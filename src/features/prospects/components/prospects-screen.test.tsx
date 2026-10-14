import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ProspectsScreen } from "./prospects-screen";
import { UiPreferencesProvider } from "@/components/ui-preferences";
import {
  makeAudit,
  makeDetectedSignals,
  signal,
} from "@/features/opportunities/test-fixtures";
import { evaluateOpportunitiesForAudit } from "@/features/opportunities/engine/evaluate";
import type { ProspectWorkspaceData } from "../workspace-model";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh() {}, replace() {} }),
}));
const id = "11111111-1111-4111-8111-111111111111";
function workspace(): ProspectWorkspaceData {
  const signals = makeDetectedSignals();
  signals.hvac.onlineBooking = signal(false);
  return {
    prospect: {
      id,
      agencyId: "agency",
      businessName: "Synthetic HVAC",
      websiteUrl: "https://example.test/",
      contactName: null,
      contactEmail: null,
      notes: null,
      createdAt: "",
      updatedAt: "",
    },
    scan: { id: "audit", status: "completed", createdAt: "", completedAt: "" },
    opportunities: evaluateOpportunitiesForAudit({
      audit: makeAudit(signals),
      agencyServices: [],
    }).map((item, i) => ({
      ...item,
      id: String(i),
      agencyId: "agency",
      prospectId: id,
      auditId: "audit",
      status: "open",
      createdAt: "",
      updatedAt: "",
    })),
    insights: [],
    services: [],
    proposals: [],
  };
}
function render(
  selected: ProspectWorkspaceData | null,
  locale: "en" | "ar" = "en",
  theme: "light" | "dark" = "light",
) {
  return renderToStaticMarkup(
    <UiPreferencesProvider initial={{ locale, theme }}>
      <ProspectsScreen
        data={{ items: [], page: 1, query: "", hasNext: false }}
        selected={selected}
        addProspect={async () => ({})}
        createProposal={async () => {}}
      />
    </UiPreferencesProvider>,
  );
}
describe("simplified prospects presentation", () => {
  it.each(["en", "ar"] as const)(
    "keeps Add in a dialog and omits extra routes or a progress tracker (%s)",
    (locale) => {
      const html = render(null, locale);
      expect(html).toContain("<dialog");
      expect(html).not.toContain("/prospects/new");
      expect(html).not.toContain("Prospect progress");
      expect(html).not.toContain("مراحل العمل مع العميل");
      expect(html).not.toContain('id="prospect-details"');
      expect(html).toContain(
        locale === "en"
          ? "Your next client starts here"
          : "عميلك القادم يبدأ من هنا",
      );
    },
  );
  it.each(["light", "dark"] as const)(
    "renders the selected record once even outside the current page (%s)",
    (theme) => {
      const html = render(workspace(), "en", theme);
      expect(html.match(/id="prospect-details"/g)).toHaveLength(1);
      expect(html).toContain("Synthetic HVAC");
      expect(html).toContain("Prepare proposal");
      expect(html).toContain("More actions");
      expect(html).not.toContain("<details open");
      expect(html).toContain("Observed on this page only");
      expect(html).toContain("No matching service in your catalog");
      expect(html).toContain("AI sales insight");
      expect(html).toContain("Page evidence");
    },
  );
  it.each(["pending", "running"] as const)(
    "offers refresh, not scan or generation during %s",
    (status) => {
      const data = workspace();
      data.scan!.status = status;
      data.opportunities = [];
      const html = render(data);
      expect(html).toContain("Refresh status");
      expect(html).not.toContain(">Scan website<");
      expect(html).not.toContain(">View opportunities<");
      expect(html).not.toContain(">Prepare proposal<");
    },
  );
  it("offers scanning for an unscanned record, without automatically invoking anything", () => {
    const data = workspace();
    data.scan = null;
    data.opportunities = [];
    const html = render(data);
    expect(html).toContain(">Scan website<");
    expect(html).not.toContain(">Prepare proposal<");
    expect(html).toContain(`href="/dashboard/prospects/${id}/edit"`);
    expect(html).toContain("Delete this prospect?");
  });
  it("keeps the existing proposal destination and exposes creation only as a secondary action", () => {
    const data = workspace();
    data.proposals = [
      { id: "existing", title: "Existing saved draft", status: "draft" },
    ];
    const html = render(data);
    expect(html).toContain('href="/dashboard/proposals/existing"');
    expect(html).toContain("Continue proposal");
    expect(html.indexOf("Prepare proposal")).toBeGreaterThan(
      html.indexOf("More actions"),
    );
  });
  it("preserves page, search and selected record in inline links", () => {
    const data = workspace();
    const html = renderToStaticMarkup(
      <ProspectsScreen
        data={{
          items: [{ ...data.prospect, scan: null }],
          page: 2,
          query: "A & B",
          hasNext: true,
        }}
        selected={null}
        addProspect={async () => ({})}
        createProposal={async () => {}}
      />,
    );
    expect(html).toContain("q=A+%26+B&amp;page=2&amp;prospect=" + id);
    expect(html).toContain("q=A+%26+B&amp;page=3");
    expect(html).not.toContain('id="prospect-details"');
  });
});
