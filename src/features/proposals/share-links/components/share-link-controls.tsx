"use client";

import { useActionState, useMemo, useState } from "react";
import type { ProposalShareLinkMetadata } from "@/domain/proposals/types";
import {
  createProposalShareLinkAction,
  revokeProposalShareLinkAction,
} from "@/features/proposals/share-links/actions";
import { initialShareLinkActionState } from "@/features/proposals/share-links/state";

export function ShareLinkControls({
  snapshotId,
  activeLink,
}: {
  snapshotId: string;
  activeLink: ProposalShareLinkMetadata | null;
}) {
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [createState, createAction, isCreating] = useActionState(
    createProposalShareLinkAction,
    initialShareLinkActionState,
  );
  const [revokeState, revokeAction, isRevoking] = useActionState(
    revokeProposalShareLinkAction,
    initialShareLinkActionState,
  );

  const latestCreateAt =
    createState.status === "success" && createState.snapshotId === snapshotId
      ? createState.issuedAt
      : 0;
  const latestRevokeAt =
    revokeState.status === "success" && revokeState.snapshotId === snapshotId
      ? revokeState.issuedAt
      : 0;
  const wasRevoked = latestRevokeAt > latestCreateAt;
  const hasFreshLink =
    createState.status === "success" &&
    createState.snapshotId === snapshotId &&
    Boolean(createState.sharePath) &&
    latestCreateAt > latestRevokeAt;
  const hasActiveLink = hasFreshLink || (Boolean(activeLink) && !wasRevoked);
  const isMutating = isCreating || isRevoking;
  const expiresAt = hasFreshLink
    ? createState.expiresAt
    : activeLink?.expiresAt;
  const shareUrl = useMemo(() => {
    if (!hasFreshLink || !createState.sharePath) {
      return null;
    }

    if (typeof window === "undefined") {
      return createState.sharePath;
    }

    return new URL(createState.sharePath, window.location.origin).toString();
  }, [createState.sharePath, hasFreshLink]);

  async function copyShareUrl() {
    if (!shareUrl) {
      return;
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopyMessage("Share link copied.");
    } catch {
      setCopyMessage("Copy failed. Select the link and copy it manually.");
    }
  }

  return (
    <div className="mt-4 rounded-md border border-border bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ink">Public share link</p>
          <p className="mt-1 text-xs text-muted">
            {hasActiveLink
              ? "Active for this immutable snapshot."
              : "Inactive. Create a link to share this snapshot publicly."}
          </p>
          {expiresAt ? (
            <p className="mt-1 text-xs text-muted">
              Expires {new Date(expiresAt).toLocaleDateString()}.
            </p>
          ) : null}
        </div>
        <span className="rounded-md border border-border px-2 py-1 text-xs font-semibold text-ink">
          {hasActiveLink ? "Active" : "Inactive"}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <form action={createAction}>
          <input type="hidden" name="snapshotId" value={snapshotId} />
          <button
            className="rounded-md border border-border bg-white px-3 py-2 text-xs font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isMutating}
          >
            {isCreating
              ? "Creating..."
              : hasActiveLink
                ? "Create New Link"
                : "Create Share Link"}
          </button>
        </form>

        <form action={revokeAction}>
          <input type="hidden" name="snapshotId" value={snapshotId} />
          <button
            className="rounded-md border border-border bg-white px-3 py-2 text-xs font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!hasActiveLink || isMutating}
          >
            {isRevoking ? "Revoking..." : "Revoke Share Link"}
          </button>
        </form>
      </div>

      {shareUrl ? (
        <div className="mt-4">
          <label>
            <span className="text-xs font-medium text-ink">Share URL</span>
            <input
              readOnly
              value={shareUrl}
              className="mt-1 w-full rounded-md border border-border bg-white px-3 py-2 text-xs text-ink"
            />
          </label>
          <button
            type="button"
            onClick={copyShareUrl}
            className="mt-2 rounded-md border border-border bg-white px-3 py-2 text-xs font-semibold text-ink"
          >
            Copy Share Link
          </button>
        </div>
      ) : hasActiveLink ? (
        <p className="mt-3 text-xs text-muted">
          The existing token is not stored. Create a new link to reveal a fresh
          URL for copying.
        </p>
      ) : null}

      {createState.message && createState.snapshotId === snapshotId ? (
        <p
          className={`mt-3 text-xs ${
            createState.status === "error" ? "text-red-700" : "text-muted"
          }`}
        >
          {createState.message}
        </p>
      ) : null}

      {revokeState.message && revokeState.snapshotId === snapshotId ? (
        <p
          className={`mt-3 text-xs ${
            revokeState.status === "error" ? "text-red-700" : "text-muted"
          }`}
        >
          {revokeState.message}
        </p>
      ) : null}

      {copyMessage ? (
        <p className="mt-3 text-xs text-muted">{copyMessage}</p>
      ) : null}
    </div>
  );
}
