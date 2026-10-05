import { z } from "zod";

export const opportunityPrioritySchema = z.enum(["low", "medium", "high"]);
export const opportunityConfidenceSchema = z.enum(["low", "medium", "high"]);
export const opportunityStatusSchema = z.enum(["open", "dismissed", "selected"]);

export const opportunityEvidenceSchema = z
  .object({
    signal: z.string().trim().min(1),
    observed_value: z.unknown(),
    scope: z.literal("analyzed_page"),
    source: z.literal("deterministic_analyzer"),
    details: z.string().trim().min(1),
    analyzer_evidence: z
      .array(
        z.object({
          source: z.string().trim().min(1),
          detail: z.string().trim().min(1),
          snippet: z.string().optional(),
          url: z.string().optional(),
          count: z.number().optional(),
        }),
      )
      .optional(),
  })
  .refine((value) => Object.hasOwn(value, "observed_value"), {
    message: "Evidence must include the observed signal value.",
    path: ["observed_value"],
  });

export const generateOpportunitiesInputSchema = z.object({
  auditId: z.string().uuid(),
});

export type GenerateOpportunitiesInput = z.infer<
  typeof generateOpportunitiesInputSchema
>;
