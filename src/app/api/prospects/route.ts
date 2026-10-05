import { NextResponse } from "next/server";
import { jsonError, jsonValidationError, parseJsonBody } from "@/lib/api-response";
import { requireCurrentAgency } from "@/features/agencies/data";
import { createProspect, listProspects } from "@/features/prospects/data";
import { prospectInputSchema } from "@/lib/validation/prospects";

export async function GET() {
  try {
    const { agency } = await requireCurrentAgency();
    const prospects = await listProspects(agency.id);

    return NextResponse.json({ data: prospects });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await parseJsonBody(request);
    const result = prospectInputSchema.safeParse(body);

    if (!result.success) {
      return jsonValidationError(result.error);
    }

    const prospect = await createProspect(result.data);

    return NextResponse.json({ data: prospect }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
