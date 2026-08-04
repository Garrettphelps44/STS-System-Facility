import { useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { InvitePanel } from './InvitePanel'

const MODES = ['build', 'assess', 'att', 'floor', 'track', 'reports']
const MODE_LABELS = {
  build: 'Build Program',
  assess: 'Assessment',
  att: 'Attendance',
  floor: 'Floor Log',
  track: 'Tracker',
  reports: 'Reports',
}

// Role-based routing per the rebuild plan: owner/coach see every mode,
// athlete lands on (and is confined to) Reports. This is a UX gate, not
// the real security boundary — the real one is the RLS policies from
// Phase 2, already proven in isolation_test.sql. This just makes sure an
// athlete can't even navigate to a mode whose data they can't read.
export function AppShell() {
  const { membership, signOut } = useAuth()
  const isAthlete = membership.role === 'athlete'
  const visibleModes = isAthlete ? ['reports'] : MODES
  const [mode, setMode] = useState(isAthlete ? 'reports' : 'build')
  const activeMode = visibleModes.includes(mode) ? mode : 'reports'

  return (
    <div>
      <header>
        <span>STS Facility — signed in as {membership.role}</span>
        <button type="button" onClick={signOut}>Sign out</button>
      </header>

      <nav>
        {visibleModes.map((m) => (
          <button
            key={m}
            type="button"
            aria-current={m === activeMode}
            onClick={() => setMode(m)}
          >
            {MODE_LABELS[m]}
          </button>
        ))}
      </nav>

      <main>
        <p>{MODE_LABELS[activeMode]} — not built yet (Phase 4).</p>

        {!isAthlete && <InvitePanel facilityId={membership.facilityId} />}
      </main>
    </div>
  )
}
