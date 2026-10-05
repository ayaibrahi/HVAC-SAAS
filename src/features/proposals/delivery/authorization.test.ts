import { describe, expect, it } from "vitest";
import type { ProposalDeliverySnapshot } from "@/domain/proposals/types";
import { assertDeliverySnapshotAccess } from "@/features/proposals/delivery/authorization";

const agencyId = "22222222-2222-4222-8222-222222222222";

describe("delivery snapshot authorization", () => {
  it("allows access to an agency-owned delivery snapshot", () => {
    expect(() =>
      assertDeliverySnapshotAccess({
        agencyId,
        snapshot: makeSnapshot(),
      }),
    ).not.toThrow();
  });

  it("rejects cross-agency delivery snapshot reads", () => {
    expect(() =>
      assertDeliverySnapshotAccess({
        agencyId,
        snapshot: makeSnapshot({ agencyId: "other-agency" }),
      }),
    ).toThrow("Delivery snapshot not found.");
  });

  it("rejects missing delivery snapshots", () => {
    expect(() =>
      assertDeliverySnapshotAccess({
        agencyId,
        snapshot: null,
      }),
    ).toThrow("Delivery snapshot not found.");
  });
});

function makeSnapshot(
  overrides: Partial<ProposalDeliverySnapshot> = {},
): ProposalDeliverySnapshot {
  return {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    agencyId,
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
    ...overrides,
  };
}
