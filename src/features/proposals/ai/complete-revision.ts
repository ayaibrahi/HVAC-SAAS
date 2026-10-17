import { createHash } from "node:crypto";
import type { ProposalBuilderData } from "../data";

// The browser returns only a revision, never authoritative prices or scope.
export function getCompleteProposalRevision(data: ProposalBuilderData) {
  const lines = [...data.lineItemsByOpportunityId.values()].sort(
    (a, b) => a.position - b.position,
  );
  return createHash("sha256")
    .update(
      JSON.stringify({
        proposal: data.proposal,
        lines,
        services: lines.map((line) =>
          data.services.find((service) => service.id === line.agencyServiceId),
        ),
        audit: data.audit,
        opportunities: data.opportunities,
        agency: { id: data.agency.id, name: data.agency.name },
        prospect: {
          id: data.prospect.id,
          name: data.prospect.businessName,
          url: data.prospect.websiteUrl,
        },
      }),
    )
    .digest("hex");
}
