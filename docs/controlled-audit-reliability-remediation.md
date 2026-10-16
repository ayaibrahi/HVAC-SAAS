# Controlled Audit Reliability Remediation

## A. Initial Git and Repository State

Started clean on `feature/scanvoro-phase-b-simplified` at
`25eb75208843a04c8e0ad341a61e259f650dc9a4`, one local commit ahead of origin.
Local and tracking master remain `09985c4e4f2503963833c91ad9b6f6c22480a2e4`.
Read the prior validation report, manifest, remediation notes, current extraction,
quality/rule/matching pipeline, URL-security/concurrency tests and installed Next
Vitest guide. No reset/discard/rebase, push, publication or deployment.

## B. Exact Root Causes

- `html.ts/getPairedTags`: an exact `</a>` regex did not accept HTML closing-tag
  whitespace. It either lost links or consumed following markup, attributing an
  appointment CTA to the previous tel link. Naive tag boundaries also ignored
  quoted `>` characters and hidden ancestors.
- `signals.ts`: unbounded `book` matching against the entire URL treated the
  hostname facebook.com as booking and CTA evidence. Generic words, unrelated
  URL query parameters and disabled/broken controls were not distinguished from
  actionable static paths. A final regression also showed that an entity-encoded
  script scheme could be misclassified as a relative HTTP path; common URI/entity
  separators are now decoded before supported-scheme classification.
- `content-quality.ts`: the finite challenge rules did not recognize the long
  Request unavailable notice. Passing length/structure floors then allowed five
  absence-based opportunities from a non-business response.
- `html.ts/removeNonContentHtml`: scripts/templates were removed, but explicitly
  hidden markup was still treated as visible text/controls. Raw form markup could
  also reintroduce hidden inputs as contact evidence.

## C. HTML Extraction Correction

Replaced paired-tag regex extraction with a bounded, quote-aware static token walk.
It accepts HTML ASCII whitespace before closing brackets, separates adjacent
controls, and preserves nested inline text, tel destinations and accessible names.
Comments and raw-text script/style/textarea/iframe contents cannot introduce fake
controls. No JavaScript, URLs, CSS selectors or external resources are evaluated.

An explicit stack propagates hidden/non-content/header-nav-footer context. Shared
text and inspectable-markup offsets keep each capture attached to its own opening
tag and exclude hidden descendants from evidence, including form field markup.
Duplicate attributes use the first occurrence; attribute dictionaries have no
prototype. Invalid numeric character references use a replacement character rather
than throwing. Unsupported/invalid link schemes cannot become actionable paths.

This is a limited static tokenizer, not a full HTML5 DOM/tree-repair implementation.
Malformed same-kind nested controls are conservatively marked incomplete rather
than letting them merge into trusted evidence. Incomplete comments/raw elements/
tags/documents are ineligible for opportunities. No dependency was necessary.

## D. Booking and Social-Link Correction

Booking requires explicit appointment/service intent in the control's accessible
text, or a same-origin booking/scheduling/appointment path segment. The hostname
and marketing query string are not evidence. A full token is not the same as a
substring: facebook, notebook, bookkeeper and recall do not create booking/CTA
signals. CTA matching uses word boundaries and excludes non-actionable controls.

External booking URLs with meaningful labels remain supported without a provider
allowlist; tests include Calendly and an unlisted fictional provider. An external
generic path such as a social profile named /book alone does not verify booking.
An explicit same-page fragment must identify a non-hidden static target.

Ambiguous labels, disabled booking buttons, script-only/absent destinations and
broken fragments produce **null / low confidence**, not true or false, when there
is no other supported booking control. They cannot trigger missing-online-booking
rules: the existing boolean signal reader already skips unknown values. A genuine
detected path wins over an unrelated ambiguous hint.

Normalized signal schema is **1.1.0** to version nullable `hvac.onlineBooking` and
`contactConversion.bookingLinkDetected`. No migration or playbook change is needed:
signals live in JSON and consumers already guard value types. The manifest's only
contract change is that schema version and explicit null semantics. Both canonical
pages' expected booleans, counts, extracted evidence and rule order are unchanged.
Stored historical results are not rewritten or retroactively certified by this fix.

## E. Access-Notice Quality Correction

Strong access identity is checked in title and primary headings, not generic
security vocabulary anywhere on the page. Request unavailable/blocked, permission
or authentication required, forbidden and automated-traffic notices are ineligible.
Strong access outcomes at the beginning of representative body copy also reject
neutral-titled notices; a leading H1 is removed only when it is an exact prefix.

Known challenge signatures remain. The quality floor (180 characters / 24 words)
is unchanged and is never sufficient on its own. The reproduced notice and other
long notices now receive `quality.status=insufficient`, reason `challenge`, and no
opportunities. The unchanged audit lifecycle returns the controlled Unable to
verify failure (`CONTENT_NOT_VERIFIABLE`), not a successful completed audit.

