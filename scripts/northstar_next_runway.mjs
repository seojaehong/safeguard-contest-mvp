#!/usr/bin/env node
// @ts-check

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SCHEMA_VERSION = "safeclaw-northstar-next-runway/v2";
const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "..");
const DEFAULT_OUTPUT_DIR = path.join("evaluation", "northstar-next-runway-current-2026-07-22");
const DEFAULT_BUILD_INFO_URL = "https://www.safeclaw.kr/api/build-info";

const ARTIFACTS = Object.freeze({
  openGate: path.join("evaluation", "northstar-open-gates-current", "report.json"),
  liveRollup: path.join("evaluation", "northstar-live-rollup-2026-07-20", "report.json"),
  final99: path.join("evaluation", "final-99-gate-current-2026-07-22", "report.json"),
  final99TwelveDocumentNoMutation: path.join("evaluation", "final-99-12-document-no-mutation-2026-08-17", "report.json"),
  workspaceInformationArchitecture: path.join("evaluation", "workspace-information-architecture-2026-07-21", "report.json"),
  hermesOpenclawRuntime: path.join("evaluation", "hermes-openclaw-runtime-current-gate-2026-07-20", "report.json"),
  launchReadiness: path.join("evaluation", "launch-readiness-current-2026-07-22", "report.json"),
  documentQualityGrounding: path.join("evaluation", "document-quality-grounding-current-gate-2026-07-19", "report.json"),
  liveDocumentQualityMatrix: path.join("evaluation", "live-document-quality-matrix-2026-07-24", "report.json"),
  liveDocumentQualityStressMatrix: path.join("evaluation", "live-document-quality-stress-matrix-2026-07-24", "report.json"),
  liveDocumentFieldIsolation: path.join("evaluation", "live-document-field-isolation-2026-07-25", "report.json"),
  liveKoshaExactMaterialization: path.join("evaluation", "live-kosha-exact-materialization-2026-07-25", "report.json"),
  liveDocumentWordingReview: path.join("evaluation", "live-document-wording-review-2026-07-24", "report.json"),
  liveDocumentBroadReview: path.join("evaluation", "live-document-broad-review-2026-07-25", "report.json"),
  liveDocumentEditorialReview: path.join("evaluation", "live-document-editorial-review-2026-07-25", "report.json"),
  documentEditorialReviewCockpit: path.join("evaluation", "document-editorial-review-cockpit-2026-08-16", "report.json"),
  documentEditorialReviewReceipt: path.join("evaluation", "document-editorial-review-receipt-2026-08-17", "report.json"),
  liveDocumentEditorialDuplicateClassification: path.join("evaluation", "live-document-editorial-duplicate-classification-2026-07-25", "report.json"),
  liveDocumentEditorialNearClassification: path.join("evaluation", "live-document-editorial-near-classification-2026-07-25", "report.json"),
  productCapabilityTruth: path.join("evaluation", "product-capability-truth-2026-07-25", "report.json"),
  ciSupplyChainFullSuite: path.join("evaluation", "ci-full-suite-remediation-2026-08-29", "report.json"),
  knowledgePreparationCapabilityTruth: path.join("evaluation", "knowledge-preparation-capability-truth-2026-08-28", "report.json"),
  launchOperationsReadiness: path.join("evaluation", "launch-operations-readiness-2026-08-26", "report.json"),
  distributedAdmissionActivationApproval: path.join("evaluation", "distributed-admission-activation-approval-2026-08-29", "report.json"),
  documentExportCapabilityTruth: path.join("evaluation", "document-export-capability-truth-2026-08-17", "report.json"),
  ontologyViewportWorkbench: path.join("evaluation", "ontology-viewport-workbench-2026-08-17", "report.json"),
  knowledgeViewportWorkbench: path.join("evaluation", "knowledge-viewport-workbench-2026-08-17", "report.json"),
  llmWikiCandidateContentReadiness: path.join("evaluation", "llm-wiki-candidate-readiness-2026-08-25", "report.json"),
  llmWikiCandidateContentMatrix: path.join("evaluation", "llm-wiki-candidate-content-matrix-2026-08-25", "report.json"),
  llmWikiSifEvidenceMatrix: path.join("evaluation", "llm-wiki-sif-evidence-matrix-2026-08-26", "report.json"),
  dependencySecurityRemediation: path.join("evaluation", "dependency-security-remediation-2026-07-28", "report.json"),
  tenantAuthorizationRemediation: path.join("evaluation", "tenant-authorization-boundary-preflight-2026-07-29", "report.json"),
  spreadsheetFormulaNeutralization: path.join("evaluation", "spreadsheet-formula-neutralization-2026-08-01", "report.json"),
  publicProviderWorkBudget: path.join("evaluation", "public-provider-work-budget-2026-08-01", "report.json"),
  documentExportWorkBudget: path.join("evaluation", "document-export-work-budget-2026-08-01", "report.json"),
  fullRepositorySecurityScan: path.join("evaluation", "follow-up-full-repository-security-scan-2026-08-02", "report.json"),
  repositorySecurityScanReconciliation: path.join("evaluation", "repository-security-scan-reconciliation-2026-08-11", "report.json"),
  currentSecurityRemediationLedger: path.join("evaluation", "security-current-remediation-ledger-2026-08-13", "report.json"),
  currentRepositorySecurityRescan: path.join("evaluation", "current-full-repository-security-scan-2026-08-27", "report.json"),
  freshCurrentSourceSecurityScan: path.join("evaluation", "current-source-standard-security-scan-2026-08-28-complete", "report.json"),
  currentSourceSecurityResidualRemediation: path.join("evaluation", "current-source-security-residual-remediation-2026-08-28", "report.json"),
  shareAckPreBodyAdmission: path.join("evaluation", "share-ack-prebody-admission-2026-08-28", "report.json"),
  safetyStatusDisconnectLease: path.join("evaluation", "safety-status-disconnect-lease-2026-08-28", "report.json"),
  weatherFallbackErrorRedaction: path.join("evaluation", "weather-fallback-error-redaction-2026-08-28", "report.json"),
  hwpxArchiveExpansionSecurity: path.join("evaluation", "hwpx-archive-expansion-security-2026-08-28", "report.json"),
  agentChatDurableAdmission: path.join("evaluation", "security-agent-chat-durable-admission-2026-08-14", "report.json"),
  mcpProviderAdmission: path.join("evaluation", "security-mcp-provider-admission-2026-08-14", "report.json"),
  shareRecipientContactVerification: path.join("evaluation", "share-recipient-contact-verification-2026-08-14", "report.json"),
  securityAtomicDbRaceApprovalBoundary: path.join("evaluation", "security-atomic-db-race-approval-boundary-2026-08-14", "report.json"),
  liveDocumentsShareRoutePerception: path.join("evaluation", "live-documents-share-route-perception-2026-08-28", "report.json"),
  deploymentFreshnessGuard: path.join("evaluation", "deployment-freshness-guard-2026-08-14", "report.json"),
  publicJsonRequestBodyBudget: path.join("evaluation", "public-json-request-body-budget-2026-08-11", "report.json"),
  improvementPhotoAnalysisBudget: path.join("evaluation", "improvement-photo-analysis-budget-2026-08-11", "report.json"),
  publicProviderCancellation: path.join("evaluation", "public-provider-cancellation-2026-08-11", "report.json"),
  publicProviderAdmission: path.join("evaluation", "public-provider-admission-2026-08-11", "report.json"),
  publicAskDistributedAdmission: path.join("evaluation", "public-ask-distributed-admission-2026-08-14", "report.json"),
  publicSearchDistributedAdmission: path.join("evaluation", "public-search-distributed-admission-2026-08-14", "report.json"),
  publicSearchDistributedRateLimitReadiness: path.join("evaluation", "public-search-distributed-rate-limit-readiness-2026-08-02", "report.json"),
  publicGenerationAdmissionSecurity: path.join("evaluation", "security-public-generation-admission-2026-08-04", "report.json"),
  securityFollowupRemediation: path.join("evaluation", "codex-security-followup-remediation-2026-08-11", "report.json"),
  securityResourceRemediation: path.join("evaluation", "security-resource-remediation-2026-08-11", "report.json"),
  securityUpstreamTransportRemediation: path.join("evaluation", "security-upstream-transport-remediation-2026-08-11", "report.json"),
  securitySafetyReferenceSurfaceRemediation: path.join("evaluation", "security-safety-reference-surface-remediation-2026-08-11", "report.json"),
  mcpGenerationWorkBudgetSecurity: path.join("evaluation", "security-mcp-generation-work-budget-2026-08-04", "report.json"),
  learningExportRendererSecurity: path.join("evaluation", "learning-export-renderer-security-2026-08-02", "report.json"),
  hermesKnowledgeReviewAuthorityUi: path.join("evaluation", "hermes-knowledge-review-selected-workbench-2026-08-14", "report.json"),
  hermesReviewDecisionFirstViewport: path.join("evaluation", "hermes-review-decision-first-viewport-2026-08-27", "report.json"),
  hermesReviewCandidatePosition: path.join("evaluation", "hermes-review-candidate-position-2026-08-27", "report.json"),
  hermesKnowledgeReviewEvidenceInspector: path.join("evaluation", "hermes-knowledge-review-evidence-inspector-2026-08-14", "report.json"),
  hermesReviewEventFactTraceability: path.join("evaluation", "hermes-knowledge-review-event-facts-2026-08-26", "report.json"),
  hermesReviewTraceBlocks: path.join("evaluation", "hermes-knowledge-review-trace-blocks-2026-08-26", "report.json"),
  hermesReviewTraceMatrix: path.join("evaluation", "hermes-knowledge-review-trace-matrix-2026-08-26", "report.json"),
  liveDocumentSecondaryGrounding: path.join("evaluation", "live-document-secondary-grounding-2026-07-25", "report.json"),
  liveDocumentSeedProfileIsolation: path.join("evaluation", "live-document-seed-profile-isolation-2026-07-25", "report.json"),
  koshaNextExactCandidateAudit: path.join("evaluation", "kosha-next-exact-candidate-audit-2026-07-22", "report.json"),
  koshaExactPromotionPacket: path.join("evaluation", "kosha-exact-promotion-packet-2026-07-22", "report.json"),
  rlsLlmWikiApprovalPreflight: path.join("evaluation", "rls-llm-wiki-approval-preflight-current-2026-07-20", "report.json"),
  approvalRunway: path.join("evaluation", "northstar-approval-runway-2026-07-21", "report.json"),
  sifEmbeddingPreflight: path.join("evaluation", "sif-embedding-gate", "approval-preflight-report.json"),
  shareGeneratedSessionPerception: path.join("evaluation", "share-generated-session-perception-2026-07-22", "report.json"),
  shareRecipientLongContentFixture: path.join("evaluation", "share-recipient-long-content-fixture-2026-07-25", "report.json"),
  shareExactSessionBoundary: path.join("evaluation", "share-exact-session-boundary-2026-07-22", "report.json"),
  shareRecipientAckApprovalPreflight: path.join("evaluation", "share-recipient-ack-approval-preflight-current-2026-07-19", "report.json"),
  sharePublicSessionStorageReadiness: path.join("evaluation", "share-public-session-storage-readiness-2026-07-23", "report.json"),
  sharePublicSessionStorageApproval: path.join("evaluation", "share-public-session-storage-approval-2026-07-23", "report.json"),
  documentsCockpitWorkbenchGeometry: path.join("evaluation", "documents-cockpit-workbench-geometry-2026-07-22", "report.json"),
  documentSectionNavigation: path.join("evaluation", "document-section-navigation-2026-08-02", "report.json"),
  documentAllAuthoringGeometry: path.join("evaluation", "document-all-authoring-geometry-2026-08-02", "after-live", "report.json"),
  documentAuthoringPaneMargin: path.join("evaluation", "document-authoring-pane-margin-2026-08-02", "report.json"),
  documentRawDrilldownGeometry: path.join("evaluation", "document-raw-drilldown-geometry-2026-08-02", "after-live", "report.json"),
  documentsLongFormIA: path.join("evaluation", "documents-long-form-ia-2026-07-22", "report.json"),
  boundedWorkbenchDod: path.join("evaluation", "workspace-bounded-workbench-dod-2026-07-22", "report.json"),
  boundedWorkbenchCurrent: path.join("evaluation", "workspace-bounded-workbench-current-2026-07-22", "report.json"),
});

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * @param {unknown} value
 */
function asString(value) {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * @param {unknown} value
 */
function asBoolean(value) {
  return value === true;
}

/**
 * @param {string} rootDir
 */
function gitHead(rootDir) {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: rootDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "unknown";
  }
}

/**
 * @param {string} rootDir
 * @param {string} possibleAncestor
 * @param {string} descendant
 */
function gitIsAncestor(rootDir, possibleAncestor, descendant) {
  if (!possibleAncestor || !descendant) return false;
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", possibleAncestor, descendant], {
      cwd: rootDir,
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {string} filePath
 */
function isEvidenceOrToolingPath(filePath) {
  const normalized = filePath.replace(/\\/g, "/");
  return normalized.startsWith("evaluation/")
    || normalized.startsWith("docs/")
    || normalized.startsWith("scripts/")
    || normalized.startsWith("tests/");
}

/**
 * @param {string} rootDir
 * @param {string} baseCommit
 * @param {string} headCommit
 */
function gitChangedPaths(rootDir, baseCommit, headCommit) {
  if (!baseCommit || !headCommit) return [];
  try {
    const output = execFileSync("git", ["diff", "--name-only", `${baseCommit}..${headCommit}`], {
      cwd: rootDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return output ? output.split(/\r?\n/u).map((item) => item.trim()).filter(Boolean) : [];
  } catch {
    return [];
  }
}

/**
 * @param {string} rootDir
 * @param {string} relativePath
 */
function readJson(rootDir, relativePath) {
  return JSON.parse(fs.readFileSync(path.join(rootDir, relativePath), "utf8"));
}

/**
 * @param {string} rootDir
 * @param {string} relativePath
 */
function readOptionalJson(rootDir, relativePath) {
  const absolutePath = path.join(rootDir, relativePath);
  if (!fs.existsSync(absolutePath)) return {};
  return JSON.parse(fs.readFileSync(absolutePath, "utf8"));
}

/**
 * @param {{ buildInfoFile: string, buildInfoUrl: string }} options
 */
async function readBuildInfo(options) {
  if (options.buildInfoFile) {
    return JSON.parse(fs.readFileSync(options.buildInfoFile, "utf8"));
  }
  const response = await fetch(options.buildInfoUrl);
  if (!response.ok) {
    throw new Error(`Failed to read build info: ${response.status} ${response.statusText}`);
  }
  return await response.json();
}

/**
 * @param {string[]} argv
 */
function parseArgs(argv) {
  /** @type {{ rootDir: string, outputDir: string, buildInfoFile: string, buildInfoUrl: string }} */
  const options = {
    rootDir: REPO_ROOT,
    outputDir: DEFAULT_OUTPUT_DIR,
    buildInfoFile: "",
    buildInfoUrl: DEFAULT_BUILD_INFO_URL,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === "--root" && next) {
      options.rootDir = next;
      index += 1;
    } else if (arg === "--output" && next) {
      options.outputDir = next;
      index += 1;
    } else if (arg === "--build-info-file" && next) {
      options.buildInfoFile = path.resolve(options.rootDir, next);
      index += 1;
    } else if (arg === "--build-info-url" && next) {
      options.buildInfoUrl = next;
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      console.log("Usage: node scripts/northstar_next_runway.mjs [--root DIR] [--output DIR] [--build-info-file FILE] [--build-info-url URL]");
      process.exit(0);
    } else {
      throw new Error(`Unknown or incomplete argument: ${arg}`);
    }
  }
  return options;
}

/**
 * @param {unknown} approvalRunway
 * @param {unknown} shareRecipientAckApproval
 */
function approvalGates(approvalRunway, shareRecipientAckApproval, distributedAdmissionApproval) {
  if (!isRecord(approvalRunway) || !Array.isArray(approvalRunway.approvalGates)) {
    throw new Error("Approval runway report is missing approvalGates.");
  }
  const gates = approvalRunway.approvalGates.filter(isRecord).map((gate) => {
    const gateId = asString(gate.id);
    const distributedReady = isRecord(distributedAdmissionApproval)
      && distributedAdmissionApproval.readyForOperatorReview === true;
    const distributedGate = gateId === "distributed_admission_activation";
    return {
      gate: gateId,
      state: asString(gate.state),
      evidencePath: asString(gate.evidencePath),
      readyForOperatorReview: distributedGate
        ? distributedReady
        : asBoolean(gate.readyForOperatorReview),
      currentSafetyLock: distributedGate && !distributedReady
        ? "approval_packet_missing_or_invalid"
        : asString(gate.currentSafetyLock),
      approvalNeeded: Array.isArray(gate.approvalNeeded) ? gate.approvalNeeded.map(asString).filter(Boolean) : [],
      forbiddenUntilApproved: Array.isArray(gate.forbiddenUntilApproved) ? gate.forbiddenUntilApproved.map(asString).filter(Boolean) : [],
    };
  });
  if (gates.some((gate) => gate.gate === "share_recipient_ack_approval")) {
    return gates;
  }

  const ack = isRecord(shareRecipientAckApproval) ? shareRecipientAckApproval : {};
  const ackReady = asString(ack.overall) === "approval_ready_open"
    && asBoolean(ack.approvalRequired) === true
    && asBoolean(ack.liveDataMutationApproved) === false
    && asBoolean(ack.dbMutationPerformed) === false
    && asBoolean(ack.providerMessageSent) === false
    && asBoolean(ack.productionShareSessionCreated) === false
    && asBoolean(ack.productionReadConfirmationInserted) === false
    && Array.isArray(ack.failedCheckIds)
    && ack.failedCheckIds.length === 0;
  return [
    {
      gate: "share_recipient_ack_approval",
      state: "approval_gated",
      evidencePath: ARTIFACTS.shareRecipientAckApprovalPreflight,
      readyForOperatorReview: ackReady,
      currentSafetyLock: ackReady
        ? "live_data_mutation_approval_required"
        : "preflight_missing_or_invalid",
      approvalNeeded: [
        "approve a disposable production workpack and worker pair",
        "approve workpack_share_sessions and workpack_read_confirmations inserts",
        "measure invited-recipient ACK readback without provider dispatch",
      ],
      forbiddenUntilApproved: [
        "production share-session creation",
        "production recipient read-confirmation insertion",
        "real invited-recipient ACK readback claim",
      ],
    },
    ...gates,
  ];
}

/**
 * @param {unknown} launch
 */
function launchReadinessSummary(launch) {
  if (!isRecord(launch)) return {};
  const apiAsk = isRecord(launch.apiAsk) ? launch.apiAsk : {};
  const runtimeBoundary = isRecord(launch.runtimeBoundary) ? launch.runtimeBoundary : {};
  return {
    verdict: asString(launch.verdict),
    safeLaunchDemoClaimAllowed: asBoolean(launch.safeLaunchDemoClaimAllowed),
    guidedPilotClaimAllowed: asBoolean(launch.guidedPilotClaimAllowed),
    fullyAutomatedLaunchClaimAllowed: asBoolean(launch.fullyAutomatedLaunchClaimAllowed),
    selfServeSaasLaunchClaimAllowed: asBoolean(launch.selfServeSaasLaunchClaimAllowed),
    providerDispatchLiveClaimed: asBoolean(launch.providerDispatchLiveClaimed),
    apiAskOk: asBoolean(apiAsk.ok),
    apiAskStatus: typeof apiAsk.status === "number" && Number.isFinite(apiAsk.status)
      ? apiAsk.status
      : null,
    apiAskErrorCode: asString(apiAsk.errorCode),
    apiAskRateLimit: asString(apiAsk.rateLimit),
    apiAskWorkUnit: asString(apiAsk.workUnit),
    dispatchCalled: asBoolean(launch.dispatchCalled),
    distributedAdmissionBlocked: asBoolean(runtimeBoundary.distributedAdmissionBlocked),
    distributedAdmissionActivation: asString(runtimeBoundary.distributedAdmissionActivation),
    exactSavedShareVerdict: asString(runtimeBoundary.exactSavedShareVerdict),
    documentCoverage: isRecord(launch.documentCoverage) ? launch.documentCoverage : {},
  };
}

/**
 * @param {unknown} quality
 */
function documentQualityGroundingSummary(quality) {
  if (!isRecord(quality)) return {};
  const tests = isRecord(quality.focusedTests) ? quality.focusedTests : {};
  const boundaries = isRecord(quality.boundaries) ? quality.boundaries : {};
  const contracts = isRecord(quality.verifiedContracts) ? quality.verifiedContracts : {};
  return {
    verdict: asString(quality.verdict),
    sourceHead: asString(quality.sourceHead),
    productionCommit: asString(quality.productionCommit),
    testsStatus: asString(tests.status),
    testsPassed: typeof tests.testsPassed === "number" ? tests.testsPassed : 0,
    sifKoshaLawBeforeLlmProse: asBoolean(contracts.sifKoshaLawBeforeLlmProse),
    llmRoleNaturalizeOnly: asBoolean(contracts.llmRoleNaturalizeOnly),
    unsupportedProviderHazardsRejected: asBoolean(contracts.providerAuthoredUnsupportedHazardsRejected),
    qualityContractBlocksIncompleteOutputs: asBoolean(contracts.qualityContractBlocksIncompleteOutputs),
    koshaSupportNotLawMandate: asBoolean(contracts.koshaSupportingEvidenceIsNotLawMandate),
    exactKoshaMaterializationCovered: asBoolean(contracts.exactKoshaMaterializationCovered),
    liveModelSampleExcellenceClaimed: asBoolean(boundaries.liveModelSampleExcellenceClaimed),
    dbMutationPerformed: asBoolean(boundaries.dbMutationPerformed),
    providerDispatchLiveClaimed: asBoolean(boundaries.providerDispatchLiveClaimed),
  };
}

/**
 * @param {unknown} matrix
 */
function liveDocumentQualityMatrixSummary(matrix) {
  if (!isRecord(matrix)) return {};
  const afterLive = isRecord(matrix.afterLive) ? matrix.afterLive : {};
  const boundaries = isRecord(matrix.boundaries) ? matrix.boundaries : {};
  return {
    verdict: asString(matrix.verdict),
    sourceHead: asString(matrix.sourceHead),
    productionCommit: asString(matrix.productionCommitAtGeneration),
    sourceHeadMatchesProduction: asBoolean(matrix.sourceHeadMatchesProduction),
    scenarioCount: Array.isArray(matrix.scenarios) ? matrix.scenarios.length : 0,
    livePassed: typeof afterLive.pass === "number" ? afterLive.pass : 0,
    liveFailed: typeof afterLive.fail === "number" ? afterLive.fail : 0,
    structuredRiskRowsPresent: asBoolean(afterLive.structuredRiskRowsPresent),
    structuredRiskControlsDistinct: asBoolean(afterLive.structuredRiskControlsDistinct),
    foreignWorkerScenarioRelevance: asBoolean(afterLive.foreignWorkerScenarioRelevance),
    dbMutationPerformed: asBoolean(boundaries.dbMutationPerformed),
    shareSessionCreated: asBoolean(boundaries.shareSessionCreated),
    providerDispatchLiveClaimed: asBoolean(boundaries.providerDispatchLiveClaimed),
    externalProviderCalled: asBoolean(boundaries.externalProviderCalled),
    exactSavedShareSessionReproduced: asBoolean(boundaries.exactSavedShareSessionReproduced),
  };
}

/**
 * @param {unknown} matrix
 */
function liveDocumentQualityStressMatrixSummary(matrix) {
  if (!isRecord(matrix)) return {};
  const afterLive = isRecord(matrix.afterLive) ? matrix.afterLive : {};
  const boundaries = isRecord(matrix.boundaries) ? matrix.boundaries : {};
  return {
    verdict: asString(matrix.verdict),
    sourceHead: asString(matrix.sourceHead),
    productCommit: asString(matrix.productCommit),
    productionCommit: asString(matrix.productionCommitAtGeneration),
    productCommitIncludedInProduction: asBoolean(matrix.productCommitIncludedInProduction),
    livePassed: typeof afterLive.pass === "number" ? afterLive.pass : 0,
    liveFailed: typeof afterLive.fail === "number" ? afterLive.fail : 0,
    dbMutationPerformed: asBoolean(boundaries.dbMutationPerformed),
    shareSessionCreated: asBoolean(boundaries.shareSessionCreated),
    providerDispatchPerformed: asBoolean(boundaries.providerDispatchPerformed),
    exactSavedShareSessionReproduced: asBoolean(boundaries.exactSavedShareSessionReproduced),
  };
}

/**
 * @param {unknown} matrix
 */
function liveDocumentFieldIsolationSummary(matrix) {
  if (!isRecord(matrix)) return {};
  const afterLive = isRecord(matrix.afterLive) ? matrix.afterLive : {};
  const normal = isRecord(afterLive.normal) ? afterLive.normal : {};
  const stress = isRecord(afterLive.stress) ? afterLive.stress : {};
  const boundary = isRecord(matrix.mutationBoundary) ? matrix.mutationBoundary : {};
  return {
    verdict: asString(matrix.verdict),
    sourceHead: asString(matrix.sourceHead),
    evidenceHeadAtLiveVerification: asString(matrix.evidenceHeadAtLiveVerification),
    productionCommit: asString(matrix.productionCommitAtLiveVerification),
    livePassed: (typeof normal.pass === "number" ? normal.pass : 0)
      + (typeof stress.pass === "number" ? stress.pass : 0),
    liveFailed: (typeof normal.fail === "number" ? normal.fail : 0)
      + (typeof stress.fail === "number" ? stress.fail : 0),
    liveAfterDeploymentPending: asBoolean(matrix.liveAfterDeploymentPending),
    dbMutationPerformed: asBoolean(boundary.dbMutationPerformed),
    shareSessionCreated: asBoolean(boundary.shareSessionCreated),
    providerDispatchCalled: asBoolean(boundary.providerDispatchCalled),
    exactSavedShareSessionReproduced: asBoolean(boundary.exactSavedShareSessionReproduced),
  };
}

/**
 * @param {unknown} matrix
 */
function liveKoshaExactMaterializationSummary(matrix) {
  if (!isRecord(matrix)) return {};
  const afterLive = isRecord(matrix.afterLive) ? matrix.afterLive : {};
  const boundary = isRecord(matrix.mutationBoundary) ? matrix.mutationBoundary : {};
  return {
    verdict: asString(matrix.verdict),
    sourceHead: asString(matrix.sourceHead),
    productCommit: asString(matrix.productCommit),
    productionCommit: asString(matrix.productionCommit),
    productCommitMatchesProduction: asBoolean(matrix.productCommitMatchesProduction),
    livePassed: typeof afterLive.pass === "number" ? afterLive.pass : 0,
    liveFailed: typeof afterLive.fail === "number" ? afterLive.fail : 0,
    liveAfterDeploymentPending: asBoolean(matrix.liveAfterDeploymentPending),
    dbMutationPerformed: asBoolean(boundary.dbMutationPerformed),
    shareSessionCreated: asBoolean(boundary.shareSessionCreated),
    providerDispatchCalled: asBoolean(boundary.providerDispatchCalled),
    exactTrustRegistryExpanded: asBoolean(boundary.exactTrustRegistryExpanded),
  };
}

/**
 * @param {unknown} review
 */
function liveDocumentWordingReviewSummary(review) {
  if (!isRecord(review)) return {};
  const afterLive = isRecord(review.afterLive) ? review.afterLive : {};
  const mutationBoundary = isRecord(review.mutationBoundary) ? review.mutationBoundary : {};
  return {
    verdict: asString(review.verdict),
    sourceHead: asString(review.sourceHead),
    productCommit: asString(review.productCommit),
    productionCommit: asString(review.productionCommitAfterDeployment),
    livePassed: typeof afterLive.pass === "number" ? afterLive.pass : 0,
    liveFailed: typeof afterLive.fail === "number" ? afterLive.fail : 0,
    liveAfterDeploymentPending: asBoolean(review.liveAfterDeploymentPending),
    dbMutationPerformed: asBoolean(mutationBoundary.dbMutationPerformed),
    shareSessionCreated: asBoolean(mutationBoundary.shareSessionCreated),
    providerDispatchCalled: asBoolean(mutationBoundary.providerDispatchCalled),
    exactSavedShareReproduced: asBoolean(mutationBoundary.exactSavedShareReproduced),
    humanReviewStillRequired: isRecord(review.claimBoundary)
      && asBoolean(review.claimBoundary.humanReviewStillRequired),
  };
}

/**
 * @param {unknown} review
 */
function liveDocumentBroadReviewSummary(review) {
  if (!isRecord(review)) return {};
  const stages = isRecord(review.stages) ? review.stages : {};
  const before = isRecord(stages.beforeRemediation) ? stages.beforeRemediation : {};
  const afterLive = isRecord(stages.afterLive) ? stages.afterLive : {};
  const mutationBoundary = isRecord(review.mutationBoundary) ? review.mutationBoundary : {};
  const permits = Array.isArray(review.workPermitMatrix) ? review.workPermitMatrix.filter(isRecord) : [];
  return {
    verdict: asString(review.verdict),
    sourceHead: asString(review.sourceHead),
    productCommit: asString(review.productCommit),
    productionCommit: asString(review.productionCommit),
    uiDocumentCount: typeof review.uiDocumentCount === "number" ? review.uiDocumentCount : 0,
    integrityRequiredCount: typeof review.integrityRequiredCount === "number" ? review.integrityRequiredCount : 0,
    reviewedDocumentCount: typeof review.reviewedDocumentCount === "number" ? review.reviewedDocumentCount : 0,
    beforePassed: typeof before.pass === "number" ? before.pass : 0,
    beforeFailed: typeof before.fail === "number" ? before.fail : 0,
    beforeMissingUnexpected: typeof before.missingUnexpectedCount === "number" ? before.missingUnexpectedCount : 0,
    livePassed: typeof afterLive.pass === "number" ? afterLive.pass : 0,
    liveFailed: typeof afterLive.fail === "number" ? afterLive.fail : 0,
    liveMissingUnexpected: typeof afterLive.missingUnexpectedCount === "number" ? afterLive.missingUnexpectedCount : 0,
    workPermitPresentNonEmpty: permits.filter((item) => (
      item.status === "presentNonEmpty" && item.verdict === "PASS"
    )).length,
    dbMutationPerformed: asBoolean(mutationBoundary.dbMutationPerformed),
    shareSessionCreated: asBoolean(mutationBoundary.shareSessionCreated),
    providerDispatchCalled: asBoolean(mutationBoundary.providerDispatchCalled),
    exactSavedShareReproduced: asBoolean(mutationBoundary.exactSavedShareReproduced),
    exactSavedShareVerdict: asString(mutationBoundary.exactSavedShareVerdict),
  };
}

/**
 * @param {unknown} review
 */
function liveDocumentSecondaryGroundingSummary(review) {
  if (!isRecord(review)) return {};
  const stages = isRecord(review.stages) ? review.stages : {};
  const afterLive = isRecord(stages.afterLive) ? stages.afterLive : {};
  const mutationBoundary = isRecord(review.mutationBoundary) ? review.mutationBoundary : {};
  return {
    verdict: asString(review.verdict),
    sourceHead: asString(review.sourceHead),
    productionCommit: asString(review.productionCommit),
    livePassed: typeof afterLive.pass === "number" ? afterLive.pass : 0,
    liveFailed: typeof afterLive.fail === "number" ? afterLive.fail : 0,
    secondaryReviewed: typeof afterLive.secondaryReviewed === "number" ? afterLive.secondaryReviewed : 0,
    secondaryPassed: typeof afterLive.secondaryPassed === "number" ? afterLive.secondaryPassed : 0,
    crossScenarioLeakageCount: typeof afterLive.crossScenarioLeakageCount === "number"
      ? afterLive.crossScenarioLeakageCount
      : 0,
    missingUnexpectedCount: typeof afterLive.missingUnexpectedCount === "number"
      ? afterLive.missingUnexpectedCount
      : 0,
    dbMutationPerformed: asBoolean(mutationBoundary.dbMutationPerformed),
    shareSessionCreated: asBoolean(mutationBoundary.shareSessionCreated),
    providerDispatchCalled: asBoolean(mutationBoundary.providerDispatchCalled),
    exactSavedShareReproduced: asBoolean(mutationBoundary.exactSavedShareReproduced),
    exactSavedShareVerdict: asString(mutationBoundary.exactSavedShareVerdict),
  };
}

/**
 * @param {unknown} review
 */
function liveDocumentEditorialReviewSummary(review) {
  if (!isRecord(review)) return {};
  const afterLive = isRecord(review.afterLive) ? review.afterLive : {};
  const mutationBoundary = isRecord(review.mutationBoundary) ? review.mutationBoundary : {};
  const evidenceBoundary = isRecord(review.evidenceBoundary) ? review.evidenceBoundary : {};
  return {
    verdict: asString(review.verdict),
    productCommit: asString(review.productCommit),
    productionCommit: asString(review.productionCommit),
    scenarioCount: typeof review.scenarioCount === "number" ? review.scenarioCount : 0,
    reviewedDocumentSurfaceCount: typeof review.reviewedDocumentSurfaceCount === "number"
      ? review.reviewedDocumentSurfaceCount
      : 0,
    livePassed: typeof afterLive.pass === "number" ? afterLive.pass : 0,
    liveFailed: typeof afterLive.fail === "number" ? afterLive.fail : 0,
    placeholderFindingCount: typeof afterLive.placeholderFindingCount === "number" ? afterLive.placeholderFindingCount : 0,
    legalOverclaimFindingCount: typeof afterLive.legalOverclaimFindingCount === "number" ? afterLive.legalOverclaimFindingCount : 0,
    awkwardCompositionFindingCount: typeof afterLive.awkwardCompositionFindingCount === "number" ? afterLive.awkwardCompositionFindingCount : 0,
    evidenceDomainMismatchCount: typeof afterLive.evidenceDomainMismatchCount === "number" ? afterLive.evidenceDomainMismatchCount : 0,
    exactLineOveruseCount: typeof afterLive.exactLineOveruseCount === "number" ? afterLive.exactLineOveruseCount : 0,
    nearDuplicateLineOveruseCount: typeof afterLive.nearDuplicateLineOveruseCount === "number" ? afterLive.nearDuplicateLineOveruseCount : 0,
    humanReviewCompleted: asBoolean(review.humanReviewCompleted),
    dbMutationPerformed: asBoolean(mutationBoundary.dbMutationPerformed),
    shareSessionCreated: asBoolean(mutationBoundary.shareSessionCreated),
    providerDispatchCalled: asBoolean(mutationBoundary.providerDispatchCalled),
    exactSavedShareReproduced: asBoolean(mutationBoundary.exactSavedShareReproduced),
    exactSavedShareVerdict: asString(evidenceBoundary.exactSavedShareVerdict),
  };
}

/**
 * @param {unknown} review
 */
function liveDocumentEditorialDuplicateClassificationSummary(review) {
  if (!isRecord(review)) return {};
  const beforeLive = isRecord(review.beforeLive) ? review.beforeLive : {};
  const afterLive = isRecord(review.afterLive) ? review.afterLive : {};
  const mutationBoundary = isRecord(review.mutationBoundary) ? review.mutationBoundary : {};
  const remainingBoundaries = isRecord(review.remainingBoundaries) ? review.remainingBoundaries : {};
  return {
    verdict: asString(review.verdict),
    productCommit: asString(review.productCommit),
    productionCommit: asString(review.productionCommit),
    reviewedDocumentSurfaceCount: typeof review.reviewedDocumentSurfaceCount === "number"
      ? review.reviewedDocumentSurfaceCount
      : 0,
    beforeGenericTemplateOveruseCount: typeof beforeLive.genericTemplateOveruseCount === "number"
      ? beforeLive.genericTemplateOveruseCount
      : 0,
    liveGenericTemplateOveruseCount: typeof afterLive.genericTemplateOveruseCount === "number"
      ? afterLive.genericTemplateOveruseCount
      : 0,
    exactLineOveruseCount: typeof afterLive.exactLineOveruseCount === "number"
      ? afterLive.exactLineOveruseCount
      : 0,
    nearDuplicateLineOveruseCount: typeof afterLive.nearDuplicateLineOveruseCount === "number"
      ? afterLive.nearDuplicateLineOveruseCount
      : 0,
    humanReviewCompleted: asBoolean(review.humanReviewCompleted),
    dbMutationPerformed: asBoolean(mutationBoundary.dbMutationPerformed),
    shareSessionCreated: asBoolean(mutationBoundary.shareSessionCreated),
    providerDispatchCalled: asBoolean(mutationBoundary.providerDispatchCalled),
    exactSavedShareReproduced: asBoolean(mutationBoundary.exactSavedShareReproduced),
    exactSavedShareVerdict: asString(remainingBoundaries.exactSavedShareVerdict),
  };
}

/**
 * @param {unknown} review
 */
function liveDocumentEditorialNearClassificationSummary(review) {
  if (!isRecord(review)) return {};
  const before = isRecord(review.before) ? review.before : {};
  const beforeCategories = isRecord(before.nearCategories) ? before.nearCategories : {};
  const afterLive = isRecord(review.afterLive) ? review.afterLive : {};
  const afterCategories = isRecord(afterLive.nearCategories) ? afterLive.nearCategories : {};
  const remainingBoundaries = isRecord(review.remainingBoundaries) ? review.remainingBoundaries : {};
  return {
    verdict: asString(review.verdict),
    sourceHead: asString(review.sourceHead),
    productionCommit: asString(review.productionCommit),
    beforeNearDuplicateLineOveruseCount: typeof before.nearDuplicateLineOveruseCount === "number"
      ? before.nearDuplicateLineOveruseCount
      : 0,
    beforeHumanReviewRequiredCount: typeof beforeCategories["human-review-required"] === "number"
      ? beforeCategories["human-review-required"]
      : 0,
    livePassed: typeof afterLive.pass === "number" ? afterLive.pass : 0,
    liveFailed: typeof afterLive.fail === "number" ? afterLive.fail : 0,
    liveNearDuplicateLineOveruseCount: typeof afterLive.nearDuplicateLineOveruseCount === "number"
      ? afterLive.nearDuplicateLineOveruseCount
      : 0,
    liveHumanReviewRequiredCount: typeof afterCategories["human-review-required"] === "number"
      ? afterCategories["human-review-required"]
      : 0,
    rolePrefixVariantCount: typeof afterCategories["document-role-prefix-variant"] === "number"
      ? afterCategories["document-role-prefix-variant"]
      : 0,
    independentContextCount: typeof afterCategories["independent-document-context"] === "number"
      ? afterCategories["independent-document-context"]
      : 0,
    hazardConsistencyCount: typeof afterCategories["cross-document-hazard-consistency"] === "number"
      ? afterCategories["cross-document-hazard-consistency"]
      : 0,
    controlConsistencyCount: typeof afterCategories["cross-document-control-consistency"] === "number"
      ? afterCategories["cross-document-control-consistency"]
      : 0,
    humanReviewCompleted: asBoolean(afterLive.humanReviewCompleted),
    exactSavedShareVerdict: asString(remainingBoundaries.exactSavedShareVerdict),
  };
}

/**
 * @param {unknown} report
 */
function productCapabilityTruthSummary(report) {
  if (!isRecord(report)) return {};
  const liveChecks = isRecord(report.liveChecks) ? report.liveChecks : {};
  const providerDispatch = isRecord(liveChecks.providerDispatch) ? liveChecks.providerDispatch : {};
  const briefing = isRecord(liveChecks.briefingSettingsUnauthenticated)
    ? liveChecks.briefingSettingsUnauthenticated
    : {};
  const photo = isRecord(liveChecks.photoVisionReadiness) ? liveChecks.photoVisionReadiness : {};
  const uiChecks = isRecord(report.uiChecks) ? report.uiChecks : {};
  const aiModes = isRecord(uiChecks.aiGenerationModes) ? uiChecks.aiGenerationModes : {};
  const mutationBoundary = isRecord(report.mutationBoundary) ? report.mutationBoundary : {};
  const remainingBoundaries = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  return {
    verdict: asString(report.verdict),
    sourceHead: asString(report.sourceHead),
    productionCommit: asString(report.productionCommit),
    dispatchMode: asString(providerDispatch.mode),
    dispatchReason: asString(providerDispatch.reason),
    briefingEmailReady: asBoolean(briefing.emailReady),
    photoVisionReady: asBoolean(photo.ready),
    photoAcceptedOnly: asBoolean(photo.acceptedOnly),
    aiModes: Array.isArray(aiModes.modes) ? aiModes.modes.filter((mode) => typeof mode === "string") : [],
    providerDispatchCalled: asBoolean(mutationBoundary.providerDispatchCalled),
    photoAnalysisPostCalled: asBoolean(mutationBoundary.photoAnalysisPostCalled),
    exactSavedShareVerdict: asString(remainingBoundaries.exactSavedShareVerdict),
    documentsShareIaVerdict: asString(remainingBoundaries.documentsShareIaVerdict),
  };
}

/**
 * @param {unknown} report
 */
function ciSupplyChainFullSuiteSummary(report) {
  if (!isRecord(report)) return {};
  const production = isRecord(report.productionBuild) ? report.productionBuild : {};
  const github = isRecord(report.githubActions) ? report.githubActions : {};
  const suite = isRecord(github.fullSuite) ? github.fullSuite : {};
  const localVerification = isRecord(report.localVerification) ? report.localVerification : {};
  const localSuite = isRecord(localVerification.fullSuite) ? localVerification.fullSuite : {};
  const localBuild = isRecord(localVerification.build) ? localVerification.build : {};
  const boundaries = isRecord(report.boundaries) ? report.boundaries : {};
  return {
    verdict: asString(report.verdict),
    sourceHead: asString(report.sourceHead),
    productionCommit: asString(production.commitSha),
    githubRunId: typeof github.runId === "number" ? github.runId : null,
    githubConclusion: asString(github.conclusion),
    pinnedCheckout: asString(github.pinnedCheckout),
    pinnedSetupNode: asString(github.pinnedSetupNode),
    testsPassed: typeof suite.testsPassed === "number" ? suite.testsPassed : null,
    testsSkipped: typeof suite.testsSkipped === "number" ? suite.testsSkipped : null,
    testsTotal: typeof localSuite.testsTotal === "number" ? localSuite.testsTotal : null,
    testFilesPassed: typeof suite.testFilesPassed === "number" ? suite.testFilesPassed : null,
    testFilesSkipped: typeof suite.testFilesSkipped === "number" ? suite.testFilesSkipped : null,
    staticPages: typeof localBuild.staticPages === "number" ? localBuild.staticPages : null,
    build: asString(github.build),
    exactSavedShareVerdict: asString(boundaries.exactSavedShareVerdict),
    approvalGatedBoundariesClosed: asBoolean(boundaries.approvalGatedBoundariesClosed),
  };
}

/**
 * @param {unknown} report
 */
function knowledgePreparationCapabilityTruthSummary(report) {
  if (!isRecord(report)) return {};
  const contract = isRecord(report.currentSourceContract) ? report.currentSourceContract : {};
  const live = isRecord(report.liveVerification) ? report.liveVerification : {};
  const remaining = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  return {
    verdict: asString(report.verdict),
    sourceHead: asString(report.sourceHead),
    productionCommit: asString(report.productionCommit),
    productionIncludesProductCommit: asBoolean(report.productionIncludesProductCommit),
    distributedAdmissionCode: asString(contract.distributedAdmissionFailurePublicCode),
    temporaryConcurrencyCode: asString(contract.temporaryConcurrencyPublicCode),
    configurationLockDistinguishedFromLoad: asBoolean(contract.configurationLockDistinguishedFromLoad),
    publicationState: asString(contract.publicationState),
    publishAllowed: asBoolean(contract.publishAllowed),
    liveStatus: asString(live.status),
    behavioralProbeExecuted: asBoolean(live.behavioralProbeExecuted),
    enhancedLlmRuntime: asString(remaining.enhancedLlmRuntime),
    authenticatedLivePreparationProbe: asString(remaining.authenticatedLivePreparationProbe),
    llmWikiPublication: asString(remaining.llmWikiPublication),
    supabaseRlsLaunchIsolation: asString(remaining.supabaseRlsLaunchIsolation),
    exactSavedShareVerdict: asString(remaining.exactSavedShareVerdict),
    securityCompleteClaimAllowed: asBoolean(remaining.securityCompleteClaimAllowed),
  };
}

/**
 * @param {unknown} report
 */
function launchOperationsReadinessSummary(report) {
  if (!isRecord(report)) return {};
  const rows = Array.isArray(report.rows) ? report.rows.filter(isRecord) : [];
  const productionBuild = isRecord(report.productionBuild) ? report.productionBuild : {};
  const boundaries = isRecord(report.boundaries) ? report.boundaries : {};
  return {
    verdict: asString(report.verdict),
    sourceHead: asString(report.sourceHead),
    productCommit: asString(report.productCommit),
    productionCommit: asString(productionBuild.commitSha),
    rowCount: rows.length,
    firstViewportCount: rows.filter((row) => row.firstViewport === true).length,
    desktopFourColumnCount: rows.filter((row) => asString(row.name).startsWith("desktop-")
      && row.localHorizontalScroll === false
      && row.cardCount === 4).length,
    mobileLocalScrollCount: rows.filter((row) => asString(row.name).startsWith("mobile-")
      && row.localHorizontalScroll === true
      && row.cardCount === 4).length,
    browserConsoleErrorCount: rows.reduce((sum, row) => sum + (
      Array.isArray(row.browserConsoleErrors) ? row.browserConsoleErrors.length : 0
    ), 0),
    publicAdmission: rows.length ? asString(rows[0].publicAdmission) : "",
    providerDispatch: rows.length ? asString(rows[0].providerDispatch) : "",
    photoVision: rows.length ? asString(rows[0].photoVision) : "",
    distributedAdmissionConfigured: asBoolean(boundaries.distributedAdmissionConfigured),
    providerDispatchReady: asBoolean(boundaries.providerDispatchReady),
    fullyAutomatedLaunchClaimAllowed: asBoolean(boundaries.fullyAutomatedLaunchClaimAllowed),
    exactSavedShareVerdict: asString(boundaries.exactSavedShareVerdict),
  };
}

/**
 * @param {Record<string, unknown>} summary
 */
function launchOperationsReadinessProven(summary) {
  return summary.verdict === "PASS_LIVE_PRODUCTION_LAUNCH_OPERATIONS_CONFIGURATION_TRUTH"
    && summary.sourceHead === summary.productionCommit
    && summary.rowCount === 4
    && summary.firstViewportCount === 4
    && summary.desktopFourColumnCount === 2
    && summary.mobileLocalScrollCount === 2
    && summary.browserConsoleErrorCount === 0
    && summary.publicAdmission === "unavailable"
    && summary.providerDispatch === "preview_only"
    && summary.photoVision === "ready"
    && summary.distributedAdmissionConfigured === false
    && summary.providerDispatchReady === false
    && summary.fullyAutomatedLaunchClaimAllowed === false
    && summary.exactSavedShareVerdict === "MISSING_EVIDENCE";
}

/**
 * @param {unknown} report
 */
function distributedAdmissionActivationApprovalSummary(report) {
  if (!isRecord(report)) return {};
  const requestedChange = isRecord(report.requestedChange) ? report.requestedChange : {};
  const sharedCredentialBoundary = isRecord(report.sharedCredentialBoundary)
    ? report.sharedCredentialBoundary
    : {};
  const mutationBoundary = isRecord(report.mutationBoundary) ? report.mutationBoundary : {};
  const checks = Array.isArray(report.checks) ? report.checks.filter(isRecord) : [];
  const requiredVariables = Array.isArray(requestedChange.requiredVariables)
    ? requestedChange.requiredVariables.map(asString).filter(Boolean)
    : [];
  const noMutation = report.ephemeralRedisMutationPerformed === false
    && mutationBoundary.dbSchemaMutationPerformed === false
    && mutationBoundary.dbDataMutationPerformed === false
    && mutationBoundary.providerCallPerformed === false
    && mutationBoundary.providerDispatchCalled === false
    && mutationBoundary.shareSessionCreated === false
    && mutationBoundary.vectorOrEmbeddingMutationPerformed === false
    && mutationBoundary.wikiPublicationPerformed === false
    && mutationBoundary.koshaRegistryMutationPerformed === false;
  const readyForOperatorReview = asString(report.verdict)
      === "APPROVAL_REQUIRED_DISTRIBUTED_ADMISSION_ACTIVATION_NO_MUTATION"
    && asString(report.overall) === "approval_ready_open"
    && report.operatorApprovalRequired === true
    && report.configurationChangeApproved === false
    && report.activationPerformed === false
    && report.runtimeBehavioralProbePerformed === false
    && report.secretValuesInspected === false
    && report.secretValuesRecorded === false
    && requiredVariables.length === 2
    && requiredVariables.includes("UPSTASH_REDIS_REST_URL")
    && requiredVariables.includes("UPSTASH_REDIS_REST_TOKEN")
    && asString(requestedChange.environment) === "Production"
    && requestedChange.remoteHermesLedgerModeChangeRequested === false
    && sharedCredentialBoundary.remoteHermesLedgerEnabledByThisChange === false
    && checks.length >= 7
    && checks.every((item) => item.passed === true)
    && Array.isArray(report.failedCheckIds)
    && report.failedCheckIds.length === 0
    && noMutation
    && asString(mutationBoundary.exactSavedShareVerdict) === "MISSING_EVIDENCE";
  return {
    verdict: asString(report.verdict),
    sourceSha: asString(report.sourceSha),
    readyForOperatorReview,
    operatorApprovalRequired: asBoolean(report.operatorApprovalRequired),
    configurationChangeApproved: asBoolean(report.configurationChangeApproved),
    activationPerformed: asBoolean(report.activationPerformed),
    runtimeBehavioralProbePerformed: asBoolean(report.runtimeBehavioralProbePerformed),
    secretValuesInspected: asBoolean(report.secretValuesInspected),
    secretValuesRecorded: asBoolean(report.secretValuesRecorded),
    requiredVariables,
    remoteHermesLedgerEnabledByThisChange: asBoolean(sharedCredentialBoundary.remoteHermesLedgerEnabledByThisChange),
    noMutation,
    exactSavedShareVerdict: asString(mutationBoundary.exactSavedShareVerdict),
  };
}

/**
 * @param {unknown} report
 */
function documentExportCapabilityTruthSummary(report) {
  if (!isRecord(report)) return {};
  const capability = isRecord(report.capability) ? report.capability : {};
  const admission = isRecord(capability.admission) ? capability.admission : {};
  const browser = isRecord(report.browser) ? report.browser : {};
  const desktop = isRecord(browser.desktop) ? browser.desktop : {};
  const mobile = isRecord(browser.mobile) ? browser.mobile : {};
  const remainingBoundaries = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  return {
    verdict: asString(report.verdict),
    sourceHead: asString(report.sourceHead),
    productCommit: asString(report.productCommit),
    productionCommit: asString(report.productionCommit),
    admissionMode: asString(admission.mode),
    admissionReason: asString(admission.reason),
    admissionReady: asBoolean(admission.ready),
    desktopPanelWidth: typeof desktop.panelWidth === "number" ? desktop.panelWidth : 0,
    desktopBetaButtonWidth: typeof desktop.legacyXlsButtonWidth === "number" ? desktop.legacyXlsButtonWidth : 0,
    mobilePanelWidth: typeof mobile.panelWidth === "number" ? mobile.panelWidth : 0,
    mobileBetaButtonWidth: typeof mobile.legacyXlsButtonWidth === "number" ? mobile.legacyXlsButtonWidth : 0,
    distributedAdmissionActivation: asString(remainingBoundaries.distributedAdmissionActivation),
    exactSavedShareVerdict: asString(remainingBoundaries.exactSavedShareVerdict),
    fullyAutomatedLaunchClaimAllowed: asBoolean(remainingBoundaries.fullyAutomatedLaunchClaimAllowed),
  };
}

/** @param {unknown} report */
function ontologyViewportWorkbenchSummary(report) {
  if (!isRecord(report)) return {};
  const browser = isRecord(report.browser) ? report.browser : {};
  const mobile = isRecord(browser.mobile) ? browser.mobile : {};
  const remainingBoundaries = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  return {
    verdict: asString(report.verdict),
    sourceHead: asString(report.sourceHead),
    productCommit: asString(report.productCommit),
    productionCommit: asString(report.productionCommit),
    rowCount: typeof browser.rowCount === "number" ? browser.rowCount : 0,
    passCount: typeof browser.passCount === "number" ? browser.passCount : 0,
    maxBodyRatio: typeof browser.maxBodyRatio === "number" ? browser.maxBodyRatio : 0,
    mobileTaskSwitchVerifiedCount: typeof mobile.taskSwitchVerifiedCount === "number" ? mobile.taskSwitchVerifiedCount : 0,
    exactSavedShareVerdict: asString(remainingBoundaries.exactSavedShareVerdict),
    fullyAutomatedLaunchClaimAllowed: asBoolean(remainingBoundaries.fullyAutomatedLaunchClaimAllowed),
  };
}

/** @param {unknown} report */
function knowledgeViewportWorkbenchSummary(report) {
  if (!isRecord(report)) return {};
  const browser = isRecord(report.browser) ? report.browser : {};
  const progressiveDisclosure = isRecord(browser.progressiveDisclosure) ? browser.progressiveDisclosure : {};
  const remainingBoundaries = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  return {
    verdict: asString(report.verdict),
    sourceHead: asString(report.sourceHead),
    productCommit: asString(report.productCommit),
    productionCommit: asString(report.productionCommit),
    rowCount: typeof browser.rowCount === "number" ? browser.rowCount : null,
    passCount: typeof browser.passCount === "number" ? browser.passCount : null,
    maxBodyRatio: typeof browser.maxBodyRatio === "number" ? browser.maxBodyRatio : null,
    visiblePanelCountPerRow: typeof browser.visiblePanelCountPerRow === "number" ? browser.visiblePanelCountPerRow : null,
    reachableSectionCountPerRow: typeof browser.reachableSectionCountPerRow === "number" ? browser.reachableSectionCountPerRow : null,
    technicalDisclosureCount: typeof progressiveDisclosure.technicalDisclosureCount === "number" ? progressiveDisclosure.technicalDisclosureCount : null,
    referenceDisclosureCount: typeof progressiveDisclosure.referenceDisclosureCount === "number" ? progressiveDisclosure.referenceDisclosureCount : null,
    wikiDisclosureCount: typeof progressiveDisclosure.wikiDisclosureCount === "number" ? progressiveDisclosure.wikiDisclosureCount : null,
    governanceDisclosureCount: typeof progressiveDisclosure.governanceDisclosureCount === "number" ? progressiveDisclosure.governanceDisclosureCount : null,
    defaultOpenDisclosureCount: typeof progressiveDisclosure.defaultOpenDisclosureCount === "number" ? progressiveDisclosure.defaultOpenDisclosureCount : null,
    exclusiveDisclosureGroups: asBoolean(progressiveDisclosure.exclusiveDisclosureGroups),
    maxMobileTechnicalScrollRatio: typeof progressiveDisclosure.maxMobileTechnicalScrollRatio === "number" ? progressiveDisclosure.maxMobileTechnicalScrollRatio : null,
    maxMobileReferenceScrollRatio: typeof progressiveDisclosure.maxMobileReferenceScrollRatio === "number" ? progressiveDisclosure.maxMobileReferenceScrollRatio : null,
    maxMobileWikiScrollRatio: typeof progressiveDisclosure.maxMobileWikiScrollRatio === "number" ? progressiveDisclosure.maxMobileWikiScrollRatio : null,
    maxMobileGovernanceScrollRatio: typeof progressiveDisclosure.maxMobileGovernanceScrollRatio === "number" ? progressiveDisclosure.maxMobileGovernanceScrollRatio : null,
    firstDisclosureInsidePanel: asBoolean(progressiveDisclosure.firstDisclosureInsidePanel),
    firstReviewStateInsidePanel: asBoolean(progressiveDisclosure.firstReviewStateInsidePanel),
    exactSavedShareVerdict: asString(remainingBoundaries.exactSavedShareVerdict),
    llmWikiPublicationVerdict: asString(remainingBoundaries.llmWikiPublicationVerdict),
    sifEmbeddingRuntimeVerdict: asString(remainingBoundaries.sifEmbeddingRuntimeVerdict),
    fullyAutomatedLaunchClaimAllowed: asBoolean(remainingBoundaries.fullyAutomatedLaunchClaimAllowed),
  };
}

/** @param {unknown} report */
function llmWikiCandidateContentReadinessSummary(report) {
  if (!isRecord(report)) return {};
  const local = isRecord(report.local) ? report.local : {};
  const afterLive = isRecord(report.afterLive) ? report.afterLive : {};
  const readiness = isRecord(report.contentReadinessContract) ? report.contentReadinessContract : {};
  const mutationBoundary = isRecord(report.mutationBoundary) ? report.mutationBoundary : {};
  const remainingBoundaries = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  return {
    verdict: asString(report.verdict),
    sourceHead: asString(report.sourceHead),
    productCommit: asString(report.productCommit),
    productionCommit: asString(report.productionCommit),
    localVerdict: asString(local.verdict),
    localPassed: typeof local.passedCount === "number" ? local.passedCount : 0,
    localViewportCount: typeof local.viewportCount === "number" ? local.viewportCount : 0,
    localFailed: typeof local.failedCount === "number" ? local.failedCount : 0,
    liveVerdict: asString(afterLive.verdict),
    livePassed: typeof afterLive.passedCount === "number" ? afterLive.passedCount : 0,
    liveViewportCount: typeof afterLive.viewportCount === "number" ? afterLive.viewportCount : 0,
    liveFailed: typeof afterLive.failedCount === "number" ? afterLive.failedCount : 0,
    productionAligned: asBoolean(afterLive.productionAligned),
    browserErrorCount: typeof afterLive.browserErrorCount === "number" ? afterLive.browserErrorCount : 0,
    requiredSectionCount: typeof readiness.requiredSectionCount === "number" ? readiness.requiredSectionCount : 0,
    readyFixtureCount: typeof readiness.readyFixtureCount === "number" ? readiness.readyFixtureCount : 0,
    revisionRequiredFixtureCount: typeof readiness.revisionRequiredFixtureCount === "number" ? readiness.revisionRequiredFixtureCount : 0,
    selectedReadinessPanelCount: typeof readiness.selectedReadinessPanelCount === "number" ? readiness.selectedReadinessPanelCount : 0,
    approvalFailsClosedForRevision: asBoolean(readiness.approvalFailsClosedForRevision),
    revisionGuidanceVisible: asBoolean(readiness.revisionGuidanceVisible),
    revisionIssueCount: typeof readiness.revisionIssueCount === "number" ? readiness.revisionIssueCount : 0,
    revisionIssueCodesExposed: asBoolean(readiness.revisionIssueCodesExposed),
    approvalFailsClosedAfterConfirmation: asBoolean(readiness.approvalFailsClosedAfterConfirmation),
    keepSiteOnlyAvailableForRevision: asBoolean(readiness.keepSiteOnlyAvailableForRevision),
    rejectAvailableForRevision: asBoolean(readiness.rejectAvailableForRevision),
    humanReviewCompleted: asBoolean(readiness.humanReviewCompleted),
    publicationState: asString(readiness.publicationState),
    publishAllowed: asBoolean(readiness.publishAllowed),
    dbMutationPerformed: asBoolean(mutationBoundary.dbMutationPerformed),
    providerDispatchCalled: asBoolean(mutationBoundary.providerDispatchCalled),
    shareSessionCreated: asBoolean(mutationBoundary.shareSessionCreated),
    ontologyPublicationPerformed: asBoolean(mutationBoundary.ontologyPublicationPerformed),
    vectorOrEmbeddingMutationPerformed: asBoolean(mutationBoundary.vectorOrEmbeddingMutationPerformed),
    wikiPublicationPerformed: asBoolean(mutationBoundary.wikiPublicationPerformed),
    koshaRegistryMutationPerformed: asBoolean(mutationBoundary.koshaRegistryMutationPerformed),
    exactSavedShareVerdict: asString(remainingBoundaries.exactSavedShareVerdict),
    llmWikiPublication: asString(remainingBoundaries.llmWikiPublication),
    supabaseRlsLaunchIsolation: asString(remainingBoundaries.supabaseRlsLaunchIsolation),
  };
}

/** @param {ReturnType<typeof llmWikiCandidateContentReadinessSummary>} summary */
function llmWikiCandidateContentReadinessProven(summary) {
  return summary.verdict === "PASS_LIVE_PRODUCTION_LLM_WIKI_CANDIDATE_CONTENT_READINESS"
    && summary.localVerdict === "PASS_CURRENT_SOURCE_LOCAL_LLM_WIKI_CANDIDATE_CONTENT_READINESS"
    && summary.localPassed === 8
    && summary.localViewportCount === 8
    && summary.localFailed === 0
    && summary.liveVerdict === "PASS_LIVE_PRODUCTION_LLM_WIKI_CANDIDATE_CONTENT_READINESS"
    && summary.livePassed === 8
    && summary.liveViewportCount === 8
    && summary.liveFailed === 0
    && summary.productionAligned === true
    && summary.browserErrorCount === 0
    && summary.requiredSectionCount === 4
    && summary.readyFixtureCount === 2
    && summary.revisionRequiredFixtureCount === 1
    && summary.selectedReadinessPanelCount === 1
    && summary.approvalFailsClosedForRevision === true
    && summary.revisionGuidanceVisible === true
    && summary.revisionIssueCount === 4
    && summary.revisionIssueCodesExposed === false
    && summary.approvalFailsClosedAfterConfirmation === true
    && summary.keepSiteOnlyAvailableForRevision === true
    && summary.rejectAvailableForRevision === true
    && summary.humanReviewCompleted === false
    && summary.publicationState === "unpublished"
    && summary.publishAllowed === false
    && summary.dbMutationPerformed === false
    && summary.providerDispatchCalled === false
    && summary.shareSessionCreated === false
    && summary.ontologyPublicationPerformed === false
    && summary.vectorOrEmbeddingMutationPerformed === false
    && summary.wikiPublicationPerformed === false
    && summary.koshaRegistryMutationPerformed === false
    && summary.exactSavedShareVerdict === "MISSING_EVIDENCE"
    && summary.llmWikiPublication === "APPROVAL_GATED"
    && summary.supabaseRlsLaunchIsolation === "APPROVAL_GATED";
}

/** @param {unknown} report */
function llmWikiCandidateContentMatrixSummary(report) {
  if (!isRecord(report)) return {};
  const beforeEvidenceVisibilityLive = isRecord(report.evidenceVisibilityBeforeLive) ? report.evidenceVisibilityBeforeLive : {};
  const afterLocal = isRecord(report.evidenceVisibilityAfterLocal) ? report.evidenceVisibilityAfterLocal : {};
  const afterLive = isRecord(report.evidenceVisibilityAfterLive) ? report.evidenceVisibilityAfterLive : {};
  const beforeEventSemanticLive = isRecord(report.eventSemanticBeforeLive) ? report.eventSemanticBeforeLive : {};
  const afterEventSemanticLocal = isRecord(report.eventSemanticAfterLocal) ? report.eventSemanticAfterLocal : {};
  const afterEventSemanticLive = isRecord(report.eventSemanticAfterLive) ? report.eventSemanticAfterLive : {};
  const afterLiveProvider = isRecord(report.afterLiveProvider) ? report.afterLiveProvider : {};
  const contentContract = isRecord(report.contentContract) ? report.contentContract : {};
  const scopeBoundary = isRecord(report.scopeBoundary) ? report.scopeBoundary : {};
  const mutationBoundary = isRecord(report.mutationBoundary) ? report.mutationBoundary : {};
  const remainingBoundaries = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  return {
    verdict: asString(report.verdict),
    productCommit: asString(report.productCommit),
    liveAfterDeploymentRequired: asBoolean(report.liveAfterDeploymentRequired),
    localVerdict: asString(afterEventSemanticLocal.verdict),
    localPassed: typeof afterEventSemanticLocal.passedCount === "number" ? afterEventSemanticLocal.passedCount : 0,
    localFailed: typeof afterEventSemanticLocal.failedCount === "number" ? afterEventSemanticLocal.failedCount : 0,
    liveVerdict: asString(afterEventSemanticLive.verdict),
    sourceHead: asString(afterEventSemanticLive.sourceHead),
    productionCommit: asString(afterEventSemanticLive.productionCommit),
    livePassed: typeof afterEventSemanticLive.passedCount === "number" ? afterEventSemanticLive.passedCount : 0,
    liveFailed: typeof afterEventSemanticLive.failedCount === "number" ? afterEventSemanticLive.failedCount : 0,
    beforeVisibleEvidenceTraceCount: typeof beforeEvidenceVisibilityLive.reviewerEvidenceTraceCount === "number" ? beforeEvidenceVisibilityLive.reviewerEvidenceTraceCount : 0,
    liveVisibleEvidenceTraceCount: typeof afterLive.reviewerEvidenceTraceCount === "number" ? afterLive.reviewerEvidenceTraceCount : 0,
    liveTechnicalGuidanceBoundaryCount: typeof afterLive.technicalGuidanceBoundaryCount === "number" ? afterLive.technicalGuidanceBoundaryCount : 0,
    liveLawCandidateBoundaryCount: typeof afterLive.lawCandidateBoundaryCount === "number" ? afterLive.lawCandidateBoundaryCount : 0,
    beforeEventSemanticGroundingCount: typeof beforeEventSemanticLive.eventSemanticGroundingCount === "number" ? beforeEventSemanticLive.eventSemanticGroundingCount : 0,
    liveEventSemanticGroundingCount: typeof afterEventSemanticLive.eventSemanticGroundingCount === "number" ? afterEventSemanticLive.eventSemanticGroundingCount : 0,
    livePrivateEventExposureCount: typeof afterEventSemanticLive.privateEventExposureCount === "number" ? afterEventSemanticLive.privateEventExposureCount : 0,
    providerVerdict: asString(afterLiveProvider.verdict),
    providerPassed: typeof afterLiveProvider.passedCount === "number" ? afterLiveProvider.passedCount : 0,
    providerFailed: typeof afterLiveProvider.failedCount === "number" ? afterLiveProvider.failedCount : 0,
    providerHttpStatuses: Array.isArray(afterLiveProvider.httpStatuses) ? afterLiveProvider.httpStatuses : [],
    providerRuntimeBlocker: asString(afterLiveProvider.runtimeBlocker),
    scenarioCount: typeof contentContract.scenarioCount === "number" ? contentContract.scenarioCount : 0,
    requiredSectionCount: typeof contentContract.requiredSectionCount === "number" ? contentContract.requiredSectionCount : 0,
    scenarioSpecificTermGroupsRequired: asBoolean(contentContract.scenarioSpecificTermGroupsRequired),
    textualHazardGroundingRequired: asBoolean(contentContract.textualHazardGroundingRequired),
    matchedHazardMetadataAloneAccepted: asBoolean(contentContract.matchedHazardMetadataAloneAccepted),
    reviewerVisibleEvidenceTraceRequired: asBoolean(contentContract.reviewerVisibleEvidenceTraceRequired),
    scenarioSpecificOfficialSourceTermsRequired: asBoolean(contentContract.scenarioSpecificOfficialSourceTermsRequired),
    technicalGuidanceAndLawRolesSeparated: asBoolean(contentContract.technicalGuidanceAndLawRolesSeparated),
    explicitEventReviewFactsRequired: asBoolean(contentContract.explicitEventReviewFactsRequired),
    arbitraryRawPayloadAcceptedAsReviewFact: asBoolean(contentContract.arbitraryRawPayloadAcceptedAsReviewFact),
    privateEventTermExposureAllowed: asBoolean(contentContract.privateEventTermExposureAllowed),
    placeholderFindingCount: typeof contentContract.placeholderFindingCount === "number" ? contentContract.placeholderFindingCount : 0,
    legalOverclaimFindingCount: typeof contentContract.legalOverclaimFindingCount === "number" ? contentContract.legalOverclaimFindingCount : 0,
    humanReviewCompleted: asBoolean(contentContract.humanReviewCompleted),
    publicationState: asString(contentContract.publicationState),
    publishAllowed: asBoolean(contentContract.publishAllowed),
    actualProductionCandidateQueueRead: asBoolean(scopeBoundary.actualProductionCandidateQueueRead),
    routeFixtureAcceptedAsGenerationProof: asBoolean(scopeBoundary.routeControlledBrowserFixtureAcceptedAsGenerationProof),
    deterministicFallbackProvenCurrentSource: asBoolean(scopeBoundary.deterministicFallbackProvenCurrentSource),
    deterministicFallbackProvenLive: asBoolean(scopeBoundary.deterministicFallbackProvenLive),
    evidenceVisibilityContractProvenLive: asBoolean(scopeBoundary.evidenceVisibilityContractProvenLive),
    eventSemanticGroundingProvenCurrentSource: asBoolean(scopeBoundary.eventSemanticGroundingProvenCurrentSource),
    eventSemanticGroundingProvenLive: asBoolean(scopeBoundary.eventSemanticGroundingProvenLive),
    enhancedLlmGenerationProvenLive: asBoolean(scopeBoundary.enhancedLlmGenerationProvenLive),
    enhancedLlmRuntimeState: asString(scopeBoundary.enhancedLlmRuntimeState),
    dbMutationPerformed: asBoolean(mutationBoundary.dbMutationPerformed),
    providerDispatchCalled: asBoolean(mutationBoundary.providerDispatchCalled),
    shareSessionCreated: asBoolean(mutationBoundary.shareSessionCreated),
    ontologyPublicationPerformed: asBoolean(mutationBoundary.ontologyPublicationPerformed),
    vectorOrEmbeddingMutationPerformed: asBoolean(mutationBoundary.vectorOrEmbeddingMutationPerformed),
    koshaRegistryMutationPerformed: asBoolean(mutationBoundary.koshaRegistryMutationPerformed),
    exactSavedShareVerdict: asString(remainingBoundaries.exactSavedShareVerdict),
    llmWikiPublication: asString(remainingBoundaries.llmWikiPublication),
    supabaseRlsLaunchIsolation: asString(remainingBoundaries.supabaseRlsLaunchIsolation),
  };
}

/** @param {ReturnType<typeof llmWikiCandidateContentMatrixSummary>} summary */
function llmWikiCandidateContentMatrixProven(summary) {
  return summary.verdict === "PASS_LIVE_PRODUCTION_WIKI_EVENT_SEMANTIC_AND_EVIDENCE_VISIBILITY_LLM_ENHANCED_RUNTIME_BLOCKED"
    && summary.liveAfterDeploymentRequired === false
    && summary.localVerdict === "PASS_CURRENT_SOURCE_LOCAL_WIKI_CANDIDATE_FALLBACK_CONTENT_MATRIX"
    && summary.localPassed === 5
    && summary.localFailed === 0
    && summary.liveVerdict === "PASS_LIVE_PRODUCTION_WIKI_CANDIDATE_FALLBACK_CONTENT_MATRIX"
    && /^[0-9a-f]{40}$/u.test(summary.sourceHead || "")
    && summary.sourceHead === summary.productionCommit
    && summary.livePassed === 5
    && summary.liveFailed === 0
    && summary.beforeVisibleEvidenceTraceCount === 0
    && summary.liveVisibleEvidenceTraceCount === 5
    && summary.liveTechnicalGuidanceBoundaryCount === 5
    && summary.liveLawCandidateBoundaryCount === 5
    && summary.beforeEventSemanticGroundingCount === 0
    && summary.liveEventSemanticGroundingCount === 5
    && summary.livePrivateEventExposureCount === 0
    && summary.providerVerdict === "RED_LIVE_PRODUCTION_LLM_WIKI_CANDIDATE_CONTENT_MATRIX"
    && summary.providerPassed === 0
    && summary.providerFailed === 5
    && summary.providerHttpStatuses.length === 5
    && summary.providerHttpStatuses.every((status) => status === 503)
    && summary.providerRuntimeBlocker === "distributed_rate_limit_unavailable_before_ai_generation"
    && summary.scenarioCount === 5
    && summary.requiredSectionCount === 4
    && summary.scenarioSpecificTermGroupsRequired === true
    && summary.textualHazardGroundingRequired === true
    && summary.matchedHazardMetadataAloneAccepted === false
    && summary.reviewerVisibleEvidenceTraceRequired === true
    && summary.scenarioSpecificOfficialSourceTermsRequired === true
    && summary.technicalGuidanceAndLawRolesSeparated === true
    && summary.explicitEventReviewFactsRequired === true
    && summary.arbitraryRawPayloadAcceptedAsReviewFact === false
    && summary.privateEventTermExposureAllowed === false
    && summary.placeholderFindingCount === 0
    && summary.legalOverclaimFindingCount === 0
    && summary.humanReviewCompleted === false
    && summary.publicationState === "unpublished"
    && summary.publishAllowed === false
    && summary.actualProductionCandidateQueueRead === false
    && summary.routeFixtureAcceptedAsGenerationProof === false
    && summary.deterministicFallbackProvenCurrentSource === true
    && summary.deterministicFallbackProvenLive === true
    && summary.evidenceVisibilityContractProvenLive === true
    && summary.eventSemanticGroundingProvenCurrentSource === true
    && summary.eventSemanticGroundingProvenLive === true
    && summary.enhancedLlmGenerationProvenLive === false
    && summary.enhancedLlmRuntimeState === "BLOCKED_DISTRIBUTED_RATE_LIMIT_CONFIGURATION"
    && summary.dbMutationPerformed === false
    && summary.providerDispatchCalled === false
    && summary.shareSessionCreated === false
    && summary.ontologyPublicationPerformed === false
    && summary.vectorOrEmbeddingMutationPerformed === false
    && summary.koshaRegistryMutationPerformed === false
    && summary.exactSavedShareVerdict === "MISSING_EVIDENCE"
    && summary.llmWikiPublication === "APPROVAL_GATED"
    && summary.supabaseRlsLaunchIsolation === "APPROVAL_GATED";
}

/** @param {unknown} report */
function llmWikiSifEvidenceMatrixSummary(report) {
  if (!isRecord(report)) return {};
  const afterLocal = isRecord(report.afterLocal) ? report.afterLocal : {};
  const afterLive = isRecord(report.afterLive) ? report.afterLive : {};
  const contentContract = isRecord(report.contentContract) ? report.contentContract : {};
  const mutationBoundary = isRecord(report.mutationBoundary) ? report.mutationBoundary : {};
  const remainingBoundaries = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  return {
    verdict: asString(report.verdict),
    productCommit: asString(report.productCommit),
    sourceHead: asString(report.sourceHead),
    productionCommit: asString(report.productionCommit),
    liveAfterDeploymentRequired: asBoolean(report.liveAfterDeploymentRequired),
    localPassed: typeof afterLocal.passedCount === "number" ? afterLocal.passedCount : 0,
    localFailed: typeof afterLocal.failedCount === "number" ? afterLocal.failedCount : 0,
    livePassed: typeof afterLive.passedCount === "number" ? afterLive.passedCount : 0,
    liveFailed: typeof afterLive.failedCount === "number" ? afterLive.failedCount : 0,
    liveSifEvidenceBoundaryCount: typeof afterLive.sifEvidenceBoundaryCount === "number" ? afterLive.sifEvidenceBoundaryCount : 0,
    liveTechnicalGuidanceBoundaryCount: typeof afterLive.technicalGuidanceBoundaryCount === "number" ? afterLive.technicalGuidanceBoundaryCount : 0,
    liveLawCandidateBoundaryCount: typeof afterLive.lawCandidateBoundaryCount === "number" ? afterLive.lawCandidateBoundaryCount : 0,
    liveEventSemanticGroundingCount: typeof afterLive.eventSemanticGroundingCount === "number" ? afterLive.eventSemanticGroundingCount : 0,
    livePrivateEventExposureCount: typeof afterLive.privateEventExposureCount === "number" ? afterLive.privateEventExposureCount : 0,
    authorityOrder: Array.isArray(contentContract.authorityOrder) ? contentContract.authorityOrder.map(asString) : [],
    scenarioCount: typeof contentContract.scenarioCount === "number" ? contentContract.scenarioCount : 0,
    reviewerVisibleSifEvidenceRequired: asBoolean(contentContract.reviewerVisibleSifEvidenceRequired),
    sifProvenanceRequired: asBoolean(contentContract.sifProvenanceRequired),
    sifIncidentControlEvidenceIsNonStatutory: asBoolean(contentContract.sifIncidentControlEvidenceIsNonStatutory),
    koshaTechnicalGuidanceIsNonStatutory: asBoolean(contentContract.koshaTechnicalGuidanceIsNonStatutory),
    statutoryClaimsRequireLawProvenance: asBoolean(contentContract.statutoryClaimsRequireLawProvenance),
    privateSifTitleExposureAllowed: asBoolean(contentContract.privateSifTitleExposureAllowed),
    humanReviewCompleted: asBoolean(contentContract.humanReviewCompleted),
    publicationState: asString(contentContract.publicationState),
    publishAllowed: asBoolean(contentContract.publishAllowed),
    dbMutationPerformed: asBoolean(mutationBoundary.dbMutationPerformed),
    providerDispatchCalled: asBoolean(mutationBoundary.providerDispatchCalled),
    shareSessionCreated: asBoolean(mutationBoundary.shareSessionCreated),
    ontologyPublicationPerformed: asBoolean(mutationBoundary.ontologyPublicationPerformed),
    vectorOrEmbeddingMutationPerformed: asBoolean(mutationBoundary.vectorOrEmbeddingMutationPerformed),
    koshaRegistryMutationPerformed: asBoolean(mutationBoundary.koshaRegistryMutationPerformed),
    actualProductionCandidateQueueRead: asBoolean(remainingBoundaries.actualProductionCandidateQueueRead),
    enhancedLlmRuntime: asString(remainingBoundaries.enhancedLlmRuntime),
    exactSavedShareVerdict: asString(remainingBoundaries.exactSavedShareVerdict),
    llmWikiPublication: asString(remainingBoundaries.llmWikiPublication),
    supabaseRlsLaunchIsolation: asString(remainingBoundaries.supabaseRlsLaunchIsolation),
  };
}

/** @param {ReturnType<typeof llmWikiSifEvidenceMatrixSummary>} summary */
function llmWikiSifEvidenceMatrixProven(summary) {
  return summary.verdict === "PASS_LIVE_PRODUCTION_SIF_KOSHA_LAW_WIKI_CANDIDATE_EVIDENCE"
    && summary.liveAfterDeploymentRequired === false
    && /^[0-9a-f]{40}$/u.test(summary.sourceHead || "")
    && summary.sourceHead === summary.productionCommit
    && summary.localPassed === 5 && summary.localFailed === 0
    && summary.livePassed === 5 && summary.liveFailed === 0
    && summary.liveSifEvidenceBoundaryCount === 5
    && summary.liveTechnicalGuidanceBoundaryCount === 5
    && summary.liveLawCandidateBoundaryCount === 5
    && summary.liveEventSemanticGroundingCount === 5
    && summary.livePrivateEventExposureCount === 0
    && summary.authorityOrder.join(",") === "sif,kosha,law"
    && summary.scenarioCount === 5
    && summary.reviewerVisibleSifEvidenceRequired === true
    && summary.sifProvenanceRequired === true
    && summary.sifIncidentControlEvidenceIsNonStatutory === true
    && summary.koshaTechnicalGuidanceIsNonStatutory === true
    && summary.statutoryClaimsRequireLawProvenance === true
    && summary.privateSifTitleExposureAllowed === false
    && summary.humanReviewCompleted === false
    && summary.publicationState === "unpublished"
    && summary.publishAllowed === false
    && summary.dbMutationPerformed === false
    && summary.providerDispatchCalled === false
    && summary.shareSessionCreated === false
    && summary.ontologyPublicationPerformed === false
    && summary.vectorOrEmbeddingMutationPerformed === false
    && summary.koshaRegistryMutationPerformed === false
    && summary.actualProductionCandidateQueueRead === false
    && summary.enhancedLlmRuntime === "BLOCKED_DISTRIBUTED_RATE_LIMIT_CONFIGURATION"
    && summary.exactSavedShareVerdict === "MISSING_EVIDENCE"
    && summary.llmWikiPublication === "APPROVAL_GATED"
    && summary.supabaseRlsLaunchIsolation === "APPROVAL_GATED";
}

/**
 * @param {unknown} report
 */
function dependencySecurityRemediationSummary(report) {
  if (!isRecord(report)) return {};
  const auditBefore = isRecord(report.auditBefore) ? report.auditBefore : {};
  const auditAfter = isRecord(report.auditAfter) ? report.auditAfter : {};
  const remainingBoundaries = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  return {
    verdict: asString(report.verdict),
    sourceHead: asString(report.sourceHead),
    productCommit: asString(report.productCommit),
    productionCommit: isRecord(report.productionBuild) ? asString(report.productionBuild.commitSha) : "",
    beforeVulnerablePackages: typeof auditBefore.totalVulnerablePackages === "number"
      ? auditBefore.totalVulnerablePackages
      : 0,
    liveVulnerablePackages: typeof auditAfter.totalVulnerablePackages === "number"
      ? auditAfter.totalVulnerablePackages
      : 0,
    liveHigh: typeof auditAfter.high === "number" ? auditAfter.high : 0,
    liveModerate: typeof auditAfter.moderate === "number" ? auditAfter.moderate : 0,
    fullRepositorySecurityScanCompleted: asBoolean(remainingBoundaries.fullRepositorySecurityScanCompleted),
    exactSavedShareVerdict: asString(remainingBoundaries.exactSavedShareVerdict),
  };
}

/**
 * @param {unknown} report
 */
function tenantAuthorizationRemediationSummary(report) {
  if (!isRecord(report)) return {};
  const productionBuild = isRecord(report.productionBuild) ? report.productionBuild : {};
  const summary = isRecord(report.summary) ? report.summary : {};
  const remainingBoundaries = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  return {
    verdict: asString(report.verdict),
    sourceHead: asString(report.sourceHead),
    productionCommit: asString(productionBuild.commitSha),
    sourceHeadIsAncestorOfProduction: asBoolean(productionBuild.sourceHeadIsAncestorOfProduction),
    remediatedFindings: typeof summary.greenCount === "number" ? summary.greenCount : 0,
    remainingBeforeFullRescan: typeof remainingBoundaries.reportableFindingCount === "number"
      ? remainingBoundaries.reportableFindingCount
      : 0,
    securityCompleteClaimAllowed: asBoolean(remainingBoundaries.securityCompleteClaimAllowed),
    exactSavedShareVerdict: asString(remainingBoundaries.exactSavedShareVerdict),
  };
}

/**
 * @param {unknown} report
 */
function spreadsheetFormulaNeutralizationSummary(report) {
  if (!isRecord(report)) return {};
  const source = isRecord(report.source) ? report.source : {};
  const changes = isRecord(report.changes) ? report.changes : {};
  const findingClosure = isRecord(changes.findingClosure) ? changes.findingClosure : {};
  const remainingBoundaries = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  return {
    verdict: asString(report.verdict),
    productCommit: asString(source.productCommit),
    evidenceHead: asString(source.evidenceHead),
    productionCommit: asString(source.productionMarkerAtValidation),
    liveAfterProductDeploy: asString(source.liveAfterProductDeploy),
    remediatedFindings: typeof findingClosure.spreadsheetFormulaInjectionFindingsRemediatedInCurrentSource === "number"
      ? findingClosure.spreadsheetFormulaInjectionFindingsRemediatedInCurrentSource
      : 0,
    cumulativeRemediatedFindings: 6,
    remainingBeforeFullRescan: typeof findingClosure.remainingReportableFindingsBeforeFullRescan === "number"
      ? findingClosure.remainingReportableFindingsBeforeFullRescan
      : 0,
    fullRepositoryRescanCompleted: asBoolean(findingClosure.fullRepositoryRescanCompleted),
    securityCompleteClaimAllowed: asBoolean(findingClosure.securityCompleteClaimAllowed),
    exactSavedShareVerdict: asString(remainingBoundaries.exactSavedShareVerdict),
  };
}

/**
 * @param {unknown} report
 */
function publicProviderWorkBudgetSummary(report) {
  if (!isRecord(report)) return {};
  const source = isRecord(report.source) ? report.source : {};
  const changes = isRecord(report.changes) ? report.changes : {};
  const findingClosure = isRecord(changes.findingClosure) ? changes.findingClosure : {};
  const mutationBoundary = isRecord(report.mutationBoundary) ? report.mutationBoundary : {};
  const remainingBoundaries = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  return {
    verdict: asString(report.verdict),
    productCommit: asString(source.productCommit),
    evidenceHead: asString(source.evidenceHead),
    productionCommit: asString(source.productionMarkerAtValidation),
    liveAfterProductDeploy: asString(source.liveAfterProductDeploy),
    remediatedFindings: typeof findingClosure.publicProviderAndUpstreamFindingsRemediatedInCurrentSource === "number"
      ? findingClosure.publicProviderAndUpstreamFindingsRemediatedInCurrentSource
      : 0,
    cumulativeRemediatedFindings: 10,
    remainingBeforeFullRescan: typeof findingClosure.remainingReportableFindingsBeforeFullRescan === "number"
      ? findingClosure.remainingReportableFindingsBeforeFullRescan
      : 0,
    fullRepositoryRescanCompleted: asBoolean(findingClosure.fullRepositoryRescanCompleted),
    securityCompleteClaimAllowed: asBoolean(findingClosure.securityCompleteClaimAllowed),
    productionProviderLoadTestPerformed: asBoolean(mutationBoundary.productionProviderLoadTestPerformed),
    exactSavedShareVerdict: asString(remainingBoundaries.exactSavedShareVerdict),
  };
}

/**
 * @param {unknown} report
 */
function documentExportWorkBudgetSummary(report) {
  if (!isRecord(report)) return {};
  const productionBuild = isRecord(report.productionBuild) ? report.productionBuild : {};
  const findingClosure = isRecord(report.findingClosure) ? report.findingClosure : {};
  const openBoundaries = isRecord(report.openBoundaries) ? report.openBoundaries : {};
  return {
    verdict: asString(report.verdict),
    productCommit: asString(report.productCommit),
    productionCommit: asString(productionBuild.commitSha),
    productCommitIsAncestorOfProduction: asBoolean(productionBuild.productCommitIsAncestorOfProduction),
    remediatedFindings: typeof findingClosure.documentExportFindingsRemediatedInLiveProduction === "number"
      ? findingClosure.documentExportFindingsRemediatedInLiveProduction
      : 0,
    cumulativeRemediatedFindings: typeof findingClosure.cumulativeBaselineFindingsWithBoundedRemediationEvidence === "number"
      ? findingClosure.cumulativeBaselineFindingsWithBoundedRemediationEvidence
      : 0,
    remainingBeforeFullRescan: typeof findingClosure.remainingReportableFindingsBeforeFullRescan === "number"
      ? findingClosure.remainingReportableFindingsBeforeFullRescan
      : 0,
    fullRepositoryRescanCompleted: asBoolean(findingClosure.fullRepositoryRescanCompleted),
    securityCompleteClaimAllowed: asBoolean(findingClosure.securityCompleteClaimAllowed),
    exactSavedShareVerdict: asString(openBoundaries.exactSavedShare),
  };
}

/**
 * @param {unknown} report
 */
function fullRepositorySecurityScanSummary(report) {
  if (!isRecord(report)) return {};
  const scan = isRecord(report.scan) ? report.scan : {};
  const severity = isRecord(scan.severity) ? scan.severity : {};
  const remainingBoundaries = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  return {
    verdict: asString(report.verdict),
    sourceHead: asString(report.sourceHead),
    productionCommit: isRecord(report.productionBuild) ? asString(report.productionBuild.commitSha) : "",
    completeness: asString(scan.completeness),
    fileCount: typeof scan.fileCount === "number" ? scan.fileCount : 0,
    candidateCount: typeof scan.candidateCount === "number" ? scan.candidateCount : 0,
    reportableFindingCount: typeof scan.reportableFindingCount === "number" ? scan.reportableFindingCount : 0,
    ignoredCandidateCount: typeof scan.ignoredCandidateCount === "number" ? scan.ignoredCandidateCount : 0,
    deferredCandidateCount: typeof scan.deferredCandidateCount === "number" ? scan.deferredCandidateCount : 0,
    medium: typeof severity.medium === "number" ? severity.medium : 0,
    low: typeof severity.low === "number" ? severity.low : 0,
    fullRepositorySecurityScanCompleted: asBoolean(remainingBoundaries.fullRepositorySecurityScanCompleted),
    securityCompleteClaimAllowed: asBoolean(remainingBoundaries.securityCompleteClaimAllowed),
    remediationRequired: asBoolean(remainingBoundaries.remediationRequired),
    distributedRateLimitResidual: asBoolean(remainingBoundaries.distributedRateLimitResidual),
    exactSavedShareVerdict: asString(remainingBoundaries.exactSavedShareVerdict),
  };
}

/**
 * @param {unknown} review
 */
function documentEditorialReviewCockpitSummary(review, receipt) {
  if (!isRecord(review)) return {};
  const acceptance = isRecord(review.acceptanceContract) ? review.acceptanceContract : {};
  const reviewBoundary = isRecord(review.reviewBoundary) ? review.reviewBoundary : {};
  const mutationBoundary = isRecord(review.mutationBoundary) ? review.mutationBoundary : {};
  const productionBuild = isRecord(review.productionBuild) ? review.productionBuild : {};
  const storageFailureProbe = isRecord(review.storageFailureProbe) ? review.storageFailureProbe : {};
  const rows = Array.isArray(review.results) ? review.results.filter(isRecord) : [];
  const rowsPass = rows.length === 4 && rows.every((row) => {
    const before = isRecord(row.beforeCompletion) ? row.beforeCompletion : {};
    const after = isRecord(row.afterCompletion) ? row.afterCompletion : {};
    return asString(row.verdict) === "PASS"
      && before.bodyHeight === before.viewportHeight
      && before.reviewDocumentCount === 12
      && before.uniqueDocumentCount === 12
      && before.includesRiskAssessment === true
      && before.checkboxCount === 5
      && before.horizontalOverflow === false
      && before.storageStatus === "empty"
      && after.currentWorkpackUnchanged === true
      && after.reviewerStorageKeyCount === 1
      && after.storageStatus === "saved"
      && after.apiRequestCount === 0
      && after.dialogScrollTop === 0
      && row.afterReload?.storageStatus === "restored"
      && row.afterReload?.reviewerInputValue === "자동 검증 검토자"
      && row.afterReload?.persistedReviewer === "자동 검증 검토자";
  });
  const desktopRows = rows.filter((row) => row.width === 1440 && row.height === 723);
  const mobileRows = rows.filter((row) => row.width === 390 && row.height === 723);
  const geometryPass = desktopRows.length === 2
    && desktopRows.every((row) => isRecord(row.beforeCompletion) && row.beforeCompletion.workbenchColumns === 3)
    && mobileRows.length === 2
    && mobileRows.every((row) => isRecord(row.beforeCompletion) && row.beforeCompletion.workbenchColumns === 1);
  const accessibilityRowsPassed = rows.filter((row) => {
    const accessibility = isRecord(row.accessibility) ? row.accessibility : {};
    return accessibility.initialFocusIsCloseButton === true
      && accessibility.initialFocusInsideDialog === true
      && accessibility.arrowNavigationPass === true
      && accessibility.homeNavigationPass === true
      && accessibility.tabpanelLinked === true
      && accessibility.dialogClosedOnEscape === true
      && accessibility.escapeRestoresLaunchFocus === true;
  }).length;
  const noMutation = mutationBoundary.dbMutationPerformed === false
    && mutationBoundary.providerDispatchCalled === false
    && mutationBoundary.shareSessionCreated === false
    && mutationBoundary.vectorRuntimeCalled === false
    && mutationBoundary.wikiPublished === false
    && mutationBoundary.koshaRegistryMutationPerformed === false;
  const storagePass = review.storageFailureProbePass === true
    && storageFailureProbe.verdict === "PASS"
    && storageFailureProbe.status === "error"
    && storageFailureProbe.visible === true;
  const receiptProductionBuild = isRecord(receipt?.productionBuild) ? receipt.productionBuild : {};
  const receiptVerification = isRecord(receipt?.receiptVerification) ? receipt.receiptVerification : {};
  const receiptCompletion = isRecord(receiptVerification.reviewCompletion) ? receiptVerification.reviewCompletion : {};
  const receiptReviewBoundary = isRecord(receipt?.reviewBoundary) ? receipt.reviewBoundary : {};
  const receiptMutationBoundary = isRecord(receipt?.mutationBoundary) ? receipt.mutationBoundary : {};
  const receiptRows = Array.isArray(receipt?.results) ? receipt.results.filter(isRecord) : [];
  const receiptRowsPass = receiptRows.length === 2 && receiptRows.every((row) => {
    const viewport = isRecord(row.viewport) ? row.viewport : {};
    const dialog = isRecord(row.dialog) ? row.dialog : {};
    const checklist = isRecord(row.checklist) ? row.checklist : {};
    return row.bodyHeightUnchanged === true
      && row.bodyHeightBefore === viewport.height
      && row.bodyHeightAfter === viewport.height
      && row.receiptLockedAtZero === true
      && row.reviewerInputVisible === true
      && row.horizontalOverflow === false
      && typeof dialog.right === "number"
      && typeof viewport.width === "number"
      && dialog.right <= viewport.width
      && typeof dialog.bottom === "number"
      && typeof viewport.height === "number"
      && dialog.bottom <= viewport.height
      && asString(checklist.overflowY) === "auto";
  });
  const receiptReady = isRecord(receipt)
    && asString(receipt.verdict) === "PASS_LIVE_PRODUCTION_DOCUMENT_EDITORIAL_REVIEW_RECEIPT"
    && asString(receipt.sourceHead).length > 0
    && asString(receipt.sourceHead) === asString(receiptProductionBuild.commitSha)
    && receipt.sourceHeadMatchesProduction === true
    && asString(receiptProductionBuild.environment) === "production"
    && receiptRowsPass
    && asString(receiptVerification.schemaVersion) === "safeclaw-document-editorial-review-receipt/v2"
    && receiptVerification.documentCount === 12
    && receiptVerification.uniqueDocumentKeyCount === 12
    && receiptVerification.reviewerCheckCount === 5
    && receiptVerification.checksComplete === true
    && receiptVerification.fingerprintsCurrent === true
    && receiptVerification.findingsBound === true
    && asString(receiptVerification.editorialFindingsFingerprint).length > 0
    && receiptVerification.editorialFindingCount > 0
    && receiptVerification.editorialFindingIdsRecorded === true
    && receiptVerification.editorialFindingCategoriesReconcile === true
    && receiptVerification.apiRequestCount === 0
    && receiptCompletion.localChecklistCompleted === true
    && receiptCompletion.editorialFindingsReviewed === true
    && receiptCompletion.reviewerSelfAttested === true
    && receiptCompletion.reviewerIdentityVerified === false
    && receiptCompletion.serverRecorded === false
    && receiptCompletion.approvalGranted === false
    && receiptReviewBoundary.automatedInteractionOnly === true
    && receiptReviewBoundary.humanReviewCompleted === false
    && receiptReviewBoundary.localReceiptProvesHumanIdentity === false
    && receiptReviewBoundary.broadHumanWordingReviewRequired === true
    && receiptMutationBoundary.dbMutationPerformed === false
    && receiptMutationBoundary.providerDispatchCalled === false
    && receiptMutationBoundary.shareSessionCreated === false
    && receiptMutationBoundary.vectorRuntimeCalled === false
    && receiptMutationBoundary.wikiPublished === false
    && receiptMutationBoundary.koshaRegistryMutationPerformed === false
    && asString(receiptMutationBoundary.exactSavedShareVerdict) === "MISSING_EVIDENCE";
  const cockpitReady = asString(review.verdict) === "PASS_LIVE_PRODUCTION_DOCUMENT_EDITORIAL_REVIEW_COCKPIT"
    && review.pass === 4
    && review.fail === 0
    && asString(review.sourceHead).length > 0
    && asString(review.sourceHead) === asString(productionBuild.commitSha)
    && review.sourceHeadMatchesProduction === true
    && asString(productionBuild.environment) === "production"
    && rowsPass
    && geometryPass
    && acceptance.canonicalDocumentCount === 12
    && acceptance.includesRiskAssessment === true
    && acceptance.reviewerCheckCount === 5
    && acceptance.desktopZones === 3
    && acceptance.mobileColumns === 1
    && acceptance.bodyHeightUnchangedWhileOpen === true
    && acceptance.longCopyContained === true
    && acceptance.reviewStateStoredSeparately === true
    && acceptance.reviewerHydrationDoesNotOverwriteStorage === true
    && acceptance.storageLifecycleVisible === true
    && acceptance.storageFailureVisible === true
    && acceptance.editedTextInvalidatesCompletion === true
    && acceptance.automaticReviewCannotClaimHumanCompletion === true
    && acceptance.keyboardRovingTabNavigation === true
    && acceptance.screenReaderTabPanelContract === true
    && acceptance.escapeRestoresLaunchFocus === true
    && accessibilityRowsPassed === 4
    && storagePass
    && reviewBoundary.automatedInteractionOnly === true
    && reviewBoundary.humanReviewCompleted === false
    && reviewBoundary.localCompletionIsApproval === false
    && reviewBoundary.broadHumanWordingReviewRequired === true
    && noMutation
    && asString(mutationBoundary.exactSavedShareVerdict) === "MISSING_EVIDENCE"
    && receiptReady;
  return {
    verdict: asString(review.verdict),
    sourceHead: asString(review.sourceHead),
    productionCommit: asString(productionBuild.commitSha),
    livePassed: typeof review.pass === "number" ? review.pass : 0,
    liveFailed: typeof review.fail === "number" ? review.fail : 0,
    canonicalDocumentCount: typeof acceptance.canonicalDocumentCount === "number" ? acceptance.canonicalDocumentCount : 0,
    reviewerCheckCount: typeof acceptance.reviewerCheckCount === "number" ? acceptance.reviewerCheckCount : 0,
    desktopZones: typeof acceptance.desktopZones === "number" ? acceptance.desktopZones : 0,
    mobileColumns: typeof acceptance.mobileColumns === "number" ? acceptance.mobileColumns : 0,
    keyboardRovingTabNavigation: asBoolean(acceptance.keyboardRovingTabNavigation),
    screenReaderTabPanelContract: asBoolean(acceptance.screenReaderTabPanelContract),
    escapeRestoresLaunchFocus: asBoolean(acceptance.escapeRestoresLaunchFocus),
    accessibilityRowsPassed,
    reviewerHydrationDoesNotOverwriteStorage: acceptance.reviewerHydrationDoesNotOverwriteStorage === true,
    storageLifecycleVisible: acceptance.storageLifecycleVisible === true,
    storageFailureVisible: acceptance.storageFailureVisible === true,
    storageFailureProbePass: storagePass,
    cockpitReady,
    receiptVerdict: isRecord(receipt) ? asString(receipt.verdict) : "missing",
    receiptReady,
    receiptLockedCases: receiptRows.filter((row) => row.receiptLockedAtZero === true).length,
    receiptDocumentCount: typeof receiptVerification.documentCount === "number" ? receiptVerification.documentCount : 0,
    receiptUniqueDocumentKeyCount: typeof receiptVerification.uniqueDocumentKeyCount === "number" ? receiptVerification.uniqueDocumentKeyCount : 0,
    receiptReviewerCheckCount: typeof receiptVerification.reviewerCheckCount === "number" ? receiptVerification.reviewerCheckCount : 0,
    receiptFindingsBound: asBoolean(receiptVerification.findingsBound),
    receiptEditorialFindingCount: typeof receiptVerification.editorialFindingCount === "number" ? receiptVerification.editorialFindingCount : 0,
    receiptEditorialFindingsFingerprintRecorded: asString(receiptVerification.editorialFindingsFingerprint).length > 0,
    receiptEditorialFindingsReviewed: asBoolean(receiptCompletion.editorialFindingsReviewed),
    receiptApiRequestCount: typeof receiptVerification.apiRequestCount === "number" ? receiptVerification.apiRequestCount : 0,
    reviewerSelfAttested: asBoolean(receiptCompletion.reviewerSelfAttested),
    reviewerIdentityVerified: asBoolean(receiptCompletion.reviewerIdentityVerified),
    serverRecorded: asBoolean(receiptCompletion.serverRecorded),
    approvalGranted: asBoolean(receiptCompletion.approvalGranted),
    localReceiptProvesHumanIdentity: asBoolean(receiptReviewBoundary.localReceiptProvesHumanIdentity),
    humanReviewCompleted: asBoolean(reviewBoundary.humanReviewCompleted),
    broadHumanWordingReviewRequired: asBoolean(reviewBoundary.broadHumanWordingReviewRequired),
    dbMutationPerformed: asBoolean(mutationBoundary.dbMutationPerformed),
    providerDispatchCalled: asBoolean(mutationBoundary.providerDispatchCalled),
    shareSessionCreated: asBoolean(mutationBoundary.shareSessionCreated),
    vectorRuntimeCalled: asBoolean(mutationBoundary.vectorRuntimeCalled),
    wikiPublished: asBoolean(mutationBoundary.wikiPublished),
    koshaRegistryMutationPerformed: asBoolean(mutationBoundary.koshaRegistryMutationPerformed),
    exactSavedShareVerdict: asString(mutationBoundary.exactSavedShareVerdict),
  };
}

/** @param {unknown} report */
function repositorySecurityScanReconciliationSummary(report) {
  if (!isRecord(report)) return {};
  const conflict = isRecord(report.sameTargetConflict) ? report.sameTargetConflict : {};
  const later = isRecord(report.laterSecurityChain) ? report.laterSecurityChain : {};
  const resolution = isRecord(report.requiredResolution) ? report.requiredResolution : {};
  const boundaries = isRecord(report.boundaries) ? report.boundaries : {};
  const corrected = isRecord(report.correctedFreshScan) ? report.correctedFreshScan : {};
  return {
    verdict: asString(report.verdict),
    targetRevision: asString(report.targetRevision),
    conflictingScanCount: Array.isArray(report.scans) ? report.scans.length : null,
    findingCountDelta: typeof conflict.findingCountDelta === "number" ? conflict.findingCountDelta : null,
    zeroFindingClaimAccepted: asBoolean(conflict.zeroFindingClaimAcceptedForNorthstar),
    receiptContradictionCount: Array.isArray(report.canonicalReceiptContradictions)
      ? report.canonicalReceiptContradictions.length
      : null,
    laterDeferredCandidateCount: typeof later.deferredCandidateCount === "number" ? later.deferredCandidateCount : null,
    correctedFreshScanRequired: asBoolean(resolution.correctedFreshFullRepositoryScanRequired),
    correctedFreshScanCompleted: asBoolean(resolution.correctedFreshFullRepositoryScanCompleted),
    correctedScanId: asString(corrected.scanId),
    correctedTargetRevision: asString(corrected.targetRevision),
    correctedReportableFindingCount: typeof corrected.reportableFindingCount === "number" ? corrected.reportableFindingCount : null,
    correctedDeferredCandidateCount: typeof corrected.deferredCandidateCount === "number" ? corrected.deferredCandidateCount : null,
    correctedCoverageCompleteness: asString(corrected.coverageCompleteness),
    securityCompleteClaimAllowed: asBoolean(corrected.securityCompleteClaimAllowed),
    exactSavedShareVerdict: asString(boundaries.exactSavedShareVerdict),
  };
}

/** @param {unknown} report */
function currentSecurityRemediationLedgerSummary(report) {
  if (!isRecord(report)) return {};
  const productionBuild = isRecord(report.productionBuild) ? report.productionBuild : {};
  const disposition = isRecord(report.findingDisposition) ? report.findingDisposition : {};
  const remaining = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  return {
    verdict: asString(report.verdict),
    sourceHead: asString(report.sourceHead),
    productionCommit: asString(productionBuild.commitSha),
    totalFindings: typeof disposition.total === "number" ? disposition.total : null,
    deployedSourceRemediationCount: typeof disposition.deployedSourceRemediationCount === "number"
      ? disposition.deployedSourceRemediationCount
      : null,
    unresolvedCount: typeof disposition.unresolvedCount === "number" ? disposition.unresolvedCount : null,
    approvalGatedCount: typeof disposition.approvalGatedCount === "number" ? disposition.approvalGatedCount : null,
    distributedRuntimeOpenCount: typeof disposition.distributedRuntimeOpenCount === "number"
      ? disposition.distributedRuntimeOpenCount
      : null,
    securityCompleteClaimAllowed: asBoolean(remaining.securityCompleteClaimAllowed),
    exactSavedShareVerdict: asString(remaining.exactSavedShareVerdict),
  };
}

/** @param {unknown} report */
function currentRepositorySecurityRescanSummary(report) {
  if (!isRecord(report)) return {};
  const scan = isRecord(report.scan) ? report.scan : {};
  const severityCounts = isRecord(scan.severityCounts) ? scan.severityCounts : {};
  const disposition = isRecord(report.findingDisposition) ? report.findingDisposition : {};
  const remaining = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  return {
    verdict: asString(report.verdict),
    scanId: asString(report.scanId),
    scanRevision: asString(report.scanRevision),
    productCommit: asString(report.productCommit),
    productionCommit: asString(report.productionCommit),
    originalBaselineFindingCount: typeof report.immutableOriginalBaselineFindingCount === "number"
      ? report.immutableOriginalBaselineFindingCount
      : null,
    reportableFindingCount: typeof scan.reportableFindingCount === "number"
      ? scan.reportableFindingCount
      : null,
    mediumFindingCount: typeof severityCounts.medium === "number" ? severityCounts.medium : null,
    lowFindingCount: typeof severityCounts.low === "number" ? severityCounts.low : null,
    coverageCompleteness: asString(scan.coverage),
    reviewedSurfaceCount: typeof scan.reviewedSurfaceCount === "number" ? scan.reviewedSurfaceCount : null,
    deferredCoverageItemCount: typeof scan.deferredCoverageItemCount === "number"
      ? scan.deferredCoverageItemCount
      : null,
    approvalFreeProductSourceCandidateCount: typeof disposition.approvalFreeProductSourceCandidateCount === "number"
      ? disposition.approvalFreeProductSourceCandidateCount
      : null,
    approvalFreeRemediatedCount: typeof disposition.approvalFreeRemediatedCount === "number"
      ? disposition.approvalFreeRemediatedCount
      : null,
    currentSourceRemediatedCount: typeof report.currentSourceRemediation?.approvalFreeRemediatedCount === "number"
      ? report.currentSourceRemediation.approvalFreeRemediatedCount
      : null,
    currentSourceRemediationHead: asString(report.currentSourceRemediation?.sourceHead),
    approvalSensitiveShareCapabilityCount: typeof report.currentSourceRemediation?.approvalSensitiveShareCapabilityCount === "number"
      ? report.currentSourceRemediation.approvalSensitiveShareCapabilityCount
      : null,
    freshFullRepositoryRescanRequired: report.currentSourceRemediation?.freshFullRepositoryRescanRequired === true,
    currentSourceLiveProductionCommit: asString(report.currentSourceRemediation?.liveAfterDeployment?.productionCommit),
    currentSourceLiveIncluded: report.currentSourceRemediation?.liveAfterDeployment?.sourceRemediationIncluded === true,
    databaseApprovalGatedRemainingCount: typeof disposition.approvalGatedDatabaseOrAtomicityCount === "number"
      ? disposition.approvalGatedDatabaseOrAtomicityCount
      : null,
    securityCompleteClaimAllowed: asBoolean(disposition.securityCompleteClaimAllowed),
    exactSavedShareVerdict: asString(remaining.exactSavedShareVerdict),
    databaseSecurityRemediation: asString(remaining.databaseSecurityRemediation),
    approvalFreeProductSourceRemediation: asString(remaining.approvalFreeProductSourceRemediation),
  };
}

/** @param {unknown} report */
function learningExportRendererSecuritySummary(report) {
  if (!isRecord(report)) return {};
  const productionBuild = isRecord(report.productionBuild) ? report.productionBuild : {};
  const candidate = isRecord(report.candidate) ? report.candidate : {};
  const remainingBoundaries = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  return {
    verdict: asString(report.verdict),
    sourceHead: asString(report.sourceHead),
    productionCommit: asString(productionBuild.commitSha),
    currentSourceDisposition: asString(candidate.currentSourceDisposition),
    canonicalDeferredCandidateCount: typeof remainingBoundaries.canonicalDeferredCandidateCount === "number"
      ? remainingBoundaries.canonicalDeferredCandidateCount
      : 0,
    fullRepositoryRescanRequired: asBoolean(candidate.fullRepositoryRescanRequiredForCanonicalClosure),
    securityCompleteClaimAllowed: asBoolean(remainingBoundaries.securityCompleteClaimAllowed),
    exactSavedShareVerdict: asString(remainingBoundaries.exactSavedShareVerdict),
  };
}

/** @param {unknown} report */
function publicSearchDistributedRateLimitReadinessSummary(report) {
  if (!isRecord(report)) return {};
  const productionBuild = isRecord(report.productionBuild) ? report.productionBuild : {};
  const configuration = isRecord(report.configuration) ? report.configuration : {};
  const boundary = isRecord(report.boundary) ? report.boundary : {};
  return {
    verdict: asString(report.verdict),
    sourceHead: asString(report.sourceHead),
    productionCommit: asString(productionBuild.commitSha),
    sourceHeadMatchesProduction: asBoolean(productionBuild.sourceHeadMatchesProduction),
    productionModeVerified: asBoolean(configuration.productionModeVerified),
    configurationState: asString(configuration.configurationState),
    readinessMode: asString(configuration.readinessMode),
    observedResponseMode: asString(configuration.observedResponseMode),
    distributedActivationPending: asBoolean(configuration.distributedActivationPending),
    sealedFindingsClosedWithoutRescan: asBoolean(boundary.sealedFindingsClosedWithoutRescan),
    productionFailClosedObserved: asBoolean(boundary.productionFailClosedObserved),
    databaseFindingsRemainApprovalGated: asBoolean(boundary.databaseFindingsRemainApprovalGated),
    exactSavedShareVerdict: asString(boundary.exactSavedShareVerdict),
  };
}

/**
 * @param {unknown} report
 */
function hermesKnowledgeReviewAuthorityUiSummary(report) {
  if (!isRecord(report)) return {};
  const local = isRecord(report.local) ? report.local : {};
  const afterLive = isRecord(report.afterLive) ? report.afterLive : {};
  const authorityContract = isRecord(report.authorityContract) ? report.authorityContract : {};
  const workbenchContract = isRecord(report.workbenchContract) ? report.workbenchContract : {};
  const mutationBoundary = isRecord(report.mutationBoundary) ? report.mutationBoundary : {};
  const remainingBoundaries = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  return {
    verdict: asString(report.verdict),
    sourceHead: asString(report.sourceHead),
    productCommit: asString(report.productCommit),
    productionCommit: asString(report.productionCommit),
    localPassed: typeof local.passedCount === "number" ? local.passedCount : 0,
    localViewportCount: typeof local.viewportCount === "number" ? local.viewportCount : 0,
    livePassed: typeof afterLive.passedCount === "number" ? afterLive.passedCount : 0,
    liveViewportCount: typeof afterLive.viewportCount === "number" ? afterLive.viewportCount : 0,
    sourceOrder: Array.isArray(authorityContract.sourceOrder)
      ? authorityContract.sourceOrder.filter((item) => typeof item === "string")
      : [],
    humanReviewRequired: asBoolean(authorityContract.humanReviewRequired),
    machineEvidenceReplacesHumanReview: asBoolean(authorityContract.machineEvidenceReplacesHumanReview),
    tenantMemoryPublicPromotionAllowed: asBoolean(authorityContract.tenantMemoryPublicPromotionAllowed),
    siteManagerAcceptanceRequiredBeforeWorkpackUse: asBoolean(authorityContract.siteManagerAcceptanceRequiredBeforeWorkpackUse),
    candidateCount: typeof workbenchContract.candidateCount === "number" ? workbenchContract.candidateCount : 0,
    selectedCandidateCount: typeof workbenchContract.selectedCandidateCount === "number" ? workbenchContract.selectedCandidateCount : 0,
    selectedBodyCount: typeof workbenchContract.selectedBodyCount === "number" ? workbenchContract.selectedBodyCount : 0,
    desktopColumns: typeof workbenchContract.desktopColumns === "number" ? workbenchContract.desktopColumns : 0,
    mobileColumns: typeof workbenchContract.mobileColumns === "number" ? workbenchContract.mobileColumns : 0,
    candidateBodyInternalScroll: asBoolean(workbenchContract.candidateBodyInternalScroll),
    candidateTablist: asBoolean(workbenchContract.candidateTablist),
    candidateRovingTabStop: asBoolean(workbenchContract.candidateRovingTabStop),
    candidateKeyboardNavigation: asBoolean(workbenchContract.candidateKeyboardNavigation),
    breakpointOrientationSynchronized: asBoolean(workbenchContract.breakpointOrientationSynchronized),
    mobilePaneTabsLinked: asBoolean(workbenchContract.mobilePaneTabsLinked),
    mobilePaneKeyboardNavigation: asBoolean(workbenchContract.mobilePaneKeyboardNavigation),
    decisionPendingStatusLive: asBoolean(workbenchContract.decisionPendingStatusLive),
    decisionBusyStateExposed: asBoolean(workbenchContract.decisionBusyStateExposed),
    decisionActionsDisabledDuringSave: asBoolean(workbenchContract.decisionActionsDisabledDuringSave),
    decisionSettlesAccessibly: asBoolean(workbenchContract.decisionSettlesAccessibly),
    dbMutationPerformed: asBoolean(mutationBoundary.dbMutationPerformed),
    providerDispatchCalled: asBoolean(mutationBoundary.providerDispatchCalled),
    shareSessionCreated: asBoolean(mutationBoundary.shareSessionCreated),
    ontologyPublicationPerformed: asBoolean(mutationBoundary.ontologyPublicationPerformed),
    exactSavedShareVerdict: asString(remainingBoundaries.exactSavedShareVerdict),
    llmWikiPublication: asString(remainingBoundaries.llmWikiPublication),
    supabaseRlsLaunchIsolation: asString(remainingBoundaries.supabaseRlsLaunchIsolation),
  };
}

/**
 * @param {unknown} review
 */
function liveDocumentSeedProfileIsolationSummary(review) {
  if (!isRecord(review)) return {};
  const beforeLive = isRecord(review.beforeLive) ? review.beforeLive : {};
  const afterLive = isRecord(review.afterLive) ? review.afterLive : {};
  const contract = isRecord(review.contract) ? review.contract : {};
  const mutationBoundary = isRecord(review.mutationBoundary) ? review.mutationBoundary : {};
  return {
    verdict: asString(review.verdict),
    sourceHead: asString(review.sourceHead),
    productCommit: asString(review.productCommit),
    productionCommit: asString(review.productionCommit),
    beforePassed: typeof beforeLive.pass === "number" ? beforeLive.pass : 0,
    beforeFailed: typeof beforeLive.fail === "number" ? beforeLive.fail : 0,
    beforeSeedProfileLeakageCount: typeof beforeLive.seedProfileLeakageCount === "number"
      ? beforeLive.seedProfileLeakageCount
      : 0,
    livePassed: typeof afterLive.pass === "number" ? afterLive.pass : 0,
    liveFailed: typeof afterLive.fail === "number" ? afterLive.fail : 0,
    liveSeedProfileLeakageCount: typeof afterLive.seedProfileLeakageCount === "number"
      ? afterLive.seedProfileLeakageCount
      : 0,
    reviewedDocumentSurfaceCount: typeof contract.reviewedDocumentSurfaceCount === "number"
      ? contract.reviewedDocumentSurfaceCount
      : 0,
    secondaryGroundingPassed: typeof afterLive.secondaryGroundingPassed === "number"
      ? afterLive.secondaryGroundingPassed
      : 0,
    secondaryGroundingReviewed: typeof afterLive.secondaryGroundingReviewed === "number"
      ? afterLive.secondaryGroundingReviewed
      : 0,
    dbMutationPerformed: asBoolean(mutationBoundary.dbMutationPerformed),
    shareSessionCreated: asBoolean(mutationBoundary.shareSessionCreated),
    providerDispatchCalled: asBoolean(mutationBoundary.providerDispatchCalled),
    exactSavedShareReproduced: asBoolean(mutationBoundary.exactSavedShareReproduced),
    exactSavedShareVerdict: asString(mutationBoundary.exactSavedShareEvidence),
  };
}

/**
 * @param {unknown} hermes
 */
function hermesSummary(hermes) {
  if (!isRecord(hermes)) return {};
  const sourceContract = isRecord(hermes.sourceContract) ? hermes.sourceContract : {};
  const liveExecutionReadiness = isRecord(hermes.liveExecutionReadiness)
    ? hermes.liveExecutionReadiness
    : {};
  return {
    verdict: asString(hermes.verdict),
    focusedTests: isRecord(hermes.focusedTests) ? hermes.focusedTests : {},
    liveUnauthenticatedBrokerSmoke: isRecord(hermes.liveUnauthenticatedBrokerSmoke) ? hermes.liveUnauthenticatedBrokerSmoke : {},
    trustedTransportWired: asBoolean(sourceContract.trustedTransportWired),
    durableAttemptLedgerWired: asBoolean(sourceContract.durableAttemptLedgerWired),
    ledgerExplicitOptIn: asBoolean(sourceContract.ledgerExplicitOptIn),
    ledgerAtomicReservation: asBoolean(sourceContract.ledgerAtomicReservation),
    ledgerTerminalRequiresReservation: asBoolean(sourceContract.ledgerTerminalRequiresReservation),
    ledgerStoresTerminalDigestOnly: asBoolean(sourceContract.ledgerStoresTerminalDigestOnly),
    readinessKeepsLedgerOpen: asBoolean(sourceContract.readinessKeepsLedgerOpen),
    liveExecutionClaimed: asBoolean(liveExecutionReadiness.claimed),
    remainingRequirements: Array.isArray(liveExecutionReadiness.requires)
      ? liveExecutionReadiness.requires.filter((value) => typeof value === "string")
      : [],
  };
}

/**
 * @param {unknown} sif
 */
function sifSummary(sif) {
  if (!isRecord(sif)) return {};
  const corpus = isRecord(sif.corpus) ? sif.corpus : sif;
  const corpusInspection = isRecord(sif.corpusInspection) ? sif.corpusInspection : {};
  return {
    approvalHeld: asBoolean(sif.approvalHeld),
    dbMutationPerformed: asBoolean(sif.dbMutationPerformed),
    embeddingGenerated: asBoolean(sif.embeddingGenerated),
    uploaded: asBoolean(sif.uploaded),
    corpusCount: typeof corpus.corpusCount === "number" ? corpus.corpusCount : undefined,
    corpusInspection: {
      parsedRecordCount: typeof corpusInspection.parsedRecordCount === "number" ? corpusInspection.parsedRecordCount : undefined,
      invalidRecordCount: typeof corpusInspection.invalidRecordCount === "number" ? corpusInspection.invalidRecordCount : undefined,
      duplicateReferenceItemIdCount: typeof corpusInspection.duplicateReferenceItemIdCount === "number"
        ? corpusInspection.duplicateReferenceItemIdCount
        : undefined,
      duplicateContentHashCount: typeof corpusInspection.duplicateContentHashCount === "number"
        ? corpusInspection.duplicateContentHashCount
        : undefined,
      manifestBatchFailureCount: typeof corpusInspection.manifestBatchFailureCount === "number"
        ? corpusInspection.manifestBatchFailureCount
        : undefined,
    },
    failedCheckIds: Array.isArray(sif.failedCheckIds) ? sif.failedCheckIds.map(asString).filter(Boolean) : [],
  };
}

/**
 * @param {unknown} shareGenerated
 */
function shareGeneratedSessionSummary(shareGenerated) {
  if (!isRecord(shareGenerated)) return {};
  const results = Array.isArray(shareGenerated.results) ? shareGenerated.results.filter(isRecord) : [];
  return {
    verdict: asString(shareGenerated.verdict),
    sourceHead: asString(shareGenerated.sourceHead),
    providerDispatchLiveClaimed: asBoolean(shareGenerated.providerDispatchLiveClaimed),
    externalProviderCalled: asBoolean(shareGenerated.externalProviderCalled),
    exactSavedUserSessionReproduced: asBoolean(shareGenerated.exactSavedUserSessionReproduced),
    fixtureBoundary: asString(shareGenerated.fixtureBoundary),
    resultLanding: results.map((item) => {
      const viewport = isRecord(item.viewport) ? item.viewport : {};
      const resultSummary = isRecord(item.resultSummary) ? item.resultSummary : {};
      return {
        label: asString(item.label),
        verdict: asString(item.verdict),
        viewport: `${typeof viewport.width === "number" ? viewport.width : "unknown"}x${typeof viewport.height === "number" ? viewport.height : "unknown"}`,
        resultSummaryTop: typeof resultSummary.top === "number" ? resultSummary.top : null,
        resultSummaryBottom: typeof resultSummary.bottom === "number" ? resultSummary.bottom : null,
      };
    }),
  };
}

/**
 * @param {unknown} shareFixture
 */
function shareRecipientLongContentFixtureSummary(shareFixture) {
  if (!isRecord(shareFixture)) return {};
  const productionBuild = isRecord(shareFixture.productionBuild) ? shareFixture.productionBuild : {};
  const acceptance = isRecord(shareFixture.acceptance) ? shareFixture.acceptance : {};
  const rows = Array.isArray(shareFixture.rows) ? shareFixture.rows.filter(isRecord) : [];
  return {
    verdict: asString(shareFixture.verdict),
    sourceHead: asString(shareFixture.sourceHead),
    productionCommit: asString(productionBuild.commitSha),
    route: asString(shareFixture.route),
    sessionKind: asString(shareFixture.sessionKind),
    routeSplitAloneAcceptedAsFix: asBoolean(shareFixture.routeSplitAloneAcceptedAsFix),
    acceptedStructure: asString(shareFixture.acceptedStructure),
    acceptance: {
      desktopMinRegions: typeof acceptance.desktopMinRegions === "number" ? acceptance.desktopMinRegions : null,
      mobileMaxRootHeightRatio: typeof acceptance.mobileMaxRootHeightRatio === "number" ? acceptance.mobileMaxRootHeightRatio : null,
      confirmationMustRemainInFirstViewport: asBoolean(acceptance.confirmationMustRemainInFirstViewport),
      longTaskMustUseLocalScroll: asBoolean(acceptance.longTaskMustUseLocalScroll),
      documentGroupCollapsedByDefault: asBoolean(acceptance.documentGroupCollapsedByDefault),
      exactSavedSessionRequiredForUserSpecificPass: asBoolean(acceptance.exactSavedSessionRequiredForUserSpecificPass),
    },
    exactSavedUserSessionReproduced: asBoolean(shareFixture.exactSavedUserSessionReproduced),
    exactSavedSessionVerdict: asString(shareFixture.exactSavedSessionVerdict),
    dbMutationPerformed: asBoolean(shareFixture.dbMutationPerformed),
    shareSessionCreated: asBoolean(shareFixture.shareSessionCreated),
    providerDispatchLiveClaimed: asBoolean(shareFixture.providerDispatchLiveClaimed),
    externalProviderCalled: asBoolean(shareFixture.externalProviderCalled),
    rows: rows.map((row) => {
      const metrics = isRecord(row.metrics) ? row.metrics : {};
      const verdicts = isRecord(row.verdicts) ? row.verdicts : {};
      return {
        theme: asString(metrics.theme),
        viewport: asString(metrics.viewport),
        overallVerdict: asString(verdicts.overallVerdict),
        exactSavedSessionVerdict: asString(verdicts.exactSavedSessionVerdict),
        pageHeightRatio: typeof metrics.pageHeightRatio === "number" ? metrics.pageHeightRatio : null,
        rootWidthRatio: typeof metrics.rootWidthRatio === "number" ? metrics.rootWidthRatio : null,
        rootHeightRatio: typeof metrics.rootHeightRatio === "number" ? metrics.rootHeightRatio : null,
        desktopXRegionCount: typeof metrics.desktopXRegionCount === "number" ? metrics.desktopXRegionCount : null,
        confirmationBottom: typeof metrics.confirmationBottom === "number" ? metrics.confirmationBottom : null,
        taskBodyContained: asBoolean(metrics.taskBodyContained),
        documentsPanelOpen: metrics.documentsPanelOpen === true,
        previewContainedCount: typeof metrics.previewContainedCount === "number" ? metrics.previewContainedCount : null,
        collapsedDocumentCount: typeof metrics.collapsedDocumentCount === "number" ? metrics.collapsedDocumentCount : null,
      };
    }),
  };
}

/**
 * @param {unknown} shareExact
 */
function shareExactSessionBoundarySummary(shareExact) {
  if (!isRecord(shareExact)) return {};
  const safeReadProbe = isRecord(shareExact.safeReadProbe) ? shareExact.safeReadProbe : {};
  const invalidReadProbe = isRecord(shareExact.invalidReadProbe) ? shareExact.invalidReadProbe : {};
  const boundary = isRecord(shareExact.boundary) ? shareExact.boundary : {};
  return {
    verdict: asString(shareExact.verdict),
    sourceHead: asString(shareExact.sourceHead),
    liveCommit: asString(shareExact.liveCommit),
    exactSavedUserSessionReproduced: asBoolean(shareExact.exactSavedUserSessionReproduced),
    exactSavedSessionRequiredForUserSpecificPass: asBoolean(boundary.exactSavedSessionRequiredForUserSpecificPass),
    dbMutationPerformed: asBoolean(boundary.dbMutationPerformed),
    providerDispatchLiveClaimed: asBoolean(boundary.providerDispatchLiveClaimed),
    externalProviderCalled: asBoolean(boundary.externalProviderCalled),
    safeReadStatus: typeof safeReadProbe.status === "number" ? safeReadProbe.status : null,
    safeReadMessage: asString(safeReadProbe.message),
    safeMissingSessionReadVerdict: asString(shareExact.safeMissingSessionReadVerdict),
    invalidReadStatus: typeof invalidReadProbe.status === "number" ? invalidReadProbe.status : null,
    invalidReadMessage: asString(invalidReadProbe.message),
    safeInvalidSessionReadVerdict: asString(shareExact.safeInvalidSessionReadVerdict),
  };
}

/**
 * @param {unknown} ack
 */
function shareRecipientAckApprovalSummary(ack) {
  if (!isRecord(ack)) return {};
  return {
    overall: asString(ack.overall),
    sourceSha: asString(ack.sourceSha),
    approvalRequired: asBoolean(ack.approvalRequired),
    liveDataMutationApproved: asBoolean(ack.liveDataMutationApproved),
    dbMutationPerformed: asBoolean(ack.dbMutationPerformed),
    providerMessageSent: asBoolean(ack.providerMessageSent),
    productionShareSessionCreated: asBoolean(ack.productionShareSessionCreated),
    productionReadConfirmationInserted: asBoolean(ack.productionReadConfirmationInserted),
    failedCheckIds: Array.isArray(ack.failedCheckIds) ? ack.failedCheckIds.map(asString).filter(Boolean) : [],
  };
}

/**
 * @param {unknown} storageReadiness
 */
function sharePublicSessionStorageReadinessSummary(storageReadiness) {
  if (!isRecord(storageReadiness)) return {};
  const livePublicApiProbe = isRecord(storageReadiness.livePublicApiProbe) ? storageReadiness.livePublicApiProbe : {};
  const serviceProbe = isRecord(storageReadiness.serviceRoleReadOnlyProbe) ? storageReadiness.serviceRoleReadOnlyProbe : {};
  const workpacks = isRecord(serviceProbe.workpacks) ? serviceProbe.workpacks : {};
  const fullSelect = isRecord(serviceProbe.workpackShareSessionsFullSelect) ? serviceProbe.workpackShareSessionsFullSelect : {};
  const fullError = isRecord(fullSelect.error) ? fullSelect.error : {};
  return {
    verdict: asString(storageReadiness.verdict),
    sourceHead: asString(storageReadiness.sourceHead),
    productionCommit: asString(storageReadiness.productionCommit),
    dbMutationPerformed: asBoolean(storageReadiness.dbMutationPerformed),
    providerDispatchLiveClaimed: asBoolean(storageReadiness.providerDispatchLiveClaimed),
    externalProviderCalled: asBoolean(storageReadiness.externalProviderCalled),
    livePublicApiStatus: typeof livePublicApiProbe.status === "number" ? livePublicApiProbe.status : null,
    workpacksReadable: asBoolean(workpacks.readable),
    shareSessionsReadable: asBoolean(fullSelect.readable),
    shareSessionsErrorCode: asString(fullError.code),
    shareSessionsErrorMessage: asString(fullError.message),
  };
}

/**
 * @param {unknown} storageApproval
 */
function sharePublicSessionStorageApprovalSummary(storageApproval) {
  if (!isRecord(storageApproval)) return {};
  const migration = isRecord(storageApproval.migration) ? storageApproval.migration : {};
  const approvalBoundary = isRecord(storageApproval.approvalBoundary) ? storageApproval.approvalBoundary : {};
  const readinessBlocker = isRecord(storageApproval.readinessBlocker) ? storageApproval.readinessBlocker : {};
  return {
    verdict: asString(storageApproval.verdict),
    sourceHead: asString(storageApproval.sourceHead),
    productionCommit: asString(storageApproval.productionCommit),
    exactSavedShareSessionVerdict: asString(storageApproval.exactSavedShareSessionVerdict),
    migrationPath: asString(migration.path),
    migrationSha256: asString(migration.sha256),
    broadMigrationRequiresOperatorReview: asBoolean(migration.broadMigrationRequiresOperatorReview),
    operatorApprovalRequiredBeforeMigration: asBoolean(approvalBoundary.operatorApprovalRequiredBeforeMigration),
    schemaMutationAuthorized: asBoolean(approvalBoundary.schemaMutationAuthorized),
    dbMutationPerformed: asBoolean(approvalBoundary.dbMutationPerformed),
    shareSessionCreated: asBoolean(approvalBoundary.shareSessionCreated),
    shareSessionCreationWouldInsertWorkpackShareSessions: asBoolean(approvalBoundary.shareSessionCreationWouldInsertWorkpackShareSessions),
    concreteProductionShareUrlProvided: asBoolean(approvalBoundary.concreteProductionShareUrlProvided),
    providerDispatchLiveClaimed: asBoolean(approvalBoundary.providerDispatchLiveClaimed),
    externalProviderCalled: asBoolean(approvalBoundary.externalProviderCalled),
    workpackShareSessionsReadable: asBoolean(readinessBlocker.workpackShareSessionsReadable),
    workpackShareSessionsErrorCode: asString(readinessBlocker.workpackShareSessionsErrorCode),
  };
}

/**
 * @param {unknown} documentsGeometry
 */
function documentsCockpitWorkbenchGeometrySummary(documentsGeometry) {
  if (!isRecord(documentsGeometry)) return {};
  const rows = Array.isArray(documentsGeometry.rows) ? documentsGeometry.rows.filter(isRecord) : [];
  return {
    verdict: asString(documentsGeometry.verdict),
    sourceHead: asString(documentsGeometry.sourceHead),
    productionCommit: isRecord(documentsGeometry.productionBuild) ? asString(documentsGeometry.productionBuild.commitSha) : "",
    baseUrl: asString(documentsGeometry.baseUrl),
    staleDevRedExplained: asBoolean(documentsGeometry.staleDevRedExplained),
    routeSplitAloneAcceptedAsFix: asBoolean(documentsGeometry.routeSplitAloneAcceptedAsFix),
    rows: rows.map((row) => {
      const metrics = isRecord(row.metrics) ? row.metrics : {};
      const verdicts = isRecord(row.verdicts) ? row.verdicts : {};
      return {
        viewport: asString(row.viewport),
        overallVerdict: asString(verdicts.overallVerdict),
        bodyHeight: typeof metrics.bodyHeight === "number" ? metrics.bodyHeight : null,
        horizontalOverflow: asBoolean(metrics.horizontalOverflow),
        workbenchDisplay: asString(metrics.workbenchDisplay),
        workbenchColumnCount: typeof metrics.workbenchColumnCount === "number" ? metrics.workbenchColumnCount : null,
        workbenchGridTemplateColumns: asString(metrics.workbenchGridTemplateColumns),
        launcherTop: typeof metrics.launcherTop === "number" ? metrics.launcherTop : null,
        launcherBottom: typeof metrics.launcherBottom === "number" ? metrics.launcherBottom : null,
        launcherRight: typeof metrics.launcherRight === "number" ? metrics.launcherRight : null,
        editorTop: typeof metrics.editorTop === "number" ? metrics.editorTop : null,
        editorBottom: typeof metrics.editorBottom === "number" ? metrics.editorBottom : null,
        editorLeft: typeof metrics.editorLeft === "number" ? metrics.editorLeft : null,
        coreButtons: typeof metrics.coreButtons === "number" ? metrics.coreButtons : null,
        uniqueDocumentKeyCount: typeof metrics.uniqueDocumentKeyCount === "number" ? metrics.uniqueDocumentKeyCount : null,
        visibleDocumentButtonCount: typeof metrics.visibleDocumentButtonCount === "number" ? metrics.visibleDocumentButtonCount : null,
        supportingButtonCount: typeof metrics.supportingButtonCount === "number" ? metrics.supportingButtonCount : null,
        visibleSupportingButtonCount: typeof metrics.visibleSupportingButtonCount === "number" ? metrics.visibleSupportingButtonCount : null,
        legacyIndexDisplay: asString(metrics.legacyIndexDisplay),
        detailsOpen: metrics.detailsOpen === true || metrics.detailsOpen === false ? metrics.detailsOpen : null,
      };
    }),
  };
}

/**
 * @param {unknown} report
 */
function documentSectionNavigationSummary(report) {
  if (!isRecord(report)) return {};
  const productionBuild = isRecord(report.productionBuild) ? report.productionBuild : {};
  const mutationBoundary = isRecord(report.mutationBoundary) ? report.mutationBoundary : {};
  const results = Array.isArray(report.results) ? report.results.filter(isRecord) : [];
  return {
    verdict: asString(report.verdict),
    sourceHead: asString(report.sourceHead),
    productionCommit: asString(productionBuild.commitSha),
    sourceHeadMatchesProduction: asBoolean(report.sourceHeadMatchesProduction),
    total: typeof report.total === "number" ? report.total : null,
    pass: typeof report.pass === "number" ? report.pass : null,
    fail: typeof report.fail === "number" ? report.fail : null,
    rows: results.map((row) => {
      const metrics = isRecord(row.metrics) ? row.metrics : {};
      return {
        theme: asString(row.theme),
        label: asString(row.label),
        verdict: asString(row.verdict),
        bodyHeight: typeof metrics.bodyHeight === "number" ? metrics.bodyHeight : null,
        viewportHeight: typeof metrics.viewportHeight === "number" ? metrics.viewportHeight : null,
        shellRatio: typeof metrics.shellRatio === "number" ? metrics.shellRatio : null,
        actionBottom: typeof metrics.actionBottom === "number" ? metrics.actionBottom : null,
        sectionTabCount: typeof metrics.sectionTabCount === "number" ? metrics.sectionTabCount : null,
        selectedSectionTabCount: typeof metrics.selectedSectionTabCount === "number" ? metrics.selectedSectionTabCount : null,
        filledSectionTabCount: typeof metrics.filledSectionTabCount === "number" ? metrics.filledSectionTabCount : null,
        emptySectionTabCount: typeof metrics.emptySectionTabCount === "number" ? metrics.emptySectionTabCount : null,
        minimumSectionTabHeight: typeof metrics.minimumSectionTabHeight === "number" ? metrics.minimumSectionTabHeight : null,
        horizontalOverflow: asBoolean(metrics.horizontalOverflow),
      };
    }),
    dbMutationPerformed: asBoolean(mutationBoundary.dbMutationPerformed),
    providerDispatchCalled: asBoolean(mutationBoundary.providerDispatchCalled),
    shareSessionCreated: asBoolean(mutationBoundary.shareSessionCreated),
    exactSavedShareVerdict: asString(mutationBoundary.exactSavedShareVerdict),
  };
}

/**
 * @param {unknown} report
 */
function documentAllAuthoringGeometrySummary(report) {
  if (!isRecord(report)) return {};
  const productionBuild = isRecord(report.productionBuild) ? report.productionBuild : {};
  const mutationBoundary = isRecord(report.mutationBoundary) ? report.mutationBoundary : {};
  const results = Array.isArray(report.results) ? report.results.filter(isRecord) : [];
  const shellRatios = results.flatMap((row) => {
    const metrics = isRecord(row.metrics) ? row.metrics : {};
    return typeof metrics.shellRatio === "number" ? [metrics.shellRatio] : [];
  });
  const firstActionBottoms = results.flatMap((row) => {
    const metrics = isRecord(row.metrics) ? row.metrics : {};
    return typeof metrics.firstActionBottom === "number" ? [metrics.firstActionBottom] : [];
  });
  const paneMargins = results.flatMap((row) => {
    const metrics = isRecord(row.metrics) ? row.metrics : {};
    return typeof metrics.shellBottom === "number" && typeof metrics.firstActionBottom === "number"
      ? [metrics.shellBottom - metrics.firstActionBottom]
      : [];
  });
  const acceptanceContract = isRecord(report.acceptanceContract) ? report.acceptanceContract : {};
  return {
    verdict: asString(report.verdict),
    sourceHead: asString(report.sourceHead),
    productionCommit: asString(productionBuild.commitSha),
    sourceHeadMatchesProduction: asBoolean(report.sourceHeadMatchesProduction),
    documentCount: typeof report.documentCount === "number" ? report.documentCount : null,
    viewportCaseCount: typeof report.viewportCaseCount === "number" ? report.viewportCaseCount : null,
    total: typeof report.total === "number" ? report.total : null,
    pass: typeof report.pass === "number" ? report.pass : null,
    fail: typeof report.fail === "number" ? report.fail : null,
    maximumShellRatio: shellRatios.length ? Math.max(...shellRatios) : null,
    maximumFirstActionBottom: firstActionBottoms.length ? Math.max(...firstActionBottoms) : null,
    minimumPaneMargin: paneMargins.length ? Math.min(...paneMargins) : null,
    requiredPaneMargin: typeof acceptanceContract.firstActionInsidePaneWithMinimumMargin === "number"
      ? acceptanceContract.firstActionInsidePaneWithMinimumMargin
      : null,
    dbMutationPerformed: asBoolean(mutationBoundary.dbMutationPerformed),
    providerDispatchCalled: asBoolean(mutationBoundary.providerDispatchCalled),
    shareSessionCreated: asBoolean(mutationBoundary.shareSessionCreated),
    exactSavedShareVerdict: asString(mutationBoundary.exactSavedShareVerdict),
  };
}

/** @param {unknown} report */
function publicGenerationAdmissionSecuritySummary(report) {
  if (!isRecord(report)) return {};
  const runtimeBoundary = isRecord(report.runtimeBoundary) ? report.runtimeBoundary : {};
  const verification = isRecord(report.verification) ? report.verification : {};
  const npmAudit = isRecord(verification.npmAudit) ? verification.npmAudit : {};
  const remainingBoundaries = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  return {
    verdict: asString(report.verdict),
    productCommit: asString(report.productCommit),
    productionCommit: asString(report.productionCommit),
    configurationState: asString(runtimeBoundary.configurationState),
    readinessMode: asString(runtimeBoundary.readinessMode),
    observedResponseMode: asString(runtimeBoundary.observedResponseMode),
    liveDeploymentVerified: asBoolean(runtimeBoundary.liveDeploymentVerified),
    productionFailClosedObserved: asBoolean(runtimeBoundary.productionFailClosedObserved),
    distributedActivationPending: asBoolean(runtimeBoundary.distributedProductionActivationPending),
    vulnerabilityCount: typeof npmAudit.vulnerabilityCount === "number" ? npmAudit.vulnerabilityCount : 0,
    freshRescanRequired: asBoolean(remainingBoundaries.freshPostChangeSecurityRescanRequired),
    exactSavedShareVerdict: asString(remainingBoundaries.exactSavedShareVerdict),
  };
}

/** @param {unknown} report */
function securityFollowupRemediationSummary(report) {
  if (!isRecord(report)) return {};
  const scan = isRecord(report.securityScan) ? report.securityScan : {};
  const verification = isRecord(report.verification) ? report.verification : {};
  const focused = isRecord(verification.focusedVitest) ? verification.focusedVitest : {};
  const deployment = isRecord(report.deployment) ? report.deployment : {};
  const boundaries = isRecord(report.boundaries) ? report.boundaries : {};
  return {
    verdict: asString(report.verdict),
    sourceHead: asString(report.sourceHead),
    productionCommit: asString(deployment.productionCommit),
    sealedFindingCount: typeof scan.sealedFindingCount === "number" ? scan.sealedFindingCount : null,
    immutableOriginalBaselineFindingCount: typeof scan.immutableOriginalBaselineFindingCount === "number"
      ? scan.immutableOriginalBaselineFindingCount
      : null,
    deferredCandidateCount: typeof scan.deferredCandidateCount === "number" ? scan.deferredCandidateCount : null,
    focusedTests: typeof focused.tests === "number" ? focused.tests : null,
    liveProviderCancellationProbeExecuted: asBoolean(deployment.liveProviderCancellationProbeExecuted),
    remainingSecurityWorkCount: Array.isArray(report.remainingSecurityWork) ? report.remainingSecurityWork.length : null,
    originalBaselineRewritten: asBoolean(boundaries.originalBaselineRewritten),
    exactSavedShareVerdict: asString(boundaries.exactSavedShareVerdict),
  };
}

/**
 * @param {unknown} report
 */
function hermesKnowledgeReviewEvidenceInspectorSummary(report) {
  if (!isRecord(report)) return {};
  const local = isRecord(report.local) ? report.local : {};
  const afterLive = isRecord(report.afterLive) ? report.afterLive : {};
  const contract = isRecord(report.evidenceContract) ? report.evidenceContract : {};
  const mutation = isRecord(report.mutationBoundary) ? report.mutationBoundary : {};
  const security = isRecord(report.securityBoundary) ? report.securityBoundary : {};
  const remaining = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  return {
    verdict: asString(report.verdict),
    sourceHead: asString(report.sourceHead),
    productCommit: asString(report.productCommit),
    productionCommit: asString(report.productionCommit),
    localPassed: typeof local.passedCount === "number" ? local.passedCount : 0,
    localViewportCount: typeof local.viewportCount === "number" ? local.viewportCount : 0,
    livePassed: typeof afterLive.passedCount === "number" ? afterLive.passedCount : 0,
    liveViewportCount: typeof afterLive.viewportCount === "number" ? afterLive.viewportCount : 0,
    productionAligned: asBoolean(afterLive.productionAligned),
    browserErrorCount: typeof afterLive.browserErrorCount === "number" ? afterLive.browserErrorCount : 0,
    itemLimit: typeof contract.itemLimit === "number" ? contract.itemLimit : 0,
    fixtureItemCount: typeof contract.fixtureItemCount === "number" ? contract.fixtureItemCount : 0,
    desktopEvidenceColumns: typeof contract.desktopEvidenceColumns === "number" ? contract.desktopEvidenceColumns : 0,
    mobileMountedPaneCount: typeof contract.mobileMountedPaneCount === "number" ? contract.mobileMountedPaneCount : 0,
    candidateTablist: asBoolean(contract.candidateTablist),
    candidateRovingTabStop: asBoolean(contract.candidateRovingTabStop),
    candidateKeyboardNavigation: asBoolean(contract.candidateKeyboardNavigation),
    breakpointOrientationSynchronized: asBoolean(contract.breakpointOrientationSynchronized),
    mobilePaneTabsLinked: asBoolean(contract.mobilePaneTabsLinked),
    mobilePaneKeyboardNavigation: asBoolean(contract.mobilePaneKeyboardNavigation),
    decisionPendingStatusLive: asBoolean(contract.decisionPendingStatusLive),
    decisionBusyStateExposed: asBoolean(contract.decisionBusyStateExposed),
    decisionActionsDisabledDuringSave: asBoolean(contract.decisionActionsDisabledDuringSave),
    decisionSettlesAccessibly: asBoolean(contract.decisionSettlesAccessibly),
    publicOfficialHttpsLinkCount: typeof contract.publicOfficialHttpsLinkCount === "number" ? contract.publicOfficialHttpsLinkCount : 0,
    privateEvidenceRawIdentityExposed: asBoolean(contract.privateEvidenceRawIdentityExposed),
    evidenceInternalScroll: asBoolean(contract.evidenceInternalScroll),
    dbMutationPerformed: asBoolean(mutation.dbMutationPerformed),
    providerDispatchCalled: asBoolean(mutation.providerDispatchCalled),
    shareSessionCreated: asBoolean(mutation.shareSessionCreated),
    securityComplete: asBoolean(security.securityComplete),
    freshFullRepositoryScanRequired: asBoolean(security.freshFullRepositoryScanRequired),
    exactSavedShareVerdict: asString(remaining.exactSavedShareVerdict),
    llmWikiPublication: asString(remaining.llmWikiPublication),
    supabaseRlsLaunchIsolation: asString(remaining.supabaseRlsLaunchIsolation),
    providerDispatchPersistence: asString(remaining.providerDispatchPersistence),
  };
}

/** @param {unknown} report */
function freshCurrentSourceSecurityScanSummary(report) {
  if (!isRecord(report)) return {};
  const scan = isRecord(report.scan) ? report.scan : {};
  const severity = isRecord(scan.severity) ? scan.severity : {};
  const baseline = isRecord(report.baseline) ? report.baseline : {};
  const disposition = isRecord(report.currentDisposition) ? report.currentDisposition : {};
  const remaining = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  return {
    verdict: asString(report.verdict),
    scanId: asString(report.scanId),
    sourceHead: asString(report.sourceHead),
    deployedProductSource: asString(report.deployedProductSource),
    status: asString(scan.status),
    coverageCompleteness: asString(scan.coverageCompleteness),
    reviewedSurfaceCount: typeof scan.reviewedSurfaceCount === "number" ? scan.reviewedSurfaceCount : null,
    deferredCoverageItemCount: typeof scan.deferredCoverageItemCount === "number" ? scan.deferredCoverageItemCount : null,
    reportableFindingCount: typeof scan.reportableFindingCount === "number" ? scan.reportableFindingCount : null,
    mediumFindingCount: typeof severity.medium === "number" ? severity.medium : null,
    lowFindingCount: typeof severity.low === "number" ? severity.low : null,
    immutableOriginalFindingCount: typeof baseline.immutableOriginalFindingCount === "number"
      ? baseline.immutableOriginalFindingCount
      : null,
    approvalGatedDatabaseOrAtomicityCount: typeof disposition.approvalGatedDatabaseOrAtomicityCount === "number"
      ? disposition.approvalGatedDatabaseOrAtomicityCount
      : null,
    approvalSensitiveShareCapabilityCount: typeof disposition.approvalSensitiveShareCapabilityCount === "number"
      ? disposition.approvalSensitiveShareCapabilityCount
      : null,
    approvalFreeProductSourceResidualCount: typeof disposition.approvalFreeProductSourceResidualCount === "number"
      ? disposition.approvalFreeProductSourceResidualCount
      : null,
    fullyClosedBoundedSourceCandidateCount: typeof disposition.fullyClosedBoundedSourceCandidateCount === "number"
      ? disposition.fullyClosedBoundedSourceCandidateCount
      : null,
    freshFullRepositoryScanCompleted: asBoolean(remaining.freshFullRepositoryScanCompleted),
    securityCompleteClaimAllowed: asBoolean(remaining.securityCompleteClaimAllowed),
    exactSavedShareVerdict: asString(remaining.exactSavedShareVerdict),
  };
}

/** @param {unknown} report */
function currentSourceSecurityResidualRemediationSummary(report) {
  if (!isRecord(report)) return {};
  const residuals = Array.isArray(report.remediatedSourceResiduals)
    ? report.remediatedSourceResiduals.filter(isRecord)
    : [];
  const verification = isRecord(report.verification) ? report.verification : {};
  const focused = isRecord(verification.focusedSecurity) ? verification.focusedSecurity : {};
  const adjacent = isRecord(verification.adjacentPublicAdmissionAndHarness)
    ? verification.adjacentPublicAdmissionAndHarness
    : {};
  const live = isRecord(report.liveVerification) ? report.liveVerification : {};
  const remaining = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  return {
    verdict: asString(report.verdict),
    sourceHead: asString(report.sourceHead),
    productionCommit: asString(report.productionCommit),
    residualAnchors: residuals.map((item) => asString(item.anchor)).filter(Boolean).sort(),
    focusedTests: typeof focused.tests === "number" ? focused.tests : null,
    adjacentTests: typeof adjacent.tests === "number" ? adjacent.tests : null,
    liveStatus: asString(live.status),
    behavioralProbeExecuted: asBoolean(live.behavioralProbeExecuted),
    followUpSecurityScanRequired: asBoolean(remaining.followUpSecurityScanRequired),
    securityCompleteClaimAllowed: asBoolean(remaining.securityCompleteClaimAllowed),
    exactSavedShareVerdict: asString(remaining.exactSavedShareVerdict),
  };
}

/** @param {unknown} report */
function shareAckPreBodyAdmissionSummary(report) {
  if (!isRecord(report)) return {};
  const finding = isRecord(report.finding) ? report.finding : {};
  const contract = isRecord(report.currentSourceContract) ? report.currentSourceContract : {};
  const verification = isRecord(report.verification) ? report.verification : {};
  const focused = isRecord(verification.focusedAndAdjacentTests) ? verification.focusedAndAdjacentTests : {};
  const live = isRecord(report.liveProbe) ? report.liveProbe : {};
  const remaining = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  return {
    verdict: asString(report.verdict),
    sourceHead: asString(report.sourceHead),
    productionCommit: asString(report.productionCommit),
    scanId: asString(finding.scanId),
    findingSlug: asString(finding.slug),
    coarseIpRateAdmissionBeforeBody: asBoolean(contract.coarseIpRateAdmissionBeforeBody),
    coarseBodyConcurrencyLeaseBeforeBody: asBoolean(contract.coarseBodyConcurrencyLeaseBeforeBody),
    recipientSpecificAdmissionRetainedAfterParse: asBoolean(contract.recipientSpecificAdmissionRetainedAfterParse),
    testsPassed: typeof focused.testsPassed === "number" ? focused.testsPassed : null,
    liveStatus: typeof live.status === "number" ? live.status : null,
    liveCode: asString(live.code),
    liveRateLimitHeader: asString(live.rateLimitHeader),
    freshRescanRequired: asBoolean(remaining.freshFullRepositoryRescanRequiredForScanClosure),
    securityCompleteClaimAllowed: asBoolean(remaining.securityCompleteClaimAllowed),
    recipientAckLiveDataApproval: asString(remaining.shareRecipientAckLiveDataApproval),
    exactSavedShareVerdict: asString(remaining.exactSavedShareVerdict),
  };
}

/** @param {unknown} report */
function safetyStatusDisconnectLeaseSummary(report) {
  if (!isRecord(report)) return {};
  const finding = isRecord(report.finding) ? report.finding : {};
  const contract = isRecord(report.currentSourceContract) ? report.currentSourceContract : {};
  const verification = isRecord(report.verification) ? report.verification : {};
  const focused = isRecord(verification.focusedAndAdjacentTests) ? verification.focusedAndAdjacentTests : {};
  const live = isRecord(report.liveProbe) ? report.liveProbe : {};
  const remaining = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  return {
    verdict: asString(report.verdict),
    sourceHead: asString(report.sourceHead),
    productionCommit: asString(report.productionCommit),
    scanId: asString(finding.scanId),
    findingId: asString(finding.findingId),
    findingSlug: asString(finding.slug),
    underlyingWorkSettlementPrecedesAbortRejection: asBoolean(contract.underlyingWorkSettlementPrecedesAbortRejection),
    admissionLeaseHeldUntilUnderlyingSettlement: asBoolean(contract.admissionLeaseHeldUntilUnderlyingSettlement),
    thirdConcurrentRequestRejectedWhileTwoDisconnectedTasksSettle: asBoolean(contract.thirdConcurrentRequestRejectedWhileTwoDisconnectedTasksSettle),
    testsPassed: typeof focused.testsPassed === "number" ? focused.testsPassed : null,
    liveStatus: typeof live.status === "number" ? live.status : null,
    liveCode: asString(live.code),
    liveWorkUnit: asString(live.workUnitHeader),
    freshRescanRequired: asBoolean(remaining.freshFullRepositoryRescanRequiredForScanClosure),
    securityCompleteClaimAllowed: asBoolean(remaining.securityCompleteClaimAllowed),
    distributedAdmissionActivation: asString(remaining.distributedAdmissionActivation),
    exactSavedShareVerdict: asString(remaining.exactSavedShareVerdict),
  };
}

/** @param {unknown} report */
function weatherFallbackErrorRedactionSummary(report) {
  if (!isRecord(report)) return {};
  const finding = isRecord(report.finding) ? report.finding : {};
  const contract = isRecord(report.currentSourceContract) ? report.currentSourceContract : {};
  const verification = isRecord(report.verification) ? report.verification : {};
  const focused = isRecord(verification.focusedAndAdjacentTests) ? verification.focusedAndAdjacentTests : {};
  const live = isRecord(report.liveProbe) ? report.liveProbe : {};
  const remaining = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  return {
    verdict: asString(report.verdict),
    sourceHead: asString(report.sourceHead),
    productionCommit: asString(report.productionCommit),
    scanId: asString(finding.scanId),
    findingId: asString(finding.findingId),
    findingSlug: asString(finding.slug),
    providerFallbackBranchCount: typeof contract.providerFallbackBranchCount === "number" ? contract.providerFallbackBranchCount : null,
    allProviderFallbackBranchesUseFixedPublicDetail: asBoolean(contract.allProviderFallbackBranchesUseFixedPublicDetail),
    rawProviderErrorsLoggedServerSide: asBoolean(contract.rawProviderErrorsLoggedServerSide),
    aggregateWeatherDetailOmitsRawProviderErrors: asBoolean(contract.aggregateWeatherDetailOmitsRawProviderErrors),
    testsPassed: typeof focused.testsPassed === "number" ? focused.testsPassed : null,
    liveStatus: typeof live.status === "number" ? live.status : null,
    liveCode: asString(live.code),
    liveRateLimitHeader: asString(live.rateLimitHeader),
    freshRescanRequired: asBoolean(remaining.freshFullRepositoryRescanRequiredForScanClosure),
    securityCompleteClaimAllowed: asBoolean(remaining.securityCompleteClaimAllowed),
    distributedAdmissionActivation: asString(remaining.distributedAdmissionActivation),
    exactSavedShareVerdict: asString(remaining.exactSavedShareVerdict),
  };
}

/** @param {unknown} report */
function hwpxArchiveExpansionSecuritySummary(report) {
  if (!isRecord(report)) return {};
  const finding = isRecord(report.finding) ? report.finding : {};
  const contract = isRecord(report.currentSourceContract) ? report.currentSourceContract : {};
  const manifest = isRecord(report.committedTemplateManifest) ? report.committedTemplateManifest : {};
  const verification = isRecord(report.verification) ? report.verification : {};
  const focused = isRecord(verification.focusedAndAdjacentTests) ? verification.focusedAndAdjacentTests : {};
  const live = isRecord(report.liveProbe) ? report.liveProbe : {};
  const remaining = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  return {
    verdict: asString(report.verdict),
    sourceHead: asString(report.sourceHead),
    productionCommit: asString(report.productionCommit),
    scanId: asString(finding.scanId),
    findingId: asString(finding.findingId),
    findingSlug: asString(finding.slug),
    centralDirectoryCheckedBeforeEntryData: asBoolean(contract.centralDirectoryCheckedBeforeEntryData),
    entryCountBudget: typeof contract.entryCountBudget === "number" ? contract.entryCountBudget : null,
    totalUncompressedBytesBudget: typeof contract.totalUncompressedBytesBudget === "number" ? contract.totalUncompressedBytesBudget : null,
    largestEntryUncompressedBytesBudget: typeof contract.largestEntryUncompressedBytesBudget === "number" ? contract.largestEntryUncompressedBytesBudget : null,
    estimatedPeakWorkingBytesBudget: typeof contract.estimatedPeakWorkingBytesBudget === "number" ? contract.estimatedPeakWorkingBytesBudget : null,
    templateCount: typeof manifest.templateCount === "number" ? manifest.templateCount : null,
    availableTemplateCount: typeof manifest.availableTemplateCount === "number" ? manifest.availableTemplateCount : null,
    allTemplatesPassPreDecompressionBudget: asBoolean(manifest.allTemplatesPassPreDecompressionBudget),
    testsPassed: typeof focused.testsPassed === "number" ? focused.testsPassed : null,
    liveStatus: typeof live.status === "number" ? live.status : null,
    liveCode: asString(live.code),
    liveRateLimitHeader: asString(live.rateLimitHeader),
    archiveProcessingReached: asBoolean(live.archiveProcessingReached),
    freshRescanRequired: asBoolean(remaining.freshFullRepositoryRescanRequiredForScanClosure),
    securityCompleteClaimAllowed: asBoolean(remaining.securityCompleteClaimAllowed),
    publicExportDistributedAdmission: asString(remaining.publicExportDistributedAdmission),
    exactSavedShareVerdict: asString(remaining.exactSavedShareVerdict),
  };
}

/**
 * @param {unknown} report
 */
function hermesReviewDecisionFirstViewportSummary(report) {
  if (!isRecord(report)) return {};
  const beforeLive = isRecord(report.beforeLive) ? report.beforeLive : {};
  const afterLocal = isRecord(report.afterLocal) ? report.afterLocal : {};
  const afterLive = isRecord(report.afterLive) ? report.afterLive : {};
  const reviewBoundary = isRecord(report.reviewBoundary) ? report.reviewBoundary : {};
  const remainingBoundaries = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  return {
    verdict: asString(report.verdict),
    sourceHead: asString(report.sourceHead),
    productCommit: asString(report.productCommit),
    productionCommit: asString(report.productionCommit),
    beforePassed: typeof beforeLive.passedCount === "number" ? beforeLive.passedCount : 0,
    beforeViewportCount: typeof beforeLive.viewportCount === "number" ? beforeLive.viewportCount : 0,
    localPassed: typeof afterLocal.passedCount === "number" ? afterLocal.passedCount : 0,
    localViewportCount: typeof afterLocal.viewportCount === "number" ? afterLocal.viewportCount : 0,
    livePassed: typeof afterLive.passedCount === "number" ? afterLive.passedCount : 0,
    liveViewportCount: typeof afterLive.viewportCount === "number" ? afterLive.viewportCount : 0,
    desktopShortFirstActionBottom: typeof afterLive.desktopShortFirstActionBottom === "number"
      ? afterLive.desktopShortFirstActionBottom
      : 0,
    mobileShortFirstActionBottom: typeof afterLive.mobileShortFirstActionBottom === "number"
      ? afterLive.mobileShortFirstActionBottom
      : 0,
    occludedFirstActionCount: typeof afterLive.occludedFirstActionCount === "number"
      ? afterLive.occludedFirstActionCount
      : 0,
    decisionConfirmationRequired: asBoolean(afterLive.decisionConfirmationRequired),
    decisionConfirmationUnlocksAllActions: asBoolean(afterLive.decisionConfirmationUnlocksAllActions),
    humanReviewCompleted: asBoolean(reviewBoundary.humanReviewCompleted),
    exactSavedShareVerdict: asString(remainingBoundaries.exactSavedShareVerdict),
    llmWikiPublication: asString(remainingBoundaries.llmWikiPublication),
    supabaseRlsLaunchIsolation: asString(remainingBoundaries.supabaseRlsLaunchIsolation),
    providerDispatchPersistence: asString(remainingBoundaries.providerDispatchPersistence),
  };
}

/** @param {unknown} report */
function hermesReviewCandidatePositionSummary(report) {
  if (!isRecord(report)) return {};
  const baseline = isRecord(report.baseline) ? report.baseline : {};
  const afterLocal = isRecord(report.afterLocal) ? report.afterLocal : {};
  const afterLive = isRecord(report.afterLive) ? report.afterLive : {};
  const reviewBoundary = isRecord(report.reviewBoundary) ? report.reviewBoundary : {};
  const remainingBoundaries = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  return {
    verdict: asString(report.verdict),
    sourceHead: asString(report.sourceHead),
    productCommit: asString(report.productCommit),
    productionCommit: asString(report.productionCommit),
    baselineNumericPositionVisible: asBoolean(baseline.numericCandidatePositionVisible),
    baselineMeasurementMethod: asString(baseline.measurementMethod),
    localPassed: typeof afterLocal.passedCount === "number" ? afterLocal.passedCount : 0,
    localViewportCount: typeof afterLocal.viewportCount === "number" ? afterLocal.viewportCount : 0,
    livePassed: typeof afterLive.passedCount === "number" ? afterLive.passedCount : 0,
    liveViewportCount: typeof afterLive.viewportCount === "number" ? afterLive.viewportCount : 0,
    localCandidatePositions: Array.isArray(afterLocal.candidatePositions) ? afterLocal.candidatePositions : [],
    liveCandidatePositions: Array.isArray(afterLive.candidatePositions) ? afterLive.candidatePositions : [],
    humanReviewCompleted: asBoolean(reviewBoundary.humanReviewCompleted),
    exactSavedShareVerdict: asString(remainingBoundaries.exactSavedShareVerdict),
    llmWikiPublication: asString(remainingBoundaries.llmWikiPublication),
    supabaseRlsLaunchIsolation: asString(remainingBoundaries.supabaseRlsLaunchIsolation),
    providerDispatchPersistence: asString(remainingBoundaries.providerDispatchPersistence),
  };
}

/** @param {unknown} report */
function hermesReviewEventFactTraceabilitySummary(report) {
  if (!isRecord(report)) return {};
  const beforeLive = isRecord(report.beforeLive) ? report.beforeLive : {};
  const local = isRecord(report.local) ? report.local : {};
  const afterLive = isRecord(report.afterLive) ? report.afterLive : {};
  const contract = isRecord(report.eventFactsContract) ? report.eventFactsContract : {};
  const remaining = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  return {
    verdict: asString(report.verdict),
    sourceHead: asString(report.sourceHead),
    productCommit: asString(report.productCommit),
    productionCommit: asString(report.productionCommit),
    beforePassed: typeof beforeLive.passedCount === "number" ? beforeLive.passedCount : 0,
    beforeViewportCount: typeof beforeLive.viewportCount === "number" ? beforeLive.viewportCount : 0,
    localPassed: typeof local.passedCount === "number" ? local.passedCount : 0,
    localViewportCount: typeof local.viewportCount === "number" ? local.viewportCount : 0,
    livePassed: typeof afterLive.passedCount === "number" ? afterLive.passedCount : 0,
    liveViewportCount: typeof afterLive.viewportCount === "number" ? afterLive.viewportCount : 0,
    boundFactCount: typeof contract.boundFactCount === "number" ? contract.boundFactCount : 0,
    orphanFactCount: typeof contract.orphanFactCount === "number" ? contract.orphanFactCount : 0,
    privateEventTextExposed: asBoolean(contract.privateEventTextExposed),
    humanReviewCompleted: asBoolean(contract.humanReviewCompleted),
    exactSavedShareVerdict: asString(remaining.exactSavedShareVerdict),
    llmWikiPublication: asString(remaining.llmWikiPublication),
    supabaseRlsLaunchIsolation: asString(remaining.supabaseRlsLaunchIsolation),
    providerDispatchPersistence: asString(remaining.providerDispatchPersistence),
  };
}

/** @param {unknown} report */
function hermesReviewTraceBlocksSummary(report) {
  if (!isRecord(report)) return {};
  const beforeLive = isRecord(report.beforeLive) ? report.beforeLive : {};
  const local = isRecord(report.local) ? report.local : {};
  const afterLive = isRecord(report.afterLive) ? report.afterLive : {};
  const contract = isRecord(report.traceabilityContract) ? report.traceabilityContract : {};
  const remaining = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  return {
    verdict: asString(report.verdict),
    sourceHead: asString(report.sourceHead),
    productCommit: asString(report.productCommit),
    productionCommit: asString(report.productionCommit),
    beforePassed: typeof beforeLive.passedCount === "number" ? beforeLive.passedCount : 0,
    beforeViewportCount: typeof beforeLive.viewportCount === "number" ? beforeLive.viewportCount : 0,
    localPassed: typeof local.passedCount === "number" ? local.passedCount : 0,
    localViewportCount: typeof local.viewportCount === "number" ? local.viewportCount : 0,
    livePassed: typeof afterLive.passedCount === "number" ? afterLive.passedCount : 0,
    liveViewportCount: typeof afterLive.viewportCount === "number" ? afterLive.viewportCount : 0,
    resolvedTraceCount: typeof contract.resolvedTraceCount === "number" ? contract.resolvedTraceCount : 0,
    unresolvedTraceCount: typeof contract.unresolvedTraceCount === "number" ? contract.unresolvedTraceCount : 0,
    scopedFixtureHazardCount: typeof contract.scopedFixtureHazardCount === "number" ? contract.scopedFixtureHazardCount : 0,
    allHazardsClosed: asBoolean(contract.allHazardsClosed),
    allDocumentsClosed: asBoolean(contract.allDocumentsClosed),
    humanReviewCompleted: asBoolean(contract.humanReviewCompleted),
    exactSavedShareVerdict: asString(remaining.exactSavedShareVerdict),
    llmWikiPublication: asString(remaining.llmWikiPublication),
    supabaseRlsLaunchIsolation: asString(remaining.supabaseRlsLaunchIsolation),
    providerDispatchPersistence: asString(remaining.providerDispatchPersistence),
  };
}

/** @param {unknown} report */
function hermesReviewTraceMatrixSummary(report) {
  if (!isRecord(report)) return {};
  const beforeLive = isRecord(report.beforeLive) ? report.beforeLive : {};
  const local = isRecord(report.local) ? report.local : {};
  const afterLive = isRecord(report.afterLive) ? report.afterLive : {};
  const contract = isRecord(report.traceabilityContract) ? report.traceabilityContract : {};
  const remaining = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  return {
    verdict: asString(report.verdict),
    sourceHead: asString(report.sourceHead),
    productCommit: asString(report.productCommit),
    productionCommit: asString(report.productionCommit),
    beforePassed: typeof beforeLive.passedCount === "number" ? beforeLive.passedCount : 0,
    beforeViewportCount: typeof beforeLive.viewportCount === "number" ? beforeLive.viewportCount : 0,
    localPassed: typeof local.passedCount === "number" ? local.passedCount : 0,
    localViewportCount: typeof local.viewportCount === "number" ? local.viewportCount : 0,
    livePassed: typeof afterLive.passedCount === "number" ? afterLive.passedCount : 0,
    liveViewportCount: typeof afterLive.viewportCount === "number" ? afterLive.viewportCount : 0,
    canonicalHazardCount: typeof contract.canonicalHazardCount === "number" ? contract.canonicalHazardCount : 0,
    canonicalControlLinkCount: typeof contract.canonicalControlLinkCount === "number" ? contract.canonicalControlLinkCount : 0,
    canonicalDocumentLinkCount: typeof contract.canonicalDocumentLinkCount === "number" ? contract.canonicalDocumentLinkCount : 0,
    canonicalMatrixComplete: asBoolean(contract.canonicalMatrixComplete),
    traceListInternalScroll: asBoolean(contract.traceListInternalScroll),
    traceScrollOwner: asString(contract.traceScrollOwner),
    candidatePaneInternalScroll: asBoolean(contract.candidatePaneInternalScroll),
    traceScreenshotContextVisible: asBoolean(contract.traceScreenshotContextVisible),
    humanReviewCompleted: asBoolean(contract.humanReviewCompleted),
    exactSavedShareVerdict: asString(remaining.exactSavedShareVerdict),
    llmWikiPublication: asString(remaining.llmWikiPublication),
    supabaseRlsLaunchIsolation: asString(remaining.supabaseRlsLaunchIsolation),
    providerDispatchPersistence: asString(remaining.providerDispatchPersistence),
  };
}

/** @param {unknown} report */
function securityResourceRemediationSummary(report) {
  if (!isRecord(report)) return {};
  const scan = isRecord(report.sourceScan) ? report.sourceScan : {};
  const remaining = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  return {
    verdict: asString(report.verdict),
    sourceHead: asString(report.sourceHead),
    productionCommit: asString(report.productionCommit),
    scanFindingCount: typeof scan.findingCount === "number" ? scan.findingCount : null,
    remediatedFindingCount: Array.isArray(report.remediatedFindings) ? report.remediatedFindings.length : null,
    remainingScanFindings: typeof remaining.remainingScanFindings === "number" ? remaining.remainingScanFindings : null,
    providerDispatchPersistence: asString(remaining.providerDispatchPersistence),
    exactSavedShareVerdict: asString(remaining.exactSavedShareVerdict),
  };
}

/** @param {unknown} report */
function securityUpstreamTransportRemediationSummary(report) {
  if (!isRecord(report)) return {};
  const scan = isRecord(report.sourceScan) ? report.sourceScan : {};
  const cumulative = isRecord(report.cumulativeRemediation) ? report.cumulativeRemediation : {};
  const live = isRecord(report.liveChecks) ? report.liveChecks : {};
  const providerProbe = isRecord(live.externalProviderProbe) ? live.externalProviderProbe : {};
  const remaining = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  return {
    verdict: asString(report.verdict),
    sourceHead: asString(report.sourceHead),
    productionCommit: asString(report.productionCommit),
    scanFindingCount: typeof scan.findingCount === "number" ? scan.findingCount : null,
    remediatedThisWave: typeof cumulative.remediatedThisWave === "number" ? cumulative.remediatedThisWave : null,
    remediatedTotal: typeof cumulative.remediatedTotal === "number" ? cumulative.remediatedTotal : null,
    remainingScanFindings: typeof remaining.remainingScanFindings === "number" ? remaining.remainingScanFindings : null,
    externalProviderProbeExecuted: asBoolean(providerProbe.executed),
    providerDispatchPersistence: asString(remaining.providerDispatchPersistence),
    exactSavedShareVerdict: asString(remaining.exactSavedShareVerdict),
  };
}

/** @param {unknown} report */
function securitySafetyReferenceSurfaceRemediationSummary(report) {
  if (!isRecord(report)) return {};
  const scan = isRecord(report.sourceScan) ? report.sourceScan : {};
  const finding = isRecord(report.remediatedFinding) ? report.remediatedFinding : {};
  const cumulative = isRecord(report.cumulativeRemediation) ? report.cumulativeRemediation : {};
  const live = isRecord(report.liveChecks) ? report.liveChecks : {};
  const publicSearch = isRecord(live.publicSafetyReferenceSearch) ? live.publicSafetyReferenceSearch : {};
  const remaining = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  return {
    verdict: asString(report.verdict),
    sourceHead: asString(report.sourceHead),
    productionCommit: asString(report.productionCommit),
    findingId: asString(finding.findingId),
    scanFindingCount: typeof scan.findingCount === "number" ? scan.findingCount : null,
    remediatedThisWave: typeof cumulative.remediatedThisWave === "number" ? cumulative.remediatedThisWave : null,
    remediatedTotal: typeof cumulative.remediatedTotal === "number" ? cumulative.remediatedTotal : null,
    remainingScanFindings: typeof remaining.remainingScanFindings === "number" ? remaining.remainingScanFindings : null,
    liveReturnedItems: typeof publicSearch.returnedItems === "number" ? publicSearch.returnedItems : null,
    publicBodyFieldCount: typeof publicSearch.bodyFieldCount === "number" ? publicSearch.bodyFieldCount : null,
    publicPayloadFieldCount: typeof publicSearch.payloadFieldCount === "number" ? publicSearch.payloadFieldCount : null,
    publicMetadataFieldCount: typeof publicSearch.metadataFieldCount === "number" ? publicSearch.metadataFieldCount : null,
    rateLimitMode: asString(publicSearch.rateLimitMode),
    providerDispatchPersistence: asString(remaining.providerDispatchPersistence),
    exactSavedShareVerdict: asString(remaining.exactSavedShareVerdict),
  };
}

/** @param {unknown} report */
function publicJsonRequestBodyBudgetSummary(report) {
  if (!isRecord(report)) return {};
  const scan = isRecord(report.scan) ? report.scan : {};
  const live = isRecord(report.liveVerification) ? report.liveVerification : {};
  const remaining = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  return {
    verdict: asString(report.verdict),
    sourceHead: asString(report.sourceHead),
    productionCommit: asString(report.productionCommit),
    findingId: asString(scan.findingId),
    liveCaseCount: Array.isArray(live.cases) ? live.cases.length : 0,
    followUpSecurityScan: asString(remaining.followUpSecurityScan),
    securityCompleteClaimAllowed: asBoolean(remaining.securityCompleteClaimAllowed),
    exactSavedShareVerdict: asString(remaining.exactSavedShareVerdict),
  };
}

/** @param {unknown} report */
function improvementPhotoAnalysisBudgetSummary(report) {
  if (!isRecord(report)) return {};
  const scan = isRecord(report.scan) ? report.scan : {};
  const budgets = isRecord(report.budgets) ? report.budgets : {};
  const live = isRecord(report.liveVerification) ? report.liveVerification : {};
  const remaining = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  return {
    verdict: asString(report.verdict),
    sourceHead: asString(report.sourceHead),
    productionCommit: asString(report.productionCommit),
    findingId: asString(scan.findingId),
    maxRequestBytes: typeof budgets.maxRequestBytes === "number" ? budgets.maxRequestBytes : null,
    aggregateConcurrency: typeof budgets.aggregateConcurrency === "number" ? budgets.aggregateConcurrency : null,
    liveCaseCount: Array.isArray(live.cases) ? live.cases.length : 0,
    distributedProductionActivation: asString(remaining.distributedProductionActivation),
    followUpSecurityScan: asString(remaining.followUpSecurityScan),
    securityCompleteClaimAllowed: asBoolean(remaining.securityCompleteClaimAllowed),
    exactSavedShareVerdict: asString(remaining.exactSavedShareVerdict),
  };
}

/** @param {unknown} report */
function publicProviderCancellationSummary(report) {
  if (!isRecord(report)) return {};
  const finding = isRecord(report.securityFinding) ? report.securityFinding : {};
  const verification = isRecord(report.verification) ? report.verification : {};
  const tests = isRecord(verification.focusedAndAdjacentVitest) ? verification.focusedAndAdjacentVitest : {};
  const production = isRecord(report.productionBuild) ? report.productionBuild : {};
  const remaining = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  return {
    verdict: asString(report.verdict),
    sourceHead: asString(report.sourceHead),
    productionCommit: asString(production.commitSha),
    findingId: asString(finding.findingId),
    tests: typeof tests.tests === "number" ? tests.tests : null,
    liveProviderCallExecuted: asBoolean(production.liveProviderCallExecuted),
    followUpSecurityScan: asString(remaining.followUpSecurityScan),
    securityCompleteClaimAllowed: asBoolean(remaining.securityCompleteClaimAllowed),
    exactSavedShareVerdict: asString(remaining.exactSavedShareVerdict),
  };
}

/** @param {unknown} report */
function publicProviderAdmissionSummary(report) {
  if (!isRecord(report)) return {};
  const contracts = isRecord(report.contracts) ? report.contracts : {};
  const ask = isRecord(contracts.publicAskProviderAdmission) ? contracts.publicAskProviderAdmission : {};
  const weights = isRecord(ask.modeWeights) ? ask.modeWeights : {};
  const production = isRecord(report.productionBuild) ? report.productionBuild : {};
  const remaining = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  return {
    verdict: asString(report.verdict),
    sourceHead: asString(report.sourceHead),
    productionCommit: asString(production.commitSha),
    findingCount: Array.isArray(report.securityFindings) ? report.securityFindings.length : 0,
    capacity: typeof ask.capacity === "number" ? ask.capacity : null,
    fullModeWeight: typeof weights.full === "number" ? weights.full : null,
    liveCaseCount: Array.isArray(report.liveChecks) ? report.liveChecks.length : 0,
    distributedProductionActivation: asString(remaining.distributedProductionActivation),
    followUpSecurityScan: asString(remaining.followUpSecurityScan),
    securityCompleteClaimAllowed: asBoolean(remaining.securityCompleteClaimAllowed),
    exactSavedShareVerdict: asString(remaining.exactSavedShareVerdict),
  };
}

/** @param {unknown} report */
function publicAskDistributedAdmissionSummary(report) {
  if (!isRecord(report)) return {};
  const finding = isRecord(report.securityFinding) ? report.securityFinding : {};
  const local = isRecord(report.localProductionProbe) ? report.localProductionProbe : {};
  const live = isRecord(report.liveProductionProbe) ? report.liveProductionProbe : {};
  const remaining = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  return {
    verdict: asString(report.verdict),
    sourceHead: asString(report.sourceHead),
    productCommit: asString(report.productCommit),
    productionCommit: asString(report.productionCommit),
    findingId: asString(finding.findingId),
    localCaseCount: Array.isArray(local.cases) ? local.cases.length : 0,
    liveCaseCount: Array.isArray(live.cases) ? live.cases.length : 0,
    providerCallExecuted: asBoolean(local.providerCallExecuted) || asBoolean(live.providerCallExecuted),
    distributedBackendActivation: asString(remaining.distributedBackendActivation),
    freshFollowUpScan: asString(remaining.freshFollowUpScan),
    securityCompleteClaimAllowed: asBoolean(remaining.securityCompleteClaimAllowed),
    exactSavedShareVerdict: asString(remaining.exactSavedShareVerdict),
  };
}

/** @param {unknown} report */
function publicSearchDistributedAdmissionSummary(report) {
  if (!isRecord(report)) return {};
  const finding = isRecord(report.securityFinding) ? report.securityFinding : {};
  const live = isRecord(report.liveProductionProbe) ? report.liveProductionProbe : {};
  const remaining = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  return {
    verdict: asString(report.verdict),
    sourceHead: asString(report.sourceHead),
    productCommit: asString(report.productCommit),
    productionCommit: asString(report.productionCommit),
    findingId: asString(finding.findingId),
    liveCaseCount: Array.isArray(live.cases) ? live.cases.length : 0,
    providerCallExecuted: asBoolean(live.providerCallExecutedForEvidence),
    distributedBackendActivation: asString(remaining.distributedBackendActivation),
    freshFollowUpScan: asString(remaining.freshFollowUpScan),
    securityCompleteClaimAllowed: asBoolean(remaining.securityCompleteClaimAllowed),
    exactSavedShareVerdict: asString(remaining.exactSavedShareVerdict),
  };
}

/** @param {unknown} report */
function agentChatDurableAdmissionSummary(report) {
  if (!isRecord(report)) return {};
  const production = isRecord(report.productionBuild) ? report.productionBuild : {};
  const live = isRecord(report.liveProbe) ? report.liveProbe : {};
  const remaining = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  return {
    verdict: asString(report.verdict),
    sourceHead: asString(report.sourceHead),
    productionCommit: asString(production.commitSha),
    findingId: isRecord(report.sealedFinding) ? asString(report.sealedFinding.findingId) : "",
    liveRateLimitMode: asString(live.rateLimitMode),
    authenticatedAgentAvailability: asString(live.authenticatedAgentAvailability),
    distributedProductionActivation: asString(remaining.distributedProductionActivation),
    authenticatedRuntimeProbe: asString(remaining.authenticatedRuntimeProbe),
    freshRescanRequired: asBoolean(remaining.freshFullRepositorySecurityScanRequiredForCanonicalClosure),
    securityCompleteClaimAllowed: asBoolean(remaining.securityCompleteClaimAllowed),
    exactSavedShareVerdict: asString(remaining.exactSavedShareVerdict),
  };
}

/** @param {unknown} report */
function mcpProviderAdmissionSummary(report) {
  if (!isRecord(report)) return {};
  const production = isRecord(report.productionBuild) ? report.productionBuild : {};
  const live = isRecord(report.liveProbe) ? report.liveProbe : {};
  const remaining = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  const verification = isRecord(report.verification) ? report.verification : {};
  const focused = isRecord(verification.focused) ? verification.focused : {};
  const adjacent = isRecord(verification.focusedAndAdjacentMcp) ? verification.focusedAndAdjacentMcp : {};
  return {
    verdict: asString(report.verdict),
    sourceHead: asString(report.sourceHead),
    productionCommit: asString(production.commitSha),
    findingId: isRecord(report.sealedFinding) ? asString(report.sealedFinding.findingId) : "",
    focusedTests: typeof focused.tests === "number" ? focused.tests : null,
    adjacentTests: typeof adjacent.tests === "number" ? adjacent.tests : null,
    liveRateLimitMode: asString(live.rateLimitMode),
    authenticatedProviderGenerationAvailability: asString(live.authenticatedProviderGenerationAvailability),
    distributedProductionActivation: asString(remaining.distributedProductionActivation),
    validAuthenticatedRuntimeProbe: asString(remaining.validAuthenticatedRuntimeProbe),
    freshRescanRequired: asBoolean(remaining.freshFullRepositorySecurityScanRequiredForCanonicalClosure),
    securityCompleteClaimAllowed: asBoolean(remaining.securityCompleteClaimAllowed),
    exactSavedShareVerdict: asString(remaining.exactSavedShareVerdict),
  };
}

/** @param {unknown} report */
function shareRecipientContactVerificationSummary(report) {
  if (!isRecord(report)) return {};
  const finding = isRecord(report.securityFinding) ? report.securityFinding : {};
  const contract = isRecord(report.sourceContract) ? report.sourceContract : {};
  const verification = isRecord(report.verification) ? report.verification : {};
  const adjacent = isRecord(verification.focusedAndAdjacent) ? verification.focusedAndAdjacent : {};
  const browser = isRecord(verification.recipientBrowser) ? verification.recipientBrowser : {};
  const live = isRecord(report.liveProbe) ? report.liveProbe : {};
  const remaining = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  return {
    verdict: asString(report.verdict),
    sourceHead: asString(report.sourceHead),
    productionCommit: asString(report.productionCommit),
    findingId: asString(finding.findingId),
    workerIdAloneAccepted: asBoolean(contract.invitationWorkerIdAloneAcceptedForConfirmation),
    verificationValuePersisted: asBoolean(contract.verificationValuePersisted),
    adjacentTests: typeof adjacent.tests === "number" ? adjacent.tests : null,
    browserTests: typeof browser.tests === "number" ? browser.tests : null,
    liveMissingSessionStatus: typeof live.status === "number" ? live.status : null,
    liveRealRecipientVerificationProbe: asString(remaining.liveRealRecipientVerificationProbe),
    freshRescanRequired: asBoolean(remaining.freshFullRepositorySecurityScanRequiredForCanonicalClosure),
    recipientAckLiveDataApproval: asString(remaining.recipientAckLiveDataApproval),
    securityCompleteClaimAllowed: asBoolean(remaining.securityCompleteClaimAllowed),
    exactSavedShareVerdict: asString(remaining.exactSavedShareVerdict),
  };
}

/** @param {unknown} report */
function securityAtomicDbRaceRemediationSummary(report) {
  if (!isRecord(report)) return {};
  const sealedScan = isRecord(report.sealedScan) ? report.sealedScan : {};
  const approval = isRecord(report.approvalRequest) ? report.approvalRequest : {};
  const mutation = isRecord(report.mutationBoundary) ? report.mutationBoundary : {};
  const remaining = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  const findings = Array.isArray(report.findings) ? report.findings.filter(isRecord) : [];
  return {
    verdict: asString(report.verdict),
    sourceHead: asString(report.sourceHead),
    scanId: asString(sealedScan.scanId),
    findingIds: findings.map((finding) => asString(finding.findingId)).filter(Boolean),
    openFindingCount: findings.filter((finding) => finding.currentSourceStillAffected === true).length,
    approvalRequired: asBoolean(approval.required),
    approvalPerformed: !asBoolean(approval.notApprovedOrPerformed),
    migrationAuthored: asBoolean(mutation.migrationAuthored),
    dbMutationPerformed: asBoolean(mutation.dbMutationPerformed),
    freshRescanRequired: asBoolean(remaining.freshFullRepositorySecurityScanRequiredAfterRemediation),
    securityCompleteClaimAllowed: asBoolean(remaining.securityCompleteClaimAllowed),
    exactSavedShareVerdict: asString(remaining.exactSavedShareVerdict),
  };
}

/** @param {unknown} report */
function liveDocumentsShareRoutePerceptionSummary(report) {
  if (!isRecord(report)) return {};
  const measurement = isRecord(report.measurement) ? report.measurement : {};
  const documents = Array.isArray(measurement.documents) ? measurement.documents.filter(isRecord) : [];
  const share = Array.isArray(measurement.workspaceShare) ? measurement.workspaceShare.filter(isRecord) : [];
  const desktopShare = share.find((row) => isRecord(row.viewport) && row.viewport.width === 1440);
  const interpretation = isRecord(report.interpretation) ? report.interpretation : {};
  const remaining = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  const mutation = isRecord(report.mutationBoundary) ? report.mutationBoundary : {};
  return {
    verdict: asString(report.verdict),
    sourceHead: asString(report.sourceHead),
    productionCommit: asString(isRecord(report.productionBuild) ? report.productionBuild.commitSha : ""),
    documentsRows: documents.length,
    workspaceShareRows: share.length,
    desktopShareRegions: typeof desktopShare?.distinctDesktopRegions === "number" ? desktopShare.distinctDesktopRegions : null,
    routeSplitAloneAcceptedAsFix: asBoolean(interpretation.routeSplitAloneAcceptedAsFix),
    exactSavedUserSessionReproduced: asBoolean(remaining.exactSavedUserSessionReproduced),
    exactSavedShareVerdict: asString(remaining.exactSavedShareVerdict),
    dbMutationPerformed: asBoolean(mutation.dbMutationPerformed),
  };
}

/** @param {unknown} report */
function deploymentFreshnessGuardSummary(report) {
  if (!isRecord(report)) return {};
  const verification = isRecord(report.verification) ? report.verification : {};
  const liveBrowser = isRecord(verification.liveBrowser) ? verification.liveBrowser : {};
  const current = isRecord(liveBrowser.normalCurrentDeployment) ? liveBrowser.normalCurrentDeployment : {};
  const drift = isRecord(liveBrowser.simulatedShaDrift) ? liveBrowser.simulatedShaDrift : {};
  const staticAudit = isRecord(verification.canonicalFrontendStaticAudit) ? verification.canonicalFrontendStaticAudit : {};
  const remaining = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  const mutation = isRecord(report.mutationBoundary) ? report.mutationBoundary : {};
  return {
    verdict: asString(report.verdict),
    sourceHead: asString(report.sourceHead),
    productionCommit: asString(isRecord(report.productionBuild) ? report.productionBuild.commitSha : ""),
    currentNoticePresent: asBoolean(current.noticePresent),
    driftRefreshVisible: asBoolean(drift.refreshButtonVisible),
    frontendAuditViolations: typeof staticAudit.violationCount === "number" ? staticAudit.violationCount : null,
    liveAfterDeploymentPending: asBoolean(remaining.liveAfterDeploymentPending),
    exactSavedShareVerdict: asString(remaining.exactSavedShareVerdict),
    dbMutationPerformed: asBoolean(mutation.dbMutationPerformed),
  };
}

/** @param {unknown} report */
function mcpGenerationWorkBudgetSecuritySummary(report) {
  if (!isRecord(report)) return {};
  const contract = isRecord(report.currentSourceContract) ? report.currentSourceContract : {};
  const verification = isRecord(report.verification) ? report.verification : {};
  const adjacent = isRecord(verification.adjacentMcp) ? verification.adjacentMcp : {};
  const remaining = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  const currentRefresh = isRecord(report.currentLiveRefresh) ? report.currentLiveRefresh : {};
  const currentProbe = isRecord(currentRefresh.probe) ? currentRefresh.probe : {};
  return {
    verdict: asString(report.verdict),
    sourceHead: asString(report.sourceHead),
    productionCommit: asString(report.productionCommit),
    sourceHeadMatchesProduction: asBoolean(report.sourceHeadMatchesProduction),
    postBodyMaxBytes: typeof contract.postBodyMaxBytes === "number" ? contract.postBodyMaxBytes : null,
    adjacentTests: typeof adjacent.tests === "number" ? adjacent.tests : null,
    validAuthenticatedRuntimeProbeRequired: asBoolean(remaining.validAuthenticatedRuntimeProbeRequired),
    distributedActivationRequired: asBoolean(remaining.distributedProductionActivationRequired),
    distributedHealthRequired: asBoolean(remaining.distributedProductionHealthRequired),
    currentRefreshStatus: typeof currentProbe.status === "number" ? currentProbe.status : null,
    currentRefreshRateLimitMode: asString(currentProbe.rateLimitHeader),
    currentRefreshErrorCode: asString(currentProbe.errorCode),
    currentRefreshConfigurationState: asString(
      isRecord(currentRefresh.configurationReadiness)
        ? currentRefresh.configurationReadiness.configurationState
        : "",
    ),
    currentRefreshReadinessReason: asString(
      isRecord(currentRefresh.configurationReadiness)
        ? currentRefresh.configurationReadiness.reason
        : "",
    ),
    freshRescanRequired: asBoolean(remaining.freshSecurityRescanRequired),
    exactSavedShareVerdict: asString(remaining.exactSavedShareVerdict),
  };
}

/**
 * @param {unknown} report
 */
function documentAuthoringPaneMarginSummary(report) {
  if (!isRecord(report)) return {};
  const beforeLive = isRecord(report.beforeLive) ? report.beforeLive : {};
  const afterLive = isRecord(report.afterLive) ? report.afterLive : {};
  const remainingBoundaries = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  return {
    verdict: asString(report.verdict),
    productCommit: asString(report.productCommit),
    productionCommit: asString(report.productionCommit),
    sourceHeadMatchesProduction: asBoolean(report.sourceHeadMatchesProduction),
    beforeBelowMargin: typeof beforeLive.paneMarginBelow16Count === "number" ? beforeLive.paneMarginBelow16Count : null,
    liveBelowMargin: typeof afterLive.paneMarginBelow16Count === "number" ? afterLive.paneMarginBelow16Count : null,
    liveMinimumMargin: typeof afterLive.minimumPaneMargin === "number" ? afterLive.minimumPaneMargin : null,
    liveMaximumShellRatio: typeof afterLive.maximumShellRatio === "number" ? afterLive.maximumShellRatio : null,
    exactSavedShareVerdict: asString(remainingBoundaries.exactSavedShareVerdict),
    routeSplitAloneAcceptedAsFix: asBoolean(remainingBoundaries.routeSplitAloneAcceptedAsFix),
  };
}

/**
 * @param {unknown} report
 */
function documentRawDrilldownGeometrySummary(report) {
  if (!isRecord(report)) return {};
  const productionBuild = isRecord(report.productionBuild) ? report.productionBuild : {};
  const mutationBoundary = isRecord(report.mutationBoundary) ? report.mutationBoundary : {};
  const results = Array.isArray(report.results) ? report.results.filter(isRecord) : [];
  const metricValues = (key) => results.flatMap((row) => {
    const metrics = isRecord(row.metrics) ? row.metrics : {};
    return typeof metrics[key] === "number" ? [metrics[key]] : [];
  });
  const shellRatios = metricValues("shellRatio");
  const sourceBottoms = metricValues("sourceBottom");
  const sourceClientHeights = metricValues("sourceClientHeight");
  const sourceRatios = metricValues("sourceRatio");
  const overflowAutoCount = results.filter((row) => {
    const metrics = isRecord(row.metrics) ? row.metrics : {};
    return asString(metrics.sourceOverflowY) === "auto";
  }).length;
  return {
    verdict: asString(report.verdict),
    sourceHead: asString(report.sourceHead),
    productionCommit: asString(productionBuild.commitSha),
    sourceHeadMatchesProduction: asBoolean(report.sourceHeadMatchesProduction),
    documentCount: typeof report.documentCount === "number" ? report.documentCount : null,
    viewportCaseCount: typeof report.viewportCaseCount === "number" ? report.viewportCaseCount : null,
    total: typeof report.total === "number" ? report.total : null,
    pass: typeof report.pass === "number" ? report.pass : null,
    fail: typeof report.fail === "number" ? report.fail : null,
    maximumShellRatio: shellRatios.length ? Math.max(...shellRatios) : null,
    maximumSourceBottom: sourceBottoms.length ? Math.max(...sourceBottoms) : null,
    maximumSourceClientHeight: sourceClientHeights.length ? Math.max(...sourceClientHeights) : null,
    maximumSourceRatio: sourceRatios.length ? Math.max(...sourceRatios) : null,
    overflowAutoCount,
    dbMutationPerformed: asBoolean(mutationBoundary.dbMutationPerformed),
    providerDispatchCalled: asBoolean(mutationBoundary.providerDispatchCalled),
    shareSessionCreated: asBoolean(mutationBoundary.shareSessionCreated),
    exactSavedShareVerdict: asString(mutationBoundary.exactSavedShareVerdict),
  };
}

/**
 * @param {unknown} documentsIa
 */
function documentsLongFormIASummary(documentsIa) {
  if (!isRecord(documentsIa)) return {};
  const results = Array.isArray(documentsIa.results) ? documentsIa.results.filter(isRecord) : [];
  const allLauncherResults = results.filter((item) => asString(item.state) === "all 12 document launcher exposure");
  return {
    verdict: asString(documentsIa.verdict),
    sourceHead: asString(documentsIa.sourceHead),
    routeSplitAloneAcceptedAsFix: asBoolean(documentsIa.routeSplitAloneAcceptedAsFix),
    routeSplitVerdict: asString(documentsIa.routeSplitVerdict),
    providerDispatchLiveClaimed: asBoolean(documentsIa.providerDispatchLiveClaimed),
    dbMutationPerformed: asBoolean(documentsIa.dbMutationPerformed),
    allLauncherExposure: allLauncherResults.map((item) => {
      const viewport = isRecord(item.viewport) ? item.viewport : {};
      const metrics = isRecord(item.metrics) ? item.metrics : {};
      const verdicts = isRecord(item.verdicts) ? item.verdicts : {};
      return {
        viewport: asString(viewport.label),
        launcherExposureVerdict: asString(verdicts.launcherExposureVerdict),
        allDocumentLongFormVerdict: asString(verdicts.allDocumentLongFormVerdict),
        selectedEditorDepthVerdict: asString(verdicts.selectedEditorDepthVerdict),
        coreDocButtonCount: typeof metrics.coreDocButtonCount === "number" ? metrics.coreDocButtonCount : null,
        allDocTabButtonCount: typeof metrics.allDocTabButtonCount === "number" ? metrics.allDocTabButtonCount : null,
        supportingLauncherMovesEditorOutOfView: asBoolean(metrics.supportingLauncherMovesEditorOutOfView),
        actionsBottom: typeof metrics.sectionActionsBottom === "number" ? metrics.sectionActionsBottom : null,
        hazardBottom: typeof metrics.firstHazardFieldBottom === "number" ? metrics.firstHazardFieldBottom : null,
        horizontalOverflow: asBoolean(metrics.horizontalOverflow),
        stickyOverlapCount: typeof metrics.stickyOverlapCount === "number" ? metrics.stickyOverlapCount : null,
      };
    }),
  };
}

/**
 * @param {unknown} dod
 */
function boundedWorkbenchDodSummary(dod) {
  if (!isRecord(dod)) return {};
  const acceptance = isRecord(dod.acceptance) ? dod.acceptance : {};
  const documents = isRecord(acceptance.documents) ? acceptance.documents : {};
  const share = isRecord(acceptance.shareResult) ? acceptance.shareResult : {};
  const evidence = isRecord(dod.evidenceRequirements) ? dod.evidenceRequirements : {};
  const legacy = isRecord(dod.legacyBroadRegressionBoundary) ? dod.legacyBroadRegressionBoundary : {};
  return {
    verdict: asString(dod.verdict),
    routeSplitAloneAcceptedAsFix: asBoolean(dod.routeSplitAloneAcceptedAsFix),
    acceptedStructure: asString(dod.acceptedStructure),
    designSystemTokenContract: asString(dod.designSystemTokenContract),
    documentsDesktopMaxScreens: typeof documents.desktopMaxScreens === "number" ? documents.desktopMaxScreens : null,
    documentsDesktopHardRedScreens: typeof documents.desktopHardRedScreens === "number" ? documents.desktopHardRedScreens : null,
    documentsMobileViewport: asString(documents.mobileViewport),
    shareDesktopMinColumns: typeof share.desktopMinColumns === "number" ? share.desktopMinColumns : null,
    shareMobileStackAllowed: asBoolean(share.mobileStackAllowed),
    requiredViewports: Array.isArray(evidence.requiredViewports) ? evidence.requiredViewports.map(asString).filter(Boolean) : [],
    requiredThemes: Array.isArray(evidence.requiredThemes) ? evidence.requiredThemes.map(asString).filter(Boolean) : [],
    generatedFixtureAndSavedSessionSeparated: asBoolean(evidence.generatedFixtureAndSavedSessionSeparated),
    legacyBroadRegressionBoundary: {
      testFile: asString(legacy.testFile),
      role: asString(legacy.role),
      notAcceptedAsUxPassGate: asBoolean(legacy.notAcceptedAsUxPassGate),
      desktopCollapsedSmokeScreens: typeof legacy.desktopCollapsedSmokeScreens === "number" ? legacy.desktopCollapsedSmokeScreens : null,
      desktopExpandedSmokeScreens: typeof legacy.desktopExpandedSmokeScreens === "number" ? legacy.desktopExpandedSmokeScreens : null,
      mobileCollapsedSmokeScreens: typeof legacy.mobileCollapsedSmokeScreens === "number" ? legacy.mobileCollapsedSmokeScreens : null,
      companionDodRequired: asBoolean(legacy.companionDodRequired),
    },
  };
}

/**
 * @param {unknown} current
 */
function boundedWorkbenchCurrentSummary(current) {
  if (!isRecord(current)) return {};
  const documentRows = Array.isArray(current.documents) ? current.documents.filter(isRecord) : [];
  const generatedDocumentRows = documentRows.filter((row) => {
    const metrics = isRecord(row.metrics) ? row.metrics : {};
    return asString(metrics.state) === "generated-current-workpack";
  });
  const selectedSectionRows = documentRows.filter((row) => {
    const metrics = isRecord(row.metrics) ? row.metrics : {};
    return asString(metrics.state) === "selected-workPlanDraft-section-detail";
  });
  const shareRows = Array.isArray(current.share) ? current.share.filter(isRecord) : [];
  const documentDetailDepthDebts = Array.isArray(current.documentDetailDepthDebts)
    ? current.documentDetailDepthDebts.filter(isRecord)
    : documentRows.filter((row) => {
      const verdicts = isRecord(row.verdicts) ? row.verdicts : {};
      return asString(verdicts.detailDepthVerdict) && asString(verdicts.detailDepthVerdict) !== "PASS";
    }).map((row) => {
      const metrics = isRecord(row.metrics) ? row.metrics : {};
      const verdicts = isRecord(row.verdicts) ? row.verdicts : {};
      return {
        route: asString(metrics.route),
        theme: asString(metrics.theme),
        state: asString(metrics.state),
        viewport: asString(metrics.viewport),
        workpackShellScrollRatio: typeof metrics.workpackShellScrollRatio === "number" ? metrics.workpackShellScrollRatio : null,
        detailDepthVerdict: asString(verdicts.detailDepthVerdict),
      };
    });
  const exactSavedSession = isRecord(current.exactSavedSession) ? current.exactSavedSession : {};
  return {
    verdict: asString(current.verdict),
    sourceHead: asString(current.sourceHead),
    productionCommit: asString(current.productionCommit)
      || (isRecord(current.productionBuild) ? asString(current.productionBuild.commitSha) : ""),
    routeSplitAloneAcceptedAsFix: asBoolean(current.routeSplitAloneAcceptedAsFix),
    providerDispatchLiveClaimed: asBoolean(current.providerDispatchLiveClaimed),
    externalProviderCalled: asBoolean(current.externalProviderCalled),
    dbMutationPerformed: asBoolean(current.dbMutationPerformed),
    generatedCurrentWorkpackMeasured: asBoolean(current.generatedCurrentWorkpackMeasured),
    generatedDocumentRows: generatedDocumentRows.map((row) => {
      const metrics = isRecord(row.metrics) ? row.metrics : {};
      const verdicts = isRecord(row.verdicts) ? row.verdicts : {};
      return {
        route: asString(metrics.route),
        theme: asString(metrics.theme),
        viewport: asString(metrics.viewport),
        overallVerdict: asString(verdicts.overallVerdict),
        bodyHeightRatio: typeof metrics.bodyHeightRatio === "number" ? metrics.bodyHeightRatio : null,
        workpackShellScrollRatio: typeof metrics.workpackShellScrollRatio === "number" ? metrics.workpackShellScrollRatio : null,
        firstActionBottom: typeof metrics.firstActionBottom === "number" ? metrics.firstActionBottom : null,
        firstHazardBottom: typeof metrics.firstHazardBottom === "number" ? metrics.firstHazardBottom : null,
        stickyOverlapCount: typeof metrics.stickyOverlapCount === "number" ? metrics.stickyOverlapCount : null,
        supportingDocsOpenDefault: metrics.supportingDocsOpenDefault === true,
      };
    }),
    selectedSectionRows: selectedSectionRows.map((row) => {
      const metrics = isRecord(row.metrics) ? row.metrics : {};
      const verdicts = isRecord(row.verdicts) ? row.verdicts : {};
      return {
        route: asString(metrics.route),
        theme: asString(metrics.theme),
        viewport: asString(metrics.viewport),
        overallVerdict: asString(verdicts.overallVerdict),
        workpackShellScrollRatio: typeof metrics.workpackShellScrollRatio === "number" ? metrics.workpackShellScrollRatio : null,
        sectionTabCount: typeof metrics.sectionTabCount === "number" ? metrics.sectionTabCount : null,
        selectedSectionTabCount: typeof metrics.selectedSectionTabCount === "number" ? metrics.selectedSectionTabCount : null,
        mountedSectionDetailCount: typeof metrics.mountedSectionDetailCount === "number" ? metrics.mountedSectionDetailCount : null,
        mountedSectionTextareaCount: typeof metrics.mountedSectionTextareaCount === "number" ? metrics.mountedSectionTextareaCount : null,
        mountedSourceTextareaCount: typeof metrics.mountedSourceTextareaCount === "number" ? metrics.mountedSourceTextareaCount : null,
        outsideElements: typeof metrics.outsideElements === "number" ? metrics.outsideElements : null,
      };
    }),
    documentRedRows: documentRows.filter((row) => {
      const verdicts = isRecord(row.verdicts) ? row.verdicts : {};
      return asString(verdicts.overallVerdict) === "RED";
    }).map((row) => {
      const metrics = isRecord(row.metrics) ? row.metrics : {};
      const verdicts = isRecord(row.verdicts) ? row.verdicts : {};
      return {
        route: asString(metrics.route),
        theme: asString(metrics.theme),
        state: asString(metrics.state),
        viewport: asString(metrics.viewport),
        firstTaskVerdict: asString(verdicts.firstTaskVerdict),
        bodyHeightVerdict: asString(verdicts.bodyHeightVerdict),
        longContentContainmentVerdict: asString(verdicts.longContentContainmentVerdict),
        bodyHeightRatio: typeof metrics.bodyHeightRatio === "number" ? metrics.bodyHeightRatio : null,
        firstActionBottom: typeof metrics.firstActionBottom === "number" ? metrics.firstActionBottom : null,
        firstHazardBottom: typeof metrics.firstHazardBottom === "number" ? metrics.firstHazardBottom : null,
        firstHazardVisibleHeight: typeof metrics.firstHazardVisibleHeight === "number" ? metrics.firstHazardVisibleHeight : null,
      };
    }),
    shareScopedRows: shareRows.map((row) => {
      const metrics = isRecord(row.metrics) ? row.metrics : {};
      const verdicts = isRecord(row.verdicts) ? row.verdicts : {};
      return {
        route: asString(metrics.route),
        theme: asString(metrics.theme),
        sessionKind: asString(metrics.sessionKind),
        viewport: asString(metrics.viewport),
        overallVerdict: asString(verdicts.overallVerdict),
        exactSavedSessionVerdict: asString(verdicts.exactSavedSessionVerdict),
        rootWidthRatio: typeof metrics.rootWidthRatio === "number" ? metrics.rootWidthRatio : null,
        desktopXRegionCount: typeof metrics.desktopXRegionCount === "number" ? metrics.desktopXRegionCount : null,
        primaryBottom: typeof metrics.primaryBottom === "number"
          ? metrics.primaryBottom
          : typeof metrics.confirmButtonBottom === "number"
            ? metrics.confirmButtonBottom
            : null,
      };
    }),
    detailDepthDebt: documentDetailDepthDebts.length > 0,
    documentDetailDepthDebts: documentDetailDepthDebts.map((row) => ({
      route: asString(row.route),
      theme: asString(row.theme),
      state: asString(row.state),
      viewport: asString(row.viewport),
      workpackShellScrollRatio: typeof row.workpackShellScrollRatio === "number" ? row.workpackShellScrollRatio : null,
      detailDepthVerdict: asString(row.detailDepthVerdict),
    })),
    exactSavedSession: {
      verdict: asString(exactSavedSession.verdict),
      sessionKind: asString(exactSavedSession.sessionKind),
      exactSavedUserSessionReproduced: asBoolean(exactSavedSession.exactSavedUserSessionReproduced),
      reason: asString(exactSavedSession.reason),
    },
  };
}

/**
 * @param {unknown} koshaCandidateAudit
 */
function koshaCandidateAuditSummary(koshaCandidateAudit) {
  if (!isRecord(koshaCandidateAudit)) return {};
  const exact = isRecord(koshaCandidateAudit.exactTrustRegistryCurrent)
    ? koshaCandidateAudit.exactTrustRegistryCurrent
    : {};
  const subset = isRecord(koshaCandidateAudit.verifiedSubsetCurrent)
    ? koshaCandidateAudit.verifiedSubsetCurrent
    : {};
  const metadata = isRecord(koshaCandidateAudit.officialMetadataRegistry)
    ? koshaCandidateAudit.officialMetadataRegistry
    : {};
  return {
    verdict: asString(koshaCandidateAudit.verdict),
    exactPins: typeof exact.count === "number" ? exact.count : undefined,
    acceptedSubsetItems: typeof subset.acceptedCount === "number" ? subset.acceptedCount : undefined,
    generatedChunks: typeof subset.chunksCount === "number" ? subset.chunksCount : undefined,
    metadataVerifiedNotExact: typeof metadata.metadataVerifiedNotExact === "number" ? metadata.metadataVerifiedNotExact : undefined,
    mutationPerformed: asBoolean(koshaCandidateAudit.mutationPerformed),
    dbMutationPerformed: asBoolean(koshaCandidateAudit.dbMutationPerformed),
    embeddingGenerationPerformed: asBoolean(koshaCandidateAudit.embeddingGenerationPerformed),
    forbiddenClaims: Array.isArray(koshaCandidateAudit.forbiddenClaims)
      ? koshaCandidateAudit.forbiddenClaims.map(asString).filter(Boolean)
      : [],
  };
}

/**
 * @param {unknown} koshaPromotionPacket
 */
function koshaPromotionPacketSummary(koshaPromotionPacket) {
  if (!isRecord(koshaPromotionPacket)) return {};
  const reviewReadiness = isRecord(koshaPromotionPacket.operatorReviewReadiness)
    ? koshaPromotionPacket.operatorReviewReadiness
    : {};
  return {
    verdict: asString(koshaPromotionPacket.verdict),
    candidateCount: typeof koshaPromotionPacket.candidateCount === "number" ? koshaPromotionPacket.candidateCount : undefined,
    selectedStableKeys: isRecord(koshaPromotionPacket.selectionPolicy) && Array.isArray(koshaPromotionPacket.selectionPolicy.selectedStableKeys)
      ? koshaPromotionPacket.selectionPolicy.selectedStableKeys.map(asString).filter(Boolean)
      : [],
    packetReadyForReview: asBoolean(reviewReadiness.packetReadyForReview),
    reviewChecklistComplete: asBoolean(reviewReadiness.reviewChecklistComplete),
    exactTrustPromotionBlockedUntilChecklistComplete: asBoolean(reviewReadiness.exactTrustPromotionBlockedUntilChecklistComplete),
    perCandidateRequiredCheckCount: typeof reviewReadiness.perCandidateRequiredCheckCount === "number"
      ? reviewReadiness.perCandidateRequiredCheckCount
      : undefined,
    mutationPerformed: asBoolean(koshaPromotionPacket.mutationPerformed),
    dbMutationPerformed: asBoolean(koshaPromotionPacket.dbMutationPerformed),
    embeddingGenerationPerformed: asBoolean(koshaPromotionPacket.embeddingGenerationPerformed),
    exactPromotionPerformed: asBoolean(koshaPromotionPacket.exactPromotionPerformed),
    forbiddenClaims: Array.isArray(koshaPromotionPacket.forbiddenClaims)
      ? koshaPromotionPacket.forbiddenClaims.map(asString).filter(Boolean)
      : [],
  };
}

/**
 * @param {{ rootDir: string, buildInfo: unknown, generatedAt?: string }} options
 */
export function buildNorthstarNextRunway(options) {
  const sourceHead = gitHead(options.rootDir);
  const liveCommit = isRecord(options.buildInfo) ? asString(options.buildInfo.commitSha) : "";
  const liveRollup = readJson(options.rootDir, ARTIFACTS.liveRollup);
  const final99TwelveDocumentNoMutation = readOptionalJson(
    options.rootDir,
    ARTIFACTS.final99TwelveDocumentNoMutation,
  );
  const approvalRunway = readJson(options.rootDir, ARTIFACTS.approvalRunway);
  const hermes = readJson(options.rootDir, ARTIFACTS.hermesOpenclawRuntime);
  const launch = readJson(options.rootDir, ARTIFACTS.launchReadiness);
  const documentQuality = readOptionalJson(options.rootDir, ARTIFACTS.documentQualityGrounding);
  const liveDocumentQualityMatrix = readOptionalJson(options.rootDir, ARTIFACTS.liveDocumentQualityMatrix);
  const liveDocumentQualityStressMatrix = readOptionalJson(options.rootDir, ARTIFACTS.liveDocumentQualityStressMatrix);
  const liveDocumentFieldIsolation = readOptionalJson(options.rootDir, ARTIFACTS.liveDocumentFieldIsolation);
  const liveKoshaExactMaterialization = readOptionalJson(options.rootDir, ARTIFACTS.liveKoshaExactMaterialization);
  const liveDocumentWordingReview = readOptionalJson(options.rootDir, ARTIFACTS.liveDocumentWordingReview);
  const liveDocumentBroadReview = readOptionalJson(options.rootDir, ARTIFACTS.liveDocumentBroadReview);
  const liveDocumentEditorialReview = readOptionalJson(options.rootDir, ARTIFACTS.liveDocumentEditorialReview);
  const documentEditorialReviewCockpit = readOptionalJson(options.rootDir, ARTIFACTS.documentEditorialReviewCockpit);
  const documentEditorialReviewReceipt = readOptionalJson(options.rootDir, ARTIFACTS.documentEditorialReviewReceipt);
  const liveDocumentEditorialDuplicateClassification = readOptionalJson(
    options.rootDir,
    ARTIFACTS.liveDocumentEditorialDuplicateClassification,
  );
  const liveDocumentEditorialNearClassification = readOptionalJson(
    options.rootDir,
    ARTIFACTS.liveDocumentEditorialNearClassification,
  );
  const productCapabilityTruth = readOptionalJson(options.rootDir, ARTIFACTS.productCapabilityTruth);
  const ciSupplyChainFullSuite = readOptionalJson(options.rootDir, ARTIFACTS.ciSupplyChainFullSuite);
  const ciSupplyChainFullSuiteResult = ciSupplyChainFullSuiteSummary(ciSupplyChainFullSuite);
  const knowledgePreparationCapabilityTruth = readOptionalJson(options.rootDir, ARTIFACTS.knowledgePreparationCapabilityTruth);
  const knowledgePreparationCapabilityTruthResult = knowledgePreparationCapabilityTruthSummary(
    knowledgePreparationCapabilityTruth,
  );
  const launchOperationsReadiness = readOptionalJson(options.rootDir, ARTIFACTS.launchOperationsReadiness);
  const launchOperationsReadinessResult = launchOperationsReadinessSummary(launchOperationsReadiness);
  const distributedAdmissionActivationApproval = readOptionalJson(
    options.rootDir,
    ARTIFACTS.distributedAdmissionActivationApproval,
  );
  const distributedAdmissionActivationApprovalResult = distributedAdmissionActivationApprovalSummary(
    distributedAdmissionActivationApproval,
  );
  const documentExportCapabilityTruth = readOptionalJson(options.rootDir, ARTIFACTS.documentExportCapabilityTruth);
  const knowledgeViewportWorkbench = readOptionalJson(options.rootDir, ARTIFACTS.knowledgeViewportWorkbench);
  const llmWikiCandidateContentReadiness = readOptionalJson(options.rootDir, ARTIFACTS.llmWikiCandidateContentReadiness);
  const llmWikiCandidateContentReadinessResult = llmWikiCandidateContentReadinessSummary(llmWikiCandidateContentReadiness);
  const llmWikiCandidateContentMatrix = readOptionalJson(options.rootDir, ARTIFACTS.llmWikiCandidateContentMatrix);
  const llmWikiCandidateContentMatrixResult = llmWikiCandidateContentMatrixSummary(llmWikiCandidateContentMatrix);
  const llmWikiSifEvidenceMatrix = readOptionalJson(options.rootDir, ARTIFACTS.llmWikiSifEvidenceMatrix);
  const llmWikiSifEvidenceMatrixResult = llmWikiSifEvidenceMatrixSummary(llmWikiSifEvidenceMatrix);
  const dependencySecurityRemediation = readOptionalJson(options.rootDir, ARTIFACTS.dependencySecurityRemediation);
  const tenantAuthorizationRemediation = readOptionalJson(options.rootDir, ARTIFACTS.tenantAuthorizationRemediation);
  const spreadsheetFormulaNeutralization = readOptionalJson(options.rootDir, ARTIFACTS.spreadsheetFormulaNeutralization);
  const publicProviderWorkBudget = readOptionalJson(options.rootDir, ARTIFACTS.publicProviderWorkBudget);
  const documentExportWorkBudget = readOptionalJson(options.rootDir, ARTIFACTS.documentExportWorkBudget);
  const fullRepositorySecurityScan = readOptionalJson(options.rootDir, ARTIFACTS.fullRepositorySecurityScan);
  const repositorySecurityScanReconciliation = readOptionalJson(
    options.rootDir,
    ARTIFACTS.repositorySecurityScanReconciliation,
  );
  const currentSecurityRemediationLedger = readOptionalJson(
    options.rootDir,
    ARTIFACTS.currentSecurityRemediationLedger,
  );
  const currentRepositorySecurityRescan = readOptionalJson(
    options.rootDir,
    ARTIFACTS.currentRepositorySecurityRescan,
  );
  const freshCurrentSourceSecurityScan = readOptionalJson(
    options.rootDir,
    ARTIFACTS.freshCurrentSourceSecurityScan,
  );
  const currentSourceSecurityResidualRemediation = readOptionalJson(
    options.rootDir,
    ARTIFACTS.currentSourceSecurityResidualRemediation,
  );
  const shareAckPreBodyAdmission = readOptionalJson(
    options.rootDir,
    ARTIFACTS.shareAckPreBodyAdmission,
  );
  const safetyStatusDisconnectLease = readOptionalJson(
    options.rootDir,
    ARTIFACTS.safetyStatusDisconnectLease,
  );
  const weatherFallbackErrorRedaction = readOptionalJson(
    options.rootDir,
    ARTIFACTS.weatherFallbackErrorRedaction,
  );
  const hwpxArchiveExpansionSecurity = readOptionalJson(
    options.rootDir,
    ARTIFACTS.hwpxArchiveExpansionSecurity,
  );
  const publicSearchDistributedRateLimitReadiness = readOptionalJson(
    options.rootDir,
    ARTIFACTS.publicSearchDistributedRateLimitReadiness,
  );
  const publicGenerationAdmissionSecurity = readOptionalJson(
    options.rootDir,
    ARTIFACTS.publicGenerationAdmissionSecurity,
  );
  const securityFollowupRemediation = readOptionalJson(
    options.rootDir,
    ARTIFACTS.securityFollowupRemediation,
  );
  const securityResourceRemediation = readOptionalJson(
    options.rootDir,
    ARTIFACTS.securityResourceRemediation,
  );
  const securityUpstreamTransportRemediation = readOptionalJson(
    options.rootDir,
    ARTIFACTS.securityUpstreamTransportRemediation,
  );
  const securitySafetyReferenceSurfaceRemediation = readOptionalJson(
    options.rootDir,
    ARTIFACTS.securitySafetyReferenceSurfaceRemediation,
  );
  const publicJsonRequestBodyBudget = readOptionalJson(
    options.rootDir,
    ARTIFACTS.publicJsonRequestBodyBudget,
  );
  const improvementPhotoAnalysisBudget = readOptionalJson(
    options.rootDir,
    ARTIFACTS.improvementPhotoAnalysisBudget,
  );
  const publicProviderCancellation = readOptionalJson(
    options.rootDir,
    ARTIFACTS.publicProviderCancellation,
  );
  const publicProviderAdmission = readOptionalJson(
    options.rootDir,
    ARTIFACTS.publicProviderAdmission,
  );
  const publicAskDistributedAdmission = readOptionalJson(
    options.rootDir,
    ARTIFACTS.publicAskDistributedAdmission,
  );
  const publicSearchDistributedAdmission = readOptionalJson(
    options.rootDir,
    ARTIFACTS.publicSearchDistributedAdmission,
  );
  const agentChatDurableAdmission = readOptionalJson(
    options.rootDir,
    ARTIFACTS.agentChatDurableAdmission,
  );
  const mcpProviderAdmission = readOptionalJson(
    options.rootDir,
    ARTIFACTS.mcpProviderAdmission,
  );
  const shareRecipientContactVerification = readOptionalJson(
    options.rootDir,
    ARTIFACTS.shareRecipientContactVerification,
  );
  const securityAtomicDbRaceApprovalBoundary = readOptionalJson(
    options.rootDir,
    ARTIFACTS.securityAtomicDbRaceApprovalBoundary,
  );
  const liveDocumentsShareRoutePerception = readOptionalJson(options.rootDir, ARTIFACTS.liveDocumentsShareRoutePerception);
  const ontologyViewportWorkbench = readOptionalJson(options.rootDir, ARTIFACTS.ontologyViewportWorkbench);
  const deploymentFreshnessGuard = readOptionalJson(options.rootDir, ARTIFACTS.deploymentFreshnessGuard);
  const mcpGenerationWorkBudgetSecurity = readOptionalJson(
    options.rootDir,
    ARTIFACTS.mcpGenerationWorkBudgetSecurity,
  );
  const learningExportRendererSecurity = readOptionalJson(options.rootDir, ARTIFACTS.learningExportRendererSecurity);
  const hermesKnowledgeReviewAuthorityUi = readOptionalJson(options.rootDir, ARTIFACTS.hermesKnowledgeReviewAuthorityUi);
  const hermesReviewDecisionFirstViewport = readOptionalJson(options.rootDir, ARTIFACTS.hermesReviewDecisionFirstViewport);
  const hermesReviewCandidatePosition = readOptionalJson(options.rootDir, ARTIFACTS.hermesReviewCandidatePosition);
  const hermesKnowledgeReviewEvidenceInspector = readOptionalJson(options.rootDir, ARTIFACTS.hermesKnowledgeReviewEvidenceInspector);
  const hermesReviewEventFactTraceability = readOptionalJson(options.rootDir, ARTIFACTS.hermesReviewEventFactTraceability);
  const hermesReviewTraceBlocks = readOptionalJson(options.rootDir, ARTIFACTS.hermesReviewTraceBlocks);
  const hermesReviewTraceMatrix = readOptionalJson(options.rootDir, ARTIFACTS.hermesReviewTraceMatrix);
  const liveDocumentSecondaryGrounding = readOptionalJson(options.rootDir, ARTIFACTS.liveDocumentSecondaryGrounding);
  const liveDocumentSeedProfileIsolation = readOptionalJson(options.rootDir, ARTIFACTS.liveDocumentSeedProfileIsolation);
  const koshaCandidateAudit = readJson(options.rootDir, ARTIFACTS.koshaNextExactCandidateAudit);
  const koshaPromotionPacket = readJson(options.rootDir, ARTIFACTS.koshaExactPromotionPacket);
  const sif = readJson(options.rootDir, ARTIFACTS.sifEmbeddingPreflight);
  const shareGenerated = readJson(options.rootDir, ARTIFACTS.shareGeneratedSessionPerception);
  const shareRecipientLongContentFixture = readOptionalJson(options.rootDir, ARTIFACTS.shareRecipientLongContentFixture);
  const shareExactBoundary = readJson(options.rootDir, ARTIFACTS.shareExactSessionBoundary);
  const shareRecipientAckApproval = readOptionalJson(options.rootDir, ARTIFACTS.shareRecipientAckApprovalPreflight);
  const sharePublicSessionStorageReadiness = readOptionalJson(options.rootDir, ARTIFACTS.sharePublicSessionStorageReadiness);
  const sharePublicSessionStorageApproval = readOptionalJson(options.rootDir, ARTIFACTS.sharePublicSessionStorageApproval);
  const documentsCockpitGeometry = readOptionalJson(options.rootDir, ARTIFACTS.documentsCockpitWorkbenchGeometry);
  const documentSectionNavigation = readOptionalJson(options.rootDir, ARTIFACTS.documentSectionNavigation);
  const documentAllAuthoringGeometry = readOptionalJson(options.rootDir, ARTIFACTS.documentAllAuthoringGeometry);
  const documentAuthoringPaneMargin = readOptionalJson(options.rootDir, ARTIFACTS.documentAuthoringPaneMargin);
  const documentRawDrilldownGeometry = readOptionalJson(options.rootDir, ARTIFACTS.documentRawDrilldownGeometry);
  const documentsIa = readJson(options.rootDir, ARTIFACTS.documentsLongFormIA);
  const boundedDod = readJson(options.rootDir, ARTIFACTS.boundedWorkbenchDod);
  const boundedCurrent = readJson(options.rootDir, ARTIFACTS.boundedWorkbenchCurrent);
  const liveExactEvidenceCommit = isRecord(liveRollup) ? asString(liveRollup.head) : "";
  const liveRollupLiveCommit = isRecord(liveRollup) && isRecord(liveRollup.liveBuildInfo)
    ? asString(liveRollup.liveBuildInfo.commitSha)
    : "";
  const liveRollupHeadMatchesKnownState = liveExactEvidenceCommit === liveCommit || liveExactEvidenceCommit === sourceHead;
  const liveRollupMatchesProduction = liveRollupHeadMatchesKnownState && liveRollupLiveCommit === liveCommit;
  const latestEvidenceCommitLive = sourceHead === liveCommit;
  const sourcePendingChangedPaths = sourceHead !== liveCommit ? gitChangedPaths(options.rootDir, liveCommit, sourceHead) : [];
  const sourceHeadHasProductChanges = sourcePendingChangedPaths.some((item) => !isEvidenceOrToolingPath(item));
  const currentHeadIsEvidenceOnlyPending = sourceHead !== liveCommit && liveRollupMatchesProduction && !sourceHeadHasProductChanges;
  const sourceHeadLivePending = sourceHead !== liveCommit;
  const boundedCurrentSourceHead = isRecord(boundedCurrent) ? asString(boundedCurrent.sourceHead) : "";
  const boundedWorkbenchSourceIncludedInLive = boundedCurrentSourceHead !== ""
    && (boundedCurrentSourceHead === liveCommit || gitIsAncestor(options.rootDir, boundedCurrentSourceHead, liveCommit));
  const boundedWorkbenchCurrentLivePending = boundedCurrentSourceHead !== "" && !boundedWorkbenchSourceIncludedInLive;
  const boundedCurrentSummary = boundedWorkbenchCurrentSummary(boundedCurrent);
  const dependencySecuritySummary = dependencySecurityRemediationSummary(dependencySecurityRemediation);
  const tenantAuthorizationSummary = tenantAuthorizationRemediationSummary(tenantAuthorizationRemediation);
  const spreadsheetFormulaSummary = spreadsheetFormulaNeutralizationSummary(spreadsheetFormulaNeutralization);
  const publicProviderWorkBudgetResult = publicProviderWorkBudgetSummary(publicProviderWorkBudget);
  const documentExportWorkBudgetResult = documentExportWorkBudgetSummary(documentExportWorkBudget);
  const fullRepositorySecuritySummary = fullRepositorySecurityScanSummary(fullRepositorySecurityScan);
  const repositorySecurityScanReconciliationResult = repositorySecurityScanReconciliationSummary(
    repositorySecurityScanReconciliation,
  );
  const currentSecurityRemediationLedgerResult = currentSecurityRemediationLedgerSummary(
    currentSecurityRemediationLedger,
  );
  const currentRepositorySecurityRescanResult = currentRepositorySecurityRescanSummary(
    currentRepositorySecurityRescan,
  );
  const freshCurrentSourceSecurityScanResult = freshCurrentSourceSecurityScanSummary(
    freshCurrentSourceSecurityScan,
  );
  const currentSourceSecurityResidualRemediationResult = currentSourceSecurityResidualRemediationSummary(
    currentSourceSecurityResidualRemediation,
  );
  const shareAckPreBodyAdmissionResult = shareAckPreBodyAdmissionSummary(shareAckPreBodyAdmission);
  const safetyStatusDisconnectLeaseResult = safetyStatusDisconnectLeaseSummary(safetyStatusDisconnectLease);
  const weatherFallbackErrorRedactionResult = weatherFallbackErrorRedactionSummary(weatherFallbackErrorRedaction);
  const hwpxArchiveExpansionSecurityResult = hwpxArchiveExpansionSecuritySummary(hwpxArchiveExpansionSecurity);
  const publicSearchDistributedRateLimitReadinessResult = publicSearchDistributedRateLimitReadinessSummary(
    publicSearchDistributedRateLimitReadiness,
  );
  const publicGenerationAdmissionSecurityResult = publicGenerationAdmissionSecuritySummary(
    publicGenerationAdmissionSecurity,
  );
  const securityFollowupRemediationResult = securityFollowupRemediationSummary(securityFollowupRemediation);
  const securityResourceRemediationResult = securityResourceRemediationSummary(securityResourceRemediation);
  const securityUpstreamTransportRemediationResult = securityUpstreamTransportRemediationSummary(
    securityUpstreamTransportRemediation,
  );
  const securitySafetyReferenceSurfaceRemediationResult = securitySafetyReferenceSurfaceRemediationSummary(
    securitySafetyReferenceSurfaceRemediation,
  );
  const publicJsonRequestBodyBudgetResult = publicJsonRequestBodyBudgetSummary(publicJsonRequestBodyBudget);
  const improvementPhotoAnalysisBudgetResult = improvementPhotoAnalysisBudgetSummary(improvementPhotoAnalysisBudget);
  const publicProviderCancellationResult = publicProviderCancellationSummary(publicProviderCancellation);
  const publicProviderAdmissionResult = publicProviderAdmissionSummary(publicProviderAdmission);
  const publicAskDistributedAdmissionResult = publicAskDistributedAdmissionSummary(publicAskDistributedAdmission);
  const publicSearchDistributedAdmissionResult = publicSearchDistributedAdmissionSummary(publicSearchDistributedAdmission);
  const mcpGenerationWorkBudgetSecurityResult = mcpGenerationWorkBudgetSecuritySummary(
    mcpGenerationWorkBudgetSecurity,
  );
  const learningExportRendererSecurityResult = learningExportRendererSecuritySummary(learningExportRendererSecurity);
  const boundedDetailDepthDebtRows = Array.isArray(boundedCurrentSummary.documentDetailDepthDebts)
    ? boundedCurrentSummary.documentDetailDepthDebts.length
    : 0;
  const uiFollowUpScope = boundedDetailDepthDebtRows > 0
    ? "keep UI follow-up scoped to remaining Documents detail-depth debt or reproduced exact-session desktop Share full-workbench perception issues"
    : "keep UI follow-up scoped to reproduced exact-session desktop Share full-workbench perception issues while preserving the Documents bounded workbench shell-ratio <= 3 contract";

  return {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: options.generatedAt || new Date().toISOString(),
    checkedAtKst: "2026-07-22",
    verdict: "OPEN_APPROVAL_GATED",
    sourceHead,
    productionCommit: liveCommit,
    liveBuildInfo: options.buildInfo,
    latestEvidenceCommitLive,
    currentHeadIsEvidenceOnlyPending,
    sourceHeadLivePending,
    sourceHeadHasProductChanges,
    sourcePendingChangedPaths,
    boundedWorkbenchSourceIncludedInLive,
    boundedWorkbenchCurrentLivePending,
    liveExactEvidenceCommit,
    liveRollupLiveCommit,
    liveRollupMatchesProduction,
    artifacts: Object.fromEntries(
      Object.entries(ARTIFACTS).map(([key, value]) => [key, value.replaceAll("/", "\\")]),
    ),
    provenCurrentState: [
      "live_harness_quality",
      "kosha_exact_trust_registry",
      "live_kosha_exact_materialization",
      "live_document_secondary_grounding",
      "live_document_seed_profile_isolation",
      "live_document_editorial_review",
      "current_live_document_editorial_runtime",
      "document_editorial_review_cockpit",
      "product_capability_truth",
      ...(ciSupplyChainFullSuiteResult.verdict === "PASS_LIVE_PRODUCTION_GITHUB_CI_FULL_SUITE_REMEDIATED"
        && ciSupplyChainFullSuiteResult.sourceHead === ciSupplyChainFullSuiteResult.productionCommit
        && ciSupplyChainFullSuiteResult.githubConclusion === "success"
        && ciSupplyChainFullSuiteResult.testsPassed === 3103
        && ciSupplyChainFullSuiteResult.testsSkipped === 26
        && ciSupplyChainFullSuiteResult.build === "success"
        && ciSupplyChainFullSuiteResult.exactSavedShareVerdict === "MISSING_EVIDENCE"
        && ciSupplyChainFullSuiteResult.approvalGatedBoundariesClosed === false
        ? ["ci_supply_chain_full_suite"]
        : []),
      ...(launchOperationsReadinessProven(launchOperationsReadinessResult)
        ? ["launch_operations_readiness_cockpit"]
        : []),
      "document_export_capability_truth",
      "ontology_viewport_workbench",
      "knowledge_viewport_workbench",
      ...(llmWikiCandidateContentReadinessProven(llmWikiCandidateContentReadinessResult)
        ? ["llm_wiki_candidate_content_readiness"]
        : []),
      ...(llmWikiCandidateContentMatrixProven(llmWikiCandidateContentMatrixResult)
        ? ["llm_wiki_candidate_content_matrix"]
        : []),
      ...(llmWikiSifEvidenceMatrixProven(llmWikiSifEvidenceMatrixResult)
        ? ["llm_wiki_sif_evidence_matrix"]
        : []),
      "dependency_security_remediation",
      "tenant_authorization_remediation",
      "spreadsheet_formula_neutralization",
      "public_provider_work_budget",
      "document_export_work_budget",
      "full_repository_security_scan",
      "repository_security_scan_reconciliation",
      "public_json_request_body_budget",
      "public_ask_distributed_admission",
      "security_followup_remediation",
      "security_resource_remediation",
      "security_upstream_transport_remediation",
      "security_safety_reference_surface_remediation",
      "learning_export_renderer_security",
      "hermes_knowledge_review_authority",
      "hermes_knowledge_review_ui",
      ...(isRecord(hermesReviewDecisionFirstViewport)
        && hermesReviewDecisionFirstViewport.verdict === "PASS_LIVE_PRODUCTION_HERMES_REVIEW_DECISION_FIRST_VIEWPORT"
        ? ["hermes_review_decision_first_viewport"]
        : []),
      ...(isRecord(hermesReviewCandidatePosition)
        && hermesReviewCandidatePosition.verdict === "PASS_LIVE_PRODUCTION_HERMES_REVIEW_CANDIDATE_POSITION"
        ? ["hermes_review_candidate_position"]
        : []),
      ...(isRecord(hermesReviewEventFactTraceability)
        && hermesReviewEventFactTraceability.verdict === "PASS_LIVE_PRODUCTION_HERMES_REVIEW_EVENT_FACT_TRACEABILITY"
        ? ["hermes_review_event_fact_traceability"]
        : []),
      ...(isRecord(hermesReviewTraceBlocks)
        && hermesReviewTraceBlocks.verdict === "PASS_LIVE_PRODUCTION_HERMES_REVIEW_TRACE_BLOCKS"
        ? ["hermes_review_trace_blocks"]
        : []),
      ...(isRecord(hermesReviewTraceMatrix)
        && hermesReviewTraceMatrix.verdict === "PASS_LIVE_PRODUCTION_HERMES_REVIEW_TRACE_MATRIX"
        ? ["hermes_review_trace_matrix"]
        : []),
      "kosha_exact_promotion_packet_ready_for_review",
      "ui_documents_share_cockpit",
      "deployment_freshness_guard",
      "dispatch_standalone_cockpit",
      "share_result_fixture_cockpit",
      "document_quality_grounding_contract",
      "hermes_openclaw_adapter_boundary",
      "sif_embedding_approval_preflight",
      "northstar_approval_runway",
      "rls_llm_wiki_approval_preflight_current_source",
    ],
    noticeState: [
      {
        gate: "final_99_gate",
        state: "notice",
        reason: isRecord(final99TwelveDocumentNoMutation)
          && isRecord(final99TwelveDocumentNoMutation.liveAfterDeployment)
          ? `pass_with_notice with carried auth-history and dispatch-policy notices; no-mutation live template generation passes 12/12 while core PDF export and weather preflight remain ${asString(final99TwelveDocumentNoMutation.liveAfterDeployment.overall)} (${asString(final99TwelveDocumentNoMutation.liveAfterDeployment.blockerCode) || "no blocker"})`
          : "pass_with_notice with carried auth-history and dispatch-policy notices",
      },
      {
        gate: "public_search_distributed_rate_limit_readiness",
        state: "notice",
        reason: "production fail-closed behavior is verified at configurationState=absent; both routes return 503 distributed-unavailable before provider work, and distributed activation remains pending",
      },
      {
        gate: "public_generation_admission_security",
        state: "notice",
        reason: "both public generation routes now fail closed before body parsing with 503 distributed-unavailable when production configuration is absent; activation and a fresh security scan remain open",
      },
      {
        gate: "current_security_remediation_ledger",
        state: "notice",
        reason: "17/23 current findings have deployed-source remediation receipts while three database findings remain approval-gated and three distributed-runtime findings remain open; security-complete is false",
      },
      {
        gate: "current_repository_security_rescan",
        state: "notice",
        reason: "sealed Standard scan records 19 findings with partial coverage; current source remediates six bounded source candidates, while one Share capability credential and 12 database/RLS/atomicity findings remain approval-gated and a fresh full scan is required",
      },
      {
        gate: "fresh_current_source_security_scan",
        state: "notice",
        reason: `fresh Standard scan ${freshCurrentSourceSecurityScanResult.scanId || "missing"} records ${freshCurrentSourceSecurityScanResult.reportableFindingCount ?? "unknown"} open findings with ${freshCurrentSourceSecurityScanResult.coverageCompleteness || "unknown"} coverage; ${freshCurrentSourceSecurityScanResult.approvalFreeProductSourceResidualCount ?? "unknown"} approval-free source residuals, ${freshCurrentSourceSecurityScanResult.approvalSensitiveShareCapabilityCount ?? "unknown"} separately reportable Share capability findings, and ${freshCurrentSourceSecurityScanResult.approvalGatedDatabaseOrAtomicityCount ?? "unknown"} database/RLS/atomicity findings remain open; security-complete is false and exact saved Share remains ${freshCurrentSourceSecurityScanResult.exactSavedShareVerdict || "MISSING_EVIDENCE"}`,
      },
      {
        gate: "current_source_security_residual_remediation",
        state: "notice",
        reason: `deployed source includes ${currentSourceSecurityResidualRemediationResult.residualAnchors?.join(", ") || "missing residuals"} with ${(currentSourceSecurityResidualRemediationResult.focusedTests ?? 0) + (currentSourceSecurityResidualRemediationResult.adjacentTests ?? 0)} local contract tests; live status is ${currentSourceSecurityResidualRemediationResult.liveStatus || "missing"} with behavioral probe=${currentSourceSecurityResidualRemediationResult.behavioralProbeExecuted === true}, the sealed scan remains open pending a fresh full scan, security-complete is false, and exact saved Share remains ${currentSourceSecurityResidualRemediationResult.exactSavedShareVerdict || "MISSING_EVIDENCE"}`,
      },
      {
        gate: "knowledge_preparation_capability_truth",
        state: "notice",
        reason: `deployed source distinguishes distributed configuration lock ${knowledgePreparationCapabilityTruthResult.distributedAdmissionCode || "missing"} from temporary load ${knowledgePreparationCapabilityTruthResult.temporaryConcurrencyCode || "missing"}; live evidence is ${knowledgePreparationCapabilityTruthResult.liveStatus || "missing"} with behavioral probe=${knowledgePreparationCapabilityTruthResult.behavioralProbeExecuted === true}, enhanced runtime remains ${knowledgePreparationCapabilityTruthResult.enhancedLlmRuntime || "missing"}, Wiki/RLS remain ${knowledgePreparationCapabilityTruthResult.llmWikiPublication || "APPROVAL_GATED"}/${knowledgePreparationCapabilityTruthResult.supabaseRlsLaunchIsolation || "APPROVAL_GATED"}, security-complete is false, and exact saved Share remains ${knowledgePreparationCapabilityTruthResult.exactSavedShareVerdict || "MISSING_EVIDENCE"}`,
      },
      {
        gate: "share_ack_prebody_admission_security",
        state: "notice",
        reason: `deployed Share ACK source now applies coarse rate and body-read concurrency admission before application body consumption, with ${shareAckPreBodyAdmissionResult.testsPassed ?? "unknown"} tests and live ${shareAckPreBodyAdmissionResult.liveStatus ?? "unknown"}/${shareAckPreBodyAdmissionResult.liveCode || "missing"}; the sealed finding still requires a fresh scan, live recipient ACK remains ${shareAckPreBodyAdmissionResult.recipientAckLiveDataApproval || "APPROVAL_GATED"}, and exact saved Share remains ${shareAckPreBodyAdmissionResult.exactSavedShareVerdict || "MISSING_EVIDENCE"}`,
      },
      {
        gate: "safety_status_disconnect_lease_security",
        state: "notice",
        reason: `deployed safety-reference status source now retains admission until underlying work settles after disconnect, with ${safetyStatusDisconnectLeaseResult.testsPassed ?? "unknown"} tests and live ${safetyStatusDisconnectLeaseResult.liveStatus ?? "unknown"}/${safetyStatusDisconnectLeaseResult.liveCode || "missing"}; the sealed finding still requires a fresh scan, distributed activation remains ${safetyStatusDisconnectLeaseResult.distributedAdmissionActivation || "OPERATOR_CONFIGURATION_REQUIRED"}, and exact saved Share remains ${safetyStatusDisconnectLeaseResult.exactSavedShareVerdict || "MISSING_EVIDENCE"}`,
      },
      {
        gate: "weather_fallback_error_redaction_security",
        state: "notice",
        reason: `deployed weather source now keeps all ${weatherFallbackErrorRedactionResult.providerFallbackBranchCount ?? "unknown"} provider fallback diagnostics server-side, with ${weatherFallbackErrorRedactionResult.testsPassed ?? "unknown"} tests and live ${weatherFallbackErrorRedactionResult.liveStatus ?? "unknown"}/${weatherFallbackErrorRedactionResult.liveCode || "missing"}; the sealed finding still requires a fresh scan, distributed activation remains ${weatherFallbackErrorRedactionResult.distributedAdmissionActivation || "OPERATOR_CONFIGURATION_REQUIRED"}, and exact saved Share remains ${weatherFallbackErrorRedactionResult.exactSavedShareVerdict || "MISSING_EVIDENCE"}`,
      },
      {
        gate: "hwpx_archive_expansion_security",
        state: "notice",
        reason: `deployed HWPX source validates ${hwpxArchiveExpansionSecurityResult.availableTemplateCount ?? "unknown"}/${hwpxArchiveExpansionSecurityResult.templateCount ?? "unknown"} committed templates against entry, total-uncompressed, largest-entry, and peak-working-set budgets before archive expansion, with ${hwpxArchiveExpansionSecurityResult.testsPassed ?? "unknown"} tests and live ${hwpxArchiveExpansionSecurityResult.liveStatus ?? "unknown"}/${hwpxArchiveExpansionSecurityResult.liveCode || "missing"}; the sealed finding still requires a fresh scan, distributed export activation remains ${hwpxArchiveExpansionSecurityResult.publicExportDistributedAdmission || "OPEN_OPERATOR_CONFIGURATION"}, and exact saved Share remains ${hwpxArchiveExpansionSecurityResult.exactSavedShareVerdict || "MISSING_EVIDENCE"}`,
      },
      {
        gate: "mcp_generation_work_budget_security",
        state: "notice",
        reason: mcpGenerationWorkBudgetSecurityResult.distributedActivationRequired
          ? "deployed source includes measured MCP body and token-bound admission budgets, but distributed configuration is absent and requests fail closed before authentication; activation, a valid authenticated runtime probe, and fresh rescan remain open"
          : "distributed MCP admission is configured but unavailable and fails closed before authentication; backend health, a valid authenticated runtime probe, and fresh rescan remain open",
      },
      {
        gate: "improvement_photo_analysis_budget",
        state: "notice",
        reason: "deployed source includes shared photo byte, file, signature, rate, and concurrency controls; production still reports process-instance admission and a fresh rescan remains open",
      },
      {
        gate: "public_provider_cancellation",
        state: "notice",
        reason: "deployed source forwards disconnect cancellation through weather, knowledge regeneration, and remediation; live provider cancellation was not invoked and a fresh rescan remains open",
      },
      {
        gate: "public_provider_admission",
        state: "notice",
        reason: "deployed source enforces weighted instance admission and no-provider work budgets; distributed production activation and a fresh rescan remain open",
      },
      {
        gate: "agent_chat_durable_admission_security",
        state: "notice",
        reason: "deployed source fails authenticated Agent Chat closed until durable distributed admission is configured; authenticated runtime proof and a fresh rescan remain open",
      },
      {
        gate: "mcp_provider_admission_security",
        state: "notice",
        reason: "deployed source fails provider-generating MCP tools closed until token-and-tenant-bound durable distributed admission is configured; valid authenticated runtime proof and a fresh rescan remain open",
      },
      {
        gate: "share_recipient_contact_verification_security",
        state: "notice",
        reason: "deployed source requires full snapshotted phone or email before worker-attributed confirmation; a real saved-session probe, fresh rescan, and live recipient ACK approval remain open",
      },
    ],
    approvalGated: approvalGates(
      approvalRunway,
      shareRecipientAckApproval,
      distributedAdmissionActivationApprovalResult,
    ),
    launchReadiness: launchReadinessSummary(launch),
    final99TwelveDocumentNoMutation: {
      verdict: isRecord(final99TwelveDocumentNoMutation)
        ? asString(final99TwelveDocumentNoMutation.verdict)
        : "missing",
      currentSourceCommit: isRecord(final99TwelveDocumentNoMutation)
        ? asString(final99TwelveDocumentNoMutation.currentSourceCommit)
        : "",
      localCanonicalPassed: isRecord(final99TwelveDocumentNoMutation)
        && isRecord(final99TwelveDocumentNoMutation.currentSourceLocal)
        ? final99TwelveDocumentNoMutation.currentSourceLocal.canonicalDocumentsPassed
        : null,
      localCorePdfsPassed: isRecord(final99TwelveDocumentNoMutation)
        && isRecord(final99TwelveDocumentNoMutation.currentSourceLocal)
        ? final99TwelveDocumentNoMutation.currentSourceLocal.corePdfsPassed
        : null,
      localOrchestrationDownloads: isRecord(final99TwelveDocumentNoMutation)
        && isRecord(final99TwelveDocumentNoMutation.currentSourceLocal)
        ? final99TwelveDocumentNoMutation.currentSourceLocal.orchestrationDownloadCount
        : null,
      liveOverall: isRecord(final99TwelveDocumentNoMutation)
        && isRecord(final99TwelveDocumentNoMutation.liveAfterDeployment)
        ? asString(final99TwelveDocumentNoMutation.liveAfterDeployment.overall)
        : "missing",
      liveBlockerCode: isRecord(final99TwelveDocumentNoMutation)
        && isRecord(final99TwelveDocumentNoMutation.liveAfterDeployment)
        ? asString(final99TwelveDocumentNoMutation.liveAfterDeployment.blockerCode)
        : "",
      liveAskVerdict: isRecord(final99TwelveDocumentNoMutation)
        && isRecord(final99TwelveDocumentNoMutation.liveAfterDeployment)
        ? asString(final99TwelveDocumentNoMutation.liveAfterDeployment.askVerdict)
        : "",
      liveRequestedAiMode: isRecord(final99TwelveDocumentNoMutation)
        && isRecord(final99TwelveDocumentNoMutation.liveAfterDeployment)
        ? asString(final99TwelveDocumentNoMutation.liveAfterDeployment.requestedAiMode)
        : "",
      liveBlockerSurfaces: isRecord(final99TwelveDocumentNoMutation)
        && isRecord(final99TwelveDocumentNoMutation.liveAfterDeployment)
        && Array.isArray(final99TwelveDocumentNoMutation.liveAfterDeployment.blockerSurfaces)
        ? final99TwelveDocumentNoMutation.liveAfterDeployment.blockerSurfaces.map(asString)
        : [],
      exactSavedShareVerdict: isRecord(final99TwelveDocumentNoMutation)
        && isRecord(final99TwelveDocumentNoMutation.remainingBoundaries)
        ? asString(final99TwelveDocumentNoMutation.remainingBoundaries.exactSavedShareVerdict)
        : "MISSING_EVIDENCE",
      fullyAutomatedLaunchClaimAllowed: isRecord(final99TwelveDocumentNoMutation)
        && isRecord(final99TwelveDocumentNoMutation.remainingBoundaries)
        ? final99TwelveDocumentNoMutation.remainingBoundaries.fullyAutomatedLaunchClaimAllowed === true
        : false,
    },
    uiInterpretation: {
      routeSplitAloneAcceptedAsFix: false,
      acceptedStructure: "three-step app shell plus first-viewport cockpit plus bounded drilldown/detail panes",
      structuralAnswer: "page count alone only moves long documents/messages to another URL; the next product wave is a bounded IA/density wave with a default exposure budget, selected-only workbench, and drilldown/local scroll for long bodies",
      stepShell: {
        input: "work description, mode/preset, evidence attach, and generation CTA first",
        documents: "core 3 status, selected document header, evidence/recheck CTA, and next action first; full 12-document bodies remain selected-only drilldown",
        share: "recipient/channel/language summary, preview/result status, and primary confirmation first; long messages, logs, provenance, and raw metadata remain collapsed/detail content",
      },
      documentsDefaultCockpit: "first actionable cockpit is live-proven with 12 unique document keys, exactly 3 visible core launchers, 9 supporting launchers closed by default, 0 visible supporting launchers, and the legacy document index hidden; do not phrase this as the whole Documents page shortened",
      documentsRemainingDebt: "full 12-document authoring and broad human wording polish remain separate; the all-12 launcher exposure and explicit raw/source editor are now live-bounded secondary drilldowns rather than serial page content, while deeper row/detail editing keeps the local workbench shell ratio target <= 3",
      selectedEditorDetail: "risk-assessment default, same-document reselect, and all-12 launcher exposure now land the field strip, evidence/recheck CTA, first risk row, and hazard field before raw long-form textarea across desktop-short, desktop 1440x900, and mobile; explicit raw/source editing is separately live-bounded across 48/48 rows",
      documentsContainment: "route/page split is only orientation; /documents must remain a selected-only bounded workbench with a default exposure budget, core 3/supporting 9 as index or collapsed navigation, and long source/section/provenance content in drilldown",
      documentsGeneratedCurrentWorkpack: "live generated-current-workpack state is measured separately from default/example Documents; desktop and mobile must keep body containment, first action/hazard visibility, supporting-9 collapsed by default, sticky overlap 0, and local shell ratio <= 3",
      shareDesktop: "current measured Workspace Share passes a scoped three-zone desktop cockpit and 390x723 mobile-stack contract, while the invited recipient fixture separately passes a two-zone desktop workbench; exact saved/generated user sessions that still feel mobile-like require their own width-ratio/grid repro before product changes, and desktop must not regress into a mobile card stack",
      dispatchStandalone: "live standalone /dispatch now separately requires a 1440x723 two-pane viewport cockpit with no hidden root scroll debt, preview/primary/channel actions inside the first viewport, three readable desktop channel columns, compact component typography, plus 390x723 Day/Night primary-action containment, default-collapsed mobile configuration, and exact saved Share MISSING_EVIDENCE",
      shareGeneratedResult: "current-source generated provider-result fixture keeps the result summary inside 1440x723, 1440x900, and 390x844 after the short desktop landing fix; exact saved user sessions still require their own repro if reported",
      shareRecipientLongContent: "live route-controlled long-content fixture keeps desktop recipient Share in two regions, mobile recipient root <= 1.5 viewports, confirmation in the first viewport, long task text in local scroll, and the document group collapsed by default; route split alone is insufficient and this is not exact saved-session proof",
      shareRouteEvidenceBoundary: "separate Share evidence into invited recipient fixture pass, exact saved/generated /share/[sessionId] missing evidence, and manager/workspace share-result route repro; do not use one route's pass to close another route's mobile-like complaint",
      shareMobile: "current compact cockpit remains first-viewport bounded in current evidence",
      hermesOpenclaw: "adapter, fail-closed auth, DNS-pinned trusted HTTPS transport, and explicit opt-in durable cross-instance attempt/terminal ledger are current-proven; authenticated live execution remains approval-gated, and the live unauthenticated broker smoke returns AUTH_REQUIRED before engine execution; live authenticated reviewer UI passes 8/8 viewport contracts and exposes SIF -> KOSHA -> law -> organization history -> site history -> external context authority roles, tenant-memory non-promotion, site-manager acceptance, and human-review requirements without provider, DB, publication, or Share mutation",
    },
    hermesOpenclaw: hermesSummary(hermes),
    documentQualityGrounding: documentQualityGroundingSummary(documentQuality),
    liveDocumentQualityMatrix: liveDocumentQualityMatrixSummary(liveDocumentQualityMatrix),
    liveDocumentQualityStressMatrix: liveDocumentQualityStressMatrixSummary(liveDocumentQualityStressMatrix),
    liveDocumentFieldIsolation: liveDocumentFieldIsolationSummary(liveDocumentFieldIsolation),
    liveKoshaExactMaterialization: liveKoshaExactMaterializationSummary(liveKoshaExactMaterialization),
    liveDocumentWordingReview: liveDocumentWordingReviewSummary(liveDocumentWordingReview),
    liveDocumentBroadReview: liveDocumentBroadReviewSummary(liveDocumentBroadReview),
    liveDocumentEditorialReview: liveDocumentEditorialReviewSummary(liveDocumentEditorialReview),
    documentEditorialReviewCockpit: documentEditorialReviewCockpitSummary(documentEditorialReviewCockpit, documentEditorialReviewReceipt),
    liveDocumentEditorialDuplicateClassification: liveDocumentEditorialDuplicateClassificationSummary(
      liveDocumentEditorialDuplicateClassification,
    ),
    liveDocumentEditorialNearClassification: liveDocumentEditorialNearClassificationSummary(
      liveDocumentEditorialNearClassification,
    ),
    productCapabilityTruth: productCapabilityTruthSummary(productCapabilityTruth),
    ciSupplyChainFullSuite: ciSupplyChainFullSuiteResult,
    knowledgePreparationCapabilityTruth: knowledgePreparationCapabilityTruthResult,
    launchOperationsReadiness: launchOperationsReadinessResult,
    distributedAdmissionActivationApproval: distributedAdmissionActivationApprovalResult,
    documentExportCapabilityTruth: documentExportCapabilityTruthSummary(documentExportCapabilityTruth),
    ontologyViewportWorkbench: ontologyViewportWorkbenchSummary(ontologyViewportWorkbench),
    knowledgeViewportWorkbench: knowledgeViewportWorkbenchSummary(knowledgeViewportWorkbench),
    llmWikiCandidateContentReadiness: llmWikiCandidateContentReadinessResult,
    llmWikiCandidateContentMatrix: llmWikiCandidateContentMatrixResult,
    llmWikiSifEvidenceMatrix: llmWikiSifEvidenceMatrixResult,
    dependencySecurityRemediation: dependencySecuritySummary,
    tenantAuthorizationRemediation: tenantAuthorizationSummary,
    spreadsheetFormulaNeutralization: spreadsheetFormulaSummary,
    publicProviderWorkBudget: publicProviderWorkBudgetResult,
    documentExportWorkBudget: documentExportWorkBudgetResult,
    fullRepositorySecurityScan: fullRepositorySecuritySummary,
    repositorySecurityScanReconciliation: repositorySecurityScanReconciliationResult,
    currentSecurityRemediationLedger: currentSecurityRemediationLedgerResult,
    currentRepositorySecurityRescan: currentRepositorySecurityRescanResult,
    freshCurrentSourceSecurityScan: freshCurrentSourceSecurityScanResult,
    currentSourceSecurityResidualRemediation: currentSourceSecurityResidualRemediationResult,
    shareAckPreBodyAdmission: shareAckPreBodyAdmissionResult,
    safetyStatusDisconnectLease: safetyStatusDisconnectLeaseResult,
    weatherFallbackErrorRedaction: weatherFallbackErrorRedactionResult,
    hwpxArchiveExpansionSecurity: hwpxArchiveExpansionSecurityResult,
    publicSearchDistributedRateLimitReadiness: publicSearchDistributedRateLimitReadinessResult,
    publicGenerationAdmissionSecurity: publicGenerationAdmissionSecurityResult,
    securityFollowupRemediation: securityFollowupRemediationResult,
    securityResourceRemediation: securityResourceRemediationResult,
    securityUpstreamTransportRemediation: securityUpstreamTransportRemediationResult,
    securitySafetyReferenceSurfaceRemediation: securitySafetyReferenceSurfaceRemediationResult,
    publicJsonRequestBodyBudget: publicJsonRequestBodyBudgetResult,
    improvementPhotoAnalysisBudget: improvementPhotoAnalysisBudgetResult,
    publicProviderCancellation: publicProviderCancellationResult,
    publicProviderAdmission: publicProviderAdmissionResult,
    publicAskDistributedAdmission: publicAskDistributedAdmissionResult,
    publicSearchDistributedAdmission: publicSearchDistributedAdmissionResult,
    agentChatDurableAdmission: agentChatDurableAdmissionSummary(agentChatDurableAdmission),
    mcpProviderAdmission: mcpProviderAdmissionSummary(mcpProviderAdmission),
    shareRecipientContactVerification: shareRecipientContactVerificationSummary(shareRecipientContactVerification),
    securityAtomicDbRaceRemediation: securityAtomicDbRaceRemediationSummary(securityAtomicDbRaceApprovalBoundary),
    liveDocumentsShareRoutePerception: liveDocumentsShareRoutePerceptionSummary(liveDocumentsShareRoutePerception),
    deploymentFreshnessGuard: deploymentFreshnessGuardSummary(deploymentFreshnessGuard),
    mcpGenerationWorkBudgetSecurity: mcpGenerationWorkBudgetSecurityResult,
    learningExportRendererSecurity: learningExportRendererSecurityResult,
    hermesKnowledgeReviewAuthorityUi: hermesKnowledgeReviewAuthorityUiSummary(hermesKnowledgeReviewAuthorityUi),
    hermesReviewDecisionFirstViewport: hermesReviewDecisionFirstViewportSummary(hermesReviewDecisionFirstViewport),
    hermesReviewCandidatePosition: hermesReviewCandidatePositionSummary(hermesReviewCandidatePosition),
    hermesKnowledgeReviewEvidenceInspector: hermesKnowledgeReviewEvidenceInspectorSummary(hermesKnowledgeReviewEvidenceInspector),
    hermesReviewEventFactTraceability: hermesReviewEventFactTraceabilitySummary(hermesReviewEventFactTraceability),
    hermesReviewTraceBlocks: hermesReviewTraceBlocksSummary(hermesReviewTraceBlocks),
    hermesReviewTraceMatrix: hermesReviewTraceMatrixSummary(hermesReviewTraceMatrix),
    liveDocumentSecondaryGrounding: liveDocumentSecondaryGroundingSummary(liveDocumentSecondaryGrounding),
    liveDocumentSeedProfileIsolation: liveDocumentSeedProfileIsolationSummary(liveDocumentSeedProfileIsolation),
    koshaNextExactCandidateAudit: koshaCandidateAuditSummary(koshaCandidateAudit),
    koshaExactPromotionPacket: koshaPromotionPacketSummary(koshaPromotionPacket),
    sifEmbeddingRuntime: sifSummary(sif),
    shareGeneratedSessionPerception: shareGeneratedSessionSummary(shareGenerated),
    shareRecipientLongContentFixture: shareRecipientLongContentFixtureSummary(shareRecipientLongContentFixture),
    shareExactSessionBoundary: shareExactSessionBoundarySummary(shareExactBoundary),
    shareRecipientAckApproval: shareRecipientAckApprovalSummary(shareRecipientAckApproval),
    sharePublicSessionStorageReadiness: sharePublicSessionStorageReadinessSummary(sharePublicSessionStorageReadiness),
    sharePublicSessionStorageApproval: sharePublicSessionStorageApprovalSummary(sharePublicSessionStorageApproval),
    documentsCockpitWorkbenchGeometry: documentsCockpitWorkbenchGeometrySummary(documentsCockpitGeometry),
    documentSectionNavigation: documentSectionNavigationSummary(documentSectionNavigation),
    documentAllAuthoringGeometry: documentAllAuthoringGeometrySummary(documentAllAuthoringGeometry),
    documentAuthoringPaneMargin: documentAuthoringPaneMarginSummary(documentAuthoringPaneMargin),
    documentRawDrilldownGeometry: documentRawDrilldownGeometrySummary(documentRawDrilldownGeometry),
    documentsLongFormIA: documentsLongFormIASummary(documentsIa),
    boundedWorkbenchDod: boundedWorkbenchDodSummary(boundedDod),
    boundedWorkbenchCurrent: boundedCurrentSummary,
    nextSafeWorkWithoutApproval: [
      "refresh source/live exact evidence when production marker advances to the current source head",
      "refresh live rollup before claiming live-exact if production advances beyond the current live rollup head",
      "use the KOSHA exact promotion packet as the bounded operator-review set and run scripts/kosha_exact_promotion_review_gate.mjs on the human review input before any exact-trust promotion",
      "keep the next UI product wave framed as bounded IA/density: default exposure budget, selected-only Documents workbench, Documents shell ratio <= 3, and exact-session desktop Share workbench proof",
      "keep Documents acceptance tied to simultaneous exposure, not page count: current status, core 3 launcher, selected document workbench, validation/recheck action, and local-scroll/drilldown for long source, section, evidence, and supporting-9 content",
      "keep document-quality grounding separate from live sample excellence: the focused contract proves SIF/KOSHA/law before LLM prose, naturalize_only model role, qualityContract blocking, and KOSHA support-not-law separation, while human wording review remains separate",
      "keep Share acceptance split by viewport and session kind: desktop must be a 2-3 region cockpit with selected language/message preview and send/export lock, while mobile single-column summaries are allowed only on mobile",
      uiFollowUpScope,
      "promote the bounded-workbench current-source proof to live only after production /api/build-info reaches the product/evidence head and the live probe is rerun",
      "reproduce an exact saved/generated Share session before using fixture or generated /workspace share evidence to close the user's exact Share complaint",
      "treat the Share exact-session boundary as open until a concrete session URL/payload is provided; the current no-mutation boundary audit only proves route presence and missing exact evidence",
      "keep Share UI evidence split by route: invited recipient fixture, exact saved/generated /share/[sessionId], and manager/workspace share-result state each need their own geometry before closing user-specific mobile-like complaints",
      "resolve public Share storage readiness before exact saved-session closure: current evidence shows workpacks readable but workpack_share_sessions missing from production PostgREST schema cache",
      "do not create a production saved Share session unless the user supplies a concrete existing URL or explicitly approves DB-backed share-session creation; POST /api/workpacks/[id]/share-sessions inserts workpack_share_sessions",
      "keep invited-recipient ACK canary approval-gated: production workpack_share_sessions and workpack_read_confirmations rows require explicit live-data mutation approval before any real ACK readback claim",
      "keep Hermes/OpenClaw authenticated live execution held: tenant envelope, tool denial, Evidence Harness, DNS-pinned trusted transport, and the explicit opt-in atomic attempt/terminal ledger are source/live-proven, while operator configuration and the authenticated canary remain approval-gated",
      "keep provider dispatch, RLS, LLM Wiki publication, and SIF vector runtime as approval-required gates",
      "keep knowledge preparation capability truth separate from runtime activation: configure approved distributed admission and run one bounded authenticated preparation probe before claiming enhanced LLM readiness, while Wiki publication and RLS stay separately approval-gated",
      "do not claim full launch completion while final-99 remains pass_with_notice and approval-gated runtime boundaries remain held",
      "preserve the immutable original 18-finding repository scan as the historical baseline; the sealed follow-up scan accounts for 5,241 files and retains 17 reportable findings plus one renderer-dependent deferred candidate, while the companion no-DB wave bounds 2 findings and mitigates 2 with a distributed-rate residual; resolve the remaining DB/RLS, renderer, distributed-rate, and exact saved Share boundaries before any security-complete claim",
    ],
    providerLiveDispatchClaimed: false,
    dbMutationPerformed: false,
  };
}

/**
 * @param {ReturnType<typeof buildNorthstarNextRunway>} report
 */
export function renderNorthstarNextRunwayMarkdown(report) {
  const approvalRows = report.approvalGated.map((gate) => (
    `| ${gate.gate} | \`${gate.state}\` | \`${gate.currentSafetyLock}\` | ${gate.approvalNeeded.join("; ")} |`
  ));
  const boundedDocumentRedRows = Array.isArray(report.boundedWorkbenchCurrent.documentRedRows)
    ? report.boundedWorkbenchCurrent.documentRedRows.length
    : 0;
  const boundedDetailDepthDebtRows = Array.isArray(report.boundedWorkbenchCurrent.documentDetailDepthDebts)
    ? report.boundedWorkbenchCurrent.documentDetailDepthDebts.length
    : 0;
  const boundedWorkbenchNote = boundedDocumentRedRows === 0
    ? boundedDetailDepthDebtRows === 0
      ? `Current bounded-workbench gate: \`${report.boundedWorkbenchCurrent.verdict}\`; first-task/body containment rows pass, and no Documents rows carry local workbench detail-depth debt. Share rows remain scoped if exact saved session evidence is missing.`
      : `Current bounded-workbench gate: \`${report.boundedWorkbenchCurrent.verdict}\`; first-task/body containment rows pass, but ${boundedDetailDepthDebtRows} Documents row(s) carry local workbench detail-depth debt when \`detailDepthDebt\` is \`true\`. Share rows remain scoped if exact saved session evidence is missing.`
    : `Current bounded-workbench source/local gate: \`${report.boundedWorkbenchCurrent.verdict}\`; ${boundedDocumentRedRows} Documents row(s) remain RED in the artifact, while Share rows remain scoped if exact saved session evidence is missing.`;
  const liveNote = report.latestEvidenceCommitLive
    ? "Note: source HEAD and production marker match for this artifact."
    : report.liveRollupMatchesProduction
      ? report.sourceHeadHasProductChanges
        ? `Note: current HEAD \`${report.sourceHead}\` includes product/runtime file changes that are not live yet. Production is still \`${report.productionCommit}\`, and the live rollup remains exact for that deployed marker.`
        : `Note: current HEAD \`${report.sourceHead}\` is an evidence-only or tooling refresh pushed after the live-exact artifact set. Production is still \`${report.productionCommit}\`, and the live rollup remains exact for that deployed marker.`
      : `Note: current HEAD \`${report.sourceHead}\` is ahead of production \`${report.productionCommit}\`. Product/evidence changes are source-local verified and live-pending until production advances and the live probe is rerun.`;

  return `# North Star Next Runway

Checked at: 2026-07-22 KST

Verdict: \`${report.verdict}\`

Source HEAD: \`${report.sourceHead}\`

Production \`/api/build-info\`: \`${report.productionCommit}\`

Latest evidence commit live: \`${report.latestEvidenceCommitLive}\`

Source head live pending: \`${report.sourceHeadLivePending}\`

Source head has product changes: \`${report.sourceHeadHasProductChanges}\`

Source pending changed paths: ${report.sourcePendingChangedPaths.length ? report.sourcePendingChangedPaths.map((item) => `\`${item}\``).join(", ") : "`none`"}

Current head is evidence-only pending: \`${report.currentHeadIsEvidenceOnlyPending}\`

Bounded workbench current live pending: \`${report.boundedWorkbenchCurrentLivePending}\`

Live rollup source head: \`${report.liveExactEvidenceCommit}\`

Live rollup matches production: \`${report.liveRollupMatchesProduction}\`

${liveNote}

Open-gate artifact: \`evaluation\\northstar-open-gates-current\\report.json\`

Live-rollup artifact: \`evaluation\\northstar-live-rollup-2026-07-20\\report.json\`

## Proven Current State

- Current launch smoke is \`${report.launchReadiness.verdict || "missing"}\`: \`/api/ask\` status \`${report.launchReadiness.apiAskStatus ?? "unknown"}\`, error \`${report.launchReadiness.apiAskErrorCode || "none"}\`, admission \`${report.launchReadiness.apiAskRateLimit || "unknown"}/${report.launchReadiness.apiAskWorkUnit || "unknown"}\`, demo allowed=\`${report.launchReadiness.safeLaunchDemoClaimAllowed === true}\`, dispatch called=\`${report.launchReadiness.dispatchCalled === true}\`. Distributed admission activation is \`${report.launchReadiness.distributedAdmissionActivation || "unknown"}\`; exact saved Share remains \`${report.launchReadiness.exactSavedShareVerdict || "MISSING_EVIDENCE"}\`.
- Live harness quality is proven.
- KOSHA exact trust registry is proven for the accepted exact-trust slice.
- KOSHA next exact candidate audit identifies the 234-item current native technical-support subset and 231 metadata-verified non-exact candidates without mutation.
- KOSHA exact promotion packet selects a bounded operator-review set without exact-trust registry mutation.
- KOSHA exact promotion review gate is available to fail closed on incomplete or mismatched human checklist input before any separate approval step.
- Documents and Share cockpit UI is proven only for the current evidence scope.
- Standalone Dispatch cockpit is proven for the current evidence scope.
- Generated Share result fixture cockpit is proven without claiming real provider dispatch.
- Document quality grounding is proven for the focused contract: \`${report.documentQualityGrounding.verdict || "missing"}\`, tests passed \`${report.documentQualityGrounding.testsPassed ?? 0}\`, SIF/KOSHA/law evidence remains before LLM prose, and KOSHA support is not promoted to statutory mandate. Live model sample excellence remains a separate human-review proof.
- Live multi-scenario document quality is measured separately: \`${report.liveDocumentQualityMatrix.verdict || "missing"}\`, live scenarios passed \`${report.liveDocumentQualityMatrix.livePassed ?? 0}/${report.liveDocumentQualityMatrix.scenarioCount ?? 0}\`, structured risk controls remain distinct, and foreign-worker briefing stays scenario-relevant. This five-scenario proof does not replace broad human wording review.
- Live high-risk document quality stress coverage is measured separately: \`${report.liveDocumentQualityStressMatrix.verdict || "missing"}\`, live scenarios passed \`${report.liveDocumentQualityStressMatrix.livePassed ?? 0}/5\`, with product-in-production \`${report.liveDocumentQualityStressMatrix.productCommitIncludedInProduction === true}\`. This stress proof does not replace broad human wording review or exact saved Share evidence.
- Live document field isolation is measured separately: \`${report.liveDocumentFieldIsolation.verdict || "missing"}\`, live scenarios passed \`${report.liveDocumentFieldIsolation.livePassed ?? 0}/10\`, live pending \`${report.liveDocumentFieldIsolation.liveAfterDeploymentPending === true}\`. This gate prevents process/task/equipment cross-scenario leakage; it does not replace broad human wording review or exact saved Share evidence.
- Live KOSHA exact-pin materialization is measured separately: \`${report.liveKoshaExactMaterialization.verdict || "missing"}\`, live scenarios passed \`${report.liveKoshaExactMaterialization.livePassed ?? 0}/3\`, product-in-production \`${report.liveKoshaExactMaterialization.productCommitMatchesProduction === true}\`. This proves only the current three exact pins in relevant structured rows; registry expansion still requires completed human review and separate approval.
- Live synthetic wording and field usability are measured separately: \`${report.liveDocumentWordingReview.verdict || "missing"}\`, live scenarios passed \`${report.liveDocumentWordingReview.livePassed ?? 0}/5\`, live pending \`${report.liveDocumentWordingReview.liveAfterDeploymentPending === true}\`. This gate catches fixed-profile field leakage and selected-document wording defects, while broad human review and exact saved Share evidence remain separate.
- Live 12-deliverable presence and applicability are measured separately: \`${report.liveDocumentBroadReview.verdict || "missing"}\`, UI/integrity/reviewed documents \`${report.liveDocumentBroadReview.uiDocumentCount ?? 0}/${report.liveDocumentBroadReview.integrityRequiredCount ?? 0}/${report.liveDocumentBroadReview.reviewedDocumentCount ?? 0}\`, before missingUnexpected \`${report.liveDocumentBroadReview.beforeMissingUnexpected ?? 0}\`, live missingUnexpected \`${report.liveDocumentBroadReview.liveMissingUnexpected ?? 0}\`, and workPermitDraft presentNonEmpty \`${report.liveDocumentBroadReview.workPermitPresentNonEmpty ?? 0}/5\`. The six-document synthetic wording gate is not accepted as 12-document deliverable coverage; exact saved Share remains \`${report.liveDocumentBroadReview.exactSavedShareVerdict || "MISSING_EVIDENCE"}\`.
- Live 12-deliverable automated editorial quality is measured separately: \`${report.liveDocumentEditorialReview.verdict || "missing"}\`, live scenarios \`${report.liveDocumentEditorialReview.livePassed ?? 0}/${report.liveDocumentEditorialReview.scenarioCount ?? 0}\`, reviewed document surface \`${report.liveDocumentEditorialReview.reviewedDocumentSurfaceCount ?? 0}\`, placeholder/legal/awkward/evidence mismatch \`${report.liveDocumentEditorialReview.placeholderFindingCount ?? 0}/${report.liveDocumentEditorialReview.legalOverclaimFindingCount ?? 0}/${report.liveDocumentEditorialReview.awkwardCompositionFindingCount ?? 0}/${report.liveDocumentEditorialReview.evidenceDomainMismatchCount ?? 0}\`, and duplicate findings exact/near \`${report.liveDocumentEditorialReview.exactLineOveruseCount ?? 0}/${report.liveDocumentEditorialReview.nearDuplicateLineOveruseCount ?? 0}\`. This is reviewer-ready automated evidence with humanReviewCompleted=\`${report.liveDocumentEditorialReview.humanReviewCompleted === true}\`, not a combined human PASS; exact saved Share remains \`${report.liveDocumentEditorialReview.exactSavedShareVerdict || "MISSING_EVIDENCE"}\`.
- The live 12-document human editorial review cockpit is measured separately: \`${report.documentEditorialReviewCockpit.verdict || "missing"}\`, live geometry \`${report.documentEditorialReviewCockpit.livePassed ?? 0}/4\`, documents/checks \`${report.documentEditorialReviewCockpit.canonicalDocumentCount ?? 0}/${report.documentEditorialReviewCockpit.reviewerCheckCount ?? 0}\`, desktop/mobile zones \`${report.documentEditorialReviewCockpit.desktopZones ?? 0}/${report.documentEditorialReviewCockpit.mobileColumns ?? 0}\`, accessibility cases \`${report.documentEditorialReviewCockpit.accessibilityRowsPassed ?? 0}/4\`, roving tabs/labelled tabpanel/Escape focus restore \`${report.documentEditorialReviewCockpit.keyboardRovingTabNavigation === true}/${report.documentEditorialReviewCockpit.screenReaderTabPanelContract === true}/${report.documentEditorialReviewCockpit.escapeRestoresLaunchFocus === true}\`, browser-local hydration/lifecycle/failure/denial \`${report.documentEditorialReviewCockpit.reviewerHydrationDoesNotOverwriteStorage === true}/${report.documentEditorialReviewCockpit.storageLifecycleVisible === true}/${report.documentEditorialReviewCockpit.storageFailureVisible === true}/${report.documentEditorialReviewCockpit.storageFailureProbePass === true}\`, and cockpitReady=\`${report.documentEditorialReviewCockpit.cockpitReady === true}\`. Its local receipt is \`${report.documentEditorialReviewCockpit.receiptVerdict || "missing"}\`, ready=\`${report.documentEditorialReviewCockpit.receiptReady === true}\`, locked cases \`${report.documentEditorialReviewCockpit.receiptLockedCases ?? 0}/2\`, documents/checks \`${report.documentEditorialReviewCockpit.receiptUniqueDocumentKeyCount ?? 0}/${report.documentEditorialReviewCockpit.receiptReviewerCheckCount ?? 0}\`, bound findings/count/reviewed \`${report.documentEditorialReviewCockpit.receiptFindingsBound === true}/${report.documentEditorialReviewCockpit.receiptEditorialFindingCount ?? 0}/${report.documentEditorialReviewCockpit.receiptEditorialFindingsReviewed === true}\`, and API requests \`${report.documentEditorialReviewCockpit.receiptApiRequestCount ?? 0}\`. ${report.documentEditorialReviewCockpit.cockpitReady === true ? "It proves" : "It does not prove"} the bounded local workflow and fail-closed self-attested JSON receipt exist; reviewer identity verified/server recorded/approval granted remain \`${report.documentEditorialReviewCockpit.reviewerIdentityVerified === true}/${report.documentEditorialReviewCockpit.serverRecorded === true}/${report.documentEditorialReviewCockpit.approvalGranted === true}\`, humanReviewCompleted=\`${report.documentEditorialReviewCockpit.humanReviewCompleted === true}\`, broadHumanWordingReviewRequired=\`${report.documentEditorialReviewCockpit.broadHumanWordingReviewRequired === true}\`, mutations DB/provider/Share/vector/wiki/KOSHA=\`${report.documentEditorialReviewCockpit.dbMutationPerformed === true}/${report.documentEditorialReviewCockpit.providerDispatchCalled === true}/${report.documentEditorialReviewCockpit.shareSessionCreated === true}/${report.documentEditorialReviewCockpit.vectorRuntimeCalled === true}/${report.documentEditorialReviewCockpit.wikiPublished === true}/${report.documentEditorialReviewCockpit.koshaRegistryMutationPerformed === true}\`, and exact saved Share remains \`${report.documentEditorialReviewCockpit.exactSavedShareVerdict || "MISSING_EVIDENCE"}\`.
- Live editorial duplicate classification is measured separately: \`${report.liveDocumentEditorialDuplicateClassification.verdict || "missing"}\`, generic template overuse \`${report.liveDocumentEditorialDuplicateClassification.beforeGenericTemplateOveruseCount ?? 0}->${report.liveDocumentEditorialDuplicateClassification.liveGenericTemplateOveruseCount ?? 0}\`, retained reviewer findings exact/near \`${report.liveDocumentEditorialDuplicateClassification.exactLineOveruseCount ?? 0}/${report.liveDocumentEditorialDuplicateClassification.nearDuplicateLineOveruseCount ?? 0}\`, and humanReviewCompleted=\`${report.liveDocumentEditorialDuplicateClassification.humanReviewCompleted === true}\`. Only generic template overuse fails automatically; safety-control and legal-reference repetition remains visible, and exact saved Share remains \`${report.liveDocumentEditorialDuplicateClassification.exactSavedShareVerdict || "MISSING_EVIDENCE"}\`.
- Live editorial near-duplicate classification preserves \`${report.liveDocumentEditorialNearClassification.beforeNearDuplicateLineOveruseCount ?? 0}->${report.liveDocumentEditorialNearClassification.liveNearDuplicateLineOveruseCount ?? 0}\` findings while reducing unclassified human-review-required \`${report.liveDocumentEditorialNearClassification.beforeHumanReviewRequiredCount ?? 0}->${report.liveDocumentEditorialNearClassification.liveHumanReviewRequiredCount ?? 0}\`. The retained role-prefix/context/hazard/control categories are \`${report.liveDocumentEditorialNearClassification.rolePrefixVariantCount ?? 0}/${report.liveDocumentEditorialNearClassification.independentContextCount ?? 0}/${report.liveDocumentEditorialNearClassification.hazardConsistencyCount ?? 0}/${report.liveDocumentEditorialNearClassification.controlConsistencyCount ?? 0}\`; humanReviewCompleted=\`${report.liveDocumentEditorialNearClassification.humanReviewCompleted === true}\` and exact saved Share remains \`${report.liveDocumentEditorialNearClassification.exactSavedShareVerdict || "MISSING_EVIDENCE"}\`.
- Live product capability truth is measured separately: \`${report.productCapabilityTruth.verdict || "missing"}\`; manual/provider dispatch is \`${report.productCapabilityTruth.dispatchMode || "unknown"}\` with reason \`${report.productCapabilityTruth.dispatchReason || "unknown"}\`, scheduled briefing email ready=\`${report.productCapabilityTruth.briefingEmailReady === true}\`, photo Vision/OCR ready/accepted-only=\`${report.productCapabilityTruth.photoVisionReady === true}/${report.productCapabilityTruth.photoAcceptedOnly === true}\`, and AI modes are \`${report.productCapabilityTruth.aiModes?.join(", ") || "missing"}\`. No provider or photo POST call is claimed. This does not unlock provider persistence; exact saved Share remains \`${report.productCapabilityTruth.exactSavedShareVerdict || "MISSING_EVIDENCE"}\` and Documents/Share IA remains \`${report.productCapabilityTruth.documentsShareIaVerdict || "OPEN_SEPARATE_VIEWPORT_IA_WAVE"}\`.
- Pinned CI supply-chain/full-suite proof is \`${report.ciSupplyChainFullSuite.verdict || "missing"}\`: GitHub run \`${report.ciSupplyChainFullSuite.githubRunId ?? "missing"}\` concluded \`${report.ciSupplyChainFullSuite.githubConclusion || "missing"}\` with \`${report.ciSupplyChainFullSuite.testsPassed ?? "unknown"}\` tests passed, \`${report.ciSupplyChainFullSuite.testsSkipped ?? "unknown"}\` skipped, and build \`${report.ciSupplyChainFullSuite.build || "missing"}\`. Checkout/setup-node remain immutable SHAs. This does not close unrelated security findings or approval-gated runtime work; exact saved Share remains \`${report.ciSupplyChainFullSuite.exactSavedShareVerdict || "MISSING_EVIDENCE"}\`.
- Knowledge preparation capability truth is a separate notice: \`${report.knowledgePreparationCapabilityTruth.verdict || "missing"}\`; distributed configuration failures use \`${report.knowledgePreparationCapabilityTruth.distributedAdmissionCode || "missing"}\`, temporary load uses \`${report.knowledgePreparationCapabilityTruth.temporaryConcurrencyCode || "missing"}\`, and the UI distinction is \`${report.knowledgePreparationCapabilityTruth.configurationLockDistinguishedFromLoad === true}\`. Live evidence is \`${report.knowledgePreparationCapabilityTruth.liveStatus || "missing"}\` with behavioral probe=\`${report.knowledgePreparationCapabilityTruth.behavioralProbeExecuted === true}\`. Enhanced runtime remains \`${report.knowledgePreparationCapabilityTruth.enhancedLlmRuntime || "missing"}\`, authenticated preparation/Wiki/RLS remain \`${report.knowledgePreparationCapabilityTruth.authenticatedLivePreparationProbe || "APPROVAL_GATED"}/${report.knowledgePreparationCapabilityTruth.llmWikiPublication || "APPROVAL_GATED"}/${report.knowledgePreparationCapabilityTruth.supabaseRlsLaunchIsolation || "APPROVAL_GATED"}\`, security-complete remains \`${report.knowledgePreparationCapabilityTruth.securityCompleteClaimAllowed === true}\`, and exact saved Share remains \`${report.knowledgePreparationCapabilityTruth.exactSavedShareVerdict || "MISSING_EVIDENCE"}\`.
- Live launch operations readiness is measured separately: \`${report.launchOperationsReadiness.verdict || "missing"}\`; first-viewport receipts \`${report.launchOperationsReadiness.firstViewportCount ?? 0}/${report.launchOperationsReadiness.rowCount ?? 0}\`, desktop four-column \`${report.launchOperationsReadiness.desktopFourColumnCount ?? 0}/2\`, mobile local-scroll \`${report.launchOperationsReadiness.mobileLocalScrollCount ?? 0}/2\`, and console errors \`${report.launchOperationsReadiness.browserConsoleErrorCount ?? 0}\`. Runtime truth remains admission \`${report.launchOperationsReadiness.publicAdmission || "unknown"}\`, dispatch \`${report.launchOperationsReadiness.providerDispatch || "unknown"}\`, and photo Vision \`${report.launchOperationsReadiness.photoVision || "unknown"}\`; distributed configured/provider ready/fully automated remain \`${report.launchOperationsReadiness.distributedAdmissionConfigured === true}/${report.launchOperationsReadiness.providerDispatchReady === true}/${report.launchOperationsReadiness.fullyAutomatedLaunchClaimAllowed === true}\`, and exact saved Share remains \`${report.launchOperationsReadiness.exactSavedShareVerdict || "MISSING_EVIDENCE"}\`.
- Distributed admission activation remains a separate operator decision: \`${report.distributedAdmissionActivationApproval.verdict || "missing"}\`, reviewer-ready \`${report.distributedAdmissionActivationApproval.readyForOperatorReview === true}\`, configured/activated/probed \`${report.distributedAdmissionActivationApproval.configurationChangeApproved === true}/${report.distributedAdmissionActivationApproval.activationPerformed === true}/${report.distributedAdmissionActivationApproval.runtimeBehavioralProbePerformed === true}\`, no mutation \`${report.distributedAdmissionActivationApproval.noMutation === true}\`, remote Hermes enabled by this change \`${report.distributedAdmissionActivationApproval.remoteHermesLedgerEnabledByThisChange === true}\`, and exact saved Share \`${report.distributedAdmissionActivationApproval.exactSavedShareVerdict || "MISSING_EVIDENCE"}\`.
- Live document export capability truth is measured separately: \`${report.documentExportCapabilityTruth.verdict || "missing"}\`; admission is \`${report.documentExportCapabilityTruth.admissionMode || "unknown"}/${report.documentExportCapabilityTruth.admissionReason || "unknown"}\` with ready=\`${report.documentExportCapabilityTruth.admissionReady === true}\`. Desktop panel/beta width is \`${report.documentExportCapabilityTruth.desktopPanelWidth ?? 0}/${report.documentExportCapabilityTruth.desktopBetaButtonWidth ?? 0}px\`; mobile is \`${report.documentExportCapabilityTruth.mobilePanelWidth ?? 0}/${report.documentExportCapabilityTruth.mobileBetaButtonWidth ?? 0}px\`. This proves fail-closed export truth and browser fallbacks, not distributed activation; activation remains \`${report.documentExportCapabilityTruth.distributedAdmissionActivation || "OPERATOR_CONFIGURATION_REQUIRED"}\`, fully automated launch remains \`${report.documentExportCapabilityTruth.fullyAutomatedLaunchClaimAllowed === true}\`, and exact saved Share remains \`${report.documentExportCapabilityTruth.exactSavedShareVerdict || "MISSING_EVIDENCE"}\`.
- Live Ontology viewport workbench is measured separately: \`${report.ontologyViewportWorkbench.verdict || "missing"}\`; browser rows \`${report.ontologyViewportWorkbench.passCount ?? 0}/${report.ontologyViewportWorkbench.rowCount ?? 0}\`, maximum body ratio \`${report.ontologyViewportWorkbench.maxBodyRatio ?? 0}\`, mobile task switches \`${report.ontologyViewportWorkbench.mobileTaskSwitchVerifiedCount ?? 0}/4\`. Route splitting alone is not treated as the fix; long content remains in local-scroll panes. Exact saved Share remains \`${report.ontologyViewportWorkbench.exactSavedShareVerdict || "MISSING_EVIDENCE"}\` and fully automated launch remains \`${report.ontologyViewportWorkbench.fullyAutomatedLaunchClaimAllowed === true}\`.
- Live Knowledge viewport workbench is measured separately: \`${report.knowledgeViewportWorkbench.verdict || "missing"}\`; browser rows \`${report.knowledgeViewportWorkbench.passCount ?? "unknown"}/${report.knowledgeViewportWorkbench.rowCount ?? "unknown"}\`, maximum body ratio \`${report.knowledgeViewportWorkbench.maxBodyRatio ?? "unknown"}\`, selected exposure \`${report.knowledgeViewportWorkbench.visiblePanelCountPerRow ?? "unknown"}\` visible panel and \`${report.knowledgeViewportWorkbench.reachableSectionCountPerRow ?? "unknown"}\` reachable tasks. Progressive disclosures technical/reference/wiki/governance are \`${report.knowledgeViewportWorkbench.technicalDisclosureCount ?? "unknown"}/${report.knowledgeViewportWorkbench.referenceDisclosureCount ?? "unknown"}/${report.knowledgeViewportWorkbench.wikiDisclosureCount ?? "unknown"}/${report.knowledgeViewportWorkbench.governanceDisclosureCount ?? "unknown"}\`, default open \`${report.knowledgeViewportWorkbench.defaultOpenDisclosureCount ?? "unknown"}\`, exclusive groups \`${report.knowledgeViewportWorkbench.exclusiveDisclosureGroups === true}\`, mobile ratios \`${report.knowledgeViewportWorkbench.maxMobileTechnicalScrollRatio ?? "unknown"}/${report.knowledgeViewportWorkbench.maxMobileReferenceScrollRatio ?? "unknown"}/${report.knowledgeViewportWorkbench.maxMobileWikiScrollRatio ?? "unknown"}/${report.knowledgeViewportWorkbench.maxMobileGovernanceScrollRatio ?? "unknown"}\`, and first item/review state panel-contained \`${report.knowledgeViewportWorkbench.firstDisclosureInsidePanel === true}/${report.knowledgeViewportWorkbench.firstReviewStateInsidePanel === true}\`. Route splitting alone is not treated as the fix; long content remains in local-scroll panels. Exact saved Share remains \`${report.knowledgeViewportWorkbench.exactSavedShareVerdict || "MISSING_EVIDENCE"}\`, Wiki publication remains \`${report.knowledgeViewportWorkbench.llmWikiPublicationVerdict || "APPROVAL_GATED"}\`, and SIF embedding remains \`${report.knowledgeViewportWorkbench.sifEmbeddingRuntimeVerdict || "APPROVAL_GATED"}\`.
- LLM Wiki candidate content readiness is measured separately: \`${report.llmWikiCandidateContentReadiness.verdict || "missing"}\`; local/live viewport rows \`${report.llmWikiCandidateContentReadiness.localPassed ?? 0}/${report.llmWikiCandidateContentReadiness.localViewportCount ?? 0}\` and \`${report.llmWikiCandidateContentReadiness.livePassed ?? 0}/${report.llmWikiCandidateContentReadiness.liveViewportCount ?? 0}\`, required sections \`${report.llmWikiCandidateContentReadiness.requiredSectionCount ?? 0}\`, ready/revision fixtures \`${report.llmWikiCandidateContentReadiness.readyFixtureCount ?? 0}/${report.llmWikiCandidateContentReadiness.revisionRequiredFixtureCount ?? 0}\`, approval fail-closed \`${report.llmWikiCandidateContentReadiness.approvalFailsClosedForRevision === true}\`, human-readable guidance/count/raw-code exposure \`${report.llmWikiCandidateContentReadiness.revisionGuidanceVisible === true}/${report.llmWikiCandidateContentReadiness.revisionIssueCount ?? 0}/${report.llmWikiCandidateContentReadiness.revisionIssueCodesExposed === true}\`, confirmed approval fail-closed \`${report.llmWikiCandidateContentReadiness.approvalFailsClosedAfterConfirmation === true}\`, and site-only/reject availability \`${report.llmWikiCandidateContentReadiness.keepSiteOnlyAvailableForRevision === true}/${report.llmWikiCandidateContentReadiness.rejectAvailableForRevision === true}\`. Human review remains \`${report.llmWikiCandidateContentReadiness.humanReviewCompleted === true}\`, publication remains \`${report.llmWikiCandidateContentReadiness.publicationState || "unpublished"}\` with publishAllowed=\`${report.llmWikiCandidateContentReadiness.publishAllowed === true}\`; exact saved Share remains \`${report.llmWikiCandidateContentReadiness.exactSavedShareVerdict || "MISSING_EVIDENCE"}\`, while Wiki publication and Supabase RLS remain \`${report.llmWikiCandidateContentReadiness.llmWikiPublication || "APPROVAL_GATED"}/${report.llmWikiCandidateContentReadiness.supabaseRlsLaunchIsolation || "APPROVAL_GATED"}\`.
- Wiki candidate generation content is measured separately from that browser fixture: \`${report.llmWikiCandidateContentMatrix.verdict || "missing"}\`; deterministic fallback local/live scenarios \`${report.llmWikiCandidateContentMatrix.localPassed ?? 0}/5\` and \`${report.llmWikiCandidateContentMatrix.livePassed ?? 0}/5\`. Reviewer-visible evidence traces move \`${report.llmWikiCandidateContentMatrix.beforeVisibleEvidenceTraceCount ?? 0}->${report.llmWikiCandidateContentMatrix.liveVisibleEvidenceTraceCount ?? 0}/5\`; live KOSHA technical/official-source and current-law candidate boundaries are \`${report.llmWikiCandidateContentMatrix.liveTechnicalGuidanceBoundaryCount ?? 0}/5\` and \`${report.llmWikiCandidateContentMatrix.liveLawCandidateBoundaryCount ?? 0}/5\`. Explicit safe event semantics move \`${report.llmWikiCandidateContentMatrix.beforeEventSemanticGroundingCount ?? 0}->${report.llmWikiCandidateContentMatrix.liveEventSemanticGroundingCount ?? 0}/5\` with private exposure \`${report.llmWikiCandidateContentMatrix.livePrivateEventExposureCount ?? 0}\`; arbitrary raw payload accepted=\`${report.llmWikiCandidateContentMatrix.arbitraryRawPayloadAcceptedAsReviewFact === true}\`. The enhanced provider remains \`${report.llmWikiCandidateContentMatrix.providerPassed ?? 0}/5\` with blocker \`${report.llmWikiCandidateContentMatrix.providerRuntimeBlocker || "missing"}\`. This does not read the production candidate queue or claim enhanced LLM quality: queueRead=\`${report.llmWikiCandidateContentMatrix.actualProductionCandidateQueueRead === true}\`, fixtureAcceptedAsGenerationProof=\`${report.llmWikiCandidateContentMatrix.routeFixtureAcceptedAsGenerationProof === true}\`, enhancedLive=\`${report.llmWikiCandidateContentMatrix.enhancedLlmGenerationProvenLive === true}\`, humanReviewCompleted=\`${report.llmWikiCandidateContentMatrix.humanReviewCompleted === true}\`, exact saved Share=\`${report.llmWikiCandidateContentMatrix.exactSavedShareVerdict || "MISSING_EVIDENCE"}\`, Wiki/RLS=\`${report.llmWikiCandidateContentMatrix.llmWikiPublication || "APPROVAL_GATED"}/${report.llmWikiCandidateContentMatrix.supabaseRlsLaunchIsolation || "APPROVAL_GATED"}\`.
- Reviewer-visible SIF evidence is measured by a separate companion matrix: \`${report.llmWikiSifEvidenceMatrix.verdict || "missing"}\`; local/live \`${report.llmWikiSifEvidenceMatrix.localPassed ?? 0}/5\` and \`${report.llmWikiSifEvidenceMatrix.livePassed ?? 0}/5\`, authority order \`${report.llmWikiSifEvidenceMatrix.authorityOrder?.join(" -> ") || "missing"}\`, live SIF/KOSHA/law boundaries \`${report.llmWikiSifEvidenceMatrix.liveSifEvidenceBoundaryCount ?? 0}/${report.llmWikiSifEvidenceMatrix.liveTechnicalGuidanceBoundaryCount ?? 0}/${report.llmWikiSifEvidenceMatrix.liveLawCandidateBoundaryCount ?? 0}\` of 5, event facts \`${report.llmWikiSifEvidenceMatrix.liveEventSemanticGroundingCount ?? 0}/5\`, and private exposure \`${report.llmWikiSifEvidenceMatrix.livePrivateEventExposureCount ?? 0}\`. This does not read the production candidate queue, complete human review, enable enhanced runtime, publish Wiki content, mutate DB/vector/KOSHA registry state, or close exact saved Share \`${report.llmWikiSifEvidenceMatrix.exactSavedShareVerdict || "MISSING_EVIDENCE"}\`.
- Public generation admission security is measured separately: \`${report.publicGenerationAdmissionSecurity.verdict || "missing"}\`, configuration/readiness/response \`${report.publicGenerationAdmissionSecurity.configurationState || "unknown"}/${report.publicGenerationAdmissionSecurity.readinessMode || "unknown"}/${report.publicGenerationAdmissionSecurity.observedResponseMode || "unknown"}\`, production fail-closed observed=\`${report.publicGenerationAdmissionSecurity.productionFailClosedObserved === true}\`, dependency vulnerabilities \`${report.publicGenerationAdmissionSecurity.vulnerabilityCount ?? "unknown"}\`, distributed activation pending=\`${report.publicGenerationAdmissionSecurity.distributedActivationPending === true}\`, and fresh full-repository scan required=\`${report.publicGenerationAdmissionSecurity.freshRescanRequired === true}\`. The response mode header is not proof of configured multi-instance protection. This notice does not close the immutable scan finding, approval-gated operations, or exact saved Share; exact saved Share remains \`${report.publicGenerationAdmissionSecurity.exactSavedShareVerdict || "MISSING_EVIDENCE"}\`.
- Security follow-up remediation is separately proven: \`${report.securityFollowupRemediation.verdict || "missing"}\`, sealed findings \`${report.securityFollowupRemediation.sealedFindingCount ?? "unknown"}\`, focused tests \`${report.securityFollowupRemediation.focusedTests ?? "unknown"}\`, and remaining security work \`${report.securityFollowupRemediation.remainingSecurityWorkCount ?? "unknown"}\`. The immutable original baseline remains \`${report.securityFollowupRemediation.immutableOriginalBaselineFindingCount ?? "unknown"}\` findings with rewritten=\`${report.securityFollowupRemediation.originalBaselineRewritten === true}\`; two deferred candidates and the separate public-admission notice remain visible, no live provider cancellation probe is claimed, and exact saved Share remains \`${report.securityFollowupRemediation.exactSavedShareVerdict || "MISSING_EVIDENCE"}\`.
- Fresh security resource remediation is scoped rather than security-complete: \`${report.securityResourceRemediation.verdict || "missing"}\`, remediated \`${report.securityResourceRemediation.remediatedFindingCount ?? "unknown"}/${report.securityResourceRemediation.scanFindingCount ?? "unknown"}\`, remaining \`${report.securityResourceRemediation.remainingScanFindings ?? "unknown"}\`, provider persistence \`${report.securityResourceRemediation.providerDispatchPersistence || "unknown"}\`, exact saved Share \`${report.securityResourceRemediation.exactSavedShareVerdict || "MISSING_EVIDENCE"}\`.
- Upstream transport remediation is separately live/source-proven without an external provider probe: \`${report.securityUpstreamTransportRemediation.verdict || "missing"}\`, remediated this wave \`${report.securityUpstreamTransportRemediation.remediatedThisWave ?? "unknown"}\`, cumulative \`${report.securityUpstreamTransportRemediation.remediatedTotal ?? "unknown"}/${report.securityUpstreamTransportRemediation.scanFindingCount ?? "unknown"}\`, remaining \`${report.securityUpstreamTransportRemediation.remainingScanFindings ?? "unknown"}\`, provider probe executed \`${report.securityUpstreamTransportRemediation.externalProviderProbeExecuted === true}\`, provider persistence \`${report.securityUpstreamTransportRemediation.providerDispatchPersistence || "unknown"}\`, exact saved Share \`${report.securityUpstreamTransportRemediation.exactSavedShareVerdict || "MISSING_EVIDENCE"}\`.
- Safety-reference public-surface remediation is separately live-proven: \`${report.securitySafetyReferenceSurfaceRemediation.verdict || "missing"}\`, finding \`${report.securitySafetyReferenceSurfaceRemediation.findingId || "missing"}\`, cumulative \`${report.securitySafetyReferenceSurfaceRemediation.remediatedTotal ?? "unknown"}/${report.securitySafetyReferenceSurfaceRemediation.scanFindingCount ?? "unknown"}\`, remaining \`${report.securitySafetyReferenceSurfaceRemediation.remainingScanFindings ?? "unknown"}\`, live items \`${report.securitySafetyReferenceSurfaceRemediation.liveReturnedItems ?? "unknown"}\`, public body/payload/metadata fields \`${report.securitySafetyReferenceSurfaceRemediation.publicBodyFieldCount ?? "unknown"}/${report.securitySafetyReferenceSurfaceRemediation.publicPayloadFieldCount ?? "unknown"}/${report.securitySafetyReferenceSurfaceRemediation.publicMetadataFieldCount ?? "unknown"}\`, and rate-limit mode \`${report.securitySafetyReferenceSurfaceRemediation.rateLimitMode || "unknown"}\`. Instance-mode distributed readiness remains a notice, provider persistence remains \`${report.securitySafetyReferenceSurfaceRemediation.providerDispatchPersistence || "unknown"}\`, and exact saved Share remains \`${report.securitySafetyReferenceSurfaceRemediation.exactSavedShareVerdict || "MISSING_EVIDENCE"}\`.
- Public JSON pre-parse body budgeting is separately live-proven: \`${report.publicJsonRequestBodyBudget.verdict || "missing"}\`, finding \`${report.publicJsonRequestBodyBudget.findingId || "missing"}\`, and live oversized-request cases \`${report.publicJsonRequestBodyBudget.liveCaseCount ?? "unknown"}\`. The corrected canonical scan remains immutable, follow-up scan status is \`${report.publicJsonRequestBodyBudget.followUpSecurityScan || "REQUIRED"}\`, security-complete remains \`${report.publicJsonRequestBodyBudget.securityCompleteClaimAllowed === true}\`, and exact saved Share remains \`${report.publicJsonRequestBodyBudget.exactSavedShareVerdict || "MISSING_EVIDENCE"}\`.
- Improvement photo analysis budgeting is separately live-measured: \`${report.improvementPhotoAnalysisBudget.verdict || "missing"}\`, finding \`${report.improvementPhotoAnalysisBudget.findingId || "missing"}\`, request bytes \`${report.improvementPhotoAnalysisBudget.maxRequestBytes ?? "unknown"}\`, concurrency \`${report.improvementPhotoAnalysisBudget.aggregateConcurrency ?? "unknown"}\`, and live admission cases \`${report.improvementPhotoAnalysisBudget.liveCaseCount ?? "unknown"}\`. Production admission remains \`${report.improvementPhotoAnalysisBudget.distributedProductionActivation || "unknown"}\`; the distributed multi-instance boundary and follow-up scan remain open, security-complete remains \`${report.improvementPhotoAnalysisBudget.securityCompleteClaimAllowed === true}\`, and exact saved Share remains \`${report.improvementPhotoAnalysisBudget.exactSavedShareVerdict || "MISSING_EVIDENCE"}\`.
- Public provider cancellation is separately source-proven in deployed production: \`${report.publicProviderCancellation.verdict || "missing"}\`, finding \`${report.publicProviderCancellation.findingId || "missing"}\`, tests \`${report.publicProviderCancellation.tests ?? "unknown"}\`, and live provider cancellation call executed=\`${report.publicProviderCancellation.liveProviderCallExecuted === true}\`. The canonical finding remains immutable until follow-up scan \`${report.publicProviderCancellation.followUpSecurityScan || "REQUIRED"}\`, security-complete remains \`${report.publicProviderCancellation.securityCompleteClaimAllowed === true}\`, and exact saved Share remains \`${report.publicProviderCancellation.exactSavedShareVerdict || "MISSING_EVIDENCE"}\`.
- Public provider admission is separately live-measured: \`${report.publicProviderAdmission.verdict || "missing"}\`, corrected findings \`${report.publicProviderAdmission.findingCount ?? "unknown"}\`, capacity/full weight \`${report.publicProviderAdmission.capacity ?? "unknown"}/${report.publicProviderAdmission.fullModeWeight ?? "unknown"}\`, and no-provider live cases \`${report.publicProviderAdmission.liveCaseCount ?? "unknown"}\`. Production distributed activation remains \`${report.publicProviderAdmission.distributedProductionActivation || "PENDING_CONFIGURATION"}\`, follow-up scan remains \`${report.publicProviderAdmission.followUpSecurityScan || "REQUIRED"}\`, security-complete remains \`${report.publicProviderAdmission.securityCompleteClaimAllowed === true}\`, and exact saved Share remains \`${report.publicProviderAdmission.exactSavedShareVerdict || "MISSING_EVIDENCE"}\`.
- Public Ask distributed admission is separately live-proven: \`${report.publicAskDistributedAdmission.verdict || "missing"}\`, finding \`${report.publicAskDistributedAdmission.findingId || "missing"}\`, local/live cases \`${report.publicAskDistributedAdmission.localCaseCount ?? 0}/${report.publicAskDistributedAdmission.liveCaseCount ?? 0}\`, and provider call executed=\`${report.publicAskDistributedAdmission.providerCallExecuted === true}\`. Enhanced/full JSON and SSE fail closed before provider work while distributed admission is unavailable; backend activation remains \`${report.publicAskDistributedAdmission.distributedBackendActivation || "OPERATOR_CONFIGURATION_REQUIRED"}\`, fresh scan remains \`${report.publicAskDistributedAdmission.freshFollowUpScan || "REQUIRED"}\`, security-complete remains \`${report.publicAskDistributedAdmission.securityCompleteClaimAllowed === true}\`, and exact saved Share remains \`${report.publicAskDistributedAdmission.exactSavedShareVerdict || "MISSING_EVIDENCE"}\`.
- Repository security scan reconciliation is \`${report.repositorySecurityScanReconciliation.verdict || "missing"}\`. The immutable same-target scans and \`${report.repositorySecurityScanReconciliation.receiptContradictionCount ?? "unknown"}\` fail-open contradictions remain preserved; zero-finding accepted=\`${report.repositorySecurityScanReconciliation.zeroFindingClaimAccepted === true}\`. Corrected scan completed=\`${report.repositorySecurityScanReconciliation.correctedFreshScanCompleted === true}\`, id=\`${report.repositorySecurityScanReconciliation.correctedScanId || "missing"}\`, reportable=\`${report.repositorySecurityScanReconciliation.correctedReportableFindingCount ?? "unknown"}\`, deferred=\`${report.repositorySecurityScanReconciliation.correctedDeferredCandidateCount ?? "unknown"}\`, coverage=\`${report.repositorySecurityScanReconciliation.correctedCoverageCompleteness || "unknown"}\`, security-complete=\`${report.repositorySecurityScanReconciliation.securityCompleteClaimAllowed === true}\`, and exact saved Share remains \`${report.repositorySecurityScanReconciliation.exactSavedShareVerdict || "MISSING_EVIDENCE"}\`.
- Current security remediation ledger is \`${report.currentSecurityRemediationLedger.verdict || "missing"}\`: deployed-source receipts \`${report.currentSecurityRemediationLedger.deployedSourceRemediationCount ?? "unknown"}/${report.currentSecurityRemediationLedger.totalFindings ?? "unknown"}\`, unresolved \`${report.currentSecurityRemediationLedger.unresolvedCount ?? "unknown"}\`, approval-gated \`${report.currentSecurityRemediationLedger.approvalGatedCount ?? "unknown"}\`, distributed-runtime open \`${report.currentSecurityRemediationLedger.distributedRuntimeOpenCount ?? "unknown"}\`, security-complete=\`${report.currentSecurityRemediationLedger.securityCompleteClaimAllowed === true}\`, exact saved Share \`${report.currentSecurityRemediationLedger.exactSavedShareVerdict || "MISSING_EVIDENCE"}\`.
- Fresh current-source Standard security scan is \`${report.freshCurrentSourceSecurityScan.verdict || "missing"}\`: scan \`${report.freshCurrentSourceSecurityScan.scanId || "missing"}\`, findings \`${report.freshCurrentSourceSecurityScan.reportableFindingCount ?? "unknown"}\` (medium/low \`${report.freshCurrentSourceSecurityScan.mediumFindingCount ?? "unknown"}/${report.freshCurrentSourceSecurityScan.lowFindingCount ?? "unknown"}\`), coverage \`${report.freshCurrentSourceSecurityScan.coverageCompleteness || "unknown"}\` with \`${report.freshCurrentSourceSecurityScan.reviewedSurfaceCount ?? "unknown"}\` recorded surfaces and \`${report.freshCurrentSourceSecurityScan.deferredCoverageItemCount ?? "unknown"}\` deferred items. Bounded closures/residuals are \`${report.freshCurrentSourceSecurityScan.fullyClosedBoundedSourceCandidateCount ?? "unknown"}/${report.freshCurrentSourceSecurityScan.approvalFreeProductSourceResidualCount ?? "unknown"}\`; database/atomicity and Share capability boundaries remain \`${report.freshCurrentSourceSecurityScan.approvalGatedDatabaseOrAtomicityCount ?? "unknown"}/${report.freshCurrentSourceSecurityScan.approvalSensitiveShareCapabilityCount ?? "unknown"}\`. Scan completion is not security-complete \`${report.freshCurrentSourceSecurityScan.securityCompleteClaimAllowed === true}\`, and exact saved Share remains \`${report.freshCurrentSourceSecurityScan.exactSavedShareVerdict || "MISSING_EVIDENCE"}\`.
- Current-source security residual remediation is \`${report.currentSourceSecurityResidualRemediation.verdict || "missing"}\`: anchors \`${report.currentSourceSecurityResidualRemediation.residualAnchors?.join(", ") || "missing"}\`, tests \`${(report.currentSourceSecurityResidualRemediation.focusedTests ?? 0) + (report.currentSourceSecurityResidualRemediation.adjacentTests ?? 0)}\`, live evidence \`${report.currentSourceSecurityResidualRemediation.liveStatus || "missing"}\` with behavioral probe \`${report.currentSourceSecurityResidualRemediation.behavioralProbeExecuted === true}\`. The immutable scan remains open, follow-up scan required=\`${report.currentSourceSecurityResidualRemediation.followUpSecurityScanRequired === true}\`, security-complete=\`${report.currentSourceSecurityResidualRemediation.securityCompleteClaimAllowed === true}\`, and exact saved Share remains \`${report.currentSourceSecurityResidualRemediation.exactSavedShareVerdict || "MISSING_EVIDENCE"}\`.
- Share ACK pre-body admission is \`${report.shareAckPreBodyAdmission.verdict || "missing"}\`: coarse IP rate/body concurrency ordering \`${report.shareAckPreBodyAdmission.coarseIpRateAdmissionBeforeBody === true}/${report.shareAckPreBodyAdmission.coarseBodyConcurrencyLeaseBeforeBody === true}\`, recipient-specific post-parse admission \`${report.shareAckPreBodyAdmission.recipientSpecificAdmissionRetainedAfterParse === true}\`, tests \`${report.shareAckPreBodyAdmission.testsPassed ?? "unknown"}\`, and live \`${report.shareAckPreBodyAdmission.liveStatus ?? "unknown"}/${report.shareAckPreBodyAdmission.liveCode || "missing"}/${report.shareAckPreBodyAdmission.liveRateLimitHeader || "missing"}\`. The sealed finding remains rescan-pending \`${report.shareAckPreBodyAdmission.freshRescanRequired === true}\`; security-complete remains \`${report.shareAckPreBodyAdmission.securityCompleteClaimAllowed === true}\`, recipient ACK is \`${report.shareAckPreBodyAdmission.recipientAckLiveDataApproval || "APPROVAL_GATED"}\`, and exact saved Share remains \`${report.shareAckPreBodyAdmission.exactSavedShareVerdict || "MISSING_EVIDENCE"}\`.
- Safety status disconnect lease is \`${report.safetyStatusDisconnectLease.verdict || "missing"}\`: work settlement before abort rejection/lease release \`${report.safetyStatusDisconnectLease.underlyingWorkSettlementPrecedesAbortRejection === true}/${report.safetyStatusDisconnectLease.admissionLeaseHeldUntilUnderlyingSettlement === true}\`, two-disconnect concurrency proof \`${report.safetyStatusDisconnectLease.thirdConcurrentRequestRejectedWhileTwoDisconnectedTasksSettle === true}\`, tests \`${report.safetyStatusDisconnectLease.testsPassed ?? "unknown"}\`, and live \`${report.safetyStatusDisconnectLease.liveStatus ?? "unknown"}/${report.safetyStatusDisconnectLease.liveCode || "missing"}/${report.safetyStatusDisconnectLease.liveWorkUnit || "missing"}\`. The sealed finding remains rescan-pending \`${report.safetyStatusDisconnectLease.freshRescanRequired === true}\`; security-complete remains \`${report.safetyStatusDisconnectLease.securityCompleteClaimAllowed === true}\`, distributed activation is \`${report.safetyStatusDisconnectLease.distributedAdmissionActivation || "OPERATOR_CONFIGURATION_REQUIRED"}\`, and exact saved Share remains \`${report.safetyStatusDisconnectLease.exactSavedShareVerdict || "MISSING_EVIDENCE"}\`.
- Weather fallback error redaction is \`${report.weatherFallbackErrorRedaction.verdict || "missing"}\`: fixed public detail/server-only raw diagnostics/aggregate redaction \`${report.weatherFallbackErrorRedaction.allProviderFallbackBranchesUseFixedPublicDetail === true}/${report.weatherFallbackErrorRedaction.rawProviderErrorsLoggedServerSide === true}/${report.weatherFallbackErrorRedaction.aggregateWeatherDetailOmitsRawProviderErrors === true}\`, provider branches \`${report.weatherFallbackErrorRedaction.providerFallbackBranchCount ?? "unknown"}\`, tests \`${report.weatherFallbackErrorRedaction.testsPassed ?? "unknown"}\`, and live \`${report.weatherFallbackErrorRedaction.liveStatus ?? "unknown"}/${report.weatherFallbackErrorRedaction.liveCode || "missing"}/${report.weatherFallbackErrorRedaction.liveRateLimitHeader || "missing"}\`. The sealed finding remains rescan-pending \`${report.weatherFallbackErrorRedaction.freshRescanRequired === true}\`; security-complete remains \`${report.weatherFallbackErrorRedaction.securityCompleteClaimAllowed === true}\`, distributed activation is \`${report.weatherFallbackErrorRedaction.distributedAdmissionActivation || "OPERATOR_CONFIGURATION_REQUIRED"}\`, and exact saved Share remains \`${report.weatherFallbackErrorRedaction.exactSavedShareVerdict || "MISSING_EVIDENCE"}\`.
- HWPX archive expansion security is \`${report.hwpxArchiveExpansionSecurity.verdict || "missing"}\`: central-directory preflight \`${report.hwpxArchiveExpansionSecurity.centralDirectoryCheckedBeforeEntryData === true}\`, template manifest \`${report.hwpxArchiveExpansionSecurity.availableTemplateCount ?? "unknown"}/${report.hwpxArchiveExpansionSecurity.templateCount ?? "unknown"}\`, entry/total/largest/peak budgets \`${report.hwpxArchiveExpansionSecurity.entryCountBudget ?? "unknown"}/${report.hwpxArchiveExpansionSecurity.totalUncompressedBytesBudget ?? "unknown"}/${report.hwpxArchiveExpansionSecurity.largestEntryUncompressedBytesBudget ?? "unknown"}/${report.hwpxArchiveExpansionSecurity.estimatedPeakWorkingBytesBudget ?? "unknown"}\`, tests \`${report.hwpxArchiveExpansionSecurity.testsPassed ?? "unknown"}\`, and live \`${report.hwpxArchiveExpansionSecurity.liveStatus ?? "unknown"}/${report.hwpxArchiveExpansionSecurity.liveCode || "missing"}/${report.hwpxArchiveExpansionSecurity.liveRateLimitHeader || "missing"}\`. The sealed finding remains rescan-pending \`${report.hwpxArchiveExpansionSecurity.freshRescanRequired === true}\`; security-complete remains \`${report.hwpxArchiveExpansionSecurity.securityCompleteClaimAllowed === true}\`, distributed export activation is \`${report.hwpxArchiveExpansionSecurity.publicExportDistributedAdmission || "OPEN_OPERATOR_CONFIGURATION"}\`, and exact saved Share remains \`${report.hwpxArchiveExpansionSecurity.exactSavedShareVerdict || "MISSING_EVIDENCE"}\`.
- Atomic database race remediation is approval-gated: \`${report.securityAtomicDbRaceRemediation.verdict || "missing"}\`, sealed findings still open \`${report.securityAtomicDbRaceRemediation.openFindingCount ?? "unknown"}\`, approval required/performed \`${report.securityAtomicDbRaceRemediation.approvalRequired === true}/${report.securityAtomicDbRaceRemediation.approvalPerformed === true}\`, migration authored \`${report.securityAtomicDbRaceRemediation.migrationAuthored === true}\`, DB mutation performed \`${report.securityAtomicDbRaceRemediation.dbMutationPerformed === true}\`, fresh scan required \`${report.securityAtomicDbRaceRemediation.freshRescanRequired === true}\`, security-complete \`${report.securityAtomicDbRaceRemediation.securityCompleteClaimAllowed === true}\`, and exact saved Share remains \`${report.securityAtomicDbRaceRemediation.exactSavedShareVerdict || "MISSING_EVIDENCE"}\`.
- Fresh live Documents/workspace Share route perception is \`${report.liveDocumentsShareRoutePerception.verdict || "missing"}\`: measured rows Documents/Share \`${report.liveDocumentsShareRoutePerception.documentsRows ?? 0}/${report.liveDocumentsShareRoutePerception.workspaceShareRows ?? 0}\`, desktop Share regions \`${report.liveDocumentsShareRoutePerception.desktopShareRegions ?? "unknown"}\`, route split alone accepted \`${report.liveDocumentsShareRoutePerception.routeSplitAloneAcceptedAsFix === true}\`, DB mutation \`${report.liveDocumentsShareRoutePerception.dbMutationPerformed === true}\`, and exact saved user session reproduced/verdict \`${report.liveDocumentsShareRoutePerception.exactSavedUserSessionReproduced === true}/${report.liveDocumentsShareRoutePerception.exactSavedShareVerdict || "MISSING_EVIDENCE"}\`.
- Live deployment freshness is measured separately: \`${report.deploymentFreshnessGuard.verdict || "missing"}\`, current notice present \`${report.deploymentFreshnessGuard.currentNoticePresent === true}\`, simulated SHA-drift refresh visible \`${report.deploymentFreshnessGuard.driftRefreshVisible === true}\`, frontend audit violations \`${report.deploymentFreshnessGuard.frontendAuditViolations ?? "unknown"}\`, and live pending \`${report.deploymentFreshnessGuard.liveAfterDeploymentPending === true}\`. This closes only stale-tab visibility; DB mutation remains \`${report.deploymentFreshnessGuard.dbMutationPerformed === true}\` and exact saved Share remains \`${report.deploymentFreshnessGuard.exactSavedShareVerdict || "MISSING_EVIDENCE"}\`.
- MCP generation work-budget security is separately measured: \`${report.mcpGenerationWorkBudgetSecurity.verdict || "missing"}\`, POST body budget \`${report.mcpGenerationWorkBudgetSecurity.postBodyMaxBytes ?? "unknown"}\` bytes, adjacent tests \`${report.mcpGenerationWorkBudgetSecurity.adjacentTests ?? "unknown"}\`, valid authenticated runtime probe pending=\`${report.mcpGenerationWorkBudgetSecurity.validAuthenticatedRuntimeProbeRequired === true}\`, distributed activation pending=\`${report.mcpGenerationWorkBudgetSecurity.distributedActivationRequired === true}\`, distributed backend health pending=\`${report.mcpGenerationWorkBudgetSecurity.distributedHealthRequired === true}\`, configuration/readiness=\`${report.mcpGenerationWorkBudgetSecurity.currentRefreshConfigurationState || "unknown"}/${report.mcpGenerationWorkBudgetSecurity.currentRefreshReadinessReason || "unknown"}\`, current refresh status/mode/error=\`${report.mcpGenerationWorkBudgetSecurity.currentRefreshStatus ?? "unknown"}/${report.mcpGenerationWorkBudgetSecurity.currentRefreshRateLimitMode || "unknown"}/${report.mcpGenerationWorkBudgetSecurity.currentRefreshErrorCode || "none"}\`, and fresh rescan required=\`${report.mcpGenerationWorkBudgetSecurity.freshRescanRequired === true}\`. A distributed response header on the fail-closed path is not activation proof; this notice preserves the sealed finding and exact saved Share \`${report.mcpGenerationWorkBudgetSecurity.exactSavedShareVerdict || "MISSING_EVIDENCE"}\`.
- Live Hermes reviewer authority UI is measured separately: \`${report.hermesKnowledgeReviewAuthorityUi.verdict || "missing"}\`, local/live viewport contracts \`${report.hermesKnowledgeReviewAuthorityUi.localPassed ?? 0}/${report.hermesKnowledgeReviewAuthorityUi.localViewportCount ?? 0}\` and \`${report.hermesKnowledgeReviewAuthorityUi.livePassed ?? 0}/${report.hermesKnowledgeReviewAuthorityUi.liveViewportCount ?? 0}\`, selected-only candidates/selected/body \`${report.hermesKnowledgeReviewAuthorityUi.candidateCount ?? 0}/${report.hermesKnowledgeReviewAuthorityUi.selectedCandidateCount ?? 0}/${report.hermesKnowledgeReviewAuthorityUi.selectedBodyCount ?? 0}\`, desktop/mobile columns \`${report.hermesKnowledgeReviewAuthorityUi.desktopColumns ?? 0}/${report.hermesKnowledgeReviewAuthorityUi.mobileColumns ?? 0}\`, and authority order \`${report.hermesKnowledgeReviewAuthorityUi.sourceOrder?.join(" -> ") || "missing"}\`. Candidate tabs require linked tabpanel semantics, one roving tab stop, breakpoint-aware orientation, and Arrow/Home/End keyboard navigation; compact review panes require linked keyboard-operable tabs. Delayed decisions require live pending/settled status, busy semantics, and disabled competing actions \`${report.hermesKnowledgeReviewAuthorityUi.decisionPendingStatusLive === true}/${report.hermesKnowledgeReviewAuthorityUi.decisionBusyStateExposed === true}/${report.hermesKnowledgeReviewAuthorityUi.decisionActionsDisabledDuringSave === true}/${report.hermesKnowledgeReviewAuthorityUi.decisionSettlesAccessibly === true}\`. Human review remains required and machine evidence does not replace it; no DB/provider/share/publication mutation is claimed. Exact saved Share remains \`${report.hermesKnowledgeReviewAuthorityUi.exactSavedShareVerdict || "MISSING_EVIDENCE"}\`, while LLM Wiki publication and Supabase RLS remain approval-gated.
- Live Hermes decision visibility is measured separately: \`${report.hermesReviewDecisionFirstViewport.verdict || "missing"}\`, before/local/live passes \`${report.hermesReviewDecisionFirstViewport.beforePassed ?? 0}/${report.hermesReviewDecisionFirstViewport.beforeViewportCount ?? 0}\`, \`${report.hermesReviewDecisionFirstViewport.localPassed ?? 0}/${report.hermesReviewDecisionFirstViewport.localViewportCount ?? 0}\`, and \`${report.hermesReviewDecisionFirstViewport.livePassed ?? 0}/${report.hermesReviewDecisionFirstViewport.liveViewportCount ?? 0}\`. Desktop-short/mobile-short first-action bottoms are \`${report.hermesReviewDecisionFirstViewport.desktopShortFirstActionBottom ?? 0}/${report.hermesReviewDecisionFirstViewport.mobileShortFirstActionBottom ?? 0}\` inside 723px with \`${report.hermesReviewDecisionFirstViewport.occludedFirstActionCount ?? 0}\` hit-test occlusions; every action remains locked until explicit candidate-and-evidence confirmation \`${report.hermesReviewDecisionFirstViewport.decisionConfirmationRequired === true}/${report.hermesReviewDecisionFirstViewport.decisionConfirmationUnlocksAllActions === true}\`. This does not complete human review \`${report.hermesReviewDecisionFirstViewport.humanReviewCompleted === true}\`; exact saved Share remains \`${report.hermesReviewDecisionFirstViewport.exactSavedShareVerdict || "MISSING_EVIDENCE"}\`, and Wiki/RLS/provider persistence remain \`${report.hermesReviewDecisionFirstViewport.llmWikiPublication || "APPROVAL_GATED"}/${report.hermesReviewDecisionFirstViewport.supabaseRlsLaunchIsolation || "APPROVAL_GATED"}/${report.hermesReviewDecisionFirstViewport.providerDispatchPersistence || "APPROVAL_GATED"}\`.
- Live Hermes candidate position is measured separately: \`${report.hermesReviewCandidatePosition.verdict || "missing"}\`, local/live passes \`${report.hermesReviewCandidatePosition.localPassed ?? 0}/${report.hermesReviewCandidatePosition.localViewportCount ?? 0}\` and \`${report.hermesReviewCandidatePosition.livePassed ?? 0}/${report.hermesReviewCandidatePosition.liveViewportCount ?? 0}\`, with candidate positions \`${report.hermesReviewCandidatePosition.liveCandidatePositions?.join(", ") || "missing"}\`. The prior visual/source baseline is not a retroactive RED runner claim \`${report.hermesReviewCandidatePosition.baselineMeasurementMethod || "missing"}\`. Human review remains incomplete, exact saved Share remains \`${report.hermesReviewCandidatePosition.exactSavedShareVerdict || "MISSING_EVIDENCE"}\`, and Wiki/RLS/provider persistence remain approval-gated.
- Live Hermes evidence inspector is measured separately: \`${report.hermesKnowledgeReviewEvidenceInspector.verdict || "missing"}\`, local/live viewport contracts \`${report.hermesKnowledgeReviewEvidenceInspector.localPassed ?? 0}/${report.hermesKnowledgeReviewEvidenceInspector.localViewportCount ?? 0}\` and \`${report.hermesKnowledgeReviewEvidenceInspector.livePassed ?? 0}/${report.hermesKnowledgeReviewEvidenceInspector.liveViewportCount ?? 0}\`, budget/items/desktop columns/mobile panes \`${report.hermesKnowledgeReviewEvidenceInspector.itemLimit ?? 0}/${report.hermesKnowledgeReviewEvidenceInspector.fixtureItemCount ?? 0}/${report.hermesKnowledgeReviewEvidenceInspector.desktopEvidenceColumns ?? 0}/${report.hermesKnowledgeReviewEvidenceInspector.mobileMountedPaneCount ?? 0}\`, linked roving candidate tabs and compact-pane keyboard navigation \`${report.hermesKnowledgeReviewEvidenceInspector.candidateTablist === true}/${report.hermesKnowledgeReviewEvidenceInspector.candidateRovingTabStop === true}/${report.hermesKnowledgeReviewEvidenceInspector.candidateKeyboardNavigation === true}/${report.hermesKnowledgeReviewEvidenceInspector.mobilePaneTabsLinked === true}/${report.hermesKnowledgeReviewEvidenceInspector.mobilePaneKeyboardNavigation === true}\`, delayed decision status/busy/actions/settled \`${report.hermesKnowledgeReviewEvidenceInspector.decisionPendingStatusLive === true}/${report.hermesKnowledgeReviewEvidenceInspector.decisionBusyStateExposed === true}/${report.hermesKnowledgeReviewEvidenceInspector.decisionActionsDisabledDuringSave === true}/${report.hermesKnowledgeReviewEvidenceInspector.decisionSettlesAccessibly === true}\`, official HTTPS/private identity exposed \`${report.hermesKnowledgeReviewEvidenceInspector.publicOfficialHttpsLinkCount ?? 0}/${report.hermesKnowledgeReviewEvidenceInspector.privateEvidenceRawIdentityExposed === true}\`. Security-complete remains \`${report.hermesKnowledgeReviewEvidenceInspector.securityComplete === true}\`, a fresh full-repository scan remains required, exact saved Share remains \`${report.hermesKnowledgeReviewEvidenceInspector.exactSavedShareVerdict || "MISSING_EVIDENCE"}\`, and Wiki/RLS/provider persistence remain approval-gated.
- Live Hermes event-fact traceability is measured separately: \`${report.hermesReviewEventFactTraceability.verdict || "missing"}\`, before/local/live passes \`${report.hermesReviewEventFactTraceability.beforePassed ?? 0}/${report.hermesReviewEventFactTraceability.beforeViewportCount ?? 0}\`, \`${report.hermesReviewEventFactTraceability.localPassed ?? 0}/${report.hermesReviewEventFactTraceability.localViewportCount ?? 0}\`, and \`${report.hermesReviewEventFactTraceability.livePassed ?? 0}/${report.hermesReviewEventFactTraceability.liveViewportCount ?? 0}\`; bound/orphan/private facts \`${report.hermesReviewEventFactTraceability.boundFactCount ?? 0}/${report.hermesReviewEventFactTraceability.orphanFactCount ?? 0}/${report.hermesReviewEventFactTraceability.privateEventTextExposed === true}\`. This is reviewer-support traceability, not full hazard-to-control-to-document-to-evidence closure; human review remains incomplete, exact saved Share remains \`${report.hermesReviewEventFactTraceability.exactSavedShareVerdict || "MISSING_EVIDENCE"}\`, and Wiki/RLS/provider persistence remain approval-gated.
- Live Hermes hazard-to-evidence trace blocks are measured separately: \`${report.hermesReviewTraceBlocks.verdict || "missing"}\`, before/local/live passes \`${report.hermesReviewTraceBlocks.beforePassed ?? 0}/${report.hermesReviewTraceBlocks.beforeViewportCount ?? 0}\`, \`${report.hermesReviewTraceBlocks.localPassed ?? 0}/${report.hermesReviewTraceBlocks.localViewportCount ?? 0}\`, and \`${report.hermesReviewTraceBlocks.livePassed ?? 0}/${report.hermesReviewTraceBlocks.liveViewportCount ?? 0}\`; resolved/unresolved/scoped hazards \`${report.hermesReviewTraceBlocks.resolvedTraceCount ?? 0}/${report.hermesReviewTraceBlocks.unresolvedTraceCount ?? 0}/${report.hermesReviewTraceBlocks.scopedFixtureHazardCount ?? 0}\`. This bounded reviewer-support proof leaves all-hazard/all-document closure false, human review incomplete, exact saved Share \`${report.hermesReviewTraceBlocks.exactSavedShareVerdict || "MISSING_EVIDENCE"}\`, and Wiki/RLS/provider persistence approval-gated.
- The canonical Hermes trace matrix is measured separately: \`${report.hermesReviewTraceMatrix.verdict || "missing"}\`, before/local/live passes \`${report.hermesReviewTraceMatrix.beforePassed ?? 0}/${report.hermesReviewTraceMatrix.beforeViewportCount ?? 0}\`, \`${report.hermesReviewTraceMatrix.localPassed ?? 0}/${report.hermesReviewTraceMatrix.localViewportCount ?? 0}\`, and \`${report.hermesReviewTraceMatrix.livePassed ?? 0}/${report.hermesReviewTraceMatrix.liveViewportCount ?? 0}\`; canonical hazards/control links/document links \`${report.hermesReviewTraceMatrix.canonicalHazardCount ?? 0}/${report.hermesReviewTraceMatrix.canonicalControlLinkCount ?? 0}/${report.hermesReviewTraceMatrix.canonicalDocumentLinkCount ?? 0}\`. The expanded trace list does not own a nested scrollbar \`${report.hermesReviewTraceMatrix.traceListInternalScroll === true}\`; the bounded candidate pane is the single scroll owner \`${report.hermesReviewTraceMatrix.traceScrollOwner || "missing"}/${report.hermesReviewTraceMatrix.candidatePaneInternalScroll === true}\`, with the first hazard context visible in every captured viewport \`${report.hermesReviewTraceMatrix.traceScreenshotContextVisible === true}\`. Full mapping closure does not complete human review, exact saved Share remains \`${report.hermesReviewTraceMatrix.exactSavedShareVerdict || "MISSING_EVIDENCE"}\`, and Wiki/RLS/provider persistence remain approval-gated.
- Live supporting-document scenario grounding is measured separately: \`${report.liveDocumentSecondaryGrounding.verdict || "missing"}\`, live cases \`${report.liveDocumentSecondaryGrounding.livePassed ?? 0}/5\`, supporting documents \`${report.liveDocumentSecondaryGrounding.secondaryPassed ?? 0}/${report.liveDocumentSecondaryGrounding.secondaryReviewed ?? 0}\`, cross-scenario leakage \`${report.liveDocumentSecondaryGrounding.crossScenarioLeakageCount ?? 0}\`, and missingUnexpected \`${report.liveDocumentSecondaryGrounding.missingUnexpectedCount ?? 0}\`. This deterministic six-secondary-document contract does not replace the six-document wording gate, 12-document presence/applicability gate, broad human review, or exact saved Share evidence; exact saved Share remains \`${report.liveDocumentSecondaryGrounding.exactSavedShareVerdict || "MISSING_EVIDENCE"}\`.
- Live document seed-profile isolation is measured separately: \`${report.liveDocumentSeedProfileIsolation.verdict || "missing"}\`, before forbidden fragments \`${report.liveDocumentSeedProfileIsolation.beforeSeedProfileLeakageCount ?? 0}\`, live forbidden fragments \`${report.liveDocumentSeedProfileIsolation.liveSeedProfileLeakageCount ?? 0}\`, reviewed document surface \`${report.liveDocumentSeedProfileIsolation.reviewedDocumentSurfaceCount ?? 0}\`, and secondary grounding \`${report.liveDocumentSeedProfileIsolation.secondaryGroundingPassed ?? 0}/${report.liveDocumentSeedProfileIsolation.secondaryGroundingReviewed ?? 0}\`. This deterministic gate does not replace broad human wording review or exact saved Share evidence; exact saved Share remains \`${report.liveDocumentSeedProfileIsolation.exactSavedShareVerdict || "MISSING_EVIDENCE"}\`.
- Hermes/OpenClaw runtime architecture is proven at the adapter, policy, service-auth, route, and fail-closed boundary level. DNS-pinned trusted transport wired=\`${report.hermesOpenclaw.trustedTransportWired === true}\`; durable attempt ledger wired/atomic/reservation-bound/digest-only=\`${report.hermesOpenclaw.durableAttemptLedgerWired === true}/${report.hermesOpenclaw.ledgerAtomicReservation === true}/${report.hermesOpenclaw.ledgerTerminalRequiresReservation === true}/${report.hermesOpenclaw.ledgerStoresTerminalDigestOnly === true}\`; live execution claimed=\`${report.hermesOpenclaw.liveExecutionClaimed === true}\`.
- SIF embedding approval preflight is approval-held: no embedding generation, no upload, and vector runtime disabled until approval.
- North Star approval runway is current and separates runtime/provider/database/vector gates from ordinary UI/evidence iteration.
- RLS / LLM Wiki approval preflight remains operator-review ready, with no DB mutation or launch-readiness claim.
- Final-99 is \`pass_with_notice\`, not clean launch-complete. Its 12-document no-mutation companion is \`${report.final99TwelveDocumentNoMutation.verdict}\`: local documents/core PDFs/downloads \`${report.final99TwelveDocumentNoMutation.localCanonicalPassed ?? "unknown"}/12\`, \`${report.final99TwelveDocumentNoMutation.localCorePdfsPassed ?? "unknown"}/4\`, and \`${report.final99TwelveDocumentNoMutation.localOrchestrationDownloads ?? "unknown"}/14\`; the source-aligned live template generation is \`${report.final99TwelveDocumentNoMutation.liveAskVerdict}\` in \`${report.final99TwelveDocumentNoMutation.liveRequestedAiMode}\` mode while \`${report.final99TwelveDocumentNoMutation.liveBlockerSurfaces?.join(", ") || "no blocked surfaces"}\` remain \`${report.final99TwelveDocumentNoMutation.liveOverall}\` with \`${report.final99TwelveDocumentNoMutation.liveBlockerCode || "no blocker"}\`. Exact saved Share remains \`${report.final99TwelveDocumentNoMutation.exactSavedShareVerdict}\`, and fully automated launch allowed remains \`${report.final99TwelveDocumentNoMutation.fullyAutomatedLaunchClaimAllowed}\`.

## Approval-Gated Boundaries

These require explicit approval before runtime mutation or live claims:

| Gate | Current state | Safety lock | Why it remains held |
| --- | --- | --- | --- |
${approvalRows.join("\n")}

## UI/UX Follow-Up Boundary

The user's Documents/Share concern remains framed as information architecture, not page-count alone:

- Default Documents cockpit: first actionable cockpit is live-proven; do not phrase this as "Documents page height fixed" or "the whole Documents page is short".
- Documents cockpit workbench geometry: \`${report.documentsCockpitWorkbenchGeometry.verdict || "missing"}\`; 1440x723 and 390x723 rows must show grid workbench, 12 unique document keys, exactly 3 visible core launchers, 9 supporting launchers closed by default, 0 visible supporting launchers, the legacy document index hidden, no horizontal overflow, and route split alone remains \`false\`.
- Documents section navigation: \`${report.documentSectionNavigation.verdict || "missing"}\`; ${report.documentSectionNavigation.pass ?? 0}/${report.documentSectionNavigation.total ?? 0} Day/Night desktop-short and mobile-short rows retain 6 tabs, exactly 1 selected tab, 44px minimum controls, readable two-line labels, shell ratio <= 3, first-action containment, no horizontal overflow, no mutation, and exact saved Share \`${report.documentSectionNavigation.exactSavedShareVerdict || "missing"}\`.
- All-document selected-authoring geometry: \`${report.documentAllAuthoringGeometry.verdict || "missing"}\`; ${report.documentAllAuthoringGeometry.pass ?? 0}/${report.documentAllAuthoringGeometry.total ?? 0} rows cover 12 canonical documents across Day/Night desktop-short and mobile-short, with maximum shell ratio \`${report.documentAllAuthoringGeometry.maximumShellRatio ?? "missing"}\`, maximum first-action bottom \`${report.documentAllAuthoringGeometry.maximumFirstActionBottom ?? "missing"}/723\`, minimum inner-pane margin \`${report.documentAllAuthoringGeometry.minimumPaneMargin ?? "missing"}px\` against required \`${report.documentAllAuthoringGeometry.requiredPaneMargin ?? "missing"}px\`, at most one role-specific cockpit, local cockpit scroll, hidden raw/source editors, no mutation, and exact saved Share \`${report.documentAllAuthoringGeometry.exactSavedShareVerdict || "missing"}\`.
- Historical document action pane companion: \`${report.documentAuthoringPaneMargin.verdict || "missing"}\`; its earlier 16px contract moved below-margin rows from ${report.documentAuthoringPaneMargin.beforeBelowMargin ?? "unknown"}/48 to ${report.documentAuthoringPaneMargin.liveBelowMargin ?? "unknown"}/48. The current 32px requirement is reported by the all-document selected-authoring geometry above; route split alone remains \`${report.documentAuthoringPaneMargin.routeSplitAloneAcceptedAsFix === true}\`, and exact saved Share remains \`${report.documentAuthoringPaneMargin.exactSavedShareVerdict || "MISSING_EVIDENCE"}\`.
- Raw-source drilldown geometry: \`${report.documentRawDrilldownGeometry.verdict || "missing"}\`; ${report.documentRawDrilldownGeometry.pass ?? 0}/${report.documentRawDrilldownGeometry.total ?? 0} rows cover 12 canonical documents across Day/Night desktop-short and mobile-short, with maximum shell ratio \`${report.documentRawDrilldownGeometry.maximumShellRatio ?? "missing"}\`, maximum source bottom \`${report.documentRawDrilldownGeometry.maximumSourceBottom ?? "missing"}/723\`, maximum source editor height \`${report.documentRawDrilldownGeometry.maximumSourceClientHeight ?? "missing"}\`, local source scrolling in ${report.documentRawDrilldownGeometry.overflowAutoCount ?? 0}/${report.documentRawDrilldownGeometry.total ?? 0}, no mutation, and exact saved Share \`${report.documentRawDrilldownGeometry.exactSavedShareVerdict || "missing"}\`.
- Documents selected editor/detail: risk-assessment default, same-document reselect, and all-12 launcher exposure land the field strip, evidence/recheck CTA, first risk row, and hazard field before raw long-form textarea across desktop-short, desktop 1440x900, and mobile; explicit raw/source editing remains secondary drilldown but is now live-bounded.
- Documents remaining debt: live selected-authoring and explicit raw-source geometry are bounded, while deeper row/detail editing and broad human wording review remain separate from this layout proof.
- Documents structure contract: route/page split is only orientation; /documents must remain a selected-only bounded workbench with core 3/supporting 9 as index or collapsed navigation.
- Bounded workbench DoD: route split alone is not accepted; desktop Documents hard-REDs above the recorded screen threshold, /share/result desktop requires multi-region workbench geometry, and generated fixture evidence must stay separate from exact saved/session proof.
- Legacy workspace-layout regression: remains a broad no-overflow/editor-flow smoke only, not a long-form UX PASS gate; the DoD and route-specific evidence own first-task distance.
- ${boundedWorkbenchNote}
- Share desktop: current measured Workspace Share and invited recipient fixture routes pass scoped desktop workbench width/region geometry; exact saved/generated user sessions that still feel mobile-like require their own width-ratio/grid repro before product changes.
- Share generated-result fixture: current-source generated provider-result fixture keeps the result summary inside 1440x723, 1440x900, and 390x844 after the short desktop landing fix; exact saved user sessions still require their own repro if reported.
- Share recipient long-content fixture: \`${report.shareRecipientLongContentFixture.verdict || "missing"}\`; ${report.shareRecipientLongContentFixture.rows?.length || 0} route-controlled day/night rows preserve scoped containment, while exact saved reproduced remains \`${report.shareRecipientLongContentFixture.exactSavedUserSessionReproduced === true}\` and exact-session verdict remains \`${report.shareRecipientLongContentFixture.exactSavedSessionVerdict || "missing"}\`.
- Share route evidence split: invited recipient \`/share/[sessionId]\` fixture route, exact saved/generated \`/share/[sessionId]\`, and manager/workspace share-result route remain separate proof layers. A fixture pass cannot close a user-specific exact saved/session complaint.
- Share exact-session boundary: \`${report.shareExactSessionBoundary.verdict || "missing"}\`; exact saved reproduced is \`${report.shareExactSessionBoundary.exactSavedUserSessionReproduced === true}\`, safe missing-session GET status is \`${report.shareExactSessionBoundary.safeReadStatus ?? "unknown"}\`, safe-read verdict is \`${report.shareExactSessionBoundary.safeMissingSessionReadVerdict || "unknown"}\`, invalid-id GET status is \`${report.shareExactSessionBoundary.invalidReadStatus ?? "unknown"}\`, invalid-id verdict is \`${report.shareExactSessionBoundary.safeInvalidSessionReadVerdict || "unknown"}\`, and DB/provider mutations remain \`false\`.
- Share recipient ACK approval: \`${report.shareRecipientAckApproval.overall || "missing"}\`; approval required is \`${report.shareRecipientAckApproval.approvalRequired === true}\`, live-data mutation approved is \`${report.shareRecipientAckApproval.liveDataMutationApproved === true}\`, production share session created is \`${report.shareRecipientAckApproval.productionShareSessionCreated === true}\`, read confirmation inserted is \`${report.shareRecipientAckApproval.productionReadConfirmationInserted === true}\`, DB mutation performed is \`${report.shareRecipientAckApproval.dbMutationPerformed === true}\`, and provider message sent is \`${report.shareRecipientAckApproval.providerMessageSent === true}\`.
- Share public-session storage readiness: \`${report.sharePublicSessionStorageReadiness.verdict || "missing"}\`; live public API status is \`${report.sharePublicSessionStorageReadiness.livePublicApiStatus ?? "unknown"}\`, service-role workpacks readable is \`${report.sharePublicSessionStorageReadiness.workpacksReadable === true}\`, workpack_share_sessions readable is \`${report.sharePublicSessionStorageReadiness.shareSessionsReadable === true}\`, and share-session read error is \`${report.sharePublicSessionStorageReadiness.shareSessionsErrorCode || "unknown"}\`.
- Share public-session storage approval: \`${report.sharePublicSessionStorageApproval.verdict || "missing"}\`; exact saved Share remains \`${report.sharePublicSessionStorageApproval.exactSavedShareSessionVerdict || "unknown"}\`, operator approval required is \`${report.sharePublicSessionStorageApproval.operatorApprovalRequiredBeforeMigration === true}\`, share-session creation would insert storage is \`${report.sharePublicSessionStorageApproval.shareSessionCreationWouldInsertWorkpackShareSessions === true}\`, DB mutation performed is \`${report.sharePublicSessionStorageApproval.dbMutationPerformed === true}\`, and migration path is \`${report.sharePublicSessionStorageApproval.migrationPath || "unknown"}\`.
- Share mobile: compact cockpit remains first-viewport bounded in current evidence.

Route/page split alone is not accepted as the UX fix. Page count only moves long documents/messages to another URL if the route body still unfolds the full artifact. The accepted structure is a three-step app shell plus first-viewport cockpit plus bounded drilldown/detail panes for long documents, messages, logs, and raw metadata.

Required first-task containment:

- Input: work description, mode/preset, evidence attach, and generation CTA first.
- Documents: core 3 status, selected document header, evidence/recheck CTA, and next action first; full 12-document bodies remain selected-only drilldown.
- Share: recipient/channel/language summary, preview/result status, and primary confirmation first; long messages, logs, provenance, and raw metadata remain collapsed/detail content.

## Next Safe Work Without Approval

${report.nextSafeWorkWithoutApproval.map((item, index) => `${index + 1}. ${item}.`).join("\n")}

## KOSHA Candidate Boundary

- Exact trust remains proven only for the accepted exact pins.
- Candidate pool: ${report.koshaNextExactCandidateAudit.acceptedSubsetItems || "unknown"} current native technical-support items.
- Metadata-verified non-exact candidates: ${report.koshaNextExactCandidateAudit.metadataVerifiedNotExact || "unknown"}.
- Operator-review packet candidates: ${report.koshaExactPromotionPacket.candidateCount || "unknown"} (${Array.isArray(report.koshaExactPromotionPacket.selectedStableKeys) ? report.koshaExactPromotionPacket.selectedStableKeys.join(", ") : "unknown"}).
- Operator-review packet ready: ${report.koshaExactPromotionPacket.packetReadyForReview === true}.
- Review checklist complete: ${report.koshaExactPromotionPacket.reviewChecklistComplete === true}.
- Exact-trust promotion blocked until checklist complete: ${report.koshaExactPromotionPacket.exactTrustPromotionBlockedUntilChecklistComplete === true}.
- Mutation performed by candidate audit: ${report.koshaNextExactCandidateAudit.mutationPerformed === true}.
- Exact promotion performed by packet: ${report.koshaExactPromotionPacket.exactPromotionPerformed === true}.
- Forbidden claim remains: metadata-verified candidates are not exact production evidence until separately promoted through immutable acquisition/review.
`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const buildInfo = await readBuildInfo(options);
  const report = buildNorthstarNextRunway({
    rootDir: options.rootDir,
    buildInfo,
  });
  const outputDir = path.isAbsolute(options.outputDir)
    ? options.outputDir
    : path.join(options.rootDir, options.outputDir);
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  fs.writeFileSync(path.join(outputDir, "report.md"), renderNorthstarNextRunwayMarkdown(report), "utf8");
  console.log(JSON.stringify({
    output: path.relative(options.rootDir, outputDir),
    sourceHead: report.sourceHead,
    liveCommit: report.productionCommit,
    latestEvidenceCommitLive: report.latestEvidenceCommitLive,
    currentHeadIsEvidenceOnlyPending: report.currentHeadIsEvidenceOnlyPending,
    liveRollupMatchesProduction: report.liveRollupMatchesProduction,
  }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
