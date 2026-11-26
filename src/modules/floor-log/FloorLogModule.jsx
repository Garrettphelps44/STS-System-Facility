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

  if (loading) return <p className="sub">Loading Floor Log…</p>
  if (error) return <p className="error-text" role="alert">{error}</p>

  return (
    <div className="floor-compact">
      <h2>Floor Log</h2>
      <p className="sub">Select a player and date — the program loads its movements. Search a movement, log set · weight · reps · tempo, hit Next Set.</p>

      <div className="panel" style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
        <label className="field" style={{ flex: 1, minWidth: 200, marginBottom: 0 }}>
          <span className="lab">Program</span>
          <select value={programId} onChange={(e) => setProgramId(e.target.value)}>
            {!programs.length && <option value="">— build or save a program first —</option>}
            {programs.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
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

      {!program && <p className="sub">No program available. Build one in Build Program (or save one) first.</p>}
      {program && !activeAthlete && <p className="sub">Add an athlete above to start logging.</p>}
      {program && activeAthlete && !date && <p className="sub">Pick a date.</p>}
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
