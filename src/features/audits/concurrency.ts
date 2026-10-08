import type { Audit } from "@/domain/audits/types";

export function isActiveAuditStatus(status: Audit["status"]) {
  return status === "pending" || status === "running";
}

export function isUniqueViolation(error: { code?: string } | null | undefined) {
  return error?.code === "23505";
}
