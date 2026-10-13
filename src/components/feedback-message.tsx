"use client";

import { useInterface } from "@/components/ui-preferences";
import { translateFeedback } from "@/lib/i18n/dictionaries";

type FeedbackMessageProps = {
  error?: string | string[];
  success?: string | string[];
};

function firstValue(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export function FeedbackMessage({ error, success }: FeedbackMessageProps) {
  const { locale, t } = useInterface();
  const errorMessage = firstValue(error);
  const successMessage = firstValue(success);

  if (!errorMessage && !successMessage) {
    return null;
  }

  if (errorMessage) {
    return (
      <div
        lang={locale}
        dir={locale === "ar" ? "rtl" : "ltr"}
        role="alert"
        aria-atomic="true"
        className="feedback-error rounded-md border border-border px-4 py-3 text-sm leading-relaxed"
      >
        <p className="mb-1 font-semibold">{t.errorHeading}</p>
        <bdi>{translateFeedback(errorMessage, locale)}</bdi>
      </div>
    );
  }

  return (
    <div
      lang={locale}
      dir={locale === "ar" ? "rtl" : "ltr"}
      role="status"
      aria-atomic="true"
      className="feedback-success rounded-md border border-border px-4 py-3 text-sm leading-relaxed"
    >
      <p className="mb-1 font-semibold">{t.successHeading}</p>
      <bdi>{translateFeedback(successMessage ?? "", locale)}</bdi>
    </div>
  );
}
