import { useState } from 'react'

const blank = { name: '', feet: '', inches: '', sport: '', sex: '' }

// Matches the reference's flPlayerModal (create-player-without-leaving-
// Floor-Log) — a coach standing on the floor with a walk-on shouldn't
// have to go to Tracker first.
export function AddPlayerModal({ onSave, onClose }) {
  const [form, setForm] = useState(blank)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    const name = form.name.trim()
    if (!name) return setError('Please enter a player name')
    const feet = form.feet === '' ? null : +form.feet
    const inches = form.inches === '' ? null : +form.inches
    if (feet != null && (isNaN(feet) || feet < 0 || feet > 9)) return setError('Please enter a valid feet value (0-9)')
    if (inches != null && (isNaN(inches) || inches < 0 || inches > 11)) return setError('Please enter a valid inches value (0-11)')
    setSaving(true)
    setError('')
    try {
      await onSave({ name, sport: form.sport, sex: form.sex, heightFeet: feet, heightInches: inches })
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div role="dialog" aria-modal="true" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div>
        <h3>Create Player</h3>
        {error && <p role="alert">{error}</p>}
        <div>
          <label>Name</label>
          <input autoFocus placeholder="Player name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        </div>
        <div>
          <label>Feet</label>
          <input type="number" min="0" max="9" placeholder="ft" value={form.feet} onChange={(e) => setForm((f) => ({ ...f, feet: e.target.value }))} />
          <label>Inches</label>
          <input type="number" min="0" max="11" placeholder="in" value={form.inches} onChange={(e) => setForm((f) => ({ ...f, inches: e.target.value }))} />
        </div>
        <div>
          <label>Sport</label>
          <input placeholder="e.g. Football" value={form.sport} onChange={(e) => setForm((f) => ({ ...f, sport: e.target.value }))} />
          <label>Sex</label>
          <select value={form.sex} onChange={(e) => setForm((f) => ({ ...f, sex: e.target.value }))}>
            <option value="">—</option>
            <option value="M">Male</option>
            <option value="F">Female</option>
          </select>
        </div>
        <div>
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="button" onClick={handleSave} disabled={saving}>Save Player</button>
        </div>
      </div>
    </div>
  )
}
