-- =====================================================================
-- RLS ISOLATION TEST
--
-- Proves the multi-facility isolation from 0001_schema.sql /
-- 0002_policies.sql actually holds: creates two facilities with two
-- owner users (plus one athlete-role user), inserts data into each,
-- then reads as each user and confirms cross-facility rows never come
-- back — including the athlete-role case, where a facility-A athlete
-- must not even see their own facility's OTHER athlete's rows.
--
-- HOW TO RUN
--   Paste this whole file into the Supabase SQL Editor and run it, or:
--     supabase db execute -f supabase/tests/isolation_test.sql
--   Either way it must run as the `postgres` / service-role connection
--   (it inserts directly into auth.users, which normal API roles can't
--   do) — the SQL Editor already connects that way.
--
--   RUN THIS ONLY AGAINST A DEV/STAGING PROJECT. It creates and deletes
--   throwaway auth.users rows with fixed test UUIDs.
--
-- HOW TO READ THE OUTPUT
--   Every check inserts one row into a scratch results table instead of
--   raising immediately, so one failure doesn't stop the rest of the
--   suite from running. The final SELECT at the bottom prints every
--   check with PASS/FAIL, and the last statement raises an exception
--   (visible as a red ERROR) if anything failed. All PASS + no ERROR at
--   the bottom = isolation confirmed.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Fixed test IDs (deterministic so this script is safe to re-run)
-- ---------------------------------------------------------------------
--   USER_A_OWNER   11111111-1111-1111-1111-111111111111  (facility A, owner)
--   USER_A_ATHLETE 11111111-1111-1111-1111-111111111112  (facility A, athlete role, pinned to ATHLETE_A1)
--   USER_B_OWNER   22222222-2222-2222-2222-222222222222  (facility B, owner)
--   FACILITY_A     aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa
--   FACILITY_B     bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb
--   ATHLETE_A1     a1111111-0000-0000-0000-000000000001  (facility A — USER_A_ATHLETE's own record)
--   ATHLETE_A2     a2222222-0000-0000-0000-000000000002  (facility A — a teammate, NOT USER_A_ATHLETE's own record)
--   ATHLETE_B1     b1111111-0000-0000-0000-000000000001  (facility B)
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- 1. Clean slate + scratch results table
-- ---------------------------------------------------------------------
delete from public.facilities where id in
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
delete from auth.users where id in
  ('11111111-1111-1111-1111-111111111111',
   '11111111-1111-1111-1111-111111111112',
   '22222222-2222-2222-2222-222222222222');

drop table if exists _test_results;
create temporary table _test_results (
  seq         serial primary key,
  check_name  text not null,
  passed      boolean not null,
  detail      text
);
-- Assertions below run as role `authenticated`, which isn't the owner of
-- this temp table (the connecting role, typically `postgres`, is) — grant
-- it explicitly so the impersonated checks can log their own results.
grant select, insert on _test_results to authenticated;
-- `seq serial` implicitly created a sequence backing the default; INSERT
-- needs nextval() on it too, which is a SEPARATE privilege from the table
-- grant above — without this, every impersonated INSERT below fails with
-- "permission denied for sequence _test_results_seq_seq".
do $$
begin
  execute format('grant usage, select on sequence %s to authenticated', pg_get_serial_sequence('_test_results', 'seq'));
end $$;

-- ---------------------------------------------------------------------
-- 2. Seed data — run as the elevated connection role (bypasses RLS as
--    table owner, same as any migration), so no impersonation needed yet.
-- ---------------------------------------------------------------------

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner-a@isolation-test.local',   '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('11111111-1111-1111-1111-111111111112', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'athlete-a@isolation-test.local', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner-b@isolation-test.local',   '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb)
on conflict (id) do nothing;
-- If this insert errors on a NOT NULL column, your Supabase project's
-- auth.users schema requires more columns than this minimal set — add
-- the missing one(s) (commonly: confirmation_token, recovery_token,
-- email_change_token_new, email_change — Postgres empty string '' is a
-- safe value for all of them).

insert into public.facilities (id, name, created_by)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Isolation Test — Facility A', '11111111-1111-1111-1111-111111111111'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Isolation Test — Facility B', '22222222-2222-2222-2222-222222222222');

insert into public.athletes (id, facility_id, name, sport, sex, grad_year)
values
  ('a1111111-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Athlete A1 (self)',     'Football', 'M', 2027),
  ('a2222222-0000-0000-0000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Athlete A2 (teammate)', 'Football', 'M', 2027),
  ('b1111111-0000-0000-0000-000000000001', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Athlete B1',            'Soccer',   'F', 2026);

insert into public.facility_members (facility_id, user_id, role, athlete_id)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'owner',   null),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111112', 'athlete', 'a1111111-0000-0000-0000-000000000001'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'owner',   null);

insert into public.metrics (facility_id, key, label, unit, higher_is_better)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'vert', 'Vertical', 'in', true),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'vert', 'Vertical', 'in', true);

