import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

import { describe, expect, it } from "vitest";

import { triggerAppErrorBoundary as triggerAuditAppErrorBoundary } from "@/lib/frontend-audit/AppBoundaryProbe.audit";
import { triggerAppErrorBoundary as triggerNormalAppErrorBoundary } from "@/lib/frontend-audit/AppBoundaryProbe.noop";

const root = process.cwd();
const scanner = path.join(root, "scripts", "frontend_audit_bundle_contract.mjs");
const cleanBuildRunner = path.join(root, "scripts", "frontend_audit_clean_build.mjs");
const globalMarker = "SafeClaw deterministic frontend audit global boundary probe";
const appErrorMarker = "SafeClaw deterministic frontend audit error boundary probe";
const appErrorConfirmationMarker = "SafeClaw deterministic frontend audit error boundary confirmed";
const evidenceDirectories = [
  "evaluation/frontend-audit-runner-port-v2-2026-07-11",
  "evaluation/release-audit-evidence-remediation-2026-07-12",
] as const;
const forbiddenLocalPath = /(?:[a-z]:[\\/]+users[\\/]|(?:^|[\\/])\.worktrees(?:[\\/]|$))/iu;

function currentCanonicalIdentity(): string {
  const moduleUrl = pathToFileURL(path.join(root, "scripts", "frontend_audit_source_identity.mjs")).href;
  const source = `import * as identity from ${JSON.stringify(moduleUrl)}; console.log(JSON.stringify(identity.canonicalFrontendSourceIdentity(${JSON.stringify(root)}).sourceIdentity));`;
  const result = spawnSync(process.execPath, ["--input-type=module", "--eval", source], {
    cwd: root,
    encoding: "utf8",
  });
  if (result.status !== 0) throw new Error(result.stderr || "Canonical frontend identity probe failed.");
  return JSON.parse(result.stdout) as string;
}

function currentCanonicalFiles(): string[] {
  const moduleUrl = pathToFileURL(path.join(root, "scripts", "frontend_audit_source_identity.mjs")).href;
  const source = `import * as identity from ${JSON.stringify(moduleUrl)}; console.log(JSON.stringify(identity.canonicalFrontendSourceIdentity(${JSON.stringify(root)}).files));`;
  const result = spawnSync(process.execPath, ["--input-type=module", "--eval", source], {
    cwd: root,
    encoding: "utf8",
  });
  if (result.status !== 0) throw new Error(result.stderr || "Canonical frontend file probe failed.");
  return JSON.parse(result.stdout) as string[];
}

function runCleanBuildPlan(mode: "normal" | "audit"): Record<string, unknown> {
  const moduleUrl = pathToFileURL(cleanBuildRunner).href;
  const source = `import * as build from ${JSON.stringify(moduleUrl)}; console.log(JSON.stringify(build.frontendAuditBuildPlan(${JSON.stringify(mode)})));`;
  const result = spawnSync(process.execPath, ["--input-type=module", "--eval", source], {
    cwd: root,
    encoding: "utf8",
  });
  if (result.status !== 0) throw new Error(result.stderr || "Frontend audit build-plan probe failed.");
  return JSON.parse(result.stdout) as Record<string, unknown>;
}

function runCleanBuildCommand(platform: "win32" | "linux"): Record<string, unknown> {
  const moduleUrl = pathToFileURL(cleanBuildRunner).href;
  const source = `import * as build from ${JSON.stringify(moduleUrl)}; console.log(JSON.stringify(build.frontendAuditBuildCommand(${JSON.stringify(platform)})));`;
  const result = spawnSync(process.execPath, ["--input-type=module", "--eval", source], {
    cwd: root,
    encoding: "utf8",
  });
  if (result.status !== 0) throw new Error(result.stderr || "Frontend audit build-command probe failed.");
  return JSON.parse(result.stdout) as Record<string, unknown>;
}

