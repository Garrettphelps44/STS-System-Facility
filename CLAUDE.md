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

**Next: Phase 4 Step 25 — Attendance**

Port the `STSAtt` data layer logic (statuses, point values, teams as display groupings) from the reference, writing to the `attendance` table instead of the `sts-attendance-v3` blob.

## Gotchas before touching Attendance

- **No local psql/Supabase CLI in this environment.** New migrations get applied by Garrett pasting into the Supabase SQL Editor by hand — can't be run directly from Claude Code.
- **Any athlete-name matching must be exact, not fuzzy** — Garrett's explicit cut during the Tracker phase; this is the module it was called out for.
- **Lazy first-load seeding must be race-safe.** React StrictMode double-invokes effects in dev — use `upsert(...).ignoreDuplicates(true)`, never read-then-conditionally-insert (Tracker's `ensureDefaultMetrics` and Floor Log's `ensureSession`/`seedExercises` both do this).
- **"Confirm email" is currently OFF** on the dev Supabase project for faster iteration — re-enable before real users touch it.
- Test data exists in the dev DB from Tracker/Build Program/Floor Log verification (a few athletes, one saved program, one logged Floor Log set) — harmless, not cleaned up.