insert into public.test_entries (facility_id, athlete_id, date, metric_key, value)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a1111111-0000-0000-0000-000000000001', current_date, 'vert', 28),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a2222222-0000-0000-0000-000000000002', current_date, 'vert', 26),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'b1111111-0000-0000-0000-000000000001', current_date, 'vert', 22);

insert into public.floor_logs (facility_id, athlete_id, date, exercise, sets, reps, weight)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a1111111-0000-0000-0000-000000000001', current_date, 'Back Squat', 1, 5, 225),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a2222222-0000-0000-0000-000000000002', current_date, 'Back Squat', 1, 5, 205),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'b1111111-0000-0000-0000-000000000001', current_date, 'Trap Bar Deadlift', 1, 5, 275);

insert into public.attendance (facility_id, athlete_id, date, status)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a1111111-0000-0000-0000-000000000001', current_date, 'present'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'b1111111-0000-0000-0000-000000000001', current_date, 'present');

insert into public.programs (facility_id, name, system, constraints, start_date)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Facility A Fall Program', 'sts-v1', '{}'::jsonb, current_date),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Facility B Fall Program', 'sts-v1', '{}'::jsonb, current_date);

-- ---------------------------------------------------------------------
-- 3. Assertion checks — each block impersonates one user (SET LOCAL
--    ROLE authenticated + the request.jwt.claims sub PostgREST would
--    set for that user) inside its own transaction, so RLS is actually
--    enforced rather than bypassed as it would be under the elevated
--    connection role used for seeding above.
-- ---------------------------------------------------------------------

-- 3a. Positive control: owner A can see their own facility's data.
--     (Runs first so a "PASS" on every negative check below can't just
--     mean RLS is silently blocking everything, including legit reads.)
begin;
  set local role authenticated;
  select set_config('request.jwt.claims', json_build_object('sub', '11111111-1111-1111-1111-111111111111', 'role', 'authenticated')::text, true);
  insert into _test_results (check_name, passed, detail)
  select
    'owner A sees own facility athletes (expect 2)',
    count(*) = 2,
    'got ' || count(*) || ' row(s)'
  from public.athletes where facility_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
commit;

-- 3b. Negative: owner A reading facility B's athletes returns nothing.
begin;
  set local role authenticated;
  select set_config('request.jwt.claims', json_build_object('sub', '11111111-1111-1111-1111-111111111111', 'role', 'authenticated')::text, true);
  insert into _test_results (check_name, passed, detail)
  select
    'owner A cannot read facility B athletes',
    count(*) = 0,
    'got ' || count(*) || ' row(s)'
  from public.athletes where facility_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
commit;

-- 3c. Negative: owner A reading facility B's floor_logs returns nothing.
begin;
  set local role authenticated;
  select set_config('request.jwt.claims', json_build_object('sub', '11111111-1111-1111-1111-111111111111', 'role', 'authenticated')::text, true);
  insert into _test_results (check_name, passed, detail)
  select
    'owner A cannot read facility B floor_logs',
    count(*) = 0,
    'got ' || count(*) || ' row(s)'
  from public.floor_logs where facility_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
commit;

-- 3d. Negative: owner A reading facility B's attendance returns nothing.
begin;
  set local role authenticated;
  select set_config('request.jwt.claims', json_build_object('sub', '11111111-1111-1111-1111-111111111111', 'role', 'authenticated')::text, true);
  insert into _test_results (check_name, passed, detail)
  select
    'owner A cannot read facility B attendance',
    count(*) = 0,
    'got ' || count(*) || ' row(s)'
  from public.attendance where facility_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
commit;

-- 3e. Negative: owner A reading facility B's test_entries returns nothing.
begin;
  set local role authenticated;
  select set_config('request.jwt.claims', json_build_object('sub', '11111111-1111-1111-1111-111111111111', 'role', 'authenticated')::text, true);
  insert into _test_results (check_name, passed, detail)
  select
    'owner A cannot read facility B test_entries',
    count(*) = 0,
    'got ' || count(*) || ' row(s)'
  from public.test_entries where facility_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
commit;

-- 3f. Negative: owner A reading facility B's programs returns nothing.
begin;
  set local role authenticated;
  select set_config('request.jwt.claims', json_build_object('sub', '11111111-1111-1111-1111-111111111111', 'role', 'authenticated')::text, true);
  insert into _test_results (check_name, passed, detail)
  select
    'owner A cannot read facility B programs',
    count(*) = 0,
    'got ' || count(*) || ' row(s)'
  from public.programs where facility_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
commit;

