import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireCurrentAgency } from "@/features/agencies/data";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/errors";
import {
  findMatchingProspect,
  getEditableProspect,
  getProspectsPage,
  getProspectWorkspace,
} from "./workspace-data";

vi.mock("server-only", () => ({}));
vi.mock("@/features/agencies/data", () => ({ requireCurrentAgency: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));
const a = "11111111-1111-4111-8111-111111111111";
const b = "22222222-2222-4222-8222-222222222222";
const timestamp = "2026-10-13T12:00:00Z";
type Row = Record<string, unknown>;
type Query = {
  table: string;
  columns: string;
  filters: [string, unknown[]][];
  limit?: number;
  range?: [number, number];
  search?: string;
  single: boolean;
};
function database(failure?: string) {
  const datasets: Record<string, Row[]> = {
    prospects: [
      {
        id: a,
        agency_id: "own",
        business_name: "Example HVAC",
        website_url: "https://example.com/",
        created_at: timestamp,
      },
      {
        id: b,
        agency_id: "other",
        business_name: "Private",
        website_url: "https://private.test/",
        created_at: timestamp,
      },
    ],
    audits: [
      {
        id: "audit",
        agency_id: "own",
        prospect_id: a,
        status: "completed",
        created_at: timestamp,
      },
      {
        id: "private-audit",
        agency_id: "other",
        prospect_id: b,
        status: "completed",
      },
    ],
    opportunities: [
      {
        id: "opportunity",
        agency_id: "own",
        prospect_id: a,
        audit_id: "audit",
        agency_service_id: "service",
        rule_key: "online_booking_missing",
        score: 90,
        evidence: [
          {
            signal: "online_booking",
            observed_value: false,
            scope: "analyzed_page",
            source: "deterministic_analyzer",
            details: "No booking detected on the analyzed page.",
          },
        ],
      },
      {
        id: "private-opportunity",
        agency_id: "other",
        prospect_id: b,
        audit_id: "private-audit",
      },
    ],
    proposals: [
      {
        id: "proposal",
        agency_id: "own",
        prospect_id: a,
        title: "Existing draft",
        status: "draft",
      },
      {
        id: "private-proposal",
        agency_id: "other",
        prospect_id: b,
        title: "Secret",
      },
    ],
    opportunity_ai_insights: [
      {
        id: "insight",
        agency_id: "own",
        opportunity_id: "opportunity",
        agency_talking_points: [],
        status: "completed",
      },
      {
        id: "private-insight",
        agency_id: "other",
        opportunity_id: "private-opportunity",
      },
    ],
    agency_services: [
      { id: "service", agency_id: "own", name: "Booking integration" },
      { id: "private-service", agency_id: "other", name: "Secret" },
    ],
  };
  const queries: Query[] = [];
  const from = vi.fn((table: string) => {
    const q: Query = { table, columns: "", filters: [], single: false };
    queries.push(q);
    const builder = {
      select(columns: string) {
        q.columns = columns;
        return builder;
      },
      eq(column: string, value: unknown) {
        q.filters.push([column, [value]]);
        return builder;
      },
      in(column: string, values: unknown[]) {
        q.filters.push([column, values]);
        return builder;
      },
      order() {
        return builder;
      },
      limit(limit: number) {
        q.limit = limit;
        return builder;
      },
      range(start: number, end: number) {
        q.range = [start, end];
        return builder;
      },
      or(search: string) {
        q.search = search;
        return builder;
      },
      maybeSingle() {
        q.single = true;
        return builder;
      },
      then(resolve: (value: unknown) => unknown) {
        let data = datasets[table].filter((row) =>
          q.filters.every(([column, values]) => values.includes(row[column])),
        );
        if (q.range) data = data.slice(q.range[0], q.range[1] + 1);
        if (q.limit) data = data.slice(0, q.limit);
        return Promise.resolve(
          resolve({
            data: q.single ? (data[0] ?? null) : data,
            error:
              table === failure
                ? { message: "private database internals" }
                : null,
          }),
        );
      },
    };
    return builder;
  });
  const supabase = { from } as unknown as Awaited<
    ReturnType<typeof createSupabaseServerClient>
  >;
  vi.mocked(createSupabaseServerClient).mockResolvedValue(supabase);
  vi.mocked(requireCurrentAgency).mockResolvedValue({
    supabase,
    agency: { id: "own" },
    user: { id: "user" },
  } as Awaited<ReturnType<typeof requireCurrentAgency>>);
  return { datasets, queries, from };
}
beforeEach(() => vi.clearAllMocks());
describe("tenant-scoped bounded prospect reads", () => {
  it("marks legacy scans unverified without hiding or modifying saved findings", async () => {
    const { datasets, queries } = database(),
      before = JSON.stringify(datasets);
    const result = await getProspectWorkspace(a);
    expect(result?.scan?.verification).toBe("unverified");
    expect(result?.opportunities).toHaveLength(1);
    expect(JSON.stringify(datasets)).toBe(before);
    expect(queries.find((q) => q.table === "audits")?.columns).toContain(
      "quality:normalized_signals->quality",
    );
  });
  it("accepts valid versioned quality and rejects inconsistent sufficient metadata", async () => {
    const { datasets } = database();
    datasets.audits[0].quality = {
      version: 1,
      status: "sufficient",
      reasons: [],
      visibleCharacters: 1000,
    };
    expect((await getProspectWorkspace(a))?.scan?.verification).toBe(
      "verified",
    );
    datasets.audits[0].quality = {
      version: 1,
      status: "sufficient",
      reasons: ["challenge"],
      visibleCharacters: 1000,
    };
    expect((await getProspectWorkspace(a))?.scan?.verification).toBe(
      "unverified",
    );
  });
  it("shows unverified status for new content-quality failures and loads no findings", async () => {
    const { datasets, queries } = database();
    datasets.audits[0].status = "failed";
    datasets.audits[0].error_code = "CONTENT_NOT_VERIFIABLE";
    expect((await getProspectWorkspace(a))?.scan?.verification).toBe(
      "unverified",
    );
    expect(queries.some((q) => q.table === "opportunities")).toBe(false);
  });
  it("reads only the current agency and caps scan lookups to the visible 12", async () => {
    const { datasets, queries } = database();
    datasets.prospects.push(
      ...Array.from({ length: 20 }, (_, index) => ({
        ...datasets.prospects[0],
        id: "own-" + index,
      })),
    );
    const page = await getProspectsPage({});
    expect(page.items).toHaveLength(12);
    expect(page.hasNext).toBe(true);
    expect(queries[0].range).toEqual([0, 12]);
    expect(queries.filter((q) => q.table === "audits")).toHaveLength(12);
    for (const q of queries)
      expect(q.filters).toContainEqual(["agency_id", ["own"]]);
    expect(page.items.some((row) => row.id === b)).toBe(false);
    expect(
      queries
        .filter((q) => q.table === "audits")
        .every((q) => q.limit === 1 && !q.columns.includes("*")),
    ).toBe(true);
  });
  it("retains agency filtering independently of search OR and uses page offsets", async () => {
    const { queries } = database();
    await getProspectsPage({ q: 'x"),agency_id.neq.own', page: "2" });
    expect(queries[0].filters).toEqual([["agency_id", ["own"]]]);
    expect(queries[0].range).toEqual([12, 24]);
    expect(queries[0].search).toContain('business_name.ilike."%x\\"');
  });
  it("returns a genuine empty list", async () => {
    const { datasets, queries } = database();
    datasets.prospects = [];
    expect((await getProspectsPage({})).items).toEqual([]);
    expect(queries).toHaveLength(1);
  });
  it("does not reveal another agency's duplicate record", async () => {
    database();
    expect(await findMatchingProspect("https://private.test/")).toBeNull();
    expect(await findMatchingProspect("https://example.com/")).toEqual({
      id: a,
      name: "Example HVAC",
    });
  });
  it.each([b, "33333333-3333-4333-8333-333333333333", "../bad"])(
    "denies inaccessible or malformed %s before loading related data",
    async (id) => {
      const { queries } = database();
      expect(await getProspectWorkspace(id)).toBeNull();
      expect(await getEditableProspect(id)).toBeNull();
      expect(queries.every((q) => q.table === "prospects")).toBe(true);
    },
  );
  it("loads only the owned latest scan and matching opportunities, insights, services and proposal links", async () => {
    const { queries } = database();
    const data = await getProspectWorkspace(a);
    expect(data?.prospect.id).toBe(a);
    expect(data?.opportunities.map((o) => o.id)).toEqual(["opportunity"]);
    expect(data?.insights.map((o) => o.id)).toEqual(["insight"]);
    expect(data?.services).toEqual([
      expect.objectContaining({ id: "service" }),
    ]);
    expect(data?.proposals.map((p) => p.id)).toEqual(["proposal"]);
    for (const q of queries)
      expect(q.filters).toContainEqual(["agency_id", ["own"]]);
    for (const q of queries.filter((q) =>
      [
        "proposals",
        "opportunities",
        "agency_services",
        "opportunity_ai_insights",
      ].includes(q.table),
    ))
      expect(q.limit).toBe(5);
    expect(queries.find((q) => q.table === "opportunities")?.filters).toEqual([
      ["agency_id", ["own"]],
      ["prospect_id", [a]],
      ["audit_id", ["audit"]],
    ]);
  });
  it.each(["pending", "running", "failed"])(
    "does not load findings from a %s scan",
    async (status) => {
      const { datasets, queries } = database();
      datasets.audits[0].status = status;
      expect((await getProspectWorkspace(a))?.opportunities).toEqual([]);
      expect(queries.some((q) => q.table === "opportunities")).toBe(false);
    },
  );
  it("fails closed on authentication errors", async () => {
    const { from } = database();
    vi.mocked(requireCurrentAgency).mockRejectedValue(
      new AppError("Sign in", 401),
    );
    await expect(getProspectsPage({})).rejects.toMatchObject({
      statusCode: 401,
    });
    expect(from).not.toHaveBeenCalled();
  });
  it("returns controlled errors without database internals", async () => {
    database("prospects");
    await expect(getProspectsPage({})).rejects.toThrow(
      "We could not load your prospects.",
    );
  });
});
