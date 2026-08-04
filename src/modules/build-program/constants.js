import { equipmentFromCats } from './engine/pool'

// Ported as-is from reference/52weekprogram.html (lines 206-211).
export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
export const SKILLS = [['none', 'None', '0–6 mo'], ['low', 'Low', '6mo–1yr'], ['med', 'Med', '1–2 yr'], ['high', 'High', '2+ yr']]
export const LENGTHS = [30, 45, 60, 75, 90]
export const SPORTS = [
  'Football', 'Basketball', 'Soccer', 'Volleyball', 'Wrestling', 'Track & Field',
  'Cross Country', 'Lacrosse', 'Tennis', 'Swimming', 'Golf', 'General Athlete',
]

export function mondayISO() {
  const t = new Date()
  const r = new Date(t)
  r.setDate(r.getDate() - ((t.getDay() + 6) % 7))
  return fmtISO(r)
}
export function fmtISO(dt) {
  return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0')
}
export function isoToDate(iso) {
  const p = (iso || '').split('-').map(Number)
  return new Date(p[0] || 2026, (p[1] || 1) - 1, p[2] || 1)
}
export function addDays(dt, n) {
  const r = new Date(dt)
  r.setDate(r.getDate() + n)
  return r
}

// Matches reference/52weekprogram.html's own default `C` object (line
// 222-232) exactly, including its default cats list — derived through
// equipmentFromCats rather than hand-picked booleans, so every category
// button that should show as selected on first load actually does.
export const DEFAULT_CONSTRAINTS = {
  system: 'sts',
  sessionLength: 60,
  equipment: equipmentFromCats(['rack', 'db', 'bench', 'cable', 'bar', 'box', 'mb', 'band']),
  days: { Mon: 'lifting', Tue: 'lifting', Thu: 'lifting', Fri: 'lifting' },
  skill: 'med',
  sport: 'General Athlete',
}
