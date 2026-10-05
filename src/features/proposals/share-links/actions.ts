"use server";

import { revalidatePath } from "next/cache";
import {
  createShareLinkForSnapshot,
  revokeShareLinkForSnapshot,
} from "@/features/proposals/share-links/data";
import {
  initialShareLinkActionState,
  type ShareLinkActionState,
} from "@/features/proposals/share-links/state";
import { getPublicErrorMessage } from "@/lib/errors";
import { proposalShareLinkInputSchema } from "@/lib/validation/proposal-share-links";

export async function createProposalShareLinkAction(
  _state: ShareLinkActionState,
  formData: FormData,
): Promise<ShareLinkActionState> {
  const result = parseShareLinkFormData(formData);

  if (!result.success) {
    return {
      ...initialShareLinkActionState,
      status: "error",
      message: "Delivery snapshot not found.",
      issuedAt: Date.now(),
    };
  }

  try {
    const link = await createShareLinkForSnapshot(result.data.snapshotId);

    revalidatePath("/dashboard/proposals");

    return {
      status: "success",
      message: "Share link created. Copy it now; the raw token is not stored.",
      snapshotId: link.snapshotId,
      sharePath: link.sharePath,
      expiresAt: link.expiresAt,
      issuedAt: Date.now(),
    };
  } catch (error) {
    return {
      ...initialShareLinkActionState,
      status: "error",
      snapshotId: result.data.snapshotId,
      issuedAt: Date.now(),
      message: getPublicErrorMessage(
        error,
        "We could not create the proposal share link.",
      ),
    };
  }
}

export async function revokeProposalShareLinkAction(
  _state: ShareLinkActionState,
  formData: FormData,
): Promise<ShareLinkActionState> {
  const result = parseShareLinkFormData(formData);

  if (!result.success) {
    return {
      ...initialShareLinkActionState,
      status: "error",
      message: "Delivery snapshot not found.",
      issuedAt: Date.now(),
    };
  }

  try {
    await revokeShareLinkForSnapshot(result.data.snapshotId);

    revalidatePath("/dashboard/proposals");

    return {
      ...initialShareLinkActionState,
      status: "success",
      snapshotId: result.data.snapshotId,
      issuedAt: Date.now(),
      message: "Share link revoked.",
    };
  } catch (error) {
    return {
      ...initialShareLinkActionState,
      status: "error",
      snapshotId: result.data.snapshotId,
      issuedAt: Date.now(),
      message: getPublicErrorMessage(
        error,
        "We could not revoke the proposal share link.",
      ),
    };
  }
}

function parseShareLinkFormData(formData: FormData) {
  return proposalShareLinkInputSchema.safeParse({
    snapshotId: formData.get("snapshotId"),
  });
}
