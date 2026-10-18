# Phase 3C Real Application Integration

Local follow-up to `946e43feb3d02cccb66aeab9aef0ba65af6496cc` on the original feature
branch. No release, migration, remote write, scan or live AI call is authorized here.

## Actual Product Routes

- `/dashboard/services`: real catalog form and migration-aware scope availability.
- `/dashboard/services/[serviceId]/edit`: four scope fields plus fresh explicit approval.
- `/dashboard/prospects?prospect=...#website-results`: saved evidence and proposal access.
- `/dashboard/proposals/[proposalId]`: saved selections/manual pricing, confirmation,
  complete generation, editable Summary/Scope/Next Step, explicit Draft/Ready save.
- Existing delivery action and authenticated PDF route use frozen snapshot fields.

These were already integrated before this follow-up. This change closes the old-schema
catalog-write gap and adds exact approved project deliverables to complete summaries.
No tenant name is hardcoded into product behavior.

## Actual Aya Inspection (Read Only)

The deployed protected Preview remains the isolated UX commit `22401f2`, not this local
Phase 3C branch. The agency is Aya; pro-hvac is a prospect, not an agency identity.

The visible catalog contains one active service, Website Conversion Optimization,
with a saved USD 500 price. This is a configured catalog value, not fresh owner
approval of every proposed offer. Its broad description is not contractual scope.

The controlled Test B Meadow HVAC audit is completed and has three displayed findings:
Weak Lead Capture (matched to that service), Weak Emergency-Service Conversion and
Missing Online Booking (both unmatched). Contact/CTA evidence supports the first
finding only on the inspected page. Do not turn unmatched findings into new services.
The positive Test A fixture has no findings and is not grounds to invent work.
Legacy unverified audits are not suitable for automatic complete generation.

The existing Test B acceptance Draft selects Weak Lead Capture and the real service,
with quantity one, USD 500, no discount. Its scope explicitly says implementation
deliverables have not been approved. Its line note is not approved service scope.
It was opened read-only and must not be cleared or overwritten for this acceptance.

Supabase's authenticated table-column view showed nine agency_services columns and
no approved_scope. Its public table list showed no agency_branding or
agency_branding_assets. No SQL, mutation or new remote health investigation was run.

Owner approval is needed for exact deliverables, exclusions, client inputs/access,
completion checks, relevance to the selected page finding, and final offer quantity,
price and discount. Reconcile line notes or use an empty new authorized test Draft.

## Generation Quality And Authority

Groq chooses among exact server-built complete strings. Personalization includes
prospect/agency names, inspected URL, revalidated selected evidence, relevant service
and exact approved deliverables. Summary includes the concrete proposed project;
Scope includes exclusions, inputs and checks. This is constrained composition, NOT
free-form bespoke authorship or evidence of live Groq quality. Voice variation is
limited; human editing is expected. No invented ROI, timelines, credentials or services.

Prices stay in existing deterministic investment tables, not model-authored narrative.
Names/URLs/scope are data, not instructions. Exact-output membership, strict schema,
claim checks, byte limits, ownership checks and stale-source/CAS protection remain.
Generation stays Draft, and never creates a delivery snapshot or share link itself.

## Schema And Recovery Gates

| Capability                                                         | Current deployed schema                                                    |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| Basic catalog edits, manual proposal editing and Draft/Ready saves | Existing tables/RPCs; runtime live save health still unverified            |
| Deterministic suggested copy                                       | Existing schema; requires verified evidence and suitable real service      |
| Persistent approved reusable scope and complete generation         | Requires 202610180001_approved_service_scope.sql                           |
| Name-only immutable delivery/PDF                                   | Existing snapshot fields/RPC; null branding asset                          |
| Persistent uploaded logos and frozen logo association              | Requires separate 202610170001_agency_branding.sql and Storage preparation |

No new migration is added by this follow-up. Scope migration adds one nullable JSONB
column/check, without backfill, new grants, RLS, RPCs or Storage changes. Existing
rows remain unapproved. Apply only a separately reviewed exact migration, not an
indiscriminate push of the entire pending migration directory. Verify the deployed
migration ledger and rehearsal result first. No DB rehearsal was performed here.

PostgREST health/recovery readiness remains unresolved. Successful reads do not
establish health, backup consistency or restore capability. Required operational
sequence: approve private encrypted storage/credential handling; verify recovery
scope and live version under separate authorization; create and validate consistent
DB/Auth/roles recovery artifacts plus Storage object bytes/platform configuration;
restore in isolation; verify relationships, policies/RPC grants, prices and migration
history; rehearse the exact scope migration; review rollback and health evidence.
None of those recovery operations was executed in this task.

## Reproducible Real-App Local Acceptance

