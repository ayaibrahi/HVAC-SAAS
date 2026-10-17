import type { Locale } from "@/lib/ui/preferences";

const english = {
  savedProposals: "Saved proposals",
  saved: "Proposal saved. Refreshing the saved preview.",
  editsPreserved: "Your edits are still in this form.",
  saveUncertain:
    "We could not confirm the save. Reopen this saved proposal in another tab to check before retrying; do not create another draft.",
  recommended: "Automatically recommended catalog service",
  manualService:
    "Manually selected catalog service; relevance requires your review.",
  selectedRecommendation: "Selected recommended service",
  serviceHelp:
    "Each checked finding needs a catalog service. Confirm its scope and enter your agreed price in the proposal currency; selecting a different service does not approve its relevance.",
  technicalEvidence: "Technical evidence (diagnostics)",
  aiEvidenceRequired:
    "Saved selections cannot support automatic copy with the current verified evidence and service scope. Review the selections or write the proposal manually.",
  deliverySaveFirst:
    "Save your current edits before preparing a client-ready version. Delivery uses the saved proposal only.",
  deliveryReview:
    "Review saved selections, quantities, prices, Summary and Scope. Resolve the issue below, then save as Ready.",
  back: "Back to proposals",
  builder: "Proposal Builder",
  forBusiness: "Proposal for",
  sourcePage: "Source page",
  businessResults: "Open business results",
  sourceNote:
    "This proposal keeps its original scan. Business results may show a newer scan.",
  workflow: "Prepare your proposal",
  chooseWorkStep: "1. Choose work and prices; save Draft.",
  editCopyStep: "2. Generate or edit copy; review and save Ready.",
  approveStep: "3. Prepare a client-ready version.",
  draftGuidance:
    "Draft: your work stays private until you prepare a client-ready version and choose to share it.",
  readyGuidance:
    "Ready: review the saved proposal, then prepare a fixed version for PDF or sharing.",
  reviewStep: "Review the analyzed-page evidence for the opportunities below.",
  selectStep:
    "Select relevant opportunities and choose services from your catalog.",
  priceStep:
    "Confirm quantities and manual prices. Unselected services are not included.",
  copyStep:
    "Write the summary and scope, or optionally generate draft copy after saving your selections.",
  saveStep:
    "Save and review the proposal. Choose Ready and save again when the content and prices are final.",
  emptyDraft:
    "Nothing is selected yet. Choose work below and save; the total reflects saved selections only.",
  savedPreview: "Saved proposal preview",
  savedPreviewNote:
    "Save changes to update this preview and its totals. AI copy uses saved selections, not unsaved edits.",
  generate: "Generate summary and scope (optional)",
  generating: "Generating...",
  aiSaveFirst:
    "Select services and save the draft before generating copy. Manual editing is always available.",
  aiOptional:
    "AI is optional. Save any edits first, then review generated copy before using it.",
  suggestCopy: "Use suggested draft",
  contentReview:
    "Based on saved selections, not an approved implementation package. Specify included work, exclusions, client inputs and completion checks in Scope before delivery. Catalog capabilities are not agreed deliverables. Prices remain in selected work.",
  contentUnavailable:
    "Suggested copy requires saved selections, verified page evidence and relevant active catalog services. Manual editing remains available.",
  suggestionApplied:
    "Suggested copy added to empty fields only. Review, edit and save when ready.",
  aiPreserve:
    "Saved text is preserved. Edit it manually; AI generation requires an empty Draft.",
  saveBeforeAi:
    "Save your current edits before requesting AI copy. Unsaved text and selections are not replaced.",
  noServices:
    "Add at least one active service before selecting proposal opportunities.",
  manageServices: "Open service catalog",
  details: "Proposal details",
  title: "Title",
  status: "Status",
  draft: "Draft",
  ready: "Ready",
  currency: "Currency",
  summary: "Summary",
  scope: "Scope",
  nextStep: "Next step",
  opportunities: "Choose opportunities and services",
  noOpportunities:
    "No opportunities are available for this proposal's scan. Review the business results before continuing.",
  service: "Service",
  chooseService: "Choose a relevant service",
  unavailableService:
    "Saved service is no longer active. Choose an active service to save changes.",
  unmatched:
    "No matching catalog service was suggested. Choose a relevant service explicitly before selecting this opportunity.",
  quantity: "Quantity",
  unitPrice: "Unit price",
  lineNote: "Service scope and deliverables",
  aiInsight: "AI sales insight",
  evidenceScope:
    "Evidence from the analyzed page only; not a claim about the whole business.",
  discount: "Discount",
  discountType: "Discount type",
  discountValue: "Discount value",
  none: "None",
  fixed: "Fixed amount",
  percentage: "Percentage",
  save: "Save proposal",
  saving: "Saving...",
  selectedWork: "Saved selected work",
  noLines: "No line items selected.",
  subtotal: "Subtotal",
  total: "Total",
  emptySummary: "Add a summary, then save to see it here.",
  emptyScope: "Describe the selected work, then save to see its scope here.",
  delivery: "Client-ready version",
  deliveryDescription:
    "Prepare a fixed copy of your saved Ready proposal for PDF and sharing. Later draft edits do not change a prepared version.",
  prepare: "Prepare client-ready version",
  preparing: "Preparing version...",
  readyRequired:
    "Select at least one service, add a summary and scope, then save with status Ready to prepare a client-ready version.",
  currentVersion: "Current client-ready version",
  noVersion: "No client-ready version has been prepared yet.",
  versionHistory: "Previous versions",
  download: "Download PDF",
  downloading: "Preparing PDF...",
  downloadError:
    "We could not download the PDF. Check your connection and try Download PDF again. Your saved version has not changed.",
  created: "Created",
  lineItems: "Line items",
  active: "Active",
  archived: "Previous",
  share: "Share link",
  shareActive: "Active for this fixed client-ready version.",
  shareInactive:
    "Inactive. Create a link when you are ready to share this version.",
  previewProtection:
    "Preview access protection may also require visitors to sign in to Vercel.",
  expires: "Expires",
  inactive: "Inactive",
  creating: "Creating...",
  newLink: "Replace share link",
  createLink: "Create share link",
  revoking: "Revoking...",
  revoke: "Revoke share link",
  shareUrl: "Share URL",
  copy: "Copy share link",
  copied: "Share link copied.",
  copyFailed: "Copy failed. Select the link and copy it manually.",
  hiddenLink:
    "The saved link cannot be shown again. Replacing it reveals a new URL and disables the previous link for this version.",
};

