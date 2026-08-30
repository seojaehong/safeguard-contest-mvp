import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function source(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

describe("security budget wiring", () => {
  it.each([
    "app/api/briefing/settings/route.ts",
    "app/api/education-records/route.ts",
    "app/api/workers/route.ts",
    "app/api/workpacks/route.ts",
    "app/api/workpacks/[id]/share-sessions/route.ts",
    "app/api/workpacks/[id]/read-confirmations/route.ts",
  ])("budgets authenticated JSON before parsing in %s", (relativePath) => {
    const text = source(relativePath);
    expect(text).toContain("enforceAuthenticatedJsonRequestBodyBudget");
    expect(text).toContain("bodyBudget.request.json()");
    expect(text.indexOf("enforceAuthenticatedJsonRequestBodyBudget(request")).toBeLessThan(
      text.indexOf("bodyBudget.request.json()"),
    );
  });

  it("admits public Ask callers before reading the JSON body", () => {
    const text = source("app/api/ask/route.ts");
    expect(text).toContain("checkPublicAskAdmission(request)");
    expect(text).toContain("admission: rateLimit");
    expect(text.indexOf("checkPublicAskAdmission(request)")).toBeLessThan(
      text.indexOf("enforcePublicJsonRequestBodyBudget("),
    );
    expect(text.indexOf("checkPublicAskAdmission(request)")).toBeLessThan(
      text.indexOf("bodyBudget.request.json()"),
    );
  });

  it.each([
    "lib/vertex/client.ts",
    "lib/photo-vision-analysis.ts",
    "lib/safety-reference-catalog.ts",
    "lib/public-distributed-rate-limit.ts",
    "lib/korean-law-mcp.ts",
  ])("uses the shared bounded reader for provider responses in %s", (relativePath) => {
    expect(source(relativePath)).toContain("readBoundedResponseText");
  });

  it("keeps export, MCP token, and workflow dispatch deadlines explicit", () => {
    expect(source("lib/document-export-budget.ts")).toContain("requestReadTimeoutMs");
    expect(source("app/api/mcp-tokens/route.ts")).toContain("MCP_TOKEN_BODY_READ_TIMEOUT");
    expect(source("app/api/workflow/dispatch/route.ts")).toContain("WORKFLOW_DISPATCH_BODY_READ_TIMEOUT");
  });
});
