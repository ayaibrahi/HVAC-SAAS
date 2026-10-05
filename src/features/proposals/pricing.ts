import type { ProposalDiscountType } from "@/domain/proposals/types";
import { AppError } from "@/lib/errors";

export type ProposalMoneyTotals = {
  subtotalCents: number;
  discountValue: number;
  discountAmountCents: number;
  totalCents: number;
};

export type PricedProposalLineInput = {
  quantity: number;
  unitPriceCents: number;
};

const maxCents = 100_000_000;

export function parseMoneyToCents(value: string) {
  const normalized = value.trim();

  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) {
    throw new AppError("Enter a valid non-negative money amount.", 422);
  }

  const [whole, fraction = ""] = normalized.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));

  if (!Number.isSafeInteger(cents) || cents > maxCents) {
    throw new AppError("Money amount is too high.", 422);
  }

  return cents;
}

export function centsToAmount(cents: number) {
  if (!Number.isSafeInteger(cents) || cents < 0) {
    throw new AppError("Invalid money amount.", 422);
  }

  return Number((cents / 100).toFixed(2));
}

export function formatMoneyAmount(value: number) {
  return value.toFixed(2);
}

export function calculateLineTotalCents(input: PricedProposalLineInput) {
  if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
    throw new AppError("Quantity must be a positive whole number.", 422);
  }

  if (!Number.isSafeInteger(input.unitPriceCents) || input.unitPriceCents < 0) {
    throw new AppError("Unit price cannot be negative.", 422);
  }

  const total = input.unitPriceCents * input.quantity;

  if (!Number.isSafeInteger(total) || total > maxCents) {
    throw new AppError("Line item total is too high.", 422);
  }

  return total;
}

export function calculateProposalTotals(input: {
  lines: PricedProposalLineInput[];
  discountType: ProposalDiscountType;
  discountValue: string;
}): ProposalMoneyTotals {
  const lineTotals = input.lines.map(calculateLineTotalCents);
  const subtotalCents = lineTotals.reduce((sum, value) => sum + value, 0);
  const discount = calculateDiscount({
    subtotalCents,
    discountType: input.discountType,
    discountValue: input.discountValue,
  });
  const totalCents = subtotalCents - discount.discountAmountCents;

  if (totalCents < 0) {
    throw new AppError("Discount cannot exceed subtotal.", 422);
  }

  return {
    subtotalCents,
    discountValue: discount.discountValue,
    discountAmountCents: discount.discountAmountCents,
    totalCents,
  };
}

function calculateDiscount(input: {
  subtotalCents: number;
  discountType: ProposalDiscountType;
  discountValue: string;
}) {
  if (input.discountType === "none") {
    return {
      discountValue: 0,
      discountAmountCents: 0,
    };
  }

  if (input.discountType === "fixed") {
    const discountAmountCents = parseMoneyToCents(input.discountValue);

    if (discountAmountCents > input.subtotalCents) {
      throw new AppError("Discount cannot exceed subtotal.", 422);
    }

    return {
      discountValue: centsToAmount(discountAmountCents),
      discountAmountCents,
    };
  }

  const percentageBasisPoints = parsePercentageToBasisPoints(input.discountValue);
  const discountAmountCents = Math.round(
    (input.subtotalCents * percentageBasisPoints) / 10_000,
  );

  if (discountAmountCents > input.subtotalCents) {
    throw new AppError("Discount cannot exceed subtotal.", 422);
  }

  return {
    discountValue: percentageBasisPoints / 100,
    discountAmountCents,
  };
}

function parsePercentageToBasisPoints(value: string) {
  const normalized = value.trim();

  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) {
    throw new AppError("Enter a valid discount percentage.", 422);
  }

  const [whole, fraction = ""] = normalized.split(".");
  const basisPoints = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));

  if (!Number.isSafeInteger(basisPoints) || basisPoints < 0 || basisPoints > 10000) {
    throw new AppError("Percentage discount must be between 0 and 100.", 422);
  }

  return basisPoints;
}
