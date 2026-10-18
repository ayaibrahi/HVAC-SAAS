# Phase 3C: Complete Proposal Drafts (Local Only)

Baseline: original feature branch `76f328af1d9262639997b995d5904d40b7f34cb7`.
The isolated UX release branch and master are not modified.

## Offer Authority

Services previously contained only general catalog descriptions. These are not
approved deliverables. A nullable `agency_services.approved_scope` object now holds
four explicitly approved fields: deliverables, exclusions, client inputs and
completion checks. Each is required, trimmed and limited to 800 characters.
Contracts are rejected rather than truncated. Existing services are unapproved.

The service form requires a fresh approval checkbox whenever saving scope. Saving
without that checkbox withdraws reusable approval; it does not change saved
proposal narrative or immutable delivery versions. A withdrawn scope can be
defined and approved again. There is no implicit approval from a catalog description
or proposal line note. No team/contract-signature workflow is introduced.

Pending migration: `202610180001_approved_service_scope.sql`. It adds one nullable
JSONB column and a shape/length check, without backfill, grants, policies or RPCs.
Existing tenant RLS applies. Downward recovery would remove that constraint/column
only after preserving new scope data and rolling back application use. Do not drop
it from an environment already using approved scope without a recovery plan.
No SQL was executed here: migration checks are static, not a PostgreSQL rehearsal.

## User Flow

1. Define and approve reusable catalog scope (enter “None” only when truly intended).
2. Select verified opportunities, relevant real catalog services and manual prices.
3. Keep line notes empty or reconcile them exactly to approved deliverables. Other
   free-form notes require manual review rather than automatic contractual adoption.
4. Save Draft. Inspect approved scope beside each selected service and confirm the
   saved quantities, prices, discount and scope for this offer.
5. Click **Generate Complete Proposal**. Missing prerequisites are explained.
6. Review and edit Summary, Scope and Next Step. Pricing remains separately editable.
7. Explicitly save Ready only after agency review; delivery remains a separate action.

Existing text is never automatically replaced. Existing deterministic “Use
suggested draft” and manual editing remain available. Generating fresh AI copy
requires an empty saved Draft; deliberate clearing/saving is an explicit user action.
There is no auto-Ready, PDF creation, snapshot creation or sharing on generation.

## AI Boundary

Complete generation requires server configuration `AI_PROVIDER=groq`; otherwise it
fails closed without selecting or calling OpenAI. Existing other provider workflows
are unchanged. No live provider call is part of local verification.

The existing strict three-field JSON output is retained. The model chooses from
server-constructed **complete** wording options, not unrestricted prose. This is
deliberately constrained AI-assisted composition, not free-form LLM authorship.
It supplies introduction, executive recommendation, verified page findings,
conditional customer relevance, selected services, exact approved scope, exclusions,
inputs, completion checks and CTA. Commercial/voice variation remains limited;
the agency can edit every narrative field afterward.

Only normalized, revalidated evidence is used. Canonical rules are regenerated;
historical AI wording, raw HTML, contact details and unrelated records are excluded.
Page-level non-detection never establishes unavailable business services, an
untested functional defect or a whole-site deficiency. Names, URLs and contractual
text are data, never instructions. Existing claim filtering remains enabled, and
every output field must match one exact permitted string. Fabricated facts,
prices, guarantees, services and scope cannot be accepted through paraphrasing.

Pricing is recalculated in integer cents and compared with saved lines and header
totals before generation. Prices are NOT sent to or calculated by the model, and
are NOT duplicated into editable AI text. Existing preview/PDF/share projections
render the deterministic investment table beside the narrative. This avoids stale
embedded currency amounts when an owner later edits a price. No ROI justification,
schedule or agency credential is invented to make an investment seem reasonable.

Existing input bounds remain: 32,000 serialized input bytes, 24,000-byte Groq request,
30-second provider timeout, at most two provider attempts and 64,000 response bytes.
Complete output is bounded to 3,500 tokens, Summary 4,000 characters, Scope 8,000 and
Next Step 1,000. Oversized combinations fail with controlled guidance; no evidence
or commitment is silently dropped. Existing legacy output token limits stay intact.
Prompt metadata uses `v6-complete`, output schema remains `1.0.0`. Complete summaries
also quote each selected service's exact approved deliverables in a prospect-specific
project section. This improves offer specificity without allowing new commitments.

## Concurrency And Persistence

The confirmation carries only a SHA-256 revision, not trusted agency/service/price
data. The authenticated server reloads and checks ownership, then rejects stale
rendered state. The revision includes saved proposal, relevant services, scope,
audit/evidence and selected lines. Client-supplied alternate facts are ignored.

