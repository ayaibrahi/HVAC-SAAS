# Phase 3: agency-first proposal PDFs (local implementation)

## Completed boundary

The live PDF download still obtains an authorized, tenant-scoped immutable
delivery snapshot, validates it and projects only its existing public fields.
The renderer now prominently displays the snapshot's agency name, client,
proposal title and preparation date. Saved Summary, Scope and Next Step remain
unchanged. Selected services show quantities and stored unit/line prices;
Investment shows the stored subtotal, discount and total exactly once.
No pricing is recomputed or accepted from download parameters.

Long narratives paginate above a reserved footer band. Each page has the frozen
agency name, preparation date and page number. Full long agency names remain on
the cover; only repeated footer/continuation labels may be ellipsized. Existing
WinAnsi punctuation handling remains; Arabic shaping/font support is NOT added.

Known draft markers receive a visible review notice. This is a presentation aid,
not an approval validator: Ready status alone does not establish commercial
completeness. The agency must review all scope and deliverables before delivery.
Catalog descriptions are explicitly capabilities, not agreed deliverables.
An exact repeated line/catalog description is cross-referenced rather than
reprinted; unique saved content is never removed or rewritten.

## Existing agency infrastructure

Settings already edits the agency name and website. There are no agency logo,
business email/phone or color fields; no logo upload UI, asset table or private
logo bucket/policies exist. Delivery snapshots store `agency_display_name` but
not agency contact details, website or a logo identity. Their website field
belongs to the prospect, NOT the agency. No authentication-account email is
repurposed as a business contact.

Therefore no new Settings controls, upload endpoint, storage policy, schema,
migration or live-logo lookup has been introduced. Live downloads continue to
use the name-only fallback. This is NOT a completed persistent-logo feature.

## Local raster rendering and security

`ValidatedAgencyLogo.decode` accepts in-memory PNG/JPEG bytes only, never URLs,
paths, SVG or filenames. Signature checks precede actual Sharp decoding:

- Maximum compressed input: 1 MiB.
- Dimensions: 16 through 2048 pixels on each axis; at most 2 million pixels.
- Aspect ratio: at most 8:1 in either direction; single image only.
- Decode: fail on warnings, at most four input channels, three-second processing
  timeout, orientation applied, sRGB, canonical 8-bit RGBA.
- Raster output fits within 600 by 240 pixels, without upscaling. Original
  metadata and uploaded byte streams are not embedded.
- PDF placement fits within 120 by 56 points without distortion. Alpha is a PDF
  soft mask, not a flattened black background. Transparent margins in uploaded
  artwork remain the agency's responsibility; narrow artwork has a narrow box.

Sharp 0.35.5 was already installed by Next.js; it is now an exact direct runtime
dependency because this code imports it. No paid service or custom image decoder
is used. Copies, private pixels and a digest prevent mutation after validation.
Invalid bytes yield controlled errors. Missing, foreign or forged rendering
objects fall back to the full frozen agency name. Rendering performs no fetch.

The optional renderer branding argument is used ONLY by local examples/tests.
The live download API does not accept it. Its ownership equality check is
defense in depth, NOT a replacement for authenticated database authorization.
It must not be connected to live data before the approval below.

## Required owner approval: persistent branding

Proposed follow-up, NOT implemented or applied:

1. An agency-owned branding-asset record containing agency ID, immutable object
   key, hash, validated MIME/dimensions and a current-profile reference. Use a
   private bucket, owner-scoped access policies and server-derived agency IDs.
2. Normalize uploads server-side using the bounded decoder. Use content-addressed
   object keys; do not overwrite issued assets. Do not trust client-supplied
   ownership, URLs or MIME. Reject unsupported/animated/oversized files.
3. Add a versioned immutable branding projection to delivery snapshots (asset
   identity/hash plus approved contact values, if separately supported). Freeze
   it in the existing server-owned snapshot transaction. Legacy snapshots retain
   their original name-only identity; never backfill them with today's logo.
4. Retain referenced assets while any historical snapshot needs them. Any future
   delete/retention rules must preserve this guarantee. Reads must verify both
   snapshot and asset ownership; no service-role credential reaches clients.
5. Public pages should use only the authorized snapshot's frozen projection.
   If images are added, use an explicitly authorized same-origin asset response,
   not a mutable public URL; review CSP and caching without relaxing token
   expiry/revocation or Preview protection.

This requires separately approved schema/RPC/bucket/policy work. No migration is
necessary for the current name-first PDF layout. Current public pages already
use the same frozen agency name; their markup, CSP and sharing security are
unchanged. PDF renderer updates can reflow an old document, but its saved
identity/content/prices do not change. Byte-identical historical PDF archival is
not promised by the existing snapshot architecture.

## Local visual acceptance evidence

All examples are fictional and TEST ONLY, created in memory with no Supabase
writes, live scan, AI, live delivery snapshot or share link:

- A: simple one-page agency-branded proposal, square raster logo.
- B: two-page fictional Page B contact proposal, transparent raster logo.
- C: multi-page stress proposal: long identities/title, long Summary/Scope,
  five fictional services, quantities and a percentage discount.
- D: missing-logo name-only fallback.
- Additional wide JPEG, tall PNG and transparent PNG placement examples.
- Page B before/after PDFs share identical saved narrative/scope/pricing and
  agency identity. Visual changes do not add findings or commitments.

USD 500 is illustrative local test pricing, not a catalog update or third-party
quote. The Page B implementation scope is manually supplied for review, NOT an
approved client offer. Unmatched findings do not become additional services.
The stress sample has five explicitly fictional service lines and illustrative
totals; it is not claimed to originate from the Page B service mapping.

The Supabase dashboard's previously reported Unhealthy indicator remains
unresolved here. No service health inspection, settings change or restart was
performed; earlier successful queries do not prove full service health.

## Verification (2026-10-17, local only)

- `npm run lint`: exit 0.
- `npm run typecheck`: exit 0.
- `npm run test`: exit 0, 87 files / 942 tests (925 existing + 17 new).
- `npm run build`: exit 0, Next.js 16.3.8 Turbopack, 13/13 static pages.
- `npm audit --omit=dev`: exit 0, zero production vulnerabilities.
- `git diff --check`: exit 0.

Sandbox cache/worker and registry DNS restrictions required permitted reruns.
An intermediate webpack build also passed; the standard Turbopack build passed
after removing only the verified ignored `.next/cache/turbopack` cache, as in
the previous phase. No compiler/security setting or test was weakened.

Eight local PDFs were rasterized and visually reviewed: A (one page), B before
and after (two pages each), C (six pages), D (one page), and three one-page logo
variants. Independent pypdf/pdfplumber checks verified all saved narrative,
numbered footers, text bounds and exact illustrative arithmetic in the seven
after samples. Long scope retains every numbered item. New automated tests cover
PNG/JPEG content checks, byte/pixel/dimension limits, alpha/aspect ratio,
ownership rejection, forged/missing fallback, canonical pixel immutability,
snapshot name immutability, no fetch, draft notices and multi-page text bounds.
Existing editing, pricing, authenticated download and delivery/share-security
suites also pass. No deployed/live behavior is claimed from local verification.
