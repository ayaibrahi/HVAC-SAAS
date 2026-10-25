# Rendered and Multi-page Audit: Feasibility Gate

Reviewed 2026-10-24 against `48d707c483dfb87326a5cbd5ecf1c194cfffb07e`.
Local branch: `codex/rendered-audit-feasibility`.

## Decision and Actual Work

STOP at the isolation gate. This is a design and inspection result, not a working
rendered crawler. No Playwright dependency, browser worker, new analyzer route,
database migration, external scan, infrastructure or deployment was introduced.
The existing authenticated SaaS and protected Preview remain unchanged.

The owner explicitly requires stopping if safe isolation cannot be demonstrated.
An ordinary Chromium child process with request interception does not demonstrate
OS-enforced egress containment. No such containment was verified on this host.
We must not represent a fixture-only mock or a browser routing test as proving it.

Observed local environment:

- Windows 11 Pro x64; 15.19 GiB usable RAM, 1.98 GiB available at inspection.
- C: free space: 15,447,883,776 bytes (14.39 GiB) at inspection.
- Docker Desktop files and CLI exist, but its backend processes were not observed.
- `wsl --list --verbose` reports only `docker-desktop`, stopped, WSL version 2.
- Windows network/virtualization services are running; that is NOT proof of an
  isolated worker or its firewall policy.
- Chrome and Edge are installed. Neither is an isolated audit environment.
- Neither `playwright` nor `playwright-core` is installed in this repository.
- No browser installation was found at the default local `ms-playwright` cache.
  Other tool-owned browser installations were not inventoried or reused.

Docker was not started. No firewall, WSL, Windows, Vercel or Supabase settings
were changed. Tooling downloads and account/billing changes were not performed.

## Current Engine and Compatibility Boundaries

`src/features/audits/analyzer/safe-fetch.ts` fetches one static response using
explicit DNS validation and a pinned Node HTTP(S) socket, original Host and TLS
servername. Defaults: 10-second total deadline, 1,000,000 response bytes and three
redirects. `url-safety.ts` restricts protocols/ports and rejects private, loopback,
link-local and several embedded IPv4/IPv6 forms. Each redirect is revalidated.

This transport does not fetch JavaScript, stylesheets, frames, sitemaps or robots
rules. It accepts identity encoding and selected text content types. It is NOT a
general browser-resource broker; using it unchanged for scripts/CSS would fail.
Its current IP deny rules also need a complete special-use address review before
reuse as the browser broker, including IPv6 transition/deprecated ranges.

`html.ts` is a bounded static tokenizer, not a browser DOM/CSS implementation.
`signals.ts` emits schema 1.1.0, including nullable booking signals and explicit
statements that static controls do not prove booking functionality.
`content-quality.ts` rejects known access notices, incomplete markup and thin
content. Passing it does not prove hydration, responsive visibility or full-site
coverage. A browser may still receive a challenge; do not bypass it.

`run-audit.ts` executes the single-page operation inside the existing action
lifecycle. There is no durable crawl queue, worker lease or per-page recovery
ledger. Authorization and the active-audit uniqueness guard must be preserved.

The local schema has one `audits.normalized_signals` JSON value and a final URL.
Composite foreign keys bind audits/opportunities to agency and prospect. An
opportunity is unique on `(audit_id, rule_key)`. Evidence validation requires
`scope = analyzed_page` and `source = deterministic_analyzer`; an evidence item's
optional URL is not a required page-provenance envelope. Do not concatenate
multiple DOMs into that old contract or silently label rendered data as static.

Use a new versioned rendered-result contract in a standalone worker package.
Do not persist it through current consumers until a reviewed adapter and explicit
schema/version compatibility tests exist. Retain legacy audit behavior and all
service mapping, approved scope, pricing, proposal and snapshot contracts.

## Recommended Architecture (Not Implemented)

1. Existing Next.js server authenticates and derives agency/prospect ownership;
   accepts only an owned prospect and bounded mode, not caller-supplied evidence.
