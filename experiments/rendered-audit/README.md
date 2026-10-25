# Native trusted-fixture rendering prototype

This is an actual TypeScript/Playwright experiment, outside the deployed application.
It is **not an external website scanner**. It must never execute untrusted HTML or
accept a user-provided URL. No Supabase, AI, Vercel or existing Chrome session
is used. The static application analyzer is unchanged. The native Windows path
does not use Docker; the separately authorized future CI path is described in
[CI preparation](ci/README.md) and has not been executed.

## Reproduce on the approved Windows host

1. Check at least 4 GiB available RAM and 8 GiB free C: space.
2. From this directory, `npm ci --ignore-scripts --no-audit --no-fund` installs the
   locked Playwright, TypeScript and Node type packages only. Do not install application dependencies here.
   Original Playwright package unpacked size: 13,655,528 bytes. Preparation budget: 100 MiB;
   no browser download. Chrome stable must already be installed.
3. `npm run build` uses the pinned experiment TypeScript compiler (same version as the app).
4. `./run-monitored.ps1` runs the real-browser tests and records process-tree samples.
   Use PowerShell 7. It checks the resource gate again, strips inherited environment
   variables down to Windows runtime essentials, and sets a 65-second process-tree
   deadline. It never kills an existing owner application.

Generated test output, result envelopes and resource measurements are in ignored
`dist/`. `npm test` also builds/runs tests, but does not perform host resource sampling;
prefer the monitored command. No app package or lockfile is changed.

## Implemented evidence

- `fixture-server.ts`: loopback-only server, fixed paths and trusted JS; separate
  loopback canary counts attempted cross-origin requests. GET-only, no secrets/data.
- `extract.ts`: reusable visible DOM extractor for CTAs, tel links, contact elements,
  forms, booking-labelled elements and known internal navigation. Caps 200 candidate
  nodes / 100 evidence items; bounded labels and hrefs; never reads form values.
- `renderer.ts`: fresh Chrome process/profile and nonpersistent contexts; sandbox
  enabled; static JS-disabled baseline and JS-enabled rendering; exact URLs,
  viewport, source, elapsed time and explicit incomplete reasons. Fixture readiness
  is a test-controlled DOM marker, **not a general hydration algorithm**.
- `prototype.test.ts`: sequential Home/Services/Contact visits at 1440x900 and
  390x844; hidden elements excluded; mobile-only phone included only on mobile;
  timeout, script error, request policy, redirects and resource cleanup checks.

Static results are parsed HTML DOM with JS disabled, not byte-for-byte HTML. The
same scripts are absent from execution in that baseline; raw fixture documents
also lack the dynamic elements. Positive signals are `true`; other values are
`null` (unknown), never inferred whole-site absence. `complete_fixture` means the
controlled fixture met its readiness marker, not that a real site is complete.
No booking, call, form submission or business outcome is tested.

## Request boundary and limitations

Only the server's exact `http://127.0.0.1:<ephemeral-port>` origin, fixed paths and
GET requests are allowed. Subframes and extra pages are denied; service workers
are blocked; popups are suppressed and unexpected pages closed; WebSockets are
closed before connection; downloads are disabled. The test attacks use `.invalid`
destinations plus a second local canary, never real external websites.

The first run proved an important defect: `route.continue()` allowed a redirect to
the second loopback canary without a second route-policy decision. This was fixed
by fetching only the permitted fixture response with `maxRedirects: 0` and
rejecting **every** redirect before fulfilling the browser request. The corrected
test verifies zero canary requests. The first failed run is retained in ignored
`dist/first-run-*` artifacts. This lesson must inform the eventual egress broker.

This is application-level interception, **not OS-enforced network isolation**.
Browser background traffic and arbitrary malicious JS are not proven contained.
Chrome launches with its sandbox enabled, but no sandbox-escape resistance test
was performed. No firewall, Windows policy or browser installation was changed.
Playwright's automation endpoint binds loopback only and closes with the process.
Do not expose it or reuse this prototype as a public crawler.

The test response cap is applied after buffering a response from the trusted local
server. It is not a safe streaming/decompression boundary for untrusted responses.
Windows process-tree measurements are sampled lower bounds; summed working sets
include shared pages. CPU time can exceed wall time across concurrent processes.
The hard supervisor exists, but a malicious endless-script/forced-kill recovery
test has not been performed. Page timeout and normal failure cleanup are tested.

## Future integration (not activated)

1. Keep `src/features/audits/analyzer/safe-fetch.ts` and `signals.ts` as the existing
   static path. Do not make Next.js actions launch Chrome.
2. Build a separately isolated worker and controlled network broker: per-request
   protocol/port/DNS checks, pinned IP/TLS verification, redirects, asset/byte/time
   budgets, denied alternate network paths, robots policy and approved targets.
3. Define a validated versioned envelope with per-page URL, static/rendered source,
   viewport, collection time, content quality, errors, skipped URLs and coverage.
   Validate worker output as untrusted. Positive observation is not functionality.
4. Add an explicitly reviewed adapter to the current normalized signals and rules
   in `src/features/opportunities`; preserve service matching, approved scopes,
   prices and all tenant authorization. Never merge DOMs and call them one page.
5. Existing audit JSON could hold an experimental envelope, but current schema
   validators/consumers expect static version 1.1.0. Existing opportunity evidence
   allows `deterministic_analyzer`/`analyzed_page`; source provenance needs an
   explicit compatible contract change before persistence. Durable jobs/per-page
   records and `(audit_id, rule_key)` aggregation need a separate design/migration
   review. No database changes are necessary or made for this local prototype.
6. Re-test legacy audits, cross-tenant authorization, duplicate job handling,
   opportunity ranking, scope mapping and proposal grounding before any deployment.

References: [Playwright browser channels](https://playwright.dev/docs/browsers),
[route.fetch redirect controls](https://playwright.dev/docs/api/class-route#route-fetch).
