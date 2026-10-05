import { NextResponse } from "next/server";
import { generateOpportunitiesForAudit } from "@/features/opportunities/data";
import { jsonError, jsonValidationError } from "@/lib/api-response";
import { generateOpportunitiesInputSchema } from "@/lib/validation/opportunities";

type AuditOpportunitiesRouteContext = {
  params: Promise<{
    auditId: string;
  }>;
};

export async function POST(
  _request: Request,
  context: AuditOpportunitiesRouteContext,
) {
  try {
    const { auditId } = await context.params;
    const result = generateOpportunitiesInputSchema.safeParse({ auditId });

    if (!result.success) {
      return jsonValidationError(result.error);
    }

    const opportunities = await generateOpportunitiesForAudit(result.data.auditId);

    return NextResponse.json({ data: opportunities }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
