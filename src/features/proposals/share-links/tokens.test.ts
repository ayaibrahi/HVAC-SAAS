import { describe, expect, it } from "vitest";
import {
  buildSharePath,
  generateShareToken,
  getDefaultShareLinkExpiration,
  hashShareToken,
  isValidShareTokenFormat,
  shareLinkDefaultTtlDays,
} from "@/features/proposals/share-links/tokens";

describe("proposal share link tokens", () => {
  it("generates high-entropy URL-safe tokens", () => {
    const tokens = Array.from({ length: 100 }, generateShareToken);

    expect(new Set(tokens).size).toBe(tokens.length);
    for (const token of tokens) {
      expect(token.length).toBeGreaterThanOrEqual(43);
      expect(isValidShareTokenFormat(token)).toBe(true);
      expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });

  it("hashes tokens exactly without storing the raw bearer secret", () => {
    const token = generateShareToken();
    const hash = hashShareToken(token);

    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toBe(token);
    expect(hashShareToken(token)).toBe(hash);
    expect(hashShareToken(`${token}x`)).not.toBe(hash);
  });

  it("rejects malformed token formats before lookup", () => {
    expect(isValidShareTokenFormat("short")).toBe(false);
    expect(isValidShareTokenFormat("a".repeat(97))).toBe(false);
    expect(isValidShareTokenFormat(`${"a".repeat(43)}.`)).toBe(false);
    expect(isValidShareTokenFormat(`${"a".repeat(43)}/nested`)).toBe(false);
  });

  it("builds token-only public share paths", () => {
    const token = generateShareToken();

    expect(buildSharePath(token)).toBe(`/proposals/shared/${token}`);
  });

  it("uses a deterministic server-side default expiration window", () => {
    const now = new Date("2026-09-26T00:00:00.000Z");
    const expiresAt = getDefaultShareLinkExpiration(now);

    expect(expiresAt).toBe(
      new Date(
        now.getTime() + shareLinkDefaultTtlDays * 24 * 60 * 60 * 1000,
      ).toISOString(),
    );
  });
});
