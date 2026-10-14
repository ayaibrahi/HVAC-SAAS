import { describe, expect, it } from "vitest";
import type { OpportunityDraft } from "@/features/opportunities/types";
import { mapOpportunityToAgencyService } from "@/features/opportunities/engine/map-services";
import { makeService } from "@/features/opportunities/test-fixtures";

describe("mapOpportunityToAgencyService", () => {
  it("does not assign a booking-only service to financing visibility", () => {
    const financing: OpportunityDraft = {
      ...makeBookingOpportunity(),
      ruleKey: "financing_visibility",
      recommendedServiceCategory: "Financing Conversion Section",
    };
    const booking = makeService({
      id: "booking",
      name: "Booking Integration",
      description: "Online appointment scheduling",
    });
    expect(mapOpportunityToAgencyService(financing, [booking])).toBeNull();
    expect(
      mapOpportunityToAgencyService(financing, [
        booking,
        makeService({
          id: "financing",
          name: "Financing Conversion Section",
          description: null,
        }),
      ]),
    ).toBe("financing");
  });
  it("maps an opportunity to a matching active agency service", () => {
    const service = makeService({
      id: "service-booking",
      name: "Online Booking Integration",
    });

    expect(
      mapOpportunityToAgencyService(makeBookingOpportunity(), [
        makeService({ id: "service-redesign", name: "Website Redesign" }),
        service,
      ]),
    ).toBe(service.id);
  });

  it("returns null when no suitable active service exists", () => {
    expect(
      mapOpportunityToAgencyService(makeBookingOpportunity(), [
        makeService({ id: "service-redesign", name: "Website Redesign" }),
      ]),
    ).toBeNull();
  });

  it("ignores inactive services", () => {
    expect(
      mapOpportunityToAgencyService(makeBookingOpportunity(), [
        makeService({
          id: "inactive-booking",
          name: "Online Booking Integration",
          isActive: false,
        }),
      ]),
    ).toBeNull();
  });

  it("chooses the strongest deterministic match when multiple services fit", () => {
    expect(
      mapOpportunityToAgencyService(makeBookingOpportunity(), [
        makeService({ id: "service-landing", name: "Booking Landing Page" }),
        makeService({
          id: "service-booking",
          name: "Online Booking Integration",
        }),
      ]),
    ).toBe("service-booking");
  });
});

function makeBookingOpportunity(): OpportunityDraft {
  return {
    verticalKey: "hvac",
    playbookVersion: "1.0.0",
    ruleKey: "missing_online_booking",
    title: "Missing Online Booking",
    shortDescription:
      "Online booking or scheduling was not detected on the analyzed page.",
    businessImpact: "Clear booking paths can improve lead capture.",
    evidence: [
      {
        signal: "hvac.onlineBooking",
        observed_value: false,
        scope: "analyzed_page",
        source: "deterministic_analyzer",
        details: "No booking-related link or CTA was detected.",
      },
    ],
    priority: "high",
    confidence: "medium",
    recommendedServiceCategory: "Online Booking Integration",
  };
}
