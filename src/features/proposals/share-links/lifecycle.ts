import type { ProposalShareLinkStatus } from "@/domain/proposals/types";

export type ShareLinkLifecycleFields = {
  status: ProposalShareLinkStatus;
  expires_at: string | null;
};

export function isShareLinkUsable(
  link: ShareLinkLifecycleFields,
  now = new Date(),
) {
  if (link.status !== "active") {
    return false;
  }

  if (!link.expires_at) {
    return true;
  }

  const expiresAt = Date.parse(link.expires_at);

  return Number.isFinite(expiresAt) && expiresAt > now.getTime();
}
