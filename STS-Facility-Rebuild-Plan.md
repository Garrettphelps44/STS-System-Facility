# STS Facility System Builder — Rebuild & Relaunch Plan
### Single-file HTML → React + Supabase + Stripe, using Claude Code

---

## WHAT YOU ACTUALLY HAVE RIGHT NOW

Read this before you start. It changes what the rebuild has to fix.

| Item | Current state |
|---|---|
| File size | 4,762 lines / 367 KB in one `Index.html` |
| Script blocks | 4 inline blocks — the main one runs **lines 1114–4537** (~3,400 lines) |
| Modes | build, assess, att, floor, track, reports (culture div at line 954 is empty — being cut) |
| Supabase tables | Only 4: `app_documents`, `report_shares`, `profiles`, `facility_members` |
| Data model | **Not relational.** Everything lives in localStorage and gets pushed to `app_documents` as whole JSON blobs keyed by `doc_key` |
| Sync method | A monkey-patch that overrides `localStorage.setItem` (lines 535–538) and flushes dirty keys on a 700ms timer |
| Auth | Two paths: real Supabase auth **or** a local fallback storing **plaintext passwords** in `localStorage.sts_profiles` |
| Session gate | `sessionStorage.sts_auth = '1'` toggles a CSS class — anyone can flip that in devtools |
| Password rule | Minimum 4 characters |
| Config | Supabase URL + anon key in a separate `sts-config.js` |

### The three real problems

1. **Blob storage, not a database.** You can't query "all athletes across facilities," build cross-facility leaderboards, run reports at scale, or safely let two facilities exist side by side — because every facility's entire dataset is one JSON blob. This is the #1 thing blocking you from selling to more than one org.
2. **Auth is cosmetic in local mode.** Plaintext passwords + a CSS-class gate. Fine for a demo. Not fine the day someone pays you.
3. **One file.** 3,400 lines in a single script block means every change risks breaking something unrelated.

**Good news:** your *logic* is solid and portable — the program engine, the EXDB exercise coefficient library, the workload math, the attendance data layer (`window.STSAtt`), the metrics system. None of that gets thrown away. You're rebuilding the container, not the contents.

---

## PHASE 0 — Before you open Claude Code (1–2 hrs, do this on paper)

**Step 1.** Write down every screen you actually use with athletes right now. If you haven't used it in 3 months, it doesn't get ported. This is your chance to cut, not carry.

**Step 2.** Culture is cut. It does not get ported. Tell Claude Code to strip every trace of it: the `mode-culture` div (line 954), the `culture` mode tab, the `soar-sts-v1` localStorage key, the `kindFor()` mapping at line 529, and the culture branch inside `unifiedAthletes()` (line 4552).

**Step 3.** Module names are locked: Build Program, Assessment, Attendance, Floor Log, Tracker, Reports. Tell Claude Code these are final so it doesn't propose renaming or reorganizing them.

**Step 4.** Write your pricing tiers — even rough. What does a facility get at each level? This determines what Stripe gates later, and it's easier to build the gates in than bolt them on.

**Step 5.** Export your current data. In the browser on your live app, open devtools console and run:
```js
copy(JSON.stringify({
  track: localStorage.getItem('sts-track'),
  att: localStorage.getItem('sts-attendance-v3'),
  attOld: localStorage.getItem('ircs_attendance_v1'),
  programs: Object.keys(localStorage).filter(k=>k.startsWith('sts:prog:'))
              .reduce((o,k)=>(o[k]=localStorage.getItem(k),o),{})
}))
```
Paste into a file called `sts-data-export.json`. This is your real IRCS data and your migration test case.

---

## PHASE 1 — Project setup (3–4 hrs)

**Step 6.** Make a new folder — do **not** work inside the old one:
```
mkdir sts-facility && cd sts-facility
```

**Step 7.** Copy in your reference files (read-only inputs, not the project):
```
mkdir _reference
cp /path/to/Index.html _reference/
cp /path/to/sts-data-export.json _reference/
```

**Step 8.** Open Claude Code in that folder and give it this opening prompt:

> I'm rebuilding a single-file HTML app into a proper React + Supabase project. The old app is at `_reference/Index.html` — 4,762 lines, one file. Read it fully before writing anything.
>
> Context: it's a facility management tool for strength & conditioning. Modes are Build Program, Assessment, Attendance, Floor Log, Tracker, Reports. It currently stores everything in localStorage and syncs whole JSON blobs to a single Supabase `app_documents` table. Auth has a local fallback with plaintext passwords.
>
> Target: React + Vite + Supabase, real relational tables, real row-level security, multi-facility from day one, Stripe paywall later.
>
> Don't build anything yet. First, read `_reference/Index.html` and give me: (1) an inventory of every distinct feature by mode, (2) the pure logic worth porting as-is, (3) a proposed relational schema to replace the blob storage. Then stop and wait.

