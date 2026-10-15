# Phase B service relevance and controlled Preview release

## Scope and baseline

Started clean on `feature/scanvoro-phase-b-simplified` at
`07bf4694629bc6a2b1ee44c60a9c8404e41e2f63`. Read the Master Plan and previous
Phase B reviews. Approved ancestor: `16908289c6a9e403df14611652de726e049b4e6d`.
Local and remote production master: `09985c4e4f2503963833c91ad9b6f6c22480a2e4`.
The only application change is deterministic agency-service matching. No UI,
provider, pricing, persistence, authorization, migrations or dependencies changed.

## Reproduced defect and correction

The old matcher accumulated substring hits in service names/descriptions and
generic category words. A single name hit qualified. Consequently, a financing
conversion section matched emergency conversion and maintenance promotion;
website maintenance matched membership promotion; Platform Integration matched
the substring `form`; and generic description overlap could map booking work to
financing. These failures were reproduced in the actual matcher and HVAC engine,
not inferred from screenshots: the new suite initially had 18 failures (17 case
failures and one integrated engine assertion), with 32 passing tests.

The matcher now uses token-bounded capability phrases per existing HVAC rule.
Specialized findings require specialized scope. Generic website redesign and
conversion work remain eligible for weak lead capture, but do not independently
establish financing, booking, emergency or membership capability. Both names and
descriptions are considered; nearby explicit scope exclusions veto a match.
Uncertain matches return null. Only active catalog entries can be returned.

Named capabilities score 100, exact generic conversion service names score 80,
and description-only capabilities score 50. An already-eligible canonical name
gets a 20-point tie preference. Existing name/ID tie breaking remains deterministic.
These are internal service-choice weights, not opportunity ranking scores.
The existing opportunity ranking, 12-point service-match bonus and top-five limit
are unchanged. Evidence, page scope, priority, confidence and prices are untouched.

## Data flow and historical compatibility

The application authenticates, derives agency ownership, loads the owned audit
and prospect, requires a completed audit, then queries only that agency's service
catalog. Rules create evidence-backed candidates; the matcher assigns an existing
service ID or null; ranking and existing server-only persistence follow. The pure
matcher consumes this server-loaded catalog; it is not an authorization layer.

Deployment itself does not rewrite, delete or regenerate saved opportunities,
AI insights, proposal lines or immutable delivery snapshots. For corrected new
results, use a new test scan and explicitly generate its findings. The existing
regeneration action on an old audit upserts by audit/rule and reconciles its top
five: it can remove unreferenced dropped rules but retains proposal-referenced
rules. This behavior was not changed or executed against live data in this task.

Existing insights may remain attached to stable opportunity IDs after a service
match changes. Existing draft lines retain their saved service descriptions and
manual prices. Review old AI prose and drafts explicitly; do not assume they were
refreshed. Prefer a fresh audit for the release smoke test. No automatic AI calls
or historical migrations are introduced.

## Website-to-proposal review

Existing tests cover duplicate website warnings/explicit override, pending and
double-submit guards, saved-business/failed-scan recovery, scan retries and audit
concurrency. Failed or unknown scans do not generate unsupported findings.
Unmatched findings stay visible with an explicit no-matching-service message.

Prepare Proposal still creates an empty owned draft from a completed owned audit;
selection and pricing occur in the builder. A default service shown in an unchecked
builder row is not a saved selection; users must choose a relevant active service.
Existing draft resume preserves its original audit, selections and prices. Successful
redirects remain outside error-catching boundaries. The creation/navigation error
recovery asks users to check saved proposals before retrying. Durable cross-request
creation idempotency is still absent; a new invocation can create another draft.
The workspace's recent-proposal lookup is bounded to five summaries.

AI cannot alter the deterministic mapped ID, evidence or manual pricing through its
strict enrichment output schema. It receives the server-loaded mapped service,
not an invented catalog. However, free-text prompt/regex safety is not a semantic
proof that all unsupported service prose is impossible. Human review remains
required before client delivery. No provider or safety logic was changed. Groq
selection remains explicit and has no paid OpenAI fallback.

## Regression results

