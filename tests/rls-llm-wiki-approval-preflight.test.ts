import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

const SCRIPT_PATH = resolve(process.cwd(), "scripts/rls_llm_wiki_approval_preflight.mjs");

function writeJson(root: string, relativePath: string, value: unknown): void {
  const path = join(root, relativePath);
  mkdirSync(resolve(path, ".."), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function writeText(root: string, relativePath: string, value: string): void {
  const path = join(root, relativePath);
  mkdirSync(resolve(path, ".."), { recursive: true });
  writeFileSync(path, value);
}

function fixtureRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "safeclaw-approval-preflight-"));
  execFileSync("git", ["init"], { cwd: root, stdio: "ignore" });
  execFileSync("git", ["config", "user.email", "codex@example.test"], { cwd: root, stdio: "ignore" });
  execFileSync("git", ["config", "user.name", "Codex"], { cwd: root, stdio: "ignore" });
  writeJson(root, "evaluation/supabase-rls-approval-2026-07-17/report.json", {
    status: "approval_required",
    launchIsolationProven: false,
    mutation: { database: false, schema: false, data: false },
    liveHeadEvidence: { policyCatalogVerified: false },
  });
  writeText(root, "evaluation/supabase-rls-approval-2026-07-17/approval-checklist.md", [
    "## A. Authoritative Target",
    "## B. Required Read-Only Catalog SQL",
    "pg_class",
    "pg_policies",
    "information_schema.role_table_grants",
    "storage.objects",
    "## C. Disposable Tenant A/B Contract",
    "## D. Service-Role And Storage Contract",
    "## E. Completion Gate",
  ].join("\n"));
  writeJson(root, "evaluation/llm-wiki-rls-approval-2026-07-17/report.json", {
    verdict: "red_approval_required",
    launchProven: false,
    databaseConnected: false,
    databaseMutationPerformed: false,
    migrationAdded: false,
    publicationPerformed: false,
  });
  writeText(root, "evaluation/llm-wiki-rls-approval-2026-07-17/report.md", "Until all blockers close, publication remains unavailable.\n");
  writeText(root, "evaluation/llm-wiki-rls-approval-2026-07-17/proposed-non-executable-publication-design.sql.txt", "-- non-executable design only, not a migration\n");
  writeJson(root, "evaluation/northstar-open-gates-current-2026-07-19/report.json", {
    gates: {
      supabase_rls_launch_isolation: { status: "approval_gated" },
      llm_wiki_publication: { status: "approval_gated" },
    },
  });
  writeText(root, "scripts/supabase_tenant_isolation_manifest.mjs", "export const TENANT_ISOLATION_MANIFEST = { version: 3, scenarios: [] };\n");
  writeText(root, "scripts/supabase_tenant_isolation_harness.mjs", "export const marker = 'blocked_unreviewed_live_adapter'; export const launch = 'launchProven: false';\n");
  execFileSync("git", ["add", "."], { cwd: root, stdio: "ignore" });
  execFileSync("git", ["commit", "-m", "fixture"], { cwd: root, stdio: "ignore" });
  return root;
}

