import type { NextConfig } from "next";

// Isolate the real-app acceptance server without changing auth or production.
const localAcceptance =
  process.env.NODE_ENV === "development" &&
  process.env.SCANVORO_LOCAL_ACCEPTANCE === "1";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  ...(localAcceptance
    ? {
        distDir: "dist/phase-3c-acceptance",
        typescript: { tsconfigPath: "dist/phase-3c-acceptance/tsconfig.json" },
      }
    : {}),
};

export default nextConfig;
