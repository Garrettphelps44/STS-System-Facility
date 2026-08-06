import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import * as brandingApi from '../modules/branding/brandingApi'
import { applyBrandingVars } from '../theme/applyBranding'

// Stashes the intent behind a signup ('create a facility' vs 'join one via
// invite token') across the gap between auth.signUp() and the moment a real
// session exists — which, if email confirmation is on, isn't until the user
// clicks the link in their inbox and comes back to sign in. See runPendingSignup.
const PENDING_KEY = 'sts_pending_signup'

// Which of a user's several facility_members rows is "active" — per-user
// because the same browser could see different logins over time.
const currentFacilityKey = (userId) => `sts_current_facility:${userId}`

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [memberships, setMemberships] = useState([])
  const [currentFacilityId, setCurrentFacilityId] = useState(null)
  const [branding, setBranding] = useState(null)
  const [loading, setLoading] = useState(true)
  const [bootstrapError, setBootstrapError] = useState(null)

  const membership = currentFacilityId
    ? memberships.find((m) => m.facilityId === currentFacilityId) ?? null
    : null

  // Every row this login belongs to, not just one — a user can be owner of
  // their own facility and coach/owner at any number of client facilities.
  const loadMemberships = useCallback(async (userId) => {
    const { data, error } = await supabase
      .from('facility_members')
      .select('facility_id, role, athlete_id, facilities(name)')
      .eq('user_id', userId)
    if (error) {
      console.error('loadMemberships failed', error)
      return []
    }
    return (data ?? []).map((row) => ({
      facilityId: row.facility_id,
      role: row.role,
      athleteId: row.athlete_id,
      facilityName: row.facilities?.name ?? 'Facility',
    }))
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

  // Picks which facility should be active: whatever this login last had
  // selected, if that membership still exists, otherwise just the first one.
  const pickCurrentFacility = useCallback((userId, rows) => {
    if (rows.length === 0) return null
    const stored = localStorage.getItem(currentFacilityKey(userId))
    return rows.some((r) => r.facilityId === stored) ? stored : rows[0].facilityId
  }, [])

  const resolveSession = useCallback(async (nextSession) => {
    setSession(nextSession)
    if (!nextSession) {
      setMemberships([])
      setCurrentFacilityId(null)
      return
    }
    let rows = await loadMemberships(nextSession.user.id)
    if (rows.length === 0 && localStorage.getItem(PENDING_KEY)) {
      await runPendingSignup()
      rows = await loadMemberships(nextSession.user.id)
    }
    setMemberships(rows)
    setCurrentFacilityId(pickCurrentFacility(nextSession.user.id, rows))
  }, [loadMemberships, runPendingSignup, pickCurrentFacility])

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

  const loadBranding = useCallback(async (facilityId) => {
    if (!facilityId) return null
    try {
      return await brandingApi.fetchBranding(facilityId)
    } catch (err) {
      console.error('loadBranding failed', err)
      return null
    }
  }, [])

  // Keyed on currentFacilityId, not on login — this is what makes the
  // Phase 5 facility switcher and Phase 5.5 branding interact correctly:
  // switching facilities re-fires this and repaints --green/--green-dim
  // for whichever facility is now active. currentFacilityId going to
  // null on sign-out resets to the STS default the same way.
  useEffect(() => {
    let active = true
    loadBranding(currentFacilityId).then((b) => {
      if (!active) return
      setBranding(b)
      applyBrandingVars(b)
    })
    return () => { active = false }
  }, [currentFacilityId, loadBranding])

  const refreshBranding = useCallback(async () => {
    const b = await loadBranding(currentFacilityId)
    setBranding(b)
    applyBrandingVars(b)
  }, [currentFacilityId, loadBranding])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setMemberships([])
    setCurrentFacilityId(null)
  }, [])

  // Re-reads this login's membership rows without touching which facility
  // is currently active (unless that one no longer exists — e.g. removed).
  const refreshMemberships = useCallback(async () => {
    if (!session) return
    const rows = await loadMemberships(session.user.id)
    setMemberships(rows)
    setCurrentFacilityId((prev) =>
      rows.some((r) => r.facilityId === prev) ? prev : (rows[0]?.facilityId ?? null)
    )
  }, [session, loadMemberships])

  const switchFacility = useCallback((facilityId) => {
    if (!session) return
    if (!memberships.some((m) => m.facilityId === facilityId)) return
    localStorage.setItem(currentFacilityKey(session.user.id), facilityId)
    setCurrentFacilityId(facilityId)
  }, [session, memberships])

  return (
    <AuthContext.Provider
      value={{
        session,
        membership,
        memberships,
        switchFacility,
        branding,
        refreshBranding,
        loading,
        bootstrapError,
        signOut,
        refreshMembership: refreshMemberships,
      }}
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
