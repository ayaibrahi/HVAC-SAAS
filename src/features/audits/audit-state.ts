import type { AuditStatus } from "@/domain/audits/types";
import { AppError } from "@/lib/errors";

const allowedTransitions: Record<AuditStatus, AuditStatus[]> = {
  pending: ["running", "failed"],
  running: ["completed", "failed"],
  completed: [],
  failed: [],
};

export function assertAuditStatusTransition(from: AuditStatus, to: AuditStatus) {
  if (!allowedTransitions[from].includes(to)) {
    throw new AppError(`Audit cannot move from ${from} to ${to}.`, 400);
  }
}

export function transitionAuditStatus(from: AuditStatus, to: AuditStatus) {
  assertAuditStatusTransition(from, to);

  return to;
}
