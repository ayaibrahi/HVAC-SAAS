import "server-only";

import {
  defaultPlaybookVersion,
  defaultVerticalPlaybookKey,
} from "@/config/vertical-playbooks";
import type { Prospect } from "@/domain/prospects/types";
import {
  auditSignalSchemaVersion,
  extractNormalizedAuditSignals,
} from "@/features/audits/analyzer/signals";
import { normalizeAnalyzerError } from "@/features/audits/analyzer/errors";
import { safeFetchHtml } from "@/features/audits/analyzer/safe-fetch";
import {
  createPendingAudit,
  markAuditCompleted,
  markAuditFailed,
  markAuditRunning,
} from "@/features/audits/data";
import { AppError, getPublicErrorMessage } from "@/lib/errors";
import type { Json } from "@/lib/supabase/database.types";
import { logger } from "@/lib/logger";
import { startAuditSchema, type StartAuditInput } from "@/lib/validation/audits";

export async function runAuditForProspect(input: {
  agencyId: string;
  prospect: Prospect;
  auditInput?: StartAuditInput;
}) {
  const playbook = startAuditSchema.parse(input.auditInput ?? {});
  const verticalKey = playbook.verticalKey ?? defaultVerticalPlaybookKey;
  const playbookVersion = playbook.playbookVersion ?? defaultPlaybookVersion;
  const audit = await createPendingAudit({
    agencyId: input.agencyId,
    prospectId: input.prospect.id,
    websiteUrl: input.prospect.websiteUrl,
    verticalKey,
    playbookVersion,
    signalSchemaVersion: auditSignalSchemaVersion,
  });

  try {
    await markAuditRunning(audit.id, input.agencyId);

    const fetchResult = await safeFetchHtml(input.prospect.websiteUrl);
    const normalizedSignals = extractNormalizedAuditSignals({
      fetchResult,
      verticalKey,
      playbookVersion,
    });

    return await markAuditCompleted({
      auditId: audit.id,
      agencyId: input.agencyId,
      finalUrl: fetchResult.finalUrl,
      normalizedSignals: normalizedSignals as unknown as Json,
      signalSchemaVersion: auditSignalSchemaVersion,
    });
  } catch (error) {
    const analyzerError = normalizeAnalyzerError(error);

    try {
      await markAuditFailed({
        auditId: audit.id,
        agencyId: input.agencyId,
        errorCode: analyzerError.code,
        errorMessage: analyzerError.publicMessage,
      });
    } catch (failureUpdateError) {
      logger.error("Could not persist audit failure state.", {
        auditId: audit.id,
        error: getPublicErrorMessage(failureUpdateError),
      });
    }

    throw new AppError(analyzerError.publicMessage, analyzerError.statusCode);
  }
}
