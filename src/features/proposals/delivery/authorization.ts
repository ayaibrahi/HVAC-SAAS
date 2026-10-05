import type { ProposalDeliverySnapshot } from "@/domain/proposals/types";
import { AppError } from "@/lib/errors";

export function assertDeliverySnapshotAccess(input: {
  agencyId: string;
  snapshot: ProposalDeliverySnapshot | null;
}): asserts input is {
  agencyId: string;
  snapshot: ProposalDeliverySnapshot;
} {
  if (!input.snapshot || input.snapshot.agencyId !== input.agencyId) {
    throw new AppError("Delivery snapshot not found.", 404);
  }
}
