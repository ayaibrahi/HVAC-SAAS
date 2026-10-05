import type { CurrencyCode } from "@/config/currencies";
import type { EntityId, Timestamp } from "@/domain/shared";

export type Agency = {
  id: EntityId;
  ownerUserId: EntityId;
  name: string;
  website: string | null;
  defaultCurrency: CurrencyCode;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};
