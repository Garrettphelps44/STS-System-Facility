import { useState } from 'react'
import { AuthProvider, useAuth } from './auth/AuthContext'
import { SignIn } from './auth/SignIn'
import { SignUp } from './auth/SignUp'
import { AppShell } from './app/AppShell'

function Gate() {
  const { session, membership, loading, bootstrapError } = useAuth()
  const [screen, setScreen] = useState(
    new URLSearchParams(window.location.search).has('invite') ? 'signup' : 'signin'
  )

  if (loading) return <p>Loading…</p>

  if (!session) {
    return screen === 'signin' ? (
      <SignIn onSwitchToSignUp={() => setScreen('signup')} />
    ) : (
      <SignUp onSwitchToSignIn={() => setScreen('signin')} />
    )
  }

  if (bootstrapError) {
    return <p role="alert">Could not finish setting up your account: {bootstrapError}</p>
  }

  if (!membership) {
    return <p>Setting up your account…</p>
  }

  return <AppShell />
}

function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  )
}

export default App
