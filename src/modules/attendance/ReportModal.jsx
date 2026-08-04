import { athleteStats } from './attendanceStats'

export function ReportModal({ team, athletes, records, onClose }) {
  const members = team.members.map((id) => athletes.find((a) => a.id === id)).filter(Boolean)
  const rows = members
    .map((a) => ({ name: a.name, ...athleteStats(records, a.id) }))
    .sort((x, y) => y.pct - x.pct || x.name.localeCompare(y.name))

  return (
    <div role="dialog" aria-modal="true" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div>
        <div>{team.name}</div>
        <div>Attendance report</div>

        {rows.length === 0 && <p>No players on this team yet.</p>}
        {rows.map((r) => (
          <div key={r.name}>
            <span>{r.name}</span>
            <span>{r.attended}/{r.sessions}</span>
            <span>{r.pct}%</span>
          </div>
        ))}

        <button type="button" onClick={onClose}>Done</button>
      </div>
    </div>
  )
}
