create table if not exists public.proposal_delivery_snapshots (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  proposal_id uuid not null,
  status text not null default 'active'
    check (status in ('active', 'superseded')),
  title text not null check (length(trim(title)) > 0),
  summary text not null default '',
  scope text not null default '',
  next_step text not null default '',
  currency text not null
    check (currency in ('USD', 'EUR', 'GBP', 'CAD', 'AUD')),
  subtotal_amount numeric(12, 2) not null check (subtotal_amount >= 0),
  discount_type text not null
    check (discount_type in ('none', 'fixed', 'percentage')),
  discount_value numeric(12, 2) not null check (discount_value >= 0),
  discount_amount numeric(12, 2) not null check (discount_amount >= 0),
  total_amount numeric(12, 2) not null check (total_amount >= 0),
  agency_display_name text not null
    check (length(trim(agency_display_name)) > 0),
  prospect_display_name text not null
    check (length(trim(prospect_display_name)) > 0),
  prospect_website_url text,
  line_items jsonb not null
    check (
      jsonb_typeof(line_items) = 'array'
      and jsonb_array_length(line_items) > 0
    ),
  created_by uuid not null references public.users(id) on delete restrict,
  source_proposal_updated_at timestamptz not null,
  created_at timestamptz not null default now(),
  superseded_at timestamptz,
  unique (id, agency_id),
  unique (proposal_id, source_proposal_updated_at),
  foreign key (proposal_id, agency_id)
    references public.proposals(id, agency_id)
    on delete cascade,
  check (
    discount_amount <= subtotal_amount
    and total_amount = subtotal_amount - discount_amount
  ),
  check (
    (status = 'active' and superseded_at is null)
    or (status = 'superseded' and superseded_at is not null)
  )
);

create index if not exists proposal_delivery_snapshots_agency_id_idx
  on public.proposal_delivery_snapshots(agency_id);

create index if not exists proposal_delivery_snapshots_proposal_id_idx
  on public.proposal_delivery_snapshots(proposal_id);

create unique index if not exists proposal_delivery_snapshots_active_proposal_idx
  on public.proposal_delivery_snapshots(proposal_id)
  where status = 'active';

create or replace function public.create_proposal_delivery_snapshot(
  p_agency_id uuid,
  p_proposal_id uuid,
  p_created_by uuid,
  p_agency_display_name text,
  p_prospect_display_name text,
  p_prospect_website_url text,
  p_title text,
  p_summary text,
  p_scope text,
  p_next_step text,
  p_currency text,
  p_subtotal_amount numeric,
  p_discount_type text,
  p_discount_value numeric,
  p_discount_amount numeric,
  p_total_amount numeric,
  p_line_items jsonb,
  p_source_proposal_updated_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing_snapshot_id uuid;
  v_snapshot_id uuid;
  v_proposal_status text;
  v_proposal_updated_at timestamptz;
begin
  select status, updated_at
  into v_proposal_status, v_proposal_updated_at
  from public.proposals
  where id = p_proposal_id
    and agency_id = p_agency_id
  for update;

  if not found then
    raise exception 'proposal_not_found';
  end if;

  if v_proposal_status <> 'ready' then
    raise exception 'proposal_not_ready';
  end if;

  if v_proposal_updated_at <> p_source_proposal_updated_at then
    raise exception 'proposal_state_changed';
  end if;

  if not exists (
    select 1
    from public.agencies
    where id = p_agency_id
      and owner_user_id = p_created_by
  ) then
    raise exception 'agency_user_not_authorized';
  end if;

  select id
  into v_existing_snapshot_id
  from public.proposal_delivery_snapshots
  where proposal_id = p_proposal_id
    and agency_id = p_agency_id
    and source_proposal_updated_at = p_source_proposal_updated_at
  order by created_at desc
  limit 1;

  if v_existing_snapshot_id is not null then
    return v_existing_snapshot_id;
  end if;

  update public.proposal_delivery_snapshots
  set status = 'superseded',
      superseded_at = now()
  where proposal_id = p_proposal_id
    and agency_id = p_agency_id
    and status = 'active';

  insert into public.proposal_delivery_snapshots (
    agency_id,
    proposal_id,
    status,
    title,
    summary,
    scope,
    next_step,
    currency,
    subtotal_amount,
    discount_type,
    discount_value,
    discount_amount,
    total_amount,
    agency_display_name,
    prospect_display_name,
    prospect_website_url,
    line_items,
    created_by,
    source_proposal_updated_at
  )
  values (
    p_agency_id,
    p_proposal_id,
    'active',
    p_title,
    p_summary,
    p_scope,
    p_next_step,
    p_currency,
    p_subtotal_amount,
    p_discount_type,
    p_discount_value,
    p_discount_amount,
    p_total_amount,
    p_agency_display_name,
    p_prospect_display_name,
    p_prospect_website_url,
    p_line_items,
    p_created_by,
    p_source_proposal_updated_at
  )
  returning id into v_snapshot_id;

  return v_snapshot_id;
end;
$$;

revoke all on function public.create_proposal_delivery_snapshot(
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  numeric,
  text,
  numeric,
  numeric,
  numeric,
  jsonb,
  timestamptz
) from public;

revoke all on function public.create_proposal_delivery_snapshot(
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  numeric,
  text,
  numeric,
  numeric,
  numeric,
  jsonb,
  timestamptz
) from authenticated;

grant execute on function public.create_proposal_delivery_snapshot(
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  numeric,
  text,
  numeric,
  numeric,
  numeric,
  jsonb,
  timestamptz
) to service_role;

alter table public.proposal_delivery_snapshots enable row level security;

drop policy if exists "Agency owners can read proposal delivery snapshots"
on public.proposal_delivery_snapshots;

create policy "Agency owners can read proposal delivery snapshots"
on public.proposal_delivery_snapshots
for select
to authenticated
using (public.current_user_owns_agency(agency_id));
