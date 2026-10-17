import { z } from "zod";

// Contractual text is rejected, never truncated. Re-approval is required on save.
const scopeText = z.string().trim().min(1).max(800);
export const approvedServiceScopeSchema = z
  .object({
    deliverables: scopeText,
    exclusions: scopeText,
    clientInputs: scopeText,
    completionChecks: scopeText,
  })
  .strict();

export type ApprovedServiceScope = z.infer<typeof approvedServiceScopeSchema>;

export function readApprovedServiceScope(
  value: unknown,
): ApprovedServiceScope | null {
  const result = approvedServiceScopeSchema.safeParse(value);
  return result.success ? result.data : null;
}
