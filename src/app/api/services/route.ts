import { NextResponse } from "next/server";
import { jsonError, jsonValidationError, parseJsonBody } from "@/lib/api-response";
import { agencyServiceInputSchema } from "@/lib/validation/services";
import { requireCurrentAgency } from "@/features/agencies/data";
import { createAgencyService, listAgencyServices } from "@/features/services/data";

export async function GET() {
  try {
    const { agency } = await requireCurrentAgency();
    const services = await listAgencyServices(agency.id);

    return NextResponse.json({ data: services });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await parseJsonBody(request);
    const result = agencyServiceInputSchema.safeParse(body);

    if (!result.success) {
      return jsonValidationError(result.error);
    }

    const service = await createAgencyService(result.data);

    return NextResponse.json({ data: service }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
