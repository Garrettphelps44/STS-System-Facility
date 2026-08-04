import { useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { InvitePanel } from './InvitePanel'
import { TrackerModule } from '../modules/tracker/TrackerModule'
import { BuildProgramModule } from '../modules/build-program/BuildProgramModule'
import { FloorLogModule } from '../modules/floor-log/FloorLogModule'
import { AttendanceModule } from '../modules/attendance/AttendanceModule'
import { AssessmentModule } from '../modules/assessment/AssessmentModule'
import { ReportsModule } from '../modules/reports/ReportsModule'

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
    <div className="wrap">
      <header className="brandbar">
        <div className="brandbar-left">
          <img className="logo-s" src="/logo-s.png" alt="STS logo" />
          <div className="name">STRENGTH THROUGH <span>SYSTEMS</span></div>
        </div>
        <div className="brandbar-right">
          <span className="brandbar-user">Signed in as {membership.role}</span>
          <button className="btn logout ghost" type="button" onClick={signOut}>Sign out</button>
        </div>
      </header>

      <nav style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '0 0 22px' }}>
        {visibleModes.map((m) => (
          <button
            className="btn"
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
        {activeMode === 'track' ? (
          <TrackerModule />
        ) : activeMode === 'build' ? (
          <BuildProgramModule />
        ) : activeMode === 'floor' ? (
          <FloorLogModule />
        ) : activeMode === 'att' ? (
          <AttendanceModule />
        ) : activeMode === 'assess' ? (
          <AssessmentModule />
        ) : activeMode === 'reports' ? (
          <ReportsModule />
        ) : (
          <p>{MODE_LABELS[activeMode]} — not built yet (Phase 4).</p>
        )}

        {!isAthlete && <InvitePanel facilityId={membership.facilityId} />}
      </main>
    </div>
  )
}