Ordinary business uses of access, secure, protected and account-help guidance pass
opposite-case tests. Strong access-page identity still fails even with an HVAC
paragraph present. Finite text heuristics cannot recognize every interstitial or
guarantee that arbitrary mixed content is representative; no protection is bypassed.

## F. Hidden-Element Findings and Limitations

Known exclusions: HTML hidden (including hidden="false", a boolean attribute),
inert, aria-hidden=true, input type=hidden, and direct inline display:none,
visibility:hidden/collapse, content-visibility:hidden or zero opacity. Ancestor
exclusions apply to descendants; a decorative aria-hidden icon does not remove
its parent's accessible booking label. Disabled controls do not create CTAs.

Inline declarations respect quoted strings/comments/parentheses, simple last-value
and !important precedence. Explicit child visibility:visible can override inherited
visibility:hidden but cannot override display:none or other hard-hidden ancestors.
No external stylesheet cascade, responsive media query, class-name convention,
animation, pseudo-element, CSS variable or browser interaction is computed. Unknown
classes do not magically hide content. Positive evidence is static HTML presence,
not proof of rendered visibility, a successful booking or service availability.

## G. Before/After Regression Evidence

Before production edits, converted the four reproduced characterization assertions
to require corrected output and ran the real controlled pipeline: **4 failed,
28 passed**. No expected-failure/skipped marker masked the defects.

After changes, the same four regressions pass. The former broken-fragment case now
asserts explicit unknown; hydration and complete-main-fragment characterizations
remain clearly labeled limitations. New regression cases exercise quoted markup,
whitespace variants, hidden descendants, inline-style precedence, generic social
URLs, known/unlisted external booking links, missing/disabled destinations, access
notice variants and ordinary business counterexamples. Canonical A/B HTML is not
changed to accommodate the fixes. Existing test assertions were not suppressed.

## H. Updated Ground-Truth Validation Matrix

PASS refers to the specified local contract, not production population accuracy.
All fixtures flow through the real fetch boundary, extractor, quality assessment,
rules, ranking and matching; only network/DNS are injected. No real scans or DB
writes occur. The audit lifecycle test mocks persistence and HTTP, not extraction.

| Layer / case                                     | Known ground truth                                                | Before                                  | After                                             | Result / opportunity suitability                 |
| ------------------------------------------------ | ----------------------------------------------------------------- | --------------------------------------- | ------------------------------------------------- | ------------------------------------------------ |
| Extraction: canonical A                          | Explicit phone, appointment, emergency, areas and service content | Correct                                 | Correct; own snippets/destinations retained       | PASS; no contrary absence opportunities          |
| Detection: canonical B                           | No phone/booking/emergency on inspected page                      | Three findings                          | Same three findings                               | PASS; analyzed_page scope only                   |
| Extraction: closing whitespace / nested text     | Legal tags retain individual links                                | Lost/merged anchors; wrong tel evidence | Own tel and booking targets/text preserved        | PASS; corrected evidence usable                  |
| Detection: social/substring URLs                 | No independent appointment evidence                               | Facebook became booking=true / CTA=1    | False, CTA=0                                      | PASS; supported booking absence retained         |
| Detection: external booking CTA                  | Meaningful link label, external target                            | Usually detected                        | Detected without provider allowlist               | PASS for static link presence, not functionality |
| Detection: ambiguous/broken/disabled booking     | Usable static path is unknown                                     | Often true or misleading false          | Null, low confidence                              | PASS; missing-booking rule suppressed            |
| Hidden descendants                               | Explicitly excluded controls are not user-facing evidence         | Phone/booking/emergency true            | Excluded; visible siblings retained               | PASS; page-level absence only                    |
| Style precedence / visible child                 | Tested explicit overrides remain detectable                       | Not distinguished                       | Tested declaration precedence respected           | PASS for supplied inline cases only              |
| Quality: substantial access notice               | Not a business page                                               | Sufficient, five false opportunities    | Insufficient/challenge, zero                      | PASS; no opportunity suitable                    |
| Quality: neutral-title access body               | Strong primary permission/request outcome                         | Could pass                              | Insufficient/challenge                            | PASS; no recommendations                         |
| Quality: ordinary business security words        | Representative service page                                       | Accepted                                | Still accepted                                    | PASS; supported findings retained                |
| Quality: strong notice + business paragraph      | Access notice is primary identity                                 | Could pass                              | Rejected                                          | PASS; content length cannot override notice      |
| Quality: shell/thin/error/partial/interrupted    | Unverified representation                                         | Rejected                                | Still rejected                                    | PASS; no recommendations                         |
| Fetch redirects/security                         | Each hop independently validated                                  | Guarded                                 | Unchanged, existing regressions pass              | PASS within local test coverage                  |
| Matching/ranking                                 | Only relevant actual catalog capabilities; stable order           | Correct                                 | Unchanged canonical matches/order; null when none | PASS; no invented service                        |
| Hydration-only widget on substantial static page | Later DOM content unknown                                         | Static absence may be produced          | Still no JS evaluation                            | LIMITATION; human review, no browser claims      |
| Complete-looking main-only fragment              | Response completeness unknown                                     | Could pass                              | Can still pass if no truncation markers           | LIMITATION; cannot certify rendered completeness |

