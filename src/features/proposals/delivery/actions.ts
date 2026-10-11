"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createDeliverySnapshotForProposal } from "@/features/proposals/delivery/data";
import {
  buildFeedbackUrl,
  getValidationErrorMessage,
} from "@/lib/action-feedback";
import { getPublicErrorMessage } from "@/lib/errors";

const proposalsPath = "/dashboard/proposals";
const proposalIdSchema = z.string().uuid();

export async function createDeliverySnapshotAction(proposalId: string) {
  const path = `${proposalsPath}/${proposalId}`;
  const result = proposalIdSchema.safeParse(proposalId);

  if (!result.success) {
    redirect(
      buildFeedbackUrl(proposalsPath, {
        error: getValidationErrorMessage(result.error),
      }),
    );
  }

  try {
    await createDeliverySnapshotForProposal(result.data);

    revalidatePath(path);
  } catch (error) {
    redirect(
      buildFeedbackUrl(path, {
        error: getPublicErrorMessage(
          error,
          "We could not create the delivery snapshot.",
        ),
      }),
    );
  }

  redirect(
    buildFeedbackUrl(path, {
      success: "Delivery snapshot created.",
    }),
  );
}
