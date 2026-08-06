-- =====================================================================
-- STS Facility — Phase 5.5: per-facility branding
-- Migration 8. Requires 0001-0007.
--
-- White-labeling is branding only — display name, logo, two accent
-- colors. Every facility runs identical logic and features; nothing
-- here branches behavior by facility_id, only appearance.
-- =====================================================================

create table if not exists public.facility_branding (
  facility_id  uuid primary key references public.facilities(id) on delete cascade,
  display_name text not null,
  logo_url     text,
  accent_color text not null default '#13be17',
  accent_dim   text not null default '#0f8f12',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.facility_branding enable row level security;

drop policy if exists facility_branding_select on public.facility_branding;
create policy facility_branding_select on public.facility_branding
  for select using (public.is_facility_member(facility_id));

-- Owner only — NOT can_write_facility (that's owner+coach). Step 3's
-- explicit rule: coaches and athletes cannot touch branding, and that
-- has to be true even if the client never hid the button.
drop policy if exists facility_branding_write on public.facility_branding;
create policy facility_branding_write on public.facility_branding
  for all using (public.facility_role(facility_id) = 'owner')
  with check (public.facility_role(facility_id) = 'owner');

-- Keep updated_at honest without trusting the client to set it.
create or replace function public.touch_facility_branding()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists facility_branding_touch on public.facility_branding;
create trigger facility_branding_touch
  before update on public.facility_branding
  for each row execute function public.touch_facility_branding();

-- ---------------------------------------------------------------------
-- Seed branding atomically with facility creation. create_facility() is
-- still the only supported way to create a facility (SECURITY DEFINER,
-- no direct INSERT policy on facilities) — this just adds one more
-- insert to the same function so a new facility looks finished
-- immediately, without a second round trip the client could skip or
-- fumble. Redefining the whole function (not ALTER) since a function
-- body can't be partially patched.
-- ---------------------------------------------------------------------
create or replace function public.create_facility(p_name text default 'My Facility')
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  fid uuid;
  v_name text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  v_name := coalesce(nullif(btrim(p_name), ''), 'My Facility');
  insert into public.facilities (name, created_by)
    values (v_name, auth.uid())
    returning id into fid;
  insert into public.facility_members (facility_id, user_id, role)
    values (fid, auth.uid(), 'owner');
  insert into public.facility_branding (facility_id, display_name)
    values (fid, v_name);
  return fid;
end;
$$;
grant execute on function public.create_facility(text) to authenticated;

-- Backfill: every facility created before this migration existed still
-- needs a branding row, or it falls back client-side with no facility
-- name to show. Same STS defaults create_facility() now seeds for new
-- ones; existing facility name carries over as the display name.
insert into public.facility_branding (facility_id, display_name)
select id, name from public.facilities
on conflict (facility_id) do nothing;

-- ---------------------------------------------------------------------
-- Storage: one bucket for facility logos. Public read — a logo has to
-- render on an anonymous share link with no auth touched at all — but
-- owner-only write, checked against the same facility_role() helper
-- every other write policy in the project uses. Path convention is
-- <facility_id>/<filename>, which is what the write policies check.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
  values ('facility-logos', 'facility-logos', true)
  on conflict (id) do nothing;

drop policy if exists facility_logos_read on storage.objects;
create policy facility_logos_read on storage.objects
  for select using (bucket_id = 'facility-logos');

drop policy if exists facility_logos_write on storage.objects;
create policy facility_logos_write on storage.objects
  for insert with check (
    bucket_id = 'facility-logos'
    and public.facility_role((storage.foldername(name))[1]::uuid) = 'owner'
  );

drop policy if exists facility_logos_update on storage.objects;
create policy facility_logos_update on storage.objects
  for update using (
    bucket_id = 'facility-logos'
    and public.facility_role((storage.foldername(name))[1]::uuid) = 'owner'
  );

drop policy if exists facility_logos_delete on storage.objects;
create policy facility_logos_delete on storage.objects
  for delete using (
    bucket_id = 'facility-logos'
    and public.facility_role((storage.foldername(name))[1]::uuid) = 'owner'
  );

-- ---------------------------------------------------------------------
-- Extend the anonymous share RPC to carry branding — a share link has
-- to show the facility's own name/logo/colors, not STS's, with zero
-- client input beyond the token. Same SECURITY DEFINER pattern as every
-- other field this function already returns; full function body
-- redefined since only the one new jsonb_build_object key changed.
-- ---------------------------------------------------------------------
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
    ),
    'branding', (
      select jsonb_build_object(
        'displayName', display_name,
        'logoUrl', logo_url,
        'accentColor', accent_color,
        'accentDim', accent_dim
      )
      from public.facility_branding
      where facility_id = v_facility_id
    )
  ) into v_result;

  return v_result;
end;
$$;

grant execute on function public.get_shared_report(text) to anon;
grant execute on function public.get_shared_report(text) to authenticated;
