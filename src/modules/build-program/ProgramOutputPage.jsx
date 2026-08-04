import { useMemo, useState } from 'react'
import { SYS } from './engine/systems'
import { resolveSession } from './engine/session'
import { buildCalMap, buildMonthGrid, CAL_WDL, MON3, DOW3 } from './calendar'
import { DAYS, SKILLS, isoToDate, mondayISO } from './constants'
import { SessionModal } from './SessionModal'

// Ported as-is from reference/52weekprogram.html (viewProgram, lines
// 960-1024) — pills, method-info panel, program switcher, calendar, and
// the day-click session modal.
export function ProgramOutputPage({ draft, programs, onLoadProgram, onNewProgram, onSaveStartDate }) {
  const [methodOpen, setMethodOpen] = useState(false)
  const [openDateKey, setOpenDateKey] = useState(null)

  const sys = SYS[draft.system] || SYS.sts
  const activeDays = DAYS.filter((d) => draft.days[d])
  const skillLabel = SKILLS.find((s) => s[0] === draft.skill)?.[1] || draft.skill

  const cx = {
    system: draft.system, sessionLength: draft.sessionLength,
    equipment: draft.equipment, skill: draft.skill, sport: draft.sport,
  }

  const calMap = useMemo(() => buildCalMap(draft.startDate, draft.days), [draft.startDate, draft.days])
  const monthGrid = useMemo(() => buildMonthGrid(draft.startDate, calMap), [draft.startDate, calMap])

  const openInfo = openDateKey ? calMap[openDateKey] : null
  const openSession = openInfo ? resolveSession(openInfo.week, openInfo.di, openInfo.type, cx) : null
  const openDt = openDateKey ? isoToDate(openDateKey) : null
  const openDayName = openDt ? DAYS[(openDt.getDay() + 6) % 7] : null
  const openDateLabel = openDt
    ? `${DOW3[openDt.getDay()]}, ${MON3[openDt.getMonth()]} ${openDt.getDate()} '${String(openDt.getFullYear()).slice(2)}`
    : null

  return (
    <div>
      <div>
        <span>
          System <b>{sys.name}</b>
        </span>
        <span>
          <b>{draft.sessionLength}</b> min
        </span>
        <span>
          <b>{activeDays.length}</b> days/wk
        </span>
        <span>
          Skill <b>{skillLabel}</b>
        </span>
        <span>
          <b>{draft.sport}</b>
        </span>
        <span>
          <b>52</b> weeks
        </span>
      </div>

      <button type="button" aria-expanded={methodOpen} onClick={() => setMethodOpen((o) => !o)}>
        {sys.name} <b>{sys.tag}</b> {methodOpen ? '–' : '+'}
      </button>
      {methodOpen && (
        <div>
          <p>{sys.intro}</p>
          <table>
            <tbody>
              <tr>
                <td>Principle</td>
                <td>{sys.layout.principle}</td>
              </tr>
              <tr>
                <td>How load moves</td>
                <td>{sys.layout.loading}</td>
              </tr>
              <tr>
                <td>Exercise rotation</td>
                <td>{sys.layout.rotation}</td>
              </tr>
              <tr>
                <td>Best for</td>
                <td>{sys.layout.bestFor}</td>
              </tr>
              <tr>
                <td>Common mistake</td>
                <td>{sys.layout.mistake}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <div>
        <span>Program</span>
        <select value={draft.id || ''} onChange={(e) => onLoadProgram(e.target.value)}>
          {!draft.id && <option value="">{draft.name} (unsaved)</option>}
          {programs.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <button type="button" onClick={onNewProgram}>
          ＋ New
        </button>
      </div>
      <div>
        <span>Start</span>
        <input type="date" value={draft.startDate || ''} onChange={(e) => onSaveStartDate(e.target.value || mondayISO())} />
      </div>

      <div>
        <span>Lifting</span>
        <span>Conditioning</span>
        <span>Both</span>
      </div>

      {!draft.startDate ? (
        <p>Pick a start date to build the calendar.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table>
            <colgroup>
              <col />
              <col span={37} />
            </colgroup>
            <thead>
              <tr>
                <th>{monthGrid[0]?.year}</th>
                {CAL_WDL.map((d, i) => (
                  <th key={i}>{d}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {monthGrid.map((row, ri) => (
                <tr key={ri}>
                  <td>
                    {row.label}
                    {row.showYr ? " '" + String(row.year).slice(2) : ''}
                  </td>
                  {row.cells.map((cell, ci) =>
                    !cell ? (
                      <td key={ci} />
                    ) : (
                      <td key={ci}>
                        {cell.hit ? (
                          <button type="button" data-type={cell.hit.type} onClick={() => setOpenDateKey(cell.key)}>
                            <span>{cell.day}</span>
                            <span>{cell.hit.code}</span>
                          </button>
                        ) : (
                          <span>{cell.day}</span>
                        )}
                      </td>
                    )
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <button type="button" className="noprint" onClick={() => window.print()}>
        Print program
      </button>

      {openSession && (
        <SessionModal
          session={openSession}
          dayName={openDayName}
          dateLabel={openDateLabel}
          weekNumber={openInfo.week}
          onClose={() => setOpenDateKey(null)}
        />
      )}
    </div>
  )
}
