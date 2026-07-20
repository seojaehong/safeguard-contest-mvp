import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const packetPath = "evaluation/kosha-guide-approval-current-2026-07-20/approval-packet.json";
const auditPath = "evaluation/kosha-guide-approval-current-2026-07-20/report.json";

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

function asNumber(value: unknown, label: string): number {
  if (typeof value !== "number") throw new Error(`${label}-not-number`);
  return value;
}

function asString(value: unknown, label: string): string {
  if (typeof value !== "string") throw new Error(`${label}-not-string`);
  return value;
}

function readJson(path: string): Record<string, unknown> {
  return asRecord(JSON.parse(readFileSync(path, "utf8")) as unknown, path);
}

describe("current KOSHA Guide approval packet", () => {
  it("does not allow mutation, upload, embedding, or vector enablement", () => {
    const packet = readJson(packetPath);

    expect(packet.decision).toBe("approval_required_before_mutation_or_embedding");
    expect(packet.dbMutationPerformed).toBe(false);
    expect(packet.uploadPerformed).toBe(false);
    expect(packet.embeddingGenerated).toBe(false);
    expect(packet.vectorRetrievalEnabled).toBe(false);

    const gates = asArray(packet.approvalGates, "approvalGates");
    expect(gates.length).toBeGreaterThan(0);
    for (const gate of gates) {
      expect(asRecord(gate, "approvalGate").mutationAllowedByThisRun).toBe(false);
    }
  });

  it("keeps the approval packet counts aligned with the raw audit", () => {
    const packet = readJson(packetPath);
    const audit = readJson(auditPath);
    const readOnlyAudit = asRecord(packet.readOnlyAudit, "readOnlyAudit");
    const quality = asRecord(audit.corpusQuality, "corpusQuality");
    const inventory = asRecord(audit.inventory, "inventory");
    const officialComparison = asRecord(inventory.officialComparison, "officialComparison");
    const verification = asRecord(audit.verification, "verification");

    expect(readOnlyAudit.itemCount).toBe(audit.item_count);
    expect(readOnlyAudit.emptyBodyCount).toBe(quality.emptyBodyCount);
    expect(readOnlyAudit.duplicateSummaryRows).toBe(quality.duplicateSummaryRows);
    expect(readOnlyAudit.operationalControlReviewRequiredRows).toBe(
      quality.operationalControlReviewRequiredCount
    );
    expect(readOnlyAudit.operationalControlSecondaryCandidateRows).toBe(
      quality.operationalControlContaminationCount
    );
    expect(readOnlyAudit.officialVersionMismatchCount).toBe(
      asArray(officialComparison.versionMismatches, "versionMismatches").length
    );
    expect(readOnlyAudit.retiredLocalRowCount).toBe(
      asArray(officialComparison.staleLocalRows, "staleLocalRows").length
    );
    expect(readOnlyAudit.manifestFailures).toEqual(
      asRecord(audit.manifestGate, "manifestGate").failures
    );
    expect(asNumber(readOnlyAudit.productionRetrievalUntestedBranches, "productionRetrievalUntestedBranches"))
      .toBeGreaterThan(0);
    expect(asNumber(verification.failedCheckCount, "failedCheckCount")).toBeGreaterThan(0);
  });

  it("carries every raw launch-readiness blocker into the approval packet", () => {
    const packet = readJson(packetPath);
    const audit = readJson(auditPath);
    const launchReadiness = asRecord(audit.launchReadiness, "launchReadiness");
    const rawBlockers = asArray(launchReadiness.blockers, "launchReadiness.blockers")
      .map((blocker) => asRecord(blocker, "rawBlocker"));
    const packetBlockers = asArray(packet.launchReadinessBlockers, "launchReadinessBlockers")
      .map((blocker) => asRecord(blocker, "packetBlocker"));
    const packetIds = new Set(packetBlockers.map((blocker) => asString(blocker.id, "packetBlocker.id")));

    expect(rawBlockers.length).toBeGreaterThanOrEqual(7);
    for (const blocker of rawBlockers) {
      const id = asString(blocker.id, "rawBlocker.id");
      const matching = packetBlockers.find((candidate) => candidate.id === id);
      expect(packetIds.has(id)).toBe(true);
      expect(matching?.count).toBe(blocker.count);
      expect(matching?.severity).toBe(blocker.severity);
    }
  });

  it("requires operational-control review and production retrieval observation before embedding", () => {
    const packet = readJson(packetPath);
    const recommendation = asRecord(packet.embeddingRecommendation, "embeddingRecommendation");
    const required = asArray(recommendation.requiredBeforeEmbedding, "requiredBeforeEmbedding")
      .map((item) => asString(item, "requiredBeforeEmbedding.item"))
      .join("\n");
    const workstreams = asArray(packet.preApprovalWorkstreams, "preApprovalWorkstreams")
      .map((item) => asRecord(item, "preApprovalWorkstream"));

    expect(required).toContain("70 operational-control");
    expect(required).toContain("ranked and hybrid production retrieval");
    expect(workstreams.map((item) => item.id)).toEqual(expect.arrayContaining([
      "control_causality_review",
      "retrieval_branch_observation"
    ]));
    for (const workstream of workstreams) {
      expect(workstream.mutationAllowedByThisRun).toBe(false);
    }
  });
});
