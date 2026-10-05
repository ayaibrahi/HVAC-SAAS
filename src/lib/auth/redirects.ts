const defaultAuthRedirectPath = "/dashboard";

function hasUnsafeCharacters(value: string) {
  return /[\u0000-\u001f\u007f\\]/.test(value);
}

export function resolveSafeAuthRedirectPath(nextValue: string | null) {
  if (!nextValue) {
    return defaultAuthRedirectPath;
  }

  const trimmed = nextValue.trim();

  if (
    trimmed.length === 0 ||
    !trimmed.startsWith("/") ||
    trimmed.startsWith("//") ||
    hasUnsafeCharacters(trimmed)
  ) {
    return defaultAuthRedirectPath;
  }

  try {
    const parsed = new URL(trimmed, "https://internal.example");

    if (parsed.origin !== "https://internal.example") {
      return defaultAuthRedirectPath;
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return defaultAuthRedirectPath;
  }
}
