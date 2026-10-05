"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { generateOpportunityAiInsightForOpportunity } from "@/features/opportunities/ai/data";
import { buildFeedbackUrl } from "@/lib/action-feedback";
import { getPublicErrorMessage } from "@/lib/errors";

const prospectsPath = "/dashboard/prospects";

export async function generateOpportunityAiInsightAction(opportunityId: string) {
  try {
    await generateOpportunityAiInsightForOpportunity(opportunityId);
  } catch (error) {
    redirect(
      buildFeedbackUrl(prospectsPath, {
        error: getPublicErrorMessage(
          error,
          "We could not generate the AI insight for that opportunity.",
        ),
      }),
    );
  }

  revalidatePath(prospectsPath);
  redirect(
    buildFeedbackUrl(prospectsPath, {
      success: "AI insight generated for that opportunity.",
    }),
  );
}
