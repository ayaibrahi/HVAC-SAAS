"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertProspectBelongsToAgency } from "@/features/audits/authorization";
import { runAuditForProspect } from "@/features/audits/run-audit";
import { requireCurrentAgency } from "@/features/agencies/data";
import { getProspect } from "@/features/prospects/data";
import { enforceAgencyUsageLimit } from "@/features/usage/limits";
import { buildFeedbackUrl } from "@/lib/action-feedback";
import { getPublicErrorMessage } from "@/lib/errors";

const prospectsPath = "/dashboard/prospects";

export async function startProspectAuditAction(prospectId: string) {
  try {
    const { agency, user } = await requireCurrentAgency();
    const prospect = await getProspect(prospectId, agency.id);

    assertProspectBelongsToAgency(prospect, agency.id);

    await enforceAgencyUsageLimit({
      agencyId: agency.id,
      userId: user.id,
      action: "website_analyzer",
    });

    await runAuditForProspect({
      agencyId: agency.id,
      prospect,
    });
  } catch (error) {
    redirect(
      buildFeedbackUrl(prospectsPath, {
        error: getPublicErrorMessage(error, "We could not analyze that prospect."),
      }),
    );
  }

  revalidatePath(prospectsPath);
  redirect(buildFeedbackUrl(prospectsPath, { success: "Audit completed and stored." }));
}
