import { beforeEach, describe, expect, it, vi } from "vitest";
import { runProposalEditorWorkflow } from "./editor-workflow";
import { makeCompleteProposalBuilder } from "./ai/complete-test-fixtures";
import { getCompleteProposalRevision } from "./ai/complete-revision";
import { createCompleteProposalInput } from "./ai/complete-input";
import { firstProposalCopy, buildProposalCopyOptions } from "./sales-content";
import {
  getProposalBuilderData,
  updateProposalDraft,
  claimCompleteProposalGeneration,
  releaseCompleteProposalGeneration,
  applyProposalAiDraft,
} from "./data";
import { createDeliverySnapshotForProposal } from "./delivery/data";
import { createProposalAiProvider } from "./ai/provider";
import { requireCurrentAgency } from "@/features/agencies/data";
import { enforceAgencyUsageLimit } from "@/features/usage/limits";
import type { UpdateProposalInput } from "@/lib/validation/proposals";
import { AppError } from "@/lib/errors";

vi.mock("server-only", () => ({}));
vi.mock("./data", () => ({
  getProposalBuilderData: vi.fn(),
  updateProposalDraft: vi.fn(),
  claimCompleteProposalGeneration: vi.fn(),
  releaseCompleteProposalGeneration: vi.fn(),
  applyProposalAiDraft: vi.fn(),
}));
vi.mock("./delivery/data", () => ({
  createDeliverySnapshotForProposal: vi.fn(),
}));
vi.mock("./ai/provider", () => ({ createProposalAiProvider: vi.fn() }));
vi.mock("@/features/agencies/data", () => ({ requireCurrentAgency: vi.fn() }));
vi.mock("@/features/usage/limits", () => ({
  enforceAgencyUsageLimit: vi.fn(),
}));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), error: vi.fn() } }));
let data: ReturnType<typeof makeCompleteProposalBuilder>;
const calls: string[] = [];
const generate = vi.fn();
function input(status: "ready" | "draft" = "draft"): UpdateProposalInput {
  const line = [...data.lineItemsByOpportunityId.values()][0];
  return {
    proposalId: data.proposal.id,
    title: "Current edited title",
    summary: status === "ready" ? "Reviewed summary" : "",
    scope: status === "ready" ? "Reviewed scope" : "",
    nextStep: "",
    status,
    currency: "USD",
    discountType: "none",
    discountValue: "0",
    lineItems: [
      {
        opportunityId: line.opportunityId,
        agencyServiceId: line.agencyServiceId,
        unitPrice: "575",
        quantity: 1,
        description: data.services[0].approvedScope!.deliverables,
      },
    ],
  };
}
beforeEach(() => {
  vi.resetAllMocks();
  calls.length = 0;
  data = makeCompleteProposalBuilder();
  vi.mocked(getProposalBuilderData).mockImplementation(async () =>
    structuredClone(data),
  );
  vi.mocked(requireCurrentAgency).mockResolvedValue({
    agency: data.agency,
    user: { id: "test-user" },
  } as Awaited<ReturnType<typeof requireCurrentAgency>>);
  vi.mocked(updateProposalDraft).mockImplementation(async (submitted) => {
    calls.push("save");
    Object.assign(data.proposal, {
      ...submitted,
      total: 575,
      subtotal: 575,
      updatedAt: "saved-revision",
    });
    const line = [...data.lineItemsByOpportunityId.values()][0];
    Object.assign(line, submitted.lineItems[0], {
      unitPrice: 575,
      lineTotal: 575,
    });
    return structuredClone(data.proposal);
  });
  vi.mocked(claimCompleteProposalGeneration).mockImplementation(async () => {
    data.proposal.updatedAt = "lease-revision";
    return {
      token: "99999999-9999-4999-8999-999999999999",
      updatedAt: data.proposal.updatedAt,
    };
  });
  generate.mockImplementation(async () => {
    calls.push("generate");
    return firstProposalCopy(
      buildProposalCopyOptions(createCompleteProposalInput(data)),
    );
  });
  vi.mocked(createProposalAiProvider).mockReturnValue({
    metadata: {
      provider: "groq",
      model: "mock",
      promptVersion: "test",
      schemaVersion: "1",
    },
    generateProposalDraft: generate,
  });
  vi.mocked(createDeliverySnapshotForProposal).mockImplementation(async () => {
    calls.push("snapshot");
    return {} as Awaited<ReturnType<typeof createDeliverySnapshotForProposal>>;
  });
});

