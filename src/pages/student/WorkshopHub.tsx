import AnswerSummary from "../../components/AnswerSummary";
import { activityTitle } from "../../lib/presentation";
import { useState } from "react";
import { signOut } from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "../../lib/firestore";
import { auth, db } from "../../firebase";
import { useCollectionData, useDocData } from "../../lib/hooks";
import {
  AGENDAS,
  DEMO_URL,
  HASHTAG,
  PROFILES,
  WORKSHOP_URL,
} from "../../content/workshop";
import paperless from "../../content/paperless.json";
import { ACTIVITY_BY_ID } from "../../content/activities";
import type { StudentProps } from "./shared";
import type { Submission } from "../../types";
import { TEAM_BY_ID, ROLES } from "../../content/teams";
import { Qr } from "../../components/Qr";
export default function WorkshopHub({
  sid,
  uid,
  student,
  session,
}: StudentProps) {
  const [tab, setTab] = useState("Agenda");
  const [post, setPost] = useState("");
  const [status, setStatus] = useState("");
  const net = useDocData<{ completed?: string[] }>(
    `sessions/${sid}/networking/${uid}`,
  );
  const entry = useDocData<{ url: string }>(`sessions/${sid}/xEntries/${uid}`);
  const submissions =
    useCollectionData<Submission>(
      `sessions/${sid}/submissions`,
      "teamId",
      student.teamId,
      "scope",
      "team",
    ) ?? [];
  const plan = useDocData<Submission>(
    `sessions/${sid}/submissions/plan__${uid}`,
  );
  const pre = useDocData<Submission>(
    `sessions/${sid}/submissions/survey-pre__${uid}`,
  );
  const postSurvey = useDocData<Submission>(
    `sessions/${sid}/submissions/survey-post__${uid}`,
  );
  const personal = [plan, pre, postSurvey].filter(Boolean);
  const roster =
    useCollectionData<{ name: string; role: string }>(
      `sessions/${sid}/students`,
      "teamId",
      student.teamId,
    ) ?? [];
  const ledger =
    useCollectionData<{ delta: number; reason: string }>(
      `sessions/${sid}/ledger`,
      "teamId",
      student.teamId,
    ) ?? [];
  const reviews =
    useCollectionData<{
      activity: string;
      points: number;
      comment: string;
      status: string;
    }>(`sessions/${sid}/reviews`, "teamId", student.teamId) ?? [];
  async function complete(id: string) {
    try {
      setStatus("Pending server confirmation…");
      await setDoc(doc(db, `sessions/${sid}/networking/${uid}`), {
        teamId: student.teamId,
        region: TEAM_BY_ID[student.teamId].region,
        completed: [...new Set([...(net?.completed ?? []), id])],
        updatedAt: serverTimestamp(),
      });
      setStatus("Completion saved for captain review.");
    } catch (e) {
      setStatus((e as Error).message);
    }
  }
  async function savePost() {
    try {
      const u = new URL(post);
      if (
        !["x.com", "twitter.com", "www.x.com"].includes(u.hostname) ||
        !/^\/[^/]+\/status\/\d+\/?$/.test(u.pathname)
      )
        throw new Error(
          "Enter a public X post URL, such as https://x.com/yourhandle/status/123.",
        );
      await setDoc(doc(db, `sessions/${sid}/xEntries/${uid}`), {
        url: u.toString(),
        name: student.name,
        teamId: student.teamId,
        region: TEAM_BY_ID[student.teamId].region,
        updatedAt: serverTimestamp(),
      });
      setStatus("Best post submitted.");
    } catch (e) {
      setStatus((e as Error).message);
    }
  }
  return (
    <div className="stack">
      <nav className="tabs" aria-label="Workshop workspace">
        {["Agenda", "Team", "Networking", "Resources"].map((t) => (
          <button
            key={t}
            className={`tab ${tab === t ? "on" : ""}`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </nav>
      {tab === "Agenda" &&
        AGENDAS.map((day) => (
          <div className="card stack" key={day.day}>
            <h3>
              Day {day.day} · {day.title}
            </h3>
            <ul>
              {day.blocks.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </div>
        ))}
      {tab === "Team" && (
        <>
          <div className="card stack">
            <h3>Your startup</h3>
            {roster.map((r) => (
              <p key={r.id}>
                <b>
                  {r.name} · {r.role}
                </b>
                <br />
                {ROLES.find((x) => x.id === r.role)?.does}
              </p>
            ))}
          </div>
          <div className="card stack">
            <h3>Submitted work</h3>
            {!submissions.length && (
              <p className="muted">
                Your team’s confirmed submissions will appear here.
              </p>
            )}
            {submissions.map((s) => (
              <details key={s.id}>
                <summary>
                  {ACTIVITY_BY_ID[s.activity]?.title ?? s.activity} · {s.byName}
                </summary>
                <AnswerSummary
                  activity={s.activity}
                  values={s.values ?? s.accusation ?? s.answers ?? s.choices}
                />
              </details>
            ))}
          </div>
          <div className="card stack">
            <h3>Captain feedback</h3>
            <p className="small muted">
              Reviewed points become credits only after the facilitator applies
              them.
            </p>
            {!reviews.length && (
              <p className="muted">
                No reviews yet. Your captain will review submitted team work.
              </p>
            )}
            {reviews.map((r) => (
              <p key={r.id}>
                {activityTitle(r.activity)} ·{" "}
                {r.status === "approved" ? "Reviewed" : r.status} · {r.points}{" "}
                credits proposed
                <br />
                {r.comment}
              </p>
            ))}
          </div>
          <div className="card stack">
            <h3>Credit history</h3>
            {!ledger.length && (
              <p className="muted">
                No credit changes yet. Every applied award appears here.
              </p>
            )}
            {ledger.map((e) => (
              <p key={e.id}>
                {e.delta > 0 ? "+" : ""}
                {e.delta} · {e.reason}
              </p>
            ))}
          </div>
        </>
      )}
      {tab === "Networking" && (
        <>
          {PROFILES.map((p) => (
            <div className="card stack" key={p.id}>
              <h3>
                Day {p.day} · {p.title}
              </h3>
              <p>{p.task}</p>
              <a href={p.url} target="_blank" rel="noreferrer">
                Open Vishruth’s profile
              </a>
              <Qr text={p.url} size={130} />
              <button
                className="btn"
                disabled={
                  !session.networkingOpen ||
                  (net?.completed ?? []).includes(p.id)
                }
                onClick={() => complete(p.id)}
              >
                {net?.completed?.includes(p.id)
                  ? "Completed"
                  : "I completed these steps"}
              </button>
            </div>
          ))}
          <div className="card stack">
            <h3>Best Workshop Post or Photo</h3>
            <p>
              Post throughout Day2 with <b>{HASHTAG}</b>. Ask permission before
              sharing someone’s photo. One individual award at closing, judged
              on learning value, creativity and workshop spirit, not likes.
              Posting is optional and separate from the +100 team activity
              points.
            </p>
            <a
              href="https://x.com/search?q=%23ChaiCartCloudWorkshop&src=typed_query&f=live"
              target="_blank"
              rel="noreferrer"
            >
              Browse tagged posts
            </a>
            <label className="field">
              Your best post URL
              <input
                type="url"
                value={post || entry?.url || ""}
                onChange={(e) => setPost(e.target.value)}
              />
            </label>
            <button
              className="btn"
              disabled={!session.networkingOpen}
              onClick={savePost}
            >
              Submit best post before final awards
            </button>
          </div>
          <p className="small">
            Existing accounts, connections and follows count. Captains approve
            completion by all five teammates for +100 per activity, once per
            team, maximum +300.
          </p>
        </>
      )}
      {tab === "Resources" && (
        <>
          <div className="card stack">
            <h3>Workshop links</h3>
            <a href={DEMO_URL} target="_blank" rel="noreferrer">
              ChaiCart demo: Google sign-in and ordering
            </a>
            <p>
              The demo uses a separate login session. Staff controls remain in
              its facilitator page.
            </p>
            <a
              href={WORKSHOP_URL + "cheat-sheet.html"}
              target="_blank"
              rel="noreferrer"
            >
              Cloud cheat sheet
            </a>
            <a
              href={WORKSHOP_URL + "day1-slides.html"}
              target="_blank"
              rel="noreferrer"
            >
              Day1 slides
            </a>
            <a
              href={WORKSHOP_URL + "day2-slides.html"}
              target="_blank"
              rel="noreferrer"
            >
              Day2 slides
            </a>
            {paperless.questions
              .filter((q) => q.query)
              .map((q) => (
                <div key={q.id}>
                  <pre>{q.query}</pre>
                  <button
                    className="btn sm ghost"
                    onClick={() =>
                      navigator.clipboard
                        .writeText(q.query)
                        .then(() => setStatus("Query copied."))
                        .catch(() =>
                          setStatus("Select and copy the query text."),
                        )
                    }
                  >
                    Copy query
                  </button>
                </div>
              ))}
          </div>
          {paperless.decks
            .find((d) => d.id === "career")
            ?.cards.map((c) => (
              <div className="card stack" key={c.title}>
                <h3>{c.title}</h3>
                <p>{c.subtitle}</p>
                <p>{c.body}</p>
              </div>
            ))}
          <button
            className="btn ghost"
            onClick={() => {
              const blob = new Blob(
                [
                  JSON.stringify(
                    {
                      student,
                      personal,
                      submissions: submissions.map((s) => ({
                        activity: s.activity,
                        response: s.values,
                      })),
                    },
                    null,
                    2,
                  ),
                ],
                { type: "application/json" },
              );
              const a = document.createElement("a");
              a.href = URL.createObjectURL(blob);
              a.download = "my-chaicart-notes.json";
              a.click();
              URL.revokeObjectURL(a.href);
            }}
          >
            Download my team notes
          </button>
        </>
      )}
      {status && <p role="status">{status}</p>}
      <button className="btn ghost sm" onClick={() => signOut(auth)}>
        Sign out
      </button>
    </div>
  );
}
