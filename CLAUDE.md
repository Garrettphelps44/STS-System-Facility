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
- Phase 4 Step 26 — Assessment (`src/modules/assessment/`) — full reference parity per Garrett's call, after first confirming its overlap with Tracker's Test Database directly (raw weight-entry is structurally redundant with test_entries; the non-redundant part is the PSC formula + weekly A:C progression, which is why it stayed a separate module). 22 movements (not "5" — corrected mid-build after actually running the dedup logic against POOL/EXDB: 30 raw pool entries across 5 categories, 22 survive EXDB-match+dedup; `ASSESS_REF_PER_DAY=5` is an unrelated scaling constant). New `assessments` table (one row per athlete, overwritten each computation, no history — matches the reference). Also wired the full A:C progression chain into Floor Log's PSC field (`src/modules/floor-log/progression.js` — `athleteWeekTotals`/`weekTargetTotal`/`progressedPSC`, verified against hand-calculated values) plus weight auto-prescription for exercises matching an assessed movement, both firing once at first-ever view of a session. Verified end-to-end live: PSC computed and persisted, Floor Log auto-filled both PSC and Back Squat's weight on a fresh session, coach override still works and persists, auto-fill correctly skipped re-triggering on a revisit.
  - Real bug caught and fixed during this build: the assessment auto-fill was originally inside Floor Log's main try/catch, so a failed assessment lookup (e.g. table not migrated yet) took down the *entire* session load instead of just skipping the optional auto-fill. Fixed by isolating it in its own try/catch — Floor Log now degrades to its pre-Assessment manual-entry behavior on any auto-fill failure, verified live.
  - Known characteristic, not a bug: if a coach has only assessed a subset of a session's exercises, the auto-prescribed weight for the assessed one(s) can look extreme (e.g. 805 lbs), because the scale factor tries to make that lone exercise's workload cover the *entire* session's target alone. This is the reference's actual formula behavior (verified by hand-computing it), not something introduced here — worth a coach-facing heads up if it comes up.

**Next: Phase 4 Step 27 — Reports (last module)**

Depends on all the others — Tracker, Build Program, Floor Log, Attendance, Assessment. Port the unified-athlete logic and the share-token system.

## Gotchas before touching Reports

- **No local psql/Supabase CLI in this environment.** New migrations get applied by Garrett pasting into the Supabase SQL Editor by hand — can't be run directly from Claude Code.
- **Any athlete-name matching must be exact, not fuzzy** — Garrett's explicit cut during the Tracker phase.
- **Lazy first-load seeding must be race-safe.** React StrictMode double-invokes effects in dev — use `upsert(...).ignoreDuplicates(true)`, never read-then-conditionally-insert (Tracker's `ensureDefaultMetrics`, Floor Log's `ensureSession`/`seedExercises`, Attendance's `addTeamMember` all do this).
- **"Confirm email" is currently OFF** on the dev Supabase project for faster iteration — re-enable before real users touch it.
- **The primary dev session (`garrettphelps8@gmail.com`) is still signed out** from Attendance's facility-isolation test — all verification since then (Attendance timing check, all of Assessment) has run against the `stsowner2` test account/facility instead. Claude doesn't have the real password to sign back in; Garrett needs to sign back in himself before browser-based verification against his own facility can resume.
- Test data exists in the dev DB from Tracker/Build Program/Floor Log/Attendance/Assessment verification (several athletes on the `stsowner2` facility, one saved program, logged Floor Log sets on Alex Rivera incl. a manually-overridden auto-prescribed weight, an assessment with PSC 65.30, two attendance teams with rosters) — harmless, not cleaned up.