**Step 9.** Read what it gives back and cut anything you don't want. This is the single highest-leverage 30 minutes of the whole rebuild — every feature you approve here becomes hours of work later.

**Step 10.** Have it scaffold: Vite + React, Supabase client, environment variables in `.env.local` (not a `sts-config.js` sitting in the repo), and git initialized with a first commit.

**Step 11.** Confirm you can run `npm run dev` and see a blank page in the browser. Commit. Don't move on until this works.

---

## PHASE 2 — The database (4–6 hrs) — most important phase ✅ DONE

This is where the product gets built. Everything else is UI.

**Step 12.** Have Claude Code write SQL migrations for a real schema. Target shape:

```
facilities          id, name, created_at, subscription_status
facility_members    facility_id, user_id, role (owner/coach/athlete)
athletes            id, facility_id, name, sport, sex, grad_year
programs            id, facility_id, name, constraints (json), created_at
program_weeks       id, program_id, week_number, day_number, session (json)
floor_logs          id, facility_id, athlete_id, date, exercise, sets, reps, weight
test_entries        id, facility_id, athlete_id, date, metric_key, value
attendance          id, facility_id, athlete_id, date, status
teams               id, facility_id, name
team_members        team_id, athlete_id
metrics             id, facility_id, key, label, unit, rank, higher_is_better
report_shares       id, facility_id, athlete_id, token, expires_at
```

Key rule to give it: **every table carries `facility_id`.** No exceptions. That one column is what makes multi-facility safe.

**Step 13.** Have it write Row Level Security policies — one per table — where the rule is always "you can only see rows where `facility_id` is a facility you're a member of." Then have it write the athlete-role variant: athletes see only their own rows.

**Step 14.** **Test the isolation before building any UI.** Create two test facilities and two test users in Supabase. Log in as user A and try to query facility B's data. If you get anything back, stop and fix RLS. Do not skip this — it's the difference between a product and a lawsuit.

**Step 15.** Have Claude Code write a one-time migration script that reads your `sts-data-export.json` and loads your real IRCS data into the new tables. Run it. Verify athlete counts, test entries, and program weeks match what you had.

**Step 16.** Commit.

**What changed / what we learned:**
- The built schema deviates from Step 12's target shape in three ways, all necessary rather than scope creep: `facility_members` got an `athlete_id` column (there's no way to implement "athletes see only their own rows" without a column saying which athlete a login *is*); `team_members` and `program_weeks` got `facility_id` even though the Step 12 sketch's column list omitted them (the "no exceptions" rule overrides the omission); and every child table that denormalizes `facility_id` alongside a reference to a parent row (an athlete, a team, a program) uses a **composite foreign key** against a `unique(id, facility_id)` on the parent, not a bare column — this is what actually stops a coach in facility A from inserting a row that claims `facility_id = A` but points at facility B's athlete/team/program.
- `report_shares` dropped the `snapshot`/`athlete_name` columns the old app's migration had — decided to compute shared reports live from relational tables at view-time instead of serving a frozen blob, once that module gets built.
- Skipped Step 15 (migrating real IRCS data) for now — building against a fresh empty dev Supabase project (`utmeduqiaexhvswcjdhq.supabase.co`), intentionally separate from the old live app's project, so nothing here touches real production data yet.
- **Gotcha for future sessions:** this environment has no local psql/Supabase CLI. Every migration gets applied by Garrett pasting the file into the Supabase SQL Editor by hand — plan for that hand-off when writing new migrations.
- Caught one real bug only by actually running `isolation_test.sql`, not by reading the SQL: a temp table's `serial` column needs its backing sequence explicitly granted `USAGE` to the `authenticated` role — granting `SELECT`/`INSERT` on the table alone isn't enough.

---

## PHASE 3 — Auth (2–3 hrs) ✅ DONE

**Step 17.** Delete the local fallback entirely. No `sts_profiles`, no plaintext passwords, no `sessionStorage.sts_auth` CSS gate. Supabase auth only.

**Step 18.** Raise the password minimum to 8 characters and use real email addresses — drop the `@sts.local` fake-email trick.

**Step 19.** Build the sign-up flow so a new user creates a **facility**, not just a profile. First user of a facility = owner role. Coaches and athletes get invited into an existing facility.

**Step 20.** Build role-based routing: owner and coach see all modes; athlete lands on Reports only.

**Step 21.** Test with three accounts — owner, coach, athlete. Confirm the athlete literally cannot reach the Tracker, not just that the button is hidden. Commit.

