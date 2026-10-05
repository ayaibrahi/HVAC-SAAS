import type { EntityId, Timestamp } from "@/domain/shared";
import type { CurrencyCode } from "@/config/currencies";

export type ProposalStatus = "draft" | "ready";
export type ProposalDiscountType = "none" | "fixed" | "percentage";
export type ProposalDeliverySnapshotStatus = "active" | "superseded";
export type ProposalShareLinkStatus = "active" | "revoked";

export type Proposal = {
  id: EntityId;
  agencyId: EntityId;
  prospectId: EntityId;
  auditId: EntityId;
  title: string;
  status: ProposalStatus;
  summary: string;
  scope: string;
  nextStep: string;
  currency: CurrencyCode;
  subtotal: number;
  discountType: ProposalDiscountType;
  discountValue: number;
  discountAmount: number;
  total: number;
  content: Record<string, unknown> | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type ProposalOpportunity = {
  proposalId: EntityId;
  opportunityId: EntityId;
  agencyId: EntityId;
  agencyServiceId: EntityId | null;
  position: number;
  opportunityTitle: string;
  opportunityShortDescription: string;
  serviceName: string | null;
  serviceDescription: string | null;
  aiSalesSummary: string | null;
  aiClientFacingExplanation: string | null;
  createdAt: Timestamp;
};

export type ProposalLineItem = {
  id: EntityId;
  proposalId: EntityId;
  opportunityId: EntityId;
  agencyId: EntityId;
  agencyServiceId: EntityId;
  position: number;
  serviceName: string;
  serviceDescription: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type ProposalDeliverySnapshotLineItem = {
  position: number;
  serviceName: string;
  serviceDescription: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export type ProposalDeliverySnapshot = {
  id: EntityId;
  agencyId: EntityId;
  proposalId: EntityId;
  status: ProposalDeliverySnapshotStatus;
  title: string;
  summary: string;
  scope: string;
  nextStep: string;
  currency: CurrencyCode;
  subtotal: number;
  discountType: ProposalDiscountType;
  discountValue: number;
  discountAmount: number;
  total: number;
  agencyDisplayName: string;
  prospectDisplayName: string;
  prospectWebsiteUrl: string | null;
  lineItems: ProposalDeliverySnapshotLineItem[];
  createdBy: EntityId;
  sourceProposalUpdatedAt: Timestamp;
  createdAt: Timestamp;
  supersededAt: Timestamp | null;
};

export type DeliverySnapshotPublicView = {
  title: string;
  summary: string;
  scope: string;
  nextStep: string;
  currency: CurrencyCode;
  agency: {
    displayName: string;
  };
  prospect: {
    displayName: string;
    websiteUrl: string | null;
  };
  pricing: {
    subtotal: number;
    discountType: ProposalDiscountType;
    discountValue: number;
    discountAmount: number;
    total: number;
  };
  lineItems: ProposalDeliverySnapshotLineItem[];
  snapshot: {
    status: ProposalDeliverySnapshotStatus;
    createdAt: Timestamp;
    supersededAt: Timestamp | null;
  };
};

export type ProposalShareLinkMetadata = {
  id: EntityId;
  agencyId: EntityId;
  deliverySnapshotId: EntityId;
  status: ProposalShareLinkStatus;
  expiresAt: Timestamp | null;
  createdAt: Timestamp;
  revokedAt: Timestamp | null;
};
