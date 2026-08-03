-- =====================================================================
-- STS Facility — relational schema (replaces the old app_documents blob
-- from _reference/Index.html — one row per fact instead of one JSON blob
-- per module).
--
-- Migration 1 of 2: tables, indexes, and cross-tenant integrity
-- constraints. Row Level Security lives in 0002_policies.sql.
--
-- Safe to re-run: guarded with IF NOT EXISTS where practical.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- CROSS-TENANT INTEGRITY PATTERN (read this before the tables below)
--
-- Every table carries facility_id, per spec, no exceptions — including
-- team_members and program_weeks, which weren't in the original column
-- list but need it so RLS never has to join through a parent table.
--
-- Wherever a child table denormalizes facility_id alongside a reference
-- to a parent row (an athlete, a team, a program), that reference is a
-- COMPOSITE foreign key against a UNIQUE (id, facility_id) constraint on
-- the parent — e.g. floor_logs(athlete_id, facility_id) references
-- athletes(id, facility_id). This is what stops a coach in facility A
-- from ever inserting a row that claims facility_id = A but actually
-- points at an athlete/team/program that belongs to facility B — the
-- exact kind of cross-tenant leak "every table carries facility_id"
-- is meant to prevent, not just something that looks like it on paper.
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- FACILITIES — the tenant boundary.
-- ---------------------------------------------------------------------
create table if not exists public.facilities (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null default 'My Facility',
  created_by          uuid references auth.users(id) on delete set null,
  created_at          timestamptz not null default now(),
  -- No check constraint on values yet: the exact vocabulary
  -- (trialing/active/past_due/canceled/...) gets defined when the
  -- Stripe webhook handler is built, not before.
  subscription_status text not null default 'active'
);

-- ---------------------------------------------------------------------
-- ATHLETES
-- ---------------------------------------------------------------------
create table if not exists public.athletes (
  id          uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities(id) on delete cascade,
  name        text not null,
  sport       text,
  sex         text,
  grad_year   int,
  created_at  timestamptz not null default now(),
  -- Lets every child table below pin its facility_id to this athlete's
  -- real facility via a composite FK instead of trusting a bare column.
  unique (id, facility_id)
);
create index if not exists athletes_facility_idx on public.athletes(facility_id);

