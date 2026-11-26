// Date -> session resolution for Floor Log. Reuses Build Program's own
// engine rather than reading program_weeks (which no module actually
// populates — resolveSession() is a pure function of constraints/week/
// day, so program_weeks was never needed for this).
import { DAYS, addDays, isoToDate } from '../build-program/constants'
import { buildCalMap } from '../build-program/calendar'
import { codeLetter, resolveSession } from '../build-program/engine/session'
import { wkMatch } from '../build-program/engine/workload'

// Ported from reference/reference:Index.html (setsRepsFrom, ~line 3118).
export function setsRepsFrom(vol) {
  const rx = String(vol).split(' ')[0]
  const m = rx.match(/^(\d+)\s*[x×]\s*(\d+)/i)
  return { rx, sets: m ? +m[1] : 1, reps: m ? +m[2] : null }
}

export function isBarbellMovement(key) {
  return /(^|\s)bb |^back squat|^front squat|conventional deadlift|trap bar/.test(key || '')
}

// Ported from reference/reference:Index.html (roundPlate, ~line 3138) —
// rounds an auto-prescribed weight to a plate-friendly number.
export function roundPlate(v, key) {
  const r = Math.max(5, Math.round(v / 5) * 5)
  return isBarbellMovement(key) ? Math.max(45, r) : r
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

// The program's training days, in week order, as built in Build Program
// (e.g. Mon/Tue/Thu/Fri -> Day 1-4 = Sessions A-D). These are the choices
// a coach picks from in Floor Log.
export function programDays(program) {
  const days = (program?.constraints || {}).days || {}
  return DAYS.filter((d) => days[d]).map((weekday, index) => ({ index, weekday, type: days[weekday], code: codeLetter(index) }))
}

// Program week (1-52) a date falls in, counted from the Monday of the
// program's start week — whether or not the date itself is a program day.
// null outside the program's 52 weeks.
export function weekOfDate(program, dateISO) {
  if (!program?.start_date || !dateISO) return null
  const start = isoToDate(program.start_date)
  const startMon = addDays(start, -((start.getDay() + 6) % 7))
  const diff = Math.round((isoToDate(dateISO) - startMon) / 86400000)
  const week = Math.floor(diff / 7) + 1
  return diff >= 0 && week <= 52 ? week : null
}

// Resolves one athlete's session on a date against a saved program.
//
// By default the day is whatever the program has scheduled on that date
// (buildCalMap only has entries for actual scheduled training days, so
// "no entry" covers every off-day case: rest day, before the program's
// start, after week 52). `chosenDayIndex` (the session's day_index — the
// program day the coach picked for this athlete, 0 = Day 1) overrides
// that: same week as the date, but that program day's session. That's how
// athletes in the same group can be on different days, including doing a
// program day on a date the program has off.
export function resolveDaySession(program, dateISO, chosenDayIndex = null) {
  if (!program || !program.start_date) return { offday: true, prescribed: [], defaultDayIndex: null }
  const days = (program.constraints || {}).days || {}
  const activeDayNames = DAYS.filter((d) => days[d])
  const hit = buildCalMap(program.start_date, days)[dateISO]
  const defaultDayIndex = hit ? hit.di : null
  const dayIndex = chosenDayIndex != null && chosenDayIndex < activeDayNames.length ? chosenDayIndex : defaultDayIndex
  const week = hit ? hit.week : weekOfDate(program, dateISO)
  if (dayIndex == null || week == null) {
    return { offday: true, prescribed: [], week, defaultDayIndex, trainingDays: activeDayNames.length }
  }

  const wd = activeDayNames[dayIndex]
  const cx = contextFor(program)
  const sess = resolveSession(week, dayIndex, days[wd], cx)

  const prescribed = []
  sess.blocks
    .filter((b) => b.kind === 'lift')
    .forEach((b) => {
      b.rows.forEach((row) => {
        const { rx, reps } = setsRepsFrom(row.vol)
        prescribed.push({ exercise: wkMatch(row.ex) || '', target: rx, prescribed: row.ex, purpose: row.purpose, reps })
      })
    })

  return { offday: false, week, wd, dayIndex, defaultDayIndex, trainingDays: activeDayNames.length, code: sess.code, prescribed }
}
