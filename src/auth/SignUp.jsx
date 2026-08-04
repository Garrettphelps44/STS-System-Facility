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
      <div className="wrap" style={{ maxWidth: 420 }}>
        <div className="brandbar login-card">
          <div className="brandbar-left">
            <img className="logo-s" src="/logo-s.png" alt="STS logo" />
            <div className="name">STRENGTH THROUGH <span>SYSTEMS</span></div>
          </div>
        </div>
        <div className="panel">
          <p className="eyebrow">Almost there</p>
          <h2>Check your email</h2>
          <p className="sub">
            We sent a confirmation link to {email}. Once you confirm, sign in and
            your {mode === 'create' ? 'facility' : 'invite'} will be set up automatically.
          </p>
          <button className="btn ghost" type="button" onClick={onSwitchToSignIn}>Back to sign in</button>
        </div>
      </div>
    )
  }

  return (
    <div className="wrap" style={{ maxWidth: 420 }}>
      <div className="brandbar login-card">
        <div className="brandbar-left">
          <img className="logo-s" src="/logo-s.png" alt="STS logo" />
          <div className="name">STRENGTH THROUGH <span>SYSTEMS</span></div>
        </div>
      </div>
      <form className="panel" onSubmit={handleSubmit}>
        <p className="eyebrow">New Profile</p>
        <h2>Create your account</h2>
        <div role="radiogroup" aria-label="Signup type" style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
          <button className="btn ghost" type="button" aria-pressed={mode === 'create'} onClick={() => setMode('create')}>
            Start a new facility
          </button>
          <button className="btn ghost" type="button" aria-pressed={mode === 'join'} onClick={() => setMode('join')}>
            I have an invite code
          </button>
        </div>
        <label className="field">
          <span className="lab">Email</span>
          <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="field">
          <span className="lab">Password</span>
          <input type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {mode === 'create' ? (
          <label className="field">
            <span className="lab">Facility name</span>
            <input required value={facilityName} onChange={(e) => setFacilityName(e.target.value)} />
          </label>
        ) : (
          <label className="field">
            <span className="lab">Invite code</span>
            <input required value={inviteToken} onChange={(e) => setInviteToken(e.target.value)} />
          </label>
        )}
        {error && <p className="error-text" role="alert">{error}</p>}
        <button className="btn primary" type="submit" disabled={submitting}>Create account</button>
        <button className="btn ghost" type="button" onClick={onSwitchToSignIn} style={{ marginTop: 10 }}>Already have an account? Sign in</button>
      </form>
    </div>
  )
}
