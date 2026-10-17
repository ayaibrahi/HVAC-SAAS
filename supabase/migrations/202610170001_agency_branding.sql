-- PREPARED ONLY: requires separate owner approval before remote application.
begin;

create table public.agency_branding_assets (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  object_key text not null unique,
  mime_type text not null check (mime_type = 'image/png'),
  byte_length integer not null check (byte_length between 1 and 1048576),
  width integer not null check (width between 1 and 600),
  height integer not null check (height between 1 and 240),
  created_at timestamptz not null default now(),
  unique (id, agency_id),
  unique (agency_id, sha256),
  check (object_key = agency_id::text || '/' || sha256 || '.png')
);

create table public.agency_branding (
  agency_id uuid primary key references public.agencies(id) on delete cascade,
  active_asset_id uuid,
  updated_at timestamptz not null default now(),
  foreign key (active_asset_id, agency_id)
    references public.agency_branding_assets(id, agency_id)
    deferrable initially deferred
);

alter table public.proposal_delivery_snapshots add column branding_asset_id uuid;
alter table public.proposal_delivery_snapshots
  add constraint proposal_snapshot_branding_ownership_fk
  foreign key (branding_asset_id, agency_id)
  references public.agency_branding_assets(id, agency_id)
  deferrable initially deferred;
create index proposal_snapshot_branding_asset_idx
  on public.proposal_delivery_snapshots(branding_asset_id)
  where branding_asset_id is not null;

alter table public.agency_branding_assets enable row level security;
alter table public.agency_branding enable row level security;
revoke all on public.agency_branding_assets, public.agency_branding
  from public, anon, authenticated, service_role;
grant select on public.agency_branding_assets, public.agency_branding to authenticated, service_role;
grant insert on public.agency_branding_assets to service_role;
create policy "Owners read branding assets" on public.agency_branding_assets
  for select to authenticated using (public.current_user_owns_agency(agency_id));
create policy "Owners read active branding" on public.agency_branding
  for select to authenticated using (public.current_user_owns_agency(agency_id));

create function public.set_agency_branding_asset(p_agency_id uuid, p_user_id uuid, p_asset_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.agencies
    where id = p_agency_id and owner_user_id = p_user_id for update;
  if not found then raise exception 'agency_user_not_authorized' using errcode = '42501'; end if;
  if p_asset_id is not null and not exists (
    select 1 from public.agency_branding_assets a
    join storage.objects o on o.bucket_id = 'agency-branding' and o.name = a.object_key
    where a.id = p_asset_id and a.agency_id = p_agency_id
  ) then raise exception 'branding_asset_not_found' using errcode = '42501'; end if;
  insert into public.agency_branding(agency_id, active_asset_id)
    values (p_agency_id, p_asset_id)
    on conflict (agency_id) do update set active_asset_id = excluded.active_asset_id, updated_at = now();
end;
$$;
revoke execute on function public.set_agency_branding_asset(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.set_agency_branding_asset(uuid, uuid, uuid) to service_role;

create function public.freeze_snapshot_branding()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_name text; v_asset uuid;
begin
  if TG_OP = 'UPDATE' then
    if new.branding_asset_id is distinct from old.branding_asset_id
      or new.agency_display_name is distinct from old.agency_display_name then
      raise exception 'snapshot_branding_is_immutable';
    end if;
    return new;
  end if;
  -- Same agency-row lock as selection changes: freeze one consistent identity.
  select name into v_name from public.agencies
    where id = new.agency_id and owner_user_id = new.created_by for share;
  if not found then raise exception 'agency_user_not_authorized' using errcode = '42501'; end if;
  select active_asset_id into v_asset from public.agency_branding where agency_id = new.agency_id;
  new.agency_display_name := v_name;
  new.branding_asset_id := v_asset;
  return new;
end;
$$;
revoke execute on function public.freeze_snapshot_branding() from public, anon, authenticated, service_role;
create trigger proposal_snapshot_freeze_branding
  before insert or update on public.proposal_delivery_snapshots
  for each row execute function public.freeze_snapshot_branding();

create function public.reject_branding_asset_update()
returns trigger language plpgsql set search_path = '' as $$
begin raise exception 'branding_asset_is_immutable'; end;
$$;
revoke execute on function public.reject_branding_asset_update() from public, anon, authenticated, service_role;
create trigger agency_branding_assets_immutable before update on public.agency_branding_assets
  for each row execute function public.reject_branding_asset_update();

-- Never silently repurpose an existing bucket with unknown policies or content.
do $$ begin
  if exists (select 1 from storage.buckets where id = 'agency-branding') then
    raise exception 'branding_bucket_already_exists_review_required';
  end if;
end $$;
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
  values ('agency-branding', 'agency-branding', false, 1048576, array['image/png']);

-- Only the authenticated application server accesses objects. Restrictive policy
-- also blocks access granted by any unrelated permissive Storage policy.
create policy "Branding objects are server only" on storage.objects
  as restrictive for all to anon, authenticated
  using (bucket_id <> 'agency-branding')
  with check (bucket_id <> 'agency-branding');

commit;
