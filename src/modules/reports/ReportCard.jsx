import { TrainingLoadChart } from './TrainingLoadChart'

function StatCard({ label, value }) {
  return (
    <div style={{ minWidth: '130px' }}>
      <div className="eyebrow" style={{ fontSize: '10.5px', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: '24px', fontWeight: 900 }}>{value}</div>
    </div>
  )
}

const DIR_COLOR = { up: 'var(--green)', down: 'var(--gold)', flat: 'var(--muted)' }

// Single continuous page, written for a parent reading it — plain
// language over coach jargon (no "ASC"/"PSC" labels, even though
// that's the math underneath). Reused as-is by both the authenticated
// in-app view and the anonymous share-link view.
export function ReportCard({ report, onPrint, onShare, shareUrl }) {
  const { name, sport, sex, generated, tests, attendance, program, trainingLoad30, history, assessment } = report

  return (
    <div style={{ maxWidth: 860 }}>
      <div className="brandbar" style={{ borderBottom: `2px solid var(--green)`, paddingBottom: 14, marginBottom: 18 }}>
        <div className="brandbar-left">
          <img className="logo-s" src="/logo-s.png" alt="STS logo" />
          <div>
            <div className="name">STRENGTH THROUGH <span>SYSTEMS</span></div>
            <div className="sub" style={{ margin: 0 }}>Athlete Report</div>
          </div>
        </div>
      </div>

      <div className="panel">
        <p className="eyebrow">{[sport, sex === 'M' ? 'Male' : sex === 'F' ? 'Female' : ''].filter(Boolean).join(' · ') || 'Athlete'}</p>
        <h2>{name}</h2>
        <p className="sub">Generated {new Date(generated).toLocaleDateString()}</p>
      </div>

      <div className="panel">
        <p className="eyebrow">Summary</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px' }}>
          <StatCard label="Tests logged" value={tests ? tests.count : 0} />
          <StatCard label="Attendance" value={attendance ? `${attendance.pct}%` : '—'} />
          <StatCard label="Training consistency" value={program?.adherence != null ? `${program.adherence}%` : '—'} />
          <StatCard label="Workouts completed" value={program ? program.sessions : '—'} />
          <StatCard label="Current strength benchmark" value={assessment ? assessment.psc.toFixed(1) : '—'} />
        </div>
      </div>

      <div className="panel">
        <p className="eyebrow">Testing — Personal Bests &amp; Trend</p>
        {tests ? (
          <>
            <table>
              <thead>
                <tr><th>Test</th><th>Latest</th><th>Best</th><th>Change</th></tr>
              </thead>
              <tbody>
                {tests.rows.map((r) => (
                  <tr key={r.key}>
                    <td>{r.label}</td>
                    <td>{r.latest}</td>
                    <td>{r.best}</td>
                    <td style={{ color: DIR_COLOR[r.dir], fontWeight: 800 }}>{r.change}{r.unit && r.change !== '—' ? ' ' + r.unit : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="sub" style={{ marginTop: 10, marginBottom: 0 }}>{tests.count} test date{tests.count !== 1 ? 's' : ''} · {tests.first} → {tests.last}</p>
          </>
        ) : (
          <p className="sub">No test data recorded yet.</p>
        )}
      </div>

      <div className="panel">
        <p className="eyebrow">Training Load — Last 30 Days</p>
        {trainingLoad30.length ? (
          <TrainingLoadChart data={trainingLoad30} />
        ) : (
          <p className="sub">No training sessions in the last 30 days.</p>
        )}
      </div>

      <div className="panel">
        <p className="eyebrow">Attendance</p>
        {attendance ? (
          <div style={{ display: 'flex', gap: '24px' }}>
            <StatCard label="Rate" value={`${attendance.pct}%`} />
            <StatCard label="Attended" value={attendance.attended} />
            <StatCard label="Sessions" value={attendance.sessions} />
          </div>
        ) : (
          <p className="sub">Not on any attendance roster yet.</p>
        )}
      </div>

      {history && (
        <div className="panel">
          <p className="eyebrow">Full Test History</p>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr><th>Date</th>{history.cols.map((c) => <th key={c}>{c}</th>)}</tr>
              </thead>
              <tbody>
                {history.rows.map((r) => (
                  <tr key={r.date}>
                    <td>{r.date}</td>
                    {r.cells.map((c, i) => <td key={i}>{c}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
        {onPrint && <button className="btn ghost" type="button" onClick={onPrint}>Print / Save PDF</button>}
        {onShare && <button className="btn primary" type="button" onClick={onShare}>Share link</button>}
      </div>
      {shareUrl && (
        <div style={{ marginTop: '8px' }}>
          <input readOnly value={shareUrl} onClick={(e) => e.target.select()} style={{ width: '100%' }} />
        </div>
      )}
    </div>
  )
}
