create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agencies (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.users(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  website text,
  default_currency text not null default 'USD',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists agencies_owner_user_id_idx
  on public.agencies(owner_user_id);

create table if not exists public.agency_services (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  description text,
  price numeric(12, 2) not null default 0 check (price >= 0),
  currency text not null default 'USD',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, agency_id)
);

create index if not exists agency_services_agency_id_idx
  on public.agency_services(agency_id);

create table if not exists public.prospects (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  business_name text not null check (length(trim(business_name)) > 0),
  website_url text not null,
  contact_name text,
  contact_email text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, agency_id)
);

create index if not exists prospects_agency_id_idx
  on public.prospects(agency_id);

create table if not exists public.audits (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  prospect_id uuid not null,
  status text not null default 'pending'
    check (status in ('pending', 'running', 'completed', 'failed')),
  website_url text not null,
  final_url text,
  started_at timestamptz,
  completed_at timestamptz,
  error_code text,
  error_message text,
  normalized_signals jsonb not null default '{}'::jsonb,
  signal_schema_version text not null default '1.0.0'
    check (signal_schema_version ~ '^[0-9]+\.[0-9]+\.[0-9]+$'),
  vertical_key text not null default 'hvac'
    check (vertical_key in ('hvac', 'plumbing', 'roofing', 'electrical', 'dental')),
  playbook_version text not null default '1.0.0'
    check (playbook_version ~ '^[0-9]+\.[0-9]+\.[0-9]+$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, agency_id),
  unique (id, prospect_id, agency_id),
  check (completed_at is null or started_at is null or completed_at >= started_at),
  foreign key (prospect_id, agency_id)
    references public.prospects(id, agency_id)
    on delete cascade
);

create index if not exists audits_agency_id_idx
  on public.audits(agency_id);

create index if not exists audits_prospect_id_idx
  on public.audits(prospect_id);

create index if not exists audits_agency_status_idx
  on public.audits(agency_id, status);

create table if not exists public.opportunities (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  audit_id uuid not null,
  prospect_id uuid not null,
  agency_service_id uuid,
  vertical_key text not null
    check (vertical_key in ('hvac', 'plumbing', 'roofing', 'electrical', 'dental')),
  playbook_version text not null
    check (playbook_version ~ '^[0-9]+\.[0-9]+\.[0-9]+$'),
  rule_key text not null check (length(trim(rule_key)) > 0),
  title text not null check (length(trim(title)) > 0),
  short_description text not null check (length(trim(short_description)) > 0),
  business_impact text not null check (length(trim(business_impact)) > 0),
  evidence jsonb not null default '[]'::jsonb,
  priority text not null
    check (priority in ('low', 'medium', 'high')),
  confidence text not null
    check (confidence in ('low', 'medium', 'high')),
  recommended_service_category text not null
    check (length(trim(recommended_service_category)) > 0),
  score integer not null default 0 check (score >= 0 and score <= 100),
  ranking_rationale text,
  status text not null default 'open'
    check (status in ('open', 'dismissed', 'selected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, agency_id),
  unique (audit_id, rule_key),
  foreign key (audit_id, prospect_id, agency_id)
    references public.audits(id, prospect_id, agency_id)
    on delete cascade,
  foreign key (agency_service_id, agency_id)
    references public.agency_services(id, agency_id)
    on delete restrict
);

create index if not exists opportunities_agency_id_idx
  on public.opportunities(agency_id);

create index if not exists opportunities_audit_id_idx
  on public.opportunities(audit_id);

create index if not exists opportunities_prospect_id_idx
  on public.opportunities(prospect_id);

create table if not exists public.opportunity_ai_insights (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  opportunity_id uuid not null,
  status text not null default 'not_generated'
    check (status in ('not_generated', 'generating', 'completed', 'failed')),
  model_provider text not null check (length(trim(model_provider)) > 0),
  model_name text not null check (length(trim(model_name)) > 0),
  prompt_version text not null check (length(trim(prompt_version)) > 0),
  schema_version text not null
    check (schema_version ~ '^[0-9]+\.[0-9]+\.[0-9]+$'),
  sales_summary text,
  why_it_matters text,
  client_facing_explanation text,
  agency_talking_points jsonb not null default '[]'::jsonb
    check (jsonb_typeof(agency_talking_points) = 'array'),
  recommended_next_step text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, agency_id),
  unique (opportunity_id),
  foreign key (opportunity_id, agency_id)
    references public.opportunities(id, agency_id)
    on delete cascade,
  check (
    status <> 'completed'
    or (
      sales_summary is not null
      and length(trim(sales_summary)) > 0
      and why_it_matters is not null
      and length(trim(why_it_matters)) > 0
      and client_facing_explanation is not null
      and length(trim(client_facing_explanation)) > 0
      and jsonb_array_length(agency_talking_points) between 2 and 4
      and recommended_next_step is not null
      and length(trim(recommended_next_step)) > 0
    )
  )
);

create index if not exists opportunity_ai_insights_agency_id_idx
  on public.opportunity_ai_insights(agency_id);

create index if not exists opportunity_ai_insights_opportunity_id_idx
  on public.opportunity_ai_insights(opportunity_id);

create table if not exists public.proposals (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  prospect_id uuid not null,
  audit_id uuid not null,
  title text not null,
  status text not null default 'draft'
    check (status in ('draft', 'shared', 'accepted', 'archived')),
  content jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, agency_id),
  foreign key (prospect_id, agency_id)
    references public.prospects(id, agency_id)
    on delete cascade,
  foreign key (audit_id, prospect_id, agency_id)
    references public.audits(id, prospect_id, agency_id)
    on delete cascade
);

create index if not exists proposals_agency_id_idx
  on public.proposals(agency_id);

create index if not exists proposals_prospect_id_idx
  on public.proposals(prospect_id);

create table if not exists public.proposal_opportunities (
  proposal_id uuid not null,
  opportunity_id uuid not null,
  agency_id uuid not null references public.agencies(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (proposal_id, opportunity_id),
  foreign key (proposal_id, agency_id)
    references public.proposals(id, agency_id)
    on delete cascade,
  foreign key (opportunity_id, agency_id)
    references public.opportunities(id, agency_id)
    on delete cascade
);

create index if not exists proposal_opportunities_agency_id_idx
  on public.proposal_opportunities(agency_id);

create trigger users_set_updated_at
before update on public.users
for each row execute function public.set_updated_at();

create trigger agencies_set_updated_at
before update on public.agencies
for each row execute function public.set_updated_at();

create trigger agency_services_set_updated_at
before update on public.agency_services
for each row execute function public.set_updated_at();

create trigger prospects_set_updated_at
before update on public.prospects
for each row execute function public.set_updated_at();

create trigger audits_set_updated_at
before update on public.audits
for each row execute function public.set_updated_at();

create trigger opportunities_set_updated_at
before update on public.opportunities
for each row execute function public.set_updated_at();

create trigger opportunity_ai_insights_set_updated_at
before update on public.opportunity_ai_insights
for each row execute function public.set_updated_at();

create trigger proposals_set_updated_at
before update on public.proposals
for each row execute function public.set_updated_at();

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, full_name)
  values (
    new.id,
    coalesce(new.email, ''),
    nullif(new.raw_user_meta_data->>'full_name', '')
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(excluded.full_name, public.users.full_name);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

create or replace function public.current_user_owns_agency(target_agency_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.agencies
    where id = target_agency_id
      and owner_user_id = auth.uid()
  );
$$;

revoke all on function public.current_user_owns_agency(uuid) from public;
grant execute on function public.current_user_owns_agency(uuid) to authenticated;

alter table public.users enable row level security;
alter table public.agencies enable row level security;
alter table public.agency_services enable row level security;
alter table public.prospects enable row level security;
alter table public.audits enable row level security;
alter table public.opportunities enable row level security;
alter table public.opportunity_ai_insights enable row level security;
alter table public.proposals enable row level security;
alter table public.proposal_opportunities enable row level security;

create policy "Users can read own profile"
on public.users
for select
to authenticated
using (id = auth.uid());

create policy "Users can update own profile"
on public.users
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy "Users can insert own profile"
on public.users
for insert
to authenticated
with check (id = auth.uid());

create policy "Users can manage owned agencies"
on public.agencies
for all
to authenticated
using (owner_user_id = auth.uid())
with check (owner_user_id = auth.uid());

create policy "Agency owners can manage services"
on public.agency_services
for all
to authenticated
using (public.current_user_owns_agency(agency_id))
with check (public.current_user_owns_agency(agency_id));

create policy "Agency owners can manage prospects"
on public.prospects
for all
to authenticated
using (public.current_user_owns_agency(agency_id))
with check (public.current_user_owns_agency(agency_id));

create policy "Agency owners can read audits"
on public.audits
for select
to authenticated
using (public.current_user_owns_agency(agency_id));

create policy "Agency owners can read opportunities"
on public.opportunities
for select
to authenticated
using (public.current_user_owns_agency(agency_id));

create policy "Agency owners can read opportunity AI insights"
on public.opportunity_ai_insights
for select
to authenticated
using (public.current_user_owns_agency(agency_id));

create policy "Agency owners can read proposals"
on public.proposals
for select
to authenticated
using (public.current_user_owns_agency(agency_id));

create policy "Agency owners can read proposal opportunities"
on public.proposal_opportunities
for select
to authenticated
using (public.current_user_owns_agency(agency_id));
