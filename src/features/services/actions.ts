"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  buildFeedbackUrl,
  getValidationErrorMessage,
} from "@/lib/action-feedback";
import { getPublicErrorMessage } from "@/lib/errors";
import { formDataToObject } from "@/lib/forms";
import { agencyServiceInputSchema } from "@/lib/validation/services";
import {
  createAgencyService,
  deleteAgencyService,
  setAgencyServiceActive,
  updateAgencyService,
} from "@/features/services/data";

const servicesPath = "/dashboard/services";

function serviceFields(formData: FormData) {
  return {
    ...formDataToObject(formData),
    approvedScope:
      formData.get("approveScope") === "on"
        ? {
            deliverables: formData.get("deliverables"),
            exclusions: formData.get("exclusions"),
            clientInputs: formData.get("clientInputs"),
            completionChecks: formData.get("completionChecks"),
          }
        : null,
  };
}

export async function createServiceAction(formData: FormData) {
  const result = agencyServiceInputSchema.safeParse(serviceFields(formData));

  if (!result.success) {
    redirect(
      buildFeedbackUrl(servicesPath, {
        error: getValidationErrorMessage(result.error),
      }),
    );
  }

  try {
    await createAgencyService(result.data);
  } catch (error) {
    redirect(
      buildFeedbackUrl(servicesPath, {
        error: getPublicErrorMessage(
          error,
          "We could not create that service.",
        ),
      }),
    );
  }

  revalidatePath(servicesPath);
  redirect(buildFeedbackUrl(servicesPath, { success: "Service created." }));
}

export async function updateServiceAction(
  serviceId: string,
  formData: FormData,
) {
  const result = agencyServiceInputSchema.safeParse(serviceFields(formData));

  if (!result.success) {
    redirect(
      buildFeedbackUrl(`${servicesPath}/${serviceId}/edit`, {
        error: getValidationErrorMessage(result.error),
      }),
    );
  }

  try {
    await updateAgencyService(serviceId, result.data);
  } catch (error) {
    redirect(
      buildFeedbackUrl(`${servicesPath}/${serviceId}/edit`, {
        error: getPublicErrorMessage(
          error,
          "We could not update that service.",
        ),
      }),
    );
  }

  revalidatePath(servicesPath);
  redirect(buildFeedbackUrl(servicesPath, { success: "Service updated." }));
}

export async function toggleServiceActiveAction(
  serviceId: string,
  nextValue: boolean,
) {
  try {
    await setAgencyServiceActive(serviceId, nextValue);
  } catch (error) {
    redirect(
      buildFeedbackUrl(servicesPath, {
        error: getPublicErrorMessage(
          error,
          "We could not update that service.",
        ),
      }),
    );
  }

  revalidatePath(servicesPath);
  redirect(buildFeedbackUrl(servicesPath, { success: "Service updated." }));
}

export async function deleteServiceAction(serviceId: string) {
  try {
    await deleteAgencyService(serviceId);
  } catch (error) {
    redirect(
      buildFeedbackUrl(servicesPath, {
        error: getPublicErrorMessage(
          error,
          "We could not delete that service.",
        ),
      }),
    );
  }

  revalidatePath(servicesPath);
  redirect(buildFeedbackUrl(servicesPath, { success: "Service deleted." }));
}
