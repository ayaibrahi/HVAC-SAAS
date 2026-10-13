# Dependency security remediation: 2026-10-13

## Scope and baseline

- Branch: `feature/ui-redesign-phase-a`.
- Starting commit: `115e290421edef34cd906b05f396f4615fe95854`.
- Starting working tree: clean.
- Only dependency manifests and this report change. No application code,
  branding, themes, localization, migrations, environment settings, or database
  changes. No push or deployment.
- Verification runtime: Node.js `24.20.0`, Windows.

## Production findings and remediation

The initial production audit flagged three packages: one Critical and two High.
Next.js aggregates several advisories under one package entry; package counts
are not counts of distinct vulnerabilities.

| Package before | Severity / advisory | Vulnerable functionality and application exposure | Patched version / resolution |
| --- | --- | --- | --- |
| `next@16.3.5` | Critical: [GHSA-vcvr-r3jv-pc5j / CVE-2026-94545](https://github.com/vercel/next.js/security/advisories/GHSA-vcvr-r3jv-pc5j) | Node.js `next/og` ImageResponse RCE with attacker-controlled SVG content/attributes/styles. No `ImageResponse` or `next/og` usage found in this application; an exploit path was not established. | Fixed upstream in `16.3.6`; upgraded to `16.3.8`. |
| `next@16.3.5` | High: [GHSA-cjq9-62q9-8jv4 / CVE-2026-94483](https://github.com/advisories/GHSA-cjq9-62q9-8jv4) | Image Optimization SSRF involving attacker-controlled remote image hosts. No `images.remotePatterns` configured; current image assets are local. No confirmed reachable path. The separate analyzer transport is unchanged. | Fixed in `16.3.8`; installed `16.3.8`. |
| `sharp@0.35.4` | High: [GHSA-wq5f-xc86-pv6w / CVE-2026-96889](https://github.com/lovell/sharp/security/advisories/GHSA-wq5f-xc86-pv6w) | Upstream librsvg memory vulnerability, potentially RCE under certain glibc Linux runtime conditions. No untrusted SVG decoding workflow identified. A Windows-only reproduction would not prove Linux safety. | Installed `0.35.5`, with patched bundled librsvg `2.63.2` and platform libvips packages `1.3.4`. |
| `source-map-js@1.2.1` | High: [GHSA-68fv-2mgg-jv7q / CVE-2026-93749](https://github.com/advisories/GHSA-68fv-2mgg-jv7q) | Event-loop DoS from crafted indexed source-map offsets. Transitive PostCSS dependency; no user-supplied source-map parsing endpoint found. | Installed `1.2.2` for both PostCSS dependency paths. |

[Next.js 16.3.8 release notes](https://github.com/vercel/next.js/releases/tag/v16.3.8)
also document fixes for metadata-route access, SSG/ISR cache poisoning,
Draft Mode / `use cache` leaks, and development-server MCP disclosure.
The initial Next audit included `GHSA-3w37-wq28-93x7`,
`GHSA-4jqv-mc3x-m676`, `GHSA-39w2-rjm5-chcv`,
`GHSA-f87g-xv8r-7p7x`, and `GHSA-mcj8-r9mp-w47p`.
These no longer appear in the production audit.

## Dependency compatibility and lockfile

- `next` and `eslint-config-next`: exact pins `16.3.5` -> `16.3.8`.
- Related `@next/env`, `@next/eslint-plugin-next`, and all platform SWC
  packages move together to `16.3.8`.
- Sharp and platform binaries: `0.35.4` -> `0.35.5`; bundled libvips platform
  packages: `1.3.3` -> `1.3.4`.
- `source-map-js`: `1.2.1` -> `1.2.2`.
- No package names added or removed, no new direct dependencies, no overrides,
  no major upgrades, no security-control changes. React `19.3.0`, Supabase
  packages, Tailwind, and other unrelated dependencies are unchanged.
- Next.js and Sharp require Node >= `20.9.0`; local Node satisfies that.
  Next's React peer range accepts installed React; the matching ESLint config
  accepts the installed ESLint and TypeScript versions.
- Lockfile remains version 3. A structural comparison against the baseline
  confirms every changed package version belongs to the reviewed dependency
  families. `npm ci --dry-run --ignore-scripts --no-audit --no-fund` passes.
- Installs used `--ignore-scripts`; the patched compiler built successfully,
  and a local in-memory Sharp SVG-to-PNG conversion loaded the patched native
  library successfully. No generated asset was written to the repository.
- npm initially reported a Windows cleanup warning for the old loaded SWC
  DLL. Task-owned local preview servers were stopped; the patched compiler
  and build succeeded. An ignored old temporary directory may remain, but it
  is not the resolved compiler package or part of the lockfile.

## Remaining advisories: not hidden or force-fixed

Production audit after remediation: **0 vulnerabilities**, exit 0.

Full audit: **9 affected development-only packages: 7 High, 2 Moderate**, exit 1.
Those package flags arise from two root advisories:

### High: braces stack-exhaustion DoS

[GHSA-vfj7-8cjw-p6xm / CVE-2026-93687](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)
affects `braces <=3.0.3`; no patched version is published as of this review.
Installed `braces@3.0.3` is reached through:

- `eslint-config-next@16.3.8` -> `@next/eslint-plugin-next@16.3.8` ->
  `fast-glob@3.3.1` -> `micromatch@4.0.8` -> `braces@3.0.3`.
- `tailwindcss@3.4.19` -> `fast-glob@3.3.3` / `micromatch@4.0.8` /
  `chokidar@3.6.0` -> `braces@3.0.3`.

The seven High package flags are `braces`, `micromatch`, `fast-glob`,
`chokidar`, `tailwindcss`, `@next/eslint-plugin-next`, and `eslint-config-next`.
They do not represent seven independent flaws.

Deeply nested attacker-controlled glob patterns can exhaust the call stack.
Current inputs are repository-controlled tooling/configuration; no path from
tenant requests, analyzer HTML, AI data, or public proposal data into these
glob parsers was found. This is a development/CI availability exposure, not
an established remotely reachable application vulnerability.

The audit proposes Tailwind `4.3.3` and an ESLint config downgrade to `14.2.35`.
Tailwind 4 is a separately scoped major migration, and downgrading Next's
ESLint config would break the requested version alignment. Neither was applied.
Do not suppress the finding, invent an unavailable braces patch, or disable lint.

### Moderate: selector-parser CPU exhaustion

[GHSA-rj75-hqrm-r3gf / CVE-2026-104844](https://github.com/advisories/GHSA-rj75-hqrm-r3gf)
affects `postcss-selector-parser <7.1.6`. Installed `6.1.4` is used by Tailwind
and `postcss-nested@6.2.0`, whose compatible range is `^6.1.1`.
The two Moderate flags are `postcss-selector-parser` and `postcss-nested`.
The patched `7.1.6` is outside that range; no unreviewed major override was used.
Crafted selectors can exhaust CPU. Current CSS is trusted repository source,
not tenant-supplied CSS. A Tailwind/toolchain migration requires separate review.

The production risks are remediated, but the unresolved High tooling advisory
is reported as a release-gate blocker under the owner's instruction to report
High findings that cannot be safely fixed within scope. Release requires a
separately approved compatible remediation or explicit scoped risk acceptance;
this report does not grant that acceptance.

## Regression verification

| Check | Result |
| --- | --- |
| `npm run lint` | PASS, exit 0 |
| `npm run typecheck` | PASS, exit 0 |
| `npm run test` | PASS, exit 0: 64 files / 522 tests |
| `npm run build` | PASS, exit 0: Next.js 16.3.8, 13/13 generated pages |
| `git diff --check` | PASS |
| `npm audit --omit=dev --json` | PASS, exit 0: zero vulnerabilities |
| `npm audit --json` | Exit 1: 7 High / 2 Moderate development-only flags |
| `npm ci --dry-run --ignore-scripts --no-audit --no-fund` | PASS, exit 0 |
| `npm ls --all --omit=dev` | PASS, exit 0 |

Existing tests cover safe auth callbacks, real Next redirect exceptions for
successful create/save/Proposal AI/snapshot actions, tenant authorization and
RLS assertions, Groq request/selection/diagnostics with no paid fallback,
analyzer socket pinning and SSRF defenses, proposal persistence/pricing,
snapshots, PDF rendering/downloads, share links, and theme/locale foundations.
All were included in the complete test run. No redundant tests were added;
application logic did not change.

An additional real local production-build browser smoke test passed:

- Eight initial SSR checks: home/sign-in across Light/Dark and English/Arabic.
- Four hydration/reload/client-navigation checks, including 360px and 1280px
  views, with no browser errors or horizontal overflow.
- Default and interactive preference selection with cookie-backed reload.
- Invalid preference cookies fall back safely.
- Local Sharp rendering loaded `sharp@0.35.5`, libvips `8.18.7`, librsvg `2.63.2`.
- Unauthenticated `/dashboard` returns 307 to `/sign-in`.

Supabase packages and the async cookie/Proxy integration are unchanged and
compile under the patched framework. Local Supabase configuration is absent;
the dashboard check exercised the controlled configuration-error redirect,
not a live session-refresh or successful sign-in round trip. Provider/database
tests use mocks. Live Supabase Auth, Groq, tenant writes, and deployed Linux
behavior were not exercised. No production data or settings were accessed.

Before a later authorized release, perform Preview smoke checks for actual
sign-in/session refresh, proposal redirects, PDF/share routes and themes/locales.
Do not interpret passing local regressions as authorization to push or deploy.
