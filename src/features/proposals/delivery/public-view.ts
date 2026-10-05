import type {
  DeliverySnapshotPublicView,
  ProposalDeliverySnapshot,
} from "@/domain/proposals/types";

export function mapDeliverySnapshotToPublicView(
  snapshot: ProposalDeliverySnapshot,
): DeliverySnapshotPublicView {
  return {
    title: snapshot.title,
    summary: snapshot.summary,
    scope: snapshot.scope,
    nextStep: snapshot.nextStep,
    currency: snapshot.currency,
    agency: {
      displayName: snapshot.agencyDisplayName,
    },
    prospect: {
      displayName: snapshot.prospectDisplayName,
      websiteUrl: snapshot.prospectWebsiteUrl,
    },
    pricing: {
      subtotal: snapshot.subtotal,
      discountType: snapshot.discountType,
      discountValue: snapshot.discountValue,
      discountAmount: snapshot.discountAmount,
      total: snapshot.total,
    },
    lineItems: snapshot.lineItems.map((item) => ({
      position: item.position,
      serviceName: item.serviceName,
      serviceDescription: item.serviceDescription,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
    })),
    snapshot: {
      status: snapshot.status,
      createdAt: snapshot.createdAt,
      supersededAt: snapshot.supersededAt,
    },
  };
}
