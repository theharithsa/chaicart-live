import { workshopAction } from "../../lib/workshopActions";
import { useState } from "react";
import {
  collection,
  doc,
  getDocsFromServer,
  query,
  setDoc,
  where,
} from "../../lib/firestore";
import { db } from "../../firebase";
import type { QuizActivity } from "../../content/activities";
import type { Submission } from "../../types";
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
  const individual =
    activity.mode === "poll" || activity.scope === "individual";
  const [busy, setBusy] = useState(false);
  const expected = individual
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

  async function questionCredits(qi: number) {
    const confirmed = await getDocsFromServer(
      query(
        collection(db, `sessions/${sid}/submissions`),
        where("activity", "==", activity.id),
      ),
    );
    const answers = confirmed.docs.map((d) => d.data() as Submission);
    const answer = keys?.QUIZ_KEYS[activity.id]?.[qi]?.answer;
    return TEAMS.map((t) => ({
      teamId: t.id,
      delta:
        answer !== undefined &&
        answers.some(
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
    setBusy(true);
    setMsg("");
    try {
      await patchSession(sid, { "state.phase": "locked" });
      if (activity.id === "cloud-or-not") {
        const result = await workshopAction({
          sid,
          action: "scoreCloud",
          question: idx,
        });
        setMsg(result.message ?? "Scored.");
      }
      await setDoc(doc(db, `sessions/${sid}/public/reveal`), {
        activity: activity.id,
        index: idx,
        correct: key?.answer ?? null,
        explanation: key?.why ?? "",
      });
      await patchSession(sid, { "state.phase": "revealed" });
      // Each question is credited once; Undo in the Leaderboard tab clears the marker so it can be re-scored.
      if (
        activity.mode === "quiz" &&
        activity.id !== "cloud-or-not" &&
        key &&
        !ctx.applied[qKey(idx)]
      ) {
        const changes = await questionCredits(idx);
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
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
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
              {answered} / {expected} {individual ? "students" : "teams"}{" "}
              answered
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
                disabled={idx === 0 || busy}
                onClick={() => go(idx - 1)}
              >
                Previous
              </button>
              <button
                className="btn ghost"
                disabled={busy}
                onClick={() => patchSession(sid, { "state.phase": "locked" })}
              >
                Lock answers
              </button>
              <button
                className="btn clay"
                disabled={!keys || busy}
                onClick={reveal}
              >
                {activity.mode === "quiz"
                  ? "Reveal and score"
                  : "Reveal answer"}
              </button>
              <button
                className="btn"
                disabled={busy || idx >= activity.questions.length - 1}
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
            {activity.points}{" "}
            {individual
              ? "per correct participant; individual scores are added to the team total."
              : "per question per team, for the team answer submitted by its COO."}{" "}
            Each question is scored only once. To re-score, use{" "}
            <b>Undo last change</b> in the Leaderboard tab, then reveal again.
          </p>
          {activity.id === "cloud-or-not" && ctx.applied[qKey(idx)] && (
            <button
              className="btn ghost"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const result = await workshopAction({
                    sid,
                    action: "undoCloud",
                    question: idx,
                  });
                  setMsg(result.message ?? "Question reset.");
                } catch (e) {
                  setMsg((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Undo this question’s student and team credits
            </button>
          )}
          {msg && <span role="status">{msg}</span>}
        </div>
      )}
    </div>
  );
}
