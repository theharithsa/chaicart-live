import { useState } from 'react'
import { ACTIVITIES, type Activity } from '../content/activities'
import { useCollectionData } from '../lib/hooks'
import type { ScreenMode, Submission } from '../types'
import { patchSession, startTimer, stateFor, type ConsoleCtx } from './shared'
import QuizPanel from './panels/QuizPanel'
import FormPanel from './panels/FormPanel'
import VotePanel from './panels/VotePanel'
import MysteryPanel from './panels/MysteryPanel'
import BudgetPanel from './panels/BudgetPanel'
import BillPanel from './panels/BillPanel'

const TIMERS = [1, 2, 3, 5, 7, 8, 10, 15, 25]
const SCREENS: { id: ScreenMode; label: string }[] = [
  { id: 'join', label: 'Join QR' },
  { id: 'leaderboard', label: 'Leaderboard' },
  { id: 'activity', label: 'Live activity' },
]

const appliedKeyFor = (a: Activity) => ({ quiz: `quiz:${a.id}`, form: `form:${a.id}`, vote: `vote:${a.id}`, mystery: 'mystery', budget: 'budget', billshock: 'billshock' })[a.kind]

export default function RunTab({ ctx }: { ctx: ConsoleCtx }) {
  const { sid, session } = ctx
  const [selId, setSelId] = useState(session.currentActivity ?? ACTIVITIES[0].id)
  const activity = ACTIVITIES.find(a => a.id === selId)!
  const subs = useCollectionData<Submission>(`sessions/${sid}/submissions`, 'activity', activity.id) ?? []
  const isLive = session.currentActivity === activity.id
  const phase = session.state.phase

  const launch = () => patchSession(sid, { currentActivity: activity.id, state: stateFor(activity), screen: 'activity' })
  const setPhase = (p: typeof phase) => patchSession(sid, { 'state.phase': p })

  return (
    <div className="console">
      <nav className="act-list" aria-label="Activities">
        {[1, 2].map(day => (
          <div key={day}>
            <div className="act-day">Day {day}</div>
            {ACTIVITIES.filter(a => a.day === day).map(a => (
              <button key={a.id} className={`act-item${a.id === selId ? ' sel' : ''}${session.currentActivity === a.id ? ' live' : ''}`} onClick={() => setSelId(a.id)}>
                <span>{a.title}</span>
                <span className="row" style={{ gap: 4 }}>
                  {Object.keys(ctx.applied).some(k => k === appliedKeyFor(a) || k.startsWith(`${appliedKeyFor(a)}:`)) && <span className="pill ok">scored</span>}
                  {session.currentActivity === a.id && <span className="dot live" />}
                </span>
              </button>
            ))}
          </div>
        ))}
      </nav>

      <section className="stack" style={{ gap: 16 }}>
        <div className="card stack">
          <div className="spread">
            <div>
              <div className="kicker">{activity.slides}</div>
              <h2 style={{ marginTop: 4 }}>{activity.title}</h2>
            </div>
            <div className="row">
              {isLive ? <span className="pill clay"><span className="dot live" /> Live on phones · {phase}</span> : <span className="pill">Not live</span>}
              <span className="pill">{subs.length} responses</span>
            </div>
          </div>
          <div className="row">
            {!isLive && <button className="btn clay" onClick={launch}>Launch on phones</button>}
            {isLive && (
              <>
                <button className={`btn sm ${phase === 'open' ? '' : 'ghost'}`} onClick={() => setPhase('open')}>Open</button>
                <button className={`btn sm ${phase === 'locked' ? '' : 'ghost'}`} onClick={() => setPhase('locked')}>Lock</button>
                <button className="btn sm ghost" onClick={() => patchSession(sid, { currentActivity: null })}>End (phones wait)</button>
              </>
            )}
            <span className="divider" style={{ width: 1, height: 24, margin: '0 4px' }} />
            <span className="small muted">Screen:</span>
            {SCREENS.map(s => (
              <button key={s.id} className={`btn sm ${session.screen === s.id ? '' : 'ghost'}`} onClick={() => patchSession(sid, { screen: s.id })}>{s.label}</button>
            ))}
          </div>
          <div className="row">
            <span className="small muted">Timer:</span>
            {TIMERS.map(m => <button key={m} className="btn sm ghost" onClick={() => startTimer(sid, m, activity.title)}>{m} min</button>)}
            {session.timer && <button className="btn sm danger" onClick={() => patchSession(sid, { timer: null })}>Clear</button>}
          </div>
        </div>

        {activity.kind === 'quiz' && <QuizPanel ctx={ctx} activity={activity} subs={subs} isLive={isLive} />}
        {activity.kind === 'form' && <FormPanel ctx={ctx} activity={activity} subs={subs} isLive={isLive} />}
        {activity.kind === 'vote' && <VotePanel ctx={ctx} activity={activity} subs={subs} isLive={isLive} />}
        {activity.kind === 'mystery' && <MysteryPanel ctx={ctx} activity={activity} subs={subs} isLive={isLive} />}
        {activity.kind === 'budget' && <BudgetPanel ctx={ctx} activity={activity} subs={subs} isLive={isLive} />}
        {activity.kind === 'billshock' && <BillPanel ctx={ctx} activity={activity} subs={subs} isLive={isLive} />}
      </section>
    </div>
  )
}
