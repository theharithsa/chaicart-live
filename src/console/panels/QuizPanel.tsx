import { useState } from "react";
import { doc, setDoc } from "../../lib/firestore";
import { db } from "../../firebase";
import type { QuizActivity } from "../../content/activities";
import { TEAMS } from "../../content/teams";
import { useDocData } from "../../lib/hooks";
import { applyCredits } from "../../lib/credits";
import { LETTERS } from "../../pages/student/shared";
import { patchSession, type PanelProps } from "../shared";

type Keys = typeof import("../../admin/keys");

export function useKeys(sid: string) {
  return useDocData<Keys>(`sessions/${sid}/private/keys`);
}

export default function QuizPanel({
  ctx,
  activity,
  subs,
  isLive,
}: PanelProps & { activity: QuizActivity }) {
  const keys = useKeys(ctx.sid);
  const [msg, setMsg] = useState("");
  const { sid, session, students } = ctx;
  const idx = isLive ? session.state.index : 0;
  const q = activity.questions[idx];
  const key = keys?.QUIZ_KEYS[activity.id]?.[idx];
  const counts = q
    ? q.options.map(
        (_, i) =>
          subs.filter(
            (s) =>
              (s.answers as Record<string, number> | undefined)?.[
                String(idx)
              ] === i,
          ).length,
      )
    : [];
  const expected =
    activity.mode === "poll"
      ? students.length
      : new Set(students.map((s) => s.teamId)).size;
  const answered = counts.reduce((a, b) => a + b, 0);
  const max = Math.max(1, ...counts);
  const revealed = isLive && session.state.phase === "revealed";
  const qKey = (qi: number) => `quiz:${activity.id}:q${qi}`;
  const scoredCount = activity.questions.filter(
    (_, qi) => ctx.applied[qKey(qi)],
  ).length;

  const go = (i: number) =>
    patchSession(sid, { "state.index": i, "state.phase": "open" });

  function questionCredits(qi: number) {
    const answer = keys?.QUIZ_KEYS[activity.id]?.[qi]?.answer;
    return TEAMS.map((t) => ({
      teamId: t.id,
      delta:
        answer !== undefined &&
        subs.some(
          (s) =>
            s.teamId === t.id &&
            (s.answers as Record<string, number> | undefined)?.[String(qi)] ===
              answer,
        )
          ? activity.points
          : 0,
    }));
  }

  async function reveal() {
    await patchSession(sid, { "state.phase": "locked" });
    await setDoc(doc(db, `sessions/${sid}/public/reveal`), {
      activity: activity.id,
      index: idx,
      correct: key?.answer ?? null,
      explanation: key?.why ?? "",
    });
    await patchSession(sid, { "state.phase": "revealed" });
    // Each question is credited once; Undo in the Leaderboard tab clears the marker so it can be re-scored.
    if (activity.mode === "quiz" && key && !ctx.applied[qKey(idx)]) {
      const changes = questionCredits(idx);
      const total = changes.reduce((s, c) => s + c.delta, 0);
      const n = await applyCredits(
        sid,
        changes,
        `${activity.title} · Q${idx + 1}`,
        qKey(idx),
      );
      setMsg(
        n
          ? `Q${idx + 1}: ${total} credits added across ${n} teams.`
          : `Q${idx + 1}: no team scored.`,
      );
    }
  }

  return (
    <div className="stack">
      {!isLive && (
        <p className="muted">
          Launch the activity to control questions. Preview of question 1 below.
        </p>
      )}
      {q ? (
        <div className="card stack">
          <div className="spread">
            <span className="muted small">
              Question {idx + 1} of {activity.questions.length}
            </span>
            <span className="pill">
              {answered} / {expected}{" "}
              {activity.mode === "poll" ? "students" : "teams"} answered
            </span>
          </div>
          <h3 style={{ fontSize: 22 }}>{q.q}</h3>
          <div className="bars">
            {q.options.map((o, i) => (
              <div
                key={i}
                className={`bar-row${revealed && key?.answer === i ? " correct" : ""}`}
              >
                <span>
                  {LETTERS[i]}. {o}
                  {key?.answer === i ? " ✓" : ""}
                </span>
                <div className="bar-track">
                  <div
                    className="bar-fill"
                    style={{ width: `${(counts[i] / max) * 100}%` }}
                  />
                </div>
                <span className="n">{counts[i]}</span>
              </div>
            ))}
          </div>
          {key && <p className="small muted">Explanation: {key.why}</p>}
          {isLive && (
            <div className="row">
              <button
                className="btn ghost"
                disabled={idx === 0}
                onClick={() => go(idx - 1)}
              >
                Previous
              </button>
              <button
                className="btn ghost"
                onClick={() => patchSession(sid, { "state.phase": "locked" })}
              >
                Lock answers
              </button>
              <button className="btn clay" disabled={!keys} onClick={reveal}>
                {activity.mode === "quiz"
                  ? "Reveal and score"
                  : "Reveal answer"}
              </button>
              <button
                className="btn"
                disabled={idx >= activity.questions.length - 1}
                onClick={() => go(idx + 1)}
              >
                Next question
              </button>
            </div>
          )}
          {isLive && activity.mode === "quiz" && ctx.applied[qKey(idx)] && (
            <span className="pill ok">Question {idx + 1} scored</span>
          )}
        </div>
      ) : (
        <div className="card empty">All questions done.</div>
      )}
      {activity.mode === "quiz" && (
        <div className="card stack">
          <div className="spread">
            <b>Automatic scoring</b>
            <span className="pill">
              {scoredCount} / {activity.questions.length} questions scored
            </span>
          </div>
          <p className="small">
            Credits are added the moment you press <b>Reveal and score</b>:{" "}
            {activity.points} per question per team, for the team answer
            submitted by its COO. Each question is scored only once. To
            re-score, use <b>Undo last change</b> in the Leaderboard tab, then
            reveal again.
          </p>
          {msg && <span className="pill ok">{msg}</span>}
        </div>
      )}
    </div>
  );
}
