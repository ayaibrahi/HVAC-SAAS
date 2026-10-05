import { describe, expect, it } from "vitest";
import { InMemoryRateLimiter } from "@/lib/rate-limit";

describe("in-memory rate limiter", () => {
  it("limits repeated requests within a window", () => {
    let now = 1_000;
    const limiter = new InMemoryRateLimiter({
      maxAttempts: 2,
      windowMs: 1_000,
      now: () => now,
    });

    expect(limiter.check("public-share:client").allowed).toBe(true);
    expect(limiter.check("public-share:client").allowed).toBe(true);
    expect(limiter.check("public-share:client").allowed).toBe(false);

    now = 2_001;

    expect(limiter.check("public-share:client").allowed).toBe(true);
  });

  it("keeps buckets isolated by key", () => {
    const limiter = new InMemoryRateLimiter({
      maxAttempts: 1,
      windowMs: 1_000,
      now: () => 1_000,
    });

    expect(limiter.check("public-share:a").allowed).toBe(true);
    expect(limiter.check("public-share:a").allowed).toBe(false);
    expect(limiter.check("public-share:b").allowed).toBe(true);
  });
});
