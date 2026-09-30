import { useState } from 'react'
import type { SimpleActivity } from '../../content/activities'
import { cardOutcome, dealBill, shuffledControls } from '../../content/billshock'
import { useDocData } from '../../lib/hooks'
import { submissionId, submit } from '../../lib/session'
import type { Submission } from '../../types'
import { fmtTime, type StudentProps } from './shared'

export default function BillView({ sid, uid, student, session, activity }: StudentProps & { activity: SimpleActivity }) {
  const sub = useDocData<Submission>(`sessions/${sid}/submissions/${submissionId(activity.id, student.teamId)}`)
  const arch = useDocData<Submission>(`sessions/${sid}/submissions/${submissionId('architecture', student.teamId)}`)
  const [picked, setPicked] = useState<Record<string, string> | null>(null)
  const [status, setStatus] = useState('')
  const components = ((arch?.values as Record<string, unknown> | undefined)?.components as string[] | undefined) ?? []
  const saved = (sub?.controls as Record<string, string> | undefined) ?? {}
  const controls = picked ?? saved
  const cards = dealBill(sid, student.teamId)
  const open = session.state.phase === 'open'

  async function save() {
    setStatus('Saving…')
    try { await submit(sid, activity.id, 'team', uid, student, { controls }); setPicked(null); setStatus('Saved.') }
    catch { setStatus('Could not save: the activity is closed.') }
  }

  return (
    <div className="stack">
      {cards.map(card => {
        const outcome = cardOutcome(card, components)
        return (
          <div key={card.id} className="card stack">
            <div className="spread">
              <h3>{card.title}</h3>
              <span className={`pill ${outcome < 0 ? 'red' : 'ok'}`}>{outcome > 0 ? '+' : '−'}{Math.abs(outcome)} credits</span>
            </div>
            <p>{card.text}</p>
            {card.needs && (
              <p className="small muted">
                {components.includes(card.needs.component) ? 'Your architecture handled this.' : 'Your architecture did not include the protection for this.'}
              </p>
            )}
            {outcome < 0 && card.controls && (
              <div className="stack" style={{ gap: 6 }}>
                <span className="small" style={{ fontWeight: 600 }}>Which control would have prevented it? Correct = half back.</span>
                <div className="checks">
                  {shuffledControls(card, student.teamId).map(o => (
                    <label key={o} className="check">
                      <input type="radio" name={card.id} disabled={!open} checked={controls[card.id] === o} onChange={() => setPicked({ ...controls, [card.id]: o })} />
                      {o}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      })}
      {sub && <div className="pill ok">Saved by {sub.byName} {fmtTime(sub.updatedAt)}</div>}
      {status && status !== 'Saved.' && <div className="error">{status}</div>}
      <button className="btn lg block" disabled={!open} onClick={save}>{sub ? 'Update answers' : 'Submit answers'}</button>
    </div>
  )
}
