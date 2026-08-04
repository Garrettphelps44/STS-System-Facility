# STS Facility — Working Notes

Rebuild of a single-file HTML facility-management app into React + Vite + Supabase, phase by phase. Full plan and per-phase notes: `STS-Facility-Rebuild-Plan.md`. Reference-only source (do not build directly against, read for logic/behavior): `reference/reference:Index.html` (old app, EXDB coefficient library + workload math source of truth) and `reference/52weekprogram.html` (target constraints UI + the 17-system programming engine).

## Current Status

**Done:** Phase 1 (scaffold), Phase 2 (database + RLS), Phase 3 (auth), Phase 4 — all six modules (Tracker, Build Program, Floor Log, Attendance, Assessment, Reports). Per-module decisions and what changed vs. the reference: see `STS-Facility-Rebuild-Plan.md`.

**Next: Phase 5 — multi-facility hardening.**

- Create a second real facility through the app itself (not just in the DB), populate it with dummy data.
- Walk every module logged in as facility B. Any place facility A's data appears is a bug — including dropdowns, leaderboards, and report share links.
- Add a facility switcher for users who belong to more than one facility.
- A real second test facility already exists for this: `garrettphelps8+facilityb@gmail.com` / `TestPassword123` (currently empty — good for a clean-slate walkthrough).

## Open items / rough edges

- **No branding/theme pass has happened.** The app is unstyled plain HTML/React — no CSS framework, no theme/token file — aside from a couple of hardcoded inline colors in Reports (`#13BE17` STS green). If that work starts, there's nothing existing to point to; it starts from scratch.
- **No local psql/Supabase CLI in this environment.** New migrations get applied by Garrett pasting into the Supabase SQL Editor by hand.
- **Athlete-identity matching must be exact, never fuzzy** — Garrett's standing call from the Tracker phase, applies anywhere a typed name gets resolved to an athlete.
- **Lazy first-load seeding must be race-safe** — `upsert(...).ignoreDuplicates(true)`, never read-then-insert. React StrictMode double-invokes effects in dev.
- **"Confirm email" is OFF** on the dev Supabase project for faster iteration — re-enable before real users touch it.
- **The primary dev session (`garrettphelps8@gmail.com`) is signed out** and Claude doesn't have the real password — Garrett needs to sign back in himself before browser verification against his own facility can resume. All verification since the Attendance phase has run against the `stsowner2` test account/facility instead.
- `garrettphelps8+stsathlete1@gmail.com` (`TestPassword123`) is an athlete-role login *in the `stsowner2` facility*, not a separate facility.
- Test data exists across every module in the `stsowner2` facility from build verification — harmless, not cleaned up.
