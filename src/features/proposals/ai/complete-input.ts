import type { ProposalBuilderData } from "../data";
import { createProposalAiInput } from "./input";
import {
  calculateLineTotalCents,
  calculateProposalTotals,
  parseMoneyToCents,
} from "../pricing";
import { readApprovedServiceScope } from "@/lib/validation/service-scope";
import { assertAiSerializedInputWithinBudget } from "@/lib/ai/input-budget";
import { AppError } from "@/lib/errors";
import { evaluateHvacOpportunityRules } from "@/features/opportunities/rules/hvac";
import { mapOpportunityToAgencyService } from "@/features/opportunities/engine/map-services";

export function createCompleteProposalInput(data: ProposalBuilderData) {
  const input = createProposalAiInput({
    agency: data.agency,
    builderData: data,
  });
  const lines = [...data.lineItemsByOpportunityId.values()].sort(
    (a, b) => a.position - b.position,
  );
  if (lines.length !== input.selectedItems.length) {
    throw new AppError(
      "Saved selections need review. Save the draft again before generation.",
      422,
    );
  }
  const pricedLines = lines.map((line) => {
    const unitPriceCents = parseMoneyToCents(String(line.unitPrice));
    if (
      calculateLineTotalCents({ quantity: line.quantity, unitPriceCents }) !==
      parseMoneyToCents(String(line.lineTotal))
    ) {
      throw new AppError(
        "Saved line prices are inconsistent. Review and save the draft.",
        422,
      );
    }
    return { quantity: line.quantity, unitPriceCents };
  });
  const totals = calculateProposalTotals({
    lines: pricedLines,
    discountType: data.proposal.discountType,
    discountValue: String(data.proposal.discountValue),
  });
  if (
    totals.subtotalCents !==
      parseMoneyToCents(String(data.proposal.subtotal)) ||
    totals.totalCents !== parseMoneyToCents(String(data.proposal.total)) ||
    totals.discountAmountCents !==
      parseMoneyToCents(String(data.proposal.discountAmount))
  ) {
    throw new AppError(
      "Saved proposal totals are inconsistent. Review and save the draft.",
      422,
    );
  }
  input.mode = "complete";
  const rules = evaluateHvacOpportunityRules({ audit: data.audit });
  input.selectedItems = lines.map((line) => {
    const item = input.selectedItems.find(
      (selected) => selected.opportunityId === line.opportunityId,
    )!;
    const service = data.services.find(
      (candidate) => candidate.id === item.service.id,
    )!;
    const scope = readApprovedServiceScope(service.approvedScope);
    if (!scope) {
      throw new AppError(
        "Approve deliverables, exclusions, client inputs and completion checks for every selected service in the catalog first.",
        422,
      );
    }
    const opportunity = data.opportunities.find(
      (candidate) => candidate.id === line.opportunityId,
    );
    const rule = rules.find(
      (candidate) => candidate.ruleKey === opportunity?.ruleKey,
    );
    if (
      !rule ||
      mapOpportunityToAgencyService(rule, [
        {
          ...service,
          description: `${scope.deliverables}\n${scope.exclusions}`,
        },
      ]) !== service.id
    ) {
      throw new AppError(
        "Approved deliverables or exclusions do not support this selected finding. Reconcile the catalog scope or review the proposal manually.",
        422,
      );
    }
    // Free-form line notes are not silently promoted to extra commitments.
    if (
      line.description.trim() &&
      line.description.trim() !== scope.deliverables
    ) {
      throw new AppError(
        "Reconcile saved line scope with the approved catalog deliverables, or leave the line note empty and save before generation.",
        422,
      );
    }
    return {
      ...item,
      service: { ...item.service, approvedScope: null, contractScope: scope },
    };
  });
  assertAiSerializedInputWithinBudget("complete proposal AI payload", input);
  return input;
}
