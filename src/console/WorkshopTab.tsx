import { workshopAction } from "../lib/workshopActions";
import { activityTitle } from "../lib/presentation";
import { useState } from "react";
import { doc, serverTimestamp, setDoc, updateDoc } from "../lib/firestore";
import { db } from "../firebase";
import { useCollectionData, useDocData } from "../lib/hooks";
import { TEAMS } from "../content/teams";
import paperless from "../content/paperless.json";
import { SCORE_RUBRICS } from "../content/workshop";
import {
  factoryMetrics,
  type FactoryTicket,
} from "../pages/student/FactoryView";
import ReviewTeam from "./ReviewTeam";
import { patchSession, type ConsoleCtx } from "./shared";
interface Review {
  teamId: string;
  activity: string;
  points: number;
  status: string;
  comment: string;
}
export default function WorkshopTab({ ctx }: { ctx: ConsoleCtx }) {
  const { sid, session, students } = ctx;
  const reviews = useCollectionData<Review>(`sessions/${sid}/reviews`) ?? [];
  const teams =
    useCollectionData<{ joinCode: string; slots: Record<string, string> }>(
      `sessions/${sid}/teams`,
    ) ?? [];
  const workshop = useDocData<{
    bingoCalled?: string[];
    awards?: { name: string; uid: string; title: string }[];
  }>(`sessions/${sid}/public/workshop`);
  const tokens =
    useCollectionData<{ activity: string; station: number; blocked: boolean }>(
      `sessions/${sid}/stationTokens`,
    ) ?? [];
  const tickets =
    useCollectionData<FactoryTicket>(`sessions/${sid}/factoryTickets`) ?? [];
  const entries =
    useCollectionData<{ name: string; url: string; shortlisted?: boolean }>(
      `sessions/${sid}/xEntries`,
    ) ?? [];
  const [team, setTeam] = useState(TEAMS[0].id);
  const [status, setStatus] = useState("");
  const [award, setAward] = useState("Best Workshop Post or Photo");
  const [winner, setWinner] = useState("");
  const [kitchenMode, setKitchenMode] = useState("pipeline");
  const [stationActivity, setStationActivity] = useState("kitchen");
  const [assignees, setAssignees] = useState<string[]>([]);
  const keys = useDocData<{ bingo: { term: string; clue: string }[] }>(
    `sessions/${sid}/private/activityKeys`,
  );
  async function run(action: () => Promise<unknown>) {
    setStatus("Working…");
    try {
      await action();
      setStatus("Confirmed.");
    } catch (e) {
      setStatus((e as Error).message);
    }
  }
  async function apply(r: Review) {
    await workshopAction({
      sid,
      action: "applyReview",
      teamId: r.teamId,
      activity: r.activity,
    });
  }
  async function freeze() {
    const { getDoc } = await import("../lib/firestore");
    const s = await getDoc(
      doc(db, `sessions/${sid}/submissions/architecture__${team}`),
    );
    if (!s.exists()) throw new Error("No architecture submitted");
    if (
      !reviews.some(
        (r) =>
          r.teamId === team &&
          r.activity === "architecture" &&
          r.status === "approved",
      )
    )
      throw new Error("Approve the architecture review first.");
    await setDoc(doc(db, `sessions/${sid}/designs/${team}`), {
      ...s.data(),
      locked: true,
      frozenAt: serverTimestamp(),
    });
  }
  async function addAward() {
    const st = students.find((s) => s.id === winner);
    if (!st) throw new Error("Choose a registered student.");
    await setDoc(
      doc(db, `sessions/${sid}/public/workshop`),
      {
        awards: [
          ...(workshop?.awards ?? []).filter((a) => a.title !== award),
          { uid: st.id, name: st.name, title: award },
        ],
      },
      { merge: true },
    );
  }
  const stations = (
    paperless.decks.find(
      (d) => d.id === (stationActivity === "kitchen" ? "kitchen" : "biz"),
    )?.cards ?? []
  ).filter((c) =>
    stationActivity === "kitchen"
      ? kitchenMode === "monolith"
        ? c.title === "The monolith"
        : c.title !== "The monolith"
      : !c.title.startsWith("Order token"),
  );
  return (
    <div className="stack">
      <div>
        <div className="kicker">Review desk</div>
        <h2>From submission to credits.</h2>
        <p>
          Captains and facilitators can review evidence and apply awards to the
          official ledger. Each reviewed award is applied once.
        </p>
      </div>
      {status && <p role="status">{status}</p>}
      <details className="card workshop-tool">
        <summary>Team codes (share with each team)</summary>
        <div className="grid4">
          {teams.map((t) => (
            <p key={t.id}>
              {TEAMS.find((team) => team.id === t.id)?.name ?? t.id}
              <br />
              <code>{t.joinCode}</code>
            </p>
          ))}
        </div>
      </details>
      <div className="card stack">
        <h3>Captain proposals</h3>
        {!reviews.length && (
          <p className="muted">
            No proposals yet. Captains will send reviewed work here.
          </p>
        )}
        {reviews.map((r) => (
          <div className="spread" key={r.id}>
            <span>
              {TEAMS.find((team) => team.id === r.teamId)?.name ?? r.teamId} ·{" "}
              {activityTitle(r.activity)} · {r.points} credits proposed
              <br />
              {r.comment}
            </span>
            <button
              className="btn sm"
              disabled={
                r.status !== "approved" ||
                !!ctx.applied[`review:${r.activity}:${r.teamId}`]
              }
              onClick={() => run(() => apply(r))}
            >
              {ctx.applied[`review:${r.activity}:${r.teamId}`]
                ? "Applied"
                : "Apply once"}
            </button>
          </div>
        ))}
      </div>
      <label className="field">
        Team
        <select value={team} onChange={(e) => setTeam(e.target.value)}>
          {TEAMS.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
      <ReviewTeam facilitator key={`${sid}:${team}`} sid={sid} teamId={team} />
      <button className="btn" onClick={() => run(freeze)}>
        Freeze approved architecture for Day2
      </button>
      <div className="card stack">
        <h3>Networking and certificates</h3>
        <button
          className="btn ghost"
          onClick={() =>
            run(() =>
              patchSession(sid, { networkingOpen: !session.networkingOpen }),
            )
          }
        >
          {session.networkingOpen
            ? "Close networking / X entries"
            : "Open networking / X entries"}
        </button>
        <p>Networking remains available while another activity is live.</p>
        <button
          className="btn"
          onClick={() =>
            run(() =>
              patchSession(sid, {
                certificatesIssued: !session.certificatesIssued,
              }),
            )
          }
        >
          {session.certificatesIssued
            ? "Withdraw certificate release"
            : "Issue participation certificates to registered students"}
        </button>
        <button
          className="btn ghost"
          onClick={() => {
            if (
              !confirm(
                session.completedAt
                  ? "Reopen this workshop?"
                  : "Mark this workshop complete and close submissions and networking?",
              )
            )
              return;
            run(() =>
              patchSession(
                sid,
                session.completedAt
                  ? { completedAt: null }
                  : {
                      completedAt: serverTimestamp(),
                      currentActivity: null,
                      networkingOpen: false,
                      state: { ...session.state, phase: "locked" },
                    },
              ),
            );
          }}
        >
          {session.completedAt ? "Reopen workshop" : "Mark workshop complete"}
        </button>
        <p>Completion is recorded separately from certificate release.</p>
        <p>
          Release only after checking attendance. Workshop date is used on every
          certificate.
        </p>
      </div>
      <details className="card workshop-tool">
        <summary>Awards</summary>
        <select
          aria-label="Award category"
          value={award}
          onChange={(e) => setAward(e.target.value)}
        >
          {[
            "Best Workshop Post or Photo",
            "Sherlock Award",
            "Best Architecture",
            "Best Blameless Postmortem",
            "Most Creative Pitch",
            "Richest Startup",
            ...["West", "South", "Central", "North"].map(
              (r) => `${r} Region Champion`,
            ),
          ].map((a) => (
            <option key={a}>{a}</option>
          ))}
        </select>
        <select
          aria-label="Award recipient"
          value={winner}
          onChange={(e) => setWinner(e.target.value)}
        >
          <option value="">Choose recipient</option>
          {students.map((s) => (
            <option value={s.id} key={s.id}>
              {s.name} · {s.teamId}
            </option>
          ))}
        </select>
        <button className="btn" onClick={() => run(addAward)}>
          Record award
        </button>
        {entries.map((e) => (
          <p key={e.id}>
            <a href={e.url} target="_blank" rel="noreferrer">
              {e.name} · {e.shortlisted ? "Shortlisted" : "X entry"}
            </a>
          </p>
        ))}
        {workshop?.awards?.map((a) => (
          <p key={a.title}>
            {a.title}: {a.name}
          </p>
        ))}
      </details>
      <details className="card workshop-tool">
        <summary>Cloud Bingo caller</summary>
        {keys?.bingo.map(({ term, clue }) => (
          <div className="spread" key={term}>
            <span>{clue}</span>
            <button
              className="btn sm ghost"
              disabled={workshop?.bingoCalled?.includes(term)}
              onClick={() =>
                run(() =>
                  setDoc(
                    doc(db, `sessions/${sid}/public/workshop`),
                    { bingoCalled: [...(workshop?.bingoCalled ?? []), term] },
                    { merge: true },
                  ),
                )
              }
            >
              {term}
            </button>
          </div>
        ))}
      </details>
      <details className="card workshop-tool">
        <summary>Digital Delivery Factory</summary>
        <p>
          Start each round for three minutes. Round1: COO serial work. Round2:
          CEO/CTO/SRE/COO pipeline. Staff judges +50 region winners from the
          metrics.
        </p>
        <div className="row">
          {[1, 2].map((round) => (
            <button
              key={round}
              className="btn"
              onClick={() =>
                run(() =>
                  setDoc(doc(db, `sessions/${sid}/public/factory`), {
                    round,
                    open: true,
                    endsAt: Date.now() + 180000,
                    startedAt: serverTimestamp(),
                  }),
                )
              }
            >
              Start round {round}
            </button>
          ))}
          <button
            className="btn ghost"
            onClick={() =>
              run(() =>
                updateDoc(doc(db, `sessions/${sid}/public/factory`), {
                  open: false,
                }),
              )
            }
          >
            Stop
          </button>
        </div>
        <div className="table-wrap">
          <table className="t">
            <thead>
              <tr>
                <th>Team</th>
                <th>Round</th>
                <th>Success</th>
                <th>Lead(s)</th>
                <th>Failures</th>
                <th>Recovery(s)</th>
              </tr>
            </thead>
            <tbody>
              {TEAMS.flatMap((t) =>
                [1, 2].map((r) => {
                  const m = factoryMetrics(
                    tickets.filter((x) => x.teamId === t.id && x.round === r),
                  );
                  return (
                    <tr key={`${t.id}:${r}`}>
                      <td>{t.name}</td>
                      <td>{r}</td>
                      <td>{m.successful}</td>
                      <td>{m.lead.toFixed(1)}</td>
                      <td>{m.failures}</td>
                      <td>{m.recovery.toFixed(1)}</td>
                    </tr>
                  );
                }),
              )}
            </tbody>
          </table>
        </div>
      </details>
      <details className="card workshop-tool">
        <summary>Station games: volunteers and tickets</summary>
        <select
          aria-label="Station activity"
          value={stationActivity}
          onChange={(e) => {
            setStationActivity(e.target.value);
            setAssignees([]);
          }}
        >
          <option value="kitchen">Human Kitchen</option>
          <option value="follow-order">Follow the Order</option>
        </select>
        {stationActivity === "kitchen" && (
          <select
            aria-label="Kitchen demonstration mode"
            value={kitchenMode}
            onChange={(e) => {
              setKitchenMode(e.target.value);
              setAssignees([]);
            }}
          >
            <option value="pipeline">Service stations</option>
            <option value="monolith">Single monolith volunteer</option>
          </select>
        )}
        {stations.map((s, i) => (
          <label className="field" key={s.title}>
            {s.title}
            <select
              value={assignees[i] ?? ""}
              onChange={(e) => {
                const a = [...assignees];
                a[i] = e.target.value;
                setAssignees(a);
              }}
            >
              <option value="">Assign volunteer</option>
              {students.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.name} · {st.teamId}
                </option>
              ))}
            </select>
          </label>
        ))}
        <button
          className="btn"
          disabled={stations.some((_, i) => !assignees[i])}
          onClick={() =>
            run(() =>
              setDoc(
                doc(
                  db,
                  `sessions/${sid}/stationTokens/${stationActivity}-${crypto.randomUUID().slice(0, 6)}`,
                ),
                {
                  activity: stationActivity,
                  station: 0,
                  blocked: false,
                  assignees: assignees.slice(0, stations.length),
                  labels: stations.map((s) => s.title),
                  createdAt: serverTimestamp(),
                },
              ),
            )
          }
        >
          Start order ticket
        </button>
        {tokens.map((t) => (
          <div key={t.id} className="spread">
            <span>
              {t.id} · station{t.station}
            </span>
            <button
              className="btn sm ghost"
              onClick={() =>
                run(() =>
                  updateDoc(doc(db, `sessions/${sid}/stationTokens/${t.id}`), {
                    blocked: !t.blocked,
                  }),
                )
              }
            >
              {t.blocked ? "Recover / resume" : "Block / simulate outage"}
            </button>
          </div>
        ))}
      </details>
      <div className="card stack">
        <h3>Overall bonuses</h3>
        <p>
          Use Leaderboard manual adjustment for overall Shark Tank/Architecture
          +100, Postmortem +75 or Treasure Hunt reflection +20. Record the award
          reason and recipient separately.
        </p>
        <p className="small">
          Rubrics: {Object.keys(SCORE_RUBRICS).length} activities. Captains
          apply reviewed credits or use a reasoned bonus/correction within their
          region.
        </p>
      </div>
    </div>
  );
}
