import type { ApprovedServiceScope } from "@/lib/validation/service-scope";

export const serviceStarterTemplates = [
  {
    id: "lead-capture",
    name: "Website Conversion & Lead Capture Optimization",
    deliverables:
      "Review and revise contact CTA wording, phone links and contact visibility on the agreed inspected page. Improve the agreed lead capture contact form or contact links using client-confirmed contact details. Work is limited to the selected page and agreed existing contact paths.",
  },
  {
    id: "service-navigation",
    name: "HVAC Service Coverage & Internal Navigation",
    deliverables:
      "Review core HVAC service links and service navigation on the agreed inspected page. Add or clarify internal links to client-confirmed existing Furnace, Heating, Air Conditioning and Maintenance pages where those services are actually offered. Check the agreed link destinations; new service pages and unconfirmed services are not included.",
  },
] as const;

export function starterScope(
  template: (typeof serviceStarterTemplates)[number],
): ApprovedServiceScope {
  return {
    deliverables: template.deliverables,
    exclusions: "",
    clientInputs: "",
    completionChecks: "",
  };
}
