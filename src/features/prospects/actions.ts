"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { buildFeedbackUrl, getValidationErrorMessage } from "@/lib/action-feedback";
import { getPublicErrorMessage } from "@/lib/errors";
import { formDataToObject } from "@/lib/forms";
import { prospectInputSchema } from "@/lib/validation/prospects";
import {
  createProspect,
  deleteProspect,
  updateProspect,
} from "@/features/prospects/data";

const prospectsPath = "/dashboard/prospects";

export async function createProspectAction(formData: FormData) {
  const result = prospectInputSchema.safeParse(formDataToObject(formData));

  if (!result.success) {
    redirect(
      buildFeedbackUrl(prospectsPath, { error: getValidationErrorMessage(result.error) }),
    );
  }

  try {
    await createProspect(result.data);
  } catch (error) {
    redirect(
      buildFeedbackUrl(prospectsPath, {
        error: getPublicErrorMessage(error, "We could not create that prospect."),
      }),
    );
  }

  revalidatePath(prospectsPath);
  redirect(buildFeedbackUrl(prospectsPath, { success: "Prospect created." }));
}

export async function updateProspectAction(prospectId: string, formData: FormData) {
  const result = prospectInputSchema.safeParse(formDataToObject(formData));

  if (!result.success) {
    redirect(
      buildFeedbackUrl(`${prospectsPath}/${prospectId}/edit`, {
        error: getValidationErrorMessage(result.error),
      }),
    );
  }

  try {
    await updateProspect(prospectId, result.data);
  } catch (error) {
    redirect(
      buildFeedbackUrl(`${prospectsPath}/${prospectId}/edit`, {
        error: getPublicErrorMessage(error, "We could not update that prospect."),
      }),
    );
  }

  revalidatePath(prospectsPath);
  redirect(buildFeedbackUrl(prospectsPath, { success: "Prospect updated." }));
}

export async function deleteProspectAction(prospectId: string) {
  try {
    await deleteProspect(prospectId);
  } catch (error) {
    redirect(
      buildFeedbackUrl(prospectsPath, {
        error: getPublicErrorMessage(error, "We could not delete that prospect."),
      }),
    );
  }

  revalidatePath(prospectsPath);
  redirect(buildFeedbackUrl(prospectsPath, { success: "Prospect deleted." }));
}
