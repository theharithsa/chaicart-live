import fs from "node:fs";
import { api } from "./firebase-rest.mjs";
const result = await api(
  "https://firebaserules.googleapis.com/v1/projects/chaicloud-workshop:test",
  {
    method: "POST",
    body: JSON.stringify({
      source: {
        files: [
          {
            name: "firestore.rules",
            content: fs.readFileSync("firestore.rules", "utf8"),
          },
        ],
      },
    }),
  },
);
console.log(JSON.stringify(result, null, 2));
if (result.issues?.some((i) => i.severity === "ERROR")) process.exitCode = 1;
