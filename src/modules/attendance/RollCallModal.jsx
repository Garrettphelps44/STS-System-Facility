import { useState } from 'react'
import { athleteStats, dispDate, monthName } from './attendanceStats'

const STATUS_ORDER = ['present', 'late', 'absent', 'excused']
const STATUS_LABEL = { present: 'P', late: 'L', absent: 'A', excused: 'E' }

export function RollCallModal({
  team, date, athletes, records,
  onClose, onSetStatus, onBulkSetStatus, onClearCell, onAddPlayers, onRemoveMember,
}) {
  const [newPlayer, setNewPlayer] = useState('')
  const [error, setError] = useState('')

  const members = team.members.map((id) => athletes.find((a) => a.id === id)).filter(Boolean)
  const statusOf = (aid) => records.find((r) => r.athlete_id === aid && r.date === date)?.status || ''
  const present = members.filter((m) => statusOf(m.id) === 'present').length
  const inSession = members.filter((m) => statusOf(m.id) !== '').length

  const nonMembers = athletes.filter((a) => !team.members.includes(a.id))

  async function handleAddPlayers() {
    const names = newPlayer.split(',').map((s) => s.trim()).filter(Boolean)
    if (!names.length) return
    setError('')
    try {
      await onAddPlayers(names)
      setNewPlayer('')
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-panel">
        <p className="eyebrow" style={{ marginBottom: 2 }}>{monthName(date)} {dispDate(date)}</p>
        <h2 style={{ fontSize: 18 }}>{team.name}</h2>
        <p className="sub">Present: {present} / {inSession} in session</p>
        {error && <p className="error-text" role="alert">{error}</p>}

        <div style={{ display: 'flex', gap: 8, margin: '12px 0' }}>
          <button className="btn ghost" type="button" onClick={() => onBulkSetStatus(members.map((m) => m.id), date, 'present')}>All present</button>
          <button className="btn ghost" type="button" onClick={() => onBulkSetStatus(members.map((m) => m.id), date, 'absent')}>All absent</button>
        </div>

        <div>
          {members.length === 0 && <p className="sub">No players yet. Add your roster below — it carries over to every date for this team.</p>}
          {members.map((a) => {
            const cur = statusOf(a.id)
            const s = athleteStats(records, a.id)
            const stat = s.sessions ? `${s.pct}% season · ${s.attended}/${s.sessions}` : 'first session'
            return (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
                <div style={{ flex: 1 }}>
                  <div>{a.name}</div>
                  <div className="sub" style={{ fontSize: 12 }}>{stat}</div>
                </div>
                <span style={{ display: 'flex', gap: 4 }}>
                  {STATUS_ORDER.map((st) => (
                    <button
                      className="btn"
                      style={{ padding: '8px 12px' }}
                      key={st}
                      type="button"
                      aria-pressed={cur === st}
                      onClick={() => onSetStatus(a.id, date, cur === st ? '' : st)}
                    >
                      {STATUS_LABEL[st]}
                    </button>
                  ))}
                </span>
                <button className="btn ghost" style={{ padding: '4px 6px' }} type="button" onClick={() => { if (window.confirm(`Remove ${a.name} from the ${team.name} team? (Their attendance history is kept.)`)) onRemoveMember(a.id) }} aria-label={`Remove ${a.name}`}>
                  🗑
                </button>
              </div>
            )
          })}
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <input
            style={{ flex: 1 }}
            list="attendance-athlete-list"
            placeholder="Add player (or paste comma-separated names)"
            value={newPlayer}
            onChange={(e) => setNewPlayer(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddPlayers() }}
          />
          <datalist id="attendance-athlete-list">
            {nonMembers.map((a) => <option key={a.id} value={a.name} />)}
          </datalist>
          <button className="btn ghost" type="button" onClick={handleAddPlayers}>Add</button>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button className="btn ghost" type="button" onClick={() => onClearCell(members.map((m) => m.id), date)}>Clear this cell</button>
          <button className="btn primary" type="button" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  )
}
