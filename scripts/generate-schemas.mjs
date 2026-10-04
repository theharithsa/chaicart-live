import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const ts = require(process.env.TYPESCRIPT_PATH ?? "typescript");
const source = fs
  .readFileSync("src/content/activities.ts", "utf8")
  .replace("import paperless from './paperless.json'", "");
const js = ts.transpile(source, {
  target: ts.ScriptTarget.ES2023,
  module: ts.ModuleKind.CommonJS,
});
const exports = {};
vm.runInNewContext(js, {
  exports,
  paperless: JSON.parse(fs.readFileSync("src/content/paperless.json", "utf8")),
});
const branches = exports.ACTIVITIES.filter((a) => a.kind === "form").map(
  (a) => {
    const fields = a.fields;
    const conditions = fields.map((f) => {
      const k = JSON.stringify(f.id),
        v = `v.get(${k},${f.type === "checks" ? "[]" : f.type === "number" || f.type === "scale" ? "0" : '""'})`;
      return f.type === "number" || f.type === "scale"
        ? `(${v} is number && ${v}>=${f.min ?? 0} && ${v}<=${f.max ?? (f.type === "scale" ? 5 : 1000000)})`
        : f.type === "checks"
          ? `(${v} is list && ${v}.size()<=20)`
          : `(${v} is string && ${v}.size()<=4000)`;
    });
    return `(a==${JSON.stringify(a.id)} && v.keys().hasOnly(${JSON.stringify(fields.map((f) => f.id))}) && ${conditions.join(" && ") || "true"})`;
  },
);
branches.push(
  `(a=='timeline' && v.keys().hasOnly(['order']) && v.order is list && v.order.size()==12 && v.order.toSet().size()==12 && v.order.hasOnly(${JSON.stringify(JSON.parse(fs.readFileSync("src/content/paperless.json")).timeline.map((c) => c.id))}))`,
);
const services = JSON.parse(
  fs.readFileSync("src/content/paperless.json"),
).services.map((s) => s.id);
branches.push(
  `(a=='service-sort' && v.keys().hasOnly(${JSON.stringify(services)}) && ${services.map((k) => `v.get('${k}','') in ['','IaaS','PaaS','SaaS']`).join(" && ")})`,
);
branches.push(
  `(a=='architecture' && v.keys().hasOnly(['provider','region','components','flow','reason']) && v.provider in ['AWS','Microsoft Azure','Google Cloud','Oracle Cloud'] && v.region is string && v.region.size()<=200 && v.flow is string && v.flow.size()<=4000 && v.reason is string && v.reason.size()<=4000 && v.components is list && v.components.size()<=13 && v.components.hasOnly(['loadbalancer','web','payment','database','multiAZ','autoscaling','cdn','waf','queue','cache','fallback','monitoring','vault']))`,
);
branches.push(
  "(a=='bingo' && v.keys().hasOnly(['marks']) && v.marks is list && v.marks.size()<=24 && v.marks.hasOnly(get(/databases/$(database)/documents/sessions/$(sid)/public/workshop).data.bingoCalled))",
);
const posters = JSON.parse(
  fs.readFileSync("src/content/paperless.json"),
).posters.map((p) => p.name);
branches.push(
  `(a=='gallery' && v.keys().hasOnly(${JSON.stringify(posters)}) && ${posters.map((p) => `v.get(${JSON.stringify(p)},'') is string && v.get(${JSON.stringify(p)},'').size()<=4000`).join(" && ")})`,
);
let rules = fs.readFileSync("firestore.rules", "utf8");
if (!rules.includes("FORM_SCHEMA_PLACEHOLDER")) {
  const start = rules.indexOf("    function formValid");
  const end = rules.indexOf("\n    allow read:", start);
  rules =
    rules.slice(0, start) +
    "    function formValid(a,v){return FORM_SCHEMA_PLACEHOLDER;}" +
    rules.slice(end);
}
fs.writeFileSync(
  "firestore.rules",
  rules.replace(
    "FORM_SCHEMA_PLACEHOLDER",
    branches
      .map((b) => {
        const m = b.match(/^\(a==([^ ]+) && ([\s\S]*)\)$/);
        return `${m[1]} == a ? (${m[2]}) : `;
      })
      .join("\n       ") + "false",
  ),
);
