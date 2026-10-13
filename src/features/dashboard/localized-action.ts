import { getNextDashboardAction } from "@/features/dashboard/next-action";
import type { DashboardOverviewData } from "@/features/dashboard/types";
import { getDictionary, type TranslationKey } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/ui/preferences";

// Presentation adapter only: preserve the existing action decision and destination.
const actionCopy: Record<
  string,
  {
    title: TranslationKey;
    description?: TranslationKey;
    label: TranslationKey;
    context: TranslationKey;
  }
> = {
  "Start with your first prospect": {
    title: "firstProspectTitle",
    description: "firstProspectDescription",
    label: "addAProspect",
    context: "buildPipeline",
  },
  "Pick up your latest draft": {
    title: "continueDraftTitle",
    label: "continueProposal",
    context: "proposalInProgress",
  },
  "Review your available opportunities": {
    title: "reviewOpportunitiesTitle",
    description: "reviewOpportunitiesDescription",
    label: "reviewProspects",
    context: "evidenceToOpportunity",
  },
  "Find your next sales conversation": {
    title: "nextConversationTitle",
    description: "nextConversationDescription",
    label: "viewProspects",
    context: "explorePipeline",
  },
};

export function getLocalizedDashboardAction(
  data: DashboardOverviewData,
  locale: Locale,
) {
  const action = getNextDashboardAction(data);
  const copy = Object.hasOwn(actionCopy, action.title)
    ? actionCopy[action.title]
    : undefined;
  if (!copy) return action;
  const t = getDictionary(locale);
  return {
    ...action,
    title: t[copy.title],
    description: copy.description ? t[copy.description] : action.description,
    label: t[copy.label],
    context: t[copy.context],
  };
}
