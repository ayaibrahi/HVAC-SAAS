import { describe, expect, it } from "vitest";
import {
  getOpportunityAiSafetyIssues,
  assertOpportunityAiInsightIsSafe,
} from "@/features/opportunities/ai/safety";
import {
  makeOpportunityAiInput,
  makeOpportunityAiInsight,
} from "@/features/opportunities/ai/test-fixtures";

describe("opportunity AI safety validation", () => {
  it.each([
    "The website currently lacks visible financing options.",
    "The site still has no booking system.",
    "The website clearly does not offer financing.",
    "The website currently doesn\u2019t offer financing.",
    "The web\u200bsite currently lacks visible financing options.",
    "The business currently does not offer financing.",
  ])("rejects saved-example page-scope broadening: %s", (salesSummary) => {
    expect(
      getOpportunityAiSafetyIssues(
        makeOpportunityAiInsight({ salesSummary }),
        makeOpportunityAiInput(),
      ),
    ).toContain("unsupported whole-site claim");
  });
  it("accepts cautious non-detection without changing authoritative input", () => {
    const input = makeOpportunityAiInput(),
      before = JSON.stringify(input);
    expect(
      getOpportunityAiSafetyIssues(
        makeOpportunityAiInsight({
          salesSummary:
            "Financing information was not detected on the analyzed page. Confirm the offering with the business before proposing a change.",
        }),
        input,
      ),
    ).toEqual([]);
    expect(JSON.stringify(input)).toBe(before);
  });
  it("accepts page-scoped evidence-bound language", () => {
    expect(() =>
      assertOpportunityAiInsightIsSafe(
        makeOpportunityAiInsight(),
        makeOpportunityAiInput(),
      ),
    ).not.toThrow();
  });

  it("rejects fabricated revenue claims", () => {
    const issues = getOpportunityAiSafetyIssues(
      makeOpportunityAiInsight({
        whyItMatters: "This site is losing $10,000 per month.",
      }),
      makeOpportunityAiInput(),
    );

    expect(issues).toContain("currency or revenue claim");
  });

  it.each([
    "$10k",
    "$10,000",
    "10,000 dollars",
    "ten thousand dollars",
    "ten thousand USD",
    "six figures",
    "five figures",
    "thousands in lost revenue",
  ])("rejects unsupported currency wording: %s", (claim) => {
    const issues = getOpportunityAiSafetyIssues(
      makeOpportunityAiInsight({
        whyItMatters: `This could represent ${claim}.`,
      }),
      makeOpportunityAiInput(),
    );

    expect(issues).toContain("currency or revenue claim");
  });

  it("rejects fabricated percentage claims", () => {
    const issues = getOpportunityAiSafetyIssues(
      makeOpportunityAiInsight({
        whyItMatters: "Adding booking will increase conversions by 30%.",
      }),
      makeOpportunityAiInput(),
    );

    expect(issues).toContain("percentage claim");
  });

  it.each([
    "30%",
    "30 percent",
    "thirty percent",
    "30 percentage points",
    "thirty percentage points",
    "30% uplift",
    "thirty percent increase",
  ])("rejects unsupported percentage wording: %s", (claim) => {
    const issues = getOpportunityAiSafetyIssues(
      makeOpportunityAiInsight({
        whyItMatters: `This could create a ${claim}.`,
      }),
      makeOpportunityAiInput(),
    );

    expect(issues).toContain("percentage claim");
  });

  it.each([
    "double revenue",
    "triple revenue",
    "3x revenue",
    "increase revenue significantly",
    "generate thousands in additional revenue",
    "recover lost revenue",
    "guaranteed ROI",
  ])("rejects unsupported financial outcome wording: %s", (claim) => {
    const issues = getOpportunityAiSafetyIssues(
      makeOpportunityAiInsight({
        whyItMatters: `This can ${claim}.`,
      }),
      makeOpportunityAiInput(),
    );

    expect(issues.length).toBeGreaterThan(0);
  });

  it("rejects whole-site claims for analyzed-page evidence", () => {
    const issues = getOpportunityAiSafetyIssues(
      makeOpportunityAiInsight({
        salesSummary:
          "The entire website does not surface a clear online booking path.",
      }),
      makeOpportunityAiInput(),
    );

    expect(issues).toContain("unsupported whole-site claim");
  });

  it.each([
    "there is no booking anywhere",
    "they do not offer financing",
    "they offer no financing",
    "the company has no service areas",
    "the business lacks service areas",
    "they don't provide maintenance",
    "there are no service areas on the website",
    "the website has no service-area pages",
  ])("rejects unsupported whole-site absence wording: %s", (claim) => {
    const issues = getOpportunityAiSafetyIssues(
      makeOpportunityAiInsight({
        salesSummary: claim,
      }),
      makeOpportunityAiInput(),
    );

    expect(issues).toContain("unsupported whole-site claim");
  });

  it("rejects unsupported business offering claims", () => {
    const issues = getOpportunityAiSafetyIssues(
      makeOpportunityAiInsight({
        clientFacingExplanation:
          "The HVAC company does not offer financing, which should be fixed.",
      }),
      makeOpportunityAiInput(),
    );

    expect(issues).toContain("unsupported business offering claim");
  });

  it("rejects unsupported service references", () => {
    const issues = getOpportunityAiSafetyIssues(
      makeOpportunityAiInsight({
        recommendedNextStep:
          "Have the agency launch a social media campaign for this opportunity.",
      }),
      makeOpportunityAiInput(),
    );

    expect(issues).toContain("out-of-scope or unsupported service reference");
  });

  it("rejects agency service claims when no mapped service exists", () => {
    const input = makeOpportunityAiInput({
      opportunity: {
        ...makeOpportunityAiInput().opportunity,
        recommendedService: null,
      },
    });
    const issues = getOpportunityAiSafetyIssues(
      makeOpportunityAiInsight({
        agencyTalkingPoints: [
          "The observation is limited to the analyzed page.",
          "The agency can address this through Online Booking Integration.",
        ],
      }),
      input,
    );

    expect(issues).toContain("agency service claim without mapped service");
  });
});
