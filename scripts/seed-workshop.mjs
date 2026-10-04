import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import { api } from "./firebase-rest.mjs";
const require = createRequire(import.meta.url);
const ts = require(process.env.TYPESCRIPT_PATH ?? "typescript");
const keys = {};
vm.runInNewContext(
  ts.transpile(fs.readFileSync("src/admin/keys.ts", "utf8"), {
    module: ts.ModuleKind.CommonJS,
  }),
  { exports: keys },
);
const activityKeys = JSON.parse(fs.readFileSync("scripts/activity-keys.json"));
activityKeys.bingo = activityKeys.bingo.map(([term, clue]) => ({ term, clue }));
const root =
  "https://firestore.googleapis.com/v1/projects/chaicloud-workshop/databases/(default)/documents/";
const encode = (v) =>
  typeof v === "string"
    ? { stringValue: v }
    : typeof v === "boolean"
      ? { booleanValue: v }
      : typeof v === "number"
        ? { integerValue: String(v) }
        : Array.isArray(v)
          ? { arrayValue: { values: v.map(encode) } }
          : v === null
            ? { nullValue: null }
            : {
                mapValue: {
                  fields: Object.fromEntries(
                    Object.entries(v).map(([k, v]) => [k, encode(v)]),
                  ),
                },
              };
const fields = (o) =>
  Object.fromEntries(Object.entries(o).map(([k, v]) => [k, encode(v)]));
const decode = (v) =>
  v.stringValue ??
  (v.booleanValue !== undefined
    ? v.booleanValue
    : v.integerValue !== undefined
      ? Number(v.integerValue)
      : v.doubleValue !== undefined
        ? v.doubleValue
        : v.arrayValue
          ? (v.arrayValue.values ?? []).map(decode)
          : v.mapValue
            ? Object.fromEntries(
                Object.entries(v.mapValue.fields ?? {}).map(([k, v]) => [
                  k,
                  decode(v),
                ]),
              )
            : (v.timestampValue ?? null));
async function list(path) {
  let docs = [],
    page = "";
  do {
    const data = await api(
      root +
        path +
        "?pageSize=300" +
        (page ? "&pageToken=" + encodeURIComponent(page) : ""),
    );
    docs.push(...(data.documents ?? []));
    page = data.nextPageToken ?? "";
  } while (page);
  return docs.map((d) => ({
    id: d.name.split("/").at(-1),
    ...Object.fromEntries(
      Object.entries(d.fields ?? {}).map(([k, v]) => [k, decode(v)]),
    ),
  }));
}
async function patch(path, value) {
  return api(root + path, {
    method: "PATCH",
    body: JSON.stringify({ fields: fields(value) }),
  });
}
const sessions = await list("sessions");
const backup = { sessions: [] };
for (const s of sessions) {
  const students = await list(`sessions/${s.id}/students`);
  const teams = await list(`sessions/${s.id}/teams`);
  const submissions = await list(`sessions/${s.id}/submissions`);
  backup.sessions.push({ session: s, students, teams, submissions });
}
fs.writeFileSync(
  `/tmp/chaicart-live-session-backup-${Date.now()}.json`,
  JSON.stringify(backup, null, 2),
  { mode: 0o600 },
);
console.log(
  "Backed up",
  sessions.length,
  "sessions; personal records remain in /tmp only.",
);
await patch("workshopContent/keys", keys);
await patch("workshopContent/activityKeys", activityKeys);
for (const { session: s, students, teams, submissions } of backup.sessions) {
  const publicDocs = await list(`sessions/${s.id}/public`);
  if (!publicDocs.some((d) => d.id === "workshop"))
    await patch(`sessions/${s.id}/public/workshop`, {
      bingoCalled: [],
      awards: [],
    });
  await patch(`sessions/${s.id}/private/keys`, keys);
  await patch(`sessions/${s.id}/private/activityKeys`, activityKeys);
  const regionCities = {
    west: "mumbai",
    south: "chennai",
    central: "pune",
    north: "delhi",
  };
  for (const [region, city] of Object.entries(regionCities))
    for (const suffix of "abcdef") {
      const id = `${city}-1${suffix}`;
      if (teams.some((t) => t.id === id)) continue;
      const slots = {};
      const collisions = [];
      for (const st of students.filter((st) => st.teamId === id)) {
        if (slots[st.role]) collisions.push(st.id);
        else slots[st.role] = st.id;
      }
      await patch(`sessions/${s.id}/teams/${id}`, {
        teamId: id,
        region,
        joinCode: `${id.toUpperCase()}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`,
        slots,
        legacyCollisions: collisions,
      });
      if (collisions.length)
        console.log(
          "Membership collisions need facilitator review:",
          s.id,
          id,
          collisions.length,
        );
    }
  for (const sub of submissions) {
    if (!sub.scope)
      await api(
        root +
          `sessions/${s.id}/submissions/${sub.id}?updateMask.fieldPaths=scope`,
        {
          method: "PATCH",
          body: JSON.stringify({
            fields: fields({
              scope: [
                "survey-pre",
                "survey-post",
                "plan",
                "cloud-or-not",
              ].includes(sub.activity)
                ? "individual"
                : "team",
            }),
          }),
        },
      );
  }
  const mask = ["schemaVersion", "networkingOpen", "certificatesIssued"]
    .map((k) => "updateMask.fieldPaths=" + k)
    .join("&");
  await api(root + `sessions/${s.id}?${mask}`, {
    method: "PATCH",
    body: JSON.stringify({
      fields: fields({
        schemaVersion: 2,
        networkingOpen: true,
        certificatesIssued: s.certificatesIssued ?? false,
      }),
    }),
  });
}
console.log(
  "Protected answer keys and team setup seeded; existing submissions and credits untouched.",
);
