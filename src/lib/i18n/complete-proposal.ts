import type { Locale } from "@/lib/ui/preferences";

const english = {
  generate: "Generate Complete Proposal",
  generating: "Preparing complete draft...",
  confirm:
    "I confirm the saved services, their approved scope, quantities, prices and discount for this draft.",
  review:
    "AI-assisted draft only. Review all wording and prices, then explicitly save as Ready before delivery.",
  missing:
    "Complete generation needs approved catalog scope and consistent saved prices. Review each selected service in the catalog; save selections first. Manual editing and suggested copy remain available.",
  catalogScope: "Reusable proposal scope",
  scopeHelp:
    "Catalog descriptions are not commitments. Enter the exact work you approve for future proposal drafts. Saving without approval removes the reusable approval; saved proposals and delivery versions do not change.",
  deliverables: "Included deliverables",
  exclusions: "Exclusions and qualifications",
  clientInputs: "Required client inputs and access",
  completionChecks: "Completion checks",
  approveScope:
    "I approve this exact scope for proposal drafts. Reconfirm when saving changes.",
  approved: "Saved approved scope",
  notApproved: "No approved reusable scope",
};

const arabic: Record<keyof typeof english, string> = {
  generate: "إنشاء عرض خدمات كامل",
  generating: "جارٍ إعداد المسودة الكاملة...",
  confirm:
    "أؤكد الخدمات المحفوظة ونطاقها المعتمد والكميات والأسعار والخصم لهذه المسودة.",
  review:
    "مسودة بمساعدة الذكاء الاصطناعي فقط. راجع النص والأسعار ثم احفظ صراحةً بالحالة جاهز قبل التسليم.",
  missing:
    "يتطلب الإنشاء الكامل نطاقًا معتمدًا من الدليل وأسعارًا محفوظة ومتسقة. راجع كل خدمة مختارة في الدليل واحفظ الاختيارات أولًا. يبقى التحرير اليدوي والنص المقترح متاحين.",
  catalogScope: "نطاق عروض الخدمات القابل لإعادة الاستخدام",
  scopeHelp:
    "أوصاف الدليل ليست التزامات. أدخل العمل الذي تعتمده لمسودات العروض المستقبلية. الحفظ دون اعتماد يلغي الاعتماد القابل لإعادة الاستخدام ولا يغيّر العروض أو نسخ التسليم المحفوظة.",
  deliverables: "المخرجات المشمولة",
  exclusions: "الاستثناءات والشروط",
  clientInputs: "المدخلات والصلاحيات المطلوبة من العميل",
  completionChecks: "معايير التحقق من الإنجاز",
  approveScope:
    "أعتمد هذا النطاق تحديدًا لمسودات العروض. أعد التأكيد عند حفظ التغييرات.",
  approved: "النطاق المعتمد المحفوظ",
  notApproved: "لا يوجد نطاق معتمد قابل لإعادة الاستخدام",
};

export function getCompleteProposalCopy(locale: Locale) {
  return locale === "ar" ? arabic : english;
}
