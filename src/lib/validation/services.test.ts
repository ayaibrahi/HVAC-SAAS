import { describe, expect, it } from "vitest";
import { agencyServiceInputSchema } from "@/lib/validation/services";

describe("agencyServiceInputSchema", () => {
  it("accepts valid service pricing", () => {
    const result = agencyServiceInputSchema.parse({
      name: "Landing Page",
      description: "Campaign-specific landing page.",
      price: "1500",
      currency: "USD",
      isActive: "true",
    });

    expect(result.price).toBe(1500);
    expect(result.isActive).toBe(true);
  });

  it("rejects negative prices", () => {
    const result = agencyServiceInputSchema.safeParse({
      name: "Local SEO Setup",
      price: "-1",
      currency: "USD",
      isActive: "true",
    });

    expect(result.success).toBe(false);
  });
});
