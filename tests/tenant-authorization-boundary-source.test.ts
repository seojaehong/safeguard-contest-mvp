import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const rootDir = process.cwd();

function readSource(...segments: string[]): string {
  return fs.readFileSync(path.join(rootDir, ...segments), "utf8");
}

describe("tenant authorization boundary source contract", () => {
  it("requires immutable tenant identity for DB-backed scheduled briefing saves", () => {
    const route = readSource("app", "api", "briefing", "run", "route.ts");

    expect(route).toContain(".select(\"id,organization_id,name,briefing_question,briefing_email,organizations(owner_id)\")");
    expect(route).not.toContain("saveAskResponseAsWorkpack(supabaseClient, site.email");
    expect(route).toContain("site.tenantContext");
  });

  it("keeps env briefing fallback delivery-only instead of resolving arbitrary auth users", () => {
    const route = readSource("app", "api", "briefing", "run", "route.ts");

    expect(route).toContain("save: skipped (immutable tenant context unavailable)");
    expect(route).not.toContain("findUserIdByEmail");
  });

  it("constrains workpack archive site enrichment by authorized organization membership", () => {
    const route = readSource("app", "api", "workpacks", "route.ts");

    expect(route).toContain(".select(\"id,name,industry,region,organization_id\")");
    expect(route).toContain(".in(\"id\", siteIds)");
    expect(route).toContain(".in(\"organization_id\", organizationIds)");
  });
});
