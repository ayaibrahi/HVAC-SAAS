import "server-only";

import { z } from "zod";
import type { Audit } from "@/domain/audits/types";
import type { OpportunityAiInsight } from "@/domain/opportunities/types";
import { mapAudit } from "@/features/audits/data";
import { assertOpportunityAiAccess } from "@/features/opportunities/ai/authorization";
import { generateValidatedOpportunityAiInsight } from "@/features/opportunities/ai/generate";
import { createOpportunityAiInput } from "@/features/opportunities/ai/input";
import { createOpenAiOpportunityInsightProvider } from "@/features/opportunities/ai/openai-provider";
import {
  createCompletedInsightUpdate,
  createFailedInsightUpdate,
  createGeneratingInsightUpdate,
  createGeneratingInsightRow,
} from "@/features/opportunities/ai/persistence";
import type { OpportunityAiProvider } from "@/features/opportunities/ai/types";
import { getOpportunityForAgency } from "@/features/opportunities/data";
import { requireCurrentAgency } from "@/features/agencies/data";
import { getProspect } from "@/features/prospects/data";
import { getAgencyService } from "@/features/services/data";
import { enforceAgencyUsageLimit } from "@/features/usage/limits";
import { AiProviderError } from "@/lib/ai/provider-errors";
import { AppError, getPublicErrorMessage } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { generateOpportunityAiInsightInputSchema } from "@/lib/validation/opportunity-ai-insights";

type OpportunityAiInsightRow =
  Database["public"]["Tables"]["opportunity_ai_insights"]["Row"];
type OpportunityAiInsightAdminClient = Pick<
  ReturnType<typeof createSupabaseAdminClient>,
  "from"
>;

const talkingPointsSchema = z.array(z.string());
export const opportunityAiGenerationStaleMs = 10 * 60 * 1000;

export async function listOpportunityAiInsightsForAgency(agencyId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("opportunity_ai_insights")
    .select("*")
    .eq("agency_id", agencyId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new AppError("We could not load AI insights.", 500);
  }

  return data.map(mapOpportunityAiInsight);
}

export async function generateOpportunityAiInsightForOpportunity(
  opportunityId: string,
  provider?: OpportunityAiProvider,
) {
  const input = generateOpportunityAiInsightInputSchema.parse({
    opportunityId,
  });
  const { supabase, agency, user } = await requireCurrentAgency();
  const opportunity = await getOpportunityForAgency(
    input.opportunityId,
    agency.id,
    supabase,
  );
  const audit = opportunity
    ? await getAuditForAgency(opportunity.auditId, agency.id, supabase)
    : null;
  const prospect = opportunity
    ? await getProspect(opportunity.prospectId, agency.id)
    : null;

  const access = {
    agencyId: agency.id,
    opportunity,
    audit,
    prospect,
  };

  assertOpportunityAiAccess(access);

  const authorizedOpportunity = access.opportunity;
  const authorizedAudit = access.audit;
  const recommendedService = authorizedOpportunity.agencyServiceId
    ? await getAgencyService(authorizedOpportunity.agencyServiceId, agency.id)
    : null;
  const aiInput = createOpportunityAiInput({
    audit: authorizedAudit,
    opportunity: authorizedOpportunity,
    recommendedService,
  });

  await enforceAgencyUsageLimit({
    agencyId: agency.id,
    userId: user.id,
    action: "opportunity_ai",
  });

  const effectiveProvider =
    provider ?? createOpenAiOpportunityInsightProvider();
  const generationClaim = await claimOpportunityAiInsightGeneration({
    agencyId: agency.id,
    opportunityId: authorizedOpportunity.id,
    provider: effectiveProvider,
  });

  if (!generationClaim) {
    throw new AppError("AI insight generation is already in progress.", 409);
  }

  const startedAt = Date.now();

  try {
    const insight = await generateValidatedOpportunityAiInsight(
      aiInput,
      effectiveProvider,
    );
    const storedInsight = await markInsightCompleted({
      agencyId: agency.id,
      opportunityId: authorizedOpportunity.id,
      provider: effectiveProvider,
      insight,
    });

    logger.info("AI opportunity insight completed", {
      opportunityId: authorizedOpportunity.id,
      agencyId: agency.id,
      provider: effectiveProvider.metadata.provider,
      model: effectiveProvider.metadata.model,
      promptVersion: effectiveProvider.metadata.promptVersion,
      schemaVersion: effectiveProvider.metadata.schemaVersion,
      latencyMs: Date.now() - startedAt,
    });

    return storedInsight;
  } catch (error) {
    const errorMessage = getPublicErrorMessage(
      error,
      "AI insight could not be generated safely.",
    );

    await markInsightFailed({
      agencyId: agency.id,
      opportunityId: authorizedOpportunity.id,
      provider: effectiveProvider,
      errorMessage,
    });

    logger.error("AI opportunity insight failed", {
      opportunityId: authorizedOpportunity.id,
      agencyId: agency.id,
      provider: effectiveProvider.metadata.provider,
      model: effectiveProvider.metadata.model,
      promptVersion: effectiveProvider.metadata.promptVersion,
      schemaVersion: effectiveProvider.metadata.schemaVersion,
      latencyMs: Date.now() - startedAt,
      errorCategory:
        error instanceof AiProviderError ? error.category : undefined,
      providerStatus:
        error instanceof AiProviderError ? error.providerStatus : undefined,
    });

    throw error;
  }
}

