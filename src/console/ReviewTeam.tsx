import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useState } from "react";
import { useCollectionData } from "../lib/hooks";
import { SCORE_RUBRICS } from "../content/workshop";
import { ACTIVITY_BY_ID } from "../content/activities";
import type { Student } from "../types";
import { ReviewEditor } from "../pages/Captain";
export default function ReviewTeam({
  sid,
  teamId,
}: {
  sid: string;
  teamId: string;
}) {
  const roster =
    useCollectionData<Student>(`sessions/${sid}/students`, "teamId", teamId) ??
    [];
  const entries =
    useCollectionData<{ name: string; url: string; shortlisted?: boolean }>(
      `sessions/${sid}/xEntries`,
      "teamId",
      teamId,
    ) ?? [];
  const [activity, setActivity] = useState("network-linkedin");
  return (
    <div className="stack">
      <div className="card">
        <h3>Roster ({roster.length}/5)</h3>
        {roster.map((s) => (
          <p key={s.id}>
            {s.name} · {s.role} · Semester{s.semester}
          </p>
        ))}
      </div>
      <label className="field">
        Review activity
        <select value={activity} onChange={(e) => setActivity(e.target.value)}>
          {Object.keys(SCORE_RUBRICS).map((a) => (
            <option key={a} value={a}>
              {ACTIVITY_BY_ID[a]?.title ?? a}
            </option>
          ))}
        </select>
      </label>
      <ReviewEditor
        key={`${teamId}:${activity}`}
        sid={sid}
        teamId={teamId}
        activity={activity}
      />
      <div className="card">
        <h3>X award entries</h3>
        {entries.map((e) => (
          <p key={e.id}>
            <a href={e.url} target="_blank" rel="noreferrer">
              {e.name} · Best post/photo
            </a>{" "}
            <button
              className="btn sm ghost"
              onClick={() =>
                updateDoc(doc(db, `sessions/${sid}/xEntries/${e.id}`), {
                  shortlisted: !e.shortlisted,
                }).catch((err) => alert((err as Error).message))
              }
            >
              {e.shortlisted ? "Remove from shortlist" : "Shortlist"}
            </button>
          </p>
        ))}
        <p className="small">
          Shortlist in your review feedback. Facilitator chooses one individual
          winner at closing.
        </p>
      </div>
    </div>
  );
}
