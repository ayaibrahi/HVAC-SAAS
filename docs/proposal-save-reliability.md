# Proposal save reliability and bounded UX remediation

Local work only, based on `ff99e36eed152b06fd99cae77b41dc4804d9e534`.
No migration, deployment, scan, AI generation or remote record mutation.

## Confirmed reproduction and limits

The owner-reported original draft was found read-only in the authenticated Aya
Preview. It currently has Draft status, no saved selected lines and a zero total.
Creation and later editing are separate operations. The controlled Page B draft
still displays its saved service, manually entered USD 500 and edited narrative.
No identifying record payloads or private content are copied into this document.

The exact original failed request is unavailable. It is not established which
finding the owner submitted with which service. Do not attribute it to PostgREST
health or claim every previous save operation rolled back.

The reproduced failure uses a checked unmatched opportunity with its Service
dropdown still on the empty placeholder. `parseLineItems` carries the empty
string into `lineItems[0].agencyServiceId`; the UUID schema rejects it before
`updateProposalDraft` or the save RPC. Both Draft and Ready previously returned
the generic `Invalid UUID`. New tests failed against that original behavior
before the correction. Valid opportunity/service/proposal UUIDs already passed;
validation has not been relaxed or replaced with generated identifiers.

## Save behavior

- The editor uses a state-returning server action with the same parsing,
  authorization, pricing and transactional save path as the original action.
  The original redirect action remains its progressive-enhancement fallback.
- Expected errors return a controlled message without redirecting the hydrated
  editor or echoing submitted content. Fields stay mounted and the error receives
  focus. A transport exception reports an uncertain result and asks the operator
  to check the existing draft before retrying, never create another one.
- Earlier URL feedback is hidden once editing or saving begins, so a previous
  creation/save success cannot masquerade as the result of a failed later edit.
  A confirmed success replaces the feedback URL before refreshing saved state.
- A synchronous submission guard and disabled pending fieldset prevent duplicate
  clicks. Saved data is revalidated and refreshed on success. Delivery and AI
  remain blocked while saving or while edits are unsaved.
- Checked findings require a nonempty catalog service in the browser. The server
  still validates UUIDs, active service ownership, finding/audit/prospect ownership,
  quantities, prices, totals and Ready prerequisites independently.
- Blank line scope stays blank instead of silently converting catalog capabilities
  or a generated implementation-support sentence into an approved deliverable.
  Explicit human line descriptions and prices are preserved.
- JavaScript is needed for in-place failure preservation; the existing server
  redirect fallback remains available for valid non-hydrated submissions.

## Eligibility and presentation

Optional AI copy requires a saved relevant selection, verified matching page
evidence, an empty Draft narrative and no pending edits. A saved selection alone
does not authorize generation for an unrelated manually chosen service. No new
AI behavior, prompt, model or provider fallback is introduced.

Delivery eligibility uses the existing pure snapshot validator: saved Ready,
Summary/Scope, consistent selected relationships and valid authoritative pricing.
The privileged snapshot action remains authoritative. No snapshot is created by
rendering its readiness guidance. Human edits cannot silently prepare stale copy.

Automatic catalog recommendation, manual catalog selection and no suitable
automatic match are distinguished. Technical signal/value/scope/source details
remain in a closed, labeled diagnostic disclosure; plain evidence stays visible.

Repeated View results explicitly focuses and scrolls to the selected section.
Navigation to a different business focuses the new section after rendering.
Modified clicks retain normal link behavior. Failed saved scans open their saved
status rather than launching a scan from the list. No selection action scans.

Completed-result coverage explains one fetched HTML page, not other pages,
JavaScript completeness, working buttons, submitted forms, working bookings or
overall technical health. Zero findings is not relabeled unverified.

## Verification and acceptance boundary

Regression coverage includes the empty-service UUID path, malformed IDs, valid
Draft/Ready saves, manual prices, unchanged existing draft on validation failure,
cross-tenant denials, Ready validation, copy protection, delivery eligibility,
service labels, diagnostic disclosure and coverage wording in English/Arabic.
The full suite retains prior PDF, immutable snapshot, branding and security tests.

An isolated localhost component viewer exercised native required-service
validation, one mock call on double click, pending disable, failure retention,
successful saved-state refresh, human-text protection, delivery dirty guard,
stale success-banner suppression after editing and failed saves,
same/different/failed/unverified result navigation, keyboard activation and
Arabic/Dark presentation at 360px without horizontal overflow. This is not live
Supabase persistence or a deployed Next.js Server Action acceptance test.

After a separately approved feature Preview release, an explicitly approved
test-only draft should repeat service selection, manual price/scope, Draft save,
reopen, human copy, Ready save and eligibility checks. Do not modify preexisting
records without approval. No scan or live AI is needed to test saving. Delivery,
PDF and sharing mutations require their own approval. Retain Preview protection.
The unresolved PostgREST health and unverified backup/recovery gates still apply
to shared-Supabase operations. The branding migration remains pending.

## Deferred full Groq proposal workflow

One-click full proposal generation is not implemented. It depends on approved
agency deliverables/exclusions/client inputs, relevant active catalog services,
verified scoped evidence, explicit manual pricing, safe input/output budgets,
confirmed provider billing/usage limits, stale-write protection and an explicit
human review/approval step. It must not infer deliverables from marketing copy or
overwrite historical AI text or immutable delivery snapshots.

## Local quality gates

- `npm run lint`: exit 0, no warnings.
- `npm run typecheck`: exit 0.
- `npm run test`: 98 files / 1,036 tests pass, retaining the 998 baseline tests.
- `npm run build`: exit 0, Next.js 16.3.8, 13/13 static pages.
- `npm audit --omit=dev`: exit 0, zero vulnerabilities.
- `git diff --check`: exit 0.

Windows verification used a stable external TEMP/TMP directory. Sandbox loopback
restrictions required the local transport tests to run outside the sandbox.
The first build attempts hit a Turbopack CSS-worker failure; preserving and
isolating `.next/cache/turbopack` resolved it. The active `.next/dev` directory
and application/build configuration were not changed. These environmental
failures were not suppressed or resolved by changing security tests.

## Changed files

```text
docs/proposal-save-reliability.md
src/app/(dashboard)/dashboard/proposals/[proposalId]/page.tsx
src/features/proposals/actions.ts
src/features/proposals/actions.test.ts
src/features/proposals/components/content-fields.tsx
src/features/proposals/components/opportunity-selection.tsx
src/features/proposals/components/opportunity-selection.test.tsx
src/features/proposals/data.ts
src/features/proposals/editor-eligibility.test.tsx
src/features/proposals/transition.test.tsx
src/features/prospects/components/prospect-details.tsx
src/features/prospects/components/prospects-screen.tsx
src/features/prospects/components/prospects-screen.test.tsx
src/features/prospects/results-focus.ts
src/features/prospects/results-focus.test.ts
src/lib/i18n/proposals.ts
src/lib/i18n/prospects.ts
src/lib/validation/proposals.ts
src/lib/validation/proposals.test.ts
```
