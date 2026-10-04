import { useSearchParams } from "react-router-dom";
import { ACTIVITY_BY_ID, type Activity } from "../content/activities";
import { BUDGET_CARDS } from "../content/budget";
import { HINTS } from "../content/mystery";
import {
  REGIONS,
  TEAMS,
  TEAM_BY_ID,
  START_CREDITS,
  regionName,
} from "../content/teams";
import { useCollectionData, useDocData, type WithId } from "../lib/hooks";
import { joinUrl } from "../lib/session";
import type {
  LeaderboardDoc,
  RevealDoc,
  SessionDoc,
  Student,
  Submission,
} from "../types";
import { LETTERS } from "../pages/student/shared";
import { Qr } from "../components/Qr";
import { TimerDisplay } from "../components/Timer";
import { AdminGate } from "./Console";
import { tally } from "./panels/VotePanel";

export default function Screen() {
  return <AdminGate>{() => <ScreenBody />}</AdminGate>;
}

function ScreenBody() {
  const [params] = useSearchParams();
  const sid =
    params.get("s") ?? localStorage.getItem("chaicart-console-session") ?? "";
  const base = sid ? `sessions/${sid}` : null;
  const session = useDocData<SessionDoc>(base);
  const board = useDocData<LeaderboardDoc>(
    base ? `${base}/public/leaderboard` : null,
  );
  const students = useCollectionData<Student>(base ? `${base}/students` : null);
  const activity = session?.currentActivity
    ? ACTIVITY_BY_ID[session.currentActivity]
    : null;
  const subs =
    useCollectionData<Submission>(
      base ? `${base}/submissions` : null,
      "activity",
      activity?.id ?? "__none__",
    ) ?? [];
  const reveal = useDocData<RevealDoc>(base ? `${base}/public/reveal` : null);

  if (!sid)
    return (
      <div className="empty">
        Open the screen from the console so it knows which session to show.
      </div>
    );
  if (!session) return <div className="empty">Loading session {sid}…</div>;

  const scores = board?.scores ?? {};
  const mode = session.screen;

  return (
    <div className="screen">
      <div className="spread">
        <div className="row">
          <div className="star" />
          <span className="kicker">ChaiCart Live · Session {sid}</span>
        </div>
        {session.timer && <TimerDisplay timer={session.timer} big />}
      </div>
      {mode === "join" && (
        <JoinScreen sid={sid} count={students?.length ?? 0} />
      )}
      {mode === "leaderboard" && <Board scores={scores} />}
      {mode === "activity" &&
        (activity ? (
          <ActivityScreen
            activity={activity}
            session={session}
            subs={subs}
            reveal={reveal ?? null}
            total={students?.length ?? 0}
          />
        ) : (
          <div className="empty">
            <h1>Waiting for the next activity</h1>
          </div>
        ))}
    </div>
  );
}

function JoinScreen({ sid, count }: { sid: string; count: number }) {
  return (
    <div
      className="row"
      style={{ flex: 1, justifyContent: "center", gap: "6vw" }}
    >
      <Qr
        text={joinUrl(sid)}
        size={Math.min(440, Math.round(window.innerHeight * 0.55))}
      />
      <div className="stack" style={{ gap: 20 }}>
        <h1>Scan to join</h1>
        <p style={{ fontSize: "clamp(18px, 2vw, 30px)" }}>
          or open the app and enter code
        </p>
        <div
          style={{
            fontFamily: "var(--mono)",
            fontSize: "clamp(40px, 6vw, 96px)",
            fontWeight: 700,
            letterSpacing: "0.1em",
          }}
        >
          {sid}
        </div>
        <div className="pill ok" style={{ fontSize: 22, padding: "8px 18px" }}>
          {count} / 120 joined
        </div>
      </div>
    </div>
  );
}

