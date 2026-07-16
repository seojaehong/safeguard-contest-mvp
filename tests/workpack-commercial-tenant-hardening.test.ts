import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

function count(sourceText: string, fragment: string): number {
  return sourceText.split(fragment).length - 1;
}

function expectTupleFilters(
  sourceText: string,
  input: { organization: number; site: number; workpack: number }
): void {
  expect(count(sourceText, '.eq("organization_id",')).toBeGreaterThanOrEqual(input.organization);
  expect(count(sourceText, '.eq("workpack_id",')).toBeGreaterThanOrEqual(input.workpack);
  expect(count(sourceText, '.is("site_id", null)')).toBeGreaterThanOrEqual(input.site);
  expect(count(sourceText, '.eq("site_id",')).toBeGreaterThanOrEqual(input.site);
}

describe("commercial workpack service-role tenant hardening", () => {
  it("scopes worker and active share-session reads to their authoritative tenant", () => {
    const store = source("lib/workpack-commercial-store.ts");

    expect(count(store, '.eq("organization_id", input.organizationId)')).toBeGreaterThanOrEqual(2);
    expect(count(store, '.is("site_id", null)')).toBeGreaterThanOrEqual(2);
    expect(count(store, '.eq("site_id", input.siteId)')).toBeGreaterThanOrEqual(2);
    expect(store).toContain('.eq("workpack_id", input.workpackId)');
  });

  it("scopes share-session and confirmation list reads by the full tenant tuple", () => {
    expectTupleFilters(source("app/api/workpacks/[id]/share-sessions/route.ts"), {
      organization: 2,
      site: 2,
      workpack: 2
    });
  });

  it("scopes confirmation reads and idempotency checks by the full tenant tuple", () => {
    expectTupleFilters(source("app/api/workpacks/[id]/read-confirmations/route.ts"), {
      organization: 2,
      site: 2,
      workpack: 2
    });
  });

  it("scopes improvement reads and failed-write cleanup by the full tenant tuple", () => {
    expectTupleFilters(source("app/api/workpacks/[id]/improvements/route.ts"), {
      organization: 2,
      site: 2,
      workpack: 2
    });
  });

  it("scopes every learning-export child read by the full tenant tuple", () => {
    expectTupleFilters(source("app/api/workpacks/[id]/learning-export/route.ts"), {
      organization: 2,
      site: 2,
      workpack: 2
    });
  });
});
