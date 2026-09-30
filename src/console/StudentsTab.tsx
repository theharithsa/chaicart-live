import { doc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { REGIONS, TEAMS, TEAM_BY_ID } from '../content/teams'
import { downloadCsv, membersByTeam, type ConsoleCtx } from './shared'

export default function StudentsTab({ ctx }: { ctx: ConsoleCtx }) {
  const { sid, students } = ctx
  const byTeam = membersByTeam(students)
  const sem = (s: '5' | '7') => students.filter(x => x.semester === s).length

  const move = (uid: string, teamId: string) => updateDoc(doc(db, `sessions/${sid}/students/${uid}`), { teamId })

  const exportCsv = () => downloadCsv(`students-${sid}.csv`, [
    ['name', 'semester', 'branch', 'team', 'region', 'role'],
    ...students.map(s => [s.name, s.semester, s.branch, TEAM_BY_ID[s.teamId]?.name, TEAM_BY_ID[s.teamId]?.region, s.role]),
  ])

  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="card row">
        <b>{students.length} joined</b>
        <span className="pill">5th sem: {sem('5')}</span>
        <span className="pill">7th sem: {sem('7')}</span>
        <span className="pill">Teams with no one yet: {TEAMS.filter(t => !byTeam[t.id]?.length).length}</span>
        <button className="btn sm ghost" onClick={exportCsv}>Export CSV</button>
      </div>
      <div className="grid4">
        {REGIONS.map(r => (
          <div key={r.id} className="region-col stack" style={{ gap: 10 }}>
            <b style={{ fontFamily: 'var(--serif)', fontWeight: 500, fontSize: 18 }}>{r.name}</b>
            {TEAMS.filter(t => t.region === r.id).map(t => {
              const members = byTeam[t.id] ?? []
              return (
                <div key={t.id} className="stack" style={{ gap: 4 }}>
                  <div className="spread">
                    <b className="small">{t.name}</b>
                    <span className={`pill ${members.length === 5 ? 'ok' : members.length > 5 ? 'red' : ''}`}>{members.length}/5</span>
                  </div>
                  {members.map(m => (
                    <div key={m.id} className="spread tiny">
                      <span>{m.name} · {m.role} · S{m.semester} {m.branch}</span>
                      <select style={{ width: 110, padding: '2px 4px', fontSize: 12 }} value={m.teamId} onChange={e => move(m.id, e.target.value)} aria-label={`Move ${m.name}`}>
                        {TEAMS.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
