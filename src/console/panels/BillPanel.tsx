import { useState } from 'react'
import type { SimpleActivity } from '../../content/activities'
import { evaluateBill } from '../../content/billshock'
import { REGIONS, TEAMS } from '../../content/teams'
import { applyCredits } from '../../lib/credits'
import { signed, type PanelProps } from '../shared'
import { useArchitecture } from './BudgetPanel'

export default function BillPanel({ ctx, subs }: PanelProps & { activity: SimpleActivity }) {
  const [msg, setMsg] = useState('')
  const components = useArchitecture(ctx.sid)
  const results = TEAMS.map(t => {
    const sub = subs.find(s => s.teamId === t.id)
    return { team: t, submitted: !!sub, ...evaluateBill(ctx.sid, t.id, components(t.id), (sub?.controls as Record<string, string> | undefined) ?? {}) }
  })

  async function apply() {
    if (ctx.applied.billshock && !confirm('Bill Shock credits were already applied. Apply again?')) return
    const n = await applyCredits(ctx.sid, results.map(r => ({ teamId: r.team.id, delta: r.total })), 'Cloud Bill Shock', 'billshock')
    setMsg(`Applied to ${n} teams.`)
  }

  return (
    <div className="stack">
      <div className="card row">
        <b>{subs.length} / 24 teams answered</b>
        <button className="btn" onClick={apply}>Apply bill credits</button>
        {ctx.applied.billshock && <span className="pill ok">Applied</span>}
        {msg && <span className="small">{msg}</span>}
        <span className="small muted">Cards are dealt automatically. Teams that don't answer still get their card outcomes, without refunds.</span>
      </div>
      <div className="grid4">
        {REGIONS.map(r => (
          <div key={r.id} className="region-col stack" style={{ gap: 8 }}>
            <b style={{ fontFamily: 'var(--serif)', fontWeight: 500 }}>{r.name}</b>
            {results.filter(x => x.team.region === r.id).map(x => (
              <div key={x.team.id} className="stack" style={{ gap: 2, borderTop: '1px solid var(--ivory-2)', paddingTop: 6 }}>
                <div className="spread"><b className="small">{x.team.name} {x.submitted ? '✓' : ''}</b><span className="sc"><b>{signed(x.total)}</b></span></div>
                {x.cards.map(c => (
                  <div key={c.card.id} className="tiny muted">{c.card.title}: {signed(c.outcome)}{c.refund ? ` (refund +${c.refund})` : ''}</div>
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
