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
      <div className="panel" style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
        <span className="sub">
          System <b style={{ color: 'var(--white)' }}>{sys.name}</b>
        </span>
        <span className="sub">
          <b style={{ color: 'var(--white)' }}>{draft.sessionLength}</b> min
        </span>
        <span className="sub">
          <b style={{ color: 'var(--white)' }}>{activeDays.length}</b> days/wk
        </span>
        <span className="sub">
          Skill <b style={{ color: 'var(--white)' }}>{skillLabel}</b>
        </span>
        <span className="sub">
          <b style={{ color: 'var(--white)' }}>{draft.sport}</b>
        </span>
        <span className="sub">
          <b style={{ color: 'var(--white)' }}>52</b> weeks
        </span>
      </div>

      <div className="panel">
        <button className="btn ghost" type="button" aria-expanded={methodOpen} onClick={() => setMethodOpen((o) => !o)}>
          {sys.name} <b>{sys.tag}</b> {methodOpen ? '–' : '+'}
        </button>
        {methodOpen && (
          <div style={{ marginTop: 12 }}>
            <p className="sub">{sys.intro}</p>
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
      </div>

      <div className="panel" style={{ display: 'flex', flexWrap: 'wrap', gap: 24 }}>
        <label className="field" style={{ flex: 1, minWidth: 200, marginBottom: 0 }}>
          <span className="lab">Program</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <select value={draft.id || ''} onChange={(e) => onLoadProgram(e.target.value)}>
              {!draft.id && <option value="">{draft.name} (unsaved)</option>}
              {programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <button className="btn ghost" type="button" onClick={onNewProgram}>
              ＋ New
            </button>
          </div>
        </label>
        <label className="field" style={{ marginBottom: 0 }}>
          <span className="lab">Start</span>
          <input type="date" value={draft.startDate || ''} onChange={(e) => onSaveStartDate(e.target.value || mondayISO())} />
        </label>
      </div>

      <div className="sub" style={{ display: 'flex', gap: 16, margin: '0 0 12px' }}>
        <span style={{ color: '#3b82f6', fontWeight: 700 }}>● Lifting</span>
        <span style={{ color: '#f59e0b', fontWeight: 700 }}>● Conditioning</span>
        <span style={{ color: '#a855f7', fontWeight: 700 }}>● Both</span>
      </div>

      {!draft.startDate ? (
        <p className="sub">Pick a start date to build the calendar.</p>
      ) : (
        <div className="panel" style={{ overflowX: 'auto' }}>
          <table className="cal-table">
            <colgroup>
              <col />
              <col span={37} />
            </colgroup>
            <thead>
              <tr>
                <th>{monthGrid[0]?.year}</th>
                {Array.from({ length: 37 }, (_, i) => CAL_WDL[i % 7]).map((d, i) => (
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
                          <button className="btn" type="button" aria-pressed={cell.key === openDateKey} data-type={cell.hit.type} onClick={() => setOpenDateKey(cell.key)}>
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

      <button className="btn primary" type="button" style={{ marginTop: 12 }} onClick={() => window.print()}>
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
