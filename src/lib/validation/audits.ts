import { z } from "zod";
import { defaultVerticalPlaybookKey } from "@/config/vertical-playbooks";
import { playbookMetadataSchema, semanticVersionSchema } from "@/lib/validation/playbooks";

export const auditStatusSchema = z.enum(["pending", "running", "completed", "failed"]);

export const normalizedSignalsSchema = z
  .record(z.string(), z.unknown())
  .default({});

export const auditStorageSchema = z
  .object({
    status: auditStatusSchema.default("pending"),
    finalUrl: z.string().url().optional().nullable(),
    startedAt: z.string().datetime().optional().nullable(),
    completedAt: z.string().datetime().optional().nullable(),
    errorCode: z.string().trim().min(1).max(120).optional().nullable(),
    errorMessage: z.string().trim().min(1).max(1000).optional().nullable(),
    normalizedSignals: normalizedSignalsSchema,
    signalSchemaVersion: semanticVersionSchema.default("1.0.0"),
  })
  .merge(
    playbookMetadataSchema.partial().extend({
      verticalKey: playbookMetadataSchema.shape.verticalKey.default(defaultVerticalPlaybookKey),
    }),
  );

export type AuditStorageInput = z.infer<typeof auditStorageSchema>;

export const startAuditSchema = playbookMetadataSchema.partial().default({});

export type StartAuditInput = z.infer<typeof startAuditSchema>;
