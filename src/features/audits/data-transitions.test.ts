import { beforeEach, expect, it, vi } from "vitest";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { markAuditRunning, markAuditCompleted, markAuditFailed } from "./data";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: vi.fn() }));

type Row = { id: string; agency_id: string; status: string };
let row: Row;
let filters: [string, string][];
beforeEach(() => {
  row = { id: "audit", agency_id: "own", status: "pending" };
  filters = [];
  vi.mocked(createSupabaseAdminClient).mockImplementation(() => ({
    from: () => ({ update: (values: Partial<Row>) => {
      const chain = {
        eq: (key: string, value: string) => { filters.push([key, value]); return chain; },
        select: () => chain,
        single: async () => {
          if (!filters.every(([key, value]) => row[key as keyof Row] === value)) return { data: null, error: { code: "PGRST116" } };
          Object.assign(row, values);
          return { data: row, error: null };
        },
      };
      return chain;
    } }),
  } as unknown as ReturnType<typeof createSupabaseAdminClient>));
});

it("uses agency-scoped pending-to-running-to-completed transitions and refuses a late failure", async () => {
  await markAuditRunning("audit", "own");
  expect(filters).toContainEqual(["status", "pending"]);
  filters = [];
  await markAuditCompleted({ auditId: "audit", agencyId: "own", finalUrl: "https://example.com", normalizedSignals: {}, signalSchemaVersion: "2.0.0" });
  expect(filters).toContainEqual(["status", "running"]);
  filters = [];
  await expect(markAuditFailed({ auditId: "audit", agencyId: "own", errorCode: "FAILED", errorMessage: "Failed" })).rejects.toThrow();
  expect(row.status).toBe("completed");
});

it("prevents a second claim and cross-tenant transitions", async () => {
  await expect(markAuditRunning("audit", "other")).rejects.toThrow();
  expect(row.status).toBe("pending");
  filters = [];
  await markAuditRunning("audit", "own");
  filters = [];
  await expect(markAuditRunning("audit", "own")).rejects.toThrow();
  expect(row.status).toBe("running");
});
