import "server-only";
import { AppError } from "@/lib/errors";

// A flag alone must never enable unverified network execution. No isolated
// backend/egress broker has yet passed adversarial tests in this project.
export function assertRenderedAuditAvailable(): void {
  throw new AppError("JavaScript-rendered analysis is not available yet.", 503);
}

export function renderedAuditsRequested(): boolean {
  return process.env.SCANVORO_RENDERED_AUDITS_ENABLED === "1";
}
