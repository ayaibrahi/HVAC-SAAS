import type { CurrencyCode } from "@/config/currencies";
import type { EntityId, Timestamp } from "@/domain/shared";
import type { ApprovedServiceScope } from "@/lib/validation/service-scope";

export type AgencyService = {
  id: EntityId;
  agencyId: EntityId;
  name: string;
  description: string | null;
  approvedScope?: ApprovedServiceScope | null;
  price: number;
  currency: CurrencyCode;
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};
