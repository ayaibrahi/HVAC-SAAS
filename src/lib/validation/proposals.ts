import { z } from "zod";
import { supportedCurrencies } from "@/config/currencies";
import { optionalTrimmedText } from "@/lib/validation/common";

export const proposalStatusSchema = z.enum(["draft", "ready"]);
export const proposalDiscountTypeSchema = z.enum(["none", "fixed", "percentage"]);

export const createProposalInputSchema = z.object({
  auditId: z.string().uuid(),
  title: optionalTrimmedText(160),
});

export const proposalLineItemInputSchema = z.object({
  opportunityId: z.string().uuid(),
  agencyServiceId: z.string().uuid(),
  quantity: z.coerce
    .number({
      error: "Enter a valid quantity.",
    })
    .int("Quantity must be a whole number.")
    .min(1, "Quantity must be at least 1.")
    .max(100, "Quantity is too high."),
  unitPrice: z.string().trim().min(1, "Enter a service price."),
  description: optionalTrimmedText(1000),
});

export const updateProposalInputSchema = z.object({
  proposalId: z.string().uuid(),
  title: z.string().trim().min(2, "Proposal title is required.").max(160),
  summary: z.string().trim().max(4000).default(""),
  scope: z.string().trim().max(8000).default(""),
  nextStep: z.string().trim().max(1000).default(""),
  currency: z.enum(supportedCurrencies),
  status: proposalStatusSchema,
  discountType: proposalDiscountTypeSchema,
  discountValue: z.string().trim().default("0"),
  lineItems: z.array(proposalLineItemInputSchema).max(10),
});

export type CreateProposalInput = z.infer<typeof createProposalInputSchema>;
export type UpdateProposalInput = z.infer<typeof updateProposalInputSchema>;
export type ProposalLineItemInput = z.infer<typeof proposalLineItemInputSchema>;
