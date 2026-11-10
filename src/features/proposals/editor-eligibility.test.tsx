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
  it("recognizes approved deliverables with all optional scope fields empty", async () => {
    data.opportunities = data.opportunities.filter((item) =>
      data.lineItemsByOpportunityId.has(item.id),
    );
    Object.assign(data.services[0].approvedScope!, {
      exclusions: "",
      clientInputs: "",
      completionChecks: "",
    });
    const markup = await html();
    expect(button(markup, "Generate Complete Proposal")).toContain(
      'aria-disabled="false"',
    );
    expect(markup).toContain("Saved approved scope");
    expect(markup).not.toContain("No approved reusable scope");
    expect(markup).not.toContain("Exclusions and qualifications");
  });
  it("offers generation from the editor while server validation enforces scope and evidence", async () => {
    expect(button(await html(), "Generate Complete Proposal")).toContain(
      'aria-disabled="false"',
    );
  });
  it("submits current unsaved selections without a separate confirmation checkbox", async () => {
    data.lineItemsByOpportunityId.clear();
    const markup = await html();
    expect(button(markup, "Generate Complete Proposal")).toContain(
      'aria-disabled="false"',
    );
    expect(markup).toContain('form="proposal-editor"');
    expect(markup).not.toContain('name="confirmCompleteProposal"');
  });
  it("allows correcting a saved unrelated service in the current form before server validation", async () => {
    data.services[0].name = "Logo Design";
    data.services[0].description = "Illustrative unrelated catalog scope";
    data.services[0].approvedScope!.deliverables =
      "Design an approved agency logo.";
    const markup = await html();
    expect(button(markup, "Generate Complete Proposal")).toContain(
      'aria-disabled="false"',
    );
    expect(markup).toContain("Generate saves your current selections");
  });
  it.each(["summary", "scope", "nextStep"] as const)(
    "allows filling empty fields while preserving existing %s",
    async (field) => {
      data.proposal[field] = "Human-approved text";
      const markup = await html();
      expect(markup).toContain("only empty text fields receive generated copy");
      expect(button(markup, "Generate Complete Proposal")).toContain(
        'aria-disabled="false"',
      );
    },
  );
  it("offers one explicit Ready approval and preparation action", async () => {
    const markup = await html();
    expect(
      button(markup, "Save as Ready &amp; Prepare Client Version"),
    ).toContain('aria-disabled="false"');
    expect(
      button(markup, "Save as Ready &amp; Prepare Client Version"),
    ).toContain('value="prepare"');
  });
  it("enables delivery for a consistent saved Ready proposal without creating any snapshot", async () => {
    data.proposal.status = "ready";
    data.proposal.summary = "Manually reviewed summary";
    data.proposal.scope = "Manually agreed scope";
    expect(
      button(await html(), "Save as Ready &amp; Prepare Client Version"),
    ).toContain('aria-disabled="false"');
  });
  it.each(["summary", "scope", "lines", "price"])(
    "shows saved %s issue while allowing corrected form submission",
    async (kind) => {
      data.proposal.status = "ready";
      data.proposal.summary = "Manually reviewed summary";
      data.proposal.scope = "Manually agreed scope";
      if (kind === "summary" || kind === "scope") data.proposal[kind] = "";
      if (kind === "lines") data.lineItemsByOpportunityId.clear();
      if (kind === "price") data.proposal.total = 999;
      const markup = await html();
      expect(
        button(markup, "Save as Ready &amp; Prepare Client Version"),
      ).toContain('aria-disabled="false"');
      expect(markup).toContain("Resolve the issue below");
    },
  );
});
