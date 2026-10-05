import { describe, expect, it } from "vitest";
import { resolveSafeAuthRedirectPath } from "@/lib/auth/redirects";

describe("resolveSafeAuthRedirectPath", () => {
  it("preserves valid internal paths and query strings", () => {
    expect(resolveSafeAuthRedirectPath("/dashboard/prospects?status=open")).toBe(
      "/dashboard/prospects?status=open",
    );
  });

  it("falls back when the redirect is missing", () => {
    expect(resolveSafeAuthRedirectPath(null)).toBe("/dashboard");
    expect(resolveSafeAuthRedirectPath("")).toBe("/dashboard");
  });

  it("rejects absolute URLs", () => {
    expect(resolveSafeAuthRedirectPath("https://evil.example/phish")).toBe("/dashboard");
    expect(resolveSafeAuthRedirectPath("http://evil.example/phish")).toBe("/dashboard");
    expect(resolveSafeAuthRedirectPath("https://internal.example/dashboard")).toBe(
      "/dashboard",
    );
  });

  it("rejects protocol-relative URLs", () => {
    expect(resolveSafeAuthRedirectPath("//evil.example/phish")).toBe("/dashboard");
  });

  it("rejects malformed or unsafe relative paths", () => {
    expect(resolveSafeAuthRedirectPath("dashboard")).toBe("/dashboard");
    expect(resolveSafeAuthRedirectPath("/dashboard\\evil")).toBe("/dashboard");
  });
});
