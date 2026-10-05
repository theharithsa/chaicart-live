import { componentLabel } from "../../lib/presentation";
import { useEffect, useState } from "react";
import { doc, runTransaction, serverTimestamp } from "../../lib/firestore";
import { db } from "../../firebase";
import paperless from "../../content/paperless.json";
import type { SimpleActivity } from "../../content/activities";
import { useCollectionData, useDocData } from "../../lib/hooks";
import { submissionId, submit } from "../../lib/session";
import type { Submission } from "../../types";
import type { StudentProps } from "./shared";
import { bingoBoard } from "../../lib/bingo";
import FactoryView from "./FactoryView";
import TimelineOrder from "../../components/TimelineOrder";

const COMPONENTS = [
  "loadbalancer",
  "web",
  "payment",
  "database",
  "multiAZ",
  "autoscaling",
  "cdn",
  "waf",
  "queue",
  "cache",
  "fallback",
  "monitoring",
  "vault",
];
export default function StudioView(
  props: StudentProps & { activity: SimpleActivity },
) {
  const { sid, uid, student, session, activity } = props;
  const sub = useDocData<Submission>(
    `sessions/${sid}/submissions/${submissionId(activity.id, student.teamId)}`,
  );
  const workshop = useDocData<{ bingoCalled?: string[] }>(
    `sessions/${sid}/public/workshop`,
  );
  const key = `draft:${sid}:${activity.id}:${uid}`;
  const [draft, setDraft] = useState<Record<string, unknown> | null>(() => {
    try {
      return JSON.parse(localStorage.getItem(key) ?? "null");
    } catch {
      return null;
    }
  });
  const values =
    draft ?? (sub?.values as Record<string, unknown> | undefined) ?? {};
  const [status, setStatus] = useState("");
  useEffect(() => {
    if (draft) localStorage.setItem(key, JSON.stringify(draft));
  }, [key, draft]);
  const edit = (field: string, value: unknown) =>
    setDraft({ ...values, [field]: value });
  const open =
    session.currentActivity === activity.id && session.state.phase === "open";
  const canSubmit = open && student.role === "COO" && !sub?.locked;
  const order =
    (values.order as string[] | undefined) ??
    paperless.timeline.map((c) => c.id);
  const selected = (values.components as string[] | undefined) ?? [];
  const marks = (values.marks as string[] | undefined) ?? [];
  const called = workshop?.bingoCalled ?? [];
  const bingo = bingoBoard(student.teamId);
  async function save() {
    setStatus("Pending server confirmation…");
    try {
      const data = {
        values: activity.id === "timeline" ? { ...values, order } : values,
      };
      if (activity.id === "timeline") {
        try {
          await submit(sid, activity.id, "team", uid, student, {
            ...data,
            locked: true,
          });
        } catch {
          await submit(sid, activity.id, "team", uid, student, {
            ...data,
            locked: false,
          });
          setStatus(
            "Order saved but not correct yet. Keep discussing and submit again.",
          );
          return;
        }
      } else {
        await submit(sid, activity.id, "team", uid, student, data);
      }
      setStatus("Submitted and confirmed.");
      localStorage.removeItem(key);
    } catch (e) {
      setStatus((e as Error).message);
    }
  }
  if (activity.id === "factory") return <FactoryView {...props} />;
  return (
    <div className="stack">
      {activity.id === "timeline" && (
        <TimelineOrder
          cards={paperless.timeline}
          order={order}
          disabled={!open || !!sub?.locked}
          onChange={(next) => edit("order", next)}
        />
      )}
      {activity.id === "service-sort" &&
        paperless.services.map((c) => (
          <label key={c.id} className="card field">
            <b>{c.name}</b>
            <span className="small">{c.description}</span>
            <select
              disabled={!open}
              value={String(values[c.id] ?? "")}
              onChange={(e) => edit(c.id, e.target.value)}
            >
              <option value="">Choose model</option>
              {["IaaS", "PaaS", "SaaS"].map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </label>
        ))}
      {activity.id === "bingo" && (
        <>
          <div className="bingo-board">
            {bingo.map((term) => (
              <button
                className={`btn ${marks.includes(term) || term === "FREE" ? "" : "ghost"}`}
                key={term}
                disabled={!open || term === "FREE" || !called.includes(term)}
                onClick={() =>
                  edit(
                    "marks",
                    marks.includes(term)
                      ? marks.filter((x) => x !== term)
                      : [...marks, term],
                  )
                }
              >
                {term}
              </button>
            ))}
          </div>
          <p>
            Only called terms can be marked. Your captain validates a full line
            and the facilitator awards the first three claims.
          </p>
        </>
      )}
      {activity.id === "architecture" && (
        <div className="card stack">
          <label className="field">
            Cloud provider
            <select
              value={String(values.provider ?? "")}
              onChange={(e) => edit("provider", e.target.value)}
              disabled={!open}
            >
              <option value="">Choose</option>
              {["AWS", "Microsoft Azure", "Google Cloud", "Oracle Cloud"].map(
                (p) => (
                  <option key={p}>{p}</option>
                ),
              )}
            </select>
          </label>
          <label className="field">
            Region / zones
            <input
              value={String(values.region ?? "")}
              onChange={(e) => edit("region", e.target.value)}
              disabled={!open}
            />
          </label>
          <div className="checks">
            {COMPONENTS.map((c) => (
              <label key={c} className="check">
                <input
                  type="checkbox"
                  checked={selected.includes(c)}
                  disabled={!open}
                  onChange={(e) =>
                    edit(
                      "components",
                      e.target.checked
                        ? [...selected, c]
                        : selected.filter((x) => x !== c),
                    )
                  }
                />
                {componentLabel(c)}
              </label>
            ))}
          </div>
          <label className="field">
            Request flow (one connection per line, e.g. web → payment →
            database)
            <textarea
              value={String(values.flow ?? "")}
              disabled={!open}
              onChange={(e) => edit("flow", e.target.value)}
            />
          </label>
          <div className="architecture-flow">
            {String(
              values.flow ??
                "Client → load balancer → web → payment → database",
            )
              .split("\n")
              .map((line, i) => (
                <div className="card small" key={i}>
                  {line}
                </div>
              ))}
          </div>
          <label className="field">
            Why these choices? Failure protection, scale, security and cost
            <textarea
              disabled={!open}
              value={String(values.reason ?? "")}
              onChange={(e) => edit("reason", e.target.value)}
            />
          </label>
          <p className="small">
            Your captain reviews the submitted design. The facilitator freezes
            approved designs before Day2 games.
          </p>
        </div>
      )}
      {activity.id === "gallery" && (
        <>
          {paperless.posters.map((p) => (
            <div key={p.name} className="card stack">
              <h3>
                {p.icon} {p.name}
              </h3>
              <p>{p.challenge}</p>
              <p>{p.did}</p>
              <p className="small">{p.concepts.join(" · ")}</p>
              <label className="field">
                {p.q}
                <textarea
                  disabled={!open}
                  value={String(values[p.name] ?? "")}
                  onChange={(e) => edit(p.name, e.target.value)}
                />
              </label>
            </div>
          ))}
        </>
      )}
      {["kitchen", "follow-order"].includes(activity.id) && (
        <StationGame {...props} />
      )}
      {!["kitchen", "follow-order"].includes(activity.id) && (
        <>
          <p className="small muted">
            Drafts stay on this device. COO submits the team answer; captain
            reviews it. {sub ? `Last submission: ${sub.byName}` : ""}
          </p>
          <button className="btn block" disabled={!canSubmit} onClick={save}>
            {activity.id === "bingo" ? "Claim bingo" : "Submit team answer"}
          </button>
        </>
      )}
      {status && <p role="status">{status}</p>}
    </div>
  );
}

function StationGame({
  sid,
  uid,
  student,
  session,
  activity,
}: StudentProps & { activity: SimpleActivity }) {
  const stations =
    paperless.decks.find(
      (d) => d.id === (activity.id === "kitchen" ? "kitchen" : "biz"),
    )?.cards ?? [];
  const tokens =
    useCollectionData<{
      station: number;
      blocked: boolean;
      assignees: string[];
      labels?: string[];
    }>(`sessions/${sid}/stationTokens`, "activity", activity.id) ?? [];
  const [message, setMessage] = useState("");
  const open = session.state.phase === "open";
  async function next(id: string) {
    setMessage("");
    try {
      await runTransaction(db, async (tx) => {
        const ref = doc(db, `sessions/${sid}/stationTokens/${id}`);
        const snap = await tx.get(ref);
        if (!snap.exists() || snap.data().blocked)
          throw new Error("Token is blocked. Facilitator must restore it.");
        tx.update(ref, {
          station: snap.data().station + 1,
          lastBy: uid,
          lastName: student.name,
          updatedAt: serverTimestamp(),
        });
        tx.set(
          doc(
            db,
            `sessions/${sid}/stationTokens/${id}/events/${snap.data().station}`,
          ),
          {
            uid,
            name: student.name,
            station: snap.data().station,
            at: serverTimestamp(),
          },
        );
      });
      setMessage("Handoff confirmed.");
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  return (
    <div className="stack">
      {stations.map((s, i) => (
        <div className="card stack" key={s.title}>
          <h3>
            {i + 1}. {s.title}
          </h3>
          <p>{s.subtitle}</p>
          <p>{s.body}</p>
        </div>
      ))}
      <h3>Live order tickets</h3>
      {tokens.map((t) => (
        <div className="card stack" key={t.id}>
          <b>
            {t.id} ·{" "}
            {t.labels?.[t.station] ?? stations[t.station]?.title ?? "Complete"}
          </b>
          <span>
            {t.blocked
              ? "Blocked: discuss queueing and recovery"
              : "Ready to hand off"}
          </span>
          <button
            className="btn"
            disabled={
              !open ||
              t.blocked ||
              t.station >= t.assignees.length ||
              t.assignees[t.station] !== uid
            }
            onClick={() => next(t.id)}
          >
            I am this station: hand off
          </button>
          <TokenHistory sid={sid} id={t.id} />
        </div>
      ))}
      {!tokens.length && (
        <p>
          The facilitator starts order tickets and assigns volunteers from
          Workshop review.
        </p>
      )}
      {message && <p role="status">{message}</p>}
    </div>
  );
}
function TokenHistory({ sid, id }: { sid: string; id: string }) {
  const events =
    useCollectionData<{
      name: string;
      station: number;
      at: { toDate?: () => Date };
    }>(`sessions/${sid}/stationTokens/${id}/events`) ?? [];
  return (
    <ul className="small">
      {events.map((e) => (
        <li key={e.id}>
          {e.name} · station {e.station} ·{" "}
          {e.at?.toDate?.().toLocaleTimeString()}
        </li>
      ))}
    </ul>
  );
}
