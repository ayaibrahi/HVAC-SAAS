import { readFileSync } from "node:fs";
import { makeBuilderData } from "./builder-test-fixtures";
import { extractNormalizedAuditSignals } from "@/features/audits/analyzer/signals";
import { evaluateOpportunitiesForAudit } from "@/features/opportunities/engine/evaluate";
import type { ProposalDeliverySnapshot } from "@/domain/proposals/types";
import type { ProposalAiDraftOutput } from "@/lib/validation/proposal-ai";
import { buildDeliverySnapshotPayload } from "./delivery/snapshot";

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
    description: "",
    quantity: 1,
    unitPrice: 500,
    lineTotal: 500,
  };
  data.lineItemsByOpportunityId = new Map([[lead.id, line]]);
  data.proposal.subtotal = data.proposal.total = 500;
  return data;
}

// Manually supplied TEST ONLY offer, never a global default or live commitment.
export const illustrativeContactSprintScope = [
  "TEST ONLY - Proposed for owner review; not an approved commercial commitment.",
  "Customer Contact Improvement Sprint",
  "Included work proposed for approval:",
  "- Add or improve one prominent contact/request-service action on the agreed page.",
  "- Add a tap-to-call option using a client-confirmed phone number.",
  "- Verify agreed contact destinations and mobile presentation.",
  "- Provide a brief change summary and verification evidence.",
  "Assumptions: client approval and necessary access/contact details before work.",
  "Excluded: dedicated booking-platform integration, emergency landing-page implementation and financing integration.",
  "No performance or revenue commitments. Schedule to be agreed; no work has been carried out.",
].join("\n");

export function makeIllustrativeContactOffer() {
  const data = makeControlledProposalBuilder();
  data.proposal.title = "TEST ONLY - Customer Contact Improvement Sprint";
  [...data.lineItemsByOpportunityId.values()][0].description =
    illustrativeContactSprintScope;
  return data;
}

// In-memory snapshot for local delivery projections, never written to Supabase.
export function makeLocalContentSnapshot(
  data: ReturnType<typeof makeControlledProposalBuilder>,
  copy: ProposalAiDraftOutput,
): ProposalDeliverySnapshot {
  const line = [...data.lineItemsByOpportunityId.values()][0];
  const opportunity = data.opportunities.find(
    (item) => item.id === line.opportunityId,
  )!;
  const payload = buildDeliverySnapshotPayload({
    agency: data.agency,
    userId: "local-test-user",
    proposal: { ...data.proposal, ...copy, status: "ready" },
    prospect: data.prospect,
    lineItems: [line],
    proposalOpportunities: [
      {
        proposalId: data.proposal.id,
        agencyId: data.agency.id,
        opportunityId: opportunity.id,
        agencyServiceId: line.agencyServiceId,
        position: 0,
        opportunityTitle: opportunity.title,
        opportunityShortDescription: opportunity.shortDescription,
        serviceName: line.serviceName,
        serviceDescription: line.serviceDescription,
        aiSalesSummary: null,
        aiClientFacingExplanation: null,
        createdAt: line.createdAt,
      },
    ],
  });
  return {
    ...payload,
    id: "local-test-snapshot",
    status: "active",
    createdAt: "2026-10-17T00:00:00.000Z",
    supersededAt: null,
  };
}
