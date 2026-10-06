import { ACTIVITY_BY_ID } from "../content/activities";
import paperless from "../content/paperless.json";

import { componentLabel, LABELS } from "../lib/presentation";

function label(key: string, activity: string): string {
  const a = ACTIVITY_BY_ID[activity];
  if (a?.kind === "form") {
    const f = a.fields.find((f) => f.id === key);
    if (f) return f.label;
  }
  return (
    paperless.services.find((s) => s.id === key)?.name ?? componentLabel(key)
  );
}
function valueLabel(value: unknown): string {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value === null || value === undefined || value === "")
    return "No answer provided";
  const text = String(value);
  return (
    paperless.timeline.find((c) => c.id === text)?.text ?? LABELS[text] ?? text
  );
}
function AnswerValue({ value }: { value: unknown }) {
  if (Array.isArray(value))
    return value.length ? (
      <ol className="answer-list">
        {value.map((v, i) => (
          <li key={i}>
            {typeof v === "object" && v !== null ? (
              <AnswerValue value={v} />
            ) : (
              valueLabel(v)
            )}
          </li>
        ))}
      </ol>
    ) : (
      <span className="muted">No selections</span>
    );
  if (typeof value === "object" && value !== null)
    return (
      <dl className="answer-summary">
        {Object.entries(value).map(([k, v]) => (
          <div key={k}>
            <dt>{componentLabel(k)}</dt>
            <dd>
              <AnswerValue value={v} />
            </dd>
          </div>
        ))}
      </dl>
    );
  return <span className="answer-text">{valueLabel(value)}</span>;
}
export default function AnswerSummary({
  activity,
  values,
}: {
  activity: string;
  values: unknown;
}) {
  if (
    !values ||
    (typeof values === "object" && Object.keys(values).length === 0)
  )
    return <p className="muted">No answers to display yet.</p>;
  if (typeof values !== "object" || Array.isArray(values))
    return <AnswerValue value={values} />;
  const quiz = ACTIVITY_BY_ID[activity];
  if (quiz?.kind === "quiz")
    return (
      <dl className="answer-summary">
        {Object.entries(values).map(([qi, answer]) => (
          <div key={qi}>
            <dt>
              {quiz.questions[Number(qi)]?.q ?? `Question ${Number(qi) + 1}`}
            </dt>
            <dd>
              {typeof answer === "number"
                ? (quiz.questions[Number(qi)]?.options[answer] ??
                  "Invalid answer")
                : "No answer"}
            </dd>
          </div>
        ))}
      </dl>
    );
  return (
    <dl className="answer-summary">
      {Object.entries(values).map(([key, value]) => (
        <div key={key}>
          <dt>{label(key, activity)}</dt>
          <dd>
            <AnswerValue value={value} />
          </dd>
        </div>
      ))}
    </dl>
  );
}
