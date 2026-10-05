import { describe, expect, it } from "vitest";
import type { Agency } from "@/domain/agencies/types";
import type {
  Proposal,
  ProposalLineItem,
  ProposalOpportunity,
} from "@/domain/proposals/types";
import type { Prospect } from "@/domain/prospects/types";
import {
  buildDeliverySnapshotPayload,
  type DeliverySnapshotSource,
} from "@/features/proposals/delivery/snapshot";

const agencyId = "22222222-2222-4222-8222-222222222222";
const proposalId = "44444444-4444-4444-8444-444444444444";
const prospectId = "33333333-3333-4333-8333-333333333333";
const auditId = "11111111-1111-4111-8111-111111111111";
const opportunityIdA = "55555555-5555-4555-8555-555555555555";
const opportunityIdB = "77777777-7777-4777-8777-777777777777";
const serviceIdA = "66666666-6666-4666-8666-666666666666";
const serviceIdB = "88888888-8888-4888-8888-888888888888";

describe("delivery snapshot payload", () => {
  it("creates a public-safe immutable payload from a ready proposal", () => {
    const payload = buildDeliverySnapshotPayload(makeSource());

    expect(payload).toMatchObject({
      agencyId,
      proposalId,
      createdBy: "99999999-9999-4999-8999-999999999999",
      agencyDisplayName: "Growth Agency",
      prospectDisplayName: "Example HVAC",
      prospectWebsiteUrl: "https://example.com",
      title: "Proposal for Example HVAC",
      summary: "Improve booking flow and service visibility.",
      scope: "Implement the selected conversion improvements.",
      nextStep: "Schedule kickoff.",
      currency: "USD",
      subtotal: 900,
      discountType: "fixed",
      discountValue: 50,
      discountAmount: 50,
      total: 850,
      sourceProposalUpdatedAt: "2026-09-25T00:10:00.000Z",
    });
    expect(payload.lineItems).toEqual([
      {
        position: 0,
        serviceName: "Online Booking Integration",
        serviceDescription: "Connect scheduling software.",
        description: "Add booking CTAs and scheduling handoff.",
        quantity: 1,
        unitPrice: 500,
        lineTotal: 500,
      },
      {
        position: 1,
        serviceName: "Service Area SEO",
        serviceDescription: "Create localized service area sections.",
        description: "Improve service area visibility.",
        quantity: 2,
        unitPrice: 200,
        lineTotal: 400,
      },
    ]);
  });

  it("rejects draft proposals", () => {
    expect(() =>
      buildDeliverySnapshotPayload(
        makeSource({ proposal: { status: "draft" } }),
      ),
    ).toThrow("Only ready proposals");
  });

  it("rejects cross-tenant proposal and line-item ownership", () => {
    expect(() =>
      buildDeliverySnapshotPayload(
        makeSource({ proposal: { agencyId: "other-agency" } }),
      ),
    ).toThrow("ownership");

    expect(() =>
      buildDeliverySnapshotPayload(
        makeSource({
          lineItems: [{ agencyId: "other-agency" }],
        }),
      ),
    ).toThrow("line items");
  });

  it("rejects inconsistent selected opportunities", () => {
    expect(() =>
      buildDeliverySnapshotPayload(
        makeSource({
          proposalOpportunities: [
            { opportunityId: opportunityIdA },
            { opportunityId: "99999999-9999-4999-8999-111111111111" },
          ],
        }),
      ),
    ).toThrow("line items");
  });

  it("rejects inconsistent pricing instead of trusting supplied totals", () => {
    expect(() =>
      buildDeliverySnapshotPayload(
        makeSource({ proposal: { subtotal: 999, total: 949 } }),
      ),
    ).toThrow("subtotal");

    expect(() =>
      buildDeliverySnapshotPayload(
        makeSource({
          lineItems: [{ lineTotal: 600 }],
          proposal: { subtotal: 1000, total: 950 },
        }),
      ),
    ).toThrow("line item pricing");
  });

  it("rejects line items saved after the proposal timestamp", () => {
    expect(() =>
      buildDeliverySnapshotPayload(
        makeSource({
          lineItems: [{ updatedAt: "2026-09-25T00:11:00.000Z" }],
        }),
      ),
    ).toThrow("still being saved");
  });

  it("does not mutate an existing payload when proposal or pricing inputs change", () => {
    const source = makeSource();
    const payload = buildDeliverySnapshotPayload(source);

    source.proposal.title = "Updated Proposal";
    source.proposal.summary = "Changed summary";
    source.lineItems[0].serviceName = "Updated Booking Service";
    source.lineItems[0].unitPrice = 600;

    expect(payload.title).toBe("Proposal for Example HVAC");
    expect(payload.summary).toBe("Improve booking flow and service visibility.");
    expect(payload.lineItems[0].serviceName).toBe("Online Booking Integration");
    expect(payload.lineItems[0].unitPrice).toBe(500);
  });

  it("creates a new payload with new approved values while old payload stays unchanged", () => {
    const oldPayload = buildDeliverySnapshotPayload(makeSource());
    const newPayload = buildDeliverySnapshotPayload(
      makeSource({
        proposal: {
          title: "Updated Proposal",
          subtotal: 1000,
          discountValue: 0,
          discountAmount: 0,
          total: 1000,
          discountType: "none",
          updatedAt: "2026-09-25T00:20:00.000Z",
        },
        lineItems: [
          {
            unitPrice: 600,
            lineTotal: 600,
            updatedAt: "2026-09-25T00:19:00.000Z",
          },
        ],
      }),
    );

    expect(oldPayload.title).toBe("Proposal for Example HVAC");
    expect(oldPayload.total).toBe(850);
    expect(newPayload.title).toBe("Updated Proposal");
    expect(newPayload.total).toBe(1000);
    expect(newPayload.lineItems[0].unitPrice).toBe(600);
  });
});

