import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(
  new URL("../functions/package.json", import.meta.url),
);
const { initializeApp, deleteApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
import {
  queueEvents,
  deliverQueuedEvent,
} from "../functions/workshop-audit.js";
let app, db;
const event = (id) => ({
  id,
  payload: {
    specversion: "1.0",
    id,
    source: "chaicart-test",
    type: "com.chaicart.test",
    data: { "credits.delta": 100 },
  },
});
before(() => {
  app = initializeApp({ projectId: "demo-chaicart" }, "business-audit");
  db = getFirestore(app);
});
after(async () => deleteApp(app));
test("duplicate commit capture creates one immutable outbox entry", async () => {
  const id = "audit-dedup";
  const counts = await Promise.all([
    queueEvents(db, [event(id)]),
    queueEvents(db, [event(id)]),
  ]);
  assert.equal(
    counts.reduce((a, b) => a + b),
    1,
  );
  assert.equal(
    (await db.doc("workshopTelemetry/" + id).get()).data().status,
    "pending",
  );
});
test("403 is retained for retry without blocking or altering workshop work", async () => {
  const id = "audit-retry";
  await queueEvents(db, [event(id)]);
  const result = await deliverQueuedEvent(db, id, {
    now: 1000,
    send: async () => {
      throw Object.assign(new Error("rejected"), { status: 403 });
    },
  });
  assert.equal(result.outcome, "retry");
  const stored = (await db.doc("workshopTelemetry/" + id).get()).data();
  assert.equal(stored.status, "pending");
  assert.equal(stored.lastStatus, 403);
  assert.equal(stored.nextAttemptAt, 3601000);
  assert.equal(stored.leaseUntil, 0);
  assert.equal(
    (
      await deliverQueuedEvent(db, id, {
        now: 2000,
        send: async () => assert.fail("too early"),
      })
    ).outcome,
    "skipped",
  );
  assert.equal(
    (await deliverQueuedEvent(db, id, { now: 3601001, send: async () => {} }))
      .outcome,
    "delivered",
  );
});
test("concurrent workers lease the same event and do not resend delivered events", async () => {
  const id = "audit-workers";
  await queueEvents(db, [event(id)]);
  let sent = 0;
  const send = async () => {
    sent++;
    await new Promise((resolve) => setTimeout(resolve, 30));
  };
  const outcomes = await Promise.all([
    deliverQueuedEvent(db, id, { send }),
    deliverQueuedEvent(db, id, { send }),
  ]);
  assert.equal(sent, 1);
  assert.ok(outcomes.some((o) => o.outcome === "delivered"));
  assert.equal((await deliverQueuedEvent(db, id, { send })).outcome, "skipped");
  assert.equal(sent, 1);
});
test("expired worker leases recover after a crash", async () => {
  const id = "audit-crash";
  await queueEvents(db, [event(id)]);
  await db
    .doc("workshopTelemetry/" + id)
    .update({ leaseUntil: 1000, leaseOwner: "dead" });
  assert.equal(
    (await deliverQueuedEvent(db, id, { now: 1001, send: async () => {} }))
      .outcome,
    "delivered",
  );
});
