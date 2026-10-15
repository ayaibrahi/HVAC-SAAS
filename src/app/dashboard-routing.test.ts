import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DashboardPage from "./(dashboard)/dashboard/page";
import ProspectsPage from "./(dashboard)/dashboard/prospects/page";
import ServicesPage from "./(dashboard)/dashboard/services/page";
import ProposalsPage from "./(dashboard)/dashboard/proposals/page";
import SettingsPage from "./(dashboard)/dashboard/settings/page";
import ProtectedLayout from "./(dashboard)/dashboard/layout";
import { WorkspaceNavigation } from "@/components/dashboard/workspace-navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getProspectWorkspace } from "@/features/prospects/workspace-data";

const state = vi.hoisted(() => ({ path: "/dashboard" }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/ui/server-preferences", () => ({
  getUiPreferences: async () => ({ locale: "en", theme: "light" }),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => state.path,
  useRouter: () => ({ refresh() {}, replace() {} }),
  redirect: (path: string) => {
    throw new Error("REDIRECT:" + path);
  },
}));
vi.mock("next/cache", () => ({ revalidatePath() {} }));
vi.mock("@/lib/auth/session", () => ({
  getCurrentUser: vi.fn(async () => ({
    id: "user",
    email: "synthetic@example.test",
  })),
}));
vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: () => true }));
vi.mock("@/features/agencies/data", () => ({
  getAgencyForUser: async () => ({
    id: "agency",
    name: "Synthetic agency",
    website: null,
    defaultCurrency: "USD",
  }),
}));
vi.mock("@/features/dashboard/data", () => ({
  getDashboardOverview: async () => ({
    counts: {
      prospects: 0,
      completedAudits: 0,
      opportunities: 0,
      proposals: 0,
    },
    recentProspects: [],
    recentAudits: [],
    recentProposals: [],
  }),
}));
vi.mock("@/features/services/data", () => ({
  listAgencyServices: async () => [],
}));
vi.mock("@/features/prospects/data", () => ({ listProspects: async () => [] }));
vi.mock("@/features/audits/data", () => ({
  listAuditsForAgency: async () => [],
}));
vi.mock("@/features/proposals/data", () => ({
  listProposalsForAgency: async () => [],
}));
vi.mock("@/features/prospects/workspace-data", () => ({
  getProspectsPage: async () => ({
    items: [],
    page: 1,
    query: "",
    hasNext: false,
  }),
  getProspectWorkspace: vi.fn(async () => null),
}));
vi.mock("@/features/prospects/workspace-actions", () => ({
  createBusinessForScan: async () => ({}),
}));
vi.mock("@/features/proposals/actions", () => ({
  createProposalAction: async () => {},
}));
vi.mock("@/features/services/actions", () => ({
  createServiceAction: async () => {},
  deleteServiceAction: async () => {},
  toggleServiceActiveAction: async () => {},
}));
vi.mock("@/features/agencies/actions", () => ({
  upsertAgencyAction: async () => {},
}));
vi.mock("@/features/auth/actions", () => ({ signOutAction: async () => {} }));
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCurrentUser).mockResolvedValue({
    id: "user",
    email: "synthetic@example.test",
  } as NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>);
});

describe("actual dashboard page entry points (mocked session/data, not a fixture router)", () => {
  it("preserves feedback from the unchanged prospect edit action", async () => {
    const html = renderToStaticMarkup(
      await ProspectsPage({
        searchParams: Promise.resolve({ success: "Prospect updated." }),
      }),
    );
    expect(html).toContain('role="status"');
    expect(html).toContain("Prospect updated.");
  });
  it.each([
    [
      "/dashboard",
      DashboardPage,
      "Sales workspace",
      "Your next opportunity starts here",
    ],
    [
      "/dashboard/prospects",
      ProspectsPage,
      "Find website opportunities",
      "No saved businesses yet",
    ],
    ["/dashboard/services", ServicesPage, "Services", "Service catalog"],
    ["/dashboard/proposals", ProposalsPage, "Proposals", "Create draft"],
    ["/dashboard/settings", SettingsPage, "Settings", "Agency name"],
  ] as const)(
    "executes %s and renders its own content and selected navigation",
    async (path, Page, heading, marker) => {
      state.path = path;
      const content = await Page({ searchParams: Promise.resolve({}) });
      const html = renderToStaticMarkup(content);
      expect(html).toMatch(new RegExp("<h1[^>]*>" + heading + "</h1>"));
      expect(html).toContain(marker);
      expect(html).not.toContain("Prospect progress");
      if (path !== "/dashboard/prospects")
        expect(html).not.toContain('id="website-results"');
      const navigation = renderToStaticMarkup(
        createElement(WorkspaceNavigation, {
          productName: "Scanvoro",
          account: null,
        }),
      );
      const currentLink = navigation.match(
        /<a\b[^>]*aria-current="page"[^>]*>/g,
      );
      expect(currentLink).toHaveLength(2); // Desktop navigation and the closed mobile drawer.
      for (const link of currentLink ?? [])
        expect(link).toContain('href="' + path + '"');
      for (const destination of [
        "/dashboard",
        "/dashboard/prospects",
        "/dashboard/services",
        "/dashboard/proposals",
        "/dashboard/settings",
      ])
        expect(navigation).toContain('href="' + destination + '"');
    },
  );
  it("protects every child route with authentication rather than fixture access", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    await expect(
      ProtectedLayout({
        children: createElement("p", null, "PRIVATE CONTENT"),
      }),
    ).rejects.toThrow("REDIRECT:/sign-in");
  });
  it("renders Settings inside the authenticated shell, not prospect content", async () => {
    state.path = "/dashboard/settings";
    const html = renderToStaticMarkup(
      await ProtectedLayout({
        children: await SettingsPage({ searchParams: Promise.resolve({}) }),
      }),
    );
    expect(html).toContain("Your agency profile and workspace preferences.");
    expect(html).toContain("Update agency");
    expect(html).not.toContain("View prospect");
  });
  it("handles unavailable selected IDs without leaking another tenant", async () => {
    const html = renderToStaticMarkup(
      await ProspectsPage({
        searchParams: Promise.resolve({ prospect: "foreign-id" }),
      }),
    );
    expect(getProspectWorkspace).toHaveBeenCalledWith("foreign-id");
    expect(html).toContain("isn&#x27;t available to your agency");
    expect(html).not.toContain('id="website-results"');
  });
});
