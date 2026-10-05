import type { ProposalDeliverySnapshot } from "@/domain/proposals/types";
import { AppError } from "@/lib/errors";

export function assertPdfSnapshot(
  snapshot: ProposalDeliverySnapshot | null,
): asserts snapshot is ProposalDeliverySnapshot {
  if (!snapshot) {
    throw new AppError("Delivery snapshot not found.", 404);
  }

  if (snapshot.lineItems.length === 0) {
    throw new AppError("Delivery snapshot is not ready for PDF export.", 409);
  }
}
