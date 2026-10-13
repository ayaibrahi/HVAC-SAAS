# Scanvoro Foundation: Brand, Themes and Locales

## Deployment Branding

The default name is Scanvoro. `NEXT_PUBLIC_PRODUCT_NAME` remains the existing,
build-time override. Before an approved deployment, the operator must set this
variable to `Scanvoro` in the intended Vercel environment (or remove that override
to use the default), then rebuild. An old value overrides the new default.
This phase does not change Vercel settings, project names, repository names,
database identifiers, routes, or historical delivery snapshots.

The category, tagline and supporting copy live in `src/config/product.ts`.
The mark is an original geometric S with scanning endpoints, not an industry icon.
`public/brand/scanvoro-mark.svg` is the icon/favicon source.
`scanvoro-wordmark.svg` is the horizontal vector treatment for light backgrounds.
The reusable `Brand` component renders the mark beside configurable text, using
the surrounding text color for light and dark surfaces. The mark is decorative
beside the visible name, avoiding duplicated screen-reader announcements.
`scanvoro-app.png` (512px) and `scanvoro-apple.png` (180px) are local raster exports
of that SVG, produced with the existing Sharp installation; no new dependency.
Replace these assets and configuration to revise the first-version identity.

## Preference Architecture

`src/lib/ui/preferences.ts` owns Zod validation, cookie serialization, direction
and interface date formatting. Only `light`/`dark` and `en`/`ar` are accepted.
Invalid or missing values fall back independently to Light and English.
`ui-theme` and `ui-locale` are host-only, first-party preference cookies with a
one-year lifetime, `Path=/`, `SameSite=Lax`, and `Secure` on HTTPS. They contain
no credentials or ownership information and have no authorization effect.

The root Server Component awaits cookies before rendering `html[data-theme]`,
`lang`, and `dir`. The client provider receives the same validated initial values,
so initialization needs no inline script, localStorage probe, hydration suppression,
or after-mount theme correction. Controls update context, document attributes and
the corresponding cookie. Preference persistence requires browser cookies.
Reading preferences in the root opts React pages into request-time rendering;
existing URLs and server-action contracts are unchanged.

Semantic CSS variables define canvas, panel, text, muted text, border, primary,
primary foreground, sidebar, focus, feedback, and status colors. Tailwind semantic
colors reference these variables. A small scoped compatibility layer themes
existing white feature panels, action buttons and legacy status utilities without
redesigning feature pages. New UI should use the semantic tokens directly.
The desktop background rail still spans the whole document. Logical inline
properties place both the rail and fixed navigation on the correct side in RTL.

Public share delivery is a standalone HTML Route Handler with its own fixed CSS,
not a child of the React root layout. PDF rendering has separate styles. Neither
inherits locale or theme preferences; neither is automatically translated.

## Translation Coverage

`src/lib/i18n/dictionaries.ts` defines typed English and Arabic dictionaries.
Missing shared keys fail TypeScript and dictionary parity tests. Unknown locales
fall back to visible English; unknown feedback stays visible and React-escaped.
No machine translation or provider request is involved.

Translated now: shared navigation and breadcrumbs, drawer labels, account labels,
preference controls, Dashboard headings/metrics/activity/status/empty states,
next-action presentation, overview error/reload, shared feedback headings and the
finite known success messages listed in the dictionary. Interface counts use
Arabic digits in Arabic; dates use the chosen locale and explicit UTC for
deterministic server/client output.

Still English: sign-in/sign-up forms, agency onboarding, Prospects, Services,
Settings, Proposal Builder, feature-specific validation/provider errors not in
the feedback map, share management controls, AI output and saved customer content.
The language option is labeled Arabic experimental. Untranslated workflows show
an Arabic coverage notice and an explicit English/LTR content boundary.
User-supplied names use bidi isolation; URLs and email addresses retain LTR.
Do not claim full Arabic support. Arabic proposal/PDF delivery needs a separate
review of typography, layout, fonts, numbers, and immutable content semantics.

To extend coverage, add typed dictionary keys and translate presentation only.
Keep persisted status values, action names, authorization, evidence, prices,
service mapping, AI requests, and stored proposal text unchanged. The dashboard
adapter translates existing next-action copy without changing its decision or URL.

## Dependency Review: 2026-10-13

No dependency or lockfile changes in this phase. Lucide remains pinned at 1.55.0,
with individual imports, no remote assets and no advisory in this audit.
`npm audit` reports 12 affected packages: 1 critical, 9 high, 2 moderate.
`npm audit --omit=dev` reports 3: Next (critical), Sharp (high), source-map-js (high).
The remaining 9 affected packages are omitted from the production dependency graph;
they still matter for developer/CI environments. Package counts are not distinct
vulnerability counts and do not prove application exploitability.

