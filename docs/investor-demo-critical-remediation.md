# Investor Demo Critical Remediation

## A. Repository State

Started clean on `feature/scanvoro-phase-b-simplified` at
`da0089a1052ffd4f6c13bcae2b59a4c1d74eb968`. Local master remains
`09985c4e4f2503963833c91ad9b6f6c22480a2e4`. No reset, rebase, push,
merge, deployment, environment/configuration change, or database operation.

Read the actual live acceptance report, existing investor-demo documentation,
the installed Next route-handler guide, and the audit/opportunity, AI-safety,
proposal PDF, snapshot-response, and download implementations/tests.

## B. Exact Audit Root-Cause Findings

Confirmed in source and reproduced with local fixtures:

- Fetch accepted non-redirect error and partial responses as analyzer input.
- Extraction and completion had no content-quality prerequisite. A challenge or
  thin JavaScript shell could become false/zero signals and confident absence rules.
- A phone was recognized only through visible text matching; an icon-only `tel:`
  link could be missed. Booking buttons/accessibility labels and emergency service
  links were not all recognized. Raw script/comment/template anchors could also
  incorrectly count as page evidence.
- Character decoding was always UTF-8; unexpected content encodings were not rejected.

The exact upstream cause of the One Hour scan remains UNCONFIRMED. Its persisted
HTTP status, title, response bytes and fetched representation were not accessible
through the acceptance UI. Do not claim that its response was a 403, challenge,
compressed body, or client-rendered shell without the missing evidence. No second
request to that site or another external site was made during remediation.

## C. Audit Content-Quality Fix

The existing single-page, DNS/IP-pinned transport still validates every redirect,
keeps Host/SNI and TLS verification, and retains its 10-second total deadline,
1 MB body cap, three-redirect cap, and default-port restrictions. It now rejects
non-success, empty/partial HTTP results and unexpected content encodings. It asks
for identity encoding, supports declared UTF-8/ASCII/Windows-1252/ISO-8859-1 text,
and refuses unsupported or malformed decoding instead of inspecting corrupt text.
Finally-abort closes unread response resources on failure as well as completion.

New `quality` metadata in the existing normalized-signals JSON has its own version
1, sufficient/insufficient verdict, finite reason codes and visible character count.
It checks HTTP eligibility, HTML structure/completeness, recognized challenge identity,
and meaningful body content outside header/navigation/footer and script/style/head/
template/noscript content. The conservative static-content floor is 180 characters
and 24 whitespace-delimited words. This is an eligibility heuristic, not proof
that all browser-visible content was rendered.

Insufficient content produces the existing failed lifecycle with
`CONTENT_NOT_VERIFIABLE`; already extracted positive signals and quality metadata
are retained where extraction completed. The UI shows localized Unable to verify
page guidance. No new opportunities are persisted from such results.

Opportunity authorization checks quality before invoking persistence; the reusable
HVAC rule entrypoint also refuses unverified input. Older records with no versioned
quality assessment are intentionally ineligible for NEW opportunity generation.
They remain unchanged and viewable with a warning; existing proposals can still
be opened. No historical sets are deleted or regenerated as a side effect. The
workspace query selects only the JSON quality projection, not every audit's full
normalized payload. No schema migration, status-enum change, or backfill.

## D. False-Positive and False-Negative Regression Results

Local fixtures cover representative static HVAC HTML, genuine absence, a thin
JavaScript shell and a challenge. Tests cover icon phone links, nested booking
anchors, accessible labels, booking buttons, emergency links/wording, positive
evidence despite negative prose, and fake evidence in scripts/comments/templates.

Shell/challenge/missing/incomplete/error/partial inputs cannot yield recommendations.
The representative fixture does not produce booking, phone/lead-capture, or
emergency absence findings. Meaningful static HTML with genuinely unobserved
features still produces up to five page-scoped opportunities. Legacy unassessed
input is rejected without mutation. Existing SSRF, concurrency, tenant, ranking,
service-matching, provider-selection, budgets and AI-safety tests continue passing.

## E. Remaining Audit Limitations

This is not browser rendering or full-site crawling. CSS visibility, JavaScript
hydration, semantic phrasing and arbitrary interstitials cannot be comprehensively
classified by a small static heuristic. Very short pages, unusual markup, omitted
closing document tags, unsupported charsets, or servers ignoring identity encoding
may safely return Unable to verify. Positive signals do not certify an entire
business offering. Do not bypass protection or repeatedly scan to force findings.

