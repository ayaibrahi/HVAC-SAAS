import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { RenderedCoverage } from "./rendered-coverage";

it.each(["en", "ar"] as const)("reports partial coverage and fallback honestly in %s", locale => {
  const html = renderToStaticMarkup(<RenderedCoverage locale={locale} coverage={{ discovered: 7, scanned: 3, failed: 1, incomplete: 1, skipped: 2, observedViewports: 4, unattemptedViewports: 1, staticFallback: true, discoveryTruncated: true, fullSiteCoverage: false }} />);
  expect(html).toContain(locale === "en" ? "not a complete website scan" : "ليست فحصًا كاملًا للموقع");
  expect(html).toContain(locale === "en" ? "Static homepage HTML" : "HTML ثابت");
  expect(html).toContain(locale === "en" ? "additional pages may exist" : "قد توجد صفحات أخرى");
  expect(html).toContain("7");
});
