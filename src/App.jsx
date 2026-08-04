import { useState } from 'react'
import { AuthProvider, useAuth } from './auth/AuthContext'
import { SignIn } from './auth/SignIn'
import { SignUp } from './auth/SignUp'
import { AppShell } from './app/AppShell'
import { SharedReportPage } from './modules/reports/SharedReportPage'

function Gate() {
  const { session, membership, loading, bootstrapError } = useAuth()
  const [screen, setScreen] = useState(
    new URLSearchParams(window.location.search).has('invite') ? 'signup' : 'signin'
  )

  if (loading) return <p className="wrap sub">Loading…</p>

  if (!session) {
    return screen === 'signin' ? (
      <SignIn onSwitchToSignUp={() => setScreen('signup')} />
    ) : (
      <SignUp onSwitchToSignIn={() => setScreen('signin')} />
    )
  }

  if (bootstrapError) {
    return <p className="wrap error-text" role="alert">Could not finish setting up your account: {bootstrapError}</p>
  }

  if (!membership) {
    return <p className="wrap sub">Setting up your account…</p>
  }

  return <AppShell />
}

// A share link opens #report=<token> — checked before AuthProvider even
// mounts, so an anonymous visitor never touches the authenticated app
// shell or session state at all, only the one RPC the token is good for.
function App() {
  const sharedToken = window.location.hash.match(/^#report=(.+)$/)?.[1]
  if (sharedToken) return <SharedReportPage token={decodeURIComponent(sharedToken)} />

  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  )
}

export default App
