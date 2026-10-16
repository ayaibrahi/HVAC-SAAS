import "server-only";

import type { Audit } from "@/domain/audits/types";
import type { Agency } from "@/domain/agencies/types";
import type { Opportunity, OpportunityAiInsight } from "@/domain/opportunities/types";
import type {
  Proposal,
  ProposalLineItem,
  ProposalOpportunity,
} from "@/domain/proposals/types";
import type { Prospect } from "@/domain/prospects/types";
import type { AgencyService } from "@/domain/services/types";
import { mapAudit } from "@/features/audits/data";
import { requireCurrentAgency } from "@/features/agencies/data";
import { mapOpportunity } from "@/features/opportunities/data";
import { mapOpportunityAiInsight } from "@/features/opportunities/ai/data";
import { getProspect } from "@/features/prospects/data";
import { listAgencyServices } from "@/features/services/data";
import {
  assertAuditCanStartProposal,
  assertProposalAccess,
  assertProposalSelection,
} from "@/features/proposals/authorization";
import {
  calculateLineTotalCents,
  calculateProposalTotals,
  centsToAmount,
  parseMoneyToCents,
} from "@/features/proposals/pricing";
import { AppError } from "@/lib/errors";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database, Json } from "@/lib/supabase/database.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  CreateProposalInput,
  UpdateProposalInput,
} from "@/lib/validation/proposals";

type ProposalRow = Database["public"]["Tables"]["proposals"]["Row"];
type ProposalOpportunityRow =
  Database["public"]["Tables"]["proposal_opportunities"]["Row"];
type ProposalLineItemRow =
  Database["public"]["Tables"]["proposal_line_items"]["Row"];

export type ProposalBuilderData = {
  agency: Agency;
  proposal: Proposal;
  prospect: Prospect;
  audit: Audit;
  opportunities: Opportunity[];
  services: AgencyService[];
  aiInsightsByOpportunityId: Map<string, OpportunityAiInsight>;
  proposalOpportunitiesByOpportunityId: Map<string, ProposalOpportunity>;
  lineItemsByOpportunityId: Map<string, ProposalLineItem>;
};

export type PreparedLine = {
  opportunity: Opportunity;
  service: AgencyService;
  position: number;
  description: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
  aiInsight: OpportunityAiInsight | null;
};

export async function listProposalsForAgency(agencyId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("proposals")
    .select("*")
    .eq("agency_id", agencyId)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new AppError("We could not load proposals.", 500);
  }

  return data.map(mapProposal);
}

export async function createProposalDraft(input: CreateProposalInput) {
  const { supabase, agency } = await requireCurrentAgency();
  const audit = await getAuditForAgency(input.auditId, agency.id, supabase);
  const prospect = audit ? await getProspect(audit.prospectId, agency.id) : null;
  const access = {
    agencyId: agency.id,
    audit,
    prospect,
  };

  assertAuditCanStartProposal(access);

  const title =
    input.title?.trim() || `Proposal for ${access.prospect.businessName}`;
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("proposals")
    .insert({
      agency_id: agency.id,
      prospect_id: access.prospect.id,
      audit_id: access.audit.id,
      title,
      status: "draft",
      summary: "",
      scope: "",
      next_step: "",
      currency: agency.defaultCurrency,
      subtotal_amount: 0,
      discount_type: "none",
      discount_value: 0,
      discount_amount: 0,
      total_amount: 0,
      content: null,
    })
    .select("*")
    .single();

  if (error) {
    throw new AppError("We could not create the proposal draft.", 500);
  }

  return mapProposal(data);
}

export async function getProposalBuilderData(
  proposalId: string,
): Promise<ProposalBuilderData> {
  const { supabase, agency } = await requireCurrentAgency();
  const proposal = await getProposalForAgency(proposalId, agency.id, supabase);
  const prospect = proposal ? await getProspect(proposal.prospectId, agency.id) : null;
  const audit = proposal
    ? await getAuditForAgency(proposal.auditId, agency.id, supabase)
    : null;
  const access = {
    agencyId: agency.id,
    proposal,
    prospect,
    audit,
  };

  assertProposalAccess(access);

  const [
    opportunities,
    services,
    aiInsights,
    proposalOpportunities,
    lineItems,
  ] = await Promise.all([
    listOpportunitiesForAudit(access.proposal.auditId, agency.id, supabase),
    listAgencyServices(agency.id),
    listOpportunityAiInsightsForOpportunityIds(
      access.proposal.auditId,
      agency.id,
      supabase,
    ),
    listProposalOpportunities(access.proposal.id, agency.id, supabase),
    listProposalLineItems(access.proposal.id, agency.id, supabase),
  ]);

  return {
    agency,
    proposal: access.proposal,
    prospect: access.prospect,
    audit: access.audit,
    opportunities,
    services,
    aiInsightsByOpportunityId: new Map(
      aiInsights.map((insight) => [insight.opportunityId, insight]),
    ),
    proposalOpportunitiesByOpportunityId: new Map(
      proposalOpportunities.map((item) => [item.opportunityId, item]),
    ),
    lineItemsByOpportunityId: new Map(
      lineItems.map((item) => [item.opportunityId, item]),
    ),
  };
}

