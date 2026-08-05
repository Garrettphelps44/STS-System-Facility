# STS Facility — Working Notes

Rebuild of a single-file HTML facility-management app into React + Vite + Supabase, phase by phase. Full plan and per-phase notes: `STS-Facility-Rebuild-Plan.md`. Reference-only source (do not build directly against, read for logic/behavior): `reference/reference:Index.html` (old app, EXDB coefficient library + workload math source of truth) and `reference/52weekprogram.html` (target constraints UI + the 17-system programming engine).

## Current Status

**Done:** Phase 2 (database + RLS), Phase 3 (auth), Phase 4 — all six modules (Tracker, Build Program, Floor Log, Attendance, Assessment, Reports), Phase 4.5 (STS branding pass), Phase 5 (multi-facility hardening — audit + facility switcher, see `STS-Facility-Rebuild-Plan.md` for the module-by-module results). **Deployed on Netlify.**

**This is a sellable state** — a facility can be onboarded manually right now, ahead of Stripe.

**Next: Phase 6 — Stripe.**
- Secret key lives in a Supabase Edge Function and nowhere else — never in React.
- Webhook updates `facilities.subscription_status`.
- Access gets gated on that column via RLS at the database level, not by hiding buttons in the UI.

**Isolation rule for all future schema work:** every new table carries `facility_id`, no exceptions — and the Phase 2 isolation test (`supabase/tests/isolation_test.sql`) gets re-run whenever the schema changes.

## Theme

Brand tokens and shared components (`.panel`, `.btn`, `.eyebrow`, `.brandbar`, form fields, modal overlay) live in `src/theme/tokens.css`, imported once from `src/index.css`. Nothing should hardcode a color — use an existing token or add a new one there.

## Deploy notes

Live on Netlify, connected to `main` on GitHub — every push triggers a build and deploy. This means schema changes now hit a deployed app, not just a local dev server: **run new migrations in order**, don't assume the dev Supabase project can be freely reset. Netlify needs `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` set in its own dashboard (Site settings → Environment variables) — that's separate from `.env.local`, which is gitignored and never reaches Netlify. **Not yet independently verified:** confirm those Netlify values actually match `.env.local` (dev project `utmeduqiaexhvswcjdhq.supabase.co`), not the old live app's Supabase project — easy for the two to drift since they're set in different places.

## Open items / rough edges

- **No local psql/Supabase CLI in this environment.** New migrations get applied by Garrett pasting into the Supabase SQL Editor by hand.
- **Athlete-identity matching must be exact, never fuzzy** — Garrett's standing call from the Tracker phase, applies anywhere a typed name gets resolved to an athlete.
- **Lazy first-load seeding must be race-safe** — `upsert(...).ignoreDuplicates(true)`, never read-then-insert. React StrictMode double-invokes effects in dev.
- **Testing `#report=<token>` links requires a real hard reload**, not a URL/hash-only navigation on an already-loaded session — the anonymous-report check in `App.jsx` runs once at mount, before `AuthProvider`, and won't re-fire on a hash-only change. Got this wrong once during the Phase 5 audit; see `STS-Facility-Rebuild-Plan.md`.
- **"Confirm email" is OFF** on the dev Supabase project for faster iteration — re-enable before real users touch it.
- **The primary dev session (`garrettphelps8@gmail.com`) is signed out** and Claude doesn't have the real password — Garrett needs to sign back in himself before browser verification against his own facility can resume.
- `garrettphelps8+stsathlete1@gmail.com` (`TestPassword123`) is an athlete-role login *in the `stsowner2` facility*, not a separate facility.
- Test data not cleaned up (harmless): every module in the `stsowner2` facility from build verification; every module in the `garrettphelps8+facilityb@gmail.com` facility ("Facility B Isolation Test") from the Phase 5 audit; an empty second facility, "Facility B North," under that same login, used to test the facility switcher.
