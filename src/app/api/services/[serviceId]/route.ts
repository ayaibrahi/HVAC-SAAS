import { NextResponse } from "next/server";
import { jsonError, jsonValidationError, parseJsonBody } from "@/lib/api-response";
import { agencyServiceInputSchema } from "@/lib/validation/services";
import {
  deleteAgencyService,
  getAgencyService,
  updateAgencyService,
} from "@/features/services/data";
import { requireCurrentAgency } from "@/features/agencies/data";

type ServiceRouteContext = {
  params: Promise<{
    serviceId: string;
  }>;
};

export async function GET(_request: Request, context: ServiceRouteContext) {
  try {
    const [{ serviceId }, { agency }] = await Promise.all([
      context.params,
      requireCurrentAgency(),
    ]);
    const service = await getAgencyService(serviceId, agency.id);

    if (!service) {
      return NextResponse.json({ error: "Service not found." }, { status: 404 });
    }

    return NextResponse.json({ data: service });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: Request, context: ServiceRouteContext) {
  try {
    const { serviceId } = await context.params;
    const body = await parseJsonBody(request);
    const result = agencyServiceInputSchema.safeParse(body);

    if (!result.success) {
      return jsonValidationError(result.error);
    }

    const service = await updateAgencyService(serviceId, result.data);

    return NextResponse.json({ data: service });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(_request: Request, context: ServiceRouteContext) {
  try {
    const { serviceId } = await context.params;

    await deleteAgencyService(serviceId);

    return NextResponse.json({ data: { deleted: true } });
  } catch (error) {
    return jsonError(error);
  }
}
