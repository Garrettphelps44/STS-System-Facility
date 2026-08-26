import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../auth/AuthContext'
import * as api from './trackerApi'
import { Roster } from './Roster'
import { TestDatabase } from './TestDatabase'
import { Leaderboards } from './Leaderboards'

const SUBTABS = [
  { key: 'roster', label: 'Roster' },
  { key: 'db', label: 'Test Database' },
  { key: 'dash', label: 'Leaderboards' },
]

// The Sport/Sex filter bar sits above all three subtabs (same structural
// placement as the old #trackFilterBar) and scopes all three, including
// Roster — a coach filtered to one sport only sees/adds/edits that sport's
// athletes; switching back to "All sports" shows everyone again.
export function TrackerModule() {
  const { membership } = useAuth()
  const facilityId = membership.facilityId

  const [subtab, setSubtab] = useState('roster')
  const [athletes, setAthletes] = useState([])
  const [metrics, setMetrics] = useState([])
  const [entries, setEntries] = useState([])
  const [filter, setFilter] = useState({ sport: '', sex: '' })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refreshAthletes = useCallback(async () => setAthletes(await api.fetchAthletes(facilityId)), [facilityId])
  const refreshMetrics = useCallback(async () => setMetrics(await api.fetchMetrics(facilityId)), [facilityId])
  const refreshEntries = useCallback(async () => setEntries(await api.fetchEntries(facilityId)), [facilityId])

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      setError('')
      try {
        const [a, m, e] = await Promise.all([
          api.fetchAthletes(facilityId),
          api.ensureDefaultMetrics(facilityId),
          api.fetchEntries(facilityId),
        ])
        if (!active) return
        setAthletes(a)
        setMetrics(m)
        setEntries(e)
      } catch (err) {
        if (active) setError(err.message)
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [facilityId])

  const sports = useMemo(
    () => [...new Set(athletes.map((a) => (a.sport || '').trim()).filter(Boolean))].sort(),
    [athletes]
  )

  const filteredAthletes = useMemo(
    () =>
      athletes.filter(
        (a) => (!filter.sport || a.sport === filter.sport) && (!filter.sex || a.sex === filter.sex)
      ),
    [athletes, filter]
  )

  async function handleReset() {
    if (!window.confirm('Clear all athletes, tests, and floor logs? Your built program stays.')) return
    await api.resetRoster(facilityId)
    await Promise.all([refreshAthletes(), refreshEntries()])
  }

  if (loading) return <p className="sub">Loading roster…</p>
  if (error) return <p className="error-text" role="alert">{error}</p>

  return (
    <div>
      <p className="eyebrow">Tracker</p>
      <div role="tablist" style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        {SUBTABS.map((t) => (
          <button className="btn" key={t.key} type="button" aria-current={t.key === subtab} onClick={() => setSubtab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {(() => {
        const filterBar = (
          <div className="panel" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 16 }}>
            <label className="field" style={{ marginBottom: 0 }}>
              <span className="lab">View</span>
              <select value={filter.sport} onChange={(e) => setFilter((f) => ({ ...f, sport: e.target.value }))}>
                <option value="">All sports</option>
                {sports.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="field" style={{ marginBottom: 0 }}>
              <span className="lab">Sex</span>
              <select value={filter.sex} onChange={(e) => setFilter((f) => ({ ...f, sex: e.target.value }))}>
                <option value="">All athletes</option>
                <option value="M">Male</option>
                <option value="F">Female</option>
              </select>
            </label>
            <span className="sub">
              {filter.sport || filter.sex
                ? `Showing ${filteredAthletes.length} of ${athletes.length}`
                : `${athletes.length} athlete${athletes.length !== 1 ? 's' : ''}`}
            </span>
          </div>
        )

        if (subtab !== 'roster') return filterBar

        // Roster only: filter bar and the roster sit side by side on the
        // same line instead of stacked, each keeping its own panel border
        // (filterBar's border, Roster's own form/table panel borders) —
        // Garrett's call, doesn't apply to Test Database/Leaderboards.
        return (
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 16 }}>
            <div style={{ flex: '0 0 260px' }}>{filterBar}</div>
            <div style={{ flex: '1 1 480px', minWidth: 0 }}>
              <Roster
                athletes={filteredAthletes}
                onAdd={async (input) => {
                  await api.addAthlete(facilityId, input)
                  await refreshAthletes()
                }}
                onUpdate={async (id, patch) => {
                  await api.updateAthlete(id, patch)
                  await refreshAthletes()
                }}
                onDelete={async (id) => {
                  await api.deleteAthlete(id)
                  await Promise.all([refreshAthletes(), refreshEntries()])
                }}
              />
            </div>
          </div>
        )
      })()}

      {subtab === 'db' && (
        <TestDatabase
          athletes={filteredAthletes}
          allAthletes={athletes}
          metrics={metrics}
          entries={entries}
          onUpsertEntry={async (input) => {
            await api.upsertEntry(facilityId, input)
            await refreshEntries()
          }}
          onAddMetric={async (input) => {
            await api.addMetric(facilityId, input)
            await refreshMetrics()
          }}
          onDeactivateMetric={async (id) => {
            await api.deactivateMetric(id)
            await refreshMetrics()
          }}
        />
      )}

      {subtab === 'dash' && <Leaderboards athletes={filteredAthletes} metrics={metrics} entries={entries} />}

      <div style={{ textAlign: 'right', marginTop: '14px' }}>
        <button className="btn ghost" type="button" onClick={handleReset}>
          Reset tracker data
        </button>
      </div>
    </div>
  )
}
