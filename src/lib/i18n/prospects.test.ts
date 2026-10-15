import { describe, it, expect } from "vitest";
import { opportunityCountLabel } from "./prospects";
import { getProposalCopy } from "./proposals";
describe("finding count and proposal status copy", () => {
  it.each([0, 1, 2, 3, 5, 11, 100])(
    "preserves the exact finding count %s in both locales",
    (count) => {
      expect(opportunityCountLabel(count, "en")).toContain(
        count.toLocaleString("en"),
      );
      expect(opportunityCountLabel(count, "ar")).toContain(
        count.toLocaleString("ar"),
      );
    },
  );
  it("uses Arabic dual/few/many forms", () => {
    expect(opportunityCountLabel(2, "ar")).toContain("فرصتا");
    expect(opportunityCountLabel(3, "ar")).toContain("فرص تحسين");
    expect(opportunityCountLabel(11, "ar")).toContain("فرصة تحسين");
  });
  it("does not call mixed Ready/Draft records Drafts", () => {
    expect(getProposalCopy("en").savedProposals).toBe("Saved proposals");
    expect(getProposalCopy("ar").savedProposals).toBe("العروض المحفوظة");
  });
});
