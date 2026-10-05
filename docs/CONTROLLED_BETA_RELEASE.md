# Controlled Beta Release Candidate

## Release Identity

- Release name: MVP controlled beta candidate
- Application version: 0.1.0
- Release commit hash: record with `git rev-parse HEAD` after the release commit is created. The final release-preparation report should include the immutable hash.
- Scope: controlled beta for a small number of real HVAC agency users.

This release is not a public launch, billing launch, or scale-readiness declaration.

## Deployment Prerequisites

- Deploy the current Next.js application with the repository state from the release commit.
- Use the production Supabase project that has all six migrations applied.
- Configure Supabase Auth before inviting beta users.
- Configure the required environment variables by name only. Do not commit or paste secret values into source control.
- Confirm Supabase backup and recovery posture before real beta data is collected.

## Required Environment Variables

Public browser-safe variables:

- `NEXT_PUBLIC_PRODUCT_NAME`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Server-only variables:

- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`

There is currently no trusted `APP_URL` or production URL environment variable in the codebase. The production app URL must still be configured in the deployment platform and Supabase Auth settings.

## Supabase Configuration Checklist

- Linked project has the following migrations applied:
  - `202609190001`
  - `202609250001`
  - `202609250002`
  - `202609250003`
  - `202609260001`
  - `202609290001`
- Run `npx supabase migration list --linked` and confirm local and remote migration versions match.
- Run `npx supabase db lint --linked` and confirm no schema errors.
- Keep Row Level Security enabled on application tables.
- Keep mutating workflow RPCs executable only by `service_role`.
- Do not expose `SUPABASE_SERVICE_ROLE_KEY` to browser code.
- Confirm Supabase Auth email/password is enabled.

## Auth Redirect Checklist

Set the Supabase Auth Site URL to the exact production app origin:

- `https://<production-domain>`

Allowlist only exact callback URLs needed for this MVP:

- `https://<production-domain>/auth/callback`
- `http://localhost:3000/auth/callback` for local development only, not as a wildcard production rule.

Do not configure wildcard production redirects.

The current signup flow builds the confirmation callback from the request `Origin` header. For controlled beta this depends on Supabase Auth Site URL and redirect allowlist being pinned to the production domain.

## Deployment Platform Notes

The repository is a standard Next.js App Router application. The current configuration expects a Node-capable Next.js host such as Vercel or an equivalent platform that supports:

- `npm run build`
- `npm run start` or platform-managed Next.js runtime
- Node.js runtime for server routes that use crypto, HTTP/TLS transport, PDF generation, Supabase server clients, and OpenAI calls

No deployment provider-specific configuration file is currently present.

## Manual Smoke Test Checklist

### Authentication

- Sign up with an email/password account.
- Confirm email through the Supabase confirmation link.
- Log in.
- Log out.
- Verify `/dashboard` redirects unauthenticated users to sign in.

### Agency

- Create an agency profile.
- Confirm the dashboard loads the agency.
- Add, edit, disable, enable, and delete a service.
- Confirm active services appear in proposal selection.

### Audit

- Create a prospect with a valid public HVAC website URL.
- Run a website audit.
- Confirm completed audit status and stored analyzed URL.
- Try an invalid or unsafe website URL and confirm a controlled user-facing failure.

### Opportunities

- Generate deterministic opportunities from a completed audit.
- Confirm opportunities display with priority, confidence, evidence, and mapped service if available.
- Generate an AI sales insight for an opportunity.
- Confirm AI text is displayed separately from deterministic evidence.

### Proposal

- Create a proposal from a completed audit.
- Select opportunities and agency services.
- Edit summary, scope, next step, prices, quantities, and discount.
- Save the proposal.
- Mark it Ready only after required content and at least one line item are present.

### Delivery

- Create an immutable delivery snapshot from a Ready proposal.
- Download the authenticated PDF.
- Create a public share link.
- Open the public share link in a signed-out/private browser session.
- Revoke the share link.
- Verify the revoked share link no longer works.

### Security Smoke Checks

- Verify one authenticated user cannot access another agency's prospects, audits, opportunities, proposals, snapshots, PDFs, or share-link metadata.
- Verify the public share page does not expose `agency_id`, `proposal_id`, `token_hash`, service-role data, or internal metadata.
- Verify browser source/network responses do not expose `SUPABASE_SERVICE_ROLE_KEY` or `OPENAI_API_KEY`.
- Verify expired or revoked share links return the unavailable page.

## Known Non-Blocking Limitations

- Signup confirmation callback origin is derived from request `Origin`; Supabase Auth redirect configuration must be pinned for beta.
- API JSON body size limits rely on platform/runtime limits rather than a centralized app-level byte cap.
- Public share-link route rate limiting is in-memory and per process.
- Centralized production observability is not implemented.
- Browser end-to-end automation is not implemented.
- README content may lag behind the implemented MVP.

## Backup And Recovery Notes

Before collecting real beta data:

- Confirm Supabase automated backups are enabled for the selected project tier.
- Confirm whether point-in-time recovery is available and enabled.
- Document who can restore the database and how restoration will be requested.
- Do not run destructive database commands against production during beta.

## Rollback Notes

- Keep the release commit hash from `git rev-parse HEAD`.
- If deployment fails before user traffic, redeploy the previous known-good commit or disable external access.
- If the database migration state is already applied, do not reset production. Roll forward with a reviewed migration if a data issue is discovered.
- If AI provider behavior fails, leave deterministic audit/opportunity/proposal editing usable and disable beta access to AI actions operationally until fixed.