A server-only optimistic compare-and-swap on `proposals.updated_at` stores an
expiring reservation in existing proposal JSON. Simultaneous requests from the same
version cannot both reserve it; fresh requests also reject an active reservation.
It expires after 90 seconds if the process dies. Provider attempts finish within
60 seconds under the current timeout/retry limits. A later request can recover an
expired reservation; an old token cannot release or publish over its replacement.

After generation, the server reloads saved sources and compares normalized input,
prices and the reserved version. Application of narrative performs a second
updated-at CAS and checks the reservation token. Newer edits/Ready state win.
The same write stores scope provenance/provider metadata and clears the reservation.
Failure cleanup changes only the reservation with a conditional write. Cleanup
failure is logged without payload and cannot turn successful persistence into a
false failure; expiration permits recovery. No new distributed lock service exists.

During generation an optimistic React Action state disables sibling editing and
save controls immediately; ordinary transition state alone was insufficient in
browser QA. A synchronous ref also blocks duplicate submission in the same form.
Other-tab edits remain protected by server revisions/CAS. Existing save failure
preservation and form refresh behavior stay intact.

## Delivery And Release Gates

Summary/Scope/Next Step and deterministic prices use existing persistence and
delivery fields. Scope provenance is internal proposal AI metadata, not an added
public field. Existing frozen delivery versions are not rewritten by later catalog
edits. Phase 3 PDF and pending Phase 3B branding code/migration are retained unchanged.

Mock-only tests cover approval, tenant boundaries, pricing, multiple/manual matches,
unsupported evidence/claims, bounded Groq requests, timeouts, duplicate reservations,
stale source changes, narrative preservation, save/reopen, Ready and PDF/share
projections. Local browser QA is synthetic, not shared-database acceptance.

Service pages now probe the approved-scope column with an authenticated, tenant-filtered
zero-row query. On a known missing-column response they hide approval controls and
allow basic catalog writes without that column; non-null approval is rejected before
writing. Other database errors fail closed. Omitted scope preserves prior approval;
an explicit null withdraws it on a supporting schema. No alternative approval store exists.

The approved-scope migration is essential for complete generation, not for existing
manual Draft/Ready editing. Persistent agency logos separately require Phase 3B.
Name-only delivery/PDF can use the existing snapshot RPC and a null branding asset;
missing branding tables are handled as unavailable. Do not bulk-apply both pending
migrations merely to enable complete generation. The exact approved migration set
needs recovery-backed PostgreSQL rehearsal and explicit release authorization.
PostgREST health is still unresolved; no health claim follows from these local tests.
Docker startup, real recovery data, remote migrations, live Groq, new scans, writes,
pushes and deployments require separate authorization. The safe eventual route is
recovery verification -> isolated database migration rehearsal -> owner scope/content
approval -> protected Preview with matching schema -> dedicated test-agency acceptance.

## Local Verification

- Lint and standalone TypeScript: passed.
- Full Vitest suite: 103 files, 1,104 tests passed (mock AI/database; local socket tests).
- Next.js 16.3.8 production build: passed, 13/13 static-generation tasks.
- Production dependency audit: zero vulnerabilities; dependency files unchanged.
- Git diff whitespace checks: passed; credential-shaped added-content scan clean.
- Actual component browser fixture: desktop and 360px mobile, English/light and
  Arabic/dark; no horizontal overflow at the narrow viewport. Generation locks all
  edit/save controls immediately, counts one mock provider request, fills editable
  complete fields, remains Draft and retains a subsequent human edit through a mock save.
- A stale generated Turbopack cache initially prevented its CSS worker connecting.
  Only that ignored build cache was archived; the normal build then passed. No build
  configuration or `.next/dev` changes were needed. Initial sandbox-only socket and
  temp-path restrictions were resolved by permitted local execution, not weaker tests.
- No live provider quality, PostgreSQL migration execution or shared-data persistence
  claim is made. No live AI, scan, upload, migration, push or deployment occurred.

The component-only verification above describes the original 946e43f implementation,
not proof of real-app acceptance. The follow-up real Next.js route verification and
actual Aya read-only findings are recorded in `phase-3c-real-app-integration.md`.

## Changed Areas

Proposal orchestration, actions, input construction/revision, provider mode/prompt,
approved full-copy choices, editor controls and eligibility tests; service domain,
validation, forms/actions/data and localized scope labels; database types and the
single pending scope migration. Five focused new test files cover complete content,
orchestration, reservation races, Groq transport and scope approval. Existing action,
save/reopen, preservation and eligibility tests are extended rather than removed.
PDF, delivery, sharing, branding implementation and dependency files are unchanged.
