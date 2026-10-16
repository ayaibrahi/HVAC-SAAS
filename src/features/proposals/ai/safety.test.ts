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
  it("rejects historical AI website-wide wording when repeated in a new proposal", () => {
    expect(
      getProposalAiDraftSafetyIssues(
        makeProposalAiDraft({
          summary: "The website currently lacks visible financing options.",
        }),
        makeProposalAiInput(),
      ),
    ).toContain("unsupported whole-site claim");
  });
  it("accepts cautious page-scoped proposal language", () => {
    expect(() =>
      assertProposalAiDraftIsSafe(makeProposalAiDraft(), makeProposalAiInput()),
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
        summary:
          "The business does not offer financing anywhere on the website.",
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

  it.each([
    "Our award-winning team has served thousands of satisfied customers.",
    "Clients say we are the best agency in town.",
    "Our certified technicians have decades of experience.",
    "We include an online booking integration and emergency landing page.",
    "We deliver a new contact form within seven days.",
    "The investment is 500 dollars with a thirty percent return.",
    "The website has no phone or booking anywhere.",
    "Guaranteed results with a lifetime warranty.",
    "Schedule at https://invented.example/meeting before Friday.",
    "Financing information is completely absent from the business.",
    "Here is otherwise plausible but unsupported extra wording.",
  ])("rejects unsupported additions in EVERY output field: %s", (claim) => {
    for (const field of ["summary", "scope", "nextStep"] as const) {
      const draft = makeProposalAiDraft({ [field]: claim });
      expect(() =>
        assertProposalAiDraftIsSafe(draft, makeProposalAiInput()),
      ).toThrow();
    }
  });
});
