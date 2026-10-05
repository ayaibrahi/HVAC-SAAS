import { describe, expect, it } from "vitest";
import type { ProposalDeliverySnapshot } from "@/domain/proposals/types";
import {
  buildProposalPdfFilename,
  sanitizeFilenamePart,
} from "@/features/proposals/pdf/filename";
import { createProposalPdfResponse } from "@/features/proposals/pdf/response";
import { assertPdfSnapshot } from "@/features/proposals/pdf/snapshot";
import type { ProposalPdfView } from "@/features/proposals/pdf/view-model";

describe("proposal PDF download helpers", () => {
  it("sanitizes filenames against path traversal, quotes, controls, unicode, and long names", () => {
    expect(sanitizeFilenamePart("../../secret")).toBe("secret");
    expect(sanitizeFilenamePart("..\\..\\secret")).toBe("secret");
    expect(sanitizeFilenamePart('"quoted\'\u0000name')).toBe("quoted-name");
    expect(sanitizeFilenamePart("عميل")).toBe("");
    expect(sanitizeFilenamePart("A".repeat(200))).toHaveLength(80);
    expect(buildProposalPdfFilename(makePdfView({ prospectName: "عميل", title: "" }))).toBe(
      "proposal.pdf",
    );
    expect(
      buildProposalPdfFilename(
        makePdfView({
          prospectName: "../../secret",
          title: "Proposal \"Q4\"",
        }),
      ),
    ).toBe("secret-proposal-q4.pdf");
  });

  it("builds secure PDF response headers", () => {
    const response = createProposalPdfResponse({
      filename: "example-proposal.pdf",
      bytes: new Uint8Array([37, 80, 68, 70]),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Disposition")).toBe(
      'attachment; filename="example-proposal.pdf"',
    );
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("rejects missing or invalid delivery snapshots safely", () => {
    expect(() => assertPdfSnapshot(null)).toThrow("Delivery snapshot not found.");
    expect(() =>
      assertPdfSnapshot(makeSnapshot({ lineItems: [] })),
    ).toThrow("not ready");
  });
});

function makePdfView(overrides: Partial<ProposalPdfView> = {}): ProposalPdfView {
  return {
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
    ...overrides,
  };
}

function makeSnapshot(
  overrides: Partial<ProposalDeliverySnapshot> = {},
): ProposalDeliverySnapshot {
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
    ...overrides,
  };
}
