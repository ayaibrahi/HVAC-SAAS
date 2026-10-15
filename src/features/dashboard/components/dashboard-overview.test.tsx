import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DashboardOverview } from "./dashboard-overview";
import { UiPreferencesProvider } from "@/components/ui-preferences";
import { getDictionary } from "@/lib/i18n/dictionaries";
import type { DashboardOverviewData } from "../types";

const data: DashboardOverviewData = {
  counts: {
    prospects: 17,
    completedAudits: 9,
    opportunities: 23,
    proposals: 4,
  },
  recentProspects: [
    {
      id: "synthetic-business",
      business_name: "Synthetic HVAC",
      website_url: "https://example.test/",
      created_at: "2026-10-15T12:00:00Z",
    },
  ],
  recentAudits: [],
  recentProposals: [],
};

describe("website-first dashboard entry", () => {
  it.each(["en", "ar"] as const)(
    "keeps real counts and opens business results rather than editing (%s)",
    (locale) => {
      const before = structuredClone(data);
      const t = getDictionary(locale);
      const html = renderToStaticMarkup(
        <UiPreferencesProvider initial={{ locale, theme: "light" }}>
          <DashboardOverview data={data} />
        </UiPreferencesProvider>,
      );
      expect(html).toContain(t.addProspect);
      expect(html).toContain(t.totalProspects);
      expect(html).toContain(t.recentProspects);
      expect(html).toContain(
        'href="/dashboard/prospects?prospect=synthetic-business#website-results"',
      );
      expect(html).not.toContain("/synthetic-business/edit");
      for (const count of Object.values(data.counts))
        expect(html).toContain(
          `>${new Intl.NumberFormat(locale === "ar" ? "ar-u-nu-arab" : "en-US").format(count)}<`,
        );
      expect(html).not.toContain("<form");
      expect(data).toEqual(before);
    },
  );
});
