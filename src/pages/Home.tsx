import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { normaliseCode, storedSession } from "../lib/session";

export default function Home() {
  const [code, setCode] = useState(storedSession());
  const navigate = useNavigate();
  return (
    <div className="page stack" style={{ gap: 18, paddingTop: 48 }}>
      <div className="star" />
      <div>
        <div className="kicker">
          Cloud Computing &amp; Business Systems Workshop
        </div>
        <h1 style={{ marginTop: 8 }}>ChaiCart Live</h1>
        <p>
          Build a startup in the cloud with your team, then keep it alive when
          things break.
        </p>
      </div>
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
          />
        </label>
        <button className="btn lg block" disabled={!code}>
          Join the workshop
        </button>
        <p className="muted small">Or scan the QR code on the projector.</p>
      </form>
      <p className="small muted center">
        Facilitator or captain? <Link to="/console">Facilitator console</Link> ·{" "}
        <Link to="/captain">Captain dashboard</Link>
      </p>
    </div>
  );
}
