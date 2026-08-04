// Paired bar chart, planned vs actual training load per day over the
// last 30 days. Validated categorical pair (blue/orange, slots 1-2 of
// the dataviz skill's default palette) — passes CVD + normal-vision
// separation in both light and dark via scripts/validate_palette.js.
const BAR_W = 10
const GAP = 2
const PAIR_GAP = 10
const CHART_H = 160
const AXIS_PAD = 28

export function TrainingLoadChart({ data }) {
  if (!data.length) return null

  const max = Math.max(1, ...data.map((d) => Math.max(d.planned, d.actual)))
  const pairW = BAR_W * 2 + GAP
  const width = data.length * (pairW + PAIR_GAP) + AXIS_PAD
  const scaleY = (v) => (v / max) * (CHART_H - 8)

  return (
    <div className="tlc-root">
      <style>{`
        .tlc-root {
          color-scheme: dark;
          --tlc-planned: #3987e5;
          --tlc-actual: #d95926;
          --tlc-grid: var(--line);
          --tlc-axis: var(--muted-2);
          --tlc-text-secondary: var(--muted);
          --tlc-text-muted: var(--muted-2);
        }
        .tlc-legend { display: flex; gap: 16px; font-size: 12px; color: var(--tlc-text-secondary); margin-bottom: 6px; }
        .tlc-legend-item { display: flex; align-items: center; gap: 6px; }
        .tlc-swatch { width: 10px; height: 10px; border-radius: 2px; display: inline-block; }
        .tlc-scroll { overflow-x: auto; }
        .tlc-date { font-size: 9px; fill: var(--tlc-text-muted); }
      `}</style>

      <div className="tlc-legend">
        <span className="tlc-legend-item"><span className="tlc-swatch" style={{ background: 'var(--tlc-planned)' }} /> Planned</span>
        <span className="tlc-legend-item"><span className="tlc-swatch" style={{ background: 'var(--tlc-actual)' }} /> Actual</span>
      </div>

      <div className="tlc-scroll">
        <svg width={width} height={CHART_H + AXIS_PAD} viewBox={`0 0 ${width} ${CHART_H + AXIS_PAD}`}>
          <line x1={0} y1={CHART_H} x2={width} y2={CHART_H} stroke="var(--tlc-axis)" strokeWidth={1} />
          {data.map((d, i) => {
            const x = i * (pairW + PAIR_GAP)
            const plannedH = scaleY(d.planned)
            const actualH = scaleY(d.actual)
            return (
              <g key={d.date}>
                <rect x={x} y={CHART_H - plannedH} width={BAR_W} height={plannedH} rx={4} fill="var(--tlc-planned)">
                  <title>{`${d.date} · planned ${d.planned.toFixed(1)}`}</title>
                </rect>
                <rect x={x + BAR_W + GAP} y={CHART_H - actualH} width={BAR_W} height={actualH} rx={4} fill="var(--tlc-actual)">
                  <title>{`${d.date} · actual ${d.actual.toFixed(1)}`}</title>
                </rect>
                <text x={x + pairW / 2} y={CHART_H + 14} textAnchor="middle" className="tlc-date">
                  {d.date.slice(5)}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}
