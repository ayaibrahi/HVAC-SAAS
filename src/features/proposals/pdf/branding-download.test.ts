import { beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import {
  createProposalPdfDownload,
  createProposalPdfDownloadFromSnapshot,
} from "./data";
import { ValidatedAgencyLogo } from "./logo";
import { getProposalContentSuggestion } from "../content-suggestion";
import {
  makeIllustrativeContactOffer,
  makeLocalContentSnapshot,
} from "../sales-test-fixtures";
const mocks = vi.hoisted(() => ({ getSnapshot: vi.fn(), loadLogo: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/features/proposals/delivery/data", () => ({
  getDeliverySnapshot: mocks.getSnapshot,
}));
vi.mock("@/features/agencies/branding/data", () => ({
  loadSnapshotLogo: mocks.loadLogo,
}));
function snapshot() {
  const data = makeIllustrativeContactOffer();
  return makeLocalContentSnapshot(data, getProposalContentSuggestion(data)!);
}
async function logo(agencyId: string) {
  const bytes = await sharp({
    create: {
      width: 80,
      height: 40,
      channels: 4,
      background: { r: 20, g: 80, b: 70, alpha: 0.5 },
    },
  })
    .png()
    .toBuffer();
  return ValidatedAgencyLogo.decode({
    bytes,
    ownerAgencyId: agencyId,
    requestingAgencyId: agencyId,
  });
}
describe("snapshot-bound branded PDF download", () => {
  beforeEach(() => vi.clearAllMocks());
  it("renders a verified frozen logo only after the authorized snapshot lookup", async () => {
    const saved = snapshot();
    const frozen = JSON.stringify(saved);
    mocks.getSnapshot.mockResolvedValue(saved);
    mocks.loadLogo.mockResolvedValue({ logo: await logo(saved.agencyId) });
    const result = await createProposalPdfDownload(saved.id);
    expect(mocks.getSnapshot).toHaveBeenCalledWith(saved.id);
    expect(mocks.loadLogo).toHaveBeenCalledWith(saved);
    expect(mocks.getSnapshot.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.loadLogo.mock.invocationCallOrder[0],
    );
    const text = Buffer.from(result.bytes).toString("latin1");
    expect(text).toContain("/AgencyLogo");
    expect(text).toContain("USD 500.00");
    expect(text).toContain(saved.agencyDisplayName);
    expect(text).not.toContain("object_key");
    expect(JSON.stringify(saved)).toBe(frozen);
  });
  it("does not access any private asset when the snapshot is missing or unauthorized", async () => {
    mocks.getSnapshot.mockResolvedValue(null);
    await expect(createProposalPdfDownload("foreign-id")).rejects.toThrow(
      "not found",
    );
    expect(mocks.loadLogo).not.toHaveBeenCalled();
  });
  it("rejects foreign branding and preserves name-only historical output", async () => {
    const saved = snapshot();
    const expected = createProposalPdfDownloadFromSnapshot(saved);
    const foreign = createProposalPdfDownloadFromSnapshot(
      saved,
      await logo("foreign-agency"),
    );
    expect(Buffer.from(foreign.bytes).equals(Buffer.from(expected.bytes))).toBe(
      true,
    );
  });
});
