-- =====================================================================
-- STS Facility — per-athlete training days
-- Migration 10. Requires 0001-0009.
--
-- A program has its training days (e.g. Mon/Tue/Thu/Fri). Until now every
-- athlete on it trained exactly those days. This lets an athlete have
-- their own weekdays instead (e.g. Mon/Wed/Fri), so two athletes in the
-- same group can be on different schedules. Floor Log builds that
-- athlete's calendar — week, session A/B/C, PSC split — from these days.
--
-- NULL = follow the program's days (what every athlete does today, so
-- nothing changes for anyone until a coach sets custom days).
-- Day TYPES (lifting/conditioning) still come from the program, by
-- position — that's app logic (floorEngine.athleteDays), not stored here.
--
-- Safe to re-run. RLS is unchanged: this is just a column on athletes,
-- covered by the existing athletes policies (coach/owner write, athlete
-- reads only their own row).
-- =====================================================================

alter table public.athletes add column if not exists training_days text[];

alter table public.athletes drop constraint if exists athletes_training_days_valid;
alter table public.athletes
  add constraint athletes_training_days_valid check (
    training_days is null
    or (
      cardinality(training_days) > 0
      and training_days <@ array['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']::text[]
    )
  );