-- 3g. Athlete-role own-record check: USER_A_ATHLETE reading athletes in
--     their OWN facility sees exactly one row, and it's their own —
--     not their teammate ATHLETE_A2's.
begin;
  set local role authenticated;
  select set_config('request.jwt.claims', json_build_object('sub', '11111111-1111-1111-1111-111111111112', 'role', 'authenticated')::text, true);
  insert into _test_results (check_name, passed, detail)
  select
    'athlete A sees only own athlete row within facility A',
    count(*) = 1 and bool_and(id = 'a1111111-0000-0000-0000-000000000001'),
    'got ' || count(*) || ' row(s): ' || coalesce(string_agg(id::text, ', '), '(none)')
  from public.athletes where facility_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
commit;

-- 3h. Athlete-role own-record check on a child table: USER_A_ATHLETE
--     cannot see teammate ATHLETE_A2's floor_logs, even within the same
--     facility.
begin;
  set local role authenticated;
  select set_config('request.jwt.claims', json_build_object('sub', '11111111-1111-1111-1111-111111111112', 'role', 'authenticated')::text, true);
  insert into _test_results (check_name, passed, detail)
  select
    'athlete A cannot read teammate''s floor_logs',
    count(*) = 0,
    'got ' || count(*) || ' row(s)'
  from public.floor_logs where athlete_id = 'a2222222-0000-0000-0000-000000000002';
commit;

-- 3i. Athlete-role own-record check, positive half: USER_A_ATHLETE CAN
--     see their own floor_logs (proves 3h isn't just blocking everything).
begin;
  set local role authenticated;
  select set_config('request.jwt.claims', json_build_object('sub', '11111111-1111-1111-1111-111111111112', 'role', 'authenticated')::text, true);
  insert into _test_results (check_name, passed, detail)
  select
    'athlete A can read own floor_logs',
    count(*) = 1,
    'got ' || count(*) || ' row(s)'
  from public.floor_logs where athlete_id = 'a1111111-0000-0000-0000-000000000001';
commit;

-- 3j. Athlete-role cross-facility check: USER_A_ATHLETE reading facility
--     B returns nothing (facility isolation applies to every role).
begin;
  set local role authenticated;
  select set_config('request.jwt.claims', json_build_object('sub', '11111111-1111-1111-1111-111111111112', 'role', 'authenticated')::text, true);
  insert into _test_results (check_name, passed, detail)
  select
    'athlete A cannot read facility B athletes',
    count(*) = 0,
    'got ' || count(*) || ' row(s)'
  from public.athletes where facility_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
commit;

-- 3k. Bonus — write isolation, not just read: owner A attempting to
--     INSERT a row claiming facility B must be rejected by the WITH
--     CHECK clause, not merely hidden afterward.
--
--     Note this block ends in COMMIT, not ROLLBACK: the inner
--     BEGIN/EXCEPTION in the DO block already establishes its own
--     implicit savepoint, so when the insert is correctly rejected,
--     only that failed insert is discarded — the _test_results row
--     logged in the EXCEPTION branch survives and needs to be
--     committed to show up in the report below. (A ROLLBACK here would
--     silently erase this check's own result along with everything
--     else.) In the unexpected case where the bad insert actually
--     succeeds, the leftover row is still swept up by the cascading
--     DELETE in step 5 below.
begin;
  set local role authenticated;
  select set_config('request.jwt.claims', json_build_object('sub', '11111111-1111-1111-1111-111111111111', 'role', 'authenticated')::text, true);
  do $$
  begin
    begin
      insert into public.attendance (facility_id, athlete_id, date, status)
      values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'b1111111-0000-0000-0000-000000000001', current_date + 1, 'present');
      insert into _test_results (check_name, passed, detail)
      values ('owner A cannot write into facility B attendance', false, 'insert succeeded — RLS did not block it');
    exception when others then
      insert into _test_results (check_name, passed, detail)
      values ('owner A cannot write into facility B attendance', true, 'insert correctly rejected: ' || sqlerrm);
    end;
  end $$;
commit;

-- ---------------------------------------------------------------------
-- 4. Report — back on the elevated connection role.
-- ---------------------------------------------------------------------
select
  seq,
  case when passed then 'PASS' else 'FAIL' end as result,
  check_name,
  detail
from _test_results
order by seq;

do $$
declare fail_count int;
begin
  select count(*) into fail_count from _test_results where not passed;
  if fail_count > 0 then
    raise exception 'ISOLATION TEST FAILED: % check(s) did not pass — see the report above', fail_count;
  end if;
  raise notice 'ISOLATION TEST PASSED: all % checks confirmed cross-facility isolation holds', (select count(*) from _test_results);
end $$;

-- ---------------------------------------------------------------------
-- 5. Teardown (safe to skip — step 1 re-cleans on the next run anyway)
-- ---------------------------------------------------------------------
delete from public.facilities where id in
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
delete from auth.users where id in
  ('11111111-1111-1111-1111-111111111111',
   '11111111-1111-1111-1111-111111111112',
   '22222222-2222-2222-2222-222222222222');
