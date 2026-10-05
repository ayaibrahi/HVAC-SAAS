import { NextResponse } from "next/server";
import { jsonError, jsonValidationError, parseJsonBody } from "@/lib/api-response";
import { requireCurrentAgency } from "@/features/agencies/data";
import {
  deleteProspect,
  getProspect,
  updateProspect,
} from "@/features/prospects/data";
import { prospectInputSchema } from "@/lib/validation/prospects";

type ProspectRouteContext = {
  params: Promise<{
    prospectId: string;
  }>;
};

export async function GET(_request: Request, context: ProspectRouteContext) {
  try {
    const [{ prospectId }, { agency }] = await Promise.all([
      context.params,
      requireCurrentAgency(),
    ]);
    const prospect = await getProspect(prospectId, agency.id);

    if (!prospect) {
      return NextResponse.json({ error: "Prospect not found." }, { status: 404 });
    }

    return NextResponse.json({ data: prospect });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: Request, context: ProspectRouteContext) {
  try {
    const { prospectId } = await context.params;
    const body = await parseJsonBody(request);
    const result = prospectInputSchema.safeParse(body);

    if (!result.success) {
      return jsonValidationError(result.error);
    }

    const prospect = await updateProspect(prospectId, result.data);

    return NextResponse.json({ data: prospect });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(_request: Request, context: ProspectRouteContext) {
  try {
    const { prospectId } = await context.params;

    await deleteProspect(prospectId);

    return NextResponse.json({ data: { deleted: true } });
  } catch (error) {
    return jsonError(error);
  }
}
