# Phase 3B: persistent agency logos and frozen delivery branding

Status: local implementation and migration proposal only. Nothing applied remotely.
Baseline: `2a35e45d14ed45abfd793377c0a29f97d9fe3bdf` on
`feature/scanvoro-phase-b-simplified`. Production master remains unchanged.

## Existing infrastructure verified

Local migrations and actual Settings/data code use `agencies.owner_user_id` with
one agency per owner. Existing Settings edits agency name, website and currency.
Delivery snapshots freeze `agency_display_name` and client-facing content/prices;
the website in those snapshots belongs to the prospect, not the agency.
No agency contact fields or logo fields existed. The authenticated Supabase
Storage UI was inspected read-only: no buckets, and no policies under either
Storage objects or buckets were listed. No keys or customer rows were opened.

## Exact additive database proposal

Prepared migration: `supabase/migrations/202610170001_agency_branding.sql`.

- `agency_branding_assets`: immutable UUID records owned by `agency_id`, canonical
  PNG SHA-256, constrained object key, MIME, byte length, width/height, creation
  timestamp. `(agency_id, sha256)` deduplicates identical uploads within a tenant.
- `agency_branding`: one current `active_asset_id` per agency (nullable), timestamp.
  Composite FK requires the active asset to belong to that agency.
- `proposal_delivery_snapshots.branding_asset_id`: nullable composite FK, indexed.
  No historical backfill, mandatory field, existing RPC signature change, or
  pricing/narrative alteration.
- Trigger freezes the database agency name and active logo on new snapshot insert.
  An agency-row share lock serializes this against logo-selection/name changes.
  Updating frozen name or asset ID is rejected; normal snapshot status transitions
  remain supported. Asset metadata updates are also rejected.
- Private `agency-branding` bucket: PNG only, 1 MiB maximum stored object.
  The migration aborts if that bucket already exists; it never repurposes it.

The migration is transactional. Nullable additions preserve old application
inserts and `select *` consumers; the existing snapshot RPC keeps its signature
and service-role-only execution grants. Old Production can continue operating
name-only. It cannot display this new logo field until the new application is
separately deployed. DDL/FK/index locks are possible; review table sizes and take
a recoverable backup before approved application.

## RLS, privileges and authorization

Both metadata tables enable RLS with owner-only authenticated SELECT. No client
INSERT/UPDATE/DELETE policies or privileges exist. The service role receives
SELECT/INSERT on immutable assets and SELECT on current selection. Selection
changes use only `set_agency_branding_asset(uuid, uuid, uuid)`, a fixed-search-path
SECURITY DEFINER RPC granted to service_role, explicitly revoked from PUBLIC,
anon and authenticated. It checks current owner, asset ownership and existence
of the fixed-bucket object, and locks the agency row.

A restrictive Storage policy denies all new-bucket object access to anon and
authenticated, even if an unrelated permissive policy grants broader access.
It does not affect other buckets. The server alone reads/writes Storage; no
client upload token, signed URL, public URL or service-role secret is returned.

`/api/agency-branding` derives agency/user from the existing authenticated owner
session. PUT accepts only raw image bytes, never ownership IDs, storage paths or
external URLs. DELETE removes only current selection. Mutations require exact
same-origin Origin; GET returns only the owner's current logo. All responses use
private/no-store and nosniff. Errors are controlled; no payloads/credentials are
logged. Before migration, Settings disables management with an approval notice;
direct mutation attempts fail before Storage writes.

## Processing and lifecycle

Uploads accept declared PNG/JPEG only, but do not trust MIME or filenames. Actual
signatures and decoding are validated with the Phase 3 bounded Sharp decoder:
1 MiB compressed input, 16..2048 dimensions, 2 million pixels, aspect <= 8:1,
single-image metadata, four channels maximum, three-second processing timeout.
The raw HTTP body has a ten-second total deadline and an independently enforced
1 MiB streaming limit (Content-Length cannot bypass it).

