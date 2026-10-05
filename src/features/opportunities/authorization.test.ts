import { describe, expect, it } from "vitest";
import { assertAuditReadyForOpportunityGeneration } from "@/features/opportunities/authorization";
import {
  makeAudit,
  makeDetectedSignals,
} from "@/features/opportunities/test-fixtures";

describe("assertAuditReadyForOpportunityGeneration", () => {
  it("allows completed HVAC audits owned by the agency", () => {
    const audit = makeAudit(makeDetectedSignals());

    expect(() =>
      assertAuditReadyForOpportunityGeneration(audit, audit.agencyId),
    ).not.toThrow();
  });

  it("rejects cross-tenant audit access", () => {
    const audit = makeAudit(makeDetectedSignals());

    expect(() =>
      assertAuditReadyForOpportunityGeneration(audit, "different-agency"),
    ).toThrow("Audit not found.");
  });

  it.each(["pending", "running", "failed"] as const)(
    "rejects %s audits",
    (status) => {
      const audit = makeAudit(makeDetectedSignals(), { status });

      expect(() =>
        assertAuditReadyForOpportunityGeneration(audit, audit.agencyId),
      ).toThrow("Complete the audit before generating opportunities.");
    },
  );

  it("rejects unsupported verticals before the playbook exists", () => {
    const audit = makeAudit(makeDetectedSignals(), { verticalKey: "plumbing" });

    expect(() =>
      assertAuditReadyForOpportunityGeneration(audit, audit.agencyId),
    ).toThrow("Only the HVAC opportunity playbook is available right now.");
  });

  it("rejects audits without normalized signals", () => {
    const audit = makeAudit(makeDetectedSignals(), { normalizedSignals: {} });

    expect(() =>
      assertAuditReadyForOpportunityGeneration(audit, audit.agencyId),
    ).toThrow("The audit does not include normalized website signals.");
  });
});
