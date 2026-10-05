import { describe, expect, it } from "vitest";
import { extractNormalizedAuditSignals } from "@/features/audits/analyzer/signals";

const baseFetchResult = {
  analyzedUrl: "https://examplehvac.com/",
  finalUrl: "https://examplehvac.com/",
  status: 200,
  responseTimeMs: 123,
  responseSizeBytes: 4096,
  redirectCount: 0,
  contentType: "text/html",
};

describe("extractNormalizedAuditSignals", () => {
  it("extracts deterministic page, contact, and HVAC evidence", () => {
    const signals = extractNormalizedAuditSignals({
      verticalKey: "hvac",
      playbookVersion: "1.0.0",
      fetchedAt: "2026-09-20T00:00:00.000Z",
      fetchResult: {
        ...baseFetchResult,
        html: `
          <!doctype html>
          <html>
            <head>
              <title>AC Repair Pros</title>
              <meta name="description" content="24/7 emergency AC repair and heating service.">
              <meta name="viewport" content="width=device-width, initial-scale=1">
              <meta name="robots" content="index,follow">
              <link rel="canonical" href="/home">
              <script type="application/ld+json">{"@type":"LocalBusiness"}</script>
            </head>
            <body>
              <h1>Emergency AC Repair</h1>
              <h2>Heating and cooling</h2>
              <a href="/air-conditioning-repair">Air conditioning repair</a>
              <a href="/schedule">Schedule service</a>
              <a href="/free-estimate">Free estimate</a>
              <a href="/contact">Contact us</a>
              <form action="/contact"><input type="email" name="email"></form>
              <img src="/truck.jpg">
              <img src="/team.jpg" alt="HVAC technicians">
              <p>Call (555) 234-9876 for emergency HVAC repair. Maintenance plan and financing available. Serving Austin, Round Rock, and Cedar Park.</p>
              <p>Email help@examplehvac.com.</p>
            </body>
          </html>
        `,
      },
    });

    expect(signals.fetch.httpStatus.value).toBe(200);
    expect(signals.page.title.value).toBe("AC Repair Pros");
    expect(signals.page.hasViewportMeta.value).toBe(true);
    expect(signals.page.hasJsonLd.value).toBe(true);
    expect(signals.page.imagesMissingAlt.value).toBe(1);
    expect(signals.contactConversion.phoneDetected.value).toBe(true);
    expect(signals.contactConversion.emailDetected.value).toBe(true);
    expect(signals.contactConversion.contactFormDetected.value).toBe(true);
    expect(signals.contactConversion.bookingLinkDetected.value).toBe(true);
    expect(signals.hvac.emergencyService.value).toBe(true);
    expect(signals.hvac.maintenancePlan.value).toBe(true);
    expect(signals.hvac.financing.value).toBe(true);
    expect(signals.hvac.serviceArea.value).toBe(true);
    expect(signals.hvac.hvacServicePages.value).toEqual({
      detected: true,
      services: ["Air conditioning"],
    });
    expect(signals.hvac.requestEstimate.evidence[0]?.snippet).toContain("Free estimate");
  });

  it("records negative evidence without fabricating missing HVAC signals", () => {
    const signals = extractNormalizedAuditSignals({
      verticalKey: "hvac",
      playbookVersion: "1.0.0",
      fetchResult: {
        ...baseFetchResult,
        html: "<html><head><title>Plain Site</title></head><body><h1>Hello</h1></body></html>",
      },
    });

    expect(signals.hvac.onlineBooking.value).toBe(false);
    expect(signals.hvac.requestEstimate.value).toBe(false);
    expect(signals.hvac.hvacServicePages.value.detected).toBe(false);
    expect(signals.contactConversion.ctaCount.value).toBe(0);
  });
});
