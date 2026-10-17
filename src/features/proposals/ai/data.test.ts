import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeBuilderData } from "../builder-test-fixtures";
import { generateProposalAiDraftForProposal } from "./data";
import { makeProposalAiDraft } from "./test-fixtures";
import { getProposalBuilderData, applyProposalAiDraft } from "../data";
import { createProposalAiProvider } from "./provider";
import { requireCurrentAgency } from "@/features/agencies/data";
import { enforceAgencyUsageLimit } from "@/features/usage/limits";
vi.mock("server-only", () => ({}));
vi.mock("../data", () => ({
  getProposalBuilderData: vi.fn(),
  applyProposalAiDraft: vi.fn(),
}));
vi.mock("./provider", () => ({ createProposalAiProvider: vi.fn() }));
vi.mock("@/features/agencies/data", () => ({ requireCurrentAgency: vi.fn() }));
vi.mock("@/features/usage/limits", () => ({
  enforceAgencyUsageLimit: vi.fn(),
}));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), error: vi.fn() } }));
beforeEach(() => {
  vi.clearAllMocks();
  const data = makeBuilderData();
  vi.mocked(getProposalBuilderData).mockResolvedValue(data);
  vi.mocked(requireCurrentAgency).mockResolvedValue({
    agency: data.agency,
    user: { id: "test-user" },
  } as Awaited<ReturnType<typeof requireCurrentAgency>>);
});
describe("proposal generation preserves saved copy before consuming provider resources", () => {
  it("cannot start the legacy generation path while complete generation owns the draft", async () => {
    const data = makeBuilderData();
    data.proposal.content = {
      proposalAiLease: { token: "active", startedAt: Date.now() },
    };
    vi.mocked(getProposalBuilderData).mockResolvedValue(data);
    await expect(
      generateProposalAiDraftForProposal(data.proposal.id),
    ).rejects.toThrow("already generating");
    expect(createProposalAiProvider).not.toHaveBeenCalled();
    expect(enforceAgencyUsageLimit).not.toHaveBeenCalled();
  });
  it.each([
    "summary",
    "scope",
    "nextStep",
    "ready",
    "unverified",
    "oversized",
    "foreign",
  ])("blocks %s without provider, usage or persistence calls", async (kind) => {
    const data = makeBuilderData();
    if (kind === "ready") data.proposal.status = "ready";
    else if (kind === "unverified") data.audit.normalizedSignals = {};
    else if (kind === "oversized")
      data.services[0].description = "S".repeat(1001);
    else if (kind === "foreign") data.proposal.agencyId = "other-agency";
    else
      data.proposal[kind as "summary" | "scope" | "nextStep"] =
        "Previously reviewed copy";
    vi.mocked(getProposalBuilderData).mockResolvedValue(data);
    await expect(
      generateProposalAiDraftForProposal(data.proposal.id),
    ).rejects.toThrow();
    expect(createProposalAiProvider).not.toHaveBeenCalled();
    expect(enforceAgencyUsageLimit).not.toHaveBeenCalled();
    expect(applyProposalAiDraft).not.toHaveBeenCalled();
  });
  it("persists only validated approved fields and provider metadata", async () => {
    const data = makeBuilderData();
    const { createProposalAiInput } = await import("./input");
    const { buildProposalCopyOptions, firstProposalCopy } =
      await import("../sales-content");
    const draft = firstProposalCopy(
      buildProposalCopyOptions(
        createProposalAiInput({ agency: data.agency, builderData: data }),
      ),
    );
    const generate = vi.fn(async () => draft);
    vi.mocked(applyProposalAiDraft).mockResolvedValue(data.proposal);
    await generateProposalAiDraftForProposal(data.proposal.id, {
      metadata: {
        provider: "test",
        model: "mock",
        promptVersion: "v3",
        schemaVersion: "1.0.0",
      },
      generateProposalDraft: generate,
    });
    expect(generate).toHaveBeenCalledTimes(1);
    expect(applyProposalAiDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        ...draft,
        proposalId: data.proposal.id,
        expectedUpdatedAt: data.proposal.updatedAt,
        metadata: expect.objectContaining({ promptVersion: "v3" }),
      }),
    );
  });
  it("never persists a fabricated implementation commitment", async () => {
    const data = makeBuilderData();
    const generate = vi.fn(async () =>
      makeProposalAiDraft({
        scope: "We install a new booking system within a week.",
      }),
    );
    await expect(
      generateProposalAiDraftForProposal(data.proposal.id, {
        metadata: {
          provider: "test",
          model: "mock",
          promptVersion: "v3",
          schemaVersion: "1.0.0",
        },
        generateProposalDraft: generate,
      }),
    ).rejects.toThrow();
    expect(applyProposalAiDraft).not.toHaveBeenCalled();
    expect(generate).toHaveBeenCalledTimes(2);
  });
});
