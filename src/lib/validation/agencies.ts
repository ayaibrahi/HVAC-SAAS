import { z } from "zod";
import { defaultCurrency, supportedCurrencies } from "@/config/currencies";
import { optionalWebsiteUrlSchema } from "@/lib/validation/website-url";

export const agencyInputSchema = z.object({
  name: z.string().trim().min(2, "Agency name is required.").max(120),
  website: optionalWebsiteUrlSchema,
  defaultCurrency: z.enum(supportedCurrencies).default(defaultCurrency),
});

export type AgencyInput = z.infer<typeof agencyInputSchema>;
