import { Link, Navigate } from "react-router-dom";
import { isGoogleStudent } from "../lib/auth";
import { useAuthUser, useDocData } from "../lib/hooks";
import { storedSession } from "../lib/session";
import { TEAM_BY_ID, regionName } from "../content/teams";
import type { SessionDoc, Student } from "../types";

export default function Certificate() {
  const sid = storedSession();
  const user = useAuthUser();
  const student = useDocData<Student>(
    user && sid ? `sessions/${sid}/students/${user.uid}` : null,
  );
  const awards = useDocData<{
    awards: { uid: string; name: string; title: string }[];
  }>(user && sid ? `sessions/${sid}/public/workshop` : null);
  const session = useDocData<SessionDoc>(
    user && sid ? `sessions/${sid}` : null,
  );

  if (user !== undefined && !isGoogleStudent(user))
    return <Navigate to={`/join?s=${sid}`} replace />;
  if (!sid) return <Navigate to="/" replace />;
  if (student === null) return <Navigate to={`/join?s=${sid}`} replace />;
  if (!student || !session) return <div className="empty">Loading…</div>;
  const today = session.workshopDate ?? "Workshop date pending";
  if (!session.certificatesIssued)
    return (
      <div className="page stack">
        <h2>Certificate not issued yet</h2>
        <p>
          The facilitator releases certificates after attendance is checked at
          closing.
        </p>
        <Link to="/play">Back to workshop</Link>
      </div>
    );
  const team = TEAM_BY_ID[student.teamId];

  return (
    <div className="page wide stack" style={{ paddingTop: 24 }}>
      <div className="spread no-print">
        <Link to="/play">← Back</Link>
        <button className="btn" onClick={() => window.print()}>
          Print or save as PDF
        </button>
      </div>
      <div className="cert">
        <div className="star" />
        <div className="kicker" style={{ letterSpacing: "0.3em" }}>
          ChaiCart Startup Challenge
        </div>
        <h1>Certificate of Participation</h1>
        <div className="muted">This is proudly presented to</div>
        <div className="name">{student.name}</div>
        <p style={{ maxWidth: 640 }}>
          for successfully participating in the two-day “{session.title}” as a
          founding member of <b>{team.name}</b> ({regionName(team.region)}{" "}
          region), covering cloud fundamentals, architecture, observability,
          SRE, DevOps, security, cost and business systems in the cloud.
        </p>
        <div className="muted small">{today}</div>
        {awards?.awards
          ?.filter((a) => a.uid === user?.uid)
          .map((a) => (
            <p key={a.title}>
              <b>Award: {a.title}</b>
            </p>
          ))}
      </div>
    </div>
  );
}
