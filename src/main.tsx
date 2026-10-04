import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const configured = Boolean(
  import.meta.env.VITE_FIREBASE_API_KEY &&
  import.meta.env.VITE_FIREBASE_PROJECT_ID,
);
const App = lazy(() => import("./App"));

function SetupNeeded() {
  return (
    <div className="page">
      <div className="card hero stack">
        <div className="star" />
        <h1>ChaiCart Live needs a Firebase project</h1>
        <p>
          Copy <code>.env.example</code> to <code>.env.local</code>, fill in
          your Firebase web app settings, and restart the dev server. The README
          explains every step.
        </p>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {configured ? (
      <Suspense fallback={<div className="empty">Loading…</div>}>
        <App />
      </Suspense>
    ) : (
      <SetupNeeded />
    )}
  </StrictMode>,
);
