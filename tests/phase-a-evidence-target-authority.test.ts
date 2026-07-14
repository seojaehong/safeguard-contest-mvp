import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";

import { describe, expect, it } from "vitest";

const AUTHORITY_REF = "refs/remotes/origin/feat/phase-a-evidence-integration";
const MINIMUM_AUTHORITY = "67d2c9e28e7278c58f46b46c2512c7133d88d1d3";
const HISTORICAL_REJECTED_TARGET = "b3762867d380f20faee2a83a17354dc61557ce12";
const V4_REJECTED_TARGET = "cc9f5af297950b73b53a9ab4018bdc143830c499";
const SUPERSEDED_AUTHORITY_TARGET = "f45bba17bcce0d8ebb2690f82d014dbe42ae8191";
const SHARE_REVIEW_HEAD = "22de1180d69263f7c08ac0ed0cfda0894e2db7f5";
const SHARE_BASE_PRODUCT_HEAD = "fc2bd1783fcc413981306f689d67bb6c659a985e";
const SHARE_PRODUCT_HEAD = "7141baac3e0abca146ef6c110093c1c0643760a2";
const EXPECTED_MAIN_CONFLICT_PATHS = ["tests/reports-download-center.test.ts"];
const EXPECTED_SHARE_CONFLICT_PATHS = [
  "app/api/workpacks/[id]/route.ts",
  "components/FieldOperationsWorkspace.tsx",
  "components/SafeGuardCommandCenter.tsx",
  "lib/workpack-commercial-store.ts",
  "tests/workpack-generation-evidence-route.test.ts",
  "tests/workpack-share-authority-routes.test.ts",
];
const EVIDENCE_DIRECTORY = path.resolve(
  "evaluation/phase-a-ontology-evidence-chains-2026-07-13",
);
const REPOSITORY_ROOT = path.resolve(".");

type TargetHistoryEntry = {
  sha: string;
  status: string;
};

