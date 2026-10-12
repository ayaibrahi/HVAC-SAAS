import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDashboardOverview } from "@/features/dashboard/data";
import { requireCurrentAgency } from "@/features/agencies/data";

vi.mock("server-only", () => ({}));
vi.mock("@/features/agencies/data", () => ({ requireCurrentAgency: vi.fn() }));

type Row = Record<string, string>;
type Query = {
  table: string;
  columns: string;
  head: boolean;
  count?: string;
  filters: [string, string[]][];
  orders: [string, boolean][];
  limit?: number;
};
const timestamp = "2026-10-10T12:00:00Z";
const rows: Record<string, Row[]> = {
  prospects: [
    {
      id: "p-a",
      agency_id: "agency-a",
      business_name: "Test HVAC",
      website_url: "https://example.test",
      created_at: timestamp,
    },
    {
      id: "p-b",
      agency_id: "agency-b",
      business_name: "Private tenant",
      created_at: timestamp,
    },
  ],
  audits: ["completed", "running", "failed"]
    .map((status, i) => ({
      id: `audit-${i}`,
      agency_id: "agency-a",
      status,
      prospect_id: "p-a",
      website_url: "https://example.test",
      created_at: timestamp,
    }))
    .concat([
      {
        id: "audit-b",
        agency_id: "agency-b",
        status: "completed",
        prospect_id: "p-b",
        website_url: "https://private.test",
        created_at: timestamp,
      },
    ]),
  opportunities: ["open", "selected", "dismissed"]
    .map((status, i) => ({ id: `o-${i}`, agency_id: "agency-a", status }))
    .concat([{ id: "o-b", agency_id: "agency-b", status: "open" }]),
  proposals: [
    {
      id: "proposal-a",
      agency_id: "agency-a",
      title: "Test proposal",
      status: "draft",
      updated_at: timestamp,
    },
    {
      id: "proposal-b",
      agency_id: "agency-b",
      title: "Private proposal",
      status: "ready",
      updated_at: timestamp,
    },
  ],
};

function mockDatabase(
  dataset = rows,
  failureTable?: string,
  missingCount = false,
) {
  const queries: Query[] = [];
  const from = vi.fn((table: string) => {
    const query: Query = {
      table,
      columns: "",
      head: false,
      filters: [],
      orders: [],
    };
    queries.push(query);
    const builder = {
      select(columns: string, options?: { head?: boolean; count?: string }) {
        query.columns = columns;
        query.head = !!options?.head;
        query.count = options?.count;
        return builder;
      },
      eq(column: string, value: string) {
        query.filters.push([column, [value]]);
        return builder;
      },
      in(column: string, values: string[]) {
        query.filters.push([column, values]);
        return builder;
      },
      order(column: string, options: { ascending: boolean }) {
        query.orders.push([column, options.ascending]);
        return builder;
      },
      limit(limit: number) {
        query.limit = limit;
        return builder;
      },
      then(resolve: (value: unknown) => unknown) {
        const filtered = (dataset[table] ?? []).filter((row) =>
          query.filters.every(([column, values]) =>
            values.includes(row[column]),
          ),
        );
        return Promise.resolve(
          resolve({
            data: query.head
              ? null
              : filtered
                  .slice(0, query.limit)
                  .map((row) =>
                    Object.fromEntries(
                      query.columns.split(",").map((key) => [key, row[key]]),
                    ),
                  ),
            count: query.head && !missingCount ? filtered.length : null,
            error:
              table === failureTable
                ? { message: "private database internal" }
                : null,
          }),
        );
      },
    };
    return builder;
  });
  vi.mocked(requireCurrentAgency).mockResolvedValue({
    agency: { id: "agency-a" },
    supabase: { from },
  } as unknown as Awaited<ReturnType<typeof requireCurrentAgency>>);
  return { from, queries };
}

beforeEach(() => vi.resetAllMocks());

describe("tenant-scoped dashboard overview", () => {
  it("counts the correct states and excludes another tenant's records", async () => {
    mockDatabase();
    const overview = await getDashboardOverview();
    expect(overview.counts).toEqual({
      prospects: 1,
      completedAudits: 1,
      opportunities: 2,
      proposals: 1,
    });
    expect(overview.recentProspects[0].business_name).toBe("Test HVAC");
    expect(overview.recentAudits).toHaveLength(3);
    expect(overview.recentProposals[0].title).toBe("Test proposal");
    expect(JSON.stringify(overview)).not.toMatch(/Private|private\.test/);
  });

  it("scopes every query to the session agency and bounds all returned records", async () => {
    const { queries } = mockDatabase();
    await getDashboardOverview();
    expect(requireCurrentAgency).toHaveBeenCalledExactlyOnceWith();
    expect(queries).toHaveLength(7);
    for (const query of queries) {
      expect(query.filters).toContainEqual(["agency_id", ["agency-a"]]);
      expect(query.columns).not.toContain("*");
      if (query.head) {
        expect(query.count).toBe("exact");
        expect(query.columns).toBe("id");
      } else {
        expect(query.limit).toBe(5);
        expect(query.orders).toEqual([
          [query.table === "proposals" ? "updated_at" : "created_at", false],
          ["id", false],
        ]);
        expect(query.columns).not.toMatch(
          /notes|signals|evidence|summary|scope|email/,
        );
      }
    }
  });

  it("returns full counts but at most five records per activity list", async () => {
    const large = Object.fromEntries(
      Object.entries(rows).map(([table, list]) => [
        table,
        Array.from({ length: 30 }, (_, i) => ({
          ...list[0],
          id: `record-${i}`,
        })),
      ]),
    );
    mockDatabase(large);
    const overview = await getDashboardOverview();
    expect(overview.counts.prospects).toBe(30);
    expect(overview.recentProspects).toHaveLength(5);
    expect(overview.recentAudits).toHaveLength(5);
    expect(overview.recentProposals).toHaveLength(5);
  });

  it("returns zeros and empty lists for a new agency", async () => {
    mockDatabase({});
    expect(await getDashboardOverview()).toEqual({
      counts: {
        prospects: 0,
        completedAudits: 0,
        opportunities: 0,
        proposals: 0,
      },
      recentProspects: [],
      recentAudits: [],
      recentProposals: [],
    });
  });

  it("stops all reads when authentication or agency access fails", async () => {
    const { from } = mockDatabase();
    vi.mocked(requireCurrentAgency).mockRejectedValue(
      new Error("Access denied"),
    );
    await expect(getDashboardOverview()).rejects.toThrow("Access denied");
    expect(from).not.toHaveBeenCalled();
  });

  it.each(["prospects", "audits", "opportunities", "proposals"])(
    "rejects %s failures without database details or fabricated totals",
    async (table) => {
      mockDatabase(rows, table);
      await expect(getDashboardOverview()).rejects.toThrow(
        "We could not load your workspace overview. Please try again.",
      );
    },
  );

  it("does not silently replace a missing count with zero", async () => {
    mockDatabase(rows, undefined, true);
    await expect(getDashboardOverview()).rejects.toThrow(
      "We could not load your workspace overview.",
    );
  });
});