function runPreflight(root: string, output = "evaluation/out"): { readonly report: Record<string, unknown>; readonly stdout: string; readonly status: number | null } {
  const result = spawnSync(process.execPath, [SCRIPT_PATH, "--root", root, "--output", output], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  if (result.error) throw result.error;
  const report = JSON.parse(readFileSync(join(root, output, "report.json"), "utf8")) as Record<string, unknown>;
  return { report, stdout: result.stdout, status: result.status };
}

describe("RLS / LLM Wiki approval preflight", () => {
  it("writes the current approval packet to the current dated evidence directory by default", () => {
    const root = fixtureRoot();
    const result = spawnSync(process.execPath, [SCRIPT_PATH, "--root", root], {
      cwd: process.cwd(),
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("rls-llm-wiki-approval-preflight-current-2026-07-20");
    const report = JSON.parse(
      readFileSync(join(root, "evaluation/rls-llm-wiki-approval-preflight-current-2026-07-20/report.json"), "utf8"),
    ) as Record<string, unknown>;
    expect(report.overall).toBe("approval_ready_open");
    expect(report.dbMutationPerformed).toBe(false);
    expect(report.networkOpened).toBe(false);
  });

  it("emits an approval-ready-open packet without claiming launch readiness", () => {
    const root = fixtureRoot();
    const { report, stdout, status } = runPreflight(root);

    expect(status).toBe(0);
    expect(stdout).toContain("approval_ready_open");
    expect(report.overall).toBe("approval_ready_open");
    expect(report.launchReadiness).toBe(false);
    expect(report.dbMutationPerformed).toBe(false);
    expect(report.networkOpened).toBe(false);
    expect(report.schemaMutationAuthorized).toBe(false);
    expect(report.approvalRequired).toBe(true);
    expect(report.failedCheckIds).toEqual([]);
    expect(report.sourceSha).toEqual(expect.stringMatching(/^[0-9a-f]{40}$/u));
    expect(report.artifactIntegrity).toEqual(expect.arrayContaining([
      expect.objectContaining({
        path: "evaluation/supabase-rls-approval-2026-07-17/report.json",
        bytes: expect.any(Number),
        sha256: expect.stringMatching(/^[0-9a-f]{64}$/u),
      }),
      expect.objectContaining({
        path: "evaluation/llm-wiki-rls-approval-2026-07-17/report.json",
        bytes: expect.any(Number),
        sha256: expect.stringMatching(/^[0-9a-f]{64}$/u),
      }),
      expect.objectContaining({
        path: "evaluation/northstar-open-gates-current-2026-07-19/report.json",
        bytes: expect.any(Number),
        sha256: expect.stringMatching(/^[0-9a-f]{64}$/u),
      }),
    ]));
    expect(JSON.stringify(report)).toContain("publication_ddl_rpc");
  });

  it("fails closed if a source packet claims RLS launch readiness", () => {
    const root = fixtureRoot();
    writeJson(root, "evaluation/supabase-rls-approval-2026-07-17/report.json", {
      status: "approval_required",
      launchIsolationProven: true,
      mutation: { database: false, schema: false, data: false },
      liveHeadEvidence: { policyCatalogVerified: false },
    });

    const { report, status } = runPreflight(root);
    expect(status).toBe(1);
    expect(report.overall).toBe("blocked_preflight_failed");
    const typedReport = report as {
      readonly failedCheckIds: readonly string[];
    };
    expect(typedReport.failedCheckIds).toContain("rls_launch_not_proven");
  });

  it("fails closed if the SQL companion moves under migrations or stops warning that it is non-executable", () => {
    const root = fixtureRoot();
    writeText(root, "evaluation/llm-wiki-rls-approval-2026-07-17/proposed-non-executable-publication-design.sql.txt", "create table unsafe_publication_attempts(id uuid);\n");

    const { report, status } = runPreflight(root);
    expect(status).toBe(1);
    expect(report.overall).toBe("blocked_preflight_failed");
    const typedReport = report as {
      readonly failedCheckIds: readonly string[];
    };
    expect(typedReport.failedCheckIds).toEqual(["wiki_sql_design_non_executable"]);
  });

  it("prefers the current northstar open-gate packet over the legacy dated packet", () => {
    const root = fixtureRoot();
    writeJson(root, "evaluation/northstar-open-gates-current-2026-07-19/report.json", {
      gates: {
        supabase_rls_launch_isolation: { status: "proven" },
        llm_wiki_publication: { status: "proven" },
      },
    });
    writeJson(root, "evaluation/northstar-open-gates-current/report.json", {
      gates: [
        { id: "supabase_rls_launch_isolation", state: "approval_gated" },
        { id: "llm_wiki_publication", state: "approval_gated" },
      ],
    });

    const { report, status } = runPreflight(root);

    expect(status).toBe(0);
    expect(report.overall).toBe("approval_ready_open");
    expect(report.inputs).toMatchObject({
      northstarReport: "evaluation/northstar-open-gates-current/report.json",
    });
  });
});
