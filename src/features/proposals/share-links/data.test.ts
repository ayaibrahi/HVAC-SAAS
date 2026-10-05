import { describe, expect, it } from "vitest";
import { isShareLinkUsable } from "@/features/proposals/share-links/lifecycle";

describe("proposal share link lifecycle", () => {
  it("allows active unexpired links", () => {
    expect(
      isShareLinkUsable(
        {
          status: "active",
          expires_at: "2026-10-26T00:00:00.000Z",
        },
        new Date("2026-09-26T00:00:00.000Z"),
      ),
    ).toBe(true);
  });

  it("rejects revoked links", () => {
    expect(
      isShareLinkUsable(
        {
          status: "revoked",
          expires_at: "2026-10-26T00:00:00.000Z",
        },
        new Date("2026-09-26T00:00:00.000Z"),
      ),
    ).toBe(false);
  });

  it("rejects expired links using server time without mutating snapshots", () => {
    expect(
      isShareLinkUsable(
        {
          status: "active",
          expires_at: "2026-09-25T23:59:59.999Z",
        },
        new Date("2026-09-26T00:00:00.000Z"),
      ),
    ).toBe(false);
  });

  it("treats malformed expiration values as unavailable", () => {
    expect(
      isShareLinkUsable(
        {
          status: "active",
          expires_at: "not-a-date",
        },
        new Date("2026-09-26T00:00:00.000Z"),
      ),
    ).toBe(false);
  });
});
