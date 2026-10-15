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
    "shows localized unverified status and blocks new finding generation: %s",
    (locale) => {
      const data = workspace();
      data.scan!.verification = "unverified";
      data.opportunities = [];
      const html = render(data, locale);
      expect(html).toContain(
        locale === "en" ? "Unable to verify page" : "تعذّر التحقّق من الصفحة",
      );
      expect(html).not.toContain('name="auditId"');
      expect(html).not.toContain("/opportunities");
    },
  );
  it("uses singular English and Arabic for a single opportunity", () => {
    expect(render(workspace())).toContain("1 opportunity found");
    expect(render(workspace(), "ar")).toContain("فرصة تحسين واحدة");
  });
  it("shows website entry and save/scan intent in both locales", () => {
    for (const locale of ["en", "ar"] as const) {
      const html = render(null, locale);
      expect(html).toContain('inputMode="url"');
      expect(html).toContain(
        locale === "en" ? "Add and scan website" : "أضف النشاط وافحص الموقع",
      );
      expect(html).toContain(
        locale === "en"
          ? "This saves the business and scans one public webpage."
          : "سيُحفظ النشاط وتُفحص صفحة عامة واحدة.",
      );
    }
  });
  it("shows three leading opportunities directly and preserves the remaining two behind one disclosure", () => {
    const data = workspace(),
      item = data.opportunities[0];
    data.opportunities = Array.from({ length: 5 }, (_, i) => ({
      ...item,
      id: String(i),
      title: "Finding " + i,
    }));
    const html = render(data);
    const more = html.indexOf("More opportunities");
    expect(html.indexOf("Finding 2")).toBeLessThan(more);
    expect(html.indexOf("Finding 3")).toBeGreaterThan(more);
    expect(html.match(/data-finding/g)).toHaveLength(5);
    expect(html).toContain("5 opportunities found");
  });
  it("does not mistake an unreviewed completed scan for an empty opportunity evaluation", () => {
    const data = workspace();
    data.opportunities = [];
    const html = render(data);
    expect(html).toContain("Check its evidence for supported opportunities.");
    expect(html).toContain("Find opportunities");
    expect(html).not.toContain("No supported opportunities were found");
  });
  it.each(["en", "ar"] as const)(
    "keeps Add in a dialog and omits extra routes or a progress tracker (%s)",
    (locale) => {
      const html = render(null, locale);
      expect(html).toContain("<dialog");
      expect(html).not.toContain("/prospects/new");
      expect(html).not.toContain("Prospect progress");
      expect(html).not.toContain("مراحل العمل مع العميل");
      expect(html).not.toContain('id="website-results"');
      expect(html).toContain(
        locale === "en"
          ? "No saved businesses yet"
          : "لا توجد أنشطة محفوظة بعد",
      );
    },
  );
  it.each(["light", "dark"] as const)(
    "renders the selected record once even outside the current page (%s)",
    (theme) => {
      const html = render(workspace(), "en", theme);
      expect(html.match(/id="website-results"/g)).toHaveLength(1);
      expect(html).toContain("Synthetic HVAC");
      expect(html).toContain("Prepare proposal");
      expect(html).toContain("Business options");
      expect(html).not.toContain("<details open");
      expect(html).toContain("Observed on this page only");
      expect(html).toContain("No matching service in your catalog");
      expect(html).toContain("AI sales insight");
      expect(html).toContain("Review evidence");
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
      expect(html).not.toContain(">Find opportunities<");
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
    expect(html).toContain("Delete this business?");
  });
  it("resumes an existing draft without a second creation action", () => {
    const data = workspace();
    data.proposals = [
      { id: "existing", title: "Existing saved draft", status: "draft" },
    ];
    const html = render(data);
    expect(html).toContain('href="/dashboard/proposals/existing"');
    expect(html).toContain("Open proposal draft");
    expect(html).not.toContain("Prepare proposal");
    expect(html.indexOf("Open proposal draft")).toBeLessThan(
      html.indexOf("data-finding"),
    );
  });
  it("shows exactly one creation action above findings, including without a mapped service", () => {
    const html = render(workspace());
    expect(html.match(/>Prepare proposal</g)).toHaveLength(1);
    expect(html.indexOf("Prepare proposal")).toBeLessThan(
      html.indexOf("data-finding"),
    );
    expect(html).toContain("Start an empty draft");
    expect(html).toContain('name="auditId" value="audit"');
  });
  it("prefers a saved draft over a newer ready proposal and labels ready proposals honestly", () => {
    const data = workspace();
    data.proposals = [
      { id: "ready", title: "Ready", status: "ready" },
      { id: "draft", title: "Draft", status: "draft" },
    ];
    expect(render(data)).toContain(
      'class="button-primary" href="/dashboard/proposals/draft"',
    );
    data.proposals.pop();
    const html = render(data);
    expect(html).toContain("Open saved proposal");
    expect(html).not.toContain("Open proposal draft");
  });
  it("does not offer creation without findings, but keeps an existing draft accessible", () => {
    const data = workspace();
    data.opportunities = [];
    expect(render(data)).not.toContain("Prepare proposal");
    data.proposals = [{ id: "saved", title: "Saved", status: "draft" }];
    expect(render(data)).toContain("Open proposal draft");
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
    expect(html).not.toContain('id="website-results"');
  });
});
