import { useMemo, useState } from 'react'
import { flyMPH } from './metrics'

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function csvCell(s) {
  s = String(s)
  return /[,"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
}

// Dates come from whatever test_entries actually exist (no separate dates
// table), same source the old app used (tDates() scanning track.entries).
// "+ Add date" doesn't pre-insert empty rows the way the old blob model
// did (there's nothing to attach an empty row to in a normalized table
// without seeding null values that would immediately vanish under
// upsertEntry's "null = clear this cell" rule) — it just jumps the grid
// to that date, ready for input. The date only appears in the dropdown
// once a value is actually typed.
export function TestDatabase({ athletes, metrics, entries, onUpsertEntry, onAddMetric, onDeactivateMetric }) {
  const knownDates = useMemo(() => [...new Set(entries.map((e) => e.date))].sort(), [entries])
  const [selectedDate, setSelectedDate] = useState(knownDates[knownDates.length - 1] || '')
  const [newDateInput, setNewDateInput] = useState('')
  const [metricLabel, setMetricLabel] = useState('')
  const [metricUnit, setMetricUnit] = useState('')
  const [metricHigher, setMetricHigher] = useState('1')

  const activeMetrics = useMemo(() => metrics.filter((m) => m.active), [metrics])

  const dateOptions = useMemo(() => {
    const set = new Set(knownDates)
    if (selectedDate) set.add(selectedDate)
    return [...set].sort()
  }, [knownDates, selectedDate])

  function entryFor(athleteId, metricKey) {
    return entries.find((e) => e.athlete_id === athleteId && e.metric_key === metricKey && e.date === selectedDate)
  }

  async function handleCellChange(athleteId, metricKey, raw) {
    const value = raw === '' ? null : +raw
    await onUpsertEntry({ athleteId, metricKey, date: selectedDate, value })
  }

  function handleAddDate() {
    setSelectedDate(newDateInput || todayStr())
    setNewDateInput('')
  }

  async function handleAddMetric(e) {
    e.preventDefault()
    if (!metricLabel.trim()) return
    await onAddMetric({ label: metricLabel, unit: metricUnit, higher: metricHigher === '1' })
    setMetricLabel('')
    setMetricUnit('')
  }

  async function handleStopTracking(metric) {
    if (!window.confirm(`Stop tracking "${metric.label}"? Existing values stay saved but hidden.`)) return
    await onDeactivateMetric(metric.id)
  }

  function handleExport() {
    const byAthlete = new Map(athletes.map((a) => [a.id, a]))

    // Group entries by athlete+date so each CSV row carries every metric's
    // value together, matching the old app's one-row-per-athlete-per-date export.
    const rowsByKey = new Map()
    entries.forEach((e) => {
      if (!byAthlete.has(e.athlete_id)) return
      const k = e.athlete_id + '|' + e.date
      if (!rowsByKey.has(k)) rowsByKey.set(k, { athleteId: e.athlete_id, date: e.date, values: {} })
      rowsByKey.get(k).values[e.metric_key] = e.value
    })

    const head = ['Athlete', 'Sport', 'Sex', 'Date']
    activeMetrics.forEach((m) => {
      if (m.key === 'fly') head.push('Fly10_sec', 'Fly10_mph')
      else head.push((m.label || m.key).replace(/,/g, ''))
    })

    const csvRows = [head.join(',')]
    ;[...rowsByKey.values()]
      .sort((a, b) => (a.date < b.date ? -1 : 1))
      .forEach((row) => {
        const a = byAthlete.get(row.athleteId)
        const cols = [csvCell(a.name), csvCell(a.sport || ''), csvCell(a.sex || ''), row.date]
        activeMetrics.forEach((m) => {
          const v = row.values[m.key]
          if (m.key === 'fly') {
            const mph = flyMPH(v)
            cols.push(v ?? '', mph ? mph.toFixed(2) : '')
          } else {
            cols.push(v ?? '')
          }
        })
        csvRows.push(cols.join(','))
      })

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'sts-athlete-data.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <h2>Test Database</h2>
      <p className="sub">Pick a test date and log values. Flying 10 auto-converts to MPH. Tap a cell to edit.</p>

      <div className="panel" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 16 }}>
        <label className="field" style={{ marginBottom: 0 }}>
          <span className="lab">Test date</span>
          <select value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)}>
            {dateOptions.length === 0 && <option value="">— none —</option>}
            {dateOptions.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
        <input type="date" style={{ width: 'auto' }} value={newDateInput} onChange={(e) => setNewDateInput(e.target.value)} />
        <button className="btn ghost" type="button" onClick={handleAddDate}>
          + Add date
        </button>
        <button className="btn ghost" type="button" onClick={handleExport} style={{ marginLeft: 'auto' }}>
          ⬇ Export CSV
        </button>
      </div>

      <form className="panel" onSubmit={handleAddMetric} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 12 }}>
        <label className="field" style={{ marginBottom: 0 }}>
          <span className="lab">Add test</span>
          <input
            placeholder="Test name (e.g. Pro Agility)"
            value={metricLabel}
            onChange={(e) => setMetricLabel(e.target.value)}
          />
        </label>
        <input placeholder="Unit (s, in, lb)" style={{ width: 140 }} value={metricUnit} onChange={(e) => setMetricUnit(e.target.value)} />
        <select value={metricHigher} onChange={(e) => setMetricHigher(e.target.value)} style={{ width: 'auto' }}>
          <option value="1">Higher = better</option>
          <option value="0">Lower = better</option>
        </select>
        <button className="btn primary" type="submit">+ Track new test</button>
      </form>
      <p className="sub">Tap the ✕ on any column to stop tracking that test.</p>

      {athletes.length === 0 ? (
        <p className="sub">Add athletes on the Roster tab first.</p>
      ) : !selectedDate ? (
        <p className="sub">Add a test date to start logging.</p>
      ) : (
        <div className="panel" style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Athlete</th>
              {activeMetrics.map((m) => (
                <th key={m.key}>
                  {m.label}
                  {m.unit ? ` (${m.unit})` : ''}{' '}
                  <span role="button" style={{ cursor: 'pointer' }} title="Stop tracking this test" onClick={() => handleStopTracking(m)}>
                    ✕
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {athletes.map((a) => (
              <tr key={a.id}>
                <td>{a.name}</td>
                {activeMetrics.map((m) => {
                  const entry = entryFor(a.id, m.key)
                  const raw = entry?.value ?? ''
                  const mph = m.key === 'fly' ? flyMPH(entry?.value) : null
                  return (
                    <td key={m.key}>
                      <input
                        // Uncontrolled + keyed on the date: forces a remount
                        // (and a fresh defaultValue) whenever selectedDate
                        // changes, so switching dates doesn't leave stale
                        // values from the previous date sitting in the boxes.
                        key={selectedDate}
                        type="number"
                        step="any"
                        defaultValue={raw}
                        placeholder="—"
                        onBlur={(e) => handleCellChange(a.id, m.key, e.target.value)}
                      />
                      {mph != null && <span className="sub"> {mph.toFixed(2)} mph</span>}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
    </div>
  )
}
