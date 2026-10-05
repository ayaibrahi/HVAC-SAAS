import type { CurrencyCode } from "@/config/currencies";
import type { EntityId, Timestamp } from "@/domain/shared";

export type AgencyService = {
  id: EntityId;
  agencyId: EntityId;
  name: string;
  description: string | null;
  price: number;
  currency: CurrencyCode;
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};
