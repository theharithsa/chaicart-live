import { context, ROOT_CONTEXT, trace, SpanKind } from "@opentelemetry/api";
import { defineSecret } from "firebase-functions/params";
import { createTelemetry } from "./telemetry.js";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { randomUUID } from "node:crypto";
import {
  canAward,
  cloudQuestionResults,
  checkReviewLimit,
  correlationContext,
} from "./workshop-policy.js";

const token = defineSecret("DYNATRACE_PLATFORM_TOKEN");
let telemetry;
const ACTIONS = new Set([
  "applyReview",
  "manualAward",
  "scoreCloud",
  "undoCloud",
  "deleteSession",
]);
const fail = (code, message) => {
  throw new HttpsError(code, message);
};
export async function executeWorkshopAction(db, actor, data) {
  const { sid, action } = data || {};
  if (!ACTIONS.has(action))
    fail("invalid-argument", "Unknown workshop action.");
  if (typeof sid !== "string" || !/^[A-Z0-9-]{4,16}$/.test(sid))
    fail("invalid-argument", "Invalid session code.");
  const base = db.doc(`sessions/${sid}`);
  async function access(tx) {
    const [session, admin, staff] = await Promise.all([
      tx.get(base),
      tx.get(db.doc(`admins/${actor.email}`)),
      tx.get(base.collection("staff").doc(actor.email)),
    ]);
    if (!session.exists) fail("not-found", "Session not found.");
    const facilitator =
      admin.exists && (admin.data().role ?? "facilitator") === "facilitator";
    const region =
      staff.data()?.role === "captain" ? staff.data().region : null;
    if (!facilitator && !region)
      fail("permission-denied", "Staff access is required.");
    if (session.data().deleting && action !== "deleteSession")
      fail("failed-precondition", "Session deletion is in progress.");
    return { facilitator, region, session: session.data() };
  }
  if (action === "deleteSession") {
    await db.runTransaction(async (tx) => {
      const role = await access(tx);
      if (!role.facilitator)
        fail("permission-denied", "Only facilitators can delete sessions.");
      if (data.confirm !== sid)
        fail("invalid-argument", "Type the session code to confirm deletion.");
      tx.update(base, {
        deleting: true,
        currentActivity: null,
        networkingOpen: false,
        "state.phase": "locked",
      });
    });
    // Firestore document deletion alone leaves subcollections behind. Delete recursively.
    await db.recursiveDelete(base);
    return { deleted: sid };
  }
  return db.runTransaction(async (tx) => {
    const role = await access(tx);
    const boardRef = base.collection("public").doc("leaderboard");
    const appliedRef = base.collection("private").doc("applied");
    const [board, appliedSnap] = await Promise.all([
      tx.get(boardRef),
      tx.get(appliedRef),
    ]);
    const applied = appliedSnap.data() || {};
    const scores = { ...(board.data()?.scores || {}) };
    const batch = randomUUID();
    const now = FieldValue.serverTimestamp();
    const ledger = (teamId, delta, reason, key, extra = {}) => {
      if (!delta) return;
      scores[teamId] = (scores[teamId] ?? 1000) + delta;
      tx.create(base.collection("ledger").doc(), {
        actor: actor.uid,
        ...(actor.transactionId ? { transactionId: actor.transactionId } : {}),
        ...(actor.traceId ? { traceId: actor.traceId } : {}),
        ...(actor.spanId ? { spanId: actor.spanId } : {}),
        actorRole: role.facilitator ? "facilitator" : "captain",
        batch,
        teamId,
        delta,
        reason,
        key,
        at: now,
        ...extra,
      });
    };
    const finish = () =>
      tx.set(boardRef, { scores, updatedAt: now }, { merge: true });
    if (action === "scoreCloud" || action === "undoCloud") {
      if (!role.facilitator)
        fail(
          "permission-denied",
          "Only facilitators reveal or reset global quiz questions.",
        );
      const qi = data.question;
      if (!Number.isInteger(qi) || qi < 0 || qi > 7)
        fail("invalid-argument", "Invalid question.");
      const key = `quiz:cloud-or-not:q${qi}`;
      const [keys, students, subs, results] = await Promise.all([
        tx.get(base.collection("private").doc("keys")),
        tx.get(base.collection("students")),
        tx.get(
          base
            .collection("submissions")
            .where("activity", "==", "cloud-or-not"),
        ),
        tx.get(base.collection("quizResults")),
      ]);
      const previous = new Map(results.docs.map((d) => [d.id, d.data()]));
      if (action === "undoCloud") {
        if (!applied[key])
          fail("failed-precondition", "This question has not been scored.");
        const entries = await tx.get(
          base.collection("ledger").where("key", "==", key),
        );
        const reversalsRef = base.collection("private").doc("reversals");
        const reversals = await tx.get(reversalsRef);
        const batches = new Set();
        for (const e of entries.docs) {
          const d = e.data();
          if (!d.correctionOf && !reversals.data()?.[d.batch]) {
            ledger(d.teamId, -d.delta, "Correction: Cloud or Not?", null, {
              correctionOf: d.batch,
            });
            batches.add(d.batch);
          }
        }
        for (const d of results.docs) {
          const r = d.data(),
            old = r.answers?.[qi];
          if (old)
            tx.update(d.ref, {
              [`answers.${qi}`]: FieldValue.delete(),
              credits: r.credits - old.credits,
              updatedAt: now,
            });
        }
        if (batches.size)
          tx.set(
            reversalsRef,
            Object.fromEntries([...batches].map((b) => [b, true])),
            { merge: true },
          );
        tx.set(appliedRef, { [key]: FieldValue.delete() }, { merge: true });
        finish();
        return { message: "Question credits reversed for students and teams." };
      }
      if (applied[key])
        return { message: "Question already scored; no credits added twice." };
      if (
        role.session.currentActivity !== "cloud-or-not" ||
        role.session.state.index !== qi ||
        role.session.state.phase === "open"
      )
        fail(
          "failed-precondition",
          "Lock the current question before scoring.",
        );
      const correct = keys.data()?.QUIZ_KEYS?.["cloud-or-not"]?.[qi]?.answer;
      if (!Number.isInteger(correct) || correct < 0 || correct > 2)
        fail("failed-precondition", "Quiz answer key is not available.");
      const rows = cloudQuestionResults(
        students.docs.map((d) => ({ id: d.id, ...d.data() })),
        subs.docs.map((d) => d.data()),
        qi,
        correct,
      );
      const deltas = {};
      for (const r of rows) {
        deltas[r.teamId] = (deltas[r.teamId] || 0) + r.credits;
        tx.set(
          base.collection("quizResults").doc(r.uid),
          {
            teamId: r.teamId,
            gradedBy: actor.uid,
            credits: (previous.get(r.uid)?.credits || 0) + r.credits,
            answers: {
              [qi]: {
                answer: r.answer,
                correct: r.correct,
                credits: r.credits,
              },
            },
            updatedAt: now,
          },
          { merge: true },
        );
      }
      for (const [teamId, delta] of Object.entries(deltas))
        ledger(
          teamId,
          delta,
          `Cloud or Not? · Q${qi + 1} · individual answers`,
          key,
        );
      tx.set(
        appliedRef,
        { [key]: "Cloud or Not? · 100 credits per correct participant" },
        { merge: true },
      );
      finish();
      return {
        message: `${rows.filter((r) => r.correct).length} correct participants; ${rows.reduce((n, r) => n + r.credits, 0)} credits added to their teams.`,
      };
    }
    const { teamId, activity } = data;
    if (!canAward(role, teamId))
      fail(
        "permission-denied",
        "You can award only teams in your assigned region.",
      );
    if (action === "applyReview") {
      const key = `review:${activity}:${teamId}`;
      if (applied[key])
        return { message: "Award already applied; no credits added twice." };
      const review = await tx.get(
        base.collection("reviews").doc(`${activity}__${teamId}`),
      );
      const r = review.data();
      if (!r || r.status !== "approved")
        fail("failed-precondition", "Save an approved review first.");
      try {
        checkReviewLimit(activity, teamId, r.points, applied);
      } catch (e) {
        fail("failed-precondition", e.message);
      }
      if (!r.points)
        fail(
          "failed-precondition",
          "Zero-credit feedback is saved; there is no award to apply.",
        );
      if (activity === "timeline") {
        const [sub, keys] = await Promise.all([
          tx.get(base.collection("submissions").doc(`timeline__${teamId}`)),
          tx.get(base.collection("private").doc("activityKeys")),
        ]);
        if (
          !Array.isArray(sub.data()?.values?.order) ||
          !Array.isArray(keys.data()?.timeline) ||
          keys.data().timeline.length === 0 ||
          JSON.stringify(sub.data()?.values?.order) !==
            JSON.stringify(keys.data()?.timeline)
        )
          fail(
            "failed-precondition",
            "Incorrect Timeline work can be reviewed, but cannot receive the correct-order winner award.",
          );
      }
      if (activity === "bingo") {
        const [sub, workshop] = await Promise.all([
          tx.get(base.collection("submissions").doc(`bingo__${teamId}`)),
          tx.get(base.collection("public").doc("workshop")),
        ]);
        const { validBingo } = await import("./bingo.js");
        if (
          !validBingo(
            teamId,
            sub.data()?.values?.marks || [],
            workshop.data()?.bingoCalled || [],
          )
        )
          fail("failed-precondition", "No valid called Bingo line.");
      }
      ledger(teamId, r.points, `${activity}: reviewed award`, key);
      tx.set(
        appliedRef,
        { [key]: `${activity}: reviewed award` },
        { merge: true },
      );
      tx.set(base.collection("awards").doc(`${activity}__${teamId}`), {
        activity,
        teamId,
        points: r.points,
        actor: actor.uid,
        at: now,
      });
      finish();
      return { message: `${r.points} credits awarded to the team.` };
    }
    if (action === "manualAward") {
      const { delta, reason, operationId } = data;
      if (
        !Number.isInteger(delta) ||
        !delta ||
        Math.abs(delta) > 10000 ||
        typeof reason !== "string" ||
        !reason.trim() ||
        reason.length > 500 ||
        typeof operationId !== "string" ||
        !/^[0-9a-f-]{36}$/.test(operationId) ||
        typeof activity !== "string" ||
        !/^[a-z0-9-]{1,50}$/.test(activity || "")
      )
        fail(
          "invalid-argument",
          "Enter valid credits, an activity and a specific reason.",
        );
      const key = `manual:${actor.uid}:${operationId}`;
      if (applied[key])
        return { message: "Award already applied; no credits added twice." };
      ledger(teamId, delta, `${activity}: ${reason.trim()}`, key);
      tx.set(appliedRef, { [key]: reason.trim() }, { merge: true });
      finish();
      return { message: `${delta} credits applied to the team.` };
    }
    fail("invalid-argument", "Unknown workshop action.");
  });
}
export const workshopAction = onCall(
  {
    region: "asia-south1",
    secrets: [token],
    invoker: "public",
    maxInstances: 2,
    timeoutSeconds: 540,
    memory: "256MiB",
  },
  async (request) => {
    const actor = request.auth;
    if (
      !actor ||
      !actor.token.email_verified ||
      actor.token.firebase?.sign_in_provider !== "google.com" ||
      !actor.token.email
    )
      fail("unauthenticated", "Sign in with your staff Google account.");
    if (!ACTIONS.has(request.data?.action))
      fail("invalid-argument", "Unknown workshop action.");
    const client = correlationContext(request.data?.clientContext);
    const transactionId = client?.transactionId ?? randomUUID();
    const parent = client
      ? trace.setSpanContext(ROOT_CONTEXT, {
          traceId: client.traceId,
          spanId: client.spanId,
          traceFlags: 1,
          isRemote: true,
        })
      : ROOT_CONTEXT;
    const run = () =>
      executeWorkshopAction(
        getFirestore(),
        {
          uid: actor.uid,
          email: actor.token.email,
          transactionId,
          traceId:
            trace.getSpan(context.active())?.spanContext().traceId ||
            client?.traceId,
          spanId:
            trace.getSpan(context.active())?.spanContext().spanId ||
            client?.spanId,
        },
        request.data,
      );
    if (process.env.FUNCTIONS_EMULATOR === "true") return run();
    telemetry ||= createTelemetry("chaicart-live-workshop", {
      endpoint: "https://indiacs.live.dynatrace.com/api/v2/otlp",
      token: token.value(),
    });
    const started = performance.now();
    let outcome = "success";
    try {
      return await context.with(parent, () =>
        telemetry.span(
          "workshop." + String(request.data?.action ?? "unknown"),
          {
            "user.id": actor.uid,
            "user.email": actor.token.email,
            "workshop.session.id": String(request.data?.sid ?? "").slice(0, 16),
            "transaction.id": transactionId,
          },
          async () => {
            try {
              const result = await run();
              telemetry.log("INFO", "Workshop action completed", {
                "event.name": "workshop.action.completed",
              });
              return result;
            } catch (e) {
              telemetry.log("WARN", "Workshop action rejected", {
                "error.type": String(e.code || "unknown"),
              });
              throw e;
            }
          },
          SpanKind.SERVER,
        ),
      );
    } catch (e) {
      outcome = "failure";
      throw e;
    } finally {
      telemetry.recordOperation(
        String(request.data?.action ?? "unknown").slice(0, 50),
        outcome,
        (performance.now() - started) / 1000,
      );
      await telemetry.flush();
    }
  },
);
