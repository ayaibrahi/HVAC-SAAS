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
import {
  AnalyzerError,
  normalizeAnalyzerError,
} from "@/features/audits/analyzer/errors";
import { safeFetchHtml } from "@/features/audits/analyzer/safe-fetch";
import { assertProspectBelongsToAgency } from "./authorization";
import { inspectRenderedSite } from "./rendered/pipeline";
import type { RenderedAuditWorker } from "./rendered/contract";
import {
  createPendingAudit,
  markAuditCompleted,
  markAuditFailed,
  markAuditRunning,
} from "@/features/audits/data";
import { AppError, getPublicErrorMessage } from "@/lib/errors";
import type { Json } from "@/lib/supabase/database.types";
import { logger } from "@/lib/logger";
import {
  startAuditSchema,
  type StartAuditInput,
} from "@/lib/validation/audits";

export async function runAuditForProspect(input: {
  agencyId: string;
  prospect: Prospect;
  auditInput?: StartAuditInput;
}, dependencies?: { createRenderedWorker: () => Promise<RenderedAuditWorker> }) {
  assertProspectBelongsToAgency(input.prospect, input.agencyId);
  const playbook = startAuditSchema.parse(input.auditInput ?? {});
  const verticalKey = playbook.verticalKey ?? defaultVerticalPlaybookKey;
  const playbookVersion = playbook.playbookVersion ?? defaultPlaybookVersion;
  const audit = await createPendingAudit({
    agencyId: input.agencyId,
    prospectId: input.prospect.id,
    websiteUrl: input.prospect.websiteUrl,
    verticalKey,
    playbookVersion,
    signalSchemaVersion: dependencies ? "2.0.0" : auditSignalSchemaVersion,
  });
  let inspected: { finalUrl: string; normalizedSignals: Json } | undefined;
  let claimed = false;

  try {
    await markAuditRunning(audit.id, input.agencyId);
    claimed = true;

    // Server-only dependency, never selected from form/API input. Existing
    // actions keep static behavior until isolated worker activation is reviewed.
    if (dependencies) {
      if (verticalKey !== "hvac" || playbookVersion !== "1.0.0")
        throw new AppError("Rendered audits currently support HVAC playbook 1.0.0 only.");
      const renderedAudit = await inspectRenderedSite({
        url: input.prospect.websiteUrl,
        worker: await dependencies.createRenderedWorker(),
        staticFallback: safeFetchHtml,
      });
      const normalizedSignals = { renderedAudit } as unknown as Json;
      inspected = { finalUrl: renderedAudit.entryUrl, normalizedSignals };
      if (!renderedAudit.pages.some(page => page.status === "observed"))
        throw new AnalyzerError("CONTENT_NOT_VERIFIABLE", "No sampled page could be reliably inspected.", 422);
      return await markAuditCompleted({ auditId: audit.id, agencyId: input.agencyId,
        finalUrl: renderedAudit.entryUrl, normalizedSignals, signalSchemaVersion: "2.0.0" });
    }

    const fetchResult = await safeFetchHtml(input.prospect.websiteUrl);
    const normalizedSignals = extractNormalizedAuditSignals({
      fetchResult,
      verticalKey,
      playbookVersion,
    });
    inspected = {
      finalUrl: fetchResult.finalUrl,
      normalizedSignals: normalizedSignals as unknown as Json,
    };
    if (normalizedSignals.quality?.status !== "sufficient") {
      throw new AnalyzerError(
        "CONTENT_NOT_VERIFIABLE",
        "We could not reliably inspect enough of this page. No website recommendations were made.",
        422,
      );
    }

    return await markAuditCompleted({
      auditId: audit.id,
      agencyId: input.agencyId,
      finalUrl: fetchResult.finalUrl,
      normalizedSignals: normalizedSignals as unknown as Json,
      signalSchemaVersion: auditSignalSchemaVersion,
    });
  } catch (error) {
    const analyzerError = normalizeAnalyzerError(error);

    if (claimed) {
      try {
        await markAuditFailed({
          auditId: audit.id,
          agencyId: input.agencyId,
          errorCode: analyzerError.code,
          errorMessage: analyzerError.publicMessage,
          ...inspected,
        });
      } catch (failureUpdateError) {
        logger.error("Could not persist audit failure state.", {
          auditId: audit.id,
          error: getPublicErrorMessage(failureUpdateError),
        });
      }
    }

    throw new AppError(analyzerError.publicMessage, analyzerError.statusCode);
  }
}
