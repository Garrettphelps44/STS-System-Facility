-- =====================================================================
-- STS Facility — invites
-- Migration 3. Requires 0001_schema.sql and 0002_policies.sql.
--
-- Phase 2's facility_members_insert policy deliberately only lets an
-- EXISTING owner add members (a self-insert policy would let any logged
-- -in user grant themselves 'owner' in any facility). That's correct,
-- but it means a coach/athlete signing up on their own has no path into
-- an existing facility without one. This migration adds that path: an
-- owner/coach generates a token good for one role (and, for an athlete
-- invite, one specific athlete record); the invited person redeems it
-- through redeem_invite() below, which — like create_facility() —
-- is a SECURITY DEFINER RPC that inserts the membership row on the
-- caller's behalf after validating the token, rather than loosening the
-- INSERT policy itself.
-- =====================================================================

create table if not exists public.invites (
  id          uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities(id) on delete cascade,
  token       text not null unique default encode(gen_random_bytes(16), 'hex'),
  role        text not null check (role in ('coach', 'athlete')),
  -- Required when role = 'athlete' (the invite pins the login to one
  -- athlete record, same as facility_members.athlete_id does after
  -- redemption); null for a coach invite.
  athlete_id  uuid,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default (now() + interval '14 days'),
  redeemed_at timestamptz,
  redeemed_by uuid references auth.users(id) on delete set null,
  foreign key (athlete_id, facility_id) references public.athletes (id, facility_id) on delete set null
);
create index if not exists invites_facility_idx on public.invites(facility_id);

alter table public.invites enable row level security;

-- Owners/coaches manage invites for their own facility. There's no
-- anon-safe "preview this invite" read path yet — the join flow submits
-- the token straight to redeem_invite() and reports success or failure,
-- it doesn't show facility details before redeeming. Fine for now; add
-- a preview_invite() RPC later if that UX gap matters.
drop policy if exists invites_select on public.invites;
create policy invites_select on public.invites
  for select using (public.can_write_facility(facility_id));

drop policy if exists invites_write on public.invites;
create policy invites_write on public.invites
  for all using (public.can_write_facility(facility_id))
  with check (public.can_write_facility(facility_id));

create or replace function public.redeem_invite(p_token text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  inv public.invites;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select * into inv from public.invites where token = p_token for update;
  if not found then
    raise exception 'invite not found';
  end if;
  if inv.redeemed_at is not null then
    raise exception 'invite already used';
  end if;
  if inv.expires_at < now() then
    raise exception 'invite expired';
  end if;
  if exists (
    select 1 from public.facility_members
    where facility_id = inv.facility_id and user_id = auth.uid()
  ) then
    raise exception 'already a member of this facility';
  end if;

  insert into public.facility_members (facility_id, user_id, role, athlete_id)
    values (inv.facility_id, auth.uid(), inv.role, inv.athlete_id);

  update public.invites set redeemed_at = now(), redeemed_by = auth.uid() where id = inv.id;

  return inv.facility_id;
end;
$$;
grant execute on function public.redeem_invite(text) to authenticated;
