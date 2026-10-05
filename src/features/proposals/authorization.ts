import type { Audit } from "@/domain/audits/types";
import type { Opportunity } from "@/domain/opportunities/types";
import type { Proposal } from "@/domain/proposals/types";
import type { Prospect } from "@/domain/prospects/types";
import type { AgencyService } from "@/domain/services/types";
import { AppError } from "@/lib/errors";

export function assertProposalAccess(input: {
  agencyId: string;
  proposal: Proposal | null;
  prospect: Prospect | null;
  audit: Audit | null;
}): asserts input is {
  agencyId: string;
  proposal: Proposal;
  prospect: Prospect;
  audit: Audit;
} {
  const { agencyId, proposal, prospect, audit } = input;

  if (!proposal || proposal.agencyId !== agencyId) {
    throw new AppError("Proposal not found.", 404);
  }

  if (!prospect || prospect.agencyId !== agencyId || prospect.id !== proposal.prospectId) {
    throw new AppError("Prospect not found.", 404);
  }

  if (
    !audit ||
    audit.agencyId !== agencyId ||
    audit.id !== proposal.auditId ||
    audit.prospectId !== proposal.prospectId
  ) {
    throw new AppError("Audit not found.", 404);
  }
}

export function assertAuditCanStartProposal(input: {
  agencyId: string;
  audit: Audit | null;
  prospect: Prospect | null;
}): asserts input is {
  agencyId: string;
  audit: Audit;
  prospect: Prospect;
} {
  const { agencyId, audit, prospect } = input;

  if (!audit || audit.agencyId !== agencyId) {
    throw new AppError("Audit not found.", 404);
  }

  if (!prospect || prospect.agencyId !== agencyId || prospect.id !== audit.prospectId) {
    throw new AppError("Prospect not found.", 404);
  }

  if (audit.status !== "completed") {
    throw new AppError("Proposals can only be created from completed audits.", 409);
  }

  if (audit.verticalKey !== "hvac") {
    throw new AppError("Only HVAC proposal drafts are supported right now.", 400);
  }
}

export function assertProposalSelection(input: {
  agencyId: string;
  proposal: Proposal;
  opportunities: Opportunity[];
  services: AgencyService[];
}) {
  const opportunitiesById = new Map(
    input.opportunities.map((opportunity) => [opportunity.id, opportunity]),
  );
  const servicesById = new Map(
    input.services.map((service) => [service.id, service]),
  );

  for (const opportunity of input.opportunities) {
    if (
      opportunity.agencyId !== input.agencyId ||
      opportunity.auditId !== input.proposal.auditId ||
      opportunity.prospectId !== input.proposal.prospectId
    ) {
      throw new AppError("Selected opportunity does not belong to this proposal audit.", 403);
    }
  }

  for (const service of input.services) {
    if (service.agencyId !== input.agencyId || !service.isActive) {
      throw new AppError("Selected service is not available for this agency.", 403);
    }
  }

  return { opportunitiesById, servicesById };
}
