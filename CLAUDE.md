# STS Facility — Working Notes

Rebuild of a single-file HTML facility-management app into React + Vite + Supabase, phase by phase. Full plan and per-phase notes: `STS-Facility-Rebuild-Plan.md`. Reference-only source (do not build directly against, read for logic/behavior): `reference/reference:Index.html` (old app, EXDB coefficient library + workload math source of truth) and `reference/52weekprogram.html` (target constraints UI + the 17-system programming engine).

## Current Status

**Done:**
- Phase 1 — scaffold (Vite + React, Supabase client)
- Phase 2 — database schema + RLS (12 tables, `facility_id` on every one, isolation-tested)
- Phase 3 — auth (Supabase-only, invite-based facility joining, role-gated shell)
- Phase 4 Step 22 — Tracker (roster, test database, leaderboards)
- Phase 4 Step 23 — Build Program (engine, 17-system library, constraints flow)

**Next: Phase 4 Step 24 — Floor Log**

Depends on two modules already built:
- Pulls the day's session from the 52-week calendar Build Program generates — `resolveSession()` in `src/modules/build-program/engine/session.js`, given a program's `constraints` + `system`.
- Logs against athletes from Tracker (`athletes` table).

Stays stripped per Garrett's decision: **exercise, sets, reps, weight only. No ASC or PSC displayed** — the EXDB workload math (`engine/workload.js`) is not part of this step's scope.

## Gotchas before touching Floor Log

- **No local psql/Supabase CLI in this environment.** New migrations get applied by Garrett pasting into the Supabase SQL Editor by hand — can't be run directly from Claude Code.
- **`floor_logs` already exists** (Phase 2: `athlete_id, date, exercise, sets, reps, weight`, facility-scoped, RLS in place) — check it against what the module actually needs before assuming it's complete; both Tracker and Build Program hit schema gaps the plan hadn't anticipated.
- **Any future athlete-name matching must be exact, not fuzzy** — Garrett's explicit cut during the Tracker phase, applies directly to Attendance (Step 25, right after Floor Log).
- **Lazy first-load seeding must be race-safe.** React StrictMode double-invokes effects in dev — use `upsert(...).ignoreDuplicates(true)`, never read-then-conditionally-insert.
- **"Confirm email" is currently OFF** on the dev Supabase project for faster iteration — re-enable before real users touch it.
- Test data exists in the dev DB from Tracker/Build Program verification (a few athletes, one saved program) — harmless, not cleaned up.
