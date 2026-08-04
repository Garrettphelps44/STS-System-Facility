import { useState } from 'react'
import { supabase } from '../lib/supabase'

export function SignIn({ onSwitchToSignUp }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    setSubmitting(false)
    if (signInError) setError(signInError.message)
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
        <p className="eyebrow">Sign In</p>
        <h2>Welcome back</h2>
        <label className="field">
          <span className="lab">Email</span>
          <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="field">
          <span className="lab">Password</span>
          <input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && <p className="error-text" role="alert">{error}</p>}
        <button className="btn primary" type="submit" disabled={submitting}>Sign in</button>
        <button className="btn ghost" type="button" onClick={onSwitchToSignUp} style={{ marginTop: 10 }}>Need an account? Create one</button>
      </form>
    </div>
  )
}
