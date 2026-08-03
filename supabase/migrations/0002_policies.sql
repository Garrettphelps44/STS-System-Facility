-- =====================================================================
-- STS Facility — Row Level Security
-- Migration 2 of 2. Requires 0001_schema.sql.
--
-- Every table's rule is the same base rule: a user can only see rows
-- where facility_id is a facility they belong to in facility_members.
-- Tables with an athlete_id column additionally narrow that for the
-- athlete role: an athlete-role login sees only rows tied to the athlete
-- record they're pinned to (facility_members.athlete_id), never a
-- teammate's. Tables with no athlete_id column (facilities, teams,
-- programs, program_weeks, metrics) have nothing to narrow — the base
-- membership rule already is the athlete-role rule there.
--
-- Writes are owner/coach only everywhere. Athlete accounts are read-only,
-- matching the old app's own stated behavior.
-- =====================================================================

-- =====================================================================
-- HELPER FUNCTIONS (security definer — run as the function owner, so
-- their internal lookups against facility_members/athletes aren't
-- themselves blocked by the RLS policies defined below)
-- =====================================================================

create or replace function public.is_facility_member(fid uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.facility_members m
    where m.facility_id = fid and m.user_id = auth.uid()
  );
$$;

create or replace function public.facility_role(fid uuid)
returns text
language sql stable security definer set search_path = public as $$
  select role from public.facility_members m
  where m.facility_id = fid and m.user_id = auth.uid()
  limit 1;
$$;

