import type {
  DeliverySnapshotPublicView,
  ProposalDeliverySnapshot,
  ProposalDeliverySnapshotLineItem,
} from "@/domain/proposals/types";
import { mapDeliverySnapshotToPublicView } from "@/features/proposals/delivery/public-view";

export type ProposalPdfView = {
  title: string;
  agencyName: string;
  prospectName: string;
  prospectWebsiteUrl: string | null;
  summary: string;
  scope: string;
  nextStep: string;
  currency: DeliverySnapshotPublicView["currency"];
  pricing: DeliverySnapshotPublicView["pricing"];
  lineItems: ProposalDeliverySnapshotLineItem[];
  snapshotCreatedAt: string;
};

export function buildProposalPdfView(
  snapshot: ProposalDeliverySnapshot,
): ProposalPdfView {
  const publicView = mapDeliverySnapshotToPublicView(snapshot);

  return {
    title: publicView.title,
    agencyName: publicView.agency.displayName,
    prospectName: publicView.prospect.displayName,
    prospectWebsiteUrl: publicView.prospect.websiteUrl,
    summary: publicView.summary,
    scope: publicView.scope,
    nextStep: publicView.nextStep,
    currency: publicView.currency,
    pricing: {
      subtotal: publicView.pricing.subtotal,
      discountType: publicView.pricing.discountType,
      discountValue: publicView.pricing.discountValue,
      discountAmount: publicView.pricing.discountAmount,
      total: publicView.pricing.total,
    },
    lineItems: publicView.lineItems.map((item) => ({
      position: item.position,
      serviceName: item.serviceName,
      serviceDescription: item.serviceDescription,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
    })),
    snapshotCreatedAt: publicView.snapshot.createdAt,
  };
}