export async function getOpportunityAiInsightForAgency(
  opportunityId: string,
  agencyId: string,
) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("opportunity_ai_insights")
    .select("*")
    .eq("agency_id", agencyId)
    .eq("opportunity_id", opportunityId)
    .maybeSingle();

  if (error) {
    throw new AppError("We could not load that AI insight.", 500);
  }

  return data ? mapOpportunityAiInsight(data) : null;
}

export async function claimOpportunityAiInsightGeneration(input: {
  agencyId: string;
  opportunityId: string;
  provider: OpportunityAiProvider;
  admin?: OpportunityAiInsightAdminClient;
  now?: () => number;
  staleAfterMs?: number;
}) {
  const admin = input.admin ?? createSupabaseAdminClient();
  const now = input.now?.() ?? Date.now();
  const staleCutoff = new Date(
    now - (input.staleAfterMs ?? opportunityAiGenerationStaleMs),
  ).toISOString();
  const { data: insertedInsight, error: insertError } = await admin
    .from("opportunity_ai_insights")
    .insert(
      createGeneratingInsightRow({
        agencyId: input.agencyId,
        opportunityId: input.opportunityId,
        metadata: input.provider.metadata,
      }),
    )
    .select("*")
    .maybeSingle();

  if (!insertError && insertedInsight) {
    return mapOpportunityAiInsight(insertedInsight);
  }

  if (insertError && !isUniqueViolation(insertError)) {
    throw new AppError("We could not start AI insight generation.", 500);
  }

  const { data: claimedInsight, error: updateError } = await admin
    .from("opportunity_ai_insights")
    .update(
      createGeneratingInsightUpdate({
        metadata: input.provider.metadata,
      }),
    )
    .eq("agency_id", input.agencyId)
    .eq("opportunity_id", input.opportunityId)
    .neq("status", "generating")
    .select("*")
    .maybeSingle();

  if (updateError) {
    throw new AppError("We could not start AI insight generation.", 500);
  }

  if (claimedInsight) {
    return mapOpportunityAiInsight(claimedInsight);
  }

  const { data: reclaimedInsight, error: reclaimError } = await admin
    .from("opportunity_ai_insights")
    .update(
      createGeneratingInsightUpdate({
        metadata: input.provider.metadata,
      }),
    )
    .eq("agency_id", input.agencyId)
    .eq("opportunity_id", input.opportunityId)
    .eq("status", "generating")
    .lt("updated_at", staleCutoff)
    .select("*")
    .maybeSingle();

  if (reclaimError) {
    throw new AppError("We could not start AI insight generation.", 500);
  }

  return reclaimedInsight ? mapOpportunityAiInsight(reclaimedInsight) : null;
}

export function mapOpportunityAiInsight(
  row: OpportunityAiInsightRow,
): OpportunityAiInsight {
  const talkingPoints = talkingPointsSchema.safeParse(
    row.agency_talking_points,
  );

  return {
    id: row.id,
    agencyId: row.agency_id,
    opportunityId: row.opportunity_id,
    status: row.status,
    modelProvider: row.model_provider,
    modelName: row.model_name,
    promptVersion: row.prompt_version,
    schemaVersion: row.schema_version,
    salesSummary: row.sales_summary,
    whyItMatters: row.why_it_matters,
    clientFacingExplanation: row.client_facing_explanation,
    agencyTalkingPoints: talkingPoints.success ? talkingPoints.data : [],
    recommendedNextStep: row.recommended_next_step,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getAuditForAgency(
  auditId: string,
  agencyId: string,
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
): Promise<Audit | null> {
  const { data, error } = await supabase
    .from("audits")
    .select("*")
    .eq("id", auditId)
    .eq("agency_id", agencyId)
    .maybeSingle();

  if (error) {
    throw new AppError("We could not load that audit.", 500);
  }

  return data ? mapAudit(data) : null;
}

async function markInsightCompleted(input: {
  agencyId: string;
  opportunityId: string;
  provider: OpportunityAiProvider;
  insight: Awaited<ReturnType<typeof generateValidatedOpportunityAiInsight>>;
}) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("opportunity_ai_insights")
    .update(
      createCompletedInsightUpdate({
        metadata: input.provider.metadata,
        insight: input.insight,
      }),
    )
    .eq("agency_id", input.agencyId)
    .eq("opportunity_id", input.opportunityId)
    .select("*")
    .single();

  if (error) {
    throw new AppError("We could not store the AI insight.", 500);
  }

  return mapOpportunityAiInsight(data);
}

async function markInsightFailed(input: {
  agencyId: string;
  opportunityId: string;
  provider: OpportunityAiProvider;
  errorMessage: string;
}) {
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("opportunity_ai_insights")
    .update(
      createFailedInsightUpdate({
        metadata: input.provider.metadata,
        errorMessage: input.errorMessage,
      }),
    )
    .eq("agency_id", input.agencyId)
    .eq("opportunity_id", input.opportunityId);

  if (error) {
    logger.error("AI opportunity insight failure state could not be stored", {
      opportunityId: input.opportunityId,
      agencyId: input.agencyId,
      provider: input.provider.metadata.provider,
      model: input.provider.metadata.model,
      promptVersion: input.provider.metadata.promptVersion,
      schemaVersion: input.provider.metadata.schemaVersion,
    });
  }
}

function isUniqueViolation(error: { code?: string }) {
  return error.code === "23505";
}
