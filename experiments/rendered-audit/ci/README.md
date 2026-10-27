# One-shot CI fixture verification

Prepared locally on `codex/rendered-audit-feasibility`, based on
`48d707c483dfb87326a5cbd5ecf1c194cfffb07e`. The owner subsequently authorized one
scoped commit, one normal branch push and one automatic fixture run after the
deployment safety gates passed. Historical 13/13 Windows
success is not verification of the final source or this Linux configuration.

## Account evidence (2026-10-25)

Authenticated read-only inspection found:

- `ayaibrahi/HVAC-SAAS` is public; Actions enabled, all actions allowed.
- GitHub Free; 0/2,000 included minutes used, 0/0.5 GB included storage used.
- Actions account budget $0, usage blocked beyond budget; no paid usage enabled.
- No workflow registered; default branch `master`, production baseline `09985c4`.
- Vercel `aya-50df/hvac-saas` is connected to that repo. Production tracks
  `master`; Preview tracks all unassigned Git branches.

Standard hosted Ubuntu jobs in public repos are free. This workflow uses no
artifact upload, Actions cache, paid/larger runner or external service. It allows
one attempt, at most 10 minutes, with a 6-minute build and 90-second test-container
wait. A timeout is a failure, not permission to rerun. Recheck account/repo status
before execution. Public CI logs must contain synthetic fixture evidence only.

## Exact trigger and deployment gates

The owner selected a push trigger instead of workflow_dispatch. Both filters must
match: branch `codex/rendered-audit-feasibility` and the single unique file
`experiments/rendered-audit/ci/run-20261025-9f8b1d7c.trigger`. No default-branch
registration, master changes, new repo or settings changes are necessary.
The job requires a non-forced, non-deletion push in the public source repository,
attempt 1, exactly one parent equal to the approved baseline, and the marker
newly ADDED (not modified/deleted) with fixed contents. Checkout uses the event's
immutable SHA. The marker is not a reusable retry mechanism. Any failed run or
future edit/push needs new owner authorization; no rerun is authorized.

Authenticated read-only integration review found no repository webhooks and no
existing Actions workflows. Installed GitHub Apps: Vercel and Render. Render's
only listed workspace has one active service, no suspended services, linked to
`ayaibrahi/simple-node.js-project` on main, not HVAC-SAAS. No Render service was
found for Scanvoro. Vercel root is the repo root, Production tracks master, and
Preview tracks other branches. No deploy hooks or conflicting local config found.
The possible fallback `scanvoro-audit-fixtures` already publishes GitHub Pages
from main, so it must not be assumed deployment-free.

Root `vercel.json` is a new local exact-branch exclusion:
`git.deploymentEnabled["codex/rendered-audit-feasibility"] = false`.
Other branches retain their existing default behavior. Include and review it in
the SAME future experiment commit before any push. Without that exclusion, a push
is expected to trigger a Vercel Preview. Reconfirm Vercel honors the exclusion;
do not represent an unpushed configuration as a verified live deployment block.

Stage only reviewed experiment, CI and branch-exclusion files. Exclude ignored
dist, node_modules, local measurements, env files, credentials and unrelated
project files. No pull_request, schedule, workflow_dispatch or repository_dispatch
trigger exists. No workflow or code is installed on master.

## Reproduction files and provenance

Keep `extract.ts`, `fixture-server.ts`, `renderer.ts`, `prototype.test.ts`,
`tsconfig.json`, package manifest/lock, `.dockerignore`, `.gitattributes`, this CI
directory, the workflow and exact-branch `vercel.json` together. Preserve native
`run-monitored.ps1`, README, RESULTS and the feasibility report as historical
context. All 13 original test cases remain; no test filtering or retries in CI.

- `playwright-core` 1.64.0, TypeScript 6.0.3, Node types 26.6.2 pinned with npm
  integrity hashes; only lockfile preparation was performed locally.
- Official `mcr.microsoft.com/playwright:v1.64.0-noble` resolved to OCI index
  `sha256:06a9939e57531807f8d5fd76ce44b53165ffb7d7501d87ab10e285c20b1e971f`;
  Dockerfile pins its linux/amd64 manifest
  `sha256:bc72a8df40831ded821e3cbc79c318c21b44d6e51dff9fd89ace7a8249c5b462`.
  Digest verified from official MCR metadata; layers not downloaded locally.
- Checkout v4.2.2 pins GitHub-verified upstream release commit
  `11bd71901bbe5b1630ceea73d27597364c9af683`.
- `seccomp_profile.json` is the unmodified Microsoft Playwright v1.64.0 profile,
  downloaded from its official GitHub repository (Apache-2.0 project). SHA-256:
  `cc3e61cabda6bbc1e53e54d27ba4d55a9d3be829b6dd1a596f4a7b31b1cc7849`.
  Git treats this file as binary to preserve the verified bytes. Shell files use LF.

