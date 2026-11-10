-- Pending owner approval: do not apply to the shared database automatically.
-- No row rewrites, RLS changes, grants or changes to historical snapshots.
begin;
set local lock_timeout = '3s';
set local statement_timeout = '120s';
alter table public.agency_services drop constraint agency_services_approved_scope_valid;
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
    and length(btrim(approved_scope->>'exclusions')) between 0 and 800
    and length(btrim(approved_scope->>'clientInputs')) between 0 and 800
    and length(btrim(approved_scope->>'completionChecks')) between 0 and 800
  ));

commit;
