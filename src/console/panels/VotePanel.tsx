import { useState } from 'react'
import type { VoteActivity } from '../../content/activities'
import { REGIONS, TEAMS, TEAM_BY_ID } from '../../content/teams'
import { applyCredits } from '../../lib/credits'
import type { PanelProps } from '../shared'
import type { WithId } from '../../lib/hooks'
import type { Submission } from '../../types'

export function tally(subs: WithId<Submission>[]) {
  return REGIONS.map(r => {
    const teams = TEAMS.filter(t => t.region === r.id)
    const counts = teams.map(t => ({ team: t, votes: subs.filter(s => s.choice === t.id && TEAM_BY_ID[s.teamId]?.region === r.id).length }))
    const voted = subs.filter(s => TEAM_BY_ID[s.teamId]?.region === r.id).length
    const top = Math.max(0, ...counts.map(c => c.votes))
    return { region: r, counts, voted, winners: top > 0 ? counts.filter(c => c.votes === top).map(c => c.team) : [] }
  })
}

export default function VotePanel({ ctx, activity, subs }: PanelProps & { activity: VoteActivity }) {
  const [msg, setMsg] = useState('')
  const results = tally(subs)
  const key = `vote:${activity.id}`

  async function award() {
    if (ctx.applied[key] && !confirm('Already applied. Apply again?')) return
    const changes = results.flatMap(r => r.winners.map(t => ({ teamId: t.id, delta: activity.award })))
    const n = await applyCredits(ctx.sid, changes, `${activity.title}: region winners`, key)
    setMsg(`Awarded ${n} teams.`)
  }

  return (
    <div className="stack">
      {activity.award > 0 && (
        <div className="card row">
          <button className="btn" onClick={award}>Award region winners (+{activity.award})</button>
          {ctx.applied[key] && <span className="pill ok">Applied</span>}
          {msg && <span className="small">{msg}</span>}
          <span className="small muted">Ties: every tied team wins.</span>
        </div>
      )}
      <div className="grid4">
        {results.map(r => (
          <div key={r.region.id} className="region-col stack" style={{ gap: 8 }}>
            <div className="spread"><b style={{ fontFamily: 'var(--serif)', fontWeight: 500 }}>{r.region.name}</b><span className="pill">{r.voted}/6 voted</span></div>
            <div className="bars">
              {r.counts.map(c => (
                <div key={c.team.id} className={`bar-row${r.winners.includes(c.team) ? ' correct' : ''}`} style={{ gridTemplateColumns: '90px 1fr 28px' }}>
                  <span className="small">{c.team.name}</span>
                  <div className="bar-track"><div className="bar-fill" style={{ width: `${(c.votes / 5) * 100}%` }} /></div>
                  <span className="n">{c.votes}</span>
                </div>
              ))}
            </div>
            {r.winners.length > 0 && <span className="small">Leading: <b>{r.winners.map(w => w.name).join(', ')}</b></span>}
          </div>
        ))}
      </div>
    </div>
  )
}
