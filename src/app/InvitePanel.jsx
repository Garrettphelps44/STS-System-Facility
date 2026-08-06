import { useState } from 'react'
import { supabase } from '../lib/supabase'

// Owner/coach only — AppShell doesn't render this for the athlete role.
// An athlete invite needs an athletes row to pin the login to (there's no
// Tracker/roster module yet to create one ahead of time), so this creates
// that row itself when the role is 'athlete'. It isn't a roster feature —
// just enough to make an athlete invite valid.
//
// Rendered as a modal (same .modal-overlay/.modal-panel pattern as
// SessionModal etc.), triggered from a compact button in the brandbar
// rather than sitting inline at the bottom of every module page.
export function InvitePanel({ facilityId, onClose, onCreated }) {
  const [role, setRole] = useState('coach')
  const [athleteName, setAthleteName] = useState('')
  const [link, setLink] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleCreate(e) {
    e.preventDefault()
    setError('')
    setLink('')

    if (role === 'athlete' && !athleteName.trim()) {
      setError("Enter the athlete's name.")
      return
    }

    setSubmitting(true)
    try {
      let athleteId = null
      if (role === 'athlete') {
        const { data: athlete, error: athleteError } = await supabase
          .from('athletes')
          .insert({ facility_id: facilityId, name: athleteName.trim() })
          .select('id')
          .single()
        if (athleteError) throw athleteError
        athleteId = athlete.id
      }

      const { data: invite, error: inviteError } = await supabase
        .from('invites')
        .insert({ facility_id: facilityId, role, athlete_id: athleteId })
        .select('token')
        .single()
      if (inviteError) throw inviteError

      setLink(`${window.location.origin}${window.location.pathname}?invite=${invite.token}`)
      setAthleteName('')
      onCreated?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay no-print" role="dialog" aria-modal="true">
      <form className="modal-panel" onSubmit={handleCreate}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div>
            <p className="eyebrow" style={{ marginBottom: 2 }}>Team</p>
            <h2 style={{ fontSize: 16 }}>Invite someone</h2>
          </div>
          <button className="btn ghost" type="button" onClick={onClose}>Close</button>
        </div>
        <label className="field">
          <span className="lab">Role</span>
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="coach">Coach</option>
            <option value="athlete">Athlete</option>
          </select>
        </label>
        {role === 'athlete' && (
          <label className="field">
            <span className="lab">Athlete name</span>
            <input value={athleteName} onChange={(e) => setAthleteName(e.target.value)} />
          </label>
        )}
        {error && <p className="error-text" role="alert">{error}</p>}
        <button className="btn primary" type="submit" disabled={submitting}>Generate invite link</button>
        {link && (
          <p className="sub">
            Share this link (expires in 14 days): <code>{link}</code>
          </p>
        )}
      </form>
    </div>
  )
}