Pixels are normalized to orientation-correct sRGB RGBA, within 600x240 without
upscaling, then encoded as metadata-free PNG. Transparency is preserved. Canonical
PNG bytes determine `${agencyId}/${sha256}.png`; original filenames are discarded.
Uploads use `upsert:false`. A duplicate upload is never overwritten: the existing
bytes are re-read and verified before activation. Metadata insert deduplicates
concurrent identical uploads; activation is an atomic RPC. Failed normalization,
upload, metadata registration or activation does not replace the prior selection.

Authenticated mutations have a basic 10-attempt/5-minute per-agency, per-process
limiter. It is not distributed or a storage quota. Broad multi-instance rollout
requires separately reviewed distributed admission/quota controls. No billing or
new infrastructure service is introduced here.

Replacement/removal never deletes prior objects or asset records. Failed uploads
can leave an inactive object/record; retries reuse verified content. No automatic
garbage collection exists. Objects are retained even after agency deletion until
an explicitly approved, reference-aware retention/erasure process removes them.
Agency/proposal deletion cascades database records as before; composite FKs are
deferred so legitimate agency cascades do not conflict. Never delete an object
while a retained snapshot references it. This retention trade-off needs owner
acceptance and monitoring; do not introduce a blanket Storage expiry policy.

## Immutable rendering and existing version semantics

PDF download first obtains the tenant-authorized snapshot, then reads only its
frozen asset ID, filtered by agency. Reads validate the asset schema/path, PNG
signature, hash, size and decoded dimensions. Corrupt, unavailable or foreign
assets fall back to the snapshot's original name, never today's active logo.
There is no network-logo URL input and no change to stored financial/narrative
fields. Changes to the Settings profile cannot retarget old snapshots.

Existing snapshot idempotency is intentionally preserved: the same proposal
revision returns the same snapshot, even after a branding change. To issue a new
delivery version with new branding, save a new proposal revision and prepare its
delivery version. Reopening/re-downloading a historical version never upgrades
it. No automatic proposal edit, duplicate snapshot or historical rewrite is used.

## Public share projection

Existing token format/hash lookup, expiration, revocation, tenant-scoped snapshot
resolution and rate limiting remain in force. Only after those checks, the server
loads the frozen asset and embeds verified PNG bytes as a bounded data URI in the
public-safe projection. No asset ID, private object key or signed Storage URL is
exposed; there is no public asset lookup endpoint. HTML accepts only a bounded PNG
data URI; URLs, SVG and attribute injection are rejected. CSP allows `img-src
data:` only, retaining no scripts, connections, frames or external image hosts.
All responses remain private/no-store. Revocation prevents subsequent retrieval,
not erasure of a document/image a viewer already downloaded.

## Settings and Vercel runtime

The localized Settings control provides upload/preview/replace/remove, owner-name
fallback, pending disable/duplicate-click guard and controlled notices. Status
notices follow locale changes. Small screens put the file input on its own row.
The preview uses a white backplate so transparent dark artwork remains legible in
Dark mode; PNG bytes are not flattened. Agency name/website/currency editing and
the rest of the application are unchanged. No real Aya logo was created.

Sharp 0.35.5 is the existing exact production dependency; no application dependency
or environment variable was added. Processing runs on Node.js, not Edge, and the
Settings image is same-origin/unoptimized (no Next remote image fetch). Vercel must
install the correct Linux native optional dependencies during its own build.
Local Windows build success does NOT establish deployed native-module/Storage
compatibility. This requires separately approved Preview runtime acceptance.
Arabic UI is supported here; Arabic PDF shaping is still not claimed.

## Reproducible isolated SQL checks

`scripts/verify-branding-migration.mjs <local-runtime-directory>` imports PGlite
from that separate directory and creates only an in-memory PostgreSQL instance.
It never reads .env or connects to any remote database. PGlite 0.5.10 with pgcrypto
was installed outside the repo solely for this verification; the application
package/lockfile are unchanged. The harness executes all seven baseline migrations
unchanged, creates Auth/Storage service-schema scaffolding, then executes the
prepared migration and verifies 25 database scenarios (RLS, RPC permissions,
ownership/FKs, legacy identity, frozen branding, removal and cascade/retention).
It is not a Supabase Storage HTTP or multi-session lock-contention emulator.

