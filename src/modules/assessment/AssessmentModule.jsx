import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../auth/AuthContext'
import * as trackerApi from '../tracker/trackerApi'
import * as api from './assessmentApi'
import { ASSESS_MOVES, computePSC } from './assessMoves'
import { AddPlayerModal } from '../floor-log/AddPlayerModal'

function playerLabel(a) {
  return a ? a.name + (a.height_feet != null ? ` — ${a.height_feet}'${a.height_inches || 0}"` : '') : ''
}

export function AssessmentModule() {
  const { membership } = useAuth()
  const facilityId = membership.facilityId

  const [athletes, setAthletes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [query, setQuery] = useState('')
  const [showOptions, setShowOptions] = useState(false)
  const [activeId, setActiveId] = useState(null)
  const [showAddPlayer, setShowAddPlayer] = useState(false)

  const [assessment, setAssessment] = useState(null)
  const [weightInputs, setWeightInputs] = useState({})
  const [assessLoading, setAssessLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')

  const refreshAthletes = async () => setAthletes(await trackerApi.fetchAthletes(facilityId))

  useEffect(() => {
    let active = true
    trackerApi.fetchAthletes(facilityId)
      .then((a) => { if (active) { setAthletes(a); setLoading(false) } })
      .catch((err) => { if (active) { setError(err.message); setLoading(false) } })
    return () => { active = false }
  }, [facilityId])

  const activeAthlete = useMemo(() => athletes.find((a) => a.id === activeId) || null, [athletes, activeId])
  const filteredAthletes = useMemo(() => {
    const t = query.toLowerCase()
    return athletes.filter((a) => a.name.toLowerCase().includes(t))
  }, [athletes, query])

  function setActivePlayer(id) {
    setActiveId(id)
    const a = athletes.find((x) => x.id === id)
    setQuery(playerLabel(a))
  }

  useEffect(() => {
    if (!activeAthlete) { setAssessment(null); setWeightInputs({}); return }
    let active = true
    setAssessLoading(true)
    setNotice('')
    api.fetchAssessment(facilityId, activeAthlete.id)
      .then((a) => {
        if (!active) return
        setAssessment(a)
        const w = {}
        ASSESS_MOVES.forEach((m) => { w[m.key] = a?.weights?.[m.key] ?? '' })
        setWeightInputs(w)
      })
      .catch((err) => active && setError(err.message))
      .finally(() => active && setAssessLoading(false))
    return () => { active = false }
  }, [activeAthlete, facilityId])

  async function handleCompute() {
    if (!activeAthlete) return
    if (activeAthlete.height_feet == null) { setNotice("Set the player's height in the Roster first — the PSC math needs it."); return }
    const weights = {}
    Object.entries(weightInputs).forEach(([key, v]) => { if (v !== '') weights[key] = +v })
    const psc = computePSC(weights, activeAthlete.height_feet, activeAthlete.height_inches)
    if (psc == null) { setNotice('Enter at least one working weight.'); return }
    setSaving(true)
    setNotice('')
    try {
      const assessedOn = new Date().toISOString().slice(0, 10)
      const saved = await api.saveAssessment(facilityId, activeAthlete.id, { psc, weights, refPerDay: 5, assessedOn })
      setAssessment(saved)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p>Loading Assessment…</p>
  if (error) return <p role="alert">{error}</p>

  return (
    <div>
      <h2>Assessment</h2>
      <p>Pick a player, enter a hard-but-completable working weight for each movement, then Compute. This sets the player's PSC and lets Floor Log auto-fill it and auto-prescribe weights to hit it.</p>

      <div>
        <label>Player</label>
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <input
            placeholder="Select player…"
            autoComplete="off"
            value={query}
            onFocus={() => { setQuery(''); setShowOptions(true) }}
            onChange={(e) => { setQuery(e.target.value); setShowOptions(true) }}
            onBlur={() => setTimeout(() => { setShowOptions(false); setQuery(playerLabel(activeAthlete)) }, 200)}
          />
          {showOptions && (
            <div>
              {!filteredAthletes.length && <div>No players — tap + Add Player</div>}
              {filteredAthletes.map((a) => (
                <div key={a.id} onMouseDown={(e) => { e.preventDefault(); setShowOptions(false); setActivePlayer(a.id) }}>
                  {a.name} <small>{a.height_feet != null ? `${a.height_feet}'${a.height_inches || 0}"` : 'no ht'}</small>
                </div>
              ))}
            </div>
          )}
        </div>
        <button type="button" onClick={() => setShowAddPlayer(true)}>+ Add Player</button>
      </div>

      {showAddPlayer && (
        <AddPlayerModal
          onClose={() => setShowAddPlayer(false)}
          onSave={async (input) => {
            const a = await trackerApi.addAthlete(facilityId, input)
            await refreshAthletes()
            setShowAddPlayer(false)
            setActivePlayer(a.id)
          }}
        />
      )}

      {!activeAthlete && <p>Pick a player to begin — or add one.</p>}

      {activeAthlete && assessLoading && <p>Loading assessment…</p>}

      {activeAthlete && !assessLoading && (
        <div>
          {activeAthlete.height_feet == null && <p>Set {activeAthlete.name}'s height in the Roster (Tracker) — the PSC math needs it.</p>}
          <div>
            PSC <b>{assessment?.psc != null ? Number(assessment.psc).toFixed(2) : '—'}</b>
            <span> {activeAthlete.name} · {activeAthlete.height_feet != null ? `${activeAthlete.height_feet}'${activeAthlete.height_inches || 0}"` : 'no height'}{assessment?.assessed_on ? ` · assessed ${assessment.assessed_on}` : ''}</span>
          </div>

          <table>
            <thead>
              <tr><th>Movement</th><th>Reps</th><th>Working Weight (lbs)</th></tr>
            </thead>
            <tbody>
              {ASSESS_MOVES.map((m) => (
                <tr key={m.key}>
                  <td>{m.label}</td>
                  <td>{m.reps}</td>
                  <td>
                    <input
                      type="number"
                      step="5"
                      min="0"
                      inputMode="numeric"
                      placeholder="lbs"
                      value={weightInputs[m.key] ?? ''}
                      onChange={(e) => setWeightInputs((w) => ({ ...w, [m.key]: e.target.value }))}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {notice && <p role="alert">{notice}</p>}
          <button type="button" onClick={handleCompute} disabled={saving}>Compute &amp; Save PSC</button>
          {assessment?.psc != null && (
            <p>PSC saved for <b>{activeAthlete.name}</b>: {Number(assessment.psc).toFixed(2)}. Floor Log will auto-fill this PSC and prescribe weights to hit it.</p>
          )}
        </div>
      )}
    </div>
  )
}
