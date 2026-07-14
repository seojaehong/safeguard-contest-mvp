import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";

import { describe, expect, it } from "vitest";

const AUTHORITY_REF = "refs/remotes/origin/feat/phase-a-evidence-integration";
const MINIMUM_AUTHORITY = "67d2c9e28e7278c58f46b46c2512c7133d88d1d3";
const HISTORICAL_REJECTED_TARGET = "b3762867d380f20faee2a83a17354dc61557ce12";
const V4_REJECTED_TARGET = "cc9f5af297950b73b53a9ab4018bdc143830c499";
const SUPERSEDED_AUTHORITY_TARGET = "f45bba17bcce0d8ebb2690f82d014dbe42ae8191";
const EVIDENCE_DIRECTORY = path.resolve(
  "evaluation/phase-a-ontology-evidence-chains-2026-07-13",
);
const REPOSITORY_ROOT = path.resolve(".");

type TargetHistoryEntry = {
  sha: string;
  status: string;
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

function normalizedLines(value: string): string[] {
  return value.split(/\r?\n/).map((entry) => entry.trim()).filter(Boolean).sort();
}

function sha256File(filePath: string): string {
  return createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
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
    expect(readString(binding, "currentTargetTree")).toBe(AUTHORITATIVE_TARGET_TREE);
    expect(git("rev-parse", readString(binding, "currentMainTarget"))).toBe(AUTHORITATIVE_TARGET);
  });

  it("binds every product artifact and merge tree to the product commit", () => {
    const manifest = readJson("evidence-manifest.json");
    const binding = requireRecord(manifest, "binding");
    const productCommit = readString(binding, "productCommit");
    const productTree = readString(binding, "productTree");
    const productArtifacts = readArtifactEntries(manifest, "productArtifacts");
    const recordedPaths = productArtifacts.map((entry) => readString(entry, "path")).sort();
    const changedPaths = normalizedLines(git(
      "diff-tree",
      "--no-commit-id",
      "--name-only",
      "-r",
      `${productCommit}^`,
      productCommit,
    ));

    expect(git("rev-parse", `${productCommit}^{commit}`)).toBe(productCommit);
    expect(git("rev-parse", `${productCommit}^{tree}`)).toBe(productTree);
    expect(gitIsAncestor(productCommit, "HEAD")).toBe(true);
    expect(recordedPaths).toEqual(changedPaths);
    for (const artifact of productArtifacts) {
      const artifactPath = readString(artifact, "path");
      expect(readString(artifact, "gitBlobOid")).toBe(
        git("rev-parse", `${productCommit}:${artifactPath}`),
      );
    }

    const mergeTree = git("merge-tree", "--write-tree", AUTHORITATIVE_TARGET, productCommit);
    const mergeIdentity = requireRecord(manifest, "mergeIdentity");
    expect(readString(mergeIdentity, "targetCommit")).toBe(AUTHORITATIVE_TARGET);
    expect(readString(mergeIdentity, "productCommit")).toBe(productCommit);
    expect(readString(mergeIdentity, "tree")).toBe(mergeTree);
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
        expect(artifact).not.toHaveProperty("contentSha256");
      } else {
        expect(readString(artifact, "contentSha256")).toBe(
          sha256File(path.resolve(artifactPath)),
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
    expect(report).toContain("Share v2 `22de1180d69263f7c08ac0ed0cfda0894e2db7f5` remains under review and was not semantically merged");
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
