import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label}-not-record`);
  }
  return value as Record<string, unknown>;
}

function asArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${label}-not-array`);
  return value;
}

function asBoolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") throw new Error(`${label}-not-boolean`);
  return value;
}

function asNumber(value: unknown, label: string): number {
  if (typeof value !== "number") throw new Error(`${label}-not-number`);
  return value;
}

function asString(value: unknown, label: string): string {
  if (typeof value !== "string") throw new Error(`${label}-not-string`);
  return value;
}

describe("KOSHA Guide repair plan", () => {
  it("builds a read-only repair queue from the current audit report", () => {
    const outputDir = mkdtempSync(join(tmpdir(), "safeclaw-kosha-repair-plan-"));
    const output = join(outputDir, "repair-plan.json");
    const result = spawnSync(
      process.execPath,
      [
        "scripts/build_kosha_guide_repair_plan.mjs",
        "--input",
        "evaluation/kosha-guide-approval-current-2026-07-20/report.json",
        "--output",
        output
      ],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        timeout: 30_000,
        windowsHide: true
      }
    );

    expect(result.status).toBe(0);
    const plan = asRecord(JSON.parse(readFileSync(output, "utf8")) as unknown, "plan");
    const rowSets = asRecord(plan.rowSets, "rowSets");
    const dryRunCounts = asRecord(plan.dryRunCounts, "dryRunCounts");
    const approvalGate = asRecord(plan.approvalGate, "approvalGate");
    const evidenceCoverage = asArray(plan.evidenceCoverage, "evidenceCoverage")
      .map((value) => asRecord(value, "evidenceCoverage"));

    expect(plan.decision).toBe("approval_required_before_mutation_or_embedding");
    expect(plan.readOnly).toBe(true);
    expect(plan.dbMutationPerformed).toBe(false);
    expect(plan.uploadPerformed).toBe(false);
    expect(plan.embeddingGenerated).toBe(false);
    expect(plan.rowEvidenceManifest)
      .toBe("evaluation/kosha-guide-approval-current-2026-07-20/repair-row-evidence-manifest.json");
    expect(asBoolean(approvalGate.mutationAllowedByThisRun, "mutationAllowedByThisRun")).toBe(false);
    expect(asArray(approvalGate.requiredEvidenceBeforeApproval, "requiredEvidenceBeforeApproval")).toEqual([
      "per-row provenance/status backfill manifest for all active rows",
      "per-row body hydration/OCR review manifest for empty-body rows",
      "per-row source-grounded summary regeneration manifest for fallback summary rows"
    ]);
    expect(dryRunCounts).toMatchObject({
      insert: 0,
      update: 7,
      retire: 1,
      unchanged: 1032
    });
    expect(asArray(rowSets.versionUpdates, "versionUpdates")).toHaveLength(7);
    expect(asArray(rowSets.retiredRows, "retiredRows")).toHaveLength(1);
    expect(asArray(rowSets.operationalControlReviewRequiredRows, "operationalControlReviewRequiredRows"))
      .toHaveLength(70);
    expect(asArray(rowSets.operationalControlSecondaryCandidateRows, "operationalControlSecondaryCandidateRows"))
      .toHaveLength(1);
    expect(asArray(rowSets.untestedRetrievalBranches, "untestedRetrievalBranches").length)
      .toBeGreaterThanOrEqual(2);
    expect(evidenceCoverage.find((item) => item.workstreamId === "provenance_and_status_backfill_dry_run"))
      .toMatchObject({
        coverage: "row_level_complete",
        rowLevelEvidenceAvailable: true,
        count: 1040
      });
    expect(evidenceCoverage.find((item) => item.workstreamId === "body_hydration_or_ocr_review"))
      .toMatchObject({
        coverage: "row_level_complete",
        rowLevelEvidenceAvailable: true,
        count: 818
      });
    expect(evidenceCoverage.find((item) => item.workstreamId === "summary_regeneration"))
      .toMatchObject({
        coverage: "row_level_complete",
        rowLevelEvidenceAvailable: true,
        count: 822
      });
    expect(evidenceCoverage.find((item) => item.workstreamId === "version_state_reconciliation"))
      .toMatchObject({
        coverage: "row_level_complete",
        rowLevelEvidenceAvailable: true,
        count: 8
      });
  });

  it("keeps repair workstreams explicit and approval-gated", () => {
    const outputDir = mkdtempSync(join(tmpdir(), "safeclaw-kosha-repair-plan-"));
    const output = join(outputDir, "repair-plan.json");
    const result = spawnSync(
      process.execPath,
      [
        "scripts/build_kosha_guide_repair_plan.mjs",
        "--output",
        output
      ],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        timeout: 30_000,
        windowsHide: true
      }
    );

    expect(result.status).toBe(0);
    const plan = asRecord(JSON.parse(readFileSync(output, "utf8")) as unknown, "plan");
    const workstreams = asArray(plan.workstreams, "workstreams")
      .map((value) => asRecord(value, "workstream"));
    const ids = workstreams.map((item) => asString(item.id, "workstream.id"));

    expect(ids).toEqual([
      "provenance_and_status_backfill_dry_run",
      "body_hydration_or_ocr_review",
      "summary_regeneration",
      "version_state_reconciliation",
      "control_causality_review",
      "retrieval_branch_observation"
    ]);
    for (const workstream of workstreams) {
      expect(asBoolean(workstream.mutationAllowedByThisRun, "workstream.mutationAllowedByThisRun"))
        .toBe(false);
      expect(asNumber(workstream.count, "workstream.count")).toBeGreaterThan(0);
      expect(asString(workstream.exitCriteria, "workstream.exitCriteria").length).toBeGreaterThan(20);
    }
    const retrieval = workstreams.find((item) => item.id === "retrieval_branch_observation");
    expect(retrieval?.countSemantics).toBe("scenario-branch pairs, not unique branch names");
  });

  it("writes a row-evidence manifest that proves every repair queue count with rows", () => {
    const outputDir = mkdtempSync(join(tmpdir(), "safeclaw-kosha-repair-plan-"));
    const output = join(outputDir, "repair-plan.json");
    const rowEvidenceOutput = join(outputDir, "repair-row-evidence-manifest.json");
    const rowEvidenceMarkdown = join(outputDir, "repair-row-evidence-manifest.md");
    const result = spawnSync(
      process.execPath,
      [
        "scripts/build_kosha_guide_repair_plan.mjs",
        "--input",
        "evaluation/kosha-guide-approval-current-2026-07-20/report.json",
        "--output",
        output
      ],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        timeout: 30_000,
        windowsHide: true
      }
    );

    expect(result.status).toBe(0);
    expect(existsSync(rowEvidenceOutput)).toBe(true);
    expect(existsSync(rowEvidenceMarkdown)).toBe(true);
    const manifest = asRecord(
      JSON.parse(readFileSync(rowEvidenceOutput, "utf8")) as unknown,
      "rowEvidenceManifest"
    );
    const inventory = asArray(manifest.rowSetInventory, "rowSetInventory")
      .map((value) => asRecord(value, "rowSetInventory.item"));
    const incomplete = asArray(manifest.incompleteWorkstreams, "incompleteWorkstreams")
      .map((value) => asRecord(value, "incompleteWorkstream"));
    const complete = asArray(manifest.completeWorkstreams, "completeWorkstreams")
      .map((value) => asRecord(value, "completeWorkstream"));
    const summarySample = asRecord(manifest.summarySample, "summarySample");
    const approvalGate = asRecord(manifest.approvalGate, "approvalGate");

    expect(manifest.decision).toBe("row_level_evidence_complete_for_review");
    expect(manifest.readOnly).toBe(true);
    expect(manifest.dbMutationPerformed).toBe(false);
    expect(manifest.uploadPerformed).toBe(false);
    expect(manifest.embeddingGenerated).toBe(false);
    expect(asBoolean(approvalGate.mutationAllowedByThisRun, "mutationAllowedByThisRun")).toBe(false);
    expect(asBoolean(approvalGate.embeddingAllowedByThisRun, "embeddingAllowedByThisRun")).toBe(false);
    expect(inventory).toHaveLength(6);
    expect(incomplete).toHaveLength(0);
    expect(complete.map((item) => item.workstreamId)).toEqual([
      "provenance_and_status_backfill_dry_run",
      "body_hydration_or_ocr_review",
      "summary_regeneration",
      "version_state_reconciliation",
      "control_causality_review",
      "retrieval_branch_observation"
    ]);
    expect(inventory.find((item) => item.workstreamId === "provenance_and_status_backfill_dry_run"))
      .toMatchObject({
        evidenceMode: "row_level_complete",
        sourceCount: 1040,
        rowCountAvailable: 1040,
        rowLevelComplete: true,
        missingRowManifestCount: 0
      });
    expect(inventory.find((item) => item.workstreamId === "body_hydration_or_ocr_review"))
      .toMatchObject({
        evidenceMode: "row_level_complete",
        sourceCount: 818,
        rowCountAvailable: 818,
        rowLevelComplete: true,
        missingRowManifestCount: 0
      });
    const summaryInventory = inventory.find((item) => item.workstreamId === "summary_regeneration");
    expect(summaryInventory).toMatchObject({
      evidenceMode: "row_level_complete",
      sourceCount: 822,
      rowCountAvailable: 822,
      rowLevelComplete: true,
      missingRowManifestCount: 0
    });
    expect(asNumber(summaryInventory?.rowCountAvailable, "summary.rowCountAvailable"))
      .toBe(822);
    expect(asNumber(summarySample.rowManifestIds, "summarySample.rowManifestIds"))
      .toBe(asNumber(summaryInventory?.rowCountAvailable, "summary.rowCountAvailable"));
    expect(inventory.find((item) => item.workstreamId === "control_causality_review"))
      .toMatchObject({
        evidenceMode: "row_level_complete",
        sourceCount: 71,
        rowCountAvailable: 71,
        rowLevelComplete: true,
        missingRowManifestCount: 0
      });
  });
});
