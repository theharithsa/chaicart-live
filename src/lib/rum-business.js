// RUM business events are client-observed; committed outcome counts come from server audit.
let actor = {};
const safe = (work) => {
  try {
    return work();
  } catch {
    return false;
  }
};
const scalarKeys = new Set([
  "workshop.session.id",
  "workshop.team.id",
  "workshop.activity.id",
  "participant.role",
  "credits.delta",
  "credits.total",
  "review.proposed.credits",
  "quiz.question.index",
  "quiz.answer",
  "vote.target.team.id",
  "survey.stage",
  "survey.nps",
  "submission.scope",
  "operation",
  "outcome",
  "error.type",
  "transaction.id",
  "trace_id",
  "span_id",
  "page",
  "ui.control",
  "ui.control.id",
]);
const id = (value) =>
  typeof value === "string" && /^[A-Za-z0-9_.:-]{1,100}$/.test(value);
export function setBusinessActor(user) {
  actor = user
    ? {
        "user.id": user.uid,
        ...(user.email ? { "user.email": user.email } : {}),
      }
    : {};
}
export function businessEvent(name, properties = {}) {
  const selected = safe(() => localStorage.getItem("chaicart-session"));
  const fields = {
    "event.provider": "chaicart-live-rum",
    "event.source": "browser",
    "event.authority": "client-observed",
    "event.id": safe(() => crypto.randomUUID()) || "unavailable",
    "event.name": name,
    "schema.version": 1,
    ...(selected && /^[A-Z0-9-]{4,16}$/.test(selected)
      ? { "workshop.session.id": selected }
      : {}),
    ...actor,
  };
  fields["transaction.id"] = fields["event.id"];
  fields["correlation.origin"] = properties["transaction.id"]
    ? "browser-operation"
    : "browser-event";
  for (const [key, value] of Object.entries(properties))
    if (
      scalarKeys.has(key) &&
      (["string", "boolean"].includes(typeof value) ||
        (typeof value === "number" && Number.isFinite(value)))
    )
      fields[key] = typeof value === "string" ? value.slice(0, 100) : value;
  if (properties["survey.ratings"]) {
    for (const [key, value] of Object.entries(properties["survey.ratings"]))
      if (
        /^c[0-9]$/.test(key) &&
        Number.isFinite(value) &&
        value >= 0 &&
        value <= 5
      )
        fields["survey.rating." + key] = value;
  }
  // This is native BizEvents, not dynatrace.sendEvent (which sends user.events).
  return safe(() => {
    const fn = globalThis.window?.dynatrace?.sendBizEvent;
    if (typeof fn !== "function") return false;
    fn.call(window.dynatrace, "com.chaicart.rum.workshop." + name, fields);
    return true;
  });
}
let installed = false;
export function installInteractionEvents(onInteraction) {
  if (installed || !globalThis.document) return;
  installed = true;
  document.addEventListener(
    "click",
    (event) => {
      const element = event.target?.closest?.(
        "button,a,input[type=checkbox],input[type=radio],select",
      );
      if (!element || element.disabled) return;
      const fields = {
        "transaction.id": safe(() => crypto.randomUUID()) || "unavailable",
        "ui.control": element.tagName.toLowerCase(),
        "ui.control.id": id(element.id) ? element.id : "unnamed",
        page: location.hash.split("?")[0].slice(0, 40) || "#/",
      };
      businessEvent("ui.activated", fields);
      safe(() => onInteraction?.("browser.interaction", fields));
    },
    true,
  );
  document.addEventListener(
    "submit",
    () => {
      const fields = { page: location.hash.split("?")[0].slice(0, 40) || "#/" };
      businessEvent("ui.form.submitted", fields);
      safe(() => onInteraction?.("browser.form", fields));
    },
    true,
  );
}
