import { describe, expect, it } from "vitest";
import {
  getProposalAiDraftSafetyIssues,
  assertProposalAiDraftIsSafe,
} from "@/features/proposals/ai/safety";
import {
  makeProposalAiDraft,
  makeProposalAiInput,
} from "@/features/proposals/ai/test-fixtures";

describe("proposal AI safety", () => {
  it("accepts cautious page-scoped proposal language", () => {
    expect(() =>
      assertProposalAiDraftIsSafe(
        makeProposalAiDraft(),
        makeProposalAiInput(),
      ),
    ).not.toThrow();
  });

  it("rejects revenue, ROI, and percentage claims", () => {
    for (const claim of [
      "This can generate $10k.",
      "This will produce guaranteed ROI.",
      "This can improve leads by 30%.",
      "This can triple revenue.",
    ]) {
      expect(
        getProposalAiDraftSafetyIssues(
          makeProposalAiDraft({ summary: claim }),
          makeProposalAiInput(),
        ).length,
      ).toBeGreaterThan(0);
    }
  });

  it("rejects unsupported whole-site claims", () => {
    const issues = getProposalAiDraftSafetyIssues(
      makeProposalAiDraft({
        summary: "The business does not offer financing anywhere on the website.",
      }),
      makeProposalAiInput(),
    );

    expect(issues).toContain("unsupported whole-site claim");
  });

  it("rejects unsupported services", () => {
    const issues = getProposalAiDraftSafetyIssues(
      makeProposalAiDraft({
        scope: "Our team can deliver CRM automation for this prospect.",
      }),
      makeProposalAiInput(),
    );

    expect(issues).toContain("out-of-scope or unsupported service reference");
  });
});
