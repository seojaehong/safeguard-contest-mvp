#!/usr/bin/env node
// @ts-check

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SCHEMA_VERSION = "safeclaw-northstar-live-rollup/v2";
const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "..");
const DEFAULT_OUTPUT_DIR = path.join("evaluation", "northstar-live-rollup-2026-07-20");
const DEFAULT_BUILD_INFO_URL = "https://www.safeclaw.kr/api/build-info";

const ARTIFACTS = Object.freeze({
  openGate: path.join("evaluation", "northstar-open-gates-current", "report.json"),
  final99: path.join("evaluation", "final-99-gate-current-2026-07-22", "report.json"),
  final99NoticeCarry: path.join("evaluation", "final-99-gate-current-2026-07-22", "notice-carry.json"),
  liveHarness: path.join("evaluation", "live-harness-quality-probe-current-2026-07-20", "report.json"),
  liveDocumentQualityMatrix: path.join("evaluation", "live-document-quality-matrix-2026-07-24", "report.json"),
  liveDocumentQualityStressMatrix: path.join("evaluation", "live-document-quality-stress-matrix-2026-07-24", "report.json"),
  liveDocumentFieldIsolation: path.join("evaluation", "live-document-field-isolation-2026-07-25", "report.json"),
  liveKoshaExactMaterialization: path.join("evaluation", "live-kosha-exact-materialization-2026-07-25", "report.json"),
  liveDocumentWordingReview: path.join("evaluation", "live-document-wording-review-2026-07-24", "report.json"),
  liveDocumentBroadReview: path.join("evaluation", "live-document-broad-review-2026-07-25", "report.json"),
  liveDocumentEditorialReview: path.join("evaluation", "live-document-editorial-review-2026-07-25", "report.json"),
  documentEditorialReviewCockpit: path.join("evaluation", "document-editorial-review-cockpit-2026-08-16", "report.json"),
  liveDocumentEditorialDuplicateClassification: path.join("evaluation", "live-document-editorial-duplicate-classification-2026-07-25", "report.json"),
  liveDocumentEditorialNearClassification: path.join("evaluation", "live-document-editorial-near-classification-2026-07-25", "report.json"),
  productCapabilityTruth: path.join("evaluation", "product-capability-truth-2026-07-25", "report.json"),
  tenantAuthorizationRemediation: path.join("evaluation", "tenant-authorization-boundary-preflight-2026-07-29", "report.json"),
  spreadsheetFormulaNeutralization: path.join("evaluation", "spreadsheet-formula-neutralization-2026-08-01", "report.json"),
  publicProviderWorkBudget: path.join("evaluation", "public-provider-work-budget-2026-08-01", "report.json"),
  documentExportWorkBudget: path.join("evaluation", "document-export-work-budget-2026-08-01", "report.json"),
  fullRepositorySecurityScan: path.join("evaluation", "follow-up-full-repository-security-scan-2026-08-02", "report.json"),
  repositorySecurityScanReconciliation: path.join("evaluation", "repository-security-scan-reconciliation-2026-08-11", "report.json"),
  currentSecurityRemediationLedger: path.join("evaluation", "security-current-remediation-ledger-2026-08-13", "report.json"),
  currentRepositorySecurityRescan: path.join("evaluation", "final-approval-free-security-rescan-2026-08-16", "report.json"),
  agentChatDurableAdmission: path.join("evaluation", "security-agent-chat-durable-admission-2026-08-14", "report.json"),
  mcpProviderAdmission: path.join("evaluation", "security-mcp-provider-admission-2026-08-14", "report.json"),
  shareRecipientContactVerification: path.join("evaluation", "share-recipient-contact-verification-2026-08-14", "report.json"),
  securityAtomicDbRaceApprovalBoundary: path.join("evaluation", "security-atomic-db-race-approval-boundary-2026-08-14", "report.json"),
  liveDocumentsShareRoutePerception: path.join("evaluation", "live-documents-share-route-perception-2026-08-14", "report.json"),
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
  hermesKnowledgeReviewEvidenceInspector: path.join("evaluation", "hermes-knowledge-review-evidence-inspector-2026-08-14", "report.json"),
  hermesOpenclawRuntime: path.join("evaluation", "hermes-openclaw-runtime-current-gate-2026-07-20", "report.json"),
  liveDocumentSecondaryGrounding: path.join("evaluation", "live-document-secondary-grounding-2026-07-25", "report.json"),
  liveDocumentSeedProfileIsolation: path.join("evaluation", "live-document-seed-profile-isolation-2026-07-25", "report.json"),
  kosha: path.join("evaluation", "kosha-current-live-gate-2026-07-20", "report.json"),
  rlsWiki: path.join("evaluation", "rls-llm-wiki-approval-preflight-current-2026-07-20", "report.json"),
  sifEmbedding: path.join("evaluation", "sif-embedding-gate", "approval-preflight-report.json"),
  liveCritical: path.join("evaluation", "live-critical-surface-current-2026-07-20-rerun", "report.json"),
  mobileP0: path.join("evaluation", "mobile-p0-workspace-gate-2026-07-20", "report.json"),
  workspaceGeometry: path.join("evaluation", "workspace-docs-share-production-gate-2026-07-20", "current-geometry.json"),
  documentAuthoringPaneMargin: path.join("evaluation", "document-authoring-pane-margin-2026-08-02", "report.json"),
  dispatchStandalone: path.join("evaluation", "dispatch-standalone-cockpit-2026-07-21", "report.json"),
  dispatchStandaloneViewport: path.join("evaluation", "dispatch-standalone-viewport-2026-07-28", "report.json"),
  providerDispatchIdempotency: path.join("evaluation", "provider-dispatch-idempotency-gate-2026-07-19", "report.json"),
  approvalRunway: path.join("evaluation", "northstar-approval-runway-2026-07-21", "report.json"),
});

/**
 * @typedef {Record<string, unknown>} JsonRecord
 */

/**
 * @param {unknown} value
 * @returns {value is JsonRecord}
 */
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * @param {unknown} value
 */
function asString(value) {
  return typeof value === "string" ? value : "";
}

/**
 * @param {unknown} value
 */
function asNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * @param {string} rootDir
 * @param {string} relativePath
 */
function readJson(rootDir, relativePath) {
  const absolutePath = path.join(rootDir, relativePath);
  const text = fs.readFileSync(absolutePath, "utf8");
  return JSON.parse(text);
}

/**
 * @param {string} rootDir
 * @param {string} relativePath
 */
