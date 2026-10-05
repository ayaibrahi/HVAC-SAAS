import type { CurrencyCode } from "@/config/currencies";
import { AppError } from "@/lib/errors";

export function formatSnapshotMoney(value: number, currency: CurrencyCode) {
  const cents = amountToCents(value);
  const whole = Math.trunc(cents / 100);
  const fraction = String(cents % 100).padStart(2, "0");

  return `${currency} ${whole}.${fraction}`;
}

export function formatSnapshotDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new AppError("Delivery snapshot date is invalid.", 500);
  }

  return date.toISOString().slice(0, 10);
}

function amountToCents(value: number) {
  if (!Number.isFinite(value) || value < 0) {
    throw new AppError("Delivery snapshot pricing is invalid.", 500);
  }

  const cents = Math.round(value * 100);

  if (Math.abs(cents / 100 - value) > 0.000001) {
    throw new AppError("Delivery snapshot pricing precision is invalid.", 500);
  }

  return cents;
}
