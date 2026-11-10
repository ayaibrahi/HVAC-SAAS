import { z } from "zod";

// Contractual text is rejected, never truncated. Re-approval is required on save.
const deliverablesMessage = "Please enter the included deliverables before approving this scope.";
const scopeText = z.string({ error: deliverablesMessage }).trim().min(1, deliverablesMessage).max(800);
const optionalScopeText = z.string().trim().max(800).nullish().transform(value => value ?? "");
export const approvedServiceScopeSchema = z
  .object({
    deliverables: scopeText,
    exclusions: optionalScopeText,
    clientInputs: optionalScopeText,
    completionChecks: optionalScopeText,
  })
  .strict();

export type ApprovedServiceScope = z.infer<typeof approvedServiceScopeSchema>;

export function readApprovedServiceScope(
  value: unknown,
): ApprovedServiceScope | null {
  const result = approvedServiceScopeSchema.safeParse(value);
  return result.success ? result.data : null;
}