export function Board({ scores }: { scores: Record<string, number> }) {
  const s = (id: string) => scores[id] ?? START_CREDITS;
  const top = [...TEAMS].sort((a, b) => s(b.id) - s(a.id)).slice(0, 3);
  return (
    <div className="stack" style={{ gap: "2.5vh" }}>
      <h1>Cloud Credits</h1>
      <div className="grid2" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        {top.map((t, i) => (
          <div key={t.id} className={`card ${i === 0 ? "dark" : ""} spread`}>
            <div>
              <div
                className="kicker"
                style={i === 0 ? { color: "var(--clay)" } : undefined}
              >
                {["1st", "2nd", "3rd"][i]} overall
              </div>
              <div
                style={{
                  fontFamily: "var(--serif)",
                  fontSize: "clamp(22px, 2.4vw, 40px)",
                }}
              >
                {t.name}
              </div>
              <div className="muted">{regionName(t.region)}</div>
            </div>
            <div
              style={{
                fontFamily: "var(--serif)",
                fontSize: "clamp(28px, 3vw, 52px)",
              }}
            >
              {s(t.id).toLocaleString()}
            </div>
          </div>
        ))}
      </div>
      <div className="grid4">
        {REGIONS.map((r) => {
          const teams = TEAMS.filter((t) => t.region === r.id).sort(
            (a, b) => s(b.id) - s(a.id),
          );
          return (
            <div key={r.id} className="region-col">
              <b
                style={{
                  fontFamily: "var(--serif)",
                  fontWeight: 500,
                  fontSize: "clamp(18px, 1.6vw, 28px)",
                }}
              >
                {r.name}
              </b>
              {teams.map((t, i) => (
                <div key={t.id} className={`team-row${i === 0 ? " top" : ""}`}>
                  <span className="rk muted">{i + 1}</span>
                  <span>{t.name}</span>
                  <span className="sc">{s(t.id).toLocaleString()}</span>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ActivityScreen({
  activity,
  session,
  subs,
  reveal,
  total,
}: {
  activity: Activity;
  session: SessionDoc;
  subs: WithId<Submission>[];
  reveal: RevealDoc | null;
  total: number;
}) {
  const idx = session.state.index;
  const teamCount = new Set(subs.map((s) => s.teamId)).size;

  if (activity.kind === "quiz") {
    const q = activity.questions[idx];
    if (!q) return <h1>{activity.title}: complete</h1>;
    const counts = q.options.map(
      (_, i) =>
        subs.filter(
          (s) =>
            (s.answers as Record<string, number> | undefined)?.[String(idx)] ===
            i,
        ).length,
    );
    const answered = counts.reduce((a, b) => a + b, 0);
    const max = Math.max(1, ...counts);
    const shown =
      session.state.phase === "revealed" &&
      reveal?.activity === activity.id &&
      reveal.index === idx;
    return (
      <div className="stack" style={{ gap: "3vh" }}>
        <div className="spread">
          <span className="kicker">
            {activity.title} · Question {idx + 1} of {activity.questions.length}
          </span>
          <span className="pill" style={{ fontSize: 20 }}>
            {answered} / {activity.mode === "poll" ? total : 24}{" "}
            {activity.mode === "poll" ? "students" : "teams"} answered
          </span>
        </div>
        <h1>{q.q}</h1>
        <div className="bars">
          {q.options.map((o, i) => (
            <div
              key={i}
              className={`bar-row${shown && reveal.correct === i ? " correct" : ""}`}
            >
              <span>
                {LETTERS[i]}. {o}
              </span>
              <div className="bar-track">
                <div
                  className="bar-fill"
                  style={{
                    width:
                      shown || activity.mode === "poll"
                        ? `${(counts[i] / max) * 100}%`
                        : "0%",
                  }}
                />
              </div>
              <span className="n">
                {shown || activity.mode === "poll" ? counts[i] : ""}
              </span>
            </div>
          ))}
        </div>
        {shown && reveal.explanation && (
          <div
            className="card accent"
            style={{ fontSize: "clamp(18px, 1.8vw, 28px)" }}
          >
            {reveal.explanation}
          </div>
        )}
      </div>
    );
  }

  if (activity.kind === "vote") {
    return (
      <div className="stack" style={{ gap: "3vh" }}>
        <h1>{activity.title}</h1>
        <div className="grid4">
          {tally(subs).map((r) => (
            <div key={r.region.id} className="region-col stack">
              <b
                style={{
                  fontFamily: "var(--serif)",
                  fontWeight: 500,
                  fontSize: 24,
                }}
              >
                {r.region.name}
              </b>
              <span className="muted">{r.voted} / 6 teams voted</span>
              {session.state.phase !== "open" && r.winners.length > 0 && (
                <div style={{ fontFamily: "var(--serif)", fontSize: 32 }}>
                  {r.winners.map((w) => w.name).join(" & ")}
                </div>
              )}
            </div>
          ))}
        </div>
        {session.state.phase === "open" && (
          <p className="muted" style={{ fontSize: 22 }}>
            Results appear when voting is locked.
          </p>
        )}
      </div>
    );
  }

  if (activity.kind === "mystery") {
    return (
      <div className="stack" style={{ gap: "3vh" }}>
        <h1>Who Killed Checkout?</h1>
        <div
          className="pill clay"
          style={{ fontSize: 22, padding: "8px 18px", width: "fit-content" }}
        >
          {teamCount} / 24 accusations in
        </div>
        {HINTS.slice(0, idx).map((h, i) => (
          <div
            key={i}
            className="card accent"
            style={{ fontSize: "clamp(20px, 2vw, 32px)" }}
          >
            Hint {i + 1}: {h}
          </div>
        ))}
      </div>
    );
  }

  if (activity.kind === "budget") {
    const card = BUDGET_CARDS[idx];
    const decided = subs.filter(
      (s) => (s.choices as Record<string, unknown> | undefined)?.[String(idx)],
    ).length;
    return card ? (
      <div className="stack" style={{ gap: "3vh" }}>
        <span className="kicker">
          Error Budget Poker · Card {idx + 1} of {BUDGET_CARDS.length}
        </span>
        <h1>{card.title}</h1>
        <p style={{ fontSize: "clamp(20px, 2.2vw, 36px)" }}>{card.text}</p>
        <div className="grid2">
          <div
            className="card"
            style={{ fontSize: "clamp(18px, 1.8vw, 28px)" }}
          >
            <b>A</b> · {card.a}
          </div>
          {card.b && (
            <div
              className="card"
              style={{ fontSize: "clamp(18px, 1.8vw, 28px)" }}
            >
              <b>B</b> · {card.b}
            </div>
          )}
        </div>
        <div className="pill" style={{ fontSize: 20, width: "fit-content" }}>
          {decided} / 24 teams decided
        </div>
      </div>
    ) : (
      <h1>The month is over</h1>
    );
  }

  const regionCounts = REGIONS.map((r) => ({
    r,
    n: subs.filter((s) => TEAM_BY_ID[s.teamId]?.region === r.id).length,
  }));
  const individual =
    activity.kind === "form" && activity.scope === "individual";
  return (
    <div className="stack" style={{ gap: "3vh" }}>
      <h1>{activity.title}</h1>
      {individual ? (
        <div
          className="pill ok"
          style={{ fontSize: 28, padding: "10px 22px", width: "fit-content" }}
        >
          {subs.length} / {total} responses
        </div>
      ) : (
        <div className="grid4">
          {regionCounts.map(({ r, n }) => (
            <div key={r.id} className="region-col stack">
              <b
                style={{
                  fontFamily: "var(--serif)",
                  fontWeight: 500,
                  fontSize: 24,
                }}
              >
                {r.name}
              </b>
              <div style={{ fontFamily: "var(--serif)", fontSize: 48 }}>
                {n} / 6
              </div>
              <span className="muted">teams submitted</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
