import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../auth/AuthContext'
import * as trackerApi from '../tracker/trackerApi'
import * as buildProgramApi from '../build-program/buildProgramApi'
import { mondayISO } from '../build-program/constants'
import { AddPlayerModal } from './AddPlayerModal'
import { FloorLogSession } from './FloorLogSession'
import * as floorLogApi from './floorLogApi'

function playerLabel(a) {
  return a ? a.name + (a.height_feet != null ? ` — ${a.height_feet}'${a.height_inches || 0}"` : '') : ''
}

export function FloorLogModule() {
  const { membership } = useAuth()
  const facilityId = membership.facilityId

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
  const [roster, setRoster] = useState([]) // session "on the floor" chip list
  const [activeId, setActiveId] = useState(null)
  const [date, setDate] = useState('')
  const [showAddPlayer, setShowAddPlayer] = useState(false)
  const [doneNotice, setDoneNotice] = useState('')

  const refreshAthletes = useCallback(async () => setAthletes(await trackerApi.fetchAthletes(facilityId)), [facilityId])

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      setError('')
      try {
        const [progs, aths] = await Promise.all([buildProgramApi.fetchPrograms(facilityId), trackerApi.fetchAthletes(facilityId)])
        if (!active) return
        setPrograms(progs)
        setAthletes(aths)
        if (progs.length) setDefaultProgramId(progs[0].id)
      } catch (err) {
        if (active) setError(err.message)
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [facilityId])

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

  function setActivePlayer(id) {
    setActiveId(id)
    const a = athletes.find((x) => x.id === id)
    setQuery(playerLabel(a))
  }

  function addToFloor(id) {
    setRoster((r) => (r.includes(id) ? r : [...r, id]))
    setActivePlayer(id)
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
            onFocus={() => { setQuery(''); setShowOptions(true) }}
            onChange={(e) => { setQuery(e.target.value); setShowOptions(true) }}
            onBlur={() => setTimeout(() => { setShowOptions(false); setQuery(playerLabel(activeAthlete)) }, 200)}
          />
          {showOptions && (
            <div className="panel" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, padding: 8, maxHeight: 220, overflowY: 'auto' }}>
              {!filteredAthletes.length && <div className="sub">No players — tap + Add Player</div>}
              {filteredAthletes.map((a) => (
                <div key={a.id} onMouseDown={(e) => { e.preventDefault(); setShowOptions(false); addToFloor(a.id) }} style={{ padding: '8px 6px', cursor: 'pointer', borderRadius: 'var(--radius)' }}>
                  {a.name} <small className="sub">{a.height_feet != null ? `${a.height_feet}'${a.height_inches || 0}"` : 'no ht'}</small>
                </div>
              ))}
            </div>
          )}
        </label>

        <button className="btn ghost" type="button" onClick={() => setShowAddPlayer(true)} style={{ alignSelf: 'flex-end' }}>+ Add Player</button>

        <label className="field" style={{ marginBottom: 0 }}>
          <span className="lab">Date</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
      </div>

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
