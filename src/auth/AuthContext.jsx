import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// Stashes the intent behind a signup ('create a facility' vs 'join one via
// invite token') across the gap between auth.signUp() and the moment a real
// session exists — which, if email confirmation is on, isn't until the user
// clicks the link in their inbox and comes back to sign in. See runPendingSignup.
const PENDING_KEY = 'sts_pending_signup'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [membership, setMembership] = useState(null)
  const [loading, setLoading] = useState(true)
  const [bootstrapError, setBootstrapError] = useState(null)

  const loadMembership = useCallback(async (userId) => {
    const { data, error } = await supabase
      .from('facility_members')
      .select('facility_id, role, athlete_id')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle()
    if (error) {
      console.error('loadMembership failed', error)
      return null
    }
    return data
      ? { facilityId: data.facility_id, role: data.role, athleteId: data.athlete_id }
      : null
  }, [])

  // Runs the signup intent stashed by SignUp.jsx, once a session actually
  // exists. Only fires when the user has no membership yet, so it can't
  // re-fire (or fire for the wrong facility) once someone is already set up.
  const runPendingSignup = useCallback(async () => {
    const raw = localStorage.getItem(PENDING_KEY)
    if (!raw) return
    let pending
    try {
      pending = JSON.parse(raw)
    } catch {
      localStorage.removeItem(PENDING_KEY)
      return
    }
    try {
      if (pending.type === 'create') {
        await supabase.rpc('create_facility', { p_name: pending.name })
      } else if (pending.type === 'join') {
        await supabase.rpc('redeem_invite', { p_token: pending.token })
      }
      localStorage.removeItem(PENDING_KEY)
    } catch (err) {
      setBootstrapError(err.message)
    }
  }, [])

  const resolveSession = useCallback(async (nextSession) => {
    setSession(nextSession)
    if (!nextSession) {
      setMembership(null)
      return
    }
    let m = await loadMembership(nextSession.user.id)
    if (!m && localStorage.getItem(PENDING_KEY)) {
      await runPendingSignup()
      m = await loadMembership(nextSession.user.id)
    }
    setMembership(m)
  }, [loadMembership, runPendingSignup])

  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!active) return
      await resolveSession(session)
      if (active) setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      resolveSession(nextSession)
    })

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [resolveSession])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setMembership(null)
  }, [])

  const refreshMembership = useCallback(async () => {
    if (!session) return
    setMembership(await loadMembership(session.user.id))
  }, [session, loadMembership])

  return (
    <AuthContext.Provider
      value={{ session, membership, loading, bootstrapError, signOut, refreshMembership }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export { PENDING_KEY }
