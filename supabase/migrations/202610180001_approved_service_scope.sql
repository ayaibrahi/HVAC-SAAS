-- LOCAL/PENDING: do not apply to the shared project without recovery approval.
-- Existing descriptions remain capabilities, never approved contractual scope.
alter table public.agency_services
  add column approved_scope jsonb;

alter table public.agency_services add constraint agency_services_approved_scope_valid
  check (approved_scope is null or (
    jsonb_typeof(approved_scope) = 'object'
    and approved_scope ?& array['deliverables', 'exclusions', 'clientInputs', 'completionChecks']
    and approved_scope - array['deliverables', 'exclusions', 'clientInputs', 'completionChecks'] = '{}'::jsonb
    and jsonb_typeof(approved_scope->'deliverables') = 'string'
    and jsonb_typeof(approved_scope->'exclusions') = 'string'
    and jsonb_typeof(approved_scope->'clientInputs') = 'string'
    and jsonb_typeof(approved_scope->'completionChecks') = 'string'
    and length(btrim(approved_scope->>'deliverables')) between 1 and 800
    and length(btrim(approved_scope->>'exclusions')) between 1 and 800
    and length(btrim(approved_scope->>'clientInputs')) between 1 and 800
    and length(btrim(approved_scope->>'completionChecks')) between 1 and 800
  ));

comment on column public.agency_services.approved_scope is
  'Owner-approved reusable proposal scope. NULL means not approved. Existing agency RLS applies.';