**What changed / what we learned:**
- Step 19 said "coaches and athletes get invited into an existing facility" but didn't specify a mechanism — the `facility_members` insert policy from Phase 2 correctly blocks anyone from self-joining a facility, so this needed a real answer: added an `invites` table + `redeem_invite()` RPC (same SECURITY DEFINER bootstrap pattern as `create_facility()`). An athlete invite creates its `athletes` row on the spot, since Tracker/roster doesn't exist yet at that point in the build order.
- **Gotcha:** the dev Supabase project had "Confirm email" ON by default, which blocked automated sign-up testing entirely (no session until the link is clicked). Garrett disabled it in the dashboard for faster dev iteration — **remember to re-enable it before any real user touches this project.**
- Minor: Supabase's signup rejected some fake test-email domains (e.g. `.dev`) outright. Plus-addressed variants of a real address (`you+test@gmail.com`) work reliably for throwaway test accounts.
- Step 21's "confirm the athlete literally cannot reach the Tracker" was verified two ways, not one: the nav doesn't render the tab (UX gate), and a raw query run as the athlete's own session was checked directly against `athletes`/`floor_logs`/`facility_members` and returned only that athlete's own rows — RLS is what's actually blocking it, not the hidden button.

---

## PHASE 4 — Port the modules, ONE AT A TIME (12–24 hrs)

The rule for all six: build it, use it for real, commit it, then start the next one. Never two at once.

**Step 22 — Tracker first.** ✅ DONE. It's the source of truth for athletes; everything else references it. Port roster, test database, and leaderboards. Reuse the `DEFAULT_METRICS` array and the `flyMPH` conversion as-is.

**What changed / what we learned:**
- The Phase 2 schema had nowhere to put two things Tracker actually needed: `athletes.height_feet`/`height_inches` (Roster collects it; Floor Log's future workload math needs it) and `metrics.active` (so "stop tracking a test" can hide a column without cascading away every athlete's history for it — without the flag the only option was deleting the row, which destroys data). Added via `0004_tracker_additions.sql`.
- **Decision, applies to Attendance later (Step 25):** cut the old app's fuzzy/case-normalized athlete-name matching entirely. Any future athlete-identity matching (e.g. Attendance resolving a typed name to an existing athlete) must be exact-match only — Garrett's call, made before Attendance gets built.
- **Gotcha for any future lazy first-load seeding:** React StrictMode double-invokes effects in dev. `ensureDefaultMetrics`'s original "read, then insert if empty" seed raced with itself (two concurrent calls both saw zero rows, both inserted, second hit the unique constraint). Fixed with `upsert(...).ignoreDuplicates(true)` — push idempotency into the database call, don't try to out-time it client-side.

**Step 23 — Build Program second.** ✅ DONE. Port the engine and the EXDB coefficient library verbatim — that's your IP and it works. Only the storage layer changes (program + weeks to tables instead of `sts:prog:` keys). Fold in your constraints-only entry page from the Netlify app here as Step 1 of the flow.

**What changed / what we learned:**
- This step turned out to need **two** reference files, not one, and they disagreed with each other in real ways: `Index.html` has the EXDB coefficient library + workload math (ported as shared infra for Floor Log/Assessment, not used by Build Program itself) but only ONE programming system. `52weekprogram.html` — the "constraints-only entry page from the Netlify app" mentioned above — turned out to contain a much more advanced engine: 17 full programming systems (`SYS`/`SYSFAM`, e.g. Linear, Conjugate, 5/3/1, Tier) that don't exist in `Index.html` at all. That newer file was treated as canonical for the engine.
- The two engines genuinely differ, not just in scope: `52weekprogram.html`'s `stageFor` dropped the "prog" progressing-accessory mode `Index.html` has; day types dropped from 4 to 3 (no conditioning-first "both" variant); session length options dropped 120 min. All three adopted as-is per "target, not the old constraints screen."
- Sport is a new constraints step (05) that doesn't exist in `Index.html` — it shifts which conditioning exercise comes up first.
- **Decision:** Groups (lane/athlete-capacity math) and the 4 static reference panels (Exercise Scale, Schedule Shifts, Cueing, Adaptation Checklist) from `Index.html`'s old Build Program were cut from `52weekprogram.html`'s target flow entirely. Garrett wanted both back but tucked away — they exist now as collapsed, click-to-open sections, not primary numbered steps. Groups needs real per-item equipment *counts*, which only exist if a facility opens the "exact equipment" panel under step 02 (the default 00–06 flow only tracks booleans per category).
- Programs save/load by `id`, not by name — no upsert-by-name matching.
- Found and preserved (not fixed) a real bug already in the EXDB source: 47 jump/plyo entries use a comma instead of `*` (`(0.024750, 0.53)` — the JS comma operator, evaluates to just `0.53`), so those movements currently all resolve to the same flat coefficient regardless of which one it is. Flagged in `engine/workload.js`; needs a decision before Floor Log/Assessment ship real numbers for those exercises.

**Step 24 — Floor Log third.** Keep it stripped the way you already decided: exercise, sets, reps, weight. Loads the day's session from the 52-week calendar. No ASC/PSC displayed.

