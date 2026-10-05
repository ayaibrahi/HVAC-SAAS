import { z } from "zod";

export function emptyToUndefined(value: unknown) {
  if (typeof value === "string" && value.trim() === "") {
    return undefined;
  }

  return value;
}

export function optionalTrimmedText(maxLength = 1000) {
  return z.preprocess(
    emptyToUndefined,
    z.string().trim().max(maxLength).optional(),
  );
}
