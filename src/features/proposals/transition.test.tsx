import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { redirect } from "next/navigation";
import {
  createProposalAction,
  updateProposalAction,
  saveProposalFormAction,
} from "./actions";
import { getProposalBuilderData } from "./data";
import ProposalBuilderPage from "@/app/(dashboard)/dashboard/proposals/[proposalId]/page";
import ProposalsPage from "@/app/(dashboard)/dashboard/proposals/page";
import ProposalWorkspaceError from "@/app/(dashboard)/dashboard/proposals/error";
import { UiPreferencesProvider } from "@/components/ui-preferences";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { generateProposalAiDraftForProposal } from "./ai/data";
import { getUiPreferences } from "@/lib/ui/server-preferences";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/ui/server-preferences", () => ({
  getUiPreferences: vi.fn(async () => ({ locale: "en", theme: "light" })),
}));
vi.mock("next/navigation", async (original) => {
  const actual = await original<typeof import("next/navigation")>();
  return {
    ...actual,
    redirect: vi.fn(actual.redirect),
    useRouter: () => ({ refresh: vi.fn() }),
  };
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
let failSave: boolean;
const inserts = vi.fn();
const saveRpc = vi.fn(async (_name: string, input: Row) => {
  if (failSave) return { error: { message: "private storage failure" } };
  const proposal = rows.proposals.find(
    (row) =>
      row.id === input.p_proposal_id && row.agency_id === input.p_agency_id,
  )!;
  for (const field of [
    "title",
    "status",
    "summary",
    "scope",
    "next_step",
    "currency",
    "subtotal_amount",
    "discount_type",
    "discount_value",
    "discount_amount",
    "total_amount",
  ])
    proposal[field] = input[`p_${field}`];
  rows.proposal_line_items = (input.p_line_items as Row[]).map(
    (line, index) => ({
      ...line,
      id: `saved-${index}`,
      proposal_id: proposalId,
      agency_id: agencyId,
    }),
  );
  rows.proposal_opportunities = (input.p_line_items as Row[]).map((line) => ({
    ...line,
    proposal_id: proposalId,
    agency_id: agencyId,
  }));
  return { error: null };
});
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
  rpc: saveRpc,
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
  failSave = false;
  vi.mocked(getUiPreferences).mockResolvedValue({
    locale: "en",
    theme: "light",
  });
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
  it("does not default an unmatched finding to an unrelated catalog service or price", async () => {
    await submit();
    rows.agency_services = [
      {
        id: "unrelated",
        agency_id: agencyId,
        name: "Logo Design",
        price: 1500,
        currency: "USD",
        is_active: true,
      },
    ];
    const html = await editorHtml(proposalId);
    const serviceChoices = html.match(
      new RegExp(
        `<select name="serviceId:${opportunityId}"[^>]*>(.*?)</select>`,
      ),
    )![1];
    expect(serviceChoices).toContain(
      '<option value="" selected="">Choose a relevant service</option>',
    );
    expect(serviceChoices).not.toContain('value="unrelated" selected');
    expect(
      html.match(
        new RegExp(`<input[^>]*name="unitPrice:${opportunityId}"[^>]*>`),
      )![0],
    ).toContain('value="0.00"');
    expect(html).toContain("No matching catalog service was suggested.");
    expect(html).not.toContain("checked=");
    expect(generateProposalAiDraftForProposal).not.toHaveBeenCalled();
  });
  it("keeps a relevant active recommendation available without preselecting its opportunity", async () => {
    await submit();
    rows.opportunities[0].agency_service_id = "booking";
    rows.agency_services = [
      {
        id: "booking",
        agency_id: agencyId,
        name: "Booking Integration",
        price: 350,
        currency: "USD",
        is_active: true,
      },
    ];
    const html = await editorHtml(proposalId);
    expect(html).toContain(
      '<option value="booking" selected="">Booking Integration</option>',
    );
    expect(
      html.match(
        new RegExp(`<input[^>]*name="unitPrice:${opportunityId}"[^>]*>`),
      )![0],
    ).toContain('value="350.00"');
    expect(html).not.toContain("checked=");
  });
  it.each(["en", "ar"] as const)(
    "explains empty drafts, saved totals and Ready delivery prerequisites (%s)",
    async (locale) => {
      await submit();
      vi.mocked(getUiPreferences).mockResolvedValue({ locale, theme: "dark" });
      const html = await editorHtml(proposalId);
      expect(html).toContain(
        `lang="${locale}" dir="${locale === "ar" ? "rtl" : "ltr"}"`,
      );
      expect(html).toContain(
        locale === "en" ? "Nothing is selected yet." : "لم تُختر أي خدمة بعد.",
      );
      expect(html).toContain(
        locale === "en"
          ? "Save changes to update this preview"
          : "احفظ التعديلات لتحديث المعاينة",
      );
      expect(html).toMatch(
        /disabled=""[^>]*>(?:Generate summary and scope|إعداد الملخص ونطاق العمل)/,
      );
      expect(html).toMatch(
        /disabled=""[^>]*>(?:Prepare client-ready version|إعداد نسخة جاهزة للعميل)/,
      );
      expect(html).toContain(
        `/dashboard/prospects?prospect=${prospectId}#website-results`,
      );
      expect(html).not.toContain("checked=");
    },
  );
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
  it("saves and reopens manual selections/prices using the real action and pricing path, then marks the saved draft Ready", async () => {
    await submit();
    const serviceId = "66666666-6666-4666-8666-666666666666";
    rows.agency_services = [
      {
        id: serviceId,
        agency_id: agencyId,
        name: "Booking Integration",
        price: 99,
        description: null,
        currency: "USD",
        is_active: true,
      },
    ];
    const form = new FormData();
    for (const [key, value] of Object.entries({
      title: "Manually reviewed",
      summary: "On the analyzed page booking was not detected.",
      scope: "Add the selected booking integration.",
      nextStep: "Review together.",
      currency: "USD",
      status: "draft",
      discountType: "none",
      discountValue: "0",
      opportunityId,
      [`serviceId:${opportunityId}`]: serviceId,
      [`quantity:${opportunityId}`]: "1",
      [`unitPrice:${opportunityId}`]: "500.00",
      [`description:${opportunityId}`]: "Manual scope",
    }))
      form.set(key, value);
    vi.mocked(redirect).mockClear();
    await expect(updateProposalAction(proposalId, form)).rejects.toMatchObject({
      message: "NEXT_REDIRECT",
    });
    expect(saveRpc).toHaveBeenCalledExactlyOnceWith(
      "save_proposal_draft",
      expect.objectContaining({
        p_agency_id: agencyId,
        p_requested_by: userId,
        p_total_amount: 500,
        p_line_items: [
          expect.objectContaining({
            agency_service_id: serviceId,
            unit_price: 500,
          }),
        ],
      }),
    );
    expect(vi.mocked(redirect).mock.calls[0][0]).toContain(
      "success=Proposal+saved.",
    );
    rows.agency_services[0].price = 900;
    const html = await editorHtml(proposalId);
    expect(html).toContain('value="500.00"');
    expect(html).toContain("Manual scope");
    expect(html).toContain('value="Manually reviewed"');
    expect(html).toContain('checked=""');
    form.set("status", "ready");
    await expect(updateProposalAction(proposalId, form)).rejects.toMatchObject({
      message: "NEXT_REDIRECT",
    });
    const readyHtml = await editorHtml(proposalId);
    expect(readyHtml).toMatch(
      /aria-disabled="false">Prepare client-ready version/,
    );
    expect(rows.proposals[0].total_amount).toBe(500);
    expect(inserts).toHaveBeenCalledTimes(1);
    expect(generateProposalAiDraftForProposal).not.toHaveBeenCalled();
  });
  it("returns safe save failure feedback and keeps the previous saved values after a failed RPC", async () => {
    await submit();
    const before = structuredClone(rows.proposals[0]);
    failSave = true;
    const form = new FormData();
    for (const [key, value] of Object.entries({
      title: "New title",
      summary: "",
      scope: "",
      nextStep: "",
      currency: "USD",
      status: "draft",
      discountType: "none",
      discountValue: "0",
    }))
      form.set(key, value);
    vi.mocked(redirect).mockClear();
    await expect(updateProposalAction(proposalId, form)).rejects.toMatchObject({
      message: "NEXT_REDIRECT",
    });
    const target = vi.mocked(redirect).mock.calls[0][0];
    expect(
      new URL(target, "https://example.test").searchParams.get("error"),
    ).toBe("We could not update the proposal.");
    expect(target).not.toContain("private");
    expect(rows.proposals[0]).toEqual(before);
    expect(saveRpc).toHaveBeenCalledTimes(1);
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
it("preserves a saved inactive service and manual price visibly instead of silently choosing another service", async () => {
  await submit();
  rows.proposal_line_items = [
    {
      id: "saved-line",
      proposal_id: proposalId,
      agency_id: agencyId,
      opportunity_id: opportunityId,
      agency_service_id: "inactive",
      service_name: "Original service",
      quantity: 1,
      unit_price: 500,
      line_total: 500,
      position: 0,
      description: "Saved scope",
    },
  ];
  rows.agency_services = [
    {
      id: "inactive",
      agency_id: agencyId,
      name: "Original service",
      price: 99,
      currency: "USD",
      is_active: false,
    },
  ];
  const html = await editorHtml(proposalId);
  expect(html).toContain('value="inactive" disabled="" selected=""');
  const checkbox = html.match(/<input[^>]*name="opportunityId"[^>]*>/)![0];
  expect(checkbox).toContain('checked=""');
  expect(checkbox).not.toContain('disabled=""');
  expect(html).toContain('value="500.00"');
  expect(html).toContain("Saved scope");
});

function manualForm() {
  const form = new FormData();
  for (const [key, value] of Object.entries({
    title: "TEST ONLY manual draft",
    status: "draft",
    summary: "",
    scope: "",
    nextStep: "",
    currency: "USD",
    discountType: "none",
    discountValue: "0",
    opportunityId,
    [`serviceId:${opportunityId}`]: "66666666-6666-4666-8666-666666666666",
    [`quantity:${opportunityId}`]: "1",
    [`unitPrice:${opportunityId}`]: "500.00",
    [`description:${opportunityId}`]: "",
  }))
    form.set(key, value);
  return form;
}
function addCatalogService() {
  rows.agency_services = [
    {
      id: "66666666-6666-4666-8666-666666666666",
      agency_id: agencyId,
      name: "Website Conversion Optimization",
      description: "Catalog capabilities are not approved deliverables.",
      price: 99,
      currency: "USD",
      is_active: true,
    },
  ];
}
it("reproduces unmatched blank-service save rejection before the RPC without deleting the already-created draft", async () => {
  await submit();
  addCatalogService();
  const before = structuredClone(rows.proposals[0]);
  const form = manualForm();
  form.set(`serviceId:${opportunityId}`, "");
  expect((await saveProposalFormAction(proposalId, form)).error).toContain(
    "Choose a catalog service",
  );
  expect(saveRpc).not.toHaveBeenCalled();
  expect(rows.proposals[0]).toEqual(before);
  expect(inserts).toHaveBeenCalledTimes(1);
});
it("does not turn catalog text or generic implementation support into an approved line scope", async () => {
  await submit();
  addCatalogService();
  expect(await saveProposalFormAction(proposalId, manualForm())).toEqual({
    saved: true,
  });
  expect(rows.proposal_line_items[0].description).toBe("");
  expect(rows.proposal_line_items[0].unit_price).toBe(500);
  expect(inserts).toHaveBeenCalledTimes(1);
});
it.each(["opportunities", "agency_services", "proposals"])(
  "blocks cross-tenant %s before a save RPC",
  async (table) => {
    await submit();
    addCatalogService();
    rows[table][0].agency_id = "foreign-agency";
    expect(
      (await saveProposalFormAction(proposalId, manualForm())).error,
    ).toBeTruthy();
    expect(saveRpc).not.toHaveBeenCalled();
    expect(inserts).toHaveBeenCalledTimes(1);
  },
);
it.each(["summary", "scope", "lines"])(
  "rejects Ready with missing %s without overwriting the saved Draft",
  async (missing) => {
    await submit();
    addCatalogService();
    const before = structuredClone(rows.proposals[0]);
    const form = manualForm();
    form.set("status", "ready");
    form.set("summary", "Manual summary");
    form.set("scope", "Manual scope");
    if (missing === "lines") form.delete("opportunityId");
    else form.set(missing, "");
    expect((await saveProposalFormAction(proposalId, form)).error).toBeTruthy();
    expect(saveRpc).not.toHaveBeenCalled();
    expect(rows.proposals[0]).toEqual(before);
  },
);
