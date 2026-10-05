import { z } from "zod";

export const proposalPdfDownloadInputSchema = z.object({
  snapshotId: z.string().uuid(),
});

export type ProposalPdfDownloadInput = z.infer<
  typeof proposalPdfDownloadInputSchema
>;
