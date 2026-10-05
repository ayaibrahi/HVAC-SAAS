import { describe, expect, it } from "vitest";
import { proposalPdfDownloadInputSchema } from "@/lib/validation/proposal-pdf";

describe("proposal PDF validation", () => {
  it("accepts a snapshot UUID", () => {
    expect(
      proposalPdfDownloadInputSchema.safeParse({
        snapshotId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      }).success,
    ).toBe(true);
  });

  it("rejects invalid snapshot identifiers", () => {
    expect(
      proposalPdfDownloadInputSchema.safeParse({
        snapshotId: "../../secret",
      }).success,
    ).toBe(false);
  });
});