## Required operator approvals and remote gate

1. Confirm backup/recovery and resolve the health warning. After loading, the
   read-only dashboard explicitly reported **Unhealthy**, despite recent request
   metrics showing 100% success and no listed errors. It also displayed **No
   backups** (this does not establish whether an external backup exists). No
   failing component or root cause is established. No repair or healthy-service
   claim is made. Hold remote migration/deployment work pending operator review.
2. Review this migration's exact SQL, current migration ledger, bucket absence,
   grants and retention implications against the target project. Approve the exact
   additive migration separately; do not blindly push unrelated pending files.
3. Only after approval, apply it to the authorized Supabase environment; verify
   private bucket settings, new table RLS/grants, trigger definitions, RPC execute
   ACLs and the unchanged old snapshot RPC. Do not rewrite legacy rows.
4. Separately approve feature-branch push/Preview deployment. Leave master,
   Production settings and Preview protection unchanged. Preview may share the
   Production database; never treat it as isolated customer data.
5. With a dedicated test agency and explicit test-data approval, validate real PNG
   and JPEG upload, cross-tenant denial, replacement/removal, create authorized
   delivery revisions, verify old/new logos in PDF/share, then expiration/revocation.
   No live AI or scan is needed. A successful local test is not this live acceptance.

Do not drop the bucket/assets after issuing branded snapshots as a rollback.
Keep immutable historical references intact and prefer a forward fix. No remote
operation described above has been performed in this phase.

## Final local verification

- `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`,
  `npm audit --omit=dev` and `git diff --check`: all exit 0.
- Vitest: 95 files / 998 tests, preserving all 942 baseline tests.
- Isolated PostgreSQL: 25 scenarios pass using the exact prepared migration over
  all seven unchanged baseline migrations. Supabase HTTP behavior and concurrent
  database sessions are not claimed from this in-memory harness.
- Local build: Next.js 16.3.8 Turbopack, 13/13 static pages. The branding route's
  output trace includes Sharp and native image dependencies. This is a Windows
  trace, not proof of Vercel Linux runtime compatibility.
- Isolated browser component fixture: English/Light desktop, Arabic/Dark at 360px,
  real file selection, mocked successful upload/remove UI, pending disabled
  controls, correct fallback and locale-following notices. Mobile document width
  equals viewport width (360px); no horizontal overflow. The fixture uses no
  Supabase or provider calls and is NOT a live persistence acceptance test.
- No application dependency/lockfile change, environment change, remote record
  mutation, Storage creation, live migration/RLS change, scan, AI, push or deploy.

## Changed-file inventory

```text
docs/phase-3b-branding-infrastructure.md
scripts/verify-branding-migration.mjs
supabase/migrations/202610170001_agency_branding.sql
src/app/(dashboard)/dashboard/settings/page.tsx
src/app/api/agency-branding/route.ts
src/app/api/agency-branding/route.test.ts
src/domain/proposals/types.ts
src/lib/supabase/database.types.ts
src/features/agencies/branding/assets.ts
src/features/agencies/branding/copy.ts
src/features/agencies/branding/data.ts
src/features/agencies/branding/data.test.ts
src/features/agencies/branding/http.ts
src/features/agencies/branding/http.test.ts
src/features/agencies/branding/service.ts
src/features/agencies/branding/service.test.ts
src/features/agencies/branding/components/logo-settings.tsx
src/features/agencies/branding/components/logo-settings.test.tsx
src/features/proposals/delivery/data.ts
src/features/proposals/pdf/data.ts
src/features/proposals/pdf/logo.ts
src/features/proposals/pdf/renderer.ts
src/features/proposals/pdf/branding-download.test.ts
src/features/proposals/share-links/data.ts
src/features/proposals/share-links/agency-logo.ts
src/features/proposals/share-links/agency-logo.test.ts
src/features/proposals/share-links/branding-resolution.test.ts
src/features/proposals/share-links/privacy.test.ts
src/features/proposals/share-links/public-page.ts
```
