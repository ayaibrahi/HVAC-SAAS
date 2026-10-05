import type { Audit } from "@/domain/audits/types";
import type { Opportunity } from "@/domain/opportunities/types";
import type { Prospect } from "@/domain/prospects/types";
import { AppError } from "@/lib/errors";

export function assertOpportunityAiAccess(input: {
  agencyId: string;
  opportunity: Opportunity | null;
  audit: Audit | null;
  prospect: Prospect | null;
}): asserts input is {
  agencyId: string;
  opportunity: Opportunity;
  audit: Audit;
  prospect: Prospect;
} {
  const { agencyId, opportunity, audit, prospect } = input;

  if (!opportunity || opportunity.agencyId !== agencyId) {
    throw new AppError("Opportunity not found.", 404);
  }

  if (!audit || audit.agencyId !== agencyId || audit.id !== opportunity.auditId) {
    throw new AppError("Audit not found.", 404);
  }

  if (
    !prospect ||
    prospect.agencyId !== agencyId ||
    prospect.id !== opportunity.prospectId ||
    prospect.id !== audit.prospectId
  ) {
    throw new AppError("Prospect not found.", 404);
  }

  if (audit.status !== "completed") {
    throw new AppError(
      "AI insights can only be generated for completed audits.",
      409,
    );
  }

  if (opportunity.prospectId !== audit.prospectId) {
    throw new AppError("Opportunity does not belong to that audit.", 409);
  }
}
