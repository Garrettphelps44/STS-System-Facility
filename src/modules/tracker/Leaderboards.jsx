import { useMemo, useState } from 'react'
import { metVal } from './metrics'

// Leaderboard's own display rounding (one decimal, except fly/rsi at two)
// is distinct from metShow's — that's a Reports-card formatting rule, this
// is the old app's separate inline ternary in tRenderDash. Kept separate
// on purpose rather than reusing metShow for something it wasn't for.
function displayValue(metric, v) {
  return metric.key === 'fly' || metric.key === 'rsi' ? v.toFixed(2) : String(Math.round(v * 10) / 10)
}

export function Leaderboards({ athletes, metrics, entries }) {
  const [mode, setMode] = useState('best')

  const rankMetrics = useMemo(() => metrics.filter((m) => m.active && m.rank), [metrics])

  // Per athlete, every date they have any entry on — needed for "latest":
  // the old app's tLatestTwo picks the athlete's single most recent test
  // DATE (any metric), then reads that metric off that date's row, even if
  // it's blank there. Replicated the same way against the normalized table.
  const latestDateByAthlete = useMemo(() => {
    const map = new Map()
    entries.forEach((e) => {
      const cur = map.get(e.athlete_id)
      if (!cur || e.date > cur) map.set(e.athlete_id, e.date)
    })
    return map
  }, [entries])

  function valueFor(athleteId, metric) {
    if (mode === 'best') {
      const raw = entries
        .filter((e) => e.athlete_id === athleteId && e.metric_key === metric.key && e.value != null)
        .map((e) => metVal(metric, e.value))
        .filter((v) => v != null && !isNaN(v))
      if (!raw.length) return null
      return metric.higher_is_better ? Math.max(...raw) : Math.min(...raw)
    }
    const latestDate = latestDateByAthlete.get(athleteId)
    if (!latestDate) return null
    const entry = entries.find(
      (e) => e.athlete_id === athleteId && e.metric_key === metric.key && e.date === latestDate
    )
    if (entry == null) return null
    const v = metVal(metric, entry.value)
    return v != null && !isNaN(v) ? v : null
  }

  return (
    <div>
      <h2>Leaderboards</h2>
      <p className="sub">Ranked across your athletes.</p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        <button className="btn" type="button" aria-pressed={mode === 'best'} onClick={() => setMode('best')}>
          All-time best
        </button>
        <button className="btn" type="button" aria-pressed={mode === 'latest'} onClick={() => setMode('latest')}>
          Latest test
        </button>
      </div>

      {entries.length === 0 ? (
        <p className="sub">No test data yet — add some on the Test Database tab.</p>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
          {rankMetrics.map((m) => {
            const ranked = athletes
              .map((a) => ({ name: a.name, v: valueFor(a.id, m) }))
              .filter((r) => r.v != null)
              .sort((a, b) => (m.higher_is_better ? b.v - a.v : a.v - b.v))
              .slice(0, 5)
            if (!ranked.length) return null
            return (
              <div key={m.key} className="panel" style={{ flex: '1 1 260px', minWidth: 240 }}>
                <p className="eyebrow" style={{ marginBottom: 10 }}>
                  {m.label}
                  {m.key === 'fly' ? ' (mph)' : m.unit ? ` (${m.unit})` : ''}
                </p>
                {ranked.map((r, i) => (
                  <div key={r.name} style={{ display: 'flex', gap: 10, padding: '6px 0', borderBottom: i < ranked.length - 1 ? '1px solid var(--line)' : 'none' }}>
                    <span className="sub" style={{ width: 18 }}>{i + 1}</span>
                    <span style={{ flex: 1 }}>{r.name}</span>
                    <span style={{ fontWeight: 800 }}>{displayValue(m, r.v)}</span>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      )}
      {entries.length > 0 && rankMetrics.every((m) => !athletes.some((a) => valueFor(a.id, m) != null)) && (
        <p className="sub">No ranked values for this filter yet.</p>
      )}
    </div>
  )
}
