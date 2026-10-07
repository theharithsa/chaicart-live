import {
  onDocumentWrittenWithAuthContext,
  onDocumentCreated,
} from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret } from "firebase-functions/params";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { randomUUID } from "node:crypto";
import {
  context,
  trace,
  ROOT_CONTEXT,
  SpanKind,
  SpanStatusCode,
} from "@opentelemetry/api";
import {
  workshopBusinessEvents,
  exportBusinessEvent,
  retryDelay,
} from "./business-events.js";
import { createTelemetry } from "./telemetry.js";
const token = defineSecret("DYNATRACE_PLATFORM_TOKEN");
const collection = "workshopTelemetry";
const options = {
  region: "asia-south1",
  secrets: [token],
  maxInstances: 2,
  concurrency: 10,
  memory: "256MiB",
  timeoutSeconds: 120,
};
let telemetry;
function monitor() {
  return (telemetry ||= createTelemetry("chaicart-live-audit", {
    endpoint:
      process.env.FUNCTIONS_EMULATOR === "true"
        ? "http://127.0.0.1:8799/api/v2/otlp"
        : "https://indiacs.live.dynatrace.com/api/v2/otlp",
    token:
      process.env.FUNCTIONS_EMULATOR === "true" ? undefined : token.value(),
  }));
}
export async function queueEvents(db, events) {
  let created = 0;
  for (const event of events) {
    try {
      await db.collection(collection).doc(event.id).create({
        payload: event.payload,
        status: "pending",
        attempts: 0,
        nextAttemptAt: 0,
        leaseUntil: 0,
        createdAt: FieldValue.serverTimestamp(),
      });
      created++;
    } catch (error) {
      if (error.code !== 6 && error.code !== "already-exists") throw error;
    }
  }
  return created;
}
// Lease leaves status pending, so an instance crash is recoverable by the scheduled drain.
export async function deliverQueuedEvent(
  db,
  id,
  { send, now = Date.now() } = {},
) {
  const ref = db.collection(collection).doc(id),
    owner = randomUUID();
  const payload = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return null;
    const record = snap.data();
    if (
      record.status !== "pending" ||
      record.nextAttemptAt > now ||
      record.leaseUntil > now
    )
      return null;
    tx.update(ref, {
      leaseUntil: now + 60000,
      leaseOwner: owner,
      attempts: record.attempts + 1,
    });
    return record.payload;
  });
  if (!payload) return { outcome: "skipped" };
  const attributes = Object.fromEntries(
    Object.entries(payload.data || {}).filter(
      ([key, value]) =>
        [
          "workshop.session.id",
          "workshop.team.id",
          "workshop.activity.id",
          "participant.id",
          "actor.id",
          "actor.email",
          "actor.role",
          "transaction.id",
          "event.id",
        ].includes(key) &&
        ["string", "number", "boolean"].includes(typeof value),
    ),
  );
  try {
    await send(payload);
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (snap.data()?.leaseOwner === owner)
        tx.update(ref, {
          status: "delivered",
          deliveredAt: FieldValue.serverTimestamp(),
          leaseUntil: 0,
          lastStatus: 202,
        });
    });
    return { outcome: "delivered", type: payload.type, attributes };
  } catch (error) {
    const status = Number(error.status) || 0;
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (snap.data()?.leaseOwner === owner)
        tx.update(ref, {
          leaseUntil: 0,
          lastStatus: status,
          nextAttemptAt: now + retryDelay(snap.data().attempts, status),
        });
    });
    return { outcome: "retry", status, type: payload.type, attributes };
  }
}
async function actorContext(event, data, sid) {
  // Ledger/review actor is enforced by the scoring backend or Firestore rules.
  const path = event.data.after.ref.path;
  const recordActor = ["ledger", "reviews", "quizResults"].includes(
    path.split("/")[2],
  )
    ? data?.actor || data?.gradedBy
    : undefined;
  const sessionActor =
    path.split("/").length === 2
      ? data?.lastActorUid || data?.createdBy
      : undefined;
  const uid =
    typeof recordActor === "string"
      ? recordActor
      : typeof sessionActor === "string"
        ? sessionActor
        : event.authId;
  const principal = { authType: event.authType || "system" };
  if (!uid) return principal;
  try {
    const user = await getAuth().getUser(uid);
    principal.uid = user.uid;
    principal.email = user.email;
    if (user.email) {
      const db = getFirestore();
      const [admin, staff] = await Promise.all([
        db.doc("admins/" + user.email).get(),
        db.doc(`sessions/${sid}/staff/${user.email}`).get(),
      ]);
      principal.role =
        admin.exists && (admin.data().role || "facilitator") === "facilitator"
          ? "facilitator"
          : staff.data()?.role === "captain"
            ? "captain"
            : "student";
    }
  } catch {
    principal.authType = event.authType || "system";
  }
  return principal;
}
async function capture(event) {
  if (!event.data) return;
  const before = event.data.before.exists ? event.data.before.data() : null,
    after = event.data.after.exists ? event.data.after.data() : null;
  const path = event.data.after.ref.path;
  if (path.split("/")[2] === "private") return; // No unrevealed keys or seed-only content.
  const t = monitor();
  try {
    const principal = await actorContext(
      event,
      after || before,
      event.params.sid,
    );
    const events = workshopBusinessEvents({
      sourceId: event.id,
      path,
      before,
      after,
      occurredAt: event.time,
      principal,
    });
    const record = after || before || {};
    const validTrace =
      /^[0-9a-f]{32}$/.test(record.traceId || "") &&
      !/^0+$/.test(record.traceId);
    const validSpan =
      /^[0-9a-f]{16}$/.test(record.spanId || "") && !/^0+$/.test(record.spanId);
    const parent =
      validTrace && validSpan
        ? trace.setSpanContext(ROOT_CONTEXT, {
            traceId: record.traceId,
            spanId: record.spanId,
            traceFlags: 1,
            isRemote: true,
          })
        : ROOT_CONTEXT;
    await context.with(parent, () =>
      t.span(
        "workshop.commit.audit",
        {
          "workshop.session.id": event.params.sid,
          "audit.source.event.id": event.id,
          "audit.event.count": events.length,
          ...(principal.uid ? { "user.id": principal.uid } : {}),
          ...(principal.email ? { "user.email": principal.email } : {}),
        },
        async (span) => {
          const sc = span.spanContext();
          for (const event of events) {
            if (/^[0-9a-f]{32}$/.test(sc.traceId) && !/^0+$/.test(sc.traceId)) {
              event.payload.data.trace_id = sc.traceId;
              event.payload.data.span_id = sc.spanId;
            }
          }
          const count = await queueEvents(getFirestore(), events);
          if (count)
            for (const { payload } of events) {
              const flat = Object.fromEntries(
                Object.entries(payload.data).filter(([, v]) =>
                  ["string", "number", "boolean"].includes(typeof v),
                ),
              );
              for (const [key, value] of Object.entries(
                payload.data["survey.ratings"] || {},
              ))
                flat["survey.rating." + key] = value;
              t.log("INFO", "Workshop change committed", {
                ...flat,
                "audit.new.records": count,
              });
            }
          t.recordOperation("workshop.commit.audit", "success", 0, {
            collection: path.split("/")[2] || "sessions",
          });
        },
        SpanKind.CONSUMER,
      ),
    );
  } finally {
    await t.flush();
  }
}
export const auditWorkshopSession = onDocumentWrittenWithAuthContext(
  { ...options, document: "sessions/{sid}", retry: true },
  capture,
);
export const auditWorkshopRecords = onDocumentWrittenWithAuthContext(
  { ...options, document: "sessions/{sid}/{collection}/{record}", retry: true },
  capture,
);
export const auditStationHandoffs = onDocumentWrittenWithAuthContext(
  {
    ...options,
    document: "sessions/{sid}/stationTokens/{ticket}/events/{record}",
    retry: true,
  },
  capture,
);
async function deliver(id) {
  const t = monitor(),
    started = performance.now();
  try {
    return await t.span(
      "bizevents.deliver",
      { "business.event.id": id },
      async (span) => {
        const result = await deliverQueuedEvent(getFirestore(), id, {
          send: (payload) => exportBusinessEvent(payload, token.value()),
        });
        span.setAttributes(result.attributes || {});
        if (result.outcome === "retry") {
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: "Business event delivery rejected",
          });
          span.setAttribute("error.type", "ingest." + String(result.status));
        }
        t.log(
          result.outcome === "retry" ? "ERROR" : "INFO",
          "Business event delivery status",
          {
            ...result.attributes,
            "event.name": "business.event.delivery",
            "business.event.id": id,
            "delivery.outcome": result.outcome,
            ...(result.status
              ? { "http.response.status_code": result.status }
              : {}),
          },
        );
        t.recordOperation(
          "bizevents.deliver",
          result.outcome,
          (performance.now() - started) / 1000,
        );
        return result;
      },
    );
  } finally {
    await t.flush();
  }
}
export const deliverWorkshopBusinessEvent = onDocumentCreated(
  { ...options, document: "workshopTelemetry/{eventId}", retry: true },
  (event) => deliver(event.params.eventId),
);
export const retryWorkshopBusinessEvents = onSchedule(
  { ...options, schedule: "every 5 minutes", timeZone: "Asia/Kolkata" },
  async () => {
    const pending = await getFirestore()
      .collection(collection)
      .where("status", "==", "pending")
      .where("nextAttemptAt", "<=", Date.now())
      .orderBy("nextAttemptAt")
      .limit(40)
      .get();
    for (let i = 0; i < pending.docs.length; i += 5)
      await Promise.all(
        pending.docs.slice(i, i + 5).map((doc) => deliver(doc.id)),
      );
  },
);
