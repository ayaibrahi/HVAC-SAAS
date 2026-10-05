create table if not exists public.usage_rate_limits (
  agency_id uuid not null references public.agencies(id) on delete cascade,
  action_key text not null
    check (action_key in ('website_analyzer', 'opportunity_ai', 'proposal_ai')),
  window_start timestamptz not null,
  window_seconds integer not null check (window_seconds > 0),
  request_count integer not null default 0 check (request_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (agency_id, action_key, window_start)
);

create index if not exists usage_rate_limits_agency_action_idx
  on public.usage_rate_limits(agency_id, action_key);

drop trigger if exists usage_rate_limits_set_updated_at on public.usage_rate_limits;

create trigger usage_rate_limits_set_updated_at
before update on public.usage_rate_limits
for each row execute function public.set_updated_at();

alter table public.usage_rate_limits enable row level security;

revoke all on table public.usage_rate_limits from anon;
revoke all on table public.usage_rate_limits from authenticated;

create or replace function public.consume_agency_rate_limit(
  p_agency_id uuid,
  p_action_key text,
  p_window_start timestamptz,
  p_window_seconds integer,
  p_max_requests integer,
  p_requested_by uuid
)
returns table (
  allowed boolean,
  remaining integer,
  reset_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request_count integer;
  v_reset_at timestamptz := p_window_start + make_interval(secs => p_window_seconds);
begin
  if p_window_seconds <= 0 or p_max_requests <= 0 then
    raise exception 'invalid_rate_limit_configuration' using errcode = '22023';
  end if;

  if p_action_key not in ('website_analyzer', 'opportunity_ai', 'proposal_ai') then
    raise exception 'invalid_rate_limit_action' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.agencies
    where id = p_agency_id
      and owner_user_id = p_requested_by
  ) then
    raise exception 'agency_user_not_authorized' using errcode = '42501';
  end if;

  insert into public.usage_rate_limits (
    agency_id,
    action_key,
    window_start,
    window_seconds,
    request_count
  )
  values (
    p_agency_id,
    p_action_key,
    p_window_start,
    p_window_seconds,
    1
  )
  on conflict (agency_id, action_key, window_start)
  do update
    set request_count = public.usage_rate_limits.request_count + 1,
        window_seconds = excluded.window_seconds
    where public.usage_rate_limits.request_count < p_max_requests
  returning request_count into v_request_count;

  if v_request_count is null then
    return query select false, 0, v_reset_at;
    return;
  end if;

  return query select true, greatest(0, p_max_requests - v_request_count), v_reset_at;
end;
$$;

revoke all on function public.consume_agency_rate_limit(
  uuid,
  text,
  timestamptz,
  integer,
  integer,
  uuid
) from public;

revoke all on function public.consume_agency_rate_limit(
  uuid,
  text,
  timestamptz,
  integer,
  integer,
  uuid
) from authenticated;

grant execute on function public.consume_agency_rate_limit(
  uuid,
  text,
  timestamptz,
  integer,
  integer,
  uuid
) to service_role;

create or replace function public.save_proposal_draft(
  p_agency_id uuid,
  p_proposal_id uuid,
  p_requested_by uuid,
  p_title text,
  p_status text,
  p_summary text,
  p_scope text,
  p_next_step text,
  p_currency text,
  p_subtotal_amount numeric,
  p_discount_type text,
  p_discount_value numeric,
  p_discount_amount numeric,
  p_total_amount numeric,
  p_line_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_audit_id uuid;
  v_prospect_id uuid;
  v_line_count integer;
  v_distinct_line_count integer;
  v_calculated_subtotal numeric(12, 2);
  v_expected_discount numeric(12, 2);
  v_expected_total numeric(12, 2);
begin
  if not exists (
    select 1
    from public.agencies
    where id = p_agency_id
      and owner_user_id = p_requested_by
  ) then
    raise exception 'agency_user_not_authorized' using errcode = '42501';
  end if;

  select audit_id, prospect_id
  into v_audit_id, v_prospect_id
  from public.proposals
  where id = p_proposal_id
    and agency_id = p_agency_id
  for update;

  if v_audit_id is null then
    raise exception 'proposal_not_found' using errcode = '42501';
  end if;

  if p_status not in ('draft', 'ready') then
    raise exception 'invalid_proposal_status' using errcode = '22023';
  end if;

  if p_currency not in ('USD', 'EUR', 'GBP', 'CAD', 'AUD') then
    raise exception 'invalid_proposal_currency' using errcode = '22023';
  end if;

  if p_discount_type not in ('none', 'fixed', 'percentage') then
    raise exception 'invalid_discount_type' using errcode = '22023';
  end if;

  if length(trim(coalesce(p_title, ''))) = 0 then
    raise exception 'proposal_title_required' using errcode = '23514';
  end if;

  if jsonb_typeof(p_line_items) <> 'array' then
    raise exception 'invalid_line_items' using errcode = '22023';
  end if;

  with line_input as (
    select *
    from jsonb_to_recordset(p_line_items) as item(
      opportunity_id uuid,
      agency_service_id uuid,
      position integer,
      opportunity_title text,
      opportunity_short_description text,
      service_name text,
      service_description text,
      ai_sales_summary text,
      ai_client_facing_explanation text,
      description text,
      quantity integer,
      unit_price numeric,
      line_total numeric
    )
  )
  select count(*), count(distinct opportunity_id)
  into v_line_count, v_distinct_line_count
  from line_input;

  if v_line_count <> v_distinct_line_count then
    raise exception 'duplicate_proposal_opportunity' using errcode = '23505';
  end if;

  if p_status = 'ready' and v_line_count = 0 then
    raise exception 'ready_proposal_requires_line_items' using errcode = '23514';
  end if;

  if p_status = 'ready'
    and (
      length(trim(coalesce(p_summary, ''))) = 0
      or length(trim(coalesce(p_scope, ''))) = 0
    )
  then
    raise exception 'ready_proposal_requires_summary_and_scope' using errcode = '23514';
  end if;

  with line_input as (
    select *
    from jsonb_to_recordset(p_line_items) as item(
      opportunity_id uuid,
      agency_service_id uuid,
      position integer,
      opportunity_title text,
      opportunity_short_description text,
      service_name text,
      service_description text,
      ai_sales_summary text,
      ai_client_facing_explanation text,
      description text,
      quantity integer,
      unit_price numeric,
      line_total numeric
    )
  )
  select coalesce(round(sum(line_total), 2), 0)
  into v_calculated_subtotal
  from line_input;

  if round(p_subtotal_amount, 2) <> v_calculated_subtotal then
    raise exception 'proposal_subtotal_mismatch' using errcode = '23514';
  end if;

  if p_discount_type = 'none' then
    v_expected_discount := 0;
  elsif p_discount_type = 'fixed' then
    v_expected_discount := least(round(p_discount_value, 2), v_calculated_subtotal);
  else
    if p_discount_value > 100 then
      raise exception 'invalid_discount_percentage' using errcode = '23514';
    end if;

    v_expected_discount := round(v_calculated_subtotal * p_discount_value / 100, 2);
  end if;

  v_expected_total := v_calculated_subtotal - v_expected_discount;

  if round(p_discount_amount, 2) <> v_expected_discount
    or round(p_total_amount, 2) <> v_expected_total
  then
    raise exception 'proposal_total_mismatch' using errcode = '23514';
  end if;

  with line_input as (
    select *
    from jsonb_to_recordset(p_line_items) as item(
      opportunity_id uuid,
      agency_service_id uuid,
      position integer,
      opportunity_title text,
      opportunity_short_description text,
      service_name text,
      service_description text,
      ai_sales_summary text,
      ai_client_facing_explanation text,
      description text,
      quantity integer,
      unit_price numeric,
      line_total numeric
    )
  )
  select count(*)
  into v_line_count
  from line_input line
  left join public.opportunities opportunity
    on opportunity.id = line.opportunity_id
    and opportunity.agency_id = p_agency_id
    and opportunity.audit_id = v_audit_id
    and opportunity.prospect_id = v_prospect_id
  left join public.agency_services service
    on service.id = line.agency_service_id
    and service.agency_id = p_agency_id
    and service.is_active = true
  where opportunity.id is null
    or service.id is null
    or line.position < 0
    or line.quantity is null
    or line.quantity <= 0
    or line.quantity > 100
    or line.unit_price is null
    or line.unit_price < 0
    or round(line.line_total, 2) <> round(line.quantity * line.unit_price, 2)
    or length(trim(coalesce(line.opportunity_title, ''))) = 0
    or length(trim(coalesce(line.opportunity_short_description, ''))) = 0
    or length(trim(coalesce(line.service_name, ''))) = 0;

  if v_line_count > 0 then
    raise exception 'invalid_proposal_line_item' using errcode = '23514';
  end if;

  with line_input as (
    select *
    from jsonb_to_recordset(p_line_items) as item(opportunity_id uuid)
  )
  delete from public.proposal_line_items existing
  where existing.proposal_id = p_proposal_id
    and existing.agency_id = p_agency_id
    and not exists (
      select 1
      from line_input line
      where line.opportunity_id = existing.opportunity_id
    );

  with line_input as (
    select *
    from jsonb_to_recordset(p_line_items) as item(opportunity_id uuid)
  )
  delete from public.proposal_opportunities existing
  where existing.proposal_id = p_proposal_id
    and existing.agency_id = p_agency_id
    and not exists (
      select 1
      from line_input line
      where line.opportunity_id = existing.opportunity_id
    );

  insert into public.proposal_opportunities (
    proposal_id,
    opportunity_id,
    agency_id,
    agency_service_id,
    position,
    opportunity_title,
    opportunity_short_description,
    service_name,
    service_description,
    ai_sales_summary,
    ai_client_facing_explanation
  )
  select
    p_proposal_id,
    line.opportunity_id,
    p_agency_id,
    line.agency_service_id,
    line.position,
    line.opportunity_title,
    line.opportunity_short_description,
    line.service_name,
    line.service_description,
    line.ai_sales_summary,
    line.ai_client_facing_explanation
  from jsonb_to_recordset(p_line_items) as line(
    opportunity_id uuid,
    agency_service_id uuid,
    position integer,
    opportunity_title text,
    opportunity_short_description text,
    service_name text,
    service_description text,
    ai_sales_summary text,
    ai_client_facing_explanation text
  )
  on conflict (proposal_id, opportunity_id)
  do update
    set agency_service_id = excluded.agency_service_id,
        position = excluded.position,
        opportunity_title = excluded.opportunity_title,
        opportunity_short_description = excluded.opportunity_short_description,
        service_name = excluded.service_name,
        service_description = excluded.service_description,
        ai_sales_summary = excluded.ai_sales_summary,
        ai_client_facing_explanation = excluded.ai_client_facing_explanation;

  insert into public.proposal_line_items (
    proposal_id,
    opportunity_id,
    agency_id,
    agency_service_id,
    position,
    service_name,
    service_description,
    description,
    quantity,
    unit_price,
    line_total
  )
  select
    p_proposal_id,
    line.opportunity_id,
    p_agency_id,
    line.agency_service_id,
    line.position,
    line.service_name,
    line.service_description,
    coalesce(line.description, ''),
    line.quantity,
    round(line.unit_price, 2),
    round(line.line_total, 2)
  from jsonb_to_recordset(p_line_items) as line(
    opportunity_id uuid,
    agency_service_id uuid,
    position integer,
    service_name text,
    service_description text,
    description text,
    quantity integer,
    unit_price numeric,
    line_total numeric
  )
  on conflict (proposal_id, opportunity_id)
  do update
    set agency_service_id = excluded.agency_service_id,
        position = excluded.position,
        service_name = excluded.service_name,
        service_description = excluded.service_description,
        description = excluded.description,
        quantity = excluded.quantity,
        unit_price = excluded.unit_price,
        line_total = excluded.line_total;

  update public.proposals
  set title = p_title,
      status = p_status,
      summary = p_summary,
      scope = p_scope,
      next_step = p_next_step,
      currency = p_currency,
      subtotal_amount = round(p_subtotal_amount, 2),
      discount_type = p_discount_type,
      discount_value = round(p_discount_value, 2),
      discount_amount = round(p_discount_amount, 2),
      total_amount = round(p_total_amount, 2)
  where id = p_proposal_id
    and agency_id = p_agency_id;

  return p_proposal_id;
end;
$$;

revoke all on function public.save_proposal_draft(
  uuid,
  uuid,
  uuid,
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
  jsonb
) from public;

revoke all on function public.save_proposal_draft(
  uuid,
  uuid,
  uuid,
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
  jsonb
) from authenticated;

grant execute on function public.save_proposal_draft(
  uuid,
  uuid,
  uuid,
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
  jsonb
) to service_role;
