import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  REPORTS_WAVE1_BUILD_MANIFEST_FILENAME,
  REPORTS_WAVE1_EVIDENCE_RELATIVE_DIR,
  REPORTS_WAVE1_PUBLISHER,
  cleanupReportsWave1OutputDirectory,
  getReportsWave1ProductIdentity,
  resolveReportsWave1OutputDirectory,
  validateReportsWave1BuildManifest,
  writeReportsWave1BuildManifest,
} from "@/scripts/reports_wave1_publish_support.mjs";

const root = process.cwd();
// Fresh Git fixtures and CRLF clones exceed Vitest's 5s default on Windows.
const WINDOWS_GIT_PROVENANCE_TIMEOUT_MS = 30_000;

function createFixtureBuild(rootDirectory: string): string {
  const buildDirectory = path.join(rootDirectory, ".next");
  fs.mkdirSync(path.join(buildDirectory, "server", "app"), { recursive: true });
  fs.mkdirSync(path.join(buildDirectory, "static", "chunks", "app"), { recursive: true });
  fs.writeFileSync(path.join(buildDirectory, "BUILD_ID"), "reports-wave1-fixture\n", "utf8");
  fs.writeFileSync(path.join(buildDirectory, "app-build-manifest.json"), "{\"pages\":[]}\n", "utf8");
  fs.writeFileSync(path.join(buildDirectory, "build-manifest.json"), "{\"rootMainFiles\":[]}\n", "utf8");
  fs.writeFileSync(path.join(buildDirectory, "prerender-manifest.json"), "{\"version\":4}\n", "utf8");
  fs.writeFileSync(path.join(buildDirectory, "required-server-files.json"), "{\"version\":1}\n", "utf8");
  fs.writeFileSync(path.join(buildDirectory, "routes-manifest.json"), "{\"version\":3}\n", "utf8");
  fs.writeFileSync(path.join(buildDirectory, "server", "app", "reports.js"), "module.exports = 'reports';\n", "utf8");
  fs.writeFileSync(path.join(buildDirectory, "static", "chunks", "app", "reports.js"), "console.log('reports');\n", "utf8");
  return buildDirectory;
}

