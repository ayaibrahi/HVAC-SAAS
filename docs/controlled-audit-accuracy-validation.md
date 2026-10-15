# Controlled Audit Accuracy Validation

## A. Repository Recovery

No recovery was required. Started clean on `feature/scanvoro-phase-b-simplified`
at `5bfa0fcf2ea98d0d5bee7a327cb2b13d09e4b1eb`. Local and tracking master
references remain `09985c4e4f2503963833c91ad9b6f6c22480a2e4`. Read the Master Plan,
current engine/security tests, latest remediation notes, and installed Next.js
Vitest/public-folder guides. No reset, discard, push, merge or deployment.

## B. Current Audit Pipeline Assessment

Authenticated tenant/prospect -> concurrency claim -> safe HTTP transport -> static
HTML parser -> normalized signals and quality -> completed/failed audit -> authorized
HVAC rule evaluation -> service mapping -> deterministic top five -> persistence.

The existing transport pins a validated public IP, retains Host/SNI and TLS checks,
revalidates redirects, permits only standard HTTP(S) ports, and limits time/body/
redirects. This work uses its injected transport/resolver for local deterministic
tests; the actual network path remains covered by the existing security suite.
No network/DNS call is made by the new engine tests.

Extraction is regex-based, not a standards-compliant DOM or browser. It excludes
scripts/styles/head/templates/noscript/comments from most signals. Phone text/tel
links, CTA/link/button text and accessible labels feed detectors. Emergency,
financing, plan and area detectors use finite wording patterns. Service links are
classified by labels/URLs, not by retrieving or validating their destinations.

Quality rejects known challenge identities, HTTP failures/partial responses,
missing outer closing tags, thin documents and shells. Its floor is 180 characters
and 24 whitespace-separated main-content words, excluding header/nav/footer. It
does not establish complete browser content or eliminate all interstitials.
Unverified/legacy quality cannot generate NEW opportunities. Negative raw booleans
may still be present on a rejected page; the gate, not the booleans, makes that
result unsuitable. Audits/opportunities and all production functions are unchanged.

## C. Controlled Test Website Files

`test-sites/hvac-audit-control/site/` is isolated from `src/app` and `public`.
It contains only two HTML pages, local CSS/diagram, robots.txt and .nojekyll.
`test-sites/hvac-audit-control/manifest.json` defines ground truth; its README
contains operator instructions. All names/regions are imaginary; the only number
is the reserved fictional (202) 555-0147. No customer data, forms, scripts, external
asset requests, AI, analytics, database connection or hosting configuration.

## D. Positive-Evidence Page

`index.html`: Northstar Test Heating & Air. The real extractor preserves the title,
heading, tel URI, scheduling fragment and core service links. Phone, booking,
emergency, area, financing and maintenance signals are detected. CTA count is two
(phone plus appointment), and all seven rule families yield no opportunity. The
same-document scheduling destination exists but is explicitly non-functional.
This proves discoverability of supplied static HTML, not a working integration.

## E. Controlled-Absence Page

`absence.html`: Meadow Test Climate Care. No phone, booking, emergency, contact link
or form evidence. Substantial static service/area/financing/maintenance content
passes the unchanged gate. Exactly three ranked opportunities: weak lead capture,
weak emergency conversion, missing online booking. All evidence is analyzed_page,
with traceable observed values and analyzer details. No inferred business-wide lack.
The synthetic matching catalog maps these to conversion, emergency landing page
and booking integration respectively. An unrelated, empty or inactive catalog
leaves every service ID null without suppressing the supported opportunities.

## F. Ground-Truth Manifest

Version 1 includes page keys/filenames, scope, playbook/schema context, expected
titles, H1 counts, main-text excerpts, normalized links and target IDs, individual
signal booleans, deliberately absent fields, CTA counts, service categories and
expected ranking. Uncertainty is explicit for hydration, partial representations,
hidden UI, ambiguous keywords, unrecognized challenges and unverified destinations.
Synthetic IDs/catalog data are test-local and are never inserted into Supabase.

## G. Actual Engine Test Matrix

PASS/FAIL here compares behavior to ground truth, NOT assertion count. All results
below come from the real implementation with synthetic fetch/DNS inputs. Tests
label seven known-limit characterization cases; those assertions pass when the
limitation is reproduced. They must not be reported as successful accuracy tests.

