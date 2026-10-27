import type { Prospect } from "@/domain/prospects/types";
import { assertProspectBelongsToAgency } from "../authorization";
import type { AuditJobStore } from "./repository";

// The caller loads the agency/user and prospect through the existing server
// authentication path. The RPC independently checks their relationship again.
export async function submitRenderedAuditJob(input: {
  agencyId: string; userId: string; prospect: Prospect | null; requestKey: string; store: AuditJobStore;
}) {
  assertProspectBelongsToAgency(input.prospect, input.agencyId);
  return input.store.enqueue({ agencyId: input.agencyId, userId: input.userId, prospectId: input.prospect.id, requestKey: input.requestKey });
}
