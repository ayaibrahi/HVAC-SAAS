import "server-only";

import type {
  DeliverySnapshotPublicView,
  ProposalDeliverySnapshot,
  ProposalShareLinkMetadata,
} from "@/domain/proposals/types";
import { requireCurrentAgency } from "@/features/agencies/data";
import {
  mapDeliverySnapshot,
  getDeliverySnapshot,
} from "@/features/proposals/delivery/data";
import { mapDeliverySnapshotToPublicView } from "@/features/proposals/delivery/public-view";
import { isShareLinkUsable } from "@/features/proposals/share-links/lifecycle";
import {
  buildSharePath,
  generateShareToken,
  getDefaultShareLinkExpiration,
  hashShareToken,
  isValidShareTokenFormat,
} from "@/features/proposals/share-links/tokens";
import { AppError } from "@/lib/errors";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";
import { proposalShareLinkInputSchema } from "@/lib/validation/proposal-share-links";

type ShareLinkRow =
  Database["public"]["Tables"]["proposal_share_links"]["Row"];
type ShareLinkMetadataRow = Pick<
  ShareLinkRow,
  | "id"
  | "agency_id"
  | "delivery_snapshot_id"
  | "status"
  | "expires_at"
  | "created_at"
  | "revoked_at"
>;
type ShareLinkResolutionRow = Pick<
  ShareLinkRow,
  "agency_id" | "delivery_snapshot_id" | "status" | "expires_at"
>;

export type CreatedShareLink = {
  snapshotId: string;
  sharePath: string;
  expiresAt: string;
};

export async function createShareLinkForSnapshot(snapshotId: string) {
  const input = proposalShareLinkInputSchema.parse({ snapshotId });
  const { agency, user } = await requireCurrentAgency();
  const snapshot = await getDeliverySnapshot(input.snapshotId);

  assertSnapshotCanBeShared(snapshot);

  if (snapshot.agencyId !== agency.id) {
    throw new AppError("Delivery snapshot not found.", 404);
  }

  const token = generateShareToken();
  const expiresAt = getDefaultShareLinkExpiration();
  const admin = createSupabaseAdminClient();
  const { error } = await admin.rpc("create_proposal_share_link", {
    p_agency_id: agency.id,
    p_delivery_snapshot_id: snapshot.id,
    p_created_by: user.id,
    p_token_hash: hashShareToken(token),
    p_expires_at: expiresAt,
  });

  if (error) {
    throw new AppError(getShareLinkMutationErrorMessage(error.message), 409);
  }

  return {
    snapshotId: snapshot.id,
    sharePath: buildSharePath(token),
    expiresAt,
  } satisfies CreatedShareLink;
}

export async function revokeShareLinkForSnapshot(snapshotId: string) {
  const input = proposalShareLinkInputSchema.parse({ snapshotId });
  const { agency, user } = await requireCurrentAgency();
  const snapshot = await getDeliverySnapshot(input.snapshotId);

  assertSnapshotCanBeShared(snapshot);

  if (snapshot.agencyId !== agency.id) {
    throw new AppError("Delivery snapshot not found.", 404);
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin.rpc("revoke_proposal_share_link", {
    p_agency_id: agency.id,
    p_delivery_snapshot_id: snapshot.id,
    p_revoked_by: user.id,
  });

  if (error) {
    throw new AppError(getShareLinkMutationErrorMessage(error.message), 409);
  }
}

export async function listShareLinksForSnapshots(snapshotIds: string[]) {
  if (snapshotIds.length === 0) {
    return [];
  }

  const { supabase, agency } = await requireCurrentAgency();
  const { data, error } = await supabase
    .from("proposal_share_links")
    .select(
      "id, agency_id, delivery_snapshot_id, status, expires_at, created_at, revoked_at",
    )
    .eq("agency_id", agency.id)
    .in("delivery_snapshot_id", snapshotIds)
    .order("created_at", { ascending: false });

  if (error) {
    throw new AppError("We could not load proposal share links.", 500);
  }

  return (data as ShareLinkMetadataRow[]).map(mapShareLinkMetadata);
}

export async function resolvePublicShareToken(
  token: string,
  now = new Date(),
): Promise<DeliverySnapshotPublicView | null> {
  if (!isValidShareTokenFormat(token)) {
    return null;
  }

  const admin = createSupabaseAdminClient();
  const { data: link, error } = await admin
    .from("proposal_share_links")
    .select("agency_id, delivery_snapshot_id, status, expires_at")
    .eq("token_hash", hashShareToken(token))
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    throw new AppError("Shared proposal could not be loaded.", 500);
  }

  if (!link || !isShareLinkUsable(link as ShareLinkResolutionRow, now)) {
    return null;
  }

  const { data: snapshot, error: snapshotError } = await admin
    .from("proposal_delivery_snapshots")
    .select("*")
    .eq("id", link.delivery_snapshot_id)
    .eq("agency_id", link.agency_id)
    .maybeSingle();

  if (snapshotError) {
    throw new AppError("Shared proposal could not be loaded.", 500);
  }

  if (!snapshot) {
    return null;
  }

  return mapDeliverySnapshotToPublicView(mapDeliverySnapshot(snapshot));
}

function assertSnapshotCanBeShared(
  snapshot: ProposalDeliverySnapshot | null,
): asserts snapshot is ProposalDeliverySnapshot {
  if (!snapshot) {
    throw new AppError("Delivery snapshot not found.", 404);
  }
}

function mapShareLinkMetadata(row: ShareLinkMetadataRow): ProposalShareLinkMetadata {
  return {
    id: row.id,
    agencyId: row.agency_id,
    deliverySnapshotId: row.delivery_snapshot_id,
    status: row.status,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    revokedAt: row.revoked_at,
  };
}

function getShareLinkMutationErrorMessage(message: string | undefined) {
  if (!message) {
    return "We could not update the proposal share link.";
  }

  if (message.includes("delivery_snapshot_not_found")) {
    return "Delivery snapshot not found.";
  }

  if (message.includes("agency_user_not_authorized")) {
    return "Delivery snapshot not found.";
  }

  if (message.includes("share_link_expiration_invalid")) {
    return "Share link expiration is invalid.";
  }

  return "We could not update the proposal share link.";
}
