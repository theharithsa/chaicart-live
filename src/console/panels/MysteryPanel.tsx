import { useState } from 'react'
import { doc, setDoc } from 'firebase/firestore'
import { db } from '../../firebase'
import type { SimpleActivity } from '../../content/activities'
import { HINTS, SUSPECTS, WEAPONS } from '../../content/mystery'
import { TEAMS, TEAM_BY_ID } from '../../content/teams'
import { applyCredits } from '../../lib/credits'
import { useDocData, type WithId } from '../../lib/hooks'
import { fmtTime } from '../../pages/student/shared'
import type { Submission } from '../../types'
import { patchSession, signed, type PanelProps } from '../shared'
import { useKeys } from './QuizPanel'

interface Accusation { killer: string; weapon: string; accomplice: string; bonus: string; metric: string; log: string; trace: string; fix: string }
type Keys = NonNullable<ReturnType<typeof useKeys>>

export function gradeMystery(keys: Keys, subs: WithId<Submission>[], fixes: Record<string, boolean>) {
  const K = keys.MYSTERY_KEY
  const rows = subs.map(s => {
    const a = s.accusation as Accusation
    const time = (s.updatedAt as { toMillis?: () => number } | undefined)?.toMillis?.() ?? Infinity
    const killer = a.killer === K.killer
    const weapon = a.weapon === K.weapon
    let pts = killer ? K.points.killer : K.points.wrongKiller
    if (weapon) pts += K.points.weapon
    if (a.accomplice === K.accomplice) pts += K.points.accomplice
    if (a.bonus === K.bonus) pts += K.points.bonus
    if (fixes[s.teamId]) pts += K.points.fix
    return { s, a, time, killer, weapon, pts, first: false }
  })
  const firstRow = rows.filter(r => r.killer && r.weapon).sort((x, y) => x.time - y.time)[0]
  if (firstRow) { firstRow.first = true; firstRow.pts += K.points.first }
  return rows.sort((x, y) => x.time - y.time)
}

export default function MysteryPanel({ ctx, subs, isLive }: PanelProps & { activity: SimpleActivity }) {
  const keys = useKeys()
  const [msg, setMsg] = useState('')
  const { sid, session } = ctx
  const fixDoc = useDocData<{ fix: Record<string, boolean> }>(`sessions/${sid}/private/mystery`)
  const fixes = fixDoc?.fix ?? {}
  const hints = isLive ? session.state.index : 0
  const rows = keys ? gradeMystery(keys, subs, fixes) : []

  const toggleFix = (teamId: string) => setDoc(doc(db, `sessions/${sid}/private/mystery`), { fix: { [teamId]: !fixes[teamId] } }, { merge: true })

  async function apply() {
    if (ctx.applied.mystery && !confirm('Mystery credits were already applied. Apply again?')) return
    const n = await applyCredits(sid, rows.map(r => ({ teamId: r.s.teamId, delta: r.pts })), 'Who Killed Checkout?', 'mystery')
    setMsg(`Applied to ${n} teams.`)
  }

  return (
    <div className="stack">
      <div className="card stack">
        <div className="spread">
          <b>Hints revealed: {hints} / {HINTS.length}</b>
          {isLive && (
            <div className="row">
              <button className="btn sm ghost" disabled={hints === 0} onClick={() => patchSession(sid, { 'state.index': hints - 1 })}>Hide last</button>
              <button className="btn sm clay" disabled={hints >= HINTS.length} onClick={() => patchSession(sid, { 'state.index': hints + 1 })}>Reveal hint {hints + 1}</button>
            </div>
          )}
        </div>
        {HINTS.map((h, i) => <div key={i} className={`small ${i < hints ? '' : 'muted'}`}>{i + 1}. {h}</div>)}
      </div>
      <div className="card row">
        <b>{subs.length} / 24 accusations</b>
        <button className="btn" disabled={!keys || !rows.length} onClick={apply}>Apply mystery credits</button>
        {ctx.applied.mystery && <span className="pill ok">Applied</span>}
        {msg && <span className="small">{msg}</span>}
        <span className="small muted">Tick “fix” for a good fix and prevention (+50) before applying.</span>
      </div>
      <div className="table-wrap">
        <table className="t">
          <thead><tr><th>Time</th><th>Team</th><th>Killer</th><th>Weapon</th><th>Accomplice</th><th>Bonus</th><th>Evidence and fix</th><th>Fix +50</th><th className="num">Credits</th></tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.s.id}>
                <td>{fmtTime(r.s.updatedAt)}{r.first && <div className="pill clay">First</div>}</td>
                <td>{TEAM_BY_ID[r.s.teamId]?.name}<div className="tiny muted">{r.s.byName}</div></td>
                <td className={r.killer ? '' : 'error'}>{SUSPECTS.find(x => x.id === r.a.killer)?.name}</td>
                <td className={r.weapon ? '' : 'error'}>{WEAPONS.find(w => w.id === r.a.weapon)?.label}</td>
                <td>{r.a.accomplice === 'none' ? 'None' : SUSPECTS.find(x => x.id === r.a.accomplice)?.name}</td>
                <td>{r.a.bonus === keys?.MYSTERY_KEY.bonus ? '✓' : '—'}</td>
                <td className="small" style={{ maxWidth: 360 }}>
                  <div><b>Metric:</b> {r.a.metric}</div><div><b>Log:</b> {r.a.log}</div><div><b>Trace:</b> {r.a.trace}</div><div><b>Fix:</b> {r.a.fix}</div>
                </td>
                <td><input type="checkbox" checked={!!fixes[r.s.teamId]} onChange={() => toggleFix(r.s.teamId)} /></td>
                <td className="num"><b>{signed(r.pts)}</b></td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={9} className="empty">No accusations yet.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="small muted">Waiting: {TEAMS.filter(t => !subs.some(s => s.teamId === t.id)).map(t => t.name).join(', ') || 'none'}</p>
    </div>
  )
}
