import type { ScanSummary } from "../workspace-model";

export function RenderedCoverage({ coverage: c, locale }: {
  coverage: NonNullable<ScanSummary["renderedCoverage"]>; locale: "en" | "ar";
}) {
  return <div className="space-y-2 text-sm text-muted">
    <p>{locale === "ar"
      ? `صفحات مكتشفة: ${c.discovered} · مفحوصة: ${c.scanned} · فاشلة: ${c.failed} · غير مكتملة: ${c.incomplete} · متجاوزة: ${c.skipped}`
      : `Pages discovered: ${c.discovered} · inspected: ${c.scanned} · failed: ${c.failed} · incomplete: ${c.incomplete} · skipped: ${c.skipped}`}</p>
    <p>{locale === "ar"
      ? `لقطات مكتملة لسطح المكتب أو الجوال: ${c.observedViewports}. قد تظهر الصفحة في أكثر من فئة عند اختلاف النتائج بين الجهازين.`
      : `Completed desktop/mobile snapshots: ${c.observedViewports}. A page can appear in multiple categories when viewport outcomes differ.`}</p>
    {c.unattemptedViewports > 0 && <p>{locale === "ar" ? `لقطات لم تتم محاولتها: ${c.unattemptedViewports}.` : `Snapshots not attempted: ${c.unattemptedViewports}.`}</p>}
    <p>{locale === "ar"
      ? "هذه عينة محدودة وليست فحصًا كاملًا للموقع. النتائج تخص الصفحة ولقطة العرض المحددتين؛ لم تُختبر وظائف النماذج أو الحجز."
      : "This is a bounded sample, not a complete website scan. Findings refer to the named page and snapshot; form and booking functionality was not tested."}</p>
    {c.staticFallback && <p>{locale === "ar" ? "استُخدم HTML ثابت للصفحة الرئيسية بعد تعذّر العرض؛ لا يثبت تنفيذ JavaScript." : "Static homepage HTML was used after rendering was unavailable; this does not demonstrate JavaScript execution."}</p>}
    {c.discoveryTruncated && <p>{locale === "ar" ? "وصل اكتشاف الروابط إلى الحد المسموح؛ قد توجد صفحات أخرى." : "Link discovery reached its limit; additional pages may exist."}</p>}
  </div>;
}
