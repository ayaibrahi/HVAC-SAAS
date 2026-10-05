import { z } from "zod";

export const shareTokenSchema = z
  .string()
  .min(43)
  .max(96)
  .regex(/^[A-Za-z0-9_-]+$/);

export const proposalShareLinkInputSchema = z.object({
  snapshotId: z.string().uuid(),
});

export type ProposalShareLinkInput = z.infer<
  typeof proposalShareLinkInputSchema
>;
