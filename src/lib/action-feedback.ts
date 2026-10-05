import type { ZodError } from "zod";

export function getValidationErrorMessage(error: ZodError) {
  return error.issues[0]?.message ?? "Please check the form and try again.";
}

export function buildFeedbackUrl(
  pathname: string,
  feedback: { error?: string; success?: string },
) {
  const params = new URLSearchParams();

  if (feedback.error) {
    params.set("error", feedback.error);
  }

  if (feedback.success) {
    params.set("success", feedback.success);
  }

  const query = params.toString();

  return query ? `${pathname}?${query}` : pathname;
}
