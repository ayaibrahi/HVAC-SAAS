import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  createProposalLineItemPayload,
  type PreparedLine,
} from "@/features/proposals/data";

vi.mock("server-only", () => ({}));

describe("proposal draft persistence payload", () => {
  it("uses server-derived opportunity, service, AI, and pricing values", () => {
    const payload = createProposalLineItemPayload([
      makePreparedLine({
        unitPriceCents: 123456,
        lineTotalCents: 246912,
      }),
    ]);

    expect(payload).toEqual([
      expect.objectContaining({
        opportunity_id: "opportunity-1",
        agency_service_id: "service-1",
        opportunity_title: "Missing Online Booking",
        service_name: "Online Booking Integration",
        ai_sales_summary: "Page lacks a clear booking path.",
        unit_price: 1234.56,
        line_total: 2469.12,
      }),
    ]);
  });
});

describe("save_proposal_draft migration", () => {
  const migrationSql = readFileSync(
    join(
      process.cwd(),
      "supabase/migrations/202609260001_mvp_hardening_phase_1.sql",
    ),
    "utf8",
  ).toLowerCase();

  it("saves proposal drafts inside a narrowly scoped service-role RPC", () => {
    expect(migrationSql).toContain(
      "create or replace function public.save_proposal_draft",
    );
    expect(migrationSql).toContain("security definer");
    expect(migrationSql).toContain("for update;");
    expect(migrationSql).toContain("agency_user_not_authorized");
    expect(migrationSql).toContain("jsonb_to_recordset(p_line_items)");
    expect(migrationSql).toContain("proposal_subtotal_mismatch");
    expect(migrationSql).toContain("proposal_total_mismatch");
    expect(migrationSql).toContain("invalid_proposal_line_item");
    expect(migrationSql).toContain(
      "grant execute on function public.save_proposal_draft",
    );
    expect(migrationSql).toContain("to service_role");
    expect(migrationSql).toContain(
      "revoke all on function public.save_proposal_draft",
    );
    expect(migrationSql).toContain("from authenticated");
  });

  it("covers the proposal header, relationships, line items, and totals together", () => {
    expect(migrationSql).toContain("delete from public.proposal_line_items");
    expect(migrationSql).toContain("delete from public.proposal_opportunities");
    expect(migrationSql).toContain("insert into public.proposal_opportunities");
    expect(migrationSql).toContain("insert into public.proposal_line_items");
    expect(migrationSql).toContain("update public.proposals");
    expect(migrationSql).toContain("subtotal_amount = round(p_subtotal_amount, 2)");
    expect(migrationSql).toContain("total_amount = round(p_total_amount, 2)");
  });
});

function makePreparedLine(
  overrides: Partial<PreparedLine> = {},
): PreparedLine {
  return {
    opportunity: {
      id: "opportunity-1",
      agencyId: "agency-1",
      auditId: "audit-1",
      prospectId: "prospect-1",
      agencyServiceId: "service-1",
      verticalKey: "hvac",
      playbookVersion: "1.0.0",
      ruleKey: "missing_online_booking",
      title: "Missing Online Booking",
      shortDescription: "Booking was not detected on the analyzed page.",
      businessImpact: "Lead capture",
      evidence: [],
      priority: "high",
      confidence: "high",
      recommendedServiceCategory: "Online Booking Integration",
      score: 90,
      rankingRationale: "Deterministic ranking.",
      status: "open",
      createdAt: "2026-09-26T00:00:00.000Z",
      updatedAt: "2026-09-26T00:00:00.000Z",
    },
    service: {
      id: "service-1",
      agencyId: "agency-1",
      name: "Online Booking Integration",
      description: "Connect booking tools.",
      price: 1200,
      currency: "USD",
      isActive: true,
      createdAt: "2026-09-26T00:00:00.000Z",
      updatedAt: "2026-09-26T00:00:00.000Z",
    },
    position: 0,
    description: "Connect booking tools.",
    quantity: 2,
    unitPriceCents: 120000,
    lineTotalCents: 240000,
    aiInsight: {
      id: "insight-1",
      agencyId: "agency-1",
      opportunityId: "opportunity-1",
      status: "completed",
      modelProvider: "test",
      modelName: "test-model",
      promptVersion: "v1",
      schemaVersion: "1.0.0",
      salesSummary: "Page lacks a clear booking path.",
      whyItMatters: "Booking friction can affect lead capture.",
      clientFacingExplanation:
        "The analyzed page did not show a direct booking option.",
      agencyTalkingPoints: ["One", "Two"],
      recommendedNextStep: "Review booking placement.",
      errorMessage: null,
      createdAt: "2026-09-26T00:00:00.000Z",
      updatedAt: "2026-09-26T00:00:00.000Z",
    },
    ...overrides,
  };
}
