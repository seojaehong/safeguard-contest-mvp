import {
  formatSifApprovalDecisionForPresentation,
  formatSifArtifactLabelForPresentation,
  formatSifCanaryModeForPresentation,
  formatSifChecklistStatusForPresentation,
  formatSifGateIdForPresentation,
  formatSifOperatorGateStatusForPresentation,
  formatSifPreflightLabelForPresentation,
  formatSifRuntimeStatusForPresentation,
  formatSifTextForPresentation
} from "@/lib/web-safe-presentation";
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
  canary: SifEmbeddingGateStatus["canary"];
  operatorGate: SifEmbeddingGateStatus["operatorGate"];
  postMigrationVerification: SifEmbeddingGateStatus["postMigrationVerification"];
  requiredArtifacts: SifEmbeddingGateStatus["approvalPacket"]["requiredArtifacts"];
  approvalFingerprint: string;
  artifactIntegrity: SifEmbeddingGateStatus["approvalPacket"]["artifactIntegrity"];
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
  return status.approvalPacket.decisions.map((decision, index) => (
    `${index + 1}. ${formatSifApprovalDecisionForPresentation(decision)}`
  ));
}

function artifactLines(status: SifEmbeddingGateStatus) {
  return status.approvalPacket.requiredArtifacts.map((artifact) => (
    `- ${formatSifArtifactLabelForPresentation(artifact.label)}: \`${artifact.path}\` (${formatSifTextForPresentation(artifact.role)})`
  ));
}

function integrityLines(status: SifEmbeddingGateStatus) {
  return status.approvalPacket.artifactIntegrity.map((artifact) => {
    const hash = artifact.sha256
      ? `sha256=${artifact.sha256}`
      : artifact.contentHash
        ? `contentHash=${artifact.contentHash}`
        : "hash=not-recorded";
    const recordCount = typeof artifact.recordCount === "number" ? `, records=${artifact.recordCount.toLocaleString("ko-KR")}` : "";
    return `- ${formatSifArtifactLabelForPresentation(artifact.label)}: ${artifact.exists ? "present" : "missing"}, bytes=${artifact.byteSize.toLocaleString("ko-KR")}, ${hash}${recordCount}`;
  });
}

function safetyLockLines(status: SifEmbeddingGateStatus) {
  return status.approvalPacket.safetyLocks.map((lock) => (
    `- ${formatSifTextForPresentation(lock.label)}: ${lock.locked ? "locked" : "review"} - ${formatSifTextForPresentation(lock.detail)}`
  ));
}

function preflightLines(status: SifEmbeddingGateStatus) {
  return status.preflightChecks.map((check) => (
    `- ${check.passed ? "pass" : "review"}: ${formatSifPreflightLabelForPresentation(check.id, check.label)} (${check.evidenceSummary})`
  ));
}

