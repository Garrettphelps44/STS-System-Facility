// Ported from reference/reference:Index.html (~lines 3043-3098) — the
// weekly acute:chronic progression that turns an Assessment's flat PSC
// into a per-day target. Adapted from the reference's in-memory
// track.floor blob to operate on an athlete's fetched session history
// + the currently-open program, but every formula/constant is unchanged.
import { buildCalMap } from '../build-program/calendar'

const PROG_RATE = 0.02
const AC_LO = 1.05
const AC_HI = 1.20

// Intensity wave within a week (High/Moderate/Light), normalized so the
// week's shares always sum to 1 — e.g. a 5-day week runs H M L M H.
export function dayShares(D) {
  const H = 1.0, M = 0.85, L = 0.7
  const patterns = { 1: [H], 2: [H, M], 3: [H, H, H], 4: [H, M, H, M], 5: [H, M, L, M, H], 6: [H, M, L, H, M, L] }
  let w = patterns[D]
  if (!w) {
    const cyc = [H, M, L]
    w = Array.from({ length: Math.max(1, D) }, (_, i) => cyc[i % 3])
  }
  const sum = w.reduce((a, b) => a + b, 0) || 1
  return w.map((x) => x / sum)
}

// Sums an athlete's logged session totals per resolved program week.
// `history` is [{date, total}] for that athlete (ASC per session,
// already resolved from floor_sessions/floor_logs by the caller).
// Dates that aren't a scheduled day for this program are skipped, same
// as the reference silently dropping sessionForDate errors.
export function athleteWeekTotals(history, program, exceptDate) {
  const days = (program.constraints || {}).days || {}
  const calMap = buildCalMap(program.start_date, days)
  const out = {}
  history.forEach(({ date, total }) => {
    if (date === exceptDate || !total) return
    const hit = calMap[date]
    if (!hit) return
    out[hit.week] = (out[hit.week] || 0) + total
  })
  return out
}

// Weekly workload target: week 1 is the flat calibration week at the
// assessed level; week 2+ progresses ~2%/week off the prior week,
// clamped to stay within 1.05-1.20x the trailing 4-week average
// (treating an unlogged week as zero, so a layoff drags the target
// down for a safe deload). The 4 weeks "before" the program are
// implicitly seeded at the assessed level via wkTotal(w<=0).
export function weekTargetTotal(psc, weekTotals, week, D) {
  const seedWeekly = psc * D
  if (week <= 1) return seedWeekly
  const wkTotal = (w) => {
    if (w <= 0) return seedWeekly
    if (weekTotals[w] != null) return weekTotals[w]
    if (w === 1) return seedWeekly
    return 0
  }
  const chronicW = (wkTotal(week - 4) + wkTotal(week - 3) + wkTotal(week - 2) + wkTotal(week - 1)) / 4
  if (chronicW <= 0) return seedWeekly
  const lastWeekTotal = wkTotal(week - 1)
  const target = lastWeekTotal * (1 + PROG_RATE)
  return Math.min(AC_HI * chronicW, Math.max(AC_LO * chronicW, target))
}

// Per-session PSC = the week's target split across days by the H/M/L wave.
export function progressedPSC(psc, weekTotals, week, dayIndex, D) {
  const T = weekTargetTotal(psc, weekTotals, week, D)
  const shares = dayShares(D)
  const i = dayIndex == null || dayIndex < 0 ? 0 : Math.min(dayIndex, shares.length - 1)
  return Math.round(T * shares[i] * 100) / 100
}
