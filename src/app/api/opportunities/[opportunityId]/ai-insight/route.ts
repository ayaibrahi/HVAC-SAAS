import { NextResponse } from "next/server";
import { generateOpportunityAiInsightForOpportunity } from "@/features/opportunities/ai/data";
import { jsonError, jsonValidationError } from "@/lib/api-response";
import { generateOpportunityAiInsightInputSchema } from "@/lib/validation/opportunity-ai-insights";

type OpportunityAiInsightRouteContext = {
  params: Promise<{
    opportunityId: string;
  }>;
};

export async function POST(
  _request: Request,
  context: OpportunityAiInsightRouteContext,
) {
  try {
    const { opportunityId } = await context.params;
    const result = generateOpportunityAiInsightInputSchema.safeParse({
      opportunityId,
    });

    if (!result.success) {
      return jsonValidationError(result.error);
    }

    const insight = await generateOpportunityAiInsightForOpportunity(
      result.data.opportunityId,
    );

    return NextResponse.json({ data: insight }, { status: 200 });
  } catch (error) {
    return jsonError(error);
  }
}
