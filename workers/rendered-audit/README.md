# Isolated rendered-audit runtime (not activated)

`src/features/audits/worker/run-job.ts` is the trusted Linux dispatcher entry
point. It calls the existing database-backed job executor with the real Docker
worker factory and static fallback. No new public endpoint enables it. The
application's availability gate remains closed.

The host must run as a dedicated non-root account with permission to control its
dedicated Docker daemon. Docker access is privileged host infrastructure; it must
never be granted to a customer or mounted into Chromium. A persistent dispatcher,
host admission limits, platform monitoring and deployment require separate review.

Each job gets a separate network namespace (`none`), read-only root filesystem,
no Linux capabilities, no-new-privileges, 2 GiB/1 CPU/256 PID limits and Chromium's
user-namespace sandbox. The digest-checked seccomp policy allows AF_UNIX sockets
only; IPv4, IPv6, legacy socketcall and io_uring networking bypasses are denied.
Do not relax this policy if Chromium fails the Linux acceptance test.

A private 0700 host directory contains only the 0600 broker socket. That directory
is mounted read-only at `/run/scanvoro`. A random per-job capability is delivered
over stdin to the controller process, never to page JavaScript, environment,
arguments or logs. HTTP and HTTPS are fetched by the existing pinned broker and
fulfilled into Chromium. There is no CONNECT tunnel, forward proxy or exposed
debugging TCP port. Only same-origin GET requests are eligible. Cookies and
authorization headers are not forwarded. Certificates and hostnames are verified
by the external broker's Node TLS transport; Chromium receives broker responses.

This conservative profile may block CDN resources or late hydration. Captures
are bounded snapshots, not proof of exhaustive site behavior. Blocked requests,
truncation and errors produce incomplete coverage. Redirects retain their final
document URL. Five pages / ten viewports remain enforced by the existing pipeline.

The host watchdog and container timeout expire before the 120-second database
lease. Cancellation terminates the container; unverified termination propagates
and prevents retry. Database fencing still rejects stale results. The watchdog
is not a substitute for a production host supervisor/admission policy.

## Pending Linux verification

The one-shot `rendered-worker-boundary.yml` workflow has not been executed.
It builds only explicitly copied public runtime sources, then exercises actual
Chromium through the job executor and disposable PostgreSQL. A synthetic TLS
fixture on the trusted host is the ONLY test destination; its narrow test-only
transport maps a validated synthetic address to loopback and verifies its exact
hostname using an ephemeral test CA. This exception is not in product code.

The suite checks OS socket denial, browser bypass attempts, authenticated Unix
IPC, HTTPS trust/name failures, rebinding/redirect denial, dynamic DOM, five-page
persistence, service matching, cancellation and actual worker crash. Local static
checks do not establish these runtime claims. No live website scans are enabled.
