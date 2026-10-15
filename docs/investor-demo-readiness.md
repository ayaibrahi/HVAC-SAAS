# Investor demo readiness: focused product hardening

## Repository and scope

Started clean on `feature/scanvoro-phase-b-simplified` at
`bfaa9a57ad1e40d083c714752b3f593813296857`. Local and remote feature hashes matched.
Local and remote master remained `09985c4e4f2503963833c91ad9b6f6c22480a2e4`.
Read the Master Plan and relevant Phase B service-matching and proposal reports.
The existing design, workflows, data contracts and security boundaries are retained.
This task creates one local commit only; pushing and deploying need new approval.

## Branding investigation: established facts versus missing evidence

The wordmark was not removed. `Brand` renders the logo plus its configured name.
`DashboardShell` passes `productConfig.name` into desktop/mobile navigation. Landing,
authentication and root metadata use the same configuration. All three icon assets
are the existing Scanvoro assets.

The default is `Scanvoro`. Nonempty `NEXT_PUBLIC_PRODUCT_NAME` overrides it after
trimming. There is no special-case override that hides a valid configured name.
Git comparison from Phase A branding commit
`115e290421edef34cd906b05f396f4615fe95854` to the task baseline shows no differences
in the product config, Brand, root metadata, navigation or dashboard shell.

The installed Next guide documents that static `NEXT_PUBLIC_*` references are
inlined at build time. Therefore an explicit legacy product-name value at build
time will produce that legacy label despite the correct fallback. A regression
test confirms this override remains honored. Changing an environment setting alone
does not update an already-built client bundle.

The actual reported deployed-label cause is NOT conclusively established. The
initial browser tabs were local synthetic fixtures. The owner then identified
`https://hvac-saas-5ysyrcp2x-aya-50df.vercel.app/dashboard` as the affected Preview.
Direct navigation redirects to Vercel sign-in, confirming access protection on that
URL. No authenticated deployment SHA or environment metadata is available for
comparison in this browser session. The prior
Phase A-only override and a legacy shared Preview value are a plausible explanation,
not a verified account configuration. Wrong deployment selection is also unexcluded.
The supplied URL is the application URL, not a Vercel deployment-details page.

Required operator check: open the intended deployment, confirm its source branch
and SHA, then inspect only `NEXT_PUBLIC_PRODUCT_NAME` and its Preview branch scope.
If it resolves to the legacy name, set it to `Scanvoro` for
`feature/scanvoro-phase-b-simplified` (or the intended shared Preview scope), leaving
Production unchanged. After release approval, build a new Preview and verify both
the sidebar and browser title. Do not reinterpret the old Phase A override as proof
that the Phase B branch has the same value. No Vercel settings were changed here.

## Ten-point completion checklist

1. **PASS - repository recovery:** exact baseline, clean initial tree, approved
   history and master integrity verified; no reset, rebase or discarded work.
2. **PARTIAL - deployed brand diagnosis:** correct code/default and the override
   mechanism established; exact deployed value/branch/SHA still requires evidence.
3. **PASS locally - consistent brand:** actual built home/sign-in/sign-up HTML has
   Scanvoro title and mark; SVG/app/Apple icons return 200. Configuration preserved.
4. **PASS - Dashboard:** Scan a website, Saved businesses, Recent websites and
   website-first next-action copy in English/Arabic. Recent businesses now open
   their results in the existing Websites route instead of the edit form. Counts
   and next-action decisions/queries are unchanged.
5. **PASS locally - website entry:** unchanged explicit save-and-scan flow, visible
   validation, pending guards, duplicate warning/override and partial-success
   recovery pass existing tests and isolated browser checks. No on-load scans/AI.
6. **PASS - opportunity accuracy:** prior capability matcher, deterministic ranking,
   top-three presentation, extra findings/evidence, page scope and null service
   matches are unchanged. All matching/security regressions pass.
7. **PASS - first-use builder:** bilingual ordered guidance, empty summary/scope
   hints, saved-preview/totals explanation, source-results link with original-scan
   caveat, optional AI save-first guidance and empty-catalog recovery. Unmatched
   findings no longer default to the first unrelated service/price.
8. **PASS with mocked storage - persistence:** real create/update actions, data
   orchestration, authorization, manual pricing, RPC payload and redirect paths
   tested through save/reopen/Ready. Previous saved values survive RPC failure.
   Live authenticated acceptance remains outstanding.
