revoke execute on function public.consume_agency_rate_limit(
  uuid,
  text,
  timestamptz,
  integer,
  integer,
  uuid
) from public;

revoke execute on function public.consume_agency_rate_limit(
  uuid,
  text,
  timestamptz,
  integer,
  integer,
  uuid
) from anon;

revoke execute on function public.consume_agency_rate_limit(
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

revoke execute on function public.save_proposal_draft(
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

revoke execute on function public.save_proposal_draft(
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
) from anon;

revoke execute on function public.save_proposal_draft(
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

revoke execute on function public.create_proposal_delivery_snapshot(
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

revoke execute on function public.create_proposal_delivery_snapshot(
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
) from anon;

revoke execute on function public.create_proposal_delivery_snapshot(
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

revoke execute on function public.create_proposal_share_link(
  uuid,
  uuid,
  uuid,
  text,
  timestamptz
) from public;

revoke execute on function public.create_proposal_share_link(
  uuid,
  uuid,
  uuid,
  text,
  timestamptz
) from anon;

revoke execute on function public.create_proposal_share_link(
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

revoke execute on function public.revoke_proposal_share_link(
  uuid,
  uuid,
  uuid
) from public;

revoke execute on function public.revoke_proposal_share_link(
  uuid,
  uuid,
  uuid
) from anon;

revoke execute on function public.revoke_proposal_share_link(
  uuid,
  uuid,
  uuid
) from authenticated;

grant execute on function public.revoke_proposal_share_link(
  uuid,
  uuid,
  uuid
) to service_role;
