import type { SifEmbeddingGateStatus } from "@/lib/sif-embedding-gate-status";
import { MAX_INPUT_HAZARD_PHOTO_FILES } from "@/lib/operation-improvements";

export type SifEmbeddingApprovalPacket = {
  scope: "sif_embedding_approval_packet";
  fileName: string;
  generatedAt: string;
  gateId: SifEmbeddingGateStatus["nextApprovalGate"]["id"];
  title: string;
  currentState: string;
  nextAction: string;
  dbMutationPerformed: boolean;
  embeddingGenerated: boolean;
  uploaded: boolean;
  requiredArtifacts: SifEmbeddingGateStatus["approvalPacket"]["requiredArtifacts"];
  relatedHarness: {
    visionEndpoint: "/api/input-photos/hazard-analysis";
    improvementEndpointPattern: "/api/workpacks/[id]/improvements";
    maxInputPhotos: number;
    acceptedOnly: true;
    beforeAfterSupported: true;
    ocrSupported: true;
  };
  markdown: string;
};

function boolText(value: boolean) {
  return value ? "yes" : "no";
}

function decisionLines(status: SifEmbeddingGateStatus) {
  return status.approvalPacket.decisions.map((decision, index) => `${index + 1}. ${decision}`);
}

function artifactLines(status: SifEmbeddingGateStatus) {
  return status.approvalPacket.requiredArtifacts.map((artifact) => (
    `- ${artifact.label}: \`${artifact.path}\` (${artifact.role})`
  ));
}

function safetyLockLines(status: SifEmbeddingGateStatus) {
  return status.approvalPacket.safetyLocks.map((lock) => (
    `- ${lock.label}: ${lock.locked ? "locked" : "review"} - ${lock.detail}`
  ));
}

function preflightLines(status: SifEmbeddingGateStatus) {
  return status.preflightChecks.map((check) => (
    `- ${check.passed ? "pass" : "review"}: ${check.label} (${check.evidenceSummary})`
  ));
}

export function buildSifEmbeddingApprovalPacket(status: SifEmbeddingGateStatus): SifEmbeddingApprovalPacket {
  const generatedAt = new Date().toISOString();
  const relatedHarness = {
    visionEndpoint: "/api/input-photos/hazard-analysis" as const,
    improvementEndpointPattern: "/api/workpacks/[id]/improvements" as const,
    maxInputPhotos: MAX_INPUT_HAZARD_PHOTO_FILES,
    acceptedOnly: true as const,
    beforeAfterSupported: true as const,
    ocrSupported: true as const
  };
  const lines = [
    "# SIF Embedding Approval Packet",
    "",
    `Generated: ${generatedAt}`,
    `Gate: ${status.nextApprovalGate.id}`,
    "",
    "## Current State",
    "",
    `- Verdict: ${status.readinessVerdict.label}`,
    `- Answer: ${status.readinessVerdict.answer}`,
    `- Next action: ${status.nextApprovalGate.action}`,
    `- DB mutation performed: ${boolText(status.dbMutationPerformed)}`,
    `- Full embedding generated: ${boolText(status.learningLifecycle.fullEmbeddingGenerated)}`,
    `- DB upload verified: ${boolText(status.learningLifecycle.dbUploadVerified)}`,
    `- Vector search usable: ${boolText(status.learningLifecycle.vectorSearchUsable)}`,
    `- Model fine-tuning performed: ${boolText(status.learningLifecycle.modelFineTuningPerformed)}`,
    "",
    "## Corpus",
    "",
    `- SIF source items: ${status.corpus.itemCount.toLocaleString("ko-KR")}`,
    `- Embedding corpus: ${status.corpus.corpusCount.toLocaleString("ko-KR")}`,
    `- Skipped rows: ${status.corpus.skippedCount.toLocaleString("ko-KR")}`,
    `- Batch count: ${status.corpus.batchCount.toLocaleString("ko-KR")}`,
    `- Embedding model: ${status.corpus.embeddingModel}`,
    `- Embedding dimensions: ${status.corpus.embeddingDimensions.toLocaleString("ko-KR")}`,
    `- Corpus hash: ${status.corpus.corpusHash}`,
    "",
    "## Required Decision",
    "",
    ...decisionLines(status),
    "",
    "## Required Artifacts",
    "",
    ...artifactLines(status),
    "",
    "## Safety Locks",
    "",
    ...safetyLockLines(status),
    "",
    "## Preflight Checks",
    "",
    ...preflightLines(status),
    "",
    "## Runtime DB Probe",
    "",
    `- Status: ${status.runtimeDbProbe.status}`,
    `- Table ready: ${boolText(status.runtimeDbProbe.tableReady)}`,
    `- RPC ready: ${boolText(status.runtimeDbProbe.rpcReady)}`,
    `- Message: ${status.runtimeDbProbe.message}`,
    "",
    "## Vision/OCR Harness Path",
    "",
    `- Initial field photos: multipart \`photos\` to \`${relatedHarness.visionEndpoint}\`, up to ${relatedHarness.maxInputPhotos} files`,
    "- Photo hazards are reviewable candidates, not final facts.",
    "- Only user-accepted candidates enter the DB harness improvement memory.",
    `- Before/After improvements: \`${relatedHarness.improvementEndpointPattern}\` with vision/OCR payload`,
    "- OCR text, detected hazards, observed improvement, source photo names, and reflected documents are exported to the workpack learning corpus.",
    "",
    "## Held Command",
    "",
    "Do not run before the required approval gate passes.",
    "",
    "```powershell",
    status.commandHeldUntilApproval,
    "```",
    ""
  ];

  return {
    scope: "sif_embedding_approval_packet",
    fileName: `safeclaw-sif-embedding-approval-${status.nextApprovalGate.id}.md`,
    generatedAt,
    gateId: status.nextApprovalGate.id,
    title: "SIF Embedding Approval Packet",
    currentState: status.readinessVerdict.label,
    nextAction: status.nextApprovalGate.action,
    dbMutationPerformed: status.dbMutationPerformed,
    embeddingGenerated: status.embeddingGenerated,
    uploaded: status.uploaded,
    requiredArtifacts: status.approvalPacket.requiredArtifacts,
    relatedHarness,
    markdown: lines.join("\n")
  };
}
