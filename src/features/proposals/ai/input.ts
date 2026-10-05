import type { ProposalAiInput } from "@/features/proposals/ai/types";
import type { ProposalBuilderData } from "@/features/proposals/data";
import type { Agency } from "@/domain/agencies/types";
import type { OpportunityEvidence } from "@/domain/opportunities/types";
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

export function createProposalAiInput(input: {
  agency: Agency;
  builderData: ProposalBuilderData;
}): ProposalAiInput {
  const { agency, builderData } = input;
  const selectedItems = builderData.opportunities
    .map((opportunity) => {
      const lineItem = builderData.lineItemsByOpportunityId.get(opportunity.id);

      if (!lineItem) {
        return null;
      }

      const insight = builderData.aiInsightsByOpportunityId.get(opportunity.id);

      return {
        opportunityId: opportunity.id,
        title: opportunity.title,
        shortDescription: opportunity.shortDescription,
        businessImpact: opportunity.businessImpact,
        priority: opportunity.priority,
        confidence: opportunity.confidence,
        evidence: opportunity.evidence,
        aiInsight:
          insight?.status === "completed"
            ? {
                salesSummary: insight.salesSummary,
                whyItMatters: insight.whyItMatters,
                clientFacingExplanation: insight.clientFacingExplanation,
                agencyTalkingPoints: insight.agencyTalkingPoints,
                recommendedNextStep: insight.recommendedNextStep,
              }
            : null,
        service: {
          id: lineItem.agencyServiceId,
          name: lineItem.serviceName,
          description: lineItem.serviceDescription,
        },
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  if (selectedItems.length === 0) {
    throw new AppError("Select at least one opportunity before generating proposal content.", 422);
  }

  return budgetProposalAiInput({
    agency: {
      id: agency.id,
      name: agency.name,
    },
    prospect: {
      id: builderData.prospect.id,
      businessName: builderData.prospect.businessName,
      websiteUrl: builderData.prospect.websiteUrl,
    },
    audit: {
      id: builderData.audit.id,
      analyzedUrl: builderData.audit.finalUrl ?? builderData.audit.websiteUrl,
      verticalKey: builderData.audit.verticalKey,
      playbookVersion: builderData.audit.playbookVersion,
      signalSchemaVersion: builderData.audit.signalSchemaVersion,
    },
    proposal: {
      id: builderData.proposal.id,
      title: builderData.proposal.title,
      currency: builderData.proposal.currency,
    },
    selectedItems,
  });
}

function budgetProposalAiInput(input: ProposalAiInput): ProposalAiInput {
  assertAiArrayWithinLimit(input.selectedItems, {
    field: "proposal.selectedItems",
    maxItems: AI_INPUT_COLLECTION_LIMITS.proposalSelectedItems,
  });

  const budgetedInput: ProposalAiInput = {
    agency: {
      id: budgetAiText(input.agency.id, {
        field: "agency.id",
        maxLength: AI_INPUT_TEXT_LIMITS.id,
      }),
      name: budgetAiText(input.agency.name, {
        field: "agency.name",
        maxLength: AI_INPUT_TEXT_LIMITS.agencyName,
        truncate: true,
      }),
    },
    prospect: {
      id: budgetAiText(input.prospect.id, {
        field: "prospect.id",
        maxLength: AI_INPUT_TEXT_LIMITS.id,
      }),
      businessName: budgetAiText(input.prospect.businessName, {
        field: "prospect.businessName",
        maxLength: AI_INPUT_TEXT_LIMITS.prospectBusinessName,
        truncate: true,
      }),
      websiteUrl: budgetAiText(input.prospect.websiteUrl, {
        field: "prospect.websiteUrl",
        maxLength: AI_INPUT_TEXT_LIMITS.url,
      }),
    },
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
    proposal: {
      id: budgetAiText(input.proposal.id, {
        field: "proposal.id",
        maxLength: AI_INPUT_TEXT_LIMITS.id,
      }),
      title: budgetAiText(input.proposal.title, {
        field: "proposal.title",
        maxLength: AI_INPUT_TEXT_LIMITS.proposalTitle,
        truncate: true,
      }),
      currency: input.proposal.currency,
    },
    selectedItems: input.selectedItems.map((item, index) => ({
      opportunityId: budgetAiText(item.opportunityId, {
        field: `proposal.selectedItems.${index}.opportunityId`,
        maxLength: AI_INPUT_TEXT_LIMITS.id,
      }),
      title: budgetAiText(item.title, {
        field: `proposal.selectedItems.${index}.title`,
        maxLength: AI_INPUT_TEXT_LIMITS.opportunityTitle,
      }),
      shortDescription: budgetAiText(item.shortDescription, {
        field: `proposal.selectedItems.${index}.shortDescription`,
        maxLength: AI_INPUT_TEXT_LIMITS.opportunityDescription,
      }),
      businessImpact: budgetAiText(item.businessImpact, {
        field: `proposal.selectedItems.${index}.businessImpact`,
        maxLength: AI_INPUT_TEXT_LIMITS.opportunityBusinessImpact,
      }),
      priority: item.priority,
      confidence: item.confidence,
      evidence: budgetProposalEvidenceItems(item.evidence, index),
      aiInsight: item.aiInsight
        ? {
            salesSummary: budgetNullableAiText(item.aiInsight.salesSummary, {
              field: `proposal.selectedItems.${index}.aiInsight.salesSummary`,
              maxLength: AI_INPUT_TEXT_LIMITS.aiInsightText,
              truncate: true,
            }),
            whyItMatters: budgetNullableAiText(item.aiInsight.whyItMatters, {
              field: `proposal.selectedItems.${index}.aiInsight.whyItMatters`,
              maxLength: AI_INPUT_TEXT_LIMITS.aiInsightText,
              truncate: true,
            }),
            clientFacingExplanation: budgetNullableAiText(
              item.aiInsight.clientFacingExplanation,
              {
                field: `proposal.selectedItems.${index}.aiInsight.clientFacingExplanation`,
                maxLength: AI_INPUT_TEXT_LIMITS.aiInsightText,
                truncate: true,
              },
            ),
            agencyTalkingPoints: budgetTalkingPoints(
              item.aiInsight.agencyTalkingPoints,
              index,
            ),
            recommendedNextStep: budgetNullableAiText(
              item.aiInsight.recommendedNextStep,
              {
                field: `proposal.selectedItems.${index}.aiInsight.recommendedNextStep`,
                maxLength: AI_INPUT_TEXT_LIMITS.aiInsightText,
                truncate: true,
              },
            ),
          }
        : null,
      service: {
        id: budgetAiText(item.service.id, {
          field: `proposal.selectedItems.${index}.service.id`,
          maxLength: AI_INPUT_TEXT_LIMITS.id,
        }),
        name: budgetAiText(item.service.name, {
          field: `proposal.selectedItems.${index}.service.name`,
          maxLength: AI_INPUT_TEXT_LIMITS.serviceName,
          truncate: true,
        }),
        description: budgetNullableAiText(item.service.description, {
          field: `proposal.selectedItems.${index}.service.description`,
          maxLength: AI_INPUT_TEXT_LIMITS.serviceDescription,
          truncate: true,
        }),
      },
    })),
  };

  assertAiSerializedInputWithinBudget("proposal AI payload", budgetedInput);

  return budgetedInput;
}

function budgetProposalEvidenceItems(
  evidenceItems: OpportunityEvidence[],
  selectedItemIndex: number,
) {
  assertAiArrayWithinLimit(evidenceItems, {
    field: `proposal.selectedItems.${selectedItemIndex}.evidence`,
    maxItems: AI_INPUT_COLLECTION_LIMITS.evidenceItems,
  });

  return evidenceItems.map((evidence, evidenceIndex) => {
    assertAiJsonValueWithinBudget(evidence.observed_value, {
      field: `proposal.selectedItems.${selectedItemIndex}.evidence.${evidenceIndex}.observed_value`,
      maxBytes: AI_INPUT_JSON_VALUE_LIMITS.observedValueBytes,
    });

    return {
      signal: budgetAiText(evidence.signal, {
        field: `proposal.selectedItems.${selectedItemIndex}.evidence.${evidenceIndex}.signal`,
        maxLength: AI_INPUT_TEXT_LIMITS.evidenceSignal,
      }),
      observed_value: evidence.observed_value,
      scope: evidence.scope,
      source: evidence.source,
      details: budgetAiText(evidence.details, {
        field: `proposal.selectedItems.${selectedItemIndex}.evidence.${evidenceIndex}.details`,
        maxLength: AI_INPUT_TEXT_LIMITS.evidenceDetails,
      }),
    };
  });
}

function budgetTalkingPoints(points: string[], selectedItemIndex: number) {
  assertAiArrayWithinLimit(points, {
    field: `proposal.selectedItems.${selectedItemIndex}.aiInsight.agencyTalkingPoints`,
    maxItems: AI_INPUT_COLLECTION_LIMITS.agencyTalkingPoints,
  });

  return points.map((point, pointIndex) =>
    budgetAiText(point, {
      field: `proposal.selectedItems.${selectedItemIndex}.aiInsight.agencyTalkingPoints.${pointIndex}`,
      maxLength: AI_INPUT_TEXT_LIMITS.aiTalkingPoint,
      truncate: true,
    }),
  );
}
