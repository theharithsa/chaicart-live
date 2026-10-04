import { doc, runTransaction, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import type { Student } from "../types";

export async function joinTeam(
  sid: string,
  uid: string,
  student: Student,
  code: string,
) {
  const profile = doc(db, `sessions/${sid}/students/${uid}`);
  const team = doc(db, `sessions/${sid}/teams/${student.teamId}`);
  await runTransaction(db, async (tx) => {
    const [existing, roster] = await Promise.all([
      tx.get(profile),
      tx.get(team),
    ]);
    if (existing.exists())
      throw new Error(
        "Already registered. Ask your facilitator to change your team.",
      );
    if (
      !roster.exists() ||
      roster.data().joinCode !== code.trim().toUpperCase()
    )
      throw new Error("Check your team code with your captain.");
    const slots = roster.data().slots ?? {};
    if (slots[student.role])
      throw new Error("That role was just taken. Choose another role.");
    tx.update(team, { [`slots.${student.role}`]: uid });
    tx.set(profile, { ...student, joinedAt: serverTimestamp() });
  });
}
