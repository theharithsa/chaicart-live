import { useState } from "react";
import type { SimpleActivity } from "../../content/activities";
import {
  BUDGET_CARDS,
  BUDGET_START,
  completeChoices,
  evaluateBudget,
  isFrozen,
  type BudgetChoice,
} from "../../content/budget";
import { useDocData } from "../../lib/hooks";
import { submissionId, submit } from "../../lib/session";
import type { Submission } from "../../types";
import { type StudentProps } from "./shared";

export default function BudgetView({
  sid,
  uid,
  student,
  session,
  activity,
}: StudentProps & { activity: SimpleActivity }) {
  const sub = useDocData<Submission>(
    `sessions/${sid}/submissions/${submissionId(activity.id, student.teamId)}`,
  );
  const arch = useDocData<Submission>(
    `sessions/${sid}/designs/${student.teamId}`,
  );
  const roll = useDocData<{ roll: number }>(
    `sessions/${sid}/rolls/${student.teamId}__${session.state.index}`,
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const components =
    ((arch?.values as Record<string, unknown> | undefined)?.components as
      string[] | undefined) ?? [];
  const choices =
    (sub?.choices as Record<string, BudgetChoice> | undefined) ?? {};
  const idx = session.state.index;
  const card = BUDGET_CARDS[idx];
  const result = evaluateBudget(completeChoices(choices, idx), components);
  const mine = choices[String(idx)];
  const frozen = isFrozen(choices, components, idx);
  const open = session.state.phase === "open" && student.role === "COO";

  async function choose(c: "A" | "B") {
    setBusy(true);
    setError("");
    const choice: BudgetChoice =
      card.rollA && c === "A" ? { c, roll: roll?.roll ?? 0 } : { c };
    try {
      await submit(sid, activity.id, "team", uid, student, {
        choices: { [String(idx)]: choice },
      });
    } catch {
      setError("Too late: this card is closed, or a teammate already decided.");
    } finally {
      setBusy(false);
    }
  }

  const minutesLeft = result.minutes;

  return (
    <div className="stack">
      <div className="card spread">
        <div>
          <div className="muted small">Error budget left</div>
          <div
            className="score-big"
            style={{ color: minutesLeft < 0 ? "var(--red)" : undefined }}
          >
            {minutesLeft}{" "}
            <span className="small muted">/ {BUDGET_START} min</span>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="muted small">Credits so far</div>
          <div className="score-big">
            {result.credits >= 0 ? "+" : ""}
            {result.credits}
          </div>
        </div>
      </div>
      {minutesLeft < 0 && (
        <div className="pill red">
          Budget exhausted: feature freeze. Risky “ship” options are blocked.
        </div>
      )}

      {card ? (
        <div className="card stack">
          <span className="muted small">
            Card {idx + 1} of {BUDGET_CARDS.length}
            {card.forced ? " · forced" : ""}
          </span>
          <h3 style={{ fontSize: 22 }}>{card.title}</h3>
          <p>{card.text}</p>
          {mine ? (
            <div className="pill ok">
              Decided: {card.forced ? "applied" : `option ${mine.c}`}
              {mine.roll ? ` · rolled ${mine.roll}` : ""}
            </div>
          ) : card.forced ? (
            <>
              <p className="small">{card.a}</p>
              <button
                className="btn block"
                disabled={!open || busy}
                onClick={() => choose("A")}
              >
                Apply this card
              </button>
            </>
          ) : (
            <div className="options">
              <button
                className="option"
                disabled={
                  !open ||
                  busy ||
                  (card.riskyA && frozen) ||
                  (card.rollA && !roll)
                }
                onClick={() => choose("A")}
              >
                <span className="letter">A</span>
                {card.a}
              </button>
              <button
                className="option"
                disabled={!open || busy}
                onClick={() => choose("B")}
              >
                <span className="letter">B</span>
                {card.b}
              </button>
            </div>
          )}
          {error && <div className="error">{error}</div>}
        </div>
      ) : (
        <div className="card accent stack">
          <h3>Month over</h3>
          <p>
            {result.minutes >= 0
              ? `${result.minutes} minutes left × 3 = +${result.endBonus} credits.`
              : "Budget below zero: −100 credits."}
          </p>
          <p>
            <b>
              Total for this game: {result.total >= 0 ? "+" : ""}
              {result.total} credits
            </b>
          </p>
        </div>
      )}

      {result.steps.length > 0 && (
        <div className="card stack" style={{ gap: 6 }}>
          <b>Your month so far</b>
          {result.steps.map((s, i) => (
            <div key={i} className="spread small">
              <span>
                {s.title}: <span className="muted">{s.note}</span>
              </span>
              <span>
                {s.lost ? `−${s.lost} min` : ""}{" "}
                {s.credits ? `${s.credits > 0 ? "+" : ""}${s.credits} cr` : ""}
              </span>
            </div>
          ))}
        </div>
      )}
      {!components.length && (
        <p className="muted small">
          No architecture on record for your team, so forced outages hit at full
          strength.
        </p>
      )}
      <p className="muted small">
        If your team does not decide before the next card, option B applies
        automatically.
      </p>
    </div>
  );
}
