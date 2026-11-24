import { useEffect, useState } from 'react'
import { athleteStats, dispDate, findAthleteByName, monthName } from './attendanceStats'

const STATUS_ORDER = ['present', 'late', 'absent', 'excused']
const STATUS_LABEL = { present: 'P', late: 'L', absent: 'A', excused: 'E' }

function heightLabel(a) {
  return a.height_feet != null || a.height_inches != null
    ? `${a.height_feet || 0}'${a.height_inches || 0}"`
    : '—'
}

export function RollCallModal({
  team, date, athletes, records,
  onClose, onSetStatus, onBulkSetStatus, onClearCell, onAddPlayers, onRemoveMember, onUpdateHeight,
}) {
  const [newPlayer, setNewPlayer] = useState('')
  const [feet, setFeet] = useState('')
  const [inches, setInches] = useState('')
  const [error, setError] = useState('')

  // Inline height editor for a player already on the team: tap their
  // height, edit under their name, Save writes straight to the Roster.
  // One row at a time; blank boxes clear the height (unlike the Add row,
  // where blank never erases — here emptying it is a deliberate edit).
  const [editingId, setEditingId] = useState(null)
  const [editFeet, setEditFeet] = useState('')
  const [editInches, setEditInches] = useState('')

  const members = team.members.map((id) => athletes.find((a) => a.id === id)).filter(Boolean)
  const statusOf = (aid) => records.find((r) => r.athlete_id === aid && r.date === date)?.status || ''
  const present = members.filter((m) => statusOf(m.id) === 'present').length
  const inSession = members.filter((m) => statusOf(m.id) !== '').length

  const nonMembers = athletes.filter((a) => !team.members.includes(a.id))

  // Height only makes sense for one player at a time — a pasted list of
  // several names has no way to say whose height is whose, so the height
  // boxes switch off and those players are added with no height.
  const names = newPlayer.split(',').map((s) => s.trim()).filter(Boolean)
  const multi = names.length > 1

  // Typing a name that already exists on the roster pulls their saved
  // height into the boxes (and clears them again when the match goes
  // away), so what's on screen is what will be written to the roster.
  const matched = names.length === 1 ? findAthleteByName(athletes, names[0]) : null
  const matchedId = matched?.id ?? null
  useEffect(() => {
    setFeet(matched?.height_feet ?? '')
    setInches(matched?.height_inches ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-sync when the matched athlete changes, not on every keystroke
  }, [matchedId])

  function startHeightEdit(a) {
    setEditingId(a.id)
    setEditFeet(a.height_feet ?? '')
    setEditInches(a.height_inches ?? '')
  }

  async function saveHeight(a) {
    const heightFeet = editFeet === '' ? null : +editFeet
    const heightInches = editInches === '' ? null : +editInches
    if (heightFeet === (a.height_feet ?? null) && heightInches === (a.height_inches ?? null)) {
      setEditingId(null)
      return
    }
    setError('')
    try {
      await onUpdateHeight(a.id, { heightFeet, heightInches })
      setEditingId(null)
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleAddPlayers() {
    if (!names.length) return
    setError('')
    try {
      const height = names.length === 1
        ? { heightFeet: feet === '' ? null : +feet, heightInches: inches === '' ? null : +inches }
        : null
      await onAddPlayers(names, height)
      setNewPlayer('')
      setFeet('')
      setInches('')
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
                  {editingId === a.id && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 8 }}>
                      <input
                        type="number" min="0" max="8" placeholder="ft" aria-label={`${a.name} height feet`}
                        style={{ width: 60, padding: '6px 8px' }} autoFocus
                        value={editFeet}
                        onChange={(e) => setEditFeet(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') saveHeight(a); if (e.key === 'Escape') setEditingId(null) }}
                      />
                      <input
                        type="number" min="0" max="11" placeholder="in" aria-label={`${a.name} height inches`}
                        style={{ width: 60, padding: '6px 8px' }}
                        value={editInches}
                        onChange={(e) => setEditInches(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') saveHeight(a); if (e.key === 'Escape') setEditingId(null) }}
                      />
                      <button className="btn primary" style={{ padding: '6px 12px' }} type="button" onClick={() => saveHeight(a)}>Save</button>
                      <button className="btn ghost" style={{ padding: '6px 12px' }} type="button" onClick={() => setEditingId(null)}>Cancel</button>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  title="Tap to edit height (saves to the Roster)"
                  aria-label={`Edit ${a.name}'s height`}
                  onClick={() => startHeightEdit(a)}
                  style={{ minWidth: 44, textAlign: 'center', whiteSpace: 'nowrap', background: 'none', border: 'none', borderBottom: '1px dashed var(--muted-2)', borderRadius: 0, padding: '2px 0', color: 'var(--muted)', fontSize: 13, fontFamily: 'inherit', cursor: 'pointer' }}
                >
                  {heightLabel(a)}
                </button>
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

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
          <input
            style={{ flex: '1 1 200px' }}
            list="attendance-athlete-list"
            placeholder="Add player (or paste comma-separated names)"
            value={newPlayer}
            onChange={(e) => setNewPlayer(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddPlayers() }}
          />
          <datalist id="attendance-athlete-list">
            {nonMembers.map((a) => <option key={a.id} value={a.name} />)}
          </datalist>
          <input
            type="number"
            min="0"
            max="8"
            placeholder="ft"
            aria-label="Height feet"
            style={{ width: 64 }}
            disabled={multi}
            value={feet}
            onChange={(e) => setFeet(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddPlayers() }}
          />
          <input
            type="number"
            min="0"
            max="11"
            placeholder="in"
            aria-label="Height inches"
            style={{ width: 64 }}
            disabled={multi}
            value={inches}
            onChange={(e) => setInches(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddPlayers() }}
          />
          <button className="btn ghost" type="button" onClick={handleAddPlayers}>Add</button>
        </div>
        <p className="sub" style={{ fontSize: 12, margin: '6px 0 0' }}>
          {multi ? 'Height is for one player at a time — add them individually to set heights.' : 'Height saves to the Roster.'}
        </p>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button className="btn ghost" type="button" onClick={() => onClearCell(members.map((m) => m.id), date)}>Clear this cell</button>
          <button className="btn primary" type="button" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  )
}
