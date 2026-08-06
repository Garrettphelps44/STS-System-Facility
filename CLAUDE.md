# STS Facility — Working Notes

Rebuild of a single-file HTML facility-management app into React + Vite + Supabase, phase by phase. Full plan and per-phase notes: `STS-Facility-Rebuild-Plan.md`. Reference-only source (do not build directly against, read for logic/behavior): `reference/reference:Index.html` (old app, EXDB coefficient library + workload math source of truth) and `reference/52weekprogram.html` (target constraints UI + the 17-system programming engine).

## Current Status

**Done:** Phase 2 (database + RLS), Phase 3 (auth), Phase 4 — all six modules (Tracker, Build Program, Floor Log, Attendance, Assessment, Reports), Phase 4.5 (STS branding pass), Phase 5 (multi-facility hardening — audit + facility switcher, see `STS-Facility-Rebuild-Plan.md` for the module-by-module results). **Deployed on Netlify.**

**This is a sellable state** — a facility can be onboarded manually right now, ahead of Stripe.

**Done: Phase 5.5 — per-facility theming** (name/logo/accent color). `facility_branding` table + owner-only RLS, Settings screen with live preview + contrast guard, share links carry the facility's own branding. Migration applied and verified against the real database — owner-only write, `create_facility()` seeding, and anonymous `get_shared_report()` branding all confirmed directly, not just in the UI. See `STS-Facility-Rebuild-Plan.md` for the full writeup, including the AppShell/SignIn/SignUp scope decision (they keep the fixed STS name/logo; only the accent color and Reports vary per facility).

**Next: Phase 6 — Stripe.**
- Secret key lives in a Supabase Edge Function and nowhere else — never in React.
- Webhook updates `facilities.subscription_status`.
- Access gets gated on that column via RLS at the database level, not by hiding buttons in the UI.

**Isolation rule for all future schema work:** every new table carries `facility_id`, no exceptions — and the Phase 2 isolation test (`supabase/tests/isolation_test.sql`) gets re-run whenever the schema changes.

## Theme

Brand tokens and shared components (`.panel`, `.btn`, `.eyebrow`, `.brandbar`, form fields, modal overlay) live in `src/theme/tokens.css`, imported once from `src/index.css`. Nothing should hardcode a color — use an existing token or add a new one there.

**Per-facility override (Phase 5.5):** `src/theme/applyBranding.js` is the only place `--green`/`--green-dim` get overwritten at runtime, via `document.documentElement.style.setProperty`. Every other token stays fixed for every facility. `AuthContext` calls it whenever the active facility changes (login, facility switch, or sign-out back to STS default); `SharedReportPage` calls it separately since anonymous share links have no `AuthContext` at all.

## Deploy notes

Live on Netlify, connected to `main` on GitHub — every push triggers a build and deploy. This means schema changes now hit a deployed app, not just a local dev server: **run new migrations in order**, don't assume the dev Supabase project can be freely reset. Netlify needs `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` set in its own dashboard (Site settings → Environment variables) — that's separate from `.env.local`, which is gitignored and never reaches Netlify. **Not yet independently verified:** confirm those Netlify values actually match `.env.local` (dev project `utmeduqiaexhvswcjdhq.supabase.co`), not the old live app's Supabase project — easy for the two to drift since they're set in different places.

## Open items / rough edges

- **No local psql/Supabase CLI in this environment.** New migrations get applied by Garrett pasting into the Supabase SQL Editor by hand.
- **`.hex.done` (Build Program's "done" step fill) is a hardcoded dark-green tint, not a CSS var** — a non-green facility will still see it green. Left alone per Phase 5.5's "only `--green`/`--green-dim` get overridden" rule; needs a decision, not a default fix.
- **Garrett's real facility currently has a crimson accent (`#be1346`/`#900e35`)** from testing the Branding Settings save flow live — not reset back to STS green, his call whether to keep it.
- **Athlete-identity matching must be exact, never fuzzy** — Garrett's standing call from the Tracker phase, applies anywhere a typed name gets resolved to an athlete.
- **Lazy first-load seeding must be race-safe** — `upsert(...).ignoreDuplicates(true)`, never read-then-insert. React StrictMode double-invokes effects in dev.
- **Testing `#report=<token>` links requires a real hard reload**, not a URL/hash-only navigation on an already-loaded session — the anonymous-report check in `App.jsx` runs once at mount, before `AuthProvider`, and won't re-fire on a hash-only change. Got this wrong once during the Phase 5 audit; see `STS-Facility-Rebuild-Plan.md`.
- **"Confirm email" is OFF** on the dev Supabase project for faster iteration — re-enable before real users touch it.
- **Correction:** earlier notes here referred to `garrettphelps8@gmail.com` as "the primary dev session" — that's wrong. Garrett's actual real login is `garrettphelps@gmail.com` (no "8"), facility name "STS," created 2026-08-04. Every `garrettphelps8+...@gmail.com` address is a test account for this project; `garrettphelps8@gmail.com` itself was never confirmed to be a real account at all.
- `garrettphelps8+stsathlete1@gmail.com` (`TestPassword123`) is an athlete-role login *in the `stsowner2` facility*, not a separate facility.
- Test data not cleaned up (harmless): every module in the `stsowner2` facility from build verification; every module in the `garrettphelps8+facilityb@gmail.com` facility ("Facility B Isolation Test") from the Phase 5 audit; an empty second facility, "Facility B North," under that same login, used to test the facility switcher.
