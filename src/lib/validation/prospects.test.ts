import { describe, expect, it } from "vitest";
import { prospectInputSchema } from "@/lib/validation/prospects";

describe("prospectInputSchema", () => {
  it("accepts a basic valid prospect", () => {
    const result = prospectInputSchema.parse({
      businessName: "Northside HVAC",
      websiteUrl: "northside.example",
      contactName: "",
      contactEmail: "",
      notes: "",
    });

    expect(result.businessName).toBe("Northside HVAC");
    expect(result.websiteUrl).toBe("https://northside.example/");
    expect(result.contactName).toBeUndefined();
  });

  it("rejects invalid prospect URLs", () => {
    const result = prospectInputSchema.safeParse({
      businessName: "Invalid Site",
      websiteUrl: "not a website",
    });

    expect(result.success).toBe(false);
  });
});