## I. False-Positive and False-Negative Results

The four reproduced defects are corrected by assertions of their opposite behavior,
not merely passing bug characterizations. Supported booking/phone/header-footer/
emergency cases remain positive; unrelated substrings and explicit-hidden cases
do not produce false positives. B retains legitimate page-level absence findings.
Ambiguous booking no longer becomes a verified positive or a missing-booking claim.
No statistical real-site precision/recall or global confidence claim is established.

## J. Remaining Static HTML Limitations

No browser rendering, hydration, iframe booking execution, destination-page fetch,
CSS layout or whole-site service assessment. A labeled external booking link is
not proof it works. Generic/short/unusual content may safely remain unverified.
Arbitrary challenge wording, language and malformed HTML can escape finite rules;
large/deep valid pages may be conservatively rejected by processing budgets.
The original One Hour discrepancy is still unexplained, and historical audits/
AI wording/proposals/snapshots are not repaired by changing current code.

## K. Security and Performance Assessment

No fetch/URL/transport/SSRF/DNS/redirect/port/rate/concurrency changes. No auth,
tenant/RLS/provider/AI/pricing/proposal/delivery/PDF/share or database changes.
All new fixture URLs are literals consumed only by injected DNS/HTTP responses.
No requests to the literal hostnames, AI providers or public fixture sites occur.

The extractor runs without recursion or a DOM. The existing 1 MB response limit
remains; a 50,000-token / 128-open-element processing budget fails with a controlled
`CONTENT_NOT_VERIFIABLE` error rather than unbounded nesting/allocation. Shared
text/markup offsets and closing same-kind captures bound subtree duplication.
Depth/flat-budget and wide-representative-document regressions are included. No
network side effects, execution or dependency added. This is not a claim of a
formally verified HTML parser or universal CSS/anti-bot interpretation.

## L. Quality Gates and Test Counts

Final results:

- `npm run lint`: exit 0.
- `npm run typecheck`: exit 0.
- `npm run test`: exit 0, **82 files / 864 tests passed**.
- `npm run build`: exit 0, Next.js 16.3.8, 13/13 static pages generated.
- `npm audit --omit=dev`: exit 0, **zero vulnerabilities**. The initial restricted
  attempt could not contact npm; the network-enabled audit succeeded and was
  repeated for the final gate without dependency changes.
- `git diff --check`: exit 0; the staged new-file diff is also checked before commit.
- Focused Prettier check: exit 0.

Baseline: 81 files / 798 tests, including the original 766 tests. Added 65 focused
regressions plus one audit-lifecycle case. No test is removed. The
existing security, concurrency, tenant, matching, AI-safety, proposal, PDF,
localization and navigation suites are retained; none requires live data.

## M. Exact Files Changed

- `src/features/audits/analyzer/html.ts`
- `src/features/audits/analyzer/signals.ts`
- `src/features/audits/analyzer/content-quality.ts`
- `src/features/audits/analyzer/controlled-site.test.ts`
- `src/features/audits/analyzer/reliability-regressions.test.ts`
- `src/features/audits/analyzer/fixtures/access-notice.html`
- `src/features/audits/run-audit.test.ts`
- `test-sites/hvac-audit-control/manifest.json`
- `test-sites/hvac-audit-control/README.md`
- `docs/controlled-audit-accuracy-validation.md` (historical-report pointer only)
- `docs/controlled-audit-reliability-remediation.md`

## N. Local Commit

One scoped local commit only after checks and final review. Its full SHA appears
in the handoff; no push, remote repository, publication, deployment or merge.

## O. Remaining Investor-Demo Reliability Risks

Fixtures do not prove deployed fetch behavior or database persistence. Production
and Preview still run the previously deployed commit until separately released.
Do not claim these local fixes are live. Two controlled HTTPS fixture scans remain
pending separate publication, release and record-creation authorization. Human
review and explicit page scope remain essential; Phase 2 has not started.

## P. Recommendation for Controlled Public Validation

Approve fixture-only publication using the package README, then supply the exact
two HTTPS URLs and frozen fixture commit. Separately approve the corrected
application Preview release and one labeled Aya scan per page; do not automatically
push or reuse third-party scan approval. Compare status/final URL/quality/version/
evidence and catalog relevance against the unchanged A/B ground truth. Stop for
unexpected outcomes instead of repeated scans. No AI call or proposal change is
necessary. Static limitations must remain visible in any investor presentation.
