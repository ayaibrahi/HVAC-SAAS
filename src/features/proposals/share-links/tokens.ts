import { createHash, randomBytes } from "node:crypto";
import { shareTokenSchema } from "@/lib/validation/proposal-share-links";

export const shareTokenByteLength = 32;
export const shareLinkDefaultTtlDays = 30;

export function generateShareToken() {
  return randomBytes(shareTokenByteLength).toString("base64url");
}

export function hashShareToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function isValidShareTokenFormat(token: string) {
  return shareTokenSchema.safeParse(token).success;
}

export function buildSharePath(token: string) {
  const result = shareTokenSchema.parse(token);

  return `/proposals/shared/${result}`;
}

export function getDefaultShareLinkExpiration(now = new Date()) {
  return new Date(
    now.getTime() + shareLinkDefaultTtlDays * 24 * 60 * 60 * 1000,
  ).toISOString();
}
