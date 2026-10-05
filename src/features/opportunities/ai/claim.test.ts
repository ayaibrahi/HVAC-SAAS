import { describe, expect, it, vi } from "vitest";
import { claimOpportunityAiInsightGeneration } from "@/features/opportunities/ai/data";
import type { OpportunityAiProvider } from "@/features/opportunities/ai/types";
import type { Database } from "@/lib/supabase/database.types";

vi.mock("server-only", () => ({}));

type AiInsightRow =
  Database["public"]["Tables"]["opportunity_ai_insights"]["Row"];
type AiInsightInsert =
  Database["public"]["Tables"]["opportunity_ai_insights"]["Insert"];
type AiInsightUpdate =
  Database["public"]["Tables"]["opportunity_ai_insights"]["Update"];

const metadata = {
  provider: "test",
  model: "test-model",
  promptVersion: "v1",
  schemaVersion: "1.0.0",
};

const provider: OpportunityAiProvider = {
  metadata,
  generateOpportunityInsight: async () => ({}),
};

describe("claimOpportunityAiInsightGeneration", () => {
  it("allows only one simultaneous generation claim for a new opportunity", async () => {
    const store = createFakeInsightStore();
    const claims = await Promise.all([
      claimOpportunityAiInsightGeneration({
        agencyId: "agency-1",
        opportunityId: "opportunity-1",
        provider,
        admin: store.admin,
        now: () => Date.parse("2026-09-24T00:00:30.000Z"),
        staleAfterMs: 10 * 60 * 1000,
      }),
      claimOpportunityAiInsightGeneration({
        agencyId: "agency-1",
        opportunityId: "opportunity-1",
        provider,
        admin: store.admin,
        now: () => Date.parse("2026-09-24T00:00:30.000Z"),
        staleAfterMs: 10 * 60 * 1000,
      }),
    ]);
    let providerCalls = 0;

    for (const claim of claims) {
      if (claim) {
        providerCalls += 1;
      }
    }

    expect(claims.filter(Boolean)).toHaveLength(1);
    expect(providerCalls).toBe(1);
    expect(store.get("opportunity-1")?.status).toBe("generating");
  });

  it("preserves existing completed content while claiming regeneration", async () => {
    const existing = makeCompletedRow();
    const store = createFakeInsightStore(existing);

    const claim = await claimOpportunityAiInsightGeneration({
      agencyId: existing.agency_id,
      opportunityId: existing.opportunity_id,
      provider,
      admin: store.admin,
    });

    expect(claim).toMatchObject({
      status: "generating",
      salesSummary: "Previous summary",
      recommendedNextStep: "Previous next step",
    });
    expect(store.get(existing.opportunity_id)).toMatchObject({
      status: "generating",
      sales_summary: "Previous summary",
      recommended_next_step: "Previous next step",
    });
  });

  it("rejects a duplicate claim while generation is fresh", async () => {
    const existing = makeGeneratingRow({
      updated_at: "2026-09-24T00:05:00.000Z",
    });
    const store = createFakeInsightStore(existing);

    const claim = await claimOpportunityAiInsightGeneration({
      agencyId: existing.agency_id,
      opportunityId: existing.opportunity_id,
      provider,
      admin: store.admin,
      now: () => Date.parse("2026-09-24T00:10:00.000Z"),
      staleAfterMs: 10 * 60 * 1000,
    });

    expect(claim).toBeNull();
    expect(store.get(existing.opportunity_id)).toMatchObject({
      status: "generating",
      updated_at: "2026-09-24T00:05:00.000Z",
    });
  });

  it("reclaims a stale generation claim while preserving previous successful content", async () => {
    const existing = makeGeneratingRow({
      updated_at: "2026-09-24T00:00:00.000Z",
    });
    const store = createFakeInsightStore(existing);

    const claim = await claimOpportunityAiInsightGeneration({
      agencyId: existing.agency_id,
      opportunityId: existing.opportunity_id,
      provider,
      admin: store.admin,
      now: () => Date.parse("2026-09-24T00:30:00.000Z"),
      staleAfterMs: 10 * 60 * 1000,
    });

    expect(claim).toMatchObject({
      status: "generating",
      salesSummary: "Previous summary",
      recommendedNextStep: "Previous next step",
    });
    expect(store.get(existing.opportunity_id)).toMatchObject({
      status: "generating",
      sales_summary: "Previous summary",
      recommended_next_step: "Previous next step",
      updated_at: "2026-09-24T00:00:01.000Z",
    });
  });
});

