import { describe, expect, it } from "vitest";
import type { Opportunity } from "@/domain/opportunities/types";
import type { Prospect } from "@/domain/prospects/types";
import { assertOpportunityAiAccess } from "@/features/opportunities/ai/authorization";
import {
  makeAudit,
  makeDetectedSignals,
} from "@/features/opportunities/test-fixtures";

const agencyId = "22222222-2222-4222-8222-222222222222";
const auditId = "11111111-1111-4111-8111-111111111111";
const prospectId = "33333333-3333-4333-8333-333333333333";

describe("assertOpportunityAiAccess", () => {
  it("allows same-agency opportunity, audit, and prospect access", () => {
    expect(() =>
      assertOpportunityAiAccess({
        agencyId,
        opportunity: makeOpportunity(),
        audit: makeAudit(makeDetectedSignals()),
        prospect: makeProspect(),
      }),
    ).not.toThrow();
  });

  it("rejects cross-agency opportunity access", () => {
    expect(() =>
      assertOpportunityAiAccess({
        agencyId,
        opportunity: makeOpportunity({ agencyId: "different-agency" }),
        audit: makeAudit(makeDetectedSignals()),
        prospect: makeProspect(),
      }),
    ).toThrow("Opportunity not found.");
  });

  it("rejects audit ownership mismatches", () => {
    expect(() =>
      assertOpportunityAiAccess({
        agencyId,
        opportunity: makeOpportunity(),
        audit: makeAudit(makeDetectedSignals(), { agencyId: "different-agency" }),
        prospect: makeProspect(),
      }),
    ).toThrow("Audit not found.");
  });

  it("rejects prospect ownership mismatches", () => {
    expect(() =>
      assertOpportunityAiAccess({
        agencyId,
        opportunity: makeOpportunity(),
        audit: makeAudit(makeDetectedSignals()),
        prospect: makeProspect({ agencyId: "different-agency" }),
      }),
    ).toThrow("Prospect not found.");
  });

  it("rejects incomplete audits", () => {
    expect(() =>
      assertOpportunityAiAccess({
        agencyId,
        opportunity: makeOpportunity(),
        audit: makeAudit(makeDetectedSignals(), { status: "running" }),
        prospect: makeProspect(),
      }),
    ).toThrow("AI insights can only be generated for completed audits.");
  });
});

function makeOpportunity(overrides: Partial<Opportunity> = {}): Opportunity {
  return {
    id: "44444444-4444-4444-8444-444444444444",
    agencyId,
    auditId,
    prospectId,
    agencyServiceId: null,
    verticalKey: "hvac",
    playbookVersion: "1.0.0",
    ruleKey: "missing_online_booking",
    title: "Missing Online Booking",
    shortDescription:
      "Online booking or scheduling was not detected on the analyzed page.",
    businessImpact:
      "Clear booking paths can reduce friction for high-intent visitors.",
    evidence: [
      {
        signal: "hvac.onlineBooking",
        observed_value: false,
        scope: "analyzed_page",
        source: "deterministic_analyzer",
        details:
          "No booking-related link or CTA was detected on the analyzed page.",
      },
    ],
    priority: "high",
    confidence: "high",
    recommendedServiceCategory: "Online Booking Integration",
    score: 91,
    rankingRationale:
      "Priority 35, confidence 25, evidence 6, HVAC relevance 16, service match present.",
    status: "open",
    createdAt: "2026-09-23T00:00:00.000Z",
    updatedAt: "2026-09-23T00:00:00.000Z",
    ...overrides,
  };
}

function makeProspect(overrides: Partial<Prospect> = {}): Prospect {
  return {
    id: prospectId,
    agencyId,
    businessName: "Example HVAC",
    websiteUrl: "https://example.com",
    contactName: null,
    contactEmail: null,
    notes: null,
    createdAt: "2026-09-23T00:00:00.000Z",
    updatedAt: "2026-09-23T00:00:00.000Z",
    ...overrides,
  };
}
