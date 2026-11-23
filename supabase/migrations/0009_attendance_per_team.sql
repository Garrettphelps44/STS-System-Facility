-- =====================================================================
-- STS Facility — attendance per team
-- Migration 9. Requires 0001-0008.
--
-- Until now an attendance mark was one row per athlete per date with no
-- team on it, so an athlete on two teams showed the SAME mark on both
-- and changing it on one changed it on the other. This puts the team on
-- the mark: one row per athlete + team + date.
--
-- Safe to re-run: every step is idempotent.
-- =====================================================================

-- 1. The team a mark belongs to. Nullable on purpose: a mark whose team
--    was deleted (see step 4) or that belongs to an athlete who was on no
--    team when this ran keeps counting toward that athlete's Report, it
--    just isn't shown in any team's grid.
alter table public.attendance add column if not exists team_id uuid;
create index if not exists attendance_team_idx on public.attendance(team_id);

-- 2. Replace unique (athlete_id, date) with unique (athlete_id, team_id,
--    date). The old constraint's name is looked up rather than assumed.
do $$
declare c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.attendance'::regclass
      and con.contype = 'u'
      and (
        select array_agg(att.attname::text order by att.attname::text)
        from unnest(con.conkey) as k
        join pg_attribute att on att.attrelid = con.conrelid and att.attnum = k
      ) = array['athlete_id', 'date']
  loop
    execute format('alter table public.attendance drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.attendance drop constraint if exists attendance_athlete_team_date_key;
alter table public.attendance
  add constraint attendance_athlete_team_date_key unique (athlete_id, team_id, date);

-- 3. Composite foreign key, same pattern as every other facility-scoped
--    child table: a mark can't claim facility A while pointing at
--    facility B's team. (team_id null = not checked, so unassigned marks
--    are fine.)
alter table public.attendance drop constraint if exists attendance_team_fk;
alter table public.attendance
  add constraint attendance_team_fk
  foreign key (team_id, facility_id) references public.teams (id, facility_id);

-- 4. Deleting a team keeps its attendance history: detach the marks
--    (team_id -> null) instead of deleting them or blocking the delete.
--    Done as a BEFORE DELETE trigger rather than ON DELETE SET NULL
--    because the foreign key is composite and facility_id must stay set —
--    a column-list SET NULL needs Postgres 15+, this works on any version.
--    SECURITY DEFINER so it isn't blocked by RLS; it only ever touches
--    rows of the team (and facility) being deleted.
create or replace function public.keep_attendance_when_team_deleted()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.attendance
  set team_id = null
  where team_id = old.id and facility_id = old.facility_id;
  return old;
end;
$$;

drop trigger if exists teams_keep_attendance on public.teams;
create trigger teams_keep_attendance
  before delete on public.teams
  for each row execute function public.keep_attendance_when_team_deleted();

-- 5. Existing marks have no team. Copy each one onto EVERY team the
--    athlete is on (which is what the screen showed until now), then drop
--    the unassigned original wherever a copy was made. An athlete on no
--    team keeps his unassigned marks.
insert into public.attendance (facility_id, athlete_id, team_id, date, status, created_at)
select a.facility_id, a.athlete_id, tm.team_id, a.date, a.status, a.created_at
from public.attendance a
join public.team_members tm
  on tm.athlete_id = a.athlete_id and tm.facility_id = a.facility_id
where a.team_id is null
on conflict (athlete_id, team_id, date) do nothing;

delete from public.attendance a
where a.team_id is null
  and exists (
    select 1 from public.team_members tm
    where tm.athlete_id = a.athlete_id and tm.facility_id = a.facility_id
  );

-- RLS is unchanged: the existing attendance policies key on facility_id /
-- athlete_id, which are exactly what they were.
