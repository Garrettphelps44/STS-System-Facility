// Date -> session resolution for Floor Log. Reuses Build Program's own
// engine rather than reading program_weeks (which no module actually
// populates — resolveSession() is a pure function of constraints/week/
// day, so program_weeks was never needed for this).
import { DAYS } from '../build-program/constants'
import { buildCalMap } from '../build-program/calendar'
import { resolveSession } from '../build-program/engine/session'
import { wkMatch } from '../build-program/engine/workload'

// Ported from reference/reference:Index.html (setsRepsFrom, ~line 3118).
export function setsRepsFrom(vol) {
  const rx = String(vol).split(' ')[0]
  const m = rx.match(/^(\d+)\s*[x×]\s*(\d+)/i)
  return { rx, sets: m ? +m[1] : 1, reps: m ? +m[2] : null }
}

// Ported from reference/reference:Index.html (roundPlate, ~line 3138) —
// rounds an auto-prescribed weight to a plate-friendly number.
export function roundPlate(v, key) {
  const barbell = /(^|\s)bb |^back squat|^front squat|conventional deadlift|trap bar/.test(key || '')
  const r = Math.max(5, Math.round(v / 5) * 5)
  return barbell ? Math.max(45, r) : r
}

// Ported from reference/reference:Index.html (planSets, ~line 3158) —
// how many sets a prescribed exercise's target string implies.
export function planSetsFromTarget(target) {
  const m = String(target || '').match(/^(\d+)\s*[x×]/i)
  return m ? +m[1] : 1
}

export function contextFor(program) {
  const c = program.constraints || {}
  return { system: program.system, sessionLength: c.sessionLength, equipment: c.equipment, skill: c.skill, sport: c.sport }
}

// Resolves a calendar date against a saved program.
//
// buildCalMap only has entries for actual scheduled training days across
// the 52-week span, so "no entry for this date" already covers every
// off-day case the reference distinguished separately (rest day, before
// the program's start, after week 52, no program at all) — no need to
// re-derive which one it was.
export function resolveDaySession(program, dateISO) {
  if (!program || !program.start_date) return { offday: true, prescribed: [] }
  const days = (program.constraints || {}).days || {}
  const calMap = buildCalMap(program.start_date, days)
  const hit = calMap[dateISO]
  if (!hit) return { offday: true, prescribed: [] }

  const activeDayNames = DAYS.filter((d) => days[d])
  const wd = activeDayNames[hit.di]
  const cx = contextFor(program)
  const sess = resolveSession(hit.week, hit.di, hit.type, cx)

  const prescribed = []
  sess.blocks
    .filter((b) => b.kind === 'lift')
    .forEach((b) => {
      b.rows.forEach((row) => {
        const { rx, reps } = setsRepsFrom(row.vol)
        prescribed.push({ exercise: wkMatch(row.ex) || '', target: rx, prescribed: row.ex, purpose: row.purpose, reps })
      })
    })

  return { offday: false, week: hit.week, wd, dayIndex: hit.di, trainingDays: activeDayNames.length, code: sess.code, prescribed }
}
