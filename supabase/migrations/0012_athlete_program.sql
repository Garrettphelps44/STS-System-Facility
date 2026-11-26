-- =====================================================================
-- STS Facility — each athlete's program
-- Migration 12. Requires 0001-0011.
--
-- Floor Log had one Program dropdown for everyone, so picking a program
-- for one athlete carried over to the next. This gives each athlete
-- their own program: Floor Log shows and uses the athlete's program, and
-- changing it assigns it to that athlete only.
--
-- NULL = not assigned yet: Floor Log uses the facility's default program
-- (the most recently created one) for them.
--
-- Safe to re-run. RLS is unchanged: a column on athletes, covered by the
-- existing athletes policies (coach/owner write, athlete reads own row).
-- =====================================================================

alter table public.athletes add column if not exists program_id uuid;

-- Composite foreign key, same pattern as every other facility-scoped
-- reference: an athlete can't be assigned another facility's program.
alter table public.athletes drop constraint if exists athletes_program_fk;
alter table public.athletes
  add constraint athletes_program_fk
  foreign key (program_id, facility_id) references public.programs (id, facility_id);

-- Deleting a program unassigns its athletes (back to the default program)
-- instead of being blocked by them. A BEFORE DELETE trigger rather than
-- ON DELETE SET NULL because the key is composite and facility_id must
-- stay set (column-list SET NULL needs Postgres 15+; this works anywhere).
create or replace function public.unassign_athletes_when_program_deleted()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.athletes
  set program_id = null
  where program_id = old.id and facility_id = old.facility_id;
  return old;
end;
$$;

drop trigger if exists programs_unassign_athletes on public.programs;
create trigger programs_unassign_athletes
  before delete on public.programs
  for each row execute function public.unassign_athletes_when_program_deleted();
