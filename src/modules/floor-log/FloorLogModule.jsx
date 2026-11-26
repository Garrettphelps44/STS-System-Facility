import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../../auth/AuthContext'
import * as trackerApi from '../tracker/trackerApi'
import * as buildProgramApi from '../build-program/buildProgramApi'
import { mondayISO } from '../build-program/constants'
import { AddPlayerModal } from './AddPlayerModal'
import { FloorLogSession } from './FloorLogSession'
import * as floorLogApi from './floorLogApi'
import * as attendanceApi from '../attendance/attendanceApi'

function playerLabel(a) {
  return a ? a.name + (a.height_feet != null ? ` — ${a.height_feet}'${a.height_inches || 0}"` : '') : ''
}

// Who's on the floor, who's selected and the date, saved for this
// browser tab (per facility) so a page reload — or the tablet dropping a
// backgrounded tab — comes back to the same floor. Logged sets already
// save as they're typed; this is just the screen around them.
function floorKey(facilityId) { return `sts.floorLog.${facilityId}` }
function loadFloorState(facilityId) {
  try { return JSON.parse(sessionStorage.getItem(floorKey(facilityId))) || {} } catch { return {} }
}

export function FloorLogModule({ active = true }) {
  const { membership } = useAuth()
  const facilityId = membership.facilityId
  const [saved] = useState(() => loadFloorState(facilityId))

  // Each athlete has their own program (athletes.program_id); an athlete
  // with none assigned uses the facility default — the most recently
  // created program. The Program dropdown always shows the selected
  // athlete's program, so nothing carries over from one athlete to the next.
  const [programs, setPrograms] = useState([])
  const [defaultProgramId, setDefaultProgramId] = useState('')
  const [programCache, setProgramCache] = useState({}) // id -> full program row
  const [programError, setProgramError] = useState('')
  const [athletes, setAthletes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [query, setQuery] = useState('')
  const [showOptions, setShowOptions] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const listRef = useRef(null)
  const [roster, setRoster] = useState(() => (Array.isArray(saved.roster) ? saved.roster : [])) // session "on the floor" chip list
  const [activeId, setActiveId] = useState(() => saved.activeId || null)
  const [date, setDate] = useState(() => saved.date || '')
  const [showAddPlayer, setShowAddPlayer] = useState(false)
  const [doneNotice, setDoneNotice] = useState('')
  const [teams, setTeams] = useState([])
  const [groupNotice, setGroupNotice] = useState('')

  const refreshAthletes = useCallback(async () => setAthletes(await trackerApi.fetchAthletes(facilityId)), [facilityId])

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      setError('')
      try {
        const [progs, aths, tms] = await Promise.all([
          buildProgramApi.fetchPrograms(facilityId),
          trackerApi.fetchAthletes(facilityId),
          attendanceApi.fetchTeams(facilityId),
        ])
        if (!active) return
        setPrograms(progs)
        setAthletes(aths)
        setTeams(tms)
        if (progs.length) setDefaultProgramId(progs[0].id)
        // A restored floor only keeps athletes that still exist.
        const ids = new Set(aths.map((a) => a.id))
        setRoster((r) => r.filter((id) => ids.has(id)))
        setActiveId((id) => (id && ids.has(id) ? id : null))
        const restored = aths.find((a) => a.id === saved.activeId)
        if (restored) setQuery(playerLabel(restored))
      } catch (err) {
        if (active) setError(err.message)
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [facilityId])

  useEffect(() => {
    try { sessionStorage.setItem(floorKey(facilityId), JSON.stringify({ roster, activeId, date })) } catch { /* storage unavailable: just not remembered */ }
  }, [facilityId, roster, activeId, date])

  // Back on this tab after working elsewhere (Floor Log stays mounted while
  // hidden): pick up athletes, heights, programs and teams added or edited
  // meanwhile — without touching the floor, the selection or the open
  // session. The default program is left as it was, so an athlete on the
  // default doesn't get switched to a just-built program mid-session.
  const firstShow = useRef(true)
  useEffect(() => {
    if (!active) return
    if (firstShow.current) { firstShow.current = false; return } // the initial load covers this
    let live = true
    Promise.all([
      buildProgramApi.fetchPrograms(facilityId),
      trackerApi.fetchAthletes(facilityId),
      attendanceApi.fetchTeams(facilityId),
    ]).then(([progs, aths, tms]) => {
      if (!live) return
      setPrograms(progs)
      setAthletes(aths)
      setTeams(tms)
    }).catch((err) => live && setGroupNotice(err.message))
    return () => { live = false }
  }, [active, facilityId])

  const activeAthlete = useMemo(() => athletes.find((a) => a.id === activeId) || null, [athletes, activeId])

  const effectiveProgramId = useMemo(() => {
    const mine = activeAthlete?.program_id
    return mine && programs.some((p) => p.id === mine) ? mine : defaultProgramId
  }, [activeAthlete, programs, defaultProgramId])
  // Only ever the program for whoever is selected right now — never a
  // previous athlete's, which is what keeps a session from being seeded
  // from the wrong program while the next one loads.
  const program = effectiveProgramId ? programCache[effectiveProgramId] || null : null

  useEffect(() => {
    if (!effectiveProgramId || programCache[effectiveProgramId]) return
    let active = true
    buildProgramApi.fetchProgram(effectiveProgramId).then((row) => {
      if (!active) return
      setProgramCache((c) => ({ ...c, [row.id]: row }))
      // First load only: start on the program's start date. Switching
      // athletes (and so programs) keeps the date you're on.
      setDate((d) => d || row.start_date || mondayISO())
    }).catch((err) => active && setError(err.message))
    return () => { active = false }
  }, [effectiveProgramId, programCache])

  // Assign a program to the selected athlete only. The session open on
  // screen was built from their old program, so it's reloaded from the
  // new one — asking first if sets were already logged in it.
  async function handleProgramChange(newId) {
    if (!activeAthlete || !newId || newId === effectiveProgramId) return
    setProgramError('')
    try {
      if (date) {
        const sess = await floorLogApi.ensureSession(facilityId, activeAthlete.id, date)
        const rows = await floorLogApi.fetchLogs(sess.id)
        const newName = programs.find((p) => p.id === newId)?.name || 'this program'
        if (rows.some((r) => r.set_index > 0) && !window.confirm(`Move ${activeAthlete.name} to ${newName}? The ${date} session will be reloaded from it, clearing what's been logged in it.`)) return
        await floorLogApi.switchSessionDay(sess.id, null)
      }
      await trackerApi.updateAthlete(activeAthlete.id, { program_id: newId })
      await refreshAthletes()
    } catch (err) {
      setProgramError(err.message)
    }
  }

  const filteredAthletes = useMemo(() => {
    const t = query.toLowerCase()
    return athletes.filter((a) => a.name.toLowerCase().includes(t))
  }, [athletes, query])

  function pickPlayer(id) {
    setShowOptions(false)
    addToFloor(id)
  }

  // Arrow keys move through the list (scrolling it along), Enter picks,
  // Escape closes — so a long roster can be browsed without the mouse.
  function handlePlayerKey(e) {
    if (!showOptions || !filteredAthletes.length) return
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const step = e.key === 'ArrowDown' ? 1 : -1
      setHighlight((h) => Math.min(filteredAthletes.length - 1, Math.max(0, h + step)))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const a = filteredAthletes[Math.min(highlight, filteredAthletes.length - 1)]
      if (a) pickPlayer(a.id)
    } else if (e.key === 'Escape') {
      setShowOptions(false)
    }
  }

  useEffect(() => {
    if (!showOptions) return
    listRef.current?.querySelector(`[data-index="${highlight}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [highlight, showOptions])

  function setActivePlayer(id) {
    setActiveId(id)
    const a = athletes.find((x) => x.id === id)
    setQuery(playerLabel(a))
  }

  function addToFloor(id) {
    setRoster((r) => (r.includes(id) ? r : [...r, id]))
    setActivePlayer(id)
  }

  // Put a whole group on the floor: everyone marked present or late on
  // that team in Attendance for the Floor Log date. Adds to whoever's
  // already on the floor (no duplicates); each comes in on their own
  // program. Roster order follows the athlete list (alphabetical).
  async function handleAddGroup(teamId) {
    if (!teamId || !date) return
    const team = teams.find((t) => t.id === teamId)
    setGroupNotice('')
    try {
      const ids = await attendanceApi.fetchAttendingAthleteIds(facilityId, teamId, date)
      const attending = athletes.filter((a) => ids.includes(a.id)).map((a) => a.id)
      if (!attending.length) {
        setGroupNotice(`Nobody on ${team.name} is marked present or late on ${date}.`)
        return
      }
      const added = attending.filter((id) => !roster.includes(id))
      setRoster((r) => [...r, ...added.filter((id) => !r.includes(id))])
      if (!activeId) setActivePlayer(attending[0])
      const already = attending.length - added.length
      setGroupNotice(`Added ${added.length} from ${team.name} (present or late on ${date})${already ? ` — ${already} already on the floor` : ''}.`)
    } catch (err) {
      setGroupNotice(err.message)
    }
  }

  function removeFromRoster(id) {
    const rest = roster.filter((x) => x !== id)
    setRoster(rest)
    if (activeId === id) {
      if (rest[0]) setActivePlayer(rest[0])
      else { setActiveId(null); setQuery('') }
    }
  }

  // An athlete tapped Done and their session is confirmed saved: take them
  // off the floor so it's obvious they're finished (the next athlete on the
  // floor, if any, comes up). Their data stays — reopen them any time.
  function handleSessionDone(athlete) {
    removeFromRoster(athlete.id)
    setDoneNotice(`✓ ${athlete.name} is done — ${date} saved.`)
    setTimeout(() => setDoneNotice((n) => (n.includes(athlete.name) ? '' : n)), 6000)
  }

  if (loading) return <p className="sub">Loading Floor Log…</p>
  if (error) return <p className="error-text" role="alert">{error}</p>

  return (
    <div className="floor-compact">
      <h2>Floor Log</h2>
      <p className="sub">Select a player and date — the program loads its movements. Search a movement, log set · weight · reps · tempo, hit Next Set.</p>

      <div className="panel" style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
        <label className="field" style={{ flex: 1, minWidth: 200, marginBottom: 0 }}>
          <span className="lab">Program<span className="hint">{activeAthlete ? `for ${activeAthlete.name}` : 'pick a player first'}</span></span>
          <select value={effectiveProgramId || ''} disabled={!activeAthlete} onChange={(e) => handleProgramChange(e.target.value)}>
            {!programs.length && <option value="">— build or save a program first —</option>}
            {programs.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          {programError && <span className="error-text" role="alert">{programError}</span>}
        </label>

        <label className="field" style={{ flex: 2, minWidth: 220, marginBottom: 0, position: 'relative' }}>
          <span className="lab">Player</span>
          <input
            placeholder="Select player…"
            autoComplete="off"
            value={query}
            onFocus={() => { setQuery(''); setShowOptions(true); setHighlight(0) }}
            onChange={(e) => { setQuery(e.target.value); setShowOptions(true); setHighlight(0) }}
            onKeyDown={handlePlayerKey}
            onBlur={() => setTimeout(() => { setShowOptions(false); setQuery(playerLabel(activeAthlete)) }, 200)}
          />
          {showOptions && (
            // Long rosters scroll inside this box. mousedown is swallowed on
            // the whole box (not just the rows) so grabbing its scrollbar
            // doesn't blur the input and close the list mid-scroll;
            // overscroll stays inside it so the page doesn't move with it.
            <div
              ref={listRef}
              className="panel"
              onMouseDown={(e) => e.preventDefault()}
              style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, padding: 6, maxHeight: 'min(360px, 55vh)', overflowY: 'auto', overscrollBehavior: 'contain' }}
            >
              {!filteredAthletes.length && <div className="sub">No players — tap + Add Player</div>}
              {filteredAthletes.length > 0 && (
                <div className="sub" style={{ position: 'sticky', top: -6, background: 'var(--panel)', padding: '4px 6px', fontSize: 12, zIndex: 1 }}>
                  {filteredAthletes.length} player{filteredAthletes.length === 1 ? '' : 's'}{query ? ` matching "${query}"` : ''} · ↑↓ Enter
                </div>
              )}
              {filteredAthletes.map((a, i) => (
                <div
                  key={a.id}
                  data-index={i}
                  // A full click picks (not mousedown), so a press-and-drag
                  // across the list — scrolling it — never picks someone.
                  onClick={() => pickPlayer(a.id)}
                  onMouseEnter={() => setHighlight(i)}
                  style={{ display: 'flex', alignItems: 'baseline', gap: 6, padding: '7px 6px', cursor: 'pointer', borderRadius: 'var(--radius)', background: i === highlight ? 'var(--panel-2, rgba(127,127,127,.15))' : 'transparent' }}
                >
                  <span style={{ flex: 1 }}>{a.name} <small className="sub">{a.height_feet != null ? `${a.height_feet}'${a.height_inches || 0}"` : 'no ht'}</small></span>
                  {roster.includes(a.id) && <small style={{ color: 'var(--green)', fontWeight: 700 }}>on floor</small>}
                </div>
              ))}
            </div>
          )}
        </label>

        <button className="btn ghost" type="button" onClick={() => setShowAddPlayer(true)} style={{ alignSelf: 'flex-end' }}>+ Add Player</button>

        <label className="field" style={{ marginBottom: 0 }}>
          <span className="lab">From Attendance<span className="hint">present + late</span></span>
          <select
            value=""
            disabled={!teams.length || !date}
            title={!teams.length ? 'No teams in Attendance yet' : `Add everyone marked present or late on ${date}`}
            onChange={(e) => handleAddGroup(e.target.value)}
          >
            <option value="">{teams.length ? 'Add a team…' : 'No teams yet'}</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </label>

        <label className="field" style={{ marginBottom: 0 }}>
          <span className="lab">Date</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
      </div>
      {groupNotice && <p className="sub" role="status">{groupNotice}</p>}

      {roster.length > 0 && (
        <div className="panel" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          {roster.map((id) => {
            const a = athletes.find((x) => x.id === id)
            if (!a) return null
            return (
              <span key={id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <button className="btn" aria-pressed={id === activeId} type="button" onClick={() => setActivePlayer(id)}>{a.name}</button>
                <button className="btn ghost" type="button" onClick={() => removeFromRoster(id)} aria-label={`Remove ${a.name}`}>✕</button>
              </span>
            )
          })}
          <button className="btn ghost" type="button" onClick={() => { setRoster([]); setActiveId(null); setQuery('') }}>Clear session</button>
        </div>
      )}

      {showAddPlayer && (
        <AddPlayerModal
          onClose={() => setShowAddPlayer(false)}
          onSave={async (input) => {
            const a = await trackerApi.addAthlete(facilityId, input)
            await refreshAthletes()
            setShowAddPlayer(false)
            addToFloor(a.id)
          }}
        />
      )}

      {doneNotice && (
        <div className="panel" role="status" style={{ borderColor: 'var(--green)', color: 'var(--green)', fontWeight: 800 }}>
          {doneNotice}
        </div>
      )}

      {!programs.length && <p className="sub">No program available. Build one in Build Program (or save one) first.</p>}
      {programs.length > 0 && !activeAthlete && <p className="sub">Add an athlete above to start logging.</p>}
      {program && activeAthlete && !date && <p className="sub">Pick a date.</p>}
      {program && activeAthlete && date && (
        <FloorLogSession
          key={activeAthlete.id + '|' + date}
          facilityId={facilityId}
          athlete={activeAthlete}
          program={program}
          date={date}
          onDone={() => handleSessionDone(activeAthlete)}
        />
      )}
    </div>
  )
}
