// Ported as-is from reference/reference:Index.html (lines 2001-2011).
// higher: true/false drives leaderboard sort direction, not display.

export const flyMPH = (sec) => (!sec || isNaN(sec) || +sec <= 0 ? null : 20.4545 / +sec)

export const DEFAULT_METRICS = [
  { key: 'bw', label: 'Body Wt', unit: 'lb', rank: false, higher: true },
  { key: 'fly', label: 'Fly 10', unit: 'sec', rank: true, higher: true },
  { key: 'vert', label: 'Vertical', unit: 'in', rank: true, higher: true },
  { key: 'rsi', label: 'RSI', unit: '', rank: true, higher: true },
  { key: 'bsq', label: 'Back Sq', unit: 'lb', rank: true, higher: true },
  { key: 'bench', label: 'Bench', unit: 'lb', rank: true, higher: true },
  { key: 'tbdl', label: 'Trap DL', unit: 'lb', rank: true, higher: true },
  { key: 'broad', label: 'Broad Jmp', unit: 'in', rank: true, higher: true },
]

// metVal/metShow ported in spirit (same fly-10 special-casing and display
// rounding) but adapted to the new {metric, value} shape instead of
// reading a wide per-date entry object keyed by metric.key.
export function metVal(metric, value) {
  if (value == null) return null
  return metric.key === 'fly' ? flyMPH(value) : value
}

export function metShow(metric, value) {
  if (value == null || isNaN(value)) return '—'
  if (metric.key === 'fly') return value.toFixed(2) + ' mph'
  if (metric.key === 'rsi') return (Math.round(value * 100) / 100).toFixed(2)
  return String(Math.round(value * 100) / 100)
}
