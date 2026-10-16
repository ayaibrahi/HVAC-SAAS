# Phase 2: Sales-Focused Proposal Content

## Baseline and health gate

Started clean on `feature/scanvoro-phase-b-simplified` at
`6f06e38c0b3d09ab7c8f729af7d05fb927121e80`. Master remains
`09985c4e4f2503963833c91ad9b6f6c22480a2e4`. Read the Master Plan,
installed Next.js forms guide and existing proposal/AI/delivery code.

Read-only inspection on 2026-10-16 at 16:31:22 UTC (19:31:22 Cairo):
Supabase overview still said **Unhealthy**. The preceding overview window
(18:02-19:02 Cairo) displayed 223 requests, 100% success, no displayed gateway,
Auth or Postgres errors; this is a limited reporting window, not universal uptime.
Database diagnostics for 18:30-19:30 showed memory usage 406.51 MB, database
space 0.03 GB / 2 GB. CPU/network/IOPS/connection/disk charts could not load.
A SELECT-only query answered at `2026-10-16 16:31:21.999952+00`, with recovery
false and transaction_read_only off. No write test was performed. Existing
authenticated Scanvoro results also reloaded successfully. No service restart,
configuration change or repair was attempted. The label's root cause remains
unconfirmed; there is no established critical incident, but the health issue is
not declared resolved. Proceed only with isolated local development, no deployment.

## Existing sales weaknesses (recorded before changes)

- New drafts are blank: useful observations do not become a client-oriented story.
- The prompt requests summary/scope/next step but gives little sales structure.
- Free-form output checks do not prove that scope commitments or credentials are
  sourced; successful AI regeneration can replace already edited narrative.
- Selected line descriptions exist, but are not included in the AI input.
- The preview reflects saved fields; it must not imply unsaved edits are saved.
- No agency credentials/testimonials field exists. Omit that section entirely.

## Existing model, new content

Use only existing `summary`, `scope`, `nextStep` and selected line descriptions.
Summary holds client opening, analyzed URL, plain-language canonical observations,
conditional business relevance and selected-service relevance. After the commercial
refinement, Scope no longer copies the catalog description. It carries an explicitly
saved line description for review, or a missing-deliverables placeholder. A saved
description identical to the catalog capability text is treated as unspecified
scope, not an approved commitment. Deliverables and schedule remain to be agreed.
Prices/quantities/discounts remain
in existing line items and totals. Next step asks for a review, not an invented
meeting link, deadline or commitment. No serialized hidden sections or migration.

The optional local starting draft fills EMPTY editor fields only. It is not
autosaved, cannot alter prices/selections, and cannot create a delivery version.
The existing Save and Ready controls remain the approval path. Old text is not
rewritten, and existing immutable snapshots are never regenerated automatically.

## AI boundary

Prompt v4 (original implementation: v3) retains the strict three-string output
schema and provider architecture.
AI selects complete wording from server-built options, not unrestricted new prose.
Runtime membership checks reject even plausible invented wording, deliverables,
credentials, prices and metrics, in addition to the existing safety filters.
This deliberately favors a useful deterministic draft over unconstrained copy.
The same source reconstruction and budgets apply to local suggestions and AI.
Verified quality, current rule support, owned selections and active services are
required. Historical AI insight prose is not promoted to new evidence.

AI generation is available only for an empty saved Draft with no unsaved edits.
The final write checks that it is still empty and compares `updated_at` to the
version captured BEFORE generation, then uses the same timestamp in its atomic
update predicate. Changes to selected work, prices, title or text during generation
invalidate the pending copy. Manual editing remains available
for historical/unverified proposals; they are not silently repaired or deleted.

## Limits and acceptance

Missing, inactive or unsupported automatic matches do not gain invented services.
Explicit manual service selection retains its existing authority and semantics.
Automatic copy additionally requires the selected service's actual scope to match
the finding using the existing matcher; unrelated selections remain manually editable.
No detailed implementation promise is generated from a broad catalog description.
Human review must agree actual deliverables before delivery. Client content is US
English; UI copy remains English/Arabic. No new Arabic PDF support is claimed.

Local tests and sample only: no scans, provider requests, database writes,
migrations, public links or deployments. Phase 3 PDF visual design is untouched.

## Original implementation verification

Final local checks on 2026-10-17 (Cairo):

| Command | Result |
| --- | --- |
| `npm run lint` | PASS, exit 0 |
| `npm run typecheck` | PASS, exit 0 |
| `npm run test` | PASS, 85 files / 912 tests, exit 0 |
| `npm run build` | PASS, Next.js 16.3.8, 13/13 static pages, exit 0 |
| `npm audit --omit=dev` | PASS, 0 vulnerabilities, exit 0 |
| `git diff --check` | PASS, exit 0 |

The baseline had 864 tests; the new total adds 48 without removing regressions.
Coverage includes canonical page evidence, unknown/contradictory signals, owned
active service selection, unmatched findings, unsupported copy in all three
fields, source budgets, provider rejection before usage for invalid saved state,
preserved historical narrative, Ready protection and optimistic write races.
Local snapshot/public-view/PDF compatibility tests preserve reviewed copy and
manual prices without changing delivery, sharing or PDF implementation.

