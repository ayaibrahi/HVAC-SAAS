import type { Prospect } from "@/domain/prospects/types";
import { AppError } from "@/lib/errors";

export function assertProspectBelongsToAgency(
  prospect: Prospect | null,
  agencyId: string,
): asserts prospect is Prospect {
  if (!prospect || prospect.agencyId !== agencyId) {
    throw new AppError("Prospect not found.", 404);
  }
}
