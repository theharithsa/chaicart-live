import { useNow } from '../lib/hooks'

export function TimerDisplay({ timer, big }: { timer: { endsAt: number; label: string } | null; big?: boolean }) {
  const now = useNow(250)
  if (!timer) return null
  const left = Math.max(0, Math.round((timer.endsAt - now) / 1000))
  const mm = String(Math.floor(left / 60)).padStart(2, '0')
  const ss = String(left % 60).padStart(2, '0')
  return (
    <span className={`timer${left === 0 ? ' done' : ''}`} style={big ? { fontSize: 'clamp(28px, 4vw, 64px)' } : undefined}>
      {timer.label ? <span className="muted" style={{ fontFamily: 'var(--sans)', fontWeight: 600, fontSize: '0.5em', marginRight: 10 }}>{timer.label}</span> : null}
      {mm}:{ss}
    </span>
  )
}
