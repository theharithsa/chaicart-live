import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { googleSignIn, isGoogleStudent } from "../lib/auth";
import { useAuthUser, useCollectionData, useDocData } from "../lib/hooks";
import { normaliseCode, storedSession } from "../lib/session";
import { REGIONS, TEAMS, TEAM_BY_ID } from "../content/teams";
import { SCORE_RUBRICS } from "../content/workshop";
import { ACTIVITY_BY_ID } from "../content/activities";
import type { SessionDoc, Student, Submission } from "../types";
import { validBingo } from "../lib/bingo";
import ReviewTeam from "../console/ReviewTeam";

export default function Captain() {
  const [params] = useSearchParams();
  const [sid, setSid] = useState(
    normaliseCode(params.get("s") ?? storedSession()),
  );
  const [error, setError] = useState("");
  const user = useAuthUser();
  const staff = useDocData<{ role: string; region: string }>(
    isGoogleStudent(user) && sid && user?.email
      ? `sessions/${sid}/staff/${user.email.toLowerCase()}`
      : null,
  );
  const session = useDocData<SessionDoc>(staff ? `sessions/${sid}` : null);
  const [teamId, setTeamId] = useState("");
  if (!isGoogleStudent(user))
    return (
      <div className="page stack">
        <h1>Region captain</h1>
        <button
          className="btn"
          onClick={() =>
            googleSignIn().catch((e) => setError((e as Error).message))
          }
        >
          Sign in with Google
        </button>
        {error && <p role="alert">{error}</p>}
      </div>
    );
  const teams = TEAMS.filter((t) => t.region === staff?.region);
  const selected = teams.find((t) => t.id === teamId)?.id ?? teams[0]?.id;
  return (
    <div className="page wide stack">
      <h1>Captain dashboard</h1>
      <label className="field">
        Session code
        <input
          value={sid}
          onChange={(e) => setSid(normaliseCode(e.target.value))}
        />
      </label>
      {staff === null && (
        <p>
          No captain assignment for this account/session. Ask the facilitator to
          assign your region.
        </p>
      )}
      {staff && session && (
        <>
          <h3>{REGIONS.find((r) => r.id === staff.region)?.name}</h3>
          <div className="card">
            <p>
              Check team work, validate completion and propose credits for your
              six teams. The facilitator applies reviewed awards. You cannot
              change global activities or another region.
            </p>
          </div>
          <div className="tabs">
            {teams.map((t) => (
              <button
                className={`tab ${selected === t.id ? "on" : ""}`}
                onClick={() => setTeamId(t.id)}
                key={t.id}
              >
                {t.name}
              </button>
            ))}
          </div>
          {selected && <ReviewTeam sid={sid} teamId={selected} />}
        </>
      )}
      <Link to="/">Home</Link>
    </div>
  );
}

export function ReviewEditor({
  sid,
  teamId,
  activity,
}: {
  sid: string;
  teamId: string;
  activity: string;
}) {
  const sub = useDocData<Submission>(
    `sessions/${sid}/submissions/${activity}__${teamId}`,
  );
  const roster =
    useCollectionData<Student>(`sessions/${sid}/students`, "teamId", teamId) ??
    [];
  const networking =
    useCollectionData<{ completed: string[] }>(
      `sessions/${sid}/networking`,
      "teamId",
      teamId,
    ) ?? [];
  const saved = useDocData<{ points: number; comment: string; status: string }>(
    `sessions/${sid}/reviews/${activity}__${teamId}`,
  );
  const [points, setPoints] = useState("");
  const [comment, setComment] = useState("");
  const [status, setStatus] = useState("");
  const keys = useDocData<{
    timeline: string[];
    services: Record<string, string>;
  }>(`sessions/${sid}/private/activityKeys`);
  const called = useDocData<{ bingoCalled: string[] }>(
    `sessions/${sid}/public/workshop`,
  );
  const rubric = SCORE_RUBRICS[activity];
  const network = activity.startsWith("network-") ? activity.slice(8) : null;
  const complete =
    network &&
    roster.length === 5 &&
    roster.every((s) =>
      networking.some((n) => n.id === s.id && n.completed.includes(network)),
    );
  const values = sub?.values as Record<string, unknown> | undefined;
  const correct =
    activity === "timeline"
      ? JSON.stringify(values?.order) === JSON.stringify(keys?.timeline)
      : undefined;
  const serviceScore =
    activity === "service-sort"
      ? Object.entries(keys?.services ?? {}).filter(
          ([k, v]) => values?.[k] === v,
        ).length * 5
      : undefined;
  async function review() {
    try {
      if (activity === "timeline" && !correct)
        throw new Error("Timeline order is not correct.");
      if (
        activity === "bingo" &&
        !validBingo(
          teamId,
          (values?.marks as string[] | undefined) ?? [],
          called?.bingoCalled ?? [],
        )
      )
        throw new Error("No valid called Bingo line.");
      const p = network ? 100 : (serviceScore ?? Number(points));
      if (!Number.isFinite(p) || p < 0 || p > rubric.max)
        throw new Error("Points outside this rubric.");
      if (network && !complete)
        throw new Error("All five teammates must complete the activity.");
      await setDoc(doc(db, `sessions/${sid}/reviews/${activity}__${teamId}`), {
        activity,
        teamId,
        region: TEAM_BY_ID[teamId].region,
        points: p,
        comment: comment.trim().slice(0, 1000),
        status: "approved",
        actor: auth.currentUser?.uid,
        updatedAt: serverTimestamp(),
      });
      setStatus("Review saved; facilitator applies credits.");
    } catch (e) {
      setStatus((e as Error).message);
    }
  }
  return (
    <div className="card stack">
      <h3>{ACTIVITY_BY_ID[activity]?.title ?? activity}</h3>
      <p>{rubric.help}</p>
      {network ? (
        <p>
          {networking.filter((n) => n.completed.includes(network)).length}/5
          declared complete · {complete ? "Ready for approval" : "Waiting"}
        </p>
      ) : (
        <>
          {sub ? (
            <>
              <p>
                Submitted by {sub.byName} ·{" "}
                {sub.updatedAt?.toDate().toLocaleTimeString()}
              </p>
              <pre className="response-text">
                {JSON.stringify(values ?? sub, null, 2)}
              </pre>
            </>
          ) : (
            <p>No submission yet.</p>
          )}
          {correct !== undefined && (
            <p>Timeline: {correct ? "Correct order" : "Not correct yet"}</p>
          )}
          {serviceScore !== undefined && (
            <p>Service score: {serviceScore}/100</p>
          )}
        </>
      )}
      <label className="field">
        Credits proposed
        <input
          type="number"
          min="0"
          max={rubric.max}
          value={network ? "100" : (serviceScore ?? points)}
          disabled={!!network || serviceScore !== undefined}
          onChange={(e) => setPoints(e.target.value)}
        />
      </label>
      <label className="field">
        Feedback / judging evidence
        <textarea
          value={comment}
          maxLength={1000}
          onChange={(e) => setComment(e.target.value)}
        />
      </label>
      <button
        className="btn"
        disabled={!!network && !complete}
        onClick={review}
      >
        Approve for facilitator
      </button>
      {saved && (
        <p>
          Previous review: {saved.points} · {saved.status} · {saved.comment}
        </p>
      )}
      {status && <p role="status">{status}</p>}
    </div>
  );
}
