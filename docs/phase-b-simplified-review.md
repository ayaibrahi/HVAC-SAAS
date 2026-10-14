# Simplified Phase B review

## Recovery

- New branch: `feature/scanvoro-phase-b-simplified`.
- Direct base: `16908289c6a9e403df14611652de726e049b4e6d`.
- Approved `feature/ui-redesign-phase-a` remains at that base.
- Rejected `feature/scanvoro-phase-b-prospects` remains at `0ceda67b27446b9ca73465688fadd4928d1a34d7`.
- Local master remains `09985c4e4f2503963833c91ad9b6f6c22480a2e4`.
- No reset, revert, full cherry-pick, push, merge, deployment, database operation, dependency change or migration.

## Navigation diagnosis

The old external `phase-b-review/entry.tsx` fixture chose the list only for
`/dashboard/prospects`, a form for paths ending in new/edit, and returned
`ProspectWorkspace` for every other path. Its next/link stub changed browser
history and dispatched popstate. The shell therefore updated its active link and
breadcrumb while the catch-all page still rendered a prospect. Settings was not
broken in the actual Next application.

No production routing workaround was added. The replacement fixture uses an
explicit table for Dashboard, Prospects, Services, Proposals and Settings.
Navigation reloads the correct actual page component with synthetic data.
Unsupported destinations explicitly say they are unavailable in the fixture.
The old fixture source and screenshots remain historical evidence, not the
current preview; its old serve.mjs process was not running when checked.

Actual application verification, distinct from the fixture:

- The production build has five distinct dashboard page entries.
- Local built Next HTTP requests to all five destinations returned 307 to sign-in
  with no session and explicitly empty service credentials.
- `src/app/dashboard-routing.test.ts` executes the actual five async page entry
  functions with mocked session/data. It asserts unique headings/content and
  active navigation, Settings within the protected shell, unauthenticated
  redirect, unavailable selected IDs and existing edit-success feedback.
- No authenticated Supabase browser session or live mutation was tested.

## Restored design and simplified journey

The approved shell, sidebar, branding, Dashboard, global styles and tokens are
unchanged. Only the locale wrapper now recognizes the localized Prospects root.

1. Open Prospects and find a business by name or website.
2. Add prospect opens a dialog with business name and website. Optional details
   are collapsed. Validation retains values; duplicate URL warnings are advisory.
3. View prospect expands one record on the existing list route.
4. Scan website is the next action for an unscanned/failed record. Active scans
   offer status refresh without starting another scan.
5. A completed scan without saved findings offers View opportunities.
6. Findings are compact title disclosures. Page evidence and optional AI
   interpretation remain separate, with priority/confidence under evidence.
7. Prepare proposal or Continue proposal is the next action after findings.
   More actions holds editing, rescan, findings refresh, other proposal links,
   contact details and confirmed deletion.

No standalone Add/detail route, permanent five-step tracker, competing findings
buttons or new navigation section was carried over. Existing edit and proposal
pages remain unchanged. Saved findings, AI and proposal content are not translated.
The partial-Arabic notice accurately identifies the translated surface.

## Data and security

Only selected read/form/request helpers were reimplemented from the rejected
branch. The full rejected commit was not cherry-picked.

- Server-derived agency identity on every read; UUID checks and owned prospect
  lookup precede loading related details.
- Search is bounded to 100 characters, PostgREST values are quoted, wildcard
  characters neutralized, and agency equality is a separate predicate.
- Pages contain 12 records plus one lookahead, with at most 12 latest-scan
  metadata reads. One selected record may be shown above the page when absent
  from its results. Details load at most five related records per collection.
- Existing opportunity sorting is exported and reused without changing it.
- All mutations reuse existing authorized API/data functions. The new Add
  action whitelists fields, validates server-side and redirects outside catches.
- Local click locks, pending states and explicit recovery after uncertain
  requests prevent misleading immediate repeats. They are not a substitute for
  the unchanged server concurrency/usage controls.
