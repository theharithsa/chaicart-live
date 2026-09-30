import {
  collection, deleteField, doc, getDocs, limit, orderBy, query, runTransaction, serverTimestamp, where,
} from 'firebase/firestore'
import { db } from '../firebase'
import { START_CREDITS, TEAMS } from '../content/teams'

export interface CreditChange { teamId: string; delta: number }

/**
 * Applies credit changes atomically: one ledger entry per team plus the single leaderboard
 * document every screen listens to. `key` marks an activity as scored so it isn't applied twice.
 */
export async function applyCredits(sid: string, changes: CreditChange[], reason: string, key?: string) {
  const real = changes.filter(c => c.delta !== 0 && Number.isFinite(c.delta))
  if (!real.length) return 0
  const batch = crypto.randomUUID()
  const lbRef = doc(db, `sessions/${sid}/public/leaderboard`)
  const appliedRef = doc(db, `sessions/${sid}/private/applied`)
  await runTransaction(db, async tx => {
    const snap = await tx.get(lbRef)
    const scores: Record<string, number> = { ...(snap.data()?.scores ?? {}) }
    for (const c of real) {
      scores[c.teamId] = (scores[c.teamId] ?? START_CREDITS) + Math.round(c.delta)
      tx.set(doc(collection(db, `sessions/${sid}/ledger`)), {
        batch, teamId: c.teamId, delta: Math.round(c.delta), reason, key: key ?? null, at: serverTimestamp(),
      })
    }
    tx.set(lbRef, { scores, updatedAt: serverTimestamp() }, { merge: true })
    if (key) tx.set(appliedRef, { [key]: reason }, { merge: true })
  })
  return real.length
}

/** Reverses the most recent batch of credit changes. */
export async function undoLastBatch(sid: string) {
  const ledger = collection(db, `sessions/${sid}/ledger`)
  const last = await getDocs(query(ledger, orderBy('at', 'desc'), limit(1)))
  if (last.empty) return null
  const { batch, reason } = last.docs[0].data() as { batch: string; reason: string }
  const entries = await getDocs(query(ledger, where('batch', '==', batch)))
  const lbRef = doc(db, `sessions/${sid}/public/leaderboard`)
  const key = (entries.docs[0]?.data() as { key: string | null } | undefined)?.key ?? null
  await runTransaction(db, async tx => {
    const snap = await tx.get(lbRef)
    const scores: Record<string, number> = { ...(snap.data()?.scores ?? {}) }
    entries.docs.forEach(d => {
      const e = d.data() as { teamId: string; delta: number }
      scores[e.teamId] = (scores[e.teamId] ?? START_CREDITS) - e.delta
      tx.delete(d.ref)
    })
    tx.set(lbRef, { scores, updatedAt: serverTimestamp() }, { merge: true })
    if (key) tx.set(doc(db, `sessions/${sid}/private/applied`), { [key]: deleteField() }, { merge: true })
  })
  return reason
}

export const initialScores = () => Object.fromEntries(TEAMS.map(t => [t.id, START_CREDITS]))