export type ProposalCopy = Record<keyof typeof english, string>;

const arabic: ProposalCopy = {
  savedProposals: "العروض المحفوظة",
  saved: "تم حفظ العرض. جارٍ تحديث المعاينة المحفوظة.",
  editsPreserved: "تعديلاتك ما زالت موجودة في هذا النموذج.",
  saveUncertain:
    "تعذّر تأكيد الحفظ. افتح العرض المحفوظ في علامة تبويب أخرى للتحقق قبل المحاولة مجددًا؛ لا تنشئ مسودة أخرى.",
  recommended: "خدمة مقترحة تلقائيًا من دليل الخدمات",
  manualService: "خدمة اخترتها يدويًا؛ يجب مراجعة ملاءمتها.",
  selectedRecommendation: "الخدمة المقترحة المختارة",
  serviceHelp:
    "كل فرصة محددة تحتاج إلى خدمة من الدليل. أكّد نطاقها وأدخل السعر المتفق عليه بعملة العرض؛ اختيار خدمة مختلفة لا يعني اعتماد ملاءمتها.",
  technicalEvidence: "أدلة تقنية للتشخيص",
  aiEvidenceRequired:
    "لا تدعم الاختيارات المحفوظة إنشاء النص تلقائيًا بالأدلة الموثّقة ونطاق الخدمة الحالي. راجع الاختيارات أو اكتب العرض يدويًا.",
  deliverySaveFirst:
    "احفظ تعديلاتك قبل إعداد نسخة العميل. يعتمد التسليم على العرض المحفوظ فقط.",
  deliveryReview:
    "راجع الاختيارات والكميات والأسعار والملخص والنطاق المحفوظة. عالج المشكلة أدناه ثم احفظ بالحالة جاهز.",
  back: "العودة إلى العروض",
  builder: "محرّر عرض الخدمات",
  forBusiness: "عرض خدمات لـ",
  sourcePage: "الصفحة التي تم فحصها",
  businessResults: "افتح نتائج النشاط",
  sourceNote: "يحتفظ هذا العرض بفحصه الأصلي. قد تعرض نتائج النشاط فحصًا أحدث.",
  workflow: "جهّز عرض الخدمات",
  chooseWorkStep: "١. اختر العمل والأسعار واحفظ المسودة.",
  editCopyStep: "٢. أنشئ النص أو حرّره وراجعه ثم احفظ بالحالة جاهز.",
  approveStep: "٣. أعدّ نسخة جاهزة للعميل.",
  draftGuidance:
    "مسودة: يبقى عملك خاصًا حتى تُعدّ نسخة جاهزة للعميل وتختار مشاركتها.",
  readyGuidance:
    "جاهز: راجع العرض المحفوظ، ثم أعدّ نسخة ثابتة للتنزيل بصيغة PDF أو المشاركة.",
  reviewStep: "راجع أدلة الصفحة التي تم فحصها للفرص أدناه.",
  selectStep: "اختر الفرص المناسبة والخدمات من دليل وكالتك.",
  priceStep: "أكّد الكميات والأسعار يدويًا. لا تُدرج الخدمات غير المختارة.",
  copyStep:
    "اكتب الملخص ونطاق العمل، أو أنشئ مسودة نصية اختياريًا بعد حفظ اختياراتك.",
  saveStep:
    "احفظ العرض وراجعه. اختر الحالة جاهز واحفظ مجددًا بعد اعتماد المحتوى والأسعار.",
  emptyDraft:
    "لم تُختر أي خدمة بعد. اختر العمل أدناه واحفظه؛ يعكس الإجمالي الاختيارات المحفوظة فقط.",
  savedPreview: "معاينة العرض المحفوظ",
  savedPreviewNote:
    "احفظ التعديلات لتحديث المعاينة والإجماليات. يستخدم الذكاء الاصطناعي الاختيارات المحفوظة، لا التعديلات غير المحفوظة.",
  generate: "إعداد الملخص ونطاق العمل (اختياري)",
  generating: "جارٍ الإعداد...",
  aiSaveFirst:
    "اختر الخدمات واحفظ المسودة قبل إنشاء النص. يمكنك دائمًا التحرير يدويًا.",
  aiOptional:
    "الذكاء الاصطناعي اختياري. احفظ تعديلاتك أولًا وراجع النص الناتج قبل استخدامه.",
  suggestCopy: "استخدم المسودة المقترحة",
  contentReview:
    "استنادًا إلى الاختيارات المحفوظة، وليس حزمة تنفيذ معتمدة. حدّد في النطاق العمل المشمول والاستثناءات ومتطلبات العميل ومعايير التحقق من الإنجاز قبل التسليم. إمكانات الدليل ليست مخرجات متفقًا عليها. تبقى الأسعار في بنود العمل.",
  contentUnavailable:
    "يتطلب النص المقترح اختيارات محفوظة وأدلة صفحة موثّقة وخدمات نشطة ومناسبة من الدليل. يبقى التحرير اليدوي متاحًا.",
  suggestionApplied:
    "أُضيف النص المقترح إلى الحقول الفارغة فقط. راجعه وعدّله واحفظه عندما تكون جاهزًا.",
  aiPreserve:
    "يُحفظ النص السابق دون استبدال. عدّله يدويًا؛ يتطلب إنشاء نص بالذكاء الاصطناعي مسودة فارغة.",
  saveBeforeAi:
    "احفظ تعديلاتك الحالية قبل طلب نص بالذكاء الاصطناعي. لا تُستبدل النصوص والاختيارات غير المحفوظة.",
  noServices: "أضف خدمة نشطة واحدة على الأقل قبل اختيار فرص العرض.",
  manageServices: "افتح دليل الخدمات",
  details: "تفاصيل العرض",
  title: "العنوان",
  status: "الحالة",
  draft: "مسودة",
  ready: "جاهز",
  currency: "العملة",
  summary: "الملخص",
  scope: "نطاق العمل",
  nextStep: "الخطوة التالية",
  opportunities: "اختر الفرص والخدمات",
  noOpportunities:
    "لا توجد فرص متاحة لفحص هذا العرض. راجع نتائج النشاط قبل المتابعة.",
  service: "الخدمة",
  chooseService: "اختر خدمة مناسبة",
  unavailableService:
    "الخدمة المحفوظة لم تعد نشطة. اختر خدمة نشطة لحفظ التعديلات.",
  unmatched:
    "لم تُقترح خدمة مناسبة من الدليل. اختر خدمة مناسبة بنفسك قبل اختيار هذه الفرصة.",
  quantity: "الكمية",
  unitPrice: "سعر الوحدة",
  lineNote: "نطاق الخدمة ومخرجاتها",
  aiInsight: "رؤية بيعية بالذكاء الاصطناعي",
  evidenceScope:
    "أدلة الصفحة التي تم فحصها فقط، وليست حكمًا على النشاط بأكمله.",
  discount: "الخصم",
  discountType: "نوع الخصم",
  discountValue: "قيمة الخصم",
  none: "بدون",
  fixed: "مبلغ ثابت",
  percentage: "نسبة مئوية",
  save: "حفظ العرض",
  saving: "جارٍ الحفظ...",
  selectedWork: "العمل المختار المحفوظ",
  noLines: "لم تُختر بنود بعد.",
  subtotal: "المجموع الفرعي",
  total: "الإجمالي",
  emptySummary: "أضف ملخصًا واحفظه ليظهر هنا.",
  emptyScope: "صِف العمل المختار واحفظه ليظهر نطاقه هنا.",
  delivery: "نسخة جاهزة للعميل",
  deliveryDescription:
    "أعدّ نسخة ثابتة من العرض الجاهز المحفوظ للتنزيل والمشاركة. لا تغيّر تعديلات المسودة اللاحقة النسخة المُعدّة.",
  prepare: "إعداد نسخة جاهزة للعميل",
  preparing: "جارٍ إعداد النسخة...",
  readyRequired:
    "اختر خدمة واحدة على الأقل وأضف الملخص ونطاق العمل، ثم احفظ بالحالة جاهز لإعداد نسخة العميل.",
  currentVersion: "نسخة العميل الحالية",
  noVersion: "لم تُعدّ نسخة جاهزة للعميل بعد.",
  versionHistory: "النسخ السابقة",
  download: "تنزيل PDF",
  downloading: "جارٍ إعداد PDF...",
  downloadError:
    "تعذّر تنزيل PDF. تحقّق من الاتصال ثم حاول التنزيل مجددًا. لم تتغيّر النسخة المحفوظة.",
  created: "تاريخ الإنشاء",
  lineItems: "البنود",
  active: "نشط",
  archived: "سابقة",
  share: "رابط المشاركة",
  shareActive: "نشط لهذه النسخة الثابتة الجاهزة للعميل.",
  shareInactive: "غير نشط. أنشئ رابطًا عندما تكون جاهزًا لمشاركة هذه النسخة.",
  previewProtection: "قد تتطلب حماية المعاينة تسجيل الزائر في Vercel أيضًا.",
  expires: "تنتهي الصلاحية",
  inactive: "غير نشط",
  creating: "جارٍ الإنشاء...",
  newLink: "استبدال رابط المشاركة",
  createLink: "إنشاء رابط مشاركة",
  revoking: "جارٍ الإلغاء...",
  revoke: "إلغاء رابط المشاركة",
  shareUrl: "عنوان المشاركة",
  copy: "نسخ رابط المشاركة",
  copied: "تم نسخ رابط المشاركة.",
  copyFailed: "تعذر النسخ. حدد الرابط وانسخه يدويًا.",
  hiddenLink:
    "لا يمكن إظهار الرابط المحفوظ مجددًا. يؤدي استبداله إلى إظهار عنوان جديد وتعطيل الرابط السابق لهذه النسخة.",
};

export function getProposalCopy(locale: Locale): ProposalCopy {
  return locale === "ar" ? arabic : english;
}
