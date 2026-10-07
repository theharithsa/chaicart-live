import type { Timestamp } from "firebase/firestore";
import type { RoleId } from "./content/teams";

export type Phase = "open" | "locked" | "revealed";
export type ScreenMode = "join" | "leaderboard" | "activity";

export interface SessionState {
  phase: Phase;
  /** Question, card or hint index, depending on the activity kind. */
  index: number;
  /** Name of the map field that may only gain the current index (quiz answers, budget choices). */
  indexedField: string | null;
}

export interface SessionDoc {
  schemaVersion?: number;
  workshopDate?: string;
  certificatesIssued?: boolean;
  completedAt?: Timestamp | null;
  networkingOpen?: boolean;
  title: string;
  currentActivity: string | null;
  state: SessionState;
  timer: { endsAt: number; label: string } | null;
  screen: ScreenMode;
  createdAt?: Timestamp;
}

export interface Student {
  name: string;
  semester: "3" | "4" | "5" | "6" | "7" | "8";
  branch: string;
  teamId: string;
  role: RoleId;
  joinedAt?: Timestamp;
}

export interface Submission {
  activity: string;
  teamId: string;
  uid: string;
  byName: string;
  updatedAt?: Timestamp;
  locked?: boolean;
  [key: string]: unknown;
}

export interface LeaderboardDoc {
  scores: Record<string, number>;
}

export interface RevealDoc {
  activity: string;
  index: number;
  correct: number | null;
  explanation: string;
}
