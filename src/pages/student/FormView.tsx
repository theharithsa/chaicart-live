import { useEffect, useState } from "react";
import type { FormActivity } from "../../content/activities";
import { TEAM_BY_ID } from "../../content/teams";
import { useDocData } from "../../lib/hooks";
import { submissionId, submit } from "../../lib/session";
import type { Submission } from "../../types";
import {
  FormFields,
  missingRequired,
  type FormValues,
} from "../../components/FormFields";
import { fmtTime, type StudentProps } from "./shared";

export default function FormView({
  sid,
  uid,
  student,
  session,
  activity,
}: StudentProps & { activity: FormActivity }) {
  const key = activity.scope === "team" ? student.teamId : uid;
  const sub = useDocData<Submission>(
    `sessions/${sid}/submissions/${submissionId(activity.id, key)}`,
  );
  const draftKey = `draft:${sid}:${activity.id}:${uid}`;
  const [draft, setDraft] = useState<FormValues | null>(() => {
    try {
      return JSON.parse(localStorage.getItem(draftKey) ?? "null");
    } catch {
      return null;
    }
  });
  useEffect(() => {
    if (draft) localStorage.setItem(draftKey, JSON.stringify(draft));
  }, [draft, draftKey]);
  const [status, setStatus] = useState("");
  const saved = (sub?.values as FormValues | undefined) ?? {};
  const values = draft ?? saved;
  const open =
    session.state.phase === "open" &&
    (activity.scope === "individual" || student.role === "COO");
  const team = TEAM_BY_ID[student.teamId];
  const variant = activity.variants?.[team.index % activity.variants.length];

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const missing = missingRequired(activity.fields, values);
    if (missing.length) {
      setStatus(`Please complete: ${missing.map((f) => f.label).join(", ")}`);
      return;
    }
    setStatus("Pending server confirmation…");
    try {
      await submit(sid, activity.id, activity.scope, uid, student, { values });
      localStorage.removeItem(draftKey);
      setDraft(null);
      setStatus("Saved.");
    } catch {
      setStatus(
        "Could not save. Check your connection and whether the activity is open; your draft is kept.",
      );
    }
  }

  return (
    <form className="stack" onSubmit={save}>
      {variant && (
        <div className="card dark stack">
          <span className="kicker" style={{ color: "var(--clay)" }}>
            Your scenario
          </span>
          <h3>{variant.title}</h3>
          <p>{variant.body}</p>
        </div>
      )}
      {sub && (
        <div className="pill ok">
          Submitted{activity.scope === "team" ? ` by ${sub.byName}` : ""}{" "}
          {fmtTime(sub.updatedAt)}
          {open ? " · you can still update it" : ""}
        </div>
      )}
      <div className="card">
        <FormFields
          fields={activity.fields}
          values={values}
          disabled={!open}
          onChange={(id, v) => setDraft({ ...values, [id]: v })}
        />
      </div>
      {activity.scope === "team" && (
        <p className="muted small">
          One answer per team. The COO submits; teammates discuss and view the
          saved response.
        </p>
      )}
      {status && (
        <div className={status.startsWith("Saved") ? "pill ok" : "error"}>
          {status}
        </div>
      )}
      <button className="btn lg block" disabled={!open}>
        {sub ? "Update" : "Submit"}
      </button>
    </form>
  );
}