- 45 labeled synthetic catalog cases plus five invariants: all 50 pass.
- Cases cover financing, booking, emergency CTAs, memberships, contact forms,
  general/website/mobile conversion work, service areas, service pages, unrelated
  services, scope exclusions and ambiguous descriptions.
- Empty/inactive catalogs, competing valid matches, input-order ties, unchanged
  evidence/priority/confidence, unchanged ranking weights and deterministic top
  five are covered. Viewport metadata alone does not invent a mobile finding.
- `npm run lint`: exit 0.
- `npm run typecheck`: exit 0.
- `npm run test`: exit 0; 73 files / 675 tests passed, including all 625 prior tests.
- `npm run build`: exit 0; Next 16.3.8, 13/13 static pages generated.
- `npm audit --omit=dev`: exit 0; zero vulnerabilities.
- `git diff --check`: exit 0.

External synthetic browser harness: 178 checks, zero page errors, four mocked
non-proposal requests, off-loopback network denied. Actual components rendered at
360/768/1280/1440px in English/Arabic and Light/Dark, with keyboard, modal focus,
pending states, recovery and actual 200% zoom. Financing maps to Financing
Conversion Section while emergency stays unmatched. Built-app checks confirmed
six protected routes (including the editor) redirect unauthenticated requests to
sign-in with HTTP 307. Temporary server credentials were empty.

Artifacts outside Git are under:
`C:/Users/CompuMart/.codex/visualizations/2026/09/19/01a0bb1e-a9c4-7791-b20d-cc200a9521c2/phase-b-website-first-review/`.
These are synthetic/component and mocked-storage checks, not live authenticated
Supabase, Groq, PDF delivery or share-link smoke tests.

## Remaining limits

This is finite English capability matching, not natural-language understanding.
Unlisted synonyms, Arabic catalog names and complex negation can be unmatched;
irrelevant prose containing a supported capability phrase can still be ambiguous.
Catalog descriptions should explicitly state the service scope; all suggestions
require agency review. No extra detectors or automated service inference were added.
Partial English-only proposal surfaces and the prior idempotency limitations remain.

## Preview verification and operator checklist

Push is authorized only for `feature/scanvoro-phase-b-simplified` after clean-tree,
remote-master, history and verification checks. Do not merge, promote, change
environment settings, alter Supabase or run live scans/AI during release verification.
Record actual push SHA and deployment status in the final release report. Git push
success alone does not prove Vercel deployment readiness or Preview protection.

Before smoke testing, the operator must verify Vercel's deployment has the exact
release SHA, branch, Preview environment, Ready status and protection enabled.
The current browser session requires Vercel sign-in, so settings cannot be confirmed
from the local code. Verify `NEXT_PUBLIC_PRODUCT_NAME=Scanvoro` applies to this branch
(an older Phase A branch override may not). Code defaults to Scanvoro only when
the setting is empty. Verify Preview `AI_PROVIDER=groq`,
`GROQ_MODEL=openai/gpt-oss-20b`, and privately configured `GROQ_API_KEY`; never share
the key. Check Supabase variable presence and the exact Preview Auth callback
allowlist if needed. No environment settings were changed by this task.

Preview may use production Supabase: use a dedicated test agency and non-sensitive
records, not real customers. Once configuration/protection is confirmed:

1. Sign in with the dedicated test user.
2. Open Websites and confirm the correct test agency.
3. Enter a known HVAC website that you are authorized to scan.
4. Explicitly Add and scan once; observe the pending state.
5. Confirm one saved business and its completed scan (or safe recovery if failed).
6. Generate/review supported findings and their analyzed-page evidence.
7. Confirm every suggested catalog service is relevant; verify unmatched findings.
8. Prepare a blank proposal or resume the intended existing draft.
9. Select relevant services and enter manual prices; do not accept a default blindly.
10. Save the draft and confirm success.
11. Reopen it; verify original selections, prices, currency and audit association.
12. Review all text before preparing the client-ready proposal and snapshot.
13. Download the PDF and compare it with that snapshot.
14. Verify share-link access/revocation as appropriate without disclosing its token.
15. Check navigation, themes, language, Settings and sign-out.

Optional Groq testing is a separate explicit operator action, only after verifying
the Preview provider configuration. Never issue paid AI calls. Production release
requires separate approval after live acceptance.
