import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createServiceAction, updateServiceAction } from "./actions";
import { createAgencyService, updateAgencyService } from "./data";
import { ServiceForm } from "./components/service-form";
import { makeCompleteProposalBuilder } from "../proposals/ai/complete-test-fixtures";
import { getCompleteProposalCopy } from "@/lib/i18n/complete-proposal";
vi.mock("./data", () => ({
  createAgencyService: vi.fn(),
  updateAgencyService: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(url);
  },
}));
beforeEach(() => vi.clearAllMocks());
function form(approve: boolean) {
  const fields = new FormData();
  const service = makeCompleteProposalBuilder().services[0];
  for (const [key, value] of Object.entries({
    name: service.name,
    description: service.description!,
    price: "500",
    currency: "USD",
    isActive: "true",
    ...service.approvedScope,
  }))
    fields.set(key, value);
  if (approve) fields.set("approveScope", "on");
  return fields;
}
describe("explicit reusable catalog scope approval", () => {
  it.each(["en", "ar"] as const)(
    "does not offer unpersistable scope approval on the old schema in %s",
    (locale) => {
      const html = renderToStaticMarkup(
        <ServiceForm action={vi.fn()} scopeAvailable={false} locale={locale} />,
      );
      expect(html).toContain(getCompleteProposalCopy(locale).scopeUnavailable);
      expect(html).not.toContain('name="approveScope"');
      expect(html).not.toContain('name="deliverables"');
      expect(html).toContain('name="price"');
    },
  );
  it("saves real scope only after explicit approval and reuses it when editing", async () => {
    const service = makeCompleteProposalBuilder().services[0];
    await expect(createServiceAction(form(true))).rejects.toThrow(
      "Service+created",
    );
    expect(createAgencyService).toHaveBeenCalledWith(
      expect.objectContaining({ approvedScope: service.approvedScope }),
    );
    const html = renderToStaticMarkup(
      <ServiceForm service={service} action={vi.fn()} />,
    );
    expect(html).toContain(service.approvedScope!.deliverables);
    expect(html).toContain('name="approveScope"');
    expect(
      html.match(/<input[^>]*name="approveScope"[^>]*>/)?.[0],
    ).not.toContain("checked");
  });
  it("does not promote catalog descriptions, alternative JSON or unchecked approval to commitments", async () => {
    const input = form(false);
    input.set("approvedScope", JSON.stringify({ deliverables: "Forged" }));
    await expect(updateServiceAction("owned-service", input)).rejects.toThrow(
      "Service+updated",
    );
    expect(updateAgencyService).toHaveBeenCalledWith(
      "owned-service",
      expect.objectContaining({ approvedScope: null }),
    );
  });
  it.each(["deliverables", "exclusions", "clientInputs", "completionChecks"])(
    "rejects missing approved %s instead of inserting partial scope",
    async (field) => {
      const input = form(true);
      input.delete(field);
      await expect(createServiceAction(input)).rejects.toThrow("error=");
      expect(createAgencyService).not.toHaveBeenCalled();
    },
  );
  it.each(["en", "ar"] as const)(
    "renders localized scope labels and explicit approval in %s",
    (locale) => {
      const copy = getCompleteProposalCopy(locale);
      const html = renderToStaticMarkup(
        <ServiceForm action={vi.fn()} locale={locale} />,
      );
      expect(html).toContain(copy.approveScope);
      expect(html).toContain(copy.deliverables);
      expect(html).toContain('maxLength="800"');
    },
  );
});
