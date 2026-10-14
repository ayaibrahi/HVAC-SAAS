"use client";

import { Sparkles } from "lucide-react";
import { useInterface } from "@/components/ui-preferences";
import type {
  Opportunity,
  OpportunityAiInsight,
} from "@/domain/opportunities/types";
import { WorkspaceAction, RefreshWorkspace } from "./workspace-controls";

export function CompactFinding({
  item,
  service,
  insight,
}: {
  item: Opportunity;
  service?: string;
  insight?: OpportunityAiInsight;
}) {
  const { t, locale } = useInterface();
  const levels = { high: t.pHigh, medium: t.pMedium, low: t.pLow };
  const hasContent = Boolean(
    insight?.salesSummary ||
    insight?.whyItMatters ||
    insight?.clientFacingExplanation ||
    insight?.agencyTalkingPoints.length ||
    insight?.recommendedNextStep,
  );
  return (
    <article className="border-b border-border py-4" data-finding>
      <h3 className="mb-2 text-sm font-semibold text-ink">
        <bdi>{item.title}</bdi>
      </h3>
      <div className="space-y-2 text-sm">
        <p dir="auto" className="max-w-2xl leading-relaxed text-muted">
          {item.shortDescription}
        </p>
        <p className="text-xs">
          <span className="text-muted">{t.pService}: </span>
          <bdi>{service ?? t.pNoService}</bdi>
        </p>
        <details>
          <summary className="cursor-pointer py-2 text-xs font-medium text-accent">
            {t.pEvidence}
          </summary>
          <div className="mt-2 space-y-3 text-xs text-muted">
            <p>{t.pPageEvidence}</p>
            <ul className="space-y-3">
              {item.evidence.map((evidence, index) => (
                <li key={index}>
                  <p dir="auto">{evidence.details}</p>
                  <details className="mt-1">
                    <summary className="cursor-pointer py-2">
                      {t.pSourceDetails}
                    </summary>
                    <p>
                      {t.pSignal}: <bdi dir="ltr">{evidence.signal}</bdi>
                    </p>
                    <p>
                      {t.pObserved}:{" "}
                      <bdi dir="ltr">
                        {JSON.stringify(evidence.observed_value)}
                      </bdi>
                    </p>
                  </details>
                </li>
              ))}
            </ul>
            <p>
              {t.pPriority}: {levels[item.priority]} · {t.pConfidence}:{" "}
              {levels[item.confidence]}
            </p>
          </div>
        </details>
        <details>
          <summary className="cursor-pointer py-2 text-xs font-medium text-accent">
            {t.pAiTitle}
          </summary>
          <div className="mt-3 space-y-4">
            <p className="max-w-2xl text-xs leading-relaxed text-muted">
              {t.pAiDescription}
            </p>
            {locale === "ar" && (
              <p className="text-xs text-muted">{t.pSavedContent}</p>
            )}
            <WorkspaceAction
              key={insight?.updatedAt}
              path={`/api/opportunities/${item.id}/ai-insight`}
              disabled={insight?.status === "generating"}
              label={
                insight?.status === "generating"
                  ? t.pAiPending
                  : insight?.status === "failed"
                    ? t.pAiRetry
                    : hasContent
                      ? t.pAiRegenerate
                      : t.pAiGenerate
              }
              pendingLabel={t.pAiPending}
              icon={<Sparkles size={15} aria-hidden="true" />}
            />
            {insight?.status === "generating" && <RefreshWorkspace />}
            {insight?.status === "failed" && (
              <p className="text-xs text-muted">{t.pAiFailed}</p>
            )}
            {insight && hasContent && (
              <dl className="space-y-4">
                {[
                  [t.pSalesSummary, insight.salesSummary],
                  [t.pWhy, insight.whyItMatters],
                  [t.pClientExplanation, insight.clientFacingExplanation],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-xs font-medium">{label}</dt>
                    <dd dir="auto" className="mt-1 leading-relaxed text-muted">
                      {value}
                    </dd>
                  </div>
                ))}
                <div>
                  <dt className="text-xs font-medium">{t.pTalkingPoints}</dt>
                  <dd>
                    <ul className="mt-2 list-disc space-y-2 ps-4">
                      {insight.agencyTalkingPoints.map((point, index) => (
                        <li dir="auto" key={index} className="text-muted">
                          {point}
                        </li>
                      ))}
                    </ul>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium">{t.pNextStep}</dt>
                  <dd dir="auto" className="mt-1 text-muted">
                    {insight.recommendedNextStep}
                  </dd>
                </div>
              </dl>
            )}
          </div>
        </details>
      </div>
    </article>
  );
}
