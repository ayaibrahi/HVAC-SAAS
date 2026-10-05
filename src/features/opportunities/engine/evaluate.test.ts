import { describe, expect, it } from "vitest";
import { evaluateOpportunitiesForAudit } from "@/features/opportunities/engine/evaluate";
import { maxRankedOpportunities } from "@/features/opportunities/engine/rank";
import {
  makeAudit,
  makeDetectedSignals,
  makeService,
  signal,
} from "@/features/opportunities/test-fixtures";

describe("evaluateOpportunitiesForAudit", () => {
  it("ranks opportunities deterministically and returns at most five", () => {
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

    const audit = makeAudit(signals);
    const services = [
      makeService({ id: "booking", name: "Online Booking Integration" }),
      makeService({ id: "emergency", name: "Emergency HVAC Landing Page" }),
      makeService({ id: "seo", name: "Local SEO Service Area Pages" }),
      makeService({ id: "conversion", name: "Conversion Optimization" }),
    ];

    const firstRun = evaluateOpportunitiesForAudit({
      audit,
      agencyServices: services,
    });
    const secondRun = evaluateOpportunitiesForAudit({
      audit,
      agencyServices: services,
    });

    expect(firstRun).toHaveLength(maxRankedOpportunities);
    expect(firstRun.map((item) => item.ruleKey)).toEqual(
      secondRun.map((item) => item.ruleKey),
    );
    expect(firstRun.map((item) => item.rank)).toEqual([1, 2, 3, 4, 5]);

    for (let index = 1; index < firstRun.length; index += 1) {
      expect(firstRun[index - 1]?.score).toBeGreaterThanOrEqual(
        firstRun[index]?.score ?? 0,
      );
    }
  });

  it("returns fewer than five opportunities when fewer rules are supported", () => {
    const signals = makeDetectedSignals();
    signals.hvac.financing = signal(false, "medium");

    const opportunities = evaluateOpportunitiesForAudit({
      audit: makeAudit(signals),
      agencyServices: [],
    });

    expect(opportunities).toHaveLength(1);
    expect(opportunities[0]?.ruleKey).toBe("financing_visibility");
    expect(opportunities[0]?.agencyServiceId).toBeNull();
  });

  it("adds a service-match boost without inventing a service", () => {
    const signals = makeDetectedSignals();
    signals.hvac.onlineBooking = signal(false, "medium");

    const [withService] = evaluateOpportunitiesForAudit({
      audit: makeAudit(signals),
      agencyServices: [
        makeService({ id: "booking", name: "Online Booking Integration" }),
      ],
    });
    const [withoutService] = evaluateOpportunitiesForAudit({
      audit: makeAudit(signals),
      agencyServices: [],
    });

    expect(withService?.agencyServiceId).toBe("booking");
    expect(withoutService?.agencyServiceId).toBeNull();
    expect(withService?.score).toBeGreaterThan(withoutService?.score ?? 0);
  });
});
