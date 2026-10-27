import { afterEach, expect, it, vi } from "vitest";
import { assertRenderedAuditAvailable, renderedAuditsRequested } from "./availability";

vi.mock("server-only", () => ({}));
afterEach(() => vi.unstubAllEnvs());
it("defaults to static auditing and cannot enable an unverified worker by setting a flag", () => {
  vi.stubEnv("SCANVORO_RENDERED_AUDITS_ENABLED", "");
  expect(renderedAuditsRequested()).toBe(false);
  vi.stubEnv("SCANVORO_RENDERED_AUDITS_ENABLED", "1");
  expect(renderedAuditsRequested()).toBe(true);
  expect(() => assertRenderedAuditAvailable()).toThrow("not available yet");
});
