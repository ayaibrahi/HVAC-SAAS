import { beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createProposalAction,
  generateProposalAiDraftAction,
  updateProposalAction,
} from "@/features/proposals/actions";
import { createDeliverySnapshotAction } from "@/features/proposals/delivery/actions";
import { buildFeedbackUrl } from "@/lib/action-feedback";
import { AiProviderError } from "@/lib/ai/provider-errors";
import { AppError } from "@/lib/errors";

const operations = vi.hoisted(() => ({
  createDraft: vi.fn(),
  saveDraft: vi.fn(),
  generateDraft: vi.fn(),
  createSnapshot: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", async (importOriginal) => {
  const navigation = await importOriginal<typeof import("next/navigation")>();
  // Keep the real throwing redirect so a swallowed NEXT_REDIRECT fails tests.
  return { ...navigation, redirect: vi.fn(navigation.redirect) };
});
vi.mock("@/features/proposals/data", () => ({
  createProposalDraft: operations.createDraft,
  updateProposalDraft: operations.saveDraft,
}));
vi.mock("@/features/proposals/ai/data", () => ({
  generateProposalAiDraftForProposal: operations.generateDraft,
}));
vi.mock("@/features/proposals/delivery/data", () => ({
  createDeliverySnapshotForProposal: operations.createSnapshot,
}));

const auditId = "11111111-1111-4111-8111-111111111111";
const proposalId = "44444444-4444-4444-8444-444444444444";
const opportunityId = "55555555-5555-4555-8555-555555555555";
const serviceId = "66666666-6666-4666-8666-666666666666";
const proposalsPath = "/dashboard/proposals";
const proposalPath = `${proposalsPath}/${proposalId}`;

beforeEach(() => {
  vi.clearAllMocks();
  operations.createDraft.mockResolvedValue({ id: proposalId });
  operations.saveDraft.mockResolvedValue(undefined);
  operations.generateDraft.mockResolvedValue(undefined);
  operations.createSnapshot.mockResolvedValue(undefined);
});

const actionCases = [
  {
    name: "create proposal",
    invoke: () => createProposalAction(createForm()),
    operation: operations.createDraft,
    expectedInput: { auditId, title: "Proposal for Example HVAC" },
    success: "Proposal draft created.",
    errorPath: proposalsPath,
    fallback: "We could not create that proposal.",
    revalidatedPaths: [proposalsPath],
  },
  {
    name: "save proposal",
    invoke: () => updateProposalAction(proposalId, updateForm()),
    operation: operations.saveDraft,
    expectedInput: {
      proposalId,
      title: "Proposal for Example HVAC",
      summary: "Page-scoped summary",
      scope: "Selected service scope",
      nextStep: "Review the proposal",
      currency: "USD",
      status: "ready",
      discountType: "fixed",
      discountValue: "25.00",
      lineItems: [
        {
          opportunityId,
          agencyServiceId: serviceId,
          quantity: 2,
          unitPrice: "350.00",
          description: "Online booking integration",
        },
      ],
    },
    success: "Proposal saved.",
    errorPath: proposalPath,
    fallback: "We could not save that proposal.",
    revalidatedPaths: [proposalPath, proposalsPath],
  },
  {
    name: "generate Proposal AI",
    invoke: () => generateProposalAiDraftAction(proposalId),
    operation: operations.generateDraft,
    expectedInput: proposalId,
    success: "Proposal summary and scope generated.",
    errorPath: proposalPath,
    fallback:
      "Proposal AI draft could not be generated. You can still edit manually.",
    revalidatedPaths: [proposalPath],
  },
  {
    name: "create delivery snapshot",
    invoke: () => createDeliverySnapshotAction(proposalId),
    operation: operations.createSnapshot,
    expectedInput: proposalId,
    success: "Delivery snapshot created.",
    errorPath: proposalPath,
    fallback: "We could not create the delivery snapshot.",
    revalidatedPaths: [proposalPath],
  },
];

describe.each(actionCases)("$name redirect boundary", (action) => {
  it("redirects once with success after exactly one operation", async () => {
    const target = buildFeedbackUrl(proposalPath, { success: action.success });

    await expect(action.invoke()).rejects.toMatchObject({
      message: "NEXT_REDIRECT",
      digest: expect.stringContaining(`;${target};`),
    });

    expect(redirect).toHaveBeenCalledExactlyOnceWith(target);
    expect(action.operation).toHaveBeenCalledExactlyOnceWith(
      action.expectedInput,
    );
    expect(revalidatePath).toHaveBeenCalledTimes(
      action.revalidatedPaths.length,
    );
    for (const [index, path] of action.revalidatedPaths.entries()) {
      expect(revalidatePath).toHaveBeenNthCalledWith(index + 1, path);
    }
    for (const operation of Object.values(operations)) {
      if (operation !== action.operation) {
        expect(operation).not.toHaveBeenCalled();
      }
    }
  });

  it("returns controlled failure feedback without leaking internal errors or retrying", async () => {
    action.operation.mockRejectedValueOnce(
      new Error("private database detail"),
    );

    await expect(action.invoke()).rejects.toMatchObject({
      message: "NEXT_REDIRECT",
    });

    expect(redirect).toHaveBeenCalledExactlyOnceWith(
      buildFeedbackUrl(action.errorPath, { error: action.fallback }),
    );
    expect(action.operation).toHaveBeenCalledTimes(1);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("preserves controlled authorization errors without reporting success", async () => {
    action.operation.mockRejectedValueOnce(
      new AppError("Proposal not found.", 404),
    );

    await expect(action.invoke()).rejects.toMatchObject({
      message: "NEXT_REDIRECT",
    });

    expect(redirect).toHaveBeenCalledExactlyOnceWith(
      buildFeedbackUrl(action.errorPath, { error: "Proposal not found." }),
    );
    expect(action.operation).toHaveBeenCalledTimes(1);
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("proposal validation and provider errors", () => {
  it.each([
    {
      name: "invalid audit ID",
      invoke: () => createProposalAction(new FormData()),
      path: proposalsPath,
    },
    {
      name: "invalid proposal form",
      invoke: () => updateProposalAction(proposalId, new FormData()),
      path: proposalPath,
    },
    {
      name: "missing line-item fields",
      invoke: () => {
        const form = updateForm();
        form.delete(`unitPrice:${opportunityId}`);
        return updateProposalAction(proposalId, form);
      },
      path: proposalPath,
    },
    {
      name: "invalid snapshot proposal ID",
      invoke: () => createDeliverySnapshotAction("not-a-uuid"),
      path: proposalsPath,
    },
  ])("rejects $name before persistence", async ({ invoke, path }) => {
    await expect(invoke()).rejects.toMatchObject({ message: "NEXT_REDIRECT" });

    expect(redirect).toHaveBeenCalledTimes(1);
    const [target] = vi.mocked(redirect).mock.calls[0];
    const url = new URL(target, "https://example.com");
    expect(url.pathname).toBe(path);
    expect(url.searchParams.get("error")).toBeTruthy();
    expect(url.searchParams.has("success")).toBe(false);
    for (const operation of Object.values(operations)) {
      expect(operation).not.toHaveBeenCalled();
    }
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("preserves safe provider failure feedback without retrying AI generation", async () => {
    operations.generateDraft.mockRejectedValueOnce(
      new AiProviderError({
        message: "AI provider rate limit reached. Please retry later.",
        statusCode: 429,
        category: "rate_limit",
      }),
    );

    await expect(
      generateProposalAiDraftAction(proposalId),
    ).rejects.toMatchObject({
      message: "NEXT_REDIRECT",
    });

    expect(redirect).toHaveBeenCalledExactlyOnceWith(
      buildFeedbackUrl(proposalPath, {
        error: "AI provider rate limit reached. Please retry later.",
      }),
    );
    expect(operations.generateDraft).toHaveBeenCalledExactlyOnceWith(
      proposalId,
    );
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

function createForm() {
  const form = new FormData();
  form.set("auditId", auditId);
  form.set("title", "Proposal for Example HVAC");
  return form;
}

function updateForm() {
  const form = new FormData();
  form.set("title", "Proposal for Example HVAC");
  form.set("summary", "Page-scoped summary");
  form.set("scope", "Selected service scope");
  form.set("nextStep", "Review the proposal");
  form.set("currency", "USD");
  form.set("status", "ready");
  form.set("discountType", "fixed");
  form.set("discountValue", "25.00");
  form.append("opportunityId", opportunityId);
  form.set(`serviceId:${opportunityId}`, serviceId);
  form.set(`quantity:${opportunityId}`, "2");
  form.set(`unitPrice:${opportunityId}`, "350.00");
  form.set(`description:${opportunityId}`, "Online booking integration");
  return form;
}
