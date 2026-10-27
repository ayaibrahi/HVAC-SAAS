"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertProspectBelongsToAgency } from "@/features/audits/authorization";
import { getActiveAuditForProspect } from "@/features/audits/data";
import { runAuditForProspect } from "@/features/audits/run-audit";
import { requireCurrentAgency } from "@/features/agencies/data";
import { getProspect } from "@/features/prospects/data";
import { enforceAgencyUsageLimit } from "@/features/usage/limits";
import { buildFeedbackUrl } from "@/lib/action-feedback";
import { getPublicErrorMessage } from "@/lib/errors";
import { assertRenderedAuditAvailable, renderedAuditsRequested } from "@/features/audits/jobs/availability";

const prospectsPath = "/dashboard/prospects";

export async function startProspectAuditAction(prospectId: string) {
  let feedback:
    | { success: string; shouldRevalidate: boolean }
    | { error: string; shouldRevalidate: boolean };

  try {
    const { agency, user } = await requireCurrentAgency();
    const prospect = await getProspect(prospectId, agency.id);

    assertProspectBelongsToAgency(prospect, agency.id);

    if (renderedAuditsRequested()) assertRenderedAuditAvailable();

    const activeAudit = prospect
      ? await getActiveAuditForProspect({
          agencyId: agency.id,
          prospectId: prospect.id,
        })
      : null;

    if (activeAudit) {
      feedback = {
        success: "Analysis is already in progress for this prospect.",
        shouldRevalidate: false,
      };
    } else {
      await enforceAgencyUsageLimit({
        agencyId: agency.id,
        userId: user.id,
        action: "website_analyzer",
      });

      await runAuditForProspect({
        agencyId: agency.id,
        prospect,
      });

      feedback = {
        success: "Audit completed and stored.",
        shouldRevalidate: true,
      };
    }
  } catch (error) {
    feedback = {
      error: getPublicErrorMessage(
        error,
        "We could not analyze that prospect.",
      ),
      shouldRevalidate: false,
    };
  }

  if (feedback.shouldRevalidate) {
    revalidatePath(prospectsPath);
  }

  const feedbackParams =
    "success" in feedback
      ? { success: feedback.success }
      : { error: feedback.error };

  redirect(buildFeedbackUrl(prospectsPath, feedbackParams));
}
