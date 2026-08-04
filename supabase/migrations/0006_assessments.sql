-- =====================================================================
-- STS Facility — Assessment module
-- Migration 6. Requires 0001_schema.sql + 0002_policies.sql.
--
-- One row per athlete, overwritten on each new computation — matches
-- the reference's a.assessment blob (no history, just "the current
-- one"). Doesn't fit test_entries: this needs an aggregate PSC number
-- plus the whole per-movement weights map plus the assessed date
-- together as one atomic record, not a single metric/value pair.
--
-- `weights` is jsonb (movement key -> working weight in lbs) rather
-- than a normalized child table, since it's always exactly the fixed
-- ASSESS_MOVES set (5 entries) read/written as one unit, never queried
-- per-movement.
-- =====================================================================

create table public.assessments (
  id            uuid primary key default gen_random_uuid(),
  facility_id   uuid not null references public.facilities(id) on delete cascade,
  athlete_id    uuid not null,
  psc           numeric not null,
  weights       jsonb not null default '{}'::jsonb,
  ref_per_day   int not null default 5,
  assessed_on   date not null,
  created_at    timestamptz not null default now(),
  foreign key (athlete_id, facility_id) references public.athletes (id, facility_id) on delete cascade,
  unique (athlete_id)
);
create index assessments_facility_idx on public.assessments(facility_id);

alter table public.assessments enable row level security;

-- Same base rule as every other athlete-scoped table.
drop policy if exists assessments_select on public.assessments;
create policy assessments_select on public.assessments
  for select using (
    public.is_facility_member(facility_id)
    and (
      public.facility_role(facility_id) in ('owner', 'coach')
      or athlete_id = public.my_athlete_id(facility_id)
    )
  );

drop policy if exists assessments_write on public.assessments;
create policy assessments_write on public.assessments
  for all using (public.can_write_facility(facility_id))
  with check (public.can_write_facility(facility_id));
