import { describe, expect, it } from "vitest";
import { evaluateOpportunitiesForAudit } from "@/features/opportunities/engine/evaluate";
import {
  createOpportunityInsertRows,
  createOpportunityReconciliationPlan,
} from "@/features/opportunities/persistence";
import {
  makeAudit,
  makeDetectedSignals,
  signal,
} from "@/features/opportunities/test-fixtures";

describe("createOpportunityInsertRows", () => {
  it("creates a deterministic opportunity set for repeated generation", () => {
    const signals = makeDetectedSignals();
    signals.hvac.onlineBooking = signal(false, "medium");
    signals.hvac.financing = signal(false, "medium");
    const audit = makeAudit(signals);
    const opportunities = evaluateOpportunitiesForAudit({
      audit,
      agencyServices: [],
    });

    const firstRows = createOpportunityInsertRows({ audit, opportunities });
    const secondRows = createOpportunityInsertRows({ audit, opportunities });

    expect(firstRows.map(getLogicalKey)).toEqual(secondRows.map(getLogicalKey));
    expect(new Set(firstRows.map(getLogicalKey)).size).toBe(firstRows.length);
  });

  it("deduplicates duplicate rule keys before persistence", () => {
    const signals = makeDetectedSignals();
    signals.hvac.onlineBooking = signal(false, "medium");
    const audit = makeAudit(signals);
    const [opportunity] = evaluateOpportunitiesForAudit({
      audit,
      agencyServices: [],
    });

    expect(opportunity).toBeDefined();

    const rows = createOpportunityInsertRows({
      audit,
      opportunities: opportunity ? [opportunity, opportunity] : [],
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.rule_key).toBe("missing_online_booking");
  });
});

describe("createOpportunityReconciliationPlan", () => {
  it("keeps stable logical opportunities on repeated regeneration", () => {
    const nextRows = [
      makeRow("missing_online_booking"),
      makeRow("weak_lead_capture"),
    ];
    const plan = createOpportunityReconciliationPlan({
      existingOpportunities: [
        { id: "opportunity-booking", rule_key: "missing_online_booking" },
        { id: "opportunity-cta", rule_key: "weak_lead_capture" },
      ],
      nextRows,
      referencedOpportunityIds: new Set(),
    });

    expect(plan.insertOrUpdateRows).toEqual(nextRows);
    expect(plan.deleteOpportunityIds).toEqual([]);
    expect(plan.preservedRemovedOpportunityIds).toEqual([]);
  });

  it("keeps proposal relationships, line items, and AI insight references valid for unchanged rules", () => {
    const proposalRelationship = {
      proposalId: "proposal-1",
      opportunityId: "opportunity-booking",
    };
    const proposalLineItem = {
      proposalId: "proposal-1",
      opportunityId: "opportunity-booking",
      lineTotal: 500,
    };
    const aiInsight = {
      opportunityId: "opportunity-booking",
      status: "completed",
    };
    const plan = createOpportunityReconciliationPlan({
      existingOpportunities: [
        { id: "opportunity-booking", rule_key: "missing_online_booking" },
      ],
      nextRows: [makeRow("missing_online_booking")],
      referencedOpportunityIds: new Set([proposalRelationship.opportunityId]),
    });

    expect(plan.deleteOpportunityIds).not.toContain("opportunity-booking");
    expect(proposalRelationship.opportunityId).toBe("opportunity-booking");
    expect(proposalLineItem).toMatchObject({
      opportunityId: "opportunity-booking",
      lineTotal: 500,
    });
    expect(aiInsight).toMatchObject({
      opportunityId: "opportunity-booking",
      status: "completed",
    });
  });

  it("preserves removed rules when proposal work references them", () => {
    const plan = createOpportunityReconciliationPlan({
      existingOpportunities: [
        { id: "opportunity-booking", rule_key: "missing_online_booking" },
        { id: "opportunity-financing", rule_key: "financing_visibility" },
      ],
      nextRows: [makeRow("missing_online_booking")],
      referencedOpportunityIds: new Set(["opportunity-financing"]),
    });

    expect(plan.deleteOpportunityIds).toEqual([]);
    expect(plan.preservedRemovedOpportunityIds).toEqual([
      "opportunity-financing",
    ]);
  });

  it("allows unreferenced removed rules to be deleted without touching proposal-linked data", () => {
    const plan = createOpportunityReconciliationPlan({
      existingOpportunities: [
        { id: "opportunity-booking", rule_key: "missing_online_booking" },
        { id: "opportunity-financing", rule_key: "financing_visibility" },
      ],
      nextRows: [makeRow("missing_online_booking")],
      referencedOpportunityIds: new Set(),
    });

    expect(plan.deleteOpportunityIds).toEqual(["opportunity-financing"]);
    expect(plan.preservedRemovedOpportunityIds).toEqual([]);
  });

  it("keeps repeated regeneration idempotent by logical opportunity key", () => {
    const nextRows = [
      makeRow("missing_online_booking"),
      makeRow("missing_online_booking"),
      makeRow("weak_lead_capture"),
    ];
    const firstPlan = createOpportunityReconciliationPlan({
      existingOpportunities: [],
      nextRows,
      referencedOpportunityIds: new Set(),
    });
    const secondPlan = createOpportunityReconciliationPlan({
      existingOpportunities: [
        { id: "opportunity-booking", rule_key: "missing_online_booking" },
        { id: "opportunity-cta", rule_key: "weak_lead_capture" },
      ],
      nextRows,
      referencedOpportunityIds: new Set(),
    });

    expect(new Set(firstPlan.insertOrUpdateRows.map(getLogicalKey)).size).toBe(
      2,
    );
    expect(secondPlan.deleteOpportunityIds).toEqual([]);
  });
});

function getLogicalKey(row: { audit_id: string; rule_key: string }) {
  return `${row.audit_id}:${row.rule_key}`;
}

function makeRow(ruleKey: string) {
  return {
    agency_id: "22222222-2222-4222-8222-222222222222",
    audit_id: "11111111-1111-4111-8111-111111111111",
    prospect_id: "33333333-3333-4333-8333-333333333333",
    agency_service_id: null,
    vertical_key: "hvac" as const,
    playbook_version: "1.0.0",
    rule_key: ruleKey,
    title: `Title for ${ruleKey}`,
    short_description: "Page-scoped opportunity.",
    business_impact: "Conversion",
    evidence: [],
    priority: "medium" as const,
    confidence: "medium" as const,
    recommended_service_category: "Conversion Optimization",
    score: 50,
    ranking_rationale: "Deterministic test fixture.",
  };
}
