import { describe, expect, it } from "vitest";
import type { DeliverySnapshotPublicView } from "@/domain/proposals/types";
import {
  publicShareSecurityHeaders,
  renderProposalUnavailableHtml,
  renderPublicProposalHtml,
} from "@/features/proposals/share-links/public-page";

describe("public proposal share page", () => {
  it("renders only the public-safe snapshot projection", () => {
    const html = renderPublicProposalHtml(makePublicView());

    expect(html).toContain("Agency Growth Studio");
    expect(html).toContain("HVAC Website Growth Plan");
    expect(html).toContain("North Valley Heating");
    expect(html).toContain("Online Booking Integration");
    expect(html).toContain("USD 650.00");
    expect(html).toContain("USD 1300.00");
    expect(html).not.toContain("agency_id");
    expect(html).not.toContain("proposal_id");
    expect(html).not.toContain("prospect_id");
    expect(html).not.toContain("audit_id");
    expect(html).not.toContain("opportunity_id");
    expect(html).not.toContain("token_hash");
    expect(html).not.toContain("created_by");
    expect(html).not.toContain("ranking");
    expect(html).not.toContain("confidence");
    expect(html).not.toContain("openai");
    expect(html).not.toContain("service_role");
  });

  it("escapes snapshot content so customer data cannot inject markup", () => {
    const html = renderPublicProposalHtml(
      makePublicView({
        title: `<script>alert("x")</script>`,
        summary: `<img src="https://evil.example/pixel">`,
      }),
    );

    expect(html).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
    expect(html).toContain(
      "&lt;img src=&quot;https://evil.example/pixel&quot;&gt;",
    );
    expect(html).not.toContain("<script>");
    expect(html).not.toContain('<img src="https://evil.example/pixel">');
  });

  it("does not load third-party resources or expose external links", () => {
    const html = renderPublicProposalHtml(makePublicView());

    expect(html).not.toMatch(/\s(?:src|href)=/i);
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<iframe");
    expect(html).not.toContain("<object");
  });

  it("uses generic unavailable content for invalid, revoked, or expired tokens", () => {
    const html = renderProposalUnavailableHtml();

    expect(html).toContain("Proposal unavailable");
    expect(html).not.toContain("expired");
    expect(html).not.toContain("revoked");
    expect(html).not.toContain("not found");
  });

  it("sets privacy-preserving public route security headers", () => {
    expect(publicShareSecurityHeaders["Cache-Control"]).toBe("private, no-store");
    expect(publicShareSecurityHeaders["Referrer-Policy"]).toBe("no-referrer");
    expect(publicShareSecurityHeaders["X-Robots-Tag"]).toBe(
      "noindex, nofollow, noarchive",
    );
    expect(publicShareSecurityHeaders["X-Content-Type-Options"]).toBe("nosniff");
    expect(publicShareSecurityHeaders["Content-Security-Policy"]).toContain(
      "frame-ancestors 'none'",
    );
    expect(publicShareSecurityHeaders["Content-Security-Policy"]).toContain(
      "default-src 'none'",
    );
    expect(publicShareSecurityHeaders["Content-Security-Policy"]).toContain(
      "script-src 'none'",
    );
    expect(publicShareSecurityHeaders["Content-Security-Policy"]).toContain(
      "connect-src 'none'",
    );
  });
});

function makePublicView(
  overrides: Partial<DeliverySnapshotPublicView> = {},
): DeliverySnapshotPublicView {
  return {
    title: "HVAC Website Growth Plan",
    summary: "Reduce booking friction on the analyzed page.",
    scope: "Add an online booking section and stronger conversion path.",
    nextStep: "Approve the scope and schedule kickoff.",
    currency: "USD",
    agency: {
      displayName: "Agency Growth Studio",
    },
    prospect: {
      displayName: "North Valley Heating",
      websiteUrl: "https://northvalley.example",
    },
    pricing: {
      subtotal: 1300,
      discountType: "none",
      discountValue: 0,
      discountAmount: 0,
      total: 1300,
    },
    lineItems: [
      {
        position: 0,
        serviceName: "Online Booking Integration",
        serviceDescription: "Connect a booking CTA to scheduling software.",
        description: "Implementation and QA.",
        quantity: 2,
        unitPrice: 650,
        lineTotal: 1300,
      },
    ],
    snapshot: {
      status: "active",
      createdAt: "2026-09-26T00:00:00.000Z",
      supersededAt: null,
    },
    ...overrides,
  };
}
