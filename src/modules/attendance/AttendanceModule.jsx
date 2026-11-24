import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../auth/AuthContext'
import * as trackerApi from '../tracker/trackerApi'
import * as api from './attendanceApi'
import {
  buildColumns, dateTotal, dispDate, distinctDates, findAthleteByName,
  forTeam, formatWeekRange, initialExpandedWeek, monthName, presentCount, weekDateTotal, weekKey, weekTeamSum,
} from './attendanceStats'
import { RollCallModal } from './RollCallModal'
import { ReportModal } from './ReportModal'

export function AttendanceModule() {
  const { membership } = useAuth()
  const facilityId = membership.facilityId

  const [athletes, setAthletes] = useState([])
  const [teams, setTeams] = useState([])
  const [records, setRecords] = useState([])
  const [openDates, setOpenDates] = useState([]) // ephemeral, session-local — see requirements: no schema home for a "known but empty" date
  const [expandedWeeks, setExpandedWeeks] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [rollCall, setRollCall] = useState(null) // { teamId, date }
  const [reportTeamId, setReportTeamId] = useState(null)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [datePickerValue, setDatePickerValue] = useState('')

  const refreshTeams = useCallback(async () => setTeams(await api.fetchTeams(facilityId)), [facilityId])
  const refreshAthletes = useCallback(async () => setAthletes(await trackerApi.fetchAthletes(facilityId)), [facilityId])
  const refreshRecords = useCallback(async () => setRecords(await api.fetchAttendance(facilityId)), [facilityId])

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      setError('')
      try {
        const [a, t, r] = await Promise.all([
          trackerApi.fetchAthletes(facilityId),
          api.fetchTeams(facilityId),
          api.fetchAttendance(facilityId),
        ])
        if (!active) return
        setAthletes(a)
        setTeams(t)
        setRecords(r)
        const wk = initialExpandedWeek(distinctDates(r))
        setExpandedWeeks(wk ? new Set([wk]) : new Set())
      } catch (err) {
        if (active) setError(err.message)
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [facilityId])

  const dates = useMemo(() => [...new Set([...distinctDates(records), ...openDates])].sort(), [records, openDates])
  const cols = useMemo(() => buildColumns(dates, expandedWeeks), [dates, expandedWeeks])

  function expandWeek(key) { setExpandedWeeks((s) => new Set([...s, key])) }
  function collapseWeek(key) { setExpandedWeeks((s) => { const n = new Set(s); n.delete(key); return n }) }

  // ---------- status mutations (optimistic — a coach is standing there waiting) ----------

  // A mark belongs to one team, so an athlete on two teams has separate
  // marks per team for the same day — every status write carries the team.
  function applyLocalStatus(teamId, athleteId, date, status) {
    setRecords((cur) => {
      const rest = cur.filter((r) => !(r.team_id === teamId && r.athlete_id === athleteId && r.date === date))
      return status ? [...rest, { athlete_id: athleteId, team_id: teamId, date, status }] : rest
    })
  }

  async function handleSetStatus(teamId, athleteId, date, status) {
    applyLocalStatus(teamId, athleteId, date, status)
    try {
      await api.setStatus(facilityId, teamId, athleteId, date, status)
    } catch (err) {
      setError(err.message)
      refreshRecords()
    }
  }

  async function handleBulkSetStatus(teamId, athleteIds, date, status) {
    setRecords((cur) => {
      const rest = cur.filter((r) => !(r.team_id === teamId && r.date === date && athleteIds.includes(r.athlete_id)))
      return [...rest, ...athleteIds.map((athlete_id) => ({ athlete_id, team_id: teamId, date, status }))]
    })
    try {
      await api.bulkSetStatus(facilityId, teamId, athleteIds, date, status)
    } catch (err) {
      setError(err.message)
      refreshRecords()
    }
  }

  async function handleClearCell(teamId, athleteIds, date) {
    setRecords((cur) => cur.filter((r) => !(r.team_id === teamId && r.date === date && athleteIds.includes(r.athlete_id))))
    try {
      await api.clearCell(teamId, athleteIds, date)
    } catch (err) {
      setError(err.message)
      refreshRecords()
    }
  }

  // ---------- team / roster mutations ----------

  async function handleAddTeam() {
    const name = window.prompt('New team name:')
    if (!name || !name.trim()) return
    try {
      await api.addTeam(facilityId, name.trim())
      await refreshTeams()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleRenameTeam(team) {
    const name = window.prompt('Team name:', team.name)
    if (name === null || !name.trim()) return
    try {
      await api.renameTeam(team.id, name.trim())
      await refreshTeams()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleDeleteTeam(team) {
    if (!window.confirm(`Delete the "${team.name}" team grouping? Athletes and their attendance history are kept.`)) return
    try {
      await api.deleteTeam(team.id)
      await refreshTeams()
    } catch (err) {
      setError(err.message)
    }
  }

  // `height` ({ heightFeet, heightInches } or null) is only ever passed for a
  // single player. A brand-new athlete is created with it; a name matching an
  // existing roster athlete gets their roster height updated instead — but
  // only if something was actually entered, so leaving the boxes blank never
  // wipes a height that's already saved.
  async function handleAddPlayers(team, names, height) {
    for (const name of names) {
      let a = findAthleteByName(athletes, name)
      if (!a) {
        a = await trackerApi.addAthlete(facilityId, { name, heightFeet: height?.heightFeet, heightInches: height?.heightInches })
        await api.addTeamMember(facilityId, team.id, a.id)
      } else {
        await api.addTeamMember(facilityId, team.id, a.id)
        const entered = height && (height.heightFeet != null || height.heightInches != null)
        if (entered && (a.height_feet !== height.heightFeet || a.height_inches !== height.heightInches)) {
          await trackerApi.updateAthlete(a.id, { height_feet: height.heightFeet, height_inches: height.heightInches })
        }
      }
    }
    await Promise.all([refreshAthletes(), refreshTeams()])
  }

  // Edits the athlete's Roster height straight from the roll call — blank
  // boxes (null) clear it, same as editing in Roster.
  async function handleUpdateHeight(athleteId, { heightFeet, heightInches }) {
    await trackerApi.updateAthlete(athleteId, { height_feet: heightFeet, height_inches: heightInches })
    await refreshAthletes()
  }

  async function handleRemoveMember(team, athleteId) {
    try {
      await api.removeTeamMember(team.id, athleteId)
      await refreshTeams()
    } catch (err) {
      setError(err.message)
    }
  }

  // ---------- dates ----------

  function handleOpenAddDate() {
    setDatePickerValue(new Date().toISOString().slice(0, 10))
    setShowDatePicker(true)
  }

  function handleConfirmAddDate() {
    if (datePickerValue) {
      setOpenDates((d) => (d.includes(datePickerValue) ? d : [...d, datePickerValue]))
      expandWeek(weekKey(datePickerValue))
    }
    setShowDatePicker(false)
  }

  async function handleDeleteDate(date) {
    if (!window.confirm(`Delete date ${dispDate(date)} for every team?`)) return
    try {
      await api.deleteDate(facilityId, date)
      setOpenDates((d) => d.filter((x) => x !== date))
      await refreshRecords()
    } catch (err) {
      setError(err.message)
    }
  }

  if (loading) return <p className="sub">Loading attendance…</p>

  const rollCallTeam = rollCall ? teams.find((t) => t.id === rollCall.teamId) : null
  const reportTeam = reportTeamId ? teams.find((t) => t.id === reportTeamId) : null

  return (
    <div>
      <h2>Attendance</h2>
      <p className="sub">Tap a cell to take roll for that team and date.</p>
      {error && <p className="error-text" role="alert">{error}</p>}

      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        <button className="btn ghost" type="button" onClick={handleAddTeam}>+ Team</button>
        <button className="btn ghost" type="button" onClick={handleOpenAddDate}>+ Date</button>
      </div>

      {showDatePicker && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-panel" style={{ maxWidth: 340, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input type="date" value={datePickerValue} onChange={(e) => setDatePickerValue(e.target.value)} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn ghost" type="button" onClick={() => setShowDatePicker(false)}>Cancel</button>
              <button className="btn primary" type="button" onClick={handleConfirmAddDate}>Add date</button>
            </div>
          </div>
        </div>
      )}

      {teams.length === 0 && <p className="sub">No teams yet — add one to start taking roll.</p>}

      {teams.length > 0 && (
        <div className="panel" style={{ overflowX: 'auto' }}>
          <table className="table-compact">
            <thead>
              <tr>
                <th>Team</th>
                {cols.map((c) =>
                  c.type === 'date' ? (
                    <th key={c.date}>
                      {c.weekFirst && (
                        <button className="btn ghost" style={{ padding: '4px 6px' }} type="button" onClick={() => collapseWeek(c.weekKey)} title="Collapse week" aria-label="Collapse week">▼</button>
                      )}
                      {monthName(c.date)} {dispDate(c.date)}
                      <button className="btn ghost" style={{ padding: '4px 6px' }} type="button" onClick={() => handleDeleteDate(c.date)} aria-label={`Delete ${c.date}`}>✕</button>
                    </th>
                  ) : (
                    <th key={c.weekKey}>
                      <button className="btn ghost" type="button" onClick={() => expandWeek(c.weekKey)}>▶ {formatWeekRange(c.dates)}</button>
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {teams.map((team) => {
                const teamRecords = forTeam(records, team.id)
                return (
                <tr key={team.id}>
                  <th>
                    <button className="btn ghost" type="button" onClick={() => handleRenameTeam(team)}>{team.name}</button>
                    <button className="btn ghost" style={{ padding: '4px 6px' }} type="button" onClick={() => setReportTeamId(team.id)} aria-label={`${team.name} report`}>📊</button>
                    <button className="btn ghost" style={{ padding: '4px 6px' }} type="button" onClick={() => handleDeleteTeam(team)} aria-label={`Delete ${team.name}`}>✕</button>
                  </th>
                  {cols.map((c) => {
                    if (c.type === 'date') {
                      const cnt = presentCount(teamRecords, team.members, c.date)
                      return (
                        <td key={c.date}>
                          <button className="btn" type="button" onClick={() => setRollCall({ teamId: team.id, date: c.date })}>
                            {cnt === null ? '+' : cnt}
                          </button>
                        </td>
                      )
                    }
                    const ws = weekTeamSum(teamRecords, team.members, c.dates)
                    return (
                      <td key={c.weekKey}>
                        <button className="btn ghost" type="button" onClick={() => expandWeek(c.weekKey)}>{ws.logged ? ws.sum : '···'}</button>
                      </td>
                    )
                  })}
                </tr>
                )
              })}
              <tr>
                <th>Total</th>
                {cols.map((c) =>
                  c.type === 'date' ? (
                    <td key={c.date}>{dateTotal(records, teams, c.date)}</td>
                  ) : (
                    <td key={c.weekKey}>{weekDateTotal(records, teams, c.dates)}</td>
                  )
                )}
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {rollCallTeam && (
        <RollCallModal
          team={rollCallTeam}
          date={rollCall.date}
          athletes={athletes}
          records={forTeam(records, rollCallTeam.id)}
          onClose={() => setRollCall(null)}
          onSetStatus={(athleteId, date, status) => handleSetStatus(rollCallTeam.id, athleteId, date, status)}
          onBulkSetStatus={(athleteIds, date, status) => handleBulkSetStatus(rollCallTeam.id, athleteIds, date, status)}
          onClearCell={(athleteIds, date) => handleClearCell(rollCallTeam.id, athleteIds, date)}
          onAddPlayers={(names, height) => handleAddPlayers(rollCallTeam, names, height)}
          onRemoveMember={(athleteId) => handleRemoveMember(rollCallTeam, athleteId)}
          onUpdateHeight={handleUpdateHeight}
        />
      )}

      {reportTeam && (
        <ReportModal team={reportTeam} athletes={athletes} records={forTeam(records, reportTeam.id)} onClose={() => setReportTeamId(null)} />
      )}
    </div>
  )
}
