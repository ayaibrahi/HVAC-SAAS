import { readFileSync } from "node:fs";
import { makeBuilderData } from "./builder-test-fixtures";
import { extractNormalizedAuditSignals } from "@/features/audits/analyzer/signals";
import { evaluateOpportunitiesForAudit } from "@/features/opportunities/engine/evaluate";

// Local fictional Page B and synthetic IDs only; never contacts the URL or DB.
export function makeControlledProposalBuilder() {
  const data = makeBuilderData();
  const url =
    "https://ayaibrahi.github.io/scanvoro-audit-fixtures/absence.html";
  const html = readFileSync(
    new URL(
      "../../../test-sites/hvac-audit-control/site/absence.html",
      import.meta.url,
    ),
    "utf8",
  );
  const signals = extractNormalizedAuditSignals({
    fetchResult: {
      analyzedUrl: url,
      finalUrl: url,
      html,
      status: 200,
      responseTimeMs: 0,
      responseSizeBytes: Buffer.byteLength(html),
      redirectCount: 0,
      contentType: "text/html",
    },
    verticalKey: "hvac",
    playbookVersion: "1.0.0",
    fetchedAt: "2026-10-16T00:00:00.000Z",
  });
  data.agency.name = "Aya";
  data.prospect.businessName = "TEST ONLY - Meadow Test Climate Care";
  data.prospect.websiteUrl = url;
  data.audit = {
    ...data.audit,
    websiteUrl: url,
    finalUrl: url,
    normalizedSignals: signals as unknown as Record<string, unknown>,
    signalSchemaVersion: signals.schemaVersion,
  };
  data.proposal.title = "TEST ONLY - Page B contact-path proposal";
  data.services[0] = {
    ...data.services[0],
    name: "Website Conversion Optimization",
    description:
      "Improve HVAC website lead capture, booking, CTAs, financing visibility, and service presentation.",
    price: 500,
  };
  data.opportunities = evaluateOpportunitiesForAudit({
    audit: data.audit,
    agencyServices: data.services,
  }).map((o, index) => ({
    ...o,
    id: `55555555-5555-4555-8555-${String(index + 1).padStart(12, "0")}`,
    agencyId: data.agency.id,
    auditId: data.audit.id,
    prospectId: data.prospect.id,
    status: "open" as const,
    createdAt: data.proposal.createdAt,
    updatedAt: data.proposal.updatedAt,
  }));
  const originalLine = [...data.lineItemsByOpportunityId.values()][0];
  const lead = data.opportunities.find(
    (o) => o.ruleKey === "weak_lead_capture",
  )!;
  const line = {
    ...originalLine,
    opportunityId: lead.id,
    serviceName: data.services[0].name,
    serviceDescription: data.services[0].description,
    description:
      "Review the inspected page's contact path and agree the specific contact improvements before implementation.",
    quantity: 1,
    unitPrice: 500,
    lineTotal: 500,
  };
  data.lineItemsByOpportunityId = new Map([[lead.id, line]]);
  data.proposal.subtotal = data.proposal.total = 500;
  return data;
}
