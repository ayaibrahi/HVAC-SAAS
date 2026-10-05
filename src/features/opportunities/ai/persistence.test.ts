import { describe, expect, it } from "vitest";
import {
  createCompletedInsightUpdate,
  createFailedInsightUpdate,
  createGeneratingInsightUpdate,
  createGeneratingInsightRow,
} from "@/features/opportunities/ai/persistence";
import { makeOpportunityAiInsight } from "@/features/opportunities/ai/test-fixtures";

const metadata = {
  provider: "test",
  model: "test-model",
  promptVersion: "v1",
  schemaVersion: "1.0.0",
};

describe("opportunity AI insight persistence helpers", () => {
  it("creates a stable generating row keyed by opportunity", () => {
    const row = createGeneratingInsightRow({
      agencyId: "agency-1",
      opportunityId: "opportunity-1",
      metadata,
    });

    expect(row).toMatchObject({
      agency_id: "agency-1",
      opportunity_id: "opportunity-1",
      status: "generating",
      model_provider: "test",
      model_name: "test-model",
      prompt_version: "v1",
      schema_version: "1.0.0",
    });
  });

  it("stores validated insight content without deterministic opportunity fields", () => {
    const update = createCompletedInsightUpdate({
      metadata,
      insight: makeOpportunityAiInsight(),
    });

    expect(update.status).toBe("completed");
    expect(update.sales_summary).toContain("analyzed page");
    expect(update).not.toHaveProperty("priority");
    expect(update).not.toHaveProperty("confidence");
    expect(update).not.toHaveProperty("score");
    expect(update).not.toHaveProperty("evidence");
  });

  it("records failed generation separately from opportunity state", () => {
    const update = createFailedInsightUpdate({
      metadata,
      errorMessage: "Provider unavailable.",
    });

    expect(update).toMatchObject({
      status: "failed",
      error_message: "Provider unavailable.",
    });
    expect(update).not.toHaveProperty("sales_summary");
    expect(update).not.toHaveProperty("why_it_matters");
    expect(update).not.toHaveProperty("client_facing_explanation");
    expect(update).not.toHaveProperty("recommended_next_step");
    expect(update).not.toHaveProperty("audit_status");
    expect(update).not.toHaveProperty("opportunity_status");
  });

  it("preserves the previous completed insight during failed regeneration", () => {
    const previousInsight = {
      status: "completed",
      sales_summary: "Previous summary",
      why_it_matters: "Previous relevance",
      client_facing_explanation: "Previous client text",
      agency_talking_points: ["One", "Two"],
      recommended_next_step: "Previous next step",
      error_message: null,
    };
    const generating = {
      ...previousInsight,
      ...createGeneratingInsightUpdate({ metadata }),
    };
    const failed = {
      ...generating,
      ...createFailedInsightUpdate({
        metadata,
        errorMessage: "Provider unavailable.",
      }),
    };

    expect(generating).toMatchObject({
      status: "generating",
      sales_summary: "Previous summary",
      recommended_next_step: "Previous next step",
    });
    expect(failed).toMatchObject({
      status: "failed",
      sales_summary: "Previous summary",
      why_it_matters: "Previous relevance",
      client_facing_explanation: "Previous client text",
      agency_talking_points: ["One", "Two"],
      recommended_next_step: "Previous next step",
      error_message: "Provider unavailable.",
    });
  });
});
