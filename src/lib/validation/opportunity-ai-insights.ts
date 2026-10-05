import { z } from "zod";

const insightText = z.string().trim().min(1).max(1000);

export const opportunityAiInsightSchemaVersion = "1.0.0";

export const opportunityAiInsightStatusSchema = z.enum([
  "not_generated",
  "generating",
  "completed",
  "failed",
]);

export const opportunityAiInsightOutputSchema = z
  .object({
    salesSummary: insightText,
    whyItMatters: insightText,
    clientFacingExplanation: z.string().trim().min(1).max(1600),
    agencyTalkingPoints: z.array(insightText.max(300)).min(2).max(4),
    recommendedNextStep: insightText,
  })
  .strict();

export const generateOpportunityAiInsightInputSchema = z.object({
  opportunityId: z.string().uuid(),
});

export const opportunityAiInsightJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "salesSummary",
    "whyItMatters",
    "clientFacingExplanation",
    "agencyTalkingPoints",
    "recommendedNextStep",
  ],
  properties: {
    salesSummary: {
      type: "string",
      minLength: 1,
      maxLength: 1000,
    },
    whyItMatters: {
      type: "string",
      minLength: 1,
      maxLength: 1000,
    },
    clientFacingExplanation: {
      type: "string",
      minLength: 1,
      maxLength: 1600,
    },
    agencyTalkingPoints: {
      type: "array",
      minItems: 2,
      maxItems: 4,
      items: {
        type: "string",
        minLength: 1,
        maxLength: 300,
      },
    },
    recommendedNextStep: {
      type: "string",
      minLength: 1,
      maxLength: 1000,
    },
  },
} as const;

export type OpportunityAiInsightOutput = z.infer<
  typeof opportunityAiInsightOutputSchema
>;

export type GenerateOpportunityAiInsightInput = z.infer<
  typeof generateOpportunityAiInsightInputSchema
>;

export function parseOpportunityAiInsightOutput(value: unknown) {
  const parsedValue = typeof value === "string" ? JSON.parse(value) : value;

  return opportunityAiInsightOutputSchema.parse(parsedValue);
}
