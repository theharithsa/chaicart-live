import { StudentWorkDetails } from "./StudentWork";
import { workshopAction } from "../lib/workshopActions";
import { ACTIVITIES } from "../content/activities";
import { activityTitle } from "../lib/presentation";
import { doc, updateDoc } from "../lib/firestore";
import { db } from "../firebase";
import { useState } from "react";
import { useCollectionData, useDocData } from "../lib/hooks";
import { SCORE_RUBRICS } from "../content/workshop";
import type { Student } from "../types";
import { ReviewEditor } from "../pages/Captain";
export default function ReviewTeam({
  sid,
  teamId,
  facilitator = false,
}: {
  sid: string;
  teamId: string;
  facilitator?: boolean;
}) {
  const board = useDocData<{ scores: Record<string, number> }>(
    `sessions/${sid}/public/leaderboard`,
  );
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
  const [awardActivity, setAwardActivity] = useState("shark-pitch");
  const [delta, setDelta] = useState("100");
  const [reason, setReason] = useState("");
  const [operationId, setOperationId] = useState(() => crypto.randomUUID());
  const [awardStatus, setAwardStatus] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="stack">
      <div className="card">
        <h3>
          Team credits: {(board?.scores?.[teamId] ?? 1000).toLocaleString()}
        </h3>
        <h3>Team readiness · {roster.length}/5 joined</h3>
        {!roster.length && (
          <p className="muted">
            Share this team’s code so students can sign in and claim their
            roles.
          </p>
        )}
        {roster.map((s) => (
          <StudentWorkDetails
            facilitator={facilitator}
            key={s.id}
            sid={sid}
            uid={s.id}
            teamId={s.teamId}
            label={`${s.name} · ${s.role} · Semester ${s.semester}`}
          />
        ))}
      </div>
      <label className="field">
        Review activity
        <select value={activity} onChange={(e) => setActivity(e.target.value)}>
          {Object.keys(SCORE_RUBRICS).map((a) => (
            <option key={a} value={a}>
              {activityTitle(a)}
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
      <form
        className="card stack"
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          setBusy(true);
          try {
            const result = await workshopAction({
              sid,
              action: "manualAward",
              teamId,
              activity: awardActivity,
              delta: Number(delta),
              reason,
              operationId,
            });
            setAwardStatus(result.message ?? "Credits applied.");
            setOperationId(crypto.randomUUID());
            setReason("");
          } catch (e) {
            setAwardStatus((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <h3>Award or correct credits for any activity</h3>
        <p className="small">
          Use the reviewed award above for normal rubric scoring. Use this for
          judged bonuses or corrections, with a specific reason. Captains can
          adjust only their region’s teams. Do not repeat an automatic quiz
          award.
        </p>
        <label className="field">
          Activity
          <select
            value={awardActivity}
            onChange={(e) => {
              setAwardActivity(e.target.value);
              setOperationId(crypto.randomUUID());
            }}
          >
            {ACTIVITIES.map((a) => (
              <option key={a.id} value={a.id}>
                {a.title}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Credits (+ award / − correction)
          <input
            type="number"
            required
            min="-10000"
            max="10000"
            value={delta}
            onChange={(e) => {
              setDelta(e.target.value);
              setOperationId(crypto.randomUUID());
            }}
          />
        </label>
        <label className="field">
          Reason
          <input
            required
            maxLength={500}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              setOperationId(crypto.randomUUID());
            }}
          />
        </label>
        <button
          className="btn"
          disabled={busy || !reason.trim() || !Number(delta)}
        >
          {busy ? "Applying…" : "Apply credits to this team"}
        </button>
        {awardStatus && <p role="status">{awardStatus}</p>}
      </form>
      <div className="card">
        <h3>X award entries</h3>
        {!entries.length && (
          <p className="muted">No post or photo entries submitted yet.</p>
        )}
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
