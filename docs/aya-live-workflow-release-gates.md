# Real Agency Workflow And Domain Release Gates

Status: local product integration, NOT a live-ready release. The final acceptance
target is the existing Scanvoro Vercel project and authenticated Aya workspace.
No parallel demo application, new review page or tenant-specific product code is needed.
Synthetic tests establish local safety only, not successful real agency acceptance.

## Implemented In The Existing Application

- Real Agency Settings renders PNG/JPEG upload, replace, remove and current-logo
  preview. The authenticated same-origin API derives agency ownership server-side.
  Uploads are bounded, decoded and normalized to private canonical PNG assets.
- Real Services create/edit supports explicitly approved deliverables, exclusions,
  client inputs and completion checks. General descriptions are not commitments.
  Missing migration hides approval and rejects attempts to persist it; ordinary
  catalog editing remains available without pretending approval was saved.
- The real Proposal Builder uses saved verified findings, relevant real services,
  manual prices and explicit saved-offer confirmation. Generate Complete Proposal
  invokes only configured Groq, validates exact permitted output, preserves edits,
  and leaves Draft. Ready and delivery remain separate human decisions.
- Name, page evidence, customer relevance and exact approved project scope
  personalize the draft. Groq currently selects constrained full-copy alternatives,
  not unrestricted bespoke prose. Live persuasiveness and provider success remain
  acceptance gates; no provider test was performed in this work.
- Existing immutable delivery snapshots feed the professional PDF route. New
  snapshots freeze active branding with agency identity. Later logo replacement or
  removal does not alter historical snapshot assets. Legacy snapshots without an
  asset remain name-only; never retroactively attach the current logo.

## Client-Facing Content Correction

Complete prompt version v7 preserves the strict three-field output contract.
Summary presents the specific project, detected page observations, conditional
customer relevance and review limits, without a repeated Executive summary label.
Scope contains approved deliverables/exclusions/inputs/checks only, and explains
that a service name does not add unlisted implementation work. Next Step refers to
the quoted investment, not internal saved state. No timelines, ROI or credentials
are invented, and catalog descriptions are not copied into approved scope.

The PDF removes redundant exact section-heading lines at rendering time, not from
stored narrative. It keeps section openings with their initial deliverable content,
uses client-facing additional-detail/background labels, avoids repeated descriptions
and explicitly separates service titles from included work. Unique frozen narrative,
line detail, catalog background, prices and exclusions remain available. The service
overview explicitly defers to Scope for included work; it does not falsely exclude
capabilities that overlap approved deliverables. Historical snapshot records and AI content
are never rewritten by these presentation changes. A test-only review banner remains
intentional for titles containing TEST ONLY or unresolved scope markers.

## Exact Pending Database Dependencies

`202610170001_agency_branding.sql`:

- Creates agency_branding_assets (immutable metadata) and agency_branding (active
  selection). Tenant-bound read policies; server-only asset inserts/selection RPC.
- Adds nullable proposal_delivery_snapshots.branding_asset_id, tenant-matching
  composite FK/index and trigger freezing name/logo on new snapshots; updates cannot
  substitute identity. Legacy rows remain null; no backfill is authorized.
- Adds owner-checked server-only set_agency_branding_asset, asset-immutability trigger,
  private agency-branding Storage bucket and restrictive browser object policy.
- The transaction deliberately refuses an already-existing bucket with that name.
  Check current bucket state, permissions and migration ledger before application;
  do not create a bucket manually first or weaken policies to bypass that guard.

`202610180001_approved_service_scope.sql`:

- Adds nullable agency_services.approved_scope JSONB, shape/type/trimmed-length
  constraint for the exact four scope fields, and a column comment.
- No service backfill, price change, grants, RLS replacement, new RPC or Storage change.
  Existing services remain unapproved until their owner explicitly approves scope.

No new migration is required for this content correction. Do not run a blanket db
push that applies an unreviewed pending set. Verify exact files/checksums and the
live ledger, rehearse both prerequisites and obtain explicit application approval.
The branding DDL is transactional; rehearse scope DDL in an explicit controlled
transaction. Assess table locks/maintenance timing on the restored dataset.

## Data Preservation And Recovery Prerequisite

The migrations are additive and intended to preserve existing users, agencies,
services, prices, audits, drafts and delivery snapshots. That is a design property,
not proof that a shared-project migration is safe. Preview and Production use the
same Supabase project; a Preview test write is a real shared-database write.
PostgREST's Unhealthy state and verified recovery capability remain unresolved.
Do not infer health from successful recent queries or restart anything silently.

The first owner decision is approval of a recovery-readiness preparation step:
confirm existing local tooling/resources and a proposed private encrypted backup
destination/key-handling plan, and permit a read-only live DB version/migration/
Storage/configuration scope inventory. Do not collect credentials in chat. This is
not approval to export records, apply SQL or change services. If earlier preflight
evidence exists, reuse it and verify only gaps; do not repeat remote health polling.

