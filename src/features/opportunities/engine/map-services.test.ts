import { describe, expect, it } from "vitest";
import type { OpportunityDraft } from "@/features/opportunities/types";
import { mapOpportunityToAgencyService } from "@/features/opportunities/engine/map-services";
import { makeService } from "@/features/opportunities/test-fixtures";

describe("mapOpportunityToAgencyService", () => {
  it("approved deliverables override a misleading name and preserve manual price", () => {
    const service = makeService({ id: "approved", name: "Online Booking Integration", approvedScope: {
      deliverables: "Contact form and call to action review.", exclusions: "Booking integration.",
      clientInputs: "Approved content.", completionChecks: "Agency review.",
    } });
    const original = structuredClone(service);
    expect(mapOpportunityToAgencyService(makeBookingOpportunity(), [service])).toBeNull();
    expect(mapOpportunityToAgencyService({ ...makeBookingOpportunity(), ruleKey: "weak_lead_capture" }, [service])).toBe(service.id);
    expect(service).toEqual(original);
    expect(service.price).toBe(500);
  });
  it("requires approved capability and rejects explicit exclusions and malformed scope", () => {
    const service = makeService({ id: "approved", name: "General service", approvedScope: {
      deliverables: "Online booking integration.", exclusions: "Payment processing.",
      clientInputs: "Approved account.", completionChecks: "Owner verifies booking link.",
    } });
    expect(mapOpportunityToAgencyService(makeBookingOpportunity(), [service])).toBe(service.id);
    service.approvedScope!.exclusions = "Online booking is excluded.";
    expect(mapOpportunityToAgencyService(makeBookingOpportunity(), [service])).toBeNull();
    service.approvedScope!.exclusions = "";
    expect(mapOpportunityToAgencyService(makeBookingOpportunity(), [service])).toBeNull();
  });
  it("does not match a negated approved appointment-link deliverable", () => {
    const service = makeService({ id: "no-booking", name: "Online Booking Integration", approvedScope: {
      deliverables: "Do not add an appointment link.", exclusions: "Extra pages.",
      clientInputs: "Approved content.", completionChecks: "Owner review.",
    } });
    expect(mapOpportunityToAgencyService(makeBookingOpportunity(), [service])).toBeNull();
  });
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
