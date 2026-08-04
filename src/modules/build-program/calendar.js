// Ported as-is from reference/52weekprogram.html (lines 905-958) — the
// annual calendar's date math. Split out of the DOM-building code since
// this app renders it as React state instead of innerHTML.

import { DAYS, addDays, fmtISO, isoToDate } from './constants'
import { codeLetter } from './engine/session'

export const MON3 = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
export const CAL_WDL = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
export const DOW3 = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// Maps every ISO date over the 52-week span to {code, type, week, di} for
// each active training day.
export function buildCalMap(startISO, days) {
  const map = {}
  if (!startISO) return map
  const start = isoToDate(startISO)
  const startMon = addDays(start, -((start.getDay() + 6) % 7)) // Monday of the start week
  const activeDayNames = DAYS.filter((d) => days[d])
  activeDayNames.forEach((dayName, ord) => {
    const wd = DAYS.indexOf(dayName)
    const code = codeLetter(ord)
    const type = days[dayName]
    for (let w = 1; w <= 52; w++) {
      map[fmtISO(addDays(startMon, (w - 1) * 7 + wd))] = { code, type, week: w, di: ord }
    }
  })
  return map
}

// Builds the month-by-month 37-column grid the calendar table renders.
export function buildMonthGrid(startISO, calMap) {
  if (!startISO) return []
  const start = isoToDate(startISO)
  const startMon = addDays(start, -((start.getDay() + 6) % 7))
  const firstMonth = new Date(startMon.getFullYear(), startMon.getMonth(), 1)
  const lastDate = addDays(startMon, 51 * 7 + 6)
  const lastMonth = new Date(lastDate.getFullYear(), lastDate.getMonth(), 1)
  const months = []
  let cur = new Date(firstMonth)
  let first = true
  while (cur <= lastMonth) {
    const y = cur.getFullYear(), mo = cur.getMonth()
    const offset = (new Date(y, mo, 1).getDay() + 6) % 7
    const dim = new Date(y, mo + 1, 0).getDate()
    const showYr = mo === 0 && !first
    first = false
    const cells = []
    for (let c = 0; c < 37; c++) {
      const day = c - offset + 1
      if (day < 1 || day > dim) {
        cells.push(null)
        continue
      }
      const key = fmtISO(new Date(y, mo, day))
      cells.push({ day, key, hit: calMap[key] || null })
    }
    months.push({ label: MON3[mo], showYr, year: y, cells })
    cur = new Date(y, mo + 1, 1)
  }
  return months
}
