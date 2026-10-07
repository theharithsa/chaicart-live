import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { normaliseCode, storedSession } from "../lib/session";

export default function Home() {
  const [code, setCode] = useState(storedSession());
  const navigate = useNavigate();
  return (
    <main className="page landing stack" style={{ gap: 22, paddingTop: 48 }}>
      <div className="star" />
      <div>
        <div className="kicker">
          GM University · CSE – Cloud Computing
        </div>
        <h1 style={{ marginTop: 8 }}>
          ChaiCart at GM University.
          <br />
          Two days to build it.
        </h1>
        <p>
          Welcome, 2nd, 3rd and 4th year students. Join four teammates, build
          your cloud architecture, and put it to the test.
        </p>
      </div>
      <ol className="join-steps" aria-label="How to join">
        <li>
          <b>01</b>
          <span>Google sign-in</span>
        </li>
        <li>
          <b>02</b>
          <span>Team code</span>
        </li>
        <li>
          <b>03</b>
          <span>Choose your role</span>
        </li>
      </ol>
      <form
        className="card stack"
        onSubmit={(e) => {
          e.preventDefault();
          if (code) navigate(`/join?s=${normaliseCode(code)}`);
        }}
      >
        <label className="field">
          Session code
          <input
            value={code}
            onChange={(e) => setCode(normaliseCode(e.target.value))}
            placeholder="e.g. CHAI26"
            autoCapitalize="characters"
            aria-describedby="session-help"
            autoComplete="off"
            required
          />
        </label>
        <button className="btn lg block" disabled={!code}>
          Join the workshop
        </button>
        <p id="session-help" className="muted small">
          Use the session code on the projector. Your captain gives you a
          separate team code after sign-in.
        </p>
      </form>
      <p className="small muted center">
        Facilitator or captain? <Link to="/console">Facilitator console</Link> ·{" "}
        <Link to="/captain">Captain dashboard</Link>
      </p>
    </main>
  );
}
