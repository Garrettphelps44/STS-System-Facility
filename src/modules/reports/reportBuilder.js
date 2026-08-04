// Pure computation, ported in spirit from reference/reference:Index.html's
// testsFor/attendanceFor/programFor/dailyPvaFor (~lines 4557-4642) — minus
// cultureFor (Culture is cut) and radarFor (cut per Garrett's call, this
// report stays a single page for a parent, not a coach dashboard).
//
// Used by BOTH the authenticated in-app view and the anonymous share-link
// view: the RPC that backs the share link returns the same raw-shaped
// data (test entries, attendance rows, floor session totals, one
// assessment) as the authenticated fetch, so there is exactly one place
// that turns raw rows into the report a parent reads — no duplicated math
// between the two paths.
import { metVal, metShow } from '../tracker/metrics'

export function computeTestsSection(entries, metrics) {
  if (!entries.length) return null
  const dates = [...new Set(entries.map((e) => e.date))].sort()
  const rows = metrics
    .map((m) => {
      const es = entries.filter((e) => e.metric_key === m.key).sort((a, b) => (a.date < b.date ? -1 : 1))
      if (!es.length) return null
      let first = null
      let last = null
      let best = null
      es.forEach((e) => {
        const v = metVal(m, e.value)
        if (v == null || isNaN(v)) return
        if (first == null) first = v
        last = v
        best = best == null ? v : (m.higher_is_better ? Math.max(best, v) : Math.min(best, v))
      })
      if (last == null) return null
      const chg = first != null ? last - first : null
      const dir = chg == null ? 'flat' : ((m.higher_is_better ? chg > 0 : chg < 0) ? 'up' : (chg === 0 ? 'flat' : 'down'))
      return {
        key: m.key,
        label: m.label,
        unit: m.unit,
        latest: metShow(m, last),
        best: metShow(m, best),
        change: chg == null || chg === 0 ? '—' : (chg > 0 ? '+' : '') + Math.round(chg * 100) / 100,
        dir,
      }
    })
    .filter(Boolean)
  if (!rows.length) return null
  return { count: dates.length, first: dates[0], last: dates[dates.length - 1], rows }
}

export function computeAttendanceSection(rows) {
  if (!rows.length) return null
  const sessions = rows.length
  const attended = rows.filter((r) => r.status === 'present' || r.status === 'late').length
  return { sessions, attended, pct: Math.round((attended / sessions) * 100) }
}

// floorSessions: [{date, projected, total}]. Adherence is the average of
// (actual ÷ planned) across every session that had a target — matches
// the reference's programFor exactly.
export function computeProgramSection(floorSessions) {
  if (!floorSessions.length) return null
  const sorted = [...floorSessions].sort((a, b) => (a.date < b.date ? -1 : 1))
  const withTarget = sorted.filter((s) => s.projected != null && s.projected > 0)
  const adherence = withTarget.length
    ? Math.round((withTarget.reduce((sum, r) => sum + r.total / r.projected, 0) / withTarget.length) * 100)
    : null
  return { sessions: sorted.length, adherence, latestTotal: sorted[sorted.length - 1].total }
}

export function computeTrainingLoad30(floorSessions) {
  const cutoff = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
  return floorSessions
    .filter((s) => s.date >= cutoff && (s.total || s.projected))
    .map((s) => ({ date: s.date, planned: s.projected || 0, actual: s.total || 0 }))
    .sort((a, b) => (a.date < b.date ? -1 : 1))
}

export function computeHistorySection(entries, metrics) {
  const dates = [...new Set(entries.map((e) => e.date))].sort()
  if (!dates.length) return null
  return {
    cols: metrics.map((m) => m.label),
    rows: dates.map((date) => ({
      date,
      cells: metrics.map((m) => {
        const e = entries.find((x) => x.date === date && x.metric_key === m.key)
        return e ? metShow(m, metVal(m, e.value)) : '—'
      }),
    })),
  }
}

export function buildReport(athlete, { entries, metrics, attendanceRows, floorSessions, assessment }) {
  return {
    name: athlete.name,
    sport: athlete.sport || '',
    sex: athlete.sex || '',
    generated: new Date().toISOString(),
    tests: computeTestsSection(entries, metrics),
    attendance: computeAttendanceSection(attendanceRows),
    program: computeProgramSection(floorSessions),
    trainingLoad30: computeTrainingLoad30(floorSessions),
    history: computeHistorySection(entries, metrics),
    assessment: assessment?.psc != null ? { psc: assessment.psc, assessedOn: assessment.assessed_on } : null,
  }
}
