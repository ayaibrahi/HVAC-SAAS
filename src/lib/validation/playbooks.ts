import { z } from "zod";
import { defaultPlaybookVersion, verticalPlaybookKeys } from "@/config/vertical-playbooks";

export const semanticVersionSchema = z
  .string()
  .trim()
  .regex(/^\d+\.\d+\.\d+$/, "Use a semantic version like 1.0.0.");

export const verticalPlaybookKeySchema = z.enum(verticalPlaybookKeys);

export const playbookMetadataSchema = z.object({
  verticalKey: verticalPlaybookKeySchema,
  playbookVersion: semanticVersionSchema.default(defaultPlaybookVersion),
});

export type PlaybookMetadataInput = z.infer<typeof playbookMetadataSchema>;