**Step 25 — Attendance fourth.** Port the `STSAtt` data layer logic (statuses, point values, teams as display groupings), but write records to the `attendance` table instead of the `sts-attendance-v3` blob.

**Step 26 — Assessment fifth.** ✅ DONE.

**What changed / what we learned:**
- Confirmed directly against the reference before building anything, per Garrett's own instruction to check first: Assessment's raw data entry (a movement name + a weight) is structurally identical to a Test Database entry — same {athlete, named thing, value, date} shape. Garrett's call: keep it as its own module anyway, matching the reference exactly, rather than fold it into Tracker — the look-alike data entry stays because the PSC formula and the weekly acute:chronic progression built on top of it are the actual reason to keep it separate, not the data entry screen itself.
- The reference's movement list isn't "5 movements" — that's `ASSESS_REF_PER_DAY`, an unrelated scaling constant, confused for the list size at first. Actually running the dedup logic against `POOL`/`EXDB` gives **22 movements** (30 raw entries across 5 pool categories, minus duplicates like "Cable Tricep Extensions" appearing in two categories).
- New `assessments` table: one row per athlete, overwritten on each computation, no history — matches the reference's own behavior (`a.assessment` was always a single overwritten object, never an array).
- The reference's PSC auto-fill/weekly-progression math actually lives in Floor Log (it reads Floor Log's own session history to compute the acute:chronic ratio), not in Assessment. Wiring it in required editing Floor Log too — an explicit, Garrett-approved exception to "Assessment only" for this step. Ported as `src/modules/floor-log/progression.js` (`athleteWeekTotals`/`weekTargetTotal`/`progressedPSC`), verified against hand-calculated values before touching the UI.
- Real bug caught during verification: the assessment lookup inside Floor Log's session-load wasn't fault-isolated — a failed lookup took down the *entire* session load, not just the optional auto-fill. Fixed with its own try/catch; Floor Log now degrades to manual-entry on any auto-fill failure.
- Known (not a bug) characteristic: if only some of a session's exercises have an assessed weight, the auto-prescribed weight for those can look extreme (e.g. 805 lbs), because the scale factor makes that one exercise's workload cover the whole session's target alone. Verified by hand-computing the reference's actual formula — not something introduced here.

**Step 27 — Reports last.** ✅ DONE. It depends on all the others. Port the unified-athlete logic and the share-token system. Reports is also your best demo surface — make it the one that looks sharpest.

**What changed / what we learned:**
- Cut the reference's entire `unifiedAthletes()` / "Reconcile Names" mechanism, not just the Culture branch inside it. That mechanism only existed to paper over the old app storing athletes by name across disconnected localStorage blobs; every module built in this rebuild already references real `athlete_id` foreign keys, so there was nothing left to reconcile.
- Assessment's PSC on the report card is new scope, not a straight port — confirmed by reading the reference that its Reports never touched `a.assessment` at all (Assessment only ever fed Floor Log there). Added per Garrett's explicit instruction for this step.
- The share-token system landed differently than the reference's approach: the reference stored a frozen JSON `snapshot` at share-creation time; this schema (decided back in Phase 2) computes the report live at view-time instead. Anonymous access goes through a single `get_shared_report(token)` RPC — `SECURITY DEFINER`, every subquery hardcoded to the token-matched athlete/facility, token is the only input — rather than an RLS policy granting anonymous table reads. `report_shares` itself still grants zero anonymous access. This exact gap was flagged in `0002_policies.sql`'s own comments back in Phase 2 ("deliberately not added here — that belongs to the Reports module"); this step is what closed it.
- `reportBuilder.js`'s pure functions are the one source of truth for the report math — the authenticated view and the anonymous RPC path both call the exact same functions on same-shaped data, so there's no second implementation to drift out of sync.
- Cut the radar chart per Garrett's call — the report stayed a single continuous page, written for a parent to read, not a coach dashboard.
- Verified end-to-end, all six checks Garrett specified: real cross-module data for one athlete; a share link opened in a separate tab with zero auth touched, matching the authenticated view exactly; an athlete-role login confirmed to see only their own report, with a direct query for another athlete blocked by RLS (empty result, not an error); a freshly-created second facility seeing none of facility A's data; all five other modules still working; a clean mobile viewport including the training-load chart.

**Step 28.** After each module: open it on your phone. If it's painful on a phone, coaches won't use it on the floor.

---

## PHASE 4.5 — STS branding pass ✅ DONE

Not in the original phase list — inserted between Phase 4 and Phase 5 once all six modules were functionally complete. Styling and markup only, no schema/logic/behavior changes, scoped and approved before any file was touched.

