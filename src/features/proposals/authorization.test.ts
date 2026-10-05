import { describe, expect, it } from "vitest";
import type { Audit } from "@/domain/audits/types";
import type { Opportunity } from "@/domain/opportunities/types";
import type { Proposal } from "@/domain/proposals/types";
import type { Prospect } from "@/domain/prospects/types";
import type { AgencyService } from "@/domain/services/types";
import {
  assertAuditCanStartProposal,
  assertProposalAccess,
  assertProposalSelection,
} from "@/features/proposals/authorization";

const agencyId = "22222222-2222-4222-8222-222222222222";
const prospectId = "33333333-3333-4333-8333-333333333333";
const auditId = "11111111-1111-4111-8111-111111111111";

describe("proposal authorization", () => {
  it("allows a proposal for the same agency, prospect, and audit", () => {
    expect(() =>
      assertProposalAccess({
        agencyId,
        proposal: makeProposal(),
        prospect: makeProspect(),
        audit: makeAudit(),
      }),
    ).not.toThrow();
  });

  it("rejects cross-agency proposal access", () => {
    expect(() =>
      assertProposalAccess({
        agencyId,
        proposal: makeProposal({ agencyId: "other-agency" }),
        prospect: makeProspect(),
        audit: makeAudit(),
      }),
    ).toThrow("Proposal not found.");
  });

  it("requires proposal audit and prospect consistency", () => {
    expect(() =>
      assertProposalAccess({
        agencyId,
        proposal: makeProposal(),
        prospect: makeProspect(),
        audit: makeAudit({ prospectId: "other-prospect" }),
      }),
    ).toThrow("Audit not found.");
  });

  it("allows proposal creation only from completed audits", () => {
    expect(() =>
      assertAuditCanStartProposal({
        agencyId,
        audit: makeAudit({ status: "running" }),
        prospect: makeProspect(),
      }),
    ).toThrow("completed audits");
  });

  it("rejects services and opportunities outside the proposal boundary", () => {
    expect(() =>
      assertProposalSelection({
        agencyId,
        proposal: makeProposal(),
        opportunities: [makeOpportunity({ auditId: "other-audit" })],
        services: [makeService()],
      }),
    ).toThrow("proposal audit");

    expect(() =>
      assertProposalSelection({
        agencyId,
        proposal: makeProposal(),
        opportunities: [makeOpportunity()],
        services: [makeService({ agencyId: "other-agency" })],
      }),
    ).toThrow("not available");
  });
});

function makeProposal(overrides: Partial<Proposal> = {}): Proposal {
  return {
    id: "44444444-4444-4444-8444-444444444444",
    agencyId,
    prospectId,
    auditId,
    title: "Proposal for Example HVAC",
    status: "draft",
    summary: "",
    scope: "",
    nextStep: "",
    currency: "USD",
    subtotal: 0,
    discountType: "none",
    discountValue: 0,
    discountAmount: 0,
    total: 0,
    content: null,
    createdAt: "2026-09-25T00:00:00.000Z",
    updatedAt: "2026-09-25T00:00:00.000Z",
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
    createdAt: "2026-09-25T00:00:00.000Z",
    updatedAt: "2026-09-25T00:00:00.000Z",
    ...overrides,
  };
}

function makeAudit(overrides: Partial<Audit> = {}): Audit {
  return {
    id: auditId,
    agencyId,
    prospectId,
    status: "completed",
    websiteUrl: "https://example.com",
    finalUrl: "https://example.com",
    startedAt: "2026-09-25T00:00:00.000Z",
    completedAt: "2026-09-25T00:01:00.000Z",
    errorCode: null,
    errorMessage: null,
    normalizedSignals: {},
    signalSchemaVersion: "1.0.0",
    verticalKey: "hvac",
    playbookVersion: "1.0.0",
    createdAt: "2026-09-25T00:00:00.000Z",
    updatedAt: "2026-09-25T00:01:00.000Z",
    ...overrides,
  };
}

function makeOpportunity(overrides: Partial<Opportunity> = {}): Opportunity {
  return {
    id: "55555555-5555-4555-8555-555555555555",
    agencyId,
    auditId,
    prospectId,
    agencyServiceId: null,
    verticalKey: "hvac",
    playbookVersion: "1.0.0",
    ruleKey: "missing_online_booking",
    title: "Missing Online Booking",
    shortDescription: "Booking was not detected on the analyzed page.",
    businessImpact: "A clearer booking path can reduce friction.",
    evidence: [],
    priority: "high",
    confidence: "high",
    recommendedServiceCategory: "Online Booking Integration",
    score: 90,
    rankingRationale: null,
    status: "open",
    createdAt: "2026-09-25T00:00:00.000Z",
    updatedAt: "2026-09-25T00:00:00.000Z",
    ...overrides,
  };
}

function makeService(overrides: Partial<AgencyService> = {}): AgencyService {
  return {
    id: "66666666-6666-4666-8666-666666666666",
    agencyId,
    name: "Online Booking Integration",
    description: "Connect scheduling software and booking CTAs.",
    price: 350,
    currency: "USD",
    isActive: true,
    createdAt: "2026-09-25T00:00:00.000Z",
    updatedAt: "2026-09-25T00:00:00.000Z",
    ...overrides,
  };
}
