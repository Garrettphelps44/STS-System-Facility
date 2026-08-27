import { useEffect, useMemo, useRef, useState } from 'react'
import { flyMPH } from './metrics'

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function csvCell(s) {
  s = String(s)
  return /[,"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
}

function cellKey(athleteId, metricKey) {
  return athleteId + '|' + metricKey
}

// Test Database is a deliberate session, not a live-editing spreadsheet:
// nothing shows until you pick who you're testing (a sport/sex filter
// above, specific athletes below, or a past test date to review), you
// enter values freely, then Save commits them and clears the screen —
// Garrett's call, so the grid never sits there half-filled from a
// previous session. Cells are uncontrolled and only read (via cellRefs)
// at Save time; nothing persists on blur anymore.
export function TestDatabase({ athletes, allAthletes, filterActive, filterKey, metrics, entries, onUpsertEntry, onAddMetric, onDeactivateMetric }) {
  const knownDates = useMemo(() => [...new Set(entries.map((e) => e.date))].sort(), [entries])
  const [selectedDate, setSelectedDate] = useState(todayStr())
  const [newDateInput, setNewDateInput] = useState('')
  const [metricLabel, setMetricLabel] = useState('')
  const [metricUnit, setMetricUnit] = useState('')
  const [metricHigher, setMetricHigher] = useState('1')
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')

  // Ad-hoc testing group: pick specific athletes across sport/sex lines
  // (e.g. 5 kids from 5 different teams getting a vertical retest today)
  // instead of the Sport/Sex filter bar's whole-group scoping above.
  const [testGroupIds, setTestGroupIds] = useState([])
  const [groupQuery, setGroupQuery] = useState('')
  const [showGroupOptions, setShowGroupOptions] = useState(false)

  // Blanks the grid after a Save/Cancel until a new, deliberate selection
  // is made (a different date, a changed sport/sex filter, or picking
  // another individual athlete) — see the handlers below, each of which
  // flips this back to false. Without this, re-showing "whoever has an
  // entry on the selected date" would immediately re-reveal the athletes
  // you just saved, since they now have an entry on that very date.
  const [justSaved, setJustSaved] = useState(false)

  // Live fly-10 mph hint as you type, without persisting anything —
  // purely a client-side computed display, doesn't touch the deferred-
  // save behavior for the actual value.
  const [flyLive, setFlyLive] = useState({})

  const cellRefs = useRef(new Map())

  const activeMetrics = useMemo(() => metrics.filter((m) => m.active), [metrics])
  const groupSearchPool = allAthletes || athletes

  useEffect(() => { setJustSaved(false) }, [filterKey])

  const groupOptions = useMemo(() => {
    const t = groupQuery.toLowerCase()
    return groupSearchPool.filter((a) => !testGroupIds.includes(a.id) && a.name.toLowerCase().includes(t))
  }, [groupSearchPool, testGroupIds, groupQuery])

  function addToTestGroup(id) {
    setTestGroupIds((cur) => (cur.includes(id) ? cur : [...cur, id]))
    setGroupQuery('')
    setJustSaved(false)
  }
  function removeFromTestGroup(id) {
    setTestGroupIds((cur) => cur.filter((x) => x !== id))
  }

  function selectDate(date) {
    setSelectedDate(date)
    setTestGroupIds([])
    setJustSaved(false)
    setNotice('')
  }

  const athletesWithEntriesOnDate = useMemo(() => {
    const ids = new Set(entries.filter((e) => e.date === selectedDate && e.value != null).map((e) => e.athlete_id))
    return groupSearchPool.filter((a) => ids.has(a.id))
  }, [entries, selectedDate, groupSearchPool])

  const displayAthletes = useMemo(() => {
    if (justSaved) return []
    const ids = new Set()
    athletesWithEntriesOnDate.forEach((a) => ids.add(a.id))
    testGroupIds.forEach((id) => ids.add(id))
    if (filterActive) athletes.forEach((a) => ids.add(a.id))
    return groupSearchPool.filter((a) => ids.has(a.id))
  }, [justSaved, athletesWithEntriesOnDate, testGroupIds, filterActive, athletes, groupSearchPool])

  const isReviewingHistory = athletesWithEntriesOnDate.length > 0 && !justSaved

  const dateOptions = useMemo(() => {
    const set = new Set(knownDates)
    set.add(todayStr())
    set.add(selectedDate)
    return [...set].sort()
  }, [knownDates, selectedDate])

  function entryFor(athleteId, metricKey) {
    return entries.find((e) => e.athlete_id === athleteId && e.metric_key === metricKey && e.date === selectedDate)
  }

  function handleAddDate() {
    selectDate(newDateInput || todayStr())
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

  async function handleSave() {
    setSaving(true)
    setNotice('')
    try {
      const updates = []
      displayAthletes.forEach((a) => {
        activeMetrics.forEach((m) => {
          const input = cellRefs.current.get(cellKey(a.id, m.key))
          if (!input) return
          const raw = input.value
          const existing = entryFor(a.id, m.key)
          const newValue = raw === '' ? null : +raw
          const oldValue = existing?.value ?? null
          if (newValue !== oldValue) updates.push({ athleteId: a.id, metricKey: m.key, date: selectedDate, value: newValue })
        })
      })
      if (updates.length) await Promise.all(updates.map(onUpsertEntry))
      setTestGroupIds([])
      setFlyLive({})
      setJustSaved(true)
      setNotice(updates.length ? `Saved ${updates.length} value${updates.length !== 1 ? 's' : ''}.` : 'Nothing to save.')
    } catch (err) {
      setNotice('Error: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  function handleCancel() {
    setTestGroupIds([])
    setFlyLive({})
    setJustSaved(true)
    setNotice('')
  }

  function handleExport() {
    const byAthlete = new Map(groupSearchPool.map((a) => [a.id, a]))

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
      <p className="sub">
        Pick a sport/sex group above, search specific athletes below, or choose a past test date to review it.
        Nothing shows until you do. Enter values, then Save.
      </p>

      <div className="panel" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 16 }}>
        <label className="field" style={{ marginBottom: 0 }}>
          <span className="lab">Test date</span>
          <select value={selectedDate} onChange={(e) => selectDate(e.target.value)}>
            {dateOptions.map((d) => (
              <option key={d} value={d}>
                {d}{knownDates.includes(d) ? ' (has data)' : ''}
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

      <div className="panel" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 16 }}>
        <label className="field" style={{ flex: '1 1 260px', minWidth: 220, marginBottom: 0, position: 'relative' }}>
          <span className="lab">Test specific athletes (any sport/sex)</span>
          <input
            placeholder="Search a name to add…"
            autoComplete="off"
            value={groupQuery}
            onFocus={() => setShowGroupOptions(true)}
            onChange={(e) => { setGroupQuery(e.target.value); setShowGroupOptions(true) }}
            onBlur={() => setTimeout(() => setShowGroupOptions(false), 200)}
          />
          {showGroupOptions && (
            <div className="panel" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, padding: 8, maxHeight: 220, overflowY: 'auto' }}>
              {!groupOptions.length && <div className="sub">No matching athletes</div>}
              {groupOptions.map((a) => (
                <div key={a.id} onMouseDown={(e) => { e.preventDefault(); addToTestGroup(a.id) }} style={{ padding: '8px 6px', cursor: 'pointer' }}>
                  {a.name}{a.sport ? <small className="sub"> — {a.sport}</small> : null}
                </div>
              ))}
            </div>
          )}
        </label>
        {testGroupIds.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', flex: '1 1 260px' }}>
            {testGroupIds.map((id) => {
              const a = groupSearchPool.find((x) => x.id === id)
              if (!a) return null
              return (
                <span key={id} className="btn ghost btn-small" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'default' }}>
                  {a.name}
                  <span role="button" style={{ cursor: 'pointer' }} title="Remove from test group" onClick={() => removeFromTestGroup(id)}>✕</span>
                </span>
              )
            })}
          </div>
        )}
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

      {notice && <p className="sub">{notice}</p>}

      {displayAthletes.length === 0 ? (
        <p className="sub">No athletes selected — pick a sport/sex filter above, search specific athletes above, or choose a past test date to review it.</p>
      ) : (
        <>
          {isReviewingHistory && <p className="sub">Reviewing {selectedDate} — editing here updates that day's saved values.</p>}
          <div className="panel" style={{ overflowX: 'auto' }}>
          <table className="table-compact">
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
              {displayAthletes.map((a, rowIndex) => (
                <tr key={a.id}>
                  <td>{a.name}</td>
                  {activeMetrics.map((m, colIndex) => {
                    const entry = entryFor(a.id, m.key)
                    const raw = entry?.value ?? ''
                    const mph = m.key === 'fly' ? flyMPH(flyLive[a.id] !== undefined ? flyLive[a.id] : entry?.value) : null
                    return (
                      <td key={m.key}>
                        <input
                          // Uncontrolled + keyed on the date/athlete-set: forces
                          // a remount (and a fresh defaultValue) whenever the
                          // session changes, so switching dates/groups doesn't
                          // leave stale unsaved values sitting in the boxes.
                          // Nothing persists until Save reads these via ref.
                          key={selectedDate + '|' + displayAthletes.length}
                          ref={(el) => {
                            if (el) cellRefs.current.set(cellKey(a.id, m.key), el)
                            else cellRefs.current.delete(cellKey(a.id, m.key))
                          }}
                          type="number"
                          step="any"
                          defaultValue={raw}
                          placeholder="—"
                          onChange={m.key === 'fly' ? (e) => setFlyLive((cur) => ({ ...cur, [a.id]: e.target.value })) : undefined}
                          onKeyDown={(e) => {
                            // Spreadsheet-style arrow navigation: Up/Down
                            // moves within this test's column (same
                            // metric, next/prev athlete); Left/Right
                            // moves within this athlete's row (same
                            // athlete, next/prev test). preventDefault is
                            // required even with step="any" — some
                            // browsers still treat Up/Down on a number
                            // input as an increment/decrement spinner
                            // otherwise. Left/Right jump unconditionally
                            // rather than only at the text-cursor's edge
                            // (the usual spreadsheet nuance) because
                            // number inputs don't expose selectionStart/
                            // End consistently across browsers — the
                            // tradeoff is you can't arrow sideways to
                            // edit mid-value, only retype or click in.
                            const isVertical = e.key === 'ArrowDown' || e.key === 'ArrowUp'
                            const isHorizontal = e.key === 'ArrowLeft' || e.key === 'ArrowRight'
                            if (!isVertical && !isHorizontal) return
                            e.preventDefault()
                            let targetInput
                            if (isVertical) {
                              const targetAthlete = displayAthletes[rowIndex + (e.key === 'ArrowDown' ? 1 : -1)]
                              if (!targetAthlete) return
                              targetInput = cellRefs.current.get(cellKey(targetAthlete.id, m.key))
                            } else {
                              const targetMetric = activeMetrics[colIndex + (e.key === 'ArrowRight' ? 1 : -1)]
                              if (!targetMetric) return
                              targetInput = cellRefs.current.get(cellKey(a.id, targetMetric.key))
                            }
                            if (targetInput) { targetInput.focus(); targetInput.select() }
                          }}
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
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button className="btn primary" type="button" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button className="btn ghost" type="button" onClick={handleCancel} disabled={saving}>
              Cancel
            </button>
          </div>
        </>
      )}
    </div>
  )
}
