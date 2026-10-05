# Agency Sales Copilot Foundation

This repository contains the foundation for a SaaS product that helps agencies turn prospect websites into evidence-based sales opportunities and proposals. The current product name is configurable and should not be treated as the final brand.

## Stack

- Next.js App Router
- TypeScript with strict mode
- React
- Tailwind CSS
- Supabase Auth and PostgreSQL
- Zod validation
- ESLint, Prettier, Vitest

## Local Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env.local` and fill in the Supabase values:

   ```bash
   NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
   NEXT_PUBLIC_SUPABASE_ANON_KEY="your-supabase-anon-key"
   SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
   ```

   `SUPABASE_SERVICE_ROLE_KEY` is reserved for server-only future operations. Do not expose it to browser code.

3. Apply the SQL migration in `supabase/migrations/202609190001_foundation.sql` with the Supabase CLI or the Supabase SQL editor.

4. In Supabase Auth, enable email/password sign-in. If email confirmation is enabled, add the local callback URL:

   ```text
   http://localhost:3000/auth/callback
   ```

5. Start the app:

   ```bash
   npm run dev
   ```

## Verification

```bash
npm run lint
npm run typecheck
npm run test
```

## Current Scope

Implemented:

- Email/password auth foundation
- Protected dashboard shell
- Minimal agency onboarding
- Agency service catalog CRUD
- Prospect CRUD
- Supabase schema and RLS for tenant isolation
- Zod validation and focused validation tests
- Website Analyzer Core for single submitted prospect URLs
- SSRF-protected server-side fetch with timeouts, redirect validation, and response size limits
- Deterministic website and HVAC evidence signal extraction

## Engine-Owned Data Boundary

Audit, opportunity, proposal, and proposal-opportunity records are generated workflow data. Authenticated agency users may read records for their own agency, but they do not receive broad client-side insert, update, or delete policies for those tables.

Analyzer, opportunity-engine, and proposal-engine writes must happen only from server-owned code paths that validate the authenticated agency context and keep service-role credentials server-side. Do not expose `SUPABASE_SERVICE_ROLE_KEY` to browser code, and do not weaken RLS for convenience.

Audits are prepared for deterministic analysis with status, timing fields, normalized signal JSON, schema versioning, final URL storage, and stable vertical/playbook metadata. The current analyzer fetches only the submitted prospect URL and does not recursively crawl.

Intentionally not implemented yet:

- AI analysis
- Recursive crawling
- PageSpeed integration
- Proposal generation
- PDF generation
- Billing
- Email/WhatsApp automation
- CRM or bulk lead import

## Next Phase

The next explicit phase should be Opportunity Engine: turn stored deterministic evidence into ranked, evidence-backed sales opportunities. It should not generate proposals or PDFs yet.
