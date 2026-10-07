import { workshopAction } from "../lib/workshopActions";
import { useState } from "react";
import {
  doc,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "../lib/firestore";
import { auth, db } from "../firebase";
import { TEAMS, REGIONS } from "../content/teams";
import { initialScores } from "../lib/credits";
import { useCollectionData } from "../lib/hooks";
import { joinUrl, normaliseCode } from "../lib/session";
import type { SessionDoc } from "../types";
import { Qr } from "../components/Qr";

export default function SetupTab({
  sid,
  setSid,
  session,
}: {
  sid: string;
  setSid: (s: string) => void;
  session: SessionDoc | null | undefined;
}) {
  const sessions = useCollectionData<SessionDoc>("sessions");
  const [code, setCode] = useState("");
  const [title, setTitle] = useState(
    "Cloud Computing & Business Systems Workshop",
  );
  const [email, setEmail] = useState("");
  const [region, setRegion] = useState("west");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [msg, setMsg] = useState("");
  const [deleteId, setDeleteId] = useState("");
  const [confirm, setConfirm] = useState("");
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  async function removeSession(e: React.FormEvent) {
    e.preventDefault();
    setDeleting(true);
    try {
      await workshopAction({ sid: deleteId, action: "deleteSession", confirm });
      if (sid === deleteId) setSid("");
      setMsg(`Session ${deleteId} and its records deleted.`);
      setDeleteId("");
      setConfirm("");
    } catch (e) {
      setMsg(
        `Deletion failed: ${(e as Error).message}. You can retry this session.`,
      );
    } finally {
      setDeleting(false);
    }
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (creating) return;
    setCreating(true);
    const id = normaliseCode(code);
    if (id.length < 4 || id.length > 16) {
      setMsg("Use 4–16 letters or digits.");
      return;
    }
    await runTransaction(db, async (tx) => {
      const parent = doc(db, `sessions/${id}`);
      const existing = await tx.get(parent);
      const learningHistory = await tx.get(doc(db, `learningEnrollments/${id}`));
      if (existing.exists())
        throw new Error(`Session ${id} already exists. Select it below.`);
      if(learningHistory.exists())throw new Error("This session code has permanent learner records. Choose a new code.");
      const content = await Promise.all(
        ["keys", "activityKeys"].map((name) =>
          tx.get(doc(db, `workshopContent/${name}`)),
        ),
      );
      if (content.some((s) => !s.exists()))
        throw new Error(
          "Workshop content not seeded. Run the documented seed script first.",
        );
      tx.set(parent, {
        schemaVersion: 2,
        createdBy: auth.currentUser?.uid ?? "",
        workshopDate: date,
        certificatesIssued: false,
        networkingOpen: true,
        title: title.trim() || "ChaiCart Workshop",
        currentActivity: null,
        screen: "join",
        timer: null,
        state: { phase: "open", index: 0, indexedField: null },
        createdAt: serverTimestamp(),
      });
      tx.set(doc(db, `sessions/${id}/public/leaderboard`), {
        scores: initialScores(),
        updatedAt: serverTimestamp(),
      });
      TEAMS.forEach((t) =>
        tx.set(doc(db, `sessions/${id}/teams/${t.id}`), {
          teamId: t.id,
          region: t.region,
          joinCode: `${t.name.toUpperCase()}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`,
          slots: {},
        }),
      );
      tx.set(doc(db, `sessions/${id}/public/workshop`), {
        bingoCalled: [],
        awards: [],
      });
      ["keys", "activityKeys"].forEach((name, i) =>
        tx.set(doc(db, `sessions/${id}/private/${name}`), content[i].data()!),
      );
    });
    setSid(id);
    setCode("");
    setMsg(`Session ${id} created.`);
  }

  return (
    <div className="grid2" style={{ alignItems: "start" }}>
      <div className="stack">
        {sid && session && (
          <div className="card stack center" style={{ alignItems: "center" }}>
            <div className="kicker">Students join here</div>
            <h2>Session {sid}</h2>
            <Qr text={joinUrl(sid)} size={260} />
            <code className="small" style={{ wordBreak: "break-all" }}>
              {joinUrl(sid)}
            </code>
            <div className="row" style={{ justifyContent: "center" }}>
              <a
                className="btn"
                href={`#/screen?s=${sid}`}
                target="_blank"
                rel="noreferrer"
              >
                Open projector screen
              </a>
              <button
                className="btn ghost"
                onClick={() => navigator.clipboard.writeText(joinUrl(sid))}
              >
                Copy join link
              </button>
            </div>
          </div>
        )}
        <div className="card stack">
          <h3>Sessions</h3>
          {!sessions?.length && <p className="muted small">No sessions yet.</p>}
          {sessions?.map((s) => (
            <div key={s.id} className="spread">
              <span>
                <b>{s.id}</b> <span className="muted small">{s.title}</span>
              </span>
              <div className="row">
                {s.id === sid ? (
                  <span className="pill ok">Selected</span>
                ) : (
                  <button className="btn sm ghost" onClick={() => setSid(s.id)}>
                    Select
                  </button>
                )}
                <button
                  className="btn sm danger"
                  disabled={deleting}
                  onClick={() => {
                    setDeleteId(s.id);
                    setConfirm("");
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
        {deleteId && (
          <form className="card stack" onSubmit={removeSession}>
            <h3>Delete session {deleteId}?</h3>
            <p>
              This permanently removes its students, answers, reviews, credits,
              station events and other workshop records. Choose a rehearsal
              session for testing.
            </p>
            <label className="field">
              Type {deleteId} to confirm
              <input
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                disabled={deleting}
              />
            </label>
            <div className="row">
              <button
                className="btn danger"
                disabled={deleting || confirm !== deleteId}
              >
                {deleting
                  ? "Deleting all records…"
                  : "Permanently delete session"}
              </button>
              <button
                type="button"
                className="btn ghost"
                disabled={deleting}
                onClick={() => setDeleteId("")}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
        {msg && <p role="status">{msg}</p>}
      </div>
      <div className="stack">
        {sid && (
          <form
            className="card stack"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await updateDoc(doc(db, `sessions/${sid}`), {
                  workshopDate: date,
                });
                setMsg("Workshop date saved.");
              } catch (e) {
                setMsg((e as Error).message);
              }
            }}
          >
            <h3>Certificate workshop date</h3>
            <p className="small">
              Current: {session?.workshopDate || "Not set"}
            </p>
            <input
              aria-label="Certificate workshop date"
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            <button className="btn">Save date</button>
          </form>
        )}
        {sid && (
          <form
            className="card stack"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await setDoc(
                  doc(
                    db,
                    `sessions/${sid}/staff/${email.trim().toLowerCase()}`,
                  ),
                  { role: "captain", region },
                );
                setMsg(
                  "Captain assigned. Share the captain link with this session code.",
                );
              } catch (e) {
                setMsg((e as Error).message);
              }
            }}
          >
            <h3>Assign a region captain</h3>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Captain Google email"
            />
            <select value={region} onChange={(e) => setRegion(e.target.value)}>
              {REGIONS.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            <button className="btn">Assign</button>
            <a href={`#/captain?s=${sid}`}>Captain dashboard link</a>
          </form>
        )}
        <form
          className="card stack"
          onSubmit={(e) => {
            create(e)
              .catch((error) => setMsg((error as Error).message))
              .finally(() => setCreating(false));
          }}
        >
          <h3>Create a session</h3>
          <p className="small muted">
            One session per workshop. It holds students, teams, submissions and
            the leaderboard. All 24 teams start with 1,000 credits.
          </p>
          <label className="field">
            Session code (students type this if they can't scan)
            <input
              value={code}
              onChange={(e) => setCode(normaliseCode(e.target.value))}
              placeholder="e.g. CHAI26"
              maxLength={16}
            />
          </label>
          <label className="field">
            Workshop date
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <label className="field">
            Workshop title (appears on certificates)
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
            />
          </label>
          <button className="btn" disabled={creating}>
            {creating ? "Creating…" : "Create session"}
          </button>
          {msg && <span className="small">{msg}</span>}
        </form>
        <div className="card stack small">
          <h3>Running the day</h3>
          <ol style={{ margin: 0, paddingLeft: 18 }}>
            <li>
              Open the projector screen on the second display and set it to{" "}
              <b>Join QR</b>.
            </li>
            <li>
              Students scan, sign in with Google and use their team code to
              claim an available role.
            </li>
            <li>
              In <b>Run</b>, select an activity and press{" "}
              <b>Launch on phones</b>. Phones switch automatically.
            </li>
            <li>
              Use <b>Lock</b> to stop answers, and the panel buttons to reveal
              and score.
            </li>
            <li>
              Captains review submissions in their region dashboard. Apply
              approved awards in Workshop review.
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}
