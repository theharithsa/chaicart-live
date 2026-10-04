import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from "./firestore";
import { auth, db } from "../firebase";
import { START_CREDITS, TEAMS } from "../content/teams";

export interface CreditChange {
  teamId: string;
  delta: number;
}

/**
 * Applies credit changes atomically: one ledger entry per team plus the single leaderboard
 * document every screen listens to. `key` marks an activity as scored so it isn't applied twice.
 */
export async function applyCredits(
  sid: string,
  changes: CreditChange[],
  reason: string,
  key?: string,
) {
  const real = changes.filter((c) => c.delta !== 0 && Number.isFinite(c.delta));
  if (!real.length) return 0;
  const batch = crypto.randomUUID();
  const refs = real.map(() => doc(collection(db, `sessions/${sid}/ledger`)));
  const lbRef = doc(db, `sessions/${sid}/public/leaderboard`);
  const appliedRef = doc(db, `sessions/${sid}/private/applied`);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(lbRef);
    const applied = key ? ((await tx.get(appliedRef)).data() ?? {}) : {};
    if (key && applied[key])
      throw new Error(
        "This award was already applied. Use a correction instead.",
      );
    if (
      key?.startsWith("review:bingo:") &&
      Object.keys(applied).filter((k) => k.startsWith("review:bingo:"))
        .length >= 3
    )
      throw new Error(
        "The first three Bingo awards have already been applied.",
      );
    if (
      key?.startsWith("review:gallery:") &&
      Object.keys(applied).filter((k) => k.startsWith("review:gallery:"))
        .length >= 4
    )
      throw new Error("Four Gallery awards have already been applied.");
    if (
      key?.startsWith("review:timeline:") &&
      Object.keys(applied).some(
        (k) =>
          k.startsWith("review:timeline:") &&
          k.split(":")[2]?.split("-")[0] === key.split(":")[2]?.split("-")[0],
      )
    )
      throw new Error("This region already has its Timeline winner.");
    const scores: Record<string, number> = { ...(snap.data()?.scores ?? {}) };
    for (const [i, c] of real.entries()) {
      scores[c.teamId] =
        (scores[c.teamId] ?? START_CREDITS) + Math.round(c.delta);
      tx.set(refs[i], {
        actor: auth.currentUser?.uid ?? "",
        batch,
        teamId: c.teamId,
        delta: Math.round(c.delta),
        reason,
        key: key ?? null,
        at: serverTimestamp(),
      });
    }
    tx.set(lbRef, { scores, updatedAt: serverTimestamp() }, { merge: true });
    if (key) tx.set(appliedRef, { [key]: reason }, { merge: true });
  });
  return real.length;
}

/** Reverses the most recent batch of credit changes. */
export async function undoLastBatch(sid: string) {
  const ledger = collection(db, `sessions/${sid}/ledger`);
  const last = await getDocs(query(ledger, orderBy("at", "desc"), limit(100)));
  if (last.empty) return null;
  const marker = await getDoc(doc(db, `sessions/${sid}/private/reversals`));
  const entry = last.docs.find(
    (d) => !d.data().correctionOf && !marker.data()?.[d.data().batch],
  );
  if (!entry) return null;
  const { batch, reason } = entry.data() as { batch: string; reason: string };
  const entries = await getDocs(query(ledger, where("batch", "==", batch)));
  const lbRef = doc(db, `sessions/${sid}/public/leaderboard`);
  const key =
    (entries.docs[0]?.data() as { key: string | null } | undefined)?.key ??
    null;
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(lbRef);
    const scores: Record<string, number> = { ...(snap.data()?.scores ?? {}) };
    const reversal = doc(db, `sessions/${sid}/private/reversals`);
    const reversed = await tx.get(reversal);
    if (reversed.data()?.[batch]) throw new Error("Already corrected.");
    entries.docs.forEach((d) => {
      const e = d.data() as { teamId: string; delta: number };
      scores[e.teamId] = (scores[e.teamId] ?? START_CREDITS) - e.delta;
      tx.set(doc(collection(db, `sessions/${sid}/ledger`)), {
        batch: `reversal:${batch}`,
        teamId: e.teamId,
        delta: -e.delta,
        reason: `Correction: ${reason}`,
        actor: auth.currentUser?.uid ?? "",
        at: serverTimestamp(),
        correctionOf: batch,
      });
    });
    tx.set(lbRef, { scores, updatedAt: serverTimestamp() }, { merge: true });
    tx.set(reversal, { [batch]: true }, { merge: true });
    if (key)
      tx.set(
        doc(db, `sessions/${sid}/private/applied`),
        { [key]: deleteField() },
        { merge: true },
      );
  });
  return reason;
}

export const initialScores = () =>
  Object.fromEntries(TEAMS.map((t) => [t.id, START_CREDITS]));
