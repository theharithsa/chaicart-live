import { useState } from 'react'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { initialScores } from '../lib/credits'
import { useCollectionData } from '../lib/hooks'
import { joinUrl, normaliseCode } from '../lib/session'
import type { SessionDoc } from '../types'
import { Qr } from '../components/Qr'

export default function SetupTab({ sid, setSid, session }: { sid: string; setSid: (s: string) => void; session: SessionDoc | null | undefined }) {
  const sessions = useCollectionData<SessionDoc>('sessions')
  const [code, setCode] = useState('')
  const [title, setTitle] = useState('Cloud Computing & Business Systems Workshop')
  const [msg, setMsg] = useState('')

  async function create(e: React.FormEvent) {
    e.preventDefault()
    const id = normaliseCode(code)
    if (id.length < 4) { setMsg('Use at least 4 letters or digits.'); return }
    if ((await getDoc(doc(db, `sessions/${id}`))).exists()) { setMsg(`Session ${id} already exists. Select it below.`); return }
    await setDoc(doc(db, `sessions/${id}`), {
      title: title.trim() || 'ChaiCart Workshop', currentActivity: null, screen: 'join', timer: null,
      state: { phase: 'open', index: 0, indexedField: null }, createdAt: serverTimestamp(),
    })
    await setDoc(doc(db, `sessions/${id}/public/leaderboard`), { scores: initialScores(), updatedAt: serverTimestamp() })
    setSid(id)
    setCode('')
    setMsg(`Session ${id} created.`)
  }

  return (
    <div className="grid2" style={{ alignItems: 'start' }}>
      <div className="stack">
        {sid && session && (
          <div className="card stack center" style={{ alignItems: 'center' }}>
            <div className="kicker">Students join here</div>
            <h2>Session {sid}</h2>
            <Qr text={joinUrl(sid)} size={260} />
            <code className="small" style={{ wordBreak: 'break-all' }}>{joinUrl(sid)}</code>
            <div className="row" style={{ justifyContent: 'center' }}>
              <a className="btn" href={`#/screen?s=${sid}`} target="_blank" rel="noreferrer">Open projector screen</a>
              <button className="btn ghost" onClick={() => navigator.clipboard.writeText(joinUrl(sid))}>Copy join link</button>
            </div>
          </div>
        )}
        <div className="card stack">
          <h3>Sessions</h3>
          {!sessions?.length && <p className="muted small">No sessions yet.</p>}
          {sessions?.map(s => (
            <div key={s.id} className="spread">
              <span><b>{s.id}</b> <span className="muted small">{s.title}</span></span>
              {s.id === sid ? <span className="pill ok">Selected</span> : <button className="btn sm ghost" onClick={() => setSid(s.id)}>Select</button>}
            </div>
          ))}
        </div>
      </div>
      <div className="stack">
        <form className="card stack" onSubmit={create}>
          <h3>Create a session</h3>
          <p className="small muted">One session per workshop. It holds students, teams, submissions and the leaderboard. All 24 teams start with 1,000 credits.</p>
          <label className="field">Session code (students type this if they can't scan)
            <input value={code} onChange={e => setCode(normaliseCode(e.target.value))} placeholder="e.g. CHAI26" maxLength={16} />
          </label>
          <label className="field">Workshop title (appears on certificates)
            <input value={title} onChange={e => setTitle(e.target.value)} maxLength={120} />
          </label>
          <button className="btn">Create session</button>
          {msg && <span className="small">{msg}</span>}
        </form>
        <div className="card stack small">
          <h3>Running the day</h3>
          <ol style={{ margin: 0, paddingLeft: 18 }}>
            <li>Open the projector screen on the second display and set it to <b>Join QR</b>.</li>
            <li>Students scan, enter their name, semester, branch, team and role.</li>
            <li>In <b>Run</b>, select an activity and press <b>Launch on phones</b>. Phones switch automatically.</li>
            <li>Use <b>Lock</b> to stop answers, and the panel buttons to reveal and score.</li>
            <li>Paper activities: enter results in <b>Leaderboard → Enter a whole round</b>.</li>
          </ol>
        </div>
      </div>
    </div>
  )
}
