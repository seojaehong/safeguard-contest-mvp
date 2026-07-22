import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

type GateState = "proven" | "approval_gated" | "notice" | "missing" | "contradicted";

type OpenGate = {
  id: string;
  state: GateState;
  evidencePath: string;
};

type NorthstarOpenGateReport = {
  overall: string;
  gates: OpenGate[];
};

type ApprovalRunwayGate = {
  id: string;
  state: GateState;
  evidencePath: string;
  readyForOperatorReview: boolean;
  currentSafetyLock: string;
  approvalNeeded: string[];
  forbiddenUntilApproved: string[];
  corpusCount?: number;
  batchCount?: number;
};

type LaunchControlNotice = {
  id: string;
  state: GateState;
  evidencePath: string;
  currentSafetyLock: string;
  evidenceNeeded: string[];
  forbiddenUntilProven: string[];
};

type ApprovalRunwayReport = {
  schemaVersion: string;
  overall: string;
  launchReadiness: boolean;
  dbMutationPerformed: boolean;
  providerMessageSent: boolean;
  embeddingGenerated: boolean;
  uploaded: boolean;
  routeSplitAloneAcceptedAsUxFix: boolean;
  viewportArchitectureGate: {
    routeSplitAloneAcceptedAsFix: boolean;
    acceptedStructure: string;
    documentsContract: string[];
    shareContract: string[];
    requiredGeometry: string[];
  };
  approvalGates: ApprovalRunwayGate[];
  launchControlNotices: LaunchControlNotice[];
  operatorSequence: string[];
  nonApprovalWorkStillAllowed: string[];
  completionBoundary: string;
};

const rootDir = process.cwd();

function readJson<T>(relativePath: string): T {
  return JSON.parse(fs.readFileSync(path.join(rootDir, relativePath), "utf8")) as T;
}

