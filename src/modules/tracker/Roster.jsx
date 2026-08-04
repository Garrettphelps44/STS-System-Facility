import { useState } from 'react'

const blankForm = { name: '', sport: '', sex: '', feet: '', inches: '', gradYear: '' }

function sexLabel(s) {
  return s === 'M' ? 'Male' : s === 'F' ? 'Female' : '—'
}

function heightLabel(a) {
  return a.height_feet != null || a.height_inches != null
    ? `${a.height_feet || 0}'${a.height_inches || 0}"`
    : '—'
}

export function Roster({ athletes, onAdd, onUpdate, onDelete }) {
  const [form, setForm] = useState(blankForm)
  const [submitting, setSubmitting] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState(null)

  async function handleAdd(e) {
    e.preventDefault()
    if (!form.name.trim()) return
    setSubmitting(true)
    try {
      await onAdd({
        name: form.name,
        sport: form.sport,
        sex: form.sex,
        gradYear: form.gradYear === '' ? null : +form.gradYear,
        heightFeet: form.feet === '' ? null : +form.feet,
        heightInches: form.inches === '' ? null : +form.inches,
      })
      setForm(blankForm)
    } finally {
      setSubmitting(false)
    }
  }

  function startEdit(a) {
    setEditingId(a.id)
    setEditForm({
      name: a.name,
      sport: a.sport || '',
      sex: a.sex || '',
      feet: a.height_feet ?? '',
      inches: a.height_inches ?? '',
      gradYear: a.grad_year ?? '',
    })
  }

  async function saveEdit(id) {
    const patch = {
      // Empty trimmed name keeps the old name rather than blanking it,
      // matching the old app's tRenderRoster save handler.
      name: editForm.name.trim() || athletes.find((a) => a.id === id).name,
      sport: editForm.sport.trim() || null,
      sex: editForm.sex || null,
      grad_year: editForm.gradYear === '' ? null : +editForm.gradYear,
      height_feet: editForm.feet === '' ? null : +editForm.feet,
      height_inches: editForm.inches === '' ? null : +editForm.inches,
    }
    await onUpdate(id, patch)
    setEditingId(null)
    setEditForm(null)
  }

  async function handleDelete(a) {
    // Not in the old app (its delete had no confirm), but added here
    // deliberately: in the old blob store this only edited an in-memory
    // array, where in the new schema it cascades a real, permanent delete
    // across that athlete's test_entries/floor_logs/attendance too.
    if (!window.confirm(`Delete ${a.name}? This also deletes all of their recorded tests.`)) return
    await onDelete(a.id)
  }

  return (
    <div>
      <h2>Roster</h2>
      <p>One athlete record — name, height, sport, sex — shared across the app. Enter once, use everywhere.</p>

      <form onSubmit={handleAdd}>
        <input
          placeholder="Athlete name"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        />
        <input
          placeholder="Sport (e.g. Football)"
          value={form.sport}
          onChange={(e) => setForm((f) => ({ ...f, sport: e.target.value }))}
        />
        <select value={form.sex} onChange={(e) => setForm((f) => ({ ...f, sex: e.target.value }))}>
          <option value="">Sex</option>
          <option value="M">Male</option>
          <option value="F">Female</option>
        </select>
        <input
          type="number"
          min="0"
          max="8"
          placeholder="ft"
          style={{ width: '58px' }}
          value={form.feet}
          onChange={(e) => setForm((f) => ({ ...f, feet: e.target.value }))}
        />
        <input
          type="number"
          min="0"
          max="11"
          placeholder="in"
          style={{ width: '58px' }}
          value={form.inches}
          onChange={(e) => setForm((f) => ({ ...f, inches: e.target.value }))}
        />
        <input
          type="number"
          placeholder="Grad year"
          style={{ width: '90px' }}
          value={form.gradYear}
          onChange={(e) => setForm((f) => ({ ...f, gradYear: e.target.value }))}
        />
        <button type="submit" disabled={submitting}>
          + Add
        </button>
      </form>
      <p>Height feeds the Strength Capacity math. Sport + sex drive the filters above.</p>

      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Sport</th>
            <th>Sex</th>
            <th>Height</th>
            <th>Grad Year</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {athletes.length === 0 && (
            <tr>
              <td colSpan={6}>No athletes yet — add one above.</td>
            </tr>
          )}
          {athletes.map((a) =>
            editingId === a.id ? (
              <tr key={a.id}>
                <td>
                  <input
                    style={{ width: '110px' }}
                    value={editForm.name}
                    onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  />
                </td>
                <td>
                  <input
                    style={{ width: '90px' }}
                    placeholder="Sport"
                    value={editForm.sport}
                    onChange={(e) => setEditForm((f) => ({ ...f, sport: e.target.value }))}
                  />
                </td>
                <td>
                  <select value={editForm.sex} onChange={(e) => setEditForm((f) => ({ ...f, sex: e.target.value }))}>
                    <option value="">—</option>
                    <option value="M">Male</option>
                    <option value="F">Female</option>
                  </select>
                </td>
                <td>
                  <input
                    type="number"
                    style={{ width: '42px' }}
                    placeholder="ft"
                    value={editForm.feet}
                    onChange={(e) => setEditForm((f) => ({ ...f, feet: e.target.value }))}
                  />
                  <input
                    type="number"
                    style={{ width: '42px' }}
                    placeholder="in"
                    value={editForm.inches}
                    onChange={(e) => setEditForm((f) => ({ ...f, inches: e.target.value }))}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    style={{ width: '70px' }}
                    value={editForm.gradYear}
                    onChange={(e) => setEditForm((f) => ({ ...f, gradYear: e.target.value }))}
                  />
                </td>
                <td>
                  <button type="button" onClick={() => saveEdit(a.id)} aria-label="Save">
                    ✓
                  </button>
                </td>
              </tr>
            ) : (
              <tr key={a.id}>
                <td>{a.name}</td>
                <td>{a.sport || '—'}</td>
                <td>{sexLabel(a.sex)}</td>
                <td>{heightLabel(a)}</td>
                <td>{a.grad_year ?? '—'}</td>
                <td>
                  <button type="button" onClick={() => startEdit(a)} aria-label="Edit" title="Edit">
                    ✎
                  </button>
                  <button type="button" onClick={() => handleDelete(a)} aria-label="Delete" title="Delete">
                    ✕
                  </button>
                </td>
              </tr>
            )
          )}
        </tbody>
      </table>
    </div>
  )
}
