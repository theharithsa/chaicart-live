import { createHash } from "node:crypto";
const PROVIDER = "chaicart-live";
const scalar = (value) =>
  ["string", "boolean", "number"].includes(typeof value) &&
  (typeof value !== "number" || Number.isFinite(value));
const team = (value) =>
  typeof value === "string" &&
  /^(mumbai|chennai|pune|delhi)-1[a-f]$/.test(value)
    ? value
    : undefined;
const safeId = (value) =>
  typeof value === "string" && /^[A-Za-z0-9_:.-]{1,120}$/.test(value)
    ? value
    : undefined;
const time = (value) =>
  value?.toDate?.().toISOString?.() ??
  (typeof value === "string" ? value : undefined);
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const numbers = (value) =>
  Object.fromEntries(
    Object.entries(value || {}).filter(
      ([k, v]) => /^[a-zA-Z0-9_-]{1,40}$/.test(k) && Number.isFinite(v),
    ),
  );
const choices = (value) =>
  Object.fromEntries(
    Object.entries(value || {}).filter(
      ([k, v]) =>
        /^[0-9]{1,3}$/.test(k) &&
        (Number.isInteger(v) || ["A", "B"].includes(v)),
    ),
  );
// Deliberate field extraction: never export document bodies, names, join codes, keys or free text.
export function workshopBusinessEvents({
  sourceId,
  path,
  before,
  after,
  occurredAt,
  principal = {},
  correlation = {},
}) {
  const parts = path.split("/");
  if (parts[0] !== "sessions" || !/^[A-Z0-9-]{4,16}$/.test(parts[1] || ""))
    return [];
  const sid = parts[1],
    collection = parts[2],
    docId = parts[3],
    data = after || before || {},
    results = [];
  const change = !before ? "created" : !after ? "deleted" : "updated";
  const auditHash = createHash("sha256")
    .update("audit:" + String(sourceId || path))
    .digest("hex");
  const validHex = (value, size) =>
    typeof value === "string" &&
    new RegExp("^[0-9a-f]{" + size + "}$").test(value) &&
    !/^0+$/.test(value);
  const common = {
    trace_id: validHex(correlation.traceId, 32)
      ? correlation.traceId
      : validHex(data.traceId, 32)
        ? data.traceId
        : auditHash.slice(0, 32),
    span_id: validHex(correlation.spanId, 16)
      ? correlation.spanId
      : auditHash.slice(32, 48),
    "transaction.id": safeId(data.transactionId) || "audit-" + auditHash,
    "correlation.origin": safeId(data.transactionId)
      ? "backend-request"
      : "firestore-audit",
    "event.provider": PROVIDER,
    "workshop.session.id": sid,
    "event.source": "firestore-commit",
    "event.authority": "server-confirmed",
    "document.collection": collection || "sessions",
    "document.change": change,
    "schema.version": 1,
    "workshop.occurred_at": occurredAt,
  };
  if (safeId(principal.uid)) common["actor.id"] = principal.uid;
  if (principal.email)
    common["actor.email"] = String(principal.email).slice(0, 200);
  if (principal.role) common["actor.role"] = principal.role;
  if (principal.authType) common["actor.auth_type"] = principal.authType;
  if (team(data.teamId)) common["workshop.team.id"] = data.teamId;
  if (safeId(data.uid)) common["participant.id"] = data.uid;
  if (safeId(data.activity)) common["workshop.activity.id"] = data.activity;
  if (safeId(data.transactionId)) common["transaction.id"] = data.transactionId;
  function add(type, extra = {}) {
    const id = createHash("sha256")
      .update(sourceId + ":" + type + ":" + results.length)
      .digest("hex");
    const fields = {
      ...common,
      ...extra,
      "event.id": id,
      "event.type": "com.chaicart.workshop." + type,
      "event.name": type,
    };
    const payload = {
      specversion: "1.0",
      id,
      source: PROVIDER,
      type: fields["event.type"],
      time: occurredAt,
      data: fields,
    };
    results.push({ id, payload });
  }
  if (parts.length === 2) {
    if (!before)
      add("session.created", {
        "workshop.date": String(after.workshopDate || "").slice(0, 20),
      });
    else if (!after) add("session.deleted");
    else {
      if (before.currentActivity !== after.currentActivity)
        add(after.currentActivity ? "activity.launched" : "activity.ended", {
          "workshop.activity.id":
            safeId(after.currentActivity || before.currentActivity) || "none",
        });
      if (!eq(before.state, after.state))
        add("activity.state.changed", {
          "workshop.activity.id": safeId(after.currentActivity) || "none",
          "activity.phase": after.state?.phase || "unknown",
          "activity.index": after.state?.index ?? 0,
        });
      if (!eq(before.timer, after.timer))
        add("timer.changed", { "timer.running": !!after.timer });
      if (before.networkingOpen !== after.networkingOpen)
        add("networking.availability.changed", {
          "networking.open": !!after.networkingOpen,
        });
      if (before.certificatesIssued !== after.certificatesIssued)
        add(
          after.certificatesIssued
            ? "certificates.released"
            : "certificates.withdrawn",
        );
      if (!before.completedAt && after.completedAt) add("workshop.completed");
      if (before.completedAt && !after.completedAt) add("workshop.reopened");
      if (!results.length) add("session.updated");
    }
  } else if (collection === "private") return [];
  else if (collection === "students") {
    add(
      !before
        ? "participant.joined"
        : !after
          ? "participant.removed"
          : "participant.updated",
      {
        "participant.id": docId,
        "participant.role": String(data.role || "").slice(0, 20),
        "workshop.team.id": team(data.teamId) || "unknown",
      },
    );
  } else if (collection === "ledger") {
    if (!after) return [];
    if (before) return [];
    add(
      data.correctionOf || Number(data.delta) < 0
        ? "credits.adjusted"
        : "credits.awarded",
      {
        "credits.delta": Number(data.delta) || 0,
        "award.batch.id": safeId(data.batch) || "unknown",
        "award.key": String(data.key || "manual").slice(0, 100),
        "actor.id": safeId(data.actor) || common["actor.id"] || "unknown",
        ...(data.actorRole ? { "actor.role": data.actorRole } : {}),
      },
    );
  } else if (collection === "submissions") {
    if (!after) {
      add("submission.removed");
      return results;
    }
    const base = {
      "submission.scope": data.scope || "team",
      "submission.id": docId,
    };
    if (data.activity === "survey-pre" || data.activity === "survey-post") {
      const values = numbers(data.values),
        ratings = Object.fromEntries(
          Object.entries(values).filter(
            ([k, v]) => /^c[0-9]$/.test(k) && v >= 0 && v <= 5,
          ),
        );
      add("survey.submitted", {
        ...base,
        "survey.stage": data.activity === "survey-pre" ? "pre" : "post",
        "survey.ratings": ratings,
        "survey.rating.count": Object.keys(ratings).length,
        "survey.rating.mean": Object.keys(ratings).length
          ? Object.values(ratings).reduce((a, b) => a + b, 0) /
            Object.keys(ratings).length
          : 0,
        ...(data.activity === "survey-post" && Number.isFinite(values.nps)
          ? { "survey.nps": values.nps }
          : {}),
      });
    } else if (typeof data.choice === "string" && team(data.choice))
      add("vote.submitted", { ...base, "vote.target.team.id": data.choice });
    else if (data.answers) {
      const next = choices(data.answers),
        prev = choices(before?.answers);
      for (const [q, answer] of Object.entries(next))
        if (!eq(prev[q], answer))
          add("quiz.answer.submitted", {
            ...base,
            "quiz.question.index": Number(q),
            "quiz.answer": answer,
          });
    } else if (data.choices) {
      for (const [q, choice] of Object.entries(choices(data.choices)))
        if (before?.choices?.[q] !== choice)
          add("game.choice.submitted", {
            ...base,
            "game.card.index": Number(q),
            "game.choice": choice,
          });
    } else
      add(data.activity === "bingo" ? "bingo.claimed" : "submission.saved", {
        ...base,
        "submission.field.count": Object.keys(data.values || {}).length,
        "submission.final": !!data.locked,
      });
  } else if (collection === "quizResults") {
    common["workshop.activity.id"] = "cloud-or-not";
    if (!after) return [];
    for (const [q, result] of Object.entries(data.answers || {}))
      if (!eq(before?.answers?.[q], result))
        add("quiz.answer.graded", {
          "participant.id": docId,
          "quiz.question.index": Number(q),
          "quiz.correct": !!result.correct,
          "credits.delta": Number(result.credits) || 0,
          "quiz.answer": scalar(result.answer) ? result.answer : null,
        });
    for (const [q, result] of Object.entries(before?.answers || {}))
      if (!Object.hasOwn(data.answers || {}, q))
        add("quiz.answer.reversed", {
          "participant.id": docId,
          "quiz.question.index": Number(q),
          "credits.delta": -Number(result.credits || 0),
        });
    if (!eq(before?.credits, data.credits))
      add("participant.score.updated", {
        "participant.id": docId,
        "credits.total": Number(data.credits) || 0,
      });
  } else if (collection === "reviews") {
    if (!after) {
      add("review.removed");
      return results;
    }
    add(data.status === "approved" ? "review.approved" : "review.saved", {
      "review.approved": data.status === "approved",
      "review.proposed.credits": Number(data.points) || 0,
    });
  } else if (collection === "public" && docId === "leaderboard") {
    if (!after) return [];
    for (const [id, total] of Object.entries(numbers(data.scores)))
      if (team(id) && before?.scores?.[id] !== total)
        add(!before ? "team.score.initialized" : "team.score.updated", {
          "workshop.team.id": id,
          "credits.total": total,
          "credits.delta":
            before?.scores && Number.isFinite(before.scores[id])
              ? total - before.scores[id]
              : 0,
        });
  } else if (collection === "public" && docId === "workshop") {
    const oldAwards = before?.awards || [];
    for (const award of after?.awards || [])
      if (!oldAwards.some((a) => eq(a, award)))
        add("individual.award.recorded", {
          "participant.id": safeId(award.uid) || "unknown",
          "award.title": String(award.title || "").slice(0, 100),
        });
    if (!results.length) add("workshop.controls.changed");
  } else if (collection === "networking") {
    for (const name of after?.completed || [])
      if (!(before?.completed || []).includes(name))
        add("networking.declared", {
          "participant.id": docId,
          "networking.platform": String(name).slice(0, 40),
          "networking.complete": true,
        });
    if (!results.length) add("networking.updated");
  } else if (collection === "staff")
    add("staff.assignment.changed", {
      "staff.role": String(data.role || "").slice(0, 20),
      "staff.region": String(data.region || "").slice(0, 20),
    });
  else if (collection === "teams")
    add(!before ? "team.created" : "team.roster.updated", {
      "workshop.team.id": team(docId) || "unknown",
      "team.roster.count": Object.keys(data.slots || {}).length,
    });
  else if (collection === "designs")
    add("architecture.frozen", {
      "workshop.team.id": team(docId) || "unknown",
    });
  else if (collection === "factoryTickets")
    add("factory.stage.changed", {
      "factory.stage": Number(data.stage) || 0,
      "factory.round": Number(data.round) || 0,
      "factory.failures": Number(data.failures) || 0,
    });
  else if (collection === "stationTokens")
    add(
      parts[4] === "events"
        ? "station.handoff.recorded"
        : "station.ticket.changed",
      { "station.name": safeId(data.station) || "unknown" },
    );
  else if (collection === "xEntries")
    add("social.entry.saved", { "participant.id": docId });
  else if (collection === "rolls") add("staff.roll.issued");
  else if (collection === "awards") add("review.award.recorded");
  else if (collection === "factoryLocks") add("factory.ticket.reserved");
  else if (collection === "public")
    add("projector.state.changed", {
      "projector.document": safeId(docId) || "unknown",
    });
  else
    add("workshop.record.changed", {
      "document.collection": safeId(collection) || "unknown",
    });
  return results;
}
export function retryDelay(attempts, status) {
  return [401, 403, 400, 413].includes(status)
    ? 3600000
    : Math.min(3600000, 15000 * 2 ** Math.min(attempts, 8));
}
export async function exportBusinessEvent(payload, token, request = fetch) {
  const response = await request(
    process.env.FUNCTIONS_EMULATOR === "true"
      ? "http://127.0.0.1:8799/api/v2/bizevents/ingest"
      : "https://indiacs.live.dynatrace.com/api/v2/bizevents/ingest",
    {
      method: "POST",
      headers: {
        "content-type": "application/cloudevents+json",
        authorization:
          (token.startsWith("dt0c01.") ? "Api-Token " : "Bearer ") + token,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    },
  );
  // One CloudEvent per request: 400 cannot be mistaken for a partially successful batch.
  if (response.status !== 202) {
    const error = new Error("Business event delivery rejected");
    error.status = response.status;
    throw error;
  }
}
