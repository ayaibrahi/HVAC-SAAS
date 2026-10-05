import { describe, expect, it } from "vitest";
import type { ProposalDeliverySnapshot } from "@/domain/proposals/types";
import { buildProposalPdfView } from "@/features/proposals/pdf/view-model";

describe("proposal PDF view model", () => {
  it("selects only delivery-approved snapshot fields", () => {
    const snapshot = {
      ...makeSnapshot(),
      auditId: "internal-audit-id",
      prospectId: "internal-prospect-id",
      opportunityId: "internal-opportunity-id",
      ranking: 10,
      confidence: "high",
      evidence: [{ signal: "online_booking" }],
      modelProvider: "openai",
      modelName: "internal-model",
      prompt: "internal prompt",
      internalNotes: "do not expose",
      lineItems: [
        {
          ...makeSnapshot().lineItems[0],
          agencyServiceId: "internal-service-id",
          opportunityId: "internal-opportunity-id",
          evidence: [{ signal: "online_booking" }],
        },
      ],
    } as unknown as ProposalDeliverySnapshot;
    const view = buildProposalPdfView(snapshot);
    const keys = collectKeys(view);

    expect(view).toEqual({
      title: "Proposal for Example HVAC",
      agencyName: "Growth Agency",
      prospectName: "Example HVAC",
      prospectWebsiteUrl: "https://example.com",
      summary: "Improve booking flow.",
      scope: "Implement selected conversion improvements.",
      nextStep: "Schedule kickoff.",
      currency: "USD",
      pricing: {
        subtotal: 500,
        discountType: "none",
        discountValue: 0,
        discountAmount: 0,
        total: 500,
      },
      lineItems: [
        {
          position: 0,
          serviceName: "Online Booking Integration",
          serviceDescription: "Connect scheduling software.",
          description: "Add booking CTAs.",
          quantity: 1,
          unitPrice: 500,
          lineTotal: 500,
        },
      ],
      snapshotCreatedAt: "2026-09-25T00:10:00.000Z",
    });
    expect(keys).not.toContain("agencyId");
    expect(keys).not.toContain("proposalId");
    expect(keys).not.toContain("prospectId");
    expect(keys).not.toContain("auditId");
    expect(keys).not.toContain("opportunityId");
    expect(keys).not.toContain("agencyServiceId");
    expect(keys).not.toContain("ranking");
    expect(keys).not.toContain("confidence");
    expect(keys).not.toContain("evidence");
    expect(keys).not.toContain("modelProvider");
    expect(keys).not.toContain("modelName");
    expect(keys).not.toContain("prompt");
    expect(keys).not.toContain("internalNotes");
  });

  it("stays unchanged if mutable source objects are changed later", () => {
    const snapshot = makeSnapshot();
    const view = buildProposalPdfView(snapshot);

    snapshot.title = "Changed proposal";
    snapshot.lineItems[0].unitPrice = 1;

    expect(view.title).toBe("Proposal for Example HVAC");
    expect(view.lineItems[0].unitPrice).toBe(500);
  });
});

function makeSnapshot(): ProposalDeliverySnapshot {
  return {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    agencyId: "22222222-2222-4222-8222-222222222222",
    proposalId: "44444444-4444-4444-8444-444444444444",
    status: "active",
    title: "Proposal for Example HVAC",
    summary: "Improve booking flow.",
    scope: "Implement selected conversion improvements.",
    nextStep: "Schedule kickoff.",
    currency: "USD",
    subtotal: 500,
    discountType: "none",
    discountValue: 0,
    discountAmount: 0,
    total: 500,
    agencyDisplayName: "Growth Agency",
    prospectDisplayName: "Example HVAC",
    prospectWebsiteUrl: "https://example.com",
    lineItems: [
      {
        position: 0,
        serviceName: "Online Booking Integration",
        serviceDescription: "Connect scheduling software.",
        description: "Add booking CTAs.",
        quantity: 1,
        unitPrice: 500,
        lineTotal: 500,
      },
    ],
    createdBy: "99999999-9999-4999-8999-999999999999",
    sourceProposalUpdatedAt: "2026-09-25T00:09:00.000Z",
    createdAt: "2026-09-25T00:10:00.000Z",
    supersededAt: null,
  };
}

function collectKeys(value: unknown, keys = new Set<string>()) {
  if (!value || typeof value !== "object") {
    return keys;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectKeys(item, keys);
    }

    return keys;
  }

  for (const [key, child] of Object.entries(value)) {
    keys.add(key);
    collectKeys(child, keys);
  }

  return keys;
}
