-- PREPARED LOCALLY ONLY. Review and rehearse before applying to the shared DB.
-- Engine-owned queue: clients cannot read lease tokens or write jobs directly.
create table public.rendered_audit_jobs (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  prospect_id uuid not null,
  audit_id uuid not null unique,
  request_key uuid not null,
  status text not null default 'pending' check (status in ('pending','running','completed','failed')),
  attempts integer not null default 0 check (attempts between 0 and 2),
  lease_token uuid,
  lease_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agency_id, request_key),
  foreign key (audit_id, prospect_id, agency_id)
    references public.audits(id, prospect_id, agency_id) on delete cascade,
  check ((status = 'running' and lease_token is not null and lease_expires_at is not null)
    or (status <> 'running' and lease_token is null and lease_expires_at is null))
);
create index rendered_audit_jobs_claim_idx on public.rendered_audit_jobs(status, lease_expires_at, created_at);
alter table public.rendered_audit_jobs enable row level security;
revoke all on public.rendered_audit_jobs from public, anon, authenticated;
grant select, insert, update, delete on public.rendered_audit_jobs to service_role;

-- Advisory locks serialize identical idempotency keys and active prospect jobs.
-- URL and tenant ownership are loaded from DB, never supplied by the client.
create function public.enqueue_rendered_audit(p_agency uuid, p_user uuid, p_prospect uuid, p_request uuid)
returns table(job_id uuid, audit_id uuid, status text)
language plpgsql security definer set search_path = '' as $$
declare v_job public.rendered_audit_jobs%rowtype; v_url text; v_audit uuid;
begin
  if p_agency is null or p_user is null or p_prospect is null or p_request is null then raise exception 'invalid input'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_agency::text || ':' || p_request::text, 0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_agency::text || ':' || p_prospect::text, 1));
  select p.website_url into v_url from public.prospects p join public.agencies a on a.id = p.agency_id
    where p.id = p_prospect and p.agency_id = p_agency and a.owner_user_id = p_user;
  if v_url is null then raise exception 'prospect not found'; end if;
  select * into v_job from public.rendered_audit_jobs j where j.agency_id = p_agency and j.request_key = p_request;
  if found then
    if v_job.prospect_id <> p_prospect then raise exception 'request conflict'; end if;
    return query select v_job.id, v_job.audit_id, v_job.status; return;
  end if;
  -- Preserve the existing one-active-audit-per-prospect rule, including static jobs.
  if exists(select 1 from public.audits a where a.agency_id = p_agency and a.prospect_id = p_prospect and a.status in ('pending','running')) then
    raise exception 'audit already active';
  end if;
  insert into public.audits(agency_id, prospect_id, website_url, status, vertical_key, playbook_version, signal_schema_version)
    values (p_agency, p_prospect, v_url, 'pending', 'hvac', '1.0.0', '2.0.0') returning id into v_audit;
  insert into public.rendered_audit_jobs(agency_id, prospect_id, audit_id, request_key)
    values (p_agency, p_prospect, v_audit, p_request) returning * into v_job;
  return query select v_job.id, v_job.audit_id, v_job.status;
end $$;

-- Atomic claim and lease recovery. Stale holders are fenced by a fresh UUID.
create function public.claim_rendered_audit(p_agency uuid, p_job uuid)
returns table(job_id uuid, audit_id uuid, lease_token uuid, website_url text, attempts integer)
language plpgsql security definer set search_path = '' as $$
declare v_job public.rendered_audit_jobs%rowtype; v_url text;
begin
  select * into v_job from public.rendered_audit_jobs j where j.id = p_job and j.agency_id = p_agency for update;
  if not found or v_job.status in ('completed','failed') then return; end if;
  if v_job.status = 'running' and v_job.lease_expires_at > clock_timestamp() then return; end if;
  if v_job.attempts >= 2 then
    update public.rendered_audit_jobs set status='failed', lease_token=null, lease_expires_at=null, updated_at=clock_timestamp() where id=v_job.id;
    update public.audits set status='failed', completed_at=clock_timestamp(), error_code='WORKER_TIMEOUT', error_message='Analysis could not be completed.'
      where id=v_job.audit_id and agency_id=p_agency and status in ('pending','running');
    return;
  end if;
  update public.rendered_audit_jobs set status='running', attempts=rendered_audit_jobs.attempts+1,
    lease_token=gen_random_uuid(), lease_expires_at=clock_timestamp()+interval '120 seconds', updated_at=clock_timestamp()
    where id=v_job.id returning * into v_job;
  update public.audits set status='running', started_at=coalesce(started_at,clock_timestamp()), error_code=null, error_message=null
    where id=v_job.audit_id and agency_id=p_agency and status in ('pending','running') returning public.audits.website_url into v_url;
  if v_url is null then raise exception 'audit unavailable'; end if;
  return query select v_job.id, v_job.audit_id, v_job.lease_token, v_url, v_job.attempts;
end $$;

-- Result and status are committed atomically; an expired or superseded lease
-- cannot modify the job or its audit. Server validates the envelope before RPC.
create function public.finish_rendered_audit(p_agency uuid, p_job uuid, p_lease uuid, p_result jsonb, p_retry boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_job public.rendered_audit_jobs%rowtype; v_next text;
begin
  select * into v_job from public.rendered_audit_jobs j where j.id=p_job and j.agency_id=p_agency for update;
  if not found or v_job.status <> 'running' or v_job.lease_token is distinct from p_lease or v_job.lease_expires_at <= clock_timestamp() then return false; end if;
  if p_result is not null then
    if jsonb_typeof(p_result) <> 'object' or pg_catalog.octet_length(p_result::text) > 1048576 then raise exception 'invalid result'; end if;
    update public.audits set status='completed', completed_at=clock_timestamp(), final_url=website_url,
      normalized_signals=p_result, signal_schema_version='2.0.0', error_code=null, error_message=null
      where id=v_job.audit_id and agency_id=p_agency and status='running';
    if not found then raise exception 'audit unavailable'; end if;
    v_next := 'completed';
  else
    v_next := case when p_retry and v_job.attempts < 2 then 'pending' else 'failed' end;
    update public.audits set status=v_next, completed_at=case when v_next='failed' then clock_timestamp() else null end,
      error_code=case when v_next='failed' then 'WORKER_FAILED' else null end,
      error_message=case when v_next='failed' then 'Analysis could not be completed.' else null end
      where id=v_job.audit_id and agency_id=p_agency and status='running';
    if not found then raise exception 'audit unavailable'; end if;
  end if;
  update public.rendered_audit_jobs set status=v_next, lease_token=null, lease_expires_at=null, updated_at=clock_timestamp() where id=v_job.id;
  return true;
end $$;

revoke execute on function public.enqueue_rendered_audit(uuid,uuid,uuid,uuid) from public, anon, authenticated;
revoke execute on function public.claim_rendered_audit(uuid,uuid) from public, anon, authenticated;
revoke execute on function public.finish_rendered_audit(uuid,uuid,uuid,jsonb,boolean) from public, anon, authenticated;
grant execute on function public.enqueue_rendered_audit(uuid,uuid,uuid,uuid) to service_role;
grant execute on function public.claim_rendered_audit(uuid,uuid) to service_role;
grant execute on function public.finish_rendered_audit(uuid,uuid,uuid,jsonb,boolean) to service_role;
