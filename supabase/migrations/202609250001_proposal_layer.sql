alter table public.proposals
  add column if not exists summary text not null default '',
  add column if not exists scope text not null default '',
  add column if not exists next_step text not null default '',
  add column if not exists currency text not null default 'USD',
  add column if not exists subtotal_amount numeric(12, 2) not null default 0,
  add column if not exists discount_type text not null default 'none',
  add column if not exists discount_value numeric(12, 2) not null default 0,
  add column if not exists discount_amount numeric(12, 2) not null default 0,
  add column if not exists total_amount numeric(12, 2) not null default 0;

alter table public.proposals
  drop constraint if exists proposals_status_check;

alter table public.proposals
  add constraint proposals_status_check
  check (status in ('draft', 'ready'));

alter table public.proposals
  drop constraint if exists proposals_currency_check;

alter table public.proposals
  add constraint proposals_currency_check
  check (currency in ('USD', 'EUR', 'GBP', 'CAD', 'AUD'));

alter table public.proposals
  drop constraint if exists proposals_amounts_check;

alter table public.proposals
  add constraint proposals_amounts_check
  check (
    subtotal_amount >= 0
    and discount_value >= 0
    and discount_amount >= 0
    and total_amount >= 0
    and discount_amount <= subtotal_amount
    and total_amount = subtotal_amount - discount_amount
  );

alter table public.proposals
  drop constraint if exists proposals_discount_type_check;

alter table public.proposals
  add constraint proposals_discount_type_check
  check (discount_type in ('none', 'fixed', 'percentage'));

alter table public.proposal_opportunities
  add column if not exists agency_service_id uuid,
  add column if not exists position integer not null default 0,
  add column if not exists opportunity_title text not null default '',
  add column if not exists opportunity_short_description text not null default '',
  add column if not exists service_name text,
  add column if not exists service_description text,
  add column if not exists ai_sales_summary text,
  add column if not exists ai_client_facing_explanation text;

alter table public.proposal_opportunities
  drop constraint if exists proposal_opportunities_position_check;

alter table public.proposal_opportunities
  add constraint proposal_opportunities_position_check
  check (position >= 0);

alter table public.proposal_opportunities
  drop constraint if exists proposal_opportunities_agency_service_fkey;

alter table public.proposal_opportunities
  add constraint proposal_opportunities_agency_service_fkey
  foreign key (agency_service_id, agency_id)
  references public.agency_services(id, agency_id)
  on delete restrict;

create table if not exists public.proposal_line_items (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null,
  opportunity_id uuid not null,
  agency_id uuid not null references public.agencies(id) on delete cascade,
  agency_service_id uuid not null,
  position integer not null default 0 check (position >= 0),
  service_name text not null check (length(trim(service_name)) > 0),
  service_description text,
  description text not null default '',
  quantity integer not null default 1 check (quantity > 0 and quantity <= 100),
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  line_total numeric(12, 2) not null check (line_total >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (proposal_id, opportunity_id),
  foreign key (proposal_id, agency_id)
    references public.proposals(id, agency_id)
    on delete cascade,
  foreign key (proposal_id, opportunity_id)
    references public.proposal_opportunities(proposal_id, opportunity_id)
    on delete cascade,
  foreign key (opportunity_id, agency_id)
    references public.opportunities(id, agency_id)
    on delete cascade,
  foreign key (agency_service_id, agency_id)
    references public.agency_services(id, agency_id)
    on delete restrict
);

create index if not exists proposal_line_items_agency_id_idx
  on public.proposal_line_items(agency_id);

create index if not exists proposal_line_items_proposal_id_idx
  on public.proposal_line_items(proposal_id);

create index if not exists proposal_line_items_opportunity_id_idx
  on public.proposal_line_items(opportunity_id);

drop trigger if exists proposal_line_items_set_updated_at on public.proposal_line_items;

create trigger proposal_line_items_set_updated_at
before update on public.proposal_line_items
for each row execute function public.set_updated_at();

alter table public.proposal_line_items enable row level security;

drop policy if exists "Agency owners can read proposal line items"
on public.proposal_line_items;

create policy "Agency owners can read proposal line items"
on public.proposal_line_items
for select
to authenticated
using (public.current_user_owns_agency(agency_id));
