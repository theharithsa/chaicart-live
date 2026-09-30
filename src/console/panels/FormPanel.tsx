import { useState } from 'react'
import type { Field, FormActivity } from '../../content/activities'
import { REGIONS, TEAMS, TEAM_BY_ID } from '../../content/teams'
import { applyCredits } from '../../lib/credits'
import { fmtTime } from '../../pages/student/shared'
import type { FormValues } from '../../components/FormFields'
import { downloadCsv, signed, type PanelProps } from '../shared'

const show = (f: Field, v: FormValues[string]) => {
  if (v === undefined || v === '') return '—'
  if (f.type === 'checks' && Array.isArray(v)) return v.map(id => f.options.find(o => o.id === id)?.label ?? id).join(', ') || '—'
  return String(v)
}

export default function FormPanel({ ctx, activity, subs }: PanelProps & { activity: FormActivity }) {
  const [open, setOpen] = useState<string | null>(null)
  const [award, setAward] = useState<Record<string, string>>({})
  const [msg, setMsg] = useState('')
  const { sid, students } = ctx
  const byKey = Object.fromEntries(subs.map(s => [activity.scope === 'team' ? s.teamId : s.uid, s]))
  const vals = (key: string) => (byKey[key]?.values as FormValues | undefined) ?? {}

  async function run(changes: { teamId: string; delta: number }[], reason: string, key?: string) {
    if (key && ctx.applied[key] && !confirm('This was already applied. Apply again?')) return
    const n = await applyCredits(sid, changes, reason, key)
    setMsg(`${reason}: applied to ${n} teams.`)
  }

  const creditsFromField = () => activity.creditsField && run(
    TEAMS.map(t => ({ teamId: t.id, delta: Number(vals(t.id)[activity.creditsField!] ?? 0) })),
    activity.title, `form:${activity.id}`,
  )

  const regionBest = () => {
    if (!activity.regionMax) return
    const { field, award: pts } = activity.regionMax
    const changes = REGIONS.flatMap(r => {
      const teams = TEAMS.filter(t => t.region === r.id && byKey[t.id])
      const best = Math.max(...teams.map(t => Number(vals(t.id)[field] ?? 0)))
      return best > 0 ? teams.filter(t => Number(vals(t.id)[field] ?? 0) === best).map(t => ({ teamId: t.id, delta: pts })) : []
    })
    return run(changes, `${activity.title}: region best`, `form:${activity.id}`)
  }

  function exportCsv() {
    const header = activity.scope === 'team' ? ['team', 'region', 'submitted by'] : ['name', 'semester', 'branch', 'team']
    const rows = subs.map(s => {
      const v = (s.values as FormValues) ?? {}
      const st = students.find(x => x.id === s.uid)
      const lead = activity.scope === 'team'
        ? [TEAM_BY_ID[s.teamId]?.name, TEAM_BY_ID[s.teamId]?.region, s.byName]
        : [st?.name ?? s.byName, st?.semester, st?.branch, TEAM_BY_ID[s.teamId]?.name]
      return [...lead, ...activity.fields.map(f => show(f, v[f.id]))]
    })
    downloadCsv(`${activity.id}.csv`, [[...header, ...activity.fields.map(f => f.label)], ...rows])
  }

  if (activity.scope === 'individual') {
    const scales = activity.fields.filter(f => f.type === 'scale')
    return (
      <div className="stack">
        <div className="card stack">
          <div className="spread">
            <b>{subs.length} / {students.length} students responded</b>
            <button className="btn sm ghost" onClick={exportCsv}>Export CSV</button>
          </div>
          {scales.length > 0 && (
            <div className="bars">
              {scales.map(f => {
                const nums = subs.map(s => Number(((s.values as FormValues) ?? {})[f.id])).filter(n => n > 0)
                const avg = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0
                return (
                  <div key={f.id} className="bar-row">
                    <span className="small">{f.label}</span>
                    <div className="bar-track"><div className="bar-fill" style={{ width: `${(avg / 5) * 100}%` }} /></div>
                    <span className="n">{avg ? avg.toFixed(1) : '—'}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
        <div className="table-wrap">
          <table className="t">
            <thead><tr><th>Student</th><th>Team</th>{activity.fields.filter(f => f.type !== 'scale').map(f => <th key={f.id}>{f.label}</th>)}</tr></thead>
            <tbody>
              {subs.map(s => (
                <tr key={s.id}>
                  <td>{s.byName}</td><td>{TEAM_BY_ID[s.teamId]?.name}</td>
                  {activity.fields.filter(f => f.type !== 'scale').map(f => <td key={f.id}>{show(f, ((s.values as FormValues) ?? {})[f.id])}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div className="stack">
      <div className="card row">
        <b>{subs.length} / 24 teams submitted</b>
        {activity.creditsField && <button className="btn sm" onClick={creditsFromField}>Apply self-marked totals</button>}
        {activity.regionMax && <button className="btn sm" onClick={regionBest}>Award region best (+{activity.regionMax.award})</button>}
        <button className="btn sm ghost" onClick={exportCsv}>Export CSV</button>
        {ctx.applied[`form:${activity.id}`] && <span className="pill ok">Applied</span>}
        {msg && <span className="small">{msg}</span>}
      </div>
      <div className="grid4">
        {REGIONS.map(r => (
          <div key={r.id} className="region-col stack" style={{ gap: 8 }}>
            <b style={{ fontFamily: 'var(--serif)', fontWeight: 500 }}>{r.name}</b>
            {TEAMS.filter(t => t.region === r.id).map(t => {
              const s = byKey[t.id]
              const variant = activity.variants?.[t.index % activity.variants.length]
              return (
                <div key={t.id} className="stack" style={{ gap: 4, borderTop: '1px solid var(--ivory-2)', paddingTop: 6 }}>
                  <div className="spread">
                    <button className="btn sm ghost" onClick={() => setOpen(open === t.id ? null : t.id)}>{t.name}</button>
                    {s ? <span className="pill ok">{fmtTime(s.updatedAt)}</span> : <span className="pill">waiting</span>}
                  </div>
                  {variant && <span className="tiny muted">{variant.title}</span>}
                  {open === t.id && (
                    <div className="stack small" style={{ gap: 4 }}>
                      {activity.fields.map(f => <div key={f.id}><b>{f.label}:</b> {show(f, vals(t.id)[f.id])}</div>)}
                      {s && <div className="tiny muted">by {s.byName}</div>}
                    </div>
                  )}
                  <div className="row" style={{ gap: 4 }}>
                    <input style={{ width: 70, padding: '4px 8px', fontSize: 13 }} type="number" placeholder="±" value={award[t.id] ?? ''} onChange={e => setAward({ ...award, [t.id]: e.target.value })} />
                    <button className="btn sm ghost" disabled={!award[t.id]} onClick={async () => {
                      await run([{ teamId: t.id, delta: Number(award[t.id]) }], activity.title)
                      setAward({ ...award, [t.id]: '' })
                    }}>Award {award[t.id] ? signed(Number(award[t.id])) : ''}</button>
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
