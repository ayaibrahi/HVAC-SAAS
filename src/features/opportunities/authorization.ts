import type { Audit } from "@/domain/audits/types";
import { AppError } from "@/lib/errors";
import { hasVerifiedPageContent } from "@/features/audits/analyzer/content-quality";

export function assertAuditReadyForOpportunityGeneration(
  audit: Audit | null,
  agencyId: string,
): asserts audit is Audit {
  if (!audit || audit.agencyId !== agencyId) {
    throw new AppError("Audit not found.", 404);
  }

  if (audit.status !== "completed") {
    throw new AppError(
      "Complete the audit before generating opportunities.",
      409,
    );
  }

  if (audit.verticalKey !== "hvac") {
    throw new AppError(
      "Only the HVAC opportunity playbook is available right now.",
      400,
    );
  }

  if (Object.keys(audit.normalizedSignals).length === 0) {
    throw new AppError(
      "The audit does not include normalized website signals.",
      409,
    );
  }
  if (!hasVerifiedPageContent(audit.normalizedSignals)) {
    throw new AppError(
      "This scan's page content could not be reliably verified. No new recommendations were made. A new authorized scan is needed.",
      409,
    );
  }
}
