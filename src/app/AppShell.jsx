import { useLayoutEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { InvitePanel } from './InvitePanel'
import { BrandingSettings } from '../modules/branding/BrandingSettings'
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
  const { membership, memberships, switchFacility, signOut } = useAuth()
  const isAthlete = membership.role === 'athlete'
  const isOwner = membership.role === 'owner'
  const visibleModes = isAthlete ? ['reports'] : MODES
  const [mode, setMode] = useState(isAthlete ? 'reports' : 'build')
  const [inviteOpen, setInviteOpen] = useState(false)
  // 'settings' isn't one of the six locked modules — kept out of MODES/
  // MODE_LABELS entirely, reachable only via the owner-only button below.
  const activeMode = mode === 'settings' && isOwner ? 'settings' : (visibleModes.includes(mode) ? mode : 'reports')

  // Floor Log stays mounted once opened — hidden, not unmounted, while
  // another tab is up — so the athletes on the floor, who's selected, the
  // date and the open session are exactly as left when the coach comes
  // back. Keyed by facility so switching facilities still starts clean.
  // Every other tab mounts fresh each visit, as before.
  const [floorOpened, setFloorOpened] = useState(false)
  const keepFloor = !isAthlete && (floorOpened || activeMode === 'floor')
  const scrollByMode = useRef({})

  function goTo(next) {
    scrollByMode.current[activeMode] = window.scrollY
    if (next === 'floor') setFloorOpened(true)
    setMode(next)
  }

  // Coming back to Floor Log also returns to where the coach was scrolled.
  useLayoutEffect(() => {
    if (activeMode === 'floor') window.scrollTo(0, scrollByMode.current.floor || 0)
  }, [activeMode])

  return (
    <div className="wrap">
      <header className="brandbar no-print">
        <div className="brandbar-left">
          <img className="logo-s" src="/logo-s.png" alt="STS logo" />
          <div className="name">STRENGTH THROUGH <span>SYSTEMS</span></div>
        </div>
        <div className="brandbar-right">
          {memberships.length > 1 && (
            <label className="facility-switcher">
              <span className="sr-only">Facility</span>
              <select
                value={membership.facilityId}
                onChange={(e) => switchFacility(e.target.value)}
              >
                {memberships.map((m) => (
                  <option key={m.facilityId} value={m.facilityId}>
                    {m.facilityName}
                  </option>
                ))}
              </select>
            </label>
          )}
          <span className="brandbar-user">Signed in as {membership.role}</span>
          {isOwner && (
            <button
              className="btn ghost btn-small"
              type="button"
              aria-current={activeMode === 'settings'}
              onClick={() => goTo('settings')}
            >
              Branding
            </button>
          )}
          {!isAthlete && (
            <button className="btn ghost btn-small" type="button" onClick={() => setInviteOpen(true)}>
              Invite
            </button>
          )}
          <button className="btn logout ghost btn-small" type="button" onClick={signOut}>Sign out</button>
        </div>
      </header>

      <nav className="no-print" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '0 0 22px' }}>
        {visibleModes.map((m) => (
          <button
            className="btn"
            key={m}
            type="button"
            aria-current={m === activeMode}
            onClick={() => goTo(m)}
          >
            {MODE_LABELS[m]}
          </button>
        ))}
      </nav>

      <main>
        {activeMode === 'settings' ? (
          <BrandingSettings />
        ) : activeMode === 'track' ? (
          <TrackerModule />
        ) : activeMode === 'build' ? (
          <BuildProgramModule />
        ) : activeMode === 'floor' ? null : activeMode === 'att' ? (
          <AttendanceModule />
        ) : activeMode === 'assess' ? (
          <AssessmentModule />
        ) : activeMode === 'reports' ? (
          <ReportsModule />
        ) : (
          <p>{MODE_LABELS[activeMode]} — not built yet (Phase 4).</p>
        )}

        {keepFloor && (
          <div hidden={activeMode !== 'floor'}>
            <FloorLogModule key={membership.facilityId} active={activeMode === 'floor'} />
          </div>
        )}

        {inviteOpen && (
          <InvitePanel facilityId={membership.facilityId} onClose={() => setInviteOpen(false)} />
        )}
      </main>
    </div>
  )
}
