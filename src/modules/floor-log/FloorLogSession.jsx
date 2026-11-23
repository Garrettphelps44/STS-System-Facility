import { useCallback, useEffect, useMemo, useState } from 'react'
import * as api from './floorLogApi'
import * as assessmentApi from '../assessment/assessmentApi'
import { resolveDaySession } from './floorEngine'
import { athleteWeekTotals, planAutoFill, priorWeekWeights, progressedPSC } from './progression'
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
      const isFreshSession = !rows.length

      if (isFreshSession && !day.offday && day.prescribed.length) {
        rows = await api.seedExercises(facilityId, sess.id, athlete.id, day.prescribed)
      }

      // Assessment auto-fill — runs on any load of a session that still
      // has no PSC (sess.projected is the "auto-fill has happened"
      // marker), not just the first. That's what lets a day that was
      // opened BEFORE the athlete's Assessment existed pick up its PSC
      // and weights the next time it's opened; once projected is set it
      // never runs again, so it can't fight the coach's edits. Even
      // while it runs, planAutoFill only writes blank weight boxes.
      // This whole block is an optional assist on top of a session that
      // already works without it (that's exactly how Floor Log shipped
      // before Assessment existed) — a failure here (Assessment not set
      // up for this athlete yet, a transient fetch error, whatever)
      // must never block the coach from logging the session itself, so
      // it's isolated in its own try/catch rather than the outer one.
      let projectedValue = sess.projected
      if (sess.projected == null && athlete.height_feet != null) {
        try {
          const assessment = await assessmentApi.fetchAssessment(facilityId, athlete.id)
          if (assessment?.psc != null) {
            let psc
            if (!day.offday) {
              const history = await api.fetchAthleteHistory(facilityId, athlete.id)
              const weekTotals = athleteWeekTotals(history, program, date)
              psc = progressedPSC(assessment.psc, weekTotals, day.week, day.dayIndex, day.trainingDays || 1)
            } else {
              // Off-day (not a program day): the Assessment PSC is a whole
              // week's workload now, so an extra one-off day gets an
              // average training day's share of it — not the full week.
              const trainingDays = Object.values((program?.constraints || {}).days || {}).filter(Boolean).length || 1
              psc = Math.round((assessment.psc / trainingDays) * 100) / 100
            }
            projectedValue = psc
            await api.updateSession(sess.id, { projected: psc })

            if (rows.length) {
              const ft = athlete.height_feet
              const inch = athlete.height_inches
              const week = day.week || 1

              // Real entered data always wins, whenever it exists — the
              // athlete's own most recent prior week's actual logged
              // weight for that exact exercise, assessed or not. Only
              // fetched when it could possibly apply (week > 1); every
              // exercise's first-ever appearance (week 1, or a movement
              // that's new to the program later on) has no prior data by
              // definition and falls to the calibration/light branches
              // below instead.
              const priorWeights = week > 1
                ? priorWeekWeights(await api.fetchAthleteExerciseHistory(facilityId, athlete.id), program, week)
                : {}

              const updates = planAutoFill({ rows, assessedWeights: assessment.weights, priorWeights, ft, inch })

              if (updates.length) {
                await Promise.all(updates.map((u) => api.updateSet(u.id, { weight: u.weight, value: u.value })))
                rows = await api.fetchLogs(sess.id)
              }
            }
          }
        } catch (assessErr) {
          console.error('Assessment auto-fill skipped:', assessErr)
        }
      }

      setSessionId(sess.id)
      setProjected(projectedValue ?? '')
      setAscOverride(sess.asc_override)
      setCtx(day)
      setSlots(groupLogs(rows))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [facilityId, athlete.id, athlete.height_feet, athlete.height_inches, program, date])

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

  if (loading) return <p className="sub">Loading session…</p>
  if (!ctx) return <p className="error-text" role="alert">{error || 'Could not load this session.'}</p>

  return (
    <div>
      {error && <p className="error-text" role="alert">{error}</p>}

      <div className="panel" style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'flex-start' }}>
        <div>
          <p className="eyebrow" style={{ marginBottom: 2 }}>ASC</p>
          <b title="Athlete Strength Capacity — tap to override" onClick={handleAscClick} style={{ cursor: 'pointer', fontSize: 20, color: over ? 'var(--gold)' : 'var(--white)' }}>
            {ascDisp.toFixed(2)}
          </b>
        </div>
        <label className="field" style={{ marginBottom: 0 }}>
          <span className="lab">PSC</span>
          <input
            type="number"
            step="any"
            placeholder="—"
            value={projected}
            onChange={(e) => handleProjectedChange(e.target.value)}
            style={over ? { borderColor: 'var(--gold)' } : undefined}
          />
        </label>
        <div className="sub">
          {ctx.offday ? `Off-day session · ${date}` : `Week ${ctx.week} · ${ctx.wd} · Code ${ctx.code}`}
          <br />
          {athlete.name} · {heightLabel(athlete)}
        </div>
      </div>

      {ctx.offday && <p className="sub">Not a program training day — add movements with <b>+ Next Exercise</b> to log a one-off lift.</p>}
      {athlete.height_feet == null && <p className="sub">Set {athlete.name}'s height in the Roster (Tracker) — the Strength Capacity math needs it to compute workload.</p>}

      {slots.map((slot) => {
        const hasCoeff = slot.exercise && EXDB[slot.exercise] != null
        const disp = slot.exercise ? slot.exercise.charAt(0).toUpperCase() + slot.exercise.slice(1) : ''
        const searching = search && search.exerciseIndex === slot.exercise_index
        const options = searching ? EXNAMES.filter((n) => n.toLowerCase().includes(search.query.toLowerCase())).slice(0, 250) : []
        let sub = 0
        slot.sets.forEach((s) => { if (s.value != null) sub += Number(s.value) })

        return (
          <div key={slot.exercise_index} className="panel">
            <div style={{ position: 'relative', display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                style={{ flex: 1 }}
                placeholder="Search exercise..."
                autoComplete="off"
                value={searching ? search.query : disp}
                onFocus={() => setSearch({ exerciseIndex: slot.exercise_index, query: '' })}
                onChange={(e) => setSearch({ exerciseIndex: slot.exercise_index, query: e.target.value })}
                onBlur={() => setTimeout(() => setSearch((s) => (s && s.exerciseIndex === slot.exercise_index ? null : s)), 200)}
              />
              {searching && (
                <div className="panel" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, padding: 8, maxHeight: 220, overflowY: 'auto' }}>
                  {options.map((n) => (
                    <div key={n} onMouseDown={(e) => { e.preventDefault(); handlePickExercise(slot, n) }} style={{ padding: '8px 6px', cursor: 'pointer' }}>
                      {n.charAt(0).toUpperCase() + n.slice(1)}
                    </div>
                  ))}
                </div>
              )}
              <button className="btn ghost" type="button" onClick={() => handleRemoveExercise(slot)} title="Remove exercise" aria-label="Remove exercise">✕</button>
            </div>
            <p className="sub" style={{ margin: '8px 0' }}>
              {slot.prescribed ? <>target: <b style={{ color: 'var(--white)' }}>{slot.target || ''}</b> · {slot.prescribed}</> : 'added exercise'}
              {slot.exercise && !hasCoeff && <span style={{ color: 'var(--gold)' }}> ⚠ pick a listed movement for a coefficient</span>}
            </p>

            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr><th>Set</th><th>Weight</th><th>Reps</th><th>Tempo</th><th>Value</th><th></th></tr>
                </thead>
                <tbody>
                  {slot.sets.map((s) => (
                    <tr key={s.id}>
                      <td>{s.set_index + 1}</td>
                      <td><input type="number" step="any" inputMode="decimal" placeholder="Weight" value={s.weight ?? ''} onChange={(e) => handleFieldEdit(s, 'weight', e.target.value)} /></td>
                      <td><input type="number" step="any" inputMode="numeric" placeholder="Reps" value={s.reps ?? ''} onChange={(e) => handleFieldEdit(s, 'reps', e.target.value)} /></td>
                      <td><input type="text" inputMode="numeric" placeholder="Tempo" value={s.tempo ?? ''} onChange={(e) => handleFieldEdit(s, 'tempo', e.target.value)} /></td>
                      <td>{s.value != null ? Number(s.value).toFixed(2) : '—'}</td>
                      <td><button className="btn" type="button" onClick={() => handleNextSet(slot, s)}>Next Set</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="sub" style={{ margin: '8px 0 0' }}>exercise workload: <b style={{ color: 'var(--white)' }}>{(Math.round(sub * 100) / 100).toFixed(2)}</b></p>
          </div>
        )
      })}

      <button className="btn ghost" type="button" onClick={handleAddExercise}>+ Next Exercise</button>
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button className="btn primary" type="button" onClick={handleDone}>{savedFlash ? 'Saved ✓' : 'Done'}</button>
        <button className="btn ghost" type="button" onClick={handleCancel}>Cancel</button>
      </div>
    </div>
  )
}
