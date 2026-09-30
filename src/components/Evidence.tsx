import { useState } from 'react'
import { BRIEF, CHANGES, CHARTS, CODE, LOGS, SUSPECTS, TRACES, WITNESSES, timeLabel, type ChartDef } from '../content/mystery'

function LineChart({ chart }: { chart: ChartDef }) {
  const W = 320, H = 120, L = 34, B = 16, n = chart.data.length
  const x = (k: number) => L + (k / (n - 1)) * (W - L - 6)
  const y = (v: number) => H - B - ((v - chart.min) / (chart.max - chart.min)) * (H - B - 6)
  const pts = chart.data.map((v, k) => `${x(k).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  return (
    <div className="chart">
      <h4>{chart.title}</h4>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={chart.title}>
        {[0, 0.5, 1].map(f => {
          const v = chart.min + f * (chart.max - chart.min)
          return (
            <g key={f}>
              <line x1={L} x2={W - 6} y1={y(v)} y2={y(v)} stroke="#E8E4D8" />
              <text x={L - 3} y={y(v) + 3} fontSize="7.5" textAnchor="end" fill="#73726C">{Math.round(v).toLocaleString()}</text>
            </g>
          )
        })}
        <line x1={x(15)} x2={x(15)} y1={4} y2={H - B} stroke="#141413" strokeOpacity=".35" strokeDasharray="2,3" />
        <text x={x(15) + 3} y={10} fontSize="7" fill="#73726C">launch</text>
        <polygon fill="#D97757" fillOpacity=".1" points={`${x(0)},${H - B} ${pts} ${x(n - 1)},${H - B}`} />
        <polyline fill="none" stroke="#D97757" strokeWidth="1.6" strokeLinejoin="round" points={pts} />
        {[0, 5, 10, 15, 20, 25, 30].map(k => (
          <text key={k} x={x(k)} y={H - 3} fontSize="7.5" textAnchor="middle" fill="#73726C">{timeLabel(k)}</text>
        ))}
      </svg>
    </div>
  )
}

const TABS = ['Brief', 'Metrics', 'Logs', 'Traces', 'Changes', 'Witnesses', 'Code'] as const

export function Evidence() {
  const [tab, setTab] = useState<(typeof TABS)[number]>('Brief')
  return (
    <div className="stack">
      <div className="tabs">
        {TABS.map(t => <button key={t} className={`tab${t === tab ? ' on' : ''}`} onClick={() => setTab(t)}>{t}</button>)}
      </div>
      {tab === 'Brief' && (
        <div className="stack">
          {BRIEF.map(b => <p key={b}>{b}</p>)}
          <h3>Suspects</h3>
          <div className="grid2">
            {SUSPECTS.map(s => (
              <div key={s.id} className="card">
                <b style={{ fontFamily: 'var(--serif)', fontWeight: 500, fontSize: 18 }}>{s.name}</b>
                <div className="muted small">{s.what}</div>
                <p style={{ fontFamily: 'var(--serif)', fontStyle: 'italic' }}>“{s.alibi}”</p>
              </div>
            ))}
          </div>
        </div>
      )}
      {tab === 'Metrics' && (
        <div className="grid2">{CHARTS.map(c => <LineChart key={c.title} chart={c} />)}</div>
      )}
      {tab === 'Logs' && (
        <pre className="logs">
          {LOGS.map((l, i) => (
            <div key={i} className={l.level}>{l.level === 'NOTE' ? l.t : `${l.t} ${l.level.padEnd(5)} ${l.msg}`}</div>
          ))}
        </pre>
      )}
      {tab === 'Traces' && (
        <div className="stack">
          {TRACES.map(tr => (
            <div key={tr.title} className="trace">
              <h4>{tr.title}</h4>
              {tr.spans.map(s => (
                <div key={s.name} className="span">
                  <span className="nm">{s.name}</span>
                  <div className="track">
                    <div className={`fill ${s.kind ?? ''}`} style={{ left: `${(s.start / tr.total) * 100}%`, width: `${Math.max(0.8, (s.dur / tr.total) * 100)}%` }} />
                  </div>
                  <span className="d">{s.dur.toLocaleString()} ms</span>
                </div>
              ))}
            </div>
          ))}
          <p className="muted small">Striped = waiting. Compare which spans exist in each trace, and which are missing.</p>
        </div>
      )}
      {tab === 'Changes' && (
        <div className="table-wrap">
          <table className="t">
            <thead><tr><th>When</th><th>What</th><th>Details</th></tr></thead>
            <tbody>{CHANGES.map(c => <tr key={c.when}><td>{c.when}</td><td>{c.what}</td><td>{c.details}</td></tr>)}</tbody>
          </table>
        </div>
      )}
      {tab === 'Witnesses' && (
        <div className="stack">
          {WITNESSES.map(w => (
            <div key={w.who} className="card accent"><b>{w.who}</b><p>“{w.says}”</p></div>
          ))}
        </div>
      )}
      {tab === 'Code' && (
        <div className="stack">
          <p className="muted small">Bonus evidence from payment-service. What makes the problem worse?</p>
          <pre className="logs">{CODE}</pre>
        </div>
      )}
    </div>
  )
}
