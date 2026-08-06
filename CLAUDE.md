# STS Facility — Working Notes

Rebuild of a single-file HTML facility-management app into React + Vite + Supabase, phase by phase. Full plan and per-phase notes: `STS-Facility-Rebuild-Plan.md`. Reference-only source (do not build directly against, read for logic/behavior): `reference/reference:Index.html` (old app, EXDB coefficient library + workload math source of truth) and `reference/52weekprogram.html` (target constraints UI + the 17-system programming engine).

## Current Status

**Done:** Phase 2 (database + RLS), Phase 3 (auth), Phase 4 (all six modules — Tracker, Build Program, Floor Log, Attendance, Assessment, Reports), Phase 4.5 (STS branding pass), Phase 5 (multi-facility hardening — audit + facility switcher), Phase 5.5 (per-facility theming — name/logo/accent color). **Deployed on Netlify.**

**This is a sellable state** — a facility can be onboarded manually today, ahead of Stripe. Full session-by-session detail, including everything that shipped differently than originally planned, lives in `STS-Facility-Rebuild-Plan.md`.

**Next: Phase 6 — Stripe.**
- Secret key lives in a Supabase Edge Function and nowhere else — never in React.
- Webhook updates `facilities.subscription_status`.
- Access gets gated on that column via RLS at the database level, not by hiding buttons.

**White-label scope rule (Phase 5.5, still binding):** branding is name, logo, and accent color only. Every facility runs identical logic and features — no per-facility functional customization, ever. A request that would branch behavior by `facility_id` is out of scope; flag it, don't build it.

**Isolation rule for all future schema work:** every new table carries `facility_id`, no exceptions. Add its checks to `supabase/tests/isolation_test.sql` (read *and* write isolation, following the existing lettered-block pattern) whenever the schema changes — `facility_branding` was added to the test this session but **not yet executed**; it needs a run in the Supabase SQL Editor same as everything else.

## Database

**Tables (16), all facility-scoped:** `facilities`, `facility_members`, `athletes`, `teams`, `team_members`, `programs`, `program_weeks`, `floor_sessions`, `floor_logs`, `attendance`, `metrics`, `test_entries`, `assessments`, `report_shares`, `invites`, `facility_branding`. `facility_branding` (Phase 5.5) is the newest — one row per facility, seeded automatically by `create_facility()` and backfilled for every pre-existing facility.

**Migrations run 0001 → 0008 in order**, pasted by hand into the Supabase SQL Editor — **no local psql/Supabase CLI in this environment.** `0008_facility_branding.sql` also redefines `create_facility()` and `get_shared_report()` in place (full function body, not `ALTER`) rather than adding new functions, since a function body can't be partially patched.

## Theme

Brand tokens and shared components (`.panel`, `.btn`, `.eyebrow`, `.brandbar`, form fields, modal overlay) live in `src/theme/tokens.css`, imported once from `src/index.css`. Nothing should hardcode a color — use an existing token or add a new one there.

**Per-facility override (Phase 5.5):** `src/theme/applyBranding.js` is the only place `--green`/`--green-dim` get overwritten at runtime, via `document.documentElement.style.setProperty`. `AuthContext` calls it whenever the active facility changes (login, facility switch, or sign-out back to STS default); `SharedReportPage` calls it separately since anonymous share links have no `AuthContext` at all. Everything else in the app that needs to track a facility's color — `--input-border`/`--input-border-hover`, Build Program's "done" step fill — is a **CSS-native reference to `--green`** (`var()`/`color-mix()`), not a second JS-computed value, so new accent-dependent styles should follow that pattern rather than expanding `applyBranding.js`.

**Print/PDF:** `.no-print` / `.print-only` classes (inside `@media print` in `tokens.css`) control what appears when printing or saving a report as PDF — screen appearance is untouched outside of an actual print action. Verify changes here by temporarily injecting the `@media print` rules unconditionally via a `<style>` tag and screenshotting (a real print dialog can't be screenshotted), then removing it and confirming the screen view is unaffected.

## Deploy notes

Live on Netlify, connected to `main` on GitHub — every push triggers a build and deploy. Netlify needs `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` set in its own dashboard (Site settings → Environment variables), separate from `.env.local`. **Not yet independently verified:** confirm those Netlify values actually match `.env.local` (dev project `utmeduqiaexhvswcjdhq.supabase.co`).

## Open items / rough edges

- **`facility_branding`'s isolation checks were added to `isolation_test.sql` but not executed** — needs a run in the Supabase SQL Editor before it's confirmed, not just assumed from the pattern matching every other table's checks.
- **Logo upload was never tested end-to-end.** The `facility-logos` storage bucket + RLS policies exist and the client code (`brandingApi.uploadLogo`) is written, but no real file has actually been uploaded and confirmed to render — only colors and display name got real save-flow verification this session.
- **Garrett's real "STS" facility has a crimson accent (`#be1346`/`#900e35`)** from testing the Branding Settings save flow live — not reset, his call whether to keep it.
- **"Confirm email" is OFF** on the dev Supabase project for faster iteration — re-enable before real users touch it.
- **Netlify env vars vs `.env.local`** — see Deploy notes above, still not independently confirmed to match.
- **Athlete-identity matching must be exact, never fuzzy** — standing call from the Tracker phase, applies anywhere a typed name gets resolved to an athlete.
- **Lazy first-load seeding must be race-safe** — `upsert(...).ignoreDuplicates(true)`, never read-then-insert. React StrictMode double-invokes effects in dev.
- **Testing `#report=<token>` links requires a real hard reload**, not a URL/hash-only navigation on an already-loaded session — the anonymous-report check in `App.jsx` runs once at mount, before `AuthProvider`, and won't re-fire on a hash-only change.
- **Garrett's real login is `garrettphelps@gmail.com`** (no "8"). Every `garrettphelps8+...@gmail.com` address is a test account for this project — `garrettphelps8@gmail.com` bare was never confirmed to be a real account at all.
- Test data not cleaned up (harmless): every module in the `stsowner2` (`garrettphelps8+stsowner2@gmail.com`) facility from build verification; every module in `garrettphelps8+facilityb@gmail.com`'s "Facility B Isolation Test" facility from the Phase 5 audit; empty facilities "Facility B North" and "Phase 5.5 Seed Test" used to test the facility switcher and `create_facility()` seeding.
