import { describe, expect, it } from "vitest";
import { getPendingLabel } from "@/components/pending-button-labels";

describe("getPendingLabel", () => {
  it("keeps the normal label while idle", () => {
    expect(
      getPendingLabel({
        isPending: false,
        label: "Analyze",
        pendingLabel: "Analyzing...",
      }),
    ).toBe("Analyze");
  });

  it("uses the pending label during submission", () => {
    expect(
      getPendingLabel({
        isPending: true,
        label: "Delete",
        pendingLabel: "Deleting...",
      }),
    ).toBe("Deleting...");
  });
});
