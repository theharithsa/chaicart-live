import { test } from "node:test";
import assert from "node:assert/strict";
import {
  workshopBusinessEvents,
  exportBusinessEvent,
  retryDelay,
} from "../business-events.js";
const make = (path, before, after) =>
  workshopBusinessEvents({
    sourceId: "commit-123",
    path: "sessions/WORKSHOP/" + path,
    before,
    after,
    occurredAt: "2026-10-07T08:00:00Z",
    principal: {
      uid: "fac",
      email: "fac@example.test",
      role: "facilitator",
      authType: "unknown",
    },
  });
test("session creation, separate completion and certificate release are distinct", () => {
  const build = (before, after) =>
    workshopBusinessEvents({
      sourceId: "1",
      path: "sessions/WORKSHOP",
      before,
      after,
      occurredAt: "2026-10-07T08:00:00Z",
    });
  assert.equal(
    build(null, { workshopDate: "2026-10-07" })[0].payload.type,
    "com.chaicart.workshop.session.created",
  );
  assert.ok(
    build({ certificatesIssued: false }, { certificatesIssued: true }).some(
      (e) => e.payload.type.endsWith("certificates.released"),
    ),
  );
  assert.ok(
    !build({ certificatesIssued: false }, { certificatesIssued: true }).some(
      (e) => e.payload.type.endsWith("workshop.completed"),
    ),
  );
  assert.ok(
    build({ completedAt: null }, { completedAt: {} }).some((e) =>
      e.payload.type.endsWith("workshop.completed"),
    ),
  );
});
test("joins never disclose names or join codes", () => {
  const event = make("students/student", null, {
    name: "PRIVATE NAME",
    teamId: "mumbai-1a",
    role: "CEO",
    joinCode: "PRIVATE CODE",
  })[0];
  assert.equal(event.payload.data["participant.id"], "student");
  assert.equal(event.payload.data["participant.role"], "CEO");
  assert.ok(!JSON.stringify(event).includes("PRIVATE"));
});
test("survey analytics preserve all numerical ratings and NPS, excluding free text", () => {
  for (const stage of ["pre", "post"]) {
    const data = make("submissions/survey-" + stage + "__student", null, {
      activity: "survey-" + stage,
      scope: "individual",
      uid: "student",
      teamId: "mumbai-1a",
      values: {
        c0: 2,
        c1: 4,
        nps: 9,
        hope: "PRIVATE",
        learned: "PRIVATE",
        improve: "PRIVATE",
        word: "PRIVATE",
      },
    })[0].payload.data;
    assert.deepEqual(data["survey.ratings"], { c0: 2, c1: 4 });
    assert.equal(data["survey.rating.mean"], 3);
    assert.equal(data["survey.nps"], stage === "post" ? 9 : undefined);
    assert.equal(data["survey.stage"], stage);
    assert.ok(!JSON.stringify(data).includes("PRIVATE"));
  }
});
test("votes, quiz answers and grading map the actual Firestore schemas", () => {
  assert.equal(
    make("submissions/demo-vote__mumbai-1a", null, {
      activity: "demo-vote",
      choice: "mumbai-1b",
    })[0].payload.data["vote.target.team.id"],
    "mumbai-1b",
  );
  const answers = make(
    "submissions/cloud-or-not__student",
    { answers: { 0: 1 } },
    { activity: "cloud-or-not", answers: { 0: 1, 1: 2 } },
  );
  assert.equal(answers.length, 1);
  assert.equal(answers[0].payload.data["quiz.question.index"], 1);
  const grading = make("quizResults/student", null, {
    teamId: "mumbai-1a",
    credits: 100,
    answers: { 0: { answer: 1, correct: true, credits: 100 } },
  });
  assert.equal(grading[0].payload.data["credits.delta"], 100);
  assert.equal(grading[0].payload.data["quiz.correct"], true);
  const undo = make(
    "quizResults/student",
    { credits: 100, answers: { 0: { credits: 100 } } },
    { credits: 0, answers: {} },
  );
  assert.ok(undo.some((e) => e.payload.type.endsWith("quiz.answer.reversed")));
});
test("captain reviews and ledger corrections keep award totals separate", () => {
  const review = make("reviews/architecture__mumbai-1a", null, {
    activity: "architecture",
    teamId: "mumbai-1a",
    status: "approved",
    points: 50,
    comment: "PRIVATE",
  })[0].payload.data;
  assert.equal(review["review.proposed.credits"], 50);
  assert.equal(review["review.approved"], true);
  assert.ok(!JSON.stringify(review).includes("PRIVATE"));
  const ledger = make("ledger/entry", null, {
    actor: "captain",
    actorRole: "captain",
    teamId: "mumbai-1a",
    delta: 50,
    batch: "b1",
    reason: "PRIVATE",
  })[0];
  assert.equal(ledger.payload.data["actor.role"], "captain");
  assert.equal(ledger.payload.data["credits.delta"], 50);
  assert.ok(!JSON.stringify(ledger).includes("PRIVATE"));
  assert.ok(
    make("ledger/correction", null, {
      delta: -50,
      correctionOf: "b1",
    })[0].payload.type.endsWith("credits.adjusted"),
  );
  assert.equal(make("ledger/entry", { delta: 50 }, { delta: 50 }).length, 0);
});
test("event IDs are repeatable for delivery retries and distinct for separate outcomes", () => {
  const a = make("public/leaderboard", null, {
      scores: { "mumbai-1a": 1000, "delhi-1a": 1000 },
    }),
    b = make("public/leaderboard", null, {
      scores: { "mumbai-1a": 1000, "delhi-1a": 1000 },
    });
  assert.deepEqual(a, b);
  assert.notEqual(a[0].id, a[1].id);
  assert.equal(make("private/keys", null, { answer: "PRIVATE" }).length, 0);
});
test("native BizEvents exporter uses the separate ingest API and rejects 403 and partial 400", async () => {
  let sent;
  await exportBusinessEvent(
    { id: "1", data: { score: 100 } },
    "dt0c01.test",
    async (url, options) => {
      sent = { url, options };
      return { status: 202 };
    },
  );
  assert.ok(sent.url.endsWith("/bizevents/ingest"));
  assert.equal(sent.options.headers.authorization, "Api-Token dt0c01.test");
  for (const status of [400, 403, 429, 503])
    await assert.rejects(
      exportBusinessEvent({ id: "1" }, "dt0c01.test", async () => ({ status })),
      (error) => error.status === status,
    );
  assert.equal(retryDelay(1, 403), 3600000);
  assert.ok(retryDelay(1, 503) < 3600000);
});

