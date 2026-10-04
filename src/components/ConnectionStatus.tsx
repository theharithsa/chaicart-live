import { useEffect, useState } from "react";
export default function ConnectionStatus() {
  const [online, setOnline] = useState(navigator.onLine);
  const [error, setError] = useState("");
  useEffect(() => {
    const state = () => setOnline(navigator.onLine);
    const failure = (e: Event) => setError((e as CustomEvent<string>).detail);
    window.addEventListener("online", state);
    window.addEventListener("offline", state);
    window.addEventListener("chaicart-data-error", failure);
    return () => {
      window.removeEventListener("online", state);
      window.removeEventListener("offline", state);
      window.removeEventListener("chaicart-data-error", failure);
    };
  }, []);
  return (
    <>
      {!online && (
        <div className="error" role="status">
          Offline: drafts stay on this device. Scored submissions need server
          confirmation.
        </div>
      )}
      {error && (
        <div className="error" role="alert">
          {error}{" "}
          <button className="btn sm ghost" onClick={() => setError("")}>
            Dismiss
          </button>
        </div>
      )}
    </>
  );
}
