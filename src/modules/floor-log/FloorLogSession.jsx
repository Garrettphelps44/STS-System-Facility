import { useCallback, useEffect, useMemo, useState } from 'react'
import * as api from './floorLogApi'
import * as assessmentApi from '../assessment/assessmentApi'
import { programDays, resolveDaySession } from './floorEngine'
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

export function FloorLogSession({ facilityId, athlete, program, date, onDone }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sessionId, setSessionId] = useState(null)
  const [projected, setProjected] = useState('')
  const [ascOverride, setAscOverride] = useState(null)
  const [ctx, setCtx] = useState(null) // { offday, week, wd, code }
  const [slots, setSlots] = useState([])
  const [search, setSearch] = useState(null) // { exerciseIndex, query } — one open dropdown at a time
  const [finishing, setFinishing] = useState(false)

  const loadSession = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      // The session's program day is the one the coach picked for this
      // athlete (sess.day_index), else whatever the program has on this date.
      const sess = await api.ensureSession(facilityId, athlete.id, date)
      const scheduled = resolveDaySession(program, date, sess.day_index)
      let rows = await api.fetchLogs(sess.id)

      // First open: a program day gets its program exercises; a day with
      // no programmed session gets 5 blank boxes to build the athlete's own.
      if (!rows.length) {
        if (!scheduled.offday && scheduled.prescribed.length) {
          rows = await api.seedExercises(facilityId, sess.id, athlete.id, scheduled.prescribed)
        } else if (scheduled.offday) {
          rows = await api.seedBlankExercises(facilityId, sess.id, athlete.id)
        }
      }

      // An "own session" is one where every exercise was added by hand —
      // none came from the program (program rows always carry `prescribed`).
      // That's the default on a non-program day, and what "+" makes on any
      // day. It's treated like an off-day for the PSC: an average training
      // day's share of the week, not a program day's.
      const custom = rows.length > 0 && rows.every((r) => r.prescribed == null)
      const day = custom ? { ...scheduled, offday: true, custom: true } : { ...scheduled, custom: false }

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

  // Done: make sure what's on screen is what's saved, then hand off so the
  // athlete is cleared from view. Every keystroke already saves, but those
  // writes aren't awaited — so this re-writes every set's weight/reps/tempo
  // (and the PSC), reads the session back, and only reports done if the
  // database matches the screen exactly. Any mismatch or error keeps the
  // athlete on screen with the error shown, so nothing is lost silently.
  async function handleDone() {
    setFinishing(true)
    setError('')
    try {
      const sets = slots.flatMap((s) => s.sets)
      await Promise.all([
        ...sets.map((set) => api.updateSet(set.id, { weight: set.weight ?? null, reps: set.reps ?? null, tempo: set.tempo ?? null })),
        api.updateSession(sessionId, { projected: projected === '' || projected == null ? null : +projected }),
      ])
      const saved = await api.fetchLogs(sessionId)
      const byId = new Map(saved.map((r) => [r.id, r]))
      const same = (a, b) => (a ?? null) === (b ?? null) || Number(a) === Number(b)
      const mismatch = sets.find((set) => {
        const r = byId.get(set.id)
        return !r || !same(r.weight, set.weight) || !same(r.reps, set.reps) || (r.tempo ?? null) !== (set.tempo ?? null)
      })
      if (mismatch) throw new Error('Some sets did not save — check your connection and tap Done again.')
      onDone?.()
    } catch (err) {
      setError(err.message)
      setFinishing(false)
    }
  }

  // Put this athlete on a different program day for this session. The
  // day's exercises are re-seeded and its PSC/weights re-filled; if sets
  // have already been logged (Next Set pressed), ask first, since those
  // are cleared along with the old day's exercises.
  async function handleChooseDay(index) {
    if (!ctx.custom && index === ctx.dayIndex) return
    const logged = slots.some((s) => s.sets.length > 1)
    if (logged && !window.confirm(`Switch ${athlete.name} to Day ${index + 1}? This replaces this session's exercises and clears what's been logged in it.`)) return
    try {
      await api.switchSessionDay(sessionId, index)
      await loadSession()
    } catch (err) {
      setError(err.message)
    }
  }

  // "+": the athlete's own session — swaps this session's exercises for 5
  // blank boxes the coach fills in. Asks first if sets were already logged.
  async function handleOwnSession() {
    if (ctx.custom) return
    const logged = slots.some((s) => s.sets.length > 1)
    if (logged && !window.confirm(`Start ${athlete.name}'s own session? This replaces this session's exercises with ${api.BLANK_EXERCISE_COUNT} blank ones and clears what's been logged in it.`)) return
    try {
      await api.startOwnSession(facilityId, sessionId, athlete.id)
      await loadSession()
    } catch (err) {
      setError(err.message)
    }
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

      {/* ASC/PSC and the Training day picker share one row (wrapping to two
          on a narrow screen), each in its own box. */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'stretch' }}>
        <div className="panel" style={{ flex: '0 0 auto', display: 'flex', gap: 24, alignItems: 'flex-start' }}>
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
              style={{ width: 120, ...(over ? { borderColor: 'var(--gold)' } : {}) }}
            />
          </label>
        </div>

        {programDays(program).length > 0 && ctx.week != null && (
          <div className="panel" style={{ flex: '1 1 380px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
            <span className="lab" style={{ marginRight: 6 }}>Training day</span>
            {programDays(program).map((d) => (
              <button
                key={d.index}
                className="btn"
                type="button"
                aria-pressed={!ctx.custom && !ctx.offday && ctx.dayIndex === d.index}
                title={`${d.weekday} in the program · Session ${d.code}${d.index === ctx.defaultDayIndex ? ' · scheduled for this date' : ''}`}
                style={{ padding: '6px 10px' }}
                onClick={() => handleChooseDay(d.index)}
              >
                Day {d.index + 1} · {d.weekday}
              </button>
            ))}
            <button
              className="btn"
              type="button"
              aria-pressed={!!ctx.custom}
              aria-label="Own session"
              title={`Own session — ${api.BLANK_EXERCISE_COUNT} blank exercises to fill in`}
              style={{ padding: '6px 12px', fontWeight: 800 }}
              onClick={handleOwnSession}
            >
              +
            </button>
            {!ctx.custom && !ctx.offday && ctx.defaultDayIndex !== ctx.dayIndex && (
              <span className="sub" style={{ marginLeft: 6 }}>
                {ctx.defaultDayIndex == null ? `Not a program day on ${date} — doing Day ${ctx.dayIndex + 1}` : `Scheduled: Day ${ctx.defaultDayIndex + 1} — doing Day ${ctx.dayIndex + 1}`}
              </span>
            )}
          </div>
        )}
      </div>

      {ctx.custom && <p className="sub">Own session — search a movement in each box below (add more with <b>+ Next Exercise</b>). Pick a training day above to load the program instead.</p>}
      {ctx.offday && !ctx.custom && <p className="sub">Not a program training day — pick a training day above to load its exercises, or add movements with <b>+ Next Exercise</b>.</p>}
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
            <p className="sub" style={{ margin: '4px 0' }}>
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
            <p className="sub" style={{ margin: '4px 0 0' }}>exercise workload: <b style={{ color: 'var(--white)' }}>{(Math.round(sub * 100) / 100).toFixed(2)}</b></p>
          </div>
        )
      })}

      <button className="btn ghost" type="button" onClick={handleAddExercise}>+ Next Exercise</button>
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button className="btn primary" type="button" onClick={handleDone} disabled={finishing}>{finishing ? 'Saving…' : 'Done'}</button>
        <button className="btn ghost" type="button" onClick={handleCancel}>Cancel</button>
      </div>
    </div>
  )
}
