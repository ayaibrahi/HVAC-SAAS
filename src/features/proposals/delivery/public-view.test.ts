import { describe, expect, it } from "vitest";
import type { ProposalDeliverySnapshot } from "@/domain/proposals/types";
import { mapDeliverySnapshotToPublicView } from "@/features/proposals/delivery/public-view";

describe("delivery snapshot public projection", () => {
  it("selects only public-safe fields", () => {
    const snapshot = {
      ...makeSnapshot(),
      auditId: "internal-audit-id",
      prospectId: "internal-prospect-id",
      opportunityId: "internal-opportunity-id",
      rankingScore: 99,
      confidence: "high",
      evidence: [{ signal: "online_booking" }],
      normalizedSignals: { online_booking: false },
      internalNotes: "do not expose",
      modelProvider: "openai",
      modelName: "internal-model",
      promptVersion: "proposal-v1",
      lineItems: [
        {
          ...makeSnapshot().lineItems[0],
          agencyServiceId: "internal-service-id",
          opportunityId: "internal-opportunity-id",
          confidence: "high",
        },
      ],
    } as unknown as ProposalDeliverySnapshot;
    const publicView = mapDeliverySnapshotToPublicView(snapshot);
    const keys = collectKeys(publicView);

    expect(publicView).toEqual({
      title: "Proposal for Example HVAC",
      summary: "Improve booking flow.",
      scope: "Implement selected conversion improvements.",
      nextStep: "Schedule kickoff.",
      currency: "USD",
      agency: {
        displayName: "Growth Agency",
      },
      prospect: {
        displayName: "Example HVAC",
        websiteUrl: "https://example.com",
      },
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
      snapshot: {
        status: "active",
        createdAt: "2026-09-25T00:10:00.000Z",
        supersededAt: null,
      },
    });
    expect(keys).not.toContain("agencyId");
    expect(keys).not.toContain("proposalId");
    expect(keys).not.toContain("prospectId");
    expect(keys).not.toContain("auditId");
    expect(keys).not.toContain("opportunityId");
    expect(keys).not.toContain("agencyServiceId");
    expect(keys).not.toContain("rankingScore");
    expect(keys).not.toContain("confidence");
    expect(keys).not.toContain("evidence");
    expect(keys).not.toContain("normalizedSignals");
    expect(keys).not.toContain("internalNotes");
    expect(keys).not.toContain("modelProvider");
    expect(keys).not.toContain("modelName");
    expect(keys).not.toContain("promptVersion");
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
