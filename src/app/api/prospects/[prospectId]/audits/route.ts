import { NextResponse } from "next/server";
import { assertProspectBelongsToAgency } from "@/features/audits/authorization";
import { runAuditForProspect } from "@/features/audits/run-audit";
import { requireCurrentAgency } from "@/features/agencies/data";
import { getProspect } from "@/features/prospects/data";
import { enforceAgencyUsageLimit } from "@/features/usage/limits";
import { jsonError, jsonValidationError, parseOptionalJsonBody } from "@/lib/api-response";
import { startAuditSchema } from "@/lib/validation/audits";
import { assertRenderedAuditAvailable, renderedAuditsRequested } from "@/features/audits/jobs/availability";
import { createAuditJobStore } from "@/features/audits/jobs/repository";
import { submitRenderedAuditJob } from "@/features/audits/jobs/submit";
import { z } from "zod";
import { AppError } from "@/lib/errors";

type ProspectAuditRouteContext = {
  params: Promise<{
    prospectId: string;
  }>;
};

export async function POST(request: Request, context: ProspectAuditRouteContext) {
  try {
    const [{ prospectId }, body, { agency, user }] = await Promise.all([
      context.params,
      parseOptionalJsonBody(request),
      requireCurrentAgency(),
    ]);
    const result = startAuditSchema.safeParse(body);

    if (!result.success) {
      return jsonValidationError(result.error);
    }

    const prospect = await getProspect(prospectId, agency.id);

    assertProspectBelongsToAgency(prospect, agency.id);

    if (renderedAuditsRequested()) {
      // Fails closed until an isolated worker AND pinned egress are verified.
      assertRenderedAuditAvailable();
      const requestKey = z.uuid().safeParse(request.headers.get("idempotency-key"));
      if (!requestKey.success) throw new AppError("A valid idempotency key is required.", 400);
      await enforceAgencyUsageLimit({ agencyId: agency.id, userId: user.id, action: "website_analyzer" });
      const job = await submitRenderedAuditJob({ agencyId: agency.id, userId: user.id, prospect, requestKey: requestKey.data, store: createAuditJobStore() });
      return NextResponse.json({ data: job }, { status: 202 });
    }

    await enforceAgencyUsageLimit({
      agencyId: agency.id,
      userId: user.id,
      action: "website_analyzer",
    });

    const audit = await runAuditForProspect({
      agencyId: agency.id,
      prospect,
      auditInput: result.data,
    });

    return NextResponse.json({ data: audit }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
