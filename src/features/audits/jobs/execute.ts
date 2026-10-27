import type { Json } from "@/lib/supabase/database.types";
import type { SafeFetchResult } from "../analyzer/safe-fetch";
import type { RenderedAuditWorker } from "../rendered/contract";
import { inspectRenderedSite, hasVerifiedRenderedContent } from "../rendered/pipeline";
import type { AuditJobStore } from "./repository";

// Only a trusted provider may raise this when it can prove no worker was
// allocated. Unknown startup failures are terminal to avoid overlapping VMs.
export class WorkerUnavailableBeforeStart extends Error {}

// Server-side orchestration; never invoked by a client. Worker creation must be
// provided by a reviewed isolated backend with independently enforced egress.
export async function executeRenderedAuditJob(input: {
  agencyId: string; jobId: string; store: AuditJobStore;
  createWorker: () => Promise<RenderedAuditWorker>;
  staticFallback: (url: string) => Promise<SafeFetchResult>;
}): Promise<"not_claimed" | "completed" | "retry_or_failed" | "lease_lost"> {
  const lease = await input.store.claim({ agencyId: input.agencyId, jobId: input.jobId });
  if (!lease) return "not_claimed";
  let result: Json | null = null;
  let retry = false;
  let allocated = false;
  try {
    const worker = await input.createWorker();
    allocated = true;
    // Once allocated, an exception may mean cleanup/termination failed. Never
    // start another sandbox unless the prior worker has closed successfully.
    retry = false;
    const renderedAudit = await inspectRenderedSite({ url: lease.website_url, worker, staticFallback: input.staticFallback });
    retry = true; // inspectRenderedSite returned only after worker.close succeeds.
    const envelope = { renderedAudit };
    if (!hasVerifiedRenderedContent(envelope, lease.website_url)) throw new Error("No verified page content");
    result = envelope as unknown as Json;
  } catch (error) {
    if (!allocated && error instanceof WorkerUnavailableBeforeStart) retry = true;
    // Bounded retry is enforced in the DB; no provider/raw error or partial
    // signals are persisted. A late worker cannot override the newer lease.
  }
  const saved = await input.store.finish({ agencyId: input.agencyId, jobId: input.jobId, leaseToken: lease.lease_token, result, retry: result === null && retry });
  if (!saved) return "lease_lost";
  return result === null ? "retry_or_failed" : "completed";
}
