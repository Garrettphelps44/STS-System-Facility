import { athleteStats } from './attendanceStats'

export function ReportModal({ team, athletes, records, onClose }) {
  const members = team.members.map((id) => athletes.find((a) => a.id === id)).filter(Boolean)
  const rows = members
    .map((a) => ({ name: a.name, ...athleteStats(records, a.id) }))
    .sort((x, y) => y.pct - x.pct || x.name.localeCompare(y.name))

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-panel">
        <p className="eyebrow" style={{ marginBottom: 2 }}>Attendance report</p>
        <h2 style={{ fontSize: 18 }}>{team.name}</h2>

        {rows.length === 0 && <p className="sub">No players on this team yet.</p>}
        {rows.map((r) => (
          <div key={r.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
            <span>{r.name}</span>
            <span className="sub">{r.attended}/{r.sessions}</span>
            <span style={{ color: 'var(--green)', fontWeight: 800 }}>{r.pct}%</span>
          </div>
        ))}

        <button className="btn primary" type="button" onClick={onClose} style={{ marginTop: 16 }}>Done</button>
      </div>
    </div>
  )
}