2. A durable job stores the immutable target, engine version, budgets, owner,
   state, lease, deadline and attempt identity. Atomic claims and fenced writes
   prevent duplicate workers or stale completions. No automatic navigation retry
   in the first release; expired jobs become explicitly incomplete.
3. A trusted coordinator handles job state and validation. The browser receives
   only its target and policy, not database credentials, provider keys, cookies,
   repository mounts, user profiles or tenant history.
4. A disposable non-root Linux browser worker runs Chromium with its sandbox
   enabled, capped CPU/RAM/PIDs, read-only root filesystem and bounded scratch
   space. No host networking, Docker socket, privileged capabilities or host
   credentials. The supervisor kills the entire process tree at the deadline.
5. Browser egress is denied at the OS/network boundary. For the first local
   milestone use a network-disabled worker and bundled controlled fixtures.
   Browser automation uses a local pipe, not an externally exposed CDP port.
6. A later public-fetch broker is the only permitted network path. For every
   request and redirect it validates URL, protocol, port, origin policy, all DNS
   answers and the selected socket IP. TLS hostname verification remains enabled.
   The browser cannot connect directly, including DNS/UDP/QUIC/WebRTC/WebSockets.
   A proxy hostname allowlist alone is insufficient against DNS rebinding.
7. Broker responses are bounded before browser delivery, including decompression
   and aggregate byte limits. Strip cookies/auth and response Set-Cookie; refuse
   uploads, non-read methods, downloads, login and side-effectful routes. Use
   direct navigation only; never click, submit forms or exercise booking widgets.
8. Validate bounded output outside the browser: source/final URL, viewport,
   readiness, resource failures, evidence excerpts, page fingerprint and coverage.
   Treat browser-produced values as untrusted observations, not instructions.

For public fetching, rendering interception can deliver broker-fetched bytes via
Playwright routes, but never `route.continue()`/`route.fetch()` to arbitrary sites.
Keep TLS, DNS and resource limits in the broker and enforce no alternate egress
outside Playwright. Block service workers and new WebSockets before any page is
created; these are defense in depth, not the containment boundary.

GET is not universally side-effect-free. Restrict document navigation to public
content routes, exclude login/logout/cart/checkout/action paths and ambiguous
query URLs. Do not claim a general guarantee that arbitrary GET requests cannot
cause external writes. Public scans still require separately approved targets.

## Rendering, Discovery and Evidence Contract

- Desktop 1440x900 and mobile 390x844, fresh context per viewport, sequential.
- DOMContentLoaded plus bounded readiness observations: representative visible
  main text, stable visible content across samples and no unresolved critical
  resource failures. Stability is an observation, not proof hydration finished.
  Do not use networkidle as a universal success criterion.
- Extract bounded visible text and controls with computed visibility, accessible
  names, hrefs, form structure, tel links and surrounding evidence. Do not read
  field values, submit forms, click CTAs, defeat consent or solve challenges.
- Delayed/failed scripts, inaccessible frames/widgets, challenge pages, timeout
  and extraction caps produce incomplete/unknown coverage. Positive observations
  may remain valid; negative opportunities require adequate inspected coverage.
- Sitemap discovery uses a maintained XML parser with DTD/external entities
  disabled, byte/node/depth limits and no recursive sitemap explosion.
- Use a maintained RFC 9309-compatible robots parser. Fetch policy before target
  pages; honor disallow and rate limits. Network/5xx robots failure means stop,
  not allow. Conservatively stop on 401/403/429; allow a genuine 404 absence.
  Read at least the RFC's 500 KiB parsing floor; use a 512 KiB cap and fail closed
  on truncation. Resolve and validate every robots redirect as well.
- Restrict documents to the approved origin, including every redirect. A www or
  scheme change must be explicitly added to the job policy, not trusted because
  a target redirects there. Prioritize home, services, contact, quote and booking.
- Normalize URL protocol/host/default ports and remove fragments. Preserve path
  case and significant queries; skip query variants by default with a reason.
  Do not treat an untrusted canonical tag as permission to cross an origin or
  discard distinct pages. Deduplicate final URLs and measured content hashes.
- Third-party CDN/widget assets require explicit broker policy and independent
  address validation. Blocked dependencies make affected observations unknown.
  External booking links can be observed without visiting or exercising them.