function runCleanBuildCleanup(directory: string, mode: "normal" | "audit"): Record<string, unknown> {
  const moduleUrl = pathToFileURL(cleanBuildRunner).href;
  const source = `import * as build from ${JSON.stringify(moduleUrl)}; console.log(JSON.stringify(build.cleanFrontendAuditBuild(${JSON.stringify(directory)}, ${JSON.stringify(mode)})));`;
  const result = spawnSync(process.execPath, ["--input-type=module", "--eval", source], {
    cwd: root,
    encoding: "utf8",
  });
  if (result.status !== 0) throw new Error(result.stderr || "Frontend audit clean-build probe failed.");
  return JSON.parse(result.stdout) as Record<string, unknown>;
}

function runScanner(
  mode: "normal" | "audit",
  sources: { staticSources?: string[]; serverSources?: string[] },
) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "safeclaw-audit-bundle-"));
  const chunkDirectory = path.join(directory, ".next", "static", "chunks", "app");
  const serverDirectory = path.join(directory, ".next", "server", "app");
  const outputPath = path.join(directory, "report.json");
  try {
    fs.mkdirSync(chunkDirectory, { recursive: true });
    fs.mkdirSync(serverDirectory, { recursive: true });
    for (const [index, source] of (sources.staticSources ?? []).entries()) {
      fs.writeFileSync(path.join(chunkDirectory, `chunk-${index}.js`), source, "utf8");
    }
    for (const [index, source] of (sources.serverSources ?? []).entries()) {
      fs.writeFileSync(path.join(serverDirectory, `server-${index}.js`), source, "utf8");
    }
    fs.writeFileSync(path.join(directory, ".next", "BUILD_ID"), "fixture-build-id\n", "utf8");
    const result = spawnSync(process.execPath, [scanner, "--mode", mode], {
      cwd: root,
      encoding: "utf8",
      env: {
        ...process.env,
        FRONTEND_AUDIT_BUILD_DIR: path.join(directory, ".next"),
        OUTPUT_PATH: outputPath,
      },
    });
    const report = JSON.parse(fs.readFileSync(outputPath, "utf8")) as Record<string, unknown>;
    return { status: result.status, report };
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

function listFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(absolutePath) : [absolutePath];
  });
}

function containsForbiddenLocalPath(filePath: string): boolean {
  const content = fs.readFileSync(filePath);
  return forbiddenLocalPath.test(content.toString("utf8"))
    || forbiddenLocalPath.test(content.toString("utf16le"));
}

