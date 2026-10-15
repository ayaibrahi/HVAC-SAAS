import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { redirect } from "next/navigation";
import { createProposalAction } from "./actions";
import { getProposalBuilderData } from "./data";
import ProposalBuilderPage from "@/app/(dashboard)/dashboard/proposals/[proposalId]/page";
import ProposalsPage from "@/app/(dashboard)/dashboard/proposals/page";
import ProposalWorkspaceError from "@/app/(dashboard)/dashboard/proposals/error";
import { UiPreferencesProvider } from "@/components/ui-preferences";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { generateProposalAiDraftForProposal } from "./ai/data";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", async (original) => {
  const actual = await original<typeof import("next/navigation")>();
  return { ...actual, redirect: vi.fn(actual.redirect) };
});
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => client),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(() => client),
}));
vi.mock("./ai/data", () => ({ generateProposalAiDraftForProposal: vi.fn() }));
vi.mock("./delivery/data", () => ({
  listDeliverySnapshotsForProposal: vi.fn(async () => []),
  createDeliverySnapshotForProposal: vi.fn(),
}));
vi.mock("./share-links/data", () => ({
  listShareLinksForSnapshots: vi.fn(async () => []),
}));
vi.mock("@/lib/auth/session", () => ({
  getCurrentUser: async () => (signedIn ? { id: userId } : null),
}));

const auditId = "11111111-1111-4111-8111-111111111111";
const agencyId = "22222222-2222-4222-8222-222222222222";
const prospectId = "33333333-3333-4333-8333-333333333333";
const proposalId = "44444444-4444-4444-8444-444444444444";
const opportunityId = "55555555-5555-4555-8555-555555555555";
const userId = "77777777-7777-4777-8777-777777777777";
type Row = Record<string, unknown>;
let rows: Record<string, Row[]>;
let signedIn: boolean;
let failInsert: boolean;
const inserts = vi.fn();
const queries: { table: string; filters: [string, unknown][] }[] = [];

// In-memory HTTP/storage substitute only. Real actions, authorization, row mappers,
// data orchestration, redirects and page entrypoints execute unchanged.
function query(table: string) {
  const filters: [string, unknown][] = [];
  queries.push({ table, filters });
  let inserted: Row | undefined;
  const result = (single: boolean) => {
    if (inserted) {
      if (failInsert)
        return { data: null, error: { message: "private DB detail" } };
      const row = {
        ...inserted,
        id: proposalId,
        created_at: "",
        updated_at: "",
      };
      rows[table] = [...(rows[table] ?? []), row];
      return { data: row, error: null };
    }
    const matching = (rows[table] ?? []).filter((row) =>
      filters.every(([key, value]) =>
        Array.isArray(value) ? value.includes(row[key]) : row[key] === value,
      ),
    );
    return { data: single ? (matching[0] ?? null) : matching, error: null };
  };
  const builder = {
    select: () => builder,
    eq: (key: string, value: unknown) => {
      filters.push([key, value]);
      return builder;
    },
    in: (key: string, value: unknown[]) => {
      filters.push([key, value]);
      return builder;
    },
    order: () => builder,
    insert: (value: Row) => {
      inserted = value;
      inserts(table, value);
      return builder;
    },
    single: async () => result(true),
    maybeSingle: async () => result(true),
    then: (resolve: (value: ReturnType<typeof result>) => unknown) =>
      Promise.resolve(result(false)).then(resolve),
  };
  return builder;
}
const client = {
  from: query,
  auth: {
    getUser: async () => ({
      data: { user: signedIn ? { id: userId } : null },
      error: null,
    }),
  },
};
beforeEach(() => {
  vi.clearAllMocks();
  queries.length = 0;
  signedIn = true;
  failInsert = false;
  rows = {
    agencies: [
      {
        id: agencyId,
        owner_user_id: userId,
        name: "Test agency",
        default_currency: "USD",
      },
    ],
    prospects: [
      {
        id: prospectId,
        agency_id: agencyId,
        business_name: "Synthetic HVAC",
        website_url: "https://example.test/",
      },
    ],
    audits: [
      {
        id: auditId,
        agency_id: agencyId,
        prospect_id: prospectId,
        status: "completed",
        vertical_key: "hvac",
        website_url: "https://example.test/",
        normalized_signals: {},
        signal_schema_version: "1.0.0",
        playbook_version: "1.0.0",
      },
    ],
    opportunities: [
      {
        id: opportunityId,
        agency_id: agencyId,
        prospect_id: prospectId,
        audit_id: auditId,
        agency_service_id: null,
        title: "Booking finding",
        short_description: "Booking not detected on this page.",
        evidence: [],
        priority: "high",
        confidence: "high",
        score: 80,
        status: "open",
      },
    ],
    proposals: [],
  };
});
async function submit() {
  const form = new FormData();
  form.set("auditId", auditId);
  form.set("title", "");
  form.set("agencyId", "forged");
  form.set("prospectId", "forged");
  form.set("proposalId", "forged");
  form.append("opportunityId", "forged");
  await expect(createProposalAction(form)).rejects.toMatchObject({
    message: "NEXT_REDIRECT",
  });
  expect(redirect).toHaveBeenCalledTimes(1);
  return new URL(vi.mocked(redirect).mock.calls[0][0], "https://example.test");
}
async function editorHtml(id: string) {
  return renderToStaticMarkup(
    await ProposalBuilderPage({
      params: Promise.resolve({ proposalId: id }),
      searchParams: Promise.resolve({}),
    }),
  );
}

