type FeedbackMessageProps = {
  error?: string | string[];
  success?: string | string[];
};

function firstValue(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export function FeedbackMessage({ error, success }: FeedbackMessageProps) {
  const errorMessage = firstValue(error);
  const successMessage = firstValue(success);

  if (!errorMessage && !successMessage) {
    return null;
  }

  if (errorMessage) {
    return (
      <div
        role="alert"
        aria-atomic="true"
        className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm leading-relaxed text-red-800"
      >
        {errorMessage}
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-atomic="true"
      className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-relaxed text-emerald-800"
    >
      {successMessage}
    </div>
  );
}
