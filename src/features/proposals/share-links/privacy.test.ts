import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const shareLinkDirectory = join(
  process.cwd(),
  "src/features/proposals/share-links",
);

describe("proposal share link privacy boundary", () => {
  it("does not log raw tokens or share URLs from share-link implementation files", () => {
    const source = readImplementationSource();

    expect(source).not.toMatch(/console\.(log|info|warn|error)/);
    expect(source).not.toContain("logger.");
  });

  it("does not perform arbitrary fetches or load external resources", () => {
    const source = readImplementationSource();

    expect(source).not.toMatch(/\bfetch\s*\(/);
    expect(source).not.toMatch(/\b(?:src|href)\s*=\s*["']https?:/);
    expect(source).not.toMatch(/\bhref\s*=/);
  });

  it("uses token-only public lookup without client-supplied ownership identifiers", () => {
    const dataSource = readFileSync(
      join(shareLinkDirectory, "data.ts"),
      "utf8",
    );

    expect(dataSource).toContain(".eq(\"token_hash\", hashShareToken(token))");
    expect(dataSource).not.toContain(".eq(\"agency_id\", token");
    expect(dataSource).not.toContain(".eq(\"proposal_id\", token");
    expect(dataSource).not.toContain(".eq(\"delivery_snapshot_id\", token");
  });

  it("keeps the public route from accepting query-parameter authorization", () => {
    const routeSource = readFileSync(
      join(
        process.cwd(),
        "src/app/proposals/shared/[token]/route.ts",
      ),
      "utf8",
    );

    expect(routeSource).not.toContain("searchParams");
    expect(routeSource).not.toContain("agencyId");
    expect(routeSource).not.toContain("proposalId");
    expect(routeSource).not.toContain("snapshotId");
  });
});

function readImplementationSource() {
  return readdirSync(shareLinkDirectory)
    .flatMap((entry) => collectTypeScriptFiles(join(shareLinkDirectory, entry)))
    .filter((file) => !file.endsWith(".test.ts"))
    .map((file) => readFileSync(file, "utf8"))
    .join("\n");
}

function collectTypeScriptFiles(path: string): string[] {
  const stat = statSync(path);

  if (stat.isDirectory()) {
    return readdirSync(path).flatMap((entry) =>
      collectTypeScriptFiles(join(path, entry)),
    );
  }

  if (path.endsWith(".ts") || path.endsWith(".tsx")) {
    return [path];
  }

  return [];
}
