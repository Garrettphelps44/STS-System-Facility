# STS Facility — Working Notes

Rebuild of a single-file HTML facility-management app into React + Vite + Supabase, phase by phase. Full plan and per-phase notes: `STS-Facility-Rebuild-Plan.md`. Reference-only source (do not build directly against, read for logic/behavior): `reference/reference:Index.html` (old app, EXDB coefficient library + workload math source of truth) and `reference/52weekprogram.html` (target constraints UI + the 17-system programming engine).

## Current Status

**Done:**
- Phase 1 — scaffold (Vite + React, Supabase client)
- Phase 2 — database schema + RLS (12 tables, `facility_id` on every one, isolation-tested)
- Phase 3 — auth (Supabase-only, invite-based facility joining, role-gated shell)
- Phase 4 Step 22 — Tracker (roster, test database, leaderboards)
- Phase 4 Step 23 — Build Program (engine, 17-system library, constraints flow)
- Phase 4 Step 24 — Floor Log (`src/modules/floor-log/`) — full reference parity per Garrett's mid-build reversal of the original "stripped down" instruction: real ASC workload math + exercise dropdown w/ coefficients, PSC is manual-entry only (no auto-fill — Assessment doesn't exist yet). Required `0005_floor_log.sql` (new `floor_sessions` + reshaped one-row-per-set `floor_logs`). Verified end-to-end live.
- Phase 4 Step 25 — Attendance (`src/modules/attendance/`) — teams/dates grid, roll-call modal (4-way status + bulk All Present/All Absent + bare-name quick-add), per-team report. No new migration — `attendance`/`teams`/`team_members` already matched. `STATUS_PTS` point values, per-(team,date) notes, and JSON export/import were all cut per Garrett's call (points only ever drove the cut Culture module; notes had no schema home). Verified end-to-end live incl. facility-isolation and a 12-player bulk-mark timing check.

**Next: Phase 4 Step 26 — Assessment**

Not yet scoped in detail — per the plan, this is weights → PSC, and it's what Floor Log's PSC field is waiting on for auto-fill (currently manual-entry only).

## Gotchas before touching Assessment

- **No local psql/Supabase CLI in this environment.** New migrations get applied by Garrett pasting into the Supabase SQL Editor by hand — can't be run directly from Claude Code.
- **Any athlete-name matching must be exact, not fuzzy** — Garrett's explicit cut during the Tracker phase.
- **Lazy first-load seeding must be race-safe.** React StrictMode double-invokes effects in dev — use `upsert(...).ignoreDuplicates(true)`, never read-then-conditionally-insert (Tracker's `ensureDefaultMetrics`, Floor Log's `ensureSession`/`seedExercises`, Attendance's `addTeamMember` all do this).
- **"Confirm email" is currently OFF** on the dev Supabase project for faster iteration — re-enable before real users touch it.
- **The primary dev session (`garrettphelps8@gmail.com`) got signed out during Attendance's facility-isolation test** and Claude doesn't have the real password to sign back in — Garrett needs to sign back in himself before further browser-based verification against his own facility.
- Test data exists in the dev DB from Tracker/Build Program/Floor Log/Attendance verification (a few athletes, one saved program, one logged Floor Log set, two attendance teams with rosters) — harmless, not cleaned up.
