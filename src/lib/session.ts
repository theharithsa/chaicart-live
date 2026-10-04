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
export function submit(
  sid: string,
  activity: string,
  scope: "team" | "individual",
  uid: string,
  student: Student,
  data: Record<string, unknown>,
) {
  const key = scope === "team" ? student.teamId : uid;
  return setDoc(
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
}