Sandbox-only Vitest transform errors and registry DNS failure required rerunning
the same commands outside the sandbox. An initial Turbopack CSS-worker failure
cleared after removing only the verified ignored `.next/cache/turbopack` cache.
No test was suppressed, no dependency/configuration was changed and the final
build passed. Generated `next-env.d.ts` dev-path changes were excluded.

Browser verification used an isolated component viewer on localhost:4190 and
the real Next.js sign-in page on localhost:4191. The viewer bundles the actual
editor components with synthetic Page B data; it has no save, database, scan or
provider connection. Verified English/light and Arabic/dark, keyboard focus,
no horizontal overflow, typed text preservation, missing-field filling and a
manual price staying at 750.55 while AI generation was disabled after an edit.
This is not a claimed authenticated live proposal acceptance or provider test.
Screenshots and the viewer live outside Git in the local visualization directory.

## Scoped file inventory

- `src/app/(dashboard)/dashboard/proposals/[proposalId]/page.tsx`
- `src/features/proposals/data.ts`
- `src/features/proposals/content-suggestion.ts`
- `src/features/proposals/sales-content.ts`
- `src/features/proposals/components/content-fields.tsx`
- `src/features/proposals/ai/data.ts`
- `src/features/proposals/ai/generate.ts`
- `src/features/proposals/ai/input.ts`
- `src/features/proposals/ai/prompt.ts`
- `src/features/proposals/ai/safety.ts`
- `src/features/proposals/ai/types.ts`
- `src/lib/i18n/proposals.ts`
- `src/features/proposals/ai/data.test.ts`
- `src/features/proposals/ai/preservation.test.ts`
- `src/features/proposals/ai/input.test.ts`
- `src/features/proposals/ai/safety.test.ts`
- `src/features/proposals/ai/test-fixtures.ts`
- `src/features/proposals/builder-test-fixtures.ts`
- `src/features/proposals/sales-content.test.tsx`
- `src/features/proposals/sales-test-fixtures.ts`
- `docs/phase-2-sales-focused-content.md`
- `docs/samples/phase-2-page-b-proposal.md`

## Preview acceptance still required

Request approval before any push/deployment or live provider request. After an
authorized Preview release, verify a dedicated test agency's saved selections,
suggestion editing, save/reopen, pricing, Ready transition and delivery using
only separately authorized test data. Verify Groq v4 compliance separately;
mocked output success is not proof of live model adherence to verbatim choices.
No database migration, dependency, environment change or paid fallback is needed.
Resolve or independently triage the Supabase health label before broader rollout.

## Final commercial refinement

Started clean on the same feature branch at
`06c22f62c7ab26bef3c875c3ae20fd0db8e37dd0`; master is unchanged. The prior review
identified diagnostic jargon, repeated absence statements, a generic service
explanation and no defined work supporting the illustrative price.

- The four verified Page B contact facts become one plain-language observation.
  Only observed false/zero signals are included; unknown facts are not filled in.
  Canonical stored evidence and ranking are not modified.
- Summary explains customer contact friction conditionally and why the selected
  service is relevant. It does not promise implementation or a financial outcome.
- Scope distinguishes agency-entered work from catalog capability. Missing work
  receives an explicit placeholder, not fabricated actions. English/Arabic editor
  guidance asks for work, exclusions, client inputs and completion checks.
- The illustrative Customer Contact Improvement Sprint is manually authored in
  a test fixture only: four proposed actions, access/approval conditions, explicit
  exclusions, no completed-work claim, no invented deadline. USD 500 is supplied
  only by the local fixture. It is not an approved live price or global package.
- The sample preserves the complete prior version and includes exact runtime
  examples with/without entered work, the actual two-page PDF extraction and the
  actual local public HTML visible text. Tests bind sample fields to runtime copy.
- The existing PDF/share renderers still repeat line descriptions under Services;
  public table details collapse newlines, while the full Scope preserves them.
  The PDF scope continues onto page two. Rendered pages were visually inspected;
  no missing text or overlap was observed. No template/layout change was made.
- Existing Ready validation checks nonempty narrative, not semantic completeness.
  Placeholders can still be marked Ready through the existing workflow. A stricter
  approval/readiness gate requires separate product approval and is NOT introduced.
  Human review must resolve notices/placeholders before real client delivery.

Local browser verification repeated typed-text and manual 750.55-price preservation,
AI-disable-on-edit behavior, English/light and Arabic/dark guidance and no horizontal
overflow. This is a synthetic component test, not live database acceptance. Actual
local PDF/HTML examples are in the visualization directory, not a public share link.
Supabase's historical Unhealthy diagnostic remains separate and unresolved.

Final refinement checks on 2026-10-17 (Cairo), all exit 0:

| Command | Result |
| --- | --- |
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `npm run test` | PASS, 86 files / 925 tests (912 existing + 13 new) |
| `npm run build` | PASS, Next.js 16.3.8, 13/13 static pages |
| `npm audit --omit=dev` | PASS, 0 vulnerabilities |
| `git diff --check` | PASS |

Refinement files: `sales-content.ts`, `ai/prompt.ts`, `sales-test-fixtures.ts`,
`sales-content.test.tsx`, new `commercial-content.test.tsx`, `src/lib/i18n/proposals.ts`
and these two proposal documentation files. No migrations, dependencies, provider
transport, pricing, authorization, PDF/share template or persistence changes.
No live AI, scans, DB writes, push, deployment or environment changes.
