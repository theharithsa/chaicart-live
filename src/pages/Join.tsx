import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { signOut } from "firebase/auth";
import { googleSignIn, isGoogleStudent } from "../lib/auth";
import { joinTeam } from "../lib/membership";
import { auth } from "../firebase";
import { useAuthUser, useDocData } from "../lib/hooks";
import { normaliseCode, storeSession, storedSession } from "../lib/session";
import { REGIONS, ROLES, TEAMS, type RoleId } from "../content/teams";
import type { SessionDoc, Student } from "../types";

export default function Join() {
  const [params] = useSearchParams();
  const sid = normaliseCode(params.get("s") ?? storedSession());
  const user = useAuthUser();
  const navigate = useNavigate();
  const session = useDocData<SessionDoc>(
    user && sid ? `sessions/${sid}` : null,
  );
  const existing = useDocData<Student>(
    user && sid ? `sessions/${sid}/students/${user.uid}` : null,
  );

  const [teamCode, setTeamCode] = useState("");
  const [name, setName] = useState("");
  const [semester, setSemester] = useState<"5" | "7" | "">("");
  const [branch, setBranch] = useState("");
  const [teamId, setTeamId] = useState("");
  const [role, setRole] = useState<RoleId | "">("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (sid) storeSession(sid);
  }, [sid]);

  if (!sid) return <Navigate to="/" replace />;
  if (existing && isGoogleStudent(user)) return <Navigate to="/play" replace />;

  const certificateName = name || user?.displayName || "";
  const ready =
    certificateName.trim().length > 1 &&
    semester &&
    branch.trim() &&
    teamId &&
    role &&
    teamCode.trim();

  async function join(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !ready) return;
    setBusy(true);
    setError("");
    try {
      await joinTeam(
        sid,
        user.uid,
        {
          name: certificateName.trim().slice(0, 60),
          semester,
          branch: branch.trim().slice(0, 60),
          teamId,
          role: role as RoleId,
        },
        teamCode,
      );
      navigate("/play");
    } catch (err) {
      setError(`Could not join: ${(err as Error).message}`);
      setBusy(false);
    }
  }

  if (session === null) {
    return (
      <div className="page stack" style={{ paddingTop: 48 }}>
        <h2>Session {sid} not found</h2>
        <p>Check the code on the projector and try again.</p>
        <button className="btn ghost" onClick={() => navigate("/")}>
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="page stack" style={{ gap: 18, paddingTop: 32 }}>
      <div>
        <div className="kicker">Session {sid}</div>
        <h1 style={{ marginTop: 6 }}>Join your startup</h1>
        <p>
          Your captain will give you a team name and join code. Each role has
          one place.
        </p>
      </div>
      <ol className="join-steps" aria-label="Registration progress">
        <li aria-current={!isGoogleStudent(user) ? "step" : undefined}>
          <b>01</b>
          <span>Sign in</span>
        </li>
        <li aria-current={isGoogleStudent(user) ? "step" : undefined}>
          <b>02</b>
          <span>Team &amp; code</span>
        </li>
        <li>
          <b>03</b>
          <span>Your role</span>
        </li>
      </ol>
      {!isGoogleStudent(user) ? (
        <div className="card stack">
          <p>
            Sign in with Google to keep your team, answers and certificate
            across devices.
          </p>
          <button
            className="btn lg"
            onClick={async () => {
              setError("");
              try {
                await googleSignIn();
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            Sign in with Google
          </button>
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
        </div>
      ) : (
        <form className="card stack" onSubmit={join}>
          <div className="spread small">
            <span>Signed in as {user?.email}</span>
            <button
              type="button"
              className="btn ghost sm"
              onClick={() => signOut(auth)}
            >
              Switch account
            </button>
          </div>
          <label className="field">
            Team code from your captain
            <input
              value={teamCode}
              onChange={(e) => setTeamCode(e.target.value.toUpperCase())}
              maxLength={20}
              autoCapitalize="characters"
              autoComplete="off"
              required
            />
          </label>
          <label className="field">
            Your name
            <input
              value={name || user?.displayName || ""}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              maxLength={60}
              placeholder="As it should appear on your certificate"
            />
          </label>
          <div className="row" style={{ alignItems: "stretch" }}>
            <label className="field" style={{ flex: 1 }}>
              Semester
              <select
                value={semester}
                onChange={(e) => setSemester(e.target.value as "5" | "7")}
              >
                <option value="" disabled>
                  Choose…
                </option>
                <option value="5">5th</option>
                <option value="7">7th</option>
              </select>
            </label>
            <label className="field" style={{ flex: 2 }}>
              Branch
              <input
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                maxLength={60}
                placeholder="e.g. CSE"
              />
            </label>
          </div>
          <label className="field">
            Team
            <select value={teamId} onChange={(e) => setTeamId(e.target.value)}>
              <option value="" disabled>
                Choose your team…
              </option>
              {REGIONS.map((r) => (
                <optgroup key={r.id} label={`${r.name} region`}>
                  {TEAMS.filter((t) => t.region === r.id).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <div className="stack" style={{ gap: 6 }}>
            <span
              style={{ fontSize: 14, fontWeight: 600, color: "var(--ink-2)" }}
            >
              Your role
            </span>
            <div className="checks">
              {ROLES.map((r) => (
                <label key={r.id} className="check">
                  <input
                    type="radio"
                    name="role"
                    checked={role === r.id}
                    onChange={() => setRole(r.id)}
                  />
                  <span>
                    <b>{r.label}</b>{" "}
                    <span className="muted small">· {r.does}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          <button className="btn lg block" disabled={!ready || busy || !user}>
            {busy ? "Joining…" : "Join"}
          </button>
        </form>
      )}
      <Link to="/">← Change session</Link>
    </div>
  );
}