describe("one-click editor orchestration with real scope/AI validation and fixture persistence", () => {
  it("saves current manual price and approved line scope before one validated AI request", async () => {
    await runProposalEditorWorkflow(
      input(),
      getCompleteProposalRevision(data),
      "generate",
    );
    expect(calls).toEqual(["save", "generate"]);
    expect(data.proposal.total).toBe(575);
    expect(data.proposal.status).toBe("draft");
    expect(applyProposalAiDraft).toHaveBeenCalledOnce();
    expect(createDeliverySnapshotForProposal).not.toHaveBeenCalled();
    expect(releaseCompleteProposalGeneration).toHaveBeenCalledOnce();
  });
  it.each(["missingScope", "unrelatedScope", "unapprovedLineScope"])(
    "rejects %s before a provider request",
    async (kind) => {
      const submitted = input();
      if (kind === "missingScope") data.services[0].approvedScope = null;
      if (kind === "unrelatedScope")
        data.services[0].approvedScope!.deliverables = "Design a logo.";
      if (kind === "unapprovedLineScope")
        submitted.lineItems[0].description = "Add unapproved new software.";
      await expect(
        runProposalEditorWorkflow(
          submitted,
          getCompleteProposalRevision(data),
          "generate",
        ),
      ).rejects.toThrow("saved as Draft");
      expect(generate).not.toHaveBeenCalled();
      expect(enforceAgencyUsageLimit).not.toHaveBeenCalled();
    },
  );
  it("rejects stale catalog approval before any save", async () => {
    const revision = getCompleteProposalRevision(data);
    data.services[0].approvedScope!.deliverables = "Changed scope";
    await expect(
      runProposalEditorWorkflow(input(), revision, "generate"),
    ).rejects.toThrow("No changes were saved");
    expect(updateProposalDraft).not.toHaveBeenCalled();
    expect(generate).not.toHaveBeenCalled();
  });
  it.each(["saved", "unsaved"])(
    "preserves %s narrative instead of replacing it",
    async (kind) => {
      const submitted = input();
      if (kind === "saved") {
        data.proposal.summary = "Human text";
        submitted.summary = "Human text";
      } else submitted.scope = "Human scope";
      await runProposalEditorWorkflow(
        submitted,
        getCompleteProposalRevision(data),
        "generate",
      );
      expect(generate).toHaveBeenCalledOnce();
      expect(applyProposalAiDraft).toHaveBeenCalledWith(
        expect.objectContaining({
          fillEmptyOnly: true,
          generationToken: expect.any(String),
        }),
      );
      expect(data.proposal[kind === "saved" ? "summary" : "scope"]).toBe(
        kind === "saved" ? "Human text" : "Human scope",
      );
    },
  );
  it("does not call AI after a failed save", async () => {
    vi.mocked(updateProposalDraft).mockRejectedValueOnce(
      new AppError("No save", 409),
    );
    await expect(
      runProposalEditorWorkflow(
        input(),
        getCompleteProposalRevision(data),
        "generate",
      ),
    ).rejects.toThrow("No save");
    expect(generate).not.toHaveBeenCalled();
  });
  it("rejects catalog scope changes during save before any AI request", async () => {
    const original = vi.mocked(updateProposalDraft).getMockImplementation()!;
    vi.mocked(updateProposalDraft).mockImplementationOnce(async (submitted) => {
      const saved = await original(submitted);
      data.services[0].approvedScope!.deliverables = "Unexpected revised scope";
      return saved;
    });
    await expect(
      runProposalEditorWorkflow(
        input(),
        getCompleteProposalRevision(data),
        "generate",
      ),
    ).rejects.toThrow("catalog service changed");
    expect(generate).not.toHaveBeenCalled();
  });
  it("reports generation failure after save, preserves manual scope and releases the lease", async () => {
    generate.mockRejectedValue(new Error("private provider detail"));
    const submitted = input();
    submitted.scope = "My manual scope";
    await expect(
      runProposalEditorWorkflow(
        submitted,
        getCompleteProposalRevision(data),
        "generate",
      ),
    ).rejects.toThrow("saved as Draft");
    expect(data.proposal.scope).toBe("My manual scope");
    expect(applyProposalAiDraft).not.toHaveBeenCalled();
    expect(releaseCompleteProposalGeneration).toHaveBeenCalledOnce();
    expect(createDeliverySnapshotForProposal).not.toHaveBeenCalled();
  });
  it("saves explicit Ready approval then prepares exactly that revision without AI", async () => {
    await runProposalEditorWorkflow(
      input("ready"),
      getCompleteProposalRevision(data),
      "prepare",
    );
    expect(calls).toEqual(["save", "snapshot"]);
    expect(createDeliverySnapshotForProposal).toHaveBeenCalledExactlyOnceWith(
      data.proposal.id,
      "saved-revision",
    );
    expect(generate).not.toHaveBeenCalled();
  });
  it("reports a partial save honestly and does not retry snapshot preparation", async () => {
    vi.mocked(createDeliverySnapshotForProposal).mockRejectedValueOnce(
      new Error("secret internal failure"),
    );
    await expect(
      runProposalEditorWorkflow(
        input("ready"),
        getCompleteProposalRevision(data),
        "prepare",
      ),
    ).rejects.toThrow("saved as Ready");
    expect(createDeliverySnapshotForProposal).toHaveBeenCalledOnce();
    expect(data.proposal.status).toBe("ready");
  });
  it("keeps tenant authorization failures before save", async () => {
    vi.mocked(getProposalBuilderData).mockRejectedValueOnce(
      new AppError("Proposal not found.", 404),
    );
    await expect(
      runProposalEditorWorkflow(input(), "foreign", "generate"),
    ).rejects.toThrow("Proposal not found");
    expect(updateProposalDraft).not.toHaveBeenCalled();
  });
});
