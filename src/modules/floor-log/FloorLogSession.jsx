import { useCallback, useEffect, useMemo, useState } from 'react'
import * as api from './floorLogApi'
import { resolveDaySession } from './floorEngine'
import { EXDB, EXNAMES, wkValue } from '../build-program/engine/workload'

function groupLogs(rows) {
  const map = new Map()
  rows.forEach((r) => {
    if (!map.has(r.exercise_index)) {
      map.set(r.exercise_index, {
        exercise_index: r.exercise_index,
        exercise: r.exercise,
        target: r.target,
        prescribed: r.prescribed,
        purpose: r.purpose,
        sets: [],
      })
    }
    map.get(r.exercise_index).sets.push(r)
  })
  return [...map.values()].sort((a, b) => a.exercise_index - b.exercise_index)
}

function heightLabel(a) {
  return a.height_feet != null ? `${a.height_feet}'${a.height_inches || 0}"` : 'no height'
}

export function FloorLogSession({ facilityId, athlete, program, date }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sessionId, setSessionId] = useState(null)
  const [projected, setProjected] = useState('')
  const [ascOverride, setAscOverride] = useState(null)
  const [ctx, setCtx] = useState(null) // { offday, week, wd, code }
  const [slots, setSlots] = useState([])
  const [search, setSearch] = useState(null) // { exerciseIndex, query } — one open dropdown at a time
  const [savedFlash, setSavedFlash] = useState(false)

  const loadSession = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const day = resolveDaySession(program, date)
      const sess = await api.ensureSession(facilityId, athlete.id, date)
      let rows = await api.fetchLogs(sess.id)
      if (!rows.length && !day.offday && day.prescribed.length) {
        rows = await api.seedExercises(facilityId, sess.id, athlete.id, day.prescribed)
      }
      setSessionId(sess.id)
      setProjected(sess.projected ?? '')
      setAscOverride(sess.asc_override)
      setCtx(day)
      setSlots(groupLogs(rows))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [facilityId, athlete.id, program, date])

  useEffect(() => { loadSession() }, [loadSession])

  const total = useMemo(() => {
    let t = 0
    slots.forEach((s) => s.sets.forEach((set) => { if (set.value != null) t += Number(set.value) }))
    return Math.round(t * 100) / 100
  }, [slots])
  const ascDisp = ascOverride != null ? Number(ascOverride) : total
  const projectedNum = projected === '' || projected == null ? null : Number(projected)
  const over = projectedNum != null && !isNaN(projectedNum) && ascDisp > projectedNum

  async function refresh() {
    const rows = await api.fetchLogs(sessionId)
    setSlots(groupLogs(rows))
  }

  function patchLocalSet(setId, patch) {
    setSlots((cur) => cur.map((s) => ({ ...s, sets: s.sets.map((set) => (set.id === setId ? { ...set, ...patch } : set)) })))
  }

  function handleFieldEdit(setRow, field, raw) {
    const value = field === 'tempo' ? (raw.trim() || null) : (raw === '' ? null : +raw)
    patchLocalSet(setRow.id, { [field]: value })
    api.updateSet(setRow.id, { [field]: value }).catch((err) => setError(err.message))
  }

  async function handleNextSet(slot, setRow) {
    if (!(slot.exercise && EXDB[slot.exercise] != null)) {
      setSearch({ exerciseIndex: slot.exercise_index, query: '' })
      return
    }
    const value = wkValue(slot.exercise, athlete.height_feet, athlete.height_inches, setRow.set_index + 1, setRow.weight, setRow.reps, setRow.tempo)
    try {
      await api.updateSet(setRow.id, { value })
      const isLast = setRow.set_index === slot.sets[slot.sets.length - 1].set_index
      if (isLast) {
        await api.addSet(facilityId, sessionId, athlete.id, slot, setRow.set_index + 1, {
          weight: setRow.weight, reps: setRow.reps, tempo: setRow.tempo,
        })
      }
      await refresh()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handlePickExercise(slot, name) {
    setSearch(null)
    try {
      await api.setSlotExercise(sessionId, slot.exercise_index, name)
      await refresh()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleRemoveExercise(slot) {
    try {
      await api.removeExerciseSlot(sessionId, slot.exercise_index)
      await refresh()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleAddExercise() {
    const nextIndex = slots.length ? Math.max(...slots.map((s) => s.exercise_index)) + 1 : 0
    try {
      await api.addExerciseSlot(facilityId, sessionId, athlete.id, nextIndex)
      await refresh()
    } catch (err) {
      setError(err.message)
    }
  }

  function handleAscClick() {
    const cur = ascOverride != null ? ascOverride : total
    const v = window.prompt('Override ASC (leave blank to use computed):', cur)
    if (v === null) return
    const next = v.trim() === '' ? null : (isNaN(+v) ? ascOverride : +v)
    setAscOverride(next)
    api.updateSession(sessionId, { asc_override: next }).catch((err) => setError(err.message))
  }

  function handleProjectedChange(raw) {
    setProjected(raw)
    api.updateSession(sessionId, { projected: raw === '' ? null : +raw }).catch((err) => setError(err.message))
  }

  function handleDone() {
    setSavedFlash(true)
    setTimeout(() => setSavedFlash(false), 1400)
  }

  async function handleCancel() {
    if (!window.confirm(`Cancel this session? Clears logged sets for ${athlete.name} on ${date} and reloads the program.`)) return
    try {
      await api.deleteSession(sessionId)
      await loadSession()
    } catch (err) {
      setError(err.message)
    }
  }

  if (loading) return <p>Loading session…</p>
  if (!ctx) return <p role="alert">{error || 'Could not load this session.'}</p>

  return (
    <div>
      {error && <p role="alert">{error}</p>}

      <div>
        <div>
          ASC{' '}
          <b title="Athlete Strength Capacity — tap to override" onClick={handleAscClick} style={{ cursor: 'pointer', color: over ? 'crimson' : undefined }}>
            {ascDisp.toFixed(2)}
          </b>
        </div>
        <div>
          <label>PSC</label>
          <input
            type="number"
            step="any"
            placeholder="—"
            value={projected}
            onChange={(e) => handleProjectedChange(e.target.value)}
            style={over ? { borderColor: 'crimson' } : undefined}
          />
        </div>
        <div>
          {ctx.offday ? `Off-day session · ${date}` : `Week ${ctx.week} · ${ctx.wd} · Code ${ctx.code}`}
          <br />
          {athlete.name} · {heightLabel(athlete)}
        </div>
      </div>

      {ctx.offday && <p>Not a program training day — add movements with <b>+ Next Exercise</b> to log a one-off lift.</p>}
      {athlete.height_feet == null && <p>Set {athlete.name}'s height in the Roster (Tracker) — the Strength Capacity math needs it to compute workload.</p>}

      {slots.map((slot) => {
        const hasCoeff = slot.exercise && EXDB[slot.exercise] != null
        const disp = slot.exercise ? slot.exercise.charAt(0).toUpperCase() + slot.exercise.slice(1) : ''
        const searching = search && search.exerciseIndex === slot.exercise_index
        const options = searching ? EXNAMES.filter((n) => n.toLowerCase().includes(search.query.toLowerCase())).slice(0, 250) : []
        let sub = 0
        slot.sets.forEach((s) => { if (s.value != null) sub += Number(s.value) })

        return (
          <div key={slot.exercise_index}>
            <div style={{ position: 'relative' }}>
              <input
                placeholder="Search exercise..."
                autoComplete="off"
                value={searching ? search.query : disp}
                onFocus={() => setSearch({ exerciseIndex: slot.exercise_index, query: '' })}
                onChange={(e) => setSearch({ exerciseIndex: slot.exercise_index, query: e.target.value })}
                onBlur={() => setTimeout(() => setSearch((s) => (s && s.exerciseIndex === slot.exercise_index ? null : s)), 200)}
              />
              {searching && (
                <div>
                  {options.map((n) => (
                    <div key={n} onMouseDown={(e) => { e.preventDefault(); handlePickExercise(slot, n) }}>
                      {n.charAt(0).toUpperCase() + n.slice(1)}
                    </div>
                  ))}
                </div>
              )}
              <button type="button" onClick={() => handleRemoveExercise(slot)} title="Remove exercise" aria-label="Remove exercise">✕</button>
            </div>
            <div>
              {slot.prescribed ? <>target: <b>{slot.target || ''}</b> · {slot.prescribed}</> : 'added exercise'}
              {slot.exercise && !hasCoeff && <span> ⚠ pick a listed movement for a coefficient</span>}
            </div>

            <div>
              <div><span>Set</span><span>Weight</span><span>Reps</span><span>Tempo</span><span>Value</span><span></span></div>
              {slot.sets.map((s) => (
                <div key={s.id}>
                  <span>{s.set_index + 1}</span>
                  <input type="number" step="any" inputMode="decimal" placeholder="Weight" value={s.weight ?? ''} onChange={(e) => handleFieldEdit(s, 'weight', e.target.value)} />
                  <input type="number" step="any" inputMode="numeric" placeholder="Reps" value={s.reps ?? ''} onChange={(e) => handleFieldEdit(s, 'reps', e.target.value)} />
                  <input type="text" inputMode="numeric" placeholder="Tempo" value={s.tempo ?? ''} onChange={(e) => handleFieldEdit(s, 'tempo', e.target.value)} />
                  <span>{s.value != null ? Number(s.value).toFixed(2) : '—'}</span>
                  <button type="button" onClick={() => handleNextSet(slot, s)}>Next Set</button>
                </div>
              ))}
            </div>
            <div>exercise workload: <b>{(Math.round(sub * 100) / 100).toFixed(2)}</b></div>
          </div>
        )
      })}

      <button type="button" onClick={handleAddExercise}>+ Next Exercise</button>
      <div>
        <button type="button" onClick={handleDone}>{savedFlash ? 'Saved ✓' : 'Done'}</button>
        <button type="button" onClick={handleCancel}>Cancel</button>
      </div>
    </div>
  )
}