| Case / layer                    | Ground truth / expected result                                   | Observed actual result                                          | Result                          | False-positive/negative and opportunity eligibility                                  |
| ------------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------ |
| A extraction                    | Title, heading, phone, anchor and targets preserved              | All manifest expectations match                                 | PASS                            | No extraction discrepancy; evidence usable within page                               |
| A detection                     | Phone/booking/emergency/area/plan/financing present              | All true; 2 CTAs                                                | PASS                            | No targeted false absence; not proof of operational booking                          |
| A rules/ranking                 | No unsupported absence opportunities                             | Zero rules and zero ranked items                                | PASS                            | No opportunity invented to fill list                                                 |
| B extraction/quality            | Substantial ordinary static copy                                 | Main content exceeds both floors; sufficient                    | PASS                            | Legitimate controlled absence not suppressed                                         |
| B detection                     | Phone/booking/emergency/contact absent only here                 | False, medium confidence; CTA=0                                 | PASS                            | Suitable only as page-scoped not-detected observations                               |
| B rules/ranking                 | Three supported page findings                                    | Lead capture, emergency, booking; deterministic order           | PASS                            | Each has observed value, scope, source and analyzer evidence                         |
| B service matching              | Catalog capability must be explicit                              | Correct three synthetic services selected                       | PASS                            | Catalog services are test-only, not real tenant changes                              |
| No relevant service             | Empty/unrelated/inactive catalog                                 | Three findings, all mappings null                               | PASS                            | No invented service; user-visible finding still valid                                |
| Pure JS shell                   | Insufficient static content                                      | Thin, no recommendations; tel positive retained                 | PASS                            | Unverified negatives not promoted                                                    |
| Thin page                       | Insufficient representative copy                                 | Thin, no recommendations                                        | PASS                            | No confirmed absence inferred                                                        |
| Recognized challenge, long copy | Access denied even with enough words                             | Challenge, no recommendations                                   | PASS                            | Challenge is not treated as customer site                                            |
| HTTP 403 / 206                  | Unusable/error or partial content                                | Transport rejects before extraction                             | PASS                            | No opportunities allowed                                                             |
| JSON media                      | Unsupported content type                                         | UNSUPPORTED_CONTENT_TYPE before extraction                      | PASS                            | No opportunities allowed                                                             |
| Interrupted stream              | Response does not complete                                       | FETCH_FAILED, no extracted result                               | PASS                            | No partial-page recommendations                                                      |
| Missing body/html closers       | Substantial but visibly truncated document                       | Incomplete, no recommendations                                  | PASS                            | Gate remains conservative                                                            |
| Safe redirect                   | Independent resolver checks, final URL evidence                  | Two host validations, correct final URL and redirectCount=1     | PASS                            | Final-document evidence retained; no real redirect executed                          |
| Supported unusual static markup | Icon/ARIA/entity/uppercase controls and footer tel               | Target signals true; no false absence                           | PASS                            | CSS/responsive visibility still unproven                                             |
| Removed appointment link on A   | Booking link absent, other evidence unchanged                    | Only missing_online_booking is generated                        | PASS                            | Supported page-scoped observation; no contradictory lead-capture finding             |
| Whitespace in closing anchors   | Legal HTML retains booking links                                 | Regex loses anchors or merges phone with appointment text       | FAIL                            | False missing-booking opportunity or misattributed evidence; not suitable            |
| Facebook substring              | Social link is not booking                                       | onlineBooking=true and CTA=1                                    | FAIL                            | False positive detector; supported missing-booking opportunity suppressed            |
| Hidden controls                 | Hidden markup is not visible conversion UI                       | Phone/booking/emergency=true, no opportunities                  | FAIL                            | False positives for visibility, resulting missed opportunities                       |
| Hybrid hydrated widget          | Later phone/booking/emergency content is unknown to static fetch | Sufficient base copy; false values; three absence opportunities | FAIL                            | Misleading relative to rendered content; requires representation caveat/human review |
| Broken appointment fragment     | Booking function/destination is not verified                     | Booking=true, no opportunities                                  | FAIL for destination certainty  | Anchor text itself exists; it is not proof of usable booking                         |
| Complete main-only fragment     | Completeness is unknown                                          | Sufficient; three absence opportunities                         | FAIL for completeness certainty | May be valid fragment or silent truncation; cannot certify absence                   |
| Unrecognized long interstitial  | Requested business page not supplied                             | Sufficient; five ranked opportunities                           | FAIL                            | False absence opportunities from an access notice; not suitable                      |

## H. False Positives and False Negatives

1. **HIGH reliability**: `html.ts/getPairedTags` requires an exact closing tag.
   Legal `</a` + newline + `>` can lose anchors or consume subsequent markup as a
   previous link. This was discovered when formatting the positive page, not by
   weakening the gate. Page A uses conventional closers; a dedicated test retains
   the whitespace variant and its misattributed evidence. A future scoped fix can
   handle legal whitespace; a real HTML parser is the robust longer-term choice.
2. **HIGH reliability**: `content-quality.ts/assessContentQuality` has finite
   challenge signatures. A substantial synthetic "Request unavailable" access
   notice is accepted and leads to five false opportunities. Future work needs
   conservative access-notice detection/uncertainty with ordinary-business tests.
3. **MEDIUM reliability**: `signals.ts/extractNormalizedAuditSignals` and
   `findCtaEvidence` use substring `book`; facebook.com counts. Use semantic tokens
   and href/text-specific rules with regressions, not a broad domain allowlist.
4. **MEDIUM limitation**: `html.ts/removeNonContentHtml` does not implement browser
   visibility. Obvious hidden attributes could be handled statically, but CSS
   media queries/computed visibility and interactive state cannot be established.
