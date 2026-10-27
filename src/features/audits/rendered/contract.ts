import { z } from "zod";

// This is an untrusted worker-output boundary, not a client request contract.
// No cookies, HTML scripts, form values, agency identifiers or credentials cross it.
export const renderedLimits = {
  pages: 5, links: 100, discovered: 200, documentBytes: 131072,
  pageTimeoutMs: 8000, jobTimeoutMs: 90000,
} as const;
export const viewportSchema = z.enum(["desktop", "mobile"]);
export type RenderViewport = z.infer<typeof viewportSchema>;
const label = z.string().max(240);
export const renderedDocumentSchema = z.object({
  title: z.string().max(300),
  text: z.string().max(30000),
  headings: z.array(label).max(20),
  links: z.array(z.object({ text: label, href: z.string().max(2048) }).strict()).max(100),
  buttons: z.array(label).max(30),
  forms: z.array(label).max(10),
  truncated: z.boolean(),
}).strict();
export type RenderedDocument = z.infer<typeof renderedDocumentSchema>;
export const renderedCaptureSchema = z.object({
  requestedUrl: z.string().max(2048).url(), finalUrl: z.string().max(2048).url(),
  viewport: viewportSchema,
  status: z.enum(["observed", "incomplete"]),
  reasons: z.array(z.enum(["timeout", "script_error", "blocked_request", "http_error", "limit"])).max(5),
  httpStatus: z.number().int().min(100).max(599),
  elapsedMs: z.number().int().min(0).max(renderedLimits.pageTimeoutMs),
  document: renderedDocumentSchema,
}).strict();
export type RenderedCapture = z.infer<typeof renderedCaptureSchema>;

// Implementations MUST live behind an isolated worker with enforced egress,
// deadlines and termination. AbortSignal alone cannot terminate Chromium.
// No implementation is selected by a client or enabled by a default env value.
export interface RenderedAuditWorker {
  capture(input: { url: string; viewport: RenderViewport; signal: AbortSignal }): Promise<unknown>;
  close(): Promise<void>;
}

export function parseRenderedCapture(value: unknown): RenderedCapture {
  // String transport is bounded BEFORE parsing. In-process trusted adapters must
  // also cap IPC bytes; JSON.stringify is not an arbitrary-object memory limit.
  if (typeof value !== "string" || Buffer.byteLength(value) > renderedLimits.documentBytes)
    throw new Error("Invalid rendered result size");
  return renderedCaptureSchema.parse(JSON.parse(value));
}
