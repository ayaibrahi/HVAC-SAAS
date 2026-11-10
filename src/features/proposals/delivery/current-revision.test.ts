import { beforeEach, expect, it, vi } from "vitest";
import { createDeliverySnapshotForProposal } from "./data";
import { requireCurrentAgency } from "@/features/agencies/data";
import { getProposalBuilderData } from "../data";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { makeCompleteProposalBuilder } from "../ai/complete-test-fixtures";

vi.mock("server-only", () => ({}));
vi.mock("@/features/agencies/data", () => ({ requireCurrentAgency: vi.fn() }));
vi.mock("../data", () => ({ getProposalBuilderData: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: vi.fn() }));
beforeEach(() => vi.resetAllMocks());
it("rejects changes after the explicit Ready approval before creating any snapshot", async () => {
  const data = makeCompleteProposalBuilder();
  data.proposal.status = "ready";
  data.proposal.updatedAt = "another-editor-revision";
  vi.mocked(requireCurrentAgency).mockResolvedValue({
    agency: data.agency,
    user: { id: "test" },
  } as Awaited<ReturnType<typeof requireCurrentAgency>>);
  vi.mocked(getProposalBuilderData).mockResolvedValue(data);
  await expect(
    createDeliverySnapshotForProposal(data.proposal.id, "approved-revision"),
  ).rejects.toThrow("changed after your Ready approval");
  expect(createSupabaseAdminClient).not.toHaveBeenCalled();
});