export async function updateProposalDraft(input: UpdateProposalInput) {
  const { supabase, agency, user } = await requireCurrentAgency();
  const proposal = await getProposalForAgency(input.proposalId, agency.id, supabase);
  const prospect = proposal ? await getProspect(proposal.prospectId, agency.id) : null;
  const audit = proposal
    ? await getAuditForAgency(proposal.auditId, agency.id, supabase)
    : null;
  const access = {
    agencyId: agency.id,
    proposal,
    prospect,
    audit,
  };

  assertProposalAccess(access);

  if (input.status === "ready" && input.lineItems.length === 0) {
    throw new AppError("Select at least one opportunity before marking ready.", 422);
  }

  if (
    input.status === "ready" &&
    (input.summary.trim().length === 0 || input.scope.trim().length === 0)
  ) {
    throw new AppError("Summary and scope are required before marking ready.", 422);
  }

  const preparedLines = await prepareProposalLines({
    agencyId: agency.id,
    proposal: access.proposal,
    input,
    supabase,
  });
  const totals = calculateProposalTotals({
    lines: preparedLines.map((line) => ({
      quantity: line.quantity,
      unitPriceCents: line.unitPriceCents,
    })),
    discountType: input.discountType,
    discountValue: input.discountValue,
  });
  const admin = createSupabaseAdminClient();

  const { error: saveError } = await admin.rpc("save_proposal_draft", {
    p_agency_id: agency.id,
    p_proposal_id: access.proposal.id,
    p_requested_by: user.id,
    p_title: input.title,
    p_status: input.status,
    p_summary: input.summary,
    p_scope: input.scope,
    p_next_step: input.nextStep,
    p_currency: input.currency,
    p_subtotal_amount: centsToAmount(totals.subtotalCents),
    p_discount_type: input.discountType,
    p_discount_value: totals.discountValue,
    p_discount_amount: centsToAmount(totals.discountAmountCents),
    p_total_amount: centsToAmount(totals.totalCents),
    p_line_items: createProposalLineItemPayload(preparedLines) as Json,
  });

  if (saveError) {
    throw new AppError("We could not update the proposal.", 500);
  }

  const { data, error } = await admin
    .from("proposals")
    .select("*")
    .eq("id", access.proposal.id)
    .eq("agency_id", agency.id)
    .single();

  if (error) {
    throw new AppError("We could not load the updated proposal.", 500);
  }

  return mapProposal(data);
}

export function createProposalLineItemPayload(preparedLines: PreparedLine[]) {
  return preparedLines.map((line) => ({
    opportunity_id: line.opportunity.id,
    agency_service_id: line.service.id,
    position: line.position,
    opportunity_title: line.opportunity.title,
    opportunity_short_description: line.opportunity.shortDescription,
    service_name: line.service.name,
    service_description: line.service.description,
    ai_sales_summary: line.aiInsight?.salesSummary ?? null,
    ai_client_facing_explanation:
      line.aiInsight?.clientFacingExplanation ?? null,
    description: line.description,
    quantity: line.quantity,
    unit_price: centsToAmount(line.unitPriceCents),
    line_total: centsToAmount(line.lineTotalCents),
  }));
}