5. **Architectural limitation**: a substantial static page with hydration-only
   booking content can pass the gate and yield absence rules. No finite static
   check guarantees rendered completeness. Do not claim full browser accuracy or
   introduce a rendering service in this task. A future design could use explicit
   unknown/representation labeling and suppress ambiguous absence inferences.
6. **Contract limitation**: link presence is not working booking, a dedicated
   service page, or a validated destination. Broken fragments and complete-looking
   partial responses are not proof of functional availability or completeness.

No scanner fix is made in this validation-only change. These findings constrain
investor claims and Phase 2 readiness even though the controlled baseline passes.

## I. Content Quality and Detector Results

Extraction: canonical pages pass; closing-tag whitespace does not. Detection:
ordinary phone/header/footer/ARIA/booking/emergency fixtures pass; hidden and
substring cases do not establish accurate visibility. Quality: known insufficient
cases fail closed; finite signatures and content-length thresholds are incomplete.
Opportunity generation: canonical A/B rules and traceability pass, but false detector
or quality inputs propagate. Service relevance: explicit capabilities pass, unrelated
catalogs stay null. These are five distinct assessments, not one success score.

## J. Remaining Static-Scanner Limitations

No JS execution, hydration, iframe-widget inspection, browser state, CSS visibility,
target-link validation or multi-page inspection. Static header/footer phone anchors
work; absent hydration-only numbers cannot establish whole-site absence. Responsive
markup may exist for multiple states. The quality floor favors safe rejection of
very short genuine sites but does not prove every accepted site is complete.
No conclusion about the original One Hour response is supported by these fixtures.

## K. Free Public Hosting Plan

Follow `test-sites/hvac-audit-control/README.md`: separately approved public
fixture-only GitHub repository, upload `site/` contents to root, enable Pages from
the default branch/root, verify HTTPS and both paths, freeze commit/hashes. No
custom domain, application integration or spend. GitHub Free supports public
repository Pages; current owner/account policy eligibility was not inspected.
If unavailable, seek approval for Cloudflare Pages Free Direct Upload instead.
Official setup/eligibility and limitations links are in the README. No publication
or account/hosting changes have occurred.

## L. Quality Gate Results

Baseline: 80 files / 766 tests. Added: one file / 32 checks (25 contract/reliability
checks and seven known-limitation characterizations). No prior test is removed.

- `npm run lint`: exit 0.
- `npm run typecheck`: exit 0.
- `npm run test`: exit 0, 81 files / 798 tests passing.
- `npm run build`: exit 0, Next.js 16.3.8, 13/13 static pages generated.
- `npm audit --omit=dev`: exit 0, zero vulnerabilities. The restricted-network
  attempt could not reach npm; the permitted network-enabled retry succeeded.
- `git diff --check`: exit 0; the staged new-file diff is also checked before commit.

An initial test expected category discovery order rather than category membership;
that assertion now compares sets via sorted copies without mutating signals.
Typecheck also caught ES2023 `toSorted` in the new test; ES2022-compatible copied
arrays are now used. Formatting exposed the parser defect documented above;
it was not corrected or hidden by weakening a production rule.

Browser QA rendered both pages at 1280x900 and 360x800. Local visual asset loaded,
no horizontal overflow, zero forms/scripts, phone and scheduling CTA visible on A
and omitted on B. The inert appointment anchor reached the expected section.
Screenshots are outside Git in `controlled-audit-validation/` beneath the chat's
visualization workspace. Local serving does not bypass scanner SSRF restrictions.

## M. Files Changed and Local Commit

Only new fixture site/manifest/README, this report and
`src/features/audits/analyzer/controlled-site.test.ts`. No production function,
dependency, lockfile, migration, environment file, security/rate/concurrency rule,
auth/RLS, provider, proposal, snapshot, PDF or share implementation changes.
One local commit only after all quality commands succeed; SHA is in the handoff.

## N. Exact Operator Actions Required

Review the seven limitation cases before making accuracy claims. Approve free
fixture-only publication or publish manually using the README. Send the final
HTTPS URLs and fixture commit/hashes; do not substitute a third-party site.
Confirm two scans/new labeled Aya test records and the deployed Preview SHA.
No permission for AI or unrelated product workflows is implied.

## O. Recommendation for Two Future Live Scans

One Page A scan and one Page B scan only, after explicit approval. A must retain
positives and not invent absence opportunities. B must retain sufficient quality
and show the three page-scoped rule families; catalog mapping depends on actual
existing relevant services, never synthetic catalog insertion. Compare fetch status,
final URL, byte size, quality/version and original evidence against frozen source.
Stop for unexpected results; don't rescan, alter history or force favorable output.
Local injected responses establish neither deployed fetch compatibility nor database
round-trip correctness. Production/One Hour remains untested in this task.

## P. Phase 2 Readiness

Not cleared for Sales-Focused Proposal Content or investor accuracy claims yet.
The static fixture pack is ready for controlled public setup; the live two-page
verification is pending, and the reproducible parser/challenge defects need a
separately scoped decision/fix before broad reliability claims. No Phase 2 work
has begun and no live authorization has been inferred from this preparation.
