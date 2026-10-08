create unique index if not exists audits_one_active_per_prospect_idx
  on public.audits(agency_id, prospect_id)
  where status in ('pending', 'running');
