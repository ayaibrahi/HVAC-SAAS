import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { runAuditForProspect } from "./run-audit";
import { safeFetchHtml } from "./analyzer/safe-fetch";
import {
  createPendingAudit,
  markAuditCompleted,
  markAuditFailed,
  markAuditRunning,
} from "./data";
import type { Prospect } from "@/domain/prospects/types";

vi.mock("server-only", () => ({}));
vi.mock("./data", () => ({
  createPendingAudit: vi.fn(),
  markAuditCompleted: vi.fn(),
  markAuditFailed: vi.fn(),
  markAuditRunning: vi.fn(),
}));
vi.mock("./analyzer/safe-fetch", () => ({ safeFetchHtml: vi.fn() }));
const prospect: Prospect = {
  id: "prospect",
  agencyId: "agency",
  businessName: "TEST ONLY",
  websiteUrl: "https://example.com/",
  contactName: null,
  contactEmail: null,
  notes: null,
  createdAt: "",
  updatedAt: "",
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createPendingAudit).mockResolvedValue({ id: "audit" } as Awaited<
    ReturnType<typeof createPendingAudit>
  >);
});
describe("audit verification lifecycle", () => {
  it("denies a foreign prospect before pending writes or worker creation", async () => {
    const createRenderedWorker = vi.fn();
    await expect(runAuditForProspect({ agencyId: "other", prospect }, { createRenderedWorker })).rejects.toThrow();
    expect(createPendingAudit).not.toHaveBeenCalled();
    expect(createRenderedWorker).not.toHaveBeenCalled();
    expect(safeFetchHtml).not.toHaveBeenCalled();
  });
  it("persists the rendered schema through the existing tenant-scoped lifecycle", async () => {
    const capture = vi.fn(async ({ url, viewport }: { url: string; viewport: string }) => JSON.stringify({
      requestedUrl: url, finalUrl: url, viewport, status: "observed", reasons: [], httpStatus: 200, elapsedMs: 1,
      document: { title: "Heating and cooling", headings: [], links: [], buttons: [], forms: [], truncated: false,
        text: "Our experienced technicians provide heating and cooling repair for homeowners. We explain the available options and help customers choose an appropriate repair or replacement. Explore the service information and contact our team to discuss your needs and arrange an appointment at a convenient time." },
    }));
    const close = vi.fn(async () => {});
    await runAuditForProspect({ agencyId: "agency", prospect }, { createRenderedWorker: async () => ({ capture, close }) });
    expect(capture).toHaveBeenCalledTimes(2);
    expect(close).toHaveBeenCalledOnce();
    expect(markAuditCompleted).toHaveBeenCalledWith(expect.objectContaining({ agencyId: "agency", auditId: "audit", signalSchemaVersion: "2.0.0", normalizedSignals: expect.objectContaining({ renderedAudit: expect.objectContaining({ completeSite: false }) }) }));
    expect(safeFetchHtml).not.toHaveBeenCalled();
    expect(markAuditFailed).not.toHaveBeenCalled();
  });
  it.each(["shell", "challenge", "access-notice", "representative"])(
    "persists a safe %s result without any opportunity generation",
    async (name) => {
      const html = readFileSync(
        new URL(`./analyzer/fixtures/${name}.html`, import.meta.url),
        "utf8",
      );
      vi.mocked(safeFetchHtml).mockResolvedValue({
        html,
        status: 200,
        analyzedUrl: prospect.websiteUrl,
        finalUrl: prospect.websiteUrl,
        contentType: "text/html",
        responseTimeMs: 1,
        responseSizeBytes: html.length,
        redirectCount: 0,
      });
      const operation = runAuditForProspect({ agencyId: "agency", prospect });
      if (name === "representative") {
        await operation;
        expect(markAuditCompleted).toHaveBeenCalledOnce();
        expect(markAuditFailed).not.toHaveBeenCalled();
      } else {
        await expect(operation).rejects.toThrow("could not reliably inspect");
        expect(markAuditCompleted).not.toHaveBeenCalled();
        expect(markAuditFailed).toHaveBeenCalledWith(
          expect.objectContaining({
            auditId: "audit",
            agencyId: "agency",
            errorCode: "CONTENT_NOT_VERIFIABLE",
            normalizedSignals: expect.objectContaining({
              quality: expect.objectContaining({ status: "insufficient" }),
            }),
          }),
        );
      }
      expect(markAuditRunning).toHaveBeenCalledOnce();
    },
  );
});