type MergeTreeInspection = {
  status: 0 | 1;
  diagnosticTreeOid: string;
  conflictPaths: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readJson(fileName: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(
    fs.readFileSync(path.join(EVIDENCE_DIRECTORY, fileName), "utf8"),
  );
  if (!isRecord(parsed)) throw new Error(`${fileName} must contain a JSON object`);
  return parsed;
}

function git(...args: string[]): string {
  return execFileSync("git", args, {
    cwd: REPOSITORY_ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function gitIsAncestor(ancestor: string, descendant: string): boolean {
  const result = spawnSync("git", ["merge-base", "--is-ancestor", ancestor, descendant], {
    cwd: REPOSITORY_ROOT,
    stdio: "ignore",
  });
  if (result.status !== 0 && result.status !== 1) {
    throw new Error(`git merge-base failed with status ${String(result.status)}`);
  }
  return result.status === 0;
}

function inspectMergeTree(left: string, right: string): MergeTreeInspection {
  const result = spawnSync("git", ["merge-tree", "--write-tree", left, right], {
    cwd: REPOSITORY_ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0 && result.status !== 1) {
    throw new Error(`git merge-tree failed with status ${String(result.status)}: ${result.stderr}`);
  }
  const output = result.stdout.trim();
  const [diagnosticTreeOid = ""] = output.split(/\r?\n/);
  if (!/^[a-f0-9]{40}$/.test(diagnosticTreeOid)) {
    throw new Error("git merge-tree did not return a diagnostic tree OID");
  }
  const conflictPaths = Array.from(new Set(
    Array.from(
      output.matchAll(/^\d{6}\s+[a-f0-9]{40}\s+[123]\t(.+)$/gm),
      (match) => match[1].replace(/\r$/, ""),
    ),
  )).sort();
  const status: 0 | 1 = result.status === 0 ? 0 : 1;
  return {
    status,
    diagnosticTreeOid,
    conflictPaths,
  };
}

function requireRecord(container: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = container[key];
  if (!isRecord(value)) throw new Error(`${key} object is required`);
  return value;
}

function readString(container: Record<string, unknown>, key: string): string {
  const value = container[key];
  if (typeof value !== "string") throw new Error(`${key} string is required`);
  return value;
}

function readArtifactEntries(
  document: Record<string, unknown>,
  key: string,
): Array<Record<string, unknown>> {
  const value = document[key];
  if (!Array.isArray(value) || !value.every(isRecord)) {
    throw new Error(`${key} artifact array is required`);
  }
  return value;
}

function readStringArray(container: Record<string, unknown>, key: string): string[] {
  const value = container[key];
  if (!Array.isArray(value) || !value.every((entry) => typeof entry === "string")) {
    throw new Error(`${key} string array is required`);
  }
  return value;
}

function normalizedLines(value: string): string[] {
  return value.split(/\r?\n/).map((entry) => entry.trim()).filter(Boolean).sort();
}

const AUTHORITATIVE_TARGET = git("rev-parse", AUTHORITY_REF);
const AUTHORITATIVE_TARGET_TREE = git("rev-parse", `${AUTHORITATIVE_TARGET}^{tree}`);

function collectCurrentTargetViolations(
  value: unknown,
  currentPath = "$",
): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => (
      collectCurrentTargetViolations(entry, `${currentPath}[${index}]`)
    ));
  }
  if (!isRecord(value)) return [];

  return Object.entries(value).flatMap(([key, entry]) => {
    const entryPath = `${currentPath}.${key}`;
    const normalizedKey = key.toLowerCase().replace(/[^a-z]/g, "");
    const exactTargetViolation = normalizedKey.startsWith("current")
      && normalizedKey.includes("target")
      && entry !== AUTHORITATIVE_TARGET
      ? [`${entryPath}=${JSON.stringify(entry)}`]
      : [];
    return [
      ...exactTargetViolation,
      ...collectCurrentTargetViolations(entry, entryPath),
    ];
  });
}

function readTargetHistory(document: Record<string, unknown>, containerKey: string): TargetHistoryEntry[] {
  const container = document[containerKey];
  if (!isRecord(container) || !Array.isArray(container.targetHistory)) {
    throw new Error(`${containerKey}.targetHistory is required`);
  }
  return container.targetHistory.map((entry, index) => {
    if (!isRecord(entry) || typeof entry.sha !== "string" || typeof entry.status !== "string") {
      throw new Error(`${containerKey}.targetHistory[${index}] is invalid`);
    }
    return { sha: entry.sha, status: entry.status };
  });
}

const EXPECTED_TARGET_HISTORY: TargetHistoryEntry[] = [
  { sha: AUTHORITATIVE_TARGET, status: "authoritative-current" },
  { sha: SUPERSEDED_AUTHORITY_TARGET, status: "superseded-authority" },
  { sha: HISTORICAL_REJECTED_TARGET, status: "historical-rejected" },
  { sha: V4_REJECTED_TARGET, status: "rejected-pending-unintegrated" },
];

describe("Phase A evidence target authority", () => {
  it("pins every current target field to the authoritative integration target", () => {
    const report = readJson("report.json");
    const manifest = readJson("evidence-manifest.json");

    expect(collectCurrentTargetViolations(report)).toEqual([]);
    expect(collectCurrentTargetViolations(manifest)).toEqual([]);
    expect(readTargetHistory(report, "source")).toEqual(EXPECTED_TARGET_HISTORY);
    expect(readTargetHistory(manifest, "binding")).toEqual(EXPECTED_TARGET_HISTORY);
  });

  it("binds the moving authority to real Git ancestry and tree identity", () => {
    const manifest = readJson("evidence-manifest.json");
    const binding = requireRecord(manifest, "binding");

    expect(gitIsAncestor(MINIMUM_AUTHORITY, AUTHORITATIVE_TARGET)).toBe(true);
    expect(readString(binding, "authorityRef")).toBe(AUTHORITY_REF);
    expect(readString(binding, "minimumAuthority")).toBe(MINIMUM_AUTHORITY);
    expect(readString(binding, "currentMainTarget")).toBe(AUTHORITATIVE_TARGET);
    expect(readString(binding, "authorityTree")).toBe(AUTHORITATIVE_TARGET_TREE);
    expect(git("rev-parse", readString(binding, "currentMainTarget"))).toBe(AUTHORITATIVE_TARGET);
  });

  it("binds the complete product series and every product artifact to its source base", () => {
    const manifest = readJson("evidence-manifest.json");
    const binding = requireRecord(manifest, "binding");
    const sourceBase = readString(binding, "sourceBase");
    const productCommit = readString(binding, "productCommit");
    const productTree = readString(binding, "productTree");
    const productSeries = readStringArray(binding, "productSeries");
    const productArtifacts = readArtifactEntries(manifest, "productArtifacts");
    const recordedPaths = productArtifacts.map((entry) => readString(entry, "path")).sort();
    const changedPaths = normalizedLines(git(
      "diff",
      "--name-only",
      sourceBase,
      productCommit,
    ));
    const actualSeries = git(
      "rev-list",
      "--reverse",
      "--ancestry-path",
      `${sourceBase}..${productCommit}`,
    ).split(/\r?\n/).filter(Boolean);

    expect(git("rev-parse", `${sourceBase}^{commit}`)).toBe(sourceBase);
    expect(git("rev-parse", `${productCommit}^{commit}`)).toBe(productCommit);
    expect(git("rev-parse", `${productCommit}^{tree}`)).toBe(productTree);
    expect(gitIsAncestor(productCommit, "HEAD")).toBe(true);
    expect(productSeries).toEqual(actualSeries);
    expect(recordedPaths).toEqual(changedPaths);
    for (const artifact of productArtifacts) {
      const artifactPath = readString(artifact, "path");
      expect(readString(artifact, "gitBlobOid")).toBe(
        git("rev-parse", `${productCommit}:${artifactPath}`),
      );
    }
  });

  it("records the current-main merge conflict as HOLD instead of claiming a merge tree", () => {
    const manifest = readJson("evidence-manifest.json");
    const binding = requireRecord(manifest, "binding");
    const productCommit = readString(binding, "productCommit");
    const reconciliation = requireRecord(manifest, "targetReconciliation");
    const inspection = inspectMergeTree(AUTHORITATIVE_TARGET, productCommit);

    expect(inspection.status).toBe(1);
    expect(inspection.conflictPaths).toEqual(EXPECTED_MAIN_CONFLICT_PATHS);
    expect(readString(reconciliation, "status")).toBe("content-conflict-hold");
    expect(reconciliation.semanticMergePerformed).toBe(false);
    expect(readString(reconciliation, "targetCommit")).toBe(AUTHORITATIVE_TARGET);
    expect(readString(reconciliation, "productCommit")).toBe(productCommit);
    expect(readString(reconciliation, "diagnosticTreeOid")).toBe(inspection.diagnosticTreeOid);
    expect(readStringArray(reconciliation, "conflictPaths")).toEqual(inspection.conflictPaths);
    expect(gitIsAncestor(AUTHORITATIVE_TARGET, productCommit)).toBe(false);
  });

  it("records the six-file Share semantic adoption HOLD at remediation head 7141baa", () => {
    const manifest = readJson("evidence-manifest.json");
    const binding = requireRecord(manifest, "binding");
    const productCommit = readString(binding, "productCommit");
    const adoption = requireRecord(manifest, "shareAdoption");
    const inspection = inspectMergeTree(SHARE_PRODUCT_HEAD, productCommit);

    expect(gitIsAncestor(SHARE_BASE_PRODUCT_HEAD, SHARE_REVIEW_HEAD)).toBe(true);
    expect(gitIsAncestor(SHARE_REVIEW_HEAD, SHARE_PRODUCT_HEAD)).toBe(true);
    expect(inspection.status).toBe(1);
    expect(inspection.conflictPaths).toEqual(EXPECTED_SHARE_CONFLICT_PATHS);
    expect(readString(adoption, "status")).toBe("content-conflict-hold");
    expect(adoption.semanticMergePerformed).toBe(false);
    expect(readString(adoption, "reviewHead")).toBe(SHARE_REVIEW_HEAD);
    expect(readString(adoption, "baseProductHead")).toBe(SHARE_BASE_PRODUCT_HEAD);
    expect(readString(adoption, "productHead")).toBe(SHARE_PRODUCT_HEAD);
    expect(readString(adoption, "phaseAProductCommit")).toBe(productCommit);
    expect(readString(adoption, "diagnosticTreeOid")).toBe(inspection.diagnosticTreeOid);
    expect(readStringArray(adoption, "conflictPaths")).toEqual(inspection.conflictPaths);
    expect(gitIsAncestor(SHARE_PRODUCT_HEAD, productCommit)).toBe(false);
  });

  it("fully lists and hashes the evidence child artifacts", () => {
    const manifest = readJson("evidence-manifest.json");
    const binding = requireRecord(manifest, "binding");
    const productCommit = readString(binding, "productCommit");
    const artifacts = readArtifactEntries(manifest, "evidenceArtifacts");
    const manifestPath = "evaluation/phase-a-ontology-evidence-chains-2026-07-13/evidence-manifest.json";
    const recordedPaths = artifacts.map((entry) => readString(entry, "path")).sort();
    const changedPaths = normalizedLines(git(
      "diff",
      "--name-only",
      productCommit,
      "HEAD",
      "--",
      "evaluation/phase-a-ontology-evidence-chains-2026-07-13",
    ));

    expect(readString(binding, "evidenceChildRequiredParent")).toBe(productCommit);
    expect(git("rev-parse", "HEAD^")).toBe(productCommit);
    expect(recordedPaths).toEqual(changedPaths);
    for (const artifact of artifacts) {
      const artifactPath = readString(artifact, "path");
      if (artifactPath === manifestPath) {
        expect(artifact.selfHashExcluded).toBe(true);
        expect(artifact).not.toHaveProperty("gitBlobOid");
      } else {
        expect(readString(artifact, "gitBlobOid")).toBe(
          git("rev-parse", `HEAD:${artifactPath}`),
        );
      }
    }
  });

  it("classifies rejected targets without claiming integration completion", () => {
    const report = fs.readFileSync(path.join(EVIDENCE_DIRECTORY, "report.md"), "utf8");

    expect(report).toContain(`Authoritative current target: \`${AUTHORITATIVE_TARGET}\``);
    expect(report).toContain(`Authority ref: \`${AUTHORITY_REF}\``);
    expect(report).toContain(`Minimum authority ancestor: \`${MINIMUM_AUTHORITY}\``);
    expect(report).toContain(`\`${SUPERSEDED_AUTHORITY_TARGET}\`: superseded authority`);
    expect(report).toContain(`\`${HISTORICAL_REJECTED_TARGET}\`: historical rejected`);
    expect(report).toContain(`\`${V4_REJECTED_TARGET}\`: rejected/pending-unintegrated`);
    expect(report).toContain(
      "Current-main reconciliation is HOLD on `tests/reports-download-center.test.ts`",
    );
    expect(report).toContain(
      "Share v2 baseline `22de1180d69263f7c08ac0ed0cfda0894e2db7f5` and request-scope remediation `7141baac3e0abca146ef6c110093c1c0643760a2` remain under review",
    );
    for (const conflictPath of EXPECTED_SHARE_CONFLICT_PATHS) {
      expect(report).toContain(`\`${conflictPath}\``);
    }
    expect(report).toContain("request-scope stale-response guard");
    expect(report).toContain("dispatch compare-and-set");
    expect(report).not.toMatch(/\bmerge executed\b/i);
    expect(report).not.toMatch(/\bintegration PASS\b/i);
  });

  it("detects a stale current target attack", () => {
    const attacked = structuredClone(readJson("report.json"));
    const source = attacked.source;
    if (!isRecord(source)) throw new Error("report source is required");
    source.currentMainTarget = HISTORICAL_REJECTED_TARGET;

    expect(collectCurrentTargetViolations(attacked)).toEqual([
      `$.source.currentMainTarget=${JSON.stringify(HISTORICAL_REJECTED_TARGET)}`,
    ]);
  });
});
