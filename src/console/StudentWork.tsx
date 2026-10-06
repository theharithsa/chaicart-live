import { useState } from "react";
import { useCollectionData, useDocData } from "../lib/hooks";
import type { Submission } from "../types";
import { activityTitle } from "../lib/presentation";
import { ACTIVITY_BY_ID } from "../content/activities";
import AnswerSummary from "../components/AnswerSummary";
export default function StudentWork({
  sid,
  uid,
  teamId,
  facilitator = false,
}: {
  sid: string;
  uid: string;
  teamId: string;
  facilitator?: boolean;
}) {
  const individualWork = useCollectionData<Submission>(
    facilitator ? `sessions/${sid}/submissions` : null,
    "teamId",
    teamId,
    "uid",
    uid,
  );
  const teamWork = useCollectionData<Submission>(
    facilitator ? null : `sessions/${sid}/submissions`,
    "teamId",
    teamId,
    "scope",
    "team",
  );
  const cloud = ACTIVITY_BY_ID["cloud-or-not"];
  const cloudWork = useDocData<Submission>(
    facilitator ? null : `sessions/${sid}/submissions/cloud-or-not__${uid}`,
  );
  const submissions = facilitator
    ? individualWork
    : teamWork === undefined || cloudWork === undefined
      ? undefined
      : [
          ...teamWork.filter((s) => s.uid === uid),
          ...(cloudWork ? [{ ...cloudWork, id: `cloud-or-not__${uid}` }] : []),
        ];
  const result = useDocData<{
    credits: number;
    answers: Record<
      string,
      { answer: number | null; correct: boolean; credits: number }
    >;
  }>(`sessions/${sid}/quizResults/${uid}`);
  return (
    <div className="stack small">
      <h4>Submitted work</h4>
      {submissions === undefined ? (
        <p>Loading work…</p>
      ) : !submissions.length ? (
        <p>No submitted work yet.</p>
      ) : (
        submissions.map((s) => (
          <div className="card stack" key={s.id}>
            <b>{activityTitle(s.activity)}</b>
            <p>
              {s.scope === "team"
                ? "Submitted for the team"
                : "Individual response"}{" "}
              · {s.updatedAt?.toDate().toLocaleString()}
            </p>
            <AnswerSummary
              activity={s.activity}
              values={
                s.values ?? s.answers ?? s.accusation ?? s.choices ?? s.choice
              }
            />
          </div>
        ))
      )}
      {result && (
        <div className="card stack">
          <b>Cloud or Not: {result.credits} personal credits</b>
          <p>These earned credits are included in the team score.</p>
          {Object.entries(result.answers).map(([qi, r]) => (
            <p key={qi}>
              {cloud.kind === "quiz"
                ? cloud.questions[Number(qi)]?.q
                : `Question ${Number(qi) + 1}`}
              :{" "}
              {r.answer === null
                ? "No answer"
                : r.correct
                  ? "Correct"
                  : "Incorrect"}{" "}
              · +{r.credits}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

export function StudentWorkDetails({
  sid,
  uid,
  teamId,
  label,
  facilitator = false,
}: {
  sid: string;
  uid: string;
  teamId: string;
  label: string;
  facilitator?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <details onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>{label}</summary>
      {open && (
        <StudentWork
          sid={sid}
          uid={uid}
          teamId={teamId}
          facilitator={facilitator}
        />
      )}
    </details>
  );
}
