import { describe, expect, it } from "vitest";
import {
  calculateLineTotalCents,
  calculateProposalTotals,
  centsToAmount,
  parseMoneyToCents,
} from "@/features/proposals/pricing";

describe("proposal pricing", () => {
  it("parses money with cent precision", () => {
    expect(parseMoneyToCents("0")).toBe(0);
    expect(parseMoneyToCents("10")).toBe(1000);
    expect(parseMoneyToCents("10.25")).toBe(1025);
    expect(() => parseMoneyToCents("-1")).toThrow("valid non-negative");
    expect(() => parseMoneyToCents("10.999")).toThrow("valid non-negative");
  });

  it("calculates multiple line items and totals", () => {
    const totals = calculateProposalTotals({
      lines: [
        { quantity: 1, unitPriceCents: 150000 },
        { quantity: 2, unitPriceCents: 25000 },
      ],
      discountType: "none",
      discountValue: "0",
    });

    expect(totals.subtotalCents).toBe(200000);
    expect(totals.discountAmountCents).toBe(0);
    expect(totals.totalCents).toBe(200000);
  });

  it("allows zero price line items", () => {
    expect(calculateLineTotalCents({ quantity: 1, unitPriceCents: 0 })).toBe(0);
  });

  it("rejects negative price and quantity", () => {
    expect(() =>
      calculateLineTotalCents({ quantity: 1, unitPriceCents: -1 }),
    ).toThrow("Unit price cannot be negative.");
    expect(() =>
      calculateLineTotalCents({ quantity: 0, unitPriceCents: 100 }),
    ).toThrow("Quantity must be a positive whole number.");
  });

  it("calculates percentage discounts", () => {
    const totals = calculateProposalTotals({
      lines: [{ quantity: 1, unitPriceCents: 10000 }],
      discountType: "percentage",
      discountValue: "12.5",
    });

    expect(totals.discountValue).toBe(12.5);
    expect(totals.discountAmountCents).toBe(1250);
    expect(totals.totalCents).toBe(8750);
  });

  it("calculates fixed discounts and prevents totals below zero", () => {
    const totals = calculateProposalTotals({
      lines: [{ quantity: 1, unitPriceCents: 10000 }],
      discountType: "fixed",
      discountValue: "25.50",
    });

    expect(totals.discountAmountCents).toBe(2550);
    expect(totals.totalCents).toBe(7450);

    expect(() =>
      calculateProposalTotals({
        lines: [{ quantity: 1, unitPriceCents: 10000 }],
        discountType: "fixed",
        discountValue: "101",
      }),
    ).toThrow("Discount cannot exceed subtotal.");
  });

  it("formats cents for database storage", () => {
    expect(centsToAmount(12345)).toBe(123.45);
  });
});
