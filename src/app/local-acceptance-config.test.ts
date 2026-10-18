import { afterEach, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});
it.each(["production", "test"])(
  "cannot enable local acceptance config in %s",
  async (mode) => {
    vi.stubEnv("NODE_ENV", mode);
    vi.stubEnv("SCANVORO_LOCAL_ACCEPTANCE", "1");
    vi.resetModules();
    const { default: config } = await import("../../next.config");
    expect(config).toEqual({ reactStrictMode: true });
  },
);
it("isolates dev build/type output only, without changing auth or routes", async () => {
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("SCANVORO_LOCAL_ACCEPTANCE", "1");
  vi.resetModules();
  const { default: config } = await import("../../next.config");
  expect(config).toEqual({
    reactStrictMode: true,
    distDir: "dist/phase-3c-acceptance",
    typescript: { tsconfigPath: "dist/phase-3c-acceptance/tsconfig.json" },
  });
});