export async function applyProposalAiDraft(input: {
  proposalId: string;
  expectedUpdatedAt: string;
  summary: string;
  scope: string;
  nextStep: string;
  metadata: Record<string, Json>;
}) {
  const { supabase, agency } = await requireCurrentAgency();
  const proposal = await getProposalForAgency(
    input.proposalId,
    agency.id,
    supabase,
  );

  if (!proposal) {
    throw new AppError("Proposal not found.", 404);
  }

  if (proposal.updatedAt !== input.expectedUpdatedAt) {
    throw new AppError(
      "The proposal changed during generation. Reload it before requesting new copy; existing text has not been overwritten.",
      409,
    );
  }

  if (
    proposal.status !== "draft" ||
    proposal.summary.trim() ||
    proposal.scope.trim() ||
    proposal.nextStep.trim()
  ) {
    throw new AppError(
      "Existing proposal text is preserved. Edit it manually, or save an empty draft before requesting new AI copy.",
      409,
    );
  }

  const admin = createSupabaseAdminClient();
  const content = {
    ...(proposal.content ?? {}),
    aiDraft: input.metadata,
  };
  const { data, error } = await admin
    .from("proposals")
    .update({
      summary: input.summary,
      scope: input.scope,
      next_step: input.nextStep,
      content: content as Json,
    })
    .eq("id", proposal.id)
    .eq("agency_id", agency.id)
    .eq("updated_at", proposal.updatedAt)
    .select("*")
    .single();

  if (error?.code === "PGRST116") {
    throw new AppError(
      "The proposal may have changed. Reload it before requesting new copy; existing text has not been overwritten.",
      409,
    );
  }
  if (error)
    throw new AppError("We could not store the generated proposal draft.", 500);

  return mapProposal(data);
}

