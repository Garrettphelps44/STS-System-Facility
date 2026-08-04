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
    <form onSubmit={handleSubmit}>
      <h1>Sign in</h1>
      <label>
        Email
        <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label>
        Password
        <input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </label>
      {error && <p role="alert">{error}</p>}
      <button type="submit" disabled={submitting}>Sign in</button>
      <button type="button" onClick={onSwitchToSignUp}>Need an account? Create one</button>
    </form>
  )
}
