import { z } from "zod";
import { defaultCurrency, supportedCurrencies } from "@/config/currencies";
import { optionalTrimmedText } from "@/lib/validation/common";

export const agencyServiceInputSchema = z.object({
  name: z.string().trim().min(2, "Service name is required.").max(120),
  description: optionalTrimmedText(1000),
  price: z.coerce
    .number({
      error: "Enter a valid price.",
    })
    .min(0, "Price cannot be negative.")
    .max(1000000, "Price is too high.")
    .transform((value) => Math.round(value * 100) / 100),
  currency: z.enum(supportedCurrencies).default(defaultCurrency),
  isActive: z.preprocess(
    (value) => value === "true" || value === "on" || value === true,
    z.boolean(),
  ),
});

export type AgencyServiceInput = z.infer<typeof agencyServiceInputSchema>;
