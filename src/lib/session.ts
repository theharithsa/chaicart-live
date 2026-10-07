import { businessEvent } from "./rum-business.js";
import { doc, serverTimestamp, setDoc } from "./firestore";
import { db } from "../firebase";
import type { Student } from "../types";

const KEY = "chaicart-session";

export const storedSession = () => localStorage.getItem(KEY) ?? "";
export const storeSession = (sid: string) => localStorage.setItem(KEY, sid);

export const normaliseCode = (s: string) =>
  s
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "");

export const sessionPath = (sid: string) => `sessions/${sid}`;
export const submissionId = (activity: string, key: string) =>
  `${activity}__${key}`;

export function joinUrl(sid: string) {
  const base = window.location.href.split("#")[0];
  return `${base}#/join?s=${encodeURIComponent(sid)}`;
}

/** Writes (merges) a student or team submission for the live activity. Security rules enforce ownership and timing. */
export async function submit(
  sid: string,
  activity: string,
  scope: "team" | "individual",
  uid: string,
  student: Student,
  data: Record<string, unknown>,
) {
  const key = scope === "team" ? student.teamId : uid;
  await setDoc(
    doc(db, `sessions/${sid}/submissions/${submissionId(activity, key)}`),
    {
      ...data,
      scope,
      activity,
      teamId: student.teamId,
      uid,
      byName: student.name,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
  const props: Record<string, unknown> = {
    "workshop.session.id": sid,
    "workshop.team.id": student.teamId,
    "workshop.activity.id": activity,
    "submission.scope": scope,
    outcome: "success",
  };
  if (activity === "survey-pre" || activity === "survey-post") {
    const values = data.values as Record<string, unknown> | undefined;
    businessEvent("survey.submitted", {
      ...props,
      "survey.stage": activity === "survey-pre" ? "pre" : "post",
      "survey.ratings": values,
      ...(typeof values?.nps === "number" ? { "survey.nps": values.nps } : {}),
    });
  } else if (typeof data.choice === "string")
    businessEvent("vote.submitted", {
      ...props,
      "vote.target.team.id": data.choice,
    });
  else if (data.answers) {
    for (const [q, answer] of Object.entries(
      data.answers as Record<string, unknown>,
    ))
      businessEvent("quiz.answer.submitted", {
        ...props,
        "quiz.question.index": Number(q),
        "quiz.answer": answer,
      });
  } else businessEvent("work.submitted", props);
}
