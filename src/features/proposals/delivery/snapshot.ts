import type { Agency } from "@/domain/agencies/types";
import type {
  Proposal,
  ProposalDeliverySnapshotLineItem,
  ProposalLineItem,
  ProposalOpportunity,
} from "@/domain/proposals/types";
import type { Prospect } from "@/domain/prospects/types";
import { calculateLineTotalCents, centsToAmount } from "@/features/proposals/pricing";
import { AppError } from "@/lib/errors";
import { deliverySnapshotLineItemsSchema } from "@/lib/validation/proposal-delivery-snapshots";

export type DeliverySnapshotSource = {
  agency: Pick<Agency, "id" | "name">;
  userId: string;
  proposal: Proposal;
  prospect: Prospect;
  proposalOpportunities: ProposalOpportunity[];
  lineItems: ProposalLineItem[];
};

export type DeliverySnapshotPayload = {
  agencyId: string;
  proposalId: string;
  createdBy: string;
  agencyDisplayName: string;
  prospectDisplayName: string;
  prospectWebsiteUrl: string | null;
  title: string;
  summary: string;
  scope: string;
  nextStep: string;
  currency: Proposal["currency"];
  subtotal: number;
  discountType: Proposal["discountType"];
  discountValue: number;
  discountAmount: number;
  total: number;
  lineItems: ProposalDeliverySnapshotLineItem[];
  sourceProposalUpdatedAt: string;
};

export function buildDeliverySnapshotPayload(
  source: DeliverySnapshotSource,
): DeliverySnapshotPayload {
  assertSnapshotSourceConsistency(source);

  if (source.proposal.status !== "ready") {
    throw new AppError("Only ready proposals can create delivery snapshots.", 409);
  }

  if (
    source.proposal.summary.trim().length === 0 ||
    source.proposal.scope.trim().length === 0
  ) {
    throw new AppError("Summary and scope are required before snapshot creation.", 422);
  }

  const orderedLineItems = [...source.lineItems].sort(
    (left, right) => left.position - right.position,
  );
  const lineItems = orderedLineItems.map((item) => ({
    position: item.position,
    serviceName: item.serviceName,
    serviceDescription: item.serviceDescription,
    description: item.description,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    lineTotal: item.lineTotal,
  }));

  const parsedLineItems = deliverySnapshotLineItemsSchema.safeParse(lineItems);

  if (!parsedLineItems.success) {
    throw new AppError("Proposal line items are not ready for delivery.", 422);
  }

  assertPricingConsistency(source.proposal, source.lineItems);

  return {
    agencyId: source.agency.id,
    proposalId: source.proposal.id,
    createdBy: source.userId,
    agencyDisplayName: source.agency.name,
    prospectDisplayName: source.prospect.businessName,
    prospectWebsiteUrl: source.prospect.websiteUrl,
    title: source.proposal.title,
    summary: source.proposal.summary,
    scope: source.proposal.scope,
    nextStep: source.proposal.nextStep,
    currency: source.proposal.currency,
    subtotal: source.proposal.subtotal,
    discountType: source.proposal.discountType,
    discountValue: source.proposal.discountValue,
    discountAmount: source.proposal.discountAmount,
    total: source.proposal.total,
    lineItems: parsedLineItems.data,
    sourceProposalUpdatedAt: source.proposal.updatedAt,
  };
}

function assertSnapshotSourceConsistency(source: DeliverySnapshotSource) {
  if (
    source.proposal.agencyId !== source.agency.id ||
    source.prospect.agencyId !== source.agency.id ||
    source.proposal.prospectId !== source.prospect.id
  ) {
    throw new AppError("Proposal ownership is inconsistent.", 403);
  }

  if (source.lineItems.length === 0) {
    throw new AppError("Select at least one line item before snapshot creation.", 422);
  }

  if (source.proposalOpportunities.length !== source.lineItems.length) {
    throw new AppError("Proposal selected work is inconsistent.", 409);
  }

  const proposalOpportunityIds = new Set(
    source.proposalOpportunities.map((item) => item.opportunityId),
  );
  const lineItemOpportunityIds = new Set<string>();

  for (const lineItem of source.lineItems) {
    if (
      lineItem.agencyId !== source.agency.id ||
      lineItem.proposalId !== source.proposal.id ||
      !proposalOpportunityIds.has(lineItem.opportunityId)
    ) {
      throw new AppError("Proposal line items are inconsistent.", 409);
    }

    if (lineItemOpportunityIds.has(lineItem.opportunityId)) {
      throw new AppError("Proposal line items contain duplicates.", 409);
    }

    lineItemOpportunityIds.add(lineItem.opportunityId);

    if (new Date(lineItem.updatedAt).getTime() > new Date(source.proposal.updatedAt).getTime()) {
      throw new AppError(
        "Proposal is still being saved. Try creating a snapshot again.",
        409,
      );
    }
  }

  for (const proposalOpportunity of source.proposalOpportunities) {
    if (
      proposalOpportunity.agencyId !== source.agency.id ||
      proposalOpportunity.proposalId !== source.proposal.id ||
      !lineItemOpportunityIds.has(proposalOpportunity.opportunityId)
    ) {
      throw new AppError("Proposal selected opportunities are inconsistent.", 409);
    }
  }
}

function assertPricingConsistency(proposal: Proposal, lineItems: ProposalLineItem[]) {
  const lineSubtotalCents = lineItems
    .map((item) => {
      const unitPriceCents = amountToCents(item.unitPrice);
      const expectedLineTotalCents = calculateLineTotalCents({
        quantity: item.quantity,
        unitPriceCents,
      });

      if (amountToCents(item.lineTotal) !== expectedLineTotalCents) {
        throw new AppError("Proposal line item pricing is inconsistent.", 409);
      }

      return expectedLineTotalCents;
    })
    .reduce((sum, value) => sum + value, 0);
  const proposalSubtotalCents = amountToCents(proposal.subtotal);
  const proposalDiscountCents = amountToCents(proposal.discountAmount);
  const proposalTotalCents = amountToCents(proposal.total);

  if (lineSubtotalCents !== proposalSubtotalCents) {
    throw new AppError("Proposal subtotal is inconsistent.", 409);
  }

  if (proposalSubtotalCents - proposalDiscountCents !== proposalTotalCents) {
    throw new AppError("Proposal total is inconsistent.", 409);
  }

  if (proposal.discountType === "none" && proposalDiscountCents !== 0) {
    throw new AppError("Proposal discount is inconsistent.", 409);
  }

  centsToAmount(proposalSubtotalCents);
  centsToAmount(proposalDiscountCents);
  centsToAmount(proposalTotalCents);
}

function amountToCents(value: number) {
  if (!Number.isFinite(value) || value < 0) {
    throw new AppError("Proposal pricing is invalid.", 409);
  }

  const cents = Math.round(value * 100);

  if (Math.abs(cents / 100 - value) > 0.000001) {
    throw new AppError("Proposal pricing precision is invalid.", 409);
  }

  return cents;
}
