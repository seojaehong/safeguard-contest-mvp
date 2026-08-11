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
  liveDocumentEditorialDuplicateClassification: path.join("evaluation", "live-document-editorial-duplicate-classification-2026-07-25", "report.json"),
  liveDocumentEditorialNearClassification: path.join("evaluation", "live-document-editorial-near-classification-2026-07-25", "report.json"),
  productCapabilityTruth: path.join("evaluation", "product-capability-truth-2026-07-25", "report.json"),
  dependencySecurityRemediation: path.join("evaluation", "dependency-security-remediation-2026-07-28", "report.json"),
  tenantAuthorizationRemediation: path.join("evaluation", "tenant-authorization-boundary-preflight-2026-07-29", "report.json"),
  spreadsheetFormulaNeutralization: path.join("evaluation", "spreadsheet-formula-neutralization-2026-08-01", "report.json"),
  publicProviderWorkBudget: path.join("evaluation", "public-provider-work-budget-2026-08-01", "report.json"),
  documentExportWorkBudget: path.join("evaluation", "document-export-work-budget-2026-08-01", "report.json"),
  fullRepositorySecurityScan: path.join("evaluation", "follow-up-full-repository-security-scan-2026-08-02", "report.json"),
  repositorySecurityScanReconciliation: path.join("evaluation", "repository-security-scan-reconciliation-2026-08-11", "report.json"),
  publicJsonRequestBodyBudget: path.join("evaluation", "public-json-request-body-budget-2026-08-11", "report.json"),
  publicSearchDistributedRateLimitReadiness: path.join("evaluation", "public-search-distributed-rate-limit-readiness-2026-08-02", "report.json"),
  publicGenerationAdmissionSecurity: path.join("evaluation", "security-public-generation-admission-2026-08-04", "report.json"),
  securityFollowupRemediation: path.join("evaluation", "codex-security-followup-remediation-2026-08-11", "report.json"),
  mcpGenerationWorkBudgetSecurity: path.join("evaluation", "security-mcp-generation-work-budget-2026-08-04", "report.json"),
  learningExportRendererSecurity: path.join("evaluation", "learning-export-renderer-security-2026-08-02", "report.json"),
  hermesKnowledgeReviewAuthorityUi: path.join("evaluation", "hermes-knowledge-review-authority-ui-2026-07-25", "report.json"),
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
function approvalGates(approvalRunway, shareRecipientAckApproval) {
  if (!isRecord(approvalRunway) || !Array.isArray(approvalRunway.approvalGates)) {
    throw new Error("Approval runway report is missing approvalGates.");
  }
  const gates = approvalRunway.approvalGates.filter(isRecord).map((gate) => ({
    gate: asString(gate.id),
    state: asString(gate.state),
    evidencePath: asString(gate.evidencePath),
    readyForOperatorReview: asBoolean(gate.readyForOperatorReview),
    currentSafetyLock: asString(gate.currentSafetyLock),
    approvalNeeded: Array.isArray(gate.approvalNeeded) ? gate.approvalNeeded.map(asString).filter(Boolean) : [],
    forbiddenUntilApproved: Array.isArray(gate.forbiddenUntilApproved) ? gate.forbiddenUntilApproved.map(asString).filter(Boolean) : [],
  }));
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
  return {
    verdict: asString(launch.verdict),
    safeLaunchDemoClaimAllowed: asBoolean(launch.safeLaunchDemoClaimAllowed),
    guidedPilotClaimAllowed: asBoolean(launch.guidedPilotClaimAllowed),
    fullyAutomatedLaunchClaimAllowed: asBoolean(launch.fullyAutomatedLaunchClaimAllowed),
    selfServeSaasLaunchClaimAllowed: asBoolean(launch.selfServeSaasLaunchClaimAllowed),
    providerDispatchLiveClaimed: asBoolean(launch.providerDispatchLiveClaimed),
    apiAskOk: isRecord(launch.apiAsk) && asBoolean(launch.apiAsk.ok),
    dispatchCalled: asBoolean(launch.dispatchCalled),
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
    observedMode: asString(configuration.observedMode),
    distributedActivationPending: asBoolean(configuration.distributedActivationPending),
    sealedFindingsClosedWithoutRescan: asBoolean(boundary.sealedFindingsClosedWithoutRescan),
    remainingDbRlsFindings: typeof boundary.remainingDbRlsFindings === "number"
      ? boundary.remainingDbRlsFindings
      : 0,
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
    liveMode: asString(runtimeBoundary.liveMode),
    liveDeploymentVerified: asBoolean(runtimeBoundary.liveDeploymentVerified),
    distributedHardeningOpen: asBoolean(runtimeBoundary.distributedProductionHardeningOpen),
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
function mcpGenerationWorkBudgetSecuritySummary(report) {
  if (!isRecord(report)) return {};
  const contract = isRecord(report.currentSourceContract) ? report.currentSourceContract : {};
  const verification = isRecord(report.verification) ? report.verification : {};
  const adjacent = isRecord(verification.adjacentMcp) ? verification.adjacentMcp : {};
  const remaining = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  return {
    verdict: asString(report.verdict),
    sourceHead: asString(report.sourceHead),
    productionCommit: asString(report.productionCommit),
    sourceHeadMatchesProduction: asBoolean(report.sourceHeadMatchesProduction),
    postBodyMaxBytes: typeof contract.postBodyMaxBytes === "number" ? contract.postBodyMaxBytes : null,
    adjacentTests: typeof adjacent.tests === "number" ? adjacent.tests : null,
    validAuthenticatedRuntimeProbeRequired: asBoolean(remaining.validAuthenticatedRuntimeProbeRequired),
    distributedActivationRequired: asBoolean(remaining.distributedProductionActivationRequired),
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
  const liveDocumentEditorialDuplicateClassification = readOptionalJson(
    options.rootDir,
    ARTIFACTS.liveDocumentEditorialDuplicateClassification,
  );
  const liveDocumentEditorialNearClassification = readOptionalJson(
    options.rootDir,
    ARTIFACTS.liveDocumentEditorialNearClassification,
  );
  const productCapabilityTruth = readOptionalJson(options.rootDir, ARTIFACTS.productCapabilityTruth);
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
  const publicJsonRequestBodyBudget = readOptionalJson(
    options.rootDir,
    ARTIFACTS.publicJsonRequestBodyBudget,
  );
  const mcpGenerationWorkBudgetSecurity = readOptionalJson(
    options.rootDir,
    ARTIFACTS.mcpGenerationWorkBudgetSecurity,
  );
  const learningExportRendererSecurity = readOptionalJson(options.rootDir, ARTIFACTS.learningExportRendererSecurity);
  const hermesKnowledgeReviewAuthorityUi = readOptionalJson(options.rootDir, ARTIFACTS.hermesKnowledgeReviewAuthorityUi);
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
  const publicSearchDistributedRateLimitReadinessResult = publicSearchDistributedRateLimitReadinessSummary(
    publicSearchDistributedRateLimitReadiness,
  );
  const publicGenerationAdmissionSecurityResult = publicGenerationAdmissionSecuritySummary(
    publicGenerationAdmissionSecurity,
  );
  const securityFollowupRemediationResult = securityFollowupRemediationSummary(securityFollowupRemediation);
  const publicJsonRequestBodyBudgetResult = publicJsonRequestBodyBudgetSummary(publicJsonRequestBodyBudget);
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
      "product_capability_truth",
      "dependency_security_remediation",
      "tenant_authorization_remediation",
      "spreadsheet_formula_neutralization",
      "public_provider_work_budget",
      "document_export_work_budget",
      "full_repository_security_scan",
      "repository_security_scan_reconciliation",
      "public_json_request_body_budget",
      "security_followup_remediation",
      "learning_export_renderer_security",
      "hermes_knowledge_review_authority",
      "hermes_knowledge_review_ui",
      "kosha_exact_promotion_packet_ready_for_review",
      "ui_documents_share_cockpit",
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
        reason: "pass_with_notice with carried auth-history and dispatch-policy notices",
      },
      {
        gate: "public_search_distributed_rate_limit_readiness",
        state: "notice",
        reason: "live capability is verified with X-SafeClaw-Rate-Limit=instance; production distributed configuration remains pending",
      },
      {
        gate: "public_generation_admission_security",
        state: "notice",
        reason: "live instance admission is verified; distributed production activation and the fresh remediation diff scan remain open",
      },
      {
        gate: "mcp_generation_work_budget_security",
        state: "notice",
        reason: "deployed source includes the measured MCP body and token-bound admission budgets; a valid authenticated runtime probe, distributed activation, and fresh rescan remain open",
      },
    ],
    approvalGated: approvalGates(approvalRunway, shareRecipientAckApproval),
    launchReadiness: launchReadinessSummary(launch),
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
      dispatchStandalone: "live standalone /dispatch now separately requires a 1440x723 two-pane viewport cockpit with preview and primary action inside the first viewport plus 390x723 Day/Night primary-action containment, internal scroll, default-collapsed mobile configuration, and exact saved Share MISSING_EVIDENCE",
      shareGeneratedResult: "current-source generated provider-result fixture keeps the result summary inside 1440x723, 1440x900, and 390x844 after the short desktop landing fix; exact saved user sessions still require their own repro if reported",
      shareRecipientLongContent: "live route-controlled long-content fixture keeps desktop recipient Share in two regions, mobile recipient root <= 1.5 viewports, confirmation in the first viewport, long task text in local scroll, and the document group collapsed by default; route split alone is insufficient and this is not exact saved-session proof",
      shareRouteEvidenceBoundary: "separate Share evidence into invited recipient fixture pass, exact saved/generated /share/[sessionId] missing evidence, and manager/workspace share-result route repro; do not use one route's pass to close another route's mobile-like complaint",
      shareMobile: "current compact cockpit remains first-viewport bounded in current evidence",
      hermesOpenclaw: "adapter and fail-closed auth boundary current-proven; production now wires the DNS-pinned trusted HTTPS transport while durable cross-instance attempt/terminal ledger and authenticated live execution remain open; live unauthenticated broker smoke returns AUTH_REQUIRED before engine execution; live authenticated reviewer UI passes 8/8 viewport contracts and exposes SIF -> KOSHA -> law -> organization history -> site history -> external context authority roles, tenant-memory non-promotion, site-manager acceptance, and human-review requirements without provider, DB, publication, or Share mutation",
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
    liveDocumentEditorialDuplicateClassification: liveDocumentEditorialDuplicateClassificationSummary(
      liveDocumentEditorialDuplicateClassification,
    ),
    liveDocumentEditorialNearClassification: liveDocumentEditorialNearClassificationSummary(
      liveDocumentEditorialNearClassification,
    ),
    productCapabilityTruth: productCapabilityTruthSummary(productCapabilityTruth),
    dependencySecurityRemediation: dependencySecuritySummary,
    tenantAuthorizationRemediation: tenantAuthorizationSummary,
    spreadsheetFormulaNeutralization: spreadsheetFormulaSummary,
    publicProviderWorkBudget: publicProviderWorkBudgetResult,
    documentExportWorkBudget: documentExportWorkBudgetResult,
    fullRepositorySecurityScan: fullRepositorySecuritySummary,
    repositorySecurityScanReconciliation: repositorySecurityScanReconciliationResult,
    publicSearchDistributedRateLimitReadiness: publicSearchDistributedRateLimitReadinessResult,
    publicGenerationAdmissionSecurity: publicGenerationAdmissionSecurityResult,
    securityFollowupRemediation: securityFollowupRemediationResult,
    publicJsonRequestBodyBudget: publicJsonRequestBodyBudgetResult,
    mcpGenerationWorkBudgetSecurity: mcpGenerationWorkBudgetSecurityResult,
    learningExportRendererSecurity: learningExportRendererSecurityResult,
    hermesKnowledgeReviewAuthorityUi: hermesKnowledgeReviewAuthorityUiSummary(hermesKnowledgeReviewAuthorityUi),
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
      "keep Hermes/OpenClaw live execution held: tenant envelope, tool denial, Evidence Harness, DNS-pinned trusted transport, and terminal persistence behavior are source-proven, while the durable cross-instance attempt/terminal ledger and authenticated canary remain open",
      "keep provider dispatch, RLS, LLM Wiki publication, and SIF vector runtime as approval-required gates",
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
- Live editorial duplicate classification is measured separately: \`${report.liveDocumentEditorialDuplicateClassification.verdict || "missing"}\`, generic template overuse \`${report.liveDocumentEditorialDuplicateClassification.beforeGenericTemplateOveruseCount ?? 0}->${report.liveDocumentEditorialDuplicateClassification.liveGenericTemplateOveruseCount ?? 0}\`, retained reviewer findings exact/near \`${report.liveDocumentEditorialDuplicateClassification.exactLineOveruseCount ?? 0}/${report.liveDocumentEditorialDuplicateClassification.nearDuplicateLineOveruseCount ?? 0}\`, and humanReviewCompleted=\`${report.liveDocumentEditorialDuplicateClassification.humanReviewCompleted === true}\`. Only generic template overuse fails automatically; safety-control and legal-reference repetition remains visible, and exact saved Share remains \`${report.liveDocumentEditorialDuplicateClassification.exactSavedShareVerdict || "MISSING_EVIDENCE"}\`.
- Live editorial near-duplicate classification preserves \`${report.liveDocumentEditorialNearClassification.beforeNearDuplicateLineOveruseCount ?? 0}->${report.liveDocumentEditorialNearClassification.liveNearDuplicateLineOveruseCount ?? 0}\` findings while reducing unclassified human-review-required \`${report.liveDocumentEditorialNearClassification.beforeHumanReviewRequiredCount ?? 0}->${report.liveDocumentEditorialNearClassification.liveHumanReviewRequiredCount ?? 0}\`. The retained role-prefix/context/hazard/control categories are \`${report.liveDocumentEditorialNearClassification.rolePrefixVariantCount ?? 0}/${report.liveDocumentEditorialNearClassification.independentContextCount ?? 0}/${report.liveDocumentEditorialNearClassification.hazardConsistencyCount ?? 0}/${report.liveDocumentEditorialNearClassification.controlConsistencyCount ?? 0}\`; humanReviewCompleted=\`${report.liveDocumentEditorialNearClassification.humanReviewCompleted === true}\` and exact saved Share remains \`${report.liveDocumentEditorialNearClassification.exactSavedShareVerdict || "MISSING_EVIDENCE"}\`.
- Live product capability truth is measured separately: \`${report.productCapabilityTruth.verdict || "missing"}\`; manual/provider dispatch is \`${report.productCapabilityTruth.dispatchMode || "unknown"}\` with reason \`${report.productCapabilityTruth.dispatchReason || "unknown"}\`, scheduled briefing email ready=\`${report.productCapabilityTruth.briefingEmailReady === true}\`, photo Vision/OCR ready/accepted-only=\`${report.productCapabilityTruth.photoVisionReady === true}/${report.productCapabilityTruth.photoAcceptedOnly === true}\`, and AI modes are \`${report.productCapabilityTruth.aiModes?.join(", ") || "missing"}\`. No provider or photo POST call is claimed. This does not unlock provider persistence; exact saved Share remains \`${report.productCapabilityTruth.exactSavedShareVerdict || "MISSING_EVIDENCE"}\` and Documents/Share IA remains \`${report.productCapabilityTruth.documentsShareIaVerdict || "OPEN_SEPARATE_VIEWPORT_IA_WAVE"}\`.
- Public generation admission security is measured separately: \`${report.publicGenerationAdmissionSecurity.verdict || "missing"}\`, live mode \`${report.publicGenerationAdmissionSecurity.liveMode || "unknown"}\`, dependency vulnerabilities \`${report.publicGenerationAdmissionSecurity.vulnerabilityCount ?? "unknown"}\`, distributed hardening open=\`${report.publicGenerationAdmissionSecurity.distributedHardeningOpen === true}\`, and fresh diff scan required=\`${report.publicGenerationAdmissionSecurity.freshRescanRequired === true}\`. This notice does not close multi-instance protection, the immutable scan finding, approval-gated operations, or exact saved Share; exact saved Share remains \`${report.publicGenerationAdmissionSecurity.exactSavedShareVerdict || "MISSING_EVIDENCE"}\`.
- Security follow-up remediation is separately proven: \`${report.securityFollowupRemediation.verdict || "missing"}\`, sealed findings \`${report.securityFollowupRemediation.sealedFindingCount ?? "unknown"}\`, focused tests \`${report.securityFollowupRemediation.focusedTests ?? "unknown"}\`, and remaining security work \`${report.securityFollowupRemediation.remainingSecurityWorkCount ?? "unknown"}\`. The immutable original baseline remains \`${report.securityFollowupRemediation.immutableOriginalBaselineFindingCount ?? "unknown"}\` findings with rewritten=\`${report.securityFollowupRemediation.originalBaselineRewritten === true}\`; two deferred candidates and the separate public-admission notice remain visible, no live provider cancellation probe is claimed, and exact saved Share remains \`${report.securityFollowupRemediation.exactSavedShareVerdict || "MISSING_EVIDENCE"}\`.
- Public JSON pre-parse body budgeting is separately live-proven: \`${report.publicJsonRequestBodyBudget.verdict || "missing"}\`, finding \`${report.publicJsonRequestBodyBudget.findingId || "missing"}\`, and live oversized-request cases \`${report.publicJsonRequestBodyBudget.liveCaseCount ?? "unknown"}\`. The corrected canonical scan remains immutable, follow-up scan status is \`${report.publicJsonRequestBodyBudget.followUpSecurityScan || "REQUIRED"}\`, security-complete remains \`${report.publicJsonRequestBodyBudget.securityCompleteClaimAllowed === true}\`, and exact saved Share remains \`${report.publicJsonRequestBodyBudget.exactSavedShareVerdict || "MISSING_EVIDENCE"}\`.
- Repository security scan reconciliation is \`${report.repositorySecurityScanReconciliation.verdict || "missing"}\`. The immutable same-target scans and \`${report.repositorySecurityScanReconciliation.receiptContradictionCount ?? "unknown"}\` fail-open contradictions remain preserved; zero-finding accepted=\`${report.repositorySecurityScanReconciliation.zeroFindingClaimAccepted === true}\`. Corrected scan completed=\`${report.repositorySecurityScanReconciliation.correctedFreshScanCompleted === true}\`, id=\`${report.repositorySecurityScanReconciliation.correctedScanId || "missing"}\`, reportable=\`${report.repositorySecurityScanReconciliation.correctedReportableFindingCount ?? "unknown"}\`, deferred=\`${report.repositorySecurityScanReconciliation.correctedDeferredCandidateCount ?? "unknown"}\`, coverage=\`${report.repositorySecurityScanReconciliation.correctedCoverageCompleteness || "unknown"}\`, security-complete=\`${report.repositorySecurityScanReconciliation.securityCompleteClaimAllowed === true}\`, and exact saved Share remains \`${report.repositorySecurityScanReconciliation.exactSavedShareVerdict || "MISSING_EVIDENCE"}\`.
- MCP generation work-budget security is separately measured: \`${report.mcpGenerationWorkBudgetSecurity.verdict || "missing"}\`, POST body budget \`${report.mcpGenerationWorkBudgetSecurity.postBodyMaxBytes ?? "unknown"}\` bytes, adjacent tests \`${report.mcpGenerationWorkBudgetSecurity.adjacentTests ?? "unknown"}\`, valid authenticated runtime probe pending=\`${report.mcpGenerationWorkBudgetSecurity.validAuthenticatedRuntimeProbeRequired === true}\`, distributed activation pending=\`${report.mcpGenerationWorkBudgetSecurity.distributedActivationRequired === true}\`, and fresh rescan required=\`${report.mcpGenerationWorkBudgetSecurity.freshRescanRequired === true}\`. This notice preserves the sealed finding and exact saved Share \`${report.mcpGenerationWorkBudgetSecurity.exactSavedShareVerdict || "MISSING_EVIDENCE"}\`.
- Live Hermes reviewer authority UI is measured separately: \`${report.hermesKnowledgeReviewAuthorityUi.verdict || "missing"}\`, local/live viewport contracts \`${report.hermesKnowledgeReviewAuthorityUi.localPassed ?? 0}/${report.hermesKnowledgeReviewAuthorityUi.localViewportCount ?? 0}\` and \`${report.hermesKnowledgeReviewAuthorityUi.livePassed ?? 0}/${report.hermesKnowledgeReviewAuthorityUi.liveViewportCount ?? 0}\`, with authority order \`${report.hermesKnowledgeReviewAuthorityUi.sourceOrder?.join(" -> ") || "missing"}\`. Human review remains required and machine evidence does not replace it; no DB/provider/share/publication mutation is claimed. Exact saved Share remains \`${report.hermesKnowledgeReviewAuthorityUi.exactSavedShareVerdict || "MISSING_EVIDENCE"}\`, while LLM Wiki publication and Supabase RLS remain approval-gated.
- Live supporting-document scenario grounding is measured separately: \`${report.liveDocumentSecondaryGrounding.verdict || "missing"}\`, live cases \`${report.liveDocumentSecondaryGrounding.livePassed ?? 0}/5\`, supporting documents \`${report.liveDocumentSecondaryGrounding.secondaryPassed ?? 0}/${report.liveDocumentSecondaryGrounding.secondaryReviewed ?? 0}\`, cross-scenario leakage \`${report.liveDocumentSecondaryGrounding.crossScenarioLeakageCount ?? 0}\`, and missingUnexpected \`${report.liveDocumentSecondaryGrounding.missingUnexpectedCount ?? 0}\`. This deterministic six-secondary-document contract does not replace the six-document wording gate, 12-document presence/applicability gate, broad human review, or exact saved Share evidence; exact saved Share remains \`${report.liveDocumentSecondaryGrounding.exactSavedShareVerdict || "MISSING_EVIDENCE"}\`.
- Live document seed-profile isolation is measured separately: \`${report.liveDocumentSeedProfileIsolation.verdict || "missing"}\`, before forbidden fragments \`${report.liveDocumentSeedProfileIsolation.beforeSeedProfileLeakageCount ?? 0}\`, live forbidden fragments \`${report.liveDocumentSeedProfileIsolation.liveSeedProfileLeakageCount ?? 0}\`, reviewed document surface \`${report.liveDocumentSeedProfileIsolation.reviewedDocumentSurfaceCount ?? 0}\`, and secondary grounding \`${report.liveDocumentSeedProfileIsolation.secondaryGroundingPassed ?? 0}/${report.liveDocumentSeedProfileIsolation.secondaryGroundingReviewed ?? 0}\`. This deterministic gate does not replace broad human wording review or exact saved Share evidence; exact saved Share remains \`${report.liveDocumentSeedProfileIsolation.exactSavedShareVerdict || "MISSING_EVIDENCE"}\`.
- Hermes/OpenClaw runtime architecture is proven at the adapter, policy, service-auth, route, and fail-closed boundary level. DNS-pinned trusted transport wired=\`${report.hermesOpenclaw.trustedTransportWired === true}\`; durable attempt ledger wired=\`${report.hermesOpenclaw.durableAttemptLedgerWired === true}\`; live execution claimed=\`${report.hermesOpenclaw.liveExecutionClaimed === true}\`.
- SIF embedding approval preflight is approval-held: no embedding generation, no upload, and vector runtime disabled until approval.
- North Star approval runway is current and separates runtime/provider/database/vector gates from ordinary UI/evidence iteration.
- RLS / LLM Wiki approval preflight remains operator-review ready, with no DB mutation or launch-readiness claim.
- Final-99 is \`pass_with_notice\`, not clean launch-complete.

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
- All-document selected-authoring geometry: \`${report.documentAllAuthoringGeometry.verdict || "missing"}\`; ${report.documentAllAuthoringGeometry.pass ?? 0}/${report.documentAllAuthoringGeometry.total ?? 0} rows cover 12 canonical documents across Day/Night desktop-short and mobile-short, with maximum shell ratio \`${report.documentAllAuthoringGeometry.maximumShellRatio ?? "missing"}\`, maximum first-action bottom \`${report.documentAllAuthoringGeometry.maximumFirstActionBottom ?? "missing"}/723\`, at most one role-specific cockpit, local cockpit scroll, hidden raw/source editors, no mutation, and exact saved Share \`${report.documentAllAuthoringGeometry.exactSavedShareVerdict || "missing"}\`.
- Document action pane margin: \`${report.documentAuthoringPaneMargin.verdict || "missing"}\`; rows below the required 16px inner-pane margin move from ${report.documentAuthoringPaneMargin.beforeBelowMargin ?? "unknown"}/48 to ${report.documentAuthoringPaneMargin.liveBelowMargin ?? "unknown"}/48, live minimum margin is ${report.documentAuthoringPaneMargin.liveMinimumMargin ?? "unknown"}px, maximum shell ratio is ${report.documentAuthoringPaneMargin.liveMaximumShellRatio ?? "unknown"}, route split alone remains \`${report.documentAuthoringPaneMargin.routeSplitAloneAcceptedAsFix === true}\`, and exact saved Share remains \`${report.documentAuthoringPaneMargin.exactSavedShareVerdict || "MISSING_EVIDENCE"}\`.
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
