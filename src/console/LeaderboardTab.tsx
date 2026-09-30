import { useState } from 'react'
import { REGIONS, TEAMS, START_CREDITS } from '../content/teams'
import { applyCredits, undoLastBatch } from '../lib/credits'
import type { ConsoleCtx } from './shared'

export default function LeaderboardTab({ ctx }: { ctx: ConsoleCtx }) {
  const { sid, scores } = ctx
  const [round, setRound] = useState<Record<string, string>>({})
  const [reason, setReason] = useState('')
  const [custom, setCustom] = useState<Record<string, string>>({})
  const [msg, setMsg] = useState('')
  const score = (id: string) => scores[id] ?? START_CREDITS

  const quick = async (teamId: string, delta: number) => {
    await applyCredits(sid, [{ teamId, delta }], 'Manual adjustment')
  }

  async function applyRound() {
    const changes = Object.entries(round).map(([teamId, v]) => ({ teamId, delta: Number(v) })).filter(c => c.delta)
    if (!changes.length) return
    const n = await applyCredits(sid, changes, reason.trim() || 'Round')
    setRound({})
    setReason('')
    setMsg(`Round applied to ${n} teams.`)
  }

  async function undo() {
    const r = await undoLastBatch(sid)
    setMsg(r ? `Undid: ${r}` : 'Nothing to undo.')
  }

  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="card row">
        <button className="btn ghost" onClick={undo}>Undo last change</button>
        <a className="btn ghost" href={`#/screen?s=${sid}`} target="_blank" rel="noreferrer">Open projector screen</a>
        {msg && <span className="small">{msg}</span>}
      </div>

      <div className="grid4">
        {REGIONS.map(r => {
          const teams = TEAMS.filter(t => t.region === r.id).sort((a, b) => score(b.id) - score(a.id))
          return (
            <div key={r.id} className="region-col">
              <div className="spread"><b style={{ fontFamily: 'var(--serif)', fontWeight: 500, fontSize: 18 }}>{r.name}</b></div>
              {teams.map((t, i) => (
                <div key={t.id} className="stack" style={{ gap: 4, padding: '8px 0', borderBottom: '1px solid var(--ivory-2)' }}>
                  <div className={`team-row${i === 0 ? ' top' : ''}`} style={{ border: 0, padding: 0 }}>
                    <span className="rk small muted">{i + 1}</span><span>{t.name}</span><span className="sc">{score(t.id).toLocaleString()}</span>
                  </div>
                  <div className="row" style={{ gap: 4 }}>
                    {[10, 50, 100].map(v => <button key={v} className="btn sm ok" onClick={() => quick(t.id, v)}>+{v}</button>)}
                    <button className="btn sm danger" onClick={() => quick(t.id, -50)}>−50</button>
                    <input style={{ width: 64, padding: '4px 8px', fontSize: 13 }} type="number" placeholder="±" value={custom[t.id] ?? ''}
                      onChange={e => setCustom({ ...custom, [t.id]: e.target.value })}
                      onKeyDown={async e => { if (e.key === 'Enter' && custom[t.id]) { await quick(t.id, Number(custom[t.id])); setCustom({ ...custom, [t.id]: '' }) } }} />
                  </div>
                </div>
              ))}
            </div>
          )
        })}
      </div>

      <div className="card stack">
        <h3>Enter a whole round</h3>
        <p className="small muted">For activities scored on paper (Timeline, Service sort, Debate, Bingo, Kitchen, Gallery). Type each team's credits from the captains' score sheets; blanks are skipped.</p>
        <div className="row">
          <input style={{ maxWidth: 320 }} placeholder="Round name, e.g. Human Timeline" value={reason} onChange={e => setReason(e.target.value)} />
          <button className="btn" onClick={applyRound}>Apply round</button>
        </div>
        <div className="grid4">
          {REGIONS.map(r => (
            <div key={r.id} className="stack" style={{ gap: 6 }}>
              <b className="small">{r.name}</b>
              {TEAMS.filter(t => t.region === r.id).map(t => (
                <label key={t.id} className="spread small">{t.name}
                  <input style={{ width: 80, padding: '5px 8px' }} type="number" value={round[t.id] ?? ''} onChange={e => setRound({ ...round, [t.id]: e.target.value })} />
                </label>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
