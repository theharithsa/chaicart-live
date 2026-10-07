import * as rumBusiness from "../src/lib/rum-business.js";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import * as firestore from "firebase/firestore";
import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  serverTimestamp,
  runTransaction,
} from "firebase/firestore";
const require = createRequire(import.meta.url);
const ts = require("typescript");
let env;
const claims = {
  email: "student@example.com",
  email_verified: true,
  firebase: { sign_in_provider: "google.com" },
};
const db = (uid = "coo", email = claims.email) =>
  env.authenticatedContext(uid, { ...claims, email }).firestore();
const path = (p) => `sessions/TEST/${p}`;
const base = {
  name: "Student",
  semester: "5",
  branch: "CSE",
  teamId: "mumbai-1a",
  role: "COO",
};
const sub = (activity, values) => ({
  activity,
  scope: "team",
  values,
  teamId: "mumbai-1a",
  uid: "coo",
  byName: "Student",
  updatedAt: serverTimestamp(),
});
before(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-chaicart",
    firestore: {
      rules: fs.readFileSync("firestore.rules", "utf8"),
      host: "127.0.0.1",
      port: 8185,
    },
  });
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore();
    await setDoc(doc(d, "admins/facilitator@example.com"), {
      role: "facilitator",
    });
    await setDoc(doc(d, "admins/oldcaptain@example.com"), { role: "captain" });
    await setDoc(doc(d, "sessions/TEST"), {
      currentActivity: "deploy-debate",
      state: { phase: "open", index: 0, indexedField: null },
      networkingOpen: true,
    });
    await setDoc(doc(d, path("students/coo")), base);
    await setDoc(doc(d, path("students/cto")), {
      ...base,
      name: "CTO",
      role: "CTO",
    });
    await setDoc(doc(d, path("students/other")), {
      ...base,
      teamId: "delhi-1a",
    });
    await setDoc(doc(d, path("teams/mumbai-1a")), {
      slots: { COO: "coo", CTO: "cto" },
      joinCode: "ABC",
      teamId: "mumbai-1a",
      region: "west",
    });
    await setDoc(doc(d, path("teams/mumbai-1b")), {
      slots: {},
      joinCode: "NEW",
      teamId: "mumbai-1b",
      region: "west",
    });
    await setDoc(doc(d, path("staff/captain@example.com")), {
      role: "captain",
      region: "west",
    });
    await setDoc(doc(d, path("public/leaderboard")), {
      scores: { "mumbai-1a": 1000 },
    });
    await setDoc(doc(d, path("private/activityKeys")), {
      timeline: JSON.parse(fs.readFileSync("scripts/activity-keys.json"))
        .timeline,
    });
    await setDoc(doc(d, path("private/keys")), { secret: true });
    await setDoc(doc(d, path("submissions/survey-pre__cto")), {
      activity: "survey-pre",
      scope: "individual",
      uid: "cto",
      teamId: "mumbai-1a",
      values: { hope: "private" },
    });
  });
});
after(async () => {
  await env.cleanup();
});
test("anonymous accounts cannot submit", async () => {
  const d = env
    .authenticatedContext("coo", {
      firebase: { sign_in_provider: "anonymous" },
    })
    .firestore();
  await assertFails(
    setDoc(
      doc(d, path("submissions/deploy-debate__mumbai-1a")),
      sub("deploy-debate", { model: "Public cloud", reason: "Scale" }),
    ),
  );
});
test("COO can submit valid team form; teammate cannot overwrite", async () => {
  await assertSucceeds(
    setDoc(
      doc(db(), path("submissions/deploy-debate__mumbai-1a")),
      sub("deploy-debate", { model: "Public cloud", reason: "Scale" }),
    ),
  );
  await assertFails(
    setDoc(doc(db("cto"), path("submissions/deploy-debate__mumbai-1a")), {
      ...sub("deploy-debate", { model: "Public cloud", reason: "Overwrite" }),
      uid: "cto",
      byName: "CTO",
    }),
  );
});
test("forged score fields and wrong types denied", async () => {
  await assertFails(
    setDoc(
      doc(db(), path("submissions/deploy-debate__mumbai-1a")),
      sub("deploy-debate", { total: 1000000 }),
    ),
  );
  await assertFails(
    setDoc(
      doc(db(), path("submissions/deploy-debate__mumbai-1a")),
      sub("deploy-debate", { model: 55, reason: "wrong type" }),
    ),
  );
});
test("own profile and team roster readable; other team private", async () => {
  await assertSucceeds(getDoc(doc(db(), path("students/coo"))));
  await assertSucceeds(
    getDocs(
      query(
        collection(db(), path("students")),
        where("teamId", "==", "mumbai-1a"),
      ),
    ),
  );
  await assertFails(getDoc(doc(db(), path("students/other"))));
});
test("private survey and answer keys are not readable by teammate", async () => {
  await assertFails(getDoc(doc(db(), path("submissions/survey-pre__cto"))));
  await assertFails(getDoc(doc(db(), path("private/keys"))));
  await assertSucceeds(
    getDoc(doc(db("cto"), path("submissions/survey-pre__cto"))),
  );
});
test("captain scoped to region and cannot bypass the scoring backend", async () => {
  const d = db("captain", "captain@example.com");
  await assertSucceeds(
    getDocs(
      query(
        collection(d, path("students")),
        where("teamId", "==", "mumbai-1a"),
      ),
    ),
  );
  await assertFails(getDoc(doc(d, path("students/other"))));
  await assertFails(
    updateDoc(doc(d, "sessions/TEST"), { currentActivity: "mystery" }),
  );
  await assertFails(
    updateDoc(doc(d, path("public/leaderboard")), {
      scores: { "mumbai-1a": 99999 },
    }),
  );
  await assertSucceeds(getDoc(doc(d, path("private/keys"))));
});
test("legacy captain admin entry does not grant facilitator access", async () => {
  await assertFails(
    updateDoc(doc(db("legacy", "oldcaptain@example.com"), "sessions/TEST"), {
      currentActivity: "mystery",
    }),
  );
});
test("captain review allowed only for own region", async () => {
  const d = db("captain", "captain@example.com");
  const review = {
    activity: "timeline",
    teamId: "mumbai-1a",
    region: "west",
    points: 50,
    comment: "Checked",
    status: "approved",
    actor: "captain",
    updatedAt: serverTimestamp(),
  };
  await assertSucceeds(
    setDoc(doc(d, path("reviews/timeline__mumbai-1a")), review),
  );
  await assertFails(
    setDoc(doc(d, path("reviews/timeline__delhi-1a")), {
      ...review,
      teamId: "delhi-1a",
      region: "north",
    }),
  );
});
test("networking remains open while another activity runs", async () => {
  await assertSucceeds(
    setDoc(doc(db(), path("networking/coo")), {
      teamId: "mumbai-1a",
      region: "west",
      completed: ["x"],
      updatedAt: serverTimestamp(),
    }),
  );
  await assertFails(
    setDoc(doc(db(), path("networking/coo")), {
      teamId: "mumbai-1a",
      region: "west",
      completed: ["fake"],
      updatedAt: serverTimestamp(),
    }),
  );
});
test("role claims are atomic and cannot take occupied role", async () => {
  const d = db("new");
  await assertSucceeds(
    runTransaction(d, async (tx) => {
      const t = doc(d, path("teams/mumbai-1b"));
      await tx.get(t);
      tx.update(t, { "slots.CEO": "new" });
      tx.set(doc(d, path("students/new")), {
        ...base,
        teamId: "mumbai-1b",
        role: "CEO",
        joinedAt: serverTimestamp(),
      });
    }),
  );
  const d2 = db("another");
  await assertFails(
    runTransaction(d2, async (tx) => {
      const t = doc(d2, path("teams/mumbai-1b"));
      await tx.get(t);
      tx.update(t, { "slots.CEO": "another" });
      tx.set(doc(d2, path("students/another")), {
        ...base,
        teamId: "mumbai-1b",
        role: "CEO",
        joinedAt: serverTimestamp(),
      });
    }),
  );
});
test("student cannot change team or role after joining", async () => {
  await assertFails(
    updateDoc(doc(db(), path("students/coo")), { role: "CEO" }),
  );
  await assertFails(
    updateDoc(doc(db(), path("students/coo")), { teamId: "delhi-1a" }),
  );
});
test("concurrent award invokes actual scoring transaction once, correction is append-only", async () => {
  const d = db("fac", "facilitator@example.com");
  const exports = {};
  const teams = { START_CREDITS: 1000, TEAMS: [] };
  new Function(
    "exports",
    "require",
    "crypto",
    ts.transpile(fs.readFileSync("src/lib/credits.ts", "utf8"), {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    }),
  )(
    exports,
    (name) =>
      name === "../firebase"
        ? { db: d, auth: { currentUser: { uid: "fac" } } }
        : name === "../content/teams"
          ? teams
          : name === "firebase/firestore" || name === "./firestore"
            ? firestore
            : name === "./rum-business.js"
              ? rumBusiness
              : require(name),
    crypto,
  );
  const results = await Promise.allSettled([
    exports.applyCredits(
      "TEST",
      [{ teamId: "mumbai-1a", delta: 100 }],
      "Networking",
      "test-award",
    ),
    exports.applyCredits(
      "TEST",
      [{ teamId: "mumbai-1a", delta: 100 }],
      "Networking",
      "test-award",
    ),
  ]);
  assert.equal(
    results.filter((r) => r.status === "fulfilled").length,
    1,
    results.map((r) => r.reason?.message).join(";"),
  );
  assert.equal(
    (await getDoc(doc(d, path("public/leaderboard")))).data().scores[
      "mumbai-1a"
    ],
    1100,
  );
  await exports.undoLastBatch("TEST");
  assert.equal(
    (await getDoc(doc(d, path("public/leaderboard")))).data().scores[
      "mumbai-1a"
    ],
    1000,
  );
  const entries = await getDocs(collection(d, path("ledger")));
  assert.equal(entries.size, 2);
  await assertFails(
    updateDoc(doc(d, path("ledger/" + entries.docs[0].id)), { delta: 999 }),
  );
  await assertFails(
    setDoc(doc(db(), path("ledger/fake")), { delta: 999, teamId: "mumbai-1a" }),
  );
});
test("factory cannot skip stages, backdate start or operate another role", async () => {
  const d = db();
  await setDoc(doc(db("fac", "facilitator@example.com"), "sessions/TEST"), {
    currentActivity: "factory",
    state: { phase: "open", index: 0, indexedField: null },
    networkingOpen: true,
  });
  await setDoc(
    doc(db("fac", "facilitator@example.com"), path("public/factory")),
    { round: 2, open: true, endsAt: Date.now() + 180000 },
  );
  await assertFails(
    setDoc(doc(d, path("factoryTickets/mumbai-1a__2__0")), {
      teamId: "mumbai-1a",
      round: 2,
      ticket: 0,
      stage: 4,
      failures: 0,
      startedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastBy: "coo",
    }),
  );
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), path("students/ceo")), {
      ...base,
      role: "CEO",
    });
  });
  const ceo = db("ceo");
  await assertSucceeds(
    setDoc(doc(ceo, path("factoryTickets/mumbai-1a__2__0")), {
      teamId: "mumbai-1a",
      round: 2,
      ticket: 0,
      stage: 1,
      failures: 0,
      startedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastBy: "ceo",
    }),
  );
  await assertFails(
    updateDoc(doc(d, path("factoryTickets/mumbai-1a__2__0")), {
      stage: 2,
      checksum: 10,
      updatedAt: serverTimestamp(),
      lastBy: "coo",
    }),
  );
  await assertSucceeds(
    updateDoc(doc(db("cto"), path("factoryTickets/mumbai-1a__2__0")), {
      stage: 2,
      checksum: 10,
      updatedAt: serverTimestamp(),
      lastBy: "cto",
    }),
  );
});
test("all paperless forms and studio submissions pass their schemas", async () => {
  const manifest = {};
  const source = fs
    .readFileSync("src/content/activities.ts", "utf8")
    .replace(/^import paperless from ['"]\.\/paperless\.json['"];?\r?\n/m, "");
  new Function(
    "exports",
    "paperless",
    ts.transpile(source, {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    }),
  )(manifest, JSON.parse(fs.readFileSync("src/content/paperless.json")));
  const f = db("fac", "facilitator@example.com");
  for (const a of manifest.ACTIVITIES.filter((a) => a.kind === "form")) {
    await updateDoc(doc(f, "sessions/TEST"), {
      currentActivity: a.id,
      state: { phase: "open", index: 0, indexedField: null },
    });
    const values = Object.fromEntries(
      a.fields.map((field) => [
        field.id,
        field.type === "number"
          ? (field.min ?? 0)
          : field.type === "scale"
            ? 3
            : field.type === "checks"
              ? []
              : field.type === "select"
                ? field.options[0]
                : "A useful answer",
      ]),
    );
    const individual = a.scope === "individual";
    await assertSucceeds(
      setDoc(
        doc(
          db(),
          path(`submissions/${a.id}__${individual ? "coo" : "mumbai-1a"}`),
        ),
        { ...sub(a.id, values), scope: a.scope },
      ).catch((e) => {
        e.message = `Schema ${a.id}: ${e.message}`;
        throw e;
      }),
    );
  }
  for (const [activity, values] of [
    [
      "timeline",
      {
        order: JSON.parse(
          fs.readFileSync("src/content/paperless.json"),
        ).timeline.map((c) => c.id),
      },
    ],
    [
      "service-sort",
      Object.fromEntries(
        Array.from({ length: 20 }, (_, i) => [`service-${i}`, "IaaS"]),
      ),
    ],
    [
      "architecture",
      {
        provider: "Microsoft Azure",
        region: "Central India",
        components: ["web", "database", "multiAZ"],
        flow: "web → database",
        reason: "Two zones for resilience",
      },
    ],
    ["gallery", { Netflix: "Design for failure" }],
  ]) {
    await updateDoc(doc(f, "sessions/TEST"), { currentActivity: activity });
    await assertSucceeds(
      setDoc(
        doc(db(), path(`submissions/${activity}__mumbai-1a`)),
        sub(activity, values),
      ),
    );
  }
});
test("team workspace query excludes private individual responses", async () => {
  await assertSucceeds(
    getDocs(
      query(
        collection(db(), path("submissions")),
        where("teamId", "==", "mumbai-1a"),
        where("scope", "==", "team"),
      ),
    ),
  );
  await assertFails(
    getDocs(
      query(
        collection(db(), path("submissions")),
        where("teamId", "==", "mumbai-1a"),
      ),
    ),
  );
});
test("frozen architecture cannot be changed by students", async () => {
  const f = db("fac", "facilitator@example.com");
  await setDoc(doc(f, path("designs/mumbai-1a")), {
    teamId: "mumbai-1a",
    values: { components: ["multiAZ"] },
  });
  await updateDoc(doc(f, "sessions/TEST"), { currentActivity: "architecture" });
  await assertFails(
    setDoc(
      doc(db(), path("submissions/architecture__mumbai-1a")),
      sub("architecture", {
        provider: "AWS",
        region: "Mumbai",
        components: [],
        flow: "web",
        reason: "Changed",
      }),
    ),
  );
});
test("quiz answers immutable and limited to current question", async () => {
  const f = db("fac", "facilitator@example.com");
  await updateDoc(doc(f, "sessions/TEST"), {
    currentActivity: "quiz-day1",
    state: { phase: "open", index: 0, indexedField: "answers" },
  });
  const answer = {
    activity: "quiz-day1",
    scope: "team",
    teamId: "mumbai-1a",
    uid: "coo",
    byName: "Student",
    updatedAt: serverTimestamp(),
    answers: { 0: 2 },
  };
  await assertSucceeds(
    setDoc(doc(db(), path("submissions/quiz-day1__mumbai-1a")), answer),
  );
  await assertFails(
    setDoc(doc(db(), path("submissions/quiz-day1__mumbai-1a")), {
      ...answer,
      answers: { 0: 1 },
    }),
  );
  await assertFails(
    setDoc(doc(db(), path("submissions/quiz-day1__mumbai-1a")), {
      ...answer,
      answers: { 0: 2, 1: 1 },
    }),
  );
  await updateDoc(doc(f, "sessions/TEST"), { "state.phase": "locked" });
  await assertFails(
    setDoc(doc(db(), path("submissions/quiz-day1__mumbai-1a")), answer),
  );
});
test("staff rolls cannot be forged or replaced", async () => {
  const f = db("fac", "facilitator@example.com");
  await updateDoc(doc(f, "sessions/TEST"), {
    currentActivity: "budget",
    state: { phase: "open", index: 0, indexedField: "choices" },
  });
  await setDoc(doc(f, path("rolls/mumbai-1a__0")), {
    teamId: "mumbai-1a",
    roll: 2,
  });
  const choices = {
    activity: "budget",
    scope: "team",
    teamId: "mumbai-1a",
    uid: "coo",
    byName: "Student",
    updatedAt: serverTimestamp(),
    choices: { 0: { c: "A", roll: 6 } },
  };
  await assertFails(
    setDoc(doc(db(), path("submissions/budget__mumbai-1a")), choices),
  );
  await assertSucceeds(
    setDoc(doc(db(), path("submissions/budget__mumbai-1a")), {
      ...choices,
      choices: { 0: { c: "A", roll: 2 } },
    }),
  );
  await assertFails(updateDoc(doc(f, path("rolls/mumbai-1a__0")), { roll: 6 }));
});
test("station handoff requires assigned volunteer and matching immutable event", async () => {
  const f = db("fac", "facilitator@example.com");
  await updateDoc(doc(f, "sessions/TEST"), {
    currentActivity: "kitchen",
    state: { phase: "open", index: 0, indexedField: null },
  });
  await setDoc(doc(f, path("stationTokens/token")), {
    activity: "kitchen",
    station: 0,
    blocked: false,
    assignees: ["coo", "cto"],
  });
  await assertFails(
    updateDoc(doc(db("cto"), path("stationTokens/token")), {
      station: 1,
      lastBy: "cto",
      lastName: "CTO",
      updatedAt: serverTimestamp(),
    }),
  );
  const studentDb = db();
  await assertSucceeds(
    runTransaction(studentDb, async (tx) => {
      await tx.get(doc(studentDb, path("stationTokens/token")));
      tx.update(doc(studentDb, path("stationTokens/token")), {
        station: 1,
        lastBy: "coo",
        lastName: "Student",
        updatedAt: serverTimestamp(),
      });
      tx.set(doc(studentDb, path("stationTokens/token/events/0")), {
        uid: "coo",
        name: "Student",
        station: 0,
        at: serverTimestamp(),
      });
    }),
  );
});
test("120 Google students join 24 teams with atomic five-role reservations", async () => {
  const f = db("fac", "facilitator@example.com");
  await setDoc(doc(f, "sessions/LOAD"), {
    currentActivity: null,
    state: { phase: "open", index: 0, indexedField: null },
  });
  const names = ["mumbai", "chennai", "pune", "delhi"].flatMap((city) =>
    "abcdef".split("").map((z) => `${city}-1${z}`),
  );
  await Promise.all(
    names.map((teamId) =>
      setDoc(doc(f, `sessions/LOAD/teams/${teamId}`), {
        teamId,
        slots: {},
        joinCode: "TEST",
      }),
    ),
  );
  let joined = 0;
  for (const teamId of names) {
    await Promise.all(
      ["CEO", "CTO", "SRE", "CFO", "COO"].map(async (role) => {
        const uid = `${teamId}-${role}`,
          d = db(uid);
        const exports = {};
        new Function(
          "exports",
          "require",
          ts.transpile(fs.readFileSync("src/lib/membership.ts", "utf8"), {
            module: ts.ModuleKind.CommonJS,
            target: ts.ScriptTarget.ES2022,
          }),
        )(exports, (name) =>
          name === "../firebase"
            ? { db: d }
            : name === "firebase/firestore" || name === "./firestore"
              ? firestore
              : require(name),
        );
        await exports.joinTeam("LOAD", uid, { ...base, teamId, role }, "TEST");
        joined++;
      }),
    );
  }
  assert.equal(joined, 120);
  const roster = await getDocs(collection(f, "sessions/LOAD/students"));
  assert.equal(roster.size, 120);
  for (const teamId of names) {
    const slots = (await getDoc(doc(f, `sessions/LOAD/teams/${teamId}`))).data()
      .slots;
    assert.equal(Object.keys(slots).length, 5);
  }
});

test("captains can shortlist their region X entries without changing student content", async () => {
  const student = db();
  await assertSucceeds(
    setDoc(doc(student, path("xEntries/coo")), {
      name: "Student",
      teamId: "mumbai-1a",
      region: "west",
      url: "https://x.com/example/status/123456",
      updatedAt: serverTimestamp(),
    }),
  );
  const captain = db("captain", "captain@example.com");
  await assertSucceeds(
    updateDoc(doc(captain, path("xEntries/coo")), { shortlisted: true }),
  );
  await assertFails(
    updateDoc(doc(captain, path("xEntries/coo")), {
      url: "https://x.com/other/status/123456",
    }),
  );
  await assertFails(
    updateDoc(doc(db("other"), path("xEntries/coo")), { shortlisted: false }),
  );
});

test("captain can open a new review before it exists only for their region", async () => {
  const captain = db("captain", "captain@example.com");
  const empty = await assertSucceeds(
    getDoc(doc(captain, path("reviews/network-linkedin__mumbai-1a"))),
  );
  assert.equal(empty.exists(), false);
  await assertFails(
    getDoc(doc(captain, path("reviews/network-linkedin__delhi-1a"))),
  );
  await assertFails(
    getDoc(doc(db("other"), path("reviews/network-linkedin__mumbai-1a"))),
  );
});

test("captain can read individual Cloud answers only within assigned region", async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), path("submissions/cloud-or-not__coo")), {
      activity: "cloud-or-not",
      scope: "individual",
      uid: "coo",
      teamId: "mumbai-1a",
      answers: { 0: 0 },
    });
    await setDoc(
      doc(ctx.firestore(), path("submissions/cloud-or-not__other")),
      {
        activity: "cloud-or-not",
        scope: "individual",
        uid: "other",
        teamId: "delhi-1a",
        answers: { 0: 0 },
      },
    );
    await setDoc(doc(ctx.firestore(), path("quizResults/coo")), {
      teamId: "mumbai-1a",
      credits: 100,
    });
  });
  const captain = db("captain", "captain@example.com");
  await assertSucceeds(
    getDoc(doc(captain, path("submissions/cloud-or-not__coo"))),
  );
  await assertFails(getDoc(doc(captain, path("submissions/survey-pre__coo"))));
  await assertFails(
    getDoc(doc(captain, path("submissions/cloud-or-not__other"))),
  );
  await assertSucceeds(getDoc(doc(captain, path("quizResults/coo"))));
  await assertFails(
    setDoc(doc(db(), path("quizResults/coo")), {
      credits: 99999,
      teamId: "mumbai-1a",
    }),
  );
  await assertFails(
    setDoc(doc(captain, path("awards/architecture__mumbai-1a")), {
      points: 50,
      teamId: "mumbai-1a",
    }),
  );
});

test("incorrect timeline review can be approved at zero credits", async () => {
  const captain = db("captain", "captain@example.com");
  await assertSucceeds(
    setDoc(doc(captain, path("reviews/timeline__mumbai-1b")), {
      activity: "timeline",
      teamId: "mumbai-1b",
      region: "west",
      points: 0,
      comment: "Review complete; order needs correction",
      status: "approved",
      actor: "captain",
      updatedAt: serverTimestamp(),
    }),
  );
});

test("business-event outbox is facilitator-readable and never client-writable", async () => {
  await env.withSecurityRulesDisabled(async context => setDoc(doc(context.firestore(), "workshopTelemetry/protected"), {status:"pending"}));
  await assertFails(getDoc(doc(db(), "workshopTelemetry/protected")));
  await assertFails(getDoc(doc(db("cap", "captain@example.com"), "workshopTelemetry/protected")));
  const facilitatorDb=db("fac", "facilitator@example.com");
  await assertSucceeds(getDoc(doc(facilitatorDb, "workshopTelemetry/protected")));
  await assertFails(setDoc(doc(facilitatorDb, "workshopTelemetry/forged"), {status:"delivered"}));
});
