import { describe, expect, it } from "vitest";
import { getNextDashboardAction } from "@/features/dashboard/next-action";
import type { DashboardOverviewData } from "@/features/dashboard/types";

const empty: DashboardOverviewData = {
  counts: { prospects: 0, completedAudits: 0, opportunities: 0, proposals: 0 },
  recentProspects: [],
  recentAudits: [],
  recentProposals: [],
};

describe("dashboard next action from bounded authenticated data", () => {
  it("uses the exact zero prospect count to recommend adding a prospect", () => {
    expect(getNextDashboardAction(empty)).toMatchObject({
      title: "Start with your first prospect",
      href: "/dashboard/prospects",
    });
  });
  it("selects the first returned draft, not a ready proposal", () => {
    const data: DashboardOverviewData = {
      ...empty,
      counts: { ...empty.counts, prospects: 3, proposals: 3 },
      recentProposals: [
        {
          id: "ready",
          title: "Ready",
          status: "ready",
          updated_at: "2026-10-12",
        },
        {
          id: "draft",
          title: "Real draft title",
          status: "draft",
          updated_at: "2026-10-11",
        },
        {
          id: "older",
          title: "Older draft",
          status: "draft",
          updated_at: "2026-10-10",
        },
      ],
    };
    const before = structuredClone(data);
    expect(getNextDashboardAction(data)).toMatchObject({
      href: "/dashboard/proposals/draft",
      description: "Real draft title",
    });
    expect(data).toEqual(before);
  });
  it("recommends reviewing opportunities without inventing a prospect-level match", () => {
    expect(
      getNextDashboardAction({
        ...empty,
        counts: { ...empty.counts, prospects: 2, opportunities: 5 },
      }),
    ).toMatchObject({
      title: "Review your available opportunities",
      href: "/dashboard/prospects",
    });
  });
  it("does not infer missing audits or drafts from an empty bounded list", () => {
    const action = getNextDashboardAction({
      ...empty,
      counts: {
        prospects: 8,
        completedAudits: 9,
        opportunities: 0,
        proposals: 4,
      },
    });
    expect(action.title).toBe("Find your next sales conversation");
    expect(action.description).not.toMatch(/no |missing|without|never/);
    expect(action.href).toBe("/dashboard/prospects");
  });
  it("is deterministic with no clock, random or provider input", () => {
    expect(getNextDashboardAction(empty)).toEqual(
      getNextDashboardAction(structuredClone(empty)),
    );
  });
});