function operatorChecklistLines(status: SifEmbeddingGateStatus) {
  return status.operatorGate.checklist.map((item) => (
    `- ${formatSifChecklistStatusForPresentation(item.status)}: ${formatSifTextForPresentation(item.label)} (${formatSifTextForPresentation(item.evidence)})`
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
    `Gate: ${formatSifGateIdForPresentation(status.nextApprovalGate.id)}`,
    "",
    "## Current State",
    "",
    `- Verdict: ${formatSifTextForPresentation(status.readinessVerdict.label)}`,
    `- Answer: ${formatSifTextForPresentation(status.readinessVerdict.answer)}`,
    `- Next action: ${formatSifTextForPresentation(status.nextApprovalGate.action)}`,
    `- DB mutation performed: ${boolText(status.dbMutationPerformed)}`,
    `- Full embedding generated: ${boolText(status.learningLifecycle.fullEmbeddingGenerated)}`,
    `- DB upload verified: ${boolText(status.learningLifecycle.dbUploadVerified)}`,
    `- Vector search usable: ${boolText(status.learningLifecycle.vectorSearchUsable)}`,
    `- Model fine-tuning performed: ${boolText(status.learningLifecycle.modelFineTuningPerformed)}`,
    "",
    "## Operator Gate Runbook",
    "",
    `- Status: ${formatSifOperatorGateStatusForPresentation(status.operatorGate.status)}`,
    `- Approval question: ${formatSifTextForPresentation(status.operatorGate.approvalQuestion)}`,
    `- Migration artifact: \`${status.operatorGate.migrationArtifact.path}\``,
    `- Migration sha256: ${status.operatorGate.migrationArtifact.sha256 || "not-recorded"}`,
    "",
    "Evidence:",
    "",
    ...status.operatorGate.evidenceSummary.map((item) => `- ${formatSifTextForPresentation(item)}`),
    "",
    "Allowed before approval:",
    "",
    ...status.operatorGate.allowedBeforeApproval.map((item) => `- ${formatSifTextForPresentation(item)}`),
    "",
    "Forbidden before approval:",
    "",
    ...status.operatorGate.forbiddenBeforeApproval.map((item) => `- ${formatSifTextForPresentation(item)}`),
    "",
    "Checklist:",
    "",
    ...operatorChecklistLines(status),
    "",
    "After approval:",
    "",
    ...status.operatorGate.postApprovalSequence.map((item, index) => `${index + 1}. ${formatSifTextForPresentation(item)}`),
    "",
    `Non-approval fallback: ${formatSifTextForPresentation(status.operatorGate.nonApprovalFallback)}`,
    "",
    "## Post-Migration Verification",
    "",
    `- Report: \`${status.postMigrationVerification.reportPath}\``,
    `- Status: ${formatSifRuntimeStatusForPresentation(status.postMigrationVerification.status)}`,
    `- OK: ${boolText(status.postMigrationVerification.ok)}`,
    `- Uploaded rows: ${status.postMigrationVerification.uploadedCount.toLocaleString("ko-KR")} / ${status.postMigrationVerification.expectedCorpusCount.toLocaleString("ko-KR")}`,
    `- Table ready: ${boolText(status.postMigrationVerification.tableReady)}`,
    `- RPC ready: ${boolText(status.postMigrationVerification.rpcReady)}`,
    `- Vector flag: ${status.postMigrationVerification.vectorFeatureFlagEnabled ? "on" : "off"}`,
    `- Failed checks: ${status.postMigrationVerification.failedCheckIds.join(", ") || "none"}`,
    `- Next action: ${formatSifTextForPresentation(status.postMigrationVerification.nextAction)}`,
    "",
    "## Canary Embedding Evidence",
    "",
    `- Status: ${formatSifTextForPresentation(status.canary.label)}`,
    `- Answer: ${formatSifTextForPresentation(status.canary.answer)}`,
    `- Corpus count: ${status.canary.corpusCount.toLocaleString("ko-KR")}`,
    `- Embedded count: ${status.canary.embeddedCount.toLocaleString("ko-KR")}`,
    `- Uploaded count: ${status.canary.uploadedCount.toLocaleString("ko-KR")}`,
    `- Mode: ${formatSifCanaryModeForPresentation(status.canary.mode)}`,
    `- Report: \`${status.canary.reportPath}\``,
    `- Vectors: ${status.canary.vectorsPath ? `\`${status.canary.vectorsPath}\`` : "none"}`,
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
    `- Approval fingerprint: ${status.approvalPacket.approvalFingerprint}`,
    "",
    "## Required Decision",
    "",
    ...decisionLines(status),
    "",
    "## Required Artifacts",
    "",
    ...artifactLines(status),
    "",
    "## Artifact Integrity",
    "",
    ...integrityLines(status),
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
    `- Status: ${formatSifRuntimeStatusForPresentation(status.runtimeDbProbe.status)}`,
    `- Table ready: ${boolText(status.runtimeDbProbe.tableReady)}`,
    `- RPC ready: ${boolText(status.runtimeDbProbe.rpcReady)}`,
    `- Message: ${formatSifTextForPresentation(status.runtimeDbProbe.message)}`,
    "",
    "## Vision/OCR Harness Path",
    "",
    `- Initial field photos: multipart \`photos\` to \`${relatedHarness.visionEndpoint}\`, up to ${relatedHarness.maxInputPhotos} files`,
    "- Photo hazards are reviewable candidates, not final facts.",
    "- Only user-accepted candidates enter the DB harness improvement memory.",
    `- Before/After improvements: \`${relatedHarness.improvementEndpointPattern}\`에 사진 분석/OCR 데이터를 저장합니다.`,
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
    canary: status.canary,
    operatorGate: status.operatorGate,
    postMigrationVerification: status.postMigrationVerification,
    requiredArtifacts: status.approvalPacket.requiredArtifacts,
    approvalFingerprint: status.approvalPacket.approvalFingerprint,
    artifactIntegrity: status.approvalPacket.artifactIntegrity,
    relatedHarness,
    markdown: lines.join("\n")
  };
}
