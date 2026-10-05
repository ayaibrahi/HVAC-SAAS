import { describe, expect, it, vi } from "vitest";
import {
  extractPdfInspectableText,
  renderProposalPdf,
} from "@/features/proposals/pdf/renderer";
import type { ProposalPdfView } from "@/features/proposals/pdf/view-model";

describe("proposal PDF renderer", () => {
  it("renders deterministic PDF bytes from snapshot-only view data", () => {
    const view = makePdfView();
    const first = renderProposalPdf(view);
    const second = renderProposalPdf(view);
    const text = extractPdfInspectableText(first);

    expect(Buffer.from(first).equals(Buffer.from(second))).toBe(true);
    expect(text).toContain("%PDF-1.4");
    expect(text).toContain("Growth Agency");
    expect(text).toContain("Proposal for Example HVAC");
    expect(text).toContain("Prepared for Example HVAC");
    expect(text).toContain("Improve booking flow.");
    expect(text).toContain("Implement selected conversion improvements.");
    expect(text).toContain("Online Booking Integration");
    expect(text).toContain("Quantity 1 | Unit USD 500.00");
    expect(text).toContain("Subtotal");
    expect(text).toContain("USD 500.00");
    expect(text).toContain("Total");
    expect(text).toContain("Schedule kickoff.");
  });

  it("reflects stored snapshot pricing without accepting request-time totals", () => {
    const text = extractPdfInspectableText(
      renderProposalPdf(
        makePdfView({
          pricing: {
            subtotal: 900,
            discountType: "fixed",
            discountValue: 50,
            discountAmount: 50,
            total: 850,
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
            {
              position: 1,
              serviceName: "Service Area SEO",
              serviceDescription: "Create service-area sections.",
              description: "Improve local discoverability.",
              quantity: 2,
              unitPrice: 200,
              lineTotal: 400,
            },
          ],
        }),
      ),
    );

    expect(text).toContain("USD 900.00");
    expect(text).toContain("Discount");
    expect(text).toContain("USD 50.00");
    expect(text).toContain("USD 850.00");
    expect(text).not.toContain("USD 1.00");
    expect(text).not.toContain("USD 100000.00");
  });

  it("does not expose internal IDs, evidence, rankings, or AI metadata", () => {
    const text = extractPdfInspectableText(renderProposalPdf(makePdfView()));

    expect(text).not.toContain("22222222-2222-4222-8222-222222222222");
    expect(text).not.toContain("44444444-4444-4444-8444-444444444444");
    expect(text).not.toContain("11111111-1111-4111-8111-111111111111");
    expect(text).not.toContain("55555555-5555-4555-8555-555555555555");
    expect(text).not.toContain("online_booking");
    expect(text).not.toContain("confidence");
    expect(text).not.toContain("ranking");
    expect(text).not.toContain("openai");
    expect(text).not.toContain("prompt");
    expect(text).not.toContain("Internal prospect note");
  });

  it("treats markup-like content as inert text, not executable PDF actions", () => {
    const text = extractPdfInspectableText(
      renderProposalPdf(
        makePdfView({
          title: "<script>alert('x')</script>",
          summary: "Use (literal) text and backslash \\ safely.",
        }),
      ),
    );

    expect(text).toContain("<script>alert");
    expect(text).toContain("Use \\(literal\\) text and backslash \\\\ safely.");
    expect(text).not.toContain("/JavaScript");
    expect(text).not.toContain("/JS");
    expect(text).not.toContain("/OpenAction");
    expect(text).not.toContain("/AA");
  });

  it("does not fetch URLs or remote resources while rendering", () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("network forbidden"));
    const text = extractPdfInspectableText(
      renderProposalPdf(
        makePdfView({
          prospectWebsiteUrl: "http://169.254.169.254",
          summary: "Review http://127.0.0.1 as plain text only.",
        }),
      ),
    );

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(text).toContain("http://169.254.169.254");
    expect(text).toContain("http://127.0.0.1");
    fetchSpy.mockRestore();
  });

  it("supports concurrent downloads without mutating the view", async () => {
    const view = makePdfView();
    const before = JSON.stringify(view);
    const [first, second] = await Promise.all([
      Promise.resolve(renderProposalPdf(view)),
      Promise.resolve(renderProposalPdf(view)),
    ]);

    expect(Buffer.from(first).equals(Buffer.from(second))).toBe(true);
    expect(JSON.stringify(view)).toBe(before);
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
