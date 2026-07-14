import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const AUTHORITATIVE_TARGET = "f45bba17bcce0d8ebb2690f82d014dbe42ae8191";
const HISTORICAL_REJECTED_TARGET = "b3762867d380f20faee2a83a17354dc61557ce12";
const V4_REJECTED_TARGET = "cc9f5af297950b73b53a9ab4018bdc143830c499";
const EVIDENCE_DIRECTORY = path.resolve(
  "evaluation/phase-a-ontology-evidence-chains-2026-07-13",
);

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

  it("classifies rejected targets without claiming integration completion", () => {
    const report = fs.readFileSync(path.join(EVIDENCE_DIRECTORY, "report.md"), "utf8");

    expect(report).toContain(`Authoritative current target: \`${AUTHORITATIVE_TARGET}\``);
    expect(report).toContain(`\`${HISTORICAL_REJECTED_TARGET}\`: historical rejected`);
    expect(report).toContain(`\`${V4_REJECTED_TARGET}\`: rejected/pending-unintegrated`);
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
