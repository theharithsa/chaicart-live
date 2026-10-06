import { identifyRumUser } from "./rum-identity";
import { ROOT_CONTEXT, trace, SpanKind, SpanStatusCode, type Span } from "@opentelemetry/api";
import { WebTracerProvider, BatchSpanProcessor, type ReadableSpan, type SpanExporter } from "@opentelemetry/sdk-trace-web";
import { resourceFromAttributes } from "@opentelemetry/resources";
import type { User } from "firebase/auth";

type Rum = { identifyUser: (email: string) => void; reportError?: (error: string) => void };
declare global { interface Window { dtrum?: Rum } }
let user: User | null = null;
let sequence = 0;
// Activate only after the protected gateway is deployed. RUM works independently.
const enabled = import.meta.env.VITE_TELEMETRY_ENABLED === "true";
const timestamp = (time: [number, number]) => time[0] * 1000 + time[1] / 1e6;

const exporter: SpanExporter = {
  export(spans, done) {
    const actor = user;
    if (!enabled || !actor) { done({ code: 0 }); return; }
    const events = spans.filter(s => !s.attributes["telemetry.discard"] && s.attributes["actor.uid"] === actor.uid && s.attributes["auth.generation"] === sequence).map((s: ReadableSpan) => ({
      traceId: s.spanContext().traceId, spanId: s.spanContext().spanId,
      parentSpanId: s.parentSpanContext?.spanId,
      name: s.name, startedAt: timestamp(s.startTime), endedAt: timestamp(s.endTime),
      status: s.status.code, attributes: s.attributes,
    }));
    if (!events.length) { done({ code: 0 }); return; }
    void actor.getIdToken().then(token => {
      // Drop an old account's pending data instead of assigning it to a new account.
      if (user?.uid !== actor.uid) return;
      return fetch("/api/telemetry", { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer " + token }, body: JSON.stringify({ events }), keepalive: true, signal: AbortSignal.timeout(8000) });
    }).then(response => done({ code: !response || response.ok ? 0 : 1 }))
      .catch(() => done({ code: 1 }));
  },
  shutdown: async () => {},
};
const processor = new BatchSpanProcessor(exporter, { maxQueueSize: 256, maxExportBatchSize: 24, scheduledDelayMillis: 3000, exportTimeoutMillis: 10000 });
const provider = new WebTracerProvider({ resource: resourceFromAttributes({ "service.name": "chaicart-live-browser", "service.namespace": "chaicart" }), spanProcessors: [processor] });
// Explicit spans avoid competing with Dynatrace's automatic fetch/RUM instrumentation.
const tracer = provider.getTracer("chaicart.firestore");

export function setTelemetryUser(next: User | null) {
  const previous = user;
  user = next;
  if (previous?.uid !== next?.uid) sequence++;
  identifyRumUser(next?.email ?? "");
}

export function operationAttributes(path?: string): Record<string, string> {
  const parts = (path ?? "").split("/");
  const activity = parts[2] === "submissions" || parts[2] === "reviews" ? parts[3]?.split("__")[0] : undefined;
  const candidateTeam = parts[2] === "teams" ? parts[3] : ["submissions", "reviews", "architectures"].includes(parts[2]) ? parts[3]?.split("__")[1] : undefined;
  const team = /^(mumbai|chennai|pune|delhi)-1[a-f]$/.test(candidateTeam ?? "") ? candidateTeam : undefined;
  const querySession = new URLSearchParams(location.hash.split("?")[1] ?? "").get("s");
  const session = parts[0] === "sessions" ? parts[1] : querySession ?? localStorage.getItem("chaicart-session");
  // Only bounded collection names; never raw document paths, join codes or form content.
  return { "db.system.name": "firestore", "db.collection.name": parts[0] === "sessions" ? parts[2] ?? "sessions" : parts[0] ?? "unknown", ...(session ? { "workshop.session.id": session.slice(0, 40) } : {}), ...(activity ? { "workshop.activity.id": activity.slice(0, 80) } : {}), ...(team ? { "workshop.team.id": team } : {}), "telemetry.source": "client-observed" };
}

const transactions = new WeakMap<Span, string>();
export async function observe<T>(name: string, work: (span: Span) => Promise<T>, attributes: Record<string, string> = {}, parent?: Span): Promise<T> {
  const actor = user;
  const generation = sequence;
  const transaction = (parent && transactions.get(parent)) || (/^[a-f0-9-]{36}$/i.test(attributes["transaction.id"] || "") ? attributes["transaction.id"] : crypto.randomUUID());
  const span = tracer.startSpan(name, { kind: SpanKind.CLIENT, attributes: { ...attributes, ...(name.startsWith("firestore.") ? { "db.operation.name": name.slice(10) } : {}), ...(actor ? { "user.id": actor.uid, "user.email": actor.email ?? "" } : {}), "transaction.id": transaction, "actor.uid": actor?.uid ?? "anonymous", "auth.generation": generation } }, parent ? trace.setSpan(ROOT_CONTEXT, parent) : ROOT_CONTEXT);
  transactions.set(span, transaction);
  try { return await work(span); }
  catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code).slice(0, 100) : "operation-failed";
    try { window.dtrum?.reportError?.(name + ": " + code); } catch { /* Optional RUM cannot break the operation. */ }
    span.setAttribute("error.type", code);
    span.setStatus({ code: SpanStatusCode.ERROR });
    throw error;
  } finally {
    // A span belongs to the account that initiated it, even if auth changes while pending.
    if (user?.uid !== actor?.uid || sequence !== generation) span.setAttribute("telemetry.discard", true);
    span.end();
  }
}

export function reportError(code: string) {
  void observe("browser.error", async span => { span.setAttribute("error.type", code); span.setStatus({ code: SpanStatusCode.ERROR }); }).catch(() => {});
}
window.addEventListener("error", () => reportError("javascript-error"));
window.addEventListener("unhandledrejection", () => reportError("unhandled-rejection"));
window.addEventListener("pagehide", () => { void processor.forceFlush().catch(() => {}); });
