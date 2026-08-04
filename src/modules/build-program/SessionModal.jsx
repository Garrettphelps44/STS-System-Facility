import { typeLabel } from './engine/session'

// Ported as-is from reference/52weekprogram.html (modalHTML/sessionHTML,
// lines 944-1024) — renders one resolved day's full session.
export function SessionModal({ session, dayName, dateLabel, weekNumber, onClose }) {
  if (!session) return null
  return (
    <div role="dialog" aria-modal="true">
      <div>
        <div>{dateLabel}</div>
        <div>
          Week {weekNumber} · Session {session.code} · {typeLabel(session.type)}
        </div>
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>

      <div>
        <span>{session.code}</span>
        <span>
          {dayName} · {typeLabel(session.type)}
        </span>
        <span>{session.total} min</span>
      </div>

      {session.blocks.map((b, i) => (
        <div key={i}>
          <div>
            <span>{b.label}</span>
            <span>{b.time} min</span>
          </div>
          {b.ideas ? (
            <p>{b.ideas.join(' · ')}</p>
          ) : (
            <table>
              <tbody>
                {b.rows.map((r, j) => (
                  <tr key={j}>
                    <td>{r.purpose}</td>
                    <td>{r.ex}</td>
                    <td style={r.prog ? { color: 'var(--green, #13BE17)' } : undefined}>{r.vol}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ))}
    </div>
  )
}