function makeSource(overrides: {
  proposal?: Partial<Proposal>;
  prospect?: Partial<Prospect>;
  agency?: Partial<Agency>;
  proposalOpportunities?: Array<Partial<ProposalOpportunity>>;
  lineItems?: Array<Partial<ProposalLineItem>>;
} = {}): DeliverySnapshotSource {
  const proposal = makeProposal(overrides.proposal);
  const prospect = makeProspect(overrides.prospect);
  const proposalOpportunities = [
    makeProposalOpportunity({ opportunityId: opportunityIdA }),
    makeProposalOpportunity({
      opportunityId: opportunityIdB,
      agencyServiceId: serviceIdB,
      position: 1,
    }),
  ];
  const lineItems = [
    makeLineItem({ opportunityId: opportunityIdA }),
    makeLineItem({
      id: "99999999-9999-4999-8999-000000000002",
      opportunityId: opportunityIdB,
      agencyServiceId: serviceIdB,
      position: 1,
      serviceName: "Service Area SEO",
      serviceDescription: "Create localized service area sections.",
      description: "Improve service area visibility.",
      quantity: 2,
      unitPrice: 200,
      lineTotal: 400,
    }),
  ];

  return {
    agency: {
      id: agencyId,
      ownerUserId: "99999999-9999-4999-8999-999999999999",
      name: "Growth Agency",
      website: "https://agency.example",
      defaultCurrency: "USD",
      createdAt: "2026-09-25T00:00:00.000Z",
      updatedAt: "2026-09-25T00:00:00.000Z",
      ...overrides.agency,
    },
    userId: "99999999-9999-4999-8999-999999999999",
    proposal,
    prospect,
    proposalOpportunities: applyArrayOverrides(
      proposalOpportunities,
      overrides.proposalOpportunities,
    ),
    lineItems: applyArrayOverrides(lineItems, overrides.lineItems),
  };
}

function applyArrayOverrides<T>(items: T[], overrides?: Array<Partial<T>>) {
  if (!overrides) {
    return items;
  }

  return items.map((item, index) => ({
    ...item,
    ...overrides[index],
  })) as T[];
}

function makeProposal(overrides: Partial<Proposal> = {}): Proposal {
  return {
    id: proposalId,
    agencyId,
    prospectId,
    auditId,
    title: "Proposal for Example HVAC",
    status: "ready",
    summary: "Improve booking flow and service visibility.",
    scope: "Implement the selected conversion improvements.",
    nextStep: "Schedule kickoff.",
    currency: "USD",
    subtotal: 900,
    discountType: "fixed",
    discountValue: 50,
    discountAmount: 50,
    total: 850,
    content: {
      aiDraft: {
        provider: "openai",
        model: "internal-metadata",
      },
    },
    createdAt: "2026-09-25T00:00:00.000Z",
    updatedAt: "2026-09-25T00:10:00.000Z",
    ...overrides,
  };
}

function makeProspect(overrides: Partial<Prospect> = {}): Prospect {
  return {
    id: prospectId,
    agencyId,
    businessName: "Example HVAC",
    websiteUrl: "https://example.com",
    contactName: "Private Contact",
    contactEmail: "private@example.com",
    notes: "Internal prospect note",
    createdAt: "2026-09-25T00:00:00.000Z",
    updatedAt: "2026-09-25T00:00:00.000Z",
    ...overrides,
  };
}

function makeProposalOpportunity(
  overrides: Partial<ProposalOpportunity> = {},
): ProposalOpportunity {
  return {
    proposalId,
    opportunityId: opportunityIdA,
    agencyId,
    agencyServiceId: serviceIdA,
    position: 0,
    opportunityTitle: "Missing Online Booking",
    opportunityShortDescription: "Booking was not detected.",
    serviceName: "Online Booking Integration",
    serviceDescription: "Connect scheduling software.",
    aiSalesSummary: "Client-facing approved text.",
    aiClientFacingExplanation: "Client-facing explanation.",
    createdAt: "2026-09-25T00:01:00.000Z",
    ...overrides,
  };
}

function makeLineItem(overrides: Partial<ProposalLineItem> = {}): ProposalLineItem {
  return {
    id: "99999999-9999-4999-8999-000000000001",
    proposalId,
    opportunityId: opportunityIdA,
    agencyId,
    agencyServiceId: serviceIdA,
    position: 0,
    serviceName: "Online Booking Integration",
    serviceDescription: "Connect scheduling software.",
    description: "Add booking CTAs and scheduling handoff.",
    quantity: 1,
    unitPrice: 500,
    lineTotal: 500,
    createdAt: "2026-09-25T00:01:00.000Z",
    updatedAt: "2026-09-25T00:09:00.000Z",
    ...overrides,
  };
}
