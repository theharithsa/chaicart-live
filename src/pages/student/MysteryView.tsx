import { useState } from 'react'
import type { SimpleActivity } from '../../content/activities'
import { BONUS_OPTIONS, HINTS, SUSPECTS, WEAPONS } from '../../content/mystery'
import { useDocData } from '../../lib/hooks'
import { submissionId, submit } from '../../lib/session'
import type { Submission } from '../../types'
import { Evidence } from '../../components/Evidence'
import { fmtTime, type StudentProps } from './shared'

interface Accusation { killer: string; weapon: string; accomplice: string; bonus: string; metric: string; log: string; trace: string; fix: string }

const EMPTY: Accusation = { killer: '', weapon: '', accomplice: '', bonus: '', metric: '', log: '', trace: '', fix: '' }

export default function MysteryView({ sid, uid, student, session, activity }: StudentProps & { activity: SimpleActivity }) {
  const sub = useDocData<Submission>(`sessions/${sid}/submissions/${submissionId(activity.id, student.teamId)}`)
  const [form, setForm] = useState<Accusation>(EMPTY)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const hints = HINTS.slice(0, session.state.index)
  const open = session.state.phase === 'open'
  const set = (k: keyof Accusation) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value })
  const ready = form.killer && form.weapon && form.accomplice && form.metric.trim() && form.log.trim() && form.trace.trim() && form.fix.trim()

  async function accuse(e: React.FormEvent) {
    e.preventDefault()
    if (!ready || !confirm('Submit your accusation? Your team can only submit once.')) return
    setBusy(true)
    setError('')
    try { await submit(sid, activity.id, 'team', uid, student, { accusation: form, locked: true }) }
    catch { setError('Could not submit: another teammate may have submitted already, or time is up.') }
    finally { setBusy(false) }
  }

  const done = sub?.accusation as Accusation | undefined

  return (
    <div className="stack">
      {hints.length > 0 && (
        <div className="card dark stack">
          <span className="kicker" style={{ color: 'var(--clay)' }}>Hints</span>
          {hints.map((h, i) => <p key={i}>{i + 1}. {h}</p>)}
        </div>
      )}
      <div className="card"><Evidence /></div>
      {done ? (
        <div className="card accent stack">
          <b>Accusation submitted by {sub?.byName} at {fmtTime(sub?.updatedAt)}</b>
          <p className="small">Killer: {SUSPECTS.find(s => s.id === done.killer)?.name} · Weapon: {WEAPONS.find(w => w.id === done.weapon)?.label}</p>
          <p className="muted small">Wait for the reveal.</p>
        </div>
      ) : (
        <form className="card stack" onSubmit={accuse}>
          <h3>Accusation form</h3>
          <label className="field">The killer
            <select value={form.killer} onChange={set('killer')} disabled={!open}>
              <option value="" disabled>Choose…</option>
              {SUSPECTS.map(s => <option key={s.id} value={s.id}>{s.name} ({s.what})</option>)}
            </select>
          </label>
          <label className="field">The weapon: how exactly did checkout die?
            <select value={form.weapon} onChange={set('weapon')} disabled={!open}>
              <option value="" disabled>Choose…</option>
              {WEAPONS.map(w => <option key={w.id} value={w.id}>{w.label}</option>)}
            </select>
          </label>
          <label className="field">Accomplice
            <select value={form.accomplice} onChange={set('accomplice')} disabled={!open}>
              <option value="" disabled>Choose…</option>
              <option value="none">No accomplice</option>
              {SUSPECTS.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <label className="field">Evidence: a metric<input value={form.metric} onChange={set('metric')} maxLength={300} disabled={!open} /></label>
          <label className="field">Evidence: a log line<input value={form.log} onChange={set('log')} maxLength={300} disabled={!open} /></label>
          <label className="field">Evidence: a trace<input value={form.trace} onChange={set('trace')} maxLength={300} disabled={!open} /></label>
          <label className="field">Immediate fix and how to prevent it<textarea value={form.fix} onChange={set('fix')} maxLength={1000} disabled={!open} /></label>
          <label className="field">Bonus (Code tab): what makes the problem worse?
            <select value={form.bonus} onChange={set('bonus')} disabled={!open}>
              <option value="">Skip the bonus</option>
              {BONUS_OPTIONS.map(b => <option key={b.id} value={b.id}>{b.label}</option>)}
            </select>
          </label>
          {error && <div className="error">{error}</div>}
          <button className="btn clay lg block" disabled={!ready || !open || busy}>Submit accusation</button>
        </form>
      )}
    </div>
  )
}