export function mapProposal(row: ProposalRow): Proposal {
  return {
    id: row.id,
    agencyId: row.agency_id,
    prospectId: row.prospect_id,
    auditId: row.audit_id,
    title: row.title,
    status: row.status,
    summary: row.summary,
    scope: row.scope,
    nextStep: row.next_step,
    currency: row.currency,
    subtotal: Number(row.subtotal_amount),
    discountType: row.discount_type,
    discountValue: Number(row.discount_value),
    discountAmount: Number(row.discount_amount),
    total: Number(row.total_amount),
    content:
      row.content && typeof row.content === "object" && !Array.isArray(row.content)
        ? (row.content as Record<string, unknown>)
        : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapProposalOpportunity(
  row: ProposalOpportunityRow,
): ProposalOpportunity {
  return {
    proposalId: row.proposal_id,
    opportunityId: row.opportunity_id,
    agencyId: row.agency_id,
    agencyServiceId: row.agency_service_id,
    position: row.position,
    opportunityTitle: row.opportunity_title,
    opportunityShortDescription: row.opportunity_short_description,
    serviceName: row.service_name,
    serviceDescription: row.service_description,
    aiSalesSummary: row.ai_sales_summary,
    aiClientFacingExplanation: row.ai_client_facing_explanation,
    createdAt: row.created_at,
  };
}

export function mapProposalLineItem(row: ProposalLineItemRow): ProposalLineItem {
  return {
    id: row.id,
    proposalId: row.proposal_id,
    opportunityId: row.opportunity_id,
    agencyId: row.agency_id,
    agencyServiceId: row.agency_service_id,
    position: row.position,
    serviceName: row.service_name,
    serviceDescription: row.service_description,
    description: row.description,
    quantity: row.quantity,
    unitPrice: Number(row.unit_price),
    lineTotal: Number(row.line_total),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getProposalForAgency(
  proposalId: string,
  agencyId: string,
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
) {
  const { data, error } = await supabase
    .from("proposals")
    .select("*")
    .eq("agency_id", agencyId)
    .eq("id", proposalId)
    .maybeSingle();

  if (error) {
    throw new AppError("We could not load that proposal.", 500);
  }

  return data ? mapProposal(data) : null;
}

async function getAuditForAgency(
  auditId: string,
  agencyId: string,
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
): Promise<Audit | null> {
  const { data, error } = await supabase
    .from("audits")
    .select("*")
    .eq("id", auditId)
    .eq("agency_id", agencyId)
    .maybeSingle();

  if (error) {
    throw new AppError("We could not load that audit.", 500);
  }

  return data ? mapAudit(data) : null;
}

async function listOpportunitiesForAudit(
  auditId: string,
  agencyId: string,
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
) {
  const { data, error } = await supabase
    .from("opportunities")
    .select("*")
    .eq("agency_id", agencyId)
    .eq("audit_id", auditId)
    .order("score", { ascending: false });

  if (error) {
    throw new AppError("We could not load opportunities for this proposal.", 500);
  }

  return data.map(mapOpportunity);
}

async function listOpportunityAiInsightsForOpportunityIds(
  auditId: string,
  agencyId: string,
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
) {
  const opportunities = await listOpportunitiesForAudit(auditId, agencyId, supabase);
  const ids = opportunities.map((opportunity) => opportunity.id);

  if (ids.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("opportunity_ai_insights")
    .select("*")
    .eq("agency_id", agencyId)
    .in("opportunity_id", ids);

  if (error) {
    throw new AppError("We could not load AI insights for this proposal.", 500);
  }

  return data.map(mapOpportunityAiInsight);
}

async function listProposalOpportunities(
  proposalId: string,
  agencyId: string,
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
) {
  const { data, error } = await supabase
    .from("proposal_opportunities")
    .select("*")
    .eq("agency_id", agencyId)
    .eq("proposal_id", proposalId)
    .order("position", { ascending: true });

  if (error) {
    throw new AppError("We could not load proposal opportunities.", 500);
  }

  return data.map(mapProposalOpportunity);
}

async function listProposalLineItems(
  proposalId: string,
  agencyId: string,
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
) {
  const { data, error } = await supabase
    .from("proposal_line_items")
    .select("*")
    .eq("agency_id", agencyId)
    .eq("proposal_id", proposalId)
    .order("position", { ascending: true });

  if (error) {
    throw new AppError("We could not load proposal line items.", 500);
  }

  return data.map(mapProposalLineItem);
}

async function prepareProposalLines(input: {
  agencyId: string;
  proposal: Proposal;
  input: UpdateProposalInput;
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
}) {
  const opportunityIds = input.input.lineItems.map((item) => item.opportunityId);
  const serviceIds = input.input.lineItems.map((item) => item.agencyServiceId);

  if (new Set(opportunityIds).size !== opportunityIds.length) {
    throw new AppError("Each opportunity can only appear once in a proposal.", 422);
  }

  const [opportunities, services, aiInsights] = await Promise.all([
    loadOpportunitiesByIds(opportunityIds, input.agencyId, input.supabase),
    loadServicesByIds(serviceIds, input.agencyId),
    loadAiInsightsByOpportunityIds(opportunityIds, input.agencyId, input.supabase),
  ]);

  if (opportunities.length !== opportunityIds.length) {
    throw new AppError("One or more selected opportunities are invalid.", 403);
  }

  if (services.length !== new Set(serviceIds).size) {
    throw new AppError("One or more selected services are invalid.", 403);
  }

  const { opportunitiesById, servicesById } = assertProposalSelection({
    agencyId: input.agencyId,
    proposal: input.proposal,
    opportunities,
    services,
  });
  const aiInsightByOpportunityId = new Map(
    aiInsights.map((insight) => [insight.opportunityId, insight]),
  );

  return input.input.lineItems.map((line, index): PreparedLine => {
    const opportunity = opportunitiesById.get(line.opportunityId);
    const service = servicesById.get(line.agencyServiceId);

    if (!opportunity || !service) {
      throw new AppError("Selected proposal line is invalid.", 403);
    }

    const unitPriceCents = parseMoneyToCents(line.unitPrice);
    const lineTotalCents = calculateLineTotalCents({
      quantity: line.quantity,
      unitPriceCents,
    });

    return {
      opportunity,
      service,
      position: index,
      description:
        line.description ??
        service.description ??
        `Implementation support for ${opportunity.title}.`,
      quantity: line.quantity,
      unitPriceCents,
      lineTotalCents,
      aiInsight: aiInsightByOpportunityId.get(opportunity.id) ?? null,
    };
  });
}

async function loadOpportunitiesByIds(
  opportunityIds: string[],
  agencyId: string,
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
) {
  if (opportunityIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("opportunities")
    .select("*")
    .eq("agency_id", agencyId)
    .in("id", opportunityIds);

  if (error) {
    throw new AppError("We could not validate selected opportunities.", 500);
  }

  return data.map(mapOpportunity);
}

async function loadServicesByIds(serviceIds: string[], agencyId: string) {
  if (serviceIds.length === 0) {
    return [];
  }

  const services = await listAgencyServices(agencyId);
  const requested = new Set(serviceIds);

  return services.filter((service) => requested.has(service.id));
}

async function loadAiInsightsByOpportunityIds(
  opportunityIds: string[],
  agencyId: string,
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
) {
  if (opportunityIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("opportunity_ai_insights")
    .select("*")
    .eq("agency_id", agencyId)
    .in("opportunity_id", opportunityIds);

  if (error) {
    throw new AppError("We could not validate proposal AI insights.", 500);
  }

  return data.map(mapOpportunityAiInsight);
}
