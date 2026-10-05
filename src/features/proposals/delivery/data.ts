import "server-only";

import type { ProposalDeliverySnapshot } from "@/domain/proposals/types";
import { requireCurrentAgency } from "@/features/agencies/data";
import { getProposalBuilderData } from "@/features/proposals/data";
import {
  buildDeliverySnapshotPayload,
  type DeliverySnapshotPayload,
} from "@/features/proposals/delivery/snapshot";
import { AppError } from "@/lib/errors";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database, Json } from "@/lib/supabase/database.types";
import { deliverySnapshotLineItemsSchema } from "@/lib/validation/proposal-delivery-snapshots";

type DeliverySnapshotRow =
  Database["public"]["Tables"]["proposal_delivery_snapshots"]["Row"];
type DeliverySnapshotRpcArgs =
  Database["public"]["Functions"]["create_proposal_delivery_snapshot"]["Args"];

export async function createDeliverySnapshotForProposal(proposalId: string) {
  const { agency, user } = await requireCurrentAgency();
  const data = await getProposalBuilderData(proposalId);
  const payload = buildDeliverySnapshotPayload({
    agency,
    userId: user.id,
    proposal: data.proposal,
    prospect: data.prospect,
    proposalOpportunities: [...data.proposalOpportunitiesByOpportunityId.values()],
    lineItems: [...data.lineItemsByOpportunityId.values()],
  });
  const admin = createSupabaseAdminClient();
  const { data: snapshotId, error } = await admin.rpc(
    "create_proposal_delivery_snapshot",
    toSnapshotRpcArgs(payload),
  );

  if (error) {
    throw new AppError(getSnapshotCreationErrorMessage(error.message), 409);
  }

  const snapshot = await getDeliverySnapshotForAgencyAdmin({
    snapshotId,
    agencyId: agency.id,
    admin,
  });

  if (!snapshot) {
    throw new AppError("Delivery snapshot could not be loaded after creation.", 500);
  }

  return snapshot;
}

export async function listDeliverySnapshotsForProposal(proposalId: string) {
  const { supabase, agency } = await requireCurrentAgency();
  const { data: proposal, error: proposalError } = await supabase
    .from("proposals")
    .select("id")
    .eq("agency_id", agency.id)
    .eq("id", proposalId)
    .maybeSingle();

  if (proposalError) {
    throw new AppError("We could not load that proposal.", 500);
  }

  if (!proposal) {
    throw new AppError("Proposal not found.", 404);
  }

  const { data, error } = await supabase
    .from("proposal_delivery_snapshots")
    .select("*")
    .eq("agency_id", agency.id)
    .eq("proposal_id", proposalId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new AppError("We could not load delivery snapshots.", 500);
  }

  return data.map(mapDeliverySnapshot);
}

export async function getDeliverySnapshot(snapshotId: string) {
  const { supabase, agency } = await requireCurrentAgency();
  const { data, error } = await supabase
    .from("proposal_delivery_snapshots")
    .select("*")
    .eq("agency_id", agency.id)
    .eq("id", snapshotId)
    .maybeSingle();

  if (error) {
    throw new AppError("We could not load that delivery snapshot.", 500);
  }

  return data ? mapDeliverySnapshot(data) : null;
}

export function mapDeliverySnapshot(
  row: DeliverySnapshotRow,
): ProposalDeliverySnapshot {
  const lineItems = deliverySnapshotLineItemsSchema.safeParse(row.line_items);

  if (!lineItems.success) {
    throw new AppError("Stored delivery snapshot is invalid.", 500);
  }

  return {
    id: row.id,
    agencyId: row.agency_id,
    proposalId: row.proposal_id,
    status: row.status,
    title: row.title,
    summary: row.summary,
    scope: row.scope,
    nextStep: row.next_step,
    currency: row.currency,
    subtotal: Number(row.subtotal_amount),
    discountType: row.discount_type,
    discountValue: Number(row.discount_value),
    discountAmount: Number(row.discount_amount),
    total: Number(row.total_amount),
    agencyDisplayName: row.agency_display_name,
    prospectDisplayName: row.prospect_display_name,
    prospectWebsiteUrl: row.prospect_website_url,
    lineItems: lineItems.data,
    createdBy: row.created_by,
    sourceProposalUpdatedAt: row.source_proposal_updated_at,
    createdAt: row.created_at,
    supersededAt: row.superseded_at,
  };
}

function toSnapshotRpcArgs(
  payload: DeliverySnapshotPayload,
): DeliverySnapshotRpcArgs {
  return {
    p_agency_id: payload.agencyId,
    p_proposal_id: payload.proposalId,
    p_created_by: payload.createdBy,
    p_agency_display_name: payload.agencyDisplayName,
    p_prospect_display_name: payload.prospectDisplayName,
    p_prospect_website_url: payload.prospectWebsiteUrl,
    p_title: payload.title,
    p_summary: payload.summary,
    p_scope: payload.scope,
    p_next_step: payload.nextStep,
    p_currency: payload.currency,
    p_subtotal_amount: payload.subtotal,
    p_discount_type: payload.discountType,
    p_discount_value: payload.discountValue,
    p_discount_amount: payload.discountAmount,
    p_total_amount: payload.total,
    p_line_items: payload.lineItems as Json,
    p_source_proposal_updated_at: payload.sourceProposalUpdatedAt,
  };
}

async function getDeliverySnapshotForAgencyAdmin(input: {
  snapshotId: string;
  agencyId: string;
  admin: ReturnType<typeof createSupabaseAdminClient>;
}) {
  const { data, error } = await input.admin
    .from("proposal_delivery_snapshots")
    .select("*")
    .eq("agency_id", input.agencyId)
    .eq("id", input.snapshotId)
    .maybeSingle();

  if (error) {
    throw new AppError("We could not load the delivery snapshot.", 500);
  }

  return data ? mapDeliverySnapshot(data) : null;
}

function getSnapshotCreationErrorMessage(message: string | undefined) {
  if (!message) {
    return "We could not create the delivery snapshot.";
  }

  if (message.includes("proposal_not_ready")) {
    return "Only ready proposals can create delivery snapshots.";
  }

  if (message.includes("proposal_state_changed")) {
    return "Proposal changed before snapshot creation. Review and try again.";
  }

  if (message.includes("proposal_not_found")) {
    return "Proposal not found.";
  }

  if (message.includes("agency_user_not_authorized")) {
    return "Delivery snapshot not found.";
  }

  return "We could not create the delivery snapshot.";
}
