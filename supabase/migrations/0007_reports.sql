-- =====================================================================
-- STS Facility — Reports module
-- Migration 7. Requires 0001-0006.
--
-- No new tables, no new RLS policies on existing tables — every
-- athlete-scoped table already restricts the athlete role to their own
-- row (confirmed: athletes, test_entries, attendance, floor_sessions/
-- floor_logs, assessments all use the same is_facility_member +
-- owner/coach-or-own-athlete_id pattern from 0002_policies.sql). The
-- authenticated in-app report reads through those policies as-is.
--
-- The one real gap, already flagged in 0002_policies.sql's own comment:
-- report_shares' RLS requires facility membership, so it grants NO
-- anonymous access — a share link needs a narrow, purpose-built path.
-- get_shared_report() is that path: SECURITY DEFINER (bypasses RLS),
-- but every subquery inside it is hardcoded to the single athlete_id/
-- facility_id resolved from the token match — the token is the only
-- input, there is no way to ask it for a different athlete's data.
-- =====================================================================

create or replace function public.get_shared_report(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_facility_id uuid;
  v_athlete_id uuid;
  v_result jsonb;
begin
  select facility_id, athlete_id
    into v_facility_id, v_athlete_id
  from public.report_shares
  where token = p_token
    and (expires_at is null or expires_at > now())
  limit 1;

  if v_athlete_id is null then
    return null;
  end if;

  select jsonb_build_object(
    'athlete', (
      select jsonb_build_object('id', id, 'name', name, 'sport', sport, 'sex', sex)
      from public.athletes
      where id = v_athlete_id and facility_id = v_facility_id
    ),
    'metrics', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'key', key, 'label', label, 'unit', unit, 'higher_is_better', higher_is_better
      ) order by created_at), '[]'::jsonb)
      from public.metrics
      where facility_id = v_facility_id and active = true
    ),
    'testEntries', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'date', date, 'metric_key', metric_key, 'value', value
      )), '[]'::jsonb)
      from public.test_entries
      where athlete_id = v_athlete_id and facility_id = v_facility_id
    ),
    'attendance', (
      select coalesce(jsonb_agg(jsonb_build_object('date', date, 'status', status)), '[]'::jsonb)
      from public.attendance
      where athlete_id = v_athlete_id and facility_id = v_facility_id
    ),
    'floorSessions', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'date', fs.date,
        'projected', fs.projected,
        'total', coalesce(fs.asc_override, sums.total, 0)
      )), '[]'::jsonb)
      from public.floor_sessions fs
      left join (
        select session_id, sum(value) as total
        from public.floor_logs
        group by session_id
      ) sums on sums.session_id = fs.id
      where fs.athlete_id = v_athlete_id and fs.facility_id = v_facility_id
    ),
    'assessment', (
      select jsonb_build_object('psc', psc, 'assessed_on', assessed_on)
      from public.assessments
      where athlete_id = v_athlete_id and facility_id = v_facility_id
    )
  ) into v_result;

  return v_result;
end;
$$;

-- The whole point: an unauthenticated visitor with just the link needs
-- to be able to call this. Every other table/function stays locked to
-- authenticated facility members.
grant execute on function public.get_shared_report(text) to anon;
grant execute on function public.get_shared_report(text) to authenticated;
