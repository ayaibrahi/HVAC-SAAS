# Rendered audit integration — 26 October 2026

## Release status

Local integration branch: `codex/rendered-audit-integration`. Not a deployable
JavaScript-scanning release. Application routes still select the static analyzer.
No worker credentials, SDK, dependency, migration or default activation was added.
Both experimental branch names are excluded by exact Vercel deployment rules.

## Implemented application code

- `audits/rendered/contract.ts`: strict bounded worker response (128 KiB before
  JSON parsing), explicit incomplete reasons, bounded DOM collections.
- `dom.ts` / `playwright-capture.ts`: real Page.evaluate callback and Page adapter,
  visible links, CTA/phone/form/booking evidence, no interactions or input values.
  A 500 ms observation window is a snapshot, not proof that all scripts finished.
- `discovery.ts` / `pipeline.ts`: at most five same-origin important pages,
  desktop/mobile captures, eight seconds per capture and 90 seconds traversal,
  separate five-second cleanup deadline. One existing safe static homepage fetch
  is allowed only after confirmed worker cleanup and no observed rendered page.
  Static fallback retains its own source and existing transport limits.
- Explicit failed/incomplete/observed state; unknown rendering never becomes
  absence. Full-site coverage is always false. Coverage counts include observed
  viewports, overlapping page outcomes, skipped pages and discovery truncation.
- Existing engine-owned audit JSON can store `rendered-1` under signal schema
  `2.0.0`; no database change is needed for these result fields. The server-only
  dependency seam cannot be enabled by a client form, URL or environment default.
- Opportunity rules operate on each verified page; deterministic first occurrence
  per rule is retained, with exact URL/viewport/source. Existing ranking/top five
  remains. Contradictory page observations are not merged into a site-wide claim.
- Approved service deliverables/exclusions override marketing labels. Missing,
  malformed, excluded or ambiguous approved capabilities stay unmatched. Legacy
  services without approved scope retain existing matching. Pricing is unchanged.
- Selected-workspace coverage is tenant filtered and displayed in English/Arabic.

These are tested integration components, not a deployed browser service. The new
Page adapter/extractor has not yet received a successful real-browser regression.
Existing AI canonical-rule reconstruction still assumes static audit signals and
fails closed for the new envelope. Multi-page AI narrative/source compatibility
must be implemented and tested before rendered findings can feed live proposals.

## Actual CI result

One authorized experimental push: `c85189e129d029719795dbd5b835e283748b9476`.
[Run 40273500529](https://github.com/ayaibrahi/HVAC-SAAS/actions/runs/40273500529)
failed; no automatic rerun or additional fix push occurred.

Container creation/configuration and cleanup succeeded. Chromium aborted during
sandbox startup at `sys_chroot("/proc/self/fdinfo/")`; the 13 final browser tests
did not complete. Peak cgroup memory was 179,204,096 bytes, CPU usage 804,920 us,
suite elapsed 1,761 ms, exit 1, no OOM. These measure failed startup, not scanning.
The committed official seccomp profile permits `chroot` only when Docker selects
its CAP_SYS_CHROOT-conditioned rule; the runner drops ALL capabilities. This is
a concrete configuration conflict consistent with the fatal syscall failure.
No syscall trace was collected, so other runtime restrictions are not ruled out.
Do not disable Chromium sandbox, add privileged mode, or retry blindly.

The next CI change needs review of a namespace-compatible seccomp rule for
Chromium's internal chroot while retaining non-root, cap-drop ALL, no-new-privileges,
network none, read-only root, no host mounts, limits and cleanup. No such relaxation
was applied in this sprint. A separately approved single rerun must include the
new application adapter as well as the existing 13 prototype tests.

## Execution environment decision

Vercel was evaluated first; the connected Aya team displays Hobby. No Sandbox was
created. [Sandbox quotas](https://vercel.com/docs/sandbox/pricing) include free
Hobby usage with creation paused rather than billed on exhaustion; remaining team
quota was not established. [Hobby terms](https://vercel.com/docs/plans/hobby) limit
it to non-commercial personal use. Commercial SaaS hosting requires an appropriate
owner-approved plan; no upgrade or payment was performed.

[Sandbox firewall](https://vercel.com/docs/sandbox/concepts/firewall) supports
deny-all, including DNS, and custom deny-default rules. Its default is allow-all,
which is unacceptable here. Domain filtering uses TLS SNI; raw HTTP requires IP
rules. SNI allowlists alone do not verify HTTP Host or pinned public destination.
Broad CIDRs can bypass domain restrictions. A deployable worker must use a
separately verified broker that validates/pins every public destination and
redirect, rejects private/metadata/IP encodings, constrains subresources and
methods, and blocks direct egress. No app/database/provider secrets belong in it.

Recommended first environment test: pinned prepared image, disposable microVM,
deny-all, no exposed ports or persistence, synthetic fixtures only, bounded TTL
and cleanup. Chromium sandbox compatibility, actual costs and OS isolation remain
NOT VERIFIED until authorized execution. If Sandbox cannot enforce the broker
boundary, the single alternative is a dedicated isolated Linux worker VM with
browser-only network access to that broker; it is not provisioned or priced here.

Before activation, implement authenticated tenant jobs with durable leases,
idempotent completion, stale-job recovery and global/per-agency concurrency/cost
caps. The existing audit row lifecycle/unique active prospect constraint is useful
but is not a durable distributed worker queue. A future job migration requires
separate review. Same-origin discovery alone is explicitly NOT SSRF protection.
Test DNS rebinding, redirects, IPv6 encodings, subresources, WebSockets, service
workers, downloads, popups, worker kill, quota exhaustion and result tampering.

## Real Aya and launch gates

Read-only Preview checks confirmed the existing Aya session, saved logo, approved
scope, USD 500 conversion service and USD 70 SEO service. No saves, uploads, scans,
AI requests, Ready transitions or delivery creation were made. Existing pro-hvac
findings remain unmatched to those specialized services; no match was fabricated.
Full live draft/save/reopen/Groq/Ready/PDF acceptance is NOT VERIFIED this sprint.
Use a supported existing finding and exact approved scope, then obtain the
existing write/AI/delivery approvals. Do not overwrite historical proposals.

Vercel deployment list still shows Aya Preview at `48d707c` and Production at
`09985c4`, with no new experimental deployment. Render installed-app access was
verified restricted to its unrelated repository before pushing. No settings changed.

Existing agency limits remain: analyzer 10/hour, opportunity AI 20/hour, proposal
AI 10/hour, database-backed and fail-closed. These do not replace worker resource
caps. Auth callback safety and tenant tests remain in the local regression suite;
production email delivery, public onboarding and recovery of stuck remote jobs
need live acceptance. Successful UI reads do not resolve the PostgREST health
warning/support ticket SU-512513. No new health investigation was performed.

## Local verification

Local fixture/mocked tests: `npm run test` passed 108 files / 1,158 tests (5.53 s).
`npm run typecheck`, `npm run lint` and `git diff --check` passed. These are not
real-browser results. The final commit IDs are reported with the handoff.
Default `npm run build` failed twice
at a Turbopack CSS child-process startup (inside and outside the local sandbox).
`npm run build -- --webpack` compiled and built successfully. The supported release
build is now explicitly `next build --webpack`; the Turbopack CSS child-process
failure remains a non-blocking follow-up for that supported build path. The browser
CI run and a successful build of the actual release commit remain release gates.
