import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { FeedbackMessage } from "@/components/feedback-message";
import { WorkspaceNavigation } from "@/components/dashboard/workspace-navigation";
import { DashboardOverview } from "@/features/dashboard/components/dashboard-overview";
import type { DashboardOverviewData } from "@/features/dashboard/types";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/proposals/123",
}));
const empty: DashboardOverviewData = {
  counts: { prospects: 0, completedAudits: 0, opportunities: 0, proposals: 0 },
  recentProspects: [],
  recentAudits: [],
  recentProposals: [],
};

describe("accessible shared feedback", () => {
  it("announces errors as alerts and gives errors precedence", () => {
    const html = renderToStaticMarkup(
      createElement(FeedbackMessage, {
        error: ["Failed", "Other"],
        success: "Saved",
      }),
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain('aria-atomic="true"');
    expect(html).toContain("Failed");
    expect(html).not.toContain("Saved");
  });
  it("announces success politely as status", () => {
    expect(
      renderToStaticMarkup(
        createElement(FeedbackMessage, { success: "Saved" }),
      ),
    ).toContain('role="status"');
  });
  it("renders nothing without feedback", () => {
    expect(renderToStaticMarkup(createElement(FeedbackMessage, {}))).toBe("");
  });
  it("escapes feedback instead of accepting HTML", () => {
    const html = renderToStaticMarkup(
      createElement(FeedbackMessage, { error: "<script>test</script>" }),
    );
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
  });
});

describe("dashboard rendering", () => {
  it("renders meaningful empty states and genuine zero counts", () => {
    const html = renderToStaticMarkup(
      createElement(DashboardOverview, { data: empty }),
    );
    expect(html).toContain("Your next opportunity starts here");
    expect(html).toContain("No proposals yet");
    expect(html).toContain("No website analyses yet");
    expect(html).not.toMatch(
      /Foundation status|revenue|conversion rate|time saved/i,
    );
    expect(html.match(/>0<\/p>/g)).toHaveLength(4);
  });
  it("renders supplied activity with safe links and escaped names", () => {
    const data: DashboardOverviewData = {
      counts: {
        prospects: 12,
        completedAudits: 8,
        opportunities: 25,
        proposals: 2,
      },
      recentProspects: [
        {
          id: "p-1",
          business_name: "<script>Customer</script>",
          website_url: "https://example.test/path",
          created_at: "2026-10-10T12:00:00Z",
        },
      ],
      recentAudits: [
        {
          id: "a-1",
          prospect_id: "p-1",
          status: "completed",
          website_url: "https://example.test/path",
          created_at: "2026-10-10T12:00:00Z",
        },
      ],
      recentProposals: [
        {
          id: "proposal-1",
          title: "Site improvements",
          status: "ready",
          updated_at: "2026-10-10T12:00:00Z",
        },
      ],
    };
    const html = renderToStaticMarkup(
      createElement(DashboardOverview, { data }),
    );
    expect(html).toContain("&lt;script&gt;Customer&lt;/script&gt;");
    expect(html).toContain("Completed");
    expect(html).toContain("Ready");
    expect(html).toContain("Site improvements");
    expect(html).toContain('href="/dashboard/proposals/proposal-1"');
    expect(html).not.toContain('href="https://example.test');
    expect(html).not.toContain("No proposals yet");
  });
});

describe("accessible navigation markup", () => {
  it("names landmarks and disclosure state and marks nested routes", () => {
    const html = renderToStaticMarkup(
      createElement(WorkspaceNavigation, {
        productName: "Configurable name",
        agencyName: "Long agency name ".repeat(20),
        account: null,
      }),
    );
    expect(html).toContain('aria-label="Main navigation"');
    expect(html).toContain('aria-label="Mobile navigation"');
    expect(html).toContain('aria-controls="workspace-navigation-drawer"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-labelledby="workspace-navigation-title"');
    expect(html.match(/aria-current="page"/g)).toHaveLength(2);
    expect(html).toMatch(
      /<a(?=[^>]*href="\/dashboard\/proposals")(?=[^>]*aria-current="page")[^>]*>/,
    );
    expect(html).toContain('aria-label="Close navigation"');
    expect(html).toContain("<dialog");
    expect(html).not.toContain("<dialog open");
  });
});
