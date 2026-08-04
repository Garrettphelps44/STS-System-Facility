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

// Roster is intentionally NOT filtered — matches the old app (tRenderRoster
// always renders every athlete; only Test Database and Leaderboards read
// through filteredAthletes()). The filter bar itself stays visible across
// all three subtabs regardless, same structural placement as the old
// #trackFilterBar sitting above all three .subpage divs.
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

  if (loading) return <p>Loading roster…</p>
  if (error) return <p role="alert">{error}</p>

  return (
    <div>
      <div role="tablist">
        {SUBTABS.map((t) => (
          <button key={t.key} type="button" aria-current={t.key === subtab} onClick={() => setSubtab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      <div>
        <label>
          View
          <select value={filter.sport} onChange={(e) => setFilter((f) => ({ ...f, sport: e.target.value }))}>
            <option value="">All sports</option>
            {sports.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <select value={filter.sex} onChange={(e) => setFilter((f) => ({ ...f, sex: e.target.value }))}>
          <option value="">All athletes</option>
          <option value="M">Male</option>
          <option value="F">Female</option>
        </select>
        <span>
          {filter.sport || filter.sex
            ? `Showing ${filteredAthletes.length} of ${athletes.length}`
            : `${athletes.length} athlete${athletes.length !== 1 ? 's' : ''}`}
        </span>
      </div>

      {subtab === 'roster' && (
        <Roster
          athletes={athletes}
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
      )}

      {subtab === 'db' && (
        <TestDatabase
          athletes={filteredAthletes}
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
        <button type="button" onClick={handleReset}>
          Reset tracker data
        </button>
      </div>
    </div>
  )
}
