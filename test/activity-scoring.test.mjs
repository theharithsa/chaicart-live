import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url),
  ts = require("typescript");
function load(path) {
  const result = {};
  new Function(
    "exports",
    ts.transpile(fs.readFileSync(path, "utf8"), {
      module: ts.ModuleKind.CommonJS,
    }),
  )(result);
  return result;
}
const budget = load("src/content/budget.ts"),
  bill = load("src/content/billshock.ts");
test("Poker uses confirmed rolls, forced cards, protection and the remaining-budget bonus", () => {
  assert.equal(budget.evaluateBudget({}, []).minutes, 43);
  const index = budget.BUDGET_CARDS.findIndex((c) => c.id === "friday");
  assert.equal(
    budget.evaluateBudget({ [index]: { c: "A", roll: 1 } }, []).minutes,
    23,
  );
  assert.equal(
    budget.evaluateBudget({ [index]: { c: "A", roll: 6 } }, []).minutes,
    43,
  );
  const zone = budget.BUDGET_CARDS.findIndex((c) => c.id === "zone");
  assert.equal(budget.evaluateBudget({ [zone]: { c: "A" } }, []).minutes, 18);
  assert.equal(
    budget.evaluateBudget({ [zone]: { c: "A" } }, ["multiAZ"]).minutes,
    43,
  );
  const completed = budget.completeChoices({}, budget.BUDGET_CARDS.length);
  for (let i = 0; i < budget.BUDGET_CARDS.length; i++)
    assert.ok(completed[String(i)], "missing card " + i);
});
test("Bill Shock gives deterministic distinct cards and refunds exactly half only for correct controls", () => {
  const cards = bill.dealBill("REHEARSAL", "mumbai-1a");
  assert.deepEqual(cards, bill.dealBill("REHEARSAL", "mumbai-1a"));
  assert.equal(new Set(cards.map((c) => c.id)).size, cards.length);
  const empty = bill.evaluateBill("REHEARSAL", "mumbai-1a", [], {});
  const correct = Object.fromEntries(
    cards.filter((c) => c.controls).map((c) => [c.id, c.controls[0]]),
  );
  const result = bill.evaluateBill("REHEARSAL", "mumbai-1a", [], correct);
  for (const r of result.cards) {
    assert.equal(
      r.refund,
      r.outcome < 0 && r.card.controls ? Math.round(-r.outcome / 2) : 0,
    );
  }
  assert.ok(result.total >= empty.total);
  assert.equal(
    result.total,
    result.cards.reduce((n, c) => n + c.outcome + c.refund, 0),
  );
});
