# Phase B website-first UX review

## Scope and recovery

Work started on clean `feature/scanvoro-phase-b-simplified` at
`04e57742ee4c0f385f89a2e9ca6b5616ae3fa9d8`. The previous simplified review
remains in `docs/phase-b-simplified-review.md` as historical evidence.
No reset, history rewrite, push, deployment, dependency change, migration,
Supabase configuration change or live customer mutation was performed.

## Why the previous journey was confusing

The page led with CRM terminology and a save-only form. Its list concealed
results inside each record, then concealed the finding itself inside another
disclosure. The purpose of adding a record and the next step toward a proposal
were not apparent. Renaming the buttons alone would not address this.

## Revised journey

1. The existing route opens with "Find website opportunities", a brief purpose
   statement and a website field beside "Scan a website".
2. That button opens the existing dialog, preserving the website and focusing
   business name. Contact details and notes remain optional and collapsed.
3. "Add and scan website" explicitly saves the record and then scans one public
   page. The dialog says that it does not generate AI content.
4. Successful completion selects the saved business on the same route. Existing
   saved rows offer "View results", "View scan status" or "Scan website".
5. One results section shows identity, status, factual page scope and the first
   three existing ranked findings. Remaining findings have one disclosure.
6. "Prepare proposal" or "Open proposal draft" is the principal next action.
   Evidence and AI interpretation remain separately labeled optional details.

The shared navigation label is now "Websites" / "المواقع". Existing route names,
database entities and server API paths remain unchanged. The approved shell,
Dashboard layout, theme tokens and branding were not redesigned.

## Save and scan boundary

`createBusinessForScan` reuses the existing form-field whitelist, Zod validation,
duplicate URL advisory and authenticated create function. It ignores client
previous state and derives ownership through the existing data layer. Editing
still uses `saveWorkspaceProspect`, with its redirect outside the catch.

The explicit client submission receives a confirmed saved UUID, then calls the
existing same-origin audit endpoint once. That endpoint independently validates
ownership and retains existing SSRF, limits and concurrency protections. No scan
runs on mount, no AI runs automatically, and no new external API was introduced.

Synchronous click locks prevent immediate double submissions. If scanning fails,
the saved ID remains available and the creation controls stay disabled, including
after reopening the dialog. The user opens the saved business, checks scan state
and retries scanning there without recreating it. A rejected/ambiguous save
transport disables repetition and asks the user to inspect Saved businesses.
Closing a completed/uncertain operation says "Close", not "Cancel".

These are UI recovery guarantees, not durable distributed exactly-once creation.
The existing duplicate advisory is not a uniqueness constraint; cross-tab or
reload races are not eliminated. No database constraint was introduced.

## State and capability preservation

- Unscanned, queued/running, failed and completed scan states remain distinct.
- Completed with no stored findings offers an explicit deterministic findings
  request. Missing rows alone are not labeled a completed empty evaluation.
- Only a successful findings response containing an empty data array confirms
  "No supported opportunities were found on this analyzed page".
- That confirmation is local to the mounted audit result. A full reload returns
  to the truthful unchecked state because the existing schema has no evaluation
  marker. A new audit gets a fresh result state.
- Existing rank order, evidence, mapping, priorities and confidence are unchanged.
- Edit, rescan, refresh findings, contact details, other proposals and confirmed
  deletion remain available under Business options.
- AI failures, existing successful insight content, pricing, proposal actions,
  snapshots, PDF, shares, auth, RLS and provider selection remain unchanged.

## Verification

Final checks after the feedback-label change:

| Check | Result |
| --- | --- |
| `npm run lint` | Exit 0 |
| `npm run typecheck` | Exit 0 |
| `npm run test` | Exit 0; 70 files, 596 tests passing |
| `npm run build` | Exit 0; Next 16.3.8; 13/13 static pages |
| `npm audit --omit=dev` | Exit 0; zero vulnerabilities |
| `git diff --check` | Exit 0 |

Focused coverage includes confirmed-ID-only scanning, forged previous state and
agency fields, invalid input, duplicate advisory, partial save, uncertain save,
repeat suppression, malformed findings responses, genuine empty findings,
top-three presentation, CTA selection and English/Arabic terminology. Existing
authorization, SSRF, AI safety, delivery and provider tests remain passing.

Synthetic browser review: 145 checks passed, zero page errors, four locally
mocked mutation requests. Actual components were bundled with synthetic data;
non-loopback requests were blocked by the test harness. Coverage includes
360/768/1280/1440px, Light/Dark, English/Arabic, empty/error/active/failed/long-name
states, modal Tab/Shift-Tab/Escape and focus restoration, duplicate clicks,
partial-save recovery, navigation, preference persistence and actual 200% browser
zoom. Screenshots were visually inspected. This is not live authenticated testing.

The fixture uses distinct `.example.test` domains, a visible synthetic banner,
actual rule evaluation and an explicit route table. Unsupported destinations are
marked unavailable rather than displaying a different page. The built Next app
separately returned 307 sign-in redirects for Dashboard, Websites, Services,
Proposals and Settings with credentials explicitly blank. Their manifest entries
are distinct. Unit tests execute their actual page functions with mocked data.

Review artifacts (outside the repository):
`C:/Users/CompuMart/.codex/visualizations/2026/09/19/01a0bb1e-a9c4-7791-b20d-cc200a9521c2/phase-b-website-first-review/`

## Existing limitations and follow-up

- Owner comprehension and visual acceptance are still required before pushing.
  No real authenticated create/scan/proposal mutation or paid AI request ran.
- Existing keyword mapping is broad: `weak_emergency_conversion` includes
  "conversion", so a catalog containing "Financing Conversion Section" can
  recommend that service for an emergency finding. This was observed with the
  actual evaluator in the synthetic review, not hardcoded into fixture output.
  No engine correction belongs to this UX change. The final fixture uses the
  narrower service name "Financing"; its emergency finding correctly displays
  no matched service. Review category precision separately before relying on
  suggestions in customer-facing proposals.
- Saved opportunity titles and other generated/customer content retain their
  original language. Arabic covers the interface, not automatic translation.
- The empty-evaluation and cross-tab idempotency limitations above remain.

Next operator action: review the website entry, three leading results, mobile
Arabic dialog and partial-save feedback using the labeled local fixture. Approve
visual UX before authorizing a branch push; no release was performed here.
