import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  PreferenceControls,
  UiPreferencesProvider,
  EnglishWorkflow,
} from "@/components/ui-preferences";
import { FeedbackMessage } from "@/components/feedback-message";
import { WorkspaceNavigation } from "@/components/dashboard/workspace-navigation";
import { DashboardOverview } from "@/features/dashboard/components/dashboard-overview";
import { arabic } from "@/lib/i18n/dictionaries";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/proposals/123",
  useRouter: () => ({ refresh: vi.fn() }),
}));
function render(
  child: ReturnType<typeof createElement>,
  locale: "en" | "ar" = "ar",
  theme: "light" | "dark" = "dark",
) {
  return renderToStaticMarkup(
    createElement(UiPreferencesProvider, { initial: { locale, theme } }, child),
  );
}
describe("bilingual accessible interface", () => {
  it("renders server-derived theme and locale control states", () => {
    const html = render(createElement(PreferenceControls));
    expect(html).toContain(
      `aria-label="${arabic.dark}" title="${arabic.dark}"`,
    );
    expect(html).toMatch(/aria-pressed="true"[^>]*aria-label="داكن"/);
    expect(html).toMatch(
      /<option(?=[^>]*value="ar")(?=[^>]*selected="")[^>]*>/,
    );
    expect(html).toContain(arabic.arabic);
  });
  it("preserves authenticated routes and active nested navigation in Arabic", () => {
    const html = render(
      createElement(WorkspaceNavigation, {
        productName: "Scanvoro",
        account: null,
      }),
    );
    for (const route of [
      "/dashboard",
      "/dashboard/prospects",
      "/dashboard/services",
      "/dashboard/proposals",
      "/dashboard/settings",
    ])
      expect(html).toContain(`href="${route}"`);
    expect(html.match(/aria-current="page"/g)).toHaveLength(2);
    expect(html).toContain(arabic.openNavigation);
    expect(html).toContain(arabic.closeNavigation);
    expect(html).toContain(arabic.proposals);
  });
  it("announces translated feedback and escapes unknown text", () => {
    expect(
      render(createElement(FeedbackMessage, { success: "Proposal saved." })),
    ).toContain(arabic.proposalSaved);
    const html = render(
      createElement(FeedbackMessage, { error: "<script>hello</script>" }),
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
  });
  it("discloses partial coverage and isolates untranslated workflows", () => {
    const html = render(
      createElement(EnglishWorkflow, null, "Proposal editor"),
    );
    expect(html).toContain(arabic.partialLocale);
    expect(html).toContain('<div lang="en" dir="ltr">');
    expect(
      render(createElement(EnglishWorkflow, null, "Form"), "en"),
    ).not.toContain(arabic.partialLocale);
  });
  it("localizes the empty dashboard without inventing data", () => {
    const html = render(
      createElement(DashboardOverview, {
        data: {
          counts: {
            prospects: 0,
            completedAudits: 0,
            opportunities: 0,
            proposals: 0,
          },
          recentProspects: [],
          recentAudits: [],
          recentProposals: [],
        },
      }),
    );
    expect(html).toContain(arabic.salesWorkspace);
    expect(html).toContain(arabic.noAnalysesTitle);
    expect(html).toContain(arabic.firstProspectTitle);
    expect(html.match(/>٠<\/p>/g)).toHaveLength(4);
  });
});
