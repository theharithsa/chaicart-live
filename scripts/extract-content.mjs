import fs from "node:fs";
import vm from "node:vm";
import { createHash } from "node:crypto";
const timelineId = (text) =>
  "event-" + createHash("sha256").update(text).digest("hex").slice(0, 10);
const ref = "../workshop-reference/";
const raw = fs.readFileSync(ref + "cards.html", "utf8");
const section = raw.slice(
  raw.indexOf("const decks ="),
  raw.indexOf("const root ="),
);
const decks = vm.runInNewContext(section + "\ndecks");
const postersRaw = fs.readFileSync(ref + "gallery-posters.html", "utf8");
const posters = vm.runInNewContext(
  postersRaw.slice(
    postersRaw.indexOf("const posters ="),
    postersRaw.indexOf("const root ="),
  ) + "\nposters",
);
const bingoRaw = raw.slice(
  raw.indexOf("const bingoPool ="),
  raw.indexOf("const bingoPool =") + 5000,
);
const pool = vm.runInNewContext(
  bingoRaw.slice(0, bingoRaw.indexOf("];") + 2) + "\nbingoPool",
);
const plain = (s) =>
  (s ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const publicDecks = decks
  .filter(
    (d) => !["budget", "bill", "timeline", "service", "deploy"].includes(d.id),
  )
  .map((d) => ({
    id: d.id,
    name: d.name,
    cards: d.cards
      .filter((c) => !/answer|solution|suggested/i.test(c.t))
      .map((c) => ({ title: c.t, subtitle: c.s ?? "", body: plain(c.b) })),
  }));
const timeline = decks
  .find((d) => d.id === "timeline")
  .cards.slice(0, -1)
  .map((c) => ({ id: timelineId(c.t), text: c.t }))
  .sort((a, b) => a.text.localeCompare(b.text));
const serviceText = raw.slice(
  raw.indexOf("id: 'service'"),
  raw.indexOf("id: 'deploy'"),
);
const services = [
  ...serviceText.matchAll(/\['[^']*', '([^']*)', '([^']*)', '([^']*)'\]/g),
].map((m, i) => ({ id: `service-${i}`, name: m[1], description: m[2] }));
const serviceKeys = Object.fromEntries(
  [
    ...serviceText.matchAll(/\['[^']*', '([^']*)', '([^']*)', '([^']*)'\]/g),
  ].map((m, i) => [`service-${i}`, m[3].split(" ")[0]]),
);
const hunt = fs.readFileSync(ref + "treasure-hunt.html", "utf8");
const questions = [
  ...hunt.matchAll(
    /<div class="q"><div class="n">(\d+)<\/div><div>([\s\S]*?)<div class="pts">(\d+)<\/div><\/div>/g,
  ),
].map((m) => ({
  id: `q${m[1]}`,
  label: plain(m[2]),
  points: Number(m[3]),
  query: (m[2].match(/<pre class="dql">([\s\S]*?)<\/pre>/) ?? [])[1] ?? "",
}));
questions[8].label =
  "Inspect the deployed ChaiCart App Service in Central India. What is its public URL?";
questions[9].label =
  "Place demo orders. If Application Insights ingestion is configured, what is the peak requests/sec? Otherwise use the evidence supplied by the facilitator.";
questions[11].label =
  "Request /chai-not-found. Record the status code and where the failed request appears in the configured observability tool.";
questions[12].label =
  "If Application Insights is configured, run the supplied KQL and explain the results. Otherwise explain the prepared evidence.";
questions[13].label =
  "Inspect the workshop budget alert if configured. Why alert at 80%, and why does an alert not cap spending?";
questions[14].label =
  "Describe safe cleanup of workshop resources after the event. Do not delete the shared live demo during the workshop.";
fs.writeFileSync(
  "src/content/paperless.json",
  JSON.stringify(
    {
      decks: publicDecks,
      posters,
      timeline,
      services,
      bingo: pool.map((p) => p[0]),
      questions,
    },
    null,
    2,
  ),
);
fs.writeFileSync(
  "scripts/activity-keys.json",
  JSON.stringify(
    {
      timeline: decks
        .find((d) => d.id === "timeline")
        .cards.slice(0, -1)
        .map((c) => timelineId(c.t)),
      services: serviceKeys,
      bingo: pool,
    },
    null,
    2,
  ),
);
