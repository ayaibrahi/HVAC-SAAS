import { describe, expect, it } from "vitest";
import { evaluateHvacOpportunityRules } from "@/features/opportunities/rules/hvac";
import {
  makeAudit,
  makeDetectedSignals,
  signal,
} from "@/features/opportunities/test-fixtures";
import { opportunityEvidenceSchema } from "@/lib/validation/opportunities";

describe("evaluateHvacOpportunityRules", () => {
  it("creates a booking opportunity when online booking is not detected", () => {
    const signals = makeDetectedSignals();
    signals.hvac.onlineBooking = signal(false, "medium");

    const opportunities = evaluateHvacOpportunityRules({
      audit: makeAudit(signals),
    });

    expect(opportunities).toHaveLength(1);
    expect(opportunities[0]?.ruleKey).toBe("missing_online_booking");
    expect(opportunities[0]?.recommendedServiceCategory).toBe(
      "Online Booking Integration",
    );
    expect(opportunities[0]?.evidence[0]).toMatchObject({
      signal: "hvac.onlineBooking",
      observed_value: false,
      scope: "analyzed_page",
      source: "deterministic_analyzer",
    });
  });

  it.each([
    {
      signalKey: "emergencyService",
      ruleKey: "weak_emergency_conversion",
      title: "Weak Emergency-Service Conversion",
    },
    {
      signalKey: "financing",
      ruleKey: "financing_visibility",
      title: "Financing Visibility Opportunity",
    },
    {
      signalKey: "maintenancePlan",
      ruleKey: "maintenance_plan_visibility",
      title: "Maintenance Plan Visibility",
    },
    {
      signalKey: "serviceArea",
      ruleKey: "service_area_local_seo",
      title: "Service Area / Local SEO Opportunity",
    },
  ] as const)(
    "creates $title when hvac.$signalKey is not detected",
    ({ signalKey, ruleKey, title }) => {
      const signals = makeDetectedSignals();
      signals.hvac[signalKey] = signal(false, "medium");

      const opportunities = evaluateHvacOpportunityRules({
        audit: makeAudit(signals),
      });

      expect(opportunities).toHaveLength(1);
      expect(opportunities[0]?.ruleKey).toBe(ruleKey);
      expect(opportunities[0]?.title).toBe(title);
      expect(opportunities[0]?.evidence[0]?.signal).toBe(`hvac.${signalKey}`);
    },
  );

  it("creates a lead-capture opportunity from weak CTA and contact signals", () => {
    const signals = makeDetectedSignals();
    signals.contactConversion.ctaCount = signal(0, "high");
    signals.contactConversion.phoneDetected = signal(false, "medium");
    signals.contactConversion.contactLinkDetected = signal(false, "medium");
    signals.contactConversion.contactFormDetected = signal(false, "medium");

    const opportunities = evaluateHvacOpportunityRules({
      audit: makeAudit(signals),
    });

    expect(opportunities).toHaveLength(1);
    expect(opportunities[0]?.ruleKey).toBe("weak_lead_capture");
    expect(opportunities[0]?.evidence.map((item) => item.signal)).toEqual([
      "contactConversion.ctaCount",
      "contactConversion.phoneDetected",
      "contactConversion.contactLinkDetected",
      "contactConversion.contactFormDetected",
    ]);
  });

  it("creates a page-scoped HVAC service visibility opportunity", () => {
    const signals = makeDetectedSignals();
    signals.hvac.hvacServicePages = signal(
      {
        detected: true,
        services: ["Air conditioning"],
      },
      "high",
    );

    const opportunities = evaluateHvacOpportunityRules({
      audit: makeAudit(signals),
    });

    expect(opportunities).toHaveLength(1);
    expect(opportunities[0]?.ruleKey).toBe("hvac_service_visibility");
    expect(opportunities[0]?.evidence[0]?.details).toContain(
      "This analyzed page",
    );
    expect(opportunities[0]?.evidence[0]?.details).toContain("Heating");
  });

  it("does not generate unsupported opportunities for unknown signals", () => {
    const signals = makeDetectedSignals();
    const hvacSignals = signals.hvac as Record<string, unknown>;
    delete hvacSignals.financing;
    delete hvacSignals.onlineBooking;

    const opportunities = evaluateHvacOpportunityRules({
      audit: makeAudit(signals),
    });

    expect(opportunities.map((item) => item.ruleKey)).not.toContain(
      "financing_visibility",
    );
    expect(opportunities.map((item) => item.ruleKey)).not.toContain(
      "missing_online_booking",
    );
  });

  it("validates evidence and avoids unsupported whole-site claims", () => {
    const signals = makeDetectedSignals();
    signals.hvac.onlineBooking = signal(false, "medium");
    signals.hvac.emergencyService = signal(false, "medium");
    signals.hvac.financing = signal(false, "medium");
    signals.hvac.maintenancePlan = signal(false, "medium");
    signals.hvac.serviceArea = signal(false, "medium");
    signals.hvac.hvacServicePages = signal(
      {
        detected: false,
        services: [],
      },
      "medium",
    );
    signals.contactConversion.ctaCount = signal(0, "high");

    const opportunities = evaluateHvacOpportunityRules({
      audit: makeAudit(signals),
    });

    expect(opportunities.length).toBeGreaterThan(0);

    for (const opportunity of opportunities) {
      expect(opportunity.evidence.length).toBeGreaterThan(0);
      expect(opportunityEvidenceSchema.array().safeParse(opportunity.evidence).success)
        .toBe(true);

      const text = [
        opportunity.title,
        opportunity.shortDescription,
        opportunity.businessImpact,
        ...opportunity.evidence.map((item) => item.details),
      ].join(" ");

      expect(text).not.toMatch(
        /entire website|whole website|business does not|does not offer|absent from the website/i,
      );
      expect(opportunity.evidence.every((item) => item.scope === "analyzed_page"))
        .toBe(true);
    }
  });
});
