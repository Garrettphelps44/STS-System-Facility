import { typeLabel } from './engine/session'

// Ported as-is from reference/52weekprogram.html (modalHTML/sessionHTML,
// lines 944-1024) — renders one resolved day's full session.
export function SessionModal({ session, dayName, dateLabel, weekNumber, onClose }) {
  if (!session) return null
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div>
            <p className="eyebrow" style={{ marginBottom: 2 }}>{dateLabel}</p>
            <h2 style={{ fontSize: 16 }}>
              Week {weekNumber} · Session {session.code} · {typeLabel(session.type)}
            </h2>
          </div>
          <button className="btn ghost" type="button" onClick={onClose}>
            Close
          </button>
        </div>

        <div style={{ display: 'flex', gap: 16, marginBottom: 16 }} className="sub">
          <span>{session.code}</span>
          <span>
            {dayName} · {typeLabel(session.type)}
          </span>
          <span>{session.total} min</span>
        </div>

        {session.blocks.map((b, i) => (
          <div key={i} style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, marginBottom: 6 }}>
              <span>{b.label}</span>
              <span className="sub">{b.time} min</span>
            </div>
            {b.ideas ? (
              <p className="sub">{b.ideas.join(' · ')}</p>
            ) : (
              <table>
                <tbody>
                  {b.rows.map((r, j) => (
                    <tr key={j}>
                      <td>{r.purpose}</td>
                      <td>{r.ex}</td>
                      <td style={r.prog ? { color: 'var(--green)' } : undefined}>{r.vol}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