function tryReadJson(rootDir, relativePath) {
  try {
    return readJson(rootDir, relativePath);
  } catch {
    return null;
  }
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
 */
function isAncestor(rootDir, possibleAncestor) {
  if (!/^[0-9a-f]{40}$/u.test(possibleAncestor)) {
    return false;
  }
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", possibleAncestor, "HEAD"], {
      cwd: rootDir,
      stdio: ["ignore", "ignore", "ignore"],
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {string} rootDir
 * @param {string} sha
 * @param {string} currentHead
 */
function classifySha(rootDir, sha, currentHead) {
  if (!sha) {
    return "missing";
  }
  if (sha === currentHead) {
    return "exact";
  }
  if (isAncestor(rootDir, sha)) {
    return "ancestor";
  }
  return "not_ancestor";
}

/**
 * @param {unknown} report
 */
function extractProductionCommit(report) {
  if (!isRecord(report)) {
    return "";
  }
  const candidates = [
    isRecord(report.productionBuild) ? report.productionBuild.commitSha : "",
    isRecord(report.productionBuildInfoAtLiveSmoke) ? report.productionBuildInfoAtLiveSmoke.commitSha : "",
    isRecord(report.liveBuildInfo) ? report.liveBuildInfo.commitSha : "",
    isRecord(report.production) ? report.production.commitSha : "",
    isRecord(report.build) ? report.build.commitSha : "",
    isRecord(report.buildInfo) ? report.buildInfo.commitSha : "",
    isRecord(report.liveDispatchState) ? report.liveDispatchState.productionCommitSha : "",
    report.liveCommitAtDraft,
    report.productionCommitAtGeneration,
    report.productionCommitAfterDeployment,
    report.productionCommit,
    isRecord(report.source) ? report.source.productionMarkerAtValidation : "",
  ];
  return candidates.map(asString).find(Boolean) || "";
}

/**
 * @param {unknown} report
 */
function extractSourceCommit(report) {
  if (!isRecord(report)) {
    return "";
  }
  return asString(report.sourceCommit)
    || asString(report.sourceSha)
    || asString(report.sourceShaForFocusedTests)
    || asString(report.sourceHeadAtDraft)
    || asString(report.sourceHeadBeforeCommit)
    || asString(report.sourceHead)
    || asString(report.head)
    || asString(report.commitSha)
    || asString(report.commit)
    || (isRecord(report.source) ? asString(report.source.evidenceHead) : "");
}

/**
 * @param {string} rootDir
 * @param {string} currentHead
 * @param {string} liveCommit
 * @param {string} id
 * @param {string} artifact
 * @param {unknown} report
 */
function evidenceStatus(rootDir, currentHead, liveCommit, id, artifact, report) {
  const sourceCommit = extractSourceCommit(report);
  const explicitProductionCommit = extractProductionCommit(report);
  const productionCommit = explicitProductionCommit || (id === "open_gate" ? sourceCommit : "");
  let productionStatus = "missing";
  if (productionCommit) {
    if (productionCommit === liveCommit) {
      productionStatus = sourceCommit && sourceCommit !== liveCommit
        ? "matches_live_source_mismatch"
        : "matches_live";
    } else {
      productionStatus = isAncestor(rootDir, productionCommit)
        ? "ancestor_of_head"
        : "not_ancestor";
    }
  }
  return {
    id,
    artifact,
    sourceCommit: sourceCommit || null,
    sourceStatus: classifySha(rootDir, sourceCommit, currentHead),
    productionCommit: productionCommit || null,
    productionStatus,
  };
}

/**
 * @param {string[]} argv
 */
function parseArgs(argv) {
  /** @type {{ rootDir: string, outputDir: string, buildInfoUrl: string, buildInfoFile: string }} */
  const options = {
    rootDir: REPO_ROOT,
    outputDir: DEFAULT_OUTPUT_DIR,
    buildInfoUrl: DEFAULT_BUILD_INFO_URL,
    buildInfoFile: "",
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1] || "";
    if (arg === "--root") {
      options.rootDir = path.resolve(next);
      index += 1;
    } else if (arg === "--output") {
      options.outputDir = next;
      index += 1;
    } else if (arg === "--build-info-url") {
      options.buildInfoUrl = next;
      index += 1;
    } else if (arg === "--build-info-file") {
      options.buildInfoFile = next;
      index += 1;
    } else if (arg === "--help") {
      console.log("Usage: node scripts/northstar_live_rollup.mjs [--root DIR] [--output DIR] [--build-info-url URL] [--build-info-file FILE]");
      process.exit(0);
    }
  }
  return options;
}

/**
 * @param {{ rootDir: string, buildInfoUrl: string, buildInfoFile: string }} options
 */
async function loadBuildInfo(options) {
  if (options.buildInfoFile) {
    return readJson(options.rootDir, options.buildInfoFile);
  }
  const response = await fetch(options.buildInfoUrl, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Build info request failed with HTTP ${response.status}`);
  }
  return await response.json();
}

/**
 * @param {unknown} value
 * @param {string} key
 */
function recordAt(value, key) {
  if (!isRecord(value)) {
    return null;
  }
  const next = value[key];
  return isRecord(next) ? next : null;
}

/** @param {unknown} review */
function documentEditorialReviewCockpitSummary(review) {
  if (!isRecord(review)) return { verdict: "missing", cockpitReady: false, accessibilityRowsPassed: 0 };
  const acceptance = recordAt(review, "acceptanceContract") || {};
  const reviewBoundary = recordAt(review, "reviewBoundary") || {};
  const mutationBoundary = recordAt(review, "mutationBoundary") || {};
  const productionBuild = recordAt(review, "productionBuild") || {};
  const rows = Array.isArray(review.results) ? review.results.filter(isRecord) : [];
  const rowsPass = rows.length === 4 && rows.every((row) => {
    const before = recordAt(row, "beforeCompletion") || {};
    const after = recordAt(row, "afterCompletion") || {};
    return asString(row.verdict) === "PASS"
      && asNumber(before.bodyHeight) === asNumber(before.viewportHeight)
      && asNumber(before.reviewDocumentCount) === 12
      && asNumber(before.uniqueDocumentCount) === 12
      && before.includesRiskAssessment === true
      && asNumber(before.checkboxCount) === 5
      && before.horizontalOverflow === false
      && after.currentWorkpackUnchanged === true
      && asNumber(after.apiRequestCount) === 0
      && asNumber(after.dialogScrollTop) === 0;
  });
  const desktopRows = rows.filter((row) => asNumber(row.width) === 1440 && asNumber(row.height) === 723);
  const mobileRows = rows.filter((row) => asNumber(row.width) === 390 && asNumber(row.height) === 723);
  const geometryPass = desktopRows.length === 2
    && desktopRows.every((row) => asNumber(recordAt(row, "beforeCompletion")?.workbenchColumns) === 3)
    && mobileRows.length === 2
    && mobileRows.every((row) => asNumber(recordAt(row, "beforeCompletion")?.workbenchColumns) === 1);
  const accessibilityRowsPassed = rows.filter((row) => {
    const accessibility = recordAt(row, "accessibility") || {};
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
  const cockpitReady = asString(review.verdict) === "PASS_LIVE_PRODUCTION_DOCUMENT_EDITORIAL_REVIEW_COCKPIT"
    && asNumber(review.pass) === 4
    && asNumber(review.fail) === 0
    && asString(review.sourceHead).length > 0
    && asString(review.sourceHead) === asString(productionBuild.commitSha)
    && review.sourceHeadMatchesProduction === true
    && asString(productionBuild.environment) === "production"
    && rowsPass
    && geometryPass
    && asNumber(acceptance.canonicalDocumentCount) === 12
    && acceptance.includesRiskAssessment === true
    && asNumber(acceptance.reviewerCheckCount) === 5
    && asNumber(acceptance.desktopZones) === 3
    && asNumber(acceptance.mobileColumns) === 1
    && acceptance.bodyHeightUnchangedWhileOpen === true
    && acceptance.longCopyContained === true
    && acceptance.reviewStateStoredSeparately === true
    && acceptance.editedTextInvalidatesCompletion === true
    && acceptance.automaticReviewCannotClaimHumanCompletion === true
    && acceptance.keyboardRovingTabNavigation === true
    && acceptance.screenReaderTabPanelContract === true
    && acceptance.escapeRestoresLaunchFocus === true
    && accessibilityRowsPassed === 4
    && reviewBoundary.automatedInteractionOnly === true
    && reviewBoundary.humanReviewCompleted === false
    && reviewBoundary.localCompletionIsApproval === false
    && reviewBoundary.broadHumanWordingReviewRequired === true
    && noMutation
    && asString(mutationBoundary.exactSavedShareVerdict) === "MISSING_EVIDENCE";
  return {
    artifact: ARTIFACTS.documentEditorialReviewCockpit,
    verdict: asString(review.verdict),
    sourceHead: asString(review.sourceHead),
    productionCommit: asString(productionBuild.commitSha),
    livePassed: asNumber(review.pass),
    liveFailed: asNumber(review.fail),
    canonicalDocumentCount: asNumber(acceptance.canonicalDocumentCount),
    reviewerCheckCount: asNumber(acceptance.reviewerCheckCount),
    desktopZones: asNumber(acceptance.desktopZones),
    mobileColumns: asNumber(acceptance.mobileColumns),
    keyboardRovingTabNavigation: acceptance.keyboardRovingTabNavigation === true,
    screenReaderTabPanelContract: acceptance.screenReaderTabPanelContract === true,
    escapeRestoresLaunchFocus: acceptance.escapeRestoresLaunchFocus === true,
    accessibilityRowsPassed,
    cockpitReady,
    humanReviewCompleted: reviewBoundary.humanReviewCompleted === true,
    broadHumanWordingReviewRequired: reviewBoundary.broadHumanWordingReviewRequired === true,
    dbMutationPerformed: mutationBoundary.dbMutationPerformed === true,
    providerDispatchCalled: mutationBoundary.providerDispatchCalled === true,
    shareSessionCreated: mutationBoundary.shareSessionCreated === true,
    vectorRuntimeCalled: mutationBoundary.vectorRuntimeCalled === true,
    wikiPublished: mutationBoundary.wikiPublished === true,
    koshaRegistryMutationPerformed: mutationBoundary.koshaRegistryMutationPerformed === true,
    exactSavedShareVerdict: asString(mutationBoundary.exactSavedShareVerdict),
  };
}

/**
 * @param {string} rootDir
 * @param {unknown} buildInfo
 * @param {string} generatedAt
 */
export function buildNorthstarLiveRollup(rootDir, buildInfo, generatedAt = new Date().toISOString()) {
  const currentHead = gitHead(rootDir);
  const liveCommit = isRecord(buildInfo) ? asString(buildInfo.commitSha) : "";
  const openGate = tryReadJson(rootDir, ARTIFACTS.openGate);
  const final99 = tryReadJson(rootDir, ARTIFACTS.final99);
  const final99NoticeCarry = tryReadJson(rootDir, ARTIFACTS.final99NoticeCarry);
  const liveHarness = tryReadJson(rootDir, ARTIFACTS.liveHarness);
  const liveDocumentQualityMatrix = tryReadJson(rootDir, ARTIFACTS.liveDocumentQualityMatrix);
  const liveDocumentQualityStressMatrix = tryReadJson(rootDir, ARTIFACTS.liveDocumentQualityStressMatrix);
  const liveDocumentFieldIsolation = tryReadJson(rootDir, ARTIFACTS.liveDocumentFieldIsolation);
  const liveKoshaExactMaterialization = tryReadJson(rootDir, ARTIFACTS.liveKoshaExactMaterialization);
  const liveDocumentWordingReview = tryReadJson(rootDir, ARTIFACTS.liveDocumentWordingReview);
  const liveDocumentBroadReview = tryReadJson(rootDir, ARTIFACTS.liveDocumentBroadReview);
  const liveDocumentEditorialReview = tryReadJson(rootDir, ARTIFACTS.liveDocumentEditorialReview);
  const documentEditorialReviewCockpit = tryReadJson(rootDir, ARTIFACTS.documentEditorialReviewCockpit);
  const liveDocumentEditorialDuplicateClassification = tryReadJson(rootDir, ARTIFACTS.liveDocumentEditorialDuplicateClassification);
  const liveDocumentEditorialNearClassification = tryReadJson(rootDir, ARTIFACTS.liveDocumentEditorialNearClassification);
  const productCapabilityTruth = tryReadJson(rootDir, ARTIFACTS.productCapabilityTruth);
  const tenantAuthorizationRemediation = tryReadJson(rootDir, ARTIFACTS.tenantAuthorizationRemediation);
  const spreadsheetFormulaNeutralization = tryReadJson(rootDir, ARTIFACTS.spreadsheetFormulaNeutralization);
  const publicProviderWorkBudget = tryReadJson(rootDir, ARTIFACTS.publicProviderWorkBudget);
  const documentExportWorkBudget = tryReadJson(rootDir, ARTIFACTS.documentExportWorkBudget);
  const fullRepositorySecurityScan = tryReadJson(rootDir, ARTIFACTS.fullRepositorySecurityScan);
  const repositorySecurityScanReconciliation = tryReadJson(rootDir, ARTIFACTS.repositorySecurityScanReconciliation);
  const currentSecurityRemediationLedger = tryReadJson(rootDir, ARTIFACTS.currentSecurityRemediationLedger);
  const currentRepositorySecurityRescan = tryReadJson(rootDir, ARTIFACTS.currentRepositorySecurityRescan);
  const agentChatDurableAdmission = tryReadJson(rootDir, ARTIFACTS.agentChatDurableAdmission);
  const mcpProviderAdmission = tryReadJson(rootDir, ARTIFACTS.mcpProviderAdmission);
  const shareRecipientContactVerification = tryReadJson(rootDir, ARTIFACTS.shareRecipientContactVerification);
  const securityAtomicDbRaceApprovalBoundary = tryReadJson(rootDir, ARTIFACTS.securityAtomicDbRaceApprovalBoundary);
  const liveDocumentsShareRoutePerception = tryReadJson(rootDir, ARTIFACTS.liveDocumentsShareRoutePerception);
  const deploymentFreshnessGuard = tryReadJson(rootDir, ARTIFACTS.deploymentFreshnessGuard);
  const publicJsonRequestBodyBudget = tryReadJson(rootDir, ARTIFACTS.publicJsonRequestBodyBudget);
  const improvementPhotoAnalysisBudget = tryReadJson(rootDir, ARTIFACTS.improvementPhotoAnalysisBudget);
  const publicProviderCancellation = tryReadJson(rootDir, ARTIFACTS.publicProviderCancellation);
  const publicProviderAdmission = tryReadJson(rootDir, ARTIFACTS.publicProviderAdmission);
  const publicAskDistributedAdmission = tryReadJson(rootDir, ARTIFACTS.publicAskDistributedAdmission);
  const publicSearchDistributedAdmission = tryReadJson(rootDir, ARTIFACTS.publicSearchDistributedAdmission);
  const publicSearchDistributedRateLimitReadiness = tryReadJson(rootDir, ARTIFACTS.publicSearchDistributedRateLimitReadiness);
  const publicGenerationAdmissionSecurity = tryReadJson(rootDir, ARTIFACTS.publicGenerationAdmissionSecurity);
  const securityFollowupRemediation = tryReadJson(rootDir, ARTIFACTS.securityFollowupRemediation);
  const securityResourceRemediation = tryReadJson(rootDir, ARTIFACTS.securityResourceRemediation);
  const securityUpstreamTransportRemediation = tryReadJson(rootDir, ARTIFACTS.securityUpstreamTransportRemediation);
  const securitySafetyReferenceSurfaceRemediation = tryReadJson(rootDir, ARTIFACTS.securitySafetyReferenceSurfaceRemediation);
  const mcpGenerationWorkBudgetSecurity = tryReadJson(rootDir, ARTIFACTS.mcpGenerationWorkBudgetSecurity);
  const learningExportRendererSecurity = tryReadJson(rootDir, ARTIFACTS.learningExportRendererSecurity);
  const hermesKnowledgeReviewAuthorityUi = tryReadJson(rootDir, ARTIFACTS.hermesKnowledgeReviewAuthorityUi);
  const hermesKnowledgeReviewEvidenceInspector = tryReadJson(rootDir, ARTIFACTS.hermesKnowledgeReviewEvidenceInspector);
  const hermesOpenclawRuntime = tryReadJson(rootDir, ARTIFACTS.hermesOpenclawRuntime);
  const liveDocumentSecondaryGrounding = tryReadJson(rootDir, ARTIFACTS.liveDocumentSecondaryGrounding);
  const liveDocumentSeedProfileIsolation = tryReadJson(rootDir, ARTIFACTS.liveDocumentSeedProfileIsolation);
  const kosha = tryReadJson(rootDir, ARTIFACTS.kosha);
  const rlsWiki = tryReadJson(rootDir, ARTIFACTS.rlsWiki);
  const sifEmbedding = tryReadJson(rootDir, ARTIFACTS.sifEmbedding);
  const liveCritical = tryReadJson(rootDir, ARTIFACTS.liveCritical);
  const mobileP0 = tryReadJson(rootDir, ARTIFACTS.mobileP0);
  const workspaceGeometry = tryReadJson(rootDir, ARTIFACTS.workspaceGeometry);
  const documentAuthoringPaneMargin = tryReadJson(rootDir, ARTIFACTS.documentAuthoringPaneMargin);
  const dispatchStandalone = tryReadJson(rootDir, ARTIFACTS.dispatchStandalone);
  const dispatchStandaloneViewport = tryReadJson(rootDir, ARTIFACTS.dispatchStandaloneViewport);
  const providerDispatchIdempotency = tryReadJson(rootDir, ARTIFACTS.providerDispatchIdempotency);
  const approvalRunway = tryReadJson(rootDir, ARTIFACTS.approvalRunway);

  const openGates = isRecord(openGate) && Array.isArray(openGate.gates) ? openGate.gates : [];
  const provenGates = [];
  const approvalGated = [];
  for (const gate of openGates) {
    if (!isRecord(gate)) {
      continue;
    }
    const id = asString(gate.id);
    const state = asString(gate.state);
    const entry = {
      id,
      state,
      artifact: asString(gate.evidencePath),
      detail: asString(gate.detail),
    };
    if (state === "proven" || state === "notice") {
      provenGates.push(entry);
    }
    if (state === "approval_gated") {
      approvalGated.push(entry);
    }
  }

  const mobileFlow = recordAt(mobileP0, "mobileFlow");
  const documentsSafetyBrief = recordAt(mobileFlow, "documentsSafetyBrief");
  const share = recordAt(mobileFlow, "share");
  const geometryResults = isRecord(workspaceGeometry) && Array.isArray(workspaceGeometry.results)
    ? workspaceGeometry.results
    : [];
  const mobileGeometry = geometryResults.find((row) => isRecord(row) && row.name === "mobile-day");
  const mobileViewport = isRecord(mobileGeometry) ? recordAt(mobileGeometry, "viewport") : null;
  const mobileViewportHeight = asNumber(mobileViewport?.height);
  const mobileDocuments = isRecord(mobileGeometry) ? recordAt(mobileGeometry, "documents") : null;
  const mobileDocumentsBody = mobileDocuments ? recordAt(mobileDocuments, "body") : null;
  const mobileDocumentWorkbench = mobileDocuments ? recordAt(mobileDocuments, "documentWorkbench") : null;
  const mobileShareGeometry = isRecord(mobileGeometry) ? recordAt(mobileGeometry, "share") : null;
  const mobileShareBody = mobileShareGeometry ? recordAt(mobileShareGeometry, "body") : null;
  const mobileSharePreview = mobileShareGeometry ? recordAt(mobileShareGeometry, "sharePreview") : null;
  const geometryDocumentsHeight = asNumber(mobileDocumentsBody?.height);
  const geometryShareHeight = asNumber(mobileShareBody?.height);
  const geometryDocumentsHeightRatio = geometryDocumentsHeight !== null && mobileViewportHeight
    ? Number((geometryDocumentsHeight / mobileViewportHeight).toFixed(2))
    : null;
  const geometryShareHeightRatio = geometryShareHeight !== null && mobileViewportHeight
    ? Number((geometryShareHeight / mobileViewportHeight).toFixed(2))
    : null;
  const liveCriticalRows = isRecord(liveCritical) && Array.isArray(liveCritical.rows) ? liveCritical.rows : [];
  const koshaLiveStatus = recordAt(kosha, "liveStatus");
  const koshaExactTrustRegistry = recordAt(koshaLiveStatus, "exactTrustRegistry");
  const koshaLocalCorpus = recordAt(koshaLiveStatus, "localCorpus");
  const koshaCoveredExactPins = isRecord(kosha) && Array.isArray(kosha.coveredExactPins)
    ? kosha.coveredExactPins
    : [];

  const evidence = [
    evidenceStatus(rootDir, currentHead, liveCommit, "open_gate", ARTIFACTS.openGate, openGate),
    evidenceStatus(rootDir, currentHead, liveCommit, "final_99_gate", ARTIFACTS.final99, final99),
    evidenceStatus(rootDir, currentHead, liveCommit, "live_harness_quality", ARTIFACTS.liveHarness, liveHarness),
    evidenceStatus(rootDir, currentHead, liveCommit, "live_document_quality_matrix", ARTIFACTS.liveDocumentQualityMatrix, liveDocumentQualityMatrix),
    evidenceStatus(rootDir, currentHead, liveCommit, "live_document_quality_stress_matrix", ARTIFACTS.liveDocumentQualityStressMatrix, liveDocumentQualityStressMatrix),
    evidenceStatus(rootDir, currentHead, liveCommit, "live_document_field_isolation", ARTIFACTS.liveDocumentFieldIsolation, liveDocumentFieldIsolation),
    evidenceStatus(rootDir, currentHead, liveCommit, "live_kosha_exact_materialization", ARTIFACTS.liveKoshaExactMaterialization, liveKoshaExactMaterialization),
    evidenceStatus(rootDir, currentHead, liveCommit, "live_document_wording_review", ARTIFACTS.liveDocumentWordingReview, liveDocumentWordingReview),
    evidenceStatus(rootDir, currentHead, liveCommit, "live_document_broad_review", ARTIFACTS.liveDocumentBroadReview, liveDocumentBroadReview),
    evidenceStatus(rootDir, currentHead, liveCommit, "live_document_editorial_review", ARTIFACTS.liveDocumentEditorialReview, liveDocumentEditorialReview),
    evidenceStatus(rootDir, currentHead, liveCommit, "document_editorial_review_cockpit", ARTIFACTS.documentEditorialReviewCockpit, documentEditorialReviewCockpit),
    evidenceStatus(rootDir, currentHead, liveCommit, "live_document_editorial_duplicate_classification", ARTIFACTS.liveDocumentEditorialDuplicateClassification, liveDocumentEditorialDuplicateClassification),
    evidenceStatus(rootDir, currentHead, liveCommit, "live_document_editorial_near_classification", ARTIFACTS.liveDocumentEditorialNearClassification, liveDocumentEditorialNearClassification),
    evidenceStatus(rootDir, currentHead, liveCommit, "product_capability_truth", ARTIFACTS.productCapabilityTruth, productCapabilityTruth),
    evidenceStatus(rootDir, currentHead, liveCommit, "tenant_authorization_remediation", ARTIFACTS.tenantAuthorizationRemediation, tenantAuthorizationRemediation),
    evidenceStatus(rootDir, currentHead, liveCommit, "spreadsheet_formula_neutralization", ARTIFACTS.spreadsheetFormulaNeutralization, spreadsheetFormulaNeutralization),
    evidenceStatus(rootDir, currentHead, liveCommit, "public_provider_work_budget", ARTIFACTS.publicProviderWorkBudget, publicProviderWorkBudget),
    evidenceStatus(rootDir, currentHead, liveCommit, "document_export_work_budget", ARTIFACTS.documentExportWorkBudget, documentExportWorkBudget),
    evidenceStatus(rootDir, currentHead, liveCommit, "full_repository_security_scan", ARTIFACTS.fullRepositorySecurityScan, fullRepositorySecurityScan),
    evidenceStatus(rootDir, currentHead, liveCommit, "repository_security_scan_reconciliation", ARTIFACTS.repositorySecurityScanReconciliation, repositorySecurityScanReconciliation),
    evidenceStatus(rootDir, currentHead, liveCommit, "current_security_remediation_ledger", ARTIFACTS.currentSecurityRemediationLedger, currentSecurityRemediationLedger),
    evidenceStatus(rootDir, currentHead, liveCommit, "current_repository_security_rescan", ARTIFACTS.currentRepositorySecurityRescan, currentRepositorySecurityRescan),
    evidenceStatus(rootDir, currentHead, liveCommit, "agent_chat_durable_admission_security", ARTIFACTS.agentChatDurableAdmission, agentChatDurableAdmission),
    evidenceStatus(rootDir, currentHead, liveCommit, "mcp_provider_admission_security", ARTIFACTS.mcpProviderAdmission, mcpProviderAdmission),
    evidenceStatus(rootDir, currentHead, liveCommit, "share_recipient_contact_verification_security", ARTIFACTS.shareRecipientContactVerification, shareRecipientContactVerification),
    evidenceStatus(rootDir, currentHead, liveCommit, "security_atomic_db_race_remediation", ARTIFACTS.securityAtomicDbRaceApprovalBoundary, securityAtomicDbRaceApprovalBoundary),
    evidenceStatus(rootDir, currentHead, liveCommit, "live_documents_share_route_perception", ARTIFACTS.liveDocumentsShareRoutePerception, liveDocumentsShareRoutePerception),
    evidenceStatus(rootDir, currentHead, liveCommit, "deployment_freshness_guard", ARTIFACTS.deploymentFreshnessGuard, deploymentFreshnessGuard),
    evidenceStatus(rootDir, currentHead, liveCommit, "public_json_request_body_budget", ARTIFACTS.publicJsonRequestBodyBudget, publicJsonRequestBodyBudget),
    evidenceStatus(rootDir, currentHead, liveCommit, "improvement_photo_analysis_budget", ARTIFACTS.improvementPhotoAnalysisBudget, improvementPhotoAnalysisBudget),
    evidenceStatus(rootDir, currentHead, liveCommit, "public_provider_cancellation", ARTIFACTS.publicProviderCancellation, publicProviderCancellation),
    evidenceStatus(rootDir, currentHead, liveCommit, "public_provider_admission", ARTIFACTS.publicProviderAdmission, publicProviderAdmission),
    evidenceStatus(rootDir, currentHead, liveCommit, "public_ask_distributed_admission", ARTIFACTS.publicAskDistributedAdmission, publicAskDistributedAdmission),
    evidenceStatus(rootDir, currentHead, liveCommit, "public_search_distributed_admission", ARTIFACTS.publicSearchDistributedAdmission, publicSearchDistributedAdmission),
    evidenceStatus(rootDir, currentHead, liveCommit, "public_search_distributed_rate_limit_readiness", ARTIFACTS.publicSearchDistributedRateLimitReadiness, publicSearchDistributedRateLimitReadiness),
    evidenceStatus(rootDir, currentHead, liveCommit, "public_generation_admission_security", ARTIFACTS.publicGenerationAdmissionSecurity, publicGenerationAdmissionSecurity),
    evidenceStatus(rootDir, currentHead, liveCommit, "security_followup_remediation", ARTIFACTS.securityFollowupRemediation, securityFollowupRemediation),
    evidenceStatus(rootDir, currentHead, liveCommit, "security_resource_remediation", ARTIFACTS.securityResourceRemediation, securityResourceRemediation),
    evidenceStatus(rootDir, currentHead, liveCommit, "security_upstream_transport_remediation", ARTIFACTS.securityUpstreamTransportRemediation, securityUpstreamTransportRemediation),
    evidenceStatus(rootDir, currentHead, liveCommit, "security_safety_reference_surface_remediation", ARTIFACTS.securitySafetyReferenceSurfaceRemediation, securitySafetyReferenceSurfaceRemediation),
    evidenceStatus(rootDir, currentHead, liveCommit, "mcp_generation_work_budget_security", ARTIFACTS.mcpGenerationWorkBudgetSecurity, mcpGenerationWorkBudgetSecurity),
    evidenceStatus(rootDir, currentHead, liveCommit, "learning_export_renderer_security", ARTIFACTS.learningExportRendererSecurity, learningExportRendererSecurity),
    evidenceStatus(rootDir, currentHead, liveCommit, "hermes_knowledge_review_ui", ARTIFACTS.hermesKnowledgeReviewAuthorityUi, hermesKnowledgeReviewAuthorityUi),
    evidenceStatus(rootDir, currentHead, liveCommit, "hermes_review_evidence_inspector", ARTIFACTS.hermesKnowledgeReviewEvidenceInspector, hermesKnowledgeReviewEvidenceInspector),
    evidenceStatus(rootDir, currentHead, liveCommit, "hermes_remote_durable_ledger", ARTIFACTS.hermesOpenclawRuntime, hermesOpenclawRuntime),
    evidenceStatus(rootDir, currentHead, liveCommit, "live_document_secondary_grounding", ARTIFACTS.liveDocumentSecondaryGrounding, liveDocumentSecondaryGrounding),
    evidenceStatus(rootDir, currentHead, liveCommit, "live_document_seed_profile_isolation", ARTIFACTS.liveDocumentSeedProfileIsolation, liveDocumentSeedProfileIsolation),
    evidenceStatus(rootDir, currentHead, liveCommit, "kosha_exact_trust_registry", ARTIFACTS.kosha, kosha),
    evidenceStatus(rootDir, currentHead, liveCommit, "rls_llm_wiki_approval_preflight", ARTIFACTS.rlsWiki, rlsWiki),
    evidenceStatus(rootDir, currentHead, liveCommit, "sif_embedding_preflight", ARTIFACTS.sifEmbedding, sifEmbedding),
    evidenceStatus(rootDir, currentHead, liveCommit, "live_critical_surface", ARTIFACTS.liveCritical, liveCritical),
    evidenceStatus(rootDir, currentHead, liveCommit, "mobile_p0_workspace", ARTIFACTS.mobileP0, mobileP0),
    evidenceStatus(rootDir, currentHead, liveCommit, "workspace_docs_share_geometry", ARTIFACTS.workspaceGeometry, workspaceGeometry),
    evidenceStatus(rootDir, currentHead, liveCommit, "document_authoring_pane_margin", ARTIFACTS.documentAuthoringPaneMargin, documentAuthoringPaneMargin),
    evidenceStatus(rootDir, currentHead, liveCommit, "dispatch_standalone_cockpit", ARTIFACTS.dispatchStandalone, dispatchStandalone),
    evidenceStatus(rootDir, currentHead, liveCommit, "dispatch_standalone_viewport_companion", ARTIFACTS.dispatchStandaloneViewport, dispatchStandaloneViewport),
    evidenceStatus(rootDir, currentHead, liveCommit, "provider_dispatch_persistence", ARTIFACTS.providerDispatchIdempotency, providerDispatchIdempotency),
    evidenceStatus(rootDir, currentHead, liveCommit, "northstar_approval_runway", ARTIFACTS.approvalRunway, approvalRunway),
  ];

  const contradictions = evidence.filter((item) => (
    item.sourceStatus === "not_ancestor" || item.productionStatus === "not_ancestor"
  ));

  const final99Notices = isRecord(final99NoticeCarry) && Array.isArray(final99NoticeCarry.notices)
    ? final99NoticeCarry.notices.filter(isRecord).map((notice) => ({
      gate: asString(notice.gate),
      launchImpact: asString(notice.launchImpact),
      allowedClaim: asString(notice.allowedClaim),
      forbiddenClaim: asString(notice.forbiddenClaim),
    }))
    : [];

  return {
    schemaVersion: SCHEMA_VERSION,
    generatedAt,
    head: currentHead,
    liveBuildInfo: buildInfo,
    overall: contradictions.length > 0
      ? "northstar_evidence_contradicted"
      : isRecord(openGate) && openGate.overall === "open"
        ? "northstar_open_approval_gated"
        : "northstar_evidence_missing_or_unknown",
    dbMutationPerformed: false,
    launchReadiness: false,
    openGate: {
      artifact: ARTIFACTS.openGate,
      overall: isRecord(openGate) ? asString(openGate.overall) : "missing",
      gateCount: openGates.length,
    },
    provenGates,
    approvalGated,
    mobileP0: {
      artifact: ARTIFACTS.mobileP0,
      verdict: isRecord(mobileP0) ? asString(mobileP0.verdict) : "missing",
      productionCommit: extractProductionCommit(mobileP0),
      currentGeometryArtifact: ARTIFACTS.workspaceGeometry,
      currentGeometryCommit: extractProductionCommit(workspaceGeometry),
      documentsHeightRatio: geometryDocumentsHeightRatio ?? (documentsSafetyBrief ? asNumber(documentsSafetyBrief.heightRatio) : null),
      documentsBodyHeight: geometryDocumentsHeight,
      documentsViewportHeight: mobileViewportHeight,
      documentWorkbenchBottom: asNumber(mobileDocumentWorkbench?.bottom),
      firstUsefulReviewY: asNumber(mobileDocumentWorkbench?.y) ?? (documentsSafetyBrief ? asNumber(documentsSafetyBrief.firstUsefulReviewY) : null),
      documentDeepReviewOpen: mobileDocuments ? mobileDocuments.documentDeepReviewOpen === true : documentsSafetyBrief ? documentsSafetyBrief.documentDeepReviewOpen === true : null,
      visibleDocumentPreviews: mobileDocuments ? asNumber(mobileDocuments.visibleDocumentPreviews) : documentsSafetyBrief ? asNumber(documentsSafetyBrief.visibleDocumentPreviews) : null,
      shareHeightRatio: geometryShareHeightRatio ?? (share ? asNumber(share.heightRatio) : null),
      shareBodyHeight: geometryShareHeight,
      shareViewportHeight: mobileViewportHeight,
      shareRootBottom: asNumber(recordAt(mobileShareGeometry, "shareRoot")?.bottom),
      sharePreviewBottom: asNumber(mobileSharePreview?.bottom),
      sharePreviewY: asNumber(mobileSharePreview?.y) ?? (share ? asNumber(share.messagePreviewY) : null),
      hardBlockersClosed: isRecord(mobileP0) ? mobileP0.hardBlockersClosed === true : false,
    },
    liveCritical: {
      artifact: ARTIFACTS.liveCritical,
      productionCommit: extractProductionCommit(liveCritical),
      findings: isRecord(liveCritical) && Array.isArray(liveCritical.findings) ? liveCritical.findings.length : null,
      rowsChecked: liveCriticalRows.length,
    },
    workspaceGeometry: {
      artifact: ARTIFACTS.workspaceGeometry,
      productionCommit: extractProductionCommit(workspaceGeometry),
      mobileDocumentDeepReviewOpen: mobileDocuments ? mobileDocuments.documentDeepReviewOpen === true : null,
      mobileVisibleDocumentPreviews: mobileDocuments ? asNumber(mobileDocuments.visibleDocumentPreviews) : null,
    },
    documentAuthoringPaneMargin: {
      artifact: ARTIFACTS.documentAuthoringPaneMargin,
      verdict: isRecord(documentAuthoringPaneMargin) ? asString(documentAuthoringPaneMargin.verdict) : "missing",
      productCommit: isRecord(documentAuthoringPaneMargin) ? asString(documentAuthoringPaneMargin.productCommit) : "",
      productionCommit: isRecord(documentAuthoringPaneMargin) ? asString(documentAuthoringPaneMargin.productionCommit) : "",
      sourceHeadMatchesProduction: isRecord(documentAuthoringPaneMargin) && documentAuthoringPaneMargin.sourceHeadMatchesProduction === true,
      beforeBelowMargin: asNumber(recordAt(documentAuthoringPaneMargin, "beforeLive")?.paneMarginBelow16Count),
      liveBelowMargin: asNumber(recordAt(documentAuthoringPaneMargin, "afterLive")?.paneMarginBelow16Count),
      liveMinimumMargin: asNumber(recordAt(documentAuthoringPaneMargin, "afterLive")?.minimumPaneMargin),
      liveMaximumShellRatio: asNumber(recordAt(documentAuthoringPaneMargin, "afterLive")?.maximumShellRatio),
      exactSavedShareVerdict: asString(recordAt(documentAuthoringPaneMargin, "remainingBoundaries")?.exactSavedShareVerdict),
    },
    dispatchStandaloneCockpit: {
      artifact: ARTIFACTS.dispatchStandalone,
      verdict: isRecord(dispatchStandalone) ? asString(dispatchStandalone.verdict) : "missing",
      pageHeight: asNumber(recordAt(dispatchStandalone, "metrics")?.pageHeight),
      heightRatio: asNumber(recordAt(dispatchStandalone, "metrics")?.heightRatio),
      rootWidth: asNumber(recordAt(dispatchStandalone, "metrics")?.rootWidth),
      rootHeight: asNumber(recordAt(dispatchStandalone, "metrics")?.rootHeight),
      previewBottom: asNumber(recordAt(dispatchStandalone, "metrics")?.previewBottom),
      primaryBottom: asNumber(recordAt(dispatchStandalone, "metrics")?.primaryBottom),
      horizontalOverflow: asNumber(recordAt(dispatchStandalone, "metrics")?.horizontalOverflow),
      viewportCompanionArtifact: ARTIFACTS.dispatchStandaloneViewport,
      viewportCompanionVerdict: isRecord(dispatchStandaloneViewport) ? asString(dispatchStandaloneViewport.verdict) : "missing",
      desktopShort: recordAt(recordAt(dispatchStandaloneViewport, "afterLive"), "desktopShort"),
      mobileShortDay: recordAt(recordAt(dispatchStandaloneViewport, "afterLive"), "mobileShortDay"),
      mobileShortNight: recordAt(recordAt(dispatchStandaloneViewport, "afterLive"), "mobileShortNight"),
      exactSavedShareVerdict: asString(recordAt(dispatchStandaloneViewport, "remainingBoundaries")?.exactSavedShareVerdict),
    },
    fullRepositorySecurityScan: {
      artifact: ARTIFACTS.fullRepositorySecurityScan,
      verdict: isRecord(fullRepositorySecurityScan) ? asString(fullRepositorySecurityScan.verdict) : "missing",
      sourceHead: isRecord(fullRepositorySecurityScan) ? asString(fullRepositorySecurityScan.sourceHead) : "",
      productionCommit: isRecord(fullRepositorySecurityScan) && isRecord(fullRepositorySecurityScan.productionBuild)
        ? asString(fullRepositorySecurityScan.productionBuild.commitSha)
        : "",
      completeness: isRecord(fullRepositorySecurityScan) && isRecord(fullRepositorySecurityScan.scan)
        ? asString(fullRepositorySecurityScan.scan.completeness)
        : "",
      fileCount: isRecord(fullRepositorySecurityScan) && isRecord(fullRepositorySecurityScan.scan)
        ? asNumber(fullRepositorySecurityScan.scan.fileCount)
        : null,
      reportableFindingCount: isRecord(fullRepositorySecurityScan) && isRecord(fullRepositorySecurityScan.scan)
        ? asNumber(fullRepositorySecurityScan.scan.reportableFindingCount)
        : null,
      deferredCandidateCount: isRecord(fullRepositorySecurityScan) && isRecord(fullRepositorySecurityScan.scan)
        ? asNumber(fullRepositorySecurityScan.scan.deferredCandidateCount)
        : null,
      medium: isRecord(fullRepositorySecurityScan)
        && isRecord(fullRepositorySecurityScan.scan)
        && isRecord(fullRepositorySecurityScan.scan.severity)
        ? asNumber(fullRepositorySecurityScan.scan.severity.medium)
        : null,
      low: isRecord(fullRepositorySecurityScan)
        && isRecord(fullRepositorySecurityScan.scan)
        && isRecord(fullRepositorySecurityScan.scan.severity)
        ? asNumber(fullRepositorySecurityScan.scan.severity.low)
        : null,
      securityCompleteClaimAllowed: isRecord(fullRepositorySecurityScan)
        && isRecord(fullRepositorySecurityScan.remainingBoundaries)
        ? fullRepositorySecurityScan.remainingBoundaries.securityCompleteClaimAllowed === true
        : null,
      distributedRateLimitResidual: isRecord(fullRepositorySecurityScan)
        && isRecord(fullRepositorySecurityScan.remainingBoundaries)
        ? fullRepositorySecurityScan.remainingBoundaries.distributedRateLimitResidual === true
        : null,
      exactSavedShareVerdict: isRecord(fullRepositorySecurityScan)
        && isRecord(fullRepositorySecurityScan.remainingBoundaries)
        ? asString(fullRepositorySecurityScan.remainingBoundaries.exactSavedShareVerdict)
        : "",
    },
    repositorySecurityScanReconciliation: {
      artifact: ARTIFACTS.repositorySecurityScanReconciliation,
      verdict: isRecord(repositorySecurityScanReconciliation) ? asString(repositorySecurityScanReconciliation.verdict) : "missing",
      targetRevision: isRecord(repositorySecurityScanReconciliation) ? asString(repositorySecurityScanReconciliation.targetRevision) : "",
      conflictingScanCount: isRecord(repositorySecurityScanReconciliation) && Array.isArray(repositorySecurityScanReconciliation.scans)
        ? repositorySecurityScanReconciliation.scans.length
        : null,
      findingCountDelta: asNumber(recordAt(repositorySecurityScanReconciliation, "sameTargetConflict")?.findingCountDelta),
      zeroFindingClaimAccepted: recordAt(repositorySecurityScanReconciliation, "sameTargetConflict")?.zeroFindingClaimAcceptedForNorthstar === true,
      receiptContradictionCount: isRecord(repositorySecurityScanReconciliation) && Array.isArray(repositorySecurityScanReconciliation.canonicalReceiptContradictions)
        ? repositorySecurityScanReconciliation.canonicalReceiptContradictions.length
        : null,
      laterDeferredCandidateCount: asNumber(recordAt(repositorySecurityScanReconciliation, "laterSecurityChain")?.deferredCandidateCount),
      correctedFreshScanRequired: recordAt(repositorySecurityScanReconciliation, "requiredResolution")?.correctedFreshFullRepositoryScanRequired === true,
      correctedFreshScanCompleted: recordAt(repositorySecurityScanReconciliation, "requiredResolution")?.correctedFreshFullRepositoryScanCompleted === true,
      correctedScanId: asString(recordAt(repositorySecurityScanReconciliation, "correctedFreshScan")?.scanId),
      correctedTargetRevision: asString(recordAt(repositorySecurityScanReconciliation, "correctedFreshScan")?.targetRevision),
      correctedReportableFindingCount: asNumber(recordAt(repositorySecurityScanReconciliation, "correctedFreshScan")?.reportableFindingCount),
      correctedDeferredCandidateCount: asNumber(recordAt(repositorySecurityScanReconciliation, "correctedFreshScan")?.deferredCandidateCount),
      correctedCoverageCompleteness: asString(recordAt(repositorySecurityScanReconciliation, "correctedFreshScan")?.coverageCompleteness),
      securityCompleteClaimAllowed: recordAt(repositorySecurityScanReconciliation, "correctedFreshScan")?.securityCompleteClaimAllowed === true,
      exactSavedShareVerdict: asString(recordAt(repositorySecurityScanReconciliation, "boundaries")?.exactSavedShareVerdict),
    },
    currentSecurityRemediationLedger: {
      artifact: ARTIFACTS.currentSecurityRemediationLedger,
      verdict: isRecord(currentSecurityRemediationLedger) ? asString(currentSecurityRemediationLedger.verdict) : "missing",
      sourceHead: isRecord(currentSecurityRemediationLedger) ? asString(currentSecurityRemediationLedger.sourceHead) : "",
      productionCommit: asString(recordAt(currentSecurityRemediationLedger, "productionBuild")?.commitSha),
      totalFindings: asNumber(recordAt(currentSecurityRemediationLedger, "findingDisposition")?.total),
      deployedSourceRemediationCount: asNumber(recordAt(currentSecurityRemediationLedger, "findingDisposition")?.deployedSourceRemediationCount),
      unresolvedCount: asNumber(recordAt(currentSecurityRemediationLedger, "findingDisposition")?.unresolvedCount),
      approvalGatedCount: asNumber(recordAt(currentSecurityRemediationLedger, "findingDisposition")?.approvalGatedCount),
      distributedRuntimeOpenCount: asNumber(recordAt(currentSecurityRemediationLedger, "findingDisposition")?.distributedRuntimeOpenCount),
      securityCompleteClaimAllowed: recordAt(currentSecurityRemediationLedger, "remainingBoundaries")?.securityCompleteClaimAllowed === true,
      exactSavedShareVerdict: asString(recordAt(currentSecurityRemediationLedger, "remainingBoundaries")?.exactSavedShareVerdict),
    },
    currentRepositorySecurityRescan: {
      artifact: ARTIFACTS.currentRepositorySecurityRescan,
      verdict: isRecord(currentRepositorySecurityRescan) ? asString(currentRepositorySecurityRescan.verdict) : "missing",
      scanId: isRecord(currentRepositorySecurityRescan) ? asString(currentRepositorySecurityRescan.scanId) : "",
      scanRevision: isRecord(currentRepositorySecurityRescan) ? asString(currentRepositorySecurityRescan.scanRevision) : "",
      productCommit: isRecord(currentRepositorySecurityRescan) ? asString(currentRepositorySecurityRescan.productCommit) : "",
      productionCommit: isRecord(currentRepositorySecurityRescan) ? asString(currentRepositorySecurityRescan.productionCommit) : "",
      originalBaselineFindingCount: asNumber(isRecord(currentRepositorySecurityRescan) ? currentRepositorySecurityRescan.immutableOriginalBaselineFindingCount : null),
      freshReportableFindingCount: asNumber(isRecord(currentRepositorySecurityRescan) ? currentRepositorySecurityRescan.freshReportableFindingCount : null),
      liveRemediatedCount: asNumber(isRecord(currentRepositorySecurityRescan) ? currentRepositorySecurityRescan.approvalFreeRemediatedCount : null),
      databaseApprovalGatedRemainingCount: asNumber(isRecord(currentRepositorySecurityRescan) ? currentRepositorySecurityRescan.approvalGatedRemainingCount : null),
      focusedTestFiles: asNumber(recordAt(recordAt(currentRepositorySecurityRescan, "verification"), "focusedTests")?.files),
      focusedTestCount: asNumber(recordAt(recordAt(currentRepositorySecurityRescan, "verification"), "focusedTests")?.tests),
      focusedTestStatus: asString(recordAt(recordAt(currentRepositorySecurityRescan, "verification"), "focusedTests")?.status),
      typecheck: asString(recordAt(currentRepositorySecurityRescan, "verification")?.typecheck),
      build: asString(recordAt(recordAt(currentRepositorySecurityRescan, "verification"), "build")?.status),
      exactSavedShareVerdict: asString(recordAt(currentRepositorySecurityRescan, "remainingBoundaries")?.exactSavedShareVerdict),
      databaseSecurityRemediation: asString(recordAt(currentRepositorySecurityRescan, "remainingBoundaries")?.databaseSecurityRemediation),
      liveAfterDeploymentRequired: recordAt(currentRepositorySecurityRescan, "remainingBoundaries")?.liveAfterDeploymentRequired === true,
    },
    publicSearchDistributedRateLimitReadiness: {
      artifact: ARTIFACTS.publicSearchDistributedRateLimitReadiness,
      verdict: isRecord(publicSearchDistributedRateLimitReadiness)
        ? asString(publicSearchDistributedRateLimitReadiness.verdict)
        : "missing",
      sourceHead: isRecord(publicSearchDistributedRateLimitReadiness)
        ? asString(publicSearchDistributedRateLimitReadiness.sourceHead)
        : "",
      productionCommit: isRecord(publicSearchDistributedRateLimitReadiness)
        && isRecord(publicSearchDistributedRateLimitReadiness.productionBuild)
        ? asString(publicSearchDistributedRateLimitReadiness.productionBuild.commitSha)
        : "",
      productionModeVerified: recordAt(publicSearchDistributedRateLimitReadiness, "configuration")?.productionModeVerified === true,
      observedMode: asString(recordAt(publicSearchDistributedRateLimitReadiness, "configuration")?.observedMode),
      distributedActivationPending: recordAt(publicSearchDistributedRateLimitReadiness, "configuration")?.distributedActivationPending === true,
      sealedFindingsClosedWithoutRescan: recordAt(publicSearchDistributedRateLimitReadiness, "boundary")?.sealedFindingsClosedWithoutRescan === true,
      remainingDbRlsFindings: asNumber(recordAt(publicSearchDistributedRateLimitReadiness, "boundary")?.remainingDbRlsFindings),
      exactSavedShareVerdict: asString(recordAt(publicSearchDistributedRateLimitReadiness, "boundary")?.exactSavedShareVerdict),
    },
    publicGenerationAdmissionSecurity: {
      artifact: ARTIFACTS.publicGenerationAdmissionSecurity,
      verdict: isRecord(publicGenerationAdmissionSecurity)
        ? asString(publicGenerationAdmissionSecurity.verdict)
        : "missing",
      productCommit: isRecord(publicGenerationAdmissionSecurity)
        ? asString(publicGenerationAdmissionSecurity.productCommit)
        : "",
      productionCommit: isRecord(publicGenerationAdmissionSecurity)
        ? asString(publicGenerationAdmissionSecurity.productionCommit)
        : "",
      liveMode: asString(recordAt(publicGenerationAdmissionSecurity, "runtimeBoundary")?.liveMode),
      distributedHardeningOpen: recordAt(publicGenerationAdmissionSecurity, "runtimeBoundary")?.distributedProductionHardeningOpen === true,
      freshRescanRequired: recordAt(publicGenerationAdmissionSecurity, "remainingBoundaries")?.freshPostChangeSecurityRescanRequired === true,
      vulnerabilityCount: asNumber(recordAt(recordAt(publicGenerationAdmissionSecurity, "verification"), "npmAudit")?.vulnerabilityCount),
      exactSavedShareVerdict: asString(recordAt(publicGenerationAdmissionSecurity, "remainingBoundaries")?.exactSavedShareVerdict),
    },
    securityFollowupRemediation: {
      artifact: ARTIFACTS.securityFollowupRemediation,
      verdict: isRecord(securityFollowupRemediation) ? asString(securityFollowupRemediation.verdict) : "missing",
      sourceHead: isRecord(securityFollowupRemediation) ? asString(securityFollowupRemediation.sourceHead) : "",
      productionCommit: asString(recordAt(securityFollowupRemediation, "deployment")?.productionCommit),
      sealedFindingCount: asNumber(recordAt(securityFollowupRemediation, "securityScan")?.sealedFindingCount),
      immutableOriginalBaselineFindingCount: asNumber(recordAt(securityFollowupRemediation, "securityScan")?.immutableOriginalBaselineFindingCount),
      deferredCandidateCount: asNumber(recordAt(securityFollowupRemediation, "securityScan")?.deferredCandidateCount),
      focusedTests: asNumber(recordAt(recordAt(securityFollowupRemediation, "verification"), "focusedVitest")?.tests),
      liveProviderCancellationProbeExecuted: recordAt(securityFollowupRemediation, "deployment")?.liveProviderCancellationProbeExecuted === true,
      remainingSecurityWorkCount: isRecord(securityFollowupRemediation) && Array.isArray(securityFollowupRemediation.remainingSecurityWork)
        ? securityFollowupRemediation.remainingSecurityWork.length
        : null,
      originalBaselineRewritten: recordAt(securityFollowupRemediation, "boundaries")?.originalBaselineRewritten === true,
      exactSavedShareVerdict: asString(recordAt(securityFollowupRemediation, "boundaries")?.exactSavedShareVerdict),
    },
    securityResourceRemediation: {
      artifact: ARTIFACTS.securityResourceRemediation,
      verdict: isRecord(securityResourceRemediation) ? asString(securityResourceRemediation.verdict) : "missing",
      sourceHead: isRecord(securityResourceRemediation) ? asString(securityResourceRemediation.sourceHead) : "",
      productionCommit: isRecord(securityResourceRemediation) ? asString(securityResourceRemediation.productionCommit) : "",
      scanFindingCount: asNumber(recordAt(securityResourceRemediation, "sourceScan")?.findingCount),
      remediatedFindingCount: isRecord(securityResourceRemediation) && Array.isArray(securityResourceRemediation.remediatedFindings)
        ? securityResourceRemediation.remediatedFindings.length
        : null,
      remainingScanFindings: asNumber(recordAt(securityResourceRemediation, "remainingBoundaries")?.remainingScanFindings),
      exactSavedShareVerdict: asString(recordAt(securityResourceRemediation, "remainingBoundaries")?.exactSavedShareVerdict),
      providerDispatchPersistence: asString(recordAt(securityResourceRemediation, "remainingBoundaries")?.providerDispatchPersistence),
    },
    securityUpstreamTransportRemediation: {
      artifact: ARTIFACTS.securityUpstreamTransportRemediation,
      verdict: isRecord(securityUpstreamTransportRemediation) ? asString(securityUpstreamTransportRemediation.verdict) : "missing",
      sourceHead: isRecord(securityUpstreamTransportRemediation) ? asString(securityUpstreamTransportRemediation.sourceHead) : "",
      productionCommit: isRecord(securityUpstreamTransportRemediation) ? asString(securityUpstreamTransportRemediation.productionCommit) : "",
      scanFindingCount: asNumber(recordAt(securityUpstreamTransportRemediation, "sourceScan")?.findingCount),
      remediatedThisWave: asNumber(recordAt(securityUpstreamTransportRemediation, "cumulativeRemediation")?.remediatedThisWave),
      remediatedTotal: asNumber(recordAt(securityUpstreamTransportRemediation, "cumulativeRemediation")?.remediatedTotal),
      remainingScanFindings: asNumber(recordAt(securityUpstreamTransportRemediation, "remainingBoundaries")?.remainingScanFindings),
      externalProviderProbeExecuted: recordAt(recordAt(securityUpstreamTransportRemediation, "liveChecks"), "externalProviderProbe")?.executed === true,
      exactSavedShareVerdict: asString(recordAt(securityUpstreamTransportRemediation, "remainingBoundaries")?.exactSavedShareVerdict),
      providerDispatchPersistence: asString(recordAt(securityUpstreamTransportRemediation, "remainingBoundaries")?.providerDispatchPersistence),
    },
    securitySafetyReferenceSurfaceRemediation: {
      artifact: ARTIFACTS.securitySafetyReferenceSurfaceRemediation,
      verdict: isRecord(securitySafetyReferenceSurfaceRemediation) ? asString(securitySafetyReferenceSurfaceRemediation.verdict) : "missing",
      sourceHead: isRecord(securitySafetyReferenceSurfaceRemediation) ? asString(securitySafetyReferenceSurfaceRemediation.sourceHead) : "",
      productionCommit: isRecord(securitySafetyReferenceSurfaceRemediation) ? asString(securitySafetyReferenceSurfaceRemediation.productionCommit) : "",
      findingId: asString(recordAt(securitySafetyReferenceSurfaceRemediation, "remediatedFinding")?.findingId),
      scanFindingCount: asNumber(recordAt(securitySafetyReferenceSurfaceRemediation, "sourceScan")?.findingCount),
      remediatedThisWave: asNumber(recordAt(securitySafetyReferenceSurfaceRemediation, "cumulativeRemediation")?.remediatedThisWave),
      remediatedTotal: asNumber(recordAt(securitySafetyReferenceSurfaceRemediation, "cumulativeRemediation")?.remediatedTotal),
      remainingScanFindings: asNumber(recordAt(securitySafetyReferenceSurfaceRemediation, "remainingBoundaries")?.remainingScanFindings),
      liveReturnedItems: asNumber(recordAt(recordAt(securitySafetyReferenceSurfaceRemediation, "liveChecks"), "publicSafetyReferenceSearch")?.returnedItems),
      publicBodyFieldCount: asNumber(recordAt(recordAt(securitySafetyReferenceSurfaceRemediation, "liveChecks"), "publicSafetyReferenceSearch")?.bodyFieldCount),
      publicPayloadFieldCount: asNumber(recordAt(recordAt(securitySafetyReferenceSurfaceRemediation, "liveChecks"), "publicSafetyReferenceSearch")?.payloadFieldCount),
      publicMetadataFieldCount: asNumber(recordAt(recordAt(securitySafetyReferenceSurfaceRemediation, "liveChecks"), "publicSafetyReferenceSearch")?.metadataFieldCount),
      rateLimitMode: asString(recordAt(recordAt(securitySafetyReferenceSurfaceRemediation, "liveChecks"), "publicSafetyReferenceSearch")?.rateLimitMode),
      exactSavedShareVerdict: asString(recordAt(securitySafetyReferenceSurfaceRemediation, "remainingBoundaries")?.exactSavedShareVerdict),
      providerDispatchPersistence: asString(recordAt(securitySafetyReferenceSurfaceRemediation, "remainingBoundaries")?.providerDispatchPersistence),
    },
    publicJsonRequestBodyBudget: {
      artifact: ARTIFACTS.publicJsonRequestBodyBudget,
      verdict: isRecord(publicJsonRequestBodyBudget) ? asString(publicJsonRequestBodyBudget.verdict) : "missing",
      sourceHead: isRecord(publicJsonRequestBodyBudget) ? asString(publicJsonRequestBodyBudget.sourceHead) : "",
      productionCommit: isRecord(publicJsonRequestBodyBudget) ? asString(publicJsonRequestBodyBudget.productionCommit) : "",
      findingId: asString(recordAt(publicJsonRequestBodyBudget, "scan")?.findingId),
      liveCaseCount: Array.isArray(recordAt(publicJsonRequestBodyBudget, "liveVerification")?.cases)
        ? recordAt(publicJsonRequestBodyBudget, "liveVerification")?.cases.length
        : 0,
      followUpSecurityScan: asString(recordAt(publicJsonRequestBodyBudget, "remainingBoundaries")?.followUpSecurityScan),
      securityCompleteClaimAllowed: recordAt(publicJsonRequestBodyBudget, "remainingBoundaries")?.securityCompleteClaimAllowed === true,
      exactSavedShareVerdict: asString(recordAt(publicJsonRequestBodyBudget, "remainingBoundaries")?.exactSavedShareVerdict),
    },
    improvementPhotoAnalysisBudget: {
      artifact: ARTIFACTS.improvementPhotoAnalysisBudget,
      verdict: isRecord(improvementPhotoAnalysisBudget) ? asString(improvementPhotoAnalysisBudget.verdict) : "missing",
      sourceHead: isRecord(improvementPhotoAnalysisBudget) ? asString(improvementPhotoAnalysisBudget.sourceHead) : "",
      productionCommit: isRecord(improvementPhotoAnalysisBudget) ? asString(improvementPhotoAnalysisBudget.productionCommit) : "",
      findingId: asString(recordAt(improvementPhotoAnalysisBudget, "scan")?.findingId),
      maxRequestBytes: asNumber(recordAt(improvementPhotoAnalysisBudget, "budgets")?.maxRequestBytes),
      aggregateConcurrency: asNumber(recordAt(improvementPhotoAnalysisBudget, "budgets")?.aggregateConcurrency),
      liveCaseCount: Array.isArray(recordAt(improvementPhotoAnalysisBudget, "liveVerification")?.cases)
        ? recordAt(improvementPhotoAnalysisBudget, "liveVerification")?.cases.length
        : 0,
      distributedProductionActivation: asString(recordAt(improvementPhotoAnalysisBudget, "remainingBoundaries")?.distributedProductionActivation),
      followUpSecurityScan: asString(recordAt(improvementPhotoAnalysisBudget, "remainingBoundaries")?.followUpSecurityScan),
      securityCompleteClaimAllowed: recordAt(improvementPhotoAnalysisBudget, "remainingBoundaries")?.securityCompleteClaimAllowed === true,
      exactSavedShareVerdict: asString(recordAt(improvementPhotoAnalysisBudget, "remainingBoundaries")?.exactSavedShareVerdict),
    },
    publicProviderCancellation: {
      artifact: ARTIFACTS.publicProviderCancellation,
      verdict: isRecord(publicProviderCancellation) ? asString(publicProviderCancellation.verdict) : "missing",
      sourceHead: isRecord(publicProviderCancellation) ? asString(publicProviderCancellation.sourceHead) : "",
      productionCommit: asString(recordAt(publicProviderCancellation, "productionBuild")?.commitSha),
      findingId: asString(recordAt(publicProviderCancellation, "securityFinding")?.findingId),
      tests: asNumber(recordAt(recordAt(publicProviderCancellation, "verification"), "focusedAndAdjacentVitest")?.tests),
      liveProviderCallExecuted: recordAt(publicProviderCancellation, "productionBuild")?.liveProviderCallExecuted === true,
      followUpSecurityScan: asString(recordAt(publicProviderCancellation, "remainingBoundaries")?.followUpSecurityScan),
      securityCompleteClaimAllowed: recordAt(publicProviderCancellation, "remainingBoundaries")?.securityCompleteClaimAllowed === true,
      exactSavedShareVerdict: asString(recordAt(publicProviderCancellation, "remainingBoundaries")?.exactSavedShareVerdict),
    },
    publicProviderAdmission: {
      artifact: ARTIFACTS.publicProviderAdmission,
      verdict: isRecord(publicProviderAdmission) ? asString(publicProviderAdmission.verdict) : "missing",
      sourceHead: isRecord(publicProviderAdmission) ? asString(publicProviderAdmission.sourceHead) : "",
      productionCommit: asString(recordAt(publicProviderAdmission, "productionBuild")?.commitSha),
      findingCount: Array.isArray(publicProviderAdmission?.securityFindings) ? publicProviderAdmission.securityFindings.length : 0,
      capacity: asNumber(recordAt(recordAt(publicProviderAdmission, "contracts"), "publicAskProviderAdmission")?.capacity),
      fullModeWeight: asNumber(recordAt(recordAt(recordAt(publicProviderAdmission, "contracts"), "publicAskProviderAdmission"), "modeWeights")?.full),
      liveCaseCount: Array.isArray(publicProviderAdmission?.liveChecks) ? publicProviderAdmission.liveChecks.length : 0,
      distributedProductionActivation: asString(recordAt(publicProviderAdmission, "remainingBoundaries")?.distributedProductionActivation),
      followUpSecurityScan: asString(recordAt(publicProviderAdmission, "remainingBoundaries")?.followUpSecurityScan),
      securityCompleteClaimAllowed: recordAt(publicProviderAdmission, "remainingBoundaries")?.securityCompleteClaimAllowed === true,
      exactSavedShareVerdict: asString(recordAt(publicProviderAdmission, "remainingBoundaries")?.exactSavedShareVerdict),
    },
    publicAskDistributedAdmission: {
      artifact: ARTIFACTS.publicAskDistributedAdmission,
      verdict: isRecord(publicAskDistributedAdmission) ? asString(publicAskDistributedAdmission.verdict) : "missing",
      sourceHead: isRecord(publicAskDistributedAdmission) ? asString(publicAskDistributedAdmission.sourceHead) : "",
      productCommit: isRecord(publicAskDistributedAdmission) ? asString(publicAskDistributedAdmission.productCommit) : "",
      productionCommit: isRecord(publicAskDistributedAdmission) ? asString(publicAskDistributedAdmission.productionCommit) : "",
      findingId: asString(recordAt(publicAskDistributedAdmission, "securityFinding")?.findingId),
      localCaseCount: Array.isArray(recordAt(publicAskDistributedAdmission, "localProductionProbe")?.cases)
        ? recordAt(publicAskDistributedAdmission, "localProductionProbe").cases.length
        : 0,
      liveCaseCount: Array.isArray(recordAt(publicAskDistributedAdmission, "liveProductionProbe")?.cases)
        ? recordAt(publicAskDistributedAdmission, "liveProductionProbe").cases.length
        : 0,
      providerCallExecuted: recordAt(publicAskDistributedAdmission, "localProductionProbe")?.providerCallExecuted === true
        || recordAt(publicAskDistributedAdmission, "liveProductionProbe")?.providerCallExecuted === true,
      distributedBackendActivation: asString(recordAt(publicAskDistributedAdmission, "remainingBoundaries")?.distributedBackendActivation),
      freshFollowUpScan: asString(recordAt(publicAskDistributedAdmission, "remainingBoundaries")?.freshFollowUpScan),
      securityCompleteClaimAllowed: recordAt(publicAskDistributedAdmission, "remainingBoundaries")?.securityCompleteClaimAllowed === true,
      exactSavedShareVerdict: asString(recordAt(publicAskDistributedAdmission, "remainingBoundaries")?.exactSavedShareVerdict),
    },
    publicSearchDistributedAdmission: {
      artifact: ARTIFACTS.publicSearchDistributedAdmission,
      verdict: isRecord(publicSearchDistributedAdmission) ? asString(publicSearchDistributedAdmission.verdict) : "missing",
      sourceHead: isRecord(publicSearchDistributedAdmission) ? asString(publicSearchDistributedAdmission.sourceHead) : "",
      productionCommit: isRecord(publicSearchDistributedAdmission) ? asString(publicSearchDistributedAdmission.productionCommit) : "",
      findingId: asString(recordAt(publicSearchDistributedAdmission, "securityFinding")?.findingId),
      liveCaseCount: Array.isArray(recordAt(publicSearchDistributedAdmission, "liveProductionProbe")?.cases)
        ? recordAt(publicSearchDistributedAdmission, "liveProductionProbe").cases.length
        : 0,
      providerCallExecuted: recordAt(publicSearchDistributedAdmission, "liveProductionProbe")?.providerCallExecutedForEvidence === true,
      distributedBackendActivation: asString(recordAt(publicSearchDistributedAdmission, "remainingBoundaries")?.distributedBackendActivation),
      freshFollowUpScan: asString(recordAt(publicSearchDistributedAdmission, "remainingBoundaries")?.freshFollowUpScan),
      securityCompleteClaimAllowed: recordAt(publicSearchDistributedAdmission, "remainingBoundaries")?.securityCompleteClaimAllowed === true,
      exactSavedShareVerdict: asString(recordAt(publicSearchDistributedAdmission, "remainingBoundaries")?.exactSavedShareVerdict),
    },
    agentChatDurableAdmission: {
      artifact: ARTIFACTS.agentChatDurableAdmission,
      verdict: isRecord(agentChatDurableAdmission) ? asString(agentChatDurableAdmission.verdict) : "missing",
      sourceHead: isRecord(agentChatDurableAdmission) ? asString(agentChatDurableAdmission.sourceHead) : "",
      productionCommit: asString(recordAt(agentChatDurableAdmission, "productionBuild")?.commitSha),
      findingId: asString(recordAt(agentChatDurableAdmission, "sealedFinding")?.findingId),
      focusedTests: asNumber(recordAt(recordAt(agentChatDurableAdmission, "verification"), "focused")?.tests),
      adjacentTests: asNumber(recordAt(recordAt(agentChatDurableAdmission, "verification"), "focusedAndAdjacentCore")?.tests),
      liveRateLimitMode: asString(recordAt(agentChatDurableAdmission, "liveProbe")?.rateLimitMode),
      authenticatedAgentAvailability: asString(recordAt(agentChatDurableAdmission, "liveProbe")?.authenticatedAgentAvailability),
      distributedProductionActivation: asString(recordAt(agentChatDurableAdmission, "remainingBoundaries")?.distributedProductionActivation),
      freshRescanRequired: recordAt(agentChatDurableAdmission, "remainingBoundaries")?.freshFullRepositorySecurityScanRequiredForCanonicalClosure === true,
      securityCompleteClaimAllowed: recordAt(agentChatDurableAdmission, "remainingBoundaries")?.securityCompleteClaimAllowed === true,
      exactSavedShareVerdict: asString(recordAt(agentChatDurableAdmission, "remainingBoundaries")?.exactSavedShareVerdict),
    },
    mcpProviderAdmission: {
      artifact: ARTIFACTS.mcpProviderAdmission,
      verdict: isRecord(mcpProviderAdmission) ? asString(mcpProviderAdmission.verdict) : "missing",
      sourceHead: isRecord(mcpProviderAdmission) ? asString(mcpProviderAdmission.sourceHead) : "",
      productionCommit: asString(recordAt(mcpProviderAdmission, "productionBuild")?.commitSha),
      findingId: asString(recordAt(mcpProviderAdmission, "sealedFinding")?.findingId),
      focusedTests: asNumber(recordAt(recordAt(mcpProviderAdmission, "verification"), "focused")?.tests),
      adjacentTests: asNumber(recordAt(recordAt(mcpProviderAdmission, "verification"), "focusedAndAdjacentMcp")?.tests),
      liveRateLimitMode: asString(recordAt(mcpProviderAdmission, "liveProbe")?.rateLimitMode),
      authenticatedProviderGenerationAvailability: asString(recordAt(mcpProviderAdmission, "liveProbe")?.authenticatedProviderGenerationAvailability),
      distributedProductionActivation: asString(recordAt(mcpProviderAdmission, "remainingBoundaries")?.distributedProductionActivation),
      freshRescanRequired: recordAt(mcpProviderAdmission, "remainingBoundaries")?.freshFullRepositorySecurityScanRequiredForCanonicalClosure === true,
      securityCompleteClaimAllowed: recordAt(mcpProviderAdmission, "remainingBoundaries")?.securityCompleteClaimAllowed === true,
      exactSavedShareVerdict: asString(recordAt(mcpProviderAdmission, "remainingBoundaries")?.exactSavedShareVerdict),
    },
    shareRecipientContactVerification: {
      artifact: ARTIFACTS.shareRecipientContactVerification,
      verdict: isRecord(shareRecipientContactVerification) ? asString(shareRecipientContactVerification.verdict) : "missing",
      sourceHead: isRecord(shareRecipientContactVerification) ? asString(shareRecipientContactVerification.sourceHead) : "",
      productionCommit: isRecord(shareRecipientContactVerification) ? asString(shareRecipientContactVerification.productionCommit) : "",
      findingId: asString(recordAt(shareRecipientContactVerification, "securityFinding")?.findingId),
      workerIdAloneAccepted: recordAt(shareRecipientContactVerification, "sourceContract")?.invitationWorkerIdAloneAcceptedForConfirmation === true,
      verificationValuePersisted: recordAt(shareRecipientContactVerification, "sourceContract")?.verificationValuePersisted === true,
      adjacentTests: asNumber(recordAt(recordAt(shareRecipientContactVerification, "verification"), "focusedAndAdjacent")?.tests),
      browserTests: asNumber(recordAt(recordAt(shareRecipientContactVerification, "verification"), "recipientBrowser")?.tests),
      liveMissingSessionStatus: asNumber(recordAt(shareRecipientContactVerification, "liveProbe")?.status),
      liveRealRecipientVerificationProbe: asString(recordAt(shareRecipientContactVerification, "remainingBoundaries")?.liveRealRecipientVerificationProbe),
      freshRescanRequired: recordAt(shareRecipientContactVerification, "remainingBoundaries")?.freshFullRepositorySecurityScanRequiredForCanonicalClosure === true,
      recipientAckLiveDataApproval: asString(recordAt(shareRecipientContactVerification, "remainingBoundaries")?.recipientAckLiveDataApproval),
      securityCompleteClaimAllowed: recordAt(shareRecipientContactVerification, "remainingBoundaries")?.securityCompleteClaimAllowed === true,
      exactSavedShareVerdict: asString(recordAt(shareRecipientContactVerification, "remainingBoundaries")?.exactSavedShareVerdict),
    },
    securityAtomicDbRaceRemediation: {
      artifact: ARTIFACTS.securityAtomicDbRaceApprovalBoundary,
      verdict: isRecord(securityAtomicDbRaceApprovalBoundary) ? asString(securityAtomicDbRaceApprovalBoundary.verdict) : "missing",
      sourceHead: isRecord(securityAtomicDbRaceApprovalBoundary) ? asString(securityAtomicDbRaceApprovalBoundary.sourceHead) : "",
      scanId: asString(recordAt(securityAtomicDbRaceApprovalBoundary, "sealedScan")?.scanId),
      findingIds: isRecord(securityAtomicDbRaceApprovalBoundary) && Array.isArray(securityAtomicDbRaceApprovalBoundary.findings)
        ? securityAtomicDbRaceApprovalBoundary.findings.filter(isRecord).map((finding) => asString(finding.findingId)).filter(Boolean)
        : [],
      openFindingCount: isRecord(securityAtomicDbRaceApprovalBoundary) && Array.isArray(securityAtomicDbRaceApprovalBoundary.findings)
        ? securityAtomicDbRaceApprovalBoundary.findings.filter((finding) => isRecord(finding) && finding.currentSourceStillAffected === true).length
        : 0,
      approvalRequired: recordAt(securityAtomicDbRaceApprovalBoundary, "approvalRequest")?.required === true,
      approvalPerformed: recordAt(securityAtomicDbRaceApprovalBoundary, "approvalRequest")?.notApprovedOrPerformed !== true,
      migrationAuthored: recordAt(securityAtomicDbRaceApprovalBoundary, "mutationBoundary")?.migrationAuthored === true,
      dbMutationPerformed: recordAt(securityAtomicDbRaceApprovalBoundary, "mutationBoundary")?.dbMutationPerformed === true,
      freshRescanRequired: recordAt(securityAtomicDbRaceApprovalBoundary, "remainingBoundaries")?.freshFullRepositorySecurityScanRequiredAfterRemediation === true,
      securityCompleteClaimAllowed: recordAt(securityAtomicDbRaceApprovalBoundary, "remainingBoundaries")?.securityCompleteClaimAllowed === true,
      exactSavedShareVerdict: asString(recordAt(securityAtomicDbRaceApprovalBoundary, "remainingBoundaries")?.exactSavedShareVerdict),
    },
    liveDocumentsShareRoutePerception: {
      artifact: ARTIFACTS.liveDocumentsShareRoutePerception,
      verdict: isRecord(liveDocumentsShareRoutePerception) ? asString(liveDocumentsShareRoutePerception.verdict) : "missing",
      sourceHead: isRecord(liveDocumentsShareRoutePerception) ? asString(liveDocumentsShareRoutePerception.sourceHead) : "",
      productionCommit: asString(recordAt(liveDocumentsShareRoutePerception, "productionBuild")?.commitSha),
      documentsRows: Array.isArray(recordAt(liveDocumentsShareRoutePerception, "measurement")?.documents)
        ? recordAt(liveDocumentsShareRoutePerception, "measurement")?.documents.length
        : 0,
      workspaceShareRows: Array.isArray(recordAt(liveDocumentsShareRoutePerception, "measurement")?.workspaceShare)
        ? recordAt(liveDocumentsShareRoutePerception, "measurement")?.workspaceShare.length
        : 0,
      desktopShareRegions: asNumber(
        Array.isArray(recordAt(liveDocumentsShareRoutePerception, "measurement")?.workspaceShare)
          ? recordAt(liveDocumentsShareRoutePerception, "measurement")?.workspaceShare.find((row) => isRecord(row) && asNumber(recordAt(row, "viewport")?.width) === 1440)?.distinctDesktopRegions
          : null,
      ),
      routeSplitAloneAcceptedAsFix: recordAt(liveDocumentsShareRoutePerception, "interpretation")?.routeSplitAloneAcceptedAsFix === true,
      exactSavedUserSessionReproduced: recordAt(liveDocumentsShareRoutePerception, "remainingBoundaries")?.exactSavedUserSessionReproduced === true,
      exactSavedShareVerdict: asString(recordAt(liveDocumentsShareRoutePerception, "remainingBoundaries")?.exactSavedShareVerdict),
      dbMutationPerformed: recordAt(liveDocumentsShareRoutePerception, "mutationBoundary")?.dbMutationPerformed === true,
    },
    deploymentFreshnessGuard: {
      artifact: ARTIFACTS.deploymentFreshnessGuard,
      verdict: isRecord(deploymentFreshnessGuard) ? asString(deploymentFreshnessGuard.verdict) : "missing",
      sourceHead: isRecord(deploymentFreshnessGuard) ? asString(deploymentFreshnessGuard.sourceHead) : "",
      productionCommit: asString(recordAt(deploymentFreshnessGuard, "productionBuild")?.commitSha),
      currentNoticePresent: recordAt(recordAt(deploymentFreshnessGuard, "verification")?.liveBrowser, "normalCurrentDeployment")?.noticePresent === true,
      driftRefreshVisible: recordAt(recordAt(deploymentFreshnessGuard, "verification")?.liveBrowser, "simulatedShaDrift")?.refreshButtonVisible === true,
      frontendAuditViolations: asNumber(recordAt(recordAt(deploymentFreshnessGuard, "verification"), "canonicalFrontendStaticAudit")?.violationCount),
      liveAfterDeploymentPending: recordAt(deploymentFreshnessGuard, "remainingBoundaries")?.liveAfterDeploymentPending === true,
      exactSavedShareVerdict: asString(recordAt(deploymentFreshnessGuard, "remainingBoundaries")?.exactSavedShareVerdict),
      dbMutationPerformed: recordAt(deploymentFreshnessGuard, "mutationBoundary")?.dbMutationPerformed === true,
    },
    mcpGenerationWorkBudgetSecurity: {
      artifact: ARTIFACTS.mcpGenerationWorkBudgetSecurity,
      verdict: isRecord(mcpGenerationWorkBudgetSecurity)
        ? asString(mcpGenerationWorkBudgetSecurity.verdict)
        : "missing",
      sourceHead: isRecord(mcpGenerationWorkBudgetSecurity)
        ? asString(mcpGenerationWorkBudgetSecurity.sourceHead)
        : "",
      productionCommit: isRecord(mcpGenerationWorkBudgetSecurity)
        ? asString(mcpGenerationWorkBudgetSecurity.productionCommit)
        : "",
      postBodyMaxBytes: asNumber(recordAt(mcpGenerationWorkBudgetSecurity, "currentSourceContract")?.postBodyMaxBytes),
      adjacentTests: asNumber(recordAt(recordAt(mcpGenerationWorkBudgetSecurity, "verification"), "adjacentMcp")?.tests),
      validAuthenticatedRuntimeProbeRequired: recordAt(mcpGenerationWorkBudgetSecurity, "remainingBoundaries")?.validAuthenticatedRuntimeProbeRequired === true,
      distributedActivationRequired: recordAt(mcpGenerationWorkBudgetSecurity, "remainingBoundaries")?.distributedProductionActivationRequired === true,
      freshRescanRequired: recordAt(mcpGenerationWorkBudgetSecurity, "remainingBoundaries")?.freshSecurityRescanRequired === true,
      exactSavedShareVerdict: asString(recordAt(mcpGenerationWorkBudgetSecurity, "remainingBoundaries")?.exactSavedShareVerdict),
    },
    learningExportRendererSecurity: {
      artifact: ARTIFACTS.learningExportRendererSecurity,
      verdict: isRecord(learningExportRendererSecurity) ? asString(learningExportRendererSecurity.verdict) : "missing",
      sourceHead: isRecord(learningExportRendererSecurity) ? asString(learningExportRendererSecurity.sourceHead) : "",
      productionCommit: isRecord(learningExportRendererSecurity) && isRecord(learningExportRendererSecurity.productionBuild)
        ? asString(learningExportRendererSecurity.productionBuild.commitSha)
        : "",
      currentSourceDisposition: asString(recordAt(learningExportRendererSecurity, "candidate")?.currentSourceDisposition),
      canonicalDeferredCandidateCount: asNumber(recordAt(learningExportRendererSecurity, "remainingBoundaries")?.canonicalDeferredCandidateCount),
      fullRepositoryRescanRequired: recordAt(learningExportRendererSecurity, "candidate")?.fullRepositoryRescanRequiredForCanonicalClosure === true,
      securityCompleteClaimAllowed: recordAt(learningExportRendererSecurity, "remainingBoundaries")?.securityCompleteClaimAllowed === true,
      exactSavedShareVerdict: asString(recordAt(learningExportRendererSecurity, "remainingBoundaries")?.exactSavedShareVerdict),
    },
    liveDocumentQualityMatrix: {
      artifact: ARTIFACTS.liveDocumentQualityMatrix,
      verdict: isRecord(liveDocumentQualityMatrix) ? asString(liveDocumentQualityMatrix.verdict) : "missing",
      sourceHead: isRecord(liveDocumentQualityMatrix) ? asString(liveDocumentQualityMatrix.sourceHead) : "",
      productionCommit: extractProductionCommit(liveDocumentQualityMatrix),
      scenarioCount: isRecord(liveDocumentQualityMatrix) && Array.isArray(liveDocumentQualityMatrix.scenarios)
        ? liveDocumentQualityMatrix.scenarios.length
        : null,
      livePassed: asNumber(recordAt(liveDocumentQualityMatrix, "afterLive")?.pass),
      liveFailed: asNumber(recordAt(liveDocumentQualityMatrix, "afterLive")?.fail),
      structuredRiskControlsDistinct: recordAt(liveDocumentQualityMatrix, "afterLive")?.structuredRiskControlsDistinct === true,
      foreignWorkerScenarioRelevance: recordAt(liveDocumentQualityMatrix, "afterLive")?.foreignWorkerScenarioRelevance === true,
      dbMutationPerformed: recordAt(liveDocumentQualityMatrix, "boundaries")?.dbMutationPerformed === true,
      providerDispatchLiveClaimed: recordAt(liveDocumentQualityMatrix, "boundaries")?.providerDispatchLiveClaimed === true,
    },
    liveDocumentQualityStressMatrix: {
      artifact: ARTIFACTS.liveDocumentQualityStressMatrix,
      verdict: isRecord(liveDocumentQualityStressMatrix) ? asString(liveDocumentQualityStressMatrix.verdict) : "missing",
      sourceHead: isRecord(liveDocumentQualityStressMatrix) ? asString(liveDocumentQualityStressMatrix.sourceHead) : "",
      productionCommit: extractProductionCommit(liveDocumentQualityStressMatrix),
      productCommitIncludedInProduction: isRecord(liveDocumentQualityStressMatrix)
        && liveDocumentQualityStressMatrix.productCommitIncludedInProduction === true,
      livePassed: asNumber(recordAt(liveDocumentQualityStressMatrix, "afterLive")?.pass),
      liveFailed: asNumber(recordAt(liveDocumentQualityStressMatrix, "afterLive")?.fail),
      dbMutationPerformed: recordAt(liveDocumentQualityStressMatrix, "boundaries")?.dbMutationPerformed === true,
      providerDispatchPerformed: recordAt(liveDocumentQualityStressMatrix, "boundaries")?.providerDispatchPerformed === true,
    },
    liveDocumentFieldIsolation: {
      artifact: ARTIFACTS.liveDocumentFieldIsolation,
      verdict: isRecord(liveDocumentFieldIsolation) ? asString(liveDocumentFieldIsolation.verdict) : "missing",
      sourceHead: isRecord(liveDocumentFieldIsolation) ? asString(liveDocumentFieldIsolation.sourceHead) : "",
      productionCommit: extractProductionCommit(liveDocumentFieldIsolation),
      livePassed: asNumber(recordAt(recordAt(liveDocumentFieldIsolation, "afterLive"), "normal")?.pass)
        + asNumber(recordAt(recordAt(liveDocumentFieldIsolation, "afterLive"), "stress")?.pass),
      liveFailed: asNumber(recordAt(recordAt(liveDocumentFieldIsolation, "afterLive"), "normal")?.fail)
        + asNumber(recordAt(recordAt(liveDocumentFieldIsolation, "afterLive"), "stress")?.fail),
      liveAfterDeploymentPending: isRecord(liveDocumentFieldIsolation)
        && liveDocumentFieldIsolation.liveAfterDeploymentPending === true,
      dbMutationPerformed: recordAt(liveDocumentFieldIsolation, "mutationBoundary")?.dbMutationPerformed === true,
      providerDispatchCalled: recordAt(liveDocumentFieldIsolation, "mutationBoundary")?.providerDispatchCalled === true,
    },
    liveDocumentWordingReview: {
      artifact: ARTIFACTS.liveDocumentWordingReview,
      verdict: isRecord(liveDocumentWordingReview) ? asString(liveDocumentWordingReview.verdict) : "missing",
      sourceHead: isRecord(liveDocumentWordingReview) ? asString(liveDocumentWordingReview.sourceHead) : "",
      productionCommit: extractProductionCommit(liveDocumentWordingReview),
      productCommit: isRecord(liveDocumentWordingReview) ? asString(liveDocumentWordingReview.productCommit) : "",
      livePassed: asNumber(recordAt(liveDocumentWordingReview, "afterLive")?.pass),
      liveFailed: asNumber(recordAt(liveDocumentWordingReview, "afterLive")?.fail),
      liveAfterDeploymentPending: isRecord(liveDocumentWordingReview)
        && liveDocumentWordingReview.liveAfterDeploymentPending === true,
      dbMutationPerformed: recordAt(liveDocumentWordingReview, "mutationBoundary")?.dbMutationPerformed === true,
      providerDispatchCalled: recordAt(liveDocumentWordingReview, "mutationBoundary")?.providerDispatchCalled === true,
    },
    liveDocumentBroadReview: {
      artifact: ARTIFACTS.liveDocumentBroadReview,
      verdict: isRecord(liveDocumentBroadReview) ? asString(liveDocumentBroadReview.verdict) : "missing",
      sourceHead: isRecord(liveDocumentBroadReview) ? asString(liveDocumentBroadReview.sourceHead) : "",
      productionCommit: extractProductionCommit(liveDocumentBroadReview),
      productCommit: isRecord(liveDocumentBroadReview) ? asString(liveDocumentBroadReview.productCommit) : "",
      uiDocumentCount: asNumber(liveDocumentBroadReview?.uiDocumentCount),
      integrityRequiredCount: asNumber(liveDocumentBroadReview?.integrityRequiredCount),
      reviewedDocumentCount: asNumber(liveDocumentBroadReview?.reviewedDocumentCount),
      beforePassed: asNumber(recordAt(recordAt(liveDocumentBroadReview, "stages"), "beforeRemediation")?.pass),
      beforeFailed: asNumber(recordAt(recordAt(liveDocumentBroadReview, "stages"), "beforeRemediation")?.fail),
      beforeMissingUnexpected: asNumber(recordAt(recordAt(liveDocumentBroadReview, "stages"), "beforeRemediation")?.missingUnexpectedCount),
      livePassed: asNumber(recordAt(recordAt(liveDocumentBroadReview, "stages"), "afterLive")?.pass),
      liveFailed: asNumber(recordAt(recordAt(liveDocumentBroadReview, "stages"), "afterLive")?.fail),
      liveMissingUnexpected: asNumber(recordAt(recordAt(liveDocumentBroadReview, "stages"), "afterLive")?.missingUnexpectedCount),
      workPermitPresentNonEmpty: Array.isArray(liveDocumentBroadReview?.workPermitMatrix)
        ? liveDocumentBroadReview.workPermitMatrix.filter((item) => (
          isRecord(item) && item.status === "presentNonEmpty" && item.verdict === "PASS"
        )).length
        : 0,
      dbMutationPerformed: recordAt(liveDocumentBroadReview, "mutationBoundary")?.dbMutationPerformed === true,
      shareSessionCreated: recordAt(liveDocumentBroadReview, "mutationBoundary")?.shareSessionCreated === true,
      providerDispatchCalled: recordAt(liveDocumentBroadReview, "mutationBoundary")?.providerDispatchCalled === true,
      exactSavedShareReproduced: recordAt(liveDocumentBroadReview, "mutationBoundary")?.exactSavedShareReproduced === true,
      exactSavedShareVerdict: asString(recordAt(liveDocumentBroadReview, "mutationBoundary")?.exactSavedShareVerdict),
    },
    liveDocumentEditorialReview: {
      artifact: ARTIFACTS.liveDocumentEditorialReview,
      verdict: isRecord(liveDocumentEditorialReview) ? asString(liveDocumentEditorialReview.verdict) : "missing",
      productCommit: isRecord(liveDocumentEditorialReview) ? asString(liveDocumentEditorialReview.productCommit) : "",
      productionCommit: extractProductionCommit(liveDocumentEditorialReview),
      scenarioCount: asNumber(liveDocumentEditorialReview?.scenarioCount),
      reviewedDocumentSurfaceCount: asNumber(liveDocumentEditorialReview?.reviewedDocumentSurfaceCount),
      livePassed: asNumber(recordAt(liveDocumentEditorialReview, "afterLive")?.pass),
      liveFailed: asNumber(recordAt(liveDocumentEditorialReview, "afterLive")?.fail),
      placeholderFindingCount: asNumber(recordAt(liveDocumentEditorialReview, "afterLive")?.placeholderFindingCount),
      legalOverclaimFindingCount: asNumber(recordAt(liveDocumentEditorialReview, "afterLive")?.legalOverclaimFindingCount),
      awkwardCompositionFindingCount: asNumber(recordAt(liveDocumentEditorialReview, "afterLive")?.awkwardCompositionFindingCount),
      evidenceDomainMismatchCount: asNumber(recordAt(liveDocumentEditorialReview, "afterLive")?.evidenceDomainMismatchCount),
      exactLineOveruseCount: asNumber(recordAt(liveDocumentEditorialReview, "afterLive")?.exactLineOveruseCount),
      nearDuplicateLineOveruseCount: asNumber(recordAt(liveDocumentEditorialReview, "afterLive")?.nearDuplicateLineOveruseCount),
      humanReviewCompleted: liveDocumentEditorialReview?.humanReviewCompleted === true,
      dbMutationPerformed: recordAt(liveDocumentEditorialReview, "mutationBoundary")?.dbMutationPerformed === true,
      shareSessionCreated: recordAt(liveDocumentEditorialReview, "mutationBoundary")?.shareSessionCreated === true,
      providerDispatchCalled: recordAt(liveDocumentEditorialReview, "mutationBoundary")?.providerDispatchCalled === true,
      exactSavedShareReproduced: recordAt(liveDocumentEditorialReview, "mutationBoundary")?.exactSavedShareReproduced === true,
      exactSavedShareVerdict: asString(recordAt(liveDocumentEditorialReview, "evidenceBoundary")?.exactSavedShareVerdict),
    },
    documentEditorialReviewCockpit: documentEditorialReviewCockpitSummary(documentEditorialReviewCockpit),
    liveDocumentEditorialDuplicateClassification: {
      artifact: ARTIFACTS.liveDocumentEditorialDuplicateClassification,
      verdict: isRecord(liveDocumentEditorialDuplicateClassification)
        ? asString(liveDocumentEditorialDuplicateClassification.verdict)
        : "missing",
      productCommit: isRecord(liveDocumentEditorialDuplicateClassification)
        ? asString(liveDocumentEditorialDuplicateClassification.productCommit)
        : "",
      productionCommit: extractProductionCommit(liveDocumentEditorialDuplicateClassification),
      reviewedDocumentSurfaceCount: asNumber(liveDocumentEditorialDuplicateClassification?.reviewedDocumentSurfaceCount),
      beforeGenericTemplateOveruseCount: asNumber(recordAt(liveDocumentEditorialDuplicateClassification, "beforeLive")?.genericTemplateOveruseCount),
      liveGenericTemplateOveruseCount: asNumber(recordAt(liveDocumentEditorialDuplicateClassification, "afterLive")?.genericTemplateOveruseCount),
      exactLineOveruseCount: asNumber(recordAt(liveDocumentEditorialDuplicateClassification, "afterLive")?.exactLineOveruseCount),
      nearDuplicateLineOveruseCount: asNumber(recordAt(liveDocumentEditorialDuplicateClassification, "afterLive")?.nearDuplicateLineOveruseCount),
      humanReviewCompleted: liveDocumentEditorialDuplicateClassification?.humanReviewCompleted === true,
      dbMutationPerformed: recordAt(liveDocumentEditorialDuplicateClassification, "mutationBoundary")?.dbMutationPerformed === true,
      shareSessionCreated: recordAt(liveDocumentEditorialDuplicateClassification, "mutationBoundary")?.shareSessionCreated === true,
      providerDispatchCalled: recordAt(liveDocumentEditorialDuplicateClassification, "mutationBoundary")?.providerDispatchCalled === true,
      exactSavedShareReproduced: recordAt(liveDocumentEditorialDuplicateClassification, "mutationBoundary")?.exactSavedShareReproduced === true,
      exactSavedShareVerdict: asString(recordAt(liveDocumentEditorialDuplicateClassification, "remainingBoundaries")?.exactSavedShareVerdict),
    },
    liveDocumentEditorialNearClassification: {
      artifact: ARTIFACTS.liveDocumentEditorialNearClassification,
      verdict: isRecord(liveDocumentEditorialNearClassification)
        ? asString(liveDocumentEditorialNearClassification.verdict)
        : "missing",
      sourceHead: isRecord(liveDocumentEditorialNearClassification)
        ? asString(liveDocumentEditorialNearClassification.sourceHead)
        : "",
      productionCommit: extractProductionCommit(liveDocumentEditorialNearClassification),
      beforeNearDuplicateLineOveruseCount: asNumber(recordAt(liveDocumentEditorialNearClassification, "before")?.nearDuplicateLineOveruseCount),
      beforeHumanReviewRequiredCount: asNumber(
        recordAt(recordAt(liveDocumentEditorialNearClassification, "before"), "nearCategories")?.["human-review-required"],
      ),
      livePassed: asNumber(recordAt(liveDocumentEditorialNearClassification, "afterLive")?.pass),
      liveFailed: asNumber(recordAt(liveDocumentEditorialNearClassification, "afterLive")?.fail),
      liveNearDuplicateLineOveruseCount: asNumber(recordAt(liveDocumentEditorialNearClassification, "afterLive")?.nearDuplicateLineOveruseCount),
      liveHumanReviewRequiredCount: asNumber(
        recordAt(recordAt(liveDocumentEditorialNearClassification, "afterLive"), "nearCategories")?.["human-review-required"],
      ),
      rolePrefixVariantCount: asNumber(
        recordAt(recordAt(liveDocumentEditorialNearClassification, "afterLive"), "nearCategories")?.["document-role-prefix-variant"],
      ),
      independentContextCount: asNumber(
        recordAt(recordAt(liveDocumentEditorialNearClassification, "afterLive"), "nearCategories")?.["independent-document-context"],
      ),
      hazardConsistencyCount: asNumber(
        recordAt(recordAt(liveDocumentEditorialNearClassification, "afterLive"), "nearCategories")?.["cross-document-hazard-consistency"],
      ),
      controlConsistencyCount: asNumber(
        recordAt(recordAt(liveDocumentEditorialNearClassification, "afterLive"), "nearCategories")?.["cross-document-control-consistency"],
      ),
      humanReviewCompleted: recordAt(liveDocumentEditorialNearClassification, "afterLive")?.humanReviewCompleted === true,
      exactSavedShareVerdict: asString(recordAt(liveDocumentEditorialNearClassification, "remainingBoundaries")?.exactSavedShareVerdict),
    },
    productCapabilityTruth: {
      artifact: ARTIFACTS.productCapabilityTruth,
      verdict: isRecord(productCapabilityTruth) ? asString(productCapabilityTruth.verdict) : "missing",
      sourceHead: isRecord(productCapabilityTruth) ? asString(productCapabilityTruth.sourceHead) : "",
      productionCommit: extractProductionCommit(productCapabilityTruth),
      dispatchMode: asString(recordAt(recordAt(productCapabilityTruth, "liveChecks"), "providerDispatch")?.mode),
      dispatchReason: asString(recordAt(recordAt(productCapabilityTruth, "liveChecks"), "providerDispatch")?.reason),
      briefingEmailReady: recordAt(recordAt(productCapabilityTruth, "liveChecks"), "briefingSettingsUnauthenticated")?.emailReady === true,
      photoVisionReady: recordAt(recordAt(productCapabilityTruth, "liveChecks"), "photoVisionReadiness")?.ready === true,
      photoAcceptedOnly: recordAt(recordAt(productCapabilityTruth, "liveChecks"), "photoVisionReadiness")?.acceptedOnly === true,
      aiModes: Array.isArray(recordAt(recordAt(productCapabilityTruth, "uiChecks"), "aiGenerationModes")?.modes)
        ? recordAt(recordAt(productCapabilityTruth, "uiChecks"), "aiGenerationModes").modes
        : [],
      providerDispatchCalled: recordAt(productCapabilityTruth, "mutationBoundary")?.providerDispatchCalled === true,
      photoAnalysisPostCalled: recordAt(productCapabilityTruth, "mutationBoundary")?.photoAnalysisPostCalled === true,
      exactSavedShareVerdict: asString(recordAt(productCapabilityTruth, "remainingBoundaries")?.exactSavedShareVerdict),
      documentsShareIaVerdict: asString(recordAt(productCapabilityTruth, "remainingBoundaries")?.documentsShareIaVerdict),
    },
    tenantAuthorizationRemediation: {
      artifact: ARTIFACTS.tenantAuthorizationRemediation,
      verdict: isRecord(tenantAuthorizationRemediation) ? asString(tenantAuthorizationRemediation.verdict) : "missing",
      sourceHead: isRecord(tenantAuthorizationRemediation) ? asString(tenantAuthorizationRemediation.sourceHead) : "",
      productionCommit: asString(recordAt(tenantAuthorizationRemediation, "productionBuild")?.commitSha),
      greenFindings: asNumber(recordAt(tenantAuthorizationRemediation, "summary")?.greenCount),
      remainingBeforeFullRescan: asNumber(recordAt(tenantAuthorizationRemediation, "remainingBoundaries")?.reportableFindingCount),
      securityCompleteClaimAllowed: recordAt(tenantAuthorizationRemediation, "remainingBoundaries")?.securityCompleteClaimAllowed === true,
      exactSavedShareVerdict: asString(recordAt(tenantAuthorizationRemediation, "remainingBoundaries")?.exactSavedShareVerdict),
    },
    spreadsheetFormulaNeutralization: {
      artifact: ARTIFACTS.spreadsheetFormulaNeutralization,
      verdict: isRecord(spreadsheetFormulaNeutralization) ? asString(spreadsheetFormulaNeutralization.verdict) : "missing",
      productCommit: asString(recordAt(spreadsheetFormulaNeutralization, "source")?.productCommit),
      evidenceHead: asString(recordAt(spreadsheetFormulaNeutralization, "source")?.evidenceHead),
      productionCommit: asString(recordAt(spreadsheetFormulaNeutralization, "source")?.productionMarkerAtValidation),
      remediatedFindings: asNumber(recordAt(recordAt(spreadsheetFormulaNeutralization, "changes"), "findingClosure")?.spreadsheetFormulaInjectionFindingsRemediatedInCurrentSource),
      cumulativeRemediatedFindings: 6,
      remainingBeforeFullRescan: asNumber(recordAt(recordAt(spreadsheetFormulaNeutralization, "changes"), "findingClosure")?.remainingReportableFindingsBeforeFullRescan),
      fullRepositoryRescanCompleted: recordAt(recordAt(spreadsheetFormulaNeutralization, "changes"), "findingClosure")?.fullRepositoryRescanCompleted === true,
      securityCompleteClaimAllowed: recordAt(recordAt(spreadsheetFormulaNeutralization, "changes"), "findingClosure")?.securityCompleteClaimAllowed === true,
      exactSavedShareVerdict: asString(recordAt(spreadsheetFormulaNeutralization, "remainingBoundaries")?.exactSavedShareVerdict),
    },
    publicProviderWorkBudget: {
      artifact: ARTIFACTS.publicProviderWorkBudget,
      verdict: isRecord(publicProviderWorkBudget) ? asString(publicProviderWorkBudget.verdict) : "missing",
      productCommit: asString(recordAt(publicProviderWorkBudget, "source")?.productCommit),
      evidenceHead: asString(recordAt(publicProviderWorkBudget, "source")?.evidenceHead),
      productionCommit: asString(recordAt(publicProviderWorkBudget, "source")?.productionMarkerAtValidation),
      remediatedFindings: asNumber(recordAt(recordAt(publicProviderWorkBudget, "changes"), "findingClosure")?.publicProviderAndUpstreamFindingsRemediatedInCurrentSource),
      cumulativeRemediatedFindings: 10,
      remainingBeforeFullRescan: asNumber(recordAt(recordAt(publicProviderWorkBudget, "changes"), "findingClosure")?.remainingReportableFindingsBeforeFullRescan),
      fullRepositoryRescanCompleted: recordAt(recordAt(publicProviderWorkBudget, "changes"), "findingClosure")?.fullRepositoryRescanCompleted === true,
      securityCompleteClaimAllowed: recordAt(recordAt(publicProviderWorkBudget, "changes"), "findingClosure")?.securityCompleteClaimAllowed === true,
      productionProviderLoadTestPerformed: recordAt(publicProviderWorkBudget, "mutationBoundary")?.productionProviderLoadTestPerformed === true,
      exactSavedShareVerdict: asString(recordAt(publicProviderWorkBudget, "remainingBoundaries")?.exactSavedShareVerdict),
    },
    documentExportWorkBudget: {
      artifact: ARTIFACTS.documentExportWorkBudget,
      verdict: isRecord(documentExportWorkBudget) ? asString(documentExportWorkBudget.verdict) : "missing",
      productCommit: isRecord(documentExportWorkBudget) ? asString(documentExportWorkBudget.productCommit) : "",
      productionCommit: asString(recordAt(documentExportWorkBudget, "productionBuild")?.commitSha),
      remediatedFindings: asNumber(recordAt(documentExportWorkBudget, "findingClosure")?.documentExportFindingsRemediatedInLiveProduction),
      cumulativeRemediatedFindings: asNumber(recordAt(documentExportWorkBudget, "findingClosure")?.cumulativeBaselineFindingsWithBoundedRemediationEvidence),
      remainingBeforeFullRescan: asNumber(recordAt(documentExportWorkBudget, "findingClosure")?.remainingReportableFindingsBeforeFullRescan),
      fullRepositoryRescanCompleted: recordAt(documentExportWorkBudget, "findingClosure")?.fullRepositoryRescanCompleted === true,
      securityCompleteClaimAllowed: recordAt(documentExportWorkBudget, "findingClosure")?.securityCompleteClaimAllowed === true,
      exactSavedShareVerdict: asString(recordAt(documentExportWorkBudget, "openBoundaries")?.exactSavedShare),
    },
    hermesKnowledgeReviewAuthorityUi: {
      artifact: ARTIFACTS.hermesKnowledgeReviewAuthorityUi,
      verdict: isRecord(hermesKnowledgeReviewAuthorityUi) ? asString(hermesKnowledgeReviewAuthorityUi.verdict) : "missing",
      sourceHead: isRecord(hermesKnowledgeReviewAuthorityUi) ? asString(hermesKnowledgeReviewAuthorityUi.sourceHead) : "",
      productCommit: isRecord(hermesKnowledgeReviewAuthorityUi) ? asString(hermesKnowledgeReviewAuthorityUi.productCommit) : "",
      productionCommit: extractProductionCommit(hermesKnowledgeReviewAuthorityUi),
      localPassed: asNumber(recordAt(hermesKnowledgeReviewAuthorityUi, "local")?.passedCount),
      localViewportCount: asNumber(recordAt(hermesKnowledgeReviewAuthorityUi, "local")?.viewportCount),
      livePassed: asNumber(recordAt(hermesKnowledgeReviewAuthorityUi, "afterLive")?.passedCount),
      liveViewportCount: asNumber(recordAt(hermesKnowledgeReviewAuthorityUi, "afterLive")?.viewportCount),
      sourceOrder: Array.isArray(recordAt(hermesKnowledgeReviewAuthorityUi, "authorityContract")?.sourceOrder)
        ? recordAt(hermesKnowledgeReviewAuthorityUi, "authorityContract").sourceOrder
        : [],
      humanReviewRequired: recordAt(hermesKnowledgeReviewAuthorityUi, "authorityContract")?.humanReviewRequired === true,
      machineEvidenceReplacesHumanReview: recordAt(hermesKnowledgeReviewAuthorityUi, "authorityContract")?.machineEvidenceReplacesHumanReview === true,
      tenantMemoryPublicPromotionAllowed: recordAt(hermesKnowledgeReviewAuthorityUi, "authorityContract")?.tenantMemoryPublicPromotionAllowed === true,
      siteManagerAcceptanceRequiredBeforeWorkpackUse: recordAt(hermesKnowledgeReviewAuthorityUi, "authorityContract")?.siteManagerAcceptanceRequiredBeforeWorkpackUse === true,
      candidateCount: asNumber(recordAt(hermesKnowledgeReviewAuthorityUi, "workbenchContract")?.candidateCount),
      selectedCandidateCount: asNumber(recordAt(hermesKnowledgeReviewAuthorityUi, "workbenchContract")?.selectedCandidateCount),
      selectedBodyCount: asNumber(recordAt(hermesKnowledgeReviewAuthorityUi, "workbenchContract")?.selectedBodyCount),
      desktopColumns: asNumber(recordAt(hermesKnowledgeReviewAuthorityUi, "workbenchContract")?.desktopColumns),
      mobileColumns: asNumber(recordAt(hermesKnowledgeReviewAuthorityUi, "workbenchContract")?.mobileColumns),
      candidateBodyInternalScroll: recordAt(hermesKnowledgeReviewAuthorityUi, "workbenchContract")?.candidateBodyInternalScroll === true,
      dbMutationPerformed: recordAt(hermesKnowledgeReviewAuthorityUi, "mutationBoundary")?.dbMutationPerformed === true,
      providerDispatchCalled: recordAt(hermesKnowledgeReviewAuthorityUi, "mutationBoundary")?.providerDispatchCalled === true,
      shareSessionCreated: recordAt(hermesKnowledgeReviewAuthorityUi, "mutationBoundary")?.shareSessionCreated === true,
      ontologyPublicationPerformed: recordAt(hermesKnowledgeReviewAuthorityUi, "mutationBoundary")?.ontologyPublicationPerformed === true,
      exactSavedShareVerdict: asString(recordAt(hermesKnowledgeReviewAuthorityUi, "remainingBoundaries")?.exactSavedShareVerdict),
      llmWikiPublication: asString(recordAt(hermesKnowledgeReviewAuthorityUi, "remainingBoundaries")?.llmWikiPublication),
      supabaseRlsLaunchIsolation: asString(recordAt(hermesKnowledgeReviewAuthorityUi, "remainingBoundaries")?.supabaseRlsLaunchIsolation),
    },
    hermesKnowledgeReviewEvidenceInspector: {
      artifact: ARTIFACTS.hermesKnowledgeReviewEvidenceInspector,
      verdict: isRecord(hermesKnowledgeReviewEvidenceInspector) ? asString(hermesKnowledgeReviewEvidenceInspector.verdict) : "missing",
      sourceHead: isRecord(hermesKnowledgeReviewEvidenceInspector) ? asString(hermesKnowledgeReviewEvidenceInspector.sourceHead) : "",
      productCommit: isRecord(hermesKnowledgeReviewEvidenceInspector) ? asString(hermesKnowledgeReviewEvidenceInspector.productCommit) : "",
      productionCommit: extractProductionCommit(hermesKnowledgeReviewEvidenceInspector),
      localPassed: asNumber(recordAt(hermesKnowledgeReviewEvidenceInspector, "local")?.passedCount),
      localViewportCount: asNumber(recordAt(hermesKnowledgeReviewEvidenceInspector, "local")?.viewportCount),
      livePassed: asNumber(recordAt(hermesKnowledgeReviewEvidenceInspector, "afterLive")?.passedCount),
      liveViewportCount: asNumber(recordAt(hermesKnowledgeReviewEvidenceInspector, "afterLive")?.viewportCount),
      productionAligned: recordAt(hermesKnowledgeReviewEvidenceInspector, "afterLive")?.productionAligned === true,
      browserErrorCount: asNumber(recordAt(hermesKnowledgeReviewEvidenceInspector, "afterLive")?.browserErrorCount),
      itemLimit: asNumber(recordAt(hermesKnowledgeReviewEvidenceInspector, "evidenceContract")?.itemLimit),
      fixtureItemCount: asNumber(recordAt(hermesKnowledgeReviewEvidenceInspector, "evidenceContract")?.fixtureItemCount),
      desktopEvidenceColumns: asNumber(recordAt(hermesKnowledgeReviewEvidenceInspector, "evidenceContract")?.desktopEvidenceColumns),
      mobileMountedPaneCount: asNumber(recordAt(hermesKnowledgeReviewEvidenceInspector, "evidenceContract")?.mobileMountedPaneCount),
      publicOfficialHttpsLinkCount: asNumber(recordAt(hermesKnowledgeReviewEvidenceInspector, "evidenceContract")?.publicOfficialHttpsLinkCount),
      privateEvidenceRawIdentityExposed: recordAt(hermesKnowledgeReviewEvidenceInspector, "evidenceContract")?.privateEvidenceRawIdentityExposed === true,
      evidenceInternalScroll: recordAt(hermesKnowledgeReviewEvidenceInspector, "evidenceContract")?.evidenceInternalScroll === true,
      dbMutationPerformed: recordAt(hermesKnowledgeReviewEvidenceInspector, "mutationBoundary")?.dbMutationPerformed === true,
      providerDispatchCalled: recordAt(hermesKnowledgeReviewEvidenceInspector, "mutationBoundary")?.providerDispatchCalled === true,
      shareSessionCreated: recordAt(hermesKnowledgeReviewEvidenceInspector, "mutationBoundary")?.shareSessionCreated === true,
      securityComplete: recordAt(hermesKnowledgeReviewEvidenceInspector, "securityBoundary")?.securityComplete === true,
      freshFullRepositoryScanRequired: recordAt(hermesKnowledgeReviewEvidenceInspector, "securityBoundary")?.freshFullRepositoryScanRequired === true,
      exactSavedShareVerdict: asString(recordAt(hermesKnowledgeReviewEvidenceInspector, "remainingBoundaries")?.exactSavedShareVerdict),
      llmWikiPublication: asString(recordAt(hermesKnowledgeReviewEvidenceInspector, "remainingBoundaries")?.llmWikiPublication),
      supabaseRlsLaunchIsolation: asString(recordAt(hermesKnowledgeReviewEvidenceInspector, "remainingBoundaries")?.supabaseRlsLaunchIsolation),
      providerDispatchPersistence: asString(recordAt(hermesKnowledgeReviewEvidenceInspector, "remainingBoundaries")?.providerDispatchPersistence),
    },
    hermesOpenclawRuntime: {
      artifact: ARTIFACTS.hermesOpenclawRuntime,
      verdict: isRecord(hermesOpenclawRuntime) ? asString(hermesOpenclawRuntime.verdict) : "missing",
      sourceHead: isRecord(hermesOpenclawRuntime) ? asString(hermesOpenclawRuntime.sourceShaForFocusedTests) : "",
      productionCommit: extractProductionCommit(hermesOpenclawRuntime),
      testFilesPassed: asNumber(recordAt(hermesOpenclawRuntime, "focusedTests")?.testFilesPassed),
      testsPassed: asNumber(recordAt(hermesOpenclawRuntime, "focusedTests")?.testsPassed),
      durableAttemptLedgerWired: recordAt(hermesOpenclawRuntime, "sourceContract")?.durableAttemptLedgerWired === true,
      ledgerAtomicReservation: recordAt(hermesOpenclawRuntime, "sourceContract")?.ledgerAtomicReservation === true,
      ledgerTerminalRequiresReservation: recordAt(hermesOpenclawRuntime, "sourceContract")?.ledgerTerminalRequiresReservation === true,
      ledgerStoresTerminalDigestOnly: recordAt(hermesOpenclawRuntime, "sourceContract")?.ledgerStoresTerminalDigestOnly === true,
      liveExecutionClaimed: recordAt(hermesOpenclawRuntime, "liveExecutionReadiness")?.claimed === true,
      exactSavedShareVerdict: asString(recordAt(hermesOpenclawRuntime, "remainingBoundaries")?.exactSavedShareVerdict),
      authenticatedHermesCanary: asString(recordAt(hermesOpenclawRuntime, "remainingBoundaries")?.authenticatedHermesCanary),
    },
    liveDocumentSecondaryGrounding: {
      artifact: ARTIFACTS.liveDocumentSecondaryGrounding,
      verdict: isRecord(liveDocumentSecondaryGrounding) ? asString(liveDocumentSecondaryGrounding.verdict) : "missing",
      sourceHead: isRecord(liveDocumentSecondaryGrounding) ? asString(liveDocumentSecondaryGrounding.sourceHead) : "",
      productionCommit: extractProductionCommit(liveDocumentSecondaryGrounding),
      livePassed: asNumber(recordAt(recordAt(liveDocumentSecondaryGrounding, "stages"), "afterLive")?.pass),
      liveFailed: asNumber(recordAt(recordAt(liveDocumentSecondaryGrounding, "stages"), "afterLive")?.fail),
      secondaryReviewed: asNumber(recordAt(recordAt(liveDocumentSecondaryGrounding, "stages"), "afterLive")?.secondaryReviewed),
      secondaryPassed: asNumber(recordAt(recordAt(liveDocumentSecondaryGrounding, "stages"), "afterLive")?.secondaryPassed),
      crossScenarioLeakageCount: asNumber(recordAt(recordAt(liveDocumentSecondaryGrounding, "stages"), "afterLive")?.crossScenarioLeakageCount),
      missingUnexpectedCount: asNumber(recordAt(recordAt(liveDocumentSecondaryGrounding, "stages"), "afterLive")?.missingUnexpectedCount),
      dbMutationPerformed: recordAt(liveDocumentSecondaryGrounding, "mutationBoundary")?.dbMutationPerformed === true,
      shareSessionCreated: recordAt(liveDocumentSecondaryGrounding, "mutationBoundary")?.shareSessionCreated === true,
      providerDispatchCalled: recordAt(liveDocumentSecondaryGrounding, "mutationBoundary")?.providerDispatchCalled === true,
      exactSavedShareReproduced: recordAt(liveDocumentSecondaryGrounding, "mutationBoundary")?.exactSavedShareReproduced === true,
      exactSavedShareVerdict: asString(recordAt(liveDocumentSecondaryGrounding, "mutationBoundary")?.exactSavedShareVerdict),
    },
    liveDocumentSeedProfileIsolation: {
      artifact: ARTIFACTS.liveDocumentSeedProfileIsolation,
      verdict: isRecord(liveDocumentSeedProfileIsolation) ? asString(liveDocumentSeedProfileIsolation.verdict) : "missing",
      sourceHead: isRecord(liveDocumentSeedProfileIsolation) ? asString(liveDocumentSeedProfileIsolation.sourceHead) : "",
      productionCommit: extractProductionCommit(liveDocumentSeedProfileIsolation),
      productCommit: isRecord(liveDocumentSeedProfileIsolation) ? asString(liveDocumentSeedProfileIsolation.productCommit) : "",
      beforePassed: asNumber(recordAt(liveDocumentSeedProfileIsolation, "beforeLive")?.pass),
      beforeFailed: asNumber(recordAt(liveDocumentSeedProfileIsolation, "beforeLive")?.fail),
      beforeSeedProfileLeakageCount: asNumber(recordAt(liveDocumentSeedProfileIsolation, "beforeLive")?.seedProfileLeakageCount),
      livePassed: asNumber(recordAt(liveDocumentSeedProfileIsolation, "afterLive")?.pass),
      liveFailed: asNumber(recordAt(liveDocumentSeedProfileIsolation, "afterLive")?.fail),
      liveSeedProfileLeakageCount: asNumber(recordAt(liveDocumentSeedProfileIsolation, "afterLive")?.seedProfileLeakageCount),
      reviewedDocumentSurfaceCount: asNumber(recordAt(liveDocumentSeedProfileIsolation, "contract")?.reviewedDocumentSurfaceCount),
      secondaryGroundingPassed: asNumber(recordAt(liveDocumentSeedProfileIsolation, "afterLive")?.secondaryGroundingPassed),
      secondaryGroundingReviewed: asNumber(recordAt(liveDocumentSeedProfileIsolation, "afterLive")?.secondaryGroundingReviewed),
      dbMutationPerformed: recordAt(liveDocumentSeedProfileIsolation, "mutationBoundary")?.dbMutationPerformed === true,
      shareSessionCreated: recordAt(liveDocumentSeedProfileIsolation, "mutationBoundary")?.shareSessionCreated === true,
      providerDispatchCalled: recordAt(liveDocumentSeedProfileIsolation, "mutationBoundary")?.providerDispatchCalled === true,
      exactSavedShareReproduced: recordAt(liveDocumentSeedProfileIsolation, "mutationBoundary")?.exactSavedShareReproduced === true,
      exactSavedShareVerdict: asString(recordAt(liveDocumentSeedProfileIsolation, "mutationBoundary")?.exactSavedShareEvidence),
    },
    providerDispatchPersistence: {
      artifact: ARTIFACTS.providerDispatchIdempotency,
      status: isRecord(providerDispatchIdempotency) ? asString(providerDispatchIdempotency.status) : "missing",
      mode: asString(recordAt(providerDispatchIdempotency, "liveDispatchState")?.mode),
      reason: asString(recordAt(providerDispatchIdempotency, "liveDispatchState")?.reason),
      draftScope: asString(recordAt(providerDispatchIdempotency, "draftMigration")?.scope),
      channelLevelExactlyOnceProven: recordAt(providerDispatchIdempotency, "channelResultPersistence")?.channelLevelExactlyOnceProven === true,
      providerMessageSent: recordAt(providerDispatchIdempotency, "safetyLocks")?.providerMessageSent === true,
      liveDispatchUnlocked: recordAt(providerDispatchIdempotency, "safetyLocks")?.liveDispatchUnlocked === true,
    },
    approvalRunway: {
      artifact: ARTIFACTS.approvalRunway,
      overall: isRecord(approvalRunway) ? asString(approvalRunway.overall) : "missing",
      gateCount: isRecord(approvalRunway) && Array.isArray(approvalRunway.approvalGates)
        ? approvalRunway.approvalGates.length
        : null,
      launchReadiness: isRecord(approvalRunway) ? approvalRunway.launchReadiness === true : null,
      dbMutationPerformed: isRecord(approvalRunway) ? approvalRunway.dbMutationPerformed === true : null,
      providerMessageSent: isRecord(approvalRunway) ? approvalRunway.providerMessageSent === true : null,
      embeddingGenerated: isRecord(approvalRunway) ? approvalRunway.embeddingGenerated === true : null,
      uploaded: isRecord(approvalRunway) ? approvalRunway.uploaded === true : null,
    },
    final99: {
      artifact: ARTIFACTS.final99,
      overall: isRecord(final99) ? asString(final99.overall) : "missing",
      productionCommit: extractProductionCommit(final99),
      noticeCarry: final99Notices,
    },
    kosha: {
      artifact: ARTIFACTS.kosha,
      verdict: isRecord(kosha) ? asString(kosha.verdict) : "missing",
      exactPins: koshaCoveredExactPins.length
        ? koshaCoveredExactPins
        : isRecord(koshaExactTrustRegistry) && Array.isArray(koshaExactTrustRegistry.stableDocumentKeys)
          ? koshaExactTrustRegistry.stableDocumentKeys
          : [],
      localCorpusItems: isRecord(koshaLocalCorpus) ? koshaLocalCorpus.itemCount : null,
    },
    evidence,
    contradictions,
    safeDemoClaims: isRecord(openGate) && Array.isArray(openGate.safeDemoClaims) ? openGate.safeDemoClaims : [],
    forbiddenClaims: isRecord(openGate) && Array.isArray(openGate.forbiddenClaims) ? openGate.forbiddenClaims : [],
  };
}

/**
 * @param {ReturnType<typeof buildNorthstarLiveRollup>} rollup
 */
export function renderNorthstarLiveRollupMarkdown(rollup) {
  const lines = [
    "# SafeClaw North Star Live Rollup",
    "",
    `Generated at: ${rollup.generatedAt}`,
    `Source HEAD at generation: ${rollup.head}`,
    `Live commit at generation: ${isRecord(rollup.liveBuildInfo) ? asString(rollup.liveBuildInfo.commitSha) : ""}`,
    "",
    "Note: this artifact is generated before it is committed. The containing Git commit and deployed build must be verified through `git log` and `/api/build-info` after push.",
    `Overall: \`${rollup.overall}\``,
    "",
    "## Current Workspace Mobile Geometry",
    "",
    `- Verdict: \`${rollup.mobileP0.verdict}\``,
    `- Geometry artifact: ${rollup.mobileP0.currentGeometryArtifact}`,
    `- Documents: ${rollup.mobileP0.documentsBodyHeight ?? "unknown"}/${rollup.mobileP0.documentsViewportHeight ?? "unknown"} (${rollup.mobileP0.documentsHeightRatio}x viewport), workbench bottom=${rollup.mobileP0.documentWorkbenchBottom}, first useful y=${rollup.mobileP0.firstUsefulReviewY}`,
    `- Deep review closed: ${rollup.mobileP0.documentDeepReviewOpen === false ? "yes" : "no"}`,
    `- Visible full previews while closed: ${rollup.mobileP0.visibleDocumentPreviews}`,
    `- Share: ${rollup.mobileP0.shareBodyHeight ?? "unknown"}/${rollup.mobileP0.shareViewportHeight ?? "unknown"} (${rollup.mobileP0.shareHeightRatio}x viewport), root bottom=${rollup.mobileP0.shareRootBottom}, preview bottom=${rollup.mobileP0.sharePreviewBottom}, preview y=${rollup.mobileP0.sharePreviewY}`,
    "",
    "## Document Authoring Pane Margin",
    "",
    `- Verdict: \`${rollup.documentAuthoringPaneMargin.verdict}\``,
    `- Product/production commit: ${rollup.documentAuthoringPaneMargin.productCommit || "missing"}/${rollup.documentAuthoringPaneMargin.productionCommit || "missing"}`,
    `- Rows below 16px pane margin: ${rollup.documentAuthoringPaneMargin.beforeBelowMargin ?? "unknown"} -> ${rollup.documentAuthoringPaneMargin.liveBelowMargin ?? "unknown"}`,
    `- Live minimum pane margin / maximum shell ratio: ${rollup.documentAuthoringPaneMargin.liveMinimumMargin ?? "unknown"}px / ${rollup.documentAuthoringPaneMargin.liveMaximumShellRatio ?? "unknown"}`,
    `- Exact saved Share: ${rollup.documentAuthoringPaneMargin.exactSavedShareVerdict || "MISSING_EVIDENCE"}`,
    "",
    "## Dispatch Standalone Cockpit",
    "",
    `- Verdict: \`${rollup.dispatchStandaloneCockpit.verdict}\``,
    `- Page height: ${rollup.dispatchStandaloneCockpit.pageHeight}px (${rollup.dispatchStandaloneCockpit.heightRatio}x viewport)`,
    `- Preview bottom: ${rollup.dispatchStandaloneCockpit.previewBottom}`,
    `- Primary CTA bottom: ${rollup.dispatchStandaloneCockpit.primaryBottom}`,
    `- Horizontal overflow: ${rollup.dispatchStandaloneCockpit.horizontalOverflow}`,
    `- Viewport companion: \`${rollup.dispatchStandaloneCockpit.viewportCompanionVerdict}\``,
    `- Desktop-short preview/primary bottom: ${rollup.dispatchStandaloneCockpit.desktopShort?.previewBottom ?? "unknown"}/${rollup.dispatchStandaloneCockpit.desktopShort?.primaryBottom ?? "unknown"}`,
    `- Mobile-short Day/Night primary bottom: ${rollup.dispatchStandaloneCockpit.mobileShortDay?.primaryBottom ?? "unknown"}/${rollup.dispatchStandaloneCockpit.mobileShortNight?.primaryBottom ?? "unknown"}`,
    `- Exact saved Share: ${rollup.dispatchStandaloneCockpit.exactSavedShareVerdict || "MISSING_EVIDENCE"}`,
    "",
    "## Live Multi-Scenario Document Quality",
    "",
    `- Verdict: \`${rollup.liveDocumentQualityMatrix.verdict}\``,
    `- Live scenarios passed: ${rollup.liveDocumentQualityMatrix.livePassed ?? "unknown"}/${rollup.liveDocumentQualityMatrix.scenarioCount ?? "unknown"}; failed=${rollup.liveDocumentQualityMatrix.liveFailed ?? "unknown"}`,
    `- Structured controls distinct: ${rollup.liveDocumentQualityMatrix.structuredRiskControlsDistinct}`,
    `- Foreign-worker scenario relevance: ${rollup.liveDocumentQualityMatrix.foreignWorkerScenarioRelevance}`,
    `- DB mutation: ${rollup.liveDocumentQualityMatrix.dbMutationPerformed}; provider dispatch claimed: ${rollup.liveDocumentQualityMatrix.providerDispatchLiveClaimed}`,
    "",
    "## Live High-Risk Document Quality Stress Matrix",
    "",
    `- Verdict: \`${rollup.liveDocumentQualityStressMatrix.verdict}\``,
    `- Live scenarios passed: ${rollup.liveDocumentQualityStressMatrix.livePassed ?? "unknown"}/5; failed=${rollup.liveDocumentQualityStressMatrix.liveFailed ?? "unknown"}`,
    `- Product commit included in production: ${rollup.liveDocumentQualityStressMatrix.productCommitIncludedInProduction}`,
    `- DB mutation: ${rollup.liveDocumentQualityStressMatrix.dbMutationPerformed}; provider dispatch: ${rollup.liveDocumentQualityStressMatrix.providerDispatchPerformed}`,
    "",
    "## Live Document Scenario Field Isolation",
    "",
    `- Verdict: \`${rollup.liveDocumentFieldIsolation.verdict}\``,
    `- Live scenarios passed: ${rollup.liveDocumentFieldIsolation.livePassed ?? "unknown"}/10; failed=${rollup.liveDocumentFieldIsolation.liveFailed ?? "unknown"}`,
    `- Live pending: ${rollup.liveDocumentFieldIsolation.liveAfterDeploymentPending}`,
    `- DB mutation: ${rollup.liveDocumentFieldIsolation.dbMutationPerformed}; provider dispatch: ${rollup.liveDocumentFieldIsolation.providerDispatchCalled}`,
    "",
    "## Live Synthetic Document Wording Review",
    "",
    `- Verdict: \`${rollup.liveDocumentWordingReview.verdict}\``,
    `- Live scenarios passed: ${rollup.liveDocumentWordingReview.livePassed ?? "unknown"}/5; failed=${rollup.liveDocumentWordingReview.liveFailed ?? "unknown"}`,
    `- Live after-deployment pending: ${rollup.liveDocumentWordingReview.liveAfterDeploymentPending}`,
    `- DB mutation: ${rollup.liveDocumentWordingReview.dbMutationPerformed}; provider dispatch: ${rollup.liveDocumentWordingReview.providerDispatchCalled}`,
    "",
    "## Live 12-Deliverable Broad Review",
    "",
    `- Verdict: \`${rollup.liveDocumentBroadReview.verdict}\``,
    `- UI / integrity / reviewed documents: ${rollup.liveDocumentBroadReview.uiDocumentCount}/${rollup.liveDocumentBroadReview.integrityRequiredCount}/${rollup.liveDocumentBroadReview.reviewedDocumentCount}`,
    `- Before remediation: pass=${rollup.liveDocumentBroadReview.beforePassed}, fail=${rollup.liveDocumentBroadReview.beforeFailed}, missingUnexpected=${rollup.liveDocumentBroadReview.beforeMissingUnexpected}`,
    `- Live after remediation: pass=${rollup.liveDocumentBroadReview.livePassed}, fail=${rollup.liveDocumentBroadReview.liveFailed}, missingUnexpected=${rollup.liveDocumentBroadReview.liveMissingUnexpected}`,
    `- workPermitDraft presentNonEmpty: ${rollup.liveDocumentBroadReview.workPermitPresentNonEmpty}/5`,
    `- DB mutation: ${rollup.liveDocumentBroadReview.dbMutationPerformed}; Share session created: ${rollup.liveDocumentBroadReview.shareSessionCreated}; provider dispatch: ${rollup.liveDocumentBroadReview.providerDispatchCalled}`,
    `- Exact saved Share: ${rollup.liveDocumentBroadReview.exactSavedShareVerdict || "MISSING_EVIDENCE"}; reproduced=${rollup.liveDocumentBroadReview.exactSavedShareReproduced}`,
    "- Boundary: the six-document synthetic wording gate is not 12-document deliverable coverage.",
    "",
    "## Live 12-Deliverable Editorial Contract Review",
    "",
    `- Verdict: \`${rollup.liveDocumentEditorialReview.verdict}\``,
    `- Live scenarios passed: ${rollup.liveDocumentEditorialReview.livePassed ?? "unknown"}/${rollup.liveDocumentEditorialReview.scenarioCount ?? "unknown"}; failed=${rollup.liveDocumentEditorialReview.liveFailed ?? "unknown"}`,
    `- Reviewed document surface: ${rollup.liveDocumentEditorialReview.reviewedDocumentSurfaceCount}; placeholder=${rollup.liveDocumentEditorialReview.placeholderFindingCount}, legal=${rollup.liveDocumentEditorialReview.legalOverclaimFindingCount}, awkward=${rollup.liveDocumentEditorialReview.awkwardCompositionFindingCount}, evidence mismatch=${rollup.liveDocumentEditorialReview.evidenceDomainMismatchCount}`,
    `- Duplicate findings retained for human review: exact=${rollup.liveDocumentEditorialReview.exactLineOveruseCount}, near=${rollup.liveDocumentEditorialReview.nearDuplicateLineOveruseCount}; human review completed=${rollup.liveDocumentEditorialReview.humanReviewCompleted}`,
    `- DB mutation: ${rollup.liveDocumentEditorialReview.dbMutationPerformed}; Share session created: ${rollup.liveDocumentEditorialReview.shareSessionCreated}; provider dispatch: ${rollup.liveDocumentEditorialReview.providerDispatchCalled}`,
    `- Exact saved Share: ${rollup.liveDocumentEditorialReview.exactSavedShareVerdict || "MISSING_EVIDENCE"}; reproduced=${rollup.liveDocumentEditorialReview.exactSavedShareReproduced}`,
    "- Boundary: this automated reviewer-ready contract does not combine the six-core wording and 12-deliverable presence gates into completed human review.",
    "",
    "## Live 12-Document Human Editorial Review Cockpit",
    "",
    `- Verdict: \`${rollup.documentEditorialReviewCockpit.verdict}\``,
    `- Live geometry: pass=${rollup.documentEditorialReviewCockpit.livePassed}/4, fail=${rollup.documentEditorialReviewCockpit.liveFailed}; documents/checks=${rollup.documentEditorialReviewCockpit.canonicalDocumentCount}/${rollup.documentEditorialReviewCockpit.reviewerCheckCount}; desktop/mobile zones=${rollup.documentEditorialReviewCockpit.desktopZones}/${rollup.documentEditorialReviewCockpit.mobileColumns}`,
    `- Keyboard and screen reader: cases=${rollup.documentEditorialReviewCockpit.accessibilityRowsPassed}/4; roving tabs=${rollup.documentEditorialReviewCockpit.keyboardRovingTabNavigation}; labelled tabpanel=${rollup.documentEditorialReviewCockpit.screenReaderTabPanelContract}; Escape focus restore=${rollup.documentEditorialReviewCockpit.escapeRestoresLaunchFocus}; cockpit ready=${rollup.documentEditorialReviewCockpit.cockpitReady}`,
    `- Human review completed: ${rollup.documentEditorialReviewCockpit.humanReviewCompleted}; broad human wording review required: ${rollup.documentEditorialReviewCockpit.broadHumanWordingReviewRequired}`,
    `- Mutations DB/provider/Share/vector/wiki/KOSHA: ${rollup.documentEditorialReviewCockpit.dbMutationPerformed}/${rollup.documentEditorialReviewCockpit.providerDispatchCalled}/${rollup.documentEditorialReviewCockpit.shareSessionCreated}/${rollup.documentEditorialReviewCockpit.vectorRuntimeCalled}/${rollup.documentEditorialReviewCockpit.wikiPublished}/${rollup.documentEditorialReviewCockpit.koshaRegistryMutationPerformed}; exact saved Share: ${rollup.documentEditorialReviewCockpit.exactSavedShareVerdict || "MISSING_EVIDENCE"}`,
    "- Boundary: this proves a bounded, local, stale-aware human-review workflow exists; automated browser interaction is not human completion.",
    "",
    "## Live Editorial Duplicate Classification",
    "",
    `- Verdict: \`${rollup.liveDocumentEditorialDuplicateClassification.verdict}\``,
    `- Generic template overuse: ${rollup.liveDocumentEditorialDuplicateClassification.beforeGenericTemplateOveruseCount}->${rollup.liveDocumentEditorialDuplicateClassification.liveGenericTemplateOveruseCount}`,
    `- Reviewer findings retained: exact=${rollup.liveDocumentEditorialDuplicateClassification.exactLineOveruseCount}, near=${rollup.liveDocumentEditorialDuplicateClassification.nearDuplicateLineOveruseCount}; human review completed=${rollup.liveDocumentEditorialDuplicateClassification.humanReviewCompleted}`,
    `- DB mutation: ${rollup.liveDocumentEditorialDuplicateClassification.dbMutationPerformed}; Share session created: ${rollup.liveDocumentEditorialDuplicateClassification.shareSessionCreated}; provider dispatch: ${rollup.liveDocumentEditorialDuplicateClassification.providerDispatchCalled}`,
    `- Exact saved Share: ${rollup.liveDocumentEditorialDuplicateClassification.exactSavedShareVerdict || "MISSING_EVIDENCE"}; reproduced=${rollup.liveDocumentEditorialDuplicateClassification.exactSavedShareReproduced}`,
    "- Boundary: only generic template overuse fails automatically; safety-control and legal-reference repetition remains reviewer-visible.",
    "",
    "## Live Editorial Near-Duplicate Classification",
    "",
    `- Verdict: \`${rollup.liveDocumentEditorialNearClassification.verdict}\``,
    `- Near findings retained: ${rollup.liveDocumentEditorialNearClassification.beforeNearDuplicateLineOveruseCount}->${rollup.liveDocumentEditorialNearClassification.liveNearDuplicateLineOveruseCount}`,
    `- Unclassified human-review-required: ${rollup.liveDocumentEditorialNearClassification.beforeHumanReviewRequiredCount}->${rollup.liveDocumentEditorialNearClassification.liveHumanReviewRequiredCount}`,
    `- Classified as role-prefix/context/hazard/control: ${rollup.liveDocumentEditorialNearClassification.rolePrefixVariantCount}/${rollup.liveDocumentEditorialNearClassification.independentContextCount}/${rollup.liveDocumentEditorialNearClassification.hazardConsistencyCount}/${rollup.liveDocumentEditorialNearClassification.controlConsistencyCount}`,
    `- Human review completed: ${rollup.liveDocumentEditorialNearClassification.humanReviewCompleted}; exact saved Share: ${rollup.liveDocumentEditorialNearClassification.exactSavedShareVerdict || "MISSING_EVIDENCE"}`,
    "- Boundary: classification improves reviewer precision without hiding findings or claiming completed human review.",
    "",
    "## Public Generation Admission Security",
    "",
    `- Verdict: \`${rollup.publicGenerationAdmissionSecurity.verdict}\``,
    `- Live admission mode: ${rollup.publicGenerationAdmissionSecurity.liveMode || "unknown"}; distributed hardening open=${rollup.publicGenerationAdmissionSecurity.distributedHardeningOpen}`,
    `- Dependency audit vulnerabilities: ${rollup.publicGenerationAdmissionSecurity.vulnerabilityCount ?? "unknown"}`,
    `- Fresh diff scan required: ${rollup.publicGenerationAdmissionSecurity.freshRescanRequired}`,
    `- Exact saved Share: ${rollup.publicGenerationAdmissionSecurity.exactSavedShareVerdict || "MISSING_EVIDENCE"}`,
    "",
    "## Security Follow-up Remediation",
    "",
    `- Verdict: \`${rollup.securityFollowupRemediation.verdict}\``,
    `- Sealed findings remediated: ${rollup.securityFollowupRemediation.sealedFindingCount ?? "unknown"}; focused tests: ${rollup.securityFollowupRemediation.focusedTests ?? "unknown"}`,
    `- Immutable original baseline: ${rollup.securityFollowupRemediation.immutableOriginalBaselineFindingCount ?? "unknown"}; rewritten=${rollup.securityFollowupRemediation.originalBaselineRewritten}`,
    `- Deferred candidates retained: ${rollup.securityFollowupRemediation.deferredCandidateCount ?? "unknown"}; live provider cancellation probe executed=${rollup.securityFollowupRemediation.liveProviderCancellationProbeExecuted}`,
    `- Exact saved Share: ${rollup.securityFollowupRemediation.exactSavedShareVerdict || "MISSING_EVIDENCE"}`,
    "",
    "## Current Security Remediation Ledger",
    `- Verdict: \`${rollup.currentSecurityRemediationLedger.verdict}\``,
    `- Current finding set: ${rollup.currentSecurityRemediationLedger.totalFindings ?? "unknown"}; deployed-source remediation receipts: ${rollup.currentSecurityRemediationLedger.deployedSourceRemediationCount ?? "unknown"}; unresolved: ${rollup.currentSecurityRemediationLedger.unresolvedCount ?? "unknown"}`,
    `- Approval-gated: ${rollup.currentSecurityRemediationLedger.approvalGatedCount ?? "unknown"}; distributed runtime open: ${rollup.currentSecurityRemediationLedger.distributedRuntimeOpenCount ?? "unknown"}; security-complete=${rollup.currentSecurityRemediationLedger.securityCompleteClaimAllowed}`,
    `- Exact saved Share: ${rollup.currentSecurityRemediationLedger.exactSavedShareVerdict || "MISSING_EVIDENCE"}`,
    "",
    "## Atomic Database Race Approval Boundary",
    `- Verdict: \`${rollup.securityAtomicDbRaceRemediation.verdict}\``,
    `- Sealed scan/findings still open: ${rollup.securityAtomicDbRaceRemediation.scanId || "missing"} / ${rollup.securityAtomicDbRaceRemediation.openFindingCount ?? "unknown"}`,
    `- Approval required/performed: ${rollup.securityAtomicDbRaceRemediation.approvalRequired}/${rollup.securityAtomicDbRaceRemediation.approvalPerformed}`,
    `- Migration authored: ${rollup.securityAtomicDbRaceRemediation.migrationAuthored}; DB mutation performed: ${rollup.securityAtomicDbRaceRemediation.dbMutationPerformed}`,
    `- Fresh scan required: ${rollup.securityAtomicDbRaceRemediation.freshRescanRequired}; security-complete=${rollup.securityAtomicDbRaceRemediation.securityCompleteClaimAllowed}`,
    `- Exact saved Share: ${rollup.securityAtomicDbRaceRemediation.exactSavedShareVerdict || "MISSING_EVIDENCE"}`,
    "",
    "## Live Documents / Workspace Share Route Perception",
    "",
    `- Verdict: \`${rollup.liveDocumentsShareRoutePerception.verdict}\``,
    `- Source / production: \`${rollup.liveDocumentsShareRoutePerception.sourceHead || "missing"}\` / \`${rollup.liveDocumentsShareRoutePerception.productionCommit || "missing"}\``,
    `- Measured rows Documents/Share: ${rollup.liveDocumentsShareRoutePerception.documentsRows}/${rollup.liveDocumentsShareRoutePerception.workspaceShareRows}; desktop Share regions: ${rollup.liveDocumentsShareRoutePerception.desktopShareRegions ?? "unknown"}`,
    `- Route split alone accepted: ${rollup.liveDocumentsShareRoutePerception.routeSplitAloneAcceptedAsFix}; DB mutation: ${rollup.liveDocumentsShareRoutePerception.dbMutationPerformed}`,
    `- Exact saved session reproduced: ${rollup.liveDocumentsShareRoutePerception.exactSavedUserSessionReproduced}; verdict: ${rollup.liveDocumentsShareRoutePerception.exactSavedShareVerdict || "MISSING_EVIDENCE"}`,
    "",
    "## Deployment Freshness Guard",
    `- Verdict: \`${rollup.deploymentFreshnessGuard.verdict}\``,
    `- Source / production: \`${rollup.deploymentFreshnessGuard.sourceHead || "missing"}\` / \`${rollup.deploymentFreshnessGuard.productionCommit || "missing"}\``,
    `- Current notice / drift refresh visible: ${rollup.deploymentFreshnessGuard.currentNoticePresent}/${rollup.deploymentFreshnessGuard.driftRefreshVisible}; frontend audit violations: ${rollup.deploymentFreshnessGuard.frontendAuditViolations ?? "unknown"}`,
    `- Live pending: ${rollup.deploymentFreshnessGuard.liveAfterDeploymentPending}; DB mutation: ${rollup.deploymentFreshnessGuard.dbMutationPerformed}; exact saved Share: ${rollup.deploymentFreshnessGuard.exactSavedShareVerdict || "MISSING_EVIDENCE"}`,
    "",
    "## Security Resource Remediation",
    `- Verdict: \`${rollup.securityResourceRemediation.verdict}\``,
    `- Fresh sealed findings: ${rollup.securityResourceRemediation.scanFindingCount ?? "unknown"}; remediated: ${rollup.securityResourceRemediation.remediatedFindingCount ?? "unknown"}; remaining: ${rollup.securityResourceRemediation.remainingScanFindings ?? "unknown"}`,
    `- Provider persistence: ${rollup.securityResourceRemediation.providerDispatchPersistence || "unknown"}; exact saved Share: ${rollup.securityResourceRemediation.exactSavedShareVerdict || "MISSING_EVIDENCE"}`,
    "",
    "## Security Upstream Transport Remediation",
    `- Verdict: \`${rollup.securityUpstreamTransportRemediation.verdict}\``,
    `- Fresh sealed findings: ${rollup.securityUpstreamTransportRemediation.scanFindingCount ?? "unknown"}; remediated this wave: ${rollup.securityUpstreamTransportRemediation.remediatedThisWave ?? "unknown"}; cumulative: ${rollup.securityUpstreamTransportRemediation.remediatedTotal ?? "unknown"}; remaining: ${rollup.securityUpstreamTransportRemediation.remainingScanFindings ?? "unknown"}`,
    `- External provider probe executed: ${rollup.securityUpstreamTransportRemediation.externalProviderProbeExecuted}; provider persistence: ${rollup.securityUpstreamTransportRemediation.providerDispatchPersistence || "unknown"}; exact saved Share: ${rollup.securityUpstreamTransportRemediation.exactSavedShareVerdict || "MISSING_EVIDENCE"}`,
    "",
    "## Security Safety-reference Surface Remediation",
    `- Verdict: \`${rollup.securitySafetyReferenceSurfaceRemediation.verdict}\``,
    `- Fresh sealed findings: ${rollup.securitySafetyReferenceSurfaceRemediation.scanFindingCount ?? "unknown"}; remediated this wave: ${rollup.securitySafetyReferenceSurfaceRemediation.remediatedThisWave ?? "unknown"}; cumulative: ${rollup.securitySafetyReferenceSurfaceRemediation.remediatedTotal ?? "unknown"}; remaining: ${rollup.securitySafetyReferenceSurfaceRemediation.remainingScanFindings ?? "unknown"}`,
    `- Live public items: ${rollup.securitySafetyReferenceSurfaceRemediation.liveReturnedItems ?? "unknown"}; body/payload/metadata fields: ${rollup.securitySafetyReferenceSurfaceRemediation.publicBodyFieldCount ?? "unknown"}/${rollup.securitySafetyReferenceSurfaceRemediation.publicPayloadFieldCount ?? "unknown"}/${rollup.securitySafetyReferenceSurfaceRemediation.publicMetadataFieldCount ?? "unknown"}; rate limit: ${rollup.securitySafetyReferenceSurfaceRemediation.rateLimitMode || "unknown"}`,
    `- Provider persistence: ${rollup.securitySafetyReferenceSurfaceRemediation.providerDispatchPersistence || "unknown"}; exact saved Share: ${rollup.securitySafetyReferenceSurfaceRemediation.exactSavedShareVerdict || "MISSING_EVIDENCE"}`,
    "",
    "## Public JSON Request Body Budget",
    "",
    `- Verdict: \`${rollup.publicJsonRequestBodyBudget.verdict}\``,
    `- Live oversized-request cases: ${rollup.publicJsonRequestBodyBudget.liveCaseCount}; finding: ${rollup.publicJsonRequestBodyBudget.findingId || "missing"}`,
    `- Follow-up scan: ${rollup.publicJsonRequestBodyBudget.followUpSecurityScan || "REQUIRED"}; security-complete=${rollup.publicJsonRequestBodyBudget.securityCompleteClaimAllowed}`,
    `- Exact saved Share: ${rollup.publicJsonRequestBodyBudget.exactSavedShareVerdict || "MISSING_EVIDENCE"}`,
    "",
    "## Improvement Photo Analysis Budget",
    "",
    `- Verdict: \`${rollup.improvementPhotoAnalysisBudget.verdict}\``,
    `- Request budget: ${rollup.improvementPhotoAnalysisBudget.maxRequestBytes ?? "unknown"} bytes; aggregate concurrency=${rollup.improvementPhotoAnalysisBudget.aggregateConcurrency ?? "unknown"}`,
    `- Live admission cases: ${rollup.improvementPhotoAnalysisBudget.liveCaseCount}; mode=${rollup.improvementPhotoAnalysisBudget.distributedProductionActivation || "unknown"}`,
    `- Follow-up scan: ${rollup.improvementPhotoAnalysisBudget.followUpSecurityScan || "REQUIRED"}; security-complete=${rollup.improvementPhotoAnalysisBudget.securityCompleteClaimAllowed}`,
    `- Exact saved Share: ${rollup.improvementPhotoAnalysisBudget.exactSavedShareVerdict || "MISSING_EVIDENCE"}`,
    "",
    "## Public provider cancellation",
    `- Verdict: \`${rollup.publicProviderCancellation.verdict}\``,
    `- Finding: \`${rollup.publicProviderCancellation.findingId || "missing"}\`; tests=${rollup.publicProviderCancellation.tests ?? "unknown"}`,
    `- Live provider cancellation call executed: ${rollup.publicProviderCancellation.liveProviderCallExecuted}`,
    `- Follow-up scan: ${rollup.publicProviderCancellation.followUpSecurityScan || "REQUIRED"}; security-complete=${rollup.publicProviderCancellation.securityCompleteClaimAllowed}`,
    `- Exact saved Share: ${rollup.publicProviderCancellation.exactSavedShareVerdict || "MISSING_EVIDENCE"}`,
    "",
    "## Public provider admission",
    `- Verdict: \`${rollup.publicProviderAdmission.verdict}\``,
    `- Findings: ${rollup.publicProviderAdmission.findingCount}; capacity=${rollup.publicProviderAdmission.capacity ?? "unknown"}; full weight=${rollup.publicProviderAdmission.fullModeWeight ?? "unknown"}`,
    `- Live no-provider cases: ${rollup.publicProviderAdmission.liveCaseCount}; distributed activation=${rollup.publicProviderAdmission.distributedProductionActivation || "PENDING_CONFIGURATION"}`,
    `- Follow-up scan: ${rollup.publicProviderAdmission.followUpSecurityScan || "REQUIRED"}; security-complete=${rollup.publicProviderAdmission.securityCompleteClaimAllowed}`,
    `- Exact saved Share: ${rollup.publicProviderAdmission.exactSavedShareVerdict || "MISSING_EVIDENCE"}`,
    "- Boundary: weighted process-instance admission is live; distributed multi-instance admission remains open.",
    "",
    "## Public Ask distributed admission",
    `- Verdict: \`${rollup.publicAskDistributedAdmission.verdict}\``,
    `- Finding: \`${rollup.publicAskDistributedAdmission.findingId || "missing"}\`; local/live cases=${rollup.publicAskDistributedAdmission.localCaseCount}/${rollup.publicAskDistributedAdmission.liveCaseCount}`,
    `- Provider call executed: ${rollup.publicAskDistributedAdmission.providerCallExecuted}; distributed activation=${rollup.publicAskDistributedAdmission.distributedBackendActivation || "OPERATOR_CONFIGURATION_REQUIRED"}`,
    `- Follow-up scan: ${rollup.publicAskDistributedAdmission.freshFollowUpScan || "REQUIRED"}; security-complete=${rollup.publicAskDistributedAdmission.securityCompleteClaimAllowed}`,
    `- Exact saved Share: ${rollup.publicAskDistributedAdmission.exactSavedShareVerdict || "MISSING_EVIDENCE"}`,
    "- Boundary: this proves deployed JSON/SSE fail-closed behavior without a provider call; it does not prove a configured distributed backend or close the immutable finding.",
    "",
    "## Repository Security Scan Reconciliation",
    "",
    `- Verdict: \`${rollup.repositorySecurityScanReconciliation.verdict}\``,
    `- Same-target sealed scans: ${rollup.repositorySecurityScanReconciliation.conflictingScanCount ?? "unknown"}; finding delta=${rollup.repositorySecurityScanReconciliation.findingCountDelta ?? "unknown"}`,
    `- Fail-open receipt contradictions: ${rollup.repositorySecurityScanReconciliation.receiptContradictionCount ?? "unknown"}; zero-finding accepted=${rollup.repositorySecurityScanReconciliation.zeroFindingClaimAccepted}`,
    `- Corrected fresh scan: completed=${rollup.repositorySecurityScanReconciliation.correctedFreshScanCompleted}, id=${rollup.repositorySecurityScanReconciliation.correctedScanId || "missing"}, target=${rollup.repositorySecurityScanReconciliation.correctedTargetRevision || "missing"}, reportable=${rollup.repositorySecurityScanReconciliation.correctedReportableFindingCount ?? "unknown"}, deferred=${rollup.repositorySecurityScanReconciliation.correctedDeferredCandidateCount ?? "unknown"}, coverage=${rollup.repositorySecurityScanReconciliation.correctedCoverageCompleteness || "unknown"}, security-complete=${rollup.repositorySecurityScanReconciliation.securityCompleteClaimAllowed}`,
    `- Exact saved Share: ${rollup.repositorySecurityScanReconciliation.exactSavedShareVerdict || "MISSING_EVIDENCE"}`,
    "",
    "## MCP Generation Work-Budget Security",
    `- Verdict: \`${rollup.mcpGenerationWorkBudgetSecurity.verdict}\``,
    `- POST body budget: ${rollup.mcpGenerationWorkBudgetSecurity.postBodyMaxBytes ?? "unknown"} bytes; adjacent tests=${rollup.mcpGenerationWorkBudgetSecurity.adjacentTests ?? "unknown"}`,
    `- Valid authenticated runtime probe pending: ${rollup.mcpGenerationWorkBudgetSecurity.validAuthenticatedRuntimeProbeRequired}`,
    `- Distributed activation pending: ${rollup.mcpGenerationWorkBudgetSecurity.distributedActivationRequired}; fresh rescan required: ${rollup.mcpGenerationWorkBudgetSecurity.freshRescanRequired}`,
    `- Exact saved Share: ${rollup.mcpGenerationWorkBudgetSecurity.exactSavedShareVerdict || "MISSING_EVIDENCE"}`,
    "- Boundary: live instance admission is not a distributed multi-instance or canonical rescan closure claim.",
    "",
    "## Live Product Capability Truth",
    "",
    `- Verdict: \`${rollup.productCapabilityTruth.verdict}\``,
    `- Manual/provider dispatch: ${rollup.productCapabilityTruth.dispatchMode || "unknown"} (${rollup.productCapabilityTruth.dispatchReason || "unknown"}); provider called=${rollup.productCapabilityTruth.providerDispatchCalled}`,
    `- Scheduled briefing email ready: ${rollup.productCapabilityTruth.briefingEmailReady}`,
    `- Photo Vision/OCR ready: ${rollup.productCapabilityTruth.photoVisionReady}; accepted-only=${rollup.productCapabilityTruth.photoAcceptedOnly}; photo POST executed=${rollup.productCapabilityTruth.photoAnalysisPostCalled}`,
    `- AI generation modes: ${rollup.productCapabilityTruth.aiModes.join(", ") || "missing"}`,
    `- Exact saved Share: ${rollup.productCapabilityTruth.exactSavedShareVerdict || "MISSING_EVIDENCE"}`,
    `- Documents/Share IA: ${rollup.productCapabilityTruth.documentsShareIaVerdict || "OPEN_SEPARATE_VIEWPORT_IA_WAVE"}`,
    "- Boundary: capability truth does not unlock provider persistence, exact saved Share, or Documents/Share viewport IA.",
    "",
    "## Live Hermes Reviewer Authority UI",
    "",
    `- Verdict: \`${rollup.hermesKnowledgeReviewAuthorityUi.verdict}\``,
    `- Local/live viewport contracts: ${rollup.hermesKnowledgeReviewAuthorityUi.localPassed ?? 0}/${rollup.hermesKnowledgeReviewAuthorityUi.localViewportCount ?? 0} and ${rollup.hermesKnowledgeReviewAuthorityUi.livePassed ?? 0}/${rollup.hermesKnowledgeReviewAuthorityUi.liveViewportCount ?? 0}`,
    `- Authority order: ${rollup.hermesKnowledgeReviewAuthorityUi.sourceOrder.join(" -> ") || "missing"}`,
    `- Human review required: ${rollup.hermesKnowledgeReviewAuthorityUi.humanReviewRequired}; machine replaces human review=${rollup.hermesKnowledgeReviewAuthorityUi.machineEvidenceReplacesHumanReview}`,
    `- Tenant-memory public promotion: ${rollup.hermesKnowledgeReviewAuthorityUi.tenantMemoryPublicPromotionAllowed}; site-manager acceptance required=${rollup.hermesKnowledgeReviewAuthorityUi.siteManagerAcceptanceRequiredBeforeWorkpackUse}`,
    `- Selected-only workbench candidates/selected/body: ${rollup.hermesKnowledgeReviewAuthorityUi.candidateCount ?? 0}/${rollup.hermesKnowledgeReviewAuthorityUi.selectedCandidateCount ?? 0}/${rollup.hermesKnowledgeReviewAuthorityUi.selectedBodyCount ?? 0}; desktop/mobile columns=${rollup.hermesKnowledgeReviewAuthorityUi.desktopColumns ?? 0}/${rollup.hermesKnowledgeReviewAuthorityUi.mobileColumns ?? 0}; body internal scroll=${rollup.hermesKnowledgeReviewAuthorityUi.candidateBodyInternalScroll}`,
    `- Mutation boundary DB/provider/share/publication: ${rollup.hermesKnowledgeReviewAuthorityUi.dbMutationPerformed}/${rollup.hermesKnowledgeReviewAuthorityUi.providerDispatchCalled}/${rollup.hermesKnowledgeReviewAuthorityUi.shareSessionCreated}/${rollup.hermesKnowledgeReviewAuthorityUi.ontologyPublicationPerformed}`,
    `- Exact saved Share: ${rollup.hermesKnowledgeReviewAuthorityUi.exactSavedShareVerdict || "MISSING_EVIDENCE"}; LLM Wiki/RLS: ${rollup.hermesKnowledgeReviewAuthorityUi.llmWikiPublication || "APPROVAL_GATED"}/${rollup.hermesKnowledgeReviewAuthorityUi.supabaseRlsLaunchIsolation || "APPROVAL_GATED"}`,
    "",
    "## Live Hermes Evidence Inspector",
    "",
    `- Verdict: \`${rollup.hermesKnowledgeReviewEvidenceInspector.verdict}\``,
    `- Local/live viewport contracts: ${rollup.hermesKnowledgeReviewEvidenceInspector.localPassed ?? 0}/${rollup.hermesKnowledgeReviewEvidenceInspector.localViewportCount ?? 0} and ${rollup.hermesKnowledgeReviewEvidenceInspector.livePassed ?? 0}/${rollup.hermesKnowledgeReviewEvidenceInspector.liveViewportCount ?? 0}; browser errors=${rollup.hermesKnowledgeReviewEvidenceInspector.browserErrorCount ?? 0}`,
    `- Evidence budget/items/desktop columns/mobile panes: ${rollup.hermesKnowledgeReviewEvidenceInspector.itemLimit ?? 0}/${rollup.hermesKnowledgeReviewEvidenceInspector.fixtureItemCount ?? 0}/${rollup.hermesKnowledgeReviewEvidenceInspector.desktopEvidenceColumns ?? 0}/${rollup.hermesKnowledgeReviewEvidenceInspector.mobileMountedPaneCount ?? 0}`,
    `- Official HTTPS links/private identity exposed/internal scroll: ${rollup.hermesKnowledgeReviewEvidenceInspector.publicOfficialHttpsLinkCount ?? 0}/${rollup.hermesKnowledgeReviewEvidenceInspector.privateEvidenceRawIdentityExposed}/${rollup.hermesKnowledgeReviewEvidenceInspector.evidenceInternalScroll}`,
    `- Security complete: ${rollup.hermesKnowledgeReviewEvidenceInspector.securityComplete}; fresh full-repository scan required=${rollup.hermesKnowledgeReviewEvidenceInspector.freshFullRepositoryScanRequired}`,
    `- Exact saved Share: ${rollup.hermesKnowledgeReviewEvidenceInspector.exactSavedShareVerdict || "MISSING_EVIDENCE"}; Wiki/RLS/provider persistence: ${rollup.hermesKnowledgeReviewEvidenceInspector.llmWikiPublication || "APPROVAL_GATED"}/${rollup.hermesKnowledgeReviewEvidenceInspector.supabaseRlsLaunchIsolation || "APPROVAL_GATED"}/${rollup.hermesKnowledgeReviewEvidenceInspector.providerDispatchPersistence || "APPROVAL_GATED"}`,
    "",
    "## Hermes Remote Durable Ledger",
    "",
    `- Verdict: \`${rollup.hermesOpenclawRuntime.verdict}\``,
    `- Focused tests: ${rollup.hermesOpenclawRuntime.testFilesPassed ?? 0} files / ${rollup.hermesOpenclawRuntime.testsPassed ?? 0} tests`,
    `- Ledger wired/atomic/reservation-bound/digest-only: ${rollup.hermesOpenclawRuntime.durableAttemptLedgerWired}/${rollup.hermesOpenclawRuntime.ledgerAtomicReservation}/${rollup.hermesOpenclawRuntime.ledgerTerminalRequiresReservation}/${rollup.hermesOpenclawRuntime.ledgerStoresTerminalDigestOnly}`,
    `- Live authenticated execution claimed: ${rollup.hermesOpenclawRuntime.liveExecutionClaimed}; canary=${rollup.hermesOpenclawRuntime.authenticatedHermesCanary || "APPROVAL_GATED"}`,
    `- Exact saved Share: ${rollup.hermesOpenclawRuntime.exactSavedShareVerdict || "MISSING_EVIDENCE"}`,
    "",
    "## Live Secondary Document Grounding",
    "",
    `- Verdict: \`${rollup.liveDocumentSecondaryGrounding.verdict}\``,
    `- Live scenarios passed: ${rollup.liveDocumentSecondaryGrounding.livePassed ?? "unknown"}/5; failed=${rollup.liveDocumentSecondaryGrounding.liveFailed ?? "unknown"}`,
    `- Supporting documents passed: ${rollup.liveDocumentSecondaryGrounding.secondaryPassed ?? "unknown"}/${rollup.liveDocumentSecondaryGrounding.secondaryReviewed ?? "unknown"}`,
    `- Cross-scenario leakage: ${rollup.liveDocumentSecondaryGrounding.crossScenarioLeakageCount ?? "unknown"}; missingUnexpected=${rollup.liveDocumentSecondaryGrounding.missingUnexpectedCount ?? "unknown"}`,
    `- DB mutation: ${rollup.liveDocumentSecondaryGrounding.dbMutationPerformed}; Share session created: ${rollup.liveDocumentSecondaryGrounding.shareSessionCreated}; provider dispatch: ${rollup.liveDocumentSecondaryGrounding.providerDispatchCalled}`,
    `- Exact saved Share: ${rollup.liveDocumentSecondaryGrounding.exactSavedShareVerdict || "MISSING_EVIDENCE"}; reproduced=${rollup.liveDocumentSecondaryGrounding.exactSavedShareReproduced}`,
    "- Boundary: this six-secondary-document scenario-grounding contract is separate from the six-document wording gate, 12-document presence/applicability gate, broad human review, and exact saved Share evidence.",
    "",
    "## Live Document Seed-Profile Isolation",
    "",
    `- Verdict: \`${rollup.liveDocumentSeedProfileIsolation.verdict}\``,
    `- Before live: pass=${rollup.liveDocumentSeedProfileIsolation.beforePassed}, fail=${rollup.liveDocumentSeedProfileIsolation.beforeFailed}, forbidden fragments=${rollup.liveDocumentSeedProfileIsolation.beforeSeedProfileLeakageCount}`,
    `- Live after remediation: pass=${rollup.liveDocumentSeedProfileIsolation.livePassed}, fail=${rollup.liveDocumentSeedProfileIsolation.liveFailed}, forbidden fragments=${rollup.liveDocumentSeedProfileIsolation.liveSeedProfileLeakageCount}`,
    `- Reviewed document surface: ${rollup.liveDocumentSeedProfileIsolation.reviewedDocumentSurfaceCount}; secondary grounding=${rollup.liveDocumentSeedProfileIsolation.secondaryGroundingPassed}/${rollup.liveDocumentSeedProfileIsolation.secondaryGroundingReviewed}`,
    `- DB mutation: ${rollup.liveDocumentSeedProfileIsolation.dbMutationPerformed}; Share session created: ${rollup.liveDocumentSeedProfileIsolation.shareSessionCreated}; provider dispatch: ${rollup.liveDocumentSeedProfileIsolation.providerDispatchCalled}`,
    `- Exact saved Share: ${rollup.liveDocumentSeedProfileIsolation.exactSavedShareVerdict || "MISSING_EVIDENCE"}; reproduced=${rollup.liveDocumentSeedProfileIsolation.exactSavedShareReproduced}`,
    "- Boundary: this deterministic seed-profile isolation contract does not replace broad human wording review or exact saved Share geometry.",
    "",
    "## Gate Matrix",
    "",
    "| Gate | State | Artifact |",
    "| --- | --- | --- |",
  ];
  for (const gate of [...rollup.provenGates, ...rollup.approvalGated]) {
    lines.push(`| ${gate.id} | ${gate.state} | ${gate.artifact} |`);
  }
  lines.push("", "## Evidence Freshness", "", "| Evidence | Source | Production | Artifact |", "| --- | --- | --- | --- |");
  for (const item of rollup.evidence) {
    lines.push(`| ${item.id} | ${item.sourceStatus} | ${item.productionStatus} | ${item.artifact} |`);
  }
  lines.push("", "## Carried Notices", "");
  if (rollup.final99.noticeCarry.length === 0) {
    lines.push("- None.");
  } else {
    for (const notice of rollup.final99.noticeCarry) {
      lines.push(`- ${notice.gate}: ${notice.launchImpact} — forbidden: ${notice.forbiddenClaim}`);
    }
  }
  lines.push("", "## Approval-Gated Work", "");
  for (const gate of rollup.approvalGated) {
    lines.push(`- ${gate.id}: ${gate.detail}`);
  }
  return `${lines.join("\n")}\n`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const buildInfo = await loadBuildInfo(options);
  const rollup = buildNorthstarLiveRollup(options.rootDir, buildInfo);
  const outputDir = path.isAbsolute(options.outputDir)
    ? options.outputDir
    : path.join(options.rootDir, options.outputDir);
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, "report.json"), `${JSON.stringify(rollup, null, 2)}\n`, "utf8");
  fs.writeFileSync(path.join(outputDir, "report.md"), renderNorthstarLiveRollupMarkdown(rollup), "utf8");
  console.log(JSON.stringify({
    overall: rollup.overall,
    output: path.relative(options.rootDir, outputDir),
    head: rollup.head,
    liveCommit: isRecord(rollup.liveBuildInfo) ? asString(rollup.liveBuildInfo.commitSha) : "",
    contradictions: rollup.contradictions.length,
  }, null, 2));
  if (rollup.contradictions.length > 0) {
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
