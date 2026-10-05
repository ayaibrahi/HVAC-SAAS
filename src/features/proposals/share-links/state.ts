export type ShareLinkActionState = {
  status: "idle" | "success" | "error";
  message: string | null;
  snapshotId: string | null;
  sharePath: string | null;
  expiresAt: string | null;
  issuedAt: number;
};

export const initialShareLinkActionState: ShareLinkActionState = {
  status: "idle",
  message: null,
  snapshotId: null,
  sharePath: null,
  expiresAt: null,
  issuedAt: 0,
};