After the owner approves the exact protected destination, credential handling and
export/restore scope: preserve a consistent DB recovery point including applicable
Auth data, roles/privileges, schemas, policies/RPCs and migration history; separately
preserve Storage object bytes and required platform configuration. Document consistency
windows, exclusions and any managed platform objects that are not portable. Verify
integrity, encrypted off-device custody and access controls. Restore only into an
isolated non-public environment, prevent email/AI/webhook side effects and verify
relations/prices/RLS/RPC grants/Auth recovery before migration rehearsal.

No recovery export/restore or migration rehearsal has yet been verified by these tests.
Do not assume current PostgreSQL version from a cached version string. No new paid
plan is implied; missing tools/resources/costs must be reviewed before installation.

## Minimum Safe Protected Preview Sequence

1. Complete approved recovery preparation, then separately authorized recovery-point
   export, isolated restore verification and exact migration rehearsal. Investigate
   unresolved API health without mutating the project unless separately approved.
2. Owner approves the exact two migrations and maintenance/rollback plan. Apply only
   that set; verify bucket/private access, grants/RLS, ledger, snapshot immutability,
   new-column availability and old application compatibility. Do not drop new data
   during rollback; favor the previous application plus preserved additive schema.
3. Approve one Aya service's deliverables, exclusions, inputs, completion checks and
   final test-offer pricing. Do not automatically reinterpret existing draft notes.
4. Separately authorize pushing a reviewed feature/release commit and protected
   Preview on the existing Vercel project. Verify exact SHA, environment, protection,
   Scanvoro build-time name and Preview-only Groq settings without revealing secrets.
   Never deploy this feature to an unprepared schema or change shared env settings.
5. Owner signs into Aya at that exact Preview hostname. Under explicit bounded write
   authorization, upload her PNG/JPEG in real Settings, refresh/reopen and verify it.
   Configure approved service scope; use the saved controlled audit, not a new scan.
6. Create at most the authorized new test draft, select supported findings/services,
   confirm quantities/prices/exclusions, save and reopen before AI. Do not overwrite
   old drafts, retroactively change snapshots or treat unmatched findings as services.
7. Verify current Groq billing/limits and authorize one generation. Review actual
   copy for grounding, client value, scope and limits; edit, save/reopen and explicitly
   approve Ready. Local template tests are not evidence of a real Groq response.
8. Separately authorize a new test delivery snapshot and PDF. Verify Aya's saved
   logo, exact approved scope/manual totals, page breaks and historic-logo behavior.
   No share link, rescan or additional provider call is implicit in this sequence.

## Production And Custom Domain (Later Approval)

Promote nothing until the real Aya walkthrough passes and owner approves the exact
release SHA, schema state, provider cost controls and rollback path. Keep tenant
isolation, auth, secrets and protected Preview intact. Do not bundle new features.

Then approve the actual owned domain/canonical hostname. On the existing Vercel
project, verify the intended Production assignment and use the exact DNS records
Vercel supplies, certificate readiness and canonical redirect behavior. Do not guess
DNS values, change mail records or attach the feature branch as the public domain.
Review domain and Preview protection scope rather than assuming it follows an alias.

Update Supabase Site URL and exact HTTPS callback/redirect allowlist only with owner
approval. Because Auth configuration is shared, preserve authorized Preview callbacks
and test sign-in/confirmation/sign-out at both hosts. Sessions are hostname-specific;
do not expect Aya's Preview login to transfer automatically. Verify origin-sensitive
logo upload and PDF actions on the real domain, branding and approved provider config,
and continued access/revocation for existing delivery links before retiring old URLs.

Official references (configuration planning, not actions performed):

- https://vercel.com/docs/domains/working-with-domains/add-a-domain
- https://vercel.com/docs/deployment-protection
- https://supabase.com/docs/guides/auth/redirect-urls

This document grants no operational authorization. Successful owner-approved real
Aya end-to-end acceptance on the deployed SaaS remains the release criterion.

## Local Verification Only

Lint, TypeScript and the Next.js 16.3.8 production build passed (13/13 static tasks).
All 105 test files / 1,121 tests passed; production dependency audit reported zero
vulnerabilities, with no dependency or migration changes. Four added regression
cases cover the approved-scope/catalog distinction, duplicate headings, client-facing
line labels and keeping the scope opening with its first deliverable. Existing
branding isolation, replacement/removal, legacy snapshot and frozen-PDF tests passed.

The actual renderer was exercised with fictional fixture data and a synthetic raster
placeholder, not Aya's logo or records. The final two-page PDF was text-inspected and
visually checked, including an independent PDFium render. This is layout QA, not
another application, a live upload, an accepted Groq proposal or the owner's final
deliverable. No live AI, remote write, export, migration, push, deploy or DNS change
was performed. Master and the existing isolated Preview remain unchanged.
