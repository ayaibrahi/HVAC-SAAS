import { NextResponse } from "next/server";
import { createProposalPdfDownload } from "@/features/proposals/pdf/data";
import { createProposalPdfResponse } from "@/features/proposals/pdf/response";
import { jsonError } from "@/lib/api-response";
import { proposalPdfDownloadInputSchema } from "@/lib/validation/proposal-pdf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ProposalPdfRouteContext = {
  params: Promise<{
    snapshotId: string;
  }>;
};

export async function GET(_request: Request, context: ProposalPdfRouteContext) {
  try {
    const { snapshotId } = await context.params;
    const result = proposalPdfDownloadInputSchema.safeParse({ snapshotId });

    if (!result.success) {
      return NextResponse.json(
        { error: "Delivery snapshot not found." },
        {
          status: 404,
          headers: {
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff",
          },
        },
      );
    }

    const download = await createProposalPdfDownload(result.data.snapshotId);

    return createProposalPdfResponse(download);
  } catch (error) {
    const response = jsonError(error);

    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("X-Content-Type-Options", "nosniff");

    return response;
  }
}
