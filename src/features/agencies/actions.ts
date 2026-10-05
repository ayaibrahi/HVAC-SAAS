"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { buildFeedbackUrl, getValidationErrorMessage } from "@/lib/action-feedback";
import { getPublicErrorMessage } from "@/lib/errors";
import { formDataToObject } from "@/lib/forms";
import { agencyInputSchema } from "@/lib/validation/agencies";
import { upsertAgencyForCurrentUser } from "@/features/agencies/data";

export async function upsertAgencyAction(formData: FormData) {
  const result = agencyInputSchema.safeParse(formDataToObject(formData));

  if (!result.success) {
    redirect(
      buildFeedbackUrl("/dashboard/settings", {
        error: getValidationErrorMessage(result.error),
      }),
    );
  }

  try {
    await upsertAgencyForCurrentUser(result.data);
  } catch (error) {
    redirect(
      buildFeedbackUrl("/dashboard/settings", {
        error: getPublicErrorMessage(error, "We could not save your agency profile."),
      }),
    );
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings");
  redirect(buildFeedbackUrl("/dashboard", { success: "Agency profile saved." }));
}
