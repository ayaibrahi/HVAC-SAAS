import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { extractNormalizedAuditSignals } from "./signals";
import { hasVerifiedPageContent } from "./content-quality";
import type { SafeFetchResult } from "./safe-fetch";
import { evaluateOpportunitiesForAudit } from "@/features/opportunities/engine/evaluate";
import { makeAudit } from "@/features/opportunities/test-fixtures";
import { assertAuditReadyForOpportunityGeneration } from "@/features/opportunities/authorization";

const fixture = (name: string) =>
  readFileSync(new URL(`./fixtures/${name}.html`, import.meta.url), "utf8");
function inspect(html: string, overrides: Partial<SafeFetchResult> = {}) {
  return extractNormalizedAuditSignals({
    verticalKey: "hvac",
    playbookVersion: "1.0.0",
    fetchResult: {
      analyzedUrl: "https://example.com/",
      finalUrl: "https://example.com/",
      html,
      status: 200,
      contentType: "text/html",
      responseTimeMs: 10,
      responseSizeBytes: Buffer.byteLength(html),
      redirectCount: 0,
      ...overrides,
    },
  });
}
const evaluate = (signals: ReturnType<typeof inspect>) =>
  evaluateOpportunitiesForAudit({
    audit: makeAudit(signals),
    agencyServices: [],
  });

describe("static page reliability boundary", () => {
  it("recognizes real header phone, nested booking CTA and emergency service link", () => {
    const signals = inspect(fixture("representative"));
    expect(signals.quality?.status).toBe("sufficient");
    expect(signals.contactConversion.phoneDetected.value).toBe(true);
    expect(signals.contactConversion.ctaCount.value).toBeGreaterThan(0);
    expect(signals.hvac.onlineBooking.value).toBe(true);
    expect(signals.hvac.emergencyService.value).toBe(true);
    expect(evaluate(signals).map((o) => o.ruleKey)).not.toEqual(
      expect.arrayContaining(["missing_online_booking"]),
    );
    expect(
      evaluate(signals).some((o) =>
        [
          "weak_lead_capture",
          "missing_online_booking",
          "weak_emergency_conversion",
        ].includes(o.ruleKey),
      ),
    ).toBe(false);
  });
  it.each([
    '<button aria-label="Schedule appointment"><svg></svg></button>',
    '<a href="/visit" aria-label="Book now"><img alt=""></a>',
    '<a href="/schedule"><span>Arrange an appointment</span></a>',
  ])("recognizes supported booking element: %s", (markup) => {
    const signals = inspect(
      fixture("absent").replace("</main>", markup + "</main>"),
    );
    expect(signals.hvac.onlineBooking.value).toBe(true);
  });
  it("keeps legitimate page-scoped absence findings on sufficient static HTML", () => {
    const signals = inspect(fixture("absent"));
    expect(signals.quality?.status).toBe("sufficient");
    expect(evaluate(signals).length).toBe(5);
    for (const opportunity of evaluate(signals))
      for (const evidence of opportunity.evidence)
        expect(evidence.scope).toBe("analyzed_page");
  });
  it.each(["shell", "challenge"])(
    "suppresses %s absence findings, preserving observed positives",
    (name) => {
      const signals = inspect(fixture(name));
      expect(signals.quality?.status).toBe("insufficient");
      expect(evaluate(signals)).toEqual([]);
      if (name === "shell")
        expect(signals.contactConversion.phoneDetected.value).toBe(true);
    },
  );
  it.each([
    "",
    "<html><body><h1>Empty</h1></body></html>",
    "<html><body><main>Incomplete",
    "<p>Accept cookies to continue</p>",
  ])("fails closed for missing/thin/incomplete content", (html) => {
    expect(evaluate(inspect(html))).toEqual([]);
  });
  it.each([403, 429, 500, 206, 204])(
    "cannot recommend from HTTP %s even with business-looking body",
    (status) => {
      expect(evaluate(inspect(fixture("representative"), { status }))).toEqual(
        [],
      );
    },
  );
  it("does not invent positive evidence from scripts/comments/templates", () => {
    const html = fixture("absent").replace(
      "</main>",
      '<script>const s = \'<a href="/book">Emergency HVAC service</a>\';</script><!-- <a href="tel:+18005550199">Call</a> --><template><a href="/book">Book</a></template></main>',
    );
    const signals = inspect(html);
    expect(signals.hvac.onlineBooking.value).toBe(false);
    expect(signals.contactConversion.phoneDetected.value).toBe(false);
    expect(signals.hvac.emergencyService.value).toBe(false);
  });
  it("does not let negative body wording override observed booking/phone links", () => {
    const signals = inspect(
      fixture("representative").replace(
        "</main>",
        "<p>No phone or booking is mentioned in this synthetic sentence.</p></main>",
      ),
    );
    expect(signals.contactConversion.phoneDetected.value).toBe(true);
    expect(signals.hvac.onlineBooking.value).toBe(true);
  });
  it("refuses unassessed historical audits before persistence without rewriting them", () => {
    const signals = inspect(fixture("absent"));
    delete signals.quality;
    const audit = makeAudit(signals),
      before = JSON.stringify(audit);
    expect(hasVerifiedPageContent(audit.normalizedSignals)).toBe(false);
    expect(() =>
      assertAuditReadyForOpportunityGeneration(audit, audit.agencyId),
    ).toThrow("could not be reliably verified");
    expect(evaluate(signals)).toEqual([]);
    expect(JSON.stringify(audit)).toBe(before);
  });
  it("does not suppress an ordinary security/cookie mention on a full business page", () => {
    expect(
      inspect(
        fixture("absent").replace(
          "</main>",
          "<p>We respect customer security and cookie preferences.</p></main>",
        ),
      ).quality?.status,
    ).toBe("sufficient");
  });
});
