import { ProspectsScreen } from "@/features/prospects/components/prospects-screen";
import { FeedbackMessage } from "@/components/feedback-message";
import {
  getProspectsPage,
  getProspectWorkspace,
} from "@/features/prospects/workspace-data";
import { createBusinessForScan } from "@/features/prospects/workspace-actions";
import { createProposalAction } from "@/features/proposals/actions";
import { AppError } from "@/lib/errors";
import type {
  ProspectListData,
  ProspectWorkspaceData,
} from "@/features/prospects/workspace-model";

export default async function ProspectsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    page?: string;
    prospect?: string;
    error?: string;
    success?: string;
  }>;
}) {
  const params = await searchParams;
  const requested =
    typeof params.prospect === "string" && params.prospect.length > 0;
  let data: ProspectListData | null = null;
  let selected: ProspectWorkspaceData | null = null;
  let problem: "agency" | "load" | undefined;
  try {
    data = await getProspectsPage(params);
    selected = requested ? await getProspectWorkspace(params.prospect!) : null;
  } catch (error) {
    data = null;
    selected = null;
    problem =
      error instanceof AppError && error.statusCode === 403 ? "agency" : "load";
  }
  return (
    <div className="space-y-6">
      <FeedbackMessage error={params.error} success={params.success} />
      <ProspectsScreen
        data={data}
        selected={selected}
        missing={requested && !selected && !problem}
        problem={problem}
        addProspect={createBusinessForScan}
        createProposal={createProposalAction}
      />
    </div>
  );
}
