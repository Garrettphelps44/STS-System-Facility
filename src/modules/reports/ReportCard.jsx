import { TrainingLoadChart } from './TrainingLoadChart'

function StatCard({ label, value }) {
  return (
    <div style={{ minWidth: '120px' }}>
      <div style={{ fontSize: '11px', color: '#6b6b6b' }}>{label}</div>
      <div style={{ fontSize: '20px', fontWeight: 600 }}>{value}</div>
    </div>
  )
}

const DIR_COLOR = { up: '#0ca30c', down: '#d03b3b', flat: '#6b6b6b' }

// Single continuous page, written for a parent reading it — plain
// language over coach jargon (no "ASC"/"PSC" labels, even though
// that's the math underneath). Reused as-is by both the authenticated
// in-app view and the anonymous share-link view.
export function ReportCard({ report, onPrint, onShare, shareUrl }) {
  const { name, sport, sex, generated, tests, attendance, program, trainingLoad30, history, assessment } = report

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderBottom: '2px solid #13BE17', paddingBottom: '10px' }}>
        <div>
          <h2 style={{ margin: 0 }}>{name}</h2>
          <div style={{ fontSize: '13px', color: '#6b6b6b' }}>
            {[sport, sex === 'M' ? 'Male' : sex === 'F' ? 'Female' : ''].filter(Boolean).join(' · ') || 'Athlete'}
            {' · Generated ' + new Date(generated).toLocaleDateString()}
          </div>
        </div>
        <div style={{ fontSize: '12px', fontWeight: 700, textAlign: 'right' }}>STRENGTH THROUGH SYSTEMS<br /><span style={{ fontWeight: 400 }}>Athlete Report</span></div>
      </div>

      <h3>Summary</h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px' }}>
        <StatCard label="Tests logged" value={tests ? tests.count : 0} />
        <StatCard label="Attendance" value={attendance ? `${attendance.pct}%` : '—'} />
        <StatCard label="Training consistency" value={program?.adherence != null ? `${program.adherence}%` : '—'} />
        <StatCard label="Workouts completed" value={program ? program.sessions : '—'} />
        <StatCard label="Current strength benchmark" value={assessment ? assessment.psc.toFixed(1) : '—'} />
      </div>

      <h3>Testing — Personal Bests &amp; Trend</h3>
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
                  <td style={{ color: DIR_COLOR[r.dir] }}>{r.change}{r.unit && r.change !== '—' ? ' ' + r.unit : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ fontSize: '12px', color: '#6b6b6b' }}>{tests.count} test date{tests.count !== 1 ? 's' : ''} · {tests.first} → {tests.last}</p>
        </>
      ) : (
        <p>No test data recorded yet.</p>
      )}

      <h3>Training Load — Last 30 Days</h3>
      {trainingLoad30.length ? (
        <TrainingLoadChart data={trainingLoad30} />
      ) : (
        <p>No training sessions in the last 30 days.</p>
      )}

      <h3>Attendance</h3>
      {attendance ? (
        <div style={{ display: 'flex', gap: '20px' }}>
          <StatCard label="Rate" value={`${attendance.pct}%`} />
          <StatCard label="Attended" value={attendance.attended} />
          <StatCard label="Sessions" value={attendance.sessions} />
        </div>
      ) : (
        <p>Not on any attendance roster yet.</p>
      )}

      {history && (
        <>
          <h3>Full Test History</h3>
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
        </>
      )}

      <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
        {onPrint && <button type="button" onClick={onPrint}>Print / Save PDF</button>}
        {onShare && <button type="button" onClick={onShare}>Share link</button>}
      </div>
      {shareUrl && (
        <div style={{ marginTop: '8px' }}>
          <input readOnly value={shareUrl} onClick={(e) => e.target.select()} style={{ width: '100%' }} />
        </div>
      )}
    </div>
  )
}