- Existing auth, RLS, SSRF, AI budgets/providers, proposal pricing/persistence,
  snapshots, PDF and share-link code are unchanged.
- No actual credentials, environment files or customer records were added.

## Service mapping diagnosis

The rejected fixture explicitly assigned its single Booking Integration service
to the first two opportunities, including financing, and reused booking evidence
for every rule. That was synthetic fixture data, not an established engine defect.
The new fixture evaluates the actual rules and mapper against synthetic signals.
A regression proves financing does not match a booking-only catalog and does
match a Financing Conversion Section when present. No ranking/mapping algorithm
was changed. Broader catalog-specific fuzzy matching remains the existing behavior.

## Verification

- `npm run lint`: exit 0.
- `npm run typecheck`: exit 0.
- `npm run test`: exit 0, 69 files / 577 tests passed.
- `npm run build`: exit 0, Next 16.3.8, 13/13 static pages generated.
- `npm audit --omit=dev`: exit 0, zero vulnerabilities.
- `git diff --check`: exit 0.

Windows sandbox worker failures initially affected Vitest/Turbopack. The failed
generated .next directory was preserved outside the repo and a clean standard
build succeeded with normal worker permissions. No dependency, compiler setting,
security control or test was weakened to bypass those failures.

New coverage includes real route-component execution, simplified presentation,
server field whitelisting, redirects, duplicate advisory/override, unknown and
cross-agency IDs, bounded tenant-scoped reads, search/pagination, controlled HTTP
responses and the financing/booking mapping regression. Existing security,
provider, proposal, delivery, theme and localization suites continue to pass.

## Visual evidence

Artifacts are outside the repository at:

`C:/Users/CompuMart/.codex/visualizations/2026/09/19/01a0bb1e-a9c4-7791-b20d-cc200a9521c2/phase-b-simplified-review/`

- `results.json`: 125 synthetic browser checks; no page errors; external
  requests blocked; only two intentionally failed local mutation requests.
- `next-route-results.json`: real built Next HTTP route checks.
- `screenshots/`: 160 captures, including 360/768/1280/1440px, light/dark,
  English/Arabic, empty/list/selected/active/failed/long-text states, Add dialog,
  disclosed evidence/AI, all five destinations and actual 200% browser zoom.
- Keyboard checks: Tab/Shift+Tab in dialogs, Escape, focus restoration,
  mobile drawer, duplicate submissions and explicit failure recovery.
- Selected saved AI text stays visible during failed/generating states.
- Theme/locale switches persist on reload; RTL and no horizontal overflow
  verified across the matrix. Screenshots were visually inspected.

Comparison captures (all synthetic; not identical customer datasets):

- Approved: sibling `phase-a2-review/screenshots/light-en-1280-prospects.png`.
- Rejected: sibling `phase-b-review/screenshots/light-en-1280-completed.png`.
- Simplified: `screenshots/light-en-1280-completed.png`.
- Arabic mobile Add: `screenshots/dark-ar-360-list-add.png`.
- Settings destination: `screenshots/route-settings.png`.

## Limitations and acceptance

The engineer's first-use assessment is that Add, Scan, findings and proposal
progression are easier to locate without permanent workflow scaffolding.
Owner visual approval is still required; automated checks are not user research.

The local fixture has inert server forms, synthetic records and controlled failed
mutation responses. It is not an authenticated/live workflow. Actual sign-in,
save, scan, AI and proposal smoke testing require separately authorized Preview
testing. Existing edit/Services/Settings/Proposal workflows remain English with
the partial-locale notice. Pagination/read authorization tests use a query stub,
not live PostgREST/RLS. Duplicate detection is exact normalized URL advisory,
not a race-safe uniqueness guarantee. The bounded latest-scan N+1 reads are an
explicit MVP tradeoff; no indexing/schema expansion is made for this UX task.

Next action: review the simplified local preview and comparison screenshots.
Do not push or deploy until the owner approves.