-- ---------------------------------------------------------------------
-- FACILITY_MEMBERS — role, plus (for athlete-role logins) which athlete
-- record this login is allowed to see.
--
-- `athlete_id` wasn't in the original column list, but it's required
-- infrastructure: there is no way to implement "athletes see only rows
-- tied to their own athlete record" anywhere in this file without a
-- column that says which athlete a given login *is*.
-- ---------------------------------------------------------------------
create table if not exists public.facility_members (
  facility_id uuid not null references public.facilities(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null default 'coach' check (role in ('owner', 'coach', 'athlete')),
  athlete_id  uuid,
  created_at  timestamptz not null default now(),
  primary key (facility_id, user_id),
  -- An athlete-role login can only be pinned to an athlete in the SAME
  -- facility. Without this, a bad membership row could point role=athlete
  -- at another facility's athlete and leak that facility's data straight
  -- through the "own record" RLS check in 0002_policies.sql.
  foreign key (athlete_id, facility_id) references public.athletes (id, facility_id) on delete set null
);
create index if not exists facility_members_user_idx on public.facility_members(user_id);

-- ---------------------------------------------------------------------
-- TEAMS / TEAM_MEMBERS
-- ---------------------------------------------------------------------
create table if not exists public.teams (
  id          uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities(id) on delete cascade,
  name        text not null,
  created_at  timestamptz not null default now(),
  unique (id, facility_id)
);
create index if not exists teams_facility_idx on public.teams(facility_id);

create table if not exists public.team_members (
  team_id     uuid not null,
  athlete_id  uuid not null,
  -- Added per "every table carries facility_id, no exceptions."
  facility_id uuid not null references public.facilities(id) on delete cascade,
  primary key (team_id, athlete_id),
  foreign key (team_id, facility_id) references public.teams (id, facility_id) on delete cascade,
  foreign key (athlete_id, facility_id) references public.athletes (id, facility_id) on delete cascade
);
create index if not exists team_members_facility_idx on public.team_members(facility_id);
create index if not exists team_members_athlete_idx on public.team_members(athlete_id);

-- ---------------------------------------------------------------------
-- PROGRAMS / PROGRAM_WEEKS
--
-- `system` records which programming method built this program (the
-- ported engine is a pure function of method + constraints) — it's what
-- lets a saved program regenerate the correct 52 weeks on load instead
-- of guessing which engine to run against its constraints.
--
-- Session content is NOT materialized in program_weeks.session beyond
-- what the app chooses to cache: resolveSession() is a pure function of
-- (constraints, week, day), so weeks can be regenerated on read. The
-- table exists for whichever caching/history strategy the Build Program
-- module ends up wanting; it isn't required to be populated by Phase 2.
-- ---------------------------------------------------------------------
create table if not exists public.programs (
  id          uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities(id) on delete cascade,
  name        text not null,
  system      text not null,
  constraints jsonb not null default '{}'::jsonb,
  start_date  date,
  created_at  timestamptz not null default now(),
  unique (id, facility_id)
);
create index if not exists programs_facility_idx on public.programs(facility_id);

create table if not exists public.program_weeks (
  id          uuid primary key default gen_random_uuid(),
  program_id  uuid not null,
  -- Added per "every table carries facility_id, no exceptions."
  facility_id uuid not null references public.facilities(id) on delete cascade,
  week_number int not null,
  day_number  int not null,
  session     jsonb not null default '{}'::jsonb,
  foreign key (program_id, facility_id) references public.programs (id, facility_id) on delete cascade,
  unique (program_id, week_number, day_number)
);
create index if not exists program_weeks_facility_idx on public.program_weeks(facility_id);
create index if not exists program_weeks_program_idx on public.program_weeks(program_id);

-- ---------------------------------------------------------------------
-- FLOOR_LOGS — one row per logged set (matches the old app's per-set
-- granularity). `sets` holds the set number for that row (1, 2, 3…),
-- not a set count.
-- ---------------------------------------------------------------------
create table if not exists public.floor_logs (
  id          uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities(id) on delete cascade,
  athlete_id  uuid not null,
  date        date not null,
  exercise    text not null,
  sets        int,
  reps        int,
  weight      numeric,
  created_at  timestamptz not null default now(),
  foreign key (athlete_id, facility_id) references public.athletes (id, facility_id) on delete cascade
);
create index if not exists floor_logs_facility_idx on public.floor_logs(facility_id);
create index if not exists floor_logs_athlete_date_idx on public.floor_logs(athlete_id, date);

-- ---------------------------------------------------------------------
-- ATTENDANCE
-- ---------------------------------------------------------------------
create table if not exists public.attendance (
  id          uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities(id) on delete cascade,
  athlete_id  uuid not null,
  date        date not null,
  status      text not null check (status in ('present', 'late', 'absent', 'excused')),
  created_at  timestamptz not null default now(),
  foreign key (athlete_id, facility_id) references public.athletes (id, facility_id) on delete cascade,
  unique (athlete_id, date)
);
create index if not exists attendance_facility_idx on public.attendance(facility_id);

-- ---------------------------------------------------------------------
-- METRICS / TEST_ENTRIES
-- ---------------------------------------------------------------------
create table if not exists public.metrics (
  id               uuid primary key default gen_random_uuid(),
  facility_id      uuid not null references public.facilities(id) on delete cascade,
  key              text not null,
  label            text not null,
  unit             text,
  rank             boolean not null default true,
  higher_is_better boolean not null default true,
  created_at       timestamptz not null default now(),
  unique (facility_id, key)
);
create index if not exists metrics_facility_idx on public.metrics(facility_id);

create table if not exists public.test_entries (
  id          uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities(id) on delete cascade,
  athlete_id  uuid not null,
  date        date not null,
  metric_key  text not null,
  value       numeric,
  created_at  timestamptz not null default now(),
  foreign key (athlete_id, facility_id) references public.athletes (id, facility_id) on delete cascade,
  -- Pins metric_key to a real metric in the SAME facility (metrics are
  -- facility-scoped, so a bare text key with no FK could silently point
  -- at nothing, or worse, be read as if it matched another facility's key).
  foreign key (facility_id, metric_key) references public.metrics (facility_id, key) on delete cascade,
  unique (athlete_id, metric_key, date)
);
create index if not exists test_entries_facility_idx on public.test_entries(facility_id);
create index if not exists test_entries_athlete_idx on public.test_entries(athlete_id, date);

-- ---------------------------------------------------------------------
-- REPORT_SHARES
--
-- The public "view a shared report by token, no login" path from the old
-- app needs an anon-safe SECURITY DEFINER RPC scoped to one non-expired
-- token — that belongs with the Reports module, not this phase. This
-- table just holds the tokens; nothing here grants anon access yet.
-- ---------------------------------------------------------------------
create table if not exists public.report_shares (
  id          uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities(id) on delete cascade,
  athlete_id  uuid not null,
  token       text not null unique default encode(gen_random_bytes(16), 'hex'),
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  -- Default 90-day expiry so report cards (often for minors) don't stay
  -- viewable forever.
  expires_at  timestamptz default (now() + interval '90 days'),
  foreign key (athlete_id, facility_id) references public.athletes (id, facility_id) on delete cascade
);
create index if not exists report_shares_facility_idx on public.report_shares(facility_id);
