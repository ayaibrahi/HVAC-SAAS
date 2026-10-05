import type { CurrencyCode } from "@/config/currencies";

export type EntityId = string;

export type Timestamp = string;

export type Money = {
  amount: number;
  currency: CurrencyCode;
};
