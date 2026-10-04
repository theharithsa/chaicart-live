import { useState } from "react";
import type { VoteActivity } from "../../content/activities";
import { TEAM_BY_ID, TEAMS, regionName } from "../../content/teams";
import { useDocData } from "../../lib/hooks";
import { submissionId, submit } from "../../lib/session";
import type { Submission } from "../../types";
import { fmtTime, type StudentProps } from "./shared";

export default function VoteView({
  sid,
  uid,
  student,
  session,
  activity,
}: StudentProps & { activity: VoteActivity }) {
  const sub = useDocData<Submission>(
    `sessions/${sid}/submissions/${submissionId(activity.id, student.teamId)}`,
  );
  const [error, setError] = useState("");
  const team = TEAM_BY_ID[student.teamId];
  const others = TEAMS.filter(
    (t) => t.region === team.region && t.id !== team.id,
  );
  const choice = sub?.choice as string | undefined;
  const open = session.state.phase === "open" && student.role === "COO";

  async function vote(id: string) {
    setError("");
    try {
      await submit(sid, activity.id, "team", uid, student, { choice: id });
    } catch {
      setError("Voting is closed.");
    }
  }

  return (
    <div className="stack">
      <p className="muted small">
        {regionName(team.region)} region · one vote per team · change it until
        voting closes.
      </p>
      <div className="options">
        {others.map((t) => (
          <button
            key={t.id}
            className={`option${choice === t.id ? " chosen" : ""}`}
            disabled={!open}
            onClick={() => vote(t.id)}
          >
            <span className="letter">{t.name.slice(-2)}</span>
            {t.name}
          </button>
        ))}
      </div>
      {sub && (
        <div className="pill ok">
          Your team voted for {TEAM_BY_ID[choice ?? ""]?.name} ({sub.byName},{" "}
          {fmtTime(sub.updatedAt)})
        </div>
      )}
      {error && <div className="error">{error}</div>}
    </div>
  );
}