- Record a bounded per-URL disposition: inspected, failed, skipped (with reason)
  or out-of-scope. Count discovered candidates separately from render attempts
  and unique final pages; do not double-count desktop/mobile as distinct pages.
  Record when discovery itself is truncated. No whole-site completion claim.
- Each finding references exact source/final URL, viewport, observation time,
  status, limited excerpt and evidence identity. Group repeated findings by rule
  while retaining every supporting page reference; count repeated header CTAs
  once per relevant observation. Call aggregated scope `inspected_pages`, not
  entire website. A positive on another page prevents an unsupported site-level
  absence claim. Keep page-specific issues separate from coverage summaries.

## Initial Hard Budgets (Proposed, Not Benchmarked)

| Resource | Initial budget |
| --- | --- |
| Concurrent jobs / pages / viewports | 1 / 1 / 1 |
| Unique pages | Default 5, configurable maximum 10 |
| Complete job wall time | Default 180 s, hard maximum 300 s including discovery |
| Render deadline | 15 s per viewport, bounded by remaining job deadline |
| Document / individual resource | 1 MiB / 2 MiB decoded, wire bytes capped too |
| Resources per render | 60 requests, 4 MiB total; blocked requests count too |
| Whole job resource budget | 40 MiB, 600 requests including discovery/redirects |
| Discovery | 200 candidates, 2 sitemap documents, depth at most 1 |
| Sitemap / robots bytes | 1 MiB / 512 KiB; reject truncated parsing |
| Redirect hops | 3 per page/resource, 5 for robots within global deadline |
| Origin pacing | At least 1 s between documents; honor longer declared limits |
| Evidence | 20 items/page, 240 characters/excerpt, no full HTML retention |
| Result envelope | 512 KiB serialized maximum |
| Worker CPU / RAM / scratch | 1 vCPU / 2 GiB / 256 MiB initial limits |

These are conservative experiments, not promises for all websites. Budget hits
must produce explicit partial results, never missing-feature assertions. Runtime
and memory caps must be enforced outside a potentially wedged renderer. Before a
local Docker run, target at least 4 GiB available host RAM and 8 GiB free disk,
recheck actual image size and reserve OS headroom. Do not terminate owner apps
or change Docker/WSL allocations automatically.

## Acceptance Matrix (Not Yet Executed)

| Fixture or adversary | Required evidence |
| --- | --- |
| Static positive/negative HVAC pages | Same intended observations as existing frozen fixtures |
| Locally bundled React client rendering | JS-inserted visible phone and booking detected; no shell absence |
| Responsive and hidden controls | Viewport-specific evidence, hidden controls excluded |
| Multi-page home/service/contact | Deterministic priority, exact page URLs and reconciled counts |
| Redirects, duplicates, canonicals | No off-scope follow; no duplicate final-page findings |
| Mock booking widget | Presence only; zero submissions/reservations/functional-success claims |
| Slow, broken, endless scripts | Bounded exit; unknown evidence; no orphan processes |
| Robots disallow/5xx/429/oversize | No disallowed page fetch; explicit incomplete coverage |
| Private/mapped IPv6, rebinding, redirect | Broker rejects before socket; per-hop pinned IP tested |
| Fetch, frames, workers, WS, UDP bypass | OS boundary denies actual outbound packets, not just mocks |
| Huge DOM/response/decompression bomb | Process and byte limits enforced; bounded output |
| Two jobs / stale lease / foreign agency | No shared browser profile or cross-job persistence |

Every fixture needs a frozen expected manifest. Count false-positive absence
findings (target zero), positive recall for supported fixtures, explicit partial
states, total request count/bytes and wall/CPU/peak process-tree RAM. Test supervisor
cleanup after crash and hard timeout. Separate malicious fixture tests from real
external authorization. Existing unit tests alone cannot certify these controls.

## Hosting and Cost Assessment