**What changed / what we learned:**
- **Scope, Garrett's call:** shared shell only, not a full per-module port. The reference file has roughly 150 more classes than the four components actually named for this pass (brandbar, hex step indicator, panel, eyebrow) — things like `.modenav`, `.tkrow`, `.fl-*`, `.rep-*`, `.acard`, `.login-*` — but those were deliberately left unmined. Every module reuses the same shared primitives (`.panel`, `.btn`, `.eyebrow`, form fields) instead of bespoke per-module CSS. All of it lives in `src/theme/tokens.css`.
- Reference file path correction: it's actually at `reference/reference:Index.html`, not `_reference/Index.html` as the original Phase 0/1 plan text has it — that path reference in this doc is stale.
- `public/logo-s.png` already existed in the project from an earlier session — reused as-is for the brandbar logo, nothing was missing.
- **`TrainingLoadChart.jsx` retuned to dark-only, Garrett's call.** It was the only place in the app with any light/dark theme logic (`prefers-color-scheme` + `data-theme` selectors, a CVD-validated palette) — nothing else has a theme toggle, so its light branch was permanently dead code once the fixed dark brand palette applied everywhere. Stripped the light branch; grid/axis/text colors now pull from the real `--line`/`--muted`/`--muted-2` tokens instead of a generic dark palette tuned to nothing in particular. The planned/actual bar colors (blue/orange) stayed hardcoded on purpose — they're validated dataviz colors, not brand colors.
- **No token exists for "negative/down"** in the given palette. `ReportCard.jsx`'s trend indicator (up/down/flat) uses `--green` for up, `--gold` for down, `--muted` for flat — Garrett's call, no new color invented.
- Added a `.modal-overlay` / `.modal-panel` pattern that wasn't in the original 4-component list — every modal in the app (session detail, reference panels, roll call, add player, etc.) had zero positioning CSS before this pass and rendered inline in the page flow instead of as an overlay. Added as shared shell infrastructure since it's basic UI chrome, not a per-module bespoke component.
- **Follow-up fix, same pass:** the first version used `--line` (#1f241f) for panel and input borders, which is barely visible against `--panel`/`--bg` — Garrett flagged that everything was "getting lost in the blackness." Fixed with a new `--border-visible` token (#333d33) for containers and buttons, and switched input/select borders to green (`#2c8f30`, brightening to `#3fce43` on hover) — pulled directly from the reference file's own input styling, not invented. `--radius` bumped from 4px to 8px app-wide for visibly rounder corners. Also caught a real CSS bug from the first version: the input selector only matched explicit `type="text"` etc. and silently missed any input with no `type` attribute at all (e.g. Program Name) — broadened to a catch-all `input:not([type='checkbox']):not([type='radio'])`.
- Reports got the extra polish pass per Step 27's own instruction — full brandbar, stat tiles, verified end-to-end on a live mobile viewport.

Files: `src/theme/tokens.css` (new), plus className/markup changes across every module, auth, and shell file — no logic files touched.

---

## DEPLOYMENT

Live on Netlify, deployed ahead of schedule — Phase 5 (multi-facility hardening) below isn't done yet.

- **Build settings:** build command `npm run build`, publish directory `dist`. No `netlify.toml` in the repo — Netlify auto-detected both from the Vite project.
- **Deploy trigger:** connected to the `main` branch on GitHub (`Garrettphelps44/STS-System-Facility`) — every `git push origin main` triggers an automatic build and deploy. For a manual rebuild (e.g. after changing environment variables, which only take effect on a fresh build): Netlify dashboard → Deploys → Trigger deploy → Deploy site.
- **Environment variables required in Netlify** (Site settings → Environment variables — separate from `.env.local`, which is gitignored and never reaches Netlify):
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
- **Supabase project:** must point at the same dev project used throughout this build, `utmeduqiaexhvswcjdhq.supabase.co` — not the old live app's project. The first deploy hit a black screen because these env vars were never set in Netlify at all (missing values crash `createClient()` before React mounts). **Not yet independently verified this session:** confirm the values actually saved in the Netlify dashboard match `.env.local` exactly — they're set in two different places and it's easy for them to drift.

---

## PHASE 5 — Multi-facility hardening (3–5 hrs) ✅ DONE

**Step 29.** Create a second real facility in the app (not just in the database) and populate it with dummy data. ✅ DONE.

**Step 30.** Go through all six modules logged in as facility B. Any place where facility A's data appears is a bug — including in dropdowns, leaderboards, and report share links. ✅ DONE.

**Step 31.** Have Claude Code add a facility switcher for users who belong to more than one (you'll need this — IRCS plus every client facility). ✅ DONE.

**Step 32.** Commit and deploy to Netlify. You now have a working multi-facility product with no payments. **This is a sellable state** — you can onboard a paying facility manually while Stripe gets built. ✅ DONE (committed; deploy triggers automatically on push to `main`, see Deployment section above).

### Audit results (Steps 29–30) — reference this before assuming a future leak is new

Setup: facility B (`garrettphelps8+facilityb@gmail.com`, facility "Facility B Isolation Test") was created live through the signup flow and populated with real data in every table. Compared against the `stsowner2` test facility (13 real athletes across every module) as facility A, checked both directions.

| Module / surface | Result | Fix required |
|---|---|---|
| Tracker — Roster | PASS | none |
| Tracker — Test Database | PASS | none |
| Tracker — Leaderboards | PASS | none |
| Floor Log — player picker | PASS (tried searching a real facility-A athlete name, zero matches) | none |
| Attendance — teams / roll call / team report | PASS | none |
| Build Program — saved-programs list | PASS (checked both directions: B doesn't see A's programs, A doesn't see B's) | none |
| Assessment — player picker | PASS | none |
| Reports — athlete picker | PASS | none |
| Report share link — anonymous access | PASS — opens exactly the one shared athlete, nothing else reachable | none |
| Report share link — cross-facility | Not a leak, but the first pass through this check produced a wrong result — see below | none (working as designed) |

**Every table-level, RLS-gated surface passed clean on the first pass. No RLS policy changes were made in Phase 5** — Phase 2's policies held under real multi-facility use, not just the synthetic `isolation_test.sql`. If a leak turns up later in one of the modules above, it's a regression (something changed since this audit), not a gap that was always there.

**Correction, worth knowing about:** the report-share-link cross-facility check was first "verified" by using the browser tool's `navigate` to load a facility-A `#report=<token>` URL while authenticated as facility B, and seeing the normal facility-B dashboard rather than the report — logged at the time as proof the link was blocked. That was a false negative caused by SPA navigation: changing only the URL hash on an already-mounted page doesn't reload the document, so `App.jsx`'s top-level `sharedToken` check (which runs before `AuthProvider` even mounts) never re-fires. A real hard reload on that same URL/session immediately showed facility A's shared report. **This is not an isolation bug** — `get_shared_report(token)` is intentionally a `SECURITY DEFINER` RPC gated only by possessing the unguessable token, exactly like a Google Docs share link, and that's what makes it usable by parents/coaches with no login at all (see Phase 4 Step 27). Anyone testing `#report=` behavior in this app in the future needs a real hard reload, not just a URL/hash change on a live session — that's the only way to trigger the real check.

### Facility switcher — where it lives, how it works

- `src/auth/AuthContext.jsx` loads *every* `facility_members` row for the logged-in user (`loadMemberships`, joined to `facilities(name)`), not just one. Which facility is currently active lives in `currentFacilityId` state, persisted per-user in `localStorage` under `sts_current_facility:<userId>`, defaulting to the first membership if nothing (or a stale value) is stored. `switchFacility(facilityId)` updates both.
- `src/app/AppShell.jsx`'s brandbar renders a `<select>` of `memberships` only when there's more than one — a single-facility login sees no switcher at all.
- No schema/migration change was needed: `facility_members`' primary key was already `(facility_id, user_id)`, so a user could already belong to more than one facility — only the client ever fetched just one row (`.limit(1).maybeSingle()`, no `.order(...)`).
- **This fixed a real, previously-unnoticed bug**, found while building the switcher: with the old single-row fetch, a user belonging to two facilities landed on an arbitrary one — Postgres gives no ordering guarantee without an `ORDER BY` — possibly a different one on every login, with the other facility's data silently invisible the whole time. There was no error and nothing in the UI would have hinted this was happening.
- Every module already reads `facilityId` off `useAuth().membership` as an effect dependency, so switching facilities needed zero changes outside these two files — data refetches automatically everywhere.
- Verified: a single-facility athlete account shows no switcher; a login given a second facility (via the existing `create_facility` RPC — already `SECURITY DEFINER`, granted to `authenticated`, no new UI needed to test it) immediately shows a dropdown, switching instantly re-scopes every module with no stale rows from the previous facility, and the selection survives a reload. Test facility "Facility B North" (`aad4d67c-1d5d-40b0-a0e8-e046bae65f1a`) exists under the facility-B login for this — empty, not cleaned up.

---

## PHASE 5.5 — Per-facility theming ✅ DONE

Not in the original phase list — inserted after Phase 5 once multi-facility was proven safe. White-labeling is branding only (name, logo, one accent color): every facility runs identical logic and features, nothing branches behavior by `facility_id`.

**Scope confirmed before building:** `AppShell`, `SignIn`, and `SignUp` keep the fixed "STRENGTH THROUGH SYSTEMS" name/logo — a coach always knows they're using STS. Only the accent color applies app-wide (Step 2's root-level `--green`/`--green-dim` override reaches every screen, including those three, since it's just a CSS variable). Only `ReportCard.jsx` — shared by the authenticated Reports module and the anonymous `SharedReportPage` — swaps in the facility's own name/logo, since that's the artifact a parent or outside coach actually sees and it shouldn't look like a third-party vendor tool.

**What was built:**
- `supabase/migrations/0008_facility_branding.sql` — new `facility_branding` table (one row per facility: `display_name`, `logo_url`, `accent_color`, `accent_dim`), RLS scoped by `is_facility_member` for reads and **`facility_role(facility_id) = 'owner'` directly for writes** (not `can_write_facility`, which is owner+coach — Step 3's "owner role only" is a real DB-level restriction, a coach's write attempt fails regardless of UI). Extends `create_facility()` to seed STS defaults + the signup name atomically with facility creation, backfills existing facilities the same way, adds a public-read/owner-write Storage bucket (`facility-logos`) for logo uploads, and extends `get_shared_report()` with a `branding` key so anonymous share-link visitors get it with zero extra input beyond the token — same `SECURITY DEFINER` pattern as everything else that function already returns.
- `src/theme/applyBranding.js` — the one place `--green`/`--green-dim` get set on `document.documentElement` at runtime; everything else in `tokens.css` stays fixed, exactly as specified.
- `src/theme/contrast.js` — WCAG relative-luminance contrast check of a candidate accent against the app's actual background (`#050605`), plus `deriveDim()` (HSL lightness − 0.1, same ratio as STS's own `#13be17` → `#0f8f12`). **Decision:** Step 1's schema has both `accent_color` and `accent_dim` columns, but Step 3 only asks for one color picker — rather than exposing two pickers, the owner sets one accent and `accent_dim` is always derived from it, never entered separately.
- **Contrast guard thresholds (a judgment call, not specified numerically in the brief):** ratio < 2:1 against `#050605` blocks Save outright (Save button `disabled`, error text shown); 2–3.5:1 shows a soft warning but still allows saving; ≥3.5:1 is clean. Verified live: a near-black accent (`#0a0a0a`, 1.0:1) correctly disables Save and visibly demonstrates why (the whole live-previewed UI, including the STS wordmark, goes nearly unreadable).
- `src/modules/branding/BrandingSettings.jsx` — owner-only screen (`AppShell` only renders it for `role === 'owner'`, real gate is the RLS write policy above), reachable via a "Branding" nav button that exists outside the six locked module names. Live preview repaints the actual running app (not a mock swatch) on every keystroke, reverts to the last-saved color on unmount if abandoned without saving, and has a "Reset to default" button that restores STS colors + clears the logo but leaves the display name alone (no universal default exists for a facility's own name to revert to).
- `src/auth/AuthContext.jsx` — branding now loads keyed on `currentFacilityId`, not on login. This is the one real interaction with the Phase 5 facility switcher the brief didn't anticipate: switching facilities re-fires the same effect and repaints colors for whichever facility is now active; signing out resets to STS default.
- `src/modules/reports/{reportBuilder,ReportsModule,SharedReportPage,ReportCard}.js(x)` — `buildReport()` takes a `branding` param now, attached to its return value; both the authenticated and anonymous callers already have branding in scope (from `useAuth()` and the RPC's own new field, respectively) with no extra fetch needed.
- **Known cosmetic gap, left alone on purpose:** `tokens.css`'s `.hex.done { background: #0c2f0d }` (Build Program's "done" step fill) is a hardcoded dark-green tint, not a `var(--green...)` reference — Step 2 says only the two named vars get overridden, so a non-green facility will still see a green-tinted "done" hex. Flagging as a rough edge, not fixing without a decision.

**Migration applied and fully verified, both client-side and against the real database:**
- Pre-migration: app didn't crash with the table missing (`loadBranding` caught the error, logged, fell back to defaults) — confirmed in console before the migration landed.
- Client-side: Branding screen renders; live preview repaints the whole running app instantly on every keystroke; contrast guard correctly blocks Save and shows why on a near-black accent (1.0:1 ratio); `npm run build` succeeds clean.
- **Save flow — verified for real, not staged:** Garrett tested it himself against his own real facility mid-session (not a synthetic test one) — set a crimson accent (`#be1346`), and it round-tripped correctly: `accent_dim` auto-derived to `#900e35`, `updated_at` trigger fired, and the whole running app repainted red immediately. Confirmed via a direct query against `facility_branding`, not just visually.
- **Owner-only RLS write, checked directly against the database:** authenticated as the `stscoach1` test account (coach role) and attempted a raw `PATCH` on `facility_branding` for its own facility — PostgREST returned `200` with an empty result set (RLS filtered the row out of the `UPDATE`'s `USING` clause before it could touch anything), and a follow-up read confirmed the value was genuinely untouched. Not just a hidden button — a coach's write request reaches the database and gets nothing.
- **`create_facility()` seeding, checked directly:** called the RPC fresh (facility "Phase 5.5 Seed Test", `17c3e7e9-b0c5-4b37-866e-20af89a327ac`) and confirmed a `facility_branding` row existed immediately with the facility's name and STS default colors — atomic with creation, no second round trip. Left in place, not cleaned up, same as other test facilities in this project.
- **`get_shared_report()` branding, checked directly and visually:** generated a real share token for an athlete in the "Facility B Isolation Test" facility, called the RPC with zero `Authorization` header (true anonymous access, apikey only) and got back a `branding` object with the facility's real name and colors. Opened the link in the browser afterward and visually confirmed the report header reads "FACILITY B ISOLATION TEST," not "STRENGTH THROUGH SYSTEMS."
- **Real discovery, not previously documented:** Garrett's actual primary login is `garrettphelps@gmail.com` (no "8"), facility name "STS," created 2026-08-04 — distinct from every `garrettphelps8+...@gmail.com` test account used throughout this project. Every prior note in this doc and `CLAUDE.md` about "the primary dev session being signed out" referred to the wrong (test) address; corrected in `CLAUDE.md`.
- **Live state left behind:** Garrett's real "STS" facility currently has the crimson accent (`#be1346`/`#900e35`) he saved while testing — not reset, since it's his real account and his call whether to keep it.

**Follow-up polish pass, same phase, Garrett's call after seeing it live:**
- Moved the "Branding" button out of the main module nav into the brandbar, between "Signed in as X" and "Sign out" — and shrank both (`.btn-small`, new in `tokens.css`) so neither competes visually with the six real module tabs.
- **Real gap caught by Garrett, not by me:** the accent override only ever touched `--green`/`--green-dim` — `--input-border`/`--input-border-hover` (every input and select's border, app-wide) and `.hex.done`'s fill (Build Program's "done" step, the exact cosmetic gap flagged two sections up) were still hardcoded hex, untouched by a facility's chosen color. Fixed at the CSS level, not by expanding `applyBranding.js`: `--input-border: var(--green)`, `--input-border-hover: color-mix(in srgb, var(--green) 80%, white)`, `.hex.done`'s background `color-mix(in srgb, var(--green) 22%, black)`. Because these are CSS-native references to `--green` rather than separately-computed JS values, they inherit any future accent change automatically — the JS side still only ever sets the same two variables it always did. Verified live in the browser: Assessment's player-search input and the invite-role `<select>` both picked up the crimson accent immediately, no reload needed (Vite HMR).

---

## PHASE 6 — Stripe (3–5 hrs)

**Step 33.** Create Stripe products matching the tiers you wrote in Step 4.

**Step 34.** Have Claude Code build a Supabase Edge Function for checkout. The secret key lives there and only there — never in the React code.

**Step 35.** Build the webhook handler that updates `facilities.subscription_status` when a payment succeeds, fails, or cancels.

**Step 36.** Gate access on `subscription_status` at the **database** level via RLS, not by hiding buttons in React. Hidden buttons are not a paywall.

**Step 37.** Test the full loop with Stripe test cards: subscribe → access granted, cancel → access revoked, failed payment → grace period.

---

## PHASE 7 — Relaunch (4–8 hrs)

**Step 38.** Full pass on your real IRCS data. Run an actual training week through the app before anyone else touches it.

**Step 39.** Update the privacy policy — the current one (line 993) describes local-only mode, which no longer exists.

**Step 40.** Point your domain at the new deploy. Keep the old Netlify HTML app live at its current URL until the new one has run clean for two weeks.

**Step 41.** Keep `constraint-52weeks.netlify.app` alive as your free outreach tool — that's your top-of-funnel. The rebuilt app is what people log into after they pay.

---

## TIME + SEQUENCING

| Phase | Hours |
|---|---|
| 0 — Prep on paper | 1–2 |
| 1 — Project setup | 3–4 |
| 2 — Database | 4–6 |
| 3 — Auth | 2–3 |
| 4 — Six modules | 12–24 |
| 5 — Multi-facility | 3–5 |
| 6 — Stripe | 3–5 |
| 7 — Relaunch | 4–8 |
| **Total** | **32–57 hrs** |

At 5–6 protected hours a week: **7–10 weeks.**

**Weekly rhythm that fits your schedule:** Saturday is your production engine — use it for a full phase or a full module in one sitting. Use one weekday evening block (after 8pm, outside family time) for the review-and-test pass on whatever Saturday produced.

---

## RULES FOR THE WHOLE REBUILD

- **One module at a time.** Working app the entire way through, never a half-finished one.
- **Commit after every working piece.** If a session goes sideways you roll back 2 hours, not 2 weeks.
- **`facility_id` on every table.** No exceptions.
- **Test isolation before UI.** Every time you add a table.
- **Port the logic, replace the storage.** The engine, EXDB, and metrics math are proven — don't let anyone rewrite them.
- **If you're 3 hours into a module and it's fighting you, the old version was doing something you haven't defined.** Go find that thing in `Index.html` before continuing.

---

*Systems drive success.*