describe("northstar approval runway", () => {
  it("keeps the remaining launch-control gates explicit and approval-gated", () => {
    const runway = readJson<ApprovalRunwayReport>("evaluation/northstar-approval-runway-2026-07-21/report.json");
    const openGate = readJson<NorthstarOpenGateReport>("evaluation/northstar-open-gates-current/report.json");
    const approvalGateIds = [
      "provider_dispatch_persistence",
      "supabase_rls_launch_isolation",
      "llm_wiki_publication",
      "sif_embedding_runtime",
      "kosha_exact_promotion_review_gate",
    ];
    const noticeGateIds = [
      "final_99_gate",
      "share_exact_saved_session_boundary",
    ];

    expect(runway.schemaVersion).toBe("safeclaw-northstar-approval-runway/v1");
    expect(runway.overall).toBe("approval_runway_ready_open");
    expect(runway.launchReadiness).toBe(false);
    expect(runway.dbMutationPerformed).toBe(false);
    expect(runway.providerMessageSent).toBe(false);
    expect(runway.embeddingGenerated).toBe(false);
    expect(runway.uploaded).toBe(false);
    expect(runway.routeSplitAloneAcceptedAsUxFix).toBe(false);
    expect(runway.approvalGates.map((gate) => gate.id)).toEqual(approvalGateIds);
    expect(runway.launchControlNotices.map((gate) => gate.id)).toEqual(noticeGateIds);

    for (const gateId of approvalGateIds) {
      const runwayGate = runway.approvalGates.find((gate) => gate.id === gateId);
      const openGateEntry = openGate.gates.find((gate) => gate.id === gateId);
      expect(runwayGate?.state, gateId).toBe("approval_gated");
      expect(runwayGate?.readyForOperatorReview, gateId).toBe(true);
      expect(runwayGate?.approvalNeeded.length, gateId).toBeGreaterThanOrEqual(2);
      expect(runwayGate?.forbiddenUntilApproved.length, gateId).toBeGreaterThanOrEqual(2);
      expect(openGateEntry?.state, gateId).toBe("approval_gated");
      expect(runwayGate?.evidencePath, gateId).toBe(openGateEntry?.evidencePath.replaceAll("\\", "/"));
    }
    for (const gateId of noticeGateIds) {
      const runwayGate = runway.launchControlNotices.find((gate) => gate.id === gateId);
      const openGateEntry = openGate.gates.find((gate) => gate.id === gateId);
      expect(runwayGate?.state, gateId).toBe("notice");
      expect(runwayGate?.evidenceNeeded.length, gateId).toBeGreaterThanOrEqual(2);
      expect(runwayGate?.forbiddenUntilProven.length, gateId).toBeGreaterThanOrEqual(2);
      expect(openGateEntry?.state, gateId).toBe("notice");
      expect(runwayGate?.evidencePath, gateId).toBe(openGateEntry?.evidencePath.replaceAll("\\", "/"));
    }
  });

  it("preserves the per-gate safety locks and forbidden claims", () => {
    const runway = readJson<ApprovalRunwayReport>("evaluation/northstar-approval-runway-2026-07-21/report.json");
    const byId = new Map(runway.approvalGates.map((gate) => [gate.id, gate]));

    expect(byId.get("provider_dispatch_persistence")?.currentSafetyLock).toBe("preview_only");
    expect(byId.get("provider_dispatch_persistence")?.forbiddenUntilApproved.join("\n")).toContain("PROVIDER_DISPATCH_IDEMPOTENCY_SUPPORTED=true");
    expect(byId.get("provider_dispatch_persistence")?.forbiddenUntilApproved.join("\n")).toContain("channel-level exactly-once");

    expect(byId.get("supabase_rls_launch_isolation")?.currentSafetyLock).toBe("read_only_preflight");
    expect(byId.get("supabase_rls_launch_isolation")?.forbiddenUntilApproved.join("\n")).toContain("RLS launch isolation proven");
    expect(byId.get("supabase_rls_launch_isolation")?.forbiddenUntilApproved.join("\n")).toContain("production migration approved");

    expect(byId.get("llm_wiki_publication")?.currentSafetyLock).toBe("candidate_unpublished");
    expect(byId.get("llm_wiki_publication")?.forbiddenUntilApproved.join("\n")).toContain("LLM Wiki publication available");
    expect(byId.get("llm_wiki_publication")?.forbiddenUntilApproved.join("\n")).toContain("LLM Wiki publishes itself");

    expect(byId.get("sif_embedding_runtime")?.currentSafetyLock).toBe("approval_held_no_vectors");
    expect(byId.get("sif_embedding_runtime")?.corpusCount).toBe(6032);
    expect(byId.get("sif_embedding_runtime")?.batchCount).toBe(61);
    expect(byId.get("sif_embedding_runtime")?.forbiddenUntilApproved.join("\n")).toContain("SIF vector retrieval production-active");

    expect(byId.get("kosha_exact_promotion_review_gate")?.currentSafetyLock).toBe("human_review_incomplete_no_mutation");
    expect(byId.get("kosha_exact_promotion_review_gate")?.forbiddenUntilApproved.join("\n")).toContain("exact-trust registry expanded");
    expect(byId.get("kosha_exact_promotion_review_gate")?.forbiddenUntilApproved.join("\n")).toContain("checklist completion alone");
  });

  it("records the documents/share viewport architecture contract separately from route count", () => {
    const runway = readJson<ApprovalRunwayReport>("evaluation/northstar-approval-runway-2026-07-21/report.json");

    expect(runway.viewportArchitectureGate.routeSplitAloneAcceptedAsFix).toBe(false);
    expect(runway.viewportArchitectureGate.acceptedStructure).toContain("first-viewport cockpit");
    expect(runway.viewportArchitectureGate.acceptedStructure).toContain("selected-only bounded workbench");
    expect(runway.viewportArchitectureGate.documentsContract.join("\n")).toContain("supporting 9 documents stay collapsed");
    expect(runway.viewportArchitectureGate.documentsContract.join("\n")).toContain("only one selected document");
    expect(runway.viewportArchitectureGate.shareContract.join("\n")).toContain("2-3 region cockpit");
    expect(runway.viewportArchitectureGate.shareContract.join("\n")).toContain("exact saved/generated /share/[sessionId]");
    expect(runway.viewportArchitectureGate.requiredGeometry.join("\n")).toContain("documents 1440x723 and 390x723");
    expect(runway.viewportArchitectureGate.requiredGeometry.join("\n")).toContain("desktop narrow-stack verdict");
  });

  it("keeps non-approval work separate from runtime launch approval", () => {
    const runway = readJson<ApprovalRunwayReport>("evaluation/northstar-approval-runway-2026-07-21/report.json");

    expect(runway.operatorSequence.join("\n")).toContain("Approve or reject RLS live catalog");
    expect(runway.operatorSequence.join("\n")).toContain("Approve or reject provider dispatch persistence");
    expect(runway.nonApprovalWorkStillAllowed).toContain("UI/UX cockpit and drilldown refinements");
    expect(runway.nonApprovalWorkStillAllowed).toContain("KOSHA exact-trust evidence refreshes without DB writes");
    expect(runway.completionBoundary).toContain("not a launch-complete claim");
  });
});
