-- =====================================================================
-- STS Facility — Floor Log module
-- Migration 5. Requires 0001_schema.sql + 0002_policies.sql.
--
-- The Phase 2 floor_logs table (one row per exercise, single
-- sets/reps/weight ints) was never written to by any module — Floor Log
-- is the first thing to actually use it — so it's safe to drop and
-- reshape rather than alter in place.
--
-- Reshaped to match the reference app's data shape (track.floor[athlete
-- id|date] = {projected, asc, ex:[{ex,target,prescribed,purpose,sets:
-- [{w,r,t,v}]}]}), split across two relational tables instead of one
-- JSON blob:
--
--   floor_sessions — one row per athlete+date. Holds the session-level
--   PSC target (`projected`) and a manual ASC override, same as the
--   reference's S.projected / S.asc.
--
--   floor_logs — one row per logged SET (not per exercise). Each
--   exercise "slot" is identified by exercise_index; every set row
--   under that slot repeats the slot's exercise/target/prescribed/
--   purpose (denormalized, same style as the rest of this schema always
--   denormalizing facility_id) so the whole session can be read back in
--   one query without a second lookup table for exercise slots.
--   `value` is the precomputed wkValue() workload contribution for that
--   set, stored so ASC totals don't require recomputing every row's
--   coefficient math on every read.
--
-- PSC auto-fill / auto-prescribe from a saved assessment (the
-- reference's maybeApplyAssessment / progressedPSC / weekTargetTotal
-- chain) is NOT implemented here — there is no assessments table yet
-- (Assessment is Step 26, after Floor Log). `projected` is a plain
-- manually-entered number for now; wiring in auto-fill later needs no
-- schema change, just a function that writes to this same column.
-- =====================================================================

drop table if exists public.floor_logs cascade;

create table public.floor_sessions (
  id            uuid primary key default gen_random_uuid(),
  facility_id   uuid not null references public.facilities(id) on delete cascade,
  athlete_id    uuid not null,
  date          date not null,
  projected     numeric,
  asc_override  numeric,
  created_at    timestamptz not null default now(),
  foreign key (athlete_id, facility_id) references public.athletes (id, facility_id) on delete cascade,
  unique (athlete_id, date),
  unique (id, facility_id)
);
create index floor_sessions_facility_idx on public.floor_sessions(facility_id);

create table public.floor_logs (
  id              uuid primary key default gen_random_uuid(),
  facility_id     uuid not null references public.facilities(id) on delete cascade,
  session_id      uuid not null,
  athlete_id      uuid not null,
  exercise_index  int not null,
  exercise        text not null default '',
  target          text,
  prescribed      text,
  purpose         text,
  set_index       int not null,
  weight          numeric,
  reps            int,
  tempo           text,
  value           numeric,
  created_at      timestamptz not null default now(),
  foreign key (session_id, facility_id) references public.floor_sessions (id, facility_id) on delete cascade,
  foreign key (athlete_id, facility_id) references public.athletes (id, facility_id) on delete cascade,
  unique (session_id, exercise_index, set_index)
);
create index floor_logs_facility_idx on public.floor_logs(facility_id);
create index floor_logs_session_idx on public.floor_logs(session_id);

alter table public.floor_sessions enable row level security;
alter table public.floor_logs     enable row level security;

-- Same base rule as every other athlete-scoped table: owner/coach see
-- and write everything in the facility; an athlete-role login sees only
-- rows tied to the athlete record they're pinned to.
drop policy if exists floor_sessions_select on public.floor_sessions;
create policy floor_sessions_select on public.floor_sessions
  for select using (
    public.is_facility_member(facility_id)
    and (
      public.facility_role(facility_id) in ('owner', 'coach')
      or athlete_id = public.my_athlete_id(facility_id)
    )
  );

drop policy if exists floor_sessions_write on public.floor_sessions;
create policy floor_sessions_write on public.floor_sessions
  for all using (public.can_write_facility(facility_id))
  with check (public.can_write_facility(facility_id));

drop policy if exists floor_logs_select on public.floor_logs;
create policy floor_logs_select on public.floor_logs
  for select using (
    public.is_facility_member(facility_id)
    and (
      public.facility_role(facility_id) in ('owner', 'coach')
      or athlete_id = public.my_athlete_id(facility_id)
    )
  );

drop policy if exists floor_logs_write on public.floor_logs;
create policy floor_logs_write on public.floor_logs
  for all using (public.can_write_facility(facility_id))
  with check (public.can_write_facility(facility_id));
