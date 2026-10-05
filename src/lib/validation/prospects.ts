import { z } from "zod";
import { optionalTrimmedText } from "@/lib/validation/common";
import { websiteUrlSchema } from "@/lib/validation/website-url";

export const prospectInputSchema = z.object({
  businessName: z.string().trim().min(2, "Business name is required.").max(160),
  websiteUrl: websiteUrlSchema,
  contactName: optionalTrimmedText(120),
  contactEmail: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().email("Enter a valid contact email.").optional(),
  ),
  notes: optionalTrimmedText(2000),
});

export type ProspectInput = z.infer<typeof prospectInputSchema>;
