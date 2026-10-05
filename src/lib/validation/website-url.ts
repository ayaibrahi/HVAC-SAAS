import { z } from "zod";

function addDefaultProtocol(value: string) {
  const trimmed = value.trim();
  const hasProtocol = /^[a-z][a-z\d+\-.]*:\/\//i.test(trimmed);

  return hasProtocol ? trimmed : `https://${trimmed}`;
}

function isBusinessWebsiteHostname(hostname: string) {
  const normalized = hostname.toLowerCase();
  const isIpv4 = /^(\d{1,3}\.){3}\d{1,3}$/.test(normalized);
  const looksInternal =
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized.endsWith(".local") ||
    normalized.endsWith(".internal");

  return (
    normalized.includes(".") &&
    !normalized.includes("_") &&
    !normalized.includes(":") &&
    !isIpv4 &&
    !looksInternal
  );
}

export const websiteUrlSchema = z
  .string()
  .trim()
  .min(1, "Website URL is required.")
  .transform(addDefaultProtocol)
  .refine((value) => {
    try {
      const url = new URL(value);

      return (
        (url.protocol === "https:" || url.protocol === "http:") &&
        url.username === "" &&
        url.password === "" &&
        isBusinessWebsiteHostname(url.hostname)
      );
    } catch {
      return false;
    }
  }, "Enter a valid public website URL.")
  .transform((value) => {
    const url = new URL(value);
    url.hash = "";

    return url.toString();
  });

export const optionalWebsiteUrlSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  websiteUrlSchema.optional(),
);
