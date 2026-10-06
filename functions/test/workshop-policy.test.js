import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cloudQuestionResults,
  canAward,
  checkReviewLimit,
  correlationContext,
} from "../workshop-policy.js";
test("each correct participant earns 100; team aggregation uses actual participants", () => {
  const students = [
    { id: "a", teamId: "mumbai-1a" },
    { id: "b", teamId: "mumbai-1a" },
    { id: "c", teamId: "mumbai-1b" },
    { id: "d", teamId: "mumbai-1a" },
  ];
  const subs = [
    ["a", "mumbai-1a", 0],
    ["b", "mumbai-1a", 0],
    ["c", "mumbai-1b", 1],
  ].map(([uid, teamId, answer]) => ({
    uid,
    teamId,
    scope: "individual",
    activity: "cloud-or-not",
    answers: { 0: answer },
  }));
  const rows = cloudQuestionResults(students, subs, 0, 0);
  assert.deepEqual(
    rows.map((r) => r.credits),
    [100, 100, 0, 0],
  );
  assert.equal(
    rows
      .filter((r) => r.teamId === "mumbai-1a")
      .reduce((n, r) => n + r.credits, 0),
    200,
  );
});
test("captain cannot award another region or invalid teams", () => {
  assert.equal(canAward({ region: "west" }, "mumbai-1a"), true);
  assert.equal(canAward({ region: "west" }, "delhi-1a"), false);
  assert.equal(canAward({ facilitator: true }, "delhi-1a"), true);
  assert.equal(canAward({ facilitator: true }, "fake"), false);
});
test("Bingo, Gallery and Timeline winner caps remain enforced", () => {
  assert.throws(() =>
    checkReviewLimit("bingo", "mumbai-1d", 30, {
      "review:bingo:mumbai-1a": true,
      "review:bingo:mumbai-1b": true,
      "review:bingo:mumbai-1c": true,
    }),
  );
  assert.throws(() =>
    checkReviewLimit(
      "gallery",
      "mumbai-1e",
      50,
      Object.fromEntries(
        ["a", "b", "c", "d"].map((x) => [`review:gallery:mumbai-1${x}`, true]),
      ),
    ),
  );
  assert.throws(() =>
    checkReviewLimit("timeline", "mumbai-1b", 50, {
      "review:timeline:mumbai-1a": true,
    }),
  );
  assert.doesNotThrow(() =>
    checkReviewLimit("timeline", "mumbai-1b", 0, {
      "review:timeline:mumbai-1a": true,
    }),
  );
  assert.throws(() => checkReviewLimit("architecture", "mumbai-1a", 51, {}));
});

test("callable correlation accepts only valid IDs, never client-supplied identity", () => {
  const ids = {
    traceId: "1234567890abcdef1234567890abcdef",
    spanId: "1234567890abcdef",
    transactionId: "12345678-1234-1234-1234-123456789012",
  };
  assert.deepEqual(
    correlationContext({ ...ids, email: "forged@example.com" }),
    ids,
  );
  assert.equal(correlationContext({ ...ids, traceId: "0".repeat(32) }), null);
  assert.equal(
    correlationContext({ ...ids, transactionId: "not-an-id" }),
    null,
  );
});
