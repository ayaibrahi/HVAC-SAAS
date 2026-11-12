import { describe, expect, it } from "vitest";
import { defaultProposalTitle, serviceDisplayName } from "./presentation";
import { proposalReadyProblem } from "./readiness";

describe("client-facing proposal labels", () => {
  it.each([
    "Example HVAC",
    "for Example HVAC",
    "FOR Example HVAC",
    " for for Example HVAC ",
  ])("avoids duplicate for in the generated title for %s", (name) => {
    expect(defaultProposalTitle(name)).toBe("Proposal for Example HVAC");
  });
  it("preserves business words that only start with for", () => {
    expect(defaultProposalTitle("Forest Heating")).toBe(
      "Proposal for Forest Heating",
    );
  });
  it.each([
    ["seo", "SEO"],
    ["ppc", "PPC"],
    ["hvac service navigation", "HVAC Service Navigation"],
    ["customer care", "Customer Care"],
    ["eCommerce Support", "eCommerce Support"],
  ])("formats %s for display only", (name, expected) =>
    expect(serviceDisplayName(name)).toBe(expected),
  );
});

describe("positive Ready investment", () => {
  it("reports content, selected-line pricing and total blockers together", () => {
    const message = proposalReadyProblem({
      summary: "",
      scope: "",
      lineItems: [{ unitPrice: "" }],
      total: 0,
    });
    expect(message).toContain("Summary, Scope");
    expect(message).toContain("unit price greater than zero");
    expect(message).toContain("total investment must be greater than zero");
  });
  const base = {
    summary: "Reviewed",
    scope: "Agreed work",
    lineItems: [{ unitPrice: 500 }],
    total: 500,
  };
  it.each([0, "0.00", "", -1, NaN, Infinity])(
    "rejects unpriced/invalid selected lines: %s",
    (price) => {
      expect(
        proposalReadyProblem({
          ...base,
          lineItems: [{ unitPrice: 500 }, { unitPrice: price }],
        }),
      ).toContain("unit price greater than zero");
    },
  );
  it.each([0, -1, NaN, Infinity])(
    "rejects zero/invalid final investment: %s",
    (total) => {
      expect(proposalReadyProblem({ ...base, total })).toContain(
        "total investment must be greater than zero",
      );
    },
  );
  it("accepts one cent and keeps missing content guidance", () => {
    expect(
      proposalReadyProblem({
        ...base,
        lineItems: [{ unitPrice: "0.01" }],
        total: 0.01,
      }),
    ).toBeNull();
    expect(
      proposalReadyProblem({ ...base, summary: "", scope: "", lineItems: [] }),
    ).toContain("Summary, Scope, at least one selected service");
  });
});
