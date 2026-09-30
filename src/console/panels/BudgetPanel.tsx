import { useState } from 'react'
import type { SimpleActivity } from '../../content/activities'
import { BUDGET_CARDS, completeChoices, evaluateBudget, type BudgetChoice } from '../../content/budget'
import { REGIONS, TEAMS } from '../../content/teams'
import { applyCredits } from '../../lib/credits'
import { useCollectionData, type WithId } from '../../lib/hooks'
import type { Submission } from '../../types'
import { patchSession, signed, type PanelProps } from '../shared'

export function useArchitecture(sid: string) {
  const arch = useCollectionData<Submission>(`sessions/${sid}/submissions`, 'activity', 'architecture') ?? []
  return (teamId: string) => ((arch.find(a => a.teamId === teamId)?.values as Record<string, unknown> | undefined)?.components as string[] | undefined) ?? []
}

export default function BudgetPanel({ ctx, subs, isLive }: PanelProps & { activity: SimpleActivity }) {
  const [msg, setMsg] = useState('')
  const { sid, session } = ctx
  const components = useArchitecture(sid)
  const idx = isLive ? session.state.index : 0
  const card = BUDGET_CARDS[idx]
  const byTeam: Record<string, WithId<Submission>> = Object.fromEntries(subs.map(s => [s.teamId, s]))
  const results = TEAMS.map(t => {
    const choices = (byTeam[t.id]?.choices as Record<string, BudgetChoice> | undefined) ?? {}
    return { team: t, decided: !!choices[String(idx)], result: evaluateBudget(completeChoices(choices, Math.min(idx, BUDGET_CARDS.length)), components(t.id)) }
  })
  const finalResults = TEAMS.map(t => {
    const choices = (byTeam[t.id]?.choices as Record<string, BudgetChoice> | undefined) ?? {}
    return { teamId: t.id, delta: evaluateBudget(completeChoices(choices, BUDGET_CARDS.length), components(t.id)).total }
  })

  async function apply() {
    if (ctx.applied.budget && !confirm('Error Budget Poker credits were already applied. Apply again?')) return
    const n = await applyCredits(sid, finalResults, 'Error Budget Poker', 'budget')
    setMsg(`Applied to ${n} teams.`)
  }

  const decidedCount = results.filter(r => r.decided).length

  return (
    <div className="stack">
      <div className="card stack">
        <div className="spread">
          <span className="muted small">{card ? `Card ${idx + 1} of ${BUDGET_CARDS.length}${card.forced ? ' · forced' : ''}` : 'Month over'}</span>
          {card && <span className="pill">{decidedCount} / 24 decided</span>}
        </div>
        {card ? (
          <>
            <h3 style={{ fontSize: 22 }}>{card.title}</h3>
            <p>{card.text}</p>
            <p className="small"><b>A:</b> {card.a}{card.b && <><br /><b>B:</b> {card.b}</>}</p>
          </>
        ) : <p>All cards played. Undecided cards count as option B; forced cards always apply.</p>}
        {isLive && (
          <div className="row">
            <button className="btn ghost" disabled={idx === 0} onClick={() => patchSession(sid, { 'state.index': idx - 1, 'state.phase': 'open' })}>Previous card</button>
            <button className="btn" disabled={idx >= BUDGET_CARDS.length} onClick={() => patchSession(sid, { 'state.index': idx + 1, 'state.phase': 'open' })}>
              {idx === BUDGET_CARDS.length - 1 ? 'End the month' : 'Next card'}
            </button>
          </div>
        )}
      </div>
      <div className="card row">
        <button className="btn" disabled={idx < BUDGET_CARDS.length} onClick={apply}>Apply final credits</button>
        {ctx.applied.budget && <span className="pill ok">Applied</span>}
        {msg && <span className="small">{msg}</span>}
      </div>
      <div className="grid4">
        {REGIONS.map(r => (
          <div key={r.id} className="region-col">
            <b style={{ fontFamily: 'var(--serif)', fontWeight: 500 }}>{r.name}</b>
            {results.filter(x => x.team.region === r.id).map(x => (
              <div key={x.team.id} className="team-row" style={{ gridTemplateColumns: '1fr auto auto' }}>
                <span>{x.team.name} {x.decided ? '✓' : ''}</span>
                <span className={`small ${x.result.minutes < 0 ? 'error' : 'muted'}`}>{x.result.minutes} min</span>
                <span className="sc small">{signed(x.result.credits)}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