Read sanitized metadata from the EXISTING disputed audit, under authorized access,
before claiming its particular root cause. A fresh external scan requires separate
explicit URL/one-request authorization after the new Preview is approved.

## F. PDF Layout and Encoding Root Causes

The original layout placed text at the current baseline and advanced using the
previous small font's height; the next larger title overlapped the agency name.
Character-count wrapping ignored actual glyph widths and service columns. ASCII
normalization deliberately replaced punctuation with question marks.

The renderer now uses top-based baseline placement, header spacing, standard
Helvetica advance widths, conservative bounds for extended glyphs, wrapped service
names in a separate price column, right-aligned monetary text and page-space checks.
Paragraphs, section starts, item blocks and totals receive bounded keep-together
handling; large content can still continue across pages without clipping lines.
Built-in Helvetica fonts explicitly use WinAnsi encoding with correct punctuation
byte mapping. No font downloads, embedding, new dependency or external resource.

Snapshot-only view data, agency/client identities, manual prices and arithmetic,
authorization, test disclaimers, share tokens and immutable snapshot source are
unchanged. Arabic shaping and arbitrary Unicode fonts are NOT implemented;
unsupported characters retain the existing fallback limitation.

## G. PDF Before/After Evidence

Evidence is outside Git under:
`C:/Users/CompuMart/.codex/visualizations/2026/09/19/01a0bb1e-a9c4-7791-b20d-cc200a9521c2/`

- BEFORE: `live-acceptance-2026-10-15/test-delivery-pdf-page-1.png`, rendered from
  the actual authenticated Preview export.
- AFTER: `critical-remediation-review/pdf/acceptance-replay-after.pdf` and its
  page PNG, a LOCAL replay of the same test content/pricing, not a new live export.
- STRESS: `critical-remediation-review/pdf/long-multipage-after.pdf`, six pages,
  long names/titles and eight line items with illustrative USD 2,000 total.
- Every page was rendered and visually inspected. A pdfplumber bounds check found
  zero out-of-bounds glyphs; all 60 stress-case scope paragraphs persisted.
  Em dashes extract correctly through pypdf. Header overlap is absent.

The live PDF and historical immutable snapshots were not overwritten or changed.
These are local rendering results, not post-deployment acceptance.

## H. PDF Download Pending-State Fix

The old control set pending true once with no completion/failure path. The new
control performs only the existing authenticated, same-origin GET, rejects redirects,
requires successful PDF media type/signature, caps bytes at 5 MiB, and has a
45-second deadline/unmount cancellation. It hands a validated Blob to the browser
and clears pending in finally; no claim is made that the user saved the file to disk.
Known-safe server filenames are retained, with a fixed fallback for invalid names.

Failures show localized safe retry guidance, never server details. An immediate
ref guard suppresses double-clicks; later retry/repeated downloads use GET and
do not create another delivery snapshot. Responses/objects/timers are cleaned up.
Tests cover success, HTTP/type/signature failure, oversize, interruption, timeout,
concurrent clicks, unmount and retry. Actual local React browser interactions
confirmed one request for double-click, pending reset, and controlled failure/retry
states. All mock responses and records were explicitly synthetic.

## I. AI Page-Scope Safety

The existing safety regex rejected `the website lacks` but missed the actual saved
phrase `the website currently lacks visible financing options`. Shared Opportunity/
Proposal validation now also rejects bounded adverb variants for website/business
absence claims, normalizes Unicode compatibility forms, smart apostrophes and
zero-width characters, and tests the saved failure wording in both workflows.

Prompts now explicitly warn against the failure phrase, distinguish old AI prose
from authoritative evidence, and require page-scoped, conditional wording.
Both prompt versions are v2; schema/provider/model contracts are unchanged.
No live Groq/OpenAI calls, prompt-response data logging, or paid fallback was added.
Existing financial-claim checks, input budgets, saved-success handling, authorization
and deterministic-field protections remain. Heuristic language validation is not
a proof against every paraphrase; human review remains required. Historical AI
text must be reviewed manually before presentation, not silently rewritten.

## J. Proposal Status and Localization Corrections

The mixed Draft/Ready section is now Saved proposals / its Arabic translation.
Stored statuses and counts did not change. Finding counts use English singular/
plural and Arabic zero/one/two/few/many forms, preserving the numeric count.
Unverified status/help and download failure copy are translated in existing files.

Actual local browser checks at 360 and 1280 pixels covered both themes and locales
(eight combinations): correct direction/theme, localized failure, cleared busy
state and no document overflow. RTL viewport screenshots were inspected; a browser
full-page RTL capture artifact was not treated as an application overflow defect.
No authenticated Preview mutations or acceptance claims apply to this patch yet.

