// Ported from reference/reference:Index.html's mode-att module (~lines
// 3396-3517) — the STSAtt data-layer math and the week/month grouping
// logic for the grid. No points/notes: those were cut (see Step 25
// requirements pass — STATUS_PTS drove only Culture's now-cut scoring,
// notes had no schema home and were cut too).

const MONTH_NAMES = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'June', 'July', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec']

export function normalizeName(s) {
  return String(s || '').toLowerCase().trim().replace(/\s+/g, ' ')
}

export function findAthleteByName(athletes, name) {
  const n = normalizeName(name)
  return athletes.find((a) => normalizeName(a.name) === n) || null
}

// Attendance marks belong to a team (an athlete on two teams has separate
// marks for each), so every per-team number below is computed from
// forTeam(records, team.id), never from the facility-wide list.
export function forTeam(records, teamId) {
  return records.filter((r) => r.team_id === teamId)
}

// Every attendance row IS a logged status (the check constraint only
// allows the four real values), so "sessions" is just the row count for
// that athlete — no separate empty-string bookkeeping needed like the
// reference.
export function athleteStats(records, athleteId) {
  const mine = records.filter((r) => r.athlete_id === athleteId)
  const sessions = mine.length
  const attended = mine.filter((r) => r.status === 'present' || r.status === 'late').length
  const pct = sessions ? Math.round((attended / sessions) * 100) : 0
  return { sessions, attended, pct }
}

// null = nobody on the team has a record for this date yet ("empty" cell
// in the reference); a number (incl. 0) means at least one status was set.
export function presentCount(records, memberIds, date) {
  let any = false
  let cnt = 0
  memberIds.forEach((aid) => {
    const r = records.find((x) => x.athlete_id === aid && x.date === date)
    if (r) { any = true; if (r.status === 'present') cnt++ }
  })
  return any ? cnt : null
}

export function dateTotal(records, teams, date) {
  let sum = 0
  let any = false
  teams.forEach((t) => {
    const c = presentCount(forTeam(records, t.id), t.members, date)
    if (c !== null) { sum += c; any = true }
  })
  return any ? sum : null
}

export function distinctDates(records) {
  return [...new Set(records.map((r) => r.date))].sort()
}

export function parseISO(iso) {
  const p = String(iso).split('-').map(Number)
  return new Date(p[0], (p[1] || 1) - 1, p[2] || 1)
}

export function monthName(iso) {
  return MONTH_NAMES[+String(iso).split('-')[1]] || ''
}

export function dispDate(iso) {
  const p = String(iso).split('-')
  return p.length === 3 ? `${+p[1]}/${+p[2]}` : iso
}

function isoOf(dt) {
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

export function todayISO() {
  return isoOf(new Date())
}

export function addDaysISO(iso, n) {
  const dt = parseISO(iso)
  dt.setDate(dt.getDate() + n)
  return isoOf(dt)
}

// Weeks run Sunday–Saturday, matching the reference. Returns that week's
// Sunday as an ISO date — the key the grid uses for "which week".
export function weekStart(iso) {
  const dt = parseISO(iso)
  dt.setDate(dt.getDate() - dt.getDay())
  return isoOf(dt)
}

export function formatWeekRange(dates) {
  const a = parseISO(dates[0])
  const b = parseISO(dates[dates.length - 1])
  const sm = monthName(dates[0])
  const em = monthName(dates[dates.length - 1])
  return sm === em ? `${sm} ${a.getDate()}–${b.getDate()}` : `${sm} ${a.getDate()} – ${em} ${b.getDate()}`
}

export function weekLabel(startISO) {
  return formatWeekRange([startISO, addDaysISO(startISO, 6)])
}

// The weeks the grid's ◀ ▶ arrows step through: every week that has at
// least one date, plus the current week, oldest first. Empty weeks in
// between are skipped so going back a season isn't one click per week.
export function navigableWeeks(dates, today = todayISO()) {
  return [...new Set([...dates.map(weekStart), weekStart(today)])].sort()
}