test("every canonical event has stable transaction correlation and valid trace/span IDs", () => {
  const paths = [
    ["sessions/CORRELATE", null, { title: "Test" }],
    [
      "sessions/CORRELATE/students/student",
      null,
      { teamId: "mumbai-1a", role: "COO" },
    ],
    [
      "sessions/CORRELATE/submissions/vote",
      null,
      { teamId: "mumbai-1a", activity: "shark-vote", choice: "mumbai-1b" },
    ],
    [
      "sessions/CORRELATE/ledger/award",
      null,
      { teamId: "mumbai-1a", delta: 100 },
    ],
    [
      "sessions/CORRELATE/submissions/survey",
      null,
      { uid: "student", activity: "survey-pre", values: { c0: 4 } },
    ],
  ];
  for (const [path, before, after] of paths) {
    const input = {
      sourceId: "commit-" + path,
      path,
      before,
      after,
      occurredAt: "2026-10-07T00:00:00Z",
    };
    const first = workshopBusinessEvents(input),
      second = workshopBusinessEvents(input);
    for (let i = 0; i < first.length; i++) {
      const data = first[i].payload.data;
      assert.match(data.trace_id, /^[0-9a-f]{32}$/);
      assert.match(data.span_id, /^[0-9a-f]{16}$/);
      assert.match(data["transaction.id"], /^audit-[0-9a-f]{64}$/);
      assert.equal(
        data["transaction.id"],
        second[i].payload.data["transaction.id"],
      );
      assert.equal(data["correlation.origin"], "firestore-audit");
    }
  }
  const data = workshopBusinessEvents({
    sourceId: "request-commit",
    path: "sessions/CORRELATE/ledger/award",
    before: null,
    after: {
      delta: 100,
      transactionId: "request-transaction",
      traceId: "a".repeat(32),
    },
    occurredAt: "2026-10-07T00:00:00Z",
  })[0].payload.data;
  assert.equal(data["transaction.id"], "request-transaction");
  assert.equal(data.trace_id, "a".repeat(32));
  assert.equal(data["correlation.origin"], "backend-request");
});