Run `node test-support/phase-3c/real-app.mjs` with Node 24 compatible with the installed
Next.js runtime. It starts the actual repository's Next routes/actions at
http://127.0.0.1:4198/sign-in and synthetic Auth/PostgREST at 127.0.0.1:4200.
No fixture frontend, authentication bypass or production credentials are used.
The local-only synthetic login is local-proposal@example.invalid / Local-test-only-123!.
The clearly labeled agency/prospect are fictional, not Aya or copied customer data.

The runner supplies process-local dummy configuration before Next loads. Groq's
exact endpoint is intercepted in memory; other outbound fetch destinations are
blocked, not forwarded. The analyzer must not be invoked. No real database exists
behind the mock, so this does not validate SQL transactions, RLS execution or migrations.
The mock implements the current RPC payload contracts, not a substitute database.

Acceptance cache/types live under ignored dist/phase-3c-acceptance, isolated from
the owner's normal dev server. The dev-only config changes build/type output only;
production cannot enable it. ESLint/tsc exclude only this generated output, not source.
Next may regenerate next-env.d.ts for that dev output; restore the normal generated
references via a normal production build before committing. No dependencies added.

### Observed Local Results

- Protected `/dashboard` redirected to sign-in before authentication. The actual
  sign-in action established the fictional agency session; navigation reached the
  real Dashboard, Websites, Services, Proposals and Settings routes.
- Actual service edit saved four approved scope fields with fresh confirmation.
  The actual builder blocked generation before saved selections, then saved a
  relevant service, quantity one and an illustrative USD 500 manual price.
- A mocked HTTP 400 returned the existing sanitized Groq error. No partial Summary
  or Scope persisted, the lease cleared, and an explicit retry succeeded. The final
  pass counted two mock requests (one rejection, one success), not live requests.
- Generation disabled sibling inputs/save controls and remained Draft. Exact
  approved deliverables appeared in both the executive project section and Scope.
- Human Next Step editing survived a simulated save failure in an earlier pass.
  Explicit Ready save/reload preserved the edit, selection and USD 500 total.
- The existing delivery action created one in-memory snapshot. The real authenticated
  PDF endpoint downloaded a 7,578-byte, two-page document. Text extraction and both
  rendered pages confirmed approved scope, human edit and pricing without clipping.
  Its review banner is intentional because the title contains TEST ONLY. No logo,
  Storage upload or share link was created. Minor repeated executive-summary wording
  remains a content-polish limitation, not a lost-content or persistence defect.
- At 1440px desktop and 360px mobile, the real proposal UI rendered coherently.
  English and Arabic/RTL had no horizontal overflow. Mobile drawer opened, Escape
  closed it, and focus returned to its trigger. Generated narrative remained English;
  changing UI language did not rewrite saved copy.
- Simulated missing approved_scope hid approval controls, displayed migration
  guidance and allowed an ordinary service update. Settings handled missing branding
  tables without inventing persisted logo state.

The first mock rate-limit response used an array despite the real client's single-row
contract; the initial mock timestamps also differed from the real atomic save RPC.
Both mock-contract defects were corrected before the final acceptance pass. The
application's rate-limit and delivery protections were not weakened to pass tests.
The local outbound-fetch guard blocked one unrelated attempted destination; it was
not forwarded. Groq requests were intercepted, with no OpenAI fallback or remote AI.

Regression gates: lint and TypeScript passed; 105 test files / 1,117 tests passed;
Next.js 16.3.8 production build passed (13/13 static-generation tasks); production
npm audit reported zero vulnerabilities. New tests cover missing-column writes,
fail-closed capability checks, approval preservation/withdrawal, localized migration
gates, exact project personalization and dev-only config isolation. Existing tenant,
CAS/lease, provider, SSRF, delivery, PDF, theme and localization tests remain passing.
Generated acceptance files are excluded from lint/typecheck, not application source.

Screenshots and the downloaded PDF are local QA artifacts, not evidence of live
Aya writes, real Groq output, PostgreSQL RLS execution or recovery readiness.

## Smallest Safe Live Path

1. Approve recovery preparation and verify an isolated restore/rehearsal first.
2. Approve/apply only the exact scope migration after that safety gate; verify column
   and constraint access with unchanged tenant policies. Defer logos if unnecessary.
3. Approve one real Aya service scope and final illustrative test-offer prices.
4. Separately approve a protected Preview of the exact reviewed branch/commit and
   Preview-only provider settings. Keep master/Production and protection unchanged.
5. Authorize one new clearly labeled test Draft from the existing controlled Test B
   audit, not edits to historical drafts. Verify save/reopen before AI.
6. Verify current Groq billing/limits and explicitly authorize one bounded generation.
   Then human review, explicit Ready, separate snapshot/PDF acceptance authorization.

Without these gates, the feature is locally integrated but not live-ready for Aya.
