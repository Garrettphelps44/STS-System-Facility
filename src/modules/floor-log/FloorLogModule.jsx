import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../auth/AuthContext'
import * as trackerApi from '../tracker/trackerApi'
import * as buildProgramApi from '../build-program/buildProgramApi'
import { mondayISO } from '../build-program/constants'
import { AddPlayerModal } from './AddPlayerModal'
import { FloorLogSession } from './FloorLogSession'

function playerLabel(a) {
  return a ? a.name + (a.height_feet != null ? ` — ${a.height_feet}'${a.height_inches || 0}"` : '') : ''
}

export function FloorLogModule() {
  const { membership } = useAuth()
  const facilityId = membership.facilityId

  const [programs, setPrograms] = useState([])
  const [programId, setProgramId] = useState('')
  const [program, setProgram] = useState(null)
  const [athletes, setAthletes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [query, setQuery] = useState('')
  const [showOptions, setShowOptions] = useState(false)
  const [roster, setRoster] = useState([]) // session "on the floor" chip list
  const [activeId, setActiveId] = useState(null)
  const [date, setDate] = useState('')
  const [showAddPlayer, setShowAddPlayer] = useState(false)

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
        if (progs.length) setProgramId(progs[0].id)
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
    let active = true
    if (!programId) { setProgram(null); return }
    buildProgramApi.fetchProgram(programId).then((row) => {
      if (!active) return
      setProgram(row)
      setDate((d) => row.start_date || d || mondayISO())
    }).catch((err) => active && setError(err.message))
    return () => { active = false }
  }, [programId])

  const activeAthlete = useMemo(() => athletes.find((a) => a.id === activeId) || null, [athletes, activeId])

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

  if (loading) return <p>Loading Floor Log…</p>
  if (error) return <p role="alert">{error}</p>

  return (
    <div>
      <h2>Floor Log</h2>
      <p>Select a player and date — the program loads its movements. Search a movement, log set · weight · reps · tempo, hit Next Set.</p>

      <div>
        <label>Program</label>
        <select value={programId} onChange={(e) => setProgramId(e.target.value)}>
          {!programs.length && <option value="">— build or save a program first —</option>}
          {programs.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label>Player</label>
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <input
            placeholder="Select player…"
            autoComplete="off"
            value={query}
            onFocus={() => { setQuery(''); setShowOptions(true) }}
            onChange={(e) => { setQuery(e.target.value); setShowOptions(true) }}
            onBlur={() => setTimeout(() => { setShowOptions(false); setQuery(playerLabel(activeAthlete)) }, 200)}
          />
          {showOptions && (
            <div>
              {!filteredAthletes.length && <div>No players — tap + Add Player</div>}
              {filteredAthletes.map((a) => (
                <div key={a.id} onMouseDown={(e) => { e.preventDefault(); setShowOptions(false); addToFloor(a.id) }}>
                  {a.name} <small>{a.height_feet != null ? `${a.height_feet}'${a.height_inches || 0}"` : 'no ht'}</small>
                </div>
              ))}
            </div>
          )}
        </div>
        <button type="button" onClick={() => setShowAddPlayer(true)}>+ Add Player</button>
        <label>Date</label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>

      {roster.length > 0 && (
        <div>
          {roster.map((id) => {
            const a = athletes.find((x) => x.id === id)
            if (!a) return null
            return (
              <span key={id} style={{ fontWeight: id === activeId ? 'bold' : 'normal' }}>
                <button type="button" onClick={() => setActivePlayer(id)}>{a.name}</button>
                <button type="button" onClick={() => removeFromRoster(id)} aria-label={`Remove ${a.name}`}>✕</button>
              </span>
            )
          })}
          <button type="button" onClick={() => { setRoster([]); setActiveId(null); setQuery('') }}>Clear session</button>
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

      {!program && <p>No program available. Build one in Build Program (or save one) first.</p>}
      {program && !activeAthlete && <p>Add an athlete above to start logging.</p>}
      {program && activeAthlete && !date && <p>Pick a date.</p>}
      {program && activeAthlete && date && (
        <FloorLogSession
          key={activeAthlete.id + '|' + date}
          facilityId={facilityId}
          athlete={activeAthlete}
          program={program}
          date={date}
        />
      )}
    </div>
  )
}
