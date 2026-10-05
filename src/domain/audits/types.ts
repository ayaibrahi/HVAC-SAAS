import type { VerticalPlaybookKey } from "@/config/vertical-playbooks";
import type { EntityId, Timestamp } from "@/domain/shared";

export type AuditStatus = "pending" | "running" | "completed" | "failed";

export type Audit = {
  id: EntityId;
  agencyId: EntityId;
  prospectId: EntityId;
  status: AuditStatus;
  websiteUrl: string;
  finalUrl: string | null;
  startedAt: Timestamp | null;
  completedAt: Timestamp | null;
  errorCode: string | null;
  errorMessage: string | null;
  normalizedSignals: Record<string, unknown>;
  signalSchemaVersion: string;
  verticalKey: VerticalPlaybookKey;
  playbookVersion: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};
