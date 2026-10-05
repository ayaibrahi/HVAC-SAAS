import type { EntityId, Timestamp } from "@/domain/shared";

export type Prospect = {
  id: EntityId;
  agencyId: EntityId;
  businessName: string;
  websiteUrl: string;
  contactName: string | null;
  contactEmail: string | null;
  notes: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};