## K. Exact Files Changed

All paths below are relative to the project root.

- `src/app/(dashboard)/dashboard/proposals/[proposalId]/page.tsx`
- `src/app/(dashboard)/dashboard/proposals/page.tsx`
- `src/app/dashboard-routing.test.ts`
- `src/components/pending-download-link.tsx`
- `src/components/pending-download-link.test.tsx`
- `src/features/audits/analyzer/content-quality.ts`
- `src/features/audits/analyzer/content-quality.test.ts`
- `src/features/audits/analyzer/errors.ts`
- `src/features/audits/analyzer/html.ts`
- `src/features/audits/analyzer/safe-fetch.ts`
- `src/features/audits/analyzer/safe-fetch.test.ts`
- `src/features/audits/analyzer/signals.ts`
- `src/features/audits/analyzer/fixtures/absent.html`
- `src/features/audits/analyzer/fixtures/challenge.html`
- `src/features/audits/analyzer/fixtures/representative.html`
- `src/features/audits/analyzer/fixtures/shell.html`
- `src/features/audits/data.ts`
- `src/features/audits/run-audit.ts`
- `src/features/audits/run-audit.test.ts`
- `src/features/opportunities/ai/prompt.ts`
- `src/features/opportunities/ai/safety.ts`
- `src/features/opportunities/ai/safety.test.ts`
- `src/features/opportunities/authorization.ts`
- `src/features/opportunities/rules/hvac.ts`
- `src/features/opportunities/test-fixtures.ts`
- `src/features/proposals/ai/prompt.ts`
- `src/features/proposals/ai/safety.test.ts`
- `src/features/proposals/pdf/renderer.ts`
- `src/features/proposals/pdf/renderer.test.ts`
- `src/features/proposals/pdf/text.ts`
- `src/features/prospects/components/prospect-details.tsx`
- `src/features/prospects/components/prospects-screen.tsx`
- `src/features/prospects/components/prospects-screen.test.tsx`
- `src/features/prospects/workspace-data.ts`
- `src/features/prospects/workspace-data.test.ts`
- `src/features/prospects/workspace-model.ts`
- `src/lib/ai/provider.test.ts`
- `src/lib/i18n/proposals.ts`
- `src/lib/i18n/prospects.ts`
- `src/lib/i18n/prospects.test.ts`
- `src/lib/pdf-download.ts`
- `src/lib/pdf-download.test.ts`
- `docs/investor-demo-critical-remediation.md`

## L. Tests, Build and Production Audit

- `npm run lint`: exit 0.
- `npm run typecheck`: exit 0.
- `npm run test`: exit 0; 80 files / 766 tests pass (all 687 baseline tests retained).
- `npm run build`: exit 0; Next 16.3.8; 13/13 static pages generated.
- `npm audit --omit=dev`: exit 0; zero vulnerabilities. The restricted-network
  attempt failed to reach npm; the approved network-enabled retry succeeded.
- `git diff --check`: exit 0.

No dependency or lockfile change, migration, pricing logic change, provider transport
change, share-link/snapshot authorization change, or new real environment file.
Tests using storage/provider mocks do not establish live PostgreSQL RLS behavior.

## M. Local Commit

One focused local commit on the feature branch; exact SHA is reported in the handoff.
The commit cannot contain its own hash. No push or deployment is authorized here.

## N. Remaining Live Verification Requirements

After separate release approval, verify the exact new protected Preview SHA and
configuration, then test corrected controls and export from labeled test records.
Check actual PostgREST JSON quality projection and legacy warnings on Preview.
Obtain sanitized metadata for the original disputed audit. A fresh scan must be
separately authorized; test insufficient-content and legitimate static-page cases
without bypassing target restrictions. Keep AI off unless separately approved.
Do not overwrite historical AI, proposals or delivery snapshots. Verify recipient
access requirements without disabling Preview protection.

## O. Investor Demo Readiness Assessment

READY FOR FINAL PREVIEW RETEST, not proof of final investor/live acceptance. The
local reproducible defects are corrected with regressions and rendered evidence.
Static-analysis limits and the original disputed response remain explicitly open.

## P. Exact Next Operator Action

Review the local commit and before/after evidence. Explicitly approve the exact
feature-branch SHA for a controlled Preview push if accepted; no automatic push,
Production action, migration, live scan, AI generation, or historical data repair.