| Installed Runtime Package | Finding and Inspected Exposure                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Recommendation                                                                                                                                                                                                                                     |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Next 16.3.5               | [Critical next/og RCE](https://github.com/advisories/GHSA-vcvr-r3jv-pc5j) requires Node ImageResponse with attacker-controlled SVG. No ImageResponse or next/og usage exists in src. The new icons are static files, not generated image routes. No critical exploitable application path was established.                                                                                                                                                                                                      | Upgrade to a reviewed supported patch, at least 16.3.8 to cover the other Next advisories, with matching eslint-config-next and full regression verification in a separate maintenance commit. The critical advisory itself was patched in 16.3.6. |
| Next 16.3.5               | [Image Optimization SSRF](https://github.com/advisories/GHSA-cjq9-62q9-8jv4) requires an attacker-controlled allowlisted remote image URL. No remotePatterns, custom image loader, remote image URL, upload path or unsafe image configuration was found. Only local static brand assets use next/image. Other Next entries concern cache/Draft Mode, self-hosted SSG/ISR, development MCP, and generated metadata-image routes; those prerequisites were not found in the inspected application configuration. | Include all Next fixes in the maintenance upgrade; reassess before adding remote image optimization, generated images, Draft Mode or cache features.                                                                                               |
| Sharp 0.35.4              | [librsvg vulnerability](https://github.com/advisories/GHSA-wq5f-xc86-pv6w) can affect SVG decoding under specified Linux/runtime conditions. The app has no untrusted SVG decoding/upload path; only trusted local icon export was performed during development. Vercel's exact binary hardening was not inspected.                                                                                                                                                                                             | Resolve to Sharp 0.35.5+ through a reviewed compatible dependency update. Do not accept untrusted SVG without a separate security boundary.                                                                                                        |
| source-map-js 1.2.1       | [Indexed source-map DoS](https://github.com/advisories/GHSA-68fv-2mgg-jv7q) requires parsing attacker-provided map offsets. Present through PostCSS, but no application endpoint/import processes user-supplied source maps.                                                                                                                                                                                                                                                                                    | Resolve to 1.2.2+ in the reviewed maintenance update.                                                                                                                                                                                              |

No confirmed critical production-exploitable path was found in this scoped review.
This is not a clean audit or a substitute for a production security gate. Existing
advisories remain unresolved; schedule the targeted maintenance upgrade before
Production promotion. Do not use npm audit fix blindly or add vulnerable features
on the assumption that current non-exposure will remain true.

## Verification Boundaries

Browser artifacts are kept outside the repository under the task's visualization
directory. The Dashboard/Prospects/Proposal Builder matrix uses actual components
with synthetic fixtures and inert actions; no tenant/customer database is accessed.
Local real Next.js public/auth pages verify server initialization, hydration and
cookie persistence without signing in or calling any AI provider.
An approved protected Preview still needs authenticated visual acceptance.

## Phase A.2 File Inventory

Modified:

- `.env.example`
- `README.md`
- `src/app/(auth)/layout.tsx`
- `src/app/(dashboard)/dashboard/page.tsx`
- `src/app/globals.css`
- `src/app/layout.tsx`
- `src/app/page.tsx`
- `src/components/dashboard/dashboard-shell.tsx`
- `src/components/dashboard/workspace-navigation.tsx`
- `src/components/feedback-message.tsx`
- `src/components/workspace-ui.test.ts`
- `src/components/workspace-ui.tsx`
- `src/config/product.ts`
- `src/features/dashboard/components/dashboard-overview.tsx`
- `tailwind.config.ts`

Added:

- `docs/scanvoro-foundation.md`
- `public/brand/scanvoro-app.png`
- `public/brand/scanvoro-apple.png`
- `public/brand/scanvoro-mark.svg`
- `public/brand/scanvoro-wordmark.svg`
- `src/app/layout.test.ts`
- `src/components/brand.tsx`
- `src/components/dashboard/workspace-content.tsx`
- `src/components/ui-preferences.test.ts`
- `src/components/ui-preferences.tsx`
- `src/config/product.test.ts`
- `src/features/dashboard/localized-action.ts`
- `src/lib/i18n/dictionaries.test.ts`
- `src/lib/i18n/dictionaries.ts`
- `src/lib/ui/preferences.test.ts`
- `src/lib/ui/preferences.ts`
- `src/lib/ui/server-preferences.ts`
