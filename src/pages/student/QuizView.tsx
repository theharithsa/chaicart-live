import { useState } from "react";
import type { QuizActivity } from "../../content/activities";
import { useDocData } from "../../lib/hooks";
import { submissionId, submit } from "../../lib/session";
import type { RevealDoc, Submission } from "../../types";
import { LETTERS, type StudentProps } from "./shared";

export default function QuizView({
  sid,
  uid,
  student,
  session,
  activity,
}: StudentProps & { activity: QuizActivity }) {
  const sub = useDocData<Submission>(
    `sessions/${sid}/submissions/${submissionId(activity.id, activity.mode === "poll" ? uid : student.teamId)}`,
  );
  const reveal = useDocData<RevealDoc>(`sessions/${sid}/public/reveal`);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const idx = session.state.index;
  const q = activity.questions[idx];
  if (!q)
    return (
      <div className="card empty">
        That's the last question. Watch the screen for the results.
      </div>
    );

  const answers = (sub?.answers as Record<string, number> | undefined) ?? {};
  const mine = answers[String(idx)];
  const revealed =
    session.state.phase === "revealed" &&
    reveal?.activity === activity.id &&
    reveal.index === idx;
  const canAnswer =
    (activity.mode === "poll" || student.role === "COO") &&
    session.state.phase === "open" &&
    mine === undefined &&
    !sending;

  async function choose(i: number) {
    setSending(true);
    setError("");
    try {
      await submit(
        sid,
        activity.id,
        activity.mode === "poll" ? "individual" : "team",
        uid,
        student,
        { answers: { [String(idx)]: i } },
      );
    } catch {
      setError("Too late: this question is closed.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="stack">
      {activity.mode === "quiz" && (
        <p className="small muted">
          Discuss together. The COO submits one answer per team; +10 per correct
          answer.
        </p>
      )}
      <div className="card stack">
        <span className="muted small">
          Question {idx + 1} of {activity.questions.length}
        </span>
        <h3 style={{ fontSize: 22 }}>{q.q}</h3>
      </div>
      <div className="options">
        {q.options.map((o, i) => {
          let cls = "option";
          if (revealed && reveal.correct !== null)
            cls +=
              i === reveal.correct ? " correct" : mine === i ? " wrong" : "";
          else if (mine === i) cls += " chosen";
          return (
            <button
              key={i}
              className={cls}
              disabled={!canAnswer}
              onClick={() => choose(i)}
            >
              <span className="letter">{LETTERS[i]}</span>
              {o}
            </button>
          );
        })}
      </div>
      {error && <div className="error">{error}</div>}
      {mine !== undefined && !revealed && (
        <p className="muted small center">
          Answer locked in. Wait for the reveal.
        </p>
      )}
      {revealed && (
        <div className={`card ${mine === reveal.correct ? "accent" : ""}`}>
          {reveal.correct !== null && activity.mode === "quiz" && (
            <b>
              {mine === reveal.correct
                ? "Correct!"
                : mine === undefined
                  ? "No answer this time."
                  : "Not this time."}
            </b>
          )}
          <p>{reveal.explanation}</p>
        </div>
      )}
    </div>
  );
}
