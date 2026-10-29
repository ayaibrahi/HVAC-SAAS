import "server-only";
import { executeRenderedAuditJob } from "../jobs/execute";
import { createAuditJobStore } from "../jobs/repository";
import { safeFetchHtml } from "../analyzer/safe-fetch";
import { linuxWorkerFactory, type LinuxWorkerConfig } from "./linux-worker";

// Trusted Linux dispatcher entry point. Not a public route and not imported by
// the enabled static path. Database/admin credentials remain in this process.
// Dispatcher identity, deployment and execution admission require separate approval.
export async function runIsolatedAuditJob(agencyId: string, jobId: string, config: LinuxWorkerConfig) {
  return executeRenderedAuditJob({ agencyId, jobId, store: createAuditJobStore(),
    createWorker: linuxWorkerFactory(config), staticFallback: safeFetchHtml });
}
