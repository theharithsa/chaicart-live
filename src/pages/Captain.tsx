import { workshopAction } from "../lib/workshopActions";
import { signOut } from "firebase/auth";
import AnswerSummary from "../components/AnswerSummary";
import { activityTitle } from "../lib/presentation";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { doc, serverTimestamp, setDoc } from "../lib/firestore";
import { auth, db } from "../firebase";
import { googleSignIn, isGoogleStudent } from "../lib/auth";
import { useAuthUser, useCollectionData, useDocData } from "../lib/hooks";
import { normaliseCode, storedSession } from "../lib/session";
import { REGIONS, TEAMS, TEAM_BY_ID } from "../content/teams";
import { SCORE_RUBRICS } from "../content/workshop";
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
  const teamCodes = useCollectionData<{
    joinCode: string;
    slots: Record<string, string>;
  }>(staff && sid ? `sessions/${sid}/teams` : null, "region", staff?.region);
  const [teamId, setTeamId] = useState("");
  if (!isGoogleStudent(user))
    return (
      <div className="page stack">
        <div className="kicker">Staff workspace</div>
        <h1>Guide your region.</h1>
        <p>
          Sign in with the Google account assigned by the facilitator. Share
          team codes, review work and propose credits for your six teams.
        </p>
        <p className="small muted">
          Student team roles do not grant captain access.
        </p>
        <button
          className="btn"
          onClick={() =>
            googleSignIn().catch((e) => setError((e as Error).message))
          }
        >
          Sign in with Google
        </button>
        {error && <p role="alert">{error}</p>}
        <Link to="/">← Back to workshop</Link>
      </div>
    );
  const teams = TEAMS.filter((t) => t.region === staff?.region);
  const selected = teams.find((t) => t.id === teamId)?.id ?? teams[0]?.id;
  return (
    <div className="page wide stack">
      <div className="spread">
        <div>
          <div className="kicker">Regional review desk</div>
          <h1>Captain dashboard</h1>
        </div>
        <button className="btn ghost" onClick={() => signOut(auth)}>
          Switch account
        </button>
      </div>
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
              Check team work, validate completion and award credits for your
              six teams. Facilitators can also apply awards. You cannot change
              global activities or another region.
            </p>
          </div>
          <div className="card stack">
            <h3>Your region’s team join codes</h3>
            <p className="small muted">
              Codes are generated when the facilitator creates the session.
              Share each code with its assigned team; students sign in with
              Google and claim an available role.
            </p>
            {teamCodes === undefined && <p>Loading team codes…</p>}
            {teamCodes?.length === 0 && (
              <p>
                No team codes are available. Ask the facilitator to check this
                session’s setup.
              </p>
            )}
            {teams.map((t) => {
              const data = teamCodes?.find((code) => code.id === t.id);
              return (
                <div className="spread" key={t.id}>
                  <div>
                    <b>{t.name}</b>
                    <br />
                    <code>{data?.joinCode ?? "Not available"}</code>
                    <span className="small muted">
                      {" "}
                      · {Object.keys(data?.slots ?? {}).length}/5 roles claimed
                    </span>
                  </div>
                  {data?.joinCode && (
                    <button
                      className="btn sm ghost"
                      onClick={() =>
                        navigator.clipboard
                          .writeText(data.joinCode)
                          .catch(() =>
                            setError(
                              "Could not copy. Select the displayed code and copy it manually.",
                            ),
                          )
                      }
                    >
                      Copy {t.name} code
                    </button>
                  )}
                </div>
              );
            })}
            {error && <p role="alert">{error}</p>}
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
          {selected && (
            <ReviewTeam
              key={`${sid}:${selected}`}
              sid={sid}
              teamId={selected}
            />
          )}
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
    activity.startsWith("network-")
      ? null
      : `sessions/${sid}/submissions/${activity}__${teamId}`,
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
  const awarded = useDocData<{ points: number }>(
    `sessions/${sid}/awards/${activity}__${teamId}`,
  );
  const [busy, setBusy] = useState(false);
  const [points, setPoints] = useState(
    String(SCORE_RUBRICS[activity]?.max ?? 0),
  );
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
      ? Array.isArray(values?.order) &&
        !!keys?.timeline?.length &&
        JSON.stringify(values.order) === JSON.stringify(keys.timeline)
      : undefined;
  const serviceScore =
    activity === "service-sort"
      ? Object.entries(keys?.services ?? {}).filter(
          ([k, v]) => values?.[k] === v,
        ).length * 5
      : undefined;
  async function review() {
    try {
      if (
        activity === "bingo" &&
        !validBingo(
          teamId,
          (values?.marks as string[] | undefined) ?? [],
          called?.bingoCalled ?? [],
        )
      )
        throw new Error("No valid called Bingo line.");
      const p =
        activity === "timeline" && !correct
          ? 0
          : network
            ? 100
            : (serviceScore ?? Number(points));
      if (!Number.isInteger(p) || p < 0 || p > rubric.max)
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
      setStatus("Review saved. A captain or facilitator can apply the award.");
    } catch (e) {
      setStatus((e as Error).message);
    }
  }
  return (
    <div className="card stack">
      <div className="kicker">Review → Approve → Award once</div>
      <h3>{activityTitle(activity)}</h3>
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
              <AnswerSummary
                activity={activity}
                values={
                  values ??
                  sub.values ??
                  sub.accusation ??
                  sub.answers ??
                  sub.choices
                }
              />
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
      {correct === false && (
        <p className="small">
          Incorrect work can be approved with feedback at zero credits. The
          correct-order winner award remains +50.
        </p>
      )}
      <label className="field">
        Credits proposed
        <input
          type="number"
          min="0"
          max={rubric.max}
          value={
            correct === false ? "0" : network ? "100" : (serviceScore ?? points)
          }
          disabled={
            !!network || serviceScore !== undefined || correct === false
          }
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
        disabled={
          (!!network && !complete) ||
          ((activity === "timeline" || activity === "service-sort") && !keys)
        }
        onClick={review}
      >
        Approve for facilitator
      </button>
      <button
        className="btn clay"
        disabled={busy || !saved || saved.points <= 0 || !!awarded}
        onClick={async () => {
          setBusy(true);
          try {
            const result = await workshopAction({
              sid,
              action: "applyReview",
              teamId,
              activity,
            });
            setStatus(result.message ?? "Award applied.");
          } catch (e) {
            setStatus((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {awarded
          ? `Awarded ${awarded.points} credits`
          : busy
            ? "Applying…"
            : "Award reviewed credits to team"}
      </button>
      {saved && (
        <p>
          Previous review: {saved.points} credits proposed ·{" "}
          {saved.status === "approved" ? "Approved" : saved.status} ·{" "}
          {saved.comment}
        </p>
      )}
      {status && <p role="status">{status}</p>}
    </div>
  );
}
