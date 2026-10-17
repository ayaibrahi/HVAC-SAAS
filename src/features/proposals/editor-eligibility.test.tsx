import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import Page from "@/app/(dashboard)/dashboard/proposals/[proposalId]/page";
import { makeControlledProposalBuilder } from "./sales-test-fixtures";
import { makeCompleteProposalBuilder } from "./ai/complete-test-fixtures";
import { getProposalBuilderData } from "./data";
import { getUiPreferences } from "@/lib/ui/server-preferences";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("./data", () => ({ getProposalBuilderData: vi.fn() }));
vi.mock("./actions", () => ({
  saveProposalFormAction: vi.fn(),
  updateProposalAction: vi.fn(),
  generateProposalAiDraftAction: vi.fn(),
  generateCompleteProposalAction: vi.fn(),
}));
vi.mock("./delivery/actions", () => ({
  createDeliverySnapshotAction: vi.fn(),
}));
vi.mock("./delivery/data", () => ({
  listDeliverySnapshotsForProposal: async () => [],
}));
vi.mock("./share-links/data", () => ({
  listShareLinksForSnapshots: async () => [],
}));
vi.mock("@/lib/ui/server-preferences", () => ({ getUiPreferences: vi.fn() }));

let data: ReturnType<typeof makeControlledProposalBuilder>;
beforeEach(() => {
  data = makeCompleteProposalBuilder();
  for (const line of data.lineItemsByOpportunityId.values()) {
    const opportunity = data.opportunities.find(
      (item) => item.id === line.opportunityId,
    )!;
    data.proposalOpportunitiesByOpportunityId.set(line.opportunityId, {
      proposalId: data.proposal.id,
      agencyId: data.agency.id,
      opportunityId: line.opportunityId,
      agencyServiceId: line.agencyServiceId,
      position: line.position,
      opportunityTitle: opportunity.title,
      opportunityShortDescription: opportunity.shortDescription,
      serviceName: line.serviceName,
      serviceDescription: line.serviceDescription,
      aiSalesSummary: null,
      aiClientFacingExplanation: null,
      createdAt: line.createdAt,
    });
  }
  vi.mocked(getProposalBuilderData).mockImplementation(async () => data);
  vi.mocked(getUiPreferences).mockResolvedValue({
    locale: "en",
    theme: "light",
  });
});
async function html() {
  return renderToStaticMarkup(
    await Page({
      params: Promise.resolve({ proposalId: data.proposal.id }),
      searchParams: Promise.resolve({}),
    }),
  );
}
function button(markup: string, label: string) {
  return markup.match(new RegExp(`<button[^>]*>${label}</button>`))?.[0];
}
describe("saved proposal action eligibility", () => {
  it("enables complete generation only for saved relevant lines with approved scope, verified evidence and empty Draft text", async () => {
    expect(button(await html(), "Generate Complete Proposal")).toContain(
      'aria-disabled="false"',
    );
  });
  it("asks for a saved selection before generation", async () => {
    data.lineItemsByOpportunityId.clear();
    const markup = await html();
    expect(button(markup, "Generate Complete Proposal")).toContain(
      'disabled=""',
    );
    expect(markup).toContain("Select services and save the draft");
  });
  it("explains blocked automatic copy for manual unrelated services instead of suggesting generation is available", async () => {
    data.services[0].name = "Logo Design";
    data.services[0].description = "Illustrative unrelated catalog scope";
    const markup = await html();
    expect(button(markup, "Generate Complete Proposal")).toContain(
      'disabled=""',
    );
    expect(markup).toContain(
      "Complete generation needs approved catalog scope",
    );
  });
  it.each(["summary", "scope", "nextStep"] as const)(
    "preserves existing %s by disabling AI replacement",
    async (field) => {
      data.proposal[field] = "Human-approved text";
      const markup = await html();
      expect(markup).toContain("Saved text is preserved.");
      expect(button(markup, "Generate Complete Proposal")).toContain(
        'disabled=""',
      );
    },
  );
  it("requires saving Ready before delivery", async () => {
    const markup = await html();
    expect(button(markup, "Prepare client-ready version")).toContain(
      'disabled=""',
    );
    expect(markup).toContain("save with status Ready");
  });
  it("enables delivery for a consistent saved Ready proposal without creating any snapshot", async () => {
    data.proposal.status = "ready";
    data.proposal.summary = "Manually reviewed summary";
    data.proposal.scope = "Manually agreed scope";
    expect(button(await html(), "Prepare client-ready version")).toContain(
      'aria-disabled="false"',
    );
  });
  it.each(["summary", "scope", "lines", "price"])(
    "blocks delivery with actionable saved %s issue",
    async (kind) => {
      data.proposal.status = "ready";
      data.proposal.summary = "Manually reviewed summary";
      data.proposal.scope = "Manually agreed scope";
      if (kind === "summary" || kind === "scope") data.proposal[kind] = "";
      if (kind === "lines") data.lineItemsByOpportunityId.clear();
      if (kind === "price") data.proposal.total = 999;
      const markup = await html();
      expect(button(markup, "Prepare client-ready version")).toContain(
        'disabled=""',
      );
      expect(markup).toContain("Resolve the issue below");
    },
  );
});
