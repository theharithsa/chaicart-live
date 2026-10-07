import { spawn } from "node:child_process";
import fs from "node:fs";
// Never use the selected production alias for automated workshop rehearsals.
const secret = "functions/.secret.local";
const created = !fs.existsSync(secret);
if (created)
  fs.writeFileSync(
    secret,
    "DYNATRACE_PLATFORM_TOKEN=emulator-test-placeholder\n",
    { mode: 0o600 },
  );
const child = spawn(
  "npx",
  [
    "--yes",
    "firebase-tools",
    "emulators:exec",
    "--project",
    "demo-chaicart",
    "--only",
    "auth,firestore,functions",
    "npm run test:browser",
  ],
  {
    stdio: "inherit",
    env: { ...process.env, GCLOUD_PROJECT: "demo-chaicart" },
  },
);
child.on("error", (error) => {
  if (created) fs.rmSync(secret, { force: true });
  console.error(error.message);
  process.exitCode = 1;
});
child.on("exit", (code) => {
  if (created) fs.rmSync(secret, { force: true });
  process.exitCode = code ?? 1;
});
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