function createFakeInsightStore(initialRow?: AiInsightRow) {
  const rows = new Map<string, AiInsightRow>();

  if (initialRow) {
    rows.set(initialRow.opportunity_id, initialRow);
  }

  return {
    admin: {
      from(table: string) {
        expect(table).toBe("opportunity_ai_insights");

        return new FakeInsightQuery(rows);
      },
    } as unknown as Parameters<
      typeof claimOpportunityAiInsightGeneration
    >[0]["admin"],
    get(opportunityId: string) {
      return rows.get(opportunityId);
    },
  };
}

class FakeInsightQuery {
  private insertRow: AiInsightInsert | null = null;
  private updatePatch: AiInsightUpdate | null = null;
  private agencyId: string | null = null;
  private opportunityId: string | null = null;
  private blockedStatus: string | null = null;
  private requiredStatus: string | null = null;
  private updatedBefore: string | null = null;

  constructor(private readonly rows: Map<string, AiInsightRow>) {}

  insert(row: AiInsightInsert) {
    this.insertRow = row;
    return this;
  }

  update(patch: AiInsightUpdate) {
    this.updatePatch = patch;
    return this;
  }

  eq(field: string, value: string) {
    if (field === "agency_id") {
      this.agencyId = value;
    }

    if (field === "opportunity_id") {
      this.opportunityId = value;
    }

    if (field === "status") {
      this.requiredStatus = value;
    }

    return this;
  }

  neq(field: string, value: string) {
    if (field === "status") {
      this.blockedStatus = value;
    }

    return this;
  }

  lt(field: string, value: string) {
    if (field === "updated_at") {
      this.updatedBefore = value;
    }

    return this;
  }

  select() {
    return this;
  }

  async maybeSingle() {
    if (this.insertRow) {
      return this.insertInsight();
    }

    if (this.updatePatch) {
      return this.updateInsight();
    }

    return { data: null, error: null };
  }

  private insertInsight() {
    const opportunityId = this.insertRow?.opportunity_id;

    if (!this.insertRow || !opportunityId) {
      return { data: null, error: null };
    }

    if (this.rows.has(opportunityId)) {
      return {
        data: null,
        error: { code: "23505", message: "duplicate key value" },
      };
    }

    const now = "2026-09-24T00:00:00.000Z";
    const row: AiInsightRow = {
      id: `insight-${this.rows.size + 1}`,
      created_at: now,
      updated_at: now,
      sales_summary: null,
      why_it_matters: null,
      client_facing_explanation: null,
      agency_talking_points: [],
      recommended_next_step: null,
      error_message: null,
      ...this.insertRow,
      status: this.insertRow.status ?? "generating",
    };

    this.rows.set(opportunityId, row);

    return { data: row, error: null };
  }

  private updateInsight() {
    if (!this.opportunityId || !this.updatePatch) {
      return { data: null, error: null };
    }

    const row = this.rows.get(this.opportunityId);

    if (
      !row ||
      row.agency_id !== this.agencyId ||
      row.status === this.blockedStatus ||
      (this.requiredStatus !== null && row.status !== this.requiredStatus) ||
      (this.updatedBefore !== null && row.updated_at >= this.updatedBefore)
    ) {
      return { data: null, error: null };
    }

    const updatedRow: AiInsightRow = {
      ...row,
      ...this.updatePatch,
      updated_at: "2026-09-24T00:00:01.000Z",
    };

    this.rows.set(this.opportunityId, updatedRow);

    return { data: updatedRow, error: null };
  }
}

function makeCompletedRow(): AiInsightRow {
  return {
    id: "insight-1",
    agency_id: "agency-1",
    opportunity_id: "opportunity-1",
    status: "completed",
    model_provider: "test",
    model_name: "test-model",
    prompt_version: "v1",
    schema_version: "1.0.0",
    sales_summary: "Previous summary",
    why_it_matters: "Previous relevance",
    client_facing_explanation: "Previous client explanation",
    agency_talking_points: ["One", "Two"],
    recommended_next_step: "Previous next step",
    error_message: null,
    created_at: "2026-09-24T00:00:00.000Z",
    updated_at: "2026-09-24T00:00:00.000Z",
  };
}

function makeGeneratingRow(overrides: Partial<AiInsightRow> = {}): AiInsightRow {
  return {
    ...makeCompletedRow(),
    status: "generating",
    ...overrides,
  };
}
