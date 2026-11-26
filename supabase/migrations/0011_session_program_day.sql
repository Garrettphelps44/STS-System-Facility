-- =====================================================================
-- STS Facility — pick the program day per Floor Log session
-- Migration 11. Requires 0001-0010.
--
-- Training days come from the program built in Build Program (e.g.
-- Mon/Tue/Thu/Fri = Day 1-4). In Floor Log the coach picks which of
-- those program days an athlete is doing in a given session. It defaults
-- to the program's day for that date, so athletes in the same group can
-- be on different days (a make-up, a different rotation) just by picking.
--
-- This replaces 0010's per-athlete weekday schedule, which never shipped
-- and isn't used by any code: its column is dropped here.
--
-- Safe to re-run. RLS is unchanged: both are columns on tables already
-- covered by their existing policies.
-- =====================================================================

-- 1. Remove 0010's unused per-athlete weekday schedule.
alter table public.athletes drop constraint if exists athletes_training_days_valid;
alter table public.athletes drop column if exists training_days;

-- 2. Which program day this session is: 0 = Day 1, 1 = Day 2, ... in the
--    order the program's training days fall in the week. NULL = whatever
--    the program has scheduled for that date (the default).
alter table public.floor_sessions add column if not exists day_index int;

alter table public.floor_sessions drop constraint if exists floor_sessions_day_index_valid;
alter table public.floor_sessions
  add constraint floor_sessions_day_index_valid
  check (day_index is null or (day_index >= 0 and day_index < 7));