-- Can the current user write (insert/update/delete) data in this facility?
create or replace function public.can_write_facility(fid uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select public.facility_role(fid) in ('owner', 'coach');
$$;

-- The athlete_id this user is pinned to (for athlete-role read scoping).
create or replace function public.my_athlete_id(fid uuid)
returns uuid
language sql stable security definer set search_path = public as $$
  select athlete_id from public.facility_members m
  where m.facility_id = fid and m.user_id = auth.uid()
  limit 1;
$$;

-- Atomic bootstrap: create a facility and make the caller its owner.
-- SECURITY DEFINER so it can insert the first membership row — the
-- facility_members_insert policy below only lets an EXISTING owner add
-- members, which is exactly what would make bootstrapping a brand new
-- facility impossible without this. This is the only supported way to
-- create a facility; there is no direct INSERT policy on facilities.
create or replace function public.create_facility(p_name text default 'My Facility')
returns uuid
language plpgsql security definer set search_path = public as $$
declare fid uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  insert into public.facilities (name, created_by)
    values (coalesce(nullif(btrim(p_name), ''), 'My Facility'), auth.uid())
    returning id into fid;
  insert into public.facility_members (facility_id, user_id, role)
    values (fid, auth.uid(), 'owner');
  return fid;
end;
$$;
grant execute on function public.create_facility(text) to authenticated;

-- =====================================================================
-- ENABLE RLS
-- =====================================================================

alter table public.facilities       enable row level security;
alter table public.athletes         enable row level security;
alter table public.facility_members enable row level security;
alter table public.teams            enable row level security;
alter table public.team_members     enable row level security;
alter table public.programs         enable row level security;
alter table public.program_weeks    enable row level security;
alter table public.floor_logs       enable row level security;
alter table public.attendance       enable row level security;
alter table public.metrics          enable row level security;
alter table public.test_entries     enable row level security;
alter table public.report_shares    enable row level security;

-- ---- facilities -------------------------------------------------------
-- No INSERT/DELETE policy: facilities are only ever created via
-- create_facility() above, which bypasses RLS as SECURITY DEFINER.
drop policy if exists facilities_select on public.facilities;
create policy facilities_select on public.facilities
  for select using (public.is_facility_member(id));

drop policy if exists facilities_update on public.facilities;
create policy facilities_update on public.facilities
  for update using (public.facility_role(id) = 'owner');

-- ---- athletes -----------------------------------------------------------
drop policy if exists athletes_select on public.athletes;
create policy athletes_select on public.athletes
  for select using (
    public.is_facility_member(facility_id)
    and (
      public.facility_role(facility_id) in ('owner', 'coach')
      or id = public.my_athlete_id(facility_id)
    )
  );

drop policy if exists athletes_write on public.athletes;
create policy athletes_write on public.athletes
  for all using (public.can_write_facility(facility_id))
  with check (public.can_write_facility(facility_id));

-- ---- facility_members -----------------------------------------------
-- Every user can see their own membership row (needed to bootstrap:
-- the client has to read its own role before it knows what to render).
-- Only an existing owner can see the full member list, add, edit, or
-- remove members. Do not loosen facility_members_insert to allow
-- `user_id = auth.uid()` — that would let any logged-in user insert
-- their own membership into ANY facility with ANY role, including
-- 'owner': an account/facility-takeover path.
drop policy if exists facility_members_select on public.facility_members;
create policy facility_members_select on public.facility_members
  for select using (
    user_id = auth.uid()
    or public.facility_role(facility_id) in ('owner', 'coach')
  );

drop policy if exists facility_members_insert on public.facility_members;
create policy facility_members_insert on public.facility_members
  for insert with check (public.facility_role(facility_id) = 'owner');

drop policy if exists facility_members_update on public.facility_members;
create policy facility_members_update on public.facility_members
  for update using (public.facility_role(facility_id) = 'owner');

drop policy if exists facility_members_delete on public.facility_members;
create policy facility_members_delete on public.facility_members
  for delete using (public.facility_role(facility_id) = 'owner');

-- ---- teams (no athlete_id column: nothing to narrow further) --------
drop policy if exists teams_select on public.teams;
create policy teams_select on public.teams
  for select using (public.is_facility_member(facility_id));

drop policy if exists teams_write on public.teams;
create policy teams_write on public.teams
  for all using (public.can_write_facility(facility_id))
  with check (public.can_write_facility(facility_id));

-- ---- team_members -----------------------------------------------------
drop policy if exists team_members_select on public.team_members;
create policy team_members_select on public.team_members
  for select using (
    public.is_facility_member(facility_id)
    and (
      public.facility_role(facility_id) in ('owner', 'coach')
      or athlete_id = public.my_athlete_id(facility_id)
    )
  );

drop policy if exists team_members_write on public.team_members;
create policy team_members_write on public.team_members
  for all using (public.can_write_facility(facility_id))
  with check (public.can_write_facility(facility_id));

-- ---- programs / program_weeks (no athlete_id column) -----------------
drop policy if exists programs_select on public.programs;
create policy programs_select on public.programs
  for select using (public.is_facility_member(facility_id));

drop policy if exists programs_write on public.programs;
create policy programs_write on public.programs
  for all using (public.can_write_facility(facility_id))
  with check (public.can_write_facility(facility_id));

drop policy if exists program_weeks_select on public.program_weeks;
create policy program_weeks_select on public.program_weeks
  for select using (public.is_facility_member(facility_id));

drop policy if exists program_weeks_write on public.program_weeks;
create policy program_weeks_write on public.program_weeks
  for all using (public.can_write_facility(facility_id))
  with check (public.can_write_facility(facility_id));

-- ---- floor_logs ---------------------------------------------------------
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

-- ---- attendance -----------------------------------------------------
drop policy if exists attendance_select on public.attendance;
create policy attendance_select on public.attendance
  for select using (
    public.is_facility_member(facility_id)
    and (
      public.facility_role(facility_id) in ('owner', 'coach')
      or athlete_id = public.my_athlete_id(facility_id)
    )
  );

drop policy if exists attendance_write on public.attendance;
create policy attendance_write on public.attendance
  for all using (public.can_write_facility(facility_id))
  with check (public.can_write_facility(facility_id));

-- ---- metrics (no athlete_id column) -----------------------------------
drop policy if exists metrics_select on public.metrics;
create policy metrics_select on public.metrics
  for select using (public.is_facility_member(facility_id));

drop policy if exists metrics_write on public.metrics;
create policy metrics_write on public.metrics
  for all using (public.can_write_facility(facility_id))
  with check (public.can_write_facility(facility_id));

-- ---- test_entries -----------------------------------------------------
drop policy if exists test_entries_select on public.test_entries;
create policy test_entries_select on public.test_entries
  for select using (
    public.is_facility_member(facility_id)
    and (
      public.facility_role(facility_id) in ('owner', 'coach')
      or athlete_id = public.my_athlete_id(facility_id)
    )
  );

drop policy if exists test_entries_write on public.test_entries;
create policy test_entries_write on public.test_entries
  for all using (public.can_write_facility(facility_id))
  with check (public.can_write_facility(facility_id));

-- ---- report_shares ----------------------------------------------------
-- Facility members manage/read share rows through these policies as
-- normal. The eventual public "open my report card via this token, no
-- login" viewer needs its own anon-safe get_shared_report(token) RPC —
-- deliberately not added here; that belongs to the Reports module.
drop policy if exists report_shares_select on public.report_shares;
create policy report_shares_select on public.report_shares
  for select using (
    public.is_facility_member(facility_id)
    and (
      public.facility_role(facility_id) in ('owner', 'coach')
      or athlete_id = public.my_athlete_id(facility_id)
    )
  );

drop policy if exists report_shares_write on public.report_shares;
create policy report_shares_write on public.report_shares
  for all using (public.can_write_facility(facility_id))
  with check (public.can_write_facility(facility_id));