describe("frontend audit bundle contract", () => {
  it("uses isolated clean output directories for sequential audit and normal builds", () => {
    expect(runCleanBuildPlan("audit")).toMatchObject({
      mode: "audit",
      buildDirectory: ".next",
      cleanBeforeBuild: true,
      auditEnabled: true,
    });
    expect(runCleanBuildPlan("normal")).toMatchObject({
      mode: "normal",
      buildDirectory: ".next",
      cleanBeforeBuild: true,
      auditEnabled: false,
    });
    expect(runCleanBuildCommand("win32")).toEqual({
      command: "cmd.exe",
      args: ["/d", "/s", "/c", "npm.cmd run build"],
    });

    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "safeclaw-clean-build-"));
    const staleServerFile = path.join(directory, ".next", "server", "app", "dryrun", "page.js");
    try {
      fs.mkdirSync(path.dirname(staleServerFile), { recursive: true });
      fs.writeFileSync(staleServerFile, appErrorMarker, "utf8");
      expect(runCleanBuildCleanup(directory, "normal")).toMatchObject({ cleanBeforeBuild: true });
      expect(fs.existsSync(path.join(directory, ".next"))).toBe(false);
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  it("includes both app boundary implementations in canonical source identity", () => {
    expect(currentCanonicalFiles()).toEqual(expect.arrayContaining([
      "lib/frontend-audit/AppBoundaryProbe.audit.ts",
      "lib/frontend-audit/AppBoundaryProbe.noop.ts",
      "scripts/frontend_audit_clean_build.mjs",
      "scripts/frontend_audit_runtime_probe.mjs",
    ]));
  });

  it("selects the app error boundary probe at build time and keeps the normal probe inert", () => {
    expect(() => triggerAuditAppErrorBoundary("error")).toThrow(
      "SafeClaw deterministic frontend audit error boundary probe",
    );
    expect(() => triggerAuditAppErrorBoundary(undefined)).not.toThrow();
    expect(() => triggerNormalAppErrorBoundary("error")).not.toThrow();

    const dryrunSource = fs.readFileSync(path.join(root, "app", "dryrun", "page.tsx"), "utf8");
    expect(dryrunSource).toContain('from "safeclaw-audit-app-error-escalation"');
    expect(dryrunSource).not.toContain("process.env.SAFECLAW_FRONTEND_AUDIT");
  });

  it("rejects audit code in normal chunks and requires it in audit chunks", () => {
    expect(runScanner("normal", { staticSources: ["console.log('normal');"] }).status).toBe(0);
    expect(runScanner("normal", { staticSources: [globalMarker] }).status).not.toBe(0);
    expect(runScanner("audit", { staticSources: ["console.log('normal');"] }).status).not.toBe(0);
    const audit = runScanner("audit", {
      staticSources: [globalMarker, appErrorConfirmationMarker],
      serverSources: [`${globalMarker}\n${appErrorMarker}`],
    });
    expect(audit.status).toBe(0);
    expect(audit.report).toMatchObject({
      buildId: "fixture-build-id",
      sourceSha: expect.stringMatching(/^[0-9a-f]{40}$/),
      sourceIdentity: currentCanonicalIdentity(),
      buildIdentity: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
  }, 15_000);

  it("emits a safe build directory without local usernames or worktree paths", () => {
    const audit = runScanner("audit", {
      staticSources: [globalMarker, appErrorConfirmationMarker],
      serverSources: [`${globalMarker}\n${appErrorMarker}`],
    });

    expect(audit.report.buildDirectory).toBe("<external-build-directory>");
    expect(JSON.stringify(audit.report)).not.toMatch(forbiddenLocalPath);
  }, 15_000);

  it("rejects audit builds with two marker chunks fail-closed", () => {
    const audit = runScanner("audit", {
      staticSources: [globalMarker, globalMarker, appErrorConfirmationMarker],
      serverSources: [`${globalMarker}\n${appErrorMarker}`],
    });

    expect(audit.status).not.toBe(0);
    expect(audit.report).toMatchObject({ markerCount: 2, status: "fail" });
  }, 15_000);

  it("rejects a normal build with stale audit code only in server output", () => {
    const normal = runScanner("normal", {
      staticSources: ["console.log('normal client');"],
      serverSources: [appErrorMarker],
    });

    expect(normal.status).not.toBe(0);
    expect(normal.report).toMatchObject({
      status: "fail",
      markers: {
        appError: { serverCount: 1, totalCount: 1 },
      },
    });
  }, 15_000);

  it("keeps every generated evidence artifact free of local absolute and worktree paths", () => {
    const scannedFiles = evidenceDirectories.flatMap((directory) => listFiles(path.join(root, directory)));
    const offenders = scannedFiles
      .filter(containsForbiddenLocalPath)
      .map((filePath) => path.relative(root, filePath).replaceAll("\\", "/"));

    expect(scannedFiles.length).toBeGreaterThan(0);
    expect(offenders).toEqual([]);
  });

  it("records complete typecheck command evidence in JSON, Markdown, and the generated log", () => {
    const evidenceRoot = path.join(root, evidenceDirectories[1]);
    const report = JSON.parse(fs.readFileSync(path.join(evidenceRoot, "report.json"), "utf8")) as {
      checks: Array<Record<string, unknown>>;
    };
    const typecheck = report.checks.find((check) => check.name === "typecheck");
    const markdown = fs.readFileSync(path.join(evidenceRoot, "report.md"), "utf8");
    const log = fs.readFileSync(path.join(evidenceRoot, "p2-final-typecheck.log"), "utf8");

    expect(typecheck).toMatchObject({
      status: "pass",
      command: "npm.cmd run typecheck",
      exitCode: 0,
      completionMarker: "typecheck-complete",
      log: "p2-final-typecheck.log",
    });
    expect(markdown).toContain("`npm.cmd run typecheck`");
    expect(markdown).toContain("Exit code: `0`");
    expect(markdown).toContain("Completion marker: `typecheck-complete`");
    expect(log).toContain("[audit-command] npm.cmd run typecheck");
    expect(log).toContain("[audit-exit-code] 0");
    expect(log).toContain("[audit-completion] typecheck-complete");
  });
});
