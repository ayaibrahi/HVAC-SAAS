import { describe, expect, it } from "vitest";
import { getPublicShareRateLimitKey } from "@/features/proposals/share-links/rate-limit";

describe("public proposal share rate-limit key", () => {
  it("uses coarse client metadata rather than the raw share token", () => {
    const request = new Request(
      "https://app.example/proposals/shared/raw-secret-token",
      {
        headers: {
          "x-forwarded-for": "203.0.113.10, 198.51.100.1",
        },
      },
    );

    expect(getPublicShareRateLimitKey(request)).toBe(
      "public-share:203.0.113.10",
    );
    expect(getPublicShareRateLimitKey(request)).not.toContain("raw-secret-token");
  });

  it("falls back to an anonymous process-local bucket", () => {
    const request = new Request("https://app.example/proposals/shared/token");

    expect(getPublicShareRateLimitKey(request)).toBe("public-share:unknown");
  });
});
