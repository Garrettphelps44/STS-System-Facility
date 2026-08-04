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

## PHASE 5 — Multi-facility hardening (3–5 hrs)

**Step 29.** Create a second real facility in the app (not just in the database) and populate it with dummy data.

**Step 30.** Go through all six modules logged in as facility B. Any place where facility A's data appears is a bug — including in dropdowns, leaderboards, and report share links.

**Step 31.** Have Claude Code add a facility switcher for users who belong to more than one (you'll need this — IRCS plus every client facility).

**Step 32.** Commit and deploy to Netlify. You now have a working multi-facility product with no payments. **This is a sellable state** — you can onboard a paying facility manually while Stripe gets built.

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
