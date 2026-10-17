import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeCompleteProposalBuilder } from "./complete-test-fixtures";
import { createCompleteProposalInput } from "./complete-input";
import { buildProposalCopyOptions, firstProposalCopy } from "../sales-content";
import { generateCompleteProposalForProposal } from "./data";
import {
  getProposalBuilderData,
  applyProposalAiDraft,
  claimCompleteProposalGeneration,
  releaseCompleteProposalGeneration,
} from "../data";
import { requireCurrentAgency } from "@/features/agencies/data";
import { enforceAgencyUsageLimit } from "@/features/usage/limits";
import { createProposalAiProvider } from "./provider";
import { getCompleteProposalRevision } from "./complete-revision";

vi.mock("server-only", () => ({}));
vi.mock("../data", () => ({
  getProposalBuilderData: vi.fn(),
  applyProposalAiDraft: vi.fn(),
  claimCompleteProposalGeneration: vi.fn(),
  releaseCompleteProposalGeneration: vi.fn(),
}));
vi.mock("./provider", () => ({ createProposalAiProvider: vi.fn() }));
vi.mock("@/features/agencies/data", () => ({ requireCurrentAgency: vi.fn() }));
vi.mock("@/features/usage/limits", () => ({
  enforceAgencyUsageLimit: vi.fn(),
}));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), error: vi.fn() } }));
let data: ReturnType<typeof makeCompleteProposalBuilder>;
const lease = {
  token: "99999999-9999-4999-8999-999999999999" as const,
  updatedAt: "2026-10-18T10:00:00Z",
};
beforeEach(() => {
  vi.resetAllMocks();
  data = makeCompleteProposalBuilder();
  vi.mocked(requireCurrentAgency).mockResolvedValue({
    agency: data.agency,
    user: { id: "test-user" },
  } as Awaited<ReturnType<typeof requireCurrentAgency>>);
  vi.mocked(getProposalBuilderData).mockImplementation(async () => data);
  vi.mocked(claimCompleteProposalGeneration).mockImplementation(async () => {
    data.proposal.updatedAt = lease.updatedAt;
    return lease;
  });
  vi.mocked(applyProposalAiDraft).mockImplementation(async (args) => ({
    ...data.proposal,
    ...args,
  }));
});
function provider(after?: () => void) {
  const generate = vi.fn(async () => {
    const output = firstProposalCopy(
      buildProposalCopyOptions(createCompleteProposalInput(data)),
    );
    after?.();
    return output;
  });
  return {
    metadata: {
      provider: "groq",
      model: "mock",
      promptVersion: "v5-complete",
      schemaVersion: "1.0.0",
    },
    generateProposalDraft: generate,
  };
}
describe("complete proposal server orchestration", () => {
  it("rejects a rendered confirmation whose saved prices or scope changed before submission", async () => {
    const revision = getCompleteProposalRevision(data);
    data.services[0].approvedScope!.exclusions = "Updated contract exclusions";
    const mock = provider();
    await expect(
      generateCompleteProposalForProposal(data.proposal.id, mock, revision),
    ).rejects.toThrow("Reload and confirm");
    expect(mock.generateProposalDraft).not.toHaveBeenCalled();
    expect(claimCompleteProposalGeneration).not.toHaveBeenCalled();
  });
  it("uses saved tenant state, one validated write and scope provenance, never marks Ready", async () => {
    const mock = provider();
    const result = await generateCompleteProposalForProposal(
      data.proposal.id,
      mock,
    );
    expect(mock.generateProposalDraft).toHaveBeenCalledTimes(1);
    expect(applyProposalAiDraft).toHaveBeenCalledTimes(1);
    expect(applyProposalAiDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        generationToken: lease.token,
        expectedUpdatedAt: lease.updatedAt,
        metadata: expect.objectContaining({
          mode: "complete",
          approvedScopes: expect.any(Array),
        }),
      }),
    );
    expect(result.status).toBe("draft");
    expect(result.total).toBe(500);
    expect(releaseCompleteProposalGeneration).toHaveBeenCalledWith(
      data.proposal.id,
      lease.token,
    );
  });
  it.each([
    "scope",
    "humanText",
    "ready",
    "foreign",
    "oversizedEvidence",
    "pricing",
  ])(
    "blocks %s before reservation, usage, provider or persistence",
    async (kind) => {
      if (kind === "scope") data.services[0].approvedScope = null;
      if (kind === "humanText")
        data.proposal.summary = "Human-written proposal";
      if (kind === "ready") data.proposal.status = "ready";
      if (kind === "foreign") data.proposal.agencyId = "another-tenant";
      if (kind === "oversizedEvidence")
        data.opportunities.find((o) =>
          data.lineItemsByOpportunityId.has(o.id),
        )!.evidence[0].details = "E".repeat(601);
      if (kind === "pricing") data.proposal.total = 600;
      const mock = provider();
      await expect(
        generateCompleteProposalForProposal(data.proposal.id, mock),
      ).rejects.toThrow();
      expect(claimCompleteProposalGeneration).not.toHaveBeenCalled();
      expect(enforceAgencyUsageLimit).not.toHaveBeenCalled();
      expect(mock.generateProposalDraft).not.toHaveBeenCalled();
      expect(applyProposalAiDraft).not.toHaveBeenCalled();
    },
  );
  it.each(["scope", "price", "human", "selection"])(
    "rejects stale %s after generation, preserving the saved version",
    async (kind) => {
      const mock = provider(() => {
        if (kind === "scope")
          data.services[0].approvedScope!.exclusions = "A changed exclusion";
        if (kind === "price") {
          data.proposal.total = data.proposal.subtotal = 600;
          const line = [...data.lineItemsByOpportunityId.values()][0];
          line.unitPrice = line.lineTotal = 600;
        }
        if (kind === "human") {
          data.proposal.summary = "Newer human text";
          data.proposal.updatedAt = "new-version";
        }
        if (kind === "selection") data.lineItemsByOpportunityId.clear();
      });
      await expect(
        generateCompleteProposalForProposal(data.proposal.id, mock),
      ).rejects.toThrow();
      expect(applyProposalAiDraft).not.toHaveBeenCalled();
      expect(releaseCompleteProposalGeneration).toHaveBeenCalled();
      if (kind === "human")
        expect(data.proposal.summary).toBe("Newer human text");
    },
  );
  it("a failed duplicate reservation cannot call the provider or release another request's lease", async () => {
    vi.mocked(claimCompleteProposalGeneration).mockRejectedValue(
      new Error("Already generating"),
    );
    const mock = provider();
    await expect(
      generateCompleteProposalForProposal(data.proposal.id, mock),
    ).rejects.toThrow();
    expect(mock.generateProposalDraft).not.toHaveBeenCalled();
    expect(releaseCompleteProposalGeneration).not.toHaveBeenCalled();
  });
  it("rejects malformed output twice, clears the lease and never persists partial copy", async () => {
    const mock = provider();
    mock.generateProposalDraft.mockResolvedValue({
      summary: "Malformed",
    } as ReturnType<typeof firstProposalCopy>);
    await expect(
      generateCompleteProposalForProposal(data.proposal.id, mock),
    ).rejects.toThrow();
    expect(mock.generateProposalDraft).toHaveBeenCalledTimes(2);
    expect(applyProposalAiDraft).not.toHaveBeenCalled();
    expect(releaseCompleteProposalGeneration).toHaveBeenCalled();
    expect(data.proposal.summary).toBe("");
  });
  it("does not report a successful write as failure if best-effort lease cleanup fails", async () => {
    vi.mocked(releaseCompleteProposalGeneration).mockRejectedValue(
      new Error("private database failure"),
    );
    await expect(
      generateCompleteProposalForProposal(data.proposal.id, provider()),
    ).resolves.toMatchObject({ status: "draft" });
    expect(applyProposalAiDraft).toHaveBeenCalledTimes(1);
  });
  it("rejects alternate-provider injection without reservation or paid fallback", async () => {
    const mock = provider();
    mock.metadata.provider = "openai";
    await expect(
      generateCompleteProposalForProposal(data.proposal.id, mock),
    ).rejects.toThrow("requires Groq");
    expect(claimCompleteProposalGeneration).not.toHaveBeenCalled();
    expect(createProposalAiProvider).not.toHaveBeenCalled();
  });
});
