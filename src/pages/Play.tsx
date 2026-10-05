import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { isGoogleStudent } from "../lib/auth";
import {
  useAuthUser,
  useCollectionData,
  useDocData,
  useNow,
} from "../lib/hooks";
import { storedSession } from "../lib/session";
import { TEAM_BY_ID, TEAMS, regionName, START_CREDITS } from "../content/teams";
import { ACTIVITY_BY_ID } from "../content/activities";
import type { LeaderboardDoc, SessionDoc, Student } from "../types";
import { TimerDisplay } from "../components/Timer";
import StudioView from "./student/StudioView";
import WorkshopHub from "./student/WorkshopHub";
import QuizView from "./student/QuizView";
import FormView from "./student/FormView";
import VoteView from "./student/VoteView";
import MysteryView from "./student/MysteryView";
import BudgetView from "./student/BudgetView";
import BillView from "./student/BillView";

export default function Play() {
  const [view, setView] = useState("Live");
  const sid = storedSession();
  const user = useAuthUser();

  const base = user && sid ? `sessions/${sid}` : null;
  const student = useDocData<Student>(
    base && user ? `${base}/students/${user.uid}` : null,
  );
  const session = useDocData<SessionDoc>(base);
  const board = useDocData<LeaderboardDoc>(
    base ? `${base}/public/leaderboard` : null,
  );
  const teammates = useCollectionData<Student>(
    base ? `${base}/students` : null,
    "teamId",
    student?.teamId ?? "__none__",
  );
  const now = useNow(1000);

  if (user !== undefined && !isGoogleStudent(user))
    return <Navigate to={`/join?s=${sid}`} replace />;
  if (!sid) return <Navigate to="/" replace />;
  if (student === null) return <Navigate to={`/join?s=${sid}`} replace />;
  if (!user || !student || !session)
    return <div className="empty">Connecting…</div>;

  const team = TEAM_BY_ID[student.teamId];
  const scores = board?.scores ?? {};
  const myScore = scores[team.id] ?? START_CREDITS;
  const regionTeams = TEAMS.filter((t) => t.region === team.region).sort(
    (a, b) => (scores[b.id] ?? START_CREDITS) - (scores[a.id] ?? START_CREDITS),
  );
  const rank = regionTeams.findIndex((t) => t.id === team.id) + 1;
  const activity = session.currentActivity
    ? ACTIVITY_BY_ID[session.currentActivity]
    : null;
  const props = { sid, uid: user.uid, student, session };

  return (
    <>
      <div className="topbar">
        <div className="inner">
          <div className="star" style={{ width: 20, height: 20 }} />
          <div className="grow">
            <div className="title">{team.name}</div>
            <div className="tiny muted">
              {regionName(team.region)} · {student.role} · {student.name}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="score-big" style={{ fontSize: 22 }}>
              {myScore.toLocaleString()}
            </div>
            <div className="tiny muted">credits · #{rank} in region</div>
          </div>
        </div>
      </div>
      <div className="page stack" style={{ gap: 16 }}>
        {session.timer && session.timer.endsAt > now - 60000 && (
          <div className="card spread" style={{ padding: "10px 16px" }}>
            <span className="small muted">Time left</span>
            <TimerDisplay timer={session.timer} />
          </div>
        )}
        <nav className="tabs" aria-label="Student navigation">
          <button
            className={`tab ${view === "Live" ? "on" : ""}`}
            onClick={() => setView("Live")}
          >
            Live activity
          </button>
          <button
            className={`tab ${view === "Workspace" ? "on" : ""}`}
            onClick={() => setView("Workspace")}
          >
            My workshop
          </button>
        </nav>
        {view === "Workspace" && <WorkshopHub {...props} />}
        {view === "Live" && !activity && (
          <div className="card hero stack">
            <span className="row">
              <span className="dot live" />{" "}
              <span className="kicker">Waiting for the next activity</span>
            </span>
            <h2>Eyes on the facilitator</h2>
            <p>This screen changes by itself when an activity starts.</p>
            {teammates && (
              <>
                <div className="divider" />
                <div className="small muted">
                  Your team ({teammates.length}/5)
                </div>
                <div className="row">
                  {teammates.map((t) => (
                    <span key={t.id} className="pill">
                      {t.name} · {t.role}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
        {view === "Live" && activity && (
          <div className="stack">
            <div>
              <div className="kicker">Live now</div>
              <h2 style={{ marginTop: 4 }}>{activity.title}</h2>
              {activity.intro && <p>{activity.intro}</p>}
            </div>
            <div className="activity-state card">
              <span className="pill">
                {(activity.kind === "form" &&
                  activity.scope === "individual") ||
                (activity.kind === "quiz" && activity.mode === "poll")
                  ? "Individual response"
                  : "Team activity"}
              </span>
              <p className="small">
                {session.state.phase === "open"
                  ? "Open for participation"
                  : session.state.phase === "revealed"
                    ? "Results revealed"
                    : "Submissions closed"}{" "}
                · Your role: {student.role}.{" "}
                {(activity.kind === "form" &&
                  activity.scope === "individual") ||
                (activity.kind === "quiz" && activity.mode === "poll")
                  ? "Submit your own response."
                  : activity.id === "factory"
                    ? "Follow the round instructions below. Assigned roles process each delivery stage."
                    : ["kitchen", "follow-order"].includes(activity.id)
                      ? "Assigned volunteers advance their service station below. Your captain reviews completion."
                      : student.role === "COO"
                        ? "You submit team answers after discussing together."
                        : "Your COO submits shared team answers."}
              </p>
            </div>
            {session.state.phase === "locked" && (
              <div className="pill red">Answers are locked</div>
            )}
            {activity.kind === "studio" && (
              <StudioView key={activity.id} {...props} activity={activity} />
            )}
            {activity.kind === "quiz" && (
              <QuizView key={activity.id} {...props} activity={activity} />
            )}
            {activity.kind === "form" && (
              <FormView key={activity.id} {...props} activity={activity} />
            )}
            {activity.kind === "vote" && (
              <VoteView key={activity.id} {...props} activity={activity} />
            )}
            {activity.kind === "mystery" && (
              <MysteryView key={activity.id} {...props} activity={activity} />
            )}
            {activity.kind === "budget" && (
              <BudgetView key={activity.id} {...props} activity={activity} />
            )}
            {activity.kind === "billshock" && (
              <BillView key={activity.id} {...props} activity={activity} />
            )}
          </div>
        )}
        <p className="center small muted">
          <Link to="/certificate">My certificate</Link>
        </p>
      </div>
    </>
  );
}
