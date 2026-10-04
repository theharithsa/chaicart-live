import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import type { Activity } from "../content/activities";
import type { SessionDoc, SessionState, Student, Submission } from "../types";
import type { WithId } from "../lib/hooks";

export interface ConsoleCtx {
  sid: string;
  session: SessionDoc;
  students: WithId<Student>[];
  scores: Record<string, number>;
  applied: Record<string, string>;
}

export interface PanelProps {
  ctx: ConsoleCtx;
  activity: Activity;
  subs: WithId<Submission>[];
  isLive: boolean;
}

export const patchSession = (
  sid: string,
  patch: Partial<SessionDoc> | Record<string, unknown>,
) => updateDoc(doc(db, `sessions/${sid}`), patch);

export function stateFor(activity: Activity): SessionState {
  return {
    phase: "open",
    index: 0,
    indexedField:
      activity.kind === "quiz"
        ? "answers"
        : activity.kind === "budget"
          ? "choices"
          : null,
  };
}

export const membersByTeam = (students: WithId<Student>[]) => {
  const m: Record<string, WithId<Student>[]> = {};
  students.forEach((s) => {
    (m[s.teamId] ??= []).push(s);
  });
  return m;
};

export function downloadCsv(
  name: string,
  rows: (string | number | undefined)[][],
) {
  const esc = (v: string | number | undefined) =>
    `"${String(v ?? "").replace(/"/g, '""')}"`;
  const blob = new Blob([rows.map((r) => r.map(esc).join(",")).join("\n")], {
    type: "text/csv",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
}

export const signed = (n: number) =>
  `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n)}`;

export const startTimer = (sid: string, minutes: number, label: string) =>
  patchSession(sid, { timer: { endsAt: Date.now() + minutes * 60000, label } });
