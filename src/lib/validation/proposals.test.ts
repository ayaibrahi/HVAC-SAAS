import { describe, expect, it } from "vitest";
import {
  createProposalInputSchema,
  updateProposalInputSchema,
} from "@/lib/validation/proposals";

const validLineItem = {
  opportunityId: "11111111-1111-4111-8111-111111111111",
  agencyServiceId: "22222222-2222-4222-8222-222222222222",
  quantity: "1",
  unitPrice: "350.00",
  description: "Booking integration work.",
};

describe("proposal validation", () => {
  it("validates proposal creation input", () => {
    expect(
      createProposalInputSchema.parse({
        auditId: "33333333-3333-4333-8333-333333333333",
        title: " Proposal ",
      }),
    ).toEqual({
      auditId: "33333333-3333-4333-8333-333333333333",
      title: "Proposal",
    });
  });

  it("validates proposal update input", () => {
    const result = updateProposalInputSchema.parse({
      proposalId: "44444444-4444-4444-8444-444444444444",
      title: "Proposal for Example HVAC",
      summary: "Summary",
      scope: "Scope",
      nextStep: "Next step",
      currency: "USD",
      status: "ready",
      discountType: "percentage",
      discountValue: "10",
      lineItems: [validLineItem],
    });

    expect(result.lineItems[0]?.quantity).toBe(1);
  });

  it("rejects unsupported status and currencies", () => {
    expect(
      updateProposalInputSchema.safeParse({
        proposalId: "44444444-4444-4444-8444-444444444444",
        title: "Proposal",
        summary: "",
        scope: "",
        nextStep: "",
        currency: "JPY",
        status: "accepted",
        discountType: "none",
        discountValue: "0",
        lineItems: [],
      }).success,
    ).toBe(false);
  });

  it("rejects invalid proposal line quantities", () => {
    expect(
      updateProposalInputSchema.safeParse({
        proposalId: "44444444-4444-4444-8444-444444444444",
        title: "Proposal",
        summary: "",
        scope: "",
        nextStep: "",
        currency: "USD",
        status: "draft",
        discountType: "none",
        discountValue: "0",
        lineItems: [{ ...validLineItem, quantity: "-1" }],
      }).success,
    ).toBe(false);
  });
});
