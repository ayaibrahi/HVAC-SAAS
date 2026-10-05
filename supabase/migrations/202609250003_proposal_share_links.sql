create table if not exists public.proposal_share_links (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  delivery_snapshot_id uuid not null,
  token_hash text not null
    check (length(token_hash) = 64 and token_hash ~ '^[a-f0-9]{64}$'),
  status text not null default 'active'
    check (status in ('active', 'revoked')),
  expires_at timestamptz,
  created_by uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (id, agency_id),
  unique (token_hash),
  foreign key (delivery_snapshot_id, agency_id)
    references public.proposal_delivery_snapshots(id, agency_id)
    on delete cascade,
  check (
    expires_at is null
    or expires_at > created_at
  ),
  check (
    (status = 'active' and revoked_at is null)
    or (status = 'revoked' and revoked_at is not null)
  )
);

create index if not exists proposal_share_links_agency_id_idx
  on public.proposal_share_links(agency_id);

create index if not exists proposal_share_links_delivery_snapshot_id_idx
  on public.proposal_share_links(delivery_snapshot_id);

create unique index if not exists proposal_share_links_active_snapshot_idx
  on public.proposal_share_links(delivery_snapshot_id)
  where status = 'active';

revoke all on table public.proposal_share_links from anon;
revoke all on table public.proposal_share_links from authenticated;

grant select (
  id,
  agency_id,
  delivery_snapshot_id,
  status,
  expires_at,
  created_at,
  revoked_at
) on public.proposal_share_links to authenticated;

create or replace function public.create_proposal_share_link(
  p_agency_id uuid,
  p_delivery_snapshot_id uuid,
  p_created_by uuid,
  p_token_hash text,
  p_expires_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_share_link_id uuid;
  v_expires_at timestamptz;
begin
  if p_expires_at is not null and p_expires_at <= now() then
    raise exception 'share_link_expiration_invalid';
  end if;

  select coalesce(p_expires_at, now() + interval '30 days')
  into v_expires_at;

  perform 1
  from public.proposal_delivery_snapshots
  where id = p_delivery_snapshot_id
    and agency_id = p_agency_id
  for update;

  if not found then
    raise exception 'delivery_snapshot_not_found';
  end if;

  if not exists (
    select 1
    from public.agencies
    where id = p_agency_id
      and owner_user_id = p_created_by
  ) then
    raise exception 'agency_user_not_authorized';
  end if;

  update public.proposal_share_links
  set status = 'revoked',
      revoked_at = now()
  where agency_id = p_agency_id
    and delivery_snapshot_id = p_delivery_snapshot_id
    and status = 'active';

  insert into public.proposal_share_links (
    agency_id,
    delivery_snapshot_id,
    token_hash,
    status,
    expires_at,
    created_by
  )
  values (
    p_agency_id,
    p_delivery_snapshot_id,
    p_token_hash,
    'active',
    v_expires_at,
    p_created_by
  )
  returning id into v_share_link_id;

  return v_share_link_id;
end;
$$;

revoke all on function public.create_proposal_share_link(
  uuid,
  uuid,
  uuid,
  text,
  timestamptz
) from public;

revoke all on function public.create_proposal_share_link(
  uuid,
  uuid,
  uuid,
  text,
  timestamptz
) from authenticated;

grant execute on function public.create_proposal_share_link(
  uuid,
  uuid,
  uuid,
  text,
  timestamptz
) to service_role;

create or replace function public.revoke_proposal_share_link(
  p_agency_id uuid,
  p_delivery_snapshot_id uuid,
  p_revoked_by uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_revoked_count integer;
begin
  perform 1
  from public.proposal_delivery_snapshots
  where id = p_delivery_snapshot_id
    and agency_id = p_agency_id
  for update;

  if not found then
    raise exception 'delivery_snapshot_not_found';
  end if;

  if not exists (
    select 1
    from public.agencies
    where id = p_agency_id
      and owner_user_id = p_revoked_by
  ) then
    raise exception 'agency_user_not_authorized';
  end if;

  update public.proposal_share_links
  set status = 'revoked',
      revoked_at = now()
  where agency_id = p_agency_id
    and delivery_snapshot_id = p_delivery_snapshot_id
    and status = 'active';

  get diagnostics v_revoked_count = row_count;

  return v_revoked_count;
end;
$$;

revoke all on function public.revoke_proposal_share_link(
  uuid,
  uuid,
  uuid
) from public;

revoke all on function public.revoke_proposal_share_link(
  uuid,
  uuid,
  uuid
) from authenticated;

grant execute on function public.revoke_proposal_share_link(
  uuid,
  uuid,
  uuid
) to service_role;

alter table public.proposal_share_links enable row level security;

drop policy if exists "Agency owners can read proposal share links"
on public.proposal_share_links;

create policy "Agency owners can read proposal share links"
on public.proposal_share_links
for select
to authenticated
using (public.current_user_owns_agency(agency_id));
