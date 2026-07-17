import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

type SmokeReport = {
  requestContract: {
    authentication: string;
    siteId: string;
    organizationId: string;
  };
  storagePolicy: {
    current: string;
    fallback: string;
    sameSiteReingest: string;
    concurrentUniqueViolation: string;
  };
  failClosed: Record<string, string>;
  smokeExecution: {
    mode: string;
    credentialsLoaded: boolean;
    liveDatabaseMutationPerformed: boolean;
  };
};

describe("knowledge runtime smoke evidence", () => {
  it("reports the authenticated site-bound persistent fail-closed contract offline", () => {
    const root = process.cwd();
    const result = spawnSync(process.execPath, [path.join(root, "scripts", "knowledge_runtime_smoke.mjs")], {
      cwd: root,
      encoding: "utf8",
      env: { NODE_ENV: "test" },
    });

    expect(result.status, result.stderr).toBe(0);
    const stdoutReport = JSON.parse(result.stdout) as SmokeReport;
    const artifactReport = JSON.parse(readFileSync(
      path.join(root, "evaluation", "knowledge-runtime", "knowledge-api-smoke.json"),
      "utf8",
    )) as SmokeReport;

    for (const report of [stdoutReport, artifactReport]) {
      expect(report.requestContract).toEqual({
        authentication: "Authorization: Bearer <Supabase access token> required",
        siteId: "required and ownership-validated",
        organizationId: "derived from owned site; explicit value must match",
      });
      expect(report.storagePolicy).toEqual({
        current: "authenticated site-bound persistent ingest",
        fallback: "none",
        sameSiteReingest: "update raw event before creating regeneration run",
        concurrentUniqueViolation: "re-read; same-site update or cross-site 409",
      });
      expect(report.failClosed).toEqual({
        invalidRequest: "400",
        unauthenticated: "401",
        siteNotOwned: "404",
        tenantConflict: "409",
        storeUnconfigured: "503",
      });
      expect(report.smokeExecution).toEqual({
        mode: "offline-contract",
        credentialsLoaded: false,
        liveDatabaseMutationPerformed: false,
      });
    }
  });
});
