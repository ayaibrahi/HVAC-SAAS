"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createProposalDraft,
  updateProposalDraft,
} from "@/features/proposals/data";
import { generateProposalAiDraftForProposal } from "@/features/proposals/ai/data";
import { buildFeedbackUrl, getValidationErrorMessage } from "@/lib/action-feedback";
import { AppError, getPublicErrorMessage } from "@/lib/errors";
import {
  createProposalInputSchema,
  updateProposalInputSchema,
} from "@/lib/validation/proposals";

const proposalsPath = "/dashboard/proposals";

export async function createProposalAction(formData: FormData) {
  const result = createProposalInputSchema.safeParse({
    auditId: formData.get("auditId"),
    title: formData.get("title"),
  });

  if (!result.success) {
    redirect(
      buildFeedbackUrl(proposalsPath, {
        error: getValidationErrorMessage(result.error),
      }),
    );
  }

  try {
    const proposal = await createProposalDraft(result.data);

    revalidatePath(proposalsPath);
    redirect(
      buildFeedbackUrl(`${proposalsPath}/${proposal.id}`, {
        success: "Proposal draft created.",
      }),
    );
  } catch (error) {
    redirect(
      buildFeedbackUrl(proposalsPath, {
        error: getPublicErrorMessage(error, "We could not create that proposal."),
      }),
    );
  }
}

export async function updateProposalAction(
  proposalId: string,
  formData: FormData,
) {
  const path = `${proposalsPath}/${proposalId}`;
  let lineItems: ReturnType<typeof parseLineItems>;

  try {
    lineItems = parseLineItems(formData);
  } catch (error) {
    redirect(
      buildFeedbackUrl(path, {
        error: getPublicErrorMessage(error, "Please check the proposal form."),
      }),
    );
  }

  const result = updateProposalInputSchema.safeParse({
    proposalId,
    title: formData.get("title"),
    summary: formData.get("summary") ?? "",
    scope: formData.get("scope") ?? "",
    nextStep: formData.get("nextStep") ?? "",
    currency: formData.get("currency"),
    status: formData.get("status"),
    discountType: formData.get("discountType"),
    discountValue: formData.get("discountValue") ?? "0",
    lineItems,
  });

  if (!result.success) {
    redirect(
      buildFeedbackUrl(path, {
        error: getValidationErrorMessage(result.error),
      }),
    );
  }

  try {
    await updateProposalDraft(result.data);

    revalidatePath(path);
    revalidatePath(proposalsPath);
    redirect(
      buildFeedbackUrl(path, {
        success: "Proposal saved.",
      }),
    );
  } catch (error) {
    redirect(
      buildFeedbackUrl(path, {
        error: getPublicErrorMessage(error, "We could not save that proposal."),
      }),
    );
  }
}

export async function generateProposalAiDraftAction(proposalId: string) {
  const path = `${proposalsPath}/${proposalId}`;

  try {
    await generateProposalAiDraftForProposal(proposalId);

    revalidatePath(path);
    redirect(
      buildFeedbackUrl(path, {
        success: "Proposal summary and scope generated.",
      }),
    );
  } catch (error) {
    redirect(
      buildFeedbackUrl(path, {
        error: getPublicErrorMessage(
          error,
          "Proposal AI draft could not be generated. You can still edit manually.",
        ),
      }),
    );
  }
}

function parseLineItems(formData: FormData) {
  const opportunityIds = formData
    .getAll("opportunityId")
    .filter((value): value is string => typeof value === "string");

  return opportunityIds.map((opportunityId) => ({
    opportunityId,
    agencyServiceId: requireFormString(formData, `serviceId:${opportunityId}`),
    quantity: requireFormString(formData, `quantity:${opportunityId}`),
    unitPrice: requireFormString(formData, `unitPrice:${opportunityId}`),
    description: optionalFormString(formData, `description:${opportunityId}`),
  }));
}

function requireFormString(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string") {
    throw new AppError("Proposal form is missing required fields.", 422);
  }

  return value;
}

function optionalFormString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value : undefined;
}
