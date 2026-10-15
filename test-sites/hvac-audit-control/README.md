# Controlled HVAC Audit Website

Fictional QA material only. Not an operating business, real prospect, commercial
offer or customer dataset. Do not call the reserved fictional number. Do not
publish without the owner's separate approval.

## Files and Ground Truth

Publish **only the contents of `site/`**, as an independent static website:

- `index.html`: Page A, Northstar Test Heating & Air. Static phone text/tel link,
  appointment CTA with a real same-document destination, emergency HVAC wording,
  area coverage, financing, maintenance plan, and core service links. Expected:
  sufficient content, all relevant positives detected, zero opportunities.
- `absence.html`: Page B, Meadow Test Climate Care. Substantial service/area/care
  copy, but no phone, booking, emergency or contact CTA evidence. Expected: three
  page-scoped opportunities, never a claim about an entire business.
- `styles.css`, `system-diagram.svg`: self-contained local presentation assets.
- `robots.txt`: permits inspection. The HTML separately requests no indexing.
- `.nojekyll`: disables unnecessary Jekyll processing on GitHub Pages.

`manifest.json` is the machine-readable oracle outside the publish root. It defines
the page files, exact signal values/counts, extracted titles/links/targets,
expected rule order with the synthetic test catalog, and uncertainty boundaries.
The appointment destination is an inert section, not an operational integration.
Core service links also target sections, not separately inspected service pages.

There are no scripts, forms, external styles/fonts/images, telemetry, cookies,
secrets, real contact details, or connections to Supabase/Scanvoro on either page.
Fragment navigation stays local; only the inert `tel:` link could invoke a device
handler if deliberately clicked. Automated QA never clicks it.

## Local Review

Open `site/index.html` and `site/absence.html` directly in a browser. No framework,
installation, build, AI service or production dev server is required. A temporary
loopback-only static server was used for browser visual QA and then stopped.
Localhost must NOT be submitted to Scanvoro; its SSRF protection must stay intact.

From the application root, run:

```powershell
npm run test -- src/features/audits/analyzer/controlled-site.test.ts
```

These tests inject synthetic DNS and HTTP responses into the real `safeFetchHtml`,
then use the real parser, normalized detector, content gate, HVAC rules, matching
and ranking. They neither contact the synthetic addresses nor write any database.
Seven characterization tests deliberately demonstrate current accuracy limitations.
Their passing assertions confirm a reproducible defect/limitation, NOT product
acceptance. See `docs/controlled-audit-accuracy-validation.md` for the PASS/FAIL matrix.

Conventional closing tags on Page A keep the baseline reproducible. A separate test
changes only closing-tag whitespace and exposes the existing regex parser defect.
It must not be omitted from accuracy reporting or mistaken for a resolved bug.

## Free HTTPS Publishing, After Separate Approval

Preferred: a **new public fixture-only repository**, e.g. `scanvoro-audit-fixtures`.
Do not publish the application repository, alter its visibility, or connect this
fixture repository to Scanvoro's Vercel project.

1. The owner approves repository creation and publishing; none is authorized yet.
2. In GitHub, create a public fixture-only repository under the chosen account.
   Verify that the account/organization permits GitHub Pages without an upgrade.
3. Upload the six files **inside `site/`** to the repository root (include
   `.nojekyll`). Do not upload the application, `.env*`, test source or customer data.
4. Commit through GitHub's normal upload flow to that repository's default branch.
5. Open its Settings > Pages. Select Deploy from a branch, the default branch,
   and `/(root)`. Save. Do not configure a custom domain or buy anything.
6. Wait for GitHub's Pages job to succeed. Use the exact URL shown by Pages,
   normally `https://<account>.github.io/<repository>/`.
7. Verify HTTPS and both `index.html` and `absence.html` manually, the local image,
   the static appointment anchor, fictional labels, and `robots.txt`. Do not test
   by submitting the phone link or any personal data.
8. Freeze the fixture commit. Record each page's exact URL and file hash, then
   request approval for exactly two Scanvoro Preview scans. Do NOT scan yet.

GitHub documents free Pages eligibility for public repositories. Private-repository
eligibility depends on the plan. Current account eligibility/permissions have not
been checked; do not purchase an upgrade to work around a policy restriction.
Official references:
[GitHub Pages setup](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site),
[publishing source](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

If Pages is unavailable, propose a separate **Cloudflare Pages Free** static
Direct Upload project. After explicit approval and free-plan confirmation, the
owner can choose Workers & Pages > Pages > Direct Upload and upload `site/` as
the root, with no functions, domain purchase or app Git connection. Verify the
assigned `*.pages.dev` HTTPS URL and limits before scanning. Direct Upload projects
do not later switch to Git integration without a new project. Do not enable paid
Workers/add-ons or enter a payment commitment.
[Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/),
[Free plan limits](https://developers.cloudflare.com/pages/platform/limits/).

## Future Live Test Contract

Publishing and scanning are separate approvals. Obtain the exact two public URLs,
one scan each, permission for clearly labeled records in Aya, and confirmation
that Preview may share the production database. Do not reuse One Hour approval.
Use the deployed Preview at the separately verified approved SHA; do not redeploy
it for these fixture tests. Compare stored HTTP/final-URL/quality metadata and
evidence to the manifest, not just the number of findings. An empty catalog must
leave service IDs null; the three synthetic catalog services exist only in tests.
No catalog edits, AI calls, proposals, PDFs, sharing or historical updates are
needed for this validation. Stop if access restrictions or incomplete content
prevent verification. Do not repeat a failed request to force a favorable result.