Official provenance establishes origin, not absence of supply-chain vulnerabilities.
No image signing/attestation verification is claimed. npm ci verifies the lock's
package integrity, disables lifecycle scripts and retries, and uses official npm.
Image pull/package preparation has network access; test execution does not.

## Runtime controls and evidence

- Standard `ubuntu-24.04` ephemeral VM; read-only contents token; checkout does not
  persist credentials. No secrets contexts, environment deployment, cloud CLI,
  Supabase client or app installation. No token/env/credential passed to container.
- Docker build context explicitly includes only fixture code/lock/config/entrypoint;
  no app code, `.git`, `.env`, backups or host home. No volume or Docker socket mount.
- Non-root uid/gid 1000; Chromium sandbox explicitly enabled; official seccomp
  profile; all capabilities dropped; no-new-privileges; private IPC and 256 MiB shm.
- Network `none`, no published ports; fixtures and browser in the SAME container.
  A kernel probe requires only loopback interfaces and an unreachable reserved
  TEST-NET TCP destination before the browser can start. It does not scan a site.
- Read-only root; 512 MiB noexec/nosuid/nodev tmpfs; 2 GiB total memory with no extra
  swap; one CPU; 256 PIDs; capped file descriptors; no core dumps; capped Docker logs.
- 45-second browser deadline, 60-second Node test timeout, 70-second inner process
  deadline, 90-second outer wait; EXIT trap removes ONLY this run's named container.
  CI cancellation may interrupt shell cleanup; ephemeral hosted-VM disposal is the
  final boundary. No cleanup of preexisting resources or disk/image pruning.
- Logs record TAP, exact synthetic per-page URLs/evidence/timings, browser version,
  profile removal, canary counts, cgroup peak memory/CPU/OOM data and cleanup result.
  Memory peak includes cache/tmpfs and isn't identical to Windows working set.

Linux channel uses bundled Chromium; Windows still uses existing Chrome. Browser
child environment is allowlisted. TypeScript, test logic, redirect rejection and
last cleanup changes are compiled directly from the checked-out approved source.
Temporary output is copied into container tmpfs, never a host bind mount.

## Follow-up after failed Linux startup

The first isolated run failed in Chromium's sandbox at `sys_chroot`. The local
follow-up derives a profile from the checksum-verified upstream bytes, changing
only the capability-conditioned `chroot` syscall rule. Docker still drops every
initial capability; Linux checks the caller's user-namespace capabilities. The
derived profile is not a blanket seccomp bypass. Static tests compare the whole
derived profile with the original and assert the retained container controls.
The adjusted profile has not yet been run in CI. A new run requires separate
owner authorization and does not establish safe access to external websites.

## Not yet established

Linux sandbox/user-namespace compatibility and actual 13/13 final browser results
require an authorized follow-up CI run. If AppArmor/user namespaces/seccomp prevent startup, fail and
report; do not add privileges, unconfined modes, host IPC, or `--no-sandbox`.

These trusted offline tests do not establish hostile-site isolation, safe egress,
DNS/IP pinning, subresource SSRF controls, robots compliance, tenancy/job isolation,
or production integration. No deployed Scanvoro JavaScript-audit claim follows.

## Local preparation checks

- Experiment TypeScript: `node --max-old-space-size=512 node_modules/typescript/bin/tsc -p experiments/rendered-audit/tsconfig.json --noEmit` — exit 0.
- Focused lint: `node --max-old-space-size=512 node_modules/eslint/bin/eslint.js experiments/rendered-audit/*.ts experiments/rendered-audit/ci/network-check.mjs` — exit 0.
- Existing Git Bash `--noprofile --norc -n` for each shell file — exit 0; parsed only.
- YAML parsed using existing repository `js-yaml`; 17 static assertions passed
  for triggers, permissions, runner/deadlines, repo/ref/attempt guards, immutable
  checkout, no secrets, input handling, Vercel exclusion, dependency integrity,
  image digest, seccomp bytes, container restrictions, context allowlist, network
  gate ordering, sandbox/redirect regression preservation, test cases and LF rules.
  These are configuration checks, NOT 17 executed browser tests.
- `git diff --check` and explicit no-index whitespace checks of all 21 untracked
  preparation/prototype files — no whitespace diagnostics. No staging was needed.
- App source, root package/lock and migrations have no tracked diff; HEAD unchanged.
- Initial preparation did not run Docker, Chromium, Actions or an application
  build, commit, push or change remote settings. Local available RAM was 1,819 MiB; checks ran sequentially
  with bounded Node heaps, independently of the browser resource gate.

## Official references

- https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#workflow_dispatch
- https://docs.github.com/en/billing/concepts/product-billing/github-actions
- https://vercel.com/docs/project-configuration/git-configuration
- https://playwright.dev/docs/docker
- https://raw.githubusercontent.com/microsoft/playwright/v1.64.0/utils/docker/seccomp_profile.json
- https://github.com/actions/checkout/commit/11bd71901bbe5b1630ceea73d27597364c9af683
