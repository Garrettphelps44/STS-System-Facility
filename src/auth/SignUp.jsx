import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { PENDING_KEY } from './AuthContext'

export function SignUp({ onSwitchToSignIn }) {
  const [mode, setMode] = useState(
    new URLSearchParams(window.location.search).has('invite') ? 'join' : 'create'
  )
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [facilityName, setFacilityName] = useState('')
  const [inviteToken, setInviteToken] = useState(
    new URLSearchParams(window.location.search).get('invite') || ''
  )
  const [error, setError] = useState('')
  const [pendingConfirm, setPendingConfirm] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (mode === 'create' && !facilityName.trim()) {
      setError('Enter a facility name.')
      return
    }
    if (mode === 'join' && !inviteToken.trim()) {
      setError('Enter your invite code.')
      return
    }

    // Stashed before signUp() so it survives even if email confirmation
    // means there's no session yet to act on — AuthContext picks this up
    // the moment a real session appears. See AuthContext.runPendingSignup.
    const pending =
      mode === 'create'
        ? { type: 'create', name: facilityName.trim() }
        : { type: 'join', token: inviteToken.trim() }
    localStorage.setItem(PENDING_KEY, JSON.stringify(pending))

    setSubmitting(true)
    const { data, error: signUpError } = await supabase.auth.signUp({ email, password })
    setSubmitting(false)

    if (signUpError) {
      localStorage.removeItem(PENDING_KEY)
      setError(signUpError.message)
      return
    }

    if (!data.session) {
      setPendingConfirm(true)
    }
    // If a session came back immediately (email confirmation off),
    // AuthContext's onAuthStateChange listener runs the pending action —
    // nothing else to do here.
  }

  if (pendingConfirm) {
    return (
      <div>
        <h1>Check your email</h1>
        <p>
          We sent a confirmation link to {email}. Once you confirm, sign in and
          your {mode === 'create' ? 'facility' : 'invite'} will be set up automatically.
        </p>
        <button type="button" onClick={onSwitchToSignIn}>Back to sign in</button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit}>
      <h1>Create your account</h1>
      <div role="radiogroup" aria-label="Signup type">
        <button type="button" aria-pressed={mode === 'create'} onClick={() => setMode('create')}>
          Start a new facility
        </button>
        <button type="button" aria-pressed={mode === 'join'} onClick={() => setMode('join')}>
          I have an invite code
        </button>
      </div>
      <label>
        Email
        <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label>
        Password
        <input type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </label>
      {mode === 'create' ? (
        <label>
          Facility name
          <input required value={facilityName} onChange={(e) => setFacilityName(e.target.value)} />
        </label>
      ) : (
        <label>
          Invite code
          <input required value={inviteToken} onChange={(e) => setInviteToken(e.target.value)} />
        </label>
      )}
      {error && <p role="alert">{error}</p>}
      <button type="submit" disabled={submitting}>Create account</button>
      <button type="button" onClick={onSwitchToSignIn}>Already have an account? Sign in</button>
    </form>
  )
}