describe("website findings to real proposal action and editor (mocked storage)", () => {
  it("creates once, redirects to the returned ID, and resolves the actual editor with no preselected lines or AI", async () => {
    const target = await submit();
    expect(target.pathname).toBe(`/dashboard/proposals/${proposalId}`);
    expect(target.searchParams.get("success")).toBe("Proposal draft created.");
    expect(inserts).toHaveBeenCalledExactlyOnceWith(
      "proposals",
      expect.objectContaining({
        agency_id: agencyId,
        prospect_id: prospectId,
        audit_id: auditId,
        title: "Proposal for Synthetic HVAC",
        total_amount: 0,
        status: "draft",
      }),
    );
    const html = await editorHtml(target.pathname.split("/").at(-1)!);
    expect(html).toContain("Proposal Builder");
    expect(html).toContain("Synthetic HVAC");
    expect(html).toContain(`name="opportunityId" value="${opportunityId}"`);
    expect(html).not.toContain("checked=");
    expect(html).toContain("Add at least one active service");
    expect(html).toContain("No line items selected.");
    expect(generateProposalAiDraftForProposal).not.toHaveBeenCalled();
  });
  it("retains an unmapped opportunity for manual selection, not an invented service", async () => {
    await submit();
    const data = await getProposalBuilderData(proposalId);
    expect(data.opportunities[0].agencyServiceId).toBeNull();
    expect(data.services).toEqual([]);
    expect(data.lineItemsByOpportunityId.size).toBe(0);
  });
  it("preserves the existing completed-audit blank draft contract even with zero opportunities", async () => {
    rows.opportunities = [];
    await submit();
    expect(await editorHtml(proposalId)).toContain("No line items selected.");
    expect(inserts).toHaveBeenCalledTimes(1);
  });
  it.each(["pending", "running", "failed"])(
    "denies creation from a %s audit before privileged writes",
    async (status) => {
      rows.audits[0].status = status;
      const target = await submit();
      expect(target.pathname).toBe("/dashboard/proposals");
      expect(target.searchParams.get("error")).toContain("completed audits");
      expect(createSupabaseAdminClient).not.toHaveBeenCalled();
    },
  );
  it.each(["audits", "prospects"])(
    "denies foreign %s using real tenant-filtered queries",
    async (table) => {
      rows[table][0].agency_id = "foreign-agency";
      const target = await submit();
      expect(target.searchParams.get("error")).toContain("not found");
      expect(createSupabaseAdminClient).not.toHaveBeenCalled();
      expect(
        queries
          .filter((q) => q.table === table)
          .every((q) =>
            q.filters.some(([k, v]) => k === "agency_id" && v === agencyId),
          ),
      ).toBe(true);
    },
  );
  it("denies missing audits and unauthenticated creation", async () => {
    rows.audits = [];
    expect((await submit()).searchParams.get("error")).toBe("Audit not found.");
    vi.mocked(redirect).mockClear();
    signedIn = false;
    expect((await submit()).searchParams.get("error")).toBe(
      "Sign in to continue.",
    );
    expect(inserts).not.toHaveBeenCalled();
  });
  it("renders controlled creation failure feedback on the real proposals destination", async () => {
    failInsert = true;
    const target = await submit();
    expect(target.searchParams.has("success")).toBe(false);
    const html = renderToStaticMarkup(
      await ProposalsPage({
        searchParams: Promise.resolve({
          error: target.searchParams.get("error")!,
        }),
      }),
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain("We could not create the proposal draft.");
    expect(html).not.toContain("private DB detail");
    expect(inserts).toHaveBeenCalledTimes(1);
  });
  it("resumes saved selections and prices without inserting another proposal", async () => {
    await submit();
    rows.proposal_line_items = [
      {
        id: "line",
        proposal_id: proposalId,
        agency_id: agencyId,
        opportunity_id: opportunityId,
        agency_service_id: "service",
        service_name: "Chosen service",
        quantity: 2,
        unit_price: 500,
        line_total: 1000,
        position: 0,
        description: "Manually confirmed",
      },
    ];
    rows.agency_services = [
      {
        id: "service",
        agency_id: agencyId,
        name: "Chosen service",
        price: 99,
        currency: "USD",
        is_active: true,
      },
    ];
    const html = await editorHtml(proposalId);
    expect(html).toContain("checked=");
    expect(html).toContain('value="500.00"');
    expect(html).toContain("Manually confirmed");
    expect(inserts).toHaveBeenCalledTimes(1);
    expect(
      queries
        .filter((q) =>
          [
            "proposals",
            "proposal_line_items",
            "opportunities",
            "agency_services",
          ].includes(q.table),
        )
        .every(
          (q) =>
            q.filters.some(([k, v]) => k === "agency_id" && v === agencyId) ||
            (q.table === "proposals" && q.filters.length === 0),
        ),
    ).toBe(true);
  });
  it("rejects foreign proposal navigation before loading snapshots or changing anything", async () => {
    await submit();
    rows.proposals[0].agency_id = "foreign";
    await expect(editorHtml(proposalId)).rejects.toThrow("Proposal not found.");
    expect(inserts).toHaveBeenCalledTimes(1);
  });
  it.each(["en", "ar"] as const)(
    "offers safe recovery links without rendering internal errors (%s)",
    (locale) => {
      const html = renderToStaticMarkup(
        <UiPreferencesProvider initial={{ locale, theme: "dark" }}>
          <ProposalWorkspaceError />
        </UiPreferencesProvider>,
      );
      expect(html).toContain('role="alert"');
      expect(html).toContain('href="/dashboard/proposals"');
      expect(html).toContain('href="/dashboard/prospects"');
      expect(html).not.toContain("<form");
    },
  );
});