9. **PASS locally - delivery clarity:** Client-ready version / Prepare client-ready
   version labels explain Ready and fixed saved content. PDF routes, snapshot
   semantics, share generation/replacement/revocation and expiry are unchanged.
   Sharing explains link replacement and possible Vercel protection separately.
10. **PASS locally - demo experience:** both themes/locales and all requested widths,
    keyboard checks and actual 200% zoom pass. A live demo must use a separately
    accepted protected Preview and dedicated test records, not the synthetic fixture.

## Behavioral changes and preservation

Only proposal presentation defaults changed: an existing saved service/price wins;
otherwise an active deterministic recommendation supplies its catalog value;
otherwise the service selector remains blank and the unit-price input is zero.
An unchecked row is not included. The user must deliberately choose work and
confirm a price. Selecting a different service does not silently change the user's
price. Existing saved inactive services/prices remain visible, with an unavailable
option instead of another service substituted. Empty catalogs disable new selections
but do not disable a previously saved checked row and silently drop its submission.
The unchanged server validates active owned services and selected opportunities.

Proposal AI is disabled in the initial empty-draft UI until selections have been
saved, matching the existing server prerequisite. The copy explicitly says AI uses
saved selections and asks users to save edits before generating. No provider,
prompts, schemas, budgets, safety rules, pricing arithmetic or persistence changed.

The proposal page reads the existing server-side locale preference and isolates
customer text with bidi markup. Dashboard, Websites and builder use localized UI;
other workflows keep the existing partial-English notice. Saved customer/AI text,
financial formatting/currencies and PDF/public proposal content are not translated.
Changing language writes the existing cookie and refreshes server-rendered copy
with `router.refresh`, not a full browser reload. Synthetic merge verification
preserves an unsaved title and manual price. Theme changes remain client-side.

No historical records, immutable snapshots, schema/RLS, privileged RPCs, audit
transport/SSRF, rate limits, auth or share-token handling were modified. The default
theme is still Light; saved Dark/Arabic preferences remain honored. No migration,
dependency, paid service, PageSpeed, analytics, additional route or provider fallback
was added. No live authenticated operations, website scans, AI calls, database
writes, push, merge or deployment were performed in this task.

## Verification

- `npm run lint`: exit 0.
- `npm run typecheck`: exit 0.
- `npm run test`: exit 0; **75 files / 687 tests passed**, including all 675 baseline tests.
- `npm run build`: exit 0; Next 16.3.8; 13/13 static pages generated.
- `npm audit --omit=dev`: exit 0; zero production vulnerabilities.
- `git diff --check`: exit 0.

Twelve additional regressions cover explicit legacy configuration, two localized
Dashboard cases, unmatched/active recommendation defaults, two localized first-use
cases, saved inactive service/price retention, actual save/reopen/Ready, safe failed
save recovery and two localized share-control cases. Test storage implements the
RPC boundary in memory; this is not a live PostgreSQL transaction or RLS test.
Existing authorization, redirect, pricing, Groq/no-fallback, SSRF, AI, snapshot,
PDF, public sharing, themes and locale tests remain passing.

Synthetic browser checks: **178 existing Website-first checks + 77 investor-demo
checks**, zero page errors. Both Light/Dark and English/Arabic at
360/768/1280/1440px, plus actual 200% browser zoom. Actual components/page entrypoints
render with explicit synthetic normalized signals and mocked server boundaries.
No customer data is loaded; off-loopback and API requests are denied. The prior
Website-first suite makes four mocked non-proposal API requests; the investor
suite makes no API/blocked external requests and does not submit live mutations.

Actual built Next HTTP checks: six protected routes return 307 to sign-in; three
public pages return 200 with Scanvoro branding/title and default Light theme;
saved Dark/Arabic root preferences are preserved; three brand assets return 200.
The temporary server has empty service credentials and is stopped after checking.

Browser artifacts are outside Git under
`C:/Users/CompuMart/.codex/visualizations/2026/09/19/01a0bb1e-a9c4-7791-b20d-cc200a9521c2/investor-demo-review/`
and `phase-b-website-first-review/`. They are labeled synthetic, not investor proof
of a live authenticated scan or completed delivery.

## Investor demo runbook

