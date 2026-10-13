import type { DashboardOverviewData } from "@/features/dashboard/types";

// Recent lists are bounded: absence from one never proves absence in the workspace.
export function getNextDashboardAction(data: DashboardOverviewData) {
  if (data.counts.prospects === 0) {
    return {
      title: "Start with your first prospect",
      description: "Add a business and its website to your sales workspace.",
      label: "Add a prospect",
      href: "/dashboard/prospects",
      context: "Build your pipeline",
    };
  }
  const draft = data.recentProposals.find(
    (proposal) => proposal.status === "draft",
  );
  if (draft) {
    return {
      title: "Pick up your latest draft",
      description: draft.title,
      label: "Continue proposal",
      href: `/dashboard/proposals/${draft.id}`,
      context: "Proposal in progress",
    };
  }
  if (data.counts.opportunities > 0) {
    return {
      title: "Review your available opportunities",
      description:
        "Open a prospect's findings to decide what belongs in your next proposal.",
      label: "Review prospects",
      href: "/dashboard/prospects",
      context: "Evidence to opportunity",
    };
  }
  return {
    title: "Find your next sales conversation",
    description: "Review your prospects and choose a website to analyze.",
    label: "View prospects",
    href: "/dashboard/prospects",
    context: "Explore your pipeline",
  };
}