Keep the UI and short authenticated dispatch/status endpoints on existing Vercel.
Do not add Chromium to the Next.js request path. Current Vercel documentation
lists a 250 MB standard uncompressed Function bundle and a 5 GB large-functions
beta, plus plan/runtime-specific duration and memory ceilings. Larger bundles or
timeouts do not establish crawler isolation or durable execution. Existing plan,
beta enrollment and worker entitlements were not inspected or assumed.

Cheapest next experiment: existing local Docker/WSL installation, only after
explicit startup and image-download approval. Network-disabled synthetic worker
first; no public crawling. Docker Desktop licensing eligibility must be checked
for the owner's organization. A container alone is not a sufficient design for
hostile websites; sandbox, mount isolation, egress and resource tests are required.

Hosted candidate to evaluate later: a disposable VM/microVM worker with enforceable
network policy and a separate broker. Vercel Sandbox documents deny-all networking
and metered compute. This is distinct from existing Vercel Functions, not an
already configured capability. Free quota eligibility, regional availability,
commercial terms and existing account usage must be verified before selection.
No paid infrastructure is proven necessary yet, and none is authorized here.

Illustrative Sandbox estimate, NOT a measurement or quote: at published iad1
rates of $0.128/active CPU-hour and $0.0212/GB-hour, a 2-minute, 2 GB run using
15-60 CPU-seconds costs about $0.00195-$0.00355 for compute plus one creation.
This excludes subscription, broker, jobs/database, transfer, image storage,
startup and operational costs. Actual CPU consumption may be much higher; do
not use examples assuming mostly idle AI workloads to price browser crawling.
Published Hobby quotas are not verified free capacity for this account.

No rendering CPU, peak RAM, duration, installed browser bundle size or per-scan
cost was measured in this task because the isolation gate stopped execution.
Resource numbers above are design budgets or explicitly illustrative estimates.

## Next Approval and Deployment Gate

Request permission to start the existing Docker Desktop Linux engine and prepare
one capped, disposable, network-disabled fixture worker, including reviewed
Playwright/Chromium downloads (reserve up to 4 GiB disk), after the owner frees
sufficient RAM. No system firewall changes, privileged container, host mounts,
real scans, Supabase access or deployment are included in that proposed approval.
Stop if Chromium sandbox and resource/network restrictions cannot be enabled.

After offline isolation and rendered-fixture tests pass, seek separate approval
for a constrained broker/worker environment and durable tenant-scoped job schema.
Review migrations, result-version compatibility, idempotency, tenant isolation,
cost caps and explicit kill switch before any Preview deployment. Preserve the
existing single-page analyzer until replacement acceptance. Real websites need
their own bounded authorization. Aya's current Preview needs no changes now.

## Verification Performed

`npm run test -- src/features/audits src/features/opportunities`: 22 test files,
363 tests passed, exit 0 (1.27 s reported duration). The initial Windows sandbox
run could not load Vitest temporary transformed modules; the identical command
passed with approved host execution. These existing tests use controlled inputs,
not real external scans or AI requests. They do not verify rendered crawling.

`git diff --check` passed. Application code, package manifests, lockfile and
migrations are unchanged. Build/lint/typecheck were not rerun for this
documentation-only result. The feature branch and master still point to their
original commits. No commit or push was made; this document is a local new file.

## Official References

- [Playwright browser launch and sandbox defaults](https://playwright.dev/docs/api/class-browsertype#browser-type-launch)
- [Playwright routing and Service Worker limitations](https://playwright.dev/docs/api/class-browsercontext#browser-context-route)
- [Playwright container guidance and untrusted-site warning](https://playwright.dev/docs/docker)
- [Vercel Function limits](https://vercel.com/docs/functions/limitations)
- [Vercel large Functions beta](https://vercel.com/changelog/vercel-functions-can-now-be-up-to-5-gb-in-package-size-7yAwSyCig0IQDXUIDistvS/eadf06d6c3)
- [Vercel Sandbox network controls](https://vercel.com/sandbox)
- [Vercel Sandbox pricing](https://vercel.com/docs/sandbox/pricing)
- [Docker Desktop Windows requirements and licensing](https://docs.docker.com/desktop/setup/install/windows-install/)
- [RFC 9309 robots rules](https://www.rfc-editor.org/rfc/rfc9309.html)
