import { describe, expect, it } from "vitest";
import { websiteUrlSchema } from "@/lib/validation/website-url";

describe("websiteUrlSchema", () => {
  it("accepts and normalizes public http URLs", () => {
    expect(websiteUrlSchema.parse("http://example.com")).toBe("http://example.com/");
  });

  it("adds https when the user omits a protocol", () => {
    expect(websiteUrlSchema.parse("example.com")).toBe("https://example.com/");
  });

  it("rejects non-web protocols", () => {
    expect(websiteUrlSchema.safeParse("ftp://example.com").success).toBe(false);
  });

  it("rejects local or internal hostnames", () => {
    expect(websiteUrlSchema.safeParse("http://localhost:3000").success).toBe(false);
    expect(websiteUrlSchema.safeParse("http://app.internal").success).toBe(false);
  });
});
