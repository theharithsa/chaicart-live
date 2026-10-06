import { withRumAction } from "../lib/rum-actions.js";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import { googleSignIn } from "../lib/auth";
import {
  useAuthUser,
  useCollectionData,
  useDocData,
  useIsAdmin,
} from "../lib/hooks";
import type { LeaderboardDoc, SessionDoc, Student } from "../types";
import type { ConsoleCtx } from "./shared";
import RunTab from "./RunTab";
import LeaderboardTab from "./LeaderboardTab";
import StudentsTab from "./StudentsTab";
import WorkshopTab from "./WorkshopTab";
import SetupTab from "./SetupTab";
import { TimerDisplay } from "../components/Timer";

const SID_KEY = "chaicart-console-session";
const TABS = ["Run", "Workshop", "Leaderboard", "Students", "Setup"] as const;

export function AdminGate({
  children,
}: {
  children: (email: string) => React.ReactNode;
}) {
  const [error, setError] = useState("");
  const user = useAuthUser();
  const isAdmin = useIsAdmin(user);
  if (user === undefined || (user && user.email && isAdmin === undefined))
    return <div className="empty">Checking access…</div>;
  if (!user || !user.email) {
    return (
      <div className="page stack" style={{ paddingTop: 64 }}>
        <div className="star" />
        <h1>Facilitator console</h1>
        <p>
          Sign in with your authorized facilitator Google account. Launch
          activities, review captain proposals and manage the workshop.
        </p>
        <button
          className="btn lg"
          onClick={() =>
            googleSignIn().catch((e) => setError((e as Error).message))
          }
        >
          Sign in with Google
        </button>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <p className="small">
          Region captain? <Link to="/captain">Open your review desk</Link>
        </p>
        <Link to="/">← Workshop home</Link>
      </div>
    );
  }
  if (!isAdmin) {
    return (
      <div className="page stack" style={{ paddingTop: 64 }}>
        <h2>No console access for {user.email}</h2>
        <p>
          Ask the facilitator for access. Region captains use the{" "}
          <a href="#/captain">captain dashboard</a>.
        </p>
        <button className="btn ghost" onClick={() => withRumAction("User Logout", () => signOut(auth))}>
          Sign out
        </button>
      </div>
    );
  }
  return <>{children(user.email)}</>;
}

export default function Console() {
  return <AdminGate>{(email) => <ConsoleBody email={email} />}</AdminGate>;
}

function ConsoleBody({ email }: { email: string }) {
  const [sid, setSid] = useState(() => localStorage.getItem(SID_KEY) ?? "");
  const [tab, setTab] = useState<(typeof TABS)[number]>(sid ? "Run" : "Setup");
  useEffect(() => {
    localStorage.setItem(SID_KEY, sid);
  }, [sid]);

  const base = sid ? `sessions/${sid}` : null;
  const session = useDocData<SessionDoc>(base);
  const students = useCollectionData<Student>(base ? `${base}/students` : null);
  const board = useDocData<LeaderboardDoc>(
    base ? `${base}/public/leaderboard` : null,
  );
  const applied = useDocData<Record<string, string>>(
    base ? `${base}/private/applied` : null,
  );

  const ctx: ConsoleCtx | null =
    sid && session
      ? {
          sid,
          session,
          students: students ?? [],
          scores: board?.scores ?? {},
          applied: applied ?? {},
        }
      : null;

  return (
    <>
      <div className="topbar wide">
        <div className="inner">
          <div className="star" style={{ width: 20, height: 20 }} />
          <div className="grow">
            <div className="title">ChaiCart Live · Console</div>
            <div className="tiny muted">
              {sid ? `Session ${sid}` : "No session selected"} ·{" "}
              {students?.length ?? 0} students joined · {email}
            </div>
          </div>
          {session?.timer && <TimerDisplay timer={session.timer} />}
          <div className="tabs">
            {TABS.map((t) => (
              <button
                key={t}
                className={`tab${tab === t ? " on" : ""}`}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </div>
          <button className="btn ghost sm" onClick={() => withRumAction("User Logout", () => signOut(auth))}>
            Sign out
          </button>
        </div>
      </div>
      <div className="page wide">
        {tab === "Setup" && (
          <SetupTab sid={sid} setSid={setSid} session={session} />
        )}
        {tab !== "Setup" && !ctx && (
          <div className="empty">Create or select a session in Setup.</div>
        )}
        {tab === "Run" && ctx && <RunTab ctx={ctx} />}
        {tab === "Leaderboard" && ctx && <LeaderboardTab ctx={ctx} />}
        {tab === "Workshop" && ctx && <WorkshopTab ctx={ctx} />}
        {tab === "Students" && ctx && <StudentsTab ctx={ctx} />}
      </div>
    </>
  );
}
