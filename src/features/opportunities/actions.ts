"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { generateOpportunitiesForAudit } from "@/features/opportunities/data";
import { buildFeedbackUrl } from "@/lib/action-feedback";
import { getPublicErrorMessage } from "@/lib/errors";

const prospectsPath = "/dashboard/prospects";

export async function generateAuditOpportunitiesAction(auditId: string) {
  try {
    await generateOpportunitiesForAudit(auditId);
  } catch (error) {
    redirect(
      buildFeedbackUrl(prospectsPath, {
        error: getPublicErrorMessage(
          error,
          "We could not generate opportunities for that audit.",
        ),
      }),
    );
  }

  revalidatePath(prospectsPath);
  redirect(
    buildFeedbackUrl(prospectsPath, {
      success: "Opportunities generated from the completed audit.",
    }),
  );
}
