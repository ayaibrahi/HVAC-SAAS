import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement, ReactNode } from "react";
import { ServiceForm } from "./components/service-form";
import { serviceStarterTemplates, starterScope } from "./starter-templates";
import { makeService } from "@/features/opportunities/test-fixtures";
import { mapOpportunityToAgencyService } from "@/features/opportunities/engine/map-services";
import { evaluateOpportunitiesForAudit } from "@/features/opportunities/engine/evaluate";
import {
  makeAudit,
  makeDetectedSignals,
  signal,
} from "@/features/opportunities/test-fixtures";
import { approvedServiceScopeSchema } from "@/lib/validation/service-scope";

const hooks = vi.hoisted(() => ({ index: 0, values: [] as unknown[] }));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useState: (initial: unknown) => {
    const index = hooks.index++;
    if (!(index in hooks.values)) hooks.values[index] = initial;
    return [
      hooks.values[index],
      (value: unknown) => {
        hooks.values[index] =
          typeof value === "function" ? value(hooks.values[index]) : value;
      },
    ];
  },
}));
type Element = ReactElement<{
  children?: ReactNode;
  name?: string;
  type?: string;
  value?: unknown;
  defaultValue?: unknown;
  checked?: boolean;
  onClick?: () => void;
  onChange?: (event: { target: { value: string } }) => void;
}>;
function elements(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!node || typeof node !== "object" || !("props" in node)) return [];
  const element = node as Element;
  return [element, ...elements(element.props.children)];
}
beforeEach(() => {
  hooks.index = 0;
  hooks.values = [];
});

describe("reviewable HVAC starter scopes", () => {
  it.each(serviceStarterTemplates)(
    "matches the intended finding for $id, without invented prices",
    (template) => {
      const scope = approvedServiceScopeSchema.parse(starterScope(template));
      expect([
        scope.exclusions,
        scope.clientInputs,
        scope.completionChecks,
      ]).toEqual(["", "", ""]);
      const signals = makeDetectedSignals();
      signals.contactConversion.ctaCount = signal(0);
      signals.hvac.hvacServicePages = signal({ detected: false, services: [] });
      signals.hvac.onlineBooking = signal(false);
      const findings = evaluateOpportunitiesForAudit({
        audit: makeAudit(signals),
        agencyServices: [],
      });
      const service = makeService({
        id: "starter",
        name: template.name,
        price: 500,
        approvedScope: scope,
      });
      const ruleKey =
        template.id === "lead-capture"
          ? "weak_lead_capture"
          : "hvac_service_visibility";
      const finding = findings.find((item) => item.ruleKey === ruleKey);
      const booking = findings.find(
        (item) => item.ruleKey === "missing_online_booking",
      );
      expect(finding).toBeDefined();
      expect(booking).toBeDefined();
      expect(mapOpportunityToAgencyService(finding!, [service])).toBe(
        service.id,
      );
      expect(mapOpportunityToAgencyService(booking!, [service])).toBeNull();
      expect(template).not.toHaveProperty("price");
      expect(service.price).toBe(500);
    },
  );
  it("requires an explicit template click, preserves an existing name/price, and revokes approval on scope edits", () => {
    const action = vi.fn();
    const service = makeService({
      id: "owned",
      name: "Existing agency offer",
      price: 70,
    });
    const render = () => {
      hooks.index = 0;
      return elements(ServiceForm({ action, service }));
    };
    let tree = render();
    expect(
      tree.find((e) => e.props.name === "approveScope")?.props.checked,
    ).toBe(false);
    tree.find((e) => e.type === "button" && e.props.onClick)?.props.onClick?.();
    tree = render();
    expect(tree.find((e) => e.props.name === "name")?.props.value).toBe(
      service.name,
    );
    expect(tree.find((e) => e.props.name === "price")?.props.defaultValue).toBe(
      70,
    );
    expect(tree.find((e) => e.props.name === "deliverables")?.props.value).toBe(
      serviceStarterTemplates[0].deliverables,
    );
    expect(
      tree.find((e) => e.props.name === "approveScope")?.props.checked,
    ).toBe(true);
    tree
      .find((e) => e.props.name === "deliverables")
      ?.props.onChange?.({ target: { value: "Edited scope" } });
    tree = render();
    expect(
      tree.find((e) => e.props.name === "approveScope")?.props.checked,
    ).toBe(false);
    expect(action).not.toHaveBeenCalled();
  });
  it("prefills a new service name and leaves persistence to Save", () => {
    const action = vi.fn();
    const render = () => {
      hooks.index = 0;
      return elements(ServiceForm({ action }));
    };
    const buttons = render().filter(
      (e) => e.type === "button" && e.props.onClick,
    );
    buttons[1].props.onClick?.();
    expect(render().find((e) => e.props.name === "name")?.props.value).toBe(
      serviceStarterTemplates[1].name,
    );
    expect(action).not.toHaveBeenCalled();
  });
});
