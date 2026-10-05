import type { Audit } from "@/domain/audits/types";
import type { Opportunity } from "@/domain/opportunities/types";
import type { AgencyService } from "@/domain/services/types";
import type {
  OpportunityAiEvidence,
  OpportunityAiInput,
} from "@/features/opportunities/ai/types";
import {
  AI_INPUT_COLLECTION_LIMITS,
  AI_INPUT_JSON_VALUE_LIMITS,
  AI_INPUT_TEXT_LIMITS,
  assertAiArrayWithinLimit,
  assertAiJsonValueWithinBudget,
  assertAiSerializedInputWithinBudget,
  budgetAiText,
  budgetNullableAiText,
} from "@/lib/ai/input-budget";
import { AppError } from "@/lib/errors";

export function createOpportunityAiInput(input: {
  audit: Audit;
  opportunity: Opportunity;
  recommendedService: AgencyService | null;
}): OpportunityAiInput {
  if (input.opportunity.verticalKey !== "hvac") {
    throw new AppError("Only HVAC opportunities can be enriched right now.", 400);
  }

  return budgetOpportunityAiInput({
    verticalKey: "hvac",
    audit: {
      id: input.audit.id,
      analyzedUrl: input.audit.finalUrl ?? input.audit.websiteUrl,
      verticalKey: input.audit.verticalKey,
      playbookVersion: input.audit.playbookVersion,
      signalSchemaVersion: input.audit.signalSchemaVersion,
    },
    opportunity: {
      id: input.opportunity.id,
      ruleKey: input.opportunity.ruleKey,
      title: input.opportunity.title,
      shortDescription: input.opportunity.shortDescription,
      businessImpact: input.opportunity.businessImpact,
      priority: input.opportunity.priority,
      confidence: input.opportunity.confidence,
      rankingScore: input.opportunity.score,
      rankingRationale: input.opportunity.rankingRationale,
      evidence: input.opportunity.evidence.map(mapEvidence),
      recommendedServiceCategory: input.opportunity.recommendedServiceCategory,
      recommendedService: input.recommendedService
        ? {
            id: input.recommendedService.id,
            name: input.recommendedService.name,
            description: input.recommendedService.description,
          }
        : null,
    },
  });
}

function mapEvidence(evidence: Opportunity["evidence"][number]): OpportunityAiEvidence {
  return {
    signal: evidence.signal,
    observedValue: evidence.observed_value,
    scope: evidence.scope,
    source: evidence.source,
    details: evidence.details,
  };
}

function budgetOpportunityAiInput(input: OpportunityAiInput): OpportunityAiInput {
  assertAiArrayWithinLimit(input.opportunity.evidence, {
    field: "opportunity.evidence",
    maxItems: AI_INPUT_COLLECTION_LIMITS.evidenceItems,
  });

  const budgetedInput: OpportunityAiInput = {
    verticalKey: input.verticalKey,
    audit: {
      id: budgetAiText(input.audit.id, {
        field: "audit.id",
        maxLength: AI_INPUT_TEXT_LIMITS.id,
      }),
      analyzedUrl: budgetAiText(input.audit.analyzedUrl, {
        field: "audit.analyzedUrl",
        maxLength: AI_INPUT_TEXT_LIMITS.url,
      }),
      verticalKey: input.audit.verticalKey,
      playbookVersion: budgetAiText(input.audit.playbookVersion, {
        field: "audit.playbookVersion",
        maxLength: AI_INPUT_TEXT_LIMITS.version,
      }),
      signalSchemaVersion: budgetAiText(input.audit.signalSchemaVersion, {
        field: "audit.signalSchemaVersion",
        maxLength: AI_INPUT_TEXT_LIMITS.version,
      }),
    },
    opportunity: {
      id: budgetAiText(input.opportunity.id, {
        field: "opportunity.id",
        maxLength: AI_INPUT_TEXT_LIMITS.id,
      }),
      ruleKey: budgetAiText(input.opportunity.ruleKey, {
        field: "opportunity.ruleKey",
        maxLength: AI_INPUT_TEXT_LIMITS.opportunityRuleKey,
      }),
      title: budgetAiText(input.opportunity.title, {
        field: "opportunity.title",
        maxLength: AI_INPUT_TEXT_LIMITS.opportunityTitle,
      }),
      shortDescription: budgetAiText(input.opportunity.shortDescription, {
        field: "opportunity.shortDescription",
        maxLength: AI_INPUT_TEXT_LIMITS.opportunityDescription,
      }),
      businessImpact: budgetAiText(input.opportunity.businessImpact, {
        field: "opportunity.businessImpact",
        maxLength: AI_INPUT_TEXT_LIMITS.opportunityBusinessImpact,
      }),
      priority: input.opportunity.priority,
      confidence: input.opportunity.confidence,
      rankingScore: input.opportunity.rankingScore,
      rankingRationale: budgetNullableAiText(input.opportunity.rankingRationale, {
        field: "opportunity.rankingRationale",
        maxLength: AI_INPUT_TEXT_LIMITS.opportunityRankingRationale,
      }),
      evidence: input.opportunity.evidence.map(budgetOpportunityEvidence),
      recommendedServiceCategory: budgetAiText(
        input.opportunity.recommendedServiceCategory,
        {
          field: "opportunity.recommendedServiceCategory",
          maxLength: AI_INPUT_TEXT_LIMITS.recommendedServiceCategory,
        },
      ),
      recommendedService: input.opportunity.recommendedService
        ? {
            id: budgetAiText(input.opportunity.recommendedService.id, {
              field: "opportunity.recommendedService.id",
              maxLength: AI_INPUT_TEXT_LIMITS.id,
            }),
            name: budgetAiText(input.opportunity.recommendedService.name, {
              field: "opportunity.recommendedService.name",
              maxLength: AI_INPUT_TEXT_LIMITS.serviceName,
              truncate: true,
            }),
            description: budgetNullableAiText(
              input.opportunity.recommendedService.description,
              {
                field: "opportunity.recommendedService.description",
                maxLength: AI_INPUT_TEXT_LIMITS.serviceDescription,
                truncate: true,
              },
            ),
          }
        : null,
    },
  };

  assertAiSerializedInputWithinBudget("opportunity AI payload", budgetedInput);

  return budgetedInput;
}

function budgetOpportunityEvidence(
  evidence: OpportunityAiEvidence,
  index: number,
): OpportunityAiEvidence {
  assertAiJsonValueWithinBudget(evidence.observedValue, {
    field: `opportunity.evidence.${index}.observedValue`,
    maxBytes: AI_INPUT_JSON_VALUE_LIMITS.observedValueBytes,
  });

  return {
    signal: budgetAiText(evidence.signal, {
      field: `opportunity.evidence.${index}.signal`,
      maxLength: AI_INPUT_TEXT_LIMITS.evidenceSignal,
    }),
    observedValue: evidence.observedValue,
    scope: evidence.scope,
    source: evidence.source,
    details: budgetAiText(evidence.details, {
      field: `opportunity.evidence.${index}.details`,
      maxLength: AI_INPUT_TEXT_LIMITS.evidenceDetails,
    }),
  };
}
