import { describe, expect, it } from "vitest";
import {
  arabic,
  english,
  getDictionary,
  translateFeedback,
} from "@/lib/i18n/dictionaries";
import { getLocalizedDashboardAction } from "@/features/dashboard/localized-action";
import { getNextDashboardAction } from "@/features/dashboard/next-action";
import type { DashboardOverviewData } from "@/features/dashboard/types";

const empty: DashboardOverviewData = {
  counts: { prospects: 0, completedAudits: 0, opportunities: 0, proposals: 0 },
  recentProspects: [],
  recentAudits: [],
  recentProposals: [],
};

describe("typed English and Arabic dictionaries", () => {
  it("has complete shared-key coverage in both dictionaries", () => {
    expect(Object.keys(arabic).sort()).toEqual(Object.keys(english).sort());
    expect(Object.values(arabic).every((value) => value.trim())).toBe(true);
  });
  it.each([undefined, "unknown", "AR", "ar-EG", {}, "__proto__"])(
    "falls back visibly to English for %j",
    (value) => expect(getDictionary(value)).toBe(english),
  );
  it("translates known feedback and leaves arbitrary content untouched", () => {
    expect(translateFeedback("Proposal saved.", "ar")).toBe(
      arabic.proposalSaved,
    );
    expect(translateFeedback("Prospect created.", "ar")).toBe(
      arabic.prospectCreated,
    );
    expect(translateFeedback("customer text <script>", "ar")).toBe(
      "customer text <script>",
    );
    expect(translateFeedback("__proto__", "ar")).toBe("__proto__");
  });
  it("localizes next-action presentation without changing destination or input", () => {
    const data = {
      ...empty,
      counts: { ...empty.counts, prospects: 1, opportunities: 2 },
    };
    const before = structuredClone(data);
    expect(getLocalizedDashboardAction(data, "ar").href).toBe(
      getNextDashboardAction(data).href,
    );
    expect(getLocalizedDashboardAction(data, "ar").title).toBe(
      arabic.reviewOpportunitiesTitle,
    );
    expect(data).toEqual(before);
  });
  it("never translates a saved draft title", () => {
    const data: DashboardOverviewData = {
      ...empty,
      counts: { ...empty.counts, prospects: 1 },
      recentProposals: [
        {
          id: "draft-1",
          title: "Draft",
          status: "draft",
          updated_at: "2026-10-13",
        },
      ],
    };
    expect(getLocalizedDashboardAction(data, "ar").description).toBe("Draft");
    expect(getLocalizedDashboardAction(data, "ar").href).toBe(
      "/dashboard/proposals/draft-1",
    );
  });
});