function runGit(rootDirectory: string, args: string[]): string {
  return execFileSync("git", args, {
    cwd: rootDirectory,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function writeFixtureFile(rootDirectory: string, relativePath: string, content: string): void {
  const filePath = path.join(rootDirectory, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
}

function commitFixture(rootDirectory: string, message: string, relativePaths = ["."]): string {
  runGit(rootDirectory, ["add", "--", ...relativePaths]);
  runGit(rootDirectory, ["commit", "--quiet", "-m", message]);
  return runGit(rootDirectory, ["rev-parse", "HEAD"]);
}

function createReportsGitFixture(prefix = "safeclaw-wave1-git-"): string {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  runGit(fixtureRoot, ["init", "--quiet"]);
  runGit(fixtureRoot, ["config", "user.email", "reports-wave1@example.test"]);
  runGit(fixtureRoot, ["config", "user.name", "Reports Wave 1 Test"]);
  runGit(fixtureRoot, ["config", "core.autocrlf", "false"]);

  const files: Record<string, string> = {
    ".gitignore": ".next/\n",
    "app/error.tsx": "export default function ErrorPage() { return null; }\n",
    "app/global-error.tsx": "export default function GlobalErrorPage() { return null; }\n",
    "app/globals.css": ":root { color: black; }\n",
    "app/layout.tsx": [
      "import \"./globals.css\";",
      "import { GlobalBoundaryProbe } from \"safeclaw-audit-error-escalation\";",
      "export default function Layout() { return GlobalBoundaryProbe(); }",
      "",
    ].join("\n"),
    "app/not-found.tsx": "export default function NotFoundPage() { return null; }\n",
    "app/api/workpacks/[id]/route.ts": "export async function GET() { return Response.json({ ok: true }); }\n",
    "app/reports/page.tsx": [
      "import { ReportsDownloadCenter } from \"@/components/ReportsDownloadCenter\";",
      "import { SafeClawModuleShell } from \"@/components/SafeClawModuleShell\";",
      "export default function ReportsPage() { return ReportsDownloadCenter() ?? SafeClawModuleShell(); }",
      "",
    ].join("\n"),
    "components/ReportsDownloadCenter.tsx": [
      "import { buildSampleWorkpack } from \"@/lib/sample-workpack\";",
      "export function ReportsDownloadCenter() {",
      "  void fetch(`/api/workpacks/${encodeURIComponent(\"fixture\")}`);",
      "  return buildSampleWorkpack();",
      "}",
      "",
    ].join("\n"),
    "components/SafeClawModuleShell.tsx": [
      "import { getModuleNavModel } from \"@/lib/module-navigation\";",
      "export function SafeClawModuleShell() { return getModuleNavModel() ?? <img src=\"/brand/ClawMark.svg\" alt=\"\" />; }",
      "",
    ].join("\n"),
    "lib/frontend-audit/GlobalBoundaryProbe.audit.tsx":
      "export function GlobalBoundaryProbe() { return null; }\n",
    "lib/frontend-audit/GlobalBoundaryProbe.noop.tsx":
      "export function GlobalBoundaryProbe() { return null; }\n",
    "lib/module-navigation.ts": "export function getModuleNavModel() { return null; }\n",
    "lib/sample-workpack.ts": "export function buildSampleWorkpack() { return \"sample-v1\"; }\n",
    "next.config.mjs": "export default {};\n",
    "public/brand/ClawMark.svg": "<svg xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M0 0h1v1H0z\" /></svg>\n",
    "scripts/publish_reports_wave1_evidence.mjs": "console.log(\"publish fixture\");\n",
    "scripts/reports_wave1_publish_support.mjs": "export const fixture = true;\n",
  };
  for (const [relativePath, content] of Object.entries(files)) {
    writeFixtureFile(fixtureRoot, relativePath, content);
  }
  commitFixture(fixtureRoot, "test: add reports fixture");
  return fixtureRoot;
}

describe("Reports Wave 1 publish support", () => {
  it("covers the complete Reports runtime dependency graph", () => {
    const identity = getReportsWave1ProductIdentity(root);

    expect(identity.sourceFiles).toEqual(expect.arrayContaining([
      "app/layout.tsx",
      "app/globals.css",
      "app/reports/page.tsx",
      "components/ReportsDownloadCenter.tsx",
      "components/SafeClawModuleShell.tsx",
      "lib/current-workpack.ts",
      "lib/operation-improvement-history.ts",
      "lib/reporting-downloads.ts",
      "lib/sample-workpack.ts",
      "lib/module-navigation.ts",
      "app/api/workpacks/[id]/route.ts",
      "public/brand/ClawMark.svg",
    ]));
  });

  it("anchors product provenance to a commit containing the publisher scripts", () => {
    const identity = getReportsWave1ProductIdentity(root);

    for (const publisherPath of [
      "scripts/publish_reports_wave1_evidence.mjs",
      "scripts/reports_wave1_publish_support.mjs",
    ]) {
      expect(() => runGit(root, ["cat-file", "-e", `${identity.sourceSha}:${publisherPath}`])).not.toThrow();
    }
  }, WINDOWS_GIT_PROVENANCE_TIMEOUT_MS);

  it("produces the same identity for clean LF and CRLF checkouts", () => {
    const sourceRoot = createReportsGitFixture("safeclaw-wave1-eol-source-");
    const cloneRoot = fs.mkdtempSync(path.join(os.tmpdir(), "safeclaw-wave1-eol-clones-"));
    const lfRoot = path.join(cloneRoot, "lf");
    const crlfRoot = path.join(cloneRoot, "crlf");

    try {
      execFileSync("git", ["clone", "--quiet", "-c", "core.autocrlf=false", sourceRoot, lfRoot]);
      execFileSync("git", ["clone", "--quiet", "-c", "core.autocrlf=true", sourceRoot, crlfRoot]);

      expect(runGit(lfRoot, ["status", "--porcelain"])).toBe("");
      expect(runGit(crlfRoot, ["status", "--porcelain"])).toBe("");
      expect(fs.readFileSync(path.join(lfRoot, "app", "reports", "page.tsx"), "utf8")).not.toContain("\r\n");
      expect(fs.readFileSync(path.join(crlfRoot, "app", "reports", "page.tsx"), "utf8")).toContain("\r\n");

      const lfIdentity = getReportsWave1ProductIdentity(lfRoot);
      const crlfIdentity = getReportsWave1ProductIdentity(crlfRoot);
      expect(crlfIdentity).toEqual(lfIdentity);
    } finally {
      fs.rmSync(sourceRoot, { recursive: true, force: true });
      fs.rmSync(cloneRoot, { recursive: true, force: true });
    }
  }, WINDOWS_GIT_PROVENANCE_TIMEOUT_MS);

  it.each([
    {
      state: "dirty",
      statusMarker: " M lib/sample-workpack.ts",
      prepare: (fixtureRoot: string) => {
        writeFixtureFile(fixtureRoot, "lib/sample-workpack.ts", "export const sample = \"dirty\";\n");
      },
    },
    {
      state: "staged",
      statusMarker: "M  lib/sample-workpack.ts",
      prepare: (fixtureRoot: string) => {
        writeFixtureFile(fixtureRoot, "lib/sample-workpack.ts", "export const sample = \"staged\";\n");
        runGit(fixtureRoot, ["add", "--", "lib/sample-workpack.ts"]);
      },
    },
    {
      state: "untracked",
      statusMarker: "?? lib/untracked-report-dependency.ts",
      prepare: (fixtureRoot: string) => {
        writeFixtureFile(fixtureRoot, "lib/untracked-report-dependency.ts", "export const sample = \"untracked\";\n");
      },
    },
  ])("fails closed when an identity file is $state", ({ state, statusMarker, prepare }) => {
    const fixtureRoot = createReportsGitFixture(`safeclaw-wave1-${state}-`);
    const identityFiles = state === "untracked"
      ? ["lib/untracked-report-dependency.ts"]
      : ["lib/sample-workpack.ts"];

    try {
      prepare(fixtureRoot);
      expect(() => getReportsWave1ProductIdentity(fixtureRoot, identityFiles)).toThrow(
        new RegExp(`Reports Wave 1 identity files are not clean:[\\s\\S]*${statusMarker.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}`, "u"),
      );
    } finally {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("rejects stale builds after isolated dependency, public asset, and API route commits", () => {
    const fixtureRoot = createReportsGitFixture("safeclaw-wave1-stale-dependency-");
    const buildDirectory = createFixtureBuild(fixtureRoot);
    const manifestPath = path.join(fixtureRoot, REPORTS_WAVE1_BUILD_MANIFEST_FILENAME);
    const mutations = [
      {
        relativePath: "lib/sample-workpack.ts",
        content: "export function buildSampleWorkpack() { return \"sample-v2\"; }\n",
      },
      {
        relativePath: "public/brand/ClawMark.svg",
        content: "<svg xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M0 0h2v2H0z\" /></svg>\n",
      },
      {
        relativePath: "app/api/workpacks/[id]/route.ts",
        content: "export async function GET() { return Response.json({ ok: false }, { status: 500 }); }\n",
      },
    ] as const;

    try {
      for (const mutation of mutations) {
        writeReportsWave1BuildManifest({
          root: fixtureRoot,
          buildDirectory,
          outputPath: manifestPath,
        });
        writeFixtureFile(fixtureRoot, mutation.relativePath, mutation.content);
        commitFixture(fixtureRoot, `test: mutate ${mutation.relativePath}`, [mutation.relativePath]);

        expect(() => validateReportsWave1BuildManifest({
          root: fixtureRoot,
          manifestPath,
          expectedBuildDirectory: buildDirectory,
        }), mutation.relativePath).toThrow(/source SHA mismatch|source identity mismatch/u);
      }
    } finally {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
  }, WINDOWS_GIT_PROVENANCE_TIMEOUT_MS);

  it("defaults browser evidence output to unique temp directories and publishes only explicitly", () => {
    const first = resolveReportsWave1OutputDirectory({ root, env: {} });
    const second = resolveReportsWave1OutputDirectory({ root, env: {} });
    const published = resolveReportsWave1OutputDirectory({
      root,
      env: { SAFECLAW_REPORTS_WAVE1_PUBLISH: "1" },
    });

    expect(first.publish).toBe(false);
    expect(first.cleanup).toBe(true);
    expect(second.publish).toBe(false);
    expect(second.cleanup).toBe(true);
    expect(first.directory).not.toBe(second.directory);
    expect(path.dirname(first.directory)).toBe(os.tmpdir());
    expect(path.dirname(second.directory)).toBe(os.tmpdir());
    expect(fs.existsSync(first.directory)).toBe(true);
    expect(fs.existsSync(second.directory)).toBe(true);

    expect(published).toEqual({
      directory: path.join(root, REPORTS_WAVE1_EVIDENCE_RELATIVE_DIR),
      publish: true,
      cleanup: false,
    });

    fs.rmSync(first.directory, { recursive: true, force: true });
    fs.rmSync(second.directory, { recursive: true, force: true });
  });

  it("cleans routine Reports output while preserving explicit publish output", () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "safeclaw-wave1-output-cleanup-"));
    const routine = resolveReportsWave1OutputDirectory({ root, env: {}, tempRoot });
    const published = resolveReportsWave1OutputDirectory({
      root: tempRoot,
      env: { SAFECLAW_REPORTS_WAVE1_PUBLISH: "1" },
    });

    try {
      writeFixtureFile(routine.directory, "routine.txt", "remove me\n");
      writeFixtureFile(published.directory, "published.txt", "preserve me\n");

      cleanupReportsWave1OutputDirectory(routine, { tempRoot });
      cleanupReportsWave1OutputDirectory(published, { tempRoot });

      expect(fs.existsSync(routine.directory)).toBe(false);
      expect(fs.existsSync(path.join(published.directory, "published.txt"))).toBe(true);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it("documents a hermetic PowerShell static-audit command", () => {
    const evidenceDirectory = path.join(root, REPORTS_WAVE1_EVIDENCE_RELATIVE_DIR);
    const report = JSON.parse(fs.readFileSync(path.join(evidenceDirectory, "report.json"), "utf8")) as {
      freshChecks?: Array<{ name?: unknown; command?: unknown }>;
    };
    const staticCheck = report.freshChecks?.find((check) => check.name === "fresh-static-audit");
    if (!staticCheck || !Array.isArray(staticCheck.command)
      || !staticCheck.command.every((line) => typeof line === "string")) {
      throw new Error("Reports Wave 1 report is missing the static-audit command");
    }
    const command = staticCheck.command.join("\n");
    const markdown = fs.readFileSync(path.join(evidenceDirectory, "report.md"), "utf8");

    for (const documentedCommand of [command, markdown]) {
      expect(documentedCommand).toContain("[System.IO.Path]::GetRandomFileName()");
      expect(documentedCommand).toContain("try {");
      expect(documentedCommand).toContain("} finally {");
      expect(documentedCommand).toContain("Remove-Item -LiteralPath $tempJson");
      expect(documentedCommand).not.toContain("safeclaw-frontend-static-audit-20260712.json");
    }
  });

  it("writes explicit build manifests and rejects stale or mismatched production builds", () => {
    const tempRoot = createReportsGitFixture("safeclaw-wave1-manifest-");
    const buildDirectory = createFixtureBuild(tempRoot);
    const manifestPath = path.join(tempRoot, REPORTS_WAVE1_BUILD_MANIFEST_FILENAME);
    const productIdentity = getReportsWave1ProductIdentity(tempRoot);

    const manifest = writeReportsWave1BuildManifest({
      root: tempRoot,
      buildDirectory,
      outputPath: manifestPath,
      publisherCommand: "node .\\scripts\\publish_reports_wave1_evidence.mjs",
      productIdentity,
    });

    expect(manifest.publisher).toBe(REPORTS_WAVE1_PUBLISHER);
    expect(manifest.productSourceSha).toBe(productIdentity.sourceSha);
    expect(manifest.buildDirectory).toBe(".next");

    expect(
      validateReportsWave1BuildManifest({
        root: tempRoot,
        manifestPath,
        expectedBuildDirectory: buildDirectory,
        productIdentity,
      }),
    ).toMatchObject({
      publisher: REPORTS_WAVE1_PUBLISHER,
      productSourceSha: productIdentity.sourceSha,
      buildId: "reports-wave1-fixture",
    });

    fs.writeFileSync(path.join(buildDirectory, "static", "chunks", "app", "reports.js"), "console.log('stale');\n", "utf8");
    expect(() => validateReportsWave1BuildManifest({
      root: tempRoot,
      manifestPath,
      expectedBuildDirectory: buildDirectory,
      productIdentity,
    })).toThrow(/build identity mismatch/u);

    fs.writeFileSync(path.join(buildDirectory, "static", "chunks", "app", "reports.js"), "console.log('reports');\n", "utf8");
    expect(() => validateReportsWave1BuildManifest({
      root: tempRoot,
      manifestPath,
      expectedBuildDirectory: buildDirectory,
      productIdentity: {
        ...productIdentity,
        sourceSha: "2".repeat(40),
      },
    })).toThrow(/source SHA mismatch/u);

    fs.rmSync(tempRoot, { recursive: true, force: true });
  }, WINDOWS_GIT_PROVENANCE_TIMEOUT_MS);
});
