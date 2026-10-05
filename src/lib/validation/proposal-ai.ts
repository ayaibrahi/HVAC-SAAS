import { z } from "zod";

const proposalDraftText = z.string().trim().min(1).max(4000);

export const proposalAiDraftSchemaVersion = "1.0.0";

export const proposalAiDraftOutputSchema = z
  .object({
    summary: proposalDraftText,
    scope: proposalDraftText.max(8000),
    nextStep: z.string().trim().min(1).max(1000),
  })
  .strict();

export const proposalAiDraftJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "scope", "nextStep"],
  properties: {
    summary: {
      type: "string",
      minLength: 1,
      maxLength: 4000,
    },
    scope: {
      type: "string",
      minLength: 1,
      maxLength: 8000,
    },
    nextStep: {
      type: "string",
      minLength: 1,
      maxLength: 1000,
    },
  },
} as const;

export type ProposalAiDraftOutput = z.infer<typeof proposalAiDraftOutputSchema>;

export function parseProposalAiDraftOutput(value: unknown) {
  const parsedValue = typeof value === "string" ? JSON.parse(value) : value;

  return proposalAiDraftOutputSchema.parse(parsedValue);
}
