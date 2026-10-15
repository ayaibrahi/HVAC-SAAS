# Phase B final UX gate: proposal transition

## Baseline and diagnosis

Started clean on `feature/scanvoro-phase-b-simplified` at
`ff647afb8be67bc0e5da69465fc715330361f385`.

The external synthetic fixture passed `async () => { window.fixture.proposals++; }`
as the creation action. It returned successfully without feedback or navigation.
That counter is not a server action, database write or provider invocation. This
explains the owner's inert-button observation; it is not evidence of a broken
production redirect. The actual action's successful redirect remains outside its
error catch and was not changed in this task.

The fixture now shows and focuses a localized status message explaining that
creation is unavailable, no proposal was saved, and no AI was called. Its brief
pending state tests the actual shared submit control. Resume navigation uses its
actual link but clearly marks the editor destination unavailable in this fixture.
No successful proposal persistence is simulated in the visual preview.

## Actual contract traced

1. The real prospects page passes `createProposalAction` to the results component.
2. The form submits only the selected scan's `auditId` and an optional empty title.
3. The action validates those fields; additional client agency, prospect,
   opportunity and proposal identifiers are ignored.
4. `createProposalDraft` authenticates, derives the current agency, queries that
   agency's audit and prospect, and checks their relationship, completed status
   and HVAC vertical before obtaining the server-only admin client.
5. Creation inserts a blank draft with those server-derived IDs, agency currency
   and zero prices. It does not select opportunities or call AI.
6. The action redirects to `/dashboard/proposals/<returned-id>` with success
   feedback. Validation/database/authorization failures redirect to the proposals
   list with controlled feedback. A successful redirect is not caught as failure.
7. The existing builder reauthorizes the proposal, prospect and audit. Opportunity,
   service and saved-line reads remain tenant scoped. Its selection checkboxes
   start unchecked for a blank draft. Users choose services and confirm prices.
8. Saving still validates selected opportunities against the proposal audit and
   prospect, validates active owned services, and uses the existing transactional
   pricing/persistence implementation. No pricing or save contract changed.

## Prerequisites and states

| Situation | Behavior |
| --- | --- |
| No scan / incomplete / failed | Results offer scan/status recovery, not creation; server rejects noncompleted audits. |
| Completed with no findings | Results offer deterministic findings evaluation, not a premature create button. The separate existing Proposals page still supports a blank draft from a completed audit. |
| Findings exist, none selected | Prepare creates an empty draft; selection happens in the existing builder. |
| No matching service | Draft creation is allowed; no service is invented. Builder requires an active catalog service for a selected line and warns if the active catalog is empty. |
| Existing draft | Primary action resumes a draft among the five already-loaded recent proposals; it performs no create operation. |
| Only ready proposals | Primary link says Open saved proposal, not Open proposal draft. |
| Existing proposal from an older scan | Original proposal/audit association and saved prices remain intact; adjacent copy makes this explicit. |
| Create failure | Existing safe redirect feedback on the actual proposals list; no automatic retry. |
| Editor/navigation render failure | New localized segment error boundary offers saved proposals/businesses links, warns to check for a created draft before retrying, and never retries a mutation. |
| Unauthorized identifiers | Tenant-filtered reads and relationship assertions deny access before privileged insertion or editor data is exposed. |

The existing builder may display a default active service and catalog price in
an unchecked row. This is not a persisted selection. Saved selections retain
their saved prices even when the catalog price changes.

## Targeted corrections

- Move the sole primary create/resume control immediately after the factual scan
  summary, above the findings. Evidence and AI remain secondary.
- Remove the secondary creation form from Business options. There were not two
  simultaneously rendered Prepare buttons; the old conditional exposed creation
  in different locations, including alongside an existing draft's resume link.
- Prefer an existing draft over a newer ready proposal within the bounded result
  set. Label ready proposals accurately. Additional drafts remain possible on the
  unchanged Proposals page; existing saved-proposal links remain available.
- Do not give findings generation primary styling when a resume action is primary.
- Add English/Arabic prerequisite and recovery copy; preserve the approved shell.
- Add a proposal segment error boundary, not a new URL or a new builder workflow.
- Correct Vitest discovery from only `.test.ts` to both `.test.ts` and `.test.tsx`.
  The previously reported 596 passing tests did not include the 12 existing TSX
  presentation tests. Those tests now run normally, plus three new presentation
  cases and fourteen new transition/recovery cases: 625 total.

## Verification and limits

- `npm run lint`: exit 0.
- `npm run typecheck`: exit 0.
- `npm run test`: exit 0; 72 files / 625 tests passing.
- `npm run build`: exit 0; Next 16.3.8; 13/13 static pages generated.
- `npm audit --omit=dev`: exit 0; zero vulnerabilities.
- `git diff --check`: exit 0.

The transition suite runs the real action, throwing Next redirect, authentication
and tenant checks, query filters, row mappers, builder loader and page entrypoint.
Only Supabase transport/storage, cache invalidation, delivery/share reads and AI
provider boundary are mocked. It verifies one insertion, exact redirect ID,
unselected/unmapped findings, missing/noncompleted/foreign audits, foreign
prospects/proposals, missing session, safe insertion failure feedback, resumed
selection/pricing, and localized non-mutating recovery links. Existing price,
selection-authorization, AI, delivery and SSRF regressions remain passing.

Synthetic browser verification passed 162 checks with zero page errors and four
mocked non-proposal API requests. It uses actual components across 360/768/1280/1440px,
English/Arabic, Light/Dark, keyboard, focus, pending/repeated-keypress handling and
200% zoom. It checks the single action above findings and honest unavailable
feedback without proposal network requests. Actual built Next HTTP checks confirm
six distinct workspace routes, including the dynamic editor, return 307 to sign-in
without a session. The temporary server has blank service credentials.

No real authenticated Supabase write, live AI generation, push or deployment was
performed. These tests do not prove deployed database connectivity or live RLS.
Existing durable idempotency limits remain: a new create invocation can create
another draft. Recovery explicitly asks the user to inspect saved proposals rather
than blindly repeating creation. Only five recent proposal summaries are loaded;
older drafts remain accessible through Proposals. Existing broad service matching
and the builder's partial English-only surface remain outside this narrow gate.

## Review artifacts and release

Updated synthetic fixture files outside Git:
`phase-b-website-first-review/entry.tsx`, `review.mjs`, `verify-next.mjs`, generated
browser results and screenshots under
`C:/Users/CompuMart/.codex/visualizations/2026/09/19/01a0bb1e-a9c4-7791-b20d-cc200a9521c2/`.

The local review URL uses loopback port 4181. The owner should check the top-level
proposal action and its synthetic-only explanation, then explicitly authorize a
controlled Preview push. A real authenticated create/resume smoke test belongs to
that separately authorized Preview, not this synthetic fixture.

No new routes, dependencies, migrations, provider changes, pricing changes,
snapshot/PDF/share changes, Supabase/Vercel changes or Phase C/D work were added.