Before the meeting, after separately approving the Preview update:

1. Verify the exact deployment SHA, Preview Ready status, protection and brand
   setting. Confirm Supabase callback allowlisting if needed. Verify the Preview
   provider is Groq and the privately configured free-tier model/key apply to this
   branch. Do not invoke OpenAI or reveal secrets.
2. Use a dedicated agency/test account, especially if Preview uses production
   Supabase. Add three to five actual service entries with meaningful capability
   descriptions and deliberately chosen USD catalog prices. Use no customer PII.
3. Choose a public HVAC business page you have permission to analyze, reachable
   without login/CAPTCHA, with enough page content for supported findings. The
   analyzer examines one submitted page. A lack of detected evidence is not proof
   of a whole-business deficiency.
4. Complete the authenticated smoke test before the meeting: scan, findings,
   service relevance, empty draft, selected service/manual price, save/reopen,
   Ready, client-ready version, PDF and share expiry/revocation. Confirm protected
   Preview share access separately; do not disable protection for the demonstration.
5. Keep one genuinely saved, reviewed test scan and proposal as a fallback. Label
   these as previously saved results, including their actual scan date. Do not
   present synthetic fixtures as live production output.

During the meeting, navigate Dashboard -> Websites -> explicit Add and scan ->
completed evidence -> three leading opportunities/more evidence -> Prepare or
resume proposal -> select services/manual prices -> Save -> reopen/review ->
choose Ready and save -> Prepare client-ready version -> Download PDF -> share
only if intended. Explain Draft versus saved Ready versus fixed delivery copy.
Optional Groq generation requires an explicit operator action and reviewed output;
it is not necessary to demonstrate the deterministic proposal workflow.

If a scan fails, show the real error and saved-business recovery, then open the
previously saved test result. State plainly that it was analyzed earlier. Do not
repeatedly submit while another scan is running or claim the failed run succeeded.
After an ambiguous proposal navigation failure, inspect saved drafts before retrying.

## Remaining limitations and release handoff

- The deployed old-name cause and actual Preview branch configuration remain
  unverified until the failing deployment is identified and public brand scope is
  inspected. The source is correct; valid overrides must remain configurable.
- Authenticated end-to-end acceptance is not authorized in this task and remains
  an operator prerequisite before an investor-facing live demo.
- Recent-draft discovery remains bounded; creation lacks durable cross-request
  idempotency. AI prose is heuristic and requires review. Existing older service
  matches/AI text are not automatically regenerated; use a fresh test scan.
- Arabic remains experimental. Some other workflows and server/provider error
  messages remain English; customer text, PDF and public delivery remain unchanged.
- Unsaved changes are not a live preview, and separate AI generation uses saved
  values. The new UI explains this; no autosave was introduced.

Next action: review the local commit and synthetic screenshots; verify the supplied
Preview's source SHA and public brand variable/branch in Vercel. Explicit approval
is required before pushing this commit and creating an updated protected Preview.

## Changed files

- `src/app/(dashboard)/dashboard/proposals/[proposalId]/page.tsx`: localized first-use,
  saved-preview and delivery guidance; explicit service choices and retained prices.
- `src/components/dashboard/workspace-content.tsx`: localized proposal editor boundary.
- `src/components/ui-preferences.tsx`: refresh server-rendered copy after locale changes.
- `src/components/ui-preferences.test.ts`, `src/components/workspace-ui.test.ts`:
  retain existing assertions and supply the newly used router refresh hook in mocks.
- `src/features/dashboard/components/dashboard-overview.tsx`: recent business results link.
- `src/lib/i18n/dictionaries.ts`: website-first Dashboard and feedback copy.
- `src/lib/i18n/proposals.ts`: typed English/Arabic proposal and sharing copy.
- `src/features/proposals/share-links/components/share-link-controls.tsx`: translated
  replacement/expiry/protection copy, UTC dates and clipboard status announcement.
- `src/config/product.test.ts`: explicit legacy configuration remains configurable.
- `src/features/dashboard/components/dashboard-overview.test.tsx`: localized links/counts.
- `src/features/proposals/transition.test.tsx`: real action/data path and mocked storage tests.
- `src/features/proposals/share-links/components/share-link-controls.test.tsx`: safe sharing copy.
- `docs/investor-demo-readiness.md`: investigation, evidence and operator runbook.
