import { createRequire } from "node:module";
import fs from "node:fs";
const require = createRequire(import.meta.url);
const root = process.env.FIREBASE_TOOLS_LIB;
if (!root)
  throw new Error(
    "Set FIREBASE_TOOLS_LIB to the installed firebase-tools/lib directory",
  );
const auth = require(root + "/auth.js");
const account = auth.getGlobalDefaultAccount();
if (!account) throw new Error("Run firebase login first");
const tokens = await auth.getAccessToken(account.tokens.refresh_token, [
  "https://www.googleapis.com/auth/cloud-platform",
  "https://www.googleapis.com/auth/firebase",
]);
const token = tokens.access_token;
export async function api(path, options = {}) {
  const r = await fetch(path, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  if (!r.ok)
    throw new Error(`Firebase request failed: ${r.status} ${await r.text()}`);
  return r.status === 204 ? null : r.json();
}
if (process.argv[2] === "backup-rules") {
  const release = await api(
    "https://firebaserules.googleapis.com/v1/projects/chaicloud-workshop/releases/cloud.firestore",
  );
  const rules = await api(
    "https://firebaserules.googleapis.com/v1/" + release.rulesetName,
  );
  fs.writeFileSync(
    "/tmp/chaicart-live-production-rules-backup.json",
    JSON.stringify(rules, null, 2),
    { mode: 0o600 },
  );
  console.log(
    "Production rules backed up to /tmp; source files:",
    rules.source.files.map((f) => f.name),
  );
  for (const f of rules.source.files)
    fs.writeFileSync("/tmp/chaicart-live-production.rules", f.content, {
      mode: 0o600,
    });
}
