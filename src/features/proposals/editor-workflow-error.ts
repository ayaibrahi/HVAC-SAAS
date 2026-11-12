import { AppError } from "@/lib/errors";

// Only raised after persistence succeeded; reload the authoritative revision,
// including any timestamp changes made by generation lease acquisition/release.
export class ProposalWorkflowSavedError extends AppError {}
