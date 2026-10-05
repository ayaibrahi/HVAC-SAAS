import "server-only";

import type { ProposalDeliverySnapshot } from "@/domain/proposals/types";
import { getDeliverySnapshot } from "@/features/proposals/delivery/data";
import { buildProposalPdfFilename } from "@/features/proposals/pdf/filename";
import { renderProposalPdf } from "@/features/proposals/pdf/renderer";
import type { ProposalPdfDownload } from "@/features/proposals/pdf/response";
import { assertPdfSnapshot } from "@/features/proposals/pdf/snapshot";
import { buildProposalPdfView } from "@/features/proposals/pdf/view-model";

export async function createProposalPdfDownload(snapshotId: string) {
  const snapshot = await getDeliverySnapshot(snapshotId);

  return createProposalPdfDownloadFromSnapshot(snapshot);
}

export function createProposalPdfDownloadFromSnapshot(
  snapshot: ProposalDeliverySnapshot | null,
): ProposalPdfDownload {
  assertPdfSnapshot(snapshot);

  const view = buildProposalPdfView(snapshot);

  return {
    filename: buildProposalPdfFilename(view),
    bytes: renderProposalPdf(view),
  };
}
