import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

interface PacketSourceIdentity {
  readonly auditedSourceCommit: string;
  readonly remediationBaseCommit: string;
  readonly packetCommit: null;
  readonly packetCommitSemantics: string;
  readonly packetCommitVerificationCommand: string;
}

interface ApprovalPacketReport {
  readonly sourceIdentity: PacketSourceIdentity;
  readonly launchProven: false;
  readonly databaseConnected: false;
  readonly databaseMutationPerformed: false;
  readonly migrationAdded: false;
  readonly publicationPerformed: false;
}

const REPORT_PATH = "evaluation/llm-wiki-rls-approval-2026-07-17/report.json";

function loadReport(): ApprovalPacketReport {
  return JSON.parse(readFileSync(resolve(process.cwd(), REPORT_PATH), "utf8")) as ApprovalPacketReport;
}

describe("LLM Wiki RLS approval packet identity", () => {
  it("separates the audited source, remediation base, and containing packet commit", () => {
    const report = loadReport();
    expect(report.sourceIdentity.auditedSourceCommit).toMatch(/^[0-9a-f]{40}$/u);
    expect(report.sourceIdentity.remediationBaseCommit).toMatch(/^[0-9a-f]{40}$/u);
    expect(report.sourceIdentity.auditedSourceCommit).not.toBe(report.sourceIdentity.remediationBaseCommit);
    expect(report.sourceIdentity.packetCommit).toBeNull();
    expect(report.sourceIdentity.packetCommitSemantics).toContain("containing this report blob");
    expect(report.sourceIdentity.packetCommitVerificationCommand).toBe(
      `git log -1 --format=%H -- ${REPORT_PATH}`,
    );
  });

  it("keeps the correction packet non-mutating and non-launch-proving", () => {
    const report = loadReport();
    expect(report).toMatchObject({
      launchProven: false,
      databaseConnected: false,
      databaseMutationPerformed: false,
      migrationAdded: false,
      publicationPerformed: false,
    });
  });
});
