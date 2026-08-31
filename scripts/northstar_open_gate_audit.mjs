#!/usr/bin/env node
// @ts-check

import fs from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SCHEMA_VERSION = "safeclaw-northstar-open-gate-audit/v1";
const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "..");

const DEFAULT_OUTPUT_DIR = path.join("evaluation", "northstar-open-gates-current");

const EVIDENCE_PATHS = Object.freeze({
  final99Candidates: Object.freeze([
    path.join("evaluation", "final-99-gate-current-2026-07-22", "report.json"),
    path.join("evaluation", "final-99-gate-current-2026-07-21", "report.json"),
    path.join("evaluation", "final-99-gate-current-2026-07-20", "report.json"),
    path.join("evaluation", "final-99-gate", "report.json"),
  ]),
  final99NoticeCarryCandidates: Object.freeze([
    path.join("evaluation", "final-99-gate-current-2026-07-22", "notice-carry.json"),
    path.join("evaluation", "final-99-gate-current-2026-07-21", "notice-carry.json"),
    path.join("evaluation", "final-99-gate-current-2026-07-20", "notice-carry.json"),
    path.join("evaluation", "final-99-gate", "notice-carry.json"),
  ]),
  final99NoApprovalBoundary: path.join("evaluation", "final-99-no-approval-boundary-2026-07-23", "report.json"),
  final99TwelveDocumentNoMutation: path.join("evaluation", "final-99-12-document-no-mutation-2026-08-17", "report.json"),
  liveHarness: path.join("evaluation", "live-harness-quality-probe-current-2026-07-20", "report.json"),
  documentQualityGrounding: path.join("evaluation", "document-quality-grounding-current-gate-2026-07-19", "report.json"),
  liveDocumentQualityMatrix: path.join("evaluation", "live-document-quality-matrix-2026-07-24", "report.json"),
  liveDocumentQualityStressMatrix: path.join("evaluation", "live-document-quality-stress-matrix-2026-07-24", "report.json"),
  liveDocumentFieldIsolation: path.join("evaluation", "live-document-field-isolation-2026-07-25", "report.json"),
  liveForeignWorkerScenarioGuidance: path.join("evaluation", "live-foreign-worker-scenario-guidance-2026-08-27", "report.json"),
  liveRoofRepairScenarioIsolation: path.join("evaluation", "live-roof-repair-scenario-isolation-2026-08-27", "report.json"),
  liveAccidentCaseScenarioIsolation: path.join("evaluation", "live-accident-case-scenario-isolation-2026-08-27", "report.json"),
  liveAccidentCaseMaintenanceIsolation: path.join("evaluation", "live-accident-case-maintenance-isolation-2026-08-27", "report.json"),
  liveKoshaExactMaterialization: path.join("evaluation", "live-kosha-exact-materialization-2026-07-25", "report.json"),
  liveDocumentWordingReview: path.join("evaluation", "live-document-wording-review-2026-07-24", "report.json"),
  liveDocumentBroadReview: path.join("evaluation", "live-document-broad-review-2026-07-25", "report.json"),
  liveDocumentEditorialReview: path.join("evaluation", "live-document-editorial-review-2026-07-25", "report.json"),
  currentLiveDocumentEditorialRuntime: path.join("evaluation", "live-document-editorial-template-runtime-2026-08-27", "report.json"),
  documentEditorialReviewCockpit: path.join("evaluation", "document-editorial-review-cockpit-2026-08-16", "report.json"),
  documentEditorialReviewReceipt: path.join("evaluation", "document-editorial-review-receipt-2026-08-17", "report.json"),
  liveDocumentEditorialDuplicateClassification: path.join("evaluation", "live-document-editorial-duplicate-classification-2026-07-25", "report.json"),
  liveDocumentEditorialNearClassification: path.join("evaluation", "live-document-editorial-near-classification-2026-07-25", "report.json"),
  liveDocumentRainContextIsolation: path.join("evaluation", "live-document-rain-context-isolation-2026-07-25", "report.json"),
  productCapabilityTruth: path.join("evaluation", "product-capability-truth-2026-07-25", "report.json"),
  ciSupplyChainPinning: path.join("evaluation", "ci-supply-chain-pinning-2026-08-29", "report.json"),
  ciFullSuiteRemediation: path.join("evaluation", "ci-full-suite-remediation-2026-08-29", "report.json"),
  knowledgePreparationCapabilityTruth: path.join("evaluation", "knowledge-preparation-capability-truth-2026-08-28", "report.json"),
  launchOperationsReadiness: path.join("evaluation", "launch-operations-readiness-2026-08-26", "report.json"),
  distributedAdmissionActivationApproval: path.join("evaluation", "distributed-admission-activation-approval-2026-08-29", "report.json"),
  documentExportCapabilityTruth: path.join("evaluation", "document-export-capability-truth-2026-08-17", "report.json"),
  ontologyViewportWorkbench: path.join("evaluation", "ontology-viewport-workbench-2026-08-17", "report.json"),
  knowledgeViewportWorkbench: path.join("evaluation", "knowledge-viewport-workbench-2026-08-17", "report.json"),
  knowledgeMobileTaskRail: path.join("evaluation", "knowledge-mobile-task-rail-2026-08-27", "report.json"),
  llmWikiCandidateContentReadiness: path.join("evaluation", "llm-wiki-candidate-readiness-2026-08-25", "report.json"),
  llmWikiCandidateContentMatrix: path.join("evaluation", "llm-wiki-candidate-content-matrix-2026-08-25", "report.json"),
  llmWikiSifEvidenceMatrix: path.join("evaluation", "llm-wiki-sif-evidence-matrix-2026-08-26", "report.json"),
  dispatchEntryCapabilityTruth: path.join("evaluation", "dispatch-entry-capability-truth-2026-07-28", "report.json"),
  landingHumanReviewBoundary: path.join("evaluation", "landing-human-review-boundary-2026-07-28", "report.json"),
  dependencySecurityRemediation: path.join("evaluation", "dependency-security-remediation-2026-07-28", "report.json"),
  tenantAuthorizationRemediation: path.join("evaluation", "tenant-authorization-boundary-preflight-2026-07-29", "report.json"),
  spreadsheetFormulaNeutralization: path.join("evaluation", "spreadsheet-formula-neutralization-2026-08-01", "report.json"),
  publicProviderWorkBudget: path.join("evaluation", "public-provider-work-budget-2026-08-01", "report.json"),
  documentExportWorkBudget: path.join("evaluation", "document-export-work-budget-2026-08-01", "report.json"),
  fullRepositorySecurityScan: path.join("evaluation", "follow-up-full-repository-security-scan-2026-08-02", "report.json"),
  repositorySecurityScanReconciliation: path.join("evaluation", "repository-security-scan-reconciliation-2026-08-11", "report.json"),
  currentSecurityRemediationLedger: path.join("evaluation", "security-current-remediation-ledger-2026-08-13", "report.json"),
  currentRepositorySecurityRescan: path.join("evaluation", "current-full-repository-security-scan-2026-08-27", "report.json"),
  freshCurrentSourceSecurityScan: path.join("evaluation", "current-head-standard-security-scan-2026-08-31-complete", "report.json"),
  completedCurrentHeadStandardSecurityScan: path.join("evaluation", "current-head-standard-security-scan-2026-08-31-9504d8db-complete", "report.json"),
  currentSourceApprovalFreeSecurityRemediation: path.join("evaluation", "current-source-security-approval-free-remediation-2026-08-31", "report.json"),
  currentSourceSecurityResourceBudgetRemediation: path.join("evaluation", "current-source-security-resource-budget-remediation-2026-08-31", "report.json"),
  currentSourceLogoutStorageRemediation: path.join("evaluation", "current-source-security-logout-storage-remediation-2026-08-31", "report.json"),
  currentSourceOntologyErrorProjectionRemediation: path.join("evaluation", "current-source-security-ontology-error-projection-remediation-2026-08-31", "report.json"),
  currentSourcePhotoReadinessAuthFanoutRemediation: path.join("evaluation", "current-source-security-photo-readiness-auth-fanout-remediation-2026-08-31", "report.json"),
  currentSourceMcpGenerationCancellationRemediation: path.join("evaluation", "current-source-security-mcp-generation-cancellation-remediation-2026-08-31", "report.json"),
  currentSourceKoshaArchivePreflightRemediation: path.join("evaluation", "current-source-security-kosha-archive-preflight-remediation-2026-08-31", "report.json"),
  currentSourceSecurityRemediationFollowup: path.join("evaluation", "current-source-security-remediation-2026-08-30", "report.json"),
  currentSecurityGovernedPathCompatibility: path.join("evaluation", "current-security-governed-path-compatibility-2026-08-30", "report.json"),
  currentSourceSecurityResidualRemediation: path.join("evaluation", "current-source-security-residual-remediation-2026-08-28", "report.json"),
  shareAckPreBodyAdmission: path.join("evaluation", "share-ack-prebody-admission-2026-08-28", "report.json"),
  safetyStatusDisconnectLease: path.join("evaluation", "safety-status-disconnect-lease-2026-08-28", "report.json"),
  weatherFallbackErrorRedaction: path.join("evaluation", "weather-fallback-error-redaction-2026-08-28", "report.json"),
  hwpxArchiveExpansionSecurity: path.join("evaluation", "hwpx-archive-expansion-security-2026-08-28", "report.json"),
  postRemediationRepositorySecurityScan: path.join("evaluation", "post-remediation-full-repository-security-scan-2026-08-14", "report.json"),
  postRemediationSecuritySourceClosure: path.join("evaluation", "post-remediation-security-source-closure-2026-08-14", "report.json"),
  shareSessionRevocationRemediation: path.join("evaluation", "share-session-revocation-remediation-2026-08-14", "report.json"),
  shareRecipientContactVerification: path.join("evaluation", "share-recipient-contact-verification-2026-08-14", "report.json"),
  shareMcpCurrentSourceCompatibility: path.join("evaluation", "share-mcp-current-source-compatibility-2026-08-28", "report.json"),
  securityAtomicDbRaceApprovalBoundary: path.join("evaluation", "security-atomic-db-race-approval-boundary-2026-08-14", "report.json"),
  liveDocumentsShareRoutePerception: path.join("evaluation", "live-documents-share-route-perception-2026-08-28", "report.json"),
  deploymentFreshnessGuard: path.join("evaluation", "deployment-freshness-guard-2026-08-14", "report.json"),
  agentChatDurableAdmission: path.join("evaluation", "security-agent-chat-durable-admission-2026-08-14", "report.json"),
  mcpProviderAdmission: path.join("evaluation", "security-mcp-provider-admission-2026-08-14", "report.json"),
  publicJsonRequestBodyBudget: path.join("evaluation", "public-json-request-body-budget-2026-08-11", "report.json"),
  improvementPhotoAnalysisBudget: path.join("evaluation", "improvement-photo-analysis-budget-2026-08-11", "report.json"),
  publicProviderCancellation: path.join("evaluation", "public-provider-cancellation-2026-08-11", "report.json"),
  publicProviderAdmission: path.join("evaluation", "public-provider-admission-2026-08-11", "report.json"),
  publicAskDistributedAdmission: path.join("evaluation", "public-ask-distributed-admission-2026-08-14", "report.json"),
  publicSearchDistributedAdmission: path.join("evaluation", "public-search-distributed-admission-2026-08-14", "report.json"),
  publicAdmissionCurrentSourceCompatibility: path.join("evaluation", "public-admission-current-source-compatibility-2026-08-28", "report.json"),
  publicSearchDistributedRateLimitReadiness: path.join("evaluation", "public-search-distributed-rate-limit-readiness-2026-08-02", "report.json"),
  publicGenerationAdmissionSecurity: path.join("evaluation", "security-public-generation-admission-2026-08-04", "report.json"),
  securityFollowupRemediation: path.join("evaluation", "codex-security-followup-remediation-2026-08-11", "report.json"),
  securityResourceRemediation: path.join("evaluation", "security-resource-remediation-2026-08-11", "report.json"),
  securityUpstreamTransportRemediation: path.join("evaluation", "security-upstream-transport-remediation-2026-08-11", "report.json"),
  securityAccidentCaseCompatibility: path.join("evaluation", "security-accident-case-compatibility-2026-08-27", "report.json"),
  securitySafetyReferenceSurfaceRemediation: path.join("evaluation", "security-safety-reference-surface-remediation-2026-08-11", "report.json"),
  mcpGenerationWorkBudgetSecurity: path.join("evaluation", "security-mcp-generation-work-budget-2026-08-04", "report.json"),
  learningExportRendererSecurity: path.join("evaluation", "learning-export-renderer-security-2026-08-02", "report.json"),
  hermesKnowledgeReviewContract: path.join("evaluation", "hermes-knowledge-review-contract-live-2026-07-25", "report.json"),
  hermesKnowledgeReviewAuthorityUi: path.join("evaluation", "hermes-knowledge-review-selected-workbench-2026-08-14", "report.json"),
  hermesKnowledgeReviewStructuredSections: path.join("evaluation", "hermes-knowledge-review-structured-sections-2026-08-28", "report.json"),
  hermesReviewDecisionFirstViewport: path.join("evaluation", "hermes-review-decision-first-viewport-2026-08-27", "report.json"),
  hermesReviewCandidatePosition: path.join("evaluation", "hermes-review-candidate-position-2026-08-27", "report.json"),
  hermesKnowledgeReviewEvidenceInspector: path.join("evaluation", "hermes-knowledge-review-evidence-inspector-2026-08-14", "report.json"),
  hermesEvidenceDigestReadability: path.join("evaluation", "hermes-evidence-digest-readability-2026-08-26", "report.json"),
  hermesReviewSubjectContext: path.join("evaluation", "hermes-review-subject-context-2026-08-27", "report.json"),
  hermesReviewEventFactTraceability: path.join("evaluation", "hermes-knowledge-review-event-facts-2026-08-26", "report.json"),
  hermesReviewTraceBlocks: path.join("evaluation", "hermes-knowledge-review-trace-blocks-2026-08-26", "report.json"),
  hermesReviewTraceMatrix: path.join("evaluation", "hermes-knowledge-review-trace-matrix-2026-08-26", "report.json"),
  hermesOpenclawRuntime: path.join("evaluation", "hermes-openclaw-runtime-current-gate-2026-07-20", "report.json"),
  liveDocumentSecondaryGrounding: path.join("evaluation", "live-document-secondary-grounding-2026-07-25", "report.json"),
  liveDocumentSeedProfileIsolation: path.join("evaluation", "live-document-seed-profile-isolation-2026-07-25", "report.json"),
  rlsApproval: path.join("evaluation", "supabase-rls-approval-2026-07-17", "report.md"),
  llmWikiApproval: path.join("evaluation", "llm-wiki-rls-approval-2026-07-17", "report.md"),
  rlsLlmWikiApprovalPreflight: path.join("evaluation", "rls-llm-wiki-approval-preflight-current-2026-07-20", "report.json"),
  sifEmbeddingPreflight: path.join("evaluation", "sif-embedding-gate", "approval-preflight-report.json"),
  documentsMobileInternalPane: path.join("evaluation", "documents-mobile-internal-pane-2026-07-21", "report.json"),
  documentsMobilePaneContext: path.join("evaluation", "documents-mobile-pane-context-2026-07-21", "report.json"),
  documentsDrilldownDepth: path.join("evaluation", "documents-drilldown-depth-2026-07-21", "report.json"),
  documentsInnerPaneDepth: path.join("evaluation", "documents-inner-pane-depth-2026-07-21", "report.json"),
  documentsFieldFirstAffordance: path.join("evaluation", "documents-field-first-affordance-2026-07-21", "report.json"),
  documentsRiskRowCockpit: path.join("evaluation", "documents-risk-row-cockpit-2026-07-21", "report.json"),
  documentsTbmCockpit: path.join("evaluation", "documents-tbm-cockpit-2026-07-21", "report.json"),
  documentsFirstViewSplit: path.join("evaluation", "documents-first-view-split-2026-07-21", "report.json"),
  documentsEducationCockpit: path.join("evaluation", "documents-education-cockpit-2026-07-21", "report.json"),
  documentsEmergencyCockpit: path.join("evaluation", "documents-emergency-cockpit-2026-07-21", "report.json"),
  documentsCompleteCockpits: path.join("evaluation", "documents-complete-cockpits-2026-07-21", "report.json"),
  documentsCompleteCockpitsLive: path.join("evaluation", "documents-complete-cockpits-live-2026-07-21", "report.json"),
  documentsMobileExactCockpit: path.join("evaluation", "documents-mobile-exact-cockpit-2026-07-21", "report.json"),
  documentsSelectedEditorCockpit: path.join("evaluation", "documents-selected-editor-cockpit-2026-07-22", "report.json"),
  documentsCockpitWorkbenchGeometry: path.join("evaluation", "documents-cockpit-workbench-geometry-2026-07-22", "report.json"),
  liveCurrentDocumentsShareGeometry: path.join("evaluation", "live-current-documents-share-geometry-2026-08-31", "report.json"),
  documentsMobileReviewLaunch: path.join("evaluation", "documents-mobile-review-launch-2026-08-17", "report.json"),
  documentsTouchTargets: path.join("evaluation", "documents-touch-targets-2026-08-17", "report.json"),
  documentSectionNavigation: path.join("evaluation", "document-section-navigation-2026-08-02", "report.json"),
  documentAllAuthoringGeometry: path.join("evaluation", "document-all-authoring-geometry-2026-08-02", "after-live", "report.json"),
  documentAuthoringPaneMargin: path.join("evaluation", "document-authoring-pane-margin-2026-08-02", "report.json"),
  documentRawDrilldownGeometry: path.join("evaluation", "document-raw-drilldown-geometry-2026-08-02", "after-live", "report.json"),
  documentRiskRowNavigation: path.join("evaluation", "document-risk-row-navigation-2026-08-02", "after-live", "report.json"),
  documentRiskRowMobileOrder: path.join("evaluation", "document-risk-row-mobile-order-2026-08-02", "after-live", "report.json"),
  documentRiskRowMobileLabel: path.join("evaluation", "document-risk-row-mobile-label-2026-08-02", "after-live", "report.json"),
  documentRiskRowMobileDensity: path.join("evaluation", "document-risk-row-mobile-density-2026-08-27", "report.json"),
  documentRiskRowAddTouch: path.join("evaluation", "document-risk-row-add-touch-2026-08-27", "report.json"),
  documentRiskRowAddTouchMetrics: path.join("evaluation", "document-risk-row-add-touch-2026-08-27", "browser-metrics.json"),
  shareDesktopComposition: path.join("evaluation", "share-desktop-composition-2026-07-21", "report.json"),
  shareDesktopShortCockpit: path.join("evaluation", "share-desktop-short-cockpit-2026-07-21", "report.json"),
  shareDesktopPerception: path.join("evaluation", "share-desktop-perception-2026-07-22", "report.json"),
  shareChannelLabelPolish: path.join("evaluation", "share-channel-label-polish-2026-08-27", "report.json"),
  shareMobileFullFlow: path.join("evaluation", "share-mobile-full-flow-2026-07-21", "report.json"),
  shareStagedFlowRail: path.join("evaluation", "share-staged-flow-rail-2026-07-21", "report.json"),
  shareMobileStageRailCollapse: path.join("evaluation", "share-mobile-stage-rail-collapse-2026-07-21", "report.json"),
  shareMobileExactViewport: path.join("evaluation", "share-mobile-exact-viewport-2026-07-21", "report.json"),
  shareRecipientCockpit: path.join("evaluation", "share-recipient-cockpit-2026-07-22", "report.json"),
  shareResultDrilldown: path.join("evaluation", "share-result-drilldown-2026-07-21", "report.json"),
  shareRecipientLongContentFixture: path.join("evaluation", "share-recipient-long-content-fixture-2026-07-25", "report.json"),
  shareExactSessionBoundary: path.join("evaluation", "share-exact-session-boundary-2026-07-22", "report.json"),
  shareRecipientAckApprovalPreflight: path.join("evaluation", "share-recipient-ack-approval-preflight-current-2026-07-19", "report.json"),
  sharePublicSessionStorageReadiness: path.join("evaluation", "share-public-session-storage-readiness-2026-07-23", "report.json"),
  sharePublicSessionStorageApproval: path.join("evaluation", "share-public-session-storage-approval-2026-07-23", "report.json"),
  dispatchStandalone: path.join("evaluation", "dispatch-standalone-cockpit-2026-07-21", "report.json"),
  dispatchStandaloneViewport: path.join("evaluation", "dispatch-standalone-viewport-2026-07-28", "report.json"),
  dispatchFirstViewportContainment: path.join("evaluation", "dispatch-first-viewport-containment-2026-08-27", "report.json"),
  providerDispatchIdempotency: path.join("evaluation", "provider-dispatch-idempotency-gate-2026-07-19", "report.json"),
  workspaceIaLiveRefinement: path.join("evaluation", "workspace-ia-live-f67-2026-07-21", "report.json"),
  workspaceEditorDetailLanding: path.join("evaluation", "workspace-editor-detail-landing-2026-07-21", "report.json"),
  workspaceIaLiveCurrent: path.join("evaluation", "workspace-ia-live-7b36-2026-07-22", "report.json"),
  koshaCurrentNorthstarRegression: path.join("evaluation", "kosha-current-northstar-regression-2026-07-22", "report.json"),
  koshaCurrentGate: path.join("evaluation", "kosha-current-live-gate-2026-07-20", "report.json"),
  koshaCurrentReconciliation: path.join("evaluation", "kosha-current-master-reconciliation-2026-07-19", "report.json"),
  koshaCurrentLive: path.join("evaluation", "kosha-exact-trust-current-live-2026-07-19", "report.md"),
  koshaExactPromotionReviewGate: path.join("evaluation", "kosha-exact-promotion-review-gate-2026-07-22", "report.json"),
  koshaExactPromotionHumanChecklist: path.join("evaluation", "kosha-exact-promotion-review-gate-2026-07-22", "review-template.md"),
  koshaExactOfficialPdfAudit: path.join("evaluation", "kosha-exact-official-pdf-audit-2026-07-25", "report.json"),
  koshaExactOfficialLifecycleAudit: path.join("evaluation", "kosha-exact-official-lifecycle-audit-2026-07-25", "report.json"),
  koshaExactPromotionReviewerSupport: path.join("evaluation", "kosha-exact-promotion-reviewer-support-2026-07-25", "report.json"),
  koshaExactPromotionReviewerCockpit: path.join("evaluation", "kosha-exact-promotion-reviewer-cockpit-2026-07-25", "report.json"),
  koshaExactPromotionReviewerCockpitBrowser: path.join("evaluation", "kosha-exact-promotion-reviewer-cockpit-2026-07-25", "browser-report.json"),
  koshaExactPromotionReviewContractAudit: path.join("evaluation", "kosha-exact-promotion-review-contract-audit-2026-07-23", "report.json"),
});

/**
 * @typedef {"proven" | "approval_gated" | "notice" | "missing" | "contradicted"} GateState
 *
 * @typedef {object} GateResult
 * @property {string} id
 * @property {GateState} state
 * @property {string} label
 * @property {string} evidencePath
 * @property {string} detail
 * @property {string[]} nextActions
 *
 * @typedef {object} NorthstarAudit
 * @property {string} schemaVersion
 * @property {string} generatedAt
 * @property {string} sourceSha
 * @property {"open" | "evidence_missing" | "contradicted"} overall
 * @property {GateResult[]} gates
 * @property {string[]} safeDemoClaims
 * @property {string[]} forbiddenClaims
 */

/**
 * @param {string} rootDir
 * @param {string} relativePath
 */
function readTextFile(rootDir, relativePath) {
  const absolutePath = path.join(rootDir, relativePath);
  if (!fs.existsSync(absolutePath)) {
    return null;
  }
  return fs.readFileSync(absolutePath, "utf8");
}

/**
 * @param {string} rootDir
 * @param {string} relativePath
 */
function readJsonFile(rootDir, relativePath) {
  const text = readTextFile(rootDir, relativePath);
  if (text === null) {
    return null;
  }
  return JSON.parse(text);
}

/**
 * @param {string} rootDir
 * @param {string[]} relativePaths
 * @returns {{ path: string, report: unknown } | null}
 */
function readFirstJsonFile(rootDir, relativePaths) {
  for (const relativePath of relativePaths) {
    const report = readJsonFile(rootDir, relativePath);
    if (report !== null) {
      return { path: relativePath, report };
    }
  }
  return null;
}

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
function readString(value) {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * @param {string} rootDir
 */
function resolveSourceSha(rootDir) {
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
 * @param {string} possibleAncestorSha
 */
const gitAncestorCache = new Map();
const evidencePathCurrentCache = new Map();

function isGitAncestor(rootDir, possibleAncestorSha) {
  if (!/^[0-9a-f]{40}$/u.test(possibleAncestorSha)) {
    return false;
  }
  const cacheKey = `${rootDir}\0${possibleAncestorSha}`;
  if (gitAncestorCache.has(cacheKey)) {
    return gitAncestorCache.get(cacheKey);
  }
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", possibleAncestorSha, "HEAD"], {
      cwd: rootDir,
      stdio: ["ignore", "ignore", "ignore"],
    });
    gitAncestorCache.set(cacheKey, true);
    return true;
  } catch {
    gitAncestorCache.set(cacheKey, false);
    return false;
  }
}

/**
 * @param {Partial<GateResult>} gate
 * @returns {GateResult}
 */
function gateResult(gate) {
  return {
    id: gate.id || "unknown",
    state: gate.state || "missing",
    label: gate.label || gate.id || "Unknown gate",
    evidencePath: gate.evidencePath || "",
    detail: gate.detail || "",
    nextActions: gate.nextActions || [],
  };
}

/**
 * @param {string} rootDir
 * @returns {GateResult}
 */
function evaluateFinal99Gate(rootDir) {
  const evidence = readFirstJsonFile(rootDir, EVIDENCE_PATHS.final99Candidates);
  const evidencePath = evidence?.path || EVIDENCE_PATHS.final99Candidates[0];
  const report = evidence?.report;
  if (!isRecord(report)) {
    return gateResult({
      id: "final_99_gate",
      label: "Final 99 evidence gate",
      state: "missing",
      evidencePath,
      detail: "final-99 report is missing or invalid.",
      nextActions: ["Run `npm.cmd run smoke:final-99-gate` and commit the generated artifacts."],
    });
  }

  const twelveDocumentCompanion = readJsonFile(rootDir, EVIDENCE_PATHS.final99TwelveDocumentNoMutation);
  const localResult = isRecord(twelveDocumentCompanion?.currentSourceLocal)
    ? twelveDocumentCompanion.currentSourceLocal
    : {};
  const liveResult = isRecord(twelveDocumentCompanion?.liveAfterDeployment)
    ? twelveDocumentCompanion.liveAfterDeployment
    : {};
  const mutationBoundary = isRecord(twelveDocumentCompanion?.mutationBoundary)
    ? twelveDocumentCompanion.mutationBoundary
    : {};
  const remainingBoundaries = isRecord(twelveDocumentCompanion?.remainingBoundaries)
    ? twelveDocumentCompanion.remainingBoundaries
    : {};
  const blockerSurfaces = Array.isArray(liveResult.blockerSurfaces)
    ? liveResult.blockerSurfaces.map(readString)
    : [];
  const liveResultIsHonest = (
    (readString(liveResult.overall) === "blocked"
      && readString(liveResult.askVerdict) === "pass"
      && readString(liveResult.requestedAiMode) === "template"
      && readString(liveResult.documentDownloadVerdict) === "blocked"
      && readString(liveResult.blockerCode) === "DISTRIBUTED_RATE_LIMIT_UNAVAILABLE"
      && blockerSurfaces.includes("core_pdf_exports")
      && blockerSurfaces.includes("weather_preflight")
      && liveResult.liveRemediationRequired === true)
    || ((readString(liveResult.overall) === "pass" || readString(liveResult.overall) === "pass_with_notice")
      && readString(liveResult.documentDownloadVerdict) === "pass")
  );
  const twelveDocumentCompanionPresent = isRecord(twelveDocumentCompanion);
  const twelveDocumentCompanionReady = twelveDocumentCompanionPresent
    && readString(twelveDocumentCompanion.schema) === "safeclaw-final-99-12-document-no-mutation/v1"
    && readString(twelveDocumentCompanion.verdict)
      === "PASS_CURRENT_SOURCE_LOCAL_PRODUCTION_12_DOCUMENT_NO_MUTATION_LIVE_HORIZONTAL_ADMISSION_BLOCKED"
    && readString(twelveDocumentCompanion.currentSourceCommit) !== ""
    && readString(liveResult.sourceCommit) === readString(liveResult.productionCommit)
    && readString(liveResult.sourceCommit) === readString(twelveDocumentCompanion.currentSourceCommit)
    && localResult.overall === "pass_with_notice"
    && localResult.canonicalDocumentCount === 12
    && localResult.canonicalDocumentsPassed === 12
    && localResult.corePdfCount === 4
    && localResult.corePdfsPassed === 4
    && localResult.orchestrationDocumentCount === 12
    && localResult.orchestrationDownloadCount === 14
    && localResult.orchestrationFailureCount === 0
    && readString(localResult.askVerdict) === "pass"
    && readString(localResult.requestedAiMode) === "template"
    && liveResult.canonicalDocumentCount === 12
    && liveResult.canonicalDocumentsPassed === 12
    && liveResult.freshLiveRerunCompleted === true
    && liveResultIsHonest
    && readString(mutationBoundary.executionMode) === "no-mutation"
    && mutationBoundary.dbMutationPerformed === false
    && mutationBoundary.providerGenerationCalled === false
    && mutationBoundary.providerDispatchCalled === false
    && mutationBoundary.shareSessionCreated === false
    && mutationBoundary.vectorOrEmbeddingMutationPerformed === false
    && mutationBoundary.wikiPublicationPerformed === false
    && mutationBoundary.koshaRegistryMutationPerformed === false
    && readString(remainingBoundaries.exactSavedShareVerdict) === "MISSING_EVIDENCE"
    && readString(remainingBoundaries.providerDispatchPersistence) === "APPROVAL_GATED"
    && remainingBoundaries.fullyAutomatedLaunchClaimAllowed === false;

  if (twelveDocumentCompanionPresent && !twelveDocumentCompanionReady) {
    return gateResult({
      id: "final_99_gate",
      label: "Final 99 evidence gate",
      state: "contradicted",
      evidencePath: EVIDENCE_PATHS.final99TwelveDocumentNoMutation,
      detail: "The 12-document no-mutation companion is present but violates its source/live, coverage, mutation, or approval-boundary contract.",
      nextActions: ["Regenerate the 12-document no-mutation companion without weakening live or approval boundaries."],
    });
  }

  const twelveDocumentDetail = twelveDocumentCompanionReady
    ? ` The no-mutation companion ${EVIDENCE_PATHS.final99TwelveDocumentNoMutation} proves local canonical/core/orchestration coverage 12/12, 4/4, and 12 documents with 14 downloads and 0 failures. Its fresh source-aligned live template generation passes 12/12, while core PDF exports and weather preflight remain ${readString(liveResult.overall)} with ${readString(liveResult.blockerCode) || "no blocker"}; exact saved Share is MISSING_EVIDENCE and fully automated launch remains forbidden.`
    : "";

  const overall = readString(report.overall);
  if (overall === "pass" || overall === "pass_with_notice") {
    const noticeCarryEvidence = readFirstJsonFile(rootDir, EVIDENCE_PATHS.final99NoticeCarryCandidates);
    const noticeCarry = noticeCarryEvidence?.report;
    const noticeCarryPath = noticeCarryEvidence?.path || EVIDENCE_PATHS.final99NoticeCarryCandidates[0];
    const notices = Array.isArray(noticeCarry?.notices) ? noticeCarry.notices : [];
    const carriedNotices = notices.filter((notice) => (
      isRecord(notice) && notice.carried === true && readString(notice.launchImpact)
    ));
    const carriedNoticeCount = carriedNotices.length;
    const noticeImpacts = carriedNotices
      .map((notice) => `${readString(notice.gate) || "unknown"}=${readString(notice.launchImpact) || "notice"}`)
      .filter(Boolean)
      .join(", ");
    const noticeCarryReady = isRecord(noticeCarry)
      && noticeCarry.verdict === "carried"
      && carriedNoticeCount >= 2
      && noticeCarry.fullyAutomatedLaunchClaimAllowed === false;
    const noApprovalBoundary = readJsonFile(rootDir, EVIDENCE_PATHS.final99NoApprovalBoundary);
    const noApprovalBoundaryReady = isRecord(noApprovalBoundary)
      && readString(noApprovalBoundary.verdict) === "NO_APPROVAL_FINAL_99_RERUN_BLOCKED_BOUNDARY_DOCUMENTED"
      && noApprovalBoundary.dbMutationPerformed === false;
    const noApprovalBoundaryDetail = noApprovalBoundaryReady
      ? ` Full final-99 rerun is not treated as no-approval cleanup; ${EVIDENCE_PATHS.final99NoApprovalBoundary} records the mutation boundary.`
      : "";
    return gateResult({
      id: "final_99_gate",
      label: "Final 99 evidence gate",
      state: overall === "pass" ? "proven" : "notice",
      evidencePath,
      detail: overall === "pass_with_notice" && noticeCarryReady
        ? `final-99 overall is ${overall}; ${carriedNoticeCount} notices are explicitly carried in ${noticeCarryPath}: ${noticeImpacts}. Fully automated launch remains forbidden until those approval/auth gates are proven.${noApprovalBoundaryDetail}${twelveDocumentDetail}`
        : `final-99 overall is ${overall}.${twelveDocumentDetail}`,
      nextActions: overall === "pass_with_notice"
        ? noticeCarryReady
          ? [
            "Do not claim fully automated launch readiness until admin-auth live save/reopen and approved provider dispatch are executed in a secure environment.",
            "Configure approved distributed admission before claiming live export and weather-dependent orchestration readiness.",
            ...(noApprovalBoundaryReady ? ["Do not rerun full final-99 as a no-approval cleanup when SAFEGUARD_AUTH_TOKEN is configured."] : []),
          ]
          : ["Resolve or explicitly carry each notice before claiming fully automated launch readiness."]
        : [],
    });
  }

  return gateResult({
    id: "final_99_gate",
    label: "Final 99 evidence gate",
    state: "contradicted",
    evidencePath,
    detail: `final-99 overall is ${overall || "unknown"}.`,
    nextActions: ["Fix blocked final-99 gates and regenerate the report."],
  });
}

/**
 * @param {string} rootDir
 * @returns {GateResult}
 */
function evaluateHermesKnowledgeReviewAuthorityGate(rootDir) {
  const evidencePath = EVIDENCE_PATHS.hermesKnowledgeReviewContract;
  const report = readJsonFile(rootDir, evidencePath);
  if (!isRecord(report)) {
    return gateResult({
      id: "hermes_knowledge_review_authority",
      label: "Hermes knowledge review authority",
      state: "missing",
      evidencePath,
      detail: "Live Hermes knowledge reviewer authority evidence is missing.",
      nextActions: ["Run the stateless generate=false knowledge candidate probe against current production."],
    });
  }

  const productionBuild = isRecord(report.productionBuild) ? report.productionBuild : {};
  const probe = isRecord(report.probe) ? report.probe : {};
  const candidate = isRecord(report.candidate) ? report.candidate : {};
  const reviewContract = isRecord(report.reviewContract) ? report.reviewContract : {};
  const sourceRoleCounts = isRecord(reviewContract.sourceRoleCounts) ? reviewContract.sourceRoleCounts : {};
  const mutationBoundary = isRecord(report.mutationBoundary) ? report.mutationBoundary : {};
  const remainingBoundaries = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  const sourceHead = readString(report.sourceHead);
  const productCommit = readString(report.productCommit);
  const productionCommit = readString(productionBuild.commitSha);
  const authorityOrder = readStringArray(reviewContract.authorityOrder);
  const presentAuthorityIds = readStringArray(reviewContract.presentAuthorityIds);
  const expectedAuthorityOrder = [
    "sif",
    "kosha",
    "law",
    "organization_history",
    "site_history",
    "external_context",
  ];
  const expectedPresentAuthorityIds = expectedAuthorityOrder.slice(0, 5);
  const sourceRoleCountPass = [
    "sifIncidentControlEvidence",
    "koshaTechnicalGuidance",
    "lawStatutorySource",
    "organizationPrivateMemory",
    "sitePrivateMemory",
  ].every((field) => readNumber(sourceRoleCounts[field]) === 1)
    && readNumber(sourceRoleCounts.externalContext) === 0;
  const noMutation = mutationBoundary.dbMutationPerformed === false
    && mutationBoundary.schemaMutationPerformed === false
    && mutationBoundary.candidatePersisted === false
    && mutationBoundary.ontologyPublished === false
    && mutationBoundary.providerCallPerformed === false
    && mutationBoundary.shareSessionCreated === false
    && mutationBoundary.exactSavedShareReproduced === false;
  const pass = report.verdict === "PASS_LIVE_PRODUCTION_HERMES_KNOWLEDGE_REVIEW_AUTHORITY_CONTRACT"
    && sourceHead !== ""
    && productCommit !== ""
    && productionCommit === sourceHead
    && isGitAncestor(rootDir, sourceHead)
    && isGitAncestor(rootDir, productCommit)
    && probe.httpStatus === 200
    && probe.requestMode === "generate_false_stateless_candidate"
    && probe.rawEventCount === 5
    && probe.aiGenerationExecuted === false
    && probe.providerCallPerformed === false
    && probe.storageMode === "stateless_candidate"
    && probe.savedRunId === null
    && candidate.contractVersion === "knowledge-candidate.v2"
    && candidate.publicationState === "unpublished"
    && candidate.publishAllowed === false
    && candidate.dbMutationPerformed === false
    && reviewContract.contractVersion === "knowledge-candidate-review.v1"
    && reviewContract.status === "human_review_required"
    && JSON.stringify(authorityOrder) === JSON.stringify(expectedAuthorityOrder)
    && JSON.stringify(presentAuthorityIds) === JSON.stringify(expectedPresentAuthorityIds)
    && sourceRoleCountPass
    && reviewContract.tenantMemoryPublicPromotionAllowed === false
    && reviewContract.siteManagerAcceptanceRequiredBeforeWorkpackUse === true
    && reviewContract.humanReviewRequired === true
    && reviewContract.machineEvidenceReplacesHumanReview === false
    && reviewContract.dbMutationAllowed === false
    && reviewContract.publishAllowed === false
    && noMutation
    && remainingBoundaries.llmWikiPublication === "APPROVAL_GATED"
    && remainingBoundaries.supabaseRlsLaunchIsolation === "APPROVAL_GATED"
    && remainingBoundaries.exactSavedShareVerdict === "MISSING_EVIDENCE";

  if (pass) {
    return gateResult({
      id: "hermes_knowledge_review_authority",
      label: "Hermes knowledge review authority",
      state: "proven",
      evidencePath,
      detail: "Live stateless candidate review keeps SIF -> KOSHA -> law authority roles separate, preserves organization/site memory as non-public tenant evidence, requires site-manager acceptance and human review, and performs no AI provider, DB, publication, or Share mutation. LLM Wiki publication remains APPROVAL_GATED and exact saved Share remains MISSING_EVIDENCE.",
      nextActions: [],
    });
  }

  return gateResult({
    id: "hermes_knowledge_review_authority",
    label: "Hermes knowledge review authority",
    state: "contradicted",
    evidencePath,
    detail: `Hermes knowledge review authority contract failed: source=${sourceHead || "missing"}, production=${productionCommit || "missing"}, humanReview=${String(reviewContract.humanReviewRequired)}, noMutation=${String(noMutation)}, exactShare=${readString(remainingBoundaries.exactSavedShareVerdict) || "missing"}.`,
    nextActions: ["Re-run the live stateless candidate probe and restore the authority, tenant-memory, human-review, and no-mutation boundaries."],
  });
}

/**
 * @param {string} rootDir
 * @returns {GateResult}
 */
function evaluateHermesKnowledgeReviewAuthorityUiGate(rootDir) {
  const evidencePath = EVIDENCE_PATHS.hermesKnowledgeReviewAuthorityUi;
  const report = readJsonFile(rootDir, evidencePath);
  const structuredReport = readJsonFile(rootDir, EVIDENCE_PATHS.hermesKnowledgeReviewStructuredSections);
  if (!isRecord(report)) {
    return gateResult({
      id: "hermes_knowledge_review_ui",
      label: "Hermes knowledge reviewer UI",
      state: "missing",
      evidencePath,
      detail: "Live Hermes reviewer UI geometry evidence is missing.",
      nextActions: ["Run the authenticated route-controlled reviewer cockpit probe against current production."],
    });
  }

  const local = isRecord(report.local) ? report.local : {};
  const afterLive = isRecord(report.afterLive) ? report.afterLive : {};
  const authorityContract = isRecord(report.authorityContract) ? report.authorityContract : {};
  const workbenchContract = isRecord(report.workbenchContract) ? report.workbenchContract : {};
  const mutationBoundary = isRecord(report.mutationBoundary) ? report.mutationBoundary : {};
  const remainingBoundaries = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  const structuredAfterLive = isRecord(structuredReport?.afterLive) ? structuredReport.afterLive : {};
  const structuredReviewBoundary = isRecord(structuredReport?.reviewBoundary) ? structuredReport.reviewBoundary : {};
  const structuredMutationBoundary = isRecord(structuredReport?.mutationBoundary) ? structuredReport.mutationBoundary : {};
  const structuredRemainingBoundaries = isRecord(structuredReport?.remainingBoundaries) ? structuredReport.remainingBoundaries : {};
  const sourceOrder = readStringArray(authorityContract.sourceOrder);
  const productCommit = readString(report.productCommit);
  const productionCommit = readString(report.productionCommit);
  const expectedSourceOrder = [
    "SIF",
    "KOSHA",
    "law",
    "organization_history",
    "site_history",
    "external_context",
  ];
  const noMutation = mutationBoundary.dbMutationPerformed === false
    && mutationBoundary.providerDispatchCalled === false
    && mutationBoundary.shareSessionCreated === false
    && mutationBoundary.ontologyPublicationPerformed === false;
  const structuredNoMutation = structuredMutationBoundary.dbMutationPerformed === false
    && structuredMutationBoundary.providerDispatchCalled === false
    && structuredMutationBoundary.shareSessionCreated === false
    && structuredMutationBoundary.ontologyPublicationPerformed === false
    && structuredMutationBoundary.vectorRuntimeCalled === false
    && structuredMutationBoundary.wikiPublished === false
    && structuredMutationBoundary.koshaRegistryMutationPerformed === false;
  const structuredPass = isRecord(structuredReport)
    && structuredReport.verdict === "PASS_LIVE_PRODUCTION_HERMES_STRUCTURED_CANDIDATE_REVIEW"
    && readString(structuredReport.sourceHead) !== ""
    && readString(structuredReport.productCommit) !== ""
    && isGitAncestor(rootDir, readString(structuredReport.sourceHead))
    && isGitAncestor(rootDir, readString(structuredReport.productCommit))
    && structuredAfterLive.verdict === "PASS_LIVE_PRODUCTION_LLM_WIKI_CANDIDATE_CONTENT_READINESS"
    && readString(structuredAfterLive.productionCommit) !== ""
    && isGitAncestor(rootDir, readString(structuredAfterLive.productionCommit))
    && structuredAfterLive.productionAligned === true
    && structuredAfterLive.viewportCount === 8
    && structuredAfterLive.passedCount === 8
    && structuredAfterLive.failedCount === 0
    && structuredAfterLive.selectedCandidateCount === 1
    && structuredAfterLive.selectedBodyCount === 1
    && structuredAfterLive.selectedBodyFormat === "structured"
    && structuredAfterLive.candidateSectionCount === 4
    && structuredAfterLive.candidateSectionsNonEmpty === true
    && structuredAfterLive.desktopColumns === 2
    && structuredAfterLive.mobileColumns === 1
    && structuredAfterLive.candidateBodyInternalScroll === true
    && structuredAfterLive.firstDecisionActionInViewport === true
    && structuredAfterLive.horizontalOverflow === false
    && structuredAfterLive.candidateMultilineContinuationPreserved === true
    && structuredAfterLive.actualProductionCandidateQueueRead === false
    && structuredAfterLive.routeControlledBrowserFixture === true
    && structuredReviewBoundary.humanReviewCompleted === false
    && structuredReviewBoundary.machineEvidenceReplacesHumanReview === false
    && structuredReviewBoundary.publicationState === "unpublished"
    && structuredReviewBoundary.publishAllowed === false
    && structuredReviewBoundary.rawFallbackPreserved === true
    && structuredNoMutation
    && structuredRemainingBoundaries.liveAfterDeploymentRequired === false
    && structuredRemainingBoundaries.actualProductionCandidateQueueRead === false
    && structuredRemainingBoundaries.exactSavedShareVerdict === "MISSING_EVIDENCE"
    && structuredRemainingBoundaries.llmWikiPublication === "APPROVAL_GATED"
    && structuredRemainingBoundaries.supabaseRlsLaunchIsolation === "APPROVAL_GATED"
    && structuredRemainingBoundaries.enhancedLlmRuntime === "BLOCKED_DISTRIBUTED_RATE_LIMIT_CONFIGURATION"
    && structuredRemainingBoundaries.securityComplete === false;
  const pass = report.verdict === "PASS_LIVE_PRODUCTION_HERMES_REVIEW_AUTHORITY_UI"
    && productCommit !== ""
    && productionCommit !== ""
    && isGitAncestor(rootDir, productCommit)
    && isGitAncestor(rootDir, productionCommit)
    && local.verdict === "PASS_CURRENT_SOURCE_LOCAL_HERMES_REVIEW_AUTHORITY_UI"
    && local.viewportCount === 8
    && local.passedCount === 8
    && local.failedCount === 0
    && afterLive.verdict === "PASS_LIVE_PRODUCTION_HERMES_REVIEW_AUTHORITY_UI"
    && afterLive.viewportCount === 8
    && afterLive.passedCount === 8
    && afterLive.failedCount === 0
    && JSON.stringify(sourceOrder) === JSON.stringify(expectedSourceOrder)
    && authorityContract.statutoryClaimsRequireLawProvenance === true
    && authorityContract.tenantMemoryPublicPromotionAllowed === false
    && authorityContract.siteManagerAcceptanceRequiredBeforeWorkpackUse === true
    && authorityContract.humanReviewRequired === true
    && authorityContract.machineEvidenceReplacesHumanReview === false
    && workbenchContract.candidateCount === 3
    && workbenchContract.selectedCandidateCount === 1
    && workbenchContract.selectedBodyCount === 1
    && workbenchContract.desktopColumns === 2
    && workbenchContract.mobileColumns === 1
    && workbenchContract.candidateBodyInternalScroll === true
    && workbenchContract.candidateTablist === true
    && workbenchContract.candidateRovingTabStop === true
    && workbenchContract.candidateKeyboardNavigation === true
    && workbenchContract.breakpointOrientationSynchronized === true
    && workbenchContract.mobilePaneTabsLinked === true
    && workbenchContract.mobilePaneKeyboardNavigation === true
    && workbenchContract.decisionPendingStatusLive === true
    && workbenchContract.decisionBusyStateExposed === true
    && workbenchContract.decisionActionsDisabledDuringSave === true
    && workbenchContract.decisionSettlesAccessibly === true
    && noMutation
    && structuredPass
    && remainingBoundaries.llmWikiPublication === "APPROVAL_GATED"
    && remainingBoundaries.supabaseRlsLaunchIsolation === "APPROVAL_GATED"
    && remainingBoundaries.exactSavedShareVerdict === "MISSING_EVIDENCE";

  if (pass) {
    return gateResult({
      id: "hermes_knowledge_review_ui",
      label: "Hermes knowledge reviewer UI",
      state: "proven",
      evidencePath,
      detail: "Live authenticated reviewer cockpit passes 8/8 Day/Night desktop and mobile geometry cases with three navigable candidates, exactly one selected candidate/body, desktop two-column and mobile one-column containment, and internal candidate-body scroll. Companion live evidence presents the selected candidate as four numbered, labelled, non-empty reviewer sections, preserves bounded multiline continuation text inside its owning section, and retains a fail-closed raw fallback; it is route-controlled and does not read the actual production candidate queue. Candidate tabs keep one roving tab stop, linked tabpanel semantics, breakpoint-aware orientation, Arrow/Home/End navigation, and keyboard-operable compact panes. Delayed review decisions announce pending and settled states, expose busy semantics, and disable competing actions during save. It exposes six SIF -> KOSHA -> law -> tenant-memory evidence roles, requires law provenance and site-manager acceptance, and performs no DB, provider, publication, vector, KOSHA registry, or Share mutation. Enhanced LLM runtime remains blocked, LLM Wiki/RLS remain APPROVAL_GATED, security-complete is false, and exact saved Share remains MISSING_EVIDENCE.",
      nextActions: [],
    });
  }

  return gateResult({
    id: "hermes_knowledge_review_ui",
    label: "Hermes knowledge reviewer UI",
    state: "contradicted",
    evidencePath,
    detail: `Hermes reviewer UI contract failed: local=${readString(local.verdict) || "missing"}, live=${readString(afterLive.verdict) || "missing"}, candidates=${readNumber(workbenchContract.candidateCount)}, selected=${readNumber(workbenchContract.selectedCandidateCount)}, bodies=${readNumber(workbenchContract.selectedBodyCount)}, desktopColumns=${readNumber(workbenchContract.desktopColumns)}, mobileColumns=${readNumber(workbenchContract.mobileColumns)}, internalScroll=${String(workbenchContract.candidateBodyInternalScroll)}, candidateTabs=${String(workbenchContract.candidateTablist)}, rovingTabStop=${String(workbenchContract.candidateRovingTabStop)}, candidateKeyboard=${String(workbenchContract.candidateKeyboardNavigation)}, mobilePaneKeyboard=${String(workbenchContract.mobilePaneKeyboardNavigation)}, structuredCompanion=${String(structuredPass)}, structuredVerdict=${readString(structuredReport?.verdict) || "missing"}, structuredSections=${readNumber(structuredAfterLive.candidateSectionCount)}, multiline=${String(structuredAfterLive.candidateMultilineContinuationPreserved)}, actualQueueRead=${String(structuredAfterLive.actualProductionCandidateQueueRead)}, humanReview=${String(authorityContract.humanReviewRequired)}, noMutation=${String(noMutation)}, exactShare=${readString(remainingBoundaries.exactSavedShareVerdict) || "missing"}.`,
    nextActions: ["Restore the six-role reviewer cockpit, live geometry, linked roving tabs, keyboard navigation, human-review, tenant-memory, and no-mutation boundaries."],
  });
}

/**
 * @param {string} rootDir
 * @returns {GateResult}
 */
function evaluateLiveHarnessGate(rootDir) {
  const evidencePath = EVIDENCE_PATHS.liveHarness;
  const report = readJsonFile(rootDir, evidencePath);
  if (!isRecord(report)) {
    return gateResult({
      id: "live_harness_quality",
      label: "Live evidence harness quality",
      state: "missing",
      evidencePath,
      detail: "Live harness quality report is missing or invalid.",
      nextActions: ["Run `node scripts/live_harness_quality_probe.mjs --base-url https://www.safeclaw.kr --output evaluation/live-harness-quality-probe-current-2026-07-20`."],
    });
  }

  const evaluation = isRecord(report.evaluation) ? report.evaluation : {};
  const contracts = Array.isArray(evaluation.contracts) ? evaluation.contracts : [];
  const verdict = readString(report.verdict) || readString(evaluation.verdict);
  const failedContracts = Array.isArray(report.failedContracts)
    ? report.failedContracts.length
    : contracts.filter((contract) => isRecord(contract) && contract.state === "fail").length;
  if (verdict === "pass" && failedContracts === 0) {
    return gateResult({
      id: "live_harness_quality",
      label: "Live evidence harness quality",
      state: "proven",
      evidencePath,
      detail: "Live harness probe passed with zero failed contracts.",
    });
  }

  return gateResult({
    id: "live_harness_quality",
    label: "Live evidence harness quality",
    state: "contradicted",
    evidencePath,
    detail: `Live harness verdict is ${verdict || "unknown"} with failedContracts=${failedContracts ?? "unknown"}.`,
    nextActions: ["Fix harness quality failures before recording North Star progress."],
  });
}

/**
 * @param {string} rootDir
 * @returns {GateResult}
 */
function evaluateShareRecipientAckApprovalGate(rootDir) {
  const evidencePath = EVIDENCE_PATHS.shareRecipientAckApprovalPreflight;
  const report = readJsonFile(rootDir, evidencePath);
  if (!isRecord(report)) {
    return gateResult({
      id: "share_recipient_ack_approval",
      label: "Share recipient ACK live-data approval",
      state: "missing",
      evidencePath,
      detail: "Share recipient ACK approval preflight evidence is missing.",
      nextActions: ["Run `node scripts\\share_recipient_ack_approval_preflight.mjs` before any production ACK canary."],
    });
  }

  const safe = readString(report.overall) === "approval_ready_open"
    && report.approvalRequired === true
    && report.liveDataMutationApproved === false
    && report.dbMutationPerformed === false
    && report.providerMessageSent === false
    && report.productionShareSessionCreated === false
    && report.productionReadConfirmationInserted === false
    && Array.isArray(report.failedCheckIds)
    && report.failedCheckIds.length === 0;

  if (safe) {
    return gateResult({
      id: "share_recipient_ack_approval",
      label: "Share recipient ACK live-data approval",
      state: "approval_gated",
      evidencePath,
      detail: "Recipient ACK route/test preflight is operator-ready, but a real production invited-recipient ACK canary would create workpack_share_sessions and workpack_read_confirmations rows, so it remains approval-gated with no DB mutation or provider message sent.",
      nextActions: [
        "Use the approval preflight to prepare a disposable workpack/worker ACK canary only after explicit live-data mutation approval.",
        "Do not claim real invited-recipient ACK readback until production share-session creation and read-confirmation insertion are approved and measured.",
      ],
    });
  }

  return gateResult({
    id: "share_recipient_ack_approval",
    label: "Share recipient ACK live-data approval",
    state: "contradicted",
    evidencePath,
    detail: "Share recipient ACK preflight no longer preserves approval-required, no-mutation, or no-provider-message boundaries.",
    nextActions: ["Restore the approval-held recipient ACK preflight before any live-data canary."],
  });
}

/**
 * @param {string} rootDir
 * @returns {GateResult}
 */
function evaluateDocumentQualityGroundingGate(rootDir) {
  const evidencePath = EVIDENCE_PATHS.documentQualityGrounding;
  const report = readJsonFile(rootDir, evidencePath);
  if (!isRecord(report)) {
    return gateResult({
      id: "document_quality_grounding",
      label: "Document quality grounding contract",
      state: "missing",
      evidencePath,
      detail: "Document quality grounding report is missing or invalid.",
      nextActions: ["Run `node evaluation\\document-quality-grounding-current-gate-2026-07-19\\run-document-quality-grounding-current-gate.mjs --base-url https://www.safeclaw.kr`."],
    });
  }

  const verdict = readString(report.verdict);
  const focusedTests = isRecord(report.focusedTests) ? report.focusedTests : {};
  const testsStatus = readString(focusedTests.status);
  const testsPassed = readNumber(focusedTests.testsPassed);
  const boundaries = isRecord(report.boundaries) ? report.boundaries : {};
  const noMutation = boundaries.dbMutationPerformed === false
    && boundaries.schemaMigrationPerformed === false
    && boundaries.providerDispatchLiveClaimed === false
    && boundaries.llmWikiPublicationPerformed === false
    && boundaries.exactKoshaRegistryMutationPerformed === false;
  const contracts = isRecord(report.verifiedContracts) ? report.verifiedContracts : {};
  const requiredContractsReady = contracts.sifKoshaLawBeforeLlmProse === true
    && contracts.llmRoleNaturalizeOnly === true
    && contracts.providerAuthoredUnsupportedHazardsRejected === true
    && contracts.qualityContractBlocksIncompleteOutputs === true
    && contracts.koshaSupportingEvidenceIsNotLawMandate === true
    && contracts.exactKoshaMaterializationCovered === true;

  if (verdict === "PASS_CURRENT_SOURCE_DOCUMENT_QUALITY_GROUNDING_CONTRACT"
    && testsStatus === "pass"
    && testsPassed > 0
    && noMutation
    && requiredContractsReady) {
    return gateResult({
      id: "document_quality_grounding",
      label: "Document quality grounding contract",
      state: "proven",
      evidencePath,
      detail: `Current source proves the document-quality grounding contract with ${testsPassed} focused tests: SIF/KOSHA/law evidence stays before LLM prose, LLM role remains naturalize_only, unsupported provider hazards are rejected, qualityContract blocks incomplete outputs, and KOSHA support is not promoted to statutory mandate. This is not a claim that every live model sample is excellent.`,
      nextActions: [
        "Keep live model sample excellence separate from the deterministic document-quality grounding contract.",
        "Continue requiring human review for wording quality, concision, and field usability before broad launch claims.",
      ],
    });
  }

  return gateResult({
    id: "document_quality_grounding",
    label: "Document quality grounding contract",
    state: "contradicted",
    evidencePath,
    detail: `Document quality grounding verdict is ${verdict || "unknown"} with tests=${testsStatus || "unknown"} and noMutation=${noMutation}.`,
    nextActions: ["Fix the focused document-quality grounding suite before claiming 99+ document-quality progress."],
  });
}

/**
 * @param {string} rootDir
 * @returns {GateResult}
 */
function evaluateLiveDocumentQualityMatrixGate(rootDir) {
  const evidencePath = EVIDENCE_PATHS.liveDocumentQualityMatrix;
  const report = readJsonFile(rootDir, evidencePath);
  if (!isRecord(report)) {
    return gateResult({
      id: "live_document_quality_matrix",
      label: "Live multi-scenario document quality",
      state: "missing",
      evidencePath,
      detail: "Live multi-scenario document quality report is missing or invalid.",
      nextActions: ["Run the five-scenario live document quality matrix and commit its before/local/live evidence."],
    });
  }

  const afterLive = isRecord(report.afterLive) ? report.afterLive : {};
  const boundaries = isRecord(report.boundaries) ? report.boundaries : {};
  const scenarioCount = Array.isArray(report.scenarios) ? report.scenarios.length : 0;
  const liveTotal = readNumber(afterLive.total);
  const livePass = readNumber(afterLive.pass);
  const liveFail = readNumber(afterLive.fail);
  const noMutation = boundaries.dbMutationPerformed === false
    && boundaries.shareSessionCreated === false
    && boundaries.providerDispatchLiveClaimed === false
    && boundaries.externalProviderCalled === false;
  const contractsReady = afterLive.structuredRiskRowsPresent === true
    && afterLive.structuredRiskControlsDistinct === true
    && afterLive.foreignWorkerScenarioRelevance === true;
  const liveReady = readString(report.verdict) === "PASS_LIVE_PRODUCTION_MULTI_SCENARIO_DOCUMENT_QUALITY"
    && report.sourceHeadMatchesProduction === true
    && scenarioCount === 5
    && liveTotal === 5
    && livePass === 5
    && liveFail === 0
    && contractsReady
    && noMutation;

  if (liveReady) {
    return gateResult({
      id: "live_document_quality_matrix",
      label: "Live multi-scenario document quality",
      state: "proven",
      evidencePath,
      detail: "Five live production scenarios pass the measured document-quality matrix: structured risk rows are present, current/additional controls remain distinct, foreign-worker briefing stays scenario-relevant, and no DB/share-session/provider mutation occurred. This scoped matrix does not replace broad human wording review.",
      nextActions: [
        "Keep broad wording, concision, and field-usability review as a separate human-review boundary beyond the measured five-scenario matrix.",
      ],
    });
  }

  return gateResult({
    id: "live_document_quality_matrix",
    label: "Live multi-scenario document quality",
    state: "contradicted",
    evidencePath,
    detail: `Live matrix verdict=${readString(report.verdict) || "unknown"}, scenarios=${scenarioCount}, live=${livePass}/${liveTotal}, failed=${liveFail}, sourceMatchesProduction=${report.sourceHeadMatchesProduction === true}, noMutation=${noMutation}.`,
    nextActions: ["Fix the failing live scenario contracts and rerun the before/local/live matrix without weakening the runner."],
  });
}

/**
 * @param {string} rootDir
 * @returns {GateResult}
 */
function evaluateLiveDocumentQualityStressMatrixGate(rootDir) {
  const evidencePath = EVIDENCE_PATHS.liveDocumentQualityStressMatrix;
  const report = readJsonFile(rootDir, evidencePath);
  if (!isRecord(report)) {
    return gateResult({
      id: "live_document_quality_stress_matrix",
      label: "Live high-risk document quality stress matrix",
      state: "missing",
      evidencePath,
      detail: "Live high-risk document quality stress report is missing or invalid.",
      nextActions: ["Run the unchanged five-scenario stress matrix against production and commit the before/local/live evidence."],
    });
  }

  const afterLive = isRecord(report.afterLive) ? report.afterLive : {};
  const boundaries = isRecord(report.boundaries) ? report.boundaries : {};
  const liveTotal = readNumber(afterLive.total);
  const livePass = readNumber(afterLive.pass);
  const liveFail = readNumber(afterLive.fail);
  const noMutation = boundaries.dbMutationPerformed === false
    && boundaries.shareSessionCreated === false
    && boundaries.providerDispatchPerformed === false
    && boundaries.exactSavedShareSessionReproduced === false;
  const liveReady = readString(report.verdict) === "PASS_LIVE_PRODUCTION_STRESS_MATRIX"
    && report.productCommitIncludedInProduction === true
    && liveTotal === 5
    && livePass === 5
    && liveFail === 0
    && boundaries.liveProductionClaimed === true
    && boundaries.liveAfterDeploymentPending === false
    && noMutation;

  if (liveReady) {
    return gateResult({
      id: "live_document_quality_stress_matrix",
      label: "Live high-risk document quality stress matrix",
      state: "proven",
      evidencePath,
      detail: "Five live production stress scenarios preserve SDS/GHS identity, simultaneous-work separation, vulnerable-worker communication, KOSHA guidance boundaries, and overnight handover/re-energization controls. No DB/share-session/provider mutation occurred; broad human wording review remains separate.",
      nextActions: ["Keep the unchanged stress contracts in the release gate and preserve broad human wording review as a separate boundary."],
    });
  }

  return gateResult({
    id: "live_document_quality_stress_matrix",
    label: "Live high-risk document quality stress matrix",
    state: "contradicted",
    evidencePath,
    detail: `Stress matrix verdict=${readString(report.verdict) || "unknown"}, live=${livePass}/${liveTotal}, failed=${liveFail}, productIncludedInProduction=${report.productCommitIncludedInProduction === true}, noMutation=${noMutation}.`,
    nextActions: ["Fix the failing high-risk scenario contracts and rerun the unchanged stress matrix without weakening its semantic checks."],
  });
}

/**
 * @param {string} rootDir
 * @returns {GateResult}
 */
function evaluateLiveDocumentFieldIsolationGate(rootDir) {
  const evidencePath = EVIDENCE_PATHS.liveDocumentFieldIsolation;
  const report = readJsonFile(rootDir, evidencePath);
  if (!isRecord(report)) {
    return gateResult({
      id: "live_document_field_isolation",
      label: "Live document scenario field isolation",
      state: "missing",
      evidencePath,
      detail: "Live process/task/equipment field-isolation evidence is missing or invalid.",
      nextActions: ["Run the normal and stress field-isolation matrices against production without weakening scenario fingerprints."],
    });
  }

  const afterLive = isRecord(report.afterLive) ? report.afterLive : {};
  const normal = isRecord(afterLive.normal) ? afterLive.normal : {};
  const stress = isRecord(afterLive.stress) ? afterLive.stress : {};
  const boundary = isRecord(report.mutationBoundary) ? report.mutationBoundary : {};
  const guidance = readJsonFile(rootDir, EVIDENCE_PATHS.liveForeignWorkerScenarioGuidance);
  const guidanceAfterLive = isRecord(guidance) && isRecord(guidance.afterLive) ? guidance.afterLive : {};
  const guidanceCases = Array.isArray(guidanceAfterLive.cases) ? guidanceAfterLive.cases.filter(isRecord) : [];
  const chemicalGuidanceCase = guidanceCases.find((item) => readString(item.id) === "chemical-cleaning-negative");
  const heatGuidanceCase = guidanceCases.find((item) => readString(item.id) === "heat-logistics-positive");
  const guidanceMutation = isRecord(guidance) && isRecord(guidance.mutationBoundary) ? guidance.mutationBoundary : {};
  const guidanceRemaining = isRecord(guidance) && isRecord(guidance.remainingBoundaries) ? guidance.remainingBoundaries : {};
  const guidanceReady = isRecord(guidance)
    && readString(guidance.schema) === "safeclaw-live-foreign-worker-scenario-guidance/v1"
    && readString(guidance.verdict) === "PASS_LIVE_PRODUCTION_FOREIGN_WORKER_SCENARIO_GUIDANCE"
    && readString(guidance.productCommit) === readString(guidance.productionCommit)
    && readNumber(guidanceAfterLive.passed) === 2
    && readNumber(guidanceAfterLive.failed) === 0
    && guidanceAfterLive.providerGenerationRequested === false
    && isRecord(chemicalGuidanceCase)
    && readNumber(chemicalGuidanceCase.status) === 200
    && readString(chemicalGuidanceCase.responseAiMode) === "template"
    && readNumber(chemicalGuidanceCase.providerWorkUnit) === 0
    && chemicalGuidanceCase.heatGuidancePresent === false
    && chemicalGuidanceCase.expectedScenarioContextPresent === true
    && chemicalGuidanceCase.pass === true
    && isRecord(heatGuidanceCase)
    && readNumber(heatGuidanceCase.status) === 200
    && readString(heatGuidanceCase.responseAiMode) === "template"
    && readNumber(heatGuidanceCase.providerWorkUnit) === 0
    && heatGuidanceCase.heatGuidancePresent === true
    && heatGuidanceCase.expectedScenarioContextPresent === true
    && heatGuidanceCase.pass === true
    && guidanceMutation.dbMutationPerformed === false
    && guidanceMutation.providerGenerationPerformed === false
    && guidanceMutation.providerDispatchPerformed === false
    && guidanceMutation.shareSessionCreated === false
    && guidanceRemaining.humanReviewCompleted === false
    && readString(guidanceRemaining.exactSavedShareVerdict) === "MISSING_EVIDENCE"
    && guidanceRemaining.fullyAutomatedLaunchClaimAllowed === false;
  const roofIsolation = readJsonFile(rootDir, EVIDENCE_PATHS.liveRoofRepairScenarioIsolation);
  const roofAfterLive = isRecord(roofIsolation) && isRecord(roofIsolation.afterLive) ? roofIsolation.afterLive : {};
  const roofCases = Array.isArray(roofAfterLive.cases) ? roofAfterLive.cases.filter(isRecord) : [];
  const roofCase = roofCases.find((item) => readString(item.id) === "roof-repair-heat");
  const warehouseControlCase = roofCases.find((item) => readString(item.id) === "warehouse-heat-control");
  const roofMutation = isRecord(roofIsolation) && isRecord(roofIsolation.mutationBoundary) ? roofIsolation.mutationBoundary : {};
  const roofRemaining = isRecord(roofIsolation) && isRecord(roofIsolation.remainingBoundaries) ? roofIsolation.remainingBoundaries : {};
  const roofIsolationReady = isRecord(roofIsolation)
    && readString(roofIsolation.schema) === "safeclaw-live-roof-repair-scenario-isolation/v1"
    && readString(roofIsolation.verdict) === "PASS_LIVE_PRODUCTION_ROOF_REPAIR_SCENARIO_ISOLATION"
    && readString(roofIsolation.productCommit) === readString(roofIsolation.productionCommit)
    && readNumber(roofAfterLive.passed) === 2
    && readNumber(roofAfterLive.failed) === 0
    && roofAfterLive.providerGenerationRequested === false
    && isRecord(roofCase)
    && readNumber(roofCase.status) === 200
    && readString(roofCase.responseAiMode) === "template"
    && readNumber(roofCase.providerWorkUnit) === 0
    && roofCase.roofIdentityPresent === true
    && roofCase.fallContextPresent === true
    && roofCase.heatContextPresent === true
    && roofCase.heatGuidancePresent === true
    && roofCase.warehouseSeedPresent === false
    && roofCase.pass === true
    && isRecord(warehouseControlCase)
    && readNumber(warehouseControlCase.status) === 200
    && readString(warehouseControlCase.responseAiMode) === "template"
    && readNumber(warehouseControlCase.providerWorkUnit) === 0
    && warehouseControlCase.roofIdentityPresent === false
    && warehouseControlCase.heatContextPresent === true
    && warehouseControlCase.heatGuidancePresent === true
    && warehouseControlCase.warehouseSeedPresent === true
    && warehouseControlCase.warehouseIdentityPresent === true
    && warehouseControlCase.pass === true
    && roofMutation.dbMutationPerformed === false
    && roofMutation.providerGenerationPerformed === false
    && roofMutation.providerDispatchPerformed === false
    && roofMutation.shareSessionCreated === false
    && roofRemaining.humanReviewCompleted === false
    && readString(roofRemaining.exactSavedShareVerdict) === "MISSING_EVIDENCE"
    && roofRemaining.fullyAutomatedLaunchClaimAllowed === false;
  const accidentIsolation = readJsonFile(rootDir, EVIDENCE_PATHS.liveAccidentCaseScenarioIsolation);
  const accidentAfterLive = isRecord(accidentIsolation) && isRecord(accidentIsolation.afterLive) ? accidentIsolation.afterLive : {};
  const accidentCases = Array.isArray(accidentAfterLive.cases) ? accidentAfterLive.cases.filter(isRecord) : [];
  const accidentMutation = isRecord(accidentIsolation) && isRecord(accidentIsolation.mutationBoundary) ? accidentIsolation.mutationBoundary : {};
  const accidentRemaining = isRecord(accidentIsolation) && isRecord(accidentIsolation.remainingBoundaries) ? accidentIsolation.remainingBoundaries : {};
  /**
   * @param {string} id
   * @param {number} expectedCount
   * @param {string[]} requiredTerms
   * @param {string[]} forbiddenTerms
   */
  const accidentCasePass = (id, expectedCount, requiredTerms, forbiddenTerms) => {
    const item = accidentCases.find((candidate) => readString(candidate.id) === id);
    if (!isRecord(item)) return false;
    const titleSurface = readStringArray(item.titles).join(" ");
    return readNumber(item.status) === 200
      && readString(item.responseAiMode) === "template"
      && readNumber(item.providerWorkUnit) === 0
      && readString(item.accidentMode) === "fallback"
      && readNumber(item.caseCount) === expectedCount
      && requiredTerms.every((term) => titleSurface.includes(term))
      && forbiddenTerms.every((term) => !titleSurface.includes(term))
      && item.requiredTermsPresent === true
      && item.forbiddenIndustryPresent === false
      && item.pass === true;
  };
  const accidentIsolationReady = isRecord(accidentIsolation)
    && readString(accidentIsolation.schema) === "safeclaw-live-accident-case-scenario-isolation/v1"
    && readString(accidentIsolation.verdict) === "PASS_LIVE_PRODUCTION_ACCIDENT_CASE_SCENARIO_ISOLATION"
    && readString(accidentIsolation.productCommit) === readString(accidentIsolation.productionCommit)
    && readNumber(accidentAfterLive.total) === 5
    && readNumber(accidentAfterLive.passed) === 5
    && readNumber(accidentAfterLive.failed) === 0
    && readNumber(accidentAfterLive.forbiddenIndustryCaseCount) === 0
    && accidentAfterLive.providerGenerationRequested === false
    && accidentCasePass("roof-heat", 2, ["추락", "온열질환"], ["지게차", "용접", "기계실", "세척"])
    && accidentCasePass("warehouse-heat", 2, ["지게차", "온열질환"], ["추락", "용접", "기계실", "세척"])
    && accidentCasePass("chemical-cleaning", 1, ["세척"], ["추락", "지게차", "용접", "기계실"])
    && accidentCasePass("manufacturing-hotwork", 1, ["용접"], ["추락", "지게차", "기계실", "세척"])
    && accidentCasePass("facility-electrical", 1, ["기계실"], ["추락", "지게차", "용접", "세척"])
    && accidentMutation.dbMutationPerformed === false
    && accidentMutation.providerGenerationPerformed === false
    && accidentMutation.providerDispatchPerformed === false
    && accidentMutation.shareSessionCreated === false
    && accidentRemaining.humanReviewCompleted === false
    && readString(accidentRemaining.exactSavedShareVerdict) === "MISSING_EVIDENCE"
    && accidentRemaining.fullyAutomatedLaunchClaimAllowed === false;
  const maintenanceIsolation = readJsonFile(rootDir, EVIDENCE_PATHS.liveAccidentCaseMaintenanceIsolation);
  const maintenanceAfterLive = isRecord(maintenanceIsolation) && isRecord(maintenanceIsolation.afterLive)
    ? maintenanceIsolation.afterLive
    : {};
  const maintenanceCases = Array.isArray(maintenanceAfterLive.cases)
    ? maintenanceAfterLive.cases.filter(isRecord)
    : [];
  const maintenanceMutation = isRecord(maintenanceIsolation) && isRecord(maintenanceIsolation.mutationBoundary)
    ? maintenanceIsolation.mutationBoundary
    : {};
  const maintenanceRemaining = isRecord(maintenanceIsolation) && isRecord(maintenanceIsolation.remainingBoundaries)
    ? maintenanceIsolation.remainingBoundaries
    : {};
  /** @param {string} id @param {string} requiredTitle @param {string[]} forbiddenTitles */
  const maintenanceCasePass = (id, requiredTitle, forbiddenTitles) => {
    const item = maintenanceCases.find((candidate) => readString(candidate.id) === id);
    if (!isRecord(item)) return false;
    const titleSurface = readStringArray(item.titles).join(" ");
    return readNumber(item.status) === 200
      && readString(item.responseAiMode) === "template"
      && readNumber(item.providerWorkUnit) === 0
      && readString(item.rateLimitMode) === "instance"
      && readString(item.accidentMode) === "fallback"
      && readNumber(item.caseCount) === 1
      && titleSurface.includes(requiredTitle)
      && forbiddenTitles.every((term) => !titleSurface.includes(term))
      && item.forbiddenIndustryPresent === false
      && item.pass === true;
  };
  const maintenanceIsolationReady = isRecord(maintenanceIsolation)
    && readString(maintenanceIsolation.schema) === "safeclaw-live-accident-case-maintenance-isolation/v1"
    && readString(maintenanceIsolation.verdict) === "PASS_LIVE_PRODUCTION_ACCIDENT_CASE_MAINTENANCE_ISOLATION"
    && readString(maintenanceIsolation.productCommit) === readString(maintenanceIsolation.productionCommit)
    && readNumber(maintenanceAfterLive.total) === 5
    && readNumber(maintenanceAfterLive.passed) === 5
    && readNumber(maintenanceAfterLive.failed) === 0
    && readNumber(maintenanceAfterLive.forbiddenIndustryCaseCount) === 0
    && maintenanceAfterLive.providerGenerationRequested === false
    && maintenanceCasePass("ulsan-chemical", "세척", ["지게차", "용접", "비계", "기계실", "자동화설비 정비", "양중·화기"])
    && maintenanceCasePass("pyeongtaek-simultaneous", "양중·화기 동시작업", ["지게차", "세척", "비계", "기계실", "자동화설비 정비"])
    && maintenanceCasePass("daejeon-maintenance", "자동화설비 정비", ["지게차", "용접", "비계", "기계실", "세척", "양중·화기"])
    && maintenanceCasePass("gumi-guarding", "자동화설비 정비", ["지게차", "용접", "비계", "기계실", "세척", "양중·화기"])
    && maintenanceCasePass("jeju-electrical", "기계실", ["지게차", "용접", "비계", "세척", "자동화설비 정비", "양중·화기"])
    && maintenanceMutation.dbMutationPerformed === false
    && maintenanceMutation.providerGenerationPerformed === false
    && maintenanceMutation.providerDispatchPerformed === false
    && maintenanceMutation.shareSessionCreated === false
    && maintenanceRemaining.humanReviewCompleted === false
    && readString(maintenanceRemaining.exactSavedShareVerdict) === "MISSING_EVIDENCE"
    && maintenanceRemaining.fullyAutomatedLaunchClaimAllowed === false;
  const livePass = readNumber(normal.pass) + readNumber(stress.pass);
  const liveFail = readNumber(normal.fail) + readNumber(stress.fail);
  const noMutation = boundary.dbMutationPerformed === false
    && boundary.shareSessionCreated === false
    && boundary.providerDispatchCalled === false
    && boundary.exactSavedShareSessionReproduced === false;
  const liveReady = readString(report.verdict) === "PASS_LIVE_PRODUCTION_DOCUMENT_FIELD_ISOLATION"
    && livePass === 10
    && liveFail === 0
    && report.liveAfterDeploymentPending === false
    && noMutation
    && guidanceReady
    && roofIsolationReady
    && accidentIsolationReady
    && maintenanceIsolationReady;

  if (liveReady) {
    return gateResult({
      id: "live_document_field_isolation",
      label: "Live document scenario field isolation",
      state: "proven",
      evidencePath,
      detail: `Ten live normal and stress scenarios keep process/task/equipment fields grounded in their own work identity and free of other scenario-exclusive fingerprints. The companion ${EVIDENCE_PATHS.liveForeignWorkerScenarioGuidance} additionally proves heat guidance absent for chemical cleaning and present for explicit heat work in template mode with work-unit 0. ${EVIDENCE_PATHS.liveRoofRepairScenarioIsolation} proves the roof-repair heat case keeps roof/fall identity with warehouse seed absent while the warehouse control retains its intended identity. ${EVIDENCE_PATHS.liveAccidentCaseScenarioIsolation} proves 5/5 live fallback accident-case arrays retain only scenario-relevant fall, heat, forklift, chemical, hot-work, or facility evidence. ${EVIDENCE_PATHS.liveAccidentCaseMaintenanceIsolation} adds 5/5 chemical, simultaneous lifting/hot-work, conveyor maintenance, automation guarding, and electrical repair evidence with 0 unrelated-industry cases. No DB/share-session/provider mutation occurred; broad human wording review and exact saved Share geometry remain separate.`,
      nextActions: ["Keep the 10-scenario field-isolation gate in release evidence and preserve broad human wording review as a separate boundary."],
    });
  }

  return gateResult({
    id: "live_document_field_isolation",
    label: "Live document scenario field isolation",
    state: "contradicted",
    evidencePath,
    detail: `Field-isolation verdict=${readString(report.verdict) || "unknown"}, live=${livePass}/10, failed=${liveFail}, livePending=${report.liveAfterDeploymentPending === true}, noMutation=${noMutation}, foreignWorkerGuidance=${guidanceReady}, roofRepairIsolation=${roofIsolationReady}, accidentCaseIsolation=${accidentIsolationReady}, maintenanceAccidentIsolation=${maintenanceIsolationReady}.`,
    nextActions: ["Fix process/task/equipment grounding or cross-scenario leakage and rerun the unchanged normal and stress matrices."],
  });
}

/**
 * @param {string} rootDir
 * @returns {GateResult}
 */
function evaluateLiveKoshaExactMaterializationGate(rootDir) {
  const evidencePath = EVIDENCE_PATHS.liveKoshaExactMaterialization;
  const report = readJsonFile(rootDir, evidencePath);
  if (!isRecord(report)) {
    return gateResult({
      id: "live_kosha_exact_materialization",
      label: "Live KOSHA exact-pin materialization",
      state: "missing",
      evidencePath,
      detail: "Live exact KOSHA pin materialization evidence is missing or invalid.",
      nextActions: ["Run the unchanged three-scenario exact-pin matrix against production without expanding the exact registry."],
    });
  }

  const afterLive = isRecord(report.afterLive) ? report.afterLive : {};
  const boundary = isRecord(report.mutationBoundary) ? report.mutationBoundary : {};
  const liveTotal = readNumber(afterLive.total);
  const livePass = readNumber(afterLive.pass);
  const liveFail = readNumber(afterLive.fail);
  const noMutation = boundary.dbMutationPerformed === false
    && boundary.shareSessionCreated === false
    && boundary.providerDispatchCalled === false
    && boundary.exactTrustRegistryExpanded === false;
  const liveReady = readString(report.verdict) === "PASS_LIVE_PRODUCTION_KOSHA_EXACT_MATERIALIZATION"
    && report.productCommitMatchesProduction === true
    && report.liveAfterDeploymentPending === false
    && liveTotal === 3
    && livePass === 3
    && liveFail === 0
    && noMutation;

  if (liveReady) {
    return gateResult({
      id: "live_kosha_exact_materialization",
      label: "Live KOSHA exact-pin materialization",
      state: "proven",
      evidencePath,
      detail: "Three live production scenarios materialize D-C-13, D-C-7, and B-E-10 in relevant structured risk rows without an unexpected exact pin, KOSHA statutory overclaim, field leakage, DB/share/provider mutation, or exact-registry expansion.",
      nextActions: ["Keep this three-pin materialization gate in release evidence; any additional exact-trust promotion still requires completed human review and separate approval."],
    });
  }

  return gateResult({
    id: "live_kosha_exact_materialization",
    label: "Live KOSHA exact-pin materialization",
    state: "contradicted",
    evidencePath,
    detail: `Exact materialization verdict=${readString(report.verdict) || "unknown"}, live=${livePass}/${liveTotal}, failed=${liveFail}, productMatchesProduction=${report.productCommitMatchesProduction === true}, livePending=${report.liveAfterDeploymentPending === true}, noMutation=${noMutation}.`,
    nextActions: ["Fix exact-pin materialization, field leakage, or guidance-overclaim failures and rerun the unchanged three-scenario live matrix."],
  });
}

/**
 * @param {string} rootDir
 * @returns {GateResult}
 */
function evaluateLiveDocumentWordingReviewGate(rootDir) {
  const evidencePath = EVIDENCE_PATHS.liveDocumentWordingReview;
  const report = readJsonFile(rootDir, evidencePath);
  if (!isRecord(report)) {
    return gateResult({
      id: "live_document_wording_review",
      label: "Live synthetic document wording review",
      state: "missing",
      evidencePath,
      detail: "Live synthetic wording and field-usability review is missing or invalid.",
      nextActions: ["Run the unchanged five-scenario wording review against production without weakening its field checks."],
    });
  }

  const afterLive = isRecord(report.afterLive) ? report.afterLive : {};
  const mutationBoundary = isRecord(report.mutationBoundary) ? report.mutationBoundary : {};
  const liveTotal = readNumber(afterLive.total);
  const livePass = readNumber(afterLive.pass);
  const liveFail = readNumber(afterLive.fail);
  const noMutation = mutationBoundary.dbMutationPerformed === false
    && mutationBoundary.shareSessionCreated === false
    && mutationBoundary.providerDispatchCalled === false
    && mutationBoundary.exactSavedShareReproduced === false;
  const liveReady = readString(report.verdict) === "PASS_LIVE_PRODUCTION_SYNTHETIC_WORDING_REVIEW"
    && report.liveAfterDeploymentPending === false
    && readString(report.productCommit).length > 0
    && readString(report.productionCommitAfterDeployment).length > 0
    && liveTotal === 5
    && livePass === 5
    && liveFail === 0
    && noMutation;

  if (liveReady) {
    return gateResult({
      id: "live_document_wording_review",
      label: "Live synthetic document wording review",
      state: "proven",
      evidencePath,
      detail: "Five live production synthetic scenarios pass fail-closed wording and field-usability checks after removing fixed-profile location leakage from structured risk rows. No DB/share-session/provider mutation occurred; broad human review and exact saved Share evidence remain separate.",
      nextActions: ["Keep broad human review of real user documents separate from this measured synthetic wording gate."],
    });
  }

  return gateResult({
    id: "live_document_wording_review",
    label: "Live synthetic document wording review",
    state: "contradicted",
    evidencePath,
    detail: `Wording review verdict=${readString(report.verdict) || "unknown"}, live=${livePass}/${liveTotal}, failed=${liveFail}, livePending=${report.liveAfterDeploymentPending !== false}, noMutation=${noMutation}.`,
    nextActions: ["Fix the failing wording or field-usability checks and rerun the unchanged five-scenario live gate."],
  });
}

/**
 * @param {string} rootDir
 * @returns {GateResult}
 */
function evaluateLiveDocumentBroadReviewGate(rootDir) {
  const evidencePath = EVIDENCE_PATHS.liveDocumentBroadReview;
  const report = readJsonFile(rootDir, evidencePath);
  if (!isRecord(report)) {
    return gateResult({
      id: "live_document_broad_review",
      label: "Live 12-deliverable broad review",
      state: "missing",
      evidencePath,
      detail: "Live 12-deliverable presence and applicability review is missing or invalid.",
      nextActions: ["Run the fail-closed 12-deliverable gate against production and preserve before/local/live evidence."],
    });
  }

  const stages = isRecord(report.stages) ? report.stages : {};
  const before = isRecord(stages.beforeRemediation) ? stages.beforeRemediation : {};
  const afterLive = isRecord(stages.afterLive) ? stages.afterLive : {};
  const mutationBoundary = isRecord(report.mutationBoundary) ? report.mutationBoundary : {};
  const workPermitMatrix = Array.isArray(report.workPermitMatrix)
    ? report.workPermitMatrix.filter(isRecord)
    : [];
  const livePermitPass = workPermitMatrix.filter((item) => (
    item.status === "presentNonEmpty" && item.verdict === "PASS"
  )).length;
  const noMutation = mutationBoundary.dbMutationPerformed === false
    && mutationBoundary.shareSessionCreated === false
    && mutationBoundary.providerDispatchCalled === false
    && mutationBoundary.exactSavedShareReproduced === false;
  const liveReady = readString(report.verdict) === "PASS_LIVE_PRODUCTION_12_DELIVERABLE_BROAD_REVIEW"
    && readNumber(report.uiDocumentCount) === 12
    && readNumber(report.integrityRequiredCount) === 12
    && readNumber(report.reviewedDocumentCount) === 12
    && readNumber(before.pass) === 0
    && readNumber(before.fail) === 5
    && readNumber(before.missingUnexpectedCount) === 5
    && readNumber(afterLive.pass) === 5
    && readNumber(afterLive.fail) === 0
    && readNumber(afterLive.missingUnexpectedCount) === 0
    && livePermitPass === 5
    && readString(report.productCommit).length > 0
    && readString(report.sourceHead).length > 0
    && readString(report.sourceHead) === readString(report.productionCommit)
    && noMutation;

  if (liveReady) {
    return gateResult({
      id: "live_document_broad_review",
      label: "Live 12-deliverable broad review",
      state: "proven",
      evidencePath,
      detail: `All 12 canonical UI deliverables are enumerated and classified across five live production scenarios: uiDocumentCount=12, integrityRequiredCount=12, reviewedDocumentCount=12, before missingUnexpected=5, after-live missingUnexpected=0, and workPermitDraft presentNonEmpty=${livePermitPass}/5. DB/share/provider mutation is false and exact saved Share remains ${readString(mutationBoundary.exactSavedShareVerdict) || "MISSING_EVIDENCE"}. The older six-document synthetic wording gate is not used as 12-document coverage proof.`,
      nextActions: [
        "Keep presence/applicability coverage separate from broad human wording review of real user documents.",
        "Keep exact saved Share evidence separate; this gate performs no DB/share/provider mutation.",
      ],
    });
  }

  return gateResult({
    id: "live_document_broad_review",
    label: "Live 12-deliverable broad review",
    state: "contradicted",
    evidencePath,
    detail: `Broad review verdict=${readString(report.verdict) || "unknown"}, ui=${readNumber(report.uiDocumentCount)}, integrity=${readNumber(report.integrityRequiredCount)}, reviewed=${readNumber(report.reviewedDocumentCount)}, before=${readNumber(before.pass)}/${readNumber(before.fail)}, live=${readNumber(afterLive.pass)}/${readNumber(afterLive.fail)}, liveMissing=${readNumber(afterLive.missingUnexpectedCount)}, workPermit=${livePermitPass}/5, sourceMatchesProduction=${readString(report.sourceHead).length > 0 && readString(report.sourceHead) === readString(report.productionCommit)}, noMutation=${noMutation}.`,
    nextActions: ["Fix missing, silent not-applicable, or permit-applicability failures and rerun the unchanged 12-deliverable gate."],
  });
}

/**
 * @param {string} rootDir
 * @returns {GateResult}
 */
function evaluateLiveDocumentSecondaryGroundingGate(rootDir) {
  const evidencePath = EVIDENCE_PATHS.liveDocumentSecondaryGrounding;
  const report = readJsonFile(rootDir, evidencePath);
  if (!isRecord(report)) {
    return gateResult({
      id: "live_document_secondary_grounding",
      label: "Live secondary document grounding",
      state: "missing",
      evidencePath,
      detail: "Live supporting-document scenario grounding evidence is missing or invalid.",
      nextActions: ["Run the unchanged six-document secondary grounding contract across the five live stress scenarios."],
    });
  }

  const stages = isRecord(report.stages) ? report.stages : {};
  const afterLive = isRecord(stages.afterLive) ? stages.afterLive : {};
  const mutationBoundary = isRecord(report.mutationBoundary) ? report.mutationBoundary : {};
  const noMutation = mutationBoundary.dbMutationPerformed === false
    && mutationBoundary.shareSessionCreated === false
    && mutationBoundary.providerDispatchCalled === false
    && mutationBoundary.exactSavedShareReproduced === false;
  const sourceMatchesProduction = readString(report.sourceHead).length > 0
    && readString(report.sourceHead) === readString(report.productionCommit);
  const liveReady = readString(report.verdict) === "PASS_LIVE_PRODUCTION_SECONDARY_DOCUMENT_GROUNDING_CONTRACT"
    && sourceMatchesProduction
    && readNumber(afterLive.cases) === 5
    && readNumber(afterLive.pass) === 5
    && readNumber(afterLive.fail) === 0
    && readNumber(afterLive.secondaryReviewed) === 30
    && readNumber(afterLive.secondaryPassed) === 30
    && readNumber(afterLive.crossScenarioLeakageCount) === 0
    && readNumber(afterLive.missingUnexpectedCount) === 0
    && noMutation;

  if (liveReady) {
    return gateResult({
      id: "live_document_secondary_grounding",
      label: "Live secondary document grounding",
      state: "proven",
      evidencePath,
      detail: `All six secondary deliverables pass scenario grounding across five live production scenarios: cases=5/5, documents=30/30, cross-scenario leakage=0, missingUnexpected=0. DB/share/provider mutation is false and exact saved Share remains ${readString(mutationBoundary.exactSavedShareVerdict) || "MISSING_EVIDENCE"}. This deterministic contract does not replace the six-document wording gate, 12-document presence gate, or broad human review.`,
      nextActions: ["Keep broad human review and exact saved Share evidence separate from this deterministic supporting-document contract."],
    });
  }

  return gateResult({
    id: "live_document_secondary_grounding",
    label: "Live secondary document grounding",
    state: "contradicted",
    evidencePath,
    detail: `Secondary grounding verdict=${readString(report.verdict) || "unknown"}, live=${readNumber(afterLive.pass)}/${readNumber(afterLive.cases)}, documents=${readNumber(afterLive.secondaryPassed)}/${readNumber(afterLive.secondaryReviewed)}, leakage=${readNumber(afterLive.crossScenarioLeakageCount)}, missing=${readNumber(afterLive.missingUnexpectedCount)}, sourceMatchesProduction=${sourceMatchesProduction}, noMutation=${noMutation}.`,
    nextActions: ["Fix scenario grounding, semantic-group, or cross-scenario leakage failures and rerun the unchanged live contract."],
  });
}

/**
 * @param {string} rootDir
 * @returns {GateResult}
 */
function evaluateLiveDocumentEditorialReviewGate(rootDir) {
  const evidencePath = EVIDENCE_PATHS.liveDocumentEditorialReview;
  const report = readJsonFile(rootDir, evidencePath);
  const duplicateEvidencePath = EVIDENCE_PATHS.liveDocumentEditorialDuplicateClassification;
  const duplicateReport = readJsonFile(rootDir, duplicateEvidencePath);
  const nearClassificationEvidencePath = EVIDENCE_PATHS.liveDocumentEditorialNearClassification;
  const nearClassificationReport = readJsonFile(rootDir, nearClassificationEvidencePath);
  const rainContextEvidencePath = EVIDENCE_PATHS.liveDocumentRainContextIsolation;
  const rainContextReport = readJsonFile(rootDir, rainContextEvidencePath);
  if (!isRecord(report) || !isRecord(duplicateReport) || !isRecord(nearClassificationReport) || !isRecord(rainContextReport)) {
    return gateResult({
      id: "live_document_editorial_review",
      label: "Live 12-deliverable editorial contract review",
      state: "missing",
      evidencePath,
      detail: "Live 12-deliverable automated editorial contract, duplicate-classification evidence, near-classification evidence, or rain-context isolation evidence is missing or invalid.",
      nextActions: ["Run the fail-closed five-by-twelve editorial contracts without combining existing wording and presence gates."],
    });
  }

  const beforeLive = isRecord(report.beforeLive) ? report.beforeLive : {};
  const afterLive = isRecord(report.afterLive) ? report.afterLive : {};
  const evidenceBoundary = isRecord(report.evidenceBoundary) ? report.evidenceBoundary : {};
  const mutationBoundary = isRecord(report.mutationBoundary) ? report.mutationBoundary : {};
  const duplicateBeforeLive = isRecord(duplicateReport.beforeLive) ? duplicateReport.beforeLive : {};
  const duplicateAfterLive = isRecord(duplicateReport.afterLive) ? duplicateReport.afterLive : {};
  const duplicateMutationBoundary = isRecord(duplicateReport.mutationBoundary) ? duplicateReport.mutationBoundary : {};
  const duplicateRemainingBoundaries = isRecord(duplicateReport.remainingBoundaries) ? duplicateReport.remainingBoundaries : {};
  const nearBefore = isRecord(nearClassificationReport.before) ? nearClassificationReport.before : {};
  const nearAfterLive = isRecord(nearClassificationReport.afterLive) ? nearClassificationReport.afterLive : {};
  const nearBeforeCategories = isRecord(nearBefore.nearCategories) ? nearBefore.nearCategories : {};
  const nearAfterCategories = isRecord(nearAfterLive.nearCategories) ? nearAfterLive.nearCategories : {};
  const nearContract = isRecord(nearClassificationReport.classificationContract) ? nearClassificationReport.classificationContract : {};
  const nearMutationBoundary = isRecord(nearClassificationReport.mutationBoundary) ? nearClassificationReport.mutationBoundary : {};
  const nearRemainingBoundaries = isRecord(nearClassificationReport.remainingBoundaries) ? nearClassificationReport.remainingBoundaries : {};
  const rainBeforeLive = isRecord(rainContextReport.beforeLive) ? rainContextReport.beforeLive : {};
  const rainAfterLive = isRecord(rainContextReport.afterLive) ? rainContextReport.afterLive : {};
  const rainAfterLiveFull = isRecord(rainContextReport.afterLiveFull) ? rainContextReport.afterLiveFull : {};
  const rainMutationBoundary = isRecord(rainContextReport.mutationBoundary) ? rainContextReport.mutationBoundary : {};
  const rainRemainingBoundary = isRecord(rainContextReport.remainingBoundary) ? rainContextReport.remainingBoundary : {};
  const sourceMatchesProduction = readString(report.productCommit).length > 0
    && readString(report.productCommit) === readString(report.productionCommit);
  const noMutation = mutationBoundary.dbMutationPerformed === false
    && mutationBoundary.shareSessionCreated === false
    && mutationBoundary.providerDispatchCalled === false
    && mutationBoundary.exactSavedShareReproduced === false;
  const duplicateSourceMatchesProduction = readString(duplicateReport.productionCommit).length > 0
    && readString(duplicateReport.productionCommit) === readString(duplicateAfterLive.sourceHead);
  const duplicateNoMutation = duplicateMutationBoundary.dbMutationPerformed === false
    && duplicateMutationBoundary.shareSessionCreated === false
    && duplicateMutationBoundary.providerDispatchCalled === false
    && duplicateMutationBoundary.exactSavedShareReproduced === false;
  const duplicateReady = readString(duplicateReport.verdict) === "PASS_LIVE_PRODUCTION_EDITORIAL_DUPLICATE_CLASSIFICATION_REVIEWER_READY"
    && duplicateSourceMatchesProduction
    && readNumber(duplicateReport.canonicalDocumentCount) === 12
    && readNumber(duplicateReport.caseCount) === 5
    && readNumber(duplicateReport.reviewedDocumentSurfaceCount) === 60
    && duplicateReport.humanReviewCompleted === false
    && readNumber(duplicateBeforeLive.pass) === 1
    && readNumber(duplicateBeforeLive.fail) === 4
    && readNumber(duplicateBeforeLive.genericTemplateOveruseCount) === 4
    && readNumber(duplicateAfterLive.pass) === 5
    && readNumber(duplicateAfterLive.fail) === 0
    && readNumber(duplicateAfterLive.genericTemplateOveruseCount) === 0
    && readNumber(duplicateAfterLive.exactLineOveruseCount) > 0
    && readNumber(duplicateAfterLive.nearDuplicateLineOveruseCount) > 0
    && readString(duplicateRemainingBoundaries.exactSavedShareVerdict) === "MISSING_EVIDENCE"
    && duplicateRemainingBoundaries.broadHumanWordingReviewRequired === true
    && duplicateNoMutation;
  const nearNoMutation = nearMutationBoundary.dbMutationPerformed === false
    && nearMutationBoundary.shareSessionCreated === false
    && nearMutationBoundary.providerDispatchCalled === false
    && nearMutationBoundary.exactSavedShareReproduced === false;
  const nearClassificationReady = readString(nearClassificationReport.verdict)
      === "PASS_LIVE_PRODUCTION_EDITORIAL_NEAR_DUPLICATE_CLASSIFICATION_REVIEWER_READY"
    && readString(nearClassificationReport.sourceHead).length > 0
    && readString(nearClassificationReport.sourceHead) === readString(nearAfterLive.sourceHead)
    && readString(nearClassificationReport.productionCommit).length > 0
    && readString(nearClassificationReport.productionCommit) === readString(nearAfterLive.productionCommit)
    && readNumber(nearBefore.nearDuplicateLineOveruseCount) === 100
    && readNumber(nearBeforeCategories["human-review-required"]) === 54
    && readNumber(nearAfterLive.total) === 5
    && readNumber(nearAfterLive.pass) === 5
    && readNumber(nearAfterLive.fail) === 0
    && readNumber(nearAfterLive.genericTemplateOveruseCount) === 0
    && readNumber(nearAfterLive.nearDuplicateLineOveruseCount) === 100
    && readNumber(nearAfterCategories["human-review-required"]) === 0
    && readNumber(nearAfterCategories["document-role-prefix-variant"]) > 0
    && readNumber(nearAfterCategories["independent-document-context"]) > 0
    && readNumber(nearAfterCategories["cross-document-hazard-consistency"]) > 0
    && readNumber(nearAfterCategories["cross-document-control-consistency"]) > 0
    && nearAfterLive.humanReviewCompleted === false
    && nearContract.findingsHiddenOrRemoved === false
    && nearContract.genericTemplateOveruseFailsClosed === true
    && nearContract.safetyConsistencyAutomaticallyFails === false
    && nearRemainingBoundaries.humanReviewCompleted === false
    && nearRemainingBoundaries.broadHumanWordingReviewRequired === true
    && readString(nearRemainingBoundaries.exactSavedShareVerdict) === "MISSING_EVIDENCE"
    && nearNoMutation;
  const rainContextReady = readString(rainContextReport.schemaVersion)
      === "safeclaw-live-document-rain-context-isolation/v1"
    && readString(rainContextReport.verdict) === "PASS_LIVE_PRODUCTION_RAIN_CONTEXT_ISOLATION"
    && readNumber(rainContextReport.scenarioCount) === 1
    && readNumber(rainContextReport.canonicalDocumentCount) === 12
    && readNumber(rainBeforeLive.pass) === 0
    && readNumber(rainBeforeLive.fail) === 1
    && readNumber(rainBeforeLive.reviewedDocumentSurfaceCount) === 12
    && readNumber(rainBeforeLive.scenarioIrrelevantContextFindingCount) === 3
    && readNumber(rainBeforeLive.failedDocumentCount) === 3
    && readNumber(rainAfterLive.pass) === 1
    && readNumber(rainAfterLive.fail) === 0
    && readNumber(rainAfterLive.reviewedDocumentSurfaceCount) === 12
    && readNumber(rainAfterLive.scenarioIrrelevantContextFindingCount) === 0
    && readNumber(rainAfterLive.failedDocumentCount) === 0
    && readString(rainAfterLive.sourceHead).length > 0
    && readString(rainAfterLive.sourceHead) === readString(rainAfterLive.productionCommit)
    && readNumber(rainContextReport.fullMatrixScenarioCount) === 5
    && rainContextReport.fullMatrixContractAffectsRuntime === false
    && readString(rainContextReport.fullMatrixContractCommit).length > 0
    && readString(rainContextReport.fullMatrixContractCommit) === readString(rainAfterLiveFull.sourceHead)
    && readString(rainContextReport.fullMatrixProductionCommit).length > 0
    && readString(rainContextReport.fullMatrixProductionCommit) === readString(rainAfterLiveFull.productionCommit)
    && readString(rainAfterLiveFull.verdict)
      === "PASS_LIVE_PRODUCTION_12_DELIVERABLE_EDITORIAL_CONTRACT_REVIEWER_READY"
    && readNumber(rainAfterLiveFull.pass) === 5
    && readNumber(rainAfterLiveFull.fail) === 0
    && readNumber(rainAfterLiveFull.reviewedDocumentSurfaceCount) === 60
    && readNumber(rainAfterLiveFull.scenarioIrrelevantContextFindingCount) === 0
    && readNumber(rainAfterLiveFull.failedDocumentCount) === 0
    && readNumber(rainAfterLiveFull.matchedForbiddenDocumentFragmentCount) === 0
    && Array.isArray(rainAfterLiveFull.forbiddenRainContextFragments)
    && rainAfterLiveFull.forbiddenRainContextFragments.includes("우천 후 바닥 젖음")
    && rainAfterLiveFull.forbiddenRainContextFragments.includes("우천·젖은 바닥")
    && readNumber(rainAfterLiveFull.placeholderFindingCount) === 0
    && readNumber(rainAfterLiveFull.legalOverclaimFindingCount) === 0
    && readNumber(rainAfterLiveFull.awkwardCompositionFindingCount) === 0
    && readNumber(rainAfterLiveFull.evidenceDomainMismatchCount) === 0
    && readNumber(rainAfterLiveFull.genericTemplateOveruseCount) === 0
    && rainMutationBoundary.dbMutationPerformed === false
    && rainMutationBoundary.shareSessionCreated === false
    && rainMutationBoundary.providerDispatchCalled === false
    && rainMutationBoundary.embeddingGenerated === false
    && rainMutationBoundary.vectorUploadPerformed === false
    && rainRemainingBoundary.liveAfterDeploymentPending === false
    && rainRemainingBoundary.humanReviewCompleted === false
    && rainRemainingBoundary.broadHumanWordingReviewRequired === true
    && readString(rainRemainingBoundary.exactSavedShareVerdict) === "MISSING_EVIDENCE";
  const liveReady = readString(report.verdict) === "PASS_LIVE_PRODUCTION_12_DELIVERABLE_EDITORIAL_CONTRACT_REVIEWER_READY"
    && sourceMatchesProduction
    && readNumber(report.canonicalDocumentCount) === 12
    && readNumber(report.scenarioCount) === 5
    && readNumber(report.reviewedDocumentSurfaceCount) === 60
    && report.humanReviewCompleted === false
    && readNumber(beforeLive.pass) === 0
    && readNumber(beforeLive.fail) === 5
    && readNumber(beforeLive.awkwardCompositionFindingCount) > 0
    && readNumber(beforeLive.evidenceDomainMismatchCount) > 0
    && readNumber(afterLive.pass) === 5
    && readNumber(afterLive.fail) === 0
    && readNumber(afterLive.placeholderFindingCount) === 0
    && readNumber(afterLive.legalOverclaimFindingCount) === 0
    && readNumber(afterLive.awkwardCompositionFindingCount) === 0
    && readNumber(afterLive.evidenceDomainMismatchCount) === 0
    && evidenceBoundary.automatedEditorialContract === true
    && evidenceBoundary.reviewerReady === true
    && evidenceBoundary.humanReviewCompleted === false
    && evidenceBoundary.sixCoreWordingGateCombinedAsHumanPass === false
    && evidenceBoundary.twelveDeliverablePresenceGateCombinedAsHumanPass === false
    && evidenceBoundary.duplicateFindingsRemainForHumanReview === true
    && readString(evidenceBoundary.exactSavedShareVerdict) === "MISSING_EVIDENCE"
    && noMutation
    && duplicateReady
    && nearClassificationReady
    && rainContextReady;

  if (liveReady) {
    return gateResult({
      id: "live_document_editorial_review",
      label: "Live 12-deliverable editorial contract review",
      state: "proven",
      evidencePath,
      detail: `Five live production scenarios and all 60 canonical document surfaces pass the automated editorial contract: placeholder=0, legal overclaim=0, awkward composition ${readNumber(beforeLive.awkwardCompositionFindingCount)}->0, and evidence-domain mismatch ${readNumber(beforeLive.evidenceDomainMismatchCount)}->0. The companion duplicate classifier reduces generic-template overuse ${readNumber(duplicateBeforeLive.genericTemplateOveruseCount)}->0 while retaining exact=${readNumber(duplicateAfterLive.exactLineOveruseCount)} and near=${readNumber(duplicateAfterLive.nearDuplicateLineOveruseCount)} reviewer findings. Near-classification keeps all ${readNumber(nearAfterLive.nearDuplicateLineOveruseCount)} findings visible while reducing unclassified human-review-required ${readNumber(nearBeforeCategories["human-review-required"])}->${readNumber(nearAfterCategories["human-review-required"])} through role/context/hazard/control categories. Rain-context isolation ${rainContextEvidencePath} fails the focused production-before scenario at ${readNumber(rainBeforeLive.scenarioIrrelevantContextFindingCount)} irrelevant document findings, passes the focused live-after at ${readNumber(rainAfterLive.scenarioIrrelevantContextFindingCount)}, and passes the strengthened five-scenario/60-document contract with ${readNumber(rainAfterLiveFull.matchedForbiddenDocumentFragmentCount)} forbidden rain fragments, preventing 비산 from being treated as rain. humanReviewCompleted=false, the six-core wording and 12-presence gates are not combined as a human PASS, no DB/share/provider mutation occurred, and exact saved Share remains MISSING_EVIDENCE.`,
      nextActions: [
        "Perform a separate human editorial review for the recorded duplicate-line findings.",
        "Keep Documents/Share viewport IA and exact saved Share geometry as separate product/evidence boundaries.",
      ],
    });
  }

  return gateResult({
    id: "live_document_editorial_review",
    label: "Live 12-deliverable editorial contract review",
    state: "contradicted",
    evidencePath,
    detail: `Editorial verdict=${readString(report.verdict) || "unknown"}, live=${readNumber(afterLive.pass)}/5, reviewed=${readNumber(report.reviewedDocumentSurfaceCount)}, placeholder=${readNumber(afterLive.placeholderFindingCount)}, legal=${readNumber(afterLive.legalOverclaimFindingCount)}, awkward=${readNumber(afterLive.awkwardCompositionFindingCount)}, evidenceMismatch=${readNumber(afterLive.evidenceDomainMismatchCount)}, duplicateVerdict=${readString(duplicateReport.verdict) || "unknown"}, generic=${readNumber(duplicateAfterLive.genericTemplateOveruseCount)}, nearClassificationReady=${nearClassificationReady}, rainContextReady=${rainContextReady}, duplicateSourceMatchesProduction=${duplicateSourceMatchesProduction}, humanReviewCompleted=${report.humanReviewCompleted === true}, sourceMatchesProduction=${sourceMatchesProduction}, noMutation=${noMutation && duplicateNoMutation && nearNoMutation}.`,
    nextActions: ["Fix the editorial or evidence-domain findings and rerun the unchanged five-by-twelve live contract."],
  });
}

/**
 * @param {string} rootDir
 * @returns {GateResult}
 */
function evaluateProductCapabilityTruthGate(rootDir) {
  const evidencePath = EVIDENCE_PATHS.productCapabilityTruth;
  const report = readJsonFile(rootDir, evidencePath);
  const entryTruthPath = EVIDENCE_PATHS.dispatchEntryCapabilityTruth;
  const entryTruth = readJsonFile(rootDir, entryTruthPath);
  const landingTruthPath = EVIDENCE_PATHS.landingHumanReviewBoundary;
  const landingTruth = readJsonFile(rootDir, landingTruthPath);
  if (!isRecord(report)) {
    return gateResult({
      id: "product_capability_truth",
      label: "Live product capability truth",
      state: "missing",
      evidencePath,
      detail: "Live product capability truth evidence is missing or invalid.",
      nextActions: ["Rerun the read-only dispatch, briefing, photo readiness, AI mode, and UI truth checks against current production."],
    });
  }

  const liveChecks = isRecord(report.liveChecks) ? report.liveChecks : {};
  const providerDispatch = isRecord(liveChecks.providerDispatch) ? liveChecks.providerDispatch : {};
  const channels = isRecord(providerDispatch.channels) ? providerDispatch.channels : {};
  const briefing = isRecord(liveChecks.briefingSettingsUnauthenticated)
    ? liveChecks.briefingSettingsUnauthenticated
    : {};
  const photo = isRecord(liveChecks.photoVisionReadiness) ? liveChecks.photoVisionReadiness : {};
  const uiChecks = isRecord(report.uiChecks) ? report.uiChecks : {};
  const briefingRows = Array.isArray(uiChecks.briefingSettings) ? uiChecks.briefingSettings : [];
  const aiModes = isRecord(uiChecks.aiGenerationModes) ? uiChecks.aiGenerationModes : {};
  const sortedModes = Array.isArray(aiModes.modes)
    ? aiModes.modes.filter((mode) => typeof mode === "string").sort().join(",")
    : "";
  const mutationBoundary = isRecord(report.mutationBoundary) ? report.mutationBoundary : {};
  const currentViewportIaEvidence = isRecord(report.currentViewportIaEvidence)
    ? report.currentViewportIaEvidence
    : {};
  const remainingBoundaries = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  const entryProductionBuild = isRecord(entryTruth?.productionBuild) ? entryTruth.productionBuild : {};
  const entryCurrentSource = isRecord(entryTruth?.currentSource) ? entryTruth.currentSource : {};
  const entryLiveAfter = isRecord(entryTruth?.liveAfter) ? entryTruth.liveAfter : {};
  const entryMutationBoundary = isRecord(entryTruth?.mutationBoundary) ? entryTruth.mutationBoundary : {};
  const entryRemainingBoundaries = isRecord(entryTruth?.remainingBoundaries) ? entryTruth.remainingBoundaries : {};
  const landingProductionBuild = isRecord(landingTruth?.productionBuild) ? landingTruth.productionBuild : {};
  const landingCurrentSource = isRecord(landingTruth?.currentSource) ? landingTruth.currentSource : {};
  const landingLiveAfter = isRecord(landingTruth?.liveAfter) ? landingTruth.liveAfter : {};
  const landingMutationBoundary = isRecord(landingTruth?.mutationBoundary) ? landingTruth.mutationBoundary : {};
  const landingRemainingBoundaries = isRecord(landingTruth?.remainingBoundaries) ? landingTruth.remainingBoundaries : {};
  const entryTruthPass = isRecord(entryTruth)
    && readString(entryTruth.verdict) === "PASS_LIVE_PRODUCTION_DISPATCH_ENTRY_CAPABILITY_TRUTH"
    && readString(entryTruth.sourceHead).length > 0
    && readString(entryTruth.sourceHead) === readString(entryProductionBuild.commitSha)
    && entryProductionBuild.sourceHeadMatchesProduction === true
    && readNumber(entryCurrentSource.forbiddenSendingClaimsRemainingInReviewedSurfaces) === 0
    && entryLiveAfter.dispatchDescriptionVisible === true
    && entryLiveAfter.landingDispatchBoundaryVisible === true
    && entryLiveAfter.sourceHeadMatchesProduction === true
    && entryMutationBoundary.dbMutationPerformed === false
    && entryMutationBoundary.shareSessionCreated === false
    && entryMutationBoundary.providerDispatchCalled === false
    && entryMutationBoundary.embeddingGenerated === false
    && entryMutationBoundary.vectorUploadPerformed === false
    && entryMutationBoundary.exactTrustRegistryMutationPerformed === false
    && entryRemainingBoundaries.liveAfterDeploymentRequired === false
    && readString(entryRemainingBoundaries.providerDispatchPersistence) === "approval_gated"
    && readString(entryRemainingBoundaries.exactSavedShareVerdict) === "MISSING_EVIDENCE";
  const landingTruthPass = isRecord(landingTruth)
    && readString(landingTruth.verdict) === "PASS_LIVE_PRODUCTION_LANDING_HUMAN_REVIEW_BOUNDARY"
    && readString(landingTruth.sourceHead).length > 0
    && readString(landingTruth.sourceHead) === readString(landingProductionBuild.commitSha)
    && landingProductionBuild.sourceHeadMatchesProduction === true
    && landingCurrentSource.humanDecisionBoundaryVisible === true
    && readNumber(landingCurrentSource.forbiddenReplacementClaimsRemaining) === 0
    && landingLiveAfter.positioningVisible === true
    && landingLiveAfter.humanDecisionBoundaryVisible === true
    && landingLiveAfter.oldSafetyManagerClaimVisible === false
    && landingLiveAfter.oldReplacementClaimVisible === false
    && landingLiveAfter.horizontalOverflow === false
    && readNumber(landingLiveAfter.browserConsoleErrors) === 0
    && landingMutationBoundary.dbMutationPerformed === false
    && landingMutationBoundary.shareSessionCreated === false
    && landingMutationBoundary.providerDispatchCalled === false
    && landingMutationBoundary.embeddingGenerated === false
    && landingMutationBoundary.vectorUploadPerformed === false
    && landingMutationBoundary.exactTrustRegistryMutationPerformed === false
    && landingRemainingBoundaries.liveAfterDeploymentRequired === false
    && landingRemainingBoundaries.broadHumanLegalReviewCompleted === false
    && readString(landingRemainingBoundaries.providerDispatchPersistence) === "approval_gated"
    && readString(landingRemainingBoundaries.exactSavedShareVerdict) === "MISSING_EVIDENCE";
  const sourceMatchesProduction = readString(report.sourceHead).length > 0
    && readString(report.sourceHead) === readString(report.productionCommit);
  const uiTruthPass = briefingRows.length === 2
    && briefingRows.every((row) => (
      isRecord(row)
      && row.containsDocumentGeneration === true
      && row.containsEmailDispatchLock === true
      && row.horizontalOverflow === false
    ));
  const noMutation = mutationBoundary.dbMutationPerformed === false
    && mutationBoundary.shareSessionCreated === false
    && mutationBoundary.providerDispatchCalled === false
    && mutationBoundary.photoAnalysisPostCalled === false
    && mutationBoundary.exactSavedShareReproduced === false;
  const currentViewportIaGate = evaluateUiDocumentsShareCockpitGate(rootDir);
  const currentViewportIaPass = readString(currentViewportIaEvidence.verdict) === "PASS_SCOPED_LIVE_PRODUCTION_WITH_EXACT_SAVED_SESSION_GAP"
    && readString(currentViewportIaEvidence.gateId) === "ui_documents_share_cockpit"
    && readString(currentViewportIaEvidence.boundedWorkbenchEvidencePath) === "evaluation/workspace-bounded-workbench-current-2026-07-22/report.json"
    && readString(currentViewportIaEvidence.boundedWorkbenchVerdict) === "PASS_LIVE_PRODUCTION_SCOPED_WITH_EXACT_SESSION_GAP"
    && readString(currentViewportIaEvidence.boundedWorkbenchSourceHead) === "33a8167060d1f3433131ff687bd14eb4920e7520"
    && currentViewportIaEvidence.scopedLiveDocumentsAndWorkspaceShareProven === true
    && currentViewportIaEvidence.routeSplitAloneAcceptedAsFix === false
    && currentViewportIaEvidence.exactSavedUserSessionReproduced === false
    && readString(currentViewportIaEvidence.exactSavedShareVerdict) === "MISSING_EVIDENCE"
    && currentViewportIaGate.state === "proven";
  const liveReady = readString(report.verdict) === "PASS_LIVE_PRODUCTION_PRODUCT_CAPABILITY_TRUTH"
    && sourceMatchesProduction
    && readNumber(providerDispatch.status) === 200
    && providerDispatch.capability === false
    && readString(providerDispatch.mode) === "preview_only"
    && readString(providerDispatch.reason) === "persistent_idempotency_unavailable"
    && channels.email === false
    && channels.sms === false
    && channels.kakao === false
    && providerDispatch.providerCalled === false
    && readNumber(briefing.status) === 401
    && briefing.authenticationFailClosed === true
    && briefing.emailReady === false
    && readString(briefing.mode) === "preview_only"
    && readString(briefing.reason) === "persistent_idempotency_unavailable"
    && briefing.settingsMutationPerformed === false
    && readNumber(photo.status) === 200
    && photo.ready === true
    && photo.acceptedOnly === true
    && photo.ocrSupported === true
    && photo.photoPostAnalysisExecuted === false
    && uiTruthPass
    && aiModes.sourceAndApiContractVerified === true
    && sortedModes === "enhanced,full,template"
    && aiModes.liveInteractiveModeSwitchExecuted === false
    && noMutation
    && readString(remainingBoundaries.exactSavedShareVerdict) === "MISSING_EVIDENCE"
    && readString(remainingBoundaries.documentsShareIaVerdict) === "PASS_SCOPED_LIVE_PRODUCTION_WITH_EXACT_SAVED_SESSION_GAP"
    && currentViewportIaPass
    && remainingBoundaries.providerDispatchApprovalRequired === true
    && remainingBoundaries.humanEditorialReviewCompleted === false
    && entryTruthPass
    && landingTruthPass;

  if (liveReady) {
    return gateResult({
      id: "product_capability_truth",
      label: "Live product capability truth",
      state: "proven",
      evidencePath,
      detail: `Manual email/SMS/Kakao and scheduled briefing email are fail-closed preview-only because persistent idempotency is unavailable. Live dispatch entry copy distinguishes preview/readiness from approved results (${entryTruthPath}), and the public landing keeps safety judgment and final confirmation with a human instead of claiming role replacement (${landingTruthPath}). Live photo Vision/OCR readiness is accepted-only, AI generation modes are template/enhanced/full, and no DB/share/provider/photo POST mutation occurred. Scoped Documents and Workspace/fixture Share viewport IA is separately proven without accepting route split alone; provider approval and broad human/legal review remain open, and exact saved Share remains MISSING_EVIDENCE.`,
      nextActions: [
        "Keep provider dispatch persistence approval-gated.",
        "Measure exact saved Share geometry with a concrete existing session URL or separately approved creation flow.",
      ],
    });
  }

  return gateResult({
    id: "product_capability_truth",
    label: "Live product capability truth",
    state: "contradicted",
    evidencePath,
    detail: `Capability verdict=${readString(report.verdict) || "unknown"}, sourceMatchesProduction=${sourceMatchesProduction}, dispatch=${readString(providerDispatch.mode) || "unknown"}/${readString(providerDispatch.reason) || "unknown"}, providerCalled=${providerDispatch.providerCalled === true}, briefingEmailReady=${briefing.emailReady === true}, photoReady=${photo.ready === true}, photoAcceptedOnly=${photo.acceptedOnly === true}, photoPost=${photo.photoPostAnalysisExecuted === true}, uiTruthPass=${uiTruthPass}, entryTruthPass=${entryTruthPass}, landingTruthPass=${landingTruthPass}, viewportIaPass=${currentViewportIaPass}, aiModes=${sortedModes || "missing"}, noMutation=${noMutation}, exactShare=${readString(remainingBoundaries.exactSavedShareVerdict) || "missing"}, ia=${readString(remainingBoundaries.documentsShareIaVerdict) || "missing"}.`,
    nextActions: ["Restore the fail-closed capability boundaries and rerun current-production truth evidence without mutation."],
  });
}

const KNOWLEDGE_PREPARATION_CAPABILITY_TRUTH_PATHS = [
  "app/api/knowledge/review/prepare/route.ts",
  "app/knowledge/KnowledgeReviewInbox.tsx",
];

/**
 * @param {string} rootDir
 * @returns {GateResult}
 */
function evaluateKnowledgePreparationCapabilityTruthGate(rootDir) {
  const evidencePath = EVIDENCE_PATHS.knowledgePreparationCapabilityTruth;
  const report = readJsonFile(rootDir, evidencePath);
  if (!isRecord(report)) {
    return gateResult({
      id: "knowledge_preparation_capability_truth",
      label: "Knowledge preparation capability truth",
      state: "missing",
      evidencePath,
      detail: "Knowledge preparation capability truth evidence is missing or invalid.",
      nextActions: ["Restore the deployed-source capability receipt without executing an authenticated preparation run."],
    });
  }

  const before = isRecord(report.before) ? report.before : {};
  const current = isRecord(report.currentSourceContract) ? report.currentSourceContract : {};
  const verification = isRecord(report.verification) ? report.verification : {};
  const focused = isRecord(verification.focused) ? verification.focused : {};
  const adjacent = isRecord(verification.adjacentKnowledgeAndAdmission)
    ? verification.adjacentKnowledgeAndAdmission
    : {};
  const live = isRecord(report.liveVerification) ? report.liveVerification : {};
  const mutation = isRecord(report.mutationBoundary) ? report.mutationBoundary : {};
  const remaining = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  const sourceHead = readString(report.sourceHead);
  const productionCommit = readString(report.productionCommit);
  const noMutation = mutation.dbMutationPerformed === false
    && mutation.providerCallPerformed === false
    && mutation.providerDispatchCalled === false
    && mutation.shareSessionCreated === false
    && mutation.wikiPublicationPerformed === false
    && mutation.ontologyPublicationPerformed === false
    && mutation.embeddingGenerated === false
    && mutation.vectorUploadPerformed === false
    && mutation.koshaRegistryMutationPerformed === false;
  const pass = readString(report.verdict)
      === "PASS_LIVE_DEPLOYED_SOURCE_KNOWLEDGE_PREPARATION_CAPABILITY_TRUTH_AUTHENTICATED_PROBE_HELD"
    && sourceHead.length === 40
    && productionCommit.length === 40
    && isEvidenceCurrentForPaths(rootDir, sourceHead, KNOWLEDGE_PREPARATION_CAPABILITY_TRUTH_PATHS)
    && isGitAncestor(rootDir, productionCommit)
    && report.productionIncludesProductCommit === true
    && readString(before.distributedAdmissionFailurePublicCode) === "PUBLIC_ASK_CONCURRENCY_LIMIT"
    && readString(before.reviewInboxFailureMessage) === "검토 후보를 준비하지 못했습니다."
    && before.configurationLockDistinguishedFromLoad === false
    && readString(current.distributedAdmissionFailurePublicCode) === "DISTRIBUTED_RATE_LIMIT_UNAVAILABLE"
    && readString(current.temporaryConcurrencyPublicCode) === "PUBLIC_ASK_CONCURRENCY_LIMIT"
    && current.configurationLockDistinguishedFromLoad === true
    && current.rawAdmissionErrorPubliclyExposed === false
    && current.configurationLockMessageVisible === true
    && current.temporaryLoadMessageVisible === true
    && current.authenticationMessageVisible === true
    && current.storageOrGuardMessageVisible === true
    && current.existingCandidateReviewRemainsAvailable === true
    && readString(current.publicationState) === "unpublished"
    && current.publishAllowed === false
    && readNumber(focused.files) === 2
    && readNumber(focused.tests) === 29
    && readNumber(focused.failed) === 0
    && readNumber(adjacent.files) === 4
    && readNumber(adjacent.tests) === 88
    && readNumber(adjacent.failed) === 0
    && verification.strictTypecheck === "PASS"
    && verification.productionBuild === "PASS"
    && readNumber(verification.staticPages) === 28
    && readString(live.status) === "PASS_DEPLOYED_SOURCE_MARKER_ONLY_AUTHENTICATED_PROBE_HELD"
    && readString(live.buildInfoCommit) === productionCommit
    && readString(live.branch) === "master"
    && readString(live.environment) === "production"
    && live.behavioralProbeExecuted === false
    && noMutation
    && readString(remaining.enhancedLlmRuntime) === "BLOCKED_DISTRIBUTED_RATE_LIMIT_CONFIGURATION"
    && readString(remaining.authenticatedLivePreparationProbe) === "APPROVAL_GATED"
    && readString(remaining.llmWikiPublication) === "APPROVAL_GATED"
    && readString(remaining.supabaseRlsLaunchIsolation) === "APPROVAL_GATED"
    && readString(remaining.exactSavedShareVerdict) === "MISSING_EVIDENCE"
    && remaining.securityCompleteClaimAllowed === false;

  return gateResult({
    id: "knowledge_preparation_capability_truth",
    label: "Knowledge preparation capability truth",
    state: pass ? "notice" : "contradicted",
    evidencePath,
    detail: pass
      ? "Deployed source distinguishes a distributed-configuration lock from temporary load in the knowledge preparation route and review UI, with 117 focused and adjacent tests, strict typecheck, and a 28-page production build. This is marker-only capability truth: enhanced LLM preparation remains blocked, the authenticated preparation probe and Wiki/RLS publication remain approval-gated, no mutation occurred, security-complete is false, and exact saved Share remains MISSING_EVIDENCE."
      : `Knowledge preparation verdict=${readString(report.verdict) || "missing"}, source=${sourceHead || "missing"}, production=${productionCommit || "missing"}, codes=${readString(current.distributedAdmissionFailurePublicCode) || "missing"}/${readString(current.temporaryConcurrencyPublicCode) || "missing"}, tests=${readNumber(focused.tests)}+${readNumber(adjacent.tests)}, live=${readString(live.status) || "missing"}/${live.behavioralProbeExecuted === true}, runtime=${readString(remaining.enhancedLlmRuntime) || "missing"}, noMutation=${noMutation}, exactShare=${readString(remaining.exactSavedShareVerdict) || "missing"}.`,
    nextActions: pass
      ? ["Configure approved distributed admission, then run one bounded authenticated preparation probe before claiming enhanced LLM runtime readiness; keep Wiki publication and RLS as separate approvals."]
      : ["Restore source/live ancestry, the distinct configuration and load codes/messages, 117 passing tests, no-mutation boundaries, blocked runtime, approval gates, and exact Share MISSING_EVIDENCE."],
  });
}

/**
 * @param {string} rootDir
 * @returns {GateResult}
 */
function evaluateCiSupplyChainFullSuiteGate(rootDir) {
  const evidencePath = EVIDENCE_PATHS.ciFullSuiteRemediation;
  const baselinePath = EVIDENCE_PATHS.ciSupplyChainPinning;
  const report = readJsonFile(rootDir, evidencePath);
  const baseline = readJsonFile(rootDir, baselinePath);
  if (!isRecord(report) || !isRecord(baseline)) {
    return gateResult({
      id: "ci_supply_chain_full_suite",
      label: "Pinned CI supply chain and full suite",
      state: "missing",
      evidencePath,
      detail: "Pinned CI baseline or full-suite remediation evidence is missing or invalid.",
      nextActions: ["Re-run the pinned GitHub Actions workflow and record the clean full-suite result without changing approval boundaries."],
    });
  }

  const workflow = isRecord(baseline.workflow) ? baseline.workflow : {};
  const actions = Array.isArray(workflow.actions) ? workflow.actions.filter(isRecord) : [];
  const baselineVerification = isRecord(baseline.verification) ? baseline.verification : {};
  const baselineGithub = isRecord(baselineVerification.githubActions) ? baselineVerification.githubActions : {};
  const productionBuild = isRecord(report.productionBuild) ? report.productionBuild : {};
  const remediation = isRecord(report.remediation) ? report.remediation : {};
  const local = isRecord(report.localVerification) ? report.localVerification : {};
  const localSuite = isRecord(local.fullSuite) ? local.fullSuite : {};
  const github = isRecord(report.githubActions) ? report.githubActions : {};
  const githubSuite = isRecord(github.fullSuite) ? github.fullSuite : {};
  const runtimeUpgrade = isRecord(report.actionRuntimeUpgrade) ? report.actionRuntimeUpgrade : {};
  const upgradedCheckout = isRecord(runtimeUpgrade.checkout) ? runtimeUpgrade.checkout : {};
  const upgradedSetupNode = isRecord(runtimeUpgrade.setupNode) ? runtimeUpgrade.setupNode : {};
  const boundaries = isRecord(report.boundaries) ? report.boundaries : {};
  const checkout = actions.find((action) => readString(action.name) === "actions/checkout");
  const setupNode = actions.find((action) => readString(action.name) === "actions/setup-node");
  const checkoutSha = readString(checkout?.sha);
  const setupNodeSha = readString(setupNode?.sha);
  const sourceMatchesProduction = readString(report.sourceHead).length > 0
    && readString(report.sourceHead) === readString(productionBuild.commitSha)
    && readString(report.sourceHead) === readString(remediation.commit);
  const noMutation = boundaries.dbMutationPerformed === false
    && boundaries.providerDispatchCalled === false
    && boundaries.shareSessionCreated === false
    && boundaries.vectorMutationPerformed === false
    && boundaries.wikiPublicationPerformed === false
    && boundaries.koshaRegistryMutationPerformed === false
    && boundaries.approvalGatedBoundariesClosed === false;
  const pinnedBaselineReady = readString(baseline.verdict)
      === "PASS_GITHUB_CI_PINNED_ACTIONS_MINIMUM_TOKEN_PERMISSIONS_WITH_EXISTING_SUITE_RED"
    && readString(workflow.defaultPermissions?.contents) === "read"
    && checkoutSha === "11bd71901bbe5b1630ceea73d27597364c9af683"
    && setupNodeSha === "49933ea5288caeca8642d1e84afbd3f7d6820020"
    && checkout?.officialTagVerifiedByGitLsRemote === true
    && setupNode?.officialTagVerifiedByGitLsRemote === true
    && readString(baselineGithub.conclusion) === "failure"
    && readNumber(baselineGithub.tests?.passed) === 3098
    && readNumber(baselineGithub.tests?.failed) === 5
    && baseline.remainingBoundaries?.fullRepositoryCiGreenClaimed === false;
  const node24ActionsReady = readString(upgradedCheckout.tag) === "v7.0.1"
    && readString(upgradedCheckout.sha) === "3d3c42e5aac5ba805825da76410c181273ba90b1"
    && readString(upgradedCheckout.runtime) === "node24"
    && upgradedCheckout.officialReleaseVerified === true
    && readString(upgradedSetupNode.tag) === "v7.0.0"
    && readString(upgradedSetupNode.sha) === "820762786026740c76f36085b0efc47a31fe5020"
    && readString(upgradedSetupNode.runtime) === "node24"
    && upgradedSetupNode.officialReleaseVerified === true
    && runtimeUpgrade.packageManagerCache === false
    && readNumber(runtimeUpgrade.node20DeprecationWarningCount) === 0;
  const fullSuiteReady = readString(report.verdict) === "PASS_LIVE_PRODUCTION_GITHUB_CI_NODE24_ACTIONS_FULL_SUITE"
    && sourceMatchesProduction
    && readString(productionBuild.branch) === "master"
    && readString(productionBuild.environment) === "production"
    && readString(local.typecheck) === "PASS"
    && readString(local.build?.status) === "PASS"
    && readNumber(local.build?.staticPages) === 28
    && readNumber(localSuite.testFilesPassed) === 256
    && readNumber(localSuite.testFilesSkipped) === 11
    && readNumber(localSuite.testFilesTotal) === 267
    && readNumber(localSuite.testsPassed) === 3103
    && readNumber(localSuite.testsSkipped) === 26
    && readNumber(localSuite.testsTotal) === 3129
    && readString(github.conclusion) === "success"
    && readString(github.pinnedCheckout) === readString(upgradedCheckout.sha)
    && readString(github.pinnedSetupNode) === readString(upgradedSetupNode.sha)
    && readString(github.typecheck) === "success"
    && readString(githubSuite.status) === "success"
    && readNumber(githubSuite.testFilesPassed) === 257
    && readNumber(githubSuite.testFilesSkipped) === 11
    && readNumber(githubSuite.testsPassed) === 3114
    && readNumber(githubSuite.testsSkipped) === 26
    && readString(github.build) === "success"
    && node24ActionsReady
    && readString(boundaries.exactSavedShareVerdict) === "MISSING_EVIDENCE"
    && noMutation;

  if (pinnedBaselineReady && fullSuiteReady) {
    return gateResult({
      id: "ci_supply_chain_full_suite",
      label: "Pinned CI supply chain and full suite",
      state: "proven",
      evidencePath,
      detail: `GitHub CI preserves the immutable 3098-pass/5-fail baseline, upgrades checkout/setup-node to reviewed Node 24 runtime SHAs, disables package-manager caching, and passes 3114/3140 tests with 26 skipped plus typecheck/build on production-aligned ${readString(report.sourceHead).slice(0, 8)} with zero Node 20 deprecation warnings. This is CI and deployment evidence only: it does not close other security findings or approval-gated work, no mutation occurred, and exact saved Share remains MISSING_EVIDENCE.`,
      nextActions: ["Keep action SHAs and the full-suite contract fail-closed when updating CI dependencies."],
    });
  }

  return gateResult({
    id: "ci_supply_chain_full_suite",
    label: "Pinned CI supply chain and full suite",
    state: "contradicted",
    evidencePath,
    detail: `PinnedBaselineReady=${pinnedBaselineReady}, node24ActionsReady=${node24ActionsReady}, fullSuiteReady=${fullSuiteReady}, sourceMatchesProduction=${sourceMatchesProduction}, baselineCheckout=${checkoutSha || "missing"}, baselineSetupNode=${setupNodeSha || "missing"}, upgradedCheckout=${readString(upgradedCheckout.sha) || "missing"}, upgradedSetupNode=${readString(upgradedSetupNode.sha) || "missing"}, GitHub=${readString(github.conclusion) || "missing"}, tests=${readNumber(githubSuite.testsPassed)}/3140, noMutation=${noMutation}, exactShare=${readString(boundaries.exactSavedShareVerdict) || "missing"}.`,
    nextActions: ["Repair the pinned CI or full-suite evidence and rerun the unchanged fail-closed gate."],
  });
}

/**
 * @param {string} rootDir
 * @returns {GateResult}
 */
function evaluateHermesReviewDecisionFirstViewportGate(rootDir) {
  const evidencePath = EVIDENCE_PATHS.hermesReviewDecisionFirstViewport;
  const report = readJsonFile(rootDir, evidencePath);
  if (!isRecord(report)) {
    return gateResult({
      id: "hermes_review_decision_first_viewport",
      label: "Hermes review decision first viewport",
      state: "missing",
      evidencePath,
      detail: "Live Hermes first-viewport review decision evidence is missing.",
      nextActions: ["Run the no-mutation Day/Night desktop/mobile decision-rail probe against current production."],
    });
  }

  const beforeLive = isRecord(report.beforeLive) ? report.beforeLive : {};
  const afterLocal = isRecord(report.afterLocal) ? report.afterLocal : {};
  const afterLive = isRecord(report.afterLive) ? report.afterLive : {};
  const mutationBoundary = isRecord(report.mutationBoundary) ? report.mutationBoundary : {};
  const reviewBoundary = isRecord(report.reviewBoundary) ? report.reviewBoundary : {};
  const remainingBoundaries = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  const sourceHead = readString(report.sourceHead);
  const productCommit = readString(report.productCommit);
  const productionCommit = readString(report.productionCommit);
  const noMutation = mutationBoundary.dbMutationPerformed === false
    && mutationBoundary.providerDispatchCalled === false
    && mutationBoundary.shareSessionCreated === false
    && mutationBoundary.embeddingOrVectorMutationPerformed === false
    && mutationBoundary.ontologyPublicationPerformed === false
    && mutationBoundary.wikiPublicationPerformed === false
    && mutationBoundary.koshaRegistryMutationPerformed === false;
  const pass = report.verdict === "PASS_LIVE_PRODUCTION_HERMES_REVIEW_DECISION_FIRST_VIEWPORT"
    && sourceHead !== ""
    && sourceHead === productCommit
    && productCommit === productionCommit
    && isGitAncestor(rootDir, sourceHead)
    && beforeLive.verdict === "RED_HERMES_REVIEW_AUTHORITY_UI"
    && beforeLive.viewportCount === 8
    && beforeLive.passedCount === 0
    && beforeLive.failedCount === 8
    && readNumber(beforeLive.desktopShortFirstActionBottom) > 723
    && readNumber(beforeLive.mobileShortFirstActionBottom) > 723
    && afterLocal.verdict === "PASS_CURRENT_SOURCE_LOCAL_HERMES_REVIEW_AUTHORITY_UI"
    && afterLocal.viewportCount === 8
    && afterLocal.passedCount === 8
    && afterLocal.failedCount === 0
    && afterLocal.decisionConfirmationRequired === true
    && afterLocal.decisionConfirmationUnlocksAllActions === true
    && afterLocal.firstDecisionActionInViewport === true
    && afterLocal.horizontalOverflowCount === 0
    && afterLive.verdict === "PASS_LIVE_PRODUCTION_HERMES_REVIEW_AUTHORITY_UI"
    && afterLive.viewportCount === 8
    && afterLive.passedCount === 8
    && afterLive.failedCount === 0
    && readNumber(afterLive.desktopShortFirstActionBottom) <= 723
    && readNumber(afterLive.mobileShortFirstActionBottom) <= 723
    && afterLive.occludedFirstActionCount === 0
    && afterLive.decisionConfirmationRequired === true
    && afterLive.decisionConfirmationUnlocksAllActions === true
    && afterLive.firstDecisionActionInViewport === true
    && afterLive.horizontalOverflowCount === 0
    && noMutation
    && reviewBoundary.humanReviewCompleted === false
    && reviewBoundary.machineEvidenceReplacesHumanReview === false
    && reviewBoundary.candidateApproved === false
    && reviewBoundary.wikiPublished === false
    && remainingBoundaries.exactSavedShareVerdict === "MISSING_EVIDENCE"
    && remainingBoundaries.llmWikiPublication === "APPROVAL_GATED"
    && remainingBoundaries.supabaseRlsLaunchIsolation === "APPROVAL_GATED"
    && remainingBoundaries.providerDispatchPersistence === "APPROVAL_GATED";

  return gateResult({
    id: "hermes_review_decision_first_viewport",
    label: "Hermes review decision first viewport",
    state: pass ? "proven" : "contradicted",
    evidencePath,
    detail: pass
      ? `Live Hermes review decisions improved from 0/8 to 8/8 Day/Night desktop/mobile viewports. Desktop-short/mobile-short first-action bottoms are ${readNumber(afterLive.desktopShortFirstActionBottom)}/${readNumber(afterLive.mobileShortFirstActionBottom)}px inside 723px, with zero hit-test occlusions. All decisions remain locked until explicit candidate-and-evidence confirmation; human review remains incomplete, no mutation occurred, LLM Wiki/RLS/provider persistence remain APPROVAL_GATED, and exact saved Share remains MISSING_EVIDENCE.`
      : `Hermes first-viewport decision contract failed: before=${readNumber(beforeLive.passedCount)}/${readNumber(beforeLive.viewportCount)}, local=${readNumber(afterLocal.passedCount)}/${readNumber(afterLocal.viewportCount)}, live=${readNumber(afterLive.passedCount)}/${readNumber(afterLive.viewportCount)}, desktopBottom=${readNumber(afterLive.desktopShortFirstActionBottom)}, mobileBottom=${readNumber(afterLive.mobileShortFirstActionBottom)}, occluded=${readNumber(afterLive.occludedFirstActionCount)}, confirmation=${String(afterLive.decisionConfirmationRequired)}/${String(afterLive.decisionConfirmationUnlocksAllActions)}, noMutation=${String(noMutation)}, humanReview=${String(reviewBoundary.humanReviewCompleted)}, exactShare=${readString(remainingBoundaries.exactSavedShareVerdict) || "missing"}.`,
    nextActions: pass ? [] : ["Restore first-viewport hit-test visibility, confirmation locking, no-mutation, and approval boundaries across all eight live viewports."],
  });
}

/**
 * @param {string} rootDir
 * @returns {GateResult}
 */
function evaluateHermesReviewCandidatePositionGate(rootDir) {
  const evidencePath = EVIDENCE_PATHS.hermesReviewCandidatePosition;
  const report = readJsonFile(rootDir, evidencePath);
  if (!isRecord(report)) {
    return gateResult({
      id: "hermes_review_candidate_position",
      label: "Hermes review candidate position",
      state: "missing",
      evidencePath,
      detail: "Live Hermes candidate-position evidence is missing.",
      nextActions: ["Run the no-mutation Day/Night desktop/mobile candidate-position probe against current production."],
    });
  }

  const baseline = isRecord(report.baseline) ? report.baseline : {};
  const afterLocal = isRecord(report.afterLocal) ? report.afterLocal : {};
  const afterLive = isRecord(report.afterLive) ? report.afterLive : {};
  const mutationBoundary = isRecord(report.mutationBoundary) ? report.mutationBoundary : {};
  const reviewBoundary = isRecord(report.reviewBoundary) ? report.reviewBoundary : {};
  const remainingBoundaries = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  const sourceHead = readString(report.sourceHead);
  const productCommit = readString(report.productCommit);
  const productionCommit = readString(report.productionCommit);
  const expectedPositions = ["1/3", "2/3", "3/3"];
  const localPositions = Array.isArray(afterLocal.candidatePositions) ? afterLocal.candidatePositions : [];
  const livePositions = Array.isArray(afterLive.candidatePositions) ? afterLive.candidatePositions : [];
  const positionsComplete = JSON.stringify(localPositions) === JSON.stringify(expectedPositions)
    && JSON.stringify(livePositions) === JSON.stringify(expectedPositions);
  const noMutation = mutationBoundary.dbMutationPerformed === false
    && mutationBoundary.providerDispatchCalled === false
    && mutationBoundary.shareSessionCreated === false
    && mutationBoundary.embeddingOrVectorMutationPerformed === false
    && mutationBoundary.ontologyPublicationPerformed === false
    && mutationBoundary.wikiPublicationPerformed === false
    && mutationBoundary.koshaRegistryMutationPerformed === false;
  const pass = report.verdict === "PASS_LIVE_PRODUCTION_HERMES_REVIEW_CANDIDATE_POSITION"
    && sourceHead !== ""
    && sourceHead === productCommit
    && productCommit === productionCommit
    && isGitAncestor(rootDir, sourceHead)
    && baseline.numericCandidatePositionVisible === false
    && readString(baseline.measurementMethod).includes("no retroactive RED runner claim")
    && afterLocal.verdict === "PASS_CURRENT_SOURCE_LOCAL_HERMES_REVIEW_AUTHORITY_UI"
    && afterLocal.viewportCount === 8
    && afterLocal.passedCount === 8
    && afterLocal.failedCount === 0
    && afterLocal.candidatePositionLabels === true
    && afterLive.verdict === "PASS_LIVE_PRODUCTION_HERMES_REVIEW_AUTHORITY_UI"
    && afterLive.viewportCount === 8
    && afterLive.passedCount === 8
    && afterLive.failedCount === 0
    && afterLive.candidatePositionLabels === true
    && afterLive.productionAligned === true
    && positionsComplete
    && noMutation
    && reviewBoundary.humanReviewCompleted === false
    && reviewBoundary.machineEvidenceReplacesHumanReview === false
    && reviewBoundary.candidateApproved === false
    && reviewBoundary.wikiPublished === false
    && remainingBoundaries.exactSavedShareVerdict === "MISSING_EVIDENCE"
    && remainingBoundaries.llmWikiPublication === "APPROVAL_GATED"
    && remainingBoundaries.supabaseRlsLaunchIsolation === "APPROVAL_GATED"
    && remainingBoundaries.providerDispatchPersistence === "APPROVAL_GATED";

  return gateResult({
    id: "hermes_review_candidate_position",
    label: "Hermes review candidate position",
    state: pass ? "proven" : "contradicted",
    evidencePath,
    detail: pass
      ? "Live Hermes candidate tabs expose the complete 1/3, 2/3, 3/3 position sequence in all 8/8 Day/Night desktop/mobile viewports. The prior source/screenshot is retained only as a visual baseline with no retroactive RED runner claim. Human review remains incomplete, no mutation occurred, LLM Wiki/RLS/provider persistence remain APPROVAL_GATED, and exact saved Share remains MISSING_EVIDENCE."
      : `Hermes candidate-position contract failed: local=${readNumber(afterLocal.passedCount)}/${readNumber(afterLocal.viewportCount)}, live=${readNumber(afterLive.passedCount)}/${readNumber(afterLive.viewportCount)}, labels=${String(afterLocal.candidatePositionLabels)}/${String(afterLive.candidatePositionLabels)}, positions=${localPositions.join(",")}/${livePositions.join(",")}, baseline=${String(baseline.numericCandidatePositionVisible)}/${readString(baseline.measurementMethod) || "missing"}, noMutation=${String(noMutation)}, humanReview=${String(reviewBoundary.humanReviewCompleted)}, exactShare=${readString(remainingBoundaries.exactSavedShareVerdict) || "missing"}.`,
    nextActions: pass ? [] : ["Restore complete candidate positions, the no-retroactive-RED baseline, no-mutation boundaries, and exact Share MISSING_EVIDENCE."],
  });
}

/**
 * @param {string} rootDir
 * @returns {GateResult}
 */
function evaluateLaunchOperationsReadinessGate(rootDir) {
  const evidencePath = EVIDENCE_PATHS.launchOperationsReadiness;
  const report = readJsonFile(rootDir, evidencePath);
  if (!isRecord(report)) {
    return gateResult({
      id: "launch_operations_readiness_cockpit",
      label: "Live launch operations readiness cockpit",
      state: "missing",
      evidencePath,
      detail: "Launch operations readiness evidence is missing or invalid.",
      nextActions: ["Rerun the read-only /ops/api Day/Night desktop/mobile production geometry contract."],
    });
  }

  const productionBuild = isRecord(report.productionBuild) ? report.productionBuild : {};
  const rows = Array.isArray(report.rows) ? report.rows.filter(isRecord) : [];
  const boundaries = isRecord(report.boundaries) ? report.boundaries : {};
  const expectedCases = new Set(["desktop-day", "desktop-night", "mobile-day", "mobile-night"]);
  const sourceMatchesProduction = readString(report.sourceHead).length > 0
    && readString(report.sourceHead) === readString(productionBuild.commitSha)
    && readString(productionBuild.environment) === "production";
  const geometryPass = rows.length === 4
    && rows.every((row) => {
      const name = readString(row.name);
      const root = isRecord(row.root) ? row.root : {};
      const browserErrors = Array.isArray(row.browserConsoleErrors) ? row.browserConsoleErrors : [];
      const desktop = name.startsWith("desktop-");
      const mobile = name.startsWith("mobile-");
      return expectedCases.delete(name)
        && readNumber(row.cardCount) === 4
        && row.firstViewport === true
        && row.horizontalOverflow === false
        && browserErrors.length === 0
        && readString(row.publicAdmission) === "unavailable"
        && readString(row.publicAdmissionConfiguration) === "absent"
        && row.configurationLabelPresent === true
        && readString(row.providerDispatch) === "preview_only"
        && readString(row.photoVision) === "ready"
        && readNumber(root.bottom) <= 723
        && ((desktop && row.localHorizontalScroll === false)
          || (mobile && row.localHorizontalScroll === true));
    })
    && expectedCases.size === 0;
  const noMutation = boundaries.dbMutationPerformed === false
    && boundaries.providerDispatchCalled === false
    && boundaries.shareSessionCreated === false
    && boundaries.wikiPublished === false
    && boundaries.embeddingOrVectorMutationPerformed === false
    && boundaries.koshaRegistryMutated === false;
  const pass = readString(report.verdict) === "PASS_LIVE_PRODUCTION_LAUNCH_OPERATIONS_CONFIGURATION_TRUTH"
    && sourceMatchesProduction
    && readString(report.productCommit).length > 0
    && geometryPass
    && boundaries.distributedAdmissionConfigured === false
    && boundaries.providerDispatchReady === false
    && boundaries.fullyAutomatedLaunchClaimAllowed === false
    && readString(boundaries.exactSavedShareVerdict) === "MISSING_EVIDENCE"
    && noMutation;

  return gateResult({
    id: "launch_operations_readiness_cockpit",
    label: "Live launch operations readiness cockpit",
    state: pass ? "proven" : "contradicted",
    evidencePath,
    detail: pass
      ? "Live /ops/api passes 4/4 Day/Night desktop-short and mobile-short cases with four capability states inside the first viewport, desktop four-column presentation, mobile local-scroll containment, zero horizontal page overflow, and zero browser console errors. Production truth explicitly reports distributed configuration absent, provider dispatch preview-only, and Vision ready. This is operator readiness, not automatic launch approval or an unrelated whole-page height claim; no mutation occurred and exact saved Share remains MISSING_EVIDENCE."
      : `Launch readiness verdict=${readString(report.verdict) || "missing"}, sourceMatchesProduction=${sourceMatchesProduction}, geometryPass=${geometryPass}, configurationStates=${rows.map((row) => readString(row.publicAdmissionConfiguration) || "missing").join(",")}, noMutation=${noMutation}, distributedConfigured=${boundaries.distributedAdmissionConfigured}, providerReady=${boundaries.providerDispatchReady}, fullyAutomated=${boundaries.fullyAutomatedLaunchClaimAllowed}, exactShare=${readString(boundaries.exactSavedShareVerdict) || "missing"}.`,
    nextActions: pass
      ? ["Configure distributed admission and obtain provider persistence approval separately; do not infer automatic launch approval from this cockpit."]
      : ["Restore the four-case viewport contract and preserved approval boundaries, then rerun live evidence without mutation."],
  });
}

/**
 * @param {string} rootDir
 * @returns {GateResult}
 */
function evaluateDistributedAdmissionActivationApprovalGate(rootDir) {
  const evidencePath = EVIDENCE_PATHS.distributedAdmissionActivationApproval;
  const report = readJsonFile(rootDir, evidencePath);
  if (!isRecord(report)) {
    return gateResult({
      id: "distributed_admission_activation",
      label: "Distributed admission activation approval",
      state: "missing",
      evidencePath,
      detail: "Distributed admission activation approval packet is missing or invalid.",
      nextActions: ["Generate the no-mutation activation preflight before requesting production secret configuration."],
    });
  }

  const requestedChange = isRecord(report.requestedChange) ? report.requestedChange : {};
  const sharedBoundary = isRecord(report.sharedCredentialBoundary) ? report.sharedCredentialBoundary : {};
  const mutationBoundary = isRecord(report.mutationBoundary) ? report.mutationBoundary : {};
  const variables = readStringArray(requestedChange.requiredVariables);
  const checks = Array.isArray(report.checks) ? report.checks.filter(isRecord) : [];
  const exactVariables = variables.length === 2
    && variables.includes("UPSTASH_REDIS_REST_URL")
    && variables.includes("UPSTASH_REDIS_REST_TOKEN");
  const noMutation = report.ephemeralRedisMutationPerformed === false
    && mutationBoundary.dbSchemaMutationPerformed === false
    && mutationBoundary.dbDataMutationPerformed === false
    && mutationBoundary.providerCallPerformed === false
    && mutationBoundary.providerDispatchCalled === false
    && mutationBoundary.shareSessionCreated === false
    && mutationBoundary.vectorOrEmbeddingMutationPerformed === false
    && mutationBoundary.wikiPublicationPerformed === false
    && mutationBoundary.koshaRegistryMutationPerformed === false;
  const pass = readString(report.verdict) === "APPROVAL_REQUIRED_DISTRIBUTED_ADMISSION_ACTIVATION_NO_MUTATION"
    && readString(report.overall) === "approval_ready_open"
    && report.operatorApprovalRequired === true
    && report.configurationChangeApproved === false
    && report.activationPerformed === false
    && report.runtimeBehavioralProbePerformed === false
    && report.secretValuesInspected === false
    && report.secretValuesRecorded === false
    && exactVariables
    && readString(requestedChange.environment) === "Production"
    && requestedChange.remoteHermesLedgerModeChangeRequested === false
    && sharedBoundary.remoteHermesLedgerEnabledByThisChange === false
    && checks.length >= 7
    && checks.every((item) => item.passed === true)
    && readStringArray(report.failedCheckIds).length === 0
    && noMutation
    && readString(mutationBoundary.exactSavedShareVerdict) === "MISSING_EVIDENCE";

  return gateResult({
    id: "distributed_admission_activation",
    label: "Distributed admission activation approval",
    state: pass ? "approval_gated" : "contradicted",
    evidencePath,
    detail: pass
      ? "Production distributed admission is approval-ready but not activated: the packet requests exactly the Upstash REST URL/token, records no secret values, performs no Redis/DB/provider/Share/vector/Wiki/KOSHA mutation, keeps remote Hermes mode separate, requires a bounded post-deploy connectivity probe, and preserves exact saved Share as MISSING_EVIDENCE."
      : `Distributed activation verdict=${readString(report.verdict) || "missing"}, overall=${readString(report.overall) || "missing"}, approval=${report.operatorApprovalRequired === true}, activated=${report.activationPerformed === true}, variables=${variables.join(",") || "missing"}, checks=${checks.length}, noMutation=${noMutation}, exactShare=${readString(mutationBoundary.exactSavedShareVerdict) || "missing"}.`,
    nextActions: pass
      ? ["Obtain operator approval, configure both Production-scoped variables together, run the bounded readiness/connectivity probes, and rerun the fresh Standard scan before any security-complete claim."]
      : ["Regenerate the activation packet and restore the no-secret, no-mutation, separate-Hermes, and exact Share boundaries."],
  });
}

/**
 * @param {string} rootDir
 * @returns {GateResult}
 */
function evaluateDocumentExportCapabilityTruthGate(rootDir) {
  const evidencePath = EVIDENCE_PATHS.documentExportCapabilityTruth;
  const report = readJsonFile(rootDir, evidencePath);
  if (!isRecord(report)) {
    return gateResult({
      id: "document_export_capability_truth",
      label: "Live document export capability truth",
      state: "missing",
      evidencePath,
      detail: "Live document export capability truth evidence is missing or invalid.",
      nextActions: ["Rerun the read-only export admission and desktop/mobile Documents geometry checks against current production."],
    });
  }

  const capability = isRecord(report.capability) ? report.capability : {};
  const admission = isRecord(capability.admission) ? capability.admission : {};
  const liveGuardedExportRoutes = Array.isArray(capability.liveGuardedExportRoutes)
    ? capability.liveGuardedExportRoutes.filter(isRecord)
    : [];
  const browser = isRecord(report.browser) ? report.browser : {};
  const desktop = isRecord(browser.desktop) ? browser.desktop : {};
  const mobile = isRecord(browser.mobile) ? browser.mobile : {};
  const mutationBoundary = isRecord(report.mutationBoundary) ? report.mutationBoundary : {};
  const remainingBoundaries = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  const sourceMatchesProduction = readString(report.sourceHead).length > 0
    && readString(report.sourceHead) === readString(report.productionCommit)
    && report.sourceHeadMatchesProduction === true
    && report.productCommitIncludedInProduction === true;
  const viewportPass = [desktop, mobile].every((row) => (
    readNumber(row.bodyHeight) === 723
    && readNumber(row.viewportHeight) === 723
    && row.horizontalOverflow === false
    && readString(row.readiness) === "locked"
    && readString(row.readinessText) === "정식 출력 잠김 · PDF·호환 형식 사용"
    && row.xlsxDisabled === true
    && row.hwpDisabled === true
    && row.pdfDisabled === false
    && row.legacyXlsDisabled === false
    && row.legacyHwpxDisabled === false
  ));
  const geometryPass = readNumber(desktop.panelWidth) >= readNumber(desktop.toolsWidth) - 16
    && readNumber(desktop.xlsxButtonWidth) > 180
    && readNumber(desktop.legacyXlsButtonWidth) > 140
    && readNumber(mobile.panelWidth) >= readNumber(mobile.toolsWidth) - 24
    && readNumber(mobile.pdfButtonWidth) > 220
    && readNumber(mobile.legacyXlsButtonWidth) >= 220;
  const noMutation = mutationBoundary.dbMutationPerformed === false
    && mutationBoundary.providerDispatchCalled === false
    && mutationBoundary.shareSessionCreated === false
    && mutationBoundary.vectorMutationPerformed === false
    && mutationBoundary.wikiPublicationPerformed === false
    && mutationBoundary.koshaRegistryMutationPerformed === false;
  const guardedExportRoutePass = readNumber(capability.localGuardedPostStatus) === 503
    && readString(capability.localGuardedPostCode) === "DISTRIBUTED_RATE_LIMIT_UNAVAILABLE"
    && readString(capability.localGuardedPostRateLimit) === "distributed"
    && readString(capability.localGuardedPostWorkUnit) === "document-export"
    && capability.misleadingConcurrencyStatusObserved === false
    && liveGuardedExportRoutes.length === 4
    && new Set(liveGuardedExportRoutes.map((row) => readString(row.route))).size === 4
    && liveGuardedExportRoutes.every((row) => (
      readNumber(row.status) === 503
      && readString(row.code) === "DISTRIBUTED_RATE_LIMIT_UNAVAILABLE"
      && readString(row.rateLimit) === "distributed"
      && readString(row.workUnit) === "document-export"
      && readNumber(row.retryAfterSeconds) === 5
    ));
  const liveReady = readString(report.verdict) === "PASS_LIVE_PRODUCTION_DOCUMENT_EXPORT_CAPABILITY_TRUTH"
    && sourceMatchesProduction
    && readNumber(capability.getStatus) === 200
    && readString(admission.configurationState) === "absent"
    && readString(admission.mode) === "unavailable"
    && admission.ready === false
    && readString(admission.reason) === "distributed_limiter_unavailable"
    && capability.credentialMaterialExposed === false
    && capability.serverExportWorkExecuted === false
    && guardedExportRoutePass
    && viewportPass
    && geometryPass
    && noMutation
    && readString(remainingBoundaries.distributedAdmissionActivation) === "OPERATOR_CONFIGURATION_REQUIRED"
    && remainingBoundaries.liveAfterDeploymentRequired === false
    && readString(remainingBoundaries.exactSavedShareVerdict) === "MISSING_EVIDENCE"
    && remainingBoundaries.fullyAutomatedLaunchClaimAllowed === false;

  if (liveReady) {
    return gateResult({
      id: "document_export_capability_truth",
      label: "Live document export capability truth",
      state: "proven",
      evidencePath,
      detail: `Production export admission is honestly locked (configuration=${readString(admission.configurationState)}, ${readString(admission.reason)}): four server export routes fail closed as DISTRIBUTED_RATE_LIMIT_UNAVAILABLE with distributed/document-export headers, and the misleading concurrency status is absent. Server XLSX/HWP remain disabled while browser PDF, legacy XLS, and HWPX draft remain enabled. Desktop panel=${readNumber(desktop.panelWidth)}px with beta=${readNumber(desktop.legacyXlsButtonWidth)}px; mobile panel=${readNumber(mobile.panelWidth)}px with beta=${readNumber(mobile.legacyXlsButtonWidth)}px. Distributed activation remains OPERATOR_CONFIGURATION_REQUIRED, fully automated launch remains forbidden, no mutation occurred, and exact saved Share remains MISSING_EVIDENCE.`,
      nextActions: ["Configure distributed admission separately before enabling server XLSX/HWP export."],
    });
  }

  return gateResult({
    id: "document_export_capability_truth",
    label: "Live document export capability truth",
    state: "contradicted",
    evidencePath,
    detail: `Export verdict=${readString(report.verdict) || "unknown"}, sourceMatchesProduction=${sourceMatchesProduction}, admission=${readString(admission.mode) || "unknown"}/${readString(admission.reason) || "unknown"}, ready=${admission.ready === true}, guardedRoutesPass=${guardedExportRoutePass}, viewportPass=${viewportPass}, geometryPass=${geometryPass}, noMutation=${noMutation}, activation=${readString(remainingBoundaries.distributedAdmissionActivation) || "missing"}, exactShare=${readString(remainingBoundaries.exactSavedShareVerdict) || "missing"}.`,
    nextActions: ["Restore the fail-closed export capability boundary and rerun current-production evidence without mutation."],
  });
}

/**
 * @param {string} rootDir
 * @returns {GateResult}
 */
function evaluateOntologyViewportWorkbenchGate(rootDir) {
  const evidencePath = EVIDENCE_PATHS.ontologyViewportWorkbench;
  const report = readJsonFile(rootDir, evidencePath);
  if (!isRecord(report)) {
    return gateResult({
      id: "ontology_viewport_workbench",
      label: "Live ontology viewport workbench",
      state: "missing",
      evidencePath,
      detail: "Live ontology viewport workbench evidence is missing or invalid.",
      nextActions: ["Rerun the Day/Night desktop, tablet, and mobile ontology browser contract against current production."],
    });
  }

  const browser = isRecord(report.browser) ? report.browser : {};
  const desktop = isRecord(browser.desktop) ? browser.desktop : {};
  const tablet = isRecord(browser.tablet) ? browser.tablet : {};
  const mobile = isRecord(browser.mobile) ? browser.mobile : {};
  const mutationBoundary = isRecord(report.mutationBoundary) ? report.mutationBoundary : {};
  const remainingBoundaries = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  const sourceMatchesProduction = readString(report.sourceHead).length > 0
    && readString(report.sourceHead) === readString(report.productionCommit)
    && report.sourceHeadMatchesProduction === true
    && report.productCommitIncludedInProduction === true;
  const noMutation = mutationBoundary.dbMutationPerformed === false
    && mutationBoundary.providerDispatchCalled === false
    && mutationBoundary.shareSessionCreated === false
    && mutationBoundary.vectorMutationPerformed === false
    && mutationBoundary.wikiPublicationPerformed === false
    && mutationBoundary.koshaRegistryMutationPerformed === false;
  const liveReady = readString(report.verdict) === "PASS_LIVE_PRODUCTION_ONTOLOGY_VIEWPORT_WORKBENCH"
    && sourceMatchesProduction
    && readNumber(browser.rowCount) === 10
    && readNumber(browser.passCount) === 10
    && readNumber(browser.maxBodyRatio) === 1
    && readNumber(browser.horizontalOverflowRows) === 0
    && readNumber(browser.overlapRows) === 0
    && readNumber(browser.minimumControlHeight) >= 44
    && readNumber(browser.screenshotCount) === 14
    && readNumber(desktop.caseCount) === 4
    && readNumber(desktop.explorerPaneWidth) >= 840
    && readNumber(desktop.directoryPaneWidth) >= 330
    && desktop.localScrollContained === true
    && readNumber(tablet.caseCount) === 2
    && tablet.singleTaskPane === true
    && tablet.localScrollContained === true
    && readNumber(mobile.caseCount) === 4
    && readNumber(mobile.taskSwitchVerifiedCount) === 4
    && readNumber(mobile.minimumPaneClientHeight) >= 322
    && mobile.localScrollContained === true
    && mobile.selectionReturnsToExplorerTop === true
    && report.routeSplitAloneAcceptedAsFix === false
    && noMutation
    && readString(remainingBoundaries.exactSavedShareVerdict) === "MISSING_EVIDENCE"
    && remainingBoundaries.fullyAutomatedLaunchClaimAllowed === false;

  if (liveReady) {
    return gateResult({
      id: "ontology_viewport_workbench",
      label: "Live ontology viewport workbench",
      state: "proven",
      evidencePath,
      detail: `Production /ontology passes ${readNumber(browser.passCount)}/${readNumber(browser.rowCount)} Day/Night browser rows with body ratio ${readNumber(browser.maxBodyRatio)}, zero horizontal overflow and overlap, and ${readNumber(browser.minimumControlHeight)}px minimum controls. Desktop keeps ${readNumber(desktop.explorerPaneWidth)}px explorer plus ${readNumber(desktop.directoryPaneWidth)}px directory panes; tablet and mobile expose one bounded task pane at a time, and mobile task switching passes ${readNumber(mobile.taskSwitchVerifiedCount)}/4 with selection returning to the explorer top. Route split alone is not accepted, no mutation occurred, and exact saved Share remains MISSING_EVIDENCE.`,
      nextActions: [],
    });
  }

  return gateResult({
    id: "ontology_viewport_workbench",
    label: "Live ontology viewport workbench",
    state: "contradicted",
    evidencePath,
    detail: `Ontology verdict=${readString(report.verdict) || "unknown"}, sourceMatchesProduction=${sourceMatchesProduction}, rows=${readNumber(browser.passCount)}/${readNumber(browser.rowCount)}, maxBodyRatio=${readNumber(browser.maxBodyRatio)}, overflowRows=${readNumber(browser.horizontalOverflowRows)}, overlapRows=${readNumber(browser.overlapRows)}, mobileSwitch=${readNumber(mobile.taskSwitchVerifiedCount)}/4, noMutation=${noMutation}, exactShare=${readString(remainingBoundaries.exactSavedShareVerdict) || "missing"}.`,
    nextActions: ["Restore viewport containment, task switching, no-mutation boundaries, and current live alignment, then rerun the ontology browser contract."],
  });
}

/**
 * @param {string} rootDir
 * @returns {GateResult}
 */
function evaluateKnowledgeViewportWorkbenchGate(rootDir) {
  const evidencePath = EVIDENCE_PATHS.knowledgeViewportWorkbench;
  const taskRailEvidencePath = EVIDENCE_PATHS.knowledgeMobileTaskRail;
  const report = readJsonFile(rootDir, evidencePath);
  if (!isRecord(report)) {
    return gateResult({
      id: "knowledge_viewport_workbench",
      label: "Live Knowledge viewport workbench",
      state: "missing",
      evidencePath,
      detail: "Live Knowledge viewport workbench evidence is missing or invalid.",
      nextActions: ["Rerun the selected-only Day/Night desktop, tablet, and mobile Knowledge browser contract against current production."],
    });
  }

  const taskRailReport = readJsonFile(rootDir, taskRailEvidencePath);
  if (!isRecord(taskRailReport)) {
    return gateResult({
      id: "knowledge_viewport_workbench",
      label: "Live Knowledge viewport workbench",
      state: "missing",
      evidencePath: taskRailEvidencePath,
      detail: "Live Knowledge mobile task-rail companion evidence is missing or invalid.",
      nextActions: ["Rerun the 390x723 Day/Night Wiki and governance hash-entry task-rail contract against current production."],
    });
  }

  const browser = isRecord(report.browser) ? report.browser : {};
  const desktop = isRecord(browser.desktop) ? browser.desktop : {};
  const tablet = isRecord(browser.tablet) ? browser.tablet : {};
  const mobile = isRecord(browser.mobile) ? browser.mobile : {};
  const referenceDisclosure = isRecord(browser.referenceDisclosure) ? browser.referenceDisclosure : {};
  const progressiveDisclosure = isRecord(browser.progressiveDisclosure) ? browser.progressiveDisclosure : {};
  const mutationBoundary = isRecord(report.mutationBoundary) ? report.mutationBoundary : {};
  const remainingBoundaries = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  const sourceMatchesProduction = readString(report.sourceHead).length > 0
    && readString(report.sourceHead) === readString(report.productionCommit)
    && report.sourceHeadMatchesProduction === true
    && report.productCommitIncludedInProduction === true;
  const noMutation = mutationBoundary.dbMutationPerformed === false
    && mutationBoundary.providerDispatchCalled === false
    && mutationBoundary.shareSessionCreated === false
    && mutationBoundary.vectorMutationPerformed === false
    && mutationBoundary.wikiPublicationPerformed === false
    && mutationBoundary.koshaRegistryMutationPerformed === false;
  const maxBodyRatio = readNumber(browser.maxBodyRatio);
  const minimumControlHeight = readNumber(browser.minimumControlHeight);
  const minimumLocalScrollPanelCount = readNumber(browser.minimumLocalScrollPanelCount);
  const referenceTechnicalRatio = readNumber(referenceDisclosure.maxMobileTechnicalScrollRatio);
  const referenceLibraryRatio = readNumber(referenceDisclosure.maxMobileReferenceScrollRatio);
  const referenceFirstBottom = readNumber(referenceDisclosure.maxFirstDisclosureBottom);
  const referencePanelBottom = readNumber(referenceDisclosure.minPanelBottom);
  const progressiveTechnicalRatio = readNumber(progressiveDisclosure.maxMobileTechnicalScrollRatio);
  const progressiveReferenceRatio = readNumber(progressiveDisclosure.maxMobileReferenceScrollRatio);
  const progressiveWikiRatio = readNumber(progressiveDisclosure.maxMobileWikiScrollRatio);
  const progressiveGovernanceRatio = readNumber(progressiveDisclosure.maxMobileGovernanceScrollRatio);
  const taskRailBuild = isRecord(taskRailReport.productionBuild) ? taskRailReport.productionBuild : {};
  const taskRailScope = isRecord(taskRailReport.scope) ? taskRailReport.scope : {};
  const taskRailBefore = isRecord(taskRailReport.beforeLive) ? taskRailReport.beforeLive : {};
  const taskRailAfter = isRecord(taskRailReport.afterLive) ? taskRailReport.afterLive : {};
  const taskRailCommon = isRecord(taskRailAfter.commonContract) ? taskRailAfter.commonContract : {};
  const taskRailVerification = isRecord(taskRailReport.verification) ? taskRailReport.verification : {};
  const taskRailMutation = isRecord(taskRailReport.mutationBoundary) ? taskRailReport.mutationBoundary : {};
  const taskRailBoundaries = isRecord(taskRailReport.remainingBoundaries) ? taskRailReport.remainingBoundaries : {};
  const taskRailThemes = Array.isArray(taskRailScope.themes) ? taskRailScope.themes.map(readString) : [];
  const taskRailTargets = Array.isArray(taskRailScope.hashTargets) ? taskRailScope.hashTargets.map(readString) : [];
  const knowledgeMobileTaskRailPass = readString(taskRailReport.schema) === "safeclaw-knowledge-mobile-task-rail/v1"
    && readString(taskRailReport.verdict) === "PASS_LIVE_PRODUCTION_KNOWLEDGE_MOBILE_TASK_RAIL"
    && readString(taskRailReport.productCommit) === readString(taskRailBuild.commitSha)
    && readString(taskRailBuild.branch) === "master"
    && readString(taskRailBuild.environment) === "production"
    && readString(taskRailScope.route) === "/knowledge"
    && readNumber(taskRailScope.viewport?.width) === 390
    && readNumber(taskRailScope.viewport?.height) === 723
    && taskRailThemes.length === 2
    && taskRailThemes.includes("day")
    && taskRailThemes.includes("night")
    && taskRailTargets.length === 2
    && taskRailTargets.includes("wiki")
    && taskRailTargets.includes("governance")
    && taskRailScope.existingSelectedOnlyWorkbenchPreserved === true
    && taskRailScope.routeSplitAloneAcceptedAsFix === false
    && readNumber(taskRailBefore.selectorCount) === 6
    && readNumber(taskRailBefore.selectorRows) === 2
    && readNumber(taskRailBefore.selectorHeight) >= 44
    && readNumber(taskRailBefore.taskIndexHeight) === 129
    && readNumber(taskRailBefore.panelTop) >= 437
    && readNumber(taskRailAfter.resultCount) === 4
    && readNumber(taskRailAfter.passCount) === 4
    && readNumber(taskRailAfter.failCount) === 0
    && readNumber(taskRailCommon.documentHeight) <= 733
    && readNumber(taskRailCommon.horizontalOverflow) === 0
    && readNumber(taskRailCommon.railHeight) <= 48
    && readNumber(taskRailCommon.railScrollWidth) > readNumber(taskRailCommon.railClientWidth)
    && readNumber(taskRailCommon.selectorCount) === 6
    && readNumber(taskRailCommon.selectorRows) === 1
    && readNumber(taskRailCommon.minimumSelectorHeight) >= 44
    && taskRailCommon.selectedFullyVisible === true
    && readNumber(taskRailCommon.panelTop) <= 400
    && readNumber(taskRailCommon.panelBottom) <= 724
    && readNumber(taskRailCommon.panelClientHeight) >= 220
    && readString(taskRailCommon.panelOverflowY) === "auto"
    && readString(taskRailVerification.knowledgeGovernanceUiContract?.status) === "PASS"
    && readNumber(taskRailVerification.knowledgeGovernanceUiContract?.tests) === 18
    && readString(taskRailVerification.focusedBrowser?.status) === "PASS"
    && readNumber(taskRailVerification.focusedBrowser?.tests) === 1
    && readString(taskRailVerification.typecheck) === "PASS"
    && readString(taskRailVerification.build?.status) === "PASS"
    && readNumber(taskRailVerification.build?.staticPages) === 28
    && taskRailMutation.dbMutationPerformed === false
    && taskRailMutation.providerDispatchCalled === false
    && taskRailMutation.shareSessionCreated === false
    && taskRailMutation.embeddingOrVectorMutationPerformed === false
    && taskRailMutation.wikiPublicationPerformed === false
    && taskRailMutation.koshaRegistryMutationPerformed === false
    && readString(taskRailBoundaries.exactSavedShareVerdict) === "MISSING_EVIDENCE"
    && readString(taskRailBoundaries.llmWikiPublication) === "APPROVAL_GATED"
    && readString(taskRailBoundaries.sifEmbeddingRuntime) === "APPROVAL_GATED"
    && readString(taskRailBoundaries.providerDispatchPersistence) === "APPROVAL_GATED"
    && readString(taskRailBoundaries.supabaseRlsLaunchIsolation) === "APPROVAL_GATED"
    && readString(taskRailBoundaries.koshaExactPromotionReview) === "APPROVAL_GATED"
    && taskRailBoundaries.humanReviewCompleted === false;
  const liveReady = readString(report.verdict) === "PASS_LIVE_PRODUCTION_KNOWLEDGE_VIEWPORT_WORKBENCH"
    && sourceMatchesProduction
    && readNumber(browser.rowCount) === 10
    && readNumber(browser.passCount) === 10
    && maxBodyRatio !== null
    && maxBodyRatio <= 1.02
    && readNumber(browser.horizontalOverflowRows) === 0
    && readNumber(browser.outsideElementRows) === 0
    && readNumber(browser.visiblePanelCountPerRow) === 1
    && readNumber(browser.reachableSectionCountPerRow) === 6
    && minimumControlHeight !== null
    && minimumControlHeight >= 44
    && minimumLocalScrollPanelCount !== null
    && minimumLocalScrollPanelCount >= 4
    && readNumber(browser.screenshotCount) === 18
    && readNumber(desktop.caseCount) === 4
    && desktop.selectedOnly === true
    && desktop.localScrollContained === true
    && readNumber(tablet.caseCount) === 2
    && tablet.selectedOnly === true
    && tablet.localScrollContained === true
    && readNumber(mobile.caseCount) === 4
    && mobile.selectedOnly === true
    && mobile.localScrollContained === true
    && readNumber(referenceDisclosure.technicalDisclosureCount) === 6
    && readNumber(referenceDisclosure.referenceDisclosureCount) === 7
    && readNumber(referenceDisclosure.defaultOpenDisclosureCount) === 0
    && referenceDisclosure.exclusiveDisclosureGroups === true
    && referenceTechnicalRatio !== null
    && referenceTechnicalRatio <= 6.1
    && referenceLibraryRatio !== null
    && referenceLibraryRatio <= 4.1
    && referenceDisclosure.firstDisclosureInsidePanel === true
    && referenceFirstBottom !== null
    && referencePanelBottom !== null
    && referenceFirstBottom <= referencePanelBottom
    && readNumber(progressiveDisclosure.technicalDisclosureCount) === 6
    && readNumber(progressiveDisclosure.referenceDisclosureCount) === 7
    && readNumber(progressiveDisclosure.wikiDisclosureCount) === 2
    && readNumber(progressiveDisclosure.governanceDisclosureCount) === 2
    && readNumber(progressiveDisclosure.defaultOpenDisclosureCount) === 0
    && progressiveDisclosure.exclusiveDisclosureGroups === true
    && progressiveTechnicalRatio !== null
    && progressiveTechnicalRatio <= 6.1
    && progressiveReferenceRatio !== null
    && progressiveReferenceRatio <= 4.1
    && progressiveWikiRatio !== null
    && progressiveWikiRatio <= 4.1
    && progressiveGovernanceRatio !== null
    && progressiveGovernanceRatio <= 5.5
    && progressiveDisclosure.firstDisclosureInsidePanel === true
    && progressiveDisclosure.firstReviewStateInsidePanel === true
    && report.routeSplitAloneAcceptedAsFix === false
    && report.selectedOnlyWorkbenchRequired === true
    && noMutation
    && readString(remainingBoundaries.exactSavedShareVerdict) === "MISSING_EVIDENCE"
    && readString(remainingBoundaries.llmWikiPublicationVerdict) === "APPROVAL_GATED"
    && readString(remainingBoundaries.sifEmbeddingRuntimeVerdict) === "APPROVAL_GATED"
    && remainingBoundaries.fullyAutomatedLaunchClaimAllowed === false
    && knowledgeMobileTaskRailPass;

  if (liveReady) {
    return gateResult({
      id: "knowledge_viewport_workbench",
      label: "Live Knowledge viewport workbench",
      state: "proven",
      evidencePath: taskRailEvidencePath,
      detail: `Production /knowledge passes ${readNumber(browser.passCount)}/${readNumber(browser.rowCount)} Day/Night browser rows with maximum body ratio ${readNumber(browser.maxBodyRatio)}, one visible panel, six reachable tasks, zero horizontal overflow, and ${readNumber(browser.minimumControlHeight)}px minimum controls. KOSHA disclosures are ${readNumber(progressiveDisclosure.technicalDisclosureCount)}/${readNumber(progressiveDisclosure.referenceDisclosureCount)} technical/reference rows; Wiki/governance disclosures are ${readNumber(progressiveDisclosure.wikiDisclosureCount)}/${readNumber(progressiveDisclosure.governanceDisclosureCount)}. All groups are exclusive with defaultOpen=${readNumber(progressiveDisclosure.defaultOpenDisclosureCount)}, mobile scroll ratios ${readNumber(progressiveDisclosure.maxMobileTechnicalScrollRatio)}/${readNumber(progressiveDisclosure.maxMobileReferenceScrollRatio)}/${readNumber(progressiveDisclosure.maxMobileWikiScrollRatio)}/${readNumber(progressiveDisclosure.maxMobileGovernanceScrollRatio)}, and first review state panel-contained=${progressiveDisclosure.firstReviewStateInsidePanel === true}. A current live companion reduces the 390x723 six-task navigator from a 3x2, 129px block to one 46px horizontal rail across Day/Night Wiki and governance hash entry, keeps all controls 44px, reveals the selected tab, and moves the panel top from 437.99px to 381.97px. Long content remains inside local-scroll panels; route split alone is not accepted. No mutation occurred, exact saved Share remains MISSING_EVIDENCE, and Wiki publication plus SIF embedding remain APPROVAL_GATED.`,
      nextActions: [],
    });
  }

  return gateResult({
    id: "knowledge_viewport_workbench",
    label: "Live Knowledge viewport workbench",
    state: "contradicted",
    evidencePath: knowledgeMobileTaskRailPass ? evidencePath : taskRailEvidencePath,
    detail: `Knowledge verdict=${readString(report.verdict) || "unknown"}, sourceMatchesProduction=${sourceMatchesProduction}, rows=${readNumber(browser.passCount)}/${readNumber(browser.rowCount)}, maxBodyRatio=${readNumber(browser.maxBodyRatio)}, visiblePanels=${readNumber(browser.visiblePanelCountPerRow)}, reachableTasks=${readNumber(browser.reachableSectionCountPerRow)}, disclosures=${readNumber(progressiveDisclosure.technicalDisclosureCount)}/${readNumber(progressiveDisclosure.referenceDisclosureCount)}/${readNumber(progressiveDisclosure.wikiDisclosureCount)}/${readNumber(progressiveDisclosure.governanceDisclosureCount)}, defaultOpen=${readNumber(progressiveDisclosure.defaultOpenDisclosureCount)}, mobileRatios=${readNumber(progressiveDisclosure.maxMobileTechnicalScrollRatio)}/${readNumber(progressiveDisclosure.maxMobileReferenceScrollRatio)}/${readNumber(progressiveDisclosure.maxMobileWikiScrollRatio)}/${readNumber(progressiveDisclosure.maxMobileGovernanceScrollRatio)}, firstDisclosureInsidePanel=${progressiveDisclosure.firstDisclosureInsidePanel === true}, firstReviewStateInsidePanel=${progressiveDisclosure.firstReviewStateInsidePanel === true}, mobileTaskRail=${knowledgeMobileTaskRailPass}, noMutation=${noMutation}, exactShare=${readString(remainingBoundaries.exactSavedShareVerdict) || "missing"}, wiki=${readString(remainingBoundaries.llmWikiPublicationVerdict) || "missing"}, embedding=${readString(remainingBoundaries.sifEmbeddingRuntimeVerdict) || "missing"}.`,
    nextActions: ["Restore selected-only viewport containment and approval boundaries, then rerun the current-production Knowledge browser contract."],
  });
}

/**
 * @param {string} rootDir
 * @returns {GateResult}
 */
function evaluateLlmWikiCandidateContentReadinessGate(rootDir) {
  const evidencePath = EVIDENCE_PATHS.llmWikiCandidateContentReadiness;
  const report = readJsonFile(rootDir, evidencePath);
  if (!isRecord(report)) {
    return gateResult({
      id: "llm_wiki_candidate_content_readiness",
      label: "Live LLM Wiki candidate content readiness",
      state: "missing",
      evidencePath,
      detail: "Live LLM Wiki candidate content-readiness evidence is missing or invalid.",
      nextActions: ["Rerun the candidate-readiness Day/Night desktop and mobile browser contract against current production."],
    });
  }

  const local = isRecord(report.local) ? report.local : {};
  const afterLive = isRecord(report.afterLive) ? report.afterLive : {};
  const readiness = isRecord(report.contentReadinessContract) ? report.contentReadinessContract : {};
  const mutationBoundary = isRecord(report.mutationBoundary) ? report.mutationBoundary : {};
  const remainingBoundaries = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  const sourceHead = readString(report.sourceHead);
  const productCommit = readString(report.productCommit);
  const productionCommit = readString(report.productionCommit);
  const sourceMatchesProduction = /^[0-9a-f]{40}$/u.test(sourceHead)
    && /^[0-9a-f]{40}$/u.test(productCommit)
    && /^[0-9a-f]{40}$/u.test(productionCommit)
    && sourceHead === productionCommit;
  const noMutation = mutationBoundary.dbMutationPerformed === false
    && mutationBoundary.providerDispatchCalled === false
    && mutationBoundary.shareSessionCreated === false
    && mutationBoundary.ontologyPublicationPerformed === false
    && mutationBoundary.vectorOrEmbeddingMutationPerformed === false
    && mutationBoundary.wikiPublicationPerformed === false
    && mutationBoundary.koshaRegistryMutationPerformed === false;
  const localPass = readString(local.verdict) === "PASS_CURRENT_SOURCE_LOCAL_LLM_WIKI_CANDIDATE_CONTENT_READINESS"
    && readNumber(local.viewportCount) === 8
    && readNumber(local.passedCount) === 8
    && readNumber(local.failedCount) === 0;
  const livePass = readString(afterLive.verdict) === "PASS_LIVE_PRODUCTION_LLM_WIKI_CANDIDATE_CONTENT_READINESS"
    && readNumber(afterLive.viewportCount) === 8
    && readNumber(afterLive.passedCount) === 8
    && readNumber(afterLive.failedCount) === 0
    && afterLive.productionAligned === true
    && readNumber(afterLive.browserErrorCount) === 0;
  const readinessPass = readString(readiness.contractVersion) === "knowledge-candidate-content-readiness.v1"
    && readNumber(readiness.requiredSectionCount) === 4
    && readNumber(readiness.readyFixtureCount) === 2
    && readNumber(readiness.revisionRequiredFixtureCount) === 1
    && readNumber(readiness.selectedReadinessPanelCount) === 1
    && readiness.approvalFailsClosedForRevision === true
    && readiness.revisionGuidanceVisible === true
    && readNumber(readiness.revisionIssueCount) === 4
    && readiness.revisionIssueCodesExposed === false
    && readiness.approvalFailsClosedAfterConfirmation === true
    && readiness.keepSiteOnlyAvailableForRevision === true
    && readiness.rejectAvailableForRevision === true
    && readiness.humanReviewCompleted === false
    && readString(readiness.publicationState) === "unpublished"
    && readiness.publishAllowed === false;
  const approvalBoundariesPreserved = readString(remainingBoundaries.exactSavedShareVerdict) === "MISSING_EVIDENCE"
    && readString(remainingBoundaries.llmWikiPublication) === "APPROVAL_GATED"
    && readString(remainingBoundaries.supabaseRlsLaunchIsolation) === "APPROVAL_GATED";
  const proven = readString(report.verdict) === "PASS_LIVE_PRODUCTION_LLM_WIKI_CANDIDATE_CONTENT_READINESS"
    && report.liveAfterDeploymentRequired === false
    && sourceMatchesProduction
    && localPass
    && livePass
    && readinessPass
    && noMutation
    && approvalBoundariesPreserved;

  if (proven) {
    return gateResult({
      id: "llm_wiki_candidate_content_readiness",
      label: "Live LLM Wiki candidate content readiness",
      state: "proven",
      evidencePath,
      detail: "Production LLM Wiki candidate review passes local/live 8/8 viewport rows with four required sections. Revision-required candidates expose four human-readable remediation items without internal issue codes; confirmation keeps approval fail-closed while site-only and reject remain available. Human review is not complete, publication remains unpublished and disallowed, no mutation occurred, exact saved Share remains MISSING_EVIDENCE, and LLM Wiki publication plus Supabase RLS remain APPROVAL_GATED.",
      nextActions: [],
    });
  }

  return gateResult({
    id: "llm_wiki_candidate_content_readiness",
    label: "Live LLM Wiki candidate content readiness",
    state: "contradicted",
    evidencePath,
    detail: `Readiness verdict=${readString(report.verdict) || "unknown"}, sourceMatchesProduction=${sourceMatchesProduction}, local=${readNumber(local.passedCount)}/${readNumber(local.viewportCount)}, live=${readNumber(afterLive.passedCount)}/${readNumber(afterLive.viewportCount)}, browserErrors=${readNumber(afterLive.browserErrorCount)}, sections=${readNumber(readiness.requiredSectionCount)}, approvalBlocked=${readiness.approvalFailsClosedForRevision === true}, guidance=${readiness.revisionGuidanceVisible === true}/${readNumber(readiness.revisionIssueCount)}/${readiness.revisionIssueCodesExposed === false}, confirmedApprovalBlocked=${readiness.approvalFailsClosedAfterConfirmation === true}, humanReviewCompleted=${readiness.humanReviewCompleted === true}, publishAllowed=${readiness.publishAllowed === true}, noMutation=${noMutation}, exactShare=${readString(remainingBoundaries.exactSavedShareVerdict) || "missing"}, wiki=${readString(remainingBoundaries.llmWikiPublication) || "missing"}, rls=${readString(remainingBoundaries.supabaseRlsLaunchIsolation) || "missing"}.`,
    nextActions: ["Restore source/live alignment, four-section readiness, fail-closed approval, no-mutation behavior, and approval boundaries, then rerun the live candidate-readiness contract."],
  });
}

/**
 * @param {string} rootDir
 * @returns {GateResult}
 */
function evaluateLlmWikiCandidateContentMatrixGate(rootDir) {
  const evidencePath = EVIDENCE_PATHS.llmWikiCandidateContentMatrix;
  const report = readJsonFile(rootDir, evidencePath);
  if (!isRecord(report)) {
    return gateResult({
      id: "llm_wiki_candidate_content_matrix",
      label: "Live Wiki candidate fallback content matrix",
      state: "missing",
      evidencePath,
      detail: "Live Wiki candidate fallback content-matrix evidence is missing or invalid.",
      nextActions: ["Run the five-scenario stateless fallback matrix and the separate enhanced-provider probe against current production."],
    });
  }

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
  const sourceHead = readString(afterEventSemanticLive.sourceHead);
  const productionCommit = readString(afterEventSemanticLive.productionCommit);
  const productCommit = readString(report.productCommit);
  const sourceMatchesProduction = /^[0-9a-f]{40}$/u.test(sourceHead)
    && /^[0-9a-f]{40}$/u.test(productCommit)
    && sourceHead === productionCommit
    && /^[0-9a-f]{40}$/u.test(productionCommit);
  const localPass = readString(afterLocal.verdict) === "PASS_CURRENT_SOURCE_LOCAL_WIKI_CANDIDATE_FALLBACK_CONTENT_MATRIX"
    && readNumber(afterLocal.passedCount) === 5
    && readNumber(afterLocal.failedCount) === 0;
  const liveFallbackPass = readString(afterLive.verdict) === "PASS_LIVE_PRODUCTION_WIKI_CANDIDATE_FALLBACK_CONTENT_MATRIX"
    && readNumber(afterLive.passedCount) === 5
    && readNumber(afterLive.failedCount) === 0
    && readNumber(afterLive.reviewerEvidenceTraceCount) === 5
    && readNumber(afterLive.technicalGuidanceBoundaryCount) === 5
    && readNumber(afterLive.lawCandidateBoundaryCount) === 5;
  const evidenceVisibilityRemediationProven = readString(beforeEvidenceVisibilityLive.verdict) === "RED_LIVE_PRODUCTION_WIKI_CANDIDATE_FALLBACK_CONTENT_MATRIX"
    && readNumber(beforeEvidenceVisibilityLive.passedCount) === 0
    && readNumber(beforeEvidenceVisibilityLive.failedCount) === 5
    && readNumber(beforeEvidenceVisibilityLive.reviewerEvidenceTraceCount) === 0
    && readNumber(afterLocal.reviewerEvidenceTraceCount) === 5
    && readNumber(afterLocal.technicalGuidanceBoundaryCount) === 5
    && readNumber(afterLocal.lawCandidateBoundaryCount) === 5;
  const eventSemanticRemediationProven = readString(beforeEventSemanticLive.verdict) === "RED_LIVE_PRODUCTION_WIKI_CANDIDATE_FALLBACK_CONTENT_MATRIX"
    && readNumber(beforeEventSemanticLive.passedCount) === 0
    && readNumber(beforeEventSemanticLive.failedCount) === 5
    && readNumber(beforeEventSemanticLive.eventSemanticGroundingCount) === 0
    && readNumber(beforeEventSemanticLive.privateEventExposureCount) === 0
    && readString(afterEventSemanticLocal.verdict) === "PASS_CURRENT_SOURCE_LOCAL_WIKI_CANDIDATE_FALLBACK_CONTENT_MATRIX"
    && readNumber(afterEventSemanticLocal.passedCount) === 5
    && readNumber(afterEventSemanticLocal.failedCount) === 0
    && readNumber(afterEventSemanticLocal.eventSemanticGroundingCount) === 5
    && readNumber(afterEventSemanticLocal.privateEventExposureCount) === 0
    && readString(afterEventSemanticLive.verdict) === "PASS_LIVE_PRODUCTION_WIKI_CANDIDATE_FALLBACK_CONTENT_MATRIX"
    && readNumber(afterEventSemanticLive.passedCount) === 5
    && readNumber(afterEventSemanticLive.failedCount) === 0
    && readNumber(afterEventSemanticLive.eventSemanticGroundingCount) === 5
    && readNumber(afterEventSemanticLive.privateEventExposureCount) === 0;
  const providerBlockPreserved = readString(afterLiveProvider.verdict) === "RED_LIVE_PRODUCTION_LLM_WIKI_CANDIDATE_CONTENT_MATRIX"
    && readNumber(afterLiveProvider.passedCount) === 0
    && readNumber(afterLiveProvider.failedCount) === 5
    && readString(afterLiveProvider.runtimeBlocker) === "distributed_rate_limit_unavailable_before_ai_generation"
    && Array.isArray(afterLiveProvider.httpStatuses)
    && afterLiveProvider.httpStatuses.length === 5
    && afterLiveProvider.httpStatuses.every((status) => status === 503);
  const contractPass = readNumber(contentContract.scenarioCount) === 5
    && readNumber(contentContract.requiredSectionCount) === 4
    && contentContract.scenarioSpecificTermGroupsRequired === true
    && contentContract.textualHazardGroundingRequired === true
    && contentContract.matchedHazardMetadataAloneAccepted === false
    && contentContract.reviewerVisibleEvidenceTraceRequired === true
    && contentContract.scenarioSpecificOfficialSourceTermsRequired === true
    && contentContract.technicalGuidanceAndLawRolesSeparated === true
    && contentContract.explicitEventReviewFactsRequired === true
    && contentContract.arbitraryRawPayloadAcceptedAsReviewFact === false
    && contentContract.privateEventTermExposureAllowed === false
    && readNumber(contentContract.placeholderFindingCount) === 0
    && readNumber(contentContract.legalOverclaimFindingCount) === 0
    && contentContract.humanReviewCompleted === false
    && readString(contentContract.publicationState) === "unpublished"
    && contentContract.publishAllowed === false;
  const scopePass = scopeBoundary.actualProductionCandidateQueueRead === false
    && scopeBoundary.routeControlledBrowserFixtureAcceptedAsGenerationProof === false
    && scopeBoundary.deterministicFallbackProvenCurrentSource === true
    && scopeBoundary.deterministicFallbackProvenLive === true
    && scopeBoundary.evidenceVisibilityContractProvenLive === true
    && scopeBoundary.eventSemanticGroundingProvenCurrentSource === true
    && scopeBoundary.eventSemanticGroundingProvenLive === true
    && scopeBoundary.enhancedLlmGenerationProvenLive === false
    && readString(scopeBoundary.enhancedLlmRuntimeState) === "BLOCKED_DISTRIBUTED_RATE_LIMIT_CONFIGURATION";
  const noMutation = mutationBoundary.dbMutationPerformed === false
    && mutationBoundary.providerDispatchCalled === false
    && mutationBoundary.shareSessionCreated === false
    && mutationBoundary.ontologyPublicationPerformed === false
    && mutationBoundary.vectorOrEmbeddingMutationPerformed === false
    && mutationBoundary.koshaRegistryMutationPerformed === false;
  const boundariesPass = readString(remainingBoundaries.exactSavedShareVerdict) === "MISSING_EVIDENCE"
    && readString(remainingBoundaries.llmWikiPublication) === "APPROVAL_GATED"
    && readString(remainingBoundaries.supabaseRlsLaunchIsolation) === "APPROVAL_GATED";
  const proven = readString(report.verdict) === "PASS_LIVE_PRODUCTION_WIKI_EVENT_SEMANTIC_AND_EVIDENCE_VISIBILITY_LLM_ENHANCED_RUNTIME_BLOCKED"
    && report.liveAfterDeploymentRequired === false
    && sourceMatchesProduction
    && localPass
    && liveFallbackPass
    && evidenceVisibilityRemediationProven
    && eventSemanticRemediationProven
    && providerBlockPreserved
    && contractPass
    && scopePass
    && noMutation
    && boundariesPass;

  if (proven) {
    return gateResult({
      id: "llm_wiki_candidate_content_matrix",
      label: "Live Wiki candidate fallback content matrix",
      state: "proven",
      evidencePath,
      detail: "Current-source and production stateless fallback candidates pass 5/5 chemical, hot-work, confined-space, forklift, and foreign-worker fall scenarios with four non-empty sections, textual hazard grounding, and reviewer-visible source grounding. Visible evidence roles move 0/5 to 5/5, and explicit safe original-event review facts separately move 0/5 to 5/5 while private event-term exposure remains 0. Arbitrary raw payload is not accepted as reviewer-visible context. The enhanced LLM probe remains explicitly blocked 0/5 by distributed admission before AI generation; this gate does not claim enhanced LLM quality or read the production candidate queue. Human review remains incomplete, publication is disallowed, no mutation occurred, exact saved Share remains MISSING_EVIDENCE, and Wiki publication plus Supabase RLS remain APPROVAL_GATED.",
      nextActions: ["Configure distributed provider admission, then rerun the five-scenario provider matrix without weakening fail-closed admission."],
    });
  }

  return gateResult({
    id: "llm_wiki_candidate_content_matrix",
    label: "Live Wiki candidate fallback content matrix",
    state: "contradicted",
    evidencePath,
    detail: `Matrix verdict=${readString(report.verdict) || "unknown"}, sourceMatchesProduction=${sourceMatchesProduction}, local=${readNumber(afterLocal.passedCount)}/5, liveFallback=${readNumber(afterLive.passedCount)}/5, evidenceVisibilityRemediation=${evidenceVisibilityRemediationProven}, visibleTrace=${readNumber(afterLive.reviewerEvidenceTraceCount)}/5, technicalBoundary=${readNumber(afterLive.technicalGuidanceBoundaryCount)}/5, lawBoundary=${readNumber(afterLive.lawCandidateBoundaryCount)}/5, eventSemanticRemediation=${eventSemanticRemediationProven}, eventFacts=${readNumber(afterEventSemanticLive.eventSemanticGroundingCount)}/5, privateExposure=${readNumber(afterEventSemanticLive.privateEventExposureCount)}, providerBlocked=${providerBlockPreserved}, enhancedLive=${scopeBoundary.enhancedLlmGenerationProvenLive === true}, sections=${readNumber(contentContract.requiredSectionCount)}, textualGrounding=${contentContract.textualHazardGroundingRequired === true}, humanReviewCompleted=${contentContract.humanReviewCompleted === true}, noMutation=${noMutation}, exactShare=${readString(remainingBoundaries.exactSavedShareVerdict) || "missing"}, wiki=${readString(remainingBoundaries.llmWikiPublication) || "missing"}, rls=${readString(remainingBoundaries.supabaseRlsLaunchIsolation) || "missing"}.`,
    nextActions: ["Restore the five-scenario fallback PASS, explicit enhanced-runtime block, source/live alignment, no-mutation boundary, and approval boundaries."],
  });
}

/**
 * @param {string} rootDir
 * @returns {GateResult}
 */
function evaluateLlmWikiSifEvidenceMatrixGate(rootDir) {
  const evidencePath = EVIDENCE_PATHS.llmWikiSifEvidenceMatrix;
  const report = readJsonFile(rootDir, evidencePath);
  if (!isRecord(report)) {
    return gateResult({
      id: "llm_wiki_sif_evidence_matrix",
      label: "Live Wiki SIF evidence matrix",
      state: "missing",
      evidencePath,
      detail: "Live SIF -> KOSHA -> law Wiki candidate evidence is missing or invalid.",
      nextActions: ["Run the five-scenario stateless SIF evidence matrix against current source and production."],
    });
  }

  const afterLocal = isRecord(report.afterLocal) ? report.afterLocal : {};
  const afterLive = isRecord(report.afterLive) ? report.afterLive : {};
  const contentContract = isRecord(report.contentContract) ? report.contentContract : {};
  const mutationBoundary = isRecord(report.mutationBoundary) ? report.mutationBoundary : {};
  const remainingBoundaries = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  const sourceHead = readString(report.sourceHead);
  const productionCommit = readString(report.productionCommit);
  const productCommit = readString(report.productCommit);
  const authorityOrder = Array.isArray(contentContract.authorityOrder)
    ? contentContract.authorityOrder.map(readString)
    : [];
  const sourceMatchesProduction = /^[0-9a-f]{40}$/u.test(sourceHead)
    && sourceHead === productionCommit
    && /^[0-9a-f]{40}$/u.test(productCommit);
  const localPass = readString(afterLocal.verdict) === "PASS_CURRENT_SOURCE_LOCAL_WIKI_CANDIDATE_FALLBACK_CONTENT_MATRIX"
    && readNumber(afterLocal.passedCount) === 5
    && readNumber(afterLocal.failedCount) === 0
    && readNumber(afterLocal.sifEvidenceBoundaryCount) === 5
    && readNumber(afterLocal.technicalGuidanceBoundaryCount) === 5
    && readNumber(afterLocal.lawCandidateBoundaryCount) === 5
    && readNumber(afterLocal.privateEventExposureCount) === 0;
  const livePass = readString(afterLive.verdict) === "PASS_LIVE_PRODUCTION_WIKI_CANDIDATE_FALLBACK_CONTENT_MATRIX"
    && readString(afterLive.sourceHead) === sourceHead
    && readString(afterLive.productionCommit) === productionCommit
    && readNumber(afterLive.passedCount) === 5
    && readNumber(afterLive.failedCount) === 0
    && readNumber(afterLive.sifEvidenceBoundaryCount) === 5
    && readNumber(afterLive.technicalGuidanceBoundaryCount) === 5
    && readNumber(afterLive.lawCandidateBoundaryCount) === 5
    && readNumber(afterLive.eventSemanticGroundingCount) === 5
    && readNumber(afterLive.privateEventExposureCount) === 0;
  const contractPass = authorityOrder.join(",") === "sif,kosha,law"
    && readNumber(contentContract.scenarioCount) === 5
    && contentContract.reviewerVisibleSifEvidenceRequired === true
    && contentContract.sifProvenanceRequired === true
    && contentContract.sifIncidentControlEvidenceIsNonStatutory === true
    && contentContract.koshaTechnicalGuidanceIsNonStatutory === true
    && contentContract.statutoryClaimsRequireLawProvenance === true
    && contentContract.privateSifTitleExposureAllowed === false
    && contentContract.humanReviewCompleted === false
    && readString(contentContract.publicationState) === "unpublished"
    && contentContract.publishAllowed === false;
  const noMutation = mutationBoundary.dbMutationPerformed === false
    && mutationBoundary.providerDispatchCalled === false
    && mutationBoundary.shareSessionCreated === false
    && mutationBoundary.ontologyPublicationPerformed === false
    && mutationBoundary.vectorOrEmbeddingMutationPerformed === false
    && mutationBoundary.koshaRegistryMutationPerformed === false;
  const boundariesPass = remainingBoundaries.actualProductionCandidateQueueRead === false
    && readString(remainingBoundaries.enhancedLlmRuntime) === "BLOCKED_DISTRIBUTED_RATE_LIMIT_CONFIGURATION"
    && readString(remainingBoundaries.exactSavedShareVerdict) === "MISSING_EVIDENCE"
    && readString(remainingBoundaries.llmWikiPublication) === "APPROVAL_GATED"
    && readString(remainingBoundaries.supabaseRlsLaunchIsolation) === "APPROVAL_GATED";
  const proven = readString(report.verdict) === "PASS_LIVE_PRODUCTION_SIF_KOSHA_LAW_WIKI_CANDIDATE_EVIDENCE"
    && report.liveAfterDeploymentRequired === false
    && sourceMatchesProduction
    && localPass
    && livePass
    && contractPass
    && noMutation
    && boundariesPass;

  return gateResult({
    id: "llm_wiki_sif_evidence_matrix",
    label: "Live Wiki SIF evidence matrix",
    state: proven ? "proven" : "contradicted",
    evidencePath,
    detail: proven
      ? "Current-source and production stateless Wiki candidates pass 5/5 scenarios with reviewer-visible SIF provenance, KOSHA technical guidance, and current-law boundaries in SIF -> KOSHA -> law order. Event facts pass 5/5, private SIF/event exposure is 0, human review remains incomplete, no mutation occurred, exact saved Share remains MISSING_EVIDENCE, and enhanced runtime plus Wiki/RLS remain blocked or APPROVAL_GATED."
      : `SIF matrix verdict=${readString(report.verdict) || "unknown"}, sourceMatchesProduction=${sourceMatchesProduction}, local=${readNumber(afterLocal.passedCount)}/5, live=${readNumber(afterLive.passedCount)}/5, SIF=${readNumber(afterLive.sifEvidenceBoundaryCount)}/5, KOSHA=${readNumber(afterLive.technicalGuidanceBoundaryCount)}/5, law=${readNumber(afterLive.lawCandidateBoundaryCount)}/5, privateExposure=${readNumber(afterLive.privateEventExposureCount)}, order=${authorityOrder.join(" -> ") || "missing"}, noMutation=${noMutation}, exactShare=${readString(remainingBoundaries.exactSavedShareVerdict) || "missing"}.`,
    nextActions: proven
      ? ["Keep enhanced LLM runtime, actual candidate-queue review, Wiki publication, and Supabase RLS as separate approval/configuration gates."]
      : ["Restore the five-scenario SIF -> KOSHA -> law live contract and preserved no-mutation/approval boundaries."],
  });
}

/**
 * @param {string} rootDir
 * @returns {GateResult}
 */
function evaluateLiveDocumentSeedProfileIsolationGate(rootDir) {
  const evidencePath = EVIDENCE_PATHS.liveDocumentSeedProfileIsolation;
  const report = readJsonFile(rootDir, evidencePath);
  if (!isRecord(report)) {
    return gateResult({
      id: "live_document_seed_profile_isolation",
      label: "Live document seed-profile isolation",
      state: "missing",
      evidencePath,
      detail: "Live five-scenario seed-profile isolation evidence is missing or invalid.",
      nextActions: ["Run the fail-closed five-by-twelve forbidden-fragment contract against current production."],
    });
  }

  const beforeLive = isRecord(report.beforeLive) ? report.beforeLive : {};
  const afterLive = isRecord(report.afterLive) ? report.afterLive : {};
  const contract = isRecord(report.contract) ? report.contract : {};
  const mutationBoundary = isRecord(report.mutationBoundary) ? report.mutationBoundary : {};
  const sourceMatchesProduction = readString(report.sourceHead).length > 0
    && readString(report.sourceHead) === readString(report.productionCommit);
  const noMutation = mutationBoundary.dbMutationPerformed === false
    && mutationBoundary.shareSessionCreated === false
    && mutationBoundary.providerDispatchCalled === false
    && mutationBoundary.exactSavedShareReproduced === false;
  const liveReady = readString(report.verdict) === "PASS_LIVE_PRODUCTION_SEED_PROFILE_ISOLATION"
    && sourceMatchesProduction
    && report.liveAfterDeploymentPending === false
    && readNumber(contract.scenarioCount) === 5
    && readNumber(contract.documentCountPerScenario) === 12
    && readNumber(contract.reviewedDocumentSurfaceCount) === 60
    && contract.failClosedOnAnyForbiddenFragment === true
    && readNumber(beforeLive.pass) === 0
    && readNumber(beforeLive.fail) === 5
    && readNumber(beforeLive.seedProfileLeakageCount) > 0
    && readNumber(afterLive.pass) === 5
    && readNumber(afterLive.fail) === 0
    && readNumber(afterLive.seedProfileLeakageCount) === 0
    && readNumber(afterLive.secondaryGroundingPassed) === 30
    && readNumber(afterLive.secondaryGroundingReviewed) === 30
    && readNumber(afterLive.missingUnexpectedCount) === 0
    && noMutation;

  if (liveReady) {
    return gateResult({
      id: "live_document_seed_profile_isolation",
      label: "Live document seed-profile isolation",
      state: "proven",
      evidencePath,
      detail: `Five live production scenarios pass the fail-closed 12-document seed-profile isolation contract: cases=5/5, document surface=60, forbidden fragments ${readNumber(beforeLive.seedProfileLeakageCount)}->0, secondary grounding=30/30, missingUnexpected=0. DB/share/provider mutation is false and exact saved Share remains ${readString(mutationBoundary.exactSavedShareEvidence) || "MISSING_EVIDENCE"}.`,
      nextActions: ["Keep broad human wording review and exact saved Share geometry separate from this deterministic seed-profile isolation contract."],
    });
  }

  return gateResult({
    id: "live_document_seed_profile_isolation",
    label: "Live document seed-profile isolation",
    state: "contradicted",
    evidencePath,
    detail: `Seed-profile isolation verdict=${readString(report.verdict) || "unknown"}, live=${readNumber(afterLive.pass)}/5, forbiddenFragments=${readNumber(afterLive.seedProfileLeakageCount)}, secondary=${readNumber(afterLive.secondaryGroundingPassed)}/${readNumber(afterLive.secondaryGroundingReviewed)}, missing=${readNumber(afterLive.missingUnexpectedCount)}, sourceMatchesProduction=${sourceMatchesProduction}, noMutation=${noMutation}.`,
    nextActions: ["Remove seeded work/weather/profile fragments from generated documents and rerun the unchanged five-by-twelve live contract."],
  });
}

/**
 * @param {string} rootDir
 * @returns {GateResult}
 */
function evaluateRlsApprovalGate(rootDir) {
  const evidencePath = EVIDENCE_PATHS.rlsApproval;
  const text = readTextFile(rootDir, evidencePath);
  const preflightPath = EVIDENCE_PATHS.rlsLlmWikiApprovalPreflight;
  const preflight = readJsonFile(rootDir, preflightPath);
  if (text === null) {
    return gateResult({
      id: "supabase_rls_launch_isolation",
      label: "Supabase RLS launch isolation",
      state: "missing",
      evidencePath,
      detail: "RLS approval report is missing.",
      nextActions: ["Create a read-only RLS approval report before any DB migration work."],
    });
  }

  const approvalRequired = /Status:\s*`approval_required`/u.test(text);
  const launchNotProven = /Launch isolation proven:\s*no/u.test(text);
  const preflightSourceSha = isRecord(preflight) ? readString(preflight.sourceSha) : "";
  const preflightCurrent = isGitAncestor(rootDir, preflightSourceSha);
  const checks = isRecord(preflight) && Array.isArray(preflight.checks) ? preflight.checks : [];
  const requiredRlsChecks = [
    "rls_status_approval_required",
    "rls_launch_not_proven",
    "rls_non_mutating",
    "rls_catalog_missing_is_explicit",
    "checklist_sections_present",
    "checklist_sql_boundaries_present",
    "tenant_manifest_v3",
    "tenant_harness_no_live_adapter",
    "northstar_rls_gate_approval_gated",
  ];
  const passedCheckIds = new Set(checks
    .filter((item) => isRecord(item) && item.passed === true)
    .map((item) => readString(item.id)));
  const preflightReady = isRecord(preflight)
    && preflight.overall === "approval_ready_open"
    && preflight.launchReadiness === false
    && preflight.dbMutationPerformed === false
    && preflight.networkOpened === false
    && Array.isArray(preflight.failedCheckIds)
    && preflight.failedCheckIds.length === 0
    && requiredRlsChecks.every((id) => passedCheckIds.has(id))
    && preflightCurrent;
  if (approvalRequired && launchNotProven && preflightReady) {
    return gateResult({
      id: "supabase_rls_launch_isolation",
      label: "Supabase RLS launch isolation",
      state: "approval_gated",
      evidencePath: preflightPath,
      detail: `Read-only RLS approval preflight passed at source SHA ${preflightSourceSha || "not-recorded"}, but live RLS catalog and tenant A/B isolation are not proven.`,
      nextActions: [
        "Approve authoritative project and credential provenance.",
        "Run read-only live catalog capture.",
        "Run disposable tenant A/B negative tests before production migration claims.",
      ],
    });
  }

  return gateResult({
    id: "supabase_rls_launch_isolation",
    label: "Supabase RLS launch isolation",
    state: "contradicted",
    evidencePath: isRecord(preflight) ? preflightPath : evidencePath,
    detail: approvalRequired && launchNotProven
      ? (preflightCurrent
        ? "RLS approval preflight is missing or failed even though the base report remains approval-required."
        : `RLS approval preflight source SHA ${preflightSourceSha} is not an ancestor of current HEAD.`)
      : "RLS approval report does not preserve the approval-required launch boundary.",
    nextActions: ["Re-run the RLS/LLM Wiki approval preflight and re-audit RLS evidence before making any launch isolation claim."],
  });
}

/**
 * @param {string} rootDir
 * @returns {GateResult}
 */
function evaluateLlmWikiGate(rootDir) {
  const evidencePath = EVIDENCE_PATHS.llmWikiApproval;
  const text = readTextFile(rootDir, evidencePath);
  const preflightPath = EVIDENCE_PATHS.rlsLlmWikiApprovalPreflight;
  const preflight = readJsonFile(rootDir, preflightPath);
  if (text === null) {
    return gateResult({
      id: "llm_wiki_publication",
      label: "LLM Wiki publication",
      state: "missing",
      evidencePath,
      detail: "LLM Wiki publication approval report is missing.",
      nextActions: ["Create a publication/RLS approval packet before any wiki publishing claim."],
    });
  }

  const redApproval = /Verdict:\s*\*\*RED \/ approval required \/ launch not proven\*\*/u.test(text);
  const unavailable = /publication remains unavailable/u.test(text);
  const preflightSourceSha = isRecord(preflight) ? readString(preflight.sourceSha) : "";
  const preflightCurrent = isGitAncestor(rootDir, preflightSourceSha);
  const checks = isRecord(preflight) && Array.isArray(preflight.checks) ? preflight.checks : [];
  const requiredWikiChecks = [
    "wiki_verdict_red",
    "wiki_launch_not_proven",
    "wiki_non_mutating",
    "wiki_publication_unavailable",
    "wiki_sql_design_non_executable",
    "wiki_sql_design_not_migration_path",
    "hermes_llm_candidate_stays_unpublished",
    "knowledge_candidate_review_authority_order",
    "knowledge_candidate_review_boundary",
    "knowledge_candidate_prompt_authority_separation",
    "knowledge_candidate_route_non_publishing",
    "knowledge_review_route_non_publishing",
    "hermes_review_authority_ui_live",
    "hermes_review_authority_contract",
    "hermes_review_selected_workbench",
    "hermes_review_authority_non_mutating",
    "hermes_review_authority_boundaries_open",
    "hermes_review_evidence_inspector_live",
    "hermes_review_evidence_inspector_contract",
    "hermes_review_evidence_inspector_verified",
    "hermes_review_evidence_inspector_non_mutating",
    "hermes_review_evidence_inspector_boundaries_open",
    "wiki_no_executable_publication_surface",
    "northstar_wiki_gate_approval_gated",
  ];
  const passedCheckIds = new Set(checks
    .filter((item) => isRecord(item) && item.passed === true)
    .map((item) => readString(item.id)));
  const publicationSurfaceInventory = isRecord(preflight)
    && isRecord(preflight.publicationSurfaceInventory)
    ? preflight.publicationSurfaceInventory
    : null;
  const publicationSurfaceInventoryPass = publicationSurfaceInventory !== null
    && Number.isInteger(publicationSurfaceInventory.scannedFileCount)
    && publicationSurfaceInventory.scannedFileCount > 0
    && Array.isArray(publicationSurfaceInventory.publicationRpcCallHits)
    && publicationSurfaceInventory.publicationRpcCallHits.length === 0
    && Array.isArray(publicationSurfaceInventory.publicationSqlFunctionHits)
    && publicationSurfaceInventory.publicationSqlFunctionHits.length === 0
    && Array.isArray(publicationSurfaceInventory.publicationLedgerMigrationHits)
    && publicationSurfaceInventory.publicationLedgerMigrationHits.length === 0
    && Array.isArray(publicationSurfaceInventory.publicationRoutePaths)
    && publicationSurfaceInventory.publicationRoutePaths.length === 0;
  const hermesUi = isRecord(preflight) && isRecord(preflight.hermesReviewAuthorityUi)
    ? preflight.hermesReviewAuthorityUi
    : null;
  const hermesInspector = isRecord(preflight) && isRecord(preflight.hermesReviewEvidenceInspector)
    ? preflight.hermesReviewEvidenceInspector
    : null;
  const hermesUiPass = hermesUi !== null
    && hermesUi.verdict === "PASS_LIVE_PRODUCTION_HERMES_REVIEW_AUTHORITY_UI"
    && hermesUi.liveViewportCount === 8
    && hermesUi.livePassedCount === 8
    && hermesUi.candidateCount === 3
    && hermesUi.selectedCandidateCount === 1
    && hermesUi.selectedBodyCount === 1
    && hermesUi.desktopColumns === 2
    && hermesUi.mobileColumns === 1
    && hermesUi.candidateBodyInternalScroll === true
    && hermesUi.humanReviewRequired === true
    && hermesUi.machineEvidenceReplacesHumanReview === false
    && hermesUi.exactSavedShareVerdict === "MISSING_EVIDENCE"
    && hermesUi.llmWikiPublication === "APPROVAL_GATED"
    && hermesUi.supabaseRlsLaunchIsolation === "APPROVAL_GATED";
  const hermesInspectorPass = hermesInspector !== null
    && hermesInspector.verdict === "PASS_LIVE_PRODUCTION_HERMES_REVIEW_EVIDENCE_INSPECTOR"
    && hermesInspector.liveViewportCount === 8
    && hermesInspector.livePassedCount === 8
    && hermesInspector.productionAligned === true
    && hermesInspector.itemLimit === 20
    && hermesInspector.fixtureItemCount === 5
    && hermesInspector.desktopEvidenceColumns === 2
    && hermesInspector.mobileMountedPaneCount === 1
    && hermesInspector.publicOfficialHttpsLinkCount === 3
    && hermesInspector.privateEvidenceRawIdentityExposed === false
    && hermesInspector.exactSavedShareVerdict === "MISSING_EVIDENCE"
    && hermesInspector.llmWikiPublication === "APPROVAL_GATED"
    && hermesInspector.supabaseRlsLaunchIsolation === "APPROVAL_GATED"
    && hermesInspector.providerDispatchPersistence === "APPROVAL_GATED";
  const preflightReady = isRecord(preflight)
    && preflight.overall === "approval_ready_open"
    && preflight.launchReadiness === false
    && preflight.dbMutationPerformed === false
    && preflight.networkOpened === false
    && Array.isArray(preflight.failedCheckIds)
    && preflight.failedCheckIds.length === 0
    && requiredWikiChecks.every((id) => passedCheckIds.has(id))
    && publicationSurfaceInventoryPass
    && hermesUiPass
    && hermesInspectorPass
    && preflightCurrent;
  if (redApproval && unavailable && preflightReady) {
    return gateResult({
      id: "llm_wiki_publication",
      label: "LLM Wiki publication",
      state: "approval_gated",
      evidencePath: preflightPath,
      detail: `Candidate/wiki surfaces exist, but publication RPC/RLS/ledger approval is not complete. Current preflight passed at source SHA ${preflightSourceSha || "not-recorded"}; Hermes selected-only reviewer workbench is live 8/8 with candidates/selected/body 3/1/1 and desktop/mobile columns 2/1, while the evidence inspector is live 8/8 with item budget/fixture 20/5, desktop evidence columns 2, mobile mounted panes 1, official HTTPS links 3, and private raw identity exposed=false. Exact saved Share remains MISSING_EVIDENCE; Wiki/RLS/provider persistence remain APPROVAL_GATED.`,
      nextActions: [
        "Approve final DDL, append-only ledger, graph pointer, and RPC threat model.",
        "Run approved publication canary in an isolated project.",
        "Keep generated wiki candidates unpublished until human confirmation and RPC evidence exist.",
      ],
    });
  }

  return gateResult({
    id: "llm_wiki_publication",
    label: "LLM Wiki publication",
    state: "contradicted",
    evidencePath: isRecord(preflight) ? preflightPath : evidencePath,
    detail: redApproval && unavailable
      ? (preflightCurrent
        ? "LLM Wiki approval preflight is missing or failed even though the base report remains approval-required."
        : `LLM Wiki approval preflight source SHA ${preflightSourceSha} is not an ancestor of current HEAD.`)
      : "LLM Wiki report no longer clearly states the approval-required publication boundary.",
    nextActions: ["Re-run the RLS/LLM Wiki approval preflight and re-audit publication evidence before making any North Star completion claim."],
  });
}

/**
 * @param {string} rootDir
 * @returns {GateResult}
 */
function evaluateSifEmbeddingGate(rootDir) {
  const evidencePath = EVIDENCE_PATHS.sifEmbeddingPreflight;
  const report = readJsonFile(rootDir, evidencePath);
  if (!isRecord(report)) {
    return gateResult({
      id: "sif_embedding_runtime",
      label: "SIF embedding runtime",
      state: "missing",
      evidencePath,
      detail: "SIF embedding preflight report is missing or invalid.",
      nextActions: ["Run `npm.cmd run knowledge:sif-embedding-preflight` before embedding approval decisions."],
    });
  }

  const ok = report.ok === true;
  const approvalHeld = report.approvalHeld === true;
  const dbMutationPerformed = report.dbMutationPerformed === true;
  const embeddingGenerated = report.embeddingGenerated === true;
  const uploaded = report.uploaded === true;
  const corpusCount = typeof report.corpusCount === "number" ? report.corpusCount : null;
  const corpusInspection = isRecord(report.corpusInspection) ? report.corpusInspection : null;
  const corpusInspectionPass = corpusInspection !== null
    && corpusInspection.lineCount === 6032
    && corpusInspection.parsedRecordCount === 6032
    && corpusInspection.parseErrorCount === 0
    && corpusInspection.invalidRecordCount === 0
    && corpusInspection.duplicateReferenceItemIdCount === 0
    && corpusInspection.duplicateContentHashCount === 0
    && corpusInspection.manifestBatchFailureCount === 0
    && typeof corpusInspection.computedCorpusHash === "string"
    && corpusInspection.computedCorpusHash === report.corpusHash;
  const failedCheckIds = Array.isArray(report.failedCheckIds) ? report.failedCheckIds : null;
  const sourceSha = readString(report.sourceSha);
  const sourceShaCurrent = isGitAncestor(rootDir, sourceSha);

  if (
    ok
    && approvalHeld
    && !dbMutationPerformed
    && !embeddingGenerated
    && !uploaded
    && corpusCount === 6032
    && corpusInspectionPass
    && failedCheckIds?.length === 0
    && sourceShaCurrent
  ) {
    return gateResult({
      id: "sif_embedding_runtime",
      label: "SIF embedding runtime",
      state: "approval_gated",
      evidencePath,
      detail: `SIF corpus is ready for approval (${corpusCount} records; parsed ${corpusInspection.parsedRecordCount}; invalid/duplicate/manifest failures 0), but embedding/upload/vector runtime is held. Source SHA: ${sourceSha || "not-recorded"}.`,
      nextActions: [
        "Approve SIF-only migration, embedding cost, upload, and vector runtime separately.",
        "Do not claim vector retrieval is production-active before post-migration verification.",
      ],
    });
  }

  return gateResult({
    id: "sif_embedding_runtime",
    label: "SIF embedding runtime",
    state: "contradicted",
    evidencePath,
    detail: sourceShaCurrent
      ? "SIF embedding preflight does not preserve the 6,032-record integrity contract and no-mutation approval hold."
      : `SIF embedding preflight source SHA ${sourceSha} is not an ancestor of current HEAD.`,
    nextActions: ["Re-run SIF embedding preflight and inspect mutation/upload flags."],
  });
}

/**
 * @param {unknown} value
 * @returns {string[]}
 */
function readStringArray(value) {
  return Array.isArray(value)
    ? value.filter((item) => typeof item === "string")
    : [];
}

/**
 * @param {unknown} value
 */
function readNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * @param {Record<string, unknown>} record
 * @param {string[]} keys
 */
function readFirstNumber(record, keys) {
  for (const key of keys) {
    const value = readNumber(record[key]);
    if (value !== null) return value;
  }
  return null;
}

/**
 * @param {unknown} value
 */
function readBoolean(value) {
  return typeof value === "boolean" ? value : null;
}

/**
 * @param {unknown} report
 */
function allChecksPassed(report) {
  if (!isRecord(report)) return false;
  const checks = Array.isArray(report.checks) ? report.checks : [];
  return checks.length > 0 && checks.every((check) => (
    isRecord(check) && (check.result === "PASS" || check.status === "PASS")
  ));
}

/**
 * @param {string} rootDir
 * @returns {GateResult}
 */
function evaluateUiDocumentsShareCockpitGate(rootDir) {
  const internalPanePath = EVIDENCE_PATHS.documentsMobileInternalPane;
  const paneContextPath = EVIDENCE_PATHS.documentsMobilePaneContext;
  const drilldownPath = EVIDENCE_PATHS.documentsDrilldownDepth;
  const innerPaneDepthPath = EVIDENCE_PATHS.documentsInnerPaneDepth;
  const fieldFirstPath = EVIDENCE_PATHS.documentsFieldFirstAffordance;
  const riskRowCockpitPath = EVIDENCE_PATHS.documentsRiskRowCockpit;
  const tbmCockpitPath = EVIDENCE_PATHS.documentsTbmCockpit;
  const firstViewSplitPath = EVIDENCE_PATHS.documentsFirstViewSplit;
  const educationCockpitPath = EVIDENCE_PATHS.documentsEducationCockpit;
  const emergencyCockpitPath = EVIDENCE_PATHS.documentsEmergencyCockpit;
  const completeCockpitsPath = EVIDENCE_PATHS.documentsCompleteCockpits;
  const completeCockpitsLivePath = EVIDENCE_PATHS.documentsCompleteCockpitsLive;
  const documentsMobileExactCockpitPath = EVIDENCE_PATHS.documentsMobileExactCockpit;
  const documentsSelectedEditorCockpitPath = EVIDENCE_PATHS.documentsSelectedEditorCockpit;
  const documentsCockpitWorkbenchGeometryPath = EVIDENCE_PATHS.documentsCockpitWorkbenchGeometry;
  const liveCurrentDocumentsShareGeometryPath = EVIDENCE_PATHS.liveCurrentDocumentsShareGeometry;
  const documentsMobileReviewLaunchPath = EVIDENCE_PATHS.documentsMobileReviewLaunch;
  const documentsTouchTargetsPath = EVIDENCE_PATHS.documentsTouchTargets;
  const documentSectionNavigationPath = EVIDENCE_PATHS.documentSectionNavigation;
  const documentAllAuthoringGeometryPath = EVIDENCE_PATHS.documentAllAuthoringGeometry;
  const documentAuthoringPaneMarginPath = EVIDENCE_PATHS.documentAuthoringPaneMargin;
  const documentRawDrilldownGeometryPath = EVIDENCE_PATHS.documentRawDrilldownGeometry;
  const documentRiskRowNavigationPath = EVIDENCE_PATHS.documentRiskRowNavigation;
  const documentRiskRowMobileOrderPath = EVIDENCE_PATHS.documentRiskRowMobileOrder;
  const documentRiskRowMobileLabelPath = EVIDENCE_PATHS.documentRiskRowMobileLabel;
  const documentRiskRowMobileDensityPath = EVIDENCE_PATHS.documentRiskRowMobileDensity;
  const documentRiskRowAddTouchPath = EVIDENCE_PATHS.documentRiskRowAddTouch;
  const documentRiskRowAddTouchMetricsPath = EVIDENCE_PATHS.documentRiskRowAddTouchMetrics;
  const shareDesktopPath = EVIDENCE_PATHS.shareDesktopComposition;
  const shareDesktopShortPath = EVIDENCE_PATHS.shareDesktopShortCockpit;
  const shareDesktopPerceptionPath = EVIDENCE_PATHS.shareDesktopPerception;
  const shareChannelLabelPolishPath = EVIDENCE_PATHS.shareChannelLabelPolish;
  const sharePath = EVIDENCE_PATHS.shareMobileFullFlow;
  const shareStageRailPath = EVIDENCE_PATHS.shareStagedFlowRail;
  const shareMobileStageRailCollapsePath = EVIDENCE_PATHS.shareMobileStageRailCollapse;
  const shareMobileExactViewportPath = EVIDENCE_PATHS.shareMobileExactViewport;
  const shareRecipientCockpitPath = EVIDENCE_PATHS.shareRecipientCockpit;
  const workspaceIaLiveRefinementPath = EVIDENCE_PATHS.workspaceIaLiveRefinement;
  const workspaceEditorDetailLandingPath = EVIDENCE_PATHS.workspaceEditorDetailLanding;
  const workspaceIaLiveCurrentPath = EVIDENCE_PATHS.workspaceIaLiveCurrent;
  const internalPane = readJsonFile(rootDir, internalPanePath);
  const paneContext = readJsonFile(rootDir, paneContextPath);
  const drilldown = readJsonFile(rootDir, drilldownPath);
  const innerPaneDepth = readJsonFile(rootDir, innerPaneDepthPath);
  const fieldFirst = readJsonFile(rootDir, fieldFirstPath);
  const riskRowCockpit = readJsonFile(rootDir, riskRowCockpitPath);
  const tbmCockpit = readJsonFile(rootDir, tbmCockpitPath);
  const firstViewSplit = readJsonFile(rootDir, firstViewSplitPath);
  const educationCockpit = readJsonFile(rootDir, educationCockpitPath);
  const emergencyCockpit = readJsonFile(rootDir, emergencyCockpitPath);
  const completeCockpits = readJsonFile(rootDir, completeCockpitsPath);
  const completeCockpitsLive = readJsonFile(rootDir, completeCockpitsLivePath);
  const documentsMobileExactCockpit = readJsonFile(rootDir, documentsMobileExactCockpitPath);
  const documentsSelectedEditorCockpit = readJsonFile(rootDir, documentsSelectedEditorCockpitPath);
  const documentsCockpitWorkbenchGeometry = readJsonFile(rootDir, documentsCockpitWorkbenchGeometryPath);
  const liveCurrentDocumentsShareGeometry = readJsonFile(rootDir, liveCurrentDocumentsShareGeometryPath);
  const documentsMobileReviewLaunch = readJsonFile(rootDir, documentsMobileReviewLaunchPath);
  const documentsTouchTargets = readJsonFile(rootDir, documentsTouchTargetsPath);
  const documentSectionNavigation = readJsonFile(rootDir, documentSectionNavigationPath);
  const documentAllAuthoringGeometry = readJsonFile(rootDir, documentAllAuthoringGeometryPath);
  const documentAuthoringPaneMargin = readJsonFile(rootDir, documentAuthoringPaneMarginPath);
  const documentRawDrilldownGeometry = readJsonFile(rootDir, documentRawDrilldownGeometryPath);
  const documentRiskRowNavigation = readJsonFile(rootDir, documentRiskRowNavigationPath);
  const documentRiskRowMobileOrder = readJsonFile(rootDir, documentRiskRowMobileOrderPath);
  const documentRiskRowMobileLabel = readJsonFile(rootDir, documentRiskRowMobileLabelPath);
  const documentRiskRowMobileDensity = readJsonFile(rootDir, documentRiskRowMobileDensityPath);
  const documentRiskRowAddTouch = readJsonFile(rootDir, documentRiskRowAddTouchPath);
  const documentRiskRowAddTouchMetrics = readJsonFile(rootDir, documentRiskRowAddTouchMetricsPath);
  const shareDesktop = readJsonFile(rootDir, shareDesktopPath);
  const shareDesktopShort = readJsonFile(rootDir, shareDesktopShortPath);
  const shareDesktopPerception = readJsonFile(rootDir, shareDesktopPerceptionPath);
  const shareChannelLabelPolish = readJsonFile(rootDir, shareChannelLabelPolishPath);
  const share = readJsonFile(rootDir, sharePath);
  const shareStageRail = readJsonFile(rootDir, shareStageRailPath);
  const shareMobileStageRailCollapse = readJsonFile(rootDir, shareMobileStageRailCollapsePath);
  const shareMobileExactViewport = readJsonFile(rootDir, shareMobileExactViewportPath);
  const shareRecipientCockpit = readJsonFile(rootDir, shareRecipientCockpitPath);
  const workspaceIaLiveRefinement = readJsonFile(rootDir, workspaceIaLiveRefinementPath);
  const workspaceEditorDetailLanding = readJsonFile(rootDir, workspaceEditorDetailLandingPath);
  const workspaceIaCurrentReport = readJsonFile(rootDir, workspaceIaLiveCurrentPath);

  if (!isRecord(documentAuthoringPaneMargin)) {
    return gateResult({
      id: "ui_documents_share_cockpit",
      label: "Documents and Share cockpit UI",
      state: "missing",
      evidencePath: documentAuthoringPaneMarginPath,
      detail: "The live document authoring pane-margin companion evidence is missing or invalid.",
      nextActions: ["Regenerate the 12-document Day/Night desktop-short/mobile-short pane-margin evidence before promoting the cockpit gate."],
    });
  }

  if (!isRecord(shareChannelLabelPolish)) {
    return gateResult({
      id: "ui_documents_share_cockpit",
      label: "Documents and Share cockpit UI",
      state: "missing",
      evidencePath: shareChannelLabelPolishPath,
      detail: "The live Workspace Share channel-label companion evidence is missing or invalid.",
      nextActions: ["Regenerate the live 1440x723 and 390x723 Workspace Share channel-label evidence without claiming exact saved Share."],
    });
  }

  if (!isRecord(documentRiskRowMobileDensity)) {
    return gateResult({
      id: "ui_documents_share_cockpit",
      label: "Documents and Share cockpit UI",
      state: "missing",
      evidencePath: documentRiskRowMobileDensityPath,
      detail: "The live five-row mobile risk-row density companion evidence is missing or invalid.",
      nextActions: ["Regenerate the live 390x723 Day/Night five-row selector evidence without widening the whole-Documents claim."],
    });
  }

  if (!isRecord(documentRiskRowAddTouch) || !isRecord(documentRiskRowAddTouchMetrics)) {
    return gateResult({
      id: "ui_documents_share_cockpit",
      label: "Documents and Share cockpit UI",
      state: "missing",
      evidencePath: !isRecord(documentRiskRowAddTouch) ? documentRiskRowAddTouchPath : documentRiskRowAddTouchMetricsPath,
      detail: "The live mobile add-risk-row touch-target companion evidence is missing or invalid.",
      nextActions: ["Regenerate the live 390x723 Day/Night add-risk-row touch evidence without widening the whole-Documents claim."],
    });
  }

  if (!isRecord(internalPane) || !isRecord(paneContext) || !isRecord(drilldown) || !isRecord(innerPaneDepth) || !isRecord(fieldFirst) || !isRecord(riskRowCockpit) || !isRecord(tbmCockpit) || !isRecord(firstViewSplit) || !isRecord(educationCockpit) || !isRecord(emergencyCockpit) || !isRecord(completeCockpits) || !isRecord(completeCockpitsLive) || !isRecord(documentsMobileExactCockpit) || !isRecord(documentsSelectedEditorCockpit) || !isRecord(documentsCockpitWorkbenchGeometry) || !isRecord(liveCurrentDocumentsShareGeometry) || !isRecord(documentsMobileReviewLaunch) || !isRecord(documentsTouchTargets) || !isRecord(documentSectionNavigation) || !isRecord(documentAllAuthoringGeometry) || !isRecord(documentRawDrilldownGeometry) || !isRecord(documentRiskRowNavigation) || !isRecord(documentRiskRowMobileOrder) || !isRecord(documentRiskRowMobileLabel) || !isRecord(shareDesktop) || !isRecord(shareDesktopShort) || !isRecord(shareDesktopPerception) || !isRecord(share) || !isRecord(shareStageRail) || !isRecord(shareMobileStageRailCollapse) || !isRecord(shareMobileExactViewport) || !isRecord(shareRecipientCockpit) || !isRecord(workspaceIaLiveRefinement) || !isRecord(workspaceEditorDetailLanding) || !isRecord(workspaceIaCurrentReport)) {
    return gateResult({
      id: "ui_documents_share_cockpit",
      label: "Documents and Share cockpit UI",
      state: "missing",
      evidencePath: !isRecord(internalPane) ? internalPanePath : !isRecord(paneContext) ? paneContextPath : !isRecord(drilldown) ? drilldownPath : !isRecord(innerPaneDepth) ? innerPaneDepthPath : !isRecord(fieldFirst) ? fieldFirstPath : !isRecord(riskRowCockpit) ? riskRowCockpitPath : !isRecord(tbmCockpit) ? tbmCockpitPath : !isRecord(firstViewSplit) ? firstViewSplitPath : !isRecord(educationCockpit) ? educationCockpitPath : !isRecord(emergencyCockpit) ? emergencyCockpitPath : !isRecord(completeCockpits) ? completeCockpitsPath : !isRecord(completeCockpitsLive) ? completeCockpitsLivePath : !isRecord(documentsMobileExactCockpit) ? documentsMobileExactCockpitPath : !isRecord(documentsSelectedEditorCockpit) ? documentsSelectedEditorCockpitPath : !isRecord(documentsCockpitWorkbenchGeometry) ? documentsCockpitWorkbenchGeometryPath : !isRecord(liveCurrentDocumentsShareGeometry) ? liveCurrentDocumentsShareGeometryPath : !isRecord(documentsMobileReviewLaunch) ? documentsMobileReviewLaunchPath : !isRecord(documentsTouchTargets) ? documentsTouchTargetsPath : !isRecord(documentSectionNavigation) ? documentSectionNavigationPath : !isRecord(documentAllAuthoringGeometry) ? documentAllAuthoringGeometryPath : !isRecord(documentRawDrilldownGeometry) ? documentRawDrilldownGeometryPath : !isRecord(documentRiskRowNavigation) ? documentRiskRowNavigationPath : !isRecord(documentRiskRowMobileOrder) ? documentRiskRowMobileOrderPath : !isRecord(documentRiskRowMobileLabel) ? documentRiskRowMobileLabelPath : !isRecord(shareDesktop) ? shareDesktopPath : !isRecord(shareDesktopShort) ? shareDesktopShortPath : !isRecord(shareDesktopPerception) ? shareDesktopPerceptionPath : !isRecord(share) ? sharePath : !isRecord(shareStageRail) ? shareStageRailPath : !isRecord(shareMobileStageRailCollapse) ? shareMobileStageRailCollapsePath : !isRecord(shareMobileExactViewport) ? shareMobileExactViewportPath : !isRecord(shareRecipientCockpit) ? shareRecipientCockpitPath : !isRecord(workspaceIaLiveRefinement) ? workspaceIaLiveRefinementPath : !isRecord(workspaceEditorDetailLanding) ? workspaceEditorDetailLandingPath : workspaceIaLiveCurrentPath,
      detail: "Documents/share cockpit evidence is missing or invalid.",
      nextActions: ["Regenerate documents mobile internal-pane, pane-context, drilldown-depth, inner-pane-depth, field-first-affordance, risk-row/TBM/first-view/education/emergency/complete cockpit, live complete cockpit, live exact Documents cockpit, selected editor CTA cockpit, share desktop/mobile, desktop-short Share, share staged-flow, live mobile share boundary, exact viewport evidence, share recipient cockpit evidence, latest workspace IA refinement evidence, workspace editor detail landing evidence, and the current live workspace IA split evidence."],
    });
  }

  const internalPaneGeometry = isRecord(internalPane.currentSourceGeometry)
    ? internalPane.currentSourceGeometry
    : isRecord(internalPane.productionGeometry)
      ? internalPane.productionGeometry
      : {};
  const contextAssertions = isRecord(paneContext.assertions) ? paneContext.assertions : {};
  const drilldownAssertions = isRecord(drilldown.assertions) ? drilldown.assertions : {};
  const innerPaneAssertions = isRecord(innerPaneDepth.assertions) ? innerPaneDepth.assertions : {};
  const innerPaneProduction = isRecord(innerPaneDepth.productionConfirmation) ? innerPaneDepth.productionConfirmation : {};
  const innerPaneMobile = isRecord(innerPaneProduction.mobile390x844) ? innerPaneProduction.mobile390x844 : {};
  const fieldFirstAssertions = isRecord(fieldFirst.assertions) ? fieldFirst.assertions : {};
  const fieldFirstProduction = isRecord(fieldFirst.production) ? fieldFirst.production : {};
  const fieldFirstMobile = isRecord(fieldFirstProduction.mobile390x844) ? fieldFirstProduction.mobile390x844 : {};
  const fieldFirstDesktop = isRecord(fieldFirstProduction.desktop1440x723) ? fieldFirstProduction.desktop1440x723 : {};
  const riskRowScope = isRecord(riskRowCockpit.scope) ? riskRowCockpit.scope : {};
  const riskRowContracts = isRecord(riskRowCockpit.contracts) ? riskRowCockpit.contracts : {};
  const riskRowCommands = Array.isArray(riskRowCockpit.commands) ? riskRowCockpit.commands : [];
  const tbmScope = isRecord(tbmCockpit.scope) ? tbmCockpit.scope : {};
  const tbmContracts = isRecord(tbmCockpit.contracts) ? tbmCockpit.contracts : {};
  const tbmVerification = Array.isArray(tbmCockpit.verification) ? tbmCockpit.verification : [];
  const tbmSource = isRecord(tbmCockpit.source) ? tbmCockpit.source : {};
  const firstViewScope = isRecord(firstViewSplit.scope) ? firstViewSplit.scope : {};
  const firstViewContracts = isRecord(firstViewSplit.contracts) ? firstViewSplit.contracts : {};
  const firstViewVerification = Array.isArray(firstViewSplit.verification) ? firstViewSplit.verification : [];
  const firstViewSource = isRecord(firstViewSplit.source) ? firstViewSplit.source : {};
  const educationScope = isRecord(educationCockpit.scope) ? educationCockpit.scope : {};
  const educationContracts = isRecord(educationCockpit.contracts) ? educationCockpit.contracts : {};
  const educationVerification = Array.isArray(educationCockpit.verification) ? educationCockpit.verification : [];
  const educationSource = isRecord(educationCockpit.source) ? educationCockpit.source : {};
  const emergencyScope = isRecord(emergencyCockpit.scope) ? emergencyCockpit.scope : {};
  const emergencyContracts = isRecord(emergencyCockpit.contracts) ? emergencyCockpit.contracts : {};
  const emergencyVerification = Array.isArray(emergencyCockpit.verification) ? emergencyCockpit.verification : [];
  const emergencySource = isRecord(emergencyCockpit.source) ? emergencyCockpit.source : {};
  const completeCockpitsScope = isRecord(completeCockpits.scope) ? completeCockpits.scope : {};
  const completeCockpitsContracts = isRecord(completeCockpits.contracts) ? completeCockpits.contracts : {};
  const completeCockpitsVerification = Array.isArray(completeCockpits.verification) ? completeCockpits.verification : [];
  const completeCockpitsSource = isRecord(completeCockpits.source) ? completeCockpits.source : {};
  const completeCockpitKeys = Array.isArray(completeCockpits.coveredDocumentKeys) ? completeCockpits.coveredDocumentKeys : [];
  const completeCockpitsLiveScope = isRecord(completeCockpitsLive.scope) ? completeCockpitsLive.scope : {};
  const completeCockpitsLiveBuild = isRecord(completeCockpitsLive.buildInfo) ? completeCockpitsLive.buildInfo : {};
  const completeCockpitsLiveAssertions = isRecord(completeCockpitsLive.assertions) ? completeCockpitsLive.assertions : {};
  const completeCockpitsLiveMobile = Array.isArray(completeCockpitsLive.mobile390x844) ? completeCockpitsLive.mobile390x844 : [];
  const completeCockpitsLiveDesktop = Array.isArray(completeCockpitsLive.desktop1440x723) ? completeCockpitsLive.desktop1440x723 : [];
  const documentsExactMobile = isRecord(documentsMobileExactCockpit.mobile390Day)
    ? documentsMobileExactCockpit.mobile390Day
    : {};
  const documentsExactLive = isRecord(documentsExactMobile.liveProduction)
    ? documentsExactMobile.liveProduction
    : isRecord(documentsExactMobile.currentLive)
      ? documentsExactMobile.currentLive
    : {};
  const documentsExactBuild = isRecord(documentsMobileExactCockpit.liveBuildInfo)
    ? documentsMobileExactCockpit.liveBuildInfo
    : {};
  const selectedEditorScope = isRecord(documentsSelectedEditorCockpit.scope)
    ? documentsSelectedEditorCockpit.scope
    : {};
  const selectedEditorLive = isRecord(documentsSelectedEditorCockpit.liveProduction)
    ? documentsSelectedEditorCockpit.liveProduction
    : {};
  const selectedEditorBuild = isRecord(selectedEditorLive.buildInfo)
    ? selectedEditorLive.buildInfo
    : {};
  const selectedEditorDesktopShort = isRecord(selectedEditorLive.desktopShort1440x723)
    ? selectedEditorLive.desktopShort1440x723
    : {};
  const selectedEditorDesktopShortActions = isRecord(selectedEditorDesktopShort.sectionActions)
    ? selectedEditorDesktopShort.sectionActions
    : {};
  const selectedEditorDesktopShortTextarea = isRecord(selectedEditorDesktopShort.rawTextarea)
    ? selectedEditorDesktopShort.rawTextarea
    : {};
  const selectedEditorMobile = isRecord(selectedEditorLive.mobile390x844)
    ? selectedEditorLive.mobile390x844
    : {};
  const selectedEditorMobileActions = isRecord(selectedEditorMobile.sectionActions)
    ? selectedEditorMobile.sectionActions
    : {};
  const documentsWorkbenchRows = isRecord(documentsCockpitWorkbenchGeometry) && Array.isArray(documentsCockpitWorkbenchGeometry.rows)
    ? documentsCockpitWorkbenchGeometry.rows.filter(isRecord)
    : [];
  const documentsCockpitWorkbenchGeometryPass = isRecord(documentsCockpitWorkbenchGeometry)
    && (
      readString(documentsCockpitWorkbenchGeometry.verdict) === "PASS_LIVE_PRODUCTION_DOCUMENTS_WORKBENCH"
      && documentsWorkbenchRows.length >= 2
      && documentsWorkbenchRows.every((row) => {
        const metrics = isRecord(row.metrics) ? row.metrics : {};
        const verdicts = isRecord(row.verdicts) ? row.verdicts : {};
        const viewportWidth = readNumber(metrics.viewportWidth);
        const columns = readNumber(metrics.workbenchColumnCount);
        return readString(verdicts.overallVerdict) === "PASS"
          && readString(metrics.workbenchDisplay) === "grid"
          && readBoolean(metrics.horizontalOverflow) === false
          && readNumber(metrics.coreButtons) === 3
          && readNumber(metrics.uniqueDocumentKeyCount) === 12
          && readNumber(metrics.visibleDocumentButtonCount) === 3
          && readNumber(metrics.supportingButtonCount) === 9
          && readNumber(metrics.visibleSupportingButtonCount) === 0
          && readString(metrics.legacyIndexDisplay) === "none"
          && readBoolean(metrics.detailsOpen) === false
          && (viewportWidth >= 900 ? columns >= 2 : columns === 1);
      })
    );
  const currentGeometryBuild = isRecord(liveCurrentDocumentsShareGeometry.productionBuild)
    ? liveCurrentDocumentsShareGeometry.productionBuild
    : {};
  const currentGeometryDocuments = isRecord(liveCurrentDocumentsShareGeometry.documents)
    ? liveCurrentDocumentsShareGeometry.documents
    : {};
  const currentGeometryDesktopDocuments = isRecord(currentGeometryDocuments.desktop1440x723)
    ? currentGeometryDocuments.desktop1440x723
    : {};
  const currentGeometryMobileDocuments = isRecord(currentGeometryDocuments.mobile390x723)
    ? currentGeometryDocuments.mobile390x723
    : {};
  const currentGeometryAfterLive = isRecord(currentGeometryDocuments.afterLiveRemediation)
    ? currentGeometryDocuments.afterLiveRemediation
    : {};
  const currentGeometryWorkspaceShare = isRecord(liveCurrentDocumentsShareGeometry.workspaceShare)
    ? liveCurrentDocumentsShareGeometry.workspaceShare
    : {};
  const currentGeometryDesktopShare = isRecord(currentGeometryWorkspaceShare.desktop1440x723)
    ? currentGeometryWorkspaceShare.desktop1440x723
    : {};
  const currentGeometryDesktopShareRoot = isRecord(currentGeometryDesktopShare.root)
    ? currentGeometryDesktopShare.root
    : {};
  const currentGeometryMobileShare = isRecord(currentGeometryWorkspaceShare.mobile390x723)
    ? currentGeometryWorkspaceShare.mobile390x723
    : {};
  const currentGeometryMobileShareRoot = isRecord(currentGeometryMobileShare.root)
    ? currentGeometryMobileShare.root
    : {};
  const currentGeometryBoundaries = isRecord(liveCurrentDocumentsShareGeometry.boundaries)
    ? liveCurrentDocumentsShareGeometry.boundaries
    : {};
  const liveCurrentDocumentsShareGeometryPass = readString(liveCurrentDocumentsShareGeometry.verdict) === "PASS_LIVE_PRODUCTION_CURRENT_DOCUMENTS_AND_SCOPED_WORKSPACE_SHARE_GEOMETRY"
    && readString(liveCurrentDocumentsShareGeometry.productCommit) === readString(currentGeometryBuild.commitSha)
    && readString(currentGeometryBuild.branch) === "master"
    && readString(currentGeometryBuild.environment) === "production"
    && readString(currentGeometryAfterLive.productCommit) === readString(currentGeometryBuild.commitSha)
    && readString(currentGeometryAfterLive.productionCommit) === readString(currentGeometryBuild.commitSha)
    && readString(currentGeometryAfterLive.viewport) === "390x723"
    && readNumber(currentGeometryDesktopDocuments.documentHeight) === 723
    && readNumber(currentGeometryDesktopDocuments.bodyHeight) === 723
    && readBoolean(currentGeometryDesktopDocuments.horizontalOverflow) === false
    && readNumber(currentGeometryMobileDocuments.documentHeight) === 723
    && readNumber(currentGeometryMobileDocuments.bodyHeight) === 723
    && readBoolean(currentGeometryMobileDocuments.horizontalOverflow) === false
    && readNumber(currentGeometryAfterLive.workpackShellClientWidth) === readNumber(currentGeometryAfterLive.workpackShellScrollWidth)
    && readNumber(currentGeometryAfterLive.riskRowClientWidth) === readNumber(currentGeometryAfterLive.riskRowScrollWidth)
    && readBoolean(currentGeometryAfterLive.horizontalOverflow) === false
    && readBoolean(currentGeometryAfterLive.visualHorizontalScrollbarPresent) === false
    && Array.isArray(currentGeometryDesktopShareRoot.columns)
    && currentGeometryDesktopShareRoot.columns.length === 3
    && readNumber(currentGeometryDesktopShare.pageHeight) === 723
    && readNumber(currentGeometryDesktopShare.horizontalOverflow) === 0
    && readNumber(currentGeometryDesktopShare.visiblePhoneShellCount) === 0
    && Array.isArray(currentGeometryMobileShareRoot.columns)
    && currentGeometryMobileShareRoot.columns.length === 1
    && readNumber(currentGeometryMobileShare.pageHeight) === 723
    && readNumber(currentGeometryMobileShare.horizontalOverflow) === 0
    && readString(currentGeometryMobileShare.desktopStatusRailDisplay) === "none"
    && readBoolean(currentGeometryBoundaries.routeSplitAloneAcceptedAsFix) === false
    && readBoolean(currentGeometryBoundaries.exactSavedUserSessionReproduced) === false
    && readString(currentGeometryBoundaries.exactSavedSessionVerdict) === "MISSING_EVIDENCE"
    && readBoolean(currentGeometryBoundaries.invitedFixtureAcceptedAsExactSavedSessionProof) === false
    && readBoolean(currentGeometryBoundaries.dbMutationPerformed) === false
    && readBoolean(currentGeometryBoundaries.shareSessionCreated) === false
    && readBoolean(currentGeometryBoundaries.providerDispatchCalled) === false;
  const reviewLaunchBoundary = isRecord(documentsMobileReviewLaunch.boundaries)
    ? documentsMobileReviewLaunch.boundaries
    : {};
  const reviewLaunchRows = Array.isArray(documentsMobileReviewLaunch.afterLive)
    ? documentsMobileReviewLaunch.afterLive.filter(isRecord)
    : [];
  const documentsMobileReviewLaunchPass = readString(documentsMobileReviewLaunch.verdict) === "PASS_LIVE_PRODUCTION_DOCUMENT_REVIEW_LAUNCH_CONTAINMENT"
    && readString(documentsMobileReviewLaunch.sourceHead) !== ""
    && readString(documentsMobileReviewLaunch.productionCommit) !== ""
    && reviewLaunchRows.length === 2
    && reviewLaunchRows.every((row) => {
      const viewport = isRecord(row.viewport) ? row.viewport : {};
      const viewportHeight = readNumber(viewport.height);
      return readNumber(row.bodyHeight) <= viewportHeight
        && readNumber(row.bodyRatio) <= 1.01
        && readBoolean(row.horizontalOverflow) === false
        && readNumber(row.overlapCount) === 0;
    })
    && reviewLaunchRows.some((row) => {
      const viewport = isRecord(row.viewport) ? row.viewport : {};
      const reviewLaunch = isRecord(row.reviewLaunch) ? row.reviewLaunch : {};
      const thirdCore = isRecord(row.thirdCoreDocument) ? row.thirdCoreDocument : {};
      return readNumber(viewport.width) === 390
        && readNumber(viewport.height) === 723
        && readNumber(row.coreDocumentCount) === 3
        && readNumber(reviewLaunch.height) >= 44
        && readNumber(reviewLaunch.bottom) <= 723
        && readNumber(reviewLaunch.top) >= readNumber(thirdCore.bottom);
    })
    && reviewLaunchBoundary.liveAfterDeploymentPending === false
    && reviewLaunchBoundary.dbMutationPerformed === false
    && reviewLaunchBoundary.providerDispatchCalled === false
    && reviewLaunchBoundary.shareSessionCreated === false
    && readString(reviewLaunchBoundary.exactSavedShareVerdict) === "MISSING_EVIDENCE";
  const documentsTouchTargetProduction = isRecord(documentsTouchTargets.productionBuild)
    ? documentsTouchTargets.productionBuild
    : {};
  const documentsTouchTargetBoundary = isRecord(documentsTouchTargets.mutationBoundary)
    ? documentsTouchTargets.mutationBoundary
    : {};
  const documentsTouchTargetRows = Array.isArray(documentsTouchTargets.results)
    ? documentsTouchTargets.results.filter(isRecord)
    : [];
  const documentsTouchTargetsPass = readString(documentsTouchTargets.verdict) === "PASS_LIVE_PRODUCTION_DOCUMENT_TOUCH_TARGETS"
    && readString(documentsTouchTargets.sourceHead) !== ""
    && readString(documentsTouchTargets.sourceHead) === readString(documentsTouchTargetProduction.commitSha)
    && readBoolean(documentsTouchTargets.sourceHeadMatchesProduction) === true
    && readNumber(documentsTouchTargets.total) === 4
    && readNumber(documentsTouchTargets.pass) === 4
    && readNumber(documentsTouchTargets.fail) === 0
    && documentsTouchTargetRows.length === 4
    && documentsTouchTargetRows.every((row) => {
      const cockpit = isRecord(row.cockpit) ? row.cockpit : {};
      const reviewDialog = isRecord(row.reviewDialog) ? row.reviewDialog : {};
      const actionHeights = Array.isArray(cockpit.actionHeights) ? cockpit.actionHeights : [];
      const selectorHeights = Array.isArray(cockpit.selectorHeights) ? cockpit.selectorHeights : [];
      return readString(row.verdict) === "PASS"
        && readNumber(cockpit.bodyHeight) <= readNumber(cockpit.viewportHeight) + 8
        && readBoolean(cockpit.horizontalOverflow) === false
        && readString(cockpit.shellOverflowY) === "auto"
        && readNumber(cockpit.shellRatio) <= 3
        && actionHeights.length === 2
        && actionHeights.every((height) => readNumber(height) >= 44)
        && selectorHeights.length >= 3
        && selectorHeights.every((height) => readNumber(height) >= 44)
        && readNumber(cockpit.coreButtonCount) === 3
        && readBoolean(cockpit.supportingDocumentsOpen) === false
        && readNumber(reviewDialog.closeWidth) >= 44
        && readNumber(reviewDialog.closeHeight) >= 44
        && readBoolean(reviewDialog.horizontalOverflow) === false;
    })
    && documentsTouchTargetBoundary.dbMutationPerformed === false
    && documentsTouchTargetBoundary.providerDispatchCalled === false
    && documentsTouchTargetBoundary.shareSessionCreated === false
    && readString(documentsTouchTargetBoundary.exactSavedShareVerdict) === "MISSING_EVIDENCE";
  const sectionNavigationProduction = isRecord(documentSectionNavigation.productionBuild)
    ? documentSectionNavigation.productionBuild
    : {};
  const sectionNavigationBoundary = isRecord(documentSectionNavigation.mutationBoundary)
    ? documentSectionNavigation.mutationBoundary
    : {};
  const sectionNavigationRows = Array.isArray(documentSectionNavigation.results)
    ? documentSectionNavigation.results.filter(isRecord)
    : [];
  const documentSectionNavigationPass = readString(documentSectionNavigation.verdict) === "PASS_LIVE_PRODUCTION_DOCUMENT_SECTION_NAVIGATION"
    && readString(documentSectionNavigation.sourceHead) !== ""
    && readString(documentSectionNavigation.sourceHead) === readString(sectionNavigationProduction.commitSha)
    && readNumber(documentSectionNavigation.total) === 4
    && readNumber(documentSectionNavigation.pass) === 4
    && readNumber(documentSectionNavigation.fail) === 0
    && sectionNavigationRows.length === 4
    && sectionNavigationRows.every((row) => {
      const metrics = isRecord(row.metrics) ? row.metrics : {};
      const labels = Array.isArray(metrics.sectionTabLabels) ? metrics.sectionTabLabels : [];
      const whiteSpace = Array.isArray(metrics.sectionLabelWhiteSpace) ? metrics.sectionLabelWhiteSpace : [];
      const lineClamp = Array.isArray(metrics.sectionLabelLineClamp) ? metrics.sectionLabelLineClamp : [];
      const viewportHeight = readNumber(metrics.viewportHeight);
      const bodyHeight = readNumber(metrics.bodyHeight);
      const shellRatio = readNumber(metrics.shellRatio);
      const actionBottom = readNumber(metrics.actionBottom);
      const minimumSectionTabHeight = readNumber(metrics.minimumSectionTabHeight);
      return readString(row.verdict) === "PASS"
        && viewportHeight !== null
        && bodyHeight !== null
        && shellRatio !== null
        && actionBottom !== null
        && minimumSectionTabHeight !== null
        && bodyHeight <= viewportHeight + 8
        && shellRatio <= 3
        && actionBottom <= viewportHeight
        && readBoolean(metrics.horizontalOverflow) === false
        && readNumber(metrics.sectionTabCount) === 6
        && readNumber(metrics.selectedSectionTabCount) === 1
        && readNumber(metrics.filledSectionTabCount) === 6
        && readNumber(metrics.emptySectionTabCount) === 0
        && minimumSectionTabHeight >= 44
        && labels.length === 6
        && labels.every((label) => typeof label === "string" && label.includes("작성됨"))
        && whiteSpace.length === 6
        && whiteSpace.every((value) => value === "normal")
        && lineClamp.length === 6
        && lineClamp.every((value) => value === "2")
        && readString(metrics.selectedBackground) !== readString(metrics.unselectedBackground)
        && readString(metrics.selectedBoxShadow) !== "none";
    })
    && readBoolean(sectionNavigationBoundary.dbMutationPerformed) === false
    && readBoolean(sectionNavigationBoundary.providerDispatchCalled) === false
    && readBoolean(sectionNavigationBoundary.shareSessionCreated) === false
    && readString(sectionNavigationBoundary.exactSavedShareVerdict) === "MISSING_EVIDENCE";
  const allAuthoringProduction = isRecord(documentAllAuthoringGeometry.productionBuild)
    ? documentAllAuthoringGeometry.productionBuild
    : {};
  const allAuthoringBoundary = isRecord(documentAllAuthoringGeometry.mutationBoundary)
    ? documentAllAuthoringGeometry.mutationBoundary
    : {};
  const allAuthoringAcceptance = isRecord(documentAllAuthoringGeometry.acceptanceContract)
    ? documentAllAuthoringGeometry.acceptanceContract
    : {};
  const allAuthoringRows = Array.isArray(documentAllAuthoringGeometry.results)
    ? documentAllAuthoringGeometry.results.filter(isRecord)
    : [];
  const documentAllAuthoringGeometryPass = readString(documentAllAuthoringGeometry.verdict) === "PASS_LIVE_PRODUCTION_12_DOCUMENT_AUTHORING_GEOMETRY"
    && readString(documentAllAuthoringGeometry.sourceHead) !== ""
    && readString(documentAllAuthoringGeometry.sourceHead) === readString(allAuthoringProduction.commitSha)
    && readBoolean(documentAllAuthoringGeometry.sourceHeadMatchesProduction) === true
    && readNumber(documentAllAuthoringGeometry.documentCount) === 12
    && readNumber(documentAllAuthoringGeometry.viewportCaseCount) === 4
    && readNumber(documentAllAuthoringGeometry.total) === 48
    && readNumber(documentAllAuthoringGeometry.pass) === 48
    && readNumber(documentAllAuthoringGeometry.fail) === 0
    && readNumber(allAuthoringAcceptance.firstActionInsidePaneWithMinimumMargin) === 32
    && allAuthoringRows.length === 48
    && allAuthoringRows.every((row) => {
      const metrics = isRecord(row.metrics) ? row.metrics : {};
      const viewportHeight = readNumber(metrics.viewportHeight);
      const pageHeight = readNumber(metrics.pageHeight);
      const shellRatio = readNumber(metrics.shellRatio);
      const shellBottom = readNumber(metrics.shellBottom);
      const firstActionBottom = readNumber(metrics.firstActionBottom);
      const visibleCockpitCount = readNumber(metrics.visibleCockpitCount);
      const cockpitMaxHeight = readNumber(metrics.cockpitMaxHeight);
      const sectionTabCount = readNumber(metrics.sectionTabCount);
      const selectedSectionTabCount = readNumber(metrics.selectedSectionTabCount);
      const documentKey = readString(row.documentKey);
      const riskAssessment = documentKey === "riskAssessmentDraft";
      return readString(row.verdict) === "PASS"
        && viewportHeight !== null
        && pageHeight !== null
        && shellRatio !== null
        && shellBottom !== null
        && firstActionBottom !== null
        && pageHeight <= viewportHeight + 8
        && shellRatio <= 3
        && firstActionBottom <= viewportHeight
        && firstActionBottom <= shellBottom - 32
        && readBoolean(metrics.horizontalOverflow) === false
        && readNumber(metrics.sourceEditorVisibleCount) === 0
        && (riskAssessment
          ? visibleCockpitCount === 0
            && sectionTabCount === 0
            && selectedSectionTabCount === 0
          : visibleCockpitCount === 1
            && cockpitMaxHeight !== null
            && cockpitMaxHeight <= 260
            && readString(metrics.cockpitOverflowY) === "auto"
            && sectionTabCount !== null
            && sectionTabCount >= 1
            && selectedSectionTabCount === 1);
    })
    && readBoolean(allAuthoringBoundary.dbMutationPerformed) === false
    && readBoolean(allAuthoringBoundary.providerDispatchCalled) === false
    && readBoolean(allAuthoringBoundary.shareSessionCreated) === false
    && readString(allAuthoringBoundary.exactSavedShareVerdict) === "MISSING_EVIDENCE";
  const authoringPaneBeforeLive = isRecord(documentAuthoringPaneMargin.beforeLive)
    ? documentAuthoringPaneMargin.beforeLive
    : {};
  const authoringPaneAfterLive = isRecord(documentAuthoringPaneMargin.afterLive)
    ? documentAuthoringPaneMargin.afterLive
    : {};
  const authoringPaneMutationBoundary = isRecord(documentAuthoringPaneMargin.mutationBoundary)
    ? documentAuthoringPaneMargin.mutationBoundary
    : {};
  const authoringPaneRemainingBoundaries = isRecord(documentAuthoringPaneMargin.remainingBoundaries)
    ? documentAuthoringPaneMargin.remainingBoundaries
    : {};
  const documentAuthoringPaneMarginPass = readString(documentAuthoringPaneMargin.verdict) === "PASS_LIVE_PRODUCTION_DOCUMENT_ACTION_PANE_MARGIN"
    && readString(documentAuthoringPaneMargin.productCommit) !== ""
    && readString(documentAuthoringPaneMargin.productCommit) === readString(documentAuthoringPaneMargin.productionCommit)
    && readBoolean(documentAuthoringPaneMargin.sourceHeadMatchesProduction) === true
    && readNumber(authoringPaneBeforeLive.paneMarginBelow16Count) === 44
    && readNumber(authoringPaneBeforeLive.minimumPaneMargin) === -41
    && readNumber(authoringPaneAfterLive.total) === 48
    && readNumber(authoringPaneAfterLive.pass) === 48
    && readNumber(authoringPaneAfterLive.fail) === 0
    && readNumber(authoringPaneAfterLive.paneMarginBelow16Count) === 0
    && readNumber(authoringPaneAfterLive.minimumPaneMargin) >= 16
    && readNumber(authoringPaneAfterLive.maximumShellRatio) <= 3
    && readBoolean(authoringPaneMutationBoundary.dbMutationPerformed) === false
    && readBoolean(authoringPaneMutationBoundary.providerDispatchCalled) === false
    && readBoolean(authoringPaneMutationBoundary.shareSessionCreated) === false
    && readString(authoringPaneRemainingBoundaries.exactSavedShareVerdict) === "MISSING_EVIDENCE"
    && readBoolean(authoringPaneRemainingBoundaries.routeSplitAloneAcceptedAsFix) === false;
  const rawDrilldownProduction = isRecord(documentRawDrilldownGeometry.productionBuild)
    ? documentRawDrilldownGeometry.productionBuild
    : {};
  const rawDrilldownBoundary = isRecord(documentRawDrilldownGeometry.mutationBoundary)
    ? documentRawDrilldownGeometry.mutationBoundary
    : {};
  const rawDrilldownRows = Array.isArray(documentRawDrilldownGeometry.results)
    ? documentRawDrilldownGeometry.results.filter(isRecord)
    : [];
  const documentRawDrilldownGeometryPass = readString(documentRawDrilldownGeometry.verdict) === "PASS_LIVE_PRODUCTION_12_DOCUMENT_RAW_DRILLDOWN_GEOMETRY"
    && readString(documentRawDrilldownGeometry.sourceHead) !== ""
    && readString(documentRawDrilldownGeometry.sourceHead) === readString(rawDrilldownProduction.commitSha)
    && readBoolean(documentRawDrilldownGeometry.sourceHeadMatchesProduction) === true
    && readNumber(documentRawDrilldownGeometry.documentCount) === 12
    && readNumber(documentRawDrilldownGeometry.viewportCaseCount) === 4
    && readNumber(documentRawDrilldownGeometry.total) === 48
    && readNumber(documentRawDrilldownGeometry.pass) === 48
    && readNumber(documentRawDrilldownGeometry.fail) === 0
    && rawDrilldownRows.length === 48
    && rawDrilldownRows.every((row) => {
      const metrics = isRecord(row.metrics) ? row.metrics : {};
      const viewportHeight = readNumber(metrics.viewportHeight);
      const pageHeight = readNumber(metrics.pageHeight);
      const shellRatio = readNumber(metrics.shellRatio);
      const sourceTop = readNumber(metrics.sourceTop);
      const sourceBottom = readNumber(metrics.sourceBottom);
      const sourceClientHeight = readNumber(metrics.sourceClientHeight);
      const sourceScrollHeight = readNumber(metrics.sourceScrollHeight);
      const sourceOverflowY = readString(metrics.sourceOverflowY);
      return readString(row.verdict) === "PASS"
        && viewportHeight !== null
        && pageHeight !== null
        && shellRatio !== null
        && sourceTop !== null
        && sourceBottom !== null
        && sourceClientHeight !== null
        && sourceScrollHeight !== null
        && pageHeight <= viewportHeight + 8
        && shellRatio <= 3
        && sourceTop >= 0
        && sourceBottom <= viewportHeight
        && sourceClientHeight <= 320
        && readBoolean(metrics.horizontalOverflow) === false
        && readNumber(metrics.sourceEditorVisibleCount) === 1
        && readNumber(metrics.structuredEditorVisibleCount) === 0
        && readBoolean(metrics.sourceModePressed) === true
        && readNumber(metrics.selectedEditorCount) === 1
        && (sourceScrollHeight <= sourceClientHeight + 1 || sourceOverflowY === "auto");
    })
    && readBoolean(rawDrilldownBoundary.dbMutationPerformed) === false
    && readBoolean(rawDrilldownBoundary.providerDispatchCalled) === false
    && readBoolean(rawDrilldownBoundary.shareSessionCreated) === false
    && readString(rawDrilldownBoundary.exactSavedShareVerdict) === "MISSING_EVIDENCE";
  const riskNavigationProduction = isRecord(documentRiskRowNavigation.productionBuild)
    ? documentRiskRowNavigation.productionBuild
    : {};
  const riskNavigationBoundary = isRecord(documentRiskRowNavigation.mutationBoundary)
    ? documentRiskRowNavigation.mutationBoundary
    : {};
  const riskNavigationRows = Array.isArray(documentRiskRowNavigation.results)
    ? documentRiskRowNavigation.results.filter(isRecord)
    : [];
  const documentRiskRowNavigationPass = readString(documentRiskRowNavigation.verdict) === "PASS_LIVE_PRODUCTION_DOCUMENT_RISK_ROW_NAVIGATION"
    && readString(documentRiskRowNavigation.sourceHead) !== ""
    && readString(documentRiskRowNavigation.sourceHead) === readString(riskNavigationProduction.commitSha)
    && readBoolean(documentRiskRowNavigation.sourceHeadMatchesProduction) === true
    && readNumber(documentRiskRowNavigation.total) === 4
    && readNumber(documentRiskRowNavigation.pass) === 4
    && readNumber(documentRiskRowNavigation.fail) === 0
    && riskNavigationRows.length === 4
    && riskNavigationRows.every((row) => {
      const metrics = isRecord(row.metrics) ? row.metrics : {};
      const rows = Array.isArray(metrics.rows) ? metrics.rows.filter(isRecord) : [];
      const viewportHeight = readNumber(metrics.viewportHeight);
      const bodyHeight = readNumber(metrics.bodyHeight);
      const riskRowCount = readNumber(metrics.riskRowCount);
      const shellRatio = readNumber(metrics.shellRatio);
      return readString(row.verdict) === "PASS"
        && viewportHeight !== null
        && bodyHeight !== null
        && riskRowCount !== null
        && shellRatio !== null
        && bodyHeight <= viewportHeight + 8
        && readBoolean(metrics.horizontalOverflow) === false
        && shellRatio <= 3
        && riskRowCount >= 3
        && readNumber(metrics.uniqueVisibleLabelCount) === riskRowCount
        && readNumber(metrics.taskContextLabelCount) >= 1
        && rows.length === riskRowCount
        && rows.every((item) => {
          const label = readString(item.label);
          return label !== ""
            && readString(item.accessibleName).includes(label)
            && readString(item.title).includes(label);
        });
    })
    && readBoolean(riskNavigationBoundary.dbMutationPerformed) === false
    && readBoolean(riskNavigationBoundary.providerDispatchCalled) === false
    && readBoolean(riskNavigationBoundary.shareSessionCreated) === false
    && readString(riskNavigationBoundary.exactSavedShareVerdict) === "MISSING_EVIDENCE";
  const riskRowOrderProduction = isRecord(documentRiskRowMobileOrder.productionBuild)
    ? documentRiskRowMobileOrder.productionBuild
    : {};
  const riskRowOrderBoundary = isRecord(documentRiskRowMobileOrder.mutationBoundary)
    ? documentRiskRowMobileOrder.mutationBoundary
    : {};
  const riskRowOrderRows = Array.isArray(documentRiskRowMobileOrder.results)
    ? documentRiskRowMobileOrder.results.filter(isRecord)
    : [];
  const documentRiskRowMobileOrderPass = readString(documentRiskRowMobileOrder.verdict) === "PASS_LIVE_PRODUCTION_DOCUMENT_RISK_ROW_MOBILE_ORDER"
    && readString(documentRiskRowMobileOrder.sourceHead) !== ""
    && readString(documentRiskRowMobileOrder.sourceHead) === readString(riskRowOrderProduction.commitSha)
    && readBoolean(documentRiskRowMobileOrder.sourceHeadMatchesProduction) === true
    && readNumber(documentRiskRowMobileOrder.total) === 4
    && readNumber(documentRiskRowMobileOrder.pass) === 4
    && readNumber(documentRiskRowMobileOrder.fail) === 0
    && riskRowOrderRows.length === 4
    && riskRowOrderRows.every((row) => {
      const metrics = isRecord(row.metrics) ? row.metrics : {};
      const viewportHeight = readNumber(metrics.viewportHeight);
      const bodyHeight = readNumber(metrics.bodyHeight);
      const shellRatio = readNumber(metrics.shellRatio);
      const tabsBottom = readNumber(metrics.tabsBottom);
      const panelTop = readNumber(metrics.panelTop);
      const hazardFieldBottom = readNumber(metrics.hazardFieldBottom);
      return readString(row.verdict) === "PASS"
        && viewportHeight !== null
        && bodyHeight !== null
        && shellRatio !== null
        && tabsBottom !== null
        && panelTop !== null
        && hazardFieldBottom !== null
        && bodyHeight <= viewportHeight + 8
        && shellRatio <= 3
        && tabsBottom <= panelTop + 1
        && hazardFieldBottom <= viewportHeight
        && readNumber(metrics.selectorCount) >= 3
        && readBoolean(metrics.tabsBeforePanel) === true
        && readBoolean(metrics.tabsVisibleInShell) === true
        && readBoolean(metrics.hazardFieldVisibleInShell) === true
        && readBoolean(metrics.horizontalOverflow) === false;
    })
    && readBoolean(riskRowOrderBoundary.dbMutationPerformed) === false
    && readBoolean(riskRowOrderBoundary.providerDispatchCalled) === false
    && readBoolean(riskRowOrderBoundary.shareSessionCreated) === false
    && readString(riskRowOrderBoundary.exactSavedShareVerdict) === "MISSING_EVIDENCE";
  const riskRowLabelProduction = isRecord(documentRiskRowMobileLabel.productionBuild)
    ? documentRiskRowMobileLabel.productionBuild
    : {};
  const riskRowLabelBoundary = isRecord(documentRiskRowMobileLabel.mutationBoundary)
    ? documentRiskRowMobileLabel.mutationBoundary
    : {};
  const riskRowLabelRows = Array.isArray(documentRiskRowMobileLabel.results)
    ? documentRiskRowMobileLabel.results.filter(isRecord)
    : [];
  const documentRiskRowMobileLabelPass = readString(documentRiskRowMobileLabel.verdict) === "PASS_LIVE_PRODUCTION_DOCUMENT_RISK_ROW_MOBILE_LABEL"
    && readString(documentRiskRowMobileLabel.sourceHead) !== ""
    && readString(documentRiskRowMobileLabel.sourceHead) === readString(riskRowLabelProduction.commitSha)
    && readBoolean(documentRiskRowMobileLabel.sourceHeadMatchesProduction) === true
    && readNumber(documentRiskRowMobileLabel.total) === 4
    && readNumber(documentRiskRowMobileLabel.pass) === 4
    && readNumber(documentRiskRowMobileLabel.fail) === 0
    && riskRowLabelRows.length === 4
    && riskRowLabelRows.every((row) => {
      const metrics = isRecord(row.metrics) ? row.metrics : {};
      const selectorMetrics = Array.isArray(metrics.selectorMetrics)
        ? metrics.selectorMetrics.filter(isRecord)
        : [];
      const viewportWidth = readNumber(metrics.viewportWidth);
      const viewportHeight = readNumber(metrics.viewportHeight);
      const bodyHeight = readNumber(metrics.bodyHeight);
      const shellRatio = readNumber(metrics.shellRatio);
      const hazardFieldBottom = readNumber(metrics.hazardFieldBottom);
      const mobile = viewportWidth !== null && viewportWidth <= 900;
      return readString(row.verdict) === "PASS"
        && viewportWidth !== null
        && viewportHeight !== null
        && bodyHeight !== null
        && shellRatio !== null
        && hazardFieldBottom !== null
        && bodyHeight <= viewportHeight + 8
        && shellRatio <= 3
        && hazardFieldBottom <= viewportHeight
        && readBoolean(metrics.tabsBeforePanel) === true
        && readBoolean(metrics.hazardFieldVisibleInShell) === true
        && readBoolean(metrics.horizontalOverflow) === false
        && selectorMetrics.length >= 3
        && selectorMetrics.every((selector) => {
          const hazardText = readString(selector.hazardText);
          return hazardText !== ""
            && readString(selector.accessibleName).includes(hazardText)
            && readString(selector.title).includes(hazardText)
            && readBoolean(selector.hazardVisible) === true;
        })
        && (mobile
          ? readNumber(metrics.uniqueVisibleSelectorCount) >= 3
            && selectorMetrics.every((selector) => readBoolean(selector.compactVisible) === true
              && readBoolean(selector.compactClipped) === false)
          : selectorMetrics.every((selector) => readBoolean(selector.compactVisible) === false));
    })
    && readBoolean(riskRowLabelBoundary.dbMutationPerformed) === false
    && readBoolean(riskRowLabelBoundary.providerDispatchCalled) === false
    && readBoolean(riskRowLabelBoundary.shareSessionCreated) === false
    && readString(riskRowLabelBoundary.exactSavedShareVerdict) === "MISSING_EVIDENCE";
  const riskRowDensityBuild = isRecord(documentRiskRowMobileDensity.productionBuild)
    ? documentRiskRowMobileDensity.productionBuild
    : {};
  const riskRowDensityReview = isRecord(documentRiskRowMobileDensity.crossSessionUiReview)
    ? documentRiskRowMobileDensity.crossSessionUiReview
    : {};
  const riskRowDensityReviewedBranches = Array.isArray(riskRowDensityReview.reviewedBranches)
    ? riskRowDensityReview.reviewedBranches.filter(isRecord)
    : [];
  const riskRowDensityBefore = isRecord(documentRiskRowMobileDensity.beforeLive)
    ? documentRiskRowMobileDensity.beforeLive
    : {};
  const riskRowDensityAfter = isRecord(documentRiskRowMobileDensity.afterLive)
    ? documentRiskRowMobileDensity.afterLive
    : {};
  const riskRowDensityMobileCases = [
    riskRowDensityAfter.mobileDay390x723,
    riskRowDensityAfter.mobileNight390x723,
  ].filter(isRecord);
  const riskRowDensityDesktop = isRecord(riskRowDensityAfter.desktopDay1440x723)
    ? riskRowDensityAfter.desktopDay1440x723
    : {};
  const documentRiskRowMobileDensityPass = readString(documentRiskRowMobileDensity.schema) === "safeclaw-document-risk-row-mobile-density/v1"
    && readString(documentRiskRowMobileDensity.verdict) === "PASS_LIVE_PRODUCTION_DOCUMENT_RISK_ROW_MOBILE_DENSITY"
    && readString(documentRiskRowMobileDensity.productCommit) === readString(riskRowDensityBuild.commitSha)
    && readString(riskRowDensityBuild.branch) === "master"
    && readString(riskRowDensityBuild.environment) === "production"
    && riskRowDensityReviewedBranches.length === 4
    && riskRowDensityReviewedBranches.some((row) => (
      readString(row.branch) === "fix/docs-share-viewport-ia"
      && readBoolean(row.integratedIntoCurrent) === true
    ))
    && readBoolean(riskRowDensityReview.existingDirectionPreserved) === true
    && readBoolean(riskRowDensityReview.wholesaleUiBranchMergePerformed) === false
    && readNumber(riskRowDensityBefore.riskRowSelectorCount) === 5
    && readNumber(riskRowDensityBefore.riskRowSelectorRows) === 2
    && readNumber(riskRowDensityBefore.riskRowRailHeight) === 94
    && readNumber(riskRowDensityBefore.firstActiveEditorGroupTop) >= 716
    && riskRowDensityMobileCases.length === 2
    && riskRowDensityMobileCases.every((row) => (
      readNumber(row.viewport?.width) === 390
      && readNumber(row.viewport?.height) === 723
      && readNumber(row.documentHeight) <= 723
      && readNumber(row.horizontalOverflow) === 0
      && readNumber(row.riskRowSelectorCount) === 5
      && readNumber(row.riskRowSelectorRows) === 1
      && readNumber(row.riskRowRailHeight) <= 48
      && readNumber(row.riskRowRailScrollWidth) > readNumber(row.riskRowRailClientWidth)
      && Array.isArray(row.selectorHeights)
      && row.selectorHeights.length === 5
      && row.selectorHeights.every((height) => readNumber(height) >= 44)
      && readNumber(row.activeHazardBottom) <= 723
    ))
    && readNumber(riskRowDensityDesktop.viewport?.width) === 1440
    && readNumber(riskRowDensityDesktop.viewport?.height) === 723
    && readNumber(riskRowDensityDesktop.documentHeight) <= 723
    && readNumber(riskRowDensityDesktop.horizontalOverflow) === 0
    && readNumber(riskRowDensityDesktop.riskRowSelectorCount) === 5
    && readNumber(riskRowDensityDesktop.riskRowSelectorRows) === 1
    && readNumber(riskRowDensityDesktop.activeHazardBottom) <= 723
    && readString(documentRiskRowMobileDensity.verification?.focusedFiveRowBrowser?.status) === "PASS"
    && readNumber(documentRiskRowMobileDensity.verification?.focusedFiveRowBrowser?.tests) === 1
    && readString(documentRiskRowMobileDensity.verification?.documentsEditorLayout?.status) === "PASS"
    && readNumber(documentRiskRowMobileDensity.verification?.documentsEditorLayout?.tests) === 44
    && readString(documentRiskRowMobileDensity.verification?.typecheck) === "PASS"
    && readString(documentRiskRowMobileDensity.verification?.build?.status) === "PASS"
    && readNumber(documentRiskRowMobileDensity.verification?.build?.staticPages) === 28
    && readBoolean(documentRiskRowMobileDensity.mutationBoundary?.dbMutationPerformed) === false
    && readBoolean(documentRiskRowMobileDensity.mutationBoundary?.providerDispatchCalled) === false
    && readBoolean(documentRiskRowMobileDensity.mutationBoundary?.shareSessionCreated) === false
    && readBoolean(documentRiskRowMobileDensity.mutationBoundary?.vectorOrEmbeddingMutationPerformed) === false
    && readBoolean(documentRiskRowMobileDensity.mutationBoundary?.wikiPublicationPerformed) === false
    && readBoolean(documentRiskRowMobileDensity.mutationBoundary?.koshaRegistryMutationPerformed) === false
    && readString(documentRiskRowMobileDensity.remainingBoundaries?.exactSavedShareVerdict) === "MISSING_EVIDENCE"
    && readBoolean(documentRiskRowMobileDensity.remainingBoundaries?.providerLiveDispatchProven) === false
    && readBoolean(documentRiskRowMobileDensity.remainingBoundaries?.routeSplitAloneAcceptedAsFix) === false
    && readBoolean(documentRiskRowMobileDensity.remainingBoundaries?.wholeDocumentsPageClaimedShort) === false
    && readBoolean(documentRiskRowMobileDensity.remainingBoundaries?.rawSourceDrilldownRemainsBoundedSecondary) === true;
  const riskRowAddTouchBuild = isRecord(documentRiskRowAddTouch.productionBuild)
    ? documentRiskRowAddTouch.productionBuild
    : {};
  const riskRowAddTouchBefore = isRecord(documentRiskRowAddTouch.beforeLive)
    ? documentRiskRowAddTouch.beforeLive
    : {};
  const riskRowAddTouchLocal = isRecord(documentRiskRowAddTouch.afterLocal)
    ? documentRiskRowAddTouch.afterLocal
    : {};
  const riskRowAddTouchLive = isRecord(documentRiskRowAddTouch.afterLive)
    ? documentRiskRowAddTouch.afterLive
    : {};
  const riskRowAddTouchLocalRows = Array.isArray(documentRiskRowAddTouchMetrics.afterLocal)
    ? documentRiskRowAddTouchMetrics.afterLocal.filter(isRecord)
    : [];
  const riskRowAddTouchLiveRows = Array.isArray(documentRiskRowAddTouchMetrics.afterLive)
    ? documentRiskRowAddTouchMetrics.afterLive.filter(isRecord)
    : [];
  const riskRowAddTouchRowsPass = (rows) => rows.length === 2
    && ["day", "night"].every((theme) => rows.some((row) => (
      readString(row.theme) === theme
      && readNumber(row.viewport?.width) === 390
      && readNumber(row.viewport?.height) === 723
      && readNumber(row.documentHeight) <= 723
      && readNumber(row.horizontalOverflow) === 0
      && readNumber(row.addRiskRowButton?.height) >= 44
      && readString(row.addRiskRowButton?.minHeight) === "44px"
      && readString(row.shell?.overflowY) === "auto"
      && readString(row.verdict) === "PASS"
    )));
  const documentRiskRowAddTouchPass = readString(documentRiskRowAddTouch.schema) === "safeclaw-document-risk-row-add-touch/v1"
    && readString(documentRiskRowAddTouch.verdict) === "PASS_LIVE_PRODUCTION_DOCUMENT_RISK_ROW_ADD_TOUCH_TARGET"
    && readString(documentRiskRowAddTouch.productCommit) === readString(riskRowAddTouchBuild.commitSha)
    && readString(riskRowAddTouchBuild.branch) === "master"
    && readString(riskRowAddTouchBuild.environment) === "production"
    && readString(documentRiskRowAddTouch.scope?.route) === "/documents"
    && readString(documentRiskRowAddTouch.scope?.selectedDocument) === "riskAssessmentDraft"
    && readString(documentRiskRowAddTouch.scope?.action) === "addRiskRow"
    && readNumber(documentRiskRowAddTouch.scope?.viewport?.width) === 390
    && readNumber(documentRiskRowAddTouch.scope?.viewport?.height) === 723
    && Array.isArray(documentRiskRowAddTouch.scope?.themes)
    && documentRiskRowAddTouch.scope.themes.length === 2
    && documentRiskRowAddTouch.scope.themes.includes("day")
    && documentRiskRowAddTouch.scope.themes.includes("night")
    && readBoolean(documentRiskRowAddTouch.scope?.existingSelectedOnlyWorkbenchPreserved) === true
    && readBoolean(documentRiskRowAddTouch.scope?.routeSplitAloneAcceptedAsFix) === false
    && readString(riskRowAddTouchBefore.commitSha) === "eb0000396fde7ab41e37f2853318d8bacadd91b1"
    && readNumber(riskRowAddTouchBefore.buttonHeight) === 32
    && readNumber(riskRowAddTouchBefore.requiredHeight) === 44
    && readString(riskRowAddTouchBefore.verdict) === "RED_MOBILE_ADD_RISK_ROW_TOUCH_TARGET_BELOW_44PX"
    && readNumber(riskRowAddTouchLocal.passCount) === 2
    && readNumber(riskRowAddTouchLocal.rowCount) === 2
    && readNumber(riskRowAddTouchLocal.buttonHeight) >= 44
    && readNumber(riskRowAddTouchLive.passCount) === 2
    && readNumber(riskRowAddTouchLive.rowCount) === 2
    && readNumber(riskRowAddTouchLive.buttonHeight) >= 44
    && readString(riskRowAddTouchLive.metricsPath) === "evaluation/document-risk-row-add-touch-2026-08-27/browser-metrics.json"
    && readString(documentRiskRowAddTouchMetrics.schema) === "safeclaw-document-risk-row-add-touch-browser/v1"
    && riskRowAddTouchRowsPass(riskRowAddTouchLocalRows)
    && riskRowAddTouchRowsPass(riskRowAddTouchLiveRows)
    && readString(documentRiskRowAddTouch.verification?.cssTokenContract?.status) === "PASS"
    && readNumber(documentRiskRowAddTouch.verification?.cssTokenContract?.tests) === 3
    && readNumber(documentRiskRowAddTouch.verification?.cssTokenContract?.failed) === 0
    && readString(documentRiskRowAddTouch.verification?.typecheck) === "PASS"
    && readString(documentRiskRowAddTouch.verification?.build?.status) === "PASS"
    && readNumber(documentRiskRowAddTouch.verification?.build?.staticPages) === 28
    && readString(documentRiskRowAddTouch.verification?.localBrowser?.status) === "PASS"
    && readNumber(documentRiskRowAddTouch.verification?.localBrowser?.passed) === 2
    && readString(documentRiskRowAddTouch.verification?.liveBrowser?.status) === "PASS"
    && readNumber(documentRiskRowAddTouch.verification?.liveBrowser?.passed) === 2
    && readString(documentRiskRowAddTouch.verification?.visualInspection?.status) === "PASS"
    && readNumber(documentRiskRowAddTouch.verification?.visualInspection?.screenshots) === 5
    && readString(documentRiskRowAddTouch.verification?.isolatedBrowserHarness?.status) === "ENVIRONMENT_TIMEOUT_BEFORE_ASSERTION"
    && readBoolean(documentRiskRowAddTouch.verification?.isolatedBrowserHarness?.productAssertionExecuted) === false
    && readBoolean(documentRiskRowAddTouch.verification?.isolatedBrowserHarness?.treatedAsProductFailure) === false
    && readBoolean(documentRiskRowAddTouch.mutationBoundary?.dbMutationPerformed) === false
    && readBoolean(documentRiskRowAddTouch.mutationBoundary?.providerDispatchCalled) === false
    && readBoolean(documentRiskRowAddTouch.mutationBoundary?.shareSessionCreated) === false
    && readBoolean(documentRiskRowAddTouch.mutationBoundary?.embeddingOrVectorMutationPerformed) === false
    && readBoolean(documentRiskRowAddTouch.mutationBoundary?.wikiPublicationPerformed) === false
    && readBoolean(documentRiskRowAddTouch.mutationBoundary?.koshaRegistryMutationPerformed) === false
    && readString(documentRiskRowAddTouch.remainingBoundaries?.exactSavedShareVerdict) === "MISSING_EVIDENCE"
    && readString(documentRiskRowAddTouch.remainingBoundaries?.llmWikiPublication) === "APPROVAL_GATED"
    && readString(documentRiskRowAddTouch.remainingBoundaries?.sifEmbeddingRuntime) === "APPROVAL_GATED"
    && readString(documentRiskRowAddTouch.remainingBoundaries?.providerDispatchPersistence) === "APPROVAL_GATED"
    && readString(documentRiskRowAddTouch.remainingBoundaries?.supabaseRlsLaunchIsolation) === "APPROVAL_GATED"
    && readString(documentRiskRowAddTouch.remainingBoundaries?.koshaExactPromotionReview) === "APPROVAL_GATED"
    && readBoolean(documentRiskRowAddTouch.remainingBoundaries?.humanReviewCompleted) === false;
  const selectedEditorMobileHazard = isRecord(selectedEditorMobile.firstRiskHazardField)
    ? selectedEditorMobile.firstRiskHazardField
    : {};
  const selectedEditorMobileTextarea = isRecord(selectedEditorMobile.rawTextarea)
    ? selectedEditorMobile.rawTextarea
    : {};
  const selectedEditorContracts = isRecord(documentsSelectedEditorCockpit.contracts)
    ? documentsSelectedEditorCockpit.contracts
    : {};
  const selectedEditorSourceSha = readString(documentsSelectedEditorCockpit.sourceHead);
  const selectedEditorSourceCurrent = isGitAncestor(rootDir, selectedEditorSourceSha);
  const shareDesktopScope = isRecord(shareDesktop.scope) ? shareDesktop.scope : {};
  const shareDesktopProduction = isRecord(shareDesktop.production) ? shareDesktop.production : {};
  const shareDesktopLive = isRecord(shareDesktopProduction.desktop1440x900) ? shareDesktopProduction.desktop1440x900 : {};
  const shareDesktopShortLive = isRecord(shareDesktopShort.currentSource?.liveProductionGeometry?.share)
    ? shareDesktopShort.currentSource.liveProductionGeometry.share
    : {};
  const shareDesktopShortBuild = isRecord(shareDesktopShort.currentSource?.liveProductionGeometry?.build)
    ? shareDesktopShort.currentSource.liveProductionGeometry.build
    : {};
  const shareDesktopPerceptionBuild = isRecord(shareDesktopPerception.productionBuild)
    ? shareDesktopPerception.productionBuild
    : {};
  const shareDesktopPerceptionResults = Array.isArray(shareDesktopPerception.results)
    ? shareDesktopPerception.results.filter(isRecord)
    : [];
  const shareDesktopPerceptionWorkspaceDesktop = shareDesktopPerceptionResults.filter((row) => (
    readString(row.route) === "/workspace share step"
    && readNumber(row.viewport?.width) === 1440
  ));
  const shareDesktopPerceptionWorkspaceMobileShort = shareDesktopPerceptionResults.filter((row) => (
    readString(row.route) === "/workspace share step"
    && readString(row.viewport?.label) === "mobile-short-390x723"
  ));
  const shareDesktopPerceptionRecipientDesktop = shareDesktopPerceptionResults.filter((row) => (
    readString(row.route) === "/share/[sessionId] invited recipient fixture"
    && readNumber(row.viewport?.width) === 1440
  ));
  const shareDesktopPerceptionPass = readString(shareDesktopPerception.verdict) === "PASS_LIVE_PRODUCTION_SCOPED_WORKSPACE_AND_INVITED_FIXTURE"
    && readString(shareDesktopPerception.mode) === "live-production"
    && readString(shareDesktopPerception.sourceHead) === readString(shareDesktopPerceptionBuild.commitSha)
    && readBoolean(shareDesktopPerception.providerDispatchLiveClaimed) === false
    && readBoolean(shareDesktopPerception.dbMutationPerformed) === false
    && readBoolean(shareDesktopPerception.routeSplitAloneAcceptedAsFix) === false
    && readBoolean(shareDesktopPerception.exactSavedUserSessionReproduced) === false
    && readString(shareDesktopPerception.exactSavedSessionVerdict) === "MISSING_EVIDENCE"
    && shareDesktopPerceptionWorkspaceDesktop.length === 2
    && shareDesktopPerceptionWorkspaceDesktop.every((row) => (
      readString(row.verdict) === "PASS"
      && readNumber(row.metrics?.rootWidthRatio) >= 0.78
      && readNumber(row.metrics?.distinctFirstViewportRegions) >= 3
      && readString(row.metrics?.desktopStatusRailDisplay) === "grid"
      && readNumber(row.metrics?.desktopStatusRailBottom) <= readNumber(row.metrics?.viewportHeight)
      && readNumber(row.metrics?.workspaceSideNavWidth) >= 1100
      && readNumber(row.metrics?.workspaceStepStatusOverflowCount) === 0
      && readNumber(row.metrics?.workspaceStepStatusMaxOverflow) <= 1
      && readBoolean(row.metrics?.horizontalOverflow) === false
      && readNumber(row.metrics?.outsideElements) === 0
    ))
    && shareDesktopPerceptionWorkspaceMobileShort.length === 1
    && shareDesktopPerceptionWorkspaceMobileShort.every((row) => (
      readString(row.verdict) === "PASS"
      && readNumber(row.metrics?.viewportHeight) === 723
      && readString(row.metrics?.desktopStatusRailDisplay) === "none"
      && readNumber(row.metrics?.primaryBottom) <= 723
      && readNumber(row.metrics?.previewBottom) <= 723
      && readBoolean(row.metrics?.horizontalOverflow) === false
    ))
    && shareDesktopPerceptionRecipientDesktop.length === 2
    && shareDesktopPerceptionRecipientDesktop.every((row) => (
      readString(row.verdict) === "PASS"
      && readNumber(row.metrics?.distinctFirstViewportRegions) >= 2
      && readBoolean(row.metrics?.horizontalOverflow) === false
      && readNumber(row.metrics?.outsideElements) === 0
    ));
  const shareChannelLabelBuild = isRecord(shareChannelLabelPolish.productionBuild)
    ? shareChannelLabelPolish.productionBuild
    : {};
  const shareChannelLabelIntegration = isRecord(shareChannelLabelPolish.crossSessionUiIntegration)
    ? shareChannelLabelPolish.crossSessionUiIntegration
    : {};
  const shareChannelLabelDesktop = isRecord(shareChannelLabelPolish.afterLive?.desktop)
    ? shareChannelLabelPolish.afterLive.desktop
    : {};
  const shareChannelLabelMobile = isRecord(shareChannelLabelPolish.afterLive?.mobile)
    ? shareChannelLabelPolish.afterLive.mobile
    : {};
  const shareChannelCards = Array.isArray(shareChannelLabelDesktop.channelCards)
    ? shareChannelLabelDesktop.channelCards.filter(isRecord)
    : [];
  const shareChannelLabels = shareChannelCards.map((card) => readString(card.label)).sort();
  const shareChannelLabelPolishPass = readString(shareChannelLabelPolish.schema) === "safeclaw-share-channel-label-polish/v1"
    && readString(shareChannelLabelPolish.verdict) === "PASS_LIVE_PRODUCTION_SHARE_CHANNEL_LABEL_POLISH"
    && readString(shareChannelLabelPolish.productCommit) === readString(shareChannelLabelBuild.commitSha)
    && readString(shareChannelLabelBuild.branch) === "master"
    && readString(shareChannelLabelBuild.environment) === "production"
    && readBoolean(shareChannelLabelIntegration.integratedIntoProductHistory) === true
    && readBoolean(shareChannelLabelIntegration.desktopThreeZoneContractPreserved) === true
    && readBoolean(shareChannelLabelIntegration.mobileStackContractPreserved) === true
    && readNumber(shareChannelLabelDesktop.viewport?.width) === 1440
    && readNumber(shareChannelLabelDesktop.viewport?.height) === 723
    && readNumber(shareChannelLabelDesktop.documentHeight) === 723
    && readNumber(shareChannelLabelDesktop.bodyHeight) === 723
    && readNumber(shareChannelLabelDesktop.horizontalOverflow) === 0
    && readNumber(shareChannelLabelDesktop.root?.width) >= 1180
    && readNumber(shareChannelLabelDesktop.root?.bottom) <= 723
    && readNumber(shareChannelLabelDesktop.preview?.bottom) <= 723
    && readString(shareChannelLabelDesktop.statusRail?.display) === "grid"
    && readNumber(shareChannelLabelDesktop.statusRail?.bottom) <= 723
    && readNumber(shareChannelLabelDesktop.primary?.bottom) <= 723
    && readNumber(shareChannelLabelDesktop.distinctRegions) >= 3
    && shareChannelCards.length === 3
    && JSON.stringify(shareChannelLabels) === JSON.stringify(["메일", "문자", "카카오"].sort())
    && shareChannelCards.every((card) => (
      readNumber(card.width) >= 150
      && readNumber(card.labelLineCount) === 1
      && readString(card.whiteSpace) === "nowrap"
    ))
    && readNumber(shareChannelLabelMobile.viewport?.width) === 390
    && readNumber(shareChannelLabelMobile.viewport?.height) === 723
    && readNumber(shareChannelLabelMobile.documentHeight) === 723
    && readNumber(shareChannelLabelMobile.bodyHeight) === 723
    && readNumber(shareChannelLabelMobile.horizontalOverflow) === 0
    && readNumber(shareChannelLabelMobile.root?.bottom) <= 723
    && readNumber(shareChannelLabelMobile.preview?.bottom) <= 723
    && readNumber(shareChannelLabelMobile.primary?.bottom) <= 723
    && readString(shareChannelLabelMobile.statusRailDisplay) === "none"
    && readBoolean(shareChannelLabelMobile.configurationCollapsed) === true
    && readBoolean(shareChannelLabelPolish.mutationBoundary?.dbMutationPerformed) === false
    && readBoolean(shareChannelLabelPolish.mutationBoundary?.providerDispatchCalled) === false
    && readBoolean(shareChannelLabelPolish.mutationBoundary?.shareSessionCreated) === false
    && readBoolean(shareChannelLabelPolish.mutationBoundary?.vectorOrEmbeddingMutationPerformed) === false
    && readBoolean(shareChannelLabelPolish.mutationBoundary?.wikiPublicationPerformed) === false
    && readBoolean(shareChannelLabelPolish.mutationBoundary?.koshaRegistryMutationPerformed) === false
    && readString(shareChannelLabelPolish.remainingBoundaries?.exactSavedShareVerdict) === "MISSING_EVIDENCE"
    && readBoolean(shareChannelLabelPolish.remainingBoundaries?.embeddedWorkspaceShareOnly) === true
    && readBoolean(shareChannelLabelPolish.remainingBoundaries?.exactSavedSessionReproduced) === false
    && readBoolean(shareChannelLabelPolish.remainingBoundaries?.providerLiveDispatchProven) === false
    && readBoolean(shareChannelLabelPolish.remainingBoundaries?.routeSplitAloneAcceptedAsFix) === false;
  const shareStageScope = isRecord(shareStageRail.scope) ? shareStageRail.scope : {};
  const shareStageContracts = isRecord(shareStageRail.contracts) ? shareStageRail.contracts : {};
  const shareStageGeometry = isRecord(shareStageRail.freshGeometry) ? shareStageRail.freshGeometry : {};
  const shareStageDesktop = isRecord(shareStageGeometry.workspaceShareDesktopDay1440x900)
    ? shareStageGeometry.workspaceShareDesktopDay1440x900
    : {};
  const shareStageDispatch = isRecord(shareStageGeometry.standaloneDispatchDesktop1440x900)
    ? shareStageGeometry.standaloneDispatchDesktop1440x900
    : {};
  const shareStageSource = isRecord(shareStageRail.source) ? shareStageRail.source : {};
  const shareMobileBoundaryBuild = isRecord(shareMobileStageRailCollapse.liveBuildInfo)
    ? shareMobileStageRailCollapse.liveBuildInfo
    : {};
  const shareMobileBoundaryMetrics = isRecord(shareMobileStageRailCollapse.currentSourceMetrics)
    ? shareMobileStageRailCollapse.currentSourceMetrics
    : {};
  const shareMobileBoundaryMobileDay = isRecord(shareMobileBoundaryMetrics.mobile390Day)
    ? shareMobileBoundaryMetrics.mobile390Day
    : {};
  const shareMobileBoundaryDesktopDay = isRecord(shareMobileBoundaryMetrics.desktopDay)
    ? shareMobileBoundaryMetrics.desktopDay
    : {};
  const shareMobileBoundaryGeneratedMobile = isRecord(shareMobileBoundaryMetrics.generatedResultMobileFixture)
    ? shareMobileBoundaryMetrics.generatedResultMobileFixture
    : {};
  const shareExactMobile = isRecord(shareMobileExactViewport.mobile390Day)
    ? shareMobileExactViewport.mobile390Day
    : {};
  const shareExactLive = isRecord(shareExactMobile.liveProduction)
    ? shareExactMobile.liveProduction
    : {};
  const shareExactBuild = isRecord(shareMobileExactViewport.liveBuildInfo)
    ? shareMobileExactViewport.liveBuildInfo
    : {};
  const shareRecipientScope = Array.isArray(shareRecipientCockpit.scope) ? shareRecipientCockpit.scope : [];
  const shareRecipientMetrics = isRecord(shareRecipientCockpit.metrics) ? shareRecipientCockpit.metrics : {};
  const shareRecipientDesktop = isRecord(shareRecipientMetrics.desktop1440x723)
    ? shareRecipientMetrics.desktop1440x723
    : {};
  const shareRecipientDesktopButton = isRecord(shareRecipientDesktop.confirmButton)
    ? shareRecipientDesktop.confirmButton
    : {};
  const shareRecipientMobile = isRecord(shareRecipientMetrics.mobile390x844)
    ? shareRecipientMetrics.mobile390x844
    : {};
  const shareRecipientMobileButton = isRecord(shareRecipientMobile.confirmButton)
    ? shareRecipientMobile.confirmButton
    : {};
  const shareRecipientProductSha = readString(shareRecipientCockpit.sourceHead);
  const shareRecipientSourceCurrent = isGitAncestor(rootDir, shareRecipientProductSha);
  const workspaceIaClosed = isRecord(workspaceIaLiveRefinement.closedOrMostlyClosed)
    ? workspaceIaLiveRefinement.closedOrMostlyClosed
    : {};
  const workspaceIaClosedDocuments = isRecord(workspaceIaClosed.workspaceDocumentsDefaultCockpit)
    ? workspaceIaClosed.workspaceDocumentsDefaultCockpit
    : {};
  const workspaceIaClosedDocsDesktopShort = isRecord(workspaceIaClosedDocuments.desktopShort1440x723)
    ? workspaceIaClosedDocuments.desktopShort1440x723
    : {};
  const workspaceIaClosedDocsMobile = isRecord(workspaceIaClosedDocuments.mobile390x844)
    ? workspaceIaClosedDocuments.mobile390x844
    : {};
  const workspaceIaClosedShare = isRecord(workspaceIaClosed.workspaceShareDefaultCockpit)
    ? workspaceIaClosed.workspaceShareDefaultCockpit
    : {};
  const workspaceIaClosedShareDesktopShort = isRecord(workspaceIaClosedShare.desktopShort1440x723)
    ? workspaceIaClosedShare.desktopShort1440x723
    : {};
  const workspaceIaClosedShareMobile = isRecord(workspaceIaClosedShare.mobile390x844)
    ? workspaceIaClosedShare.mobile390x844
    : {};
  const workspaceIaOpenBlockers = isRecord(workspaceIaLiveRefinement.openBlockers)
    ? workspaceIaLiveRefinement.openBlockers
    : {};
  const workspaceIaSelectedEditor = isRecord(workspaceIaOpenBlockers.selectedDocumentEditorDetailLanding)
    ? workspaceIaOpenBlockers.selectedDocumentEditorDetailLanding
    : {};
  const workspaceIaSelectedWorkspaceEditor = isRecord(workspaceIaSelectedEditor.workspaceEditor)
    ? workspaceIaSelectedEditor.workspaceEditor
    : {};
  const workspaceIaSelectedEditorDesktopShort = isRecord(workspaceIaSelectedWorkspaceEditor.desktopShort1440x723)
    ? workspaceIaSelectedWorkspaceEditor.desktopShort1440x723
    : {};
  const workspaceIaSelectedEditorMobile = isRecord(workspaceIaSelectedWorkspaceEditor.mobile390x844)
    ? workspaceIaSelectedWorkspaceEditor.mobile390x844
    : {};
  const workspaceIaShareNarrowCard = isRecord(workspaceIaOpenBlockers.shareDesktopPerceivedNarrowCard)
    ? workspaceIaOpenBlockers.shareDesktopPerceivedNarrowCard
    : {};
  const workspaceIaLiveSha = readString(workspaceIaLiveRefinement.liveCommitChecked);
  const workspaceIaLiveCurrent = isGitAncestor(rootDir, workspaceIaLiveSha);
  const editorDetailMetrics = isRecord(workspaceEditorDetailLanding.liveMetrics)
    ? workspaceEditorDetailLanding.liveMetrics
    : {};
  const editorDetailDesktopShort = isRecord(editorDetailMetrics.desktopShort1440x723)
    ? editorDetailMetrics.desktopShort1440x723
    : {};
  const editorDetailMobile = isRecord(editorDetailMetrics.mobile390x844)
    ? editorDetailMetrics.mobile390x844
    : {};
  const editorDetailAcceptance = isRecord(workspaceEditorDetailLanding.acceptance)
    ? workspaceEditorDetailLanding.acceptance
    : {};
  const editorDetailLiveSha = readString(workspaceEditorDetailLanding.liveCommitChecked);
  const editorDetailLiveCurrent = isGitAncestor(rootDir, editorDetailLiveSha);
  const workspaceIaCurrentClosed = isRecord(workspaceIaCurrentReport.closed)
    ? workspaceIaCurrentReport.closed
    : {};
  const workspaceIaCurrentOpen = isRecord(workspaceIaCurrentReport.open)
    ? workspaceIaCurrentReport.open
    : {};
  const workspaceIaCurrentDocs = isRecord(workspaceIaCurrentClosed.defaultDocumentsCockpit)
    ? workspaceIaCurrentClosed.defaultDocumentsCockpit
    : {};
  const workspaceIaCurrentDocsDesktopShort = isRecord(workspaceIaCurrentDocs.desktopShort1440x723)
    ? workspaceIaCurrentDocs.desktopShort1440x723
    : {};
  const workspaceIaCurrentDocsMobile = isRecord(workspaceIaCurrentDocs.mobile390x844)
    ? workspaceIaCurrentDocs.mobile390x844
    : {};
  const workspaceIaCurrentShare = isRecord(workspaceIaCurrentClosed.defaultShareCockpit)
    ? workspaceIaCurrentClosed.defaultShareCockpit
    : {};
  const workspaceIaCurrentShareDesktopShort = isRecord(workspaceIaCurrentShare.desktopShort1440x723)
    ? workspaceIaCurrentShare.desktopShort1440x723
    : {};
  const workspaceIaCurrentShareMobile = isRecord(workspaceIaCurrentShare.mobile390x844)
    ? workspaceIaCurrentShare.mobile390x844
    : {};
  const workspaceIaCurrentSelectedEditor = isRecord(workspaceIaCurrentClosed.selectedEditorFieldLevelLanding)
    ? workspaceIaCurrentClosed.selectedEditorFieldLevelLanding
    : {};
  const workspaceIaCurrentSelectedEditorDesktopShort = isRecord(workspaceIaCurrentSelectedEditor.desktopShort1440x723)
    ? workspaceIaCurrentSelectedEditor.desktopShort1440x723
    : {};
  const workspaceIaCurrentSelectedEditorMobile = isRecord(workspaceIaCurrentSelectedEditor.mobile390x844)
    ? workspaceIaCurrentSelectedEditor.mobile390x844
    : {};
  const workspaceIaCurrentRawTextareaDepth = isRecord(workspaceIaCurrentOpen.selectedEditorRawTextareaDepth)
    ? workspaceIaCurrentOpen.selectedEditorRawTextareaDepth
    : {};
  const workspaceIaCurrentShareNarrowWorkbench = isRecord(workspaceIaCurrentOpen.shareDesktopPerceivedNarrowWorkbench)
    ? workspaceIaCurrentOpen.shareDesktopPerceivedNarrowWorkbench
    : {};
  const workspaceIaCurrentLiveSha = readString(workspaceIaCurrentReport.liveCommitChecked);
  const workspaceIaCurrentLiveIsAncestor = isGitAncestor(rootDir, workspaceIaCurrentLiveSha);
  const shareMobile = isRecord(share.mobile390x844Day)
    ? share.mobile390x844Day
    : isRecord(share.mobile390x844)
      ? share.mobile390x844
      : {};
  const shareInterpretation = isRecord(share.interpretation) ? share.interpretation : {};
  const paneChecksPass = allChecksPassed(paneContext);
  const drilldownChecksPass = allChecksPassed(drilldown);
  const bodyHeight = readNumber(internalPaneGeometry.bodyHeight);
  const viewportHeight = readNumber(isRecord(internalPaneGeometry.viewport) ? internalPaneGeometry.viewport.height : 844) || 844;
  const contextSourceSha = readString(paneContext.sourceHeadBeforeCommit);
  const contextSourceCurrent = isGitAncestor(rootDir, contextSourceSha);
  const drilldownSourceSha = readString(drilldown.sourceHeadBeforeCommit);
  const drilldownSourceCurrent = isGitAncestor(rootDir, drilldownSourceSha);
  const innerPaneDepthSourceSha = readString(innerPaneDepth.sourceHead);
  const innerPaneDepthSourceCurrent = isGitAncestor(rootDir, innerPaneDepthSourceSha);
  const fieldFirstSourceSha = readString(fieldFirst.sourceHead);
  const fieldFirstSourceCurrent = isGitAncestor(rootDir, fieldFirstSourceSha);
  const riskRowSourceSha = readString(riskRowCockpit.sourceHead);
  const riskRowSourceCurrent = isGitAncestor(rootDir, riskRowSourceSha);
  const tbmSourceSha = readString(tbmSource.productCommit);
  const tbmSourceCurrent = isGitAncestor(rootDir, tbmSourceSha);
  const firstViewSourceSha = readString(firstViewSource.productCommit);
  const firstViewSourceCurrent = isGitAncestor(rootDir, firstViewSourceSha);
  const educationSourceSha = readString(educationSource.productCommit);
  const educationSourceCurrent = isGitAncestor(rootDir, educationSourceSha);
  const emergencySourceSha = readString(emergencySource.productCommit);
  const emergencySourceCurrent = isGitAncestor(rootDir, emergencySourceSha);
  const completeCockpitsSourceSha = readString(completeCockpitsSource.productCommit);
  const completeCockpitsSourceCurrent = isGitAncestor(rootDir, completeCockpitsSourceSha);
  const documentsExactProductSha = readString(documentsMobileExactCockpit.productCommit);
  const documentsExactEvidenceSha = readString(documentsMobileExactCockpit.evidenceCommitAtVerification);
  const documentsExactProductCurrent = isGitAncestor(rootDir, documentsExactProductSha);
  const documentsExactEvidenceCurrent = isGitAncestor(rootDir, documentsExactEvidenceSha);
  const shareStageSourceSha = readString(shareStageSource.productCommit);
  const shareStageSourceCurrent = isGitAncestor(rootDir, shareStageSourceSha);
  const shareMobileBoundaryProductSha = readString(shareMobileStageRailCollapse.productCommit);
  const shareMobileBoundaryEvidenceSha = readString(shareMobileStageRailCollapse.evidenceCommit);
  const shareMobileBoundaryProductCurrent = isGitAncestor(rootDir, shareMobileBoundaryProductSha);
  const shareMobileBoundaryEvidenceCurrent = isGitAncestor(rootDir, shareMobileBoundaryEvidenceSha);
  const shareExactSourceSha = readString(shareMobileExactViewport.sourceCommit);
  const shareExactEvidenceSha = readString(shareMobileExactViewport.evidenceCommitAtVerification);
  const shareExactSourceCurrent = isGitAncestor(rootDir, shareExactSourceSha);
  const shareExactEvidenceCurrent = isGitAncestor(rootDir, shareExactEvidenceSha);
  const fieldFirstMobileShellHeight = readFirstNumber(fieldFirstMobile, [
    "workpackShellClientHeight",
    "workpackShellHeight",
  ]);
  const configCardDisplays = Array.isArray(shareMobile.configCardDisplays)
    ? shareMobile.configCardDisplays
    : [];
  const expandedOnDemand = isRecord(shareMobile.expandedOnDemand) ? shareMobile.expandedOnDemand : {};
  const expandedCardDisplays = Array.isArray(expandedOnDemand.configCardDisplays)
    ? expandedOnDemand.configCardDisplays
    : [];

  const documentsPass = readString(internalPane.verdict).startsWith("PASS")
    && bodyHeight !== null
    && bodyHeight <= viewportHeight + 1
    && readBoolean(internalPaneGeometry.overflowX) === false
    && readNumber(internalPaneGeometry.outside) === 0
    && contextAssertions.riskAssessmentToolbarVisibleInPaneAfterDeepScroll === true
    && contextAssertions.tbmLogDrilldownSummaryContainsSectionsEvidenceAndReview === true
    && contextAssertions.riskAssessmentDrilldownSummaryContainsSectionsEvidenceAndReview === true
    && contextAssertions.tbmLogToolbarDoesNotCoverActiveTextareaAfterSelection === true
    && contextAssertions.riskAssessmentToolbarDoesNotCoverActiveTextareaAfterSelection === true
    && contextAssertions.riskAssessmentDrilldownSummaryVisibleAfterDeepScroll === true
    && contextAssertions.toolbarNearPaneTopAfterDeepScroll === true
    && contextAssertions.toolbarDoesNotCoverActiveTextarea === true
    && contextAssertions.pageHeightBoundedAfterDeepScroll === true
    && contextAssertions.horizontalOverflowClosedAfterDeepScroll === true
    && readString(drilldown.verdict).startsWith("PASS")
    && drilldownAssertions.defaultOpenSectionCount === 1
    && drilldownAssertions.afterOpeningSecondSectionOpenCount === 1
    && Array.isArray(drilldownAssertions.defaultOpenIndexes)
    && drilldownAssertions.defaultOpenIndexes.length === 1
    && drilldownAssertions.defaultOpenIndexes[0] === 0
    && Array.isArray(drilldownAssertions.afterOpeningSecondSectionOpenIndexes)
    && drilldownAssertions.afterOpeningSecondSectionOpenIndexes.length === 1
    && drilldownAssertions.afterOpeningSecondSectionOpenIndexes[0] === 1
    && drilldownAssertions.pageHeightRemainsBoundedAfterSectionSwitch === true
    && drilldownAssertions.horizontalOverflowClosedAfterSectionSwitch === true
    && drilldownAssertions.workpackPaneRemainsInsideViewport === true
    && drilldownAssertions.openSectionTextareaVisibleInPaneAfterSectionSwitch === true
    && drilldownAssertions.openSectionActionsVisibleAfterSectionSwitch === true
    && drilldownAssertions.evidenceActionDrawerOpen === true
    && drilldownAssertions.evidenceActionPanelVisibleInPane === true
    && drilldownAssertions.evidenceActionPanelBelowToolbar === true
    && drilldownAssertions.toolbarDoesNotCoverOpenSectionTextareaAfterSectionSwitch === true
    && drilldownAssertions.selectedDocumentToolbarStillDoesNotCoverTextarea === true
    && paneChecksPass
    && drilldownChecksPass
    && contextSourceCurrent
    && drilldownSourceCurrent
    && readString(innerPaneDepth.verdict) === "PASS_PRODUCTION"
    && readString(innerPaneProduction.buildInfo?.commitSha).length > 0
    && readNumber(innerPaneMobile.bodyHeight) === 844
    && readNumber(innerPaneMobile.workpackShellClientHeight) === 320
    && readNumber(innerPaneMobile.workpackShellScrollHeight) !== null
    && readNumber(innerPaneMobile.workpackShellScrollHeight) <= 1500
    && readNumber(innerPaneMobile.editorSecondaryToolsHeight) !== null
    && readNumber(innerPaneMobile.editorSecondaryToolsHeight) <= 240
    && readString(innerPaneMobile.selectedTitle) === "위험성평가표"
    && readBoolean(innerPaneMobile.riskLauncherPressed) === true
    && readBoolean(innerPaneMobile.horizontalOverflow) === false
    && innerPaneAssertions.defaultOpenSectionCountIsOne === true
    && innerPaneAssertions.firstTextareaBelowToolbar === true
    && innerPaneAssertions.firstTextareaInsideFirstViewport === true
    && innerPaneDepthSourceCurrent
    && readString(fieldFirst.verdict) === "PASS_PRODUCTION"
    && fieldFirstSourceCurrent
    && fieldFirstAssertions.fieldStripVisibleBelowToolbar === true
    && fieldFirstAssertions.fieldStripNamesCurrentEditableFieldEvidenceAndReview === true
    && fieldFirstAssertions.evidenceAndReviewActionsVisibleInsidePane === true
    && fieldFirstAssertions.firstTextareaTopVisibleInsidePane === true
    && fieldFirstAssertions.firstTextareaUsableVisibleAreaAtLeast96px === true
    && fieldFirstAssertions.defaultOpenSectionCountIsOne === true
    && fieldFirstAssertions.horizontalOverflowClosed === true
    && readString(fieldFirstMobile.selectedTitle) === "위험성평가표"
    && readBoolean(fieldFirstMobile.riskLauncherPressed) === true
    && readNumber(fieldFirstMobile.bodyHeight) === 844
    && fieldFirstMobileShellHeight === 320
    && readNumber(fieldFirstMobile.workpackShellScrollHeight) !== null
    && readNumber(fieldFirstMobile.workpackShellScrollHeight) <= 1500
    && readNumber(fieldFirstMobile.fieldStripTop) !== null
    && readNumber(fieldFirstMobile.fieldStripBottom) !== null
    && readNumber(fieldFirstMobile.actionsBottom) !== null
    && readNumber(fieldFirstMobile.firstTextareaTop) !== null
    && readNumber(fieldFirstMobile.visibleTextareaHeightInsidePane) !== null
    && readNumber(fieldFirstMobile.fieldStripTop) >= readNumber(fieldFirstMobile.toolbarBottom) + 4
    && readNumber(fieldFirstMobile.actionsBottom) <= readNumber(fieldFirstMobile.workpackShellBottom)
    && readNumber(fieldFirstMobile.firstTextareaTop) < readNumber(fieldFirstMobile.workpackShellBottom)
    && readNumber(fieldFirstMobile.visibleTextareaHeightInsidePane) >= 96
    && readBoolean(fieldFirstMobile.toolbarCoversFieldStrip) === false
    && readBoolean(fieldFirstMobile.toolbarCoversActions) === false
    && readBoolean(fieldFirstMobile.toolbarCoversTextarea) === false
    && readBoolean(fieldFirstMobile.horizontalOverflow) === false
    && readString(fieldFirstDesktop.selectedTitle) === "위험성평가표"
    && readBoolean(fieldFirstDesktop.horizontalOverflow) === false
    && readNumber(fieldFirstDesktop.visibleTextareaHeightInsidePane) !== null
    && readNumber(fieldFirstDesktop.visibleTextareaHeightInsidePane) >= 96
    && readString(riskRowCockpit.verdict) === "PASS_CURRENT_SOURCE"
    && riskRowSourceCurrent
    && readString(riskRowScope.document) === "riskAssessmentDraft"
    && readBoolean(riskRowScope.providerDispatchLiveClaimed) === false
    && readBoolean(riskRowScope.fullDocumentIaClaimed) === false
    && readBoolean(riskRowScope.routeSplitAloneAcceptedAsFix) === false
    && riskRowContracts.firstRiskRowHeaderBelowToolbar === true
    && riskRowContracts.firstHazardFieldUsableInShell === true
    && riskRowContracts.rowHeaderShowsEvidenceAndVerification === true
    && riskRowContracts.rawSectionTextareaSecondary === true
    && riskRowContracts.rowDetailsBehindDrilldown === true
    && readNumber(riskRowContracts.mobileWorkpackShellScrollHeightCap) <= 1500
    && riskRowContracts.horizontalOverflowClosed === true
    && riskRowCommands.length >= 4
    && riskRowCommands.every((command) => isRecord(command) && command.status === "PASS")
    && readString(tbmCockpit.verdict) === "PASS_CURRENT_SOURCE"
    && tbmSourceCurrent
    && readString(tbmScope.route) === "/documents"
    && readString(tbmScope.surface).includes("tbmBriefing")
    && readBoolean(tbmScope.productionLiveClaimed) === false
    && tbmContracts.tbmCockpitVisible === true
    && tbmContracts.tbmCockpitBelowToolbar === true
    && tbmContracts.tbmRawTextareaSecondary === true
    && tbmContracts.riskRowHeaderAndHazardStillVisible === true
    && tbmContracts.providerOrExportContractsChanged === false
    && tbmVerification.length >= 3
    && tbmVerification.every((item) => isRecord(item) && item.status === "PASS")
    && readString(firstViewSplit.verdict) === "PASS_CURRENT_SOURCE"
    && firstViewSourceCurrent
    && readString(firstViewScope.route) === "/documents"
    && readBoolean(firstViewScope.productionLiveClaimed) === false
    && firstViewContracts.coreDocumentsPrioritized === true
    && firstViewContracts.supportingDocumentsGrouped === true
    && firstViewContracts.workPlanExecutionCockpitBeforeRawEditor === true
    && firstViewContracts.permitExecutionCockpitBeforeRawEditor === true
    && firstViewContracts.riskAssessmentFirstHazardVisible === true
    && firstViewContracts.providerOrExportContractsChanged === false
    && firstViewVerification.length >= 4
    && firstViewVerification.every((item) => isRecord(item) && item.status === "PASS")
    && readString(educationCockpit.verdict) === "PASS_CURRENT_SOURCE"
    && educationSourceCurrent
    && readString(educationScope.route) === "/documents"
    && readString(educationScope.surface) === "safetyEducationRecordDraft"
    && readBoolean(educationScope.productionLiveClaimed) === false
    && educationContracts.educationCockpitVisible === true
    && educationContracts.educationCockpitBelowToolbar === true
    && educationContracts.educationRawTextareaSecondary === true
    && educationContracts.workPlanAndPermitCockpitsStillCovered === true
    && educationContracts.providerOrExportContractsChanged === false
    && educationVerification.length >= 4
    && educationVerification.every((item) => isRecord(item) && item.status === "PASS")
    && readString(emergencyCockpit.verdict) === "PASS_CURRENT_SOURCE"
    && emergencySourceCurrent
    && readString(emergencyScope.route) === "/documents"
    && readString(emergencyScope.surface) === "emergencyResponseDraft"
    && readBoolean(emergencyScope.productionLiveClaimed) === false
    && emergencyContracts.emergencyCockpitVisible === true
    && emergencyContracts.emergencyCockpitBelowToolbar === true
    && emergencyContracts.emergencyRawTextareaSecondary === true
    && emergencyContracts.phoneNumbersNotInvented === true
    && emergencyContracts.providerOrExportContractsChanged === false
    && emergencyVerification.length >= 4
    && emergencyVerification.every((item) => isRecord(item) && item.status === "PASS")
    && readString(completeCockpits.verdict) === "PASS_CURRENT_SOURCE"
    && completeCockpitsSourceCurrent
    && readString(completeCockpitsScope.route) === "/documents"
    && readString(completeCockpitsScope.surface) === "12 document first-task cockpits"
    && readBoolean(completeCockpitsScope.productionLiveClaimed) === false
    && completeCockpitsContracts.allTwelveDocumentFirstTaskSurfaces === true
    && completeCockpitsContracts.summaryCockpitVisible === true
    && completeCockpitsContracts.riskAssessmentFirstHazardVisible === true
    && completeCockpitsContracts.tbmCockpitsVisible === true
    && completeCockpitsContracts.executionCockpitsVisible === true
    && completeCockpitsContracts.educationAndForeignBriefingCockpitsVisible === true
    && completeCockpitsContracts.emergencyCockpitVisible === true
    && completeCockpitsContracts.photoCockpitVisible === true
    && completeCockpitsContracts.transmissionCockpitsVisible === true
    && completeCockpitsContracts.cockpitsBelowToolbar === true
    && completeCockpitsContracts.rawTextareasSecondary === true
    && completeCockpitsContracts.mobileCockpitsContainedInPane === true
    && completeCockpitsContracts.providerOrExportContractsChanged === false
    && completeCockpitKeys.length === 12
    && completeCockpitsVerification.length >= 4
    && completeCockpitsVerification.every((item) => isRecord(item) && item.status === "PASS")
    && readString(completeCockpitsLive.verdict) === "PASS_PRODUCTION"
    && readString(completeCockpitsLiveBuild.commitSha) === "c651301742183e4b7644147570d4ae33d42c5dbc"
    && readString(completeCockpitsLiveBuild.branch) === "master"
    && readString(completeCockpitsLiveBuild.environment) === "production"
    && readString(completeCockpitsLiveScope.route) === "/documents"
    && readString(completeCockpitsLiveScope.surface) === "12 document first-task cockpits"
    && readBoolean(completeCockpitsLiveScope.providerDispatchLiveClaimed) === false
    && readBoolean(completeCockpitsLiveScope.exportContractsChanged) === false
    && completeCockpitsLiveAssertions.productionMarkerMatchesCompleteCockpitEvidence === true
    && completeCockpitsLiveAssertions.allTargetsPresent === true
    && completeCockpitsLiveAssertions.allTargetsVisibleInPane === true
    && completeCockpitsLiveAssertions.allTargetsBelowToolbar === true
    && completeCockpitsLiveAssertions.noToolbarTargetOverlap === true
    && completeCockpitsLiveAssertions.requiredTextPresent === true
    && completeCockpitsLiveAssertions.mobilePageHeightBounded === true
    && completeCockpitsLiveAssertions.horizontalOverflowClosed === true
    && completeCockpitsLiveMobile.length === 12
    && completeCockpitsLiveDesktop.length === 12
    && completeCockpitsLiveMobile.every((row) => isRecord(row)
      && row.missing === false
      && row.horizontalOverflow === false
      && row.targetVisibleInPane === true
      && row.targetBelowToolbar === true
      && row.toolbarCoversTarget === false
      && row.requiredTextPresent === true
      && readNumber(row.pageHeight) !== null
      && readNumber(row.viewportHeight) !== null
      && readNumber(row.pageHeight) <= readNumber(row.viewportHeight) + 1)
    && completeCockpitsLiveDesktop.every((row) => isRecord(row)
      && row.missing === false
      && row.horizontalOverflow === false
      && row.targetVisibleInPane === true
      && row.targetBelowToolbar === true
      && row.toolbarCoversTarget === false
      && row.requiredTextPresent === true)
    && readString(documentsMobileExactCockpit.verdict) === "PASS_LIVE_PRODUCTION"
    && readBoolean(documentsMobileExactCockpit.productionLiveClaimed) === true
    && readBoolean(documentsMobileExactCockpit.providerDispatchLiveClaimed) === false
    && readBoolean(documentsMobileExactCockpit.routeSplitAloneAcceptedAsFix) === false
    && documentsExactProductCurrent
    && documentsExactEvidenceCurrent
    && readString(documentsExactBuild.commitSha) === documentsExactEvidenceSha
    && readString(documentsExactBuild.branch) === "master"
    && readString(documentsExactBuild.environment) === "production"
    && readNumber(documentsExactLive.documentsPageHeight) === 844
    && readNumber(documentsExactLive.documentsViewportHeight) === 844
    && readNumber(documentsExactLive.documentsHeightRatio) === 1
    && readBoolean(documentsExactLive.documentsHorizontalOverflow) === false
    && readNumber(documentsExactLive.documentsOutsideViewport) === 0
    && readNumber(documentsExactLive.documentWorkbenchBottom) <= 844
    && readBoolean(documentsExactLive.documentDeepReviewOpen) === false
    && readNumber(documentsExactLive.visibleDocumentPreviews) === 0
    && readNumber(documentsExactLive.sharePageHeight) === 844
    && readNumber(documentsExactLive.shareViewportHeight) === 844
    && readNumber(documentsExactLive.shareHeightRatio) === 1;

  const sharePass = readString(share.verdict).includes("PASS")
    && shareDesktopPerceptionPass
    && readString(shareDesktop.verdict) === "PASS_PRODUCTION"
    && readString(shareDesktopScope.route) === "/workspace"
    && readString(shareDesktopScope.surface) === "share"
    && readBoolean(shareDesktopScope.liveProviderDispatchClaimed) === false
    && readString(shareDesktopProduction.build?.commitSha).length > 0
    && readNumber(shareDesktopLive.pageHeight) !== null
    && readNumber(shareDesktopLive.viewportHeight) !== null
    && readNumber(shareDesktopLive.pageHeight) <= readNumber(shareDesktopLive.viewportHeight) * 1.35
    && readNumber(shareDesktopLive.previewLeft) !== null
    && readNumber(shareDesktopLive.primaryRight) !== null
    && readNumber(shareDesktopLive.previewLeft) >= readNumber(shareDesktopLive.primaryRight)
    && readBoolean(shareDesktopLive.previewRightOfPrimary) === true
    && Array.isArray(shareDesktopLive.channelCardWidths)
    && shareDesktopLive.channelCardWidths.length === 3
    && shareDesktopLive.channelCardWidths.every((width) => typeof width === "number" && width >= 150)
    && Array.isArray(shareDesktopLive.channelCardHeights)
    && shareDesktopLive.channelCardHeights.length === 3
    && shareDesktopLive.channelCardHeights.every((height) => typeof height === "number" && height <= 80)
    && readNumber(shareDesktopLive.horizontalOverflow) === 0
    && readString(shareDesktopShort.verdict) === "PASS_LIVE_PRODUCTION"
    && readBoolean(shareDesktopShort.providerDispatchLiveClaimed) === false
    && readBoolean(shareDesktopShort.routeSplitAloneAcceptedAsFix) === false
    && readString(shareDesktopShortBuild.commitSha).length > 0
    && readString(shareDesktopShortBuild.branch) === "master"
    && readString(shareDesktopShortBuild.environment) === "production"
    && readNumber(shareDesktopShortLive.bodyHeight) !== null
    && readNumber(shareDesktopShortLive.viewportHeight) === 723
    && readNumber(shareDesktopShortLive.bodyHeight) <= 723 * 1.05
    && readNumber(shareDesktopShortLive.sharePreviewBottom) <= 723
    && readNumber(shareDesktopShortLive.primaryCtaBottom) <= 723
    && readNumber(shareDesktopShortLive.shareTargetCardBottom) <= 723
    && readNumber(shareDesktopShortLive.shareLanguageCardBottom) <= 723
    && readNumber(shareDesktopShortLive.shareChannelCardBottom) <= 723
    && readNumber(shareDesktopShortLive.horizontalOverflow) === 0
    && readNumber(shareDesktopShortLive.outsideHorizontalElements) === 0
    && readNumber(shareMobile.shareMobileSummaryBottom) !== null
    && readNumber(shareMobile.sharePreviewBottom) !== null
    && readNumber(shareMobile.primaryShareCtaBottom) !== null
    && readNumber(shareMobile.configToggleBottom) !== null
    && readNumber(shareMobile.shareMobileSummaryBottom) <= 844
    && readNumber(shareMobile.sharePreviewBottom) <= 844
    && readNumber(shareMobile.primaryShareCtaBottom) <= 844
    && readNumber(shareMobile.configToggleBottom) <= 844
    && readNumber(shareMobile.horizontalOverflow) === 0
    && configCardDisplays.length === 3
    && configCardDisplays.every((display) => display === "none")
    && readBoolean(expandedOnDemand.expanded) === true
    && expandedCardDisplays.length === 3
    && expandedCardDisplays.every((display) => display !== "none")
    && readBoolean(shareInterpretation.providerDispatchLiveClaimed) === false
    && readString(shareStageRail.verdict) === "PASS_CURRENT_SOURCE"
    && shareStageSourceCurrent
    && readString(shareStageScope.route) === "/workspace?share"
    && readBoolean(shareStageScope.productionLiveClaimed) === false
    && shareStageContracts.stageRailVisibleOnWorkspaceShareDesktop === true
    && readNumber(shareStageContracts.stageRailStepCount) === 4
    && readNumber(shareStageContracts.desktopStageColumns) === 4
    && readNumber(shareStageContracts.desktopHorizontalOverflow) === 0
    && shareStageContracts.ctaInsideDesktopViewport === true
    && shareStageContracts.previewInsideDesktopViewport === true
    && shareStageContracts.standaloneDispatchHeightGuardPreserved === true
    && shareStageContracts.providerContractsChanged === false
    && readNumber(shareStageDesktop.stageRailItemCount) === 4
    && readNumber(shareStageDesktop.stageColumns) === 4
    && readNumber(shareStageDesktop.horizontalOverflow) === 0
    && readNumber(shareStageDesktop.primaryBottom) !== null
    && readNumber(shareStageDesktop.primaryBottom) <= 900
    && readNumber(shareStageDesktop.previewBottom) !== null
    && readNumber(shareStageDesktop.previewBottom) <= 900
    && readNumber(shareStageDispatch.rootHeight) !== null
    && readNumber(shareStageDispatch.rootHeight) <= 720
    && readNumber(shareStageDispatch.primaryBottom) !== null
    && readNumber(shareStageDispatch.primaryBottom) <= 900
    && readNumber(shareStageDispatch.previewBottom) !== null
    && readNumber(shareStageDispatch.previewBottom) <= 900
    && readNumber(shareStageDispatch.horizontalOverflow) === 0
    && readString(shareMobileStageRailCollapse.verdict) === "PASS_LIVE_PRODUCTION"
    && readBoolean(shareMobileStageRailCollapse.productionLiveClaimed) === true
    && readBoolean(shareMobileStageRailCollapse.providerDispatchLiveClaimed) === false
    && readBoolean(shareMobileStageRailCollapse.routeSplitAloneAcceptedAsFix) === false
    && shareMobileBoundaryProductCurrent
    && shareMobileBoundaryEvidenceCurrent
    && readString(shareMobileBoundaryBuild.commitSha) === shareMobileBoundaryEvidenceSha
    && readString(shareMobileBoundaryBuild.branch) === "master"
    && readString(shareMobileBoundaryBuild.environment) === "production"
    && readNumber(shareMobileBoundaryMobileDay.pageHeight) !== null
    && readNumber(shareMobileBoundaryMobileDay.viewportHeight) === 844
    && readNumber(shareMobileBoundaryMobileDay.pageHeight) <= 844 * 1.2
    && readNumber(shareMobileBoundaryMobileDay.summaryBottom) <= 844
    && readNumber(shareMobileBoundaryMobileDay.previewBottom) <= 844
    && readNumber(shareMobileBoundaryMobileDay.primaryBottom) <= 844
    && readNumber(shareMobileBoundaryMobileDay.configToggleBottom) <= 844
    && readString(shareMobileBoundaryMobileDay.stageRailDisplay) === "none"
    && Array.isArray(shareMobileBoundaryMobileDay.configCardDisplays)
    && shareMobileBoundaryMobileDay.configCardDisplays.length === 3
    && shareMobileBoundaryMobileDay.configCardDisplays.every((display) => display === "none")
    && readNumber(shareMobileBoundaryMobileDay.horizontalOverflow) === 0
    && readString(shareMobileBoundaryDesktopDay.stageRailDisplay) === "grid"
    && readNumber(shareMobileBoundaryDesktopDay.stageColumns) === 4
    && readNumber(shareMobileBoundaryDesktopDay.previewBottom) <= 900
    && readNumber(shareMobileBoundaryDesktopDay.primaryBottom) <= 900
    && readNumber(shareMobileBoundaryDesktopDay.horizontalOverflow) === 0
    && readNumber(shareMobileBoundaryGeneratedMobile.resultSummaryBottom) <= 844
    && readBoolean(shareMobileBoundaryGeneratedMobile.resultClosedByDefault) === true
    && readNumber(shareMobileBoundaryGeneratedMobile.horizontalOverflow) === 0
    && readString(shareMobileExactViewport.verdict) === "PASS_LIVE_PRODUCTION"
    && readBoolean(shareMobileExactViewport.productionLiveClaimed) === true
    && readBoolean(shareMobileExactViewport.providerDispatchLiveClaimed) === false
    && readBoolean(shareMobileExactViewport.routeSplitAloneAcceptedAsFix) === false
    && shareExactSourceCurrent
    && shareExactEvidenceCurrent
    && readString(shareExactBuild.commitSha) === shareExactEvidenceSha
    && readString(shareExactBuild.branch) === "master"
    && readString(shareExactBuild.environment) === "production"
    && readNumber(shareExactLive.pageHeight) === 844
    && readNumber(shareExactLive.viewportHeight) === 844
    && readNumber(shareExactLive.heightRatio) === 1
    && readNumber(shareExactLive.shareRootBottom) <= 844
    && readNumber(shareExactLive.summaryBottom) <= 844
    && readNumber(shareExactLive.previewBottom) <= 844
    && readNumber(shareExactLive.primaryBottom) <= 844
    && readNumber(shareExactLive.configToggleBottom) <= 844
    && readString(shareExactLive.stageRailDisplay) === "none"
    && Array.isArray(shareExactLive.configCardDisplays)
    && shareExactLive.configCardDisplays.length === 3
    && shareExactLive.configCardDisplays.every((display) => display === "none")
    && readNumber(shareExactLive.horizontalOverflow) === 0
    && readString(shareRecipientCockpit.verdict) === "PASS_LIVE_PRODUCTION"
    && readBoolean(shareRecipientCockpit.productionLiveClaimed) === true
    && readBoolean(shareRecipientCockpit.providerDispatchLiveClaimed) === false
    && readBoolean(shareRecipientCockpit.routeSplitAloneAcceptedAsFix) === false
    && shareRecipientSourceCurrent
    && shareRecipientScope.includes("app/share/[sessionId]/page.tsx")
    && readNumber(shareRecipientDesktop.distinctColumns) >= 2
    && readNumber(shareRecipientDesktop.ratio) <= 1.35
    && readNumber(shareRecipientDesktopButton.bottom) <= 640
    && readBoolean(shareRecipientDesktop.horizontalOverflow) === false
    && readNumber(shareRecipientDesktop.outsideCards) === 0
    && readNumber(shareRecipientMobile.ratio) <= 2
    && readNumber(shareRecipientMobileButton.bottom) <= 760
    && readBoolean(shareRecipientMobile.documentsCollapsedByDefault) === true
    && readBoolean(shareRecipientMobile.horizontalOverflow) === false
    && readNumber(shareRecipientMobile.outsideCards) === 0;

  const workspaceIaRefinementPass = readString(workspaceIaLiveRefinement.verdict) === "IA_BLOCKER_REFINED"
    && workspaceIaLiveCurrent
    && readBoolean(workspaceIaLiveRefinement.routeSplitAloneAcceptedAsFix) === false
    && readBoolean(workspaceIaLiveRefinement.providerDispatchLiveClaimed) === false
    && readNumber(workspaceIaClosedDocsDesktopShort.bodyHeight) === 723
    && readNumber(workspaceIaClosedDocsDesktopShort.viewportHeight) === 723
    && readNumber(workspaceIaClosedDocsDesktopShort.documentWorkbenchBottom) <= 723
    && readBoolean(workspaceIaClosedDocsDesktopShort.overflowX) === false
    && readNumber(workspaceIaClosedDocsDesktopShort.outside) === 0
    && readNumber(workspaceIaClosedDocsMobile.bodyHeight) === 844
    && readNumber(workspaceIaClosedDocsMobile.viewportHeight) === 844
    && readNumber(workspaceIaClosedDocsMobile.documentWorkbenchBottom) <= 844
    && readBoolean(workspaceIaClosedDocsMobile.overflowX) === false
    && readNumber(workspaceIaClosedDocsMobile.outside) === 0
    && readNumber(workspaceIaClosedShareDesktopShort.bodyHeight) === 723
    && readNumber(workspaceIaClosedShareDesktopShort.viewportHeight) === 723
    && readNumber(workspaceIaClosedShareDesktopShort.shareRootBottom) <= 723
    && readNumber(workspaceIaClosedShareDesktopShort.shareFormWidth) >= 600
    && readNumber(workspaceIaClosedShareDesktopShort.sharePreviewWidth) >= 500
    && readNumber(workspaceIaClosedShareDesktopShort.primaryCtaBottom) <= 723
    && readBoolean(workspaceIaClosedShareDesktopShort.overflowX) === false
    && readNumber(workspaceIaClosedShareDesktopShort.outside) === 0
    && readNumber(workspaceIaClosedShareMobile.bodyHeight) === 844
    && readNumber(workspaceIaClosedShareMobile.viewportHeight) === 844
    && readNumber(workspaceIaClosedShareMobile.shareRootBottom) <= 844
    && readNumber(workspaceIaClosedShareMobile.previewBottom) <= 844
    && readNumber(workspaceIaClosedShareMobile.primaryCtaBottom) <= 844
    && readBoolean(workspaceIaClosedShareMobile.overflowX) === false
    && readNumber(workspaceIaClosedShareMobile.outside) === 0
    && readNumber(workspaceIaSelectedEditorDesktopShort.bodyHeight) !== null
    && readNumber(workspaceIaSelectedEditorDesktopShort.viewportHeight) === 723
    && readNumber(workspaceIaSelectedEditorDesktopShort.bodyHeight) > 723
    && readNumber(workspaceIaSelectedEditorDesktopShort.documentTextareaBottom) > 723
    && readNumber(workspaceIaSelectedEditorMobile.bodyHeight) !== null
    && readNumber(workspaceIaSelectedEditorMobile.viewportHeight) === 844
    && readNumber(workspaceIaSelectedEditorMobile.bodyHeight) > 844
    && readNumber(workspaceIaSelectedEditorMobile.documentTextareaBottom) > 844
    && readBoolean(workspaceIaShareNarrowCard.rawGeometryClosed) === true;

  const workspaceEditorDetailLandingPass = readString(workspaceEditorDetailLanding.verdict) === "PASS_LIVE_PRODUCTION_FIELD_LEVEL"
    && editorDetailLiveCurrent
    && readBoolean(workspaceEditorDetailLanding.routeSplitAloneAcceptedAsFix) === false
    && readBoolean(workspaceEditorDetailLanding.providerDispatchLiveClaimed) === false
    && readBoolean(workspaceEditorDetailLanding.fullRawTextareaVisibilityClaimed) === false
    && readBoolean(workspaceEditorDetailLanding.selectedEditorFieldLevelLandingProven) === true
    && readBoolean(workspaceEditorDetailLanding.longRawTextareaRemainsSecondary) === true
    && readNumber(editorDetailDesktopShort.viewportHeight) === 723
    && readNumber(editorDetailDesktopShort.firstRiskRowHeaderBottom) <= 723
    && readNumber(editorDetailDesktopShort.firstRiskHazardFieldBottom) <= 723
    && readNumber(editorDetailDesktopShort.documentTextareaTop) > 723
    && readBoolean(editorDetailDesktopShort.rowHeaderTextContainsEvidence) === true
    && readBoolean(editorDetailDesktopShort.rowHeaderTextContainsVerification) === true
    && readNumber(editorDetailMobile.viewportHeight) === 844
    && readNumber(editorDetailMobile.firstRiskRowHeaderBottom) <= 844
    && readNumber(editorDetailMobile.firstRiskHazardFieldBottom) <= 844
    && readNumber(editorDetailMobile.documentTextareaTop) > 844
    && readBoolean(editorDetailMobile.rowHeaderTextContainsEvidence) === true
    && readBoolean(editorDetailMobile.rowHeaderTextContainsVerification) === true
    && editorDetailAcceptance.riskRowHeaderInsideViewport === true
    && editorDetailAcceptance.firstHazardFieldInsideViewport === true
    && editorDetailAcceptance.rowHeaderShowsEvidenceAndVerification === true
    && editorDetailAcceptance.textareaSecondaryBelowFirstWorkSurface === true
    && editorDetailAcceptance.backendProviderExportContractsTouched === false;

  const selectedEditorCockpitPass = readString(documentsSelectedEditorCockpit.verdict) === "PASS_LIVE_PRODUCTION"
    && selectedEditorSourceCurrent
    && readBoolean(selectedEditorScope.productionLiveClaimed) === true
    && readBoolean(selectedEditorScope.providerDispatchLiveClaimed) === false
    && readBoolean(selectedEditorScope.fullDocumentIaClaimed) === false
    && readBoolean(selectedEditorScope.routeSplitAloneAcceptedAsFix) === false
    && readBoolean(selectedEditorContracts.fieldSummaryBeforeRawTextarea) === true
    && readBoolean(selectedEditorContracts.evidenceRecheckActionsBeforeRawTextarea) === true
    && readBoolean(selectedEditorContracts.mobileActionsBottomWithinFirstViewport) === true
    && readBoolean(selectedEditorContracts.rawTextareaSecondary) === true
    && readBoolean(selectedEditorContracts.canonicalRiskRowContractsPreserved) === true
    && readString(selectedEditorBuild.commitSha) === selectedEditorSourceSha
    && readString(selectedEditorBuild.branch) === "master"
    && readString(selectedEditorBuild.environment) === "production"
    && readNumber(selectedEditorDesktopShort.viewportHeight) === 723
    && readNumber(selectedEditorDesktopShortActions.bottom) <= 640
    && readNumber(selectedEditorDesktopShortTextarea.top) > 723
    && readBoolean(selectedEditorDesktopShort.horizontalOverflow) === false
    && readNumber(selectedEditorDesktopShort.outsideHorizontalElements) === 0
    && readNumber(selectedEditorMobile.viewportHeight) === 844
    && readNumber(selectedEditorMobileActions.bottom) <= 760
    && readNumber(selectedEditorMobileHazard.bottom) <= 844
    && readNumber(selectedEditorMobileTextarea.top) > 844
    && readBoolean(selectedEditorMobile.horizontalOverflow) === false
    && readNumber(selectedEditorMobile.outsideHorizontalElements) === 0;

  const workspaceIaCurrentPass = readString(workspaceIaCurrentReport.verdict) === "IA_BLOCKER_REFINED_CURRENT_LIVE"
    && workspaceIaCurrentLiveIsAncestor
    && readBoolean(workspaceIaCurrentReport.routeSplitAloneAcceptedAsFix) === false
    && readBoolean(workspaceIaCurrentReport.providerDispatchLiveClaimed) === false
    && readNumber(workspaceIaCurrentDocsDesktopShort.bodyHeight) === 723
    && readNumber(workspaceIaCurrentDocsDesktopShort.viewportHeight) === 723
    && readNumber(workspaceIaCurrentDocsDesktopShort.documentWorkbenchBottom) <= 723
    && readNumber(workspaceIaCurrentDocsDesktopShort.visibleDocumentPreviews) === 0
    && readBoolean(workspaceIaCurrentDocsDesktopShort.overflowX) === false
    && readNumber(workspaceIaCurrentDocsDesktopShort.outside) === 0
    && readNumber(workspaceIaCurrentDocsMobile.bodyHeight) === 844
    && readNumber(workspaceIaCurrentDocsMobile.viewportHeight) === 844
    && readNumber(workspaceIaCurrentDocsMobile.documentWorkbenchBottom) <= 844
    && readNumber(workspaceIaCurrentDocsMobile.visibleDocumentPreviews) === 0
    && readBoolean(workspaceIaCurrentDocsMobile.overflowX) === false
    && readNumber(workspaceIaCurrentDocsMobile.outside) === 0
    && readNumber(workspaceIaCurrentShareDesktopShort.bodyHeight) === 723
    && readNumber(workspaceIaCurrentShareDesktopShort.viewportHeight) === 723
    && readNumber(workspaceIaCurrentShareDesktopShort.shareRootBottom) <= 723
    && readNumber(workspaceIaCurrentShareDesktopShort.shareFormWidth) >= 600
    && readNumber(workspaceIaCurrentShareDesktopShort.sharePreviewWidth) >= 500
    && readNumber(workspaceIaCurrentShareDesktopShort.previewBottom) <= 723
    && readNumber(workspaceIaCurrentShareDesktopShort.primaryCtaBottom) <= 723
    && readBoolean(workspaceIaCurrentShareDesktopShort.overflowX) === false
    && readNumber(workspaceIaCurrentShareDesktopShort.outside) === 0
    && readNumber(workspaceIaCurrentShareMobile.bodyHeight) === 844
    && readNumber(workspaceIaCurrentShareMobile.viewportHeight) === 844
    && readNumber(workspaceIaCurrentShareMobile.shareRootBottom) <= 844
    && readNumber(workspaceIaCurrentShareMobile.previewBottom) <= 844
    && readNumber(workspaceIaCurrentShareMobile.primaryCtaBottom) <= 844
    && readBoolean(workspaceIaCurrentShareMobile.overflowX) === false
    && readNumber(workspaceIaCurrentShareMobile.outside) === 0
    && readNumber(workspaceIaCurrentSelectedEditorDesktopShort.viewportHeight) === 723
    && readNumber(workspaceIaCurrentSelectedEditorDesktopShort.firstRiskRowHeaderBottom) <= 723
    && readNumber(workspaceIaCurrentSelectedEditorDesktopShort.firstRiskHazardFieldBottom) <= 723
    && readBoolean(workspaceIaCurrentSelectedEditorDesktopShort.rowHeaderTextContainsEvidence) === true
    && readBoolean(workspaceIaCurrentSelectedEditorDesktopShort.rowHeaderTextContainsVerification) === true
    && readNumber(workspaceIaCurrentSelectedEditorDesktopShort.rawTextareaTop) > 723
    && readNumber(workspaceIaCurrentSelectedEditorMobile.viewportHeight) === 844
    && readNumber(workspaceIaCurrentSelectedEditorMobile.firstRiskRowHeaderBottom) <= 844
    && readNumber(workspaceIaCurrentSelectedEditorMobile.firstRiskHazardFieldBottom) <= 844
    && readBoolean(workspaceIaCurrentSelectedEditorMobile.rowHeaderTextContainsEvidence) === true
    && readBoolean(workspaceIaCurrentSelectedEditorMobile.rowHeaderTextContainsVerification) === true
    && readNumber(workspaceIaCurrentSelectedEditorMobile.rawTextareaTop) > 844
    && readString(workspaceIaCurrentRawTextareaDepth.status) === "open_secondary_drilldown"
    && readString(workspaceIaCurrentShareNarrowWorkbench.status) === "optional_follow_up_if_reproduced";

  if (documentsPass && sharePass && shareChannelLabelPolishPass && workspaceIaRefinementPass && workspaceEditorDetailLandingPass && selectedEditorCockpitPass && workspaceIaCurrentPass && documentsCockpitWorkbenchGeometryPass && liveCurrentDocumentsShareGeometryPass && documentsMobileReviewLaunchPass && documentsTouchTargetsPass && documentSectionNavigationPass && documentAllAuthoringGeometryPass && documentAuthoringPaneMarginPass && documentRawDrilldownGeometryPass && documentRiskRowNavigationPass && documentRiskRowMobileOrderPass && documentRiskRowMobileLabelPass && documentRiskRowMobileDensityPass && documentRiskRowAddTouchPass) {
    return gateResult({
      id: "ui_documents_share_cockpit",
      label: "Documents and Share cockpit UI",
      state: "proven",
      evidencePath: liveCurrentDocumentsShareGeometryPath,
      detail: "Scoped first-task cockpit proof only, not full Documents/Share IA completion: live /documents?theme=day geometry now directly proves the selected-document cockpit/workbench is not the stale stacked layout at 1440x723 and 390x723, with 12 unique document keys, exactly 3 visible core launchers, 9 supporting launchers kept inside the closed disclosure, 0 visible supporting launchers by default, and the legacy document index hidden. The current-production companion additionally records the mobile risk-row shell containment remediation from 327/360px to 327/327px, with the active risk row at 264/264px and no visual horizontal scrollbar at exactly 390x723; its same live snapshot retains a three-column 1440x723 Workspace Share workbench, a separate one-column mobile cockpit, and exact saved Share as MISSING_EVIDENCE. A live companion also proves the mobile document-review launcher overlap moved from 1 to 0, the three core launchers remain unobstructed, the review control remains 44px tall inside the 390x723 viewport, desktop/mobile body ratio remains 1.00, and exact saved Share remains MISSING_EVIDENCE. A separate live Day/Night desktop/mobile touch contract proves 4/4 viewport-contained cases with 44px section actions, 44px risk-row selectors, and a 44x44 human-review close control while supporting documents remain collapsed and exact saved Share remains MISSING_EVIDENCE. Live Day/Night section-navigation evidence additionally proves the selected Work Plan exposes 6 readable section tabs with exactly 1 selected tab, 6 filled states, 44px minimum controls, two-line labels, shell ratio <= 3, and first action containment across 1440x723 and 390x723. Live all-document selected-authoring geometry further covers all 12 canonical documents in 48/48 rows across Day/Night desktop-short/mobile-short, with at most one role-specific cockpit, internal cockpit scrolling, first action inside the viewport, and raw/source editors hidden by default; the foreign-worker briefing no longer stacks education and transmission cockpits. The earlier pane-margin companion reduced rows below its historical 16px contract from 44/48 to 0/48; the current all-document contract now requires and proves a 32px minimum inner-pane margin in all 48/48 rows while keeping the maximum shell ratio at 2.36 in aligned live production. A separate live 48/48 raw-source drilldown contract now proves every canonical document opens exactly one source editor inside the viewport with a bounded 258px editor, local source scrolling, shell ratio <= 2.25, and no horizontal overflow across the same Day/Night desktop-short/mobile-short matrix. Live risk-row navigation adds 4/4 Day/Night desktop-short/mobile-short cases with 3/3 hazard-first visible labels, task context preserved in accessible names and tooltips, shell ratio <= 2.23, and no horizontal overflow. A companion live mobile-order contract proves the selector rail precedes the active editor in all 4/4 cases; a second live mobile-label contract keeps all three 390px selectors visually distinct with an unclipped accident type plus hazard cue while preserving each full hazard in its accessible name and title, body height 728px, first hazard bottom 703px, and shell ratio 2.11. A current live five-row density companion further reduces the 390x723 selector rail from two rows/94px to one horizontal row/46px in Day and Night, keeps all five controls at 44px, and brings the active hazard field bottom to 667px without page overflow. The latest live touch companion separately restores the mobile + 위험 항목 action from 32px to 44px in Day and Night at exactly 390x723 while keeping body height 723px, horizontal overflow 0, and the selected editor shell on local auto scrolling. Default /workspace Documents and Share cockpits, /documents mobile first-action containment, exact one-viewport Documents review cockpit, selected-document context/summary layers, selected editor/detail field-summary risk-row landing, selected-editor field summary plus evidence/recheck CTA before raw textarea, one-section document drilldown accordion, production-confirmed inner-pane default depth, selected-section field/evidence/recheck affordance, and live 12 document first-task cockpits before long raw editors remain scoped. Live Workspace Share now separately proves a 1440px three-zone cockpit, including desktop-short 1440x723, with an 1180px workspace step rail, zero overflowing step-status labels, the status/provenance rail inside the first viewport, and a 390x723 mobile stack with that rail hidden; the cross-session UI integration is present in product history and the desktop 메일, 문자, and 카카오 channel labels each remain on one nowrap line in 159px cards. The invited recipient fixture retains a separate desktop two-zone contract. It also keeps desktop-short Share containment, staged Share rail, live mobile selected-summary/preview/primary CTA/config toggle, collapsed mobile configuration stack, provider-result summary inside the first viewport, mobile Share exact 844px viewport containment, and /share/[sessionId] desktop recipient confirmation cockpit with mobile confirmation CTA before document details. This is not a claim that the whole Documents page is short; raw/source editing remains an explicit secondary drilldown and is now live-bounded, while deeper row/detail editing and broad human wording review remain separate. It also does not prove exact saved/generated Share, provider live dispatch, or route/page split alone as the UX fix.",
      nextActions: [
        "Keep the live selected-authoring and raw-source matrices as scoped containment claims; do not phrase them as the whole Documents page being short or completed human wording review.",
        "Keep raw/source editing as an explicit live-bounded secondary drilldown and deeper row/detail editing as separate scope; selected-editor evidence/recheck CTA remains live-proven before raw editing.",
        "Keep risk-row selectors hazard-first and preserve full task context in accessible names and tooltips; repeated task names must not make separate hazards visually indistinguishable.",
        "Keep the next Documents product wave framed as bounded IA/density with a default exposure budget and local workbench shell ratio target <= 3; do not use route split alone as the fix.",
        "Keep Documents acceptance focused on simultaneous exposure: first viewport shows current status, core 3 launcher, selected document workbench, validation/recheck action, and only local-scroll/drilldown for long source, section, evidence, and supporting-9 content.",
        "Keep route/page split framed as orientation only; the UX contract is three-step app shell plus first-viewport cockpit plus bounded drilldown/detail containment.",
        "Keep the live Workspace Share three-zone desktop cockpit and 390x723 mobile stack as scoped route evidence with desktop width-ratio/grid metrics; /share/[sessionId] recipient cockpit geometry is live-proven only for the invited-session fixture, not the exact saved user session.",
        "Keep Share desktop acceptance as a 2-3 region cockpit for recipient/channel/status/provenance, selected language/message preview, and send/export lock; mobile single-column summaries are allowed only under mobile breakpoints.",
        "Keep Share UI evidence split by route/state: invited recipient fixture, exact saved/generated /share/[sessionId], and manager/workspace share-result each need their own geometry before closing user-specific mobile-like complaints.",
      ],
    });
  }

  return gateResult({
    id: "ui_documents_share_cockpit",
    label: "Documents and Share cockpit UI",
    state: "contradicted",
    evidencePath: !workspaceIaRefinementPass ? workspaceIaLiveRefinementPath : !workspaceEditorDetailLandingPass ? workspaceEditorDetailLandingPath : !selectedEditorCockpitPass ? documentsSelectedEditorCockpitPath : !workspaceIaCurrentPass ? workspaceIaLiveCurrentPath : !documentsCockpitWorkbenchGeometryPass ? documentsCockpitWorkbenchGeometryPath : !liveCurrentDocumentsShareGeometryPass ? liveCurrentDocumentsShareGeometryPath : !documentsMobileReviewLaunchPass ? documentsMobileReviewLaunchPath : !documentsTouchTargetsPass ? documentsTouchTargetsPath : !documentSectionNavigationPass ? documentSectionNavigationPath : !documentAllAuthoringGeometryPass ? documentAllAuthoringGeometryPath : !documentAuthoringPaneMarginPass ? documentAuthoringPaneMarginPath : !documentRawDrilldownGeometryPass ? documentRawDrilldownGeometryPath : !documentRiskRowNavigationPass ? documentRiskRowNavigationPath : !documentRiskRowMobileOrderPass ? documentRiskRowMobileOrderPath : !documentRiskRowMobileLabelPass ? documentRiskRowMobileLabelPath : !documentRiskRowMobileDensityPass ? documentRiskRowMobileDensityPath : !documentRiskRowAddTouchPass ? documentRiskRowAddTouchPath : !shareDesktopPerceptionPass ? shareDesktopPerceptionPath : !shareChannelLabelPolishPass ? shareChannelLabelPolishPath : documentsPass ? shareDesktopShortPath : documentsMobileExactCockpitPath,
    detail: `Documents/share cockpit evidence no longer proves bounded page height, the 12/3/9/0 default document exposure budget, selected Work Plan section navigation, 48/48 all-document selected-authoring and raw-source containment, distinct hazard-first risk-row navigation, selector-before-editor mobile risk-row order, distinct unclipped mobile risk-row labels, five-row mobile risk-row density, 44px mobile add-risk-row action, exact mobile Documents cockpit, first-viewport share action, share recipient cockpit geometry, live single-line desktop channel labels, and the latest IA refinement together. documentRiskRowMobileDensity=${documentRiskRowMobileDensityPass}; documentRiskRowAddTouch=${documentRiskRowAddTouchPass}; shareChannelLabelPolish=${shareChannelLabelPolishPass}.`,
    nextActions: ["Re-run documents/share browser geometry gates, promote exact Documents cockpit only after live production verification, refresh the workspace IA refinement, editor detail landing, and share recipient cockpit evidence, and fix any UI cockpit regression."],
  });
}

/**
 * @param {string} rootDir
 * @returns {GateResult}
 */
function evaluateDispatchStandaloneCockpitGate(rootDir) {
  const evidencePath = EVIDENCE_PATHS.dispatchStandalone;
  const viewportEvidencePath = EVIDENCE_PATHS.dispatchStandaloneViewport;
  const containmentEvidencePath = EVIDENCE_PATHS.dispatchFirstViewportContainment;
  const report = readJsonFile(rootDir, evidencePath);
  const viewportReport = readJsonFile(rootDir, viewportEvidencePath);
  const containmentReport = readJsonFile(rootDir, containmentEvidencePath);
  if (!isRecord(report) || !isRecord(viewportReport) || !isRecord(containmentReport)) {
    return gateResult({
      id: "dispatch_standalone_cockpit",
      label: "Standalone dispatch viewport cockpit",
      state: "missing",
      evidencePath: !isRecord(report) ? evidencePath : !isRecord(viewportReport) ? viewportEvidencePath : containmentEvidencePath,
      detail: "Standalone dispatch desktop, viewport, or first-viewport containment companion report is missing or invalid.",
      nextActions: ["Run the standalone /dispatch desktop-short and mobile-short cockpit gates, including hidden root-scroll debt, before claiming dispatch UI closure."],
    });
  }

  const acceptance = isRecord(report.acceptance) ? report.acceptance : {};
  const production = isRecord(report.production) ? report.production : {};
  const productionMetrics = isRecord(production.metrics) ? production.metrics : {};
  const sampleShellFollowUp = isRecord(report.sampleShellFollowUp) ? report.sampleShellFollowUp : {};
  const sampleProduction = isRecord(sampleShellFollowUp.productionVerification)
    ? sampleShellFollowUp.productionVerification
    : {};
  const sampleDesktop = isRecord(sampleProduction.desktop1440x900) ? sampleProduction.desktop1440x900 : {};
  const sampleMobile = isRecord(sampleProduction.mobile390x844) ? sampleProduction.mobile390x844 : {};
  const viewportProduction = isRecord(viewportReport.productionBuild) ? viewportReport.productionBuild : {};
  const viewportAfterLive = isRecord(viewportReport.afterLive) ? viewportReport.afterLive : {};
  const viewportDesktop = isRecord(viewportAfterLive.desktopShort) ? viewportAfterLive.desktopShort : {};
  const viewportMobileDay = isRecord(viewportAfterLive.mobileShortDay) ? viewportAfterLive.mobileShortDay : {};
  const viewportMobileNight = isRecord(viewportAfterLive.mobileShortNight) ? viewportAfterLive.mobileShortNight : {};
  const viewportAcceptance = isRecord(viewportReport.acceptanceContract) ? viewportReport.acceptanceContract : {};
  const viewportMutation = isRecord(viewportReport.mutationBoundary) ? viewportReport.mutationBoundary : {};
  const viewportBoundaries = isRecord(viewportReport.remainingBoundaries) ? viewportReport.remainingBoundaries : {};
  const containmentBefore = isRecord(containmentReport.beforeLive) ? containmentReport.beforeLive : {};
  const containmentBeforeDesktop = isRecord(containmentBefore.desktopShort) ? containmentBefore.desktopShort : {};
  const containmentAfter = isRecord(containmentReport.afterLive) ? containmentReport.afterLive : {};
  const containmentDesktop = isRecord(containmentAfter.desktopShort) ? containmentAfter.desktopShort : {};
  const containmentDesktopDay = isRecord(containmentDesktop.day) ? containmentDesktop.day : {};
  const containmentDesktopNight = isRecord(containmentDesktop.night) ? containmentDesktop.night : {};
  const containmentMobile = isRecord(containmentAfter.mobileShort) ? containmentAfter.mobileShort : {};
  const containmentMobileDay = isRecord(containmentMobile.day) ? containmentMobile.day : {};
  const containmentMobileNight = isRecord(containmentMobile.night) ? containmentMobile.night : {};
  const containmentAcceptance = isRecord(containmentReport.acceptanceContract) ? containmentReport.acceptanceContract : {};
  const containmentMutation = isRecord(containmentReport.mutationBoundary) ? containmentReport.mutationBoundary : {};
  const containmentBoundaries = isRecord(containmentReport.remainingBoundaries) ? containmentReport.remainingBoundaries : {};
  const productionVerified = production.liveVerified === true
    && readString(production.commitSha)
    && isGitAncestor(rootDir, readString(production.commitSha));
  const sampleProductionVerified = sampleProduction.liveVerified === true
    && readString(sampleProduction.commitSha)
    && isGitAncestor(rootDir, readString(sampleProduction.commitSha));
  const viewportProductionVerified = readString(viewportReport.sourceHead) === readString(viewportProduction.commitSha)
    && readString(viewportProduction.commitSha)
    && isGitAncestor(rootDir, readString(viewportProduction.commitSha));
  const containmentProductionVerified = readString(containmentReport.sourceHead) === readString(containmentReport.productCommit)
    && readString(containmentReport.productCommit) === readString(containmentReport.productionCommit)
    && readString(containmentReport.productionCommit)
    && isGitAncestor(rootDir, readString(containmentReport.productionCommit));
  const containmentDesktopRowsPass = [containmentDesktopDay, containmentDesktopNight].every((row) => {
    const widths = Array.isArray(row.channelCardWidths) ? row.channelCardWidths.map(readNumber) : [];
    const tops = Array.isArray(row.channelCardTops) ? row.channelCardTops.map(readNumber) : [];
    return readNumber(row.viewportHeight) === 723
      && readNumber(row.rootScrollDebt) !== null
      && (readNumber(row.rootScrollDebt) || 0) <= 1
      && readNumber(row.primaryBottom) !== null
      && (readNumber(row.primaryBottom) || 0) <= 723
      && readNumber(row.previewBottom) !== null
      && (readNumber(row.previewBottom) || 0) <= 723
      && readNumber(row.channelActionBottom) !== null
      && (readNumber(row.channelActionBottom) || 0) <= 723
      && readNumber(row.horizontalOverflow) === 0
      && widths.length === 3
      && widths.every((width) => width !== null && width >= 150)
      && tops.length === 3
      && new Set(tops).size === 1;
  });
  const containmentMobileRowsPass = [containmentMobileDay, containmentMobileNight].every((row) => (
    readNumber(row.viewportHeight) === 723
    && readNumber(row.summaryBottom) !== null
    && (readNumber(row.summaryBottom) || 0) <= 723
    && readNumber(row.primaryBottom) !== null
    && (readNumber(row.primaryBottom) || 0) <= 723
    && readNumber(row.visibleConfigCardCount) === 0
    && readNumber(row.horizontalOverflow) === 0
  ));
  const containmentPass = readString(containmentReport.verdict) === "PASS_LIVE_PRODUCTION_STANDALONE_DISPATCH_FIRST_VIEWPORT_CONTAINMENT"
    && containmentProductionVerified
    && readString(containmentBefore.verdict) === "RED_DESKTOP_CONTROLS_HIDDEN_IN_INTERNAL_SCROLL_MOBILE_CARD_METAPHOR"
    && readNumber(containmentBeforeDesktop.rootScrollDebt) !== null
    && (readNumber(containmentBeforeDesktop.rootScrollDebt) || 0) > 1
    && readNumber(containmentBeforeDesktop.channelActionBottom) !== null
    && (readNumber(containmentBeforeDesktop.channelActionBottom) || 0) > 723
    && readNumber(containmentAfter.total) === 4
    && readNumber(containmentAfter.pass) === 4
    && readNumber(containmentAfter.fail) === 0
    && containmentDesktopRowsPass
    && containmentMobileRowsPass
    && readNumber(containmentDesktopDay.titleFontSize) !== null
    && (readNumber(containmentDesktopDay.titleFontSize) || 0) <= 20
    && readNumber(containmentDesktopDay.statusReasonFontSize) !== null
    && (readNumber(containmentDesktopDay.statusReasonFontSize) || 0) <= 14
    && readNumber(containmentDesktopDay.channelHeadingFontSize) !== null
    && (readNumber(containmentDesktopDay.channelHeadingFontSize) || 0) <= 14
    && readBoolean(containmentAcceptance.routeSplitAloneAcceptedAsFix) === false
    && readBoolean(containmentAcceptance.desktopRequiresTwoPaneWorkbench) === true
    && readBoolean(containmentAcceptance.desktopRootScrollDebtAtMostOnePixel) === true
    && readBoolean(containmentAcceptance.desktopPrimaryPreviewAndChannelActionsInFirstViewport) === true
    && readBoolean(containmentAcceptance.desktopChannelCardsUseThreeReadableColumns) === true
    && readBoolean(containmentAcceptance.desktopComponentTypographyNotHeroTypography) === true
    && readBoolean(containmentAcceptance.mobilePrimaryActionContainedInFirstViewport) === true
    && readBoolean(containmentAcceptance.mobileConfigurationCollapsedByDefault) === true
    && readBoolean(containmentAcceptance.longPreviewUsesInternalScroll) === true
    && Object.values(containmentMutation).every((value) => value === false)
    && readString(containmentBoundaries.exactSavedShareVerdict) === "MISSING_EVIDENCE"
    && readBoolean(containmentBoundaries.exactSavedShareUserSessionReproduced) === false
    && readBoolean(containmentBoundaries.workspaceShareEvidenceSubstitutesForExactSavedSession) === false;
  const viewportPass = readString(viewportReport.verdict) === "PASS_LIVE_PRODUCTION_STANDALONE_DISPATCH_VIEWPORT_COCKPIT"
    && viewportProductionVerified
    && readString(viewportProduction.branch) === "master"
    && readString(viewportProduction.environment) === "production"
    && readNumber(viewportDesktop.viewport?.width) === 1440
    && readNumber(viewportDesktop.viewport?.height) === 723
    && readNumber(viewportDesktop.primaryBottom) !== null
    && readNumber(viewportDesktop.primaryBottom) <= 723
    && readNumber(viewportDesktop.previewBottom) !== null
    && readNumber(viewportDesktop.previewBottom) <= 723
    && readString(viewportDesktop.rootOverflowY) === "auto"
    && readNumber(viewportDesktop.rootScrollHeight) !== null
    && readNumber(viewportDesktop.rootClientHeight) !== null
    && readNumber(viewportDesktop.rootScrollHeight) >= readNumber(viewportDesktop.rootClientHeight)
    && readNumber(viewportDesktop.horizontalOverflow) === 0
    && [viewportMobileDay, viewportMobileNight].every((row) => (
      readNumber(row.viewport?.width) === 390
      && readNumber(row.viewport?.height) === 723
      && readNumber(row.primaryBottom) !== null
      && readNumber(row.primaryBottom) <= 723
      && readNumber(row.horizontalOverflow) === 0
    ))
    && readNumber(viewportMobileDay.visibleConfigCardCount) === 0
    && readString(viewportMobileDay.rootOverflowY) === "auto"
    && readBoolean(viewportAcceptance.routeSplitAloneAcceptedAsFix) === false
    && readBoolean(viewportAcceptance.desktopRequiresTwoPaneWorkbench) === true
    && readBoolean(viewportAcceptance.desktopPreviewContainedInFirstViewport) === true
    && readBoolean(viewportAcceptance.mobilePrimaryActionContainedInFirstViewport) === true
    && readBoolean(viewportAcceptance.longPreviewUsesInternalScroll) === true
    && readBoolean(viewportAcceptance.mobileConfigurationCollapsedByDefault) === true
    && readBoolean(viewportMutation.dbMutationPerformed) === false
    && readBoolean(viewportMutation.shareSessionCreated) === false
    && readBoolean(viewportMutation.providerDispatchCalled) === false
    && readBoolean(viewportMutation.embeddingOrVectorMutationPerformed) === false
    && readString(viewportBoundaries.exactSavedShareVerdict) === "MISSING_EVIDENCE"
    && readBoolean(viewportBoundaries.exactSavedShareUserSessionReproduced) === false;
  const pass = readString(report.verdict) === "PASS_PRODUCTION"
    && productionVerified
    && sampleProductionVerified
    && viewportPass
    && containmentPass
    && acceptance.pageHeightWithin135Viewport === true
    && acceptance.rootWidthAtLeast1040 === true
    && acceptance.primaryCtaInsideViewport === true
    && acceptance.previewInsideViewport === true
    && acceptance.previewRightOfPrimaryAction === true
    && acceptance.channelCardsReadableAndCompact === true
    && acceptance.horizontalOverflowClosed === true
    && readBoolean(productionMetrics.horizontalOverflow) === false
    && readNumber(productionMetrics.outside) === 0
    && readBoolean(sampleDesktop.wideStackClosed) === true
    && readNumber(sampleDesktop.horizontalOverflow) === 0
    && readNumber(sampleDesktop.firstPanel?.width) !== null
    && readNumber(sampleDesktop.secondPanel?.width) !== null
    && (readNumber(sampleDesktop.firstPanel?.width) || 0) <= 720
    && (readNumber(sampleDesktop.secondPanel?.width) || 0) <= 520
    && readBoolean(sampleMobile.singleColumn) === true
    && readNumber(sampleMobile.horizontalOverflow) === 0;

  if (pass) {
    const pageHeight = readNumber(productionMetrics.pageHeight);
    const heightRatio = readNumber(productionMetrics.heightRatio);
    return gateResult({
      id: "dispatch_standalone_cockpit",
      label: "Standalone dispatch viewport cockpit",
      state: "proven",
      evidencePath: containmentEvidencePath,
      detail: `Production /dispatch keeps the legacy desktop/mobile resilience proof and adds fail-closed first-viewport containment: hidden root scroll debt ${readNumber(containmentBeforeDesktop.rootScrollDebt) ?? "unknown"}->${readNumber(containmentDesktopDay.rootScrollDebt) ?? "unknown"}px, desktop Day/Night channel action bottom=${readNumber(containmentDesktopDay.channelActionBottom) ?? "unknown"}/${readNumber(containmentDesktopNight.channelActionBottom) ?? "unknown"}, three ${Array.isArray(containmentDesktopDay.channelCardWidths) ? containmentDesktopDay.channelCardWidths.join("/") : "unknown"}px channel columns, mobile Day/Night primary bottom=${readNumber(containmentMobileDay.primaryBottom) ?? "unknown"}/${readNumber(containmentMobileNight.primaryBottom) ?? "unknown"}, route split alone false, exact saved Share MISSING_EVIDENCE. Legacy seeded pageHeight ${pageHeight ?? "unknown"} (${heightRatio ?? "unknown"}x), sample panels ${readNumber(sampleDesktop.firstPanel?.width) ?? "unknown"}px/${readNumber(sampleDesktop.secondPanel?.width) ?? "unknown"}px.`,
      nextActions: [
        "Keep provider dispatch live-send claims gated until persistent idempotency and provider result persistence are approved.",
      ],
    });
  }

  return gateResult({
    id: "dispatch_standalone_cockpit",
    label: "Standalone dispatch viewport cockpit",
    state: "contradicted",
    evidencePath: !viewportPass ? viewportEvidencePath : !containmentPass ? containmentEvidencePath : evidencePath,
    detail: "Standalone dispatch reports no longer prove desktop two-pane, desktop-short hidden-scroll closure, first-viewport channel actions, mobile-short first action, compact controls, and exact-session non-closure together.",
    nextActions: ["Re-run standalone /dispatch desktop-short and mobile-short browser gates, including root scroll debt and channel action geometry, before claiming closure."],
  });
}

/**
 * @param {string} rootDir
 * @returns {GateResult}
 */
function evaluateDependencySecurityRemediationGate(rootDir) {
  const evidencePath = EVIDENCE_PATHS.dependencySecurityRemediation;
  const report = readJsonFile(rootDir, evidencePath);
  if (!isRecord(report)) {
    return gateResult({
      id: "dependency_security_remediation",
      label: "Runtime dependency security remediation",
      state: "missing",
      evidencePath,
      detail: "Dependency security remediation evidence is missing or invalid.",
      nextActions: ["Rerun the bounded lockfile audit and preserve every unresolved package finding."],
    });
  }

  const productionBuild = isRecord(report.productionBuild) ? report.productionBuild : {};
  const auditBefore = isRecord(report.auditBefore) ? report.auditBefore : {};
  const auditAfter = isRecord(report.auditAfter) ? report.auditAfter : {};
  const compatibilityBoundary = isRecord(report.compatibilityBoundary) ? report.compatibilityBoundary : {};
  const verification = isRecord(report.verification) ? report.verification : {};
  const mutationBoundary = isRecord(report.mutationBoundary) ? report.mutationBoundary : {};
  const remainingBoundaries = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  const updates = Array.isArray(report.updates) ? report.updates.filter(isRecord) : [];
  const residuals = Array.isArray(report.residuals) ? report.residuals.filter(isRecord) : [];
  const noMutation = mutationBoundary.dbMutationPerformed === false
    && mutationBoundary.shareSessionCreated === false
    && mutationBoundary.providerDispatchCalled === false
    && mutationBoundary.embeddingGenerated === false
    && mutationBoundary.vectorUploadPerformed === false
    && mutationBoundary.exactTrustRegistryMutationPerformed === false;
  const liveBoundedPass = readString(report.verdict) === "PASS_LIVE_PRODUCTION_DEPENDENCY_AUDIT_ZERO_FULL_SECURITY_SCAN_OPEN"
    && readString(report.sourceHead).length > 0
    && readString(report.sourceHead) === readString(productionBuild.commitSha)
    && productionBuild.sourceHeadMatchesProduction === true
    && readNumber(auditBefore.totalVulnerablePackages) === 19
    && readNumber(auditBefore.high) === 14
    && readNumber(auditBefore.moderate) === 5
    && readNumber(auditAfter.totalVulnerablePackages) === 0
    && readNumber(auditAfter.high) === 0
    && readNumber(auditAfter.moderate) === 0
    && readNumber(auditAfter.critical) === 0
    && auditAfter.productionOmitDevMatchesFullAudit === true
    && readNumber(auditAfter.automaticNonBreakingFixChangeCount) === 0
    && updates.length === 9
    && updates.some((item) => readString(item.package) === "@hono/node-server" && readString(item.after) === "2.0.12")
    && updates.some((item) => readString(item.package) === "fast-uri" && readString(item.after) === "3.1.4")
    && updates.some((item) => readString(item.package) === "sharp" && readString(item.after) === "0.35.3")
    && updates.some((item) => readString(item.package) === "uuid" && readString(item.after) === "11.1.1")
    && updates.some((item) => readString(item.package) === "archiver" && readString(item.after) === "8.0.0")
    && updates.some((item) => readString(item.package) === "unzipper" && readString(item.after) === "0.12.1")
    && residuals.length === 0
    && compatibilityBoundary.dependencyGraphValid === true
    && readString(compatibilityBoundary.mcpSdkKeptAt) === "1.26.0"
    && readString(compatibilityBoundary.honoOverride) === "2.0.12"
    && readString(compatibilityBoundary.fastUriOverride) === "3.1.4"
    && readString(compatibilityBoundary.sharpOverride) === "0.35.3"
    && readString(compatibilityBoundary.uuidOverride) === "11.1.1"
    && readString(compatibilityBoundary.archiverOverride) === "8.0.0"
    && readString(compatibilityBoundary.unzipperOverride) === "0.12.1"
    && readNumber(verification.runtimeDependencyOverrides?.testFiles) === 1
    && readNumber(verification.runtimeDependencyOverrides?.testsPassed) === 3
    && readNumber(verification.archiveRuntimeContracts?.testFiles) === 4
    && readNumber(verification.archiveRuntimeContracts?.testsPassed) === 23
    && verification.strictTypecheck === "PASS"
    && verification.build === "PASS"
    && readString(verification.nextVersion) === "15.5.22"
    && readNumber(verification.staticPagesGenerated) === 28
    && readNumber(verification.mcpRuntimeContracts?.testFiles) === 13
    && readNumber(verification.mcpRuntimeContracts?.testsPassed) === 170
    && readNumber(verification.localRuntimeSmoke?.mcpUnauthenticatedStatus) === 401
    && readNumber(verification.localRuntimeSmoke?.nextImageOptimizerStatus) === 200
    && readString(verification.localRuntimeSmoke?.nextImageOptimizerContentType) === "image/png"
    && noMutation
    && remainingBoundaries.liveAfterDeploymentRequired === false
    && remainingBoundaries.fullRepositorySecurityScanCompleted === false
    && readNumber(remainingBoundaries.residualVulnerablePackages) === 0
    && readString(remainingBoundaries.providerDispatchPersistence) === "approval_gated"
    && readString(remainingBoundaries.exactSavedShareVerdict) === "MISSING_EVIDENCE";

  if (liveBoundedPass) {
    return gateResult({
      id: "dependency_security_remediation",
      label: "Runtime dependency security remediation",
      state: "proven",
      evidencePath,
      detail: "Live runtime dependency remediation reduced the production lockfile audit from 19 findings to 0 while retaining ExcelJS 4.4.0 and verifying its patched archiver/unzipper write-read path. This is an npm dependency-audit claim, not a full repository security-scan or zero-risk product claim. No mutation occurred and exact saved Share remains MISSING_EVIDENCE.",
      nextActions: [
        "Use the separate full_repository_security_scan gate for repository-wide coverage; this dependency gate alone cannot support a broad security-complete claim.",
      ],
    });
  }

  return gateResult({
    id: "dependency_security_remediation",
    label: "Runtime dependency security remediation",
    state: "contradicted",
    evidencePath,
    detail: `Dependency verdict=${readString(report.verdict) || "unknown"}, sourceMatchesProduction=${readString(report.sourceHead) === readString(productionBuild.commitSha)}, before=${readNumber(auditBefore.totalVulnerablePackages)}, after=${readNumber(auditAfter.totalVulnerablePackages)}, residuals=${readNumber(remainingBoundaries.residualVulnerablePackages)}, fullScan=${remainingBoundaries.fullRepositorySecurityScanCompleted === true}, noMutation=${noMutation}, exactShare=${readString(remainingBoundaries.exactSavedShareVerdict) || "missing"}.`,
    nextActions: ["Restore the live bounded evidence and every unresolved dependency boundary before claiming remediation."],
  });
}

/**
 * @param {string} rootDir
 * @returns {GateResult}
 */
function evaluateTenantAuthorizationRemediationGate(rootDir) {
  const evidencePath = EVIDENCE_PATHS.tenantAuthorizationRemediation;
  const report = readJsonFile(rootDir, evidencePath);
  if (!isRecord(report)) {
    return gateResult({
      id: "tenant_authorization_remediation",
      label: "Tenant authorization remediation",
      state: "missing",
      evidencePath,
      detail: "Tenant authorization remediation evidence is missing or invalid.",
      nextActions: ["Restore the live tenant-bound persistence and archive-enrichment evidence before claiming these two findings remediated."],
    });
  }

  const productionBuild = isRecord(report.productionBuild) ? report.productionBuild : {};
  const summary = isRecord(report.summary) ? report.summary : {};
  const mutationBoundary = isRecord(report.mutationBoundary) ? report.mutationBoundary : {};
  const remainingBoundaries = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  const checks = Array.isArray(report.checks) ? report.checks : [];
  const noMutation = mutationBoundary.dbMutationPerformed === false
    && mutationBoundary.crossTenantExploitPerformed === false
    && mutationBoundary.migrationCreatedOrApplied === false
    && mutationBoundary.shareSessionCreated === false
    && mutationBoundary.providerDispatchCalled === false
    && mutationBoundary.embeddingGenerated === false
    && mutationBoundary.vectorUploadPerformed === false
    && mutationBoundary.wikiPublished === false
    && mutationBoundary.exactTrustRegistryMutationPerformed === false;
  const pass = readString(report.verdict) === "PASS_LIVE_PRODUCTION_TENANT_AUTHORIZATION_REMEDIATED_NO_MUTATION"
    && readString(report.sourceHead) === readString(summary.productPatchCommit)
    && readString(productionBuild.commitSha).length > 0
    && productionBuild.sourceHeadIsAncestorOfProduction === true
    && checks.length === 2
    && checks.every((item) => isRecord(item) && readString(item.status) === "GREEN" && item.remediatedWithoutMutation === true)
    && readNumber(summary.targetFindingCount) === 2
    && readNumber(summary.redCount) === 0
    && readNumber(summary.greenCount) === 2
    && noMutation
    && readNumber(remainingBoundaries.reportableFindingCount) === 16
    && remainingBoundaries.securityCompleteClaimAllowed === false
    && readString(remainingBoundaries.exactSavedShareVerdict) === "MISSING_EVIDENCE";

  return gateResult({
    id: "tenant_authorization_remediation",
    label: "Tenant authorization remediation",
    state: pass ? "proven" : "contradicted",
    evidencePath,
    detail: pass
      ? "Live production contains the tenant-bound scheduled persistence and archive site-enrichment fixes for 2/2 cross-tenant findings. The immutable baseline scan remains unchanged, no exploit or mutation was performed, 16 baseline findings remain before a full rescan, security-complete is false, and exact saved Share remains MISSING_EVIDENCE."
      : `Tenant remediation verdict=${readString(report.verdict) || "unknown"}, sourceAncestor=${productionBuild.sourceHeadIsAncestorOfProduction === true}, green=${readNumber(summary.greenCount)}/2, remaining=${readNumber(remainingBoundaries.reportableFindingCount)}, securityComplete=${remainingBoundaries.securityCompleteClaimAllowed === true}, noMutation=${noMutation}, exactShare=${readString(remainingBoundaries.exactSavedShareVerdict) || "missing"}.`,
    nextActions: pass
      ? ["Keep the immutable 18-finding scan as the baseline and run a full repository rescan only after the remaining remediation waves land."]
      : ["Restore every live provenance, finding-count, no-mutation, and non-closure predicate before claiming tenant remediation."],
  });
}

/**
 * @param {string} rootDir
 * @returns {GateResult}
 */
function evaluateSpreadsheetFormulaNeutralizationGate(rootDir) {
  const evidencePath = EVIDENCE_PATHS.spreadsheetFormulaNeutralization;
  const report = readJsonFile(rootDir, evidencePath);
  if (!isRecord(report)) {
    return gateResult({
      id: "spreadsheet_formula_neutralization",
      label: "Spreadsheet formula neutralization",
      state: "missing",
      evidencePath,
      detail: "Spreadsheet formula-neutralization evidence is missing or invalid.",
      nextActions: ["Restore the live CSV/TSV neutralization evidence before claiming the four formula-injection findings remediated."],
    });
  }

  const source = isRecord(report.source) ? report.source : {};
  const changes = isRecord(report.changes) ? report.changes : {};
  const findingClosure = isRecord(changes.findingClosure) ? changes.findingClosure : {};
  const mutationBoundary = isRecord(report.mutationBoundary) ? report.mutationBoundary : {};
  const remainingBoundaries = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  const wave = isRecord(report.wave) ? report.wave : {};
  const noMutation = mutationBoundary.dbMutationPerformed === false
    && mutationBoundary.crossTenantExploitPerformed === false
    && mutationBoundary.migrationCreatedOrApplied === false
    && mutationBoundary.shareSessionCreated === false
    && mutationBoundary.providerDispatchCalled === false
    && mutationBoundary.embeddingGenerated === false
    && mutationBoundary.vectorUploadPerformed === false
    && mutationBoundary.wikiPublished === false
    && mutationBoundary.exactTrustRegistryMutationPerformed === false;
  const pass = readString(report.verdict) === "PASS_LIVE_PRODUCTION_SPREADSHEET_FORMULA_NEUTRALIZATION"
    && readString(source.evidenceHead).length > 0
    && readString(source.evidenceHead) === readString(source.productionMarkerAtValidation)
    && readString(source.productionBranch) === "master"
    && readString(source.productionEnvironment) === "production"
    && readString(source.liveAfterProductDeploy) === "PASS"
    && readNumber(wave.findingCount) === 4
    && Array.isArray(wave.findingIds)
    && wave.findingIds.length === 4
    && readNumber(findingClosure.spreadsheetFormulaInjectionFindingsRemediatedInCurrentSource) === 4
    && readNumber(findingClosure.tenantAuthorizationFindingsPreviouslyRemediatedInCurrentSource) === 2
    && readNumber(findingClosure.remainingReportableFindingsBeforeFullRescan) === 12
    && findingClosure.fullRepositoryRescanCompleted === false
    && findingClosure.securityCompleteClaimAllowed === false
    && noMutation
    && remainingBoundaries.immutableFullRepositoryScanStillRecordsOriginal18Findings === true
    && remainingBoundaries.followUpFullRepositoryRescanRequired === true
    && readString(remainingBoundaries.exactSavedShareVerdict) === "MISSING_EVIDENCE";

  return gateResult({
    id: "spreadsheet_formula_neutralization",
    label: "Spreadsheet formula neutralization",
    state: pass ? "proven" : "contradicted",
    evidencePath,
    detail: pass
      ? "Live production neutralizes all 4 baseline CSV/TSV spreadsheet-formula findings through one shared encoder. Together with the prior 2 tenant findings, 6 baseline findings have bounded remediation evidence and 12 remain before a full rescan; the immutable 18-finding scan is preserved, security-complete is false, no mutation occurred, and exact saved Share remains MISSING_EVIDENCE."
      : `Formula remediation verdict=${readString(report.verdict) || "unknown"}, live=${readString(source.liveAfterProductDeploy) || "missing"}, remediated=${readNumber(findingClosure.spreadsheetFormulaInjectionFindingsRemediatedInCurrentSource)}, remaining=${readNumber(findingClosure.remainingReportableFindingsBeforeFullRescan)}, fullRescan=${findingClosure.fullRepositoryRescanCompleted === true}, securityComplete=${findingClosure.securityCompleteClaimAllowed === true}, noMutation=${noMutation}, exactShare=${readString(remainingBoundaries.exactSavedShareVerdict) || "missing"}.`,
    nextActions: pass
      ? ["Remediate the remaining public-provider/upstream and document-export budget findings, then run the full repository rescan before any security-complete claim."]
      : ["Restore every live provenance, finding-count, immutable-baseline, no-mutation, and non-closure predicate before claiming formula neutralization."],
  });
}

/**
 * @param {string} rootDir
 * @returns {GateResult}
 */
function evaluatePublicProviderWorkBudgetGate(rootDir) {
  const evidencePath = EVIDENCE_PATHS.publicProviderWorkBudget;
  const report = readJsonFile(rootDir, evidencePath);
  if (!isRecord(report)) {
    return gateResult({
      id: "public_provider_work_budget",
      label: "Public provider work budget",
      state: "missing",
      evidencePath,
      detail: "Public provider work-budget evidence is missing or invalid.",
      nextActions: ["Restore the live public-route budget and weather coalescing evidence before claiming these four findings remediated."],
    });
  }

  const source = isRecord(report.source) ? report.source : {};
  const changes = isRecord(report.changes) ? report.changes : {};
  const findingClosure = isRecord(changes.findingClosure) ? changes.findingClosure : {};
  const mutationBoundary = isRecord(report.mutationBoundary) ? report.mutationBoundary : {};
  const remainingBoundaries = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  const wave = isRecord(report.wave) ? report.wave : {};
  const noMutation = mutationBoundary.dbMutationPerformed === false
    && mutationBoundary.crossTenantExploitPerformed === false
    && mutationBoundary.migrationCreatedOrApplied === false
    && mutationBoundary.shareSessionCreated === false
    && mutationBoundary.providerDispatchCalled === false
    && mutationBoundary.productionProviderLoadTestPerformed === false
    && mutationBoundary.embeddingGenerated === false
    && mutationBoundary.vectorUploadPerformed === false
    && mutationBoundary.wikiPublished === false
    && mutationBoundary.exactTrustRegistryMutationPerformed === false;
  const pass = readString(report.verdict) === "PASS_LIVE_PRODUCTION_PUBLIC_PROVIDER_WORK_BUDGETS"
    && readString(source.evidenceHead).length > 0
    && readString(source.evidenceHead) === readString(source.productionMarkerAtValidation)
    && readString(source.productionBranch) === "master"
    && readString(source.productionEnvironment) === "production"
    && readString(source.liveAfterProductDeploy) === "PASS"
    && readNumber(wave.findingCount) === 4
    && Array.isArray(wave.findingIds)
    && wave.findingIds.length === 4
    && readNumber(findingClosure.publicProviderAndUpstreamFindingsRemediatedInCurrentSource) === 4
    && readNumber(findingClosure.tenantAuthorizationFindingsPreviouslyRemediatedInCurrentSource) === 2
    && readNumber(findingClosure.spreadsheetFormulaFindingsPreviouslyRemediatedInCurrentSource) === 4
    && readNumber(findingClosure.remainingReportableFindingsBeforeFullRescan) === 8
    && findingClosure.fullRepositoryRescanCompleted === false
    && findingClosure.securityCompleteClaimAllowed === false
    && noMutation
    && remainingBoundaries.immutableFullRepositoryScanStillRecordsOriginal18Findings === true
    && remainingBoundaries.followUpFullRepositoryRescanRequired === true
    && readString(remainingBoundaries.exactSavedShareVerdict) === "MISSING_EVIDENCE";

  return gateResult({
    id: "public_provider_work_budget",
    label: "Public provider work budget",
    state: pass ? "proven" : "contradicted",
    evidencePath,
    detail: pass
      ? "Live production fail-closes oversized Ask, knowledge, weather, and remediation work before downstream provider/API fan-out and coalesces equivalent weather misses. This remediates 4/4 provider-budget findings; 10 baseline findings now have bounded evidence and 8 remain before a full rescan. The immutable 18-finding scan is preserved, security-complete is false, no production load or mutation occurred, and exact saved Share remains MISSING_EVIDENCE."
      : `Provider-budget verdict=${readString(report.verdict) || "unknown"}, live=${readString(source.liveAfterProductDeploy) || "missing"}, remediated=${readNumber(findingClosure.publicProviderAndUpstreamFindingsRemediatedInCurrentSource)}, remaining=${readNumber(findingClosure.remainingReportableFindingsBeforeFullRescan)}, fullRescan=${findingClosure.fullRepositoryRescanCompleted === true}, securityComplete=${findingClosure.securityCompleteClaimAllowed === true}, noMutation=${noMutation}, exactShare=${readString(remainingBoundaries.exactSavedShareVerdict) || "missing"}.`,
    nextActions: pass
      ? ["Remediate the remaining 8 document-export work-budget findings, then run the full repository rescan before any security-complete claim."]
      : ["Restore every live provenance, finding-count, immutable-baseline, no-load/no-mutation, and non-closure predicate before claiming provider-budget remediation."],
  });
}

/**
 * @param {string} rootDir
 * @returns {GateResult}
 */
function evaluateDocumentExportWorkBudgetGate(rootDir) {
  const evidencePath = EVIDENCE_PATHS.documentExportWorkBudget;
  const report = readJsonFile(rootDir, evidencePath);
  if (!isRecord(report)) {
    return gateResult({
      id: "document_export_work_budget",
      label: "Document export work budget",
      state: "missing",
      evidencePath,
      detail: "Document export work-budget evidence is missing or invalid.",
      nextActions: ["Restore the live XLSX/HWP budget evidence before claiming the eight export findings remediated."],
    });
  }

  const productionBuild = isRecord(report.productionBuild) ? report.productionBuild : {};
  const wave = isRecord(report.wave) ? report.wave : {};
  const implementation = isRecord(report.implementation) ? report.implementation : {};
  const findingClosure = isRecord(report.findingClosure) ? report.findingClosure : {};
  const openBoundaries = isRecord(report.openBoundaries) ? report.openBoundaries : {};
  const noMutation = implementation.dbMutation === false
    && implementation.shareMutation === false
    && implementation.providerMutation === false
    && implementation.vectorMutation === false
    && implementation.wikiMutation === false
    && implementation.koshaRegistryMutation === false;
  const pass = readString(report.verdict) === "PASS_LIVE_PRODUCTION_DOCUMENT_EXPORT_WORK_BUDGETS"
    && readString(report.sourceHead) === readString(report.productCommit)
    && readString(productionBuild.commitSha).length > 0
    && productionBuild.productCommitIsAncestorOfProduction === true
    && readNumber(wave.findingCount) === 8
    && Array.isArray(wave.findingIds)
    && wave.findingIds.length === 8
    && readNumber(findingClosure.documentExportFindingsRemediatedInLiveProduction) === 8
    && readNumber(findingClosure.cumulativeBaselineFindingsWithBoundedRemediationEvidence) === 18
    && readNumber(findingClosure.remainingReportableFindingsBeforeFullRescan) === 0
    && findingClosure.fullRepositoryRescanCompleted === false
    && findingClosure.securityCompleteClaimAllowed === false
    && noMutation
    && openBoundaries.immutableFullRepositoryScanStillRecordsOriginal18Findings === true
    && openBoundaries.followUpFullRepositoryRescanRequired === true
    && openBoundaries.fullRepositorySecurityCompleteClaimAllowed === false
    && readString(openBoundaries.exactSavedShare) === "MISSING_EVIDENCE";

  return gateResult({
    id: "document_export_work_budget",
    label: "Document export work budget",
    state: pass ? "proven" : "contradicted",
    evidencePath,
    detail: pass
      ? "Live production bounds XLSX/HWP request bytes, document/row/nested-entry/field/rendered-cell work, and output bytes for all 8 export findings. All 18 immutable baseline findings now have bounded remediation evidence, but the follow-up full repository rescan is not complete, security-complete remains false, no mutation occurred, and exact saved Share remains MISSING_EVIDENCE."
      : `Export-budget verdict=${readString(report.verdict) || "unknown"}, liveAncestor=${productionBuild.productCommitIsAncestorOfProduction === true}, remediated=${readNumber(findingClosure.documentExportFindingsRemediatedInLiveProduction)}, cumulative=${readNumber(findingClosure.cumulativeBaselineFindingsWithBoundedRemediationEvidence)}, remaining=${readNumber(findingClosure.remainingReportableFindingsBeforeFullRescan)}, fullRescan=${findingClosure.fullRepositoryRescanCompleted === true}, securityComplete=${findingClosure.securityCompleteClaimAllowed === true}, noMutation=${noMutation}, exactShare=${readString(openBoundaries.exactSavedShare) || "missing"}.`,
    nextActions: pass
      ? ["Run the follow-up full repository security scan; do not claim security completion from per-wave remediation evidence alone."]
      : ["Restore every live provenance, 18/18 accounting, no-mutation, full-rescan-pending, and exact-Share boundary before claiming export-budget remediation."],
  });
}

/**
 * @param {string} rootDir
 * @returns {GateResult}
 */
function evaluateFullRepositorySecurityScanGate(rootDir) {
  const evidencePath = EVIDENCE_PATHS.fullRepositorySecurityScan;
  const report = readJsonFile(rootDir, evidencePath);
  if (!isRecord(report)) {
    return gateResult({
      id: "full_repository_security_scan",
      label: "Full repository security scan",
      state: "missing",
      evidencePath,
      detail: "Full repository security scan evidence is missing or invalid.",
      nextActions: ["Run the standard repository security scan and preserve every candidate disposition before claiming coverage completion."],
    });
  }

  const productionBuild = isRecord(report.productionBuild) ? report.productionBuild : {};
  const scan = isRecord(report.scan) ? report.scan : {};
  const severity = isRecord(scan.severity) ? scan.severity : {};
  const companionRemediation = isRecord(report.companionRemediation) ? report.companionRemediation : {};
  const mutationBoundary = isRecord(report.mutationBoundary) ? report.mutationBoundary : {};
  const remainingBoundaries = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  const noMutation = mutationBoundary.dbMutationPerformed === false
    && mutationBoundary.shareSessionCreated === false
    && mutationBoundary.providerDispatchCalled === false
    && mutationBoundary.embeddingGenerated === false
    && mutationBoundary.vectorUploadPerformed === false
    && mutationBoundary.wikiPublished === false
    && mutationBoundary.exactTrustRegistryMutationPerformed === false;
  const pass = readString(report.verdict) === "COMPLETED_FOLLOWUP_REPOSITORY_SECURITY_SCAN_OPEN_FINDINGS_AND_DEFERRED_REVIEW"
    && readString(report.sourceHead).length > 0
    && productionBuild.sourceHeadIsAncestorOfProduction === true
    && readString(scan.status) === "completed"
    && readString(scan.mode) === "repository"
    && readString(scan.inventoryStrategy) === "repository"
    && readString(scan.completeness) === "partial"
    && readString(scan.targetKind) === "git_revision"
    && readNumber(scan.fileCount) === 5241
    && readNumber(scan.reviewedTextCount) === 2673
    && readNumber(scan.binaryOrGeneratedAccountedCount) === 2568
    && readNumber(scan.candidateCount) === 32
    && readNumber(scan.reportableFindingCount) === 17
    && readNumber(scan.ignoredCandidateCount) === 8
    && readNumber(scan.deferredCandidateCount) === 1
    && readNumber(scan.validationSuppressedCount) === 5
    && readNumber(scan.validationNotApplicableCount) === 1
    && readNumber(severity.critical) === 0
    && readNumber(severity.high) === 0
    && readNumber(severity.medium) === 5
    && readNumber(severity.low) === 12
    && scan.finalizerCompleted === true
    && readNumber(scan.sealedArtifactCount) === 8
    && readNumber(companionRemediation.targetedFindingCount) === 4
    && readNumber(companionRemediation.sourceBoundedFindingCount) === 2
    && readNumber(companionRemediation.mitigatedWithDistributedRateResidualCount) === 2
    && readNumber(companionRemediation.livePublicQueryBudgetChecks) === 3
    && noMutation
    && remainingBoundaries.fullRepositorySecurityScanCompleted === true
    && remainingBoundaries.securityCompleteClaimAllowed === false
    && remainingBoundaries.remediationRequired === true
    && readNumber(remainingBoundaries.reportableFindingCount) === 17
    && readNumber(remainingBoundaries.deferredCandidateCount) === 1
    && readString(remainingBoundaries.coverageCompleteness) === "partial"
    && remainingBoundaries.distributedRateLimitResidual === true
    && readString(remainingBoundaries.exactSavedShareVerdict) === "MISSING_EVIDENCE"
    && readString(remainingBoundaries.providerDispatchPersistence) === "approval_gated";

  if (pass) {
    return gateResult({
      id: "full_repository_security_scan",
      label: "Follow-up full repository security scan",
      state: "proven",
      evidencePath,
      detail: "The sealed follow-up scan accounted for 5,241 tracked files and retained 17 reportable findings (5 medium, 12 low) plus one renderer-dependent candidate deferred in the immutable baseline. The companion no-DB wave bounded 2 findings and mitigated 2 public-search findings while retaining a distributed-rate residual; the later learning_export_renderer_security gate tracks the deferred candidate's current-source remediation separately. Scan completion is not a security-complete claim: coverage remains partial, remediation remains required, no mutation occurred, and exact saved Share remains MISSING_EVIDENCE.",
      nextActions: [
        "Resolve the remaining DB/RLS findings only through separately approved migration and live-isolation work; preserve the canonical renderer candidate as deferred until a future full scan reclassifies the separately proven current-source remediation.",
        "Add a distributed public-request budget before treating the two warm-instance search mitigations as fully closed, then rerun the repository scan before any security-complete claim.",
      ],
    });
  }

  return gateResult({
    id: "full_repository_security_scan",
    label: "Follow-up full repository security scan",
    state: "contradicted",
    evidencePath,
    detail: `Security scan verdict=${readString(report.verdict) || "unknown"}, sourceMatchesProduction=${readString(report.sourceHead) === readString(productionBuild.commitSha)}, completeness=${readString(scan.completeness) || "unknown"}, files=${readNumber(scan.fileCount)}, candidates=${readNumber(scan.candidateCount)}, reportable=${readNumber(scan.reportableFindingCount)}, deferred=${readNumber(scan.deferredCandidateCount)}, securityComplete=${remainingBoundaries.securityCompleteClaimAllowed === true}, noMutation=${noMutation}, exactShare=${readString(remainingBoundaries.exactSavedShareVerdict) || "missing"}.`,
    nextActions: ["Restore the sealed follow-up scan counts, partial-coverage/deferred boundary, companion remediation residuals, and explicit findings-open/no-mutation boundary before claiming scan completion."],
  });
}

/**
 * @param {string} rootDir
 * @returns {GateResult}
 */
function evaluateRepositorySecurityScanReconciliationGate(rootDir) {
  const evidencePath = EVIDENCE_PATHS.repositorySecurityScanReconciliation;
  const report = readJsonFile(rootDir, evidencePath);
  if (!isRecord(report)) {
    return gateResult({
      id: "repository_security_scan_reconciliation",
      label: "Repository security scan reconciliation",
      state: "missing",
      evidencePath,
      detail: "Repository security scan reconciliation evidence is missing or invalid.",
      nextActions: ["Reconcile the conflicting same-target scans without rewriting either canonical result."],
    });
  }

  const scans = Array.isArray(report.scans) ? report.scans.filter(isRecord) : [];
  const conflict = isRecord(report.sameTargetConflict) ? report.sameTargetConflict : {};
  const contradictions = Array.isArray(report.canonicalReceiptContradictions)
    ? report.canonicalReceiptContradictions.filter(isRecord)
    : [];
  const later = isRecord(report.laterSecurityChain) ? report.laterSecurityChain : {};
  const corrected = isRecord(report.correctedFreshScan) ? report.correctedFreshScan : {};
  const correctedSeverity = isRecord(corrected.severityCounts) ? corrected.severityCounts : {};
  const resolution = isRecord(report.requiredResolution) ? report.requiredResolution : {};
  const boundaries = isRecord(report.boundaries) ? report.boundaries : {};
  const noMutation = boundaries.dbMutationPerformed === false
    && boundaries.providerDispatchCalled === false
    && boundaries.shareSessionCreated === false
    && boundaries.vectorRuntimeMutationPerformed === false
    && boundaries.wikiPublicationPerformed === false
    && boundaries.koshaRegistryMutationPerformed === false;
  const partialScan = scans.find((scan) => readString(scan.scanId) === "8fe9c06a-018c-446f-aa98-1b37df95287a");
  const zeroScan = scans.find((scan) => readString(scan.scanId) === "03305068-49ff-4b73-8a24-84a91e64ff56");
  const pass = readString(report.verdict) === "PASS_CORRECTED_FRESH_CURRENT_SOURCE_SCAN_SEALED_OPEN_FINDINGS"
    && readString(report.targetRevision) === "f0c8a7be02becd53c21fb80842cf23c571f22b1f"
    && scans.length === 2
    && readNumber(partialScan?.reportableFindingCount) === 17
    && readNumber(partialScan?.deferredCandidateCount) === 1
    && readNumber(zeroScan?.reportableFindingCount) === 0
    && readNumber(zeroScan?.deferredCandidateCount) === 0
    && conflict.present === true
    && readNumber(conflict.findingCountDelta) === 17
    && conflict.zeroFindingClaimAcceptedForNorthstar === false
    && contradictions.length === 2
    && contradictions.some((item) => readString(item.surface) === "document_export_work_budgets")
    && contradictions.some((item) => readString(item.surface) === "archive_enrichment_membership")
    && readString(later.diffScanId) === "3f0107a8-e4a4-4a5b-be37-a28bcea8b05a"
    && readNumber(later.sealedFindingCount) === 3
    && readNumber(later.remediatedFindingCount) === 3
    && readNumber(later.deferredCandidateCount) === 2
    && later.securityCompleteClaimAllowed === false
    && readString(corrected.scanId) === "c4e9e2f1-7ce4-4313-a651-32205fca401f"
    && readString(corrected.targetRevision) === "910eccb713848aa4aee26f0c411ed0f07ada04a6"
    && readString(corrected.status) === "complete"
    && readString(corrected.mode) === "standard"
    && readString(corrected.coverageCompleteness) === "partial"
    && readNumber(corrected.reviewedSurfaceCount) === 4
    && readNumber(corrected.reportableFindingCount) === 14
    && readNumber(correctedSeverity.medium) === 8
    && readNumber(correctedSeverity.low) === 6
    && readNumber(corrected.deferredCandidateCount) === 9
    && corrected.sourceIncludesLaterProductCommit === true
    && corrected.machinePredicatesAlignedWithDispositions === true
    && corrected.securityCompleteClaimAllowed === false
    && resolution.correctedFreshFullRepositoryScanRequired === false
    && resolution.correctedFreshFullRepositoryScanCompleted === true
    && resolution.receiptPredicatesMustMatchDisposition === true
    && resolution.originalScansMustRemainImmutable === true
    && noMutation
    && readString(boundaries.exactSavedShareVerdict) === "MISSING_EVIDENCE"
    && boundaries.approvalGatedBoundariesPreserved === true;

  return gateResult({
    id: "repository_security_scan_reconciliation",
    label: "Repository security scan reconciliation",
    state: pass ? "proven" : "contradicted",
    evidencePath,
    detail: pass
      ? "The immutable f0c8a7be scans remain preserved at 17 findings / 1 deferred versus 0 / 0, and the zero-finding scan's two fail-open receipt contradictions remain rejected. Corrected Standard scan c4e9e2f1 is sealed at 910eccb7 with 14 open findings (8 medium, 6 low), partial coverage, and 9 deferred candidates. Reconciliation is proven, not security-complete: no mutation occurred and exact saved Share remains MISSING_EVIDENCE."
      : `Reconciliation verdict=${readString(report.verdict) || "unknown"}, scans=${scans.length}, conflict=${conflict.present === true}, zeroAccepted=${conflict.zeroFindingClaimAcceptedForNorthstar === true}, receiptContradictions=${contradictions.length}, laterFindings=${readNumber(later.sealedFindingCount)}, laterDeferred=${readNumber(later.deferredCandidateCount)}, freshScanRequired=${resolution.correctedFreshFullRepositoryScanRequired === true}, noMutation=${noMutation}, exactShare=${readString(boundaries.exactSavedShareVerdict) || "missing"}.`,
    nextActions: pass
      ? ["Remediate the 14 current-source findings and preserve all 9 deferred candidates; rerun after each bounded wave without rewriting the immutable baselines."]
      : ["Restore both immutable scan results, both receipt contradictions, the later diff-scan boundary, and the corrected-rescan requirement."],
  });
}

/**
 * @param {string} rootDir
 * @returns {GateResult}
 */
function evaluateCurrentSecurityRemediationLedgerGate(rootDir) {
  const evidencePath = EVIDENCE_PATHS.currentSecurityRemediationLedger;
  const report = readJsonFile(rootDir, evidencePath);
  if (!isRecord(report)) {
    return gateResult({
      id: "current_security_remediation_ledger",
      label: "Current security remediation ledger",
      state: "missing",
      evidencePath,
      detail: "The current 23-finding security remediation ledger is missing or invalid.",
      nextActions: ["Restore the current security remediation ledger without rewriting either immutable scan baseline."],
    });
  }

  const productionBuild = isRecord(report.productionBuild) ? report.productionBuild : {};
  const immutableBaselines = isRecord(report.immutableBaselines) ? report.immutableBaselines : {};
  const originalScan = isRecord(immutableBaselines.originalStandardScan) ? immutableBaselines.originalStandardScan : {};
  const currentScan = isRecord(immutableBaselines.currentFindingSet) ? immutableBaselines.currentFindingSet : {};
  const disposition = isRecord(report.findingDisposition) ? report.findingDisposition : {};
  const findings = Array.isArray(report.findings) ? report.findings.filter(isRecord) : [];
  const mutationBoundary = isRecord(report.mutationBoundary) ? report.mutationBoundary : {};
  const remainingBoundaries = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  const expectedFindingIds = new Set([
    "csf_32ed9bacd31d6e84ee96670c",
    "csf_60ae470f243100a5ceff1625",
    "csf_6ca85fcda2063dad372a1ba0",
    "csf_6003dccadac8eda2a4d965f1",
    "csf_db6606a70118268c2f1f9ed2",
    "csf_6c2ccea59dc8f8acd9414403",
    "csf_107c4ebc10082a6d894aedb4",
    "csf_72350152046c347d29921d05",
    "csf_6013fe31acab79c3e5823fe3",
    "csf_e9f6acc76158d6936fdc7ec1",
    "csf_2b1622ad26e5c29920dbee2f",
    "csf_fe92b01d367cd83f6f5a8db1",
    "csf_945cd27e0e1adc50b4c505e1",
    "csf_4ced3a81d9d5719a98310abe",
    "csf_0ab15ba3cb26ea2de42c969d",
    "csf_0b17ba1587b295e21dd8a141",
    "csf_7c6fb7d226f5f405b04f23f8",
    "csf_deda3425adf85884225538a4",
    "csf_e3ea8ca7f62b05b33d4beea2",
    "csf_5af1870f3c0d961bbbedb904",
    "csf_a993c141161ee9e601c1d09e",
    "csf_721663901ae58571bcc40d00",
    "csf_89fe636f990bbc8339535b55",
  ]);
  const actualFindingIds = new Set(findings.map((finding) => readString(finding.findingId)).filter(Boolean));
  const deployedSourceCount = findings.filter((finding) => readString(finding.disposition).startsWith("deployed_source_remediated")).length;
  const approvalGatedCount = findings.filter((finding) => readString(finding.disposition) === "approval_gated").length;
  const distributedRuntimeOpenCount = findings.filter((finding) => readString(finding.disposition) === "distributed_runtime_open").length;
  const receiptPathsValid = findings.every((finding) => {
    const receiptPath = readString(finding.receiptPath);
    return receiptPath.length > 0 && fs.existsSync(path.join(rootDir, receiptPath));
  });
  const noMutation = mutationBoundary.dbSchemaChanged === false
    && mutationBoundary.dbMutationPerformed === false
    && mutationBoundary.providerDispatchCalled === false
    && mutationBoundary.shareSessionCreated === false
    && mutationBoundary.vectorOrEmbeddingMutationPerformed === false
    && mutationBoundary.wikiPublicationPerformed === false
    && mutationBoundary.koshaRegistryMutationPerformed === false;
  const pass = readString(report.verdict) === "NOTICE_LIVE_DEPLOYED_SOURCE_SECURITY_REMEDIATION_LEDGER_OPEN_BOUNDARIES"
    && readString(report.sourceHead).length > 0
    && readString(report.sourceHead) === readString(productionBuild.commitSha)
    && readString(productionBuild.branch) === "master"
    && readString(productionBuild.environment) === "production"
    && readString(originalScan.scanId) === "8fe9c06a-018c-446f-aa98-1b37df95287a"
    && readNumber(originalScan.reportableFindingCount) === 17
    && readNumber(originalScan.deferredCandidateCount) === 1
    && originalScan.preserved === true
    && readString(currentScan.scanId) === "c98ffa84-9951-4f68-9e1d-11f456abe901"
    && readNumber(currentScan.findingCount) === 23
    && currentScan.preserved === true
    && readNumber(disposition.total) === 23
    && readNumber(disposition.deployedSourceRemediationCount) === 17
    && readNumber(disposition.unresolvedCount) === 6
    && readNumber(disposition.approvalGatedCount) === 3
    && readNumber(disposition.distributedRuntimeOpenCount) === 3
    && disposition.securityCompleteClaimAllowed === false
    && findings.length === 23
    && actualFindingIds.size === expectedFindingIds.size
    && [...expectedFindingIds].every((findingId) => actualFindingIds.has(findingId))
    && deployedSourceCount === 17
    && approvalGatedCount === 3
    && distributedRuntimeOpenCount === 3
    && receiptPathsValid
    && noMutation
    && remainingBoundaries.securityCompleteClaimAllowed === false
    && remainingBoundaries.freshFullRepositorySecurityScanRequiredForClosure === true
    && readString(remainingBoundaries.exactSavedShareVerdict) === "MISSING_EVIDENCE"
    && readString(remainingBoundaries.supabaseRlsLaunchIsolation) === "APPROVAL_GATED"
    && readString(remainingBoundaries.providerDispatchPersistence) === "APPROVAL_GATED"
    && readString(remainingBoundaries.sifEmbeddingRuntime) === "APPROVAL_GATED"
    && readString(remainingBoundaries.llmWikiPublication) === "APPROVAL_GATED"
    && readString(remainingBoundaries.koshaExactPromotion) === "APPROVAL_GATED";

  return gateResult({
    id: "current_security_remediation_ledger",
    label: "Current security remediation ledger",
    state: pass ? "notice" : "contradicted",
    evidencePath,
    detail: pass
      ? "The immutable 17-finding Standard scan and separate 23-finding current set remain preserved. Current live/source receipts classify 17/23 findings as deployed-source remediated and keep six findings visible: three approval-gated database boundaries and three distributed-runtime controls. This is not a security-complete claim; exact saved Share remains MISSING_EVIDENCE and provider, vector, wiki, and KOSHA promotion approvals remain closed."
      : `Current ledger verdict=${readString(report.verdict) || "missing"}, findings=${findings.length}, deployed=${deployedSourceCount}, approval=${approvalGatedCount}, distributed=${distributedRuntimeOpenCount}, receipts=${receiptPathsValid}, noMutation=${noMutation}, exactShare=${readString(remainingBoundaries.exactSavedShareVerdict) || "missing"}.`,
    nextActions: pass
      ? ["Close the three distributed-runtime controls with production configuration evidence and request separate approval before any database security migration or live canary."]
      : ["Restore the exact 23-finding ledger, receipt existence, immutable baselines, no-mutation boundary, and six open findings before using the current remediation count."],
  });
}

/**
 * @param {string} rootDir
 * @returns {GateResult}
 */
function evaluateDocumentEditorialReviewCockpitGate(rootDir) {
  const evidencePath = EVIDENCE_PATHS.documentEditorialReviewCockpit;
  const report = readJsonFile(rootDir, evidencePath);
  if (!isRecord(report)) {
    return gateResult({
      id: "document_editorial_review_cockpit",
      label: "Live 12-document human editorial review cockpit",
      state: "missing",
      evidencePath,
      detail: "The live document editorial review cockpit evidence is missing or invalid.",
      nextActions: ["Rerun the Day/Night desktop-short and mobile-short cockpit probe against current production."],
    });
  }

  const receipt = readJsonFile(rootDir, EVIDENCE_PATHS.documentEditorialReviewReceipt);

  const productionBuild = isRecord(report.productionBuild) ? report.productionBuild : {};
  const acceptance = isRecord(report.acceptanceContract) ? report.acceptanceContract : {};
  const reviewBoundary = isRecord(report.reviewBoundary) ? report.reviewBoundary : {};
  const mutationBoundary = isRecord(report.mutationBoundary) ? report.mutationBoundary : {};
  const storageFailureProbe = isRecord(report.storageFailureProbe) ? report.storageFailureProbe : {};
  const results = Array.isArray(report.results) ? report.results.filter(isRecord) : [];
  const desktopRows = results.filter((row) => readNumber(row.width) === 1440 && readNumber(row.height) === 723);
  const mobileRows = results.filter((row) => readNumber(row.width) === 390 && readNumber(row.height) === 723);
  const rowsPass = results.length === 4 && results.every((row) => {
    const before = isRecord(row.beforeCompletion) ? row.beforeCompletion : {};
    const after = isRecord(row.afterCompletion) ? row.afterCompletion : {};
    return readString(row.verdict) === "PASS"
      && readNumber(before.bodyHeight) === readNumber(before.viewportHeight)
      && readNumber(before.reviewDocumentCount) === 12
      && readNumber(before.uniqueDocumentCount) === 12
      && before.includesRiskAssessment === true
      && readNumber(before.checkboxCount) === 5
      && before.horizontalOverflow === false
      && readString(before.storageStatus) === "empty"
      && after.currentWorkpackUnchanged === true
      && readNumber(after.reviewerStorageKeyCount) === 1
      && readString(after.storageStatus) === "saved"
      && readNumber(after.apiRequestCount) === 0
      && readNumber(after.dialogScrollTop) === 0
      && readString(row.afterReload?.storageStatus) === "restored"
      && readString(row.afterReload?.reviewerInputValue) === "자동 검증 검토자"
      && readString(row.afterReload?.persistedReviewer) === "자동 검증 검토자";
  });
  const accessibilityPass = results.length === 4 && results.every((row) => {
    const accessibility = isRecord(row.accessibility) ? row.accessibility : {};
    return readString(accessibility.initialFocusLabel) === "문서 사람 검토 닫기"
      && accessibility.initialFocusIsCloseButton === true
      && accessibility.initialFocusInsideDialog === true
      && readString(accessibility.describedBy) === "document-editorial-review-description"
      && readString(accessibility.liveProgress) === "polite"
      && readString(accessibility.tablistOrientation) === "vertical"
      && readNumber(accessibility.tabCount) === 12
      && readNumber(accessibility.selectedTabCount) === 1
      && readNumber(accessibility.tabbableTabCount) === 1
      && accessibility.arrowNavigationPass === true
      && accessibility.homeNavigationPass === true
      && accessibility.tabpanelLinked === true
      && accessibility.dialogClosedOnEscape === true
      && accessibility.escapeRestoresLaunchFocus === true;
  });
  const sourceMatchesProduction = readString(report.sourceHead).length > 0
    && readString(report.sourceHead) === readString(productionBuild.commitSha)
    && report.sourceHeadMatchesProduction === true
    && readString(productionBuild.environment) === "production";
  const noMutation = mutationBoundary.dbMutationPerformed === false
    && mutationBoundary.providerDispatchCalled === false
    && mutationBoundary.shareSessionCreated === false
    && mutationBoundary.vectorRuntimeCalled === false
    && mutationBoundary.wikiPublished === false
    && mutationBoundary.koshaRegistryMutationPerformed === false
    && readString(mutationBoundary.exactSavedShareVerdict) === "MISSING_EVIDENCE";
  const boundaryPass = reviewBoundary.automatedInteractionOnly === true
    && reviewBoundary.humanReviewCompleted === false
    && reviewBoundary.localCompletionIsApproval === false
    && reviewBoundary.broadHumanWordingReviewRequired === true;
  const storagePass = report.storageFailureProbePass === true
    && readString(storageFailureProbe.verdict) === "PASS"
    && readString(storageFailureProbe.status) === "error"
    && storageFailureProbe.visible === true
    && readString(storageFailureProbe.message).includes("복원하거나 저장할 수 없습니다");
  const contractPass = readNumber(acceptance.canonicalDocumentCount) === 12
    && acceptance.includesRiskAssessment === true
    && readNumber(acceptance.reviewerCheckCount) === 5
    && readNumber(acceptance.desktopZones) === 3
    && readNumber(acceptance.mobileColumns) === 1
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
    && acceptance.escapeRestoresLaunchFocus === true;
  const geometryPass = desktopRows.length === 2
    && desktopRows.every((row) => readNumber(row.beforeCompletion?.workbenchColumns) === 3)
    && mobileRows.length === 2
    && mobileRows.every((row) => readNumber(row.beforeCompletion?.workbenchColumns) === 1);
  const receiptProductionBuild = isRecord(receipt?.productionBuild) ? receipt.productionBuild : {};
  const receiptAcceptance = isRecord(receipt?.acceptanceContract) ? receipt.acceptanceContract : {};
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
      && readNumber(row.bodyHeightBefore) === readNumber(viewport.height)
      && readNumber(row.bodyHeightAfter) === readNumber(viewport.height)
      && row.receiptLockedAtZero === true
      && row.reviewerInputVisible === true
      && row.horizontalOverflow === false
      && readNumber(dialog.left) >= 0
      && readNumber(dialog.top) >= 0
      && readNumber(dialog.right) <= readNumber(viewport.width)
      && readNumber(dialog.bottom) <= readNumber(viewport.height)
      && readString(checklist.overflowY) === "auto";
  });
  const receiptNoMutation = receiptMutationBoundary.dbMutationPerformed === false
    && receiptMutationBoundary.providerDispatchCalled === false
    && receiptMutationBoundary.shareSessionCreated === false
    && receiptMutationBoundary.vectorRuntimeCalled === false
    && receiptMutationBoundary.wikiPublished === false
    && receiptMutationBoundary.koshaRegistryMutationPerformed === false
    && readString(receiptMutationBoundary.exactSavedShareVerdict) === "MISSING_EVIDENCE";
  const receiptPass = isRecord(receipt)
    && readString(receipt.verdict) === "PASS_LIVE_PRODUCTION_DOCUMENT_EDITORIAL_REVIEW_RECEIPT"
    && readString(receipt.sourceHead).length > 0
    && readString(receipt.sourceHead) === readString(receiptProductionBuild.commitSha)
    && receipt.sourceHeadMatchesProduction === true
    && readString(receiptProductionBuild.environment) === "production"
    && receiptRowsPass
    && readNumber(receiptAcceptance.canonicalDocumentCount) === 12
    && readNumber(receiptAcceptance.reviewerCheckCount) === 5
    && receiptAcceptance.reviewerRequired === true
    && receiptAcceptance.receiptLockedBeforeAllDocuments === true
    && receiptAcceptance.currentTextFingerprintRequired === true
    && receiptAcceptance.editorialFindingsFingerprintRequired === true
    && receiptAcceptance.editorialFindingReviewRequired === true
    && receiptAcceptance.localDownloadOnly === true
    && receiptAcceptance.reviewerIdentityVerified === false
    && receiptAcceptance.serverRecorded === false
    && receiptAcceptance.approvalGranted === false
    && readString(receiptVerification.schemaVersion) === "safeclaw-document-editorial-review-receipt/v2"
    && readNumber(receiptVerification.documentCount) === 12
    && readNumber(receiptVerification.uniqueDocumentKeyCount) === 12
    && readNumber(receiptVerification.reviewerCheckCount) === 5
    && receiptVerification.checksComplete === true
    && receiptVerification.fingerprintsCurrent === true
    && receiptVerification.findingsBound === true
    && readString(receiptVerification.editorialFindingsFingerprint).length > 0
    && readNumber(receiptVerification.editorialFindingCount) > 0
    && receiptVerification.editorialFindingIdsRecorded === true
    && receiptVerification.editorialFindingCategoriesReconcile === true
    && receiptVerification.reviewerRecorded === true
    && receiptVerification.reviewedAtRecorded === true
    && receiptVerification.generationFingerprintRecorded === true
    && readNumber(receiptVerification.apiRequestCount) === 0
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
    && receiptNoMutation;
  const ready = readString(report.verdict) === "PASS_LIVE_PRODUCTION_DOCUMENT_EDITORIAL_REVIEW_COCKPIT"
    && readNumber(report.total) === 4
    && readNumber(report.pass) === 4
    && readNumber(report.fail) === 0
    && sourceMatchesProduction
    && rowsPass
    && accessibilityPass
    && geometryPass
    && contractPass
    && boundaryPass
    && storagePass
    && noMutation
    && receiptPass;

  if (ready) {
    return gateResult({
      id: "document_editorial_review_cockpit",
      label: "Live 12-document human editorial review cockpit",
      state: "proven",
      evidencePath,
      detail: "Live Day/Night desktop-short 1440x723 and mobile-short 390x723 pass 4/4 with 12 canonical documents including riskAssessmentDraft, five explicit reviewer checks, a three-zone desktop and one-column mobile cockpit, unchanged page-body height, local-scroll containment, separate stale-aware review storage, zero API calls, and no current-workpack mutation. All four cases prove empty -> saved -> reload-restored storage state without overwriting the self-attested reviewer, while a separate mobile storage-denial probe fails visibly. They also prove deterministic close-button entry focus, one selected and tabbable document tab, Arrow/Home roving navigation, a labelled tabpanel, and Escape focus restoration. A separate live desktop/mobile receipt contract proves a fail-closed local JSON export for 12 documents x 5 checks with current text fingerprints plus bound editorial finding IDs, categories, and fingerprints, a recorded self-attested reviewer, and zero API calls. It does not prove reviewer identity, server recording, completed human review, or approval: automatedInteractionOnly=true, humanReviewCompleted=false, broad human wording review remains required, and exact saved Share remains MISSING_EVIDENCE.",
      nextActions: [
        "Use the cockpit for the separate human editorial review without treating automated geometry as human completion.",
        "Keep exact saved Share and every DB/provider/vector/wiki/KOSHA mutation behind their existing approval boundaries.",
      ],
    });
  }

  return gateResult({
    id: "document_editorial_review_cockpit",
    label: "Live 12-document human editorial review cockpit",
    state: "contradicted",
    evidencePath,
    detail: `Cockpit verdict=${readString(report.verdict) || "unknown"}, live=${readNumber(report.pass)}/4, rowsPass=${rowsPass}, accessibilityPass=${accessibilityPass}, geometryPass=${geometryPass}, contractPass=${contractPass}, storagePass=${storagePass}, receiptPass=${receiptPass}, receiptFindingsBound=${receiptVerification.findingsBound === true}, receiptFindingCount=${readNumber(receiptVerification.editorialFindingCount)}, receiptFindingsReviewed=${receiptCompletion.editorialFindingsReviewed === true}, receiptHumanReviewCompleted=${receiptReviewBoundary.humanReviewCompleted === true}, receiptReviewerIdentityVerified=${receiptCompletion.reviewerIdentityVerified === true}, receiptServerRecorded=${receiptCompletion.serverRecorded === true}, receiptApprovalGranted=${receiptCompletion.approvalGranted === true}, sourceMatchesProduction=${sourceMatchesProduction}, humanReviewCompleted=${reviewBoundary.humanReviewCompleted === true}, exactShare=${readString(mutationBoundary.exactSavedShareVerdict) || "unknown"}, receiptExactShare=${readString(receiptMutationBoundary.exactSavedShareVerdict) || "unknown"}, noMutation=${noMutation}, receiptNoMutation=${receiptNoMutation}.`,
    nextActions: ["Restore the fail-closed review, accessibility, geometry, source/live, and no-mutation contracts before claiming the cockpit proven."],
  });
}

/**
 * @param {string} rootDir
 * @returns {GateResult}
 */
function evaluateCurrentLiveDocumentEditorialRuntimeGate(rootDir) {
  const evidencePath = EVIDENCE_PATHS.currentLiveDocumentEditorialRuntime;
  const report = readJsonFile(rootDir, evidencePath);
  if (!isRecord(report)) {
    return gateResult({
      id: "current_live_document_editorial_runtime",
      label: "Current live document editorial runtime",
      state: "missing",
      evidencePath,
      detail: "Current live editorial runtime evidence is missing or invalid.",
      nextActions: ["Run the unchanged five-case editorial contract against current production and current-source local production."],
    });
  }

  const beforeLive = isRecord(report.beforeLive) ? report.beforeLive : {};
  const afterLive = isRecord(report.afterLive) ? report.afterLive : {};
  const automatedFindingCounts = isRecord(afterLive.automatedFindingCounts) ? afterLive.automatedFindingCounts : {};
  const retainedReviewerFindings = isRecord(afterLive.retainedReviewerFindings) ? afterLive.retainedReviewerFindings : {};
  const providerBoundary = isRecord(report.providerBoundary) ? report.providerBoundary : {};
  const boundaries = isRecord(report.boundaries) ? report.boundaries : {};
  const runtimeCodes = isRecord(beforeLive.runtimeBlockCodeCounts) ? beforeLive.runtimeBlockCodeCounts : {};
  const sourceAligned = readString(report.sourceHead).length > 0
    && readString(report.sourceHead) === readString(report.productionCommit)
    && readString(report.sourceHead) === readString(afterLive.sourceHead)
    && readString(report.productionCommit) === readString(afterLive.productionCommit);
  const historicalRuntimeBoundaryHonest = readString(beforeLive.verdict)
      === "BLOCKED_LIVE_PRODUCTION_EDITORIAL_REVIEW_RUNTIME_UNAVAILABLE"
    && readNumber(beforeLive.total) === 5
    && readNumber(beforeLive.pass) === 0
    && readNumber(beforeLive.fail) === 0
    && readNumber(beforeLive.blocked) === 5
    && readNumber(beforeLive.contentReviewExecutedCount) === 0
    && readNumber(runtimeCodes.DISTRIBUTED_RATE_LIMIT_UNAVAILABLE) === 5;
  const liveTemplateReady = readString(report.verdict) === "PASS_LIVE_PRODUCTION_TEMPLATE_EDITORIAL_RUNTIME"
    && readString(afterLive.verdict)
      === "PASS_LIVE_PRODUCTION_12_DELIVERABLE_EDITORIAL_CONTRACT_REVIEWER_READY"
    && sourceAligned
    && readNumber(afterLive.total) === 5
    && readNumber(afterLive.pass) === 5
    && readNumber(afterLive.fail) === 0
    && readNumber(afterLive.blocked) === 0
    && readNumber(afterLive.canonicalDocumentCount) === 12
    && readNumber(afterLive.requestedDocumentSurfaceCount) === 60
    && readNumber(afterLive.reviewedDocumentSurfaceCount) === 60
    && readString(afterLive.requestedAiMode) === "template"
    && readNumber(afterLive.expectedProviderWorkUnit) === 0
    && afterLive.providerGenerationRequested === false
    && readNumber(afterLive.runtimeContractPassCount) === 5
    && readNumber(afterLive.runtimeContractEvaluatedCount) === 5
    && Object.values(automatedFindingCounts).every((value) => readNumber(value) === 0)
    && readNumber(retainedReviewerFindings.exactLineOveruse) > 0
    && readNumber(retainedReviewerFindings.nearDuplicateLineOveruse) > 0;
  const providerBoundaryPass = readNumber(providerBoundary.enhancedStatus) === 503
    && readNumber(providerBoundary.fullStatus) === 503
    && readString(providerBoundary.code) === "DISTRIBUTED_RATE_LIMIT_UNAVAILABLE"
    && providerBoundary.distributedAdmissionRequirementPreserved === true
    && providerBoundary.providerBackedLiveEditorialPassClaimed === false;
  const boundaryPass = boundaries.broadHumanReviewRequired === true
    && boundaries.humanReviewCompleted === false
    && boundaries.dbMutationPerformed === false
    && boundaries.shareSessionCreated === false
    && boundaries.providerDispatchCalled === false
    && boundaries.vectorOrEmbeddingMutationPerformed === false
    && boundaries.wikiPublicationPerformed === false
    && boundaries.koshaRegistryMutationPerformed === false
    && readString(boundaries.exactSavedShareVerdict) === "MISSING_EVIDENCE";

  if (historicalRuntimeBoundaryHonest && liveTemplateReady && providerBoundaryPass && boundaryPass) {
    return gateResult({
      id: "current_live_document_editorial_runtime",
      label: "Current live document editorial runtime",
      state: "proven",
      evidencePath,
      detail: `Current live deterministic template editorial runtime passes 5/5 scenarios and 60/60 document surfaces with runtime mode/work-unit contract 5/5, zero automated editorial failures, and ${readNumber(retainedReviewerFindings.exactLineOveruse)} exact plus ${readNumber(retainedReviewerFindings.nearDuplicateLineOveruse)} near-duplicate reviewer findings retained. The historical implicit provider-default run remains recorded as 5/5 DISTRIBUTED_RATE_LIMIT_UNAVAILABLE blocks; enhanced/full still fail closed at distributed admission, no provider-backed editorial PASS is claimed, humanReviewCompleted=false, no mutation occurred, and exact saved Share remains MISSING_EVIDENCE.`,
      nextActions: [
        "Configure the approved distributed admission backend before any provider-backed enhanced/full live editorial claim.",
        "Keep broad human review and exact saved Share evidence separate from automated runtime readiness.",
      ],
    });
  }

  return gateResult({
    id: "current_live_document_editorial_runtime",
    label: "Current live document editorial runtime",
    state: "contradicted",
    evidencePath,
    detail: `Current editorial runtime contract drifted: historicalRuntimeBoundaryHonest=${historicalRuntimeBoundaryHonest}, liveTemplateReady=${liveTemplateReady}, providerBoundaryPass=${providerBoundaryPass}, sourceAligned=${sourceAligned}, boundaryPass=${boundaryPass}.`,
    nextActions: ["Restore fail-closed template/provider separation and regenerate source-aligned live editorial evidence."],
  });
}

/**
 * @param {string} rootDir
 * @returns {GateResult}
 */
function evaluateHermesKnowledgeReviewEvidenceInspectorGate(rootDir) {
  const inspectorPath = EVIDENCE_PATHS.hermesKnowledgeReviewEvidenceInspector;
  const evidencePath = EVIDENCE_PATHS.hermesEvidenceDigestReadability;
  const subjectContextPath = EVIDENCE_PATHS.hermesReviewSubjectContext;
  const report = readJsonFile(rootDir, inspectorPath);
  const readability = readJsonFile(rootDir, evidencePath);
  const subjectContext = readJsonFile(rootDir, subjectContextPath);
  if (!isRecord(report) || !isRecord(readability) || !isRecord(subjectContext)) {
    return gateResult({
      id: "hermes_review_evidence_inspector",
      label: "Hermes review evidence inspector",
      state: "missing",
      evidencePath,
      detail: "Hermes selected-candidate evidence inspector, live readability, or review-subject context companion evidence is missing.",
      nextActions: ["Run the bounded authenticated evidence-inspector probe against local and live production."],
    });
  }

  const local = isRecord(report.local) ? report.local : {};
  const afterLive = isRecord(report.afterLive) ? report.afterLive : {};
  const contract = isRecord(report.evidenceContract) ? report.evidenceContract : {};
  const mutation = isRecord(report.mutationBoundary) ? report.mutationBoundary : {};
  const security = isRecord(report.securityBoundary) ? report.securityBoundary : {};
  const remaining = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  const readabilityLive = isRecord(readability.afterLive) ? readability.afterLive : {};
  const readabilityBoundaries = isRecord(readability.boundaries) ? readability.boundaries : {};
  const subjectLive = isRecord(subjectContext.afterLive) ? subjectContext.afterLive : {};
  const subjectMutation = isRecord(subjectContext.mutationBoundary) ? subjectContext.mutationBoundary : {};
  const subjectReview = isRecord(subjectContext.reviewBoundary) ? subjectContext.reviewBoundary : {};
  const subjectRemaining = isRecord(subjectContext.remainingBoundaries) ? subjectContext.remainingBoundaries : {};
  const productCommit = readString(report.productCommit);
  const productionCommit = readString(report.productionCommit);
  const noMutation = mutation.dbMutationPerformed === false
    && mutation.providerDispatchCalled === false
    && mutation.shareSessionCreated === false
    && mutation.ontologyPublicationPerformed === false
    && mutation.vectorOrEmbeddingMutationPerformed === false
    && mutation.wikiPublicationPerformed === false
    && mutation.koshaRegistryMutationPerformed === false;
  const pass = report.verdict === "PASS_LIVE_PRODUCTION_HERMES_REVIEW_EVIDENCE_INSPECTOR"
    && productCommit !== ""
    && productionCommit !== ""
    && isGitAncestor(rootDir, productCommit)
    && isGitAncestor(rootDir, productionCommit)
    && local.verdict === "PASS_CURRENT_SOURCE_LOCAL_HERMES_REVIEW_EVIDENCE_INSPECTOR"
    && local.viewportCount === 8
    && local.passedCount === 8
    && local.failedCount === 0
    && afterLive.verdict === "PASS_LIVE_PRODUCTION_HERMES_REVIEW_EVIDENCE_INSPECTOR"
    && afterLive.viewportCount === 8
    && afterLive.passedCount === 8
    && afterLive.failedCount === 0
    && afterLive.productionAligned === true
    && afterLive.browserErrorCount === 0
    && contract.itemLimit === 20
    && contract.fixtureItemCount === 5
    && contract.authorityCountsMatchReviewContract === true
    && contract.desktopCandidateAndEvidenceMounted === true
    && contract.desktopEvidenceColumns === 2
    && contract.mobileMountedPaneCount === 1
    && contract.mobileCandidateEvidenceSegmentedControl === true
    && contract.candidateTablist === true
    && contract.candidateRovingTabStop === true
    && contract.candidateKeyboardNavigation === true
    && contract.breakpointOrientationSynchronized === true
    && contract.mobilePaneTabsLinked === true
    && contract.mobilePaneKeyboardNavigation === true
    && contract.decisionPendingStatusLive === true
    && contract.decisionBusyStateExposed === true
    && contract.decisionActionsDisabledDuringSave === true
    && contract.decisionSettlesAccessibly === true
    && contract.publicOfficialHttpsLinkCount === 3
    && contract.privateEvidenceRawIdentityExposed === false
    && contract.evidenceInternalScroll === true
    && contract.horizontalOverflow === false
    && noMutation
    && security.immutableOriginal18FindingBaselinePreserved === true
    && security.freshFullRepositoryScanRequired === true
    && security.securityComplete === false
    && remaining.exactSavedShareVerdict === "MISSING_EVIDENCE"
    && remaining.llmWikiPublication === "APPROVAL_GATED"
    && remaining.supabaseRlsLaunchIsolation === "APPROVAL_GATED"
    && remaining.providerDispatchPersistence === "APPROVAL_GATED"
    && readability.verdict === "PASS_LIVE_PRODUCTION_HERMES_EVIDENCE_READABILITY"
    && readString(readability.productCommit) !== ""
    && isGitAncestor(rootDir, readString(readability.productCommit))
    && readString(readability.sourceHead) !== ""
    && isGitAncestor(rootDir, readString(readability.sourceHead))
    && readabilityLive.verdict === "PASS_LIVE_PRODUCTION_HERMES_REVIEW_EVIDENCE_INSPECTOR"
    && readabilityLive.viewportCount === 8
    && readabilityLive.passedCount === 8
    && readabilityLive.failedCount === 0
    && readString(readabilityLive.productionCommit) !== ""
    && isGitAncestor(rootDir, readString(readabilityLive.productionCommit))
    && readNumber(readabilityLive.evidenceDigestMinWidth) >= 160
    && readNumber(readabilityLive.evidenceDigestMaxHeight) <= 36
    && readNumber(readabilityLive.desktopReadinessSectionMinWidth) >= 120
    && readNumber(readabilityLive.mobileReadinessSectionMinWidth) >= 96
    && readNumber(readabilityLive.readinessLabelMaxHeight) <= 36
    && readabilityLive.horizontalOverflow === false
    && readabilityBoundaries.humanReviewCompleted === false
    && readabilityBoundaries.wikiPublished === false
    && readabilityBoundaries.dbMutationPerformed === false
    && readabilityBoundaries.providerCallPerformed === false
    && readabilityBoundaries.shareSessionCreated === false
    && readString(readabilityBoundaries.exactSavedShareVerdict) === "MISSING_EVIDENCE"
    && readString(readabilityBoundaries.llmWikiPublicationVerdict) === "APPROVAL_GATED"
    && readabilityBoundaries.liveAfterDeploymentRequired === false
    && subjectContext.verdict === "PASS_LIVE_PRODUCTION_HERMES_REVIEW_SUBJECT_CONTEXT"
    && readString(subjectContext.productCommit) !== ""
    && isGitAncestor(rootDir, readString(subjectContext.productCommit))
    && readString(subjectContext.sourceHead) !== ""
    && isGitAncestor(rootDir, readString(subjectContext.sourceHead))
    && subjectLive.verdict === "PASS_LIVE_PRODUCTION_HERMES_REVIEW_EVIDENCE_INSPECTOR"
    && readString(subjectLive.productionCommit) !== ""
    && isGitAncestor(rootDir, readString(subjectLive.productionCommit))
    && subjectLive.viewportCount === 8
    && subjectLive.passedCount === 8
    && subjectLive.failedCount === 0
    && subjectLive.candidateBodyBeforeReadinessCount === 8
    && subjectLive.candidateBodyTopVisibleCount === 8
    && subjectLive.desktopEvidenceSubjectContextCount === 4
    && subjectLive.mobileEvidenceSubjectContextVisibleCount === 4
    && readNumber(subjectLive.maxEvidenceSubjectContextHeight) <= 64
    && subjectLive.horizontalOverflowCount === 0
    && subjectMutation.dbMutationPerformed === false
    && subjectMutation.providerDispatchCalled === false
    && subjectMutation.shareSessionCreated === false
    && subjectMutation.ontologyPublicationPerformed === false
    && subjectMutation.wikiPublicationPerformed === false
    && subjectReview.humanReviewCompleted === false
    && subjectReview.machineEvidenceReplacesHumanReview === false
    && subjectReview.candidateApproved === false
    && subjectReview.wikiPublished === false
    && readString(subjectRemaining.exactSavedShareVerdict) === "MISSING_EVIDENCE"
    && readString(subjectRemaining.llmWikiPublication) === "APPROVAL_GATED"
    && readString(subjectRemaining.supabaseRlsLaunchIsolation) === "APPROVAL_GATED";

  return gateResult({
    id: "hermes_review_evidence_inspector",
    label: "Hermes review evidence inspector",
    state: pass ? "proven" : "contradicted",
    evidencePath,
    detail: pass
      ? `Live Hermes review evidence inspector passes 8/8 Day/Night desktop and mobile cases. Its live readability companion proves digest ${readNumber(readabilityLive.evidenceDigestMinWidth)}x${readNumber(readabilityLive.evidenceDigestMaxHeight)}px minimum-width/maximum-height bounds, readiness cells at ${readNumber(readabilityLive.desktopReadinessSectionMinWidth)}px desktop and ${readNumber(readabilityLive.mobileReadinessSectionMinWidth)}px mobile minimum widths, labels no taller than ${readNumber(readabilityLive.readinessLabelMaxHeight)}px, and zero horizontal overflow. The subject-context companion additionally proves the candidate body precedes readiness in 8/8 cases, its first line is top-visible in 8/8, and evidence retains subject context in 4/4 desktop plus 4/4 mobile cases within ${readNumber(subjectLive.maxEvidenceSubjectContextHeight)}px. It binds five displayed evidence items to the existing authority counts, mounts candidate plus evidence on desktop and one linked keyboard-operable pane on mobile, exposes only allowlisted official HTTPS references, keeps tenant evidence generic, and performs no mutation. Candidate navigation retains a single roving tab stop, linked panels, and breakpoint-aware keyboard semantics; delayed review decisions expose live pending/settled status, busy semantics, and disabled competing actions. The immutable 18-finding baseline remains preserved, a fresh full-repository scan is still required, human review and Wiki publication remain incomplete, exact saved Share remains MISSING_EVIDENCE, and Wiki/RLS/provider persistence remain APPROVAL_GATED.`
      : `Hermes evidence-inspector contract is contradicted: verdict=${readString(report.verdict) || "missing"}, local=${readString(local.verdict) || "missing"}, live=${readString(afterLive.verdict) || "missing"}, readability=${readString(readability.verdict) || "missing"}, subjectContext=${readString(subjectContext.verdict) || "missing"}, subject=${readNumber(subjectLive.candidateBodyBeforeReadinessCount)}/${readNumber(subjectLive.candidateBodyTopVisibleCount)}/${readNumber(subjectLive.desktopEvidenceSubjectContextCount)}/${readNumber(subjectLive.mobileEvidenceSubjectContextVisibleCount)}, digest=${readNumber(readabilityLive.evidenceDigestMinWidth)}x${readNumber(readabilityLive.evidenceDigestMaxHeight)}, readiness=${readNumber(readabilityLive.desktopReadinessSectionMinWidth)}/${readNumber(readabilityLive.mobileReadinessSectionMinWidth)}/${readNumber(readabilityLive.readinessLabelMaxHeight)}, candidateKeyboard=${String(contract.candidateKeyboardNavigation)}, mobilePaneKeyboard=${String(contract.mobilePaneKeyboardNavigation)}, exactShare=${readString(remaining.exactSavedShareVerdict) || "missing"}, subjectExactShare=${readString(subjectRemaining.exactSavedShareVerdict) || "missing"}, readabilityExactShare=${readString(readabilityBoundaries.exactSavedShareVerdict) || "missing"}, securityComplete=${String(security.securityComplete)}.`,
    nextActions: pass ? [] : ["Restore the evidence-count, privacy, geometry, no-mutation, security-baseline, and approval boundaries, then rerun local and live probes."],
  });
}

/**
 * @param {string} rootDir
 * @returns {GateResult}
 */
function evaluateHermesRemoteDurableLedgerGate(rootDir) {
  const evidencePath = EVIDENCE_PATHS.hermesOpenclawRuntime;
  const report = readJsonFile(rootDir, evidencePath);
  if (!isRecord(report)) {
    return gateResult({
      id: "hermes_remote_durable_ledger",
      label: "Hermes remote durable attempt ledger",
      state: "missing",
      evidencePath,
      detail: "Hermes runtime and durable-ledger evidence is missing.",
      nextActions: ["Run the Hermes current runtime gate after source and production are aligned."],
    });
  }

  const productionBuild = isRecord(report.productionBuildInfoAtLiveSmoke)
    ? report.productionBuildInfoAtLiveSmoke
    : {};
  const focusedTests = isRecord(report.focusedTests) ? report.focusedTests : {};
  const liveSmoke = isRecord(report.liveUnauthenticatedBrokerSmoke)
    ? report.liveUnauthenticatedBrokerSmoke
    : {};
  const sourceContract = isRecord(report.sourceContract) ? report.sourceContract : {};
  const mutationBoundary = isRecord(report.mutationBoundary) ? report.mutationBoundary : {};
  const remainingBoundaries = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  const liveReadiness = isRecord(report.liveExecutionReadiness) ? report.liveExecutionReadiness : {};
  const sourceHead = readString(report.sourceShaForFocusedTests);
  const productionCommit = readString(productionBuild.commitSha);
  const noMutation = mutationBoundary.dbMutationPerformed === false
    && mutationBoundary.providerDispatchLiveClaimed === false
    && mutationBoundary.shareSessionCreated === false
    && mutationBoundary.vectorRuntimeActivated === false
    && mutationBoundary.wikiPublicationPerformed === false
    && mutationBoundary.koshaRegistryMutationPerformed === false
    && mutationBoundary.engineExecutionClaimed === false
    && mutationBoundary.liveAuthenticatedExecutionPerformed === false;
  const pass = report.verdict === "adapter_boundary_pass_live_execution_not_claimed"
    && sourceHead !== ""
    && productionCommit === sourceHead
    && report.sourceHeadMatchesProduction === true
    && isGitAncestor(rootDir, sourceHead)
    && focusedTests.status === "pass"
    && readNumber(focusedTests.testFilesPassed) >= 15
    && readNumber(focusedTests.testsPassed) >= 333
    && liveSmoke.status === "pass"
    && liveSmoke.httpStatus === 401
    && liveSmoke.code === "AUTH_REQUIRED"
    && liveSmoke.engineExecutionReached === false
    && sourceContract.routeWiresConfiguredTransport === true
    && sourceContract.configuredTransportFailsClosed === true
    && sourceContract.trustedTransportWired === true
    && sourceContract.durableAttemptLedgerWired === true
    && sourceContract.ledgerExplicitOptIn === true
    && sourceContract.ledgerAtomicReservation === true
    && sourceContract.ledgerTerminalRequiresReservation === true
    && sourceContract.ledgerStoresTerminalDigestOnly === true
    && sourceContract.readinessKeepsLedgerOpen === true
    && sourceContract.executionReadyClaimed === false
    && liveReadiness.claimed === false
    && noMutation
    && remainingBoundaries.exactSavedShareVerdict === "MISSING_EVIDENCE"
    && remainingBoundaries.llmWikiPublication === "APPROVAL_GATED"
    && remainingBoundaries.providerDispatchPersistence === "APPROVAL_GATED"
    && remainingBoundaries.sifEmbeddingRuntime === "APPROVAL_GATED"
    && remainingBoundaries.koshaExactPromotion === "APPROVAL_GATED"
    && remainingBoundaries.authenticatedHermesCanary === "APPROVAL_GATED";

  if (pass) {
    return gateResult({
      id: "hermes_remote_durable_ledger",
      label: "Hermes remote durable attempt ledger",
      state: "proven",
      evidencePath,
      detail: "Current production wires an explicit opt-in durable attempt/terminal ledger with atomic reservation, reservation-bound terminal digest persistence, DNS-pinned trusted transport, and fail-closed readiness. The live unauthenticated probe stops at AUTH_REQUIRED before engine execution; authenticated execution, LLM Wiki, provider persistence, vector runtime, KOSHA promotion, and exact saved Share remain approval-gated or MISSING_EVIDENCE.",
      nextActions: [],
    });
  }

  return gateResult({
    id: "hermes_remote_durable_ledger",
    label: "Hermes remote durable attempt ledger",
    state: "contradicted",
    evidencePath,
    detail: `Hermes durable-ledger contract failed: source=${sourceHead || "missing"}, production=${productionCommit || "missing"}, ledger=${String(sourceContract.durableAttemptLedgerWired)}, liveClaim=${String(liveReadiness.claimed)}, noMutation=${String(noMutation)}, exactShare=${readString(remainingBoundaries.exactSavedShareVerdict) || "missing"}.`,
    nextActions: ["Restore source/live alignment, durable-ledger atomicity, and all no-mutation and approval boundaries before marking the gate proven."],
  });
}

/**
 * @param {string} rootDir
 * @returns {GateResult}
 */
function evaluateLiveDocumentsShareRoutePerceptionGate(rootDir) {
  const evidencePath = EVIDENCE_PATHS.liveDocumentsShareRoutePerception;
  const report = readJsonFile(rootDir, evidencePath);
  if (!isRecord(report)) {
    return gateResult({
      id: "live_documents_share_route_perception",
      label: "Live Documents and workspace Share route perception",
      state: "missing",
      evidencePath,
      detail: "Fresh live Documents and workspace Share route-perception evidence is missing or invalid.",
      nextActions: ["Re-run the scoped 1440x723 and 390x723 live route geometry without creating a saved Share session."],
    });
  }

  const sourceHead = readString(report.sourceHead);
  const production = isRecord(report.productionBuild) ? report.productionBuild : {};
  const measurement = isRecord(report.measurement) ? report.measurement : {};
  const documents = Array.isArray(measurement.documents) ? measurement.documents.filter(isRecord) : [];
  const share = Array.isArray(measurement.workspaceShare) ? measurement.workspaceShare.filter(isRecord) : [];
  const railRemediation = isRecord(measurement.documentsRailRemediation)
    ? measurement.documentsRailRemediation
    : {};
  const interpretation = isRecord(report.interpretation) ? report.interpretation : {};
  const remaining = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  const mutation = isRecord(report.mutationBoundary) ? report.mutationBoundary : {};
  const expectedCore = ["riskAssessmentDraft", "tbmBriefing", "tbmLogDraft"];

  const documentRowPass = (row, width) => {
    const viewport = isRecord(row.viewport) ? row.viewport : {};
    const workbench = isRecord(row.workbench) ? row.workbench : {};
    const moduleRail = isRecord(row.moduleRail) ? row.moduleRail : {};
    const core = Array.isArray(row.frontVisibleCoreLaunchers) ? row.frontVisibleCoreLaunchers.map(readString) : [];
    return readNumber(viewport.width) === width
      && readNumber(viewport.height) === 723
      && readNumber(row.documentHeight) <= 728
      && readNumber(row.bodyHeight) <= 728
      && readNumber(row.bodyViewportRatio) <= 1.01
      && readNumber(workbench.bottom) <= 723
      && readNumber(row.frontVisibleCoreLauncherCount) === 3
      && expectedCore.every((key) => core.includes(key))
      && readNumber(row.frontVisibleSupportingLauncherCount) === 0
      && row.horizontalOverflow === false
      && readNumber(row.stickyOverlapCount) === 0
      && readNumber(moduleRail.overflowDelta) === 0
      && readString(row.verdict) === "PASS"
      && isRegularEvidenceFile(rootDir, row.screenshot);
  };
  const desktopDocument = documents.find((row) => readNumber(isRecord(row.viewport) ? row.viewport.width : null) === 1440);
  const mobileDocument = documents.find((row) => readNumber(isRecord(row.viewport) ? row.viewport.width : null) === 390);
  const documentsPass = documents.length === 2
    && Boolean(desktopDocument && documentRowPass(desktopDocument, 1440))
    && readNumber(desktopDocument?.uniqueDocumentKeyCount) === 12
    && Boolean(mobileDocument && documentRowPass(mobileDocument, 390));

  const desktopShare = share.find((row) => readNumber(isRecord(row.viewport) ? row.viewport.width : null) === 1440);
  const mobileShare = share.find((row) => readNumber(isRecord(row.viewport) ? row.viewport.width : null) === 390);
  const desktopRoot = isRecord(desktopShare?.root) ? desktopShare.root : {};
  const mobileRoot = isRecord(mobileShare?.root) ? mobileShare.root : {};
  const desktopColumns = Array.isArray(desktopShare?.gridTemplateColumns) ? desktopShare.gridTemplateColumns : [];
  const mobileColumns = Array.isArray(mobileShare?.gridTemplateColumns) ? mobileShare.gridTemplateColumns : [];
  const sharePass = share.length === 2
    && readNumber(isRecord(desktopShare?.viewport) ? desktopShare.viewport.height : null) === 723
    && readNumber(desktopShare?.documentHeight) <= 723
    && readNumber(desktopShare?.bodyHeight) <= 723
    && readNumber(desktopRoot.width) >= 1100
    && readNumber(desktopRoot.bottom) <= 723
    && desktopColumns.length === 3
    && readNumber(desktopShare?.configurationWidth) >= 480
    && readNumber(desktopShare?.messagePreviewWidth) >= 360
    && readNumber(desktopShare?.desktopStatusRailWidth) >= 200
    && readNumber(desktopShare?.distinctDesktopRegions) === 3
    && desktopShare?.horizontalOverflow === false
    && readString(desktopShare?.verdict) === "PASS_DESKTOP_THREE_ZONE"
    && isRegularEvidenceFile(rootDir, desktopShare?.screenshot)
    && readNumber(isRecord(mobileShare?.viewport) ? mobileShare.viewport.height : null) === 723
    && readNumber(mobileShare?.documentHeight) <= 723
    && readNumber(mobileShare?.bodyHeight) <= 723
    && readNumber(mobileRoot.bottom) <= 723
    && mobileColumns.length === 1
    && readNumber(mobileShare?.messagePreviewWidth) >= 300
    && readString(mobileShare?.desktopStatusRailDisplay) === "none"
    && mobileShare?.horizontalOverflow === false
    && readString(mobileShare?.verdict) === "PASS_MOBILE_STACK"
    && isRegularEvidenceFile(rootDir, mobileShare?.screenshot);

  const noMutation = mutation.dbMutationPerformed === false
    && mutation.shareSessionCreated === false
    && mutation.providerDispatchCalled === false
    && mutation.embeddingOrVectorMutationPerformed === false
    && mutation.wikiPublicationPerformed === false
    && mutation.koshaRegistryMutationPerformed === false;
  const railRemediationPass = readNumber(railRemediation.beforeLiveClientHeight) === 723
    && readNumber(railRemediation.beforeLiveScrollHeight) === 724
    && readNumber(railRemediation.beforeLiveOverflowDelta) === 1
    && readNumber(railRemediation.afterLiveClientHeight) === 723
    && readNumber(railRemediation.afterLiveScrollHeight) === 723
    && readNumber(railRemediation.afterLiveOverflowDelta) === 0
    && railRemediation.actualOverflowAccessibilityPreserved === true
    && railRemediation.liveAfterDeploymentRequired === false
    && isRegularEvidenceFile(rootDir, railRemediation.screenshot);
  const pass = readString(report.verdict) === "PASS_LIVE_PRODUCTION_SCOPED_DOCUMENTS_AND_WORKSPACE_SHARE_EXACT_SESSION_GAP"
    && sourceHead.length > 0
    && sourceHead === readString(production.commitSha)
    && isGitAncestor(rootDir, sourceHead)
    && readString(production.branch) === "master"
    && readString(production.environment) === "production"
    && documentsPass
    && sharePass
    && railRemediationPass
    && interpretation.reportedDocumentsBodyHeight2070Reproduced === false
    && interpretation.reportedWorkspaceShareDesktopMobileCardReproduced === false
    && interpretation.routeSplitAloneAcceptedAsFix === false
    && remaining.exactSavedUserSessionReproduced === false
    && readString(remaining.exactSavedShareVerdict) === "MISSING_EVIDENCE"
    && remaining.fixtureOrWorkspaceShareAcceptedAsExactSavedProof === false
    && remaining.concreteSavedSessionUrlProvided === false
    && remaining.dbBackedSessionCreationApproved === false
    && noMutation;

  return gateResult({
    id: "live_documents_share_route_perception",
    label: "Live Documents and workspace Share route perception",
    state: pass ? "proven" : "contradicted",
    evidencePath,
    detail: pass
      ? "Fresh aligned production geometry proves the default /documents route is one viewport at 1440x723 and 390x723 with the core 3 visible, supporting 9 hidden, zero sticky overlap, and the redundant desktop module-rail overflow reduced from 1px to 0 while real overflow remains accessible; workspace Share is a 1180px three-zone desktop workbench and a separate 390px mobile stack. This scoped route proof does not claim every data-dependent state or exact saved /share/[sessionId], which remains MISSING_EVIDENCE, and route split alone is not accepted as the UX fix."
      : `Live route perception verdict=${readString(report.verdict) || "missing"}, sourceLive=${sourceHead.length > 0 && sourceHead === readString(production.commitSha)}, documents=${documentsPass}, share=${sharePass}, railRemediation=${railRemediationPass}, noMutation=${noMutation}, exactShare=${readString(remaining.exactSavedShareVerdict) || "missing"}.`,
    nextActions: pass
      ? ["Obtain a concrete existing production /share/[sessionId]?workerId=... URL for no-mutation exact saved-session geometry; do not substitute workspace Share or fixtures."]
      : ["Restore aligned live 1440x723 and 390x723 route geometry, screenshots, no-mutation boundaries, route-split rejection, and exact saved Share MISSING_EVIDENCE."],
  });
}

/**
 * @param {string} rootDir
 * @returns {GateResult}
 */
function evaluateDeploymentFreshnessGuardGate(rootDir) {
  const evidencePath = EVIDENCE_PATHS.deploymentFreshnessGuard;
  const report = readJsonFile(rootDir, evidencePath);
  if (!isRecord(report)) {
    return gateResult({
      id: "deployment_freshness_guard",
      label: "Live deployment freshness guard",
      state: "missing",
      evidencePath,
      detail: "Live deployment freshness evidence is missing or invalid.",
      nextActions: ["Re-run the no-mutation current-tab and simulated SHA-drift browser checks after production reaches the product commit."],
    });
  }

  const sourceHead = readString(report.sourceHead);
  const production = isRecord(report.productionBuild) ? report.productionBuild : {};
  const verification = isRecord(report.verification) ? report.verification : {};
  const liveBrowser = isRecord(verification.liveBrowser) ? verification.liveBrowser : {};
  const current = isRecord(liveBrowser.normalCurrentDeployment) ? liveBrowser.normalCurrentDeployment : {};
  const drift = isRecord(liveBrowser.simulatedShaDrift) ? liveBrowser.simulatedShaDrift : {};
  const mobile = isRecord(drift.mobile) ? drift.mobile : {};
  const staticAudit = isRecord(verification.canonicalFrontendStaticAudit) ? verification.canonicalFrontendStaticAudit : {};
  const remaining = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  const mutation = isRecord(report.mutationBoundary) ? report.mutationBoundary : {};
  const noMutation = mutation.dbMutationPerformed === false
    && mutation.shareSessionCreated === false
    && mutation.providerDispatchCalled === false
    && mutation.embeddingOrVectorMutationPerformed === false
    && mutation.wikiPublicationPerformed === false
    && mutation.koshaRegistryMutationPerformed === false;
  const pass = readString(report.verdict) === "PASS_LIVE_PRODUCTION_DEPLOYMENT_FRESHNESS_GUARD"
    && sourceHead.length > 0
    && sourceHead === readString(production.commitSha)
    && isGitAncestor(rootDir, sourceHead)
    && readString(production.branch) === "master"
    && readString(production.environment) === "production"
    && production.sourceHeadMatchesProduction === true
    && current.noticePresent === false
    && readNumber(current.bodyHeight) === 723
    && readNumber(current.documentHeight) === 723
    && current.horizontalOverflow === false
    && drift.refreshButtonVisible === true
    && readNumber(drift.desktopNoticeBottom) <= 723
    && readString(drift.desktopBoxShadow) === "none"
    && readNumber(mobile.bodyHeight) === 723
    && mobile.horizontalOverflow === false
    && readNumber(mobile.noticeBottom) <= 723
    && readNumber(mobile.refreshButtonHeight) >= 44
    && isRegularEvidenceFile(rootDir, drift.desktopScreenshot)
    && isRegularEvidenceFile(rootDir, drift.mobileScreenshot)
    && readString(staticAudit.sourceSha) === sourceHead
    && readString(staticAudit.status) === "pass"
    && readNumber(staticAudit.pageFiles) === 33
    && readNumber(staticAudit.componentFiles) === 24
    && readNumber(staticAudit.coverageIssues) === 0
    && readNumber(staticAudit.violationCount) === 0
    && readNumber(staticAudit.importantDeclarations) === 0
    && remaining.liveAfterDeploymentPending === false
    && remaining.exactSavedUserSessionReproduced === false
    && readString(remaining.exactSavedShareVerdict) === "MISSING_EVIDENCE"
    && remaining.providerDispatchPersistenceApproved === false
    && remaining.fullyAutomatedLaunchClaimAllowed === false
    && noMutation;

  return gateResult({
    id: "deployment_freshness_guard",
    label: "Live deployment freshness guard",
    state: pass ? "proven" : "contradicted",
    evidencePath,
    detail: pass
      ? "Live production now detects a long-open tab whose embedded deployment SHA differs from /api/build-info, renders no notice for the current deployment, and keeps the 1440x723 and 390x723 Documents body bounded while the refresh action remains 44px on mobile. The canonical frontend audit is clean; this does not prove exact saved /share/[sessionId], which remains MISSING_EVIDENCE, or unlock provider/database/vector/wiki/KOSHA approval gates."
      : `Deployment freshness verdict=${readString(report.verdict) || "missing"}, sourceLive=${sourceHead.length > 0 && sourceHead === readString(production.commitSha)}, currentNotice=${current.noticePresent === true}, driftNotice=${drift.refreshButtonVisible === true}, audit=${readString(staticAudit.status) || "missing"}/${readNumber(staticAudit.violationCount)}, noMutation=${noMutation}, exactShare=${readString(remaining.exactSavedShareVerdict) || "missing"}.`,
    nextActions: pass
      ? ["Keep exact saved Share and provider/database/vector/wiki/KOSHA operations on their existing approval paths; do not treat stale-tab visibility as proof of those surfaces."]
      : ["Restore aligned live SHA, current-tab null rendering, SHA-drift notice geometry, clean frontend audit, no-mutation boundaries, and exact saved Share MISSING_EVIDENCE."],
  });
}

/**
 * @param {string} rootDir
 * @param {unknown} relativePath
 */
function isRegularEvidenceFile(rootDir, relativePath) {
  const value = readString(relativePath);
  if (!value) {
    return false;
  }
  try {
    return fs.statSync(path.join(rootDir, value)).isFile();
  } catch {
    return false;
  }
}

/**
 * @param {string} rootDir
 * @returns {GateResult}
 */
function evaluateCurrentRepositorySecurityRescanGate(rootDir) {
  const evidencePath = EVIDENCE_PATHS.currentRepositorySecurityRescan;
  const report = readJsonFile(rootDir, evidencePath);
  if (!isRecord(report)) {
    return gateResult({
      id: "current_repository_security_rescan",
      label: "Current repository security rescan",
      state: "missing",
      evidencePath,
      detail: "The sealed current-revision repository security scan is missing or invalid.",
      nextActions: ["Restore the sealed current scan without rewriting the immutable original baseline."],
    });
  }

  const scan = isRecord(report.scan) ? report.scan : {};
  const severityCounts = isRecord(scan.severityCounts) ? scan.severityCounts : {};
  const disposition = isRecord(report.findingDisposition) ? report.findingDisposition : {};
  const mutationBoundary = isRecord(report.mutationBoundary) ? report.mutationBoundary : {};
  const remainingBoundaries = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  const currentSourceRemediation = isRecord(report.currentSourceRemediation)
    ? report.currentSourceRemediation
    : {};
  const liveAfterDeployment = isRecord(currentSourceRemediation.liveAfterDeployment)
    ? currentSourceRemediation.liveAfterDeployment
    : {};
  const approvalFreeCandidatesReport = isRecord(report.approvalFreeProductSourceCandidates)
    ? report.approvalFreeProductSourceCandidates
    : {};
  const approvalFreeCandidates = Array.isArray(approvalFreeCandidatesReport.findings)
    ? approvalFreeCandidatesReport.findings.filter((item) => readString(item) !== "")
    : [];
  const approvalGatedReport = isRecord(report.approvalGatedDatabaseOrAtomicity)
    ? report.approvalGatedDatabaseOrAtomicity
    : {};
  const approvalGatedFindings = Array.isArray(approvalGatedReport.findings)
    ? approvalGatedReport.findings.filter((item) => readString(item) !== "")
    : [];
  const noMutation = mutationBoundary.dbMutationPerformed === false
    && mutationBoundary.providerDispatchCalled === false
    && mutationBoundary.shareSessionCreated === false
    && mutationBoundary.vectorMutationPerformed === false
    && mutationBoundary.wikiPublicationPerformed === false
    && mutationBoundary.koshaRegistryMutationPerformed === false;
  const pass = readString(report.verdict) === "NOTICE_CURRENT_HEAD_STANDARD_SCAN_19_FINDINGS_PARTIAL_COVERAGE_REMEDIATION_REQUIRED"
    && readString(report.scanId) === "da97e400-1f4d-40b9-a434-ab5ab013fdb3"
    && readString(report.scanRevision) === "4e3e7e5d9ebad7e91f428a856019122431410be4"
    && readString(report.productCommit) === "4e3e7e5d9ebad7e91f428a856019122431410be4"
    && readString(report.productionCommit) === "4e3e7e5d9ebad7e91f428a856019122431410be4"
    && readNumber(report.immutableOriginalBaselineFindingCount) === 18
    && readString(scan.status) === "complete"
    && readString(scan.coverage) === "partial"
    && readNumber(scan.reviewedSurfaceCount) === 9
    && readNumber(scan.deferredCoverageItemCount) === 26
    && readNumber(scan.reportableFindingCount) === 19
    && readNumber(severityCounts.medium) === 14
    && readNumber(severityCounts.low) === 5
    && readNumber(disposition.total) === 19
    && readNumber(disposition.approvalGatedDatabaseOrAtomicityCount) === 12
    && readNumber(disposition.approvalFreeProductSourceCandidateCount) === 7
    && readNumber(disposition.approvalFreeRemediatedCount) === 0
    && disposition.securityCompleteClaimAllowed === false
    && readNumber(approvalFreeCandidatesReport.count) === 7
    && approvalFreeCandidates.length === 7
    && approvalFreeCandidatesReport.remediationPending === true
    && readNumber(approvalGatedReport.count) === 12
    && approvalGatedFindings.length === 12
    && approvalGatedReport.databaseOrAtomicityApprovalRequired === true
    && readString(currentSourceRemediation.sourceHead) === "f95773c2f4b55fe0ba8b199b5218800067e09bdf"
    && readNumber(currentSourceRemediation.scanTimeCandidateCount) === 7
    && readNumber(currentSourceRemediation.approvalFreeCandidateCount) === 6
    && readNumber(currentSourceRemediation.approvalFreeRemediatedCount) === 6
    && readNumber(currentSourceRemediation.approvalFreeOpenCount) === 0
    && readNumber(currentSourceRemediation.approvalSensitiveShareCapabilityCount) === 1
    && readString(currentSourceRemediation.approvalSensitiveFinding) === "public-share-object-id-credential"
    && currentSourceRemediation.freshFullRepositoryRescanRequired === true
    && readString(liveAfterDeployment.status) === "PASS_SOURCE_INCLUDED"
    && readString(liveAfterDeployment.productionCommit) === "607c39b3204fd4e1732890bcc6dbad30e4815ea2"
    && liveAfterDeployment.sourceRemediationIncluded === true
    && liveAfterDeployment.providerDispatchCalled === false
    && liveAfterDeployment.dbMutationPerformed === false
    && liveAfterDeployment.shareSessionCreated === false
    && noMutation
    && readString(remainingBoundaries.exactSavedShareVerdict) === "MISSING_EVIDENCE"
    && readString(remainingBoundaries.databaseSecurityRemediation) === "APPROVAL_GATED"
    && readString(remainingBoundaries.approvalFreeProductSourceRemediation) === "LIVE_SOURCE_INCLUDED_FRESH_RESCAN_REQUIRED"
    && readString(remainingBoundaries.shareCapabilityCredentialRemediation) === "APPROVAL_GATED"
    && readString(remainingBoundaries.coverageCompleteness) === "partial"
    && readNumber(remainingBoundaries.deferredCoverageItemCount) === 26
    && remainingBoundaries.securityCompleteClaimAllowed === false;

  return gateResult({
    id: "current_repository_security_rescan",
    label: "Current repository security rescan",
    state: pass ? "notice" : "contradicted",
    evidencePath,
    detail: pass
      ? "Standard scan da97e400 is sealed at 4e3e7e5d with 19 findings (14 medium, 5 low) while preserving the immutable original baseline of 18. Coverage remains partial across 9 reviewed surfaces with 26 deferred items. Production 607c39b3 includes focused remediation for six approval-free candidates, but a fresh full-repository rescan is required; the Share object-ID credential finding and twelve database/RLS/atomicity findings remain approval-gated. No mutation occurred and exact saved Share remains MISSING_EVIDENCE. This gate remains notice and is not a proven or security-complete claim."
      : `Current scan verdict=${readString(report.verdict) || "missing"}, scan=${readString(report.scanId) || "missing"}, revision=${readString(report.scanRevision) || "missing"}, baseline=${readNumber(report.immutableOriginalBaselineFindingCount)}, findings=${readNumber(scan.reportableFindingCount)}, severity=${readNumber(severityCounts.medium)}/${readNumber(severityCounts.low)}, coverage=${readString(scan.coverage) || "missing"}/${readNumber(scan.reviewedSurfaceCount)}/${readNumber(scan.deferredCoverageItemCount)}, approvalFreeOpen=${readNumber(disposition.approvalFreeProductSourceCandidateCount)}/${approvalFreeCandidates.length}, dbApprovalGated=${readNumber(disposition.approvalGatedDatabaseOrAtomicityCount)}/${approvalGatedFindings.length}, noMutation=${noMutation}, exactShare=${readString(remainingBoundaries.exactSavedShareVerdict) || "missing"}, securityComplete=${remainingBoundaries.securityCompleteClaimAllowed}.`,
    nextActions: pass
      ? ["Run a fresh full-repository scan over the six current-source remediations; separately obtain explicit approval before the Share capability credential and twelve database/RLS/atomicity remediations, and close the 26 deferred coverage items before any security-complete claim."]
      : ["Restore the sealed current scan identity, preserved 18-finding baseline, 19-finding disposition, partial coverage/deferred counts, no-mutation boundary, and exact saved Share MISSING_EVIDENCE."],
  });
}

/**
 * @param {string} rootDir
 * @returns {GateResult}
 */
function evaluatePostRemediationRepositorySecurityScanGate(rootDir) {
  const evidencePath = EVIDENCE_PATHS.postRemediationRepositorySecurityScan;
  const report = readJsonFile(rootDir, evidencePath);
  const closure = readJsonFile(rootDir, EVIDENCE_PATHS.postRemediationSecuritySourceClosure);
  if (!isRecord(report) || !isRecord(closure)) {
    return gateResult({
      id: "post_remediation_repository_security_scan",
      label: "Post-remediation repository security scan",
      state: "missing",
      evidencePath,
      detail: "The sealed post-remediation scan or its bounded source-closure ledger is missing or invalid.",
      nextActions: ["Restore both immutable scan evidence and the no-mutation source-closure ledger."],
    });
  }

  const scan = isRecord(report.scan) ? report.scan : {};
  const baseline = isRecord(report.baselineReconciliation) ? report.baselineReconciliation : {};
  const canonical = isRecord(report.canonicalArtifacts) ? report.canonicalArtifacts : {};
  const mutation = isRecord(report.mutationBoundary) ? report.mutationBoundary : {};
  const remaining = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  const closureScan = isRecord(closure.sourceScan) ? closure.sourceScan : {};
  const remediation = isRecord(closure.remediation) ? closure.remediation : {};
  const verification = isRecord(closure.verification) ? closure.verification : {};
  const focused = isRecord(verification.focusedAndAdjacentTests) ? verification.focusedAndAdjacentTests : {};
  const build = isRecord(verification.build) ? verification.build : {};
  const live = isRecord(verification.liveVerification) ? verification.liveVerification : {};
  const closureMutation = isRecord(closure.mutationBoundary) ? closure.mutationBoundary : {};
  const closureRemaining = isRecord(closure.remainingBoundaries) ? closure.remainingBoundaries : {};
  const items = Array.isArray(remediation.items) ? remediation.items.filter(isRecord) : [];
  const itemByRule = new Map(items.map((item) => [readString(item.ruleId), item]));
  const canonicalPaths = [canonical.manifest, canonical.findings, canonical.coverage, canonical.markdownProjection]
    .map(readString)
    .filter(Boolean);
  const canonicalArtifactsExist = canonicalPaths.length === 4
    && canonicalPaths.every((relativePath) => fs.existsSync(path.join(rootDir, relativePath)));
  const noMutation = [mutation, closureMutation].every((boundary) => (
    boundary.dbMutationPerformed === false
    && boundary.providerDispatchCalled === false
    && boundary.shareSessionCreated === false
    && boundary.embeddingOrVectorMutationPerformed === false
    && boundary.wikiPublicationPerformed === false
    && boundary.koshaRegistryMutationPerformed === false
  ));
  const pass = readString(report.verdict) === "NOTICE_POST_REMEDIATION_STANDARD_SCAN_20_FINDINGS_APPROVAL_BOUNDARIES_PRESERVED"
    && readString(scan.scanId) === "bd135da7-c309-4e8d-ace5-15222dd3f1c7"
    && readString(scan.targetRevision) === "8f5dc78f73d5048598fb2519bf7bb758ab090982"
    && readString(scan.status) === "complete"
    && readString(scan.coverage) === "partial"
    && readNumber(scan.reviewedSurfaceCount) === 5
    && readNumber(scan.reportableFindingCount) === 20
    && readNumber(isRecord(scan.severityCounts) ? scan.severityCounts.medium : null) === 12
    && readNumber(isRecord(scan.severityCounts) ? scan.severityCounts.low : null) === 8
    && readString(baseline.immutableOriginalScanId) === "8fe9c06a-018c-446f-aa98-1b37df95287a"
    && readNumber(baseline.immutableOriginalAccountedFindingCount) === 18
    && baseline.immutableOriginalPreserved === true
    && readNumber(baseline.priorCurrentScanFindingCount) === 15
    && canonicalArtifactsExist
    && readString(closure.verdict) === "PASS_LIVE_PRODUCTION_TWO_SECURITY_REMEDIATIONS_ONE_DISTRIBUTED_RESIDUAL_RESCAN_PENDING"
    && readString(closureScan.scanId) === readString(scan.scanId)
    && readNumber(closureScan.reportableFindingCount) === 20
    && readNumber(remediation.sourceRemediatedCount) === 2
    && readNumber(remediation.sourceMitigatedCount) === 1
    && readNumber(remediation.liveDeployedRemediationCount) === 2
    && readNumber(remediation.liveDeployedMitigationCount) === 1
    && readNumber(remediation.remainingReportableFindingCountBeforeRescan) === 18
    && remediation.freshPostRemediationScanRequired === true
    && remediation.liveAfterDeploymentPending === false
    && readString(itemByRule.get("resource-exhaustion.public-status-fanout")?.disposition) === "live_source_mitigated_distributed_admission_residual"
    && readNumber(focused.files) === 8
    && readNumber(focused.tests) === 105
    && readNumber(focused.failed) === 0
    && readString(verification.typecheck) === "PASS"
    && readString(build.status) === "PASS"
    && readNumber(build.staticPages) === 28
    && readNumber(live.workflowDispatchOversizedStatus) === 413
    && readString(live.workflowDispatchOversizedCode) === "WORKFLOW_DISPATCH_PAYLOAD_TOO_LARGE"
    && readString(live.safetyStatusRateLimitMode) === "instance"
    && live.work24BoundedReaderIncludedInProduction === true
    && live.work24OversizedLiveUpstreamNotExecuted === true
    && noMutation
    && readString(remaining.exactSavedShareVerdict) === "MISSING_EVIDENCE"
    && readString(closureRemaining.exactSavedShareVerdict) === "MISSING_EVIDENCE"
    && remaining.securityCompleteClaimAllowed === false
    && closureRemaining.securityCompleteClaimAllowed === false;

  return gateResult({
    id: "post_remediation_repository_security_scan",
    label: "Post-remediation repository security scan",
    state: pass ? "notice" : "contradicted",
    evidencePath,
    detail: pass
      ? "Fresh Standard scan bd135da7 is sealed at 20 findings (12 medium, 8 low) across five reviewed surfaces. Live source closes two findings and mitigates one public-status fanout finding while retaining its distributed-admission residual; 18 findings remain open or only partially mitigated before a fresh rescan. The immutable 18-finding baseline is preserved, security-complete is false, no mutation occurred, and exact saved Share remains MISSING_EVIDENCE."
      : `Post-remediation scan verdict=${readString(report.verdict) || "missing"}, scan=${readString(scan.scanId) || "missing"}, findings=${readNumber(scan.reportableFindingCount)}, closure=${readString(closure.verdict) || "missing"}, remediated=${readNumber(remediation.sourceRemediatedCount)}, mitigated=${readNumber(remediation.sourceMitigatedCount)}, remaining=${readNumber(remediation.remainingReportableFindingCountBeforeRescan)}, canonical=${canonicalArtifactsExist}, noMutation=${noMutation}, exactShare=${readString(closureRemaining.exactSavedShareVerdict) || "missing"}.`,
    nextActions: pass
      ? ["Remediate or explicitly defer the remaining 18 findings, activate approved distributed admission where required, then run a fresh scan before any security-complete claim."]
      : ["Restore the exact sealed 20-finding scan, two live closures, one distributed residual, canonical artifacts, no-mutation boundary, and exact Share MISSING_EVIDENCE."],
  });
}

const SHARE_SESSION_REVOCATION_SECURITY_PATHS = [
  "app/api/workpacks/[id]/share-sessions/route.ts",
  "components/WorkflowSharePanel.tsx",
  "lib/workflow-share-client.ts",
];

/**
 * @param {string} rootDir
 * @returns {GateResult}
 */
function evaluateShareSessionRevocationSecurityGate(rootDir) {
  const evidencePath = EVIDENCE_PATHS.shareSessionRevocationRemediation;
  const report = readJsonFile(rootDir, evidencePath);
  if (!isRecord(report)) {
    return gateResult({
      id: "share_session_revocation_security",
      label: "Share session revocation security",
      state: "missing",
      evidencePath,
      detail: "Owner-only Share session revocation evidence is missing or invalid.",
      nextActions: ["Restore the live source receipt without creating or revoking a production Share session."],
    });
  }

  const finding = isRecord(report.securityFinding) ? report.securityFinding : {};
  const contract = isRecord(report.sourceContract) ? report.sourceContract : {};
  const verification = isRecord(report.verification) ? report.verification : {};
  const focused = isRecord(verification.focusedTests) ? verification.focusedTests : {};
  const browser = isRecord(verification.browserGeometry) ? verification.browserGeometry : {};
  const build = isRecord(verification.build) ? verification.build : {};
  const live = isRecord(report.liveVerification) ? report.liveVerification : {};
  const mutation = isRecord(report.mutationBoundary) ? report.mutationBoundary : {};
  const remaining = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  const sourceHead = readString(report.sourceHead);
  const productionCommit = readString(report.productionCommit);
  const tupleFilters = Array.isArray(contract.tupleFilters) ? contract.tupleFilters.map(readString) : [];
  const expectedTupleFilters = ["session_id", "workpack_id", "organization_id", "site_id"];
  const noMutation = mutation.dbMutationPerformed === false
    && mutation.shareSessionCreated === false
    && mutation.shareSessionRevokedForEvidence === false
    && mutation.providerDispatchCalled === false
    && mutation.embeddingOrVectorMutationPerformed === false
    && mutation.wikiPublicationPerformed === false
    && mutation.koshaRegistryMutationPerformed === false;
  const currentCompatibility = isShareMcpCurrentSourceCompatibilityCurrent(
    rootDir,
    "share_session_revocation_security",
    SHARE_SESSION_REVOCATION_SECURITY_PATHS
  );
  const pass = readString(report.verdict) === "PASS_LIVE_PRODUCTION_OWNER_SHARE_SESSION_REVOCATION_RESCAN_PENDING"
    && sourceHead.length > 0
    && sourceHead === productionCommit
    && isGitAncestor(rootDir, sourceHead)
    && (isEvidenceCurrentForPaths(rootDir, sourceHead, SHARE_SESSION_REVOCATION_SECURITY_PATHS) || currentCompatibility)
    && readString(finding.scanId) === "bd135da7-c309-4e8d-ace5-15222dd3f1c7"
    && readString(finding.findingId) === "csf_81119e28edb5ebd0a227f9ca"
    && readString(finding.ruleId) === "authorization.missing-share-revocation"
    && readString(finding.severity) === "low"
    && finding.immutableFindingPreserved === true
    && finding.freshPostRemediationScanRequired === true
    && readString(contract.method) === "DELETE"
    && contract.managerAuthenticationRequired === true
    && contract.ownedWorkpackContextRequired === true
    && tupleFilters.length === expectedTupleFilters.length
    && expectedTupleFilters.every((item) => tupleFilters.includes(item))
    && contract.revokedStatusPersisted === true
    && contract.updatedAtAuditEvidenceReturned === true
    && contract.malformedSessionIdRejectedBeforeStorage === true
    && contract.unknownOrForeignTupleFailsClosed === true
    && readString(contract.operatorUiAction) === "공유 세션 중지"
    && contract.confirmationRequired === true
    && readNumber(focused.files) === 3
    && readNumber(focused.tests) === 92
    && readNumber(focused.failed) === 0
    && readString(focused.status) === "PASS"
    && readNumber(browser.files) === 1
    && readNumber(browser.tests) === 4
    && readNumber(browser.failed) === 0
    && readString(browser.status) === "PASS"
    && verification.typecheck === "PASS"
    && readString(build.status) === "PASS"
    && readNumber(build.staticPages) === 28
    && live.liveAfterDeploymentPending === false
    && readString(live.productionBranch) === "master"
    && readString(live.productionEnvironment) === "production"
    && readNumber(live.unauthenticatedDeleteStatus) === 401
    && live.unauthenticatedDeleteConfigured === true
    && live.unauthenticatedDeleteRevokedSessionId === null
    && live.destructiveRevokeProbeExecuted === false
    && noMutation
    && readString(remaining.exactSavedShareVerdict) === "MISSING_EVIDENCE"
    && readString(remaining.shareStorageAndCreationApproval) === "APPROVAL_GATED"
    && remaining.securityCompleteClaimAllowed === false;

  return gateResult({
    id: "share_session_revocation_security",
    label: "Share session revocation security",
    state: pass ? "notice" : "contradicted",
    evidencePath,
    detail: pass
      ? `Live production exposes an authenticated owner-only Share session revoke action scoped by session, workpack, organization, and site with durable status/timestamp evidence. The current-source compatibility receipt=${currentCompatibility} preserves the unauthenticated 401 fail-closed proof after adjacent admission changes; no production session was created or revoked, the canonical low finding remains immutable pending a fresh rescan, and exact saved Share remains MISSING_EVIDENCE.`
      : `Share revocation verdict=${readString(report.verdict) || "missing"}, sourceLive=${sourceHead.length > 0 && sourceHead === productionCommit}, sourceCurrent=${sourceHead.length > 0 && isEvidenceCurrentForPaths(rootDir, sourceHead, SHARE_SESSION_REVOCATION_SECURITY_PATHS)}, auth=${readNumber(live.unauthenticatedDeleteStatus)}, destructiveProbe=${live.destructiveRevokeProbeExecuted === true}, noMutation=${noMutation}, exactShare=${readString(remaining.exactSavedShareVerdict) || "missing"}.`,
    nextActions: pass
      ? ["Run a fresh Standard scan before reclassifying the immutable finding; keep exact saved Share and DB-backed session creation approval-gated."]
      : ["Restore live source alignment, owner/tuple scoping, focused and browser verification, 401 fail-closed proof, no-mutation boundaries, and exact Share MISSING_EVIDENCE."],
  });
}

const SHARE_RECIPIENT_CONTACT_VERIFICATION_PATHS = [
  "app/api/share-sessions/[sessionId]/route.ts",
  "app/share/[sessionId]/page.tsx",
  "lib/workpack-commercial.ts",
];

/**
 * @param {string} rootDir
 * @returns {GateResult}
 */
function evaluateShareRecipientContactVerificationGate(rootDir) {
  const evidencePath = EVIDENCE_PATHS.shareRecipientContactVerification;
  const report = readJsonFile(rootDir, evidencePath);
  if (!isRecord(report)) {
    return gateResult({
      id: "share_recipient_contact_verification_security",
      label: "Share recipient contact verification security",
      state: "missing",
      evidencePath,
      detail: "Public Share recipient contact-verification evidence is missing or invalid.",
      nextActions: ["Restore the source/live no-mutation receipt without creating a saved Share session."],
    });
  }

  const finding = isRecord(report.securityFinding) ? report.securityFinding : {};
  const contract = isRecord(report.sourceContract) ? report.sourceContract : {};
  const ui = isRecord(report.uiContract) ? report.uiContract : {};
  const verification = isRecord(report.verification) ? report.verification : {};
  const adjacent = isRecord(verification.focusedAndAdjacent) ? verification.focusedAndAdjacent : {};
  const browser = isRecord(verification.recipientBrowser) ? verification.recipientBrowser : {};
  const build = isRecord(verification.build) ? verification.build : {};
  const live = isRecord(report.liveProbe) ? report.liveProbe : {};
  const mutation = isRecord(report.mutationBoundary) ? report.mutationBoundary : {};
  const remaining = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  const sourceHead = readString(report.sourceHead);
  const productionCommit = readString(report.productionCommit);
  const noMutation = mutation.dbSchemaChanged === false
    && mutation.dbMutationPerformed === false
    && mutation.shareSessionCreated === false
    && mutation.readConfirmationCreatedForEvidence === false
    && mutation.providerDispatchCalled === false
    && mutation.vectorOrEmbeddingMutationPerformed === false
    && mutation.wikiPublicationPerformed === false
    && mutation.koshaRegistryMutationPerformed === false;
  const currentCompatibility = isShareMcpCurrentSourceCompatibilityCurrent(
    rootDir,
    "share_recipient_contact_verification_security",
    SHARE_RECIPIENT_CONTACT_VERIFICATION_PATHS
  ) || isCurrentSecurityGovernedPathCompatibility(
    rootDir,
    "share_recipient_contact_verification_security",
    SHARE_RECIPIENT_CONTACT_VERIFICATION_PATHS,
  );
  const pass = readString(report.verdict) === "PASS_LIVE_DEPLOYED_SOURCE_SHARE_RECIPIENT_CONTACT_VERIFICATION_RESCAN_PENDING"
    && sourceHead.length > 0
    && sourceHead === productionCommit
    && isGitAncestor(rootDir, sourceHead)
    && (isEvidenceCurrentForPaths(rootDir, sourceHead, SHARE_RECIPIENT_CONTACT_VERIFICATION_PATHS) || currentCompatibility)
    && readString(finding.scanId) === "bd135da7-c309-4e8d-ace5-15222dd3f1c7"
    && readString(finding.findingId) === "csf_e6a120c87c57d3529757bbde"
    && readString(finding.ruleId) === "authentication.bearer-invitation-attribution"
    && readString(finding.severity) === "low"
    && finding.immutableFindingPreserved === true
    && finding.freshPostRemediationScanRequired === true
    && contract.invitationWorkerIdAloneAcceptedForConfirmation === false
    && contract.fullSnapshottedPhoneAccepted === true
    && contract.fullSnapshottedEmailAccepted === true
    && contract.partialPhoneAccepted === false
    && contract.verificationValuePersisted === false
    && contract.verificationValueReturned === false
    && contract.verificationValueLogged === false
    && readNumber(contract.missingVerificationStatus) === 403
    && readNumber(contract.mismatchedVerificationStatus) === 403
    && readNumber(contract.missingRecipientContactStatus) === 409
    && contract.databaseInsertOccursOnlyAfterVerification === true
    && contract.serverRecipientSnapshotRemainsAuthoritative === true
    && contract.anonymousShareBehaviorPreserved === true
    && readNumber(ui.inputCountIncrease) === 0
    && ui.mobileConfirmationRemainsInFirstViewport === true
    && ui.desktopRecipientWorkbenchRemainsMultiRegion === true
    && ui.longContentRemainsContained === true
    && readNumber(adjacent.files) === 7
    && readNumber(adjacent.tests) === 124
    && readNumber(adjacent.failed) === 0
    && readString(adjacent.status) === "PASS"
    && readNumber(browser.files) === 1
    && readNumber(browser.tests) === 7
    && readNumber(browser.failed) === 0
    && readString(browser.status) === "PASS"
    && verification.typecheck === "PASS"
    && readString(build.status) === "PASS"
    && readNumber(build.staticPages) === 28
    && (readNumber(live.status) === 404 || currentCompatibility)
    && live.confirmationId === null
    && live.realSavedSessionUsed === false
    && live.realWorkerIdentityUsed === false
    && live.contactVerificationBranchExecuted === false
    && noMutation
    && remaining.freshFullRepositorySecurityScanRequiredForCanonicalClosure === true
    && readString(remaining.liveRealRecipientVerificationProbe) === "NOT_EXECUTED_NO_EXISTING_SAVED_SESSION"
    && readString(remaining.exactSavedShareVerdict) === "MISSING_EVIDENCE"
    && readString(remaining.shareStorageAndCreationApproval) === "APPROVAL_GATED"
    && readString(remaining.recipientAckLiveDataApproval) === "APPROVAL_GATED"
    && remaining.securityCompleteClaimAllowed === false;

  return gateResult({
    id: "share_recipient_contact_verification_security",
    label: "Share recipient contact verification security",
    state: pass ? "notice" : "contradicted",
    evidencePath,
    detail: pass
      ? `Live source requires full snapshotted phone or email verification before an invited worker-attributed Share confirmation insert. The value is not stored or returned, mobile/desktop recipient geometry remains bounded, and current compatibility=${currentCompatibility} records that the safe live missing-session probe now fails earlier at distributed admission with 503 and creates no confirmation. The sealed low finding remains immutable pending a fresh rescan, recipient ACK stays approval-gated, and exact saved Share remains MISSING_EVIDENCE.`
      : `Share recipient verification verdict=${readString(report.verdict) || "missing"}, sourceLive=${sourceHead.length > 0 && sourceHead === productionCommit}, sourceCurrent=${sourceHead.length > 0 && isEvidenceCurrentForPaths(rootDir, sourceHead, SHARE_RECIPIENT_CONTACT_VERIFICATION_PATHS)}, workerIdOnly=${contract.invitationWorkerIdAloneAcceptedForConfirmation === true}, persisted=${contract.verificationValuePersisted === true}, liveStatus=${readNumber(live.status)}, noMutation=${noMutation}, exactShare=${readString(remaining.exactSavedShareVerdict) || "missing"}, ack=${readString(remaining.recipientAckLiveDataApproval) || "missing"}.`,
    nextActions: pass
      ? ["Run a fresh Standard scan before reclassifying the immutable finding; keep exact saved Share and live recipient ACK approval-gated."]
      : ["Restore source/live alignment, full contact verification before insert, non-persistence, browser containment, no-mutation evidence, fresh-rescan requirement, exact Share MISSING_EVIDENCE, and ACK approval gating."],
  });
}

/**
 * @param {string} rootDir
 * @returns {GateResult}
 */
function evaluateSecurityAtomicDbRaceApprovalBoundaryGate(rootDir) {
  const evidencePath = EVIDENCE_PATHS.securityAtomicDbRaceApprovalBoundary;
  const report = readJsonFile(rootDir, evidencePath);
  if (!isRecord(report)) {
    return gateResult({
      id: "security_atomic_db_race_remediation",
      label: "Atomic database race remediation",
      state: "missing",
      evidencePath,
      detail: "Atomic MCP-token and worker-site race approval evidence is missing or invalid.",
      nextActions: ["Restore the no-mutation operator decision packet before authoring any database migration."],
    });
  }

  const sealedScan = isRecord(report.sealedScan) ? report.sealedScan : {};
  const approval = isRecord(report.approvalRequest) ? report.approvalRequest : {};
  const mutation = isRecord(report.mutationBoundary) ? report.mutationBoundary : {};
  const remaining = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  const findings = Array.isArray(report.findings) ? report.findings.filter(isRecord) : [];
  const expectedFindingIds = [
    "csf_a98f91f2e28285923aa618aa",
    "csf_8cec017794f281cd81e25643",
  ];
  const noMutation = mutation.migrationAuthored === false
    && mutation.dbSchemaChanged === false
    && mutation.dbMutationPerformed === false
    && mutation.providerDispatchCalled === false
    && mutation.shareSessionCreated === false
    && mutation.embeddingOrVectorMutationPerformed === false
    && mutation.wikiPublicationPerformed === false
    && mutation.koshaRegistryMutationPerformed === false;
  const pass = readString(report.verdict) === "APPROVAL_REQUIRED_TRANSACTIONAL_DB_RACE_REMEDIATION_NO_MUTATION"
    && readString(report.sourceHead).length > 0
    && isGitAncestor(rootDir, readString(report.sourceHead))
    && readString(sealedScan.scanId) === "bd135da7-c309-4e8d-ace5-15222dd3f1c7"
    && readString(sealedScan.targetRevision) === "8f5dc78f73d5048598fb2519bf7bb758ab090982"
    && sealedScan.immutableFindingsPreserved === true
    && findings.length === 2
    && expectedFindingIds.every((id) => findings.some((finding) => (
      readString(finding.findingId) === id
      && readString(finding.severity) === "low"
      && finding.currentSourceStillAffected === true
      && Array.isArray(finding.requiredVerification)
      && finding.requiredVerification.length >= 5
    )))
    && approval.required === true
    && approval.notApprovedOrPerformed === true
    && noMutation
    && readString(remaining.exactSavedShareVerdict) === "MISSING_EVIDENCE"
    && remaining.securityCompleteClaimAllowed === false
    && remaining.freshFullRepositorySecurityScanRequiredAfterRemediation === true;

  return gateResult({
    id: "security_atomic_db_race_remediation",
    label: "Atomic database race remediation",
    state: pass ? "approval_gated" : "contradicted",
    evidencePath,
    detail: pass
      ? "The MCP token-cap and worker site-binding races have bounded transactional database designs and concurrency test plans, but no migration, RPC, trigger, DB mutation, or closure claim was made. Both sealed low findings remain open pending explicit schema approval, database integration proof, deployment, and a fresh scan; exact saved Share remains MISSING_EVIDENCE."
      : `Atomic-race verdict=${readString(report.verdict) || "missing"}, findings=${findings.length}/2, approvalRequired=${approval.required === true}, approvalPerformed=${approval.notApprovedOrPerformed !== true}, noMutation=${noMutation}, exactShare=${readString(remaining.exactSavedShareVerdict) || "missing"}, securityComplete=${remaining.securityCompleteClaimAllowed === true}.`,
    nextActions: pass
      ? ["Obtain explicit migration/RPC/trigger approval before implementing or running the two transactional database concurrency suites."]
      : ["Restore the immutable finding identities, transactional design, unapproved/no-mutation boundary, fresh-rescan requirement, and exact Share MISSING_EVIDENCE."],
  });
}

const AGENT_CHAT_DURABLE_ADMISSION_PATHS = [
  "lib/openclaw-broker-route.ts",
  "tests/claw-chat-route.test.ts",
];

/**
 * @param {string} rootDir
 * @returns {GateResult}
 */
function evaluateAgentChatDurableAdmissionGate(rootDir) {
  const evidencePath = EVIDENCE_PATHS.agentChatDurableAdmission;
  const report = readJsonFile(rootDir, evidencePath);
  if (!isRecord(report)) {
    return gateResult({
      id: "agent_chat_durable_admission_security",
      label: "Agent chat durable admission security",
      state: "missing",
      evidencePath,
      detail: "Agent Chat durable production admission evidence is missing or invalid.",
      nextActions: ["Restore the deployed source receipt without executing authenticated provider work."],
    });
  }

  const finding = isRecord(report.sealedFinding) ? report.sealedFinding : {};
  const contracts = isRecord(report.contracts) ? report.contracts : {};
  const authenticated = isRecord(contracts.authenticatedIdentityQuota) ? contracts.authenticatedIdentityQuota : {};
  const engine = isRecord(contracts.engineConcurrencyLease) ? contracts.engineConcurrencyLease : {};
  const preAuth = isRecord(contracts.preAuthBoundary) ? contracts.preAuthBoundary : {};
  const verification = isRecord(report.verification) ? report.verification : {};
  const focused = isRecord(verification.focused) ? verification.focused : {};
  const adjacent = isRecord(verification.focusedAndAdjacentCore) ? verification.focusedAndAdjacentCore : {};
  const broader = isRecord(verification.broaderHermesAttempt) ? verification.broaderHermesAttempt : {};
  const build = isRecord(verification.build) ? verification.build : {};
  const production = isRecord(report.productionBuild) ? report.productionBuild : {};
  const live = isRecord(report.liveProbe) ? report.liveProbe : {};
  const mutation = isRecord(report.mutationBoundary) ? report.mutationBoundary : {};
  const remaining = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  const sourceHead = readString(report.sourceHead);
  const noMutation = mutation.dbSchemaChanged === false
    && mutation.dbMutationPerformed === false
    && mutation.providerDispatchCalled === false
    && mutation.providerGenerationExecuted === false
    && mutation.shareSessionCreated === false
    && mutation.vectorOrEmbeddingMutationPerformed === false
    && mutation.wikiPublicationPerformed === false
    && mutation.koshaRegistryMutationPerformed === false;
  const pass = readString(report.verdict) === "PASS_LIVE_DEPLOYED_SOURCE_DURABLE_AGENT_ADMISSION_RESCAN_PENDING"
    && sourceHead.length > 0
    && sourceHead === readString(report.productCommit)
    && sourceHead === readString(production.commitSha)
    && isGitAncestor(rootDir, sourceHead)
    && isEvidenceCurrentForPaths(rootDir, sourceHead, AGENT_CHAT_DURABLE_ADMISSION_PATHS)
    && readString(finding.scanId) === "bd135da7-c309-4e8d-ace5-15222dd3f1c7"
    && readString(finding.findingId) === "csf_dbfc57f541ee5079a9bf9735"
    && readString(finding.ruleId) === "resource-exhaustion.distributed-agent-admission"
    && finding.immutableFindingMutated === false
    && finding.canonicalClosureClaimed === false
    && readString(authenticated.namespace) === "agent-chat-authenticated"
    && readNumber(authenticated.limit) === 5
    && authenticated.distributedRequiredInProduction === true
    && authenticated.missingConfigurationFailsBeforeBodyAndSiteWork === true
    && readString(engine.namespace) === "agent-chat-engine-work"
    && readNumber(engine.defaultConcurrency) === 1
    && engine.distributedRequiredInProduction === true
    && engine.missingConfigurationFailsBeforeAvailabilityOrEngineWork === true
    && engine.busyFailsBeforeEngineWork === true
    && engine.availabilityFailureReleasesLease === true
    && engine.completionAndCancellationReleaseLease === true
    && preAuth.existingUnauthenticated401Preserved === true
    && preAuth.instanceFallbackRetained === true
    && readNumber(focused.files) === 1
    && readNumber(focused.tests) === 24
    && readNumber(focused.failed) === 0
    && readNumber(adjacent.files) === 5
    && readNumber(adjacent.tests) === 55
    && readNumber(adjacent.failed) === 0
    && readNumber(broader.testsPassed) === 107
    && readNumber(broader.testsFailed) === 1
    && readString(broader.status) === "RED_EXISTING_APPROVAL_GATED_SCHEMA_DEPENDENCY"
    && broader.relatedToThisDiff === false
    && readString(verification.typecheck) === "PASS"
    && readString(build.status) === "PASS"
    && readNumber(build.staticPages) === 28
    && readString(production.branch) === "master"
    && readString(production.environment) === "production"
    && production.sourceHeadMatchesProduction === true
    && readNumber(live.status) === 401
    && readString(live.code) === "AUTH_REQUIRED"
    && readString(live.rateLimitMode) === "instance"
    && live.providerWorkExecuted === false
    && live.authenticatedFailClosedProbeExecuted === false
    && readString(live.authenticatedAgentAvailability) === "FAIL_CLOSED_UNTIL_DISTRIBUTED_CONFIG"
    && noMutation
    && readString(remaining.distributedProductionActivation) === "OPEN_OPERATOR_CONFIGURATION"
    && readString(remaining.authenticatedRuntimeProbe) === "NOT_EXECUTED_NO_USER_TOKEN"
    && remaining.freshFullRepositorySecurityScanRequiredForCanonicalClosure === true
    && remaining.securityCompleteClaimAllowed === false
    && readString(remaining.exactSavedShareVerdict) === "MISSING_EVIDENCE"
    && remaining.approvalGatedOperationsRemainApprovalGated === true;

  return gateResult({
    id: "agent_chat_durable_admission_security",
    label: "Agent chat durable admission security",
    state: pass ? "notice" : "contradicted",
    evidencePath,
    detail: pass
      ? "Live source requires a distributed authenticated-user quota and engine-work lease before Agent Chat model or tool execution, with busy, failure, completion, and cancellation release covered by 24 focused and 55 adjacent tests. Production still reports pre-auth instance mode, so authenticated Agent Chat is fail-closed until operator configuration; the immutable medium finding and fresh rescan remain open, no provider or mutation work occurred, and exact saved Share remains MISSING_EVIDENCE."
      : `Agent admission verdict=${readString(report.verdict) || "missing"}, sourceLive=${sourceHead.length > 0 && sourceHead === readString(production.commitSha)}, sourceCurrent=${sourceHead.length > 0 && isEvidenceCurrentForPaths(rootDir, sourceHead, AGENT_CHAT_DURABLE_ADMISSION_PATHS)}, distributed=${readString(remaining.distributedProductionActivation) || "missing"}, authProbe=${readString(remaining.authenticatedRuntimeProbe) || "missing"}, noMutation=${noMutation}, exactShare=${readString(remaining.exactSavedShareVerdict) || "missing"}.`,
    nextActions: pass
      ? [
          "Configure the approved distributed backend and run a bounded authenticated no-provider admission probe.",
          "Run a fresh Standard scan before reclassifying the immutable finding or claiming security completion.",
        ]
      : ["Restore deployed source alignment, production fail-closed contracts, verification receipts, no-mutation boundaries, rescan requirement, and exact Share MISSING_EVIDENCE."],
  });
}

const MCP_PROVIDER_ADMISSION_PATHS = [
  "app/api/mcp/[transport]/implementation.ts",
  "lib/mcp-auth.ts",
  "lib/mcp-provider-admission.ts",
  "lib/mcp-tools.ts",
  "tests/mcp-auth.test.ts",
  "tests/mcp-provider-admission.test.ts",
  "tests/mcp-work-budget.test.ts",
];

/**
 * @param {string} rootDir
 * @returns {GateResult}
 */
function evaluateMcpProviderAdmissionGate(rootDir) {
  const evidencePath = EVIDENCE_PATHS.mcpProviderAdmission;
  const report = readJsonFile(rootDir, evidencePath);
  if (!isRecord(report)) {
    return gateResult({
      id: "mcp_provider_admission_security",
      label: "MCP provider admission security",
      state: "missing",
      evidencePath,
      detail: "MCP provider durable admission evidence is missing or invalid.",
      nextActions: ["Restore the deployed source receipt without using a production MCP token or invoking provider work."],
    });
  }

  const production = isRecord(report.productionBuild) ? report.productionBuild : {};
  const finding = isRecord(report.sealedFinding) ? report.sealedFinding : {};
  const contracts = isRecord(report.contracts) ? report.contracts : {};
  const rate = isRecord(contracts.tokenTenantRateAdmission) ? contracts.tokenTenantRateAdmission : {};
  const lease = isRecord(contracts.providerConcurrencyLease) ? contracts.providerConcurrencyLease : {};
  const weights = isRecord(lease.weights) ? lease.weights : {};
  const preserved = isRecord(contracts.preservedBehavior) ? contracts.preservedBehavior : {};
  const verification = isRecord(report.verification) ? report.verification : {};
  const focused = isRecord(verification.focused) ? verification.focused : {};
  const adjacent = isRecord(verification.focusedAndAdjacentMcp) ? verification.focusedAndAdjacentMcp : {};
  const build = isRecord(verification.build) ? verification.build : {};
  const live = isRecord(report.liveProbe) ? report.liveProbe : {};
  const mutation = isRecord(report.mutationBoundary) ? report.mutationBoundary : {};
  const remaining = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  const sourceHead = readString(report.sourceHead);
  const tools = Array.isArray(contracts.providerGeneratingTools)
    ? contracts.providerGeneratingTools.map(readString)
    : [];
  const noMutation = mutation.dbSchemaChanged === false
    && mutation.dbMutationPerformed === false
    && mutation.providerDispatchCalled === false
    && mutation.providerGenerationExecuted === false
    && mutation.shareSessionCreated === false
    && mutation.vectorOrEmbeddingMutationPerformed === false
    && mutation.wikiPublicationPerformed === false
    && mutation.koshaRegistryMutationPerformed === false;
  const currentCompatibility = isShareMcpCurrentSourceCompatibilityCurrent(
    rootDir,
    "mcp_provider_admission_security",
    MCP_PROVIDER_ADMISSION_PATHS
  ) || isCurrentSecurityGovernedPathReceiptCurrent(rootDir, MCP_PROVIDER_ADMISSION_PATHS)
    || isCurrentMcpGenerationCancellationCompatibility(rootDir, MCP_PROVIDER_ADMISSION_PATHS);
  const pass = readString(report.verdict) === "PASS_LIVE_DEPLOYED_SOURCE_DURABLE_MCP_PROVIDER_ADMISSION_RESCAN_PENDING"
    && sourceHead.length > 0
    && sourceHead === readString(report.productCommit)
    && sourceHead === readString(production.commitSha)
    && isGitAncestor(rootDir, sourceHead)
    && (isEvidenceCurrentForPaths(rootDir, sourceHead, MCP_PROVIDER_ADMISSION_PATHS) || currentCompatibility)
    && readString(finding.scanId) === "bd135da7-c309-4e8d-ace5-15222dd3f1c7"
    && readString(finding.findingId) === "csf_b10479b6501c208c4d11644e"
    && readString(finding.ruleId) === "resource-exhaustion.distributed-provider-admission"
    && finding.immutableFindingMutated === false
    && finding.canonicalClosureClaimed === false
    && tools.length === 2
    && tools.includes("generate_safety_docpack")
    && tools.includes("generate_reviewed_safety_docpack")
    && readString(rate.namespace) === "mcp-provider-generation"
    && readNumber(rate.limit) === 10
    && readNumber(rate.windowMs) === 60000
    && rate.bearerStoredOrLogged === false
    && rate.sha256BearerFingerprintIncluded === true
    && rate.organizationAndSiteIncluded === true
    && rate.distributedRequiredInProduction === true
    && rate.missingOrPartialConfigurationFailsBeforeProviderHandler === true
    && readString(lease.namespace) === "mcp-provider-generation-work"
    && readNumber(lease.capacity) === 12
    && readNumber(lease.leaseMs) === 310000
    && readNumber(weights.template) === 0
    && readNumber(weights.enhanced) === 2
    && readNumber(weights.full) === 12
    && lease.distributedRequiredInProduction === true
    && lease.busyFailsBeforeProviderHandler === true
    && lease.completionAndFailureReleaseLease === true
    && preserved.readOnlyMcpToolsUnaffected === true
    && preserved.templateModeOutsideProviderAdmission === true
    && preserved.developmentWeightedInstanceFallbackRetained === true
    && readNumber(focused.files) === 3
    && readNumber(focused.tests) === 61
    && readNumber(focused.failed) === 0
    && readNumber(adjacent.files) === 8
    && readNumber(adjacent.tests) >= 94
    && readNumber(adjacent.failed) === 0
    && readString(verification.typecheck) === "PASS"
    && readNumber(verification.dependencyAuditVulnerabilities) === 0
    && readString(build.status) === "PASS"
    && readNumber(build.staticPages) === 28
    && readString(production.branch) === "master"
    && readString(production.environment) === "production"
    && production.sourceHeadMatchesProduction === true
    && ((readNumber(live.status) === 401 && readString(live.rateLimitMode) === "instance") || currentCompatibility)
    && live.mcpToolDispatchPerformed === false
    && live.providerGenerationExecuted === false
    && live.validAuthenticatedFailClosedProbeExecuted === false
    && readString(live.authenticatedProviderGenerationAvailability) === "FAIL_CLOSED_UNTIL_DISTRIBUTED_CONFIG"
    && noMutation
    && readString(remaining.distributedProductionActivation) === "OPEN_OPERATOR_CONFIGURATION"
    && readString(remaining.validAuthenticatedRuntimeProbe) === "NOT_EXECUTED_NO_MCP_TOKEN"
    && remaining.freshFullRepositorySecurityScanRequiredForCanonicalClosure === true
    && remaining.securityCompleteClaimAllowed === false
    && readString(remaining.exactSavedShareVerdict) === "MISSING_EVIDENCE"
    && remaining.approvalGatedOperationsRemainApprovalGated === true;

  return gateResult({
    id: "mcp_provider_admission_security",
    label: "MCP provider admission security",
    state: pass ? "notice" : "contradicted",
    evidencePath,
    detail: pass
      ? `Live source requires token-and-tenant-bound distributed rate admission plus a weighted durable lease before either provider-generating MCP tool runs, while read-only tools and deterministic template mode remain available. Current compatibility=${currentCompatibility} records that an invalid non-secret token now fails earlier at distributed admission with 503 before auth, tool dispatch, or provider work. Valid authenticated generation remains unprobed without an MCP token and fail-closed until operator configuration; the immutable medium finding and fresh rescan remain open, no provider or mutation work occurred, and exact saved Share remains MISSING_EVIDENCE.`
      : `MCP provider admission verdict=${readString(report.verdict) || "missing"}, sourceLive=${sourceHead.length > 0 && sourceHead === readString(production.commitSha)}, sourceCurrent=${sourceHead.length > 0 && isEvidenceCurrentForPaths(rootDir, sourceHead, MCP_PROVIDER_ADMISSION_PATHS)}, distributed=${readString(remaining.distributedProductionActivation) || "missing"}, authProbe=${readString(remaining.validAuthenticatedRuntimeProbe) || "missing"}, noMutation=${noMutation}, exactShare=${readString(remaining.exactSavedShareVerdict) || "missing"}.`,
    nextActions: pass
      ? [
          "Configure the approved distributed backend and run a bounded authenticated no-provider MCP admission probe.",
          "Run a fresh Standard scan before reclassifying the immutable finding or claiming security completion.",
        ]
      : ["Restore deployed source alignment, token/tenant rate admission, weighted lease, verification receipts, no-mutation boundaries, rescan requirement, and exact Share MISSING_EVIDENCE."],
  });
}

/**
 * @param {string} rootDir
 * @returns {GateResult}
 */
function evaluateLearningExportRendererSecurityGate(rootDir) {
  const evidencePath = EVIDENCE_PATHS.learningExportRendererSecurity;
  const report = readJsonFile(rootDir, evidencePath);
  if (!isRecord(report)) {
    return gateResult({
      id: "learning_export_renderer_security",
      label: "Learning export renderer security",
      state: "missing",
      evidencePath,
      detail: "Learning export renderer-security evidence is missing or invalid.",
      nextActions: ["Verify inert Markdown/Obsidian bytes and attachment response controls without creating a production workpack."],
    });
  }

  const productionBuild = isRecord(report.productionBuild) ? report.productionBuild : {};
  const candidate = isRecord(report.candidate) ? report.candidate : {};
  const rendererContract = isRecord(report.rendererContract) ? report.rendererContract : {};
  const controls = isRecord(report.controls) ? report.controls : {};
  const verification = isRecord(report.verification) ? report.verification : {};
  const mutationBoundary = isRecord(report.mutationBoundary) ? report.mutationBoundary : {};
  const remainingBoundaries = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  const sourceHead = readString(report.sourceHead);
  const noMutation = mutationBoundary.dbMutationPerformed === false
    && mutationBoundary.shareSessionCreated === false
    && mutationBoundary.providerDispatchCalled === false
    && mutationBoundary.embeddingGenerated === false
    && mutationBoundary.vectorUploadPerformed === false
    && mutationBoundary.wikiPublished === false
    && mutationBoundary.exactTrustRegistryMutationPerformed === false;
  const pass = readString(report.verdict) === "PASS_LIVE_PRODUCTION_RENDERER_INERT_LEARNING_EXPORT_SOURCE_CONTRACT"
    && sourceHead.length > 0
    && sourceHead === readString(productionBuild.commitSha)
    && (isEvidenceCurrentForPaths(rootDir, sourceHead, LEARNING_EXPORT_RENDERER_SECURITY_PATHS)
      || isCurrentSecurityGovernedPathCompatibility(rootDir, "learning_export_renderer_security", LEARNING_EXPORT_RENDERER_SECURITY_PATHS))
    && productionBuild.sourceHeadMatchesProduction === true
    && productionBuild.liveAfterDeploymentPending === false
    && readString(candidate.id) === "candidate-5ae4fb7bd6d7ea24"
    && readString(candidate.originalDisposition) === "needs_follow_up"
    && readString(candidate.currentSourceDisposition) === "bounded_renderer_independent_inert_text_contract"
    && candidate.fullRepositoryRescanRequiredForCanonicalClosure === true
    && rendererContract.applicationEmbeddedRenderer === false
    && readString(rendererContract.deliveryDisposition) === "attachment"
    && readString(rendererContract.obsidianRole) === "optional_operator_review_tool"
    && rendererContract.externalRendererTrustRequired === false
    && rendererContract.jsonlRawProvenancePreserved === true
    && controls.rawHtmlDelimitersEntityEncoded === true
    && controls.markdownImageAndLinkOpenersEscaped === true
    && controls.obsidianEmbedOpenersEscaped === true
    && controls.obsidianSegmentsBlockPathAndEmbedMetacharacters === true
    && Array.isArray(controls.activeAndLocalUriSchemesNeutralized)
    && controls.activeAndLocalUriSchemesNeutralized.length === 4
    && controls.frontmatterDynamicValuesNeutralized === true
    && controls.contentDispositionAttachment === true
    && controls.contentSecurityPolicySandbox === true
    && controls.contentTypeNosniff === true
    && controls.cacheControlPrivateNoStore === true
    && controls.referrerPolicyNoReferrer === true
    && readNumber(verification.focusedTestFiles) === 5
    && readNumber(verification.focusedTestsPassed) === 87
    && readString(verification.strictTypecheck) === "PASS"
    && readString(verification.productionBuild) === "PASS"
    && readNumber(verification.staticPagesGenerated) === 28
    && verification.hostileFixtureRawHtmlAbsent === true
    && verification.hostileFixtureActiveUriAbsent === true
    && verification.hostileFixtureObsidianEmbedAbsent === true
    && verification.jsonlRawProvenanceRetained === true
    && noMutation
    && readString(remainingBoundaries.canonicalFollowUpScanCompleteness) === "partial"
    && readNumber(remainingBoundaries.canonicalDeferredCandidateCount) === 1
    && remainingBoundaries.securityCompleteClaimAllowed === false
    && remainingBoundaries.liveSuccessResponseProbeAvailableWithoutStoredWorkpack === false
    && remainingBoundaries.liveAfterDeploymentRequired === false
    && remainingBoundaries.distributedRateLimitResidual === true
    && readString(remainingBoundaries.exactSavedShareVerdict) === "MISSING_EVIDENCE";

  if (pass) {
    return gateResult({
      id: "learning_export_renderer_security",
      label: "Learning export renderer security",
      state: "proven",
      evidencePath,
      detail: "Live source alignment proves a renderer-independent inert-text contract for downloaded Markdown/Obsidian learning exports: raw HTML, active/local URI schemes, image/link openers, Obsidian embeds, path metacharacters, and frontmatter are bounded; attachment CSP/no-sniff/no-store/no-referrer controls are present; JSONL provenance remains raw. This bounds the deferred candidate in current source but does not rewrite the sealed partial scan, replace a future full rescan, create a stored workpack, or close exact saved Share MISSING_EVIDENCE.",
      nextActions: [
        "Re-run the full repository security scan after the remaining findings are remediated so the immutable canonical coverage can reclassify the deferred candidate.",
      ],
    });
  }

  return gateResult({
    id: "learning_export_renderer_security",
    label: "Learning export renderer security",
    state: "contradicted",
    evidencePath,
    detail: `Learning export verdict=${readString(report.verdict) || "unknown"}, sourceMatchesProduction=${readString(report.sourceHead) === readString(productionBuild.commitSha)}, disposition=${readString(candidate.currentSourceDisposition) || "missing"}, tests=${readNumber(verification.focusedTestsPassed)}, canonicalDeferred=${readNumber(remainingBoundaries.canonicalDeferredCandidateCount)}, securityComplete=${remainingBoundaries.securityCompleteClaimAllowed === true}, noMutation=${noMutation}, exactShare=${readString(remainingBoundaries.exactSavedShareVerdict) || "missing"}.`,
    nextActions: ["Restore the inert-byte, response-header, provenance, no-mutation, and canonical-rescan boundaries before claiming this current-source remediation."],
  });
}

/**
 * @param {string} rootDir
 * @returns {GateResult}
 */
function evaluatePublicSearchDistributedRateLimitReadinessGate(rootDir) {
  const evidencePath = EVIDENCE_PATHS.publicSearchDistributedRateLimitReadiness;
  const report = readJsonFile(rootDir, evidencePath);
  if (!isRecord(report)) {
    return gateResult({
      id: "public_search_distributed_rate_limit_readiness",
      label: "Public search distributed rate-limit readiness",
      state: "missing",
      evidencePath,
      detail: "Distributed public-search rate-limit readiness evidence is missing or invalid.",
      nextActions: ["Restore the bounded current-source readiness report without claiming live distributed protection."],
    });
  }

  const productionBuild = isRecord(report.productionBuild) ? report.productionBuild : {};
  const contract = isRecord(report.currentSourceContract) ? report.currentSourceContract : {};
  const configuration = isRecord(report.configuration) ? report.configuration : {};
  const verification = isRecord(report.verification) ? report.verification : {};
  const tests = isRecord(verification.focusedAndAdjacentTests) ? verification.focusedAndAdjacentTests : {};
  const build = isRecord(verification.build) ? verification.build : {};
  const boundary = isRecord(report.boundary) ? report.boundary : {};
  const liveProbes = Array.isArray(report.liveProbes) ? report.liveProbes : [];
  const liveProbePass = liveProbes.length === 2
    && liveProbes.every((probe) => isRecord(probe)
      && readNumber(probe.status) === 503
      && readString(probe.rateLimitHeader) === "distributed"
      && readNumber(probe.retryAfterSeconds) === 5
      && readString(probe.code) === "DISTRIBUTED_RATE_LIMIT_UNAVAILABLE"
      && probe.providerCallExecuted === false);
  const pass = readString(report.verdict) === "PASS_LIVE_PRODUCTION_PUBLIC_SEARCH_DISTRIBUTED_CONFIGURATION_TRUTH"
    && readString(report.sourceHead).length > 0
    && productionBuild.sourceHeadMatchesProduction === true
    && productionBuild.productCommitIsAncestorOfProduction === true
    && contract.atomicDistributedCounter === true
    && contract.serverOnlyRestCredentials === true
    && contract.httpsOnlyEndpoint === true
    && contract.clientIdentifierSha256Hashed === true
    && contract.rawClientIpSentToStore === false
    && contract.partialConfigurationFailsClosed === true
    && contract.distributedFailureFailsClosedBeforeProviderWork === true
    && contract.productionRequiresDistributedAdmission === true
    && contract.absentConfigurationFailsClosedBeforeProviderWork === true
    && contract.productionInstanceFallbackAllowed === false
    && contract.developmentInstanceFallbackAllowed === true
    && readString(contract.responseModeHeader) === "X-SafeClaw-Rate-Limit"
    && readNumber(contract.providerCallsOnPartialConfiguration) === 0
    && readNumber(contract.providerCallsOnAbsentConfiguration) === 0
    && configuration.productionConfigured === false
    && configuration.productionModeVerified === true
    && readString(configuration.configurationState) === "absent"
    && readString(configuration.readinessMode) === "unavailable"
    && readString(configuration.observedResponseMode) === "distributed"
    && configuration.responseModeHeaderDoesNotProveConfigurationReady === true
    && configuration.distributedActivationPending === true
    && liveProbePass
    && readNumber(tests.files) === 3
    && readNumber(tests.tests) === 19
    && readNumber(tests.failed) === 0
    && readString(verification.typecheck) === "PASS"
    && readString(build.status) === "PASS"
    && readNumber(build.staticPages) === 28
    && boundary.sealedScanMutated === false
    && boundary.sealedFindingsClosedWithoutRescan === false
    && boundary.immutableOriginalBaselinePreserved === true
    && boundary.distributedProtectionConfiguredLive === false
    && boundary.productionFailClosedObserved === true
    && boundary.databaseFindingsRemainApprovalGated === true
    && boundary.dbMutationPerformed === false
    && boundary.providerDispatchCalled === false
    && boundary.shareSessionCreated === false
    && boundary.vectorMutationPerformed === false
    && boundary.wikiPublicationPerformed === false
    && boundary.koshaRegistryMutationPerformed === false
    && readString(boundary.exactSavedShareVerdict) === "MISSING_EVIDENCE";

  return gateResult({
    id: "public_search_distributed_rate_limit_readiness",
    label: "Public search distributed rate-limit readiness",
    state: pass ? "notice" : "contradicted",
    evidencePath,
    detail: pass
      ? "Live production requires distributed admission for both public search routes and fails closed before provider work when the Upstash configuration state is absent. Both bounded probes returned HTTP 503 with X-SafeClaw-Rate-Limit=distributed and DISTRIBUTED_RATE_LIMIT_UNAVAILABLE; that response mode identifies the required guard path, not configured distributed protection. Activation and a fresh full scan remain required before closing the two sealed search findings; database findings remain approval-gated and exact saved Share remains MISSING_EVIDENCE."
      : `Distributed configuration-truth verdict=${readString(report.verdict) || "unknown"}, config=${readString(configuration.configurationState) || "unknown"}, responseMode=${readString(configuration.observedResponseMode) || "unknown"}, liveProbes=${liveProbePass}, tests=${readNumber(tests.tests)}, sealedClosed=${boundary.sealedFindingsClosedWithoutRescan === true}, exactShare=${readString(boundary.exactSavedShareVerdict) || "missing"}.`,
    nextActions: pass
      ? [
          "Configure both server-only Upstash REST variables through an approved production environment change.",
          "After configuration reaches ready, verify bounded successful requests use distributed admission, then rerun the full repository scan before closing either sealed finding.",
        ]
      : ["Restore every current-source, fail-closed, verification, no-mutation, sealed-scan, and exact-Share predicate."],
  });
}

/**
 * @param {string} rootDir
 * @param {string} sourceSha
 * @param {string[]} governedPaths
 */
function isEvidenceCurrentForPaths(rootDir, sourceSha, governedPaths) {
  if (!isGitAncestor(rootDir, sourceSha) || governedPaths.length === 0) {
    return false;
  }
  const cacheKey = `${rootDir}\0${sourceSha}\0${governedPaths.join("\0")}`;
  if (evidencePathCurrentCache.has(cacheKey)) {
    return evidencePathCurrentCache.get(cacheKey);
  }
  try {
    execFileSync("git", ["diff", "--quiet", `${sourceSha}..HEAD`, "--", ...governedPaths], {
      cwd: rootDir,
      stdio: ["ignore", "ignore", "ignore"],
    });
    evidencePathCurrentCache.set(cacheKey, true);
    return true;
  } catch {
    const currentScanPass = currentSecurityScanClearsGovernedPaths(rootDir, governedPaths);
    evidencePathCurrentCache.set(cacheKey, currentScanPass);
    return currentScanPass;
  }
}

/**
 * A sealed current scan may supersede an older receipt only when the scan target
 * still governs every requested path and no reportable finding intersects them.
 *
 * @param {string} rootDir
 * @param {string[]} governedPaths
 */
function currentSecurityScanClearsGovernedPaths(rootDir, governedPaths) {
  const report = readJsonFile(rootDir, EVIDENCE_PATHS.currentRepositorySecurityRescan);
  const scan = isRecord(report) && isRecord(report.scan) ? report.scan : {};
  if (!isRecord(report)
    || readString(report.verdict) !== "NOTICE_CURRENT_HEAD_STANDARD_SCAN_19_FINDINGS_PARTIAL_COVERAGE_REMEDIATION_REQUIRED"
    || readString(report.scanId) !== "da97e400-1f4d-40b9-a434-ab5ab013fdb3"
    || readNumber(scan.reportableFindingCount) !== 19
    || readString(scan.coverage) !== "complete") {
    return false;
  }
  const scanRevision = readString(report.scanRevision);
  const canonical = isRecord(report.canonicalArtifacts) ? report.canonicalArtifacts : {};
  const findingsPath = readString(canonical.findings);
  if (!scanRevision || !findingsPath || !isGitAncestor(rootDir, scanRevision)) {
    return false;
  }
  try {
    execFileSync("git", ["diff", "--quiet", `${scanRevision}..HEAD`, "--", ...governedPaths], {
      cwd: rootDir,
      stdio: ["ignore", "ignore", "ignore"],
    });
  } catch {
    return false;
  }
  const canonicalFindings = readJsonFile(rootDir, findingsPath);
  const findings = isRecord(canonicalFindings) && Array.isArray(canonicalFindings.findings)
    ? canonicalFindings.findings.filter(isRecord)
    : [];
  if (findings.length !== 19) {
    return false;
  }
  const normalizedGovernedPaths = governedPaths.map((value) => value.replaceAll("\\", "/"));
  return findings.every((finding) => {
    const locations = Array.isArray(finding.locations) ? finding.locations.filter(isRecord) : [];
    return locations.every((location) => {
      const findingPath = readString(location.path).replaceAll("\\", "/");
      return normalizedGovernedPaths.every((governedPath) => (
        findingPath !== governedPath
        && !findingPath.startsWith(`${governedPath}/`)
        && !governedPath.startsWith(`${findingPath}/`)
      ));
    });
  });
}

const PUBLIC_PROVIDER_ADMISSION_COMPATIBILITY_GATE_IDS = [
  "security_followup_remediation",
  "public_json_request_body_budget",
  "improvement_photo_analysis_budget",
  "public_provider_cancellation",
];

const PUBLIC_PROVIDER_ADMISSION_CHANGED_PATHS = [
  "app/api/ask/route.ts",
  "app/api/ask/stream/route.ts",
  "app/api/knowledge/match/route.ts",
  "app/api/weather/route.ts",
  "lib/public-ask-admission.ts",
  "lib/public-distributed-rate-limit.ts",
];

const PUBLIC_ASK_DISTRIBUTED_ADMISSION_COMPATIBILITY_GATE_IDS = [
  "public_json_request_body_budget",
  "public_provider_cancellation",
  "public_provider_admission",
  "public_generation_admission_security",
];

const PUBLIC_ASK_DISTRIBUTED_ADMISSION_CHANGED_PATHS = [
  "app/api/ask/route.ts",
  "app/api/ask/stream/route.ts",
  "app/api/knowledge/regenerate/route.ts",
  "app/api/knowledge/review/prepare/route.ts",
  "app/api/workpack/remediate/route.ts",
  "components/SafeGuardCommandCenter.tsx",
  "lib/ask-stream-client.ts",
  "lib/public-ask-admission.ts",
];

/**
 * @param {string} rootDir
 * @param {string} gateId
 * @param {string[]} governedPaths
 */
function isPublicAskDistributedAdmissionCompatibilityCurrent(rootDir, gateId, governedPaths) {
  const report = readJsonFile(rootDir, EVIDENCE_PATHS.publicAskDistributedAdmission);
  if (!isRecord(report) || !isRecord(report.governedPathCompatibility)) {
    return false;
  }
  const compatibility = report.governedPathCompatibility;
  const coveredGateIds = Array.isArray(compatibility.coveredGateIds)
    ? compatibility.coveredGateIds.map(readString)
    : [];
  const changedProductPaths = Array.isArray(compatibility.changedProductPaths)
    ? compatibility.changedProductPaths.map(readString)
    : [];
  const focused = isRecord(compatibility.focusedVitest) ? compatibility.focusedVitest : {};
  const adjacent = isRecord(compatibility.focusedAndAdjacentVitest) ? compatibility.focusedAndAdjacentVitest : {};
  const sourceHead = readString(compatibility.sourceHead);
  const productionCommit = readString(compatibility.productionCommit);
  return readString(report.verdict) === "PASS_LIVE_PRODUCTION_PUBLIC_ASK_PROVIDER_MODES_FAIL_CLOSED_WITHOUT_DISTRIBUTED_ADMISSION"
    && readString(compatibility.verdict) === "PASS_LIVE_PRODUCTION_PUBLIC_ASK_DISTRIBUTED_ADMISSION_GOVERNED_PATH_COMPATIBILITY"
    && sourceHead.length > 0
    && sourceHead === readString(report.sourceHead)
    && sourceHead === readString(report.productCommit)
    && productionCommit === readString(report.productionCommit)
    && isGitAncestor(rootDir, sourceHead)
    && isGitAncestor(rootDir, productionCommit)
    && isEvidenceCurrentForPaths(rootDir, sourceHead, governedPaths)
    && coveredGateIds.length === PUBLIC_ASK_DISTRIBUTED_ADMISSION_COMPATIBILITY_GATE_IDS.length
    && PUBLIC_ASK_DISTRIBUTED_ADMISSION_COMPATIBILITY_GATE_IDS.every((id) => coveredGateIds.includes(id))
    && coveredGateIds.includes(gateId)
    && changedProductPaths.length === PUBLIC_ASK_DISTRIBUTED_ADMISSION_CHANGED_PATHS.length
    && PUBLIC_ASK_DISTRIBUTED_ADMISSION_CHANGED_PATHS.every((item) => changedProductPaths.includes(item))
    && readNumber(focused.files) === 3
    && readNumber(focused.tests) === 21
    && readNumber(focused.failed) === 0
    && readNumber(adjacent.files) === 11
    && readNumber(adjacent.tests) === 67
    && readNumber(adjacent.failed) === 0
    && compatibility.originalSecurityBaselineRewritten === false
    && compatibility.noMutation === true
    && compatibility.providerCallExecuted === false
    && readString(compatibility.freshFollowUpScan) === "REQUIRED"
    && readString(compatibility.exactSavedShareVerdict) === "MISSING_EVIDENCE";
}

const PUBLIC_SEARCH_DISTRIBUTED_ADMISSION_COMPATIBILITY_GATE_IDS = [
  "public_provider_cancellation",
  "public_provider_admission",
];

const PUBLIC_SEARCH_DISTRIBUTED_ADMISSION_CHANGED_PATHS = [
  "app/api/search/route.ts",
  "app/api/safety-reference/search/route.ts",
  "app/api/weather/route.ts",
  "lib/public-search-admission.ts",
];

/**
 * @param {string} rootDir
 * @param {string} gateId
 * @param {string[]} governedPaths
 */
function isPublicSearchDistributedAdmissionCompatibilityCurrent(rootDir, gateId, governedPaths) {
  const report = readJsonFile(rootDir, EVIDENCE_PATHS.publicSearchDistributedAdmission);
  if (!isRecord(report) || !isRecord(report.governedPathCompatibility)) return false;
  const compatibility = report.governedPathCompatibility;
  const coveredGateIds = Array.isArray(compatibility.coveredGateIds)
    ? compatibility.coveredGateIds.map(readString)
    : [];
  const changedProductPaths = Array.isArray(compatibility.changedProductPaths)
    ? compatibility.changedProductPaths.map(readString)
    : [];
  const tests = isRecord(compatibility.focusedAndAdjacentVitest)
    ? compatibility.focusedAndAdjacentVitest
    : {};
  const sourceHead = readString(compatibility.sourceHead);
  const productionCommit = readString(compatibility.productionCommit);
  return readString(report.verdict) === "PASS_LIVE_PRODUCTION_PUBLIC_SEARCH_PROVIDER_WORK_FAILS_CLOSED_WITHOUT_DISTRIBUTED_ADMISSION"
    && readString(compatibility.verdict) === "PASS_LIVE_PRODUCTION_PUBLIC_SEARCH_DISTRIBUTED_ADMISSION_GOVERNED_PATH_COMPATIBILITY"
    && sourceHead.length > 0
    && sourceHead === readString(report.sourceHead)
    && sourceHead === readString(report.productCommit)
    && productionCommit === readString(report.productionCommit)
    && isGitAncestor(rootDir, sourceHead)
    && isGitAncestor(rootDir, productionCommit)
    && isEvidenceCurrentForPaths(rootDir, sourceHead, governedPaths)
    && coveredGateIds.length === PUBLIC_SEARCH_DISTRIBUTED_ADMISSION_COMPATIBILITY_GATE_IDS.length
    && PUBLIC_SEARCH_DISTRIBUTED_ADMISSION_COMPATIBILITY_GATE_IDS.every((id) => coveredGateIds.includes(id))
    && coveredGateIds.includes(gateId)
    && changedProductPaths.length === PUBLIC_SEARCH_DISTRIBUTED_ADMISSION_CHANGED_PATHS.length
    && PUBLIC_SEARCH_DISTRIBUTED_ADMISSION_CHANGED_PATHS.every((item) => changedProductPaths.includes(item))
    && readNumber(tests.files) === 5
    && readNumber(tests.tests) === 35
    && readNumber(tests.failed) === 0
    && compatibility.originalSecurityBaselineRewritten === false
    && compatibility.noMutation === true
    && compatibility.providerCallExecuted === false
    && readString(compatibility.freshFollowUpScan) === "REQUIRED"
    && readString(compatibility.exactSavedShareVerdict) === "MISSING_EVIDENCE";
}

const SECURITY_RESOURCE_REMEDIATION_CHANGED_PATHS = [
  "app/api/knowledge/ingest/route.ts",
  "app/api/knowledge/review/prepare/route.ts",
  "app/api/knowledge/review/route.ts",
  "app/api/mcp/[transport]/implementation.ts",
  "app/api/share-sessions/[sessionId]/route.ts",
  "app/api/workpack/remediate/route.ts",
  "lib/openclaw-chat.ts",
  "lib/public-work-budget.ts",
];

const SECURITY_RESOURCE_REMEDIATION_COMPATIBILITY_GATE_IDS = [
  "public_json_request_body_budget",
  "public_provider_cancellation",
  "public_provider_admission",
];

const SECURITY_UPSTREAM_TRANSPORT_CHANGED_PATHS = [
  ".env.example",
  "lib/accident-cases.ts",
  "lib/server/upstream-http.ts",
  "lib/weather.ts",
];

const SECURITY_UPSTREAM_TRANSPORT_COMPATIBILITY_GATE_IDS = [
  "security_followup_remediation",
  "public_provider_cancellation",
  "public_provider_work_budget",
];

/**
 * @param {string} rootDir
 * @param {string} gateId
 * @param {string[]} governedPaths
 */
function isSecurityUpstreamTransportCompatibilityCurrent(rootDir, gateId, governedPaths) {
  const report = readJsonFile(rootDir, EVIDENCE_PATHS.securityUpstreamTransportRemediation);
  if (!isRecord(report) || !isRecord(report.governedPathCompatibility)) {
    return false;
  }
  const compatibility = report.governedPathCompatibility;
  const coveredGateIds = Array.isArray(compatibility.coveredGateIds)
    ? compatibility.coveredGateIds.map(readString)
    : [];
  const changedGovernedPaths = Array.isArray(compatibility.changedGovernedPaths)
    ? compatibility.changedGovernedPaths.map(readString)
    : [];
  const focused = isRecord(compatibility.focused) ? compatibility.focused : {};
  const adjacent = isRecord(compatibility.adjacent) ? compatibility.adjacent : {};
  const sourceHead = readString(compatibility.sourceHead);
  const productionCommit = readString(compatibility.productionCommit);
  return readString(report.verdict) === "PASS_LIVE_PRODUCTION_SOURCE_PROVEN_UPSTREAM_TRANSPORT_SECURITY_NO_PROVIDER_PROBE"
    && readString(compatibility.verdict) === "PASS_LIVE_PRODUCTION_UPSTREAM_TRANSPORT_COMPATIBILITY"
    && sourceHead.length > 0
    && sourceHead === productionCommit
    && productionCommit === readString(report.productionCommit)
    && isGitAncestor(rootDir, productionCommit)
    && isEvidenceCurrentForPaths(rootDir, productionCommit, governedPaths)
    && coveredGateIds.length === SECURITY_UPSTREAM_TRANSPORT_COMPATIBILITY_GATE_IDS.length
    && SECURITY_UPSTREAM_TRANSPORT_COMPATIBILITY_GATE_IDS.every((id) => coveredGateIds.includes(id))
    && coveredGateIds.includes(gateId)
    && changedGovernedPaths.length === SECURITY_UPSTREAM_TRANSPORT_CHANGED_PATHS.length
    && SECURITY_UPSTREAM_TRANSPORT_CHANGED_PATHS.every((item) => changedGovernedPaths.includes(item))
    && readNumber(focused.testFiles) === 5
    && readNumber(focused.tests) === 32
    && readString(focused.status) === "PASS"
    && readNumber(adjacent.testFiles) === 11
    && readNumber(adjacent.tests) === 119
    && readString(adjacent.status) === "PASS"
    && compatibility.noMutation === true
    && readString(compatibility.exactSavedShareVerdict) === "MISSING_EVIDENCE";
}

const SECURITY_SAFETY_REFERENCE_SURFACE_CHANGED_PATHS = [
  "lib/safety-reference-catalog.ts",
];

const SECURITY_SAFETY_REFERENCE_SURFACE_COMPATIBILITY_GATE_IDS = [
  "security_followup_remediation",
];

/**
 * @param {string} rootDir
 * @param {string} gateId
 * @param {string[]} governedPaths
 */
function isSecuritySafetyReferenceSurfaceCompatibilityCurrent(rootDir, gateId, governedPaths) {
  const report = readJsonFile(rootDir, EVIDENCE_PATHS.securitySafetyReferenceSurfaceRemediation);
  if (!isRecord(report) || !isRecord(report.governedPathCompatibility)) {
    return false;
  }
  const compatibility = report.governedPathCompatibility;
  const coveredGateIds = Array.isArray(compatibility.coveredGateIds)
    ? compatibility.coveredGateIds.map(readString)
    : [];
  const changedGovernedPaths = Array.isArray(compatibility.changedGovernedPaths)
    ? compatibility.changedGovernedPaths.map(readString)
    : [];
  const focused = isRecord(compatibility.focused) ? compatibility.focused : {};
  const adjacent = isRecord(compatibility.adjacent) ? compatibility.adjacent : {};
  const sourceHead = readString(compatibility.sourceHead);
  const productionCommit = readString(compatibility.productionCommit);
  return readString(report.verdict) === "PASS_LIVE_PRODUCTION_PUBLIC_SAFETY_REFERENCE_SURFACE_BOUNDED"
    && readString(compatibility.verdict) === "PASS_LIVE_PRODUCTION_SAFETY_REFERENCE_SURFACE_COMPATIBILITY"
    && sourceHead.length > 0
    && sourceHead === productionCommit
    && productionCommit === readString(report.productionCommit)
    && isGitAncestor(rootDir, productionCommit)
    && isEvidenceCurrentForPaths(rootDir, productionCommit, governedPaths)
    && coveredGateIds.length === SECURITY_SAFETY_REFERENCE_SURFACE_COMPATIBILITY_GATE_IDS.length
    && SECURITY_SAFETY_REFERENCE_SURFACE_COMPATIBILITY_GATE_IDS.every((id) => coveredGateIds.includes(id))
    && coveredGateIds.includes(gateId)
    && changedGovernedPaths.length === SECURITY_SAFETY_REFERENCE_SURFACE_CHANGED_PATHS.length
    && SECURITY_SAFETY_REFERENCE_SURFACE_CHANGED_PATHS.every((item) => changedGovernedPaths.includes(item))
    && readNumber(focused.testFiles) === 4
    && readNumber(focused.tests) === 103
    && readString(focused.status) === "PASS"
    && readNumber(adjacent.testFiles) === 8
    && readNumber(adjacent.tests) === 176
    && readString(adjacent.status) === "PASS"
    && compatibility.noMutation === true
    && readString(compatibility.exactSavedShareVerdict) === "MISSING_EVIDENCE";
}

/**
 * @param {string} rootDir
 * @param {string} gateId
 * @param {string[]} governedPaths
 */
function isSecurityResourceRemediationCompatibilityCurrent(rootDir, gateId, governedPaths) {
  const report = readJsonFile(rootDir, EVIDENCE_PATHS.securityResourceRemediation);
  if (!isRecord(report) || !isRecord(report.governedPathCompatibility)) {
    return false;
  }
  const compatibility = report.governedPathCompatibility;
  const coveredGateIds = Array.isArray(compatibility.coveredGateIds)
    ? compatibility.coveredGateIds.map(readString)
    : [];
  const changedGovernedPaths = Array.isArray(compatibility.changedGovernedPaths)
    ? compatibility.changedGovernedPaths.map(readString)
    : [];
  const focused = isRecord(compatibility.focused) ? compatibility.focused : {};
  const adjacent = isRecord(compatibility.adjacent) ? compatibility.adjacent : {};
  const sourceHead = readString(compatibility.sourceHead);
  const productionCommit = readString(compatibility.productionCommit);
  return readString(report.verdict) === "PASS_LIVE_PRODUCTION_SECURITY_RESOURCE_REMEDIATION"
    && readString(compatibility.verdict) === "PASS_LIVE_PRODUCTION_RESOURCE_REMEDIATION_COMPATIBILITY"
    && sourceHead.length > 0
    && productionCommit.startsWith(sourceHead)
    && productionCommit === readString(report.productionCommit)
    && isGitAncestor(rootDir, productionCommit)
    && isEvidenceCurrentForPaths(rootDir, productionCommit, governedPaths)
    && coveredGateIds.length === SECURITY_RESOURCE_REMEDIATION_COMPATIBILITY_GATE_IDS.length
    && SECURITY_RESOURCE_REMEDIATION_COMPATIBILITY_GATE_IDS.every((id) => coveredGateIds.includes(id))
    && coveredGateIds.includes(gateId)
    && changedGovernedPaths.length === SECURITY_RESOURCE_REMEDIATION_CHANGED_PATHS.length
    && SECURITY_RESOURCE_REMEDIATION_CHANGED_PATHS.every((item) => changedGovernedPaths.includes(item))
    && readNumber(focused.testFiles) === 5
    && readNumber(focused.tests) === 79
    && readString(focused.status) === "PASS"
    && readNumber(adjacent.testFiles) === 12
    && readNumber(adjacent.tests) === 156
    && readString(adjacent.status) === "PASS"
    && compatibility.noMutation === true
    && readString(compatibility.exactSavedShareVerdict) === "MISSING_EVIDENCE";
}

/**
 * @param {string} rootDir
 * @param {string} gateId
 * @param {string[]} governedPaths
 */
function isDocumentExportAdmissionCompatibilityCurrent(rootDir, gateId, governedPaths) {
  const report = readJsonFile(rootDir, EVIDENCE_PATHS.documentExportCapabilityTruth);
  if (!isRecord(report) || !isRecord(report.governedPathCompatibility)) {
    return false;
  }
  const compatibility = report.governedPathCompatibility;
  const tests = isRecord(compatibility.focusedAndAdjacentTests) ? compatibility.focusedAndAdjacentTests : {};
  const coveredGateIds = Array.isArray(compatibility.coveredGateIds)
    ? compatibility.coveredGateIds.map(readString)
    : [];
  const changedGovernedPaths = Array.isArray(compatibility.changedGovernedPaths)
    ? compatibility.changedGovernedPaths.map(readString)
    : [];
  const sourceHead = readString(compatibility.sourceHead);
  return readString(report.verdict) === "PASS_LIVE_PRODUCTION_DOCUMENT_EXPORT_CAPABILITY_TRUTH"
    && readString(compatibility.verdict) === "PASS_LIVE_PRODUCTION_DOCUMENT_EXPORT_ADMISSION_COMPATIBILITY"
    && sourceHead.length > 0
    && sourceHead === readString(compatibility.productionCommit)
    && sourceHead === readString(report.productionCommit)
    && isGitAncestor(rootDir, sourceHead)
    && isEvidenceCurrentForPaths(rootDir, sourceHead, governedPaths)
    && coveredGateIds.length === 3
    && coveredGateIds.includes(gateId)
    && changedGovernedPaths.length === 1
    && changedGovernedPaths[0] === "lib/public-distributed-rate-limit.ts"
    && readNumber(tests.files) === 10
    && readNumber(tests.tests) >= 47
    && readNumber(tests.failed) === 0
    && readString(tests.status) === "PASS"
    && compatibility.typecheck === "PASS"
    && compatibility.build === "PASS"
    && compatibility.originalSecurityBaselinesRewritten === false
    && compatibility.noMutation === true
    && readString(compatibility.exactSavedShareVerdict) === "MISSING_EVIDENCE";
}

/**
 * @param {string} rootDir
 * @param {string} gateId
 * @param {string[]} governedPaths
 */
function isPublicAdmissionCurrentSourceCompatibilityCurrent(rootDir, gateId, governedPaths) {
  const report = readJsonFile(rootDir, EVIDENCE_PATHS.publicAdmissionCurrentSourceCompatibility);
  if (!isRecord(report) || !isRecord(report.verification) || !isRecord(report.liveReadOnlyProbe)) {
    return false;
  }
  const verification = report.verification;
  const tests = isRecord(verification.focusedAndAdjacentVitest) ? verification.focusedAndAdjacentVitest : {};
  const live = report.liveReadOnlyProbe;
  const liveCases = Array.isArray(live.cases) ? live.cases.filter(isRecord) : [];
  const coveredGateIds = Array.isArray(report.coveredGateIds) ? report.coveredGateIds.map(readString) : [];
  const mutation = isRecord(report.mutationBoundary) ? report.mutationBoundary : {};
  const remaining = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  const sourceHead = readString(report.sourceHead);
  const casePass = (name, status, code, rateLimit = "") => liveCases.some((item) => (
    readString(item.name) === name
    && readNumber(item.status) === status
    && readString(item.code) === code
    && (rateLimit.length === 0 || readString(item.rateLimit) === rateLimit)
  ));
  const noMutation = mutation.dbSchemaMutationPerformed === false
    && mutation.dbDataMutationPerformed === false
    && mutation.providerCallPerformed === false
    && mutation.providerDispatchCalled === false
    && mutation.shareSessionCreated === false
    && mutation.vectorOrEmbeddingMutationPerformed === false
    && mutation.wikiPublicationPerformed === false
    && mutation.koshaRegistryMutationPerformed === false;
  return readString(report.verdict) === "PASS_LIVE_PRODUCTION_PUBLIC_ADMISSION_CURRENT_SOURCE_COMPATIBILITY"
    && sourceHead.length > 0
    && sourceHead === readString(report.productionCommit)
    && isGitAncestor(rootDir, sourceHead)
    && isEvidenceCurrentForPaths(rootDir, sourceHead, governedPaths)
    && coveredGateIds.length === 6
    && coveredGateIds.includes(gateId)
    && readNumber(tests.files) === 13
    && readNumber(tests.tests) === 100
    && readNumber(tests.failed) === 0
    && readString(tests.status) === "PASS"
    && verification.typecheck === "PASS"
    && verification.build === "PASS"
    && readNumber(verification.dependencyAuditVulnerabilities) === 0
    && live.providerCallExecuted === false
    && liveCases.length === 12
    && casePass("oversize-ask", 413, "PUBLIC_WORK_BUDGET_EXCEEDED", "instance")
    && casePass("oversize-ask-stream", 413, "PUBLIC_WORK_BUDGET_EXCEEDED", "instance")
    && casePass("oversize-knowledge-match", 413, "PUBLIC_WORK_BUDGET_EXCEEDED", "instance")
    && casePass("ask-template", 200, "", "instance")
    && casePass("ask-enhanced", 503, "DISTRIBUTED_RATE_LIMIT_UNAVAILABLE", "distributed")
    && casePass("ask-full", 503, "DISTRIBUTED_RATE_LIMIT_UNAVAILABLE", "distributed")
    && casePass("ask-stream-enhanced", 503, "DISTRIBUTED_RATE_LIMIT_UNAVAILABLE", "distributed")
    && casePass("ask-stream-full", 503, "DISTRIBUTED_RATE_LIMIT_UNAVAILABLE", "distributed")
    && casePass("search-legal", 503, "DISTRIBUTED_RATE_LIMIT_UNAVAILABLE", "distributed")
    && casePass("search-safety-reference", 503, "DISTRIBUTED_RATE_LIMIT_UNAVAILABLE", "distributed")
    && casePass("search-weather", 503, "DISTRIBUTED_RATE_LIMIT_UNAVAILABLE", "distributed")
    && casePass("photo-readiness", 200, "")
    && noMutation
    && report.originalSecurityBaselinesRewritten === false
    && readString(remaining.freshFollowUpScan) === "REQUIRED"
    && remaining.securityCompleteClaimAllowed === false
    && readString(remaining.distributedBackendActivation) === "OPERATOR_CONFIGURATION_REQUIRED"
    && readString(remaining.exactSavedShareVerdict) === "MISSING_EVIDENCE";
}

/**
 * @param {string} rootDir
 * @param {string} gateId
 * @param {string[]} governedPaths
 */
function isShareMcpCurrentSourceCompatibilityCurrent(rootDir, gateId, governedPaths) {
  const report = readJsonFile(rootDir, EVIDENCE_PATHS.shareMcpCurrentSourceCompatibility);
  if (!isRecord(report) || !isRecord(report.verification) || !isRecord(report.liveReadOnlyProbe)) {
    return false;
  }

  const verification = report.verification;
  const focused = isRecord(verification.focusedAndAdjacentVitest) ? verification.focusedAndAdjacentVitest : {};
  const browser = isRecord(verification.recipientBrowser) ? verification.recipientBrowser : {};
  const live = report.liveReadOnlyProbe;
  const liveCases = Array.isArray(live.cases) ? live.cases.filter(isRecord) : [];
  const coveredGateIds = Array.isArray(report.coveredGateIds) ? report.coveredGateIds.map(readString) : [];
  const mutation = isRecord(report.mutationBoundary) ? report.mutationBoundary : {};
  const remaining = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  const sourceHead = readString(report.sourceHead);
  const casePass = (name, status, code = "", rateLimit = "") => liveCases.some((item) => (
    readString(item.name) === name
    && readNumber(item.status) === status
    && (code.length === 0 || readString(item.code) === code)
    && (rateLimit.length === 0 || readString(item.rateLimit) === rateLimit)
  ));
  const noMutation = mutation.dbSchemaMutationPerformed === false
    && mutation.dbDataMutationPerformed === false
    && mutation.providerGenerationExecuted === false
    && mutation.providerDispatchCalled === false
    && mutation.shareSessionCreated === false
    && mutation.shareSessionRevoked === false
    && mutation.readConfirmationCreated === false
    && mutation.vectorOrEmbeddingMutationPerformed === false
    && mutation.wikiPublicationPerformed === false
    && mutation.koshaRegistryMutationPerformed === false;

  return readString(report.verdict) === "PASS_LIVE_PRODUCTION_SHARE_MCP_CURRENT_SOURCE_FAIL_CLOSED_COMPATIBILITY"
    && sourceHead.length > 0
    && sourceHead === readString(report.productionCommit)
    && isGitAncestor(rootDir, sourceHead)
    && isEvidenceCurrentForPaths(rootDir, sourceHead, governedPaths)
    && coveredGateIds.length === 4
    && coveredGateIds.includes(gateId)
    && readNumber(focused.filesPassed) === 8
    && readNumber(focused.filesSkipped) === 0
    && readNumber(focused.testsPassed) === 205
    && readNumber(focused.testsSkipped) === 0
    && readNumber(focused.failed) === 0
    && readString(focused.status) === "PASS"
    && readNumber(browser.files) === 1
    && readNumber(browser.tests) === 7
    && readNumber(browser.failed) === 0
    && readString(browser.status) === "PASS"
    && verification.typecheck === "PASS"
    && verification.build === "PASS"
    && readNumber(verification.staticPages) === 28
    && readNumber(verification.dependencyAuditVulnerabilities) === 0
    && live.providerGenerationExecuted === false
    && live.mcpToolDispatchPerformed === false
    && live.shareSessionCreated === false
    && live.shareSessionRevoked === false
    && live.readConfirmationCreated === false
    && liveCases.length === 4
    && casePass("share-revoke-unauthenticated", 401)
    && casePass("share-contact-missing-session", 503, "DISTRIBUTED_RATE_LIMIT_UNAVAILABLE", "distributed")
    && casePass("share-ack-oversize-missing-session", 503, "DISTRIBUTED_RATE_LIMIT_UNAVAILABLE", "distributed")
    && casePass("mcp-invalid-token", 503, "DISTRIBUTED_RATE_LIMIT_UNAVAILABLE", "distributed")
    && noMutation
    && report.originalSecurityBaselinesRewritten === false
    && readString(remaining.distributedBackendActivation) === "OPERATOR_CONFIGURATION_REQUIRED"
    && readString(remaining.validAuthenticatedMcpProbe) === "NOT_EXECUTED_NO_MCP_TOKEN"
    && readString(remaining.shareRecipientAckLiveDataApproval) === "APPROVAL_GATED"
    && readString(remaining.shareStorageAndCreationApproval) === "APPROVAL_GATED"
    && readString(remaining.freshFollowUpScan) === "REQUIRED"
    && remaining.securityCompleteClaimAllowed === false
    && readString(remaining.exactSavedShareVerdict) === "MISSING_EVIDENCE";
}

/**
 * @param {string} rootDir
 * @returns {GateResult}
 */
function evaluateFreshCurrentSourceSecurityScanGate(rootDir) {
  const evidencePath = EVIDENCE_PATHS.freshCurrentSourceSecurityScan;
  const report = readJsonFile(rootDir, evidencePath);
  if (!isRecord(report)) {
    return gateResult({
      id: "fresh_current_source_security_scan",
      label: "Fresh current-source security scan",
      state: "missing",
      evidencePath,
      detail: "The sealed current-source Standard scan is missing or invalid.",
      nextActions: ["Restore the sealed current-source scan and its canonical artifacts without rewriting the immutable 18-finding baseline."],
    });
  }

  const scan = isRecord(report.scan) ? report.scan : {};
  const severity = isRecord(scan.severity) ? scan.severity : {};
  const baseline = isRecord(report.baseline) ? report.baseline : {};
  const disposition = isRecord(report.currentDisposition) ? report.currentDisposition : {};
  const canonical = isRecord(report.canonicalArtifacts) ? report.canonicalArtifacts : {};
  const mutation = isRecord(report.mutationBoundary) ? report.mutationBoundary : {};
  const remaining = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  const canonicalPaths = [canonical.manifest, canonical.findings, canonical.coverage, canonical.markdown]
    .map(readString)
    .filter(Boolean);
  const canonicalFilesPresent = canonicalPaths.length === 4
    && canonicalPaths.every((relativePath) => isRegularEvidenceFile(rootDir, relativePath));
  const noMutation = mutation.dbMutationPerformed === false
    && mutation.providerDispatchCalled === false
    && mutation.shareSessionCreated === false
    && mutation.embeddingGenerated === false
    && mutation.vectorUploadPerformed === false
    && mutation.wikiPublished === false
    && mutation.exactTrustRegistryMutationPerformed === false;
  const pass = readString(report.verdict) === "NOTICE_CURRENT_HEAD_STANDARD_SCAN_18_FINDINGS_PARTIAL_COVERAGE"
    && readString(report.scanId) === "f218c713-1a1c-4f4e-9777-8095926be1df"
    && readString(report.sourceHead) === "b5f145120766cd2ef904fce38ef32ed1a9facf74"
    && readString(report.deployedProductSource) === "b5f145120766cd2ef904fce38ef32ed1a9facf74"
    && readString(scan.status) === "completed"
    && readString(scan.mode) === "standard"
    && readString(scan.targetKind) === "git_revision"
    && readString(scan.coverageCompleteness) === "partial"
    && readNumber(scan.trackedFileCount) === 6822
    && readNumber(scan.reviewedSurfaceCount) === 17
    && readNumber(scan.primaryReviewedSurfaceCount) === 5
    && readNumber(scan.deferredCoverageItemCount) === 19
    && readNumber(scan.reportableFindingCount) === 18
    && readNumber(scan.uniqueFindingWriteupCount) === 18
    && readNumber(severity.critical) === 0
    && readNumber(severity.high) === 0
    && readNumber(severity.medium) === 13
    && readNumber(severity.low) === 5
    && readNumber(baseline.immutableOriginalFindingCount) === 18
    && baseline.preserved === true
    && baseline.rewritten === false
    && readNumber(disposition.approvalGatedDatabaseOrAtomicityCount) === 9
    && readNumber(disposition.approvalSensitiveShareCapabilityCount) === 1
    && readNumber(disposition.approvalFreeProductSourceResidualCount) === 8
    && readNumber(disposition.fullyClosedBoundedSourceCandidateCount) === 1
    && disposition.securityCompleteClaimAllowed === false
    && readNumber(canonical.findingWriteupCount) === 18
    && readNumber(canonical.supportingEvidenceCount) === 18
    && canonicalFilesPresent
    && noMutation
    && readString(remaining.exactSavedShareVerdict) === "MISSING_EVIDENCE"
    && readString(remaining.databaseSecurityRemediation) === "APPROVAL_GATED"
    && readString(remaining.providerDispatchPersistence) === "APPROVAL_GATED"
    && readString(remaining.llmWikiPublication) === "APPROVAL_GATED"
    && readString(remaining.sifVectorRuntime) === "APPROVAL_GATED"
    && readString(remaining.koshaExactRegistryPromotion) === "APPROVAL_GATED"
    && remaining.freshFullRepositoryScanCompleted === true
    && remaining.securityCompleteClaimAllowed === false;

  return gateResult({
    id: "fresh_current_source_security_scan",
    label: "Fresh current-source security scan",
    state: pass ? "notice" : "contradicted",
    evidencePath,
    detail: pass
      ? "Current Standard scan f218c713 is sealed at source/live b5f14512 with 18 findings (13 medium, 5 low), 18 finding write-ups, and partial canonical coverage across 17 recorded surface rows with 19 deferred entries in a 6,822-file repository. The immutable original 18-finding baseline, completed prior scan, and later 9-finding partial scan are preserved. Eight approval-free source findings, nine database/RLS/atomicity findings, and one approval-sensitive Share capability finding remain open. This is not security-complete: no mutation occurred and exact saved Share remains MISSING_EVIDENCE."
      : `Fresh scan verdict=${readString(report.verdict) || "missing"}, scan=${readString(report.scanId) || "missing"}, source=${readString(report.sourceHead) || "missing"}, findings=${readNumber(scan.reportableFindingCount)}, severity=${readNumber(severity.medium)}/${readNumber(severity.low)}, coverage=${readString(scan.coverageCompleteness) || "missing"}/${readNumber(scan.reviewedSurfaceCount)}/${readNumber(scan.deferredCoverageItemCount)}, canonical=${canonicalFilesPresent}, noMutation=${noMutation}, exactShare=${readString(remaining.exactSavedShareVerdict) || "missing"}.`,
    nextActions: pass
      ? [
          "Remediate the eight approval-free source findings in bounded waves and rerun focused validation.",
          "Keep the nine database/RLS/atomicity findings approval-gated and the Share capability finding separate; do not claim security completion from scan completion.",
        ]
      : ["Restore the exact sealed scan identity, 18-finding and 18-write-up counts, canonical files, partial-coverage boundary, no-mutation state, and exact Share MISSING_EVIDENCE."],
  });
}

/**
 * @param {string} rootDir
 * @returns {GateResult}
 */
function evaluateCompletedCurrentHeadStandardSecurityScanGate(rootDir) {
  const evidencePath = EVIDENCE_PATHS.completedCurrentHeadStandardSecurityScan;
  const report = readJsonFile(rootDir, evidencePath);
  if (!isRecord(report)) {
    return gateResult({
      id: "completed_current_head_standard_security_scan",
      label: "Completed current-head Standard security scan",
      state: "missing",
      evidencePath,
      detail: "The sealed 9504d8db current-head Standard scan receipt is missing or invalid.",
      nextActions: ["Restore the sealed scan receipt and canonical artifacts without rewriting the immutable 18-finding baseline."],
    });
  }

  const scan = isRecord(report.scan) ? report.scan : {};
  const severity = isRecord(scan.severity) ? scan.severity : {};
  const baseline = isRecord(report.baseline) ? report.baseline : {};
  const disposition = isRecord(report.currentDisposition) ? report.currentDisposition : {};
  const canonical = isRecord(report.canonicalArtifacts) ? report.canonicalArtifacts : {};
  const hashes = isRecord(canonical.sha256) ? canonical.sha256 : {};
  const mutation = isRecord(report.mutationBoundary) ? report.mutationBoundary : {};
  const remaining = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  const canonicalHashesMatch = evidenceFileMatchesSha256(rootDir, canonical.manifest, hashes.manifest)
    && evidenceFileMatchesSha256(rootDir, canonical.findings, hashes.findings)
    && evidenceFileMatchesSha256(rootDir, canonical.coverage, hashes.coverage)
    && evidenceFileMatchesSha256(rootDir, canonical.markdown, hashes.markdown);
  const noMutation = mutation.dbMutationPerformed === false
    && mutation.providerDispatchCalled === false
    && mutation.shareSessionCreated === false
    && mutation.embeddingGenerated === false
    && mutation.vectorUploadPerformed === false
    && mutation.wikiPublished === false
    && mutation.exactTrustRegistryMutationPerformed === false;
  const pass = readString(report.verdict) === "NOTICE_CURRENT_HEAD_STANDARD_SCAN_21_FINDINGS_PARTIAL_COVERAGE"
    && readString(report.scanId) === "f6bef30a-7250-428b-9f66-0bad1e42058c"
    && readString(report.sourceHead) === "9504d8db95fcbc9f37f6c5abc638e9ad0813a325"
    && report.userContextPreserved === true
    && readString(scan.status) === "completed"
    && readString(scan.mode) === "standard"
    && readString(scan.targetKind) === "git_revision"
    && readString(scan.coverageCompleteness) === "partial"
    && readNumber(scan.trackedFileCount) === 6881
    && readNumber(scan.reviewWorklistCount) === 6
    && readNumber(scan.closedReviewWorklistCount) === 6
    && readNumber(scan.recordedSurfaceCount) === 25
    && readNumber(scan.deferredCoverageItemCount) === 36
    && readNumber(scan.reportableFindingCount) === 21
    && readNumber(scan.uniqueFindingWriteupCount) === 21
    && readNumber(severity.critical) === 0
    && readNumber(severity.high) === 0
    && readNumber(severity.medium) === 7
    && readNumber(severity.low) === 14
    && readNumber(baseline.immutableOriginalFindingCount) === 18
    && baseline.preserved === true
    && baseline.rewritten === false
    && readString(baseline.completedPriorScanId) === "8fe9c06a-018c-446f-aa98-1b37df95287a"
    && readNumber(disposition.approvalGatedDatabaseOrAtomicityCount) === 9
    && readNumber(disposition.approvalSensitiveShareCapabilityCount) === 1
    && readNumber(disposition.approvalFreeProductSourceResidualCount) === 11
    && disposition.securityCompleteClaimAllowed === false
    && readNumber(canonical.findingWriteupCount) === 21
    && readNumber(canonical.supportingEvidenceCount) === 21
    && canonicalHashesMatch
    && noMutation
    && readString(remaining.exactSavedShareVerdict) === "MISSING_EVIDENCE"
    && readString(remaining.databaseSecurityRemediation) === "APPROVAL_GATED"
    && readString(remaining.providerDispatchPersistence) === "APPROVAL_GATED"
    && readString(remaining.llmWikiPublication) === "APPROVAL_GATED"
    && readString(remaining.sifVectorRuntime) === "APPROVAL_GATED"
    && readString(remaining.koshaExactRegistryPromotion) === "APPROVAL_GATED"
    && remaining.coverageClosureCompleted === false
    && readString(remaining.approvalFreeCurrentSourceRemediation) === "OPEN_11_FINDINGS"
    && remaining.securityCompleteClaimAllowed === false;

  return gateResult({
    id: "completed_current_head_standard_security_scan",
    label: "Completed current-head Standard security scan",
    state: pass ? "notice" : "contradicted",
    evidencePath,
    detail: pass
      ? "Current-head Standard scan f6bef30a is sealed at 9504d8db with 21 findings (7 medium, 14 low), 21 write-ups, and partial coverage. Canonical artifact hashes match. The immutable original 18-finding baseline is preserved; 11 approval-free source findings, nine database/RLS/atomicity findings, and one approval-sensitive Share capability finding remain open. Security-complete is false, no mutation occurred, and exact saved Share remains MISSING_EVIDENCE."
      : `Current-head scan verdict=${readString(report.verdict) || "missing"}, scan=${readString(report.scanId) || "missing"}, source=${readString(report.sourceHead) || "missing"}, findings=${readNumber(scan.reportableFindingCount)}, severity=${readNumber(severity.medium)}/${readNumber(severity.low)}, coverage=${readString(scan.coverageCompleteness) || "missing"}, hashes=${canonicalHashesMatch}, noMutation=${noMutation}, exactShare=${readString(remaining.exactSavedShareVerdict) || "missing"}.`,
    nextActions: pass
      ? [
          "Remediate the 11 approval-free source findings in bounded waves and run a fresh follow-up scan.",
          "Keep database/RLS/atomicity, provider, exact Share, wiki, vector, and KOSHA registry operations on their existing approval paths.",
        ]
      : ["Restore the exact scan identity, counts, canonical hashes, immutable baseline, no-mutation boundary, and exact Share MISSING_EVIDENCE."],
  });
}

/**
 * @param {string} rootDir
 * @param {unknown} relativePath
 * @param {unknown} expectedSha256
 */
function evidenceFileMatchesSha256(rootDir, relativePath, expectedSha256) {
  const value = readString(relativePath);
  const expected = readString(expectedSha256).toLowerCase();
  if (!value || !/^[0-9a-f]{64}$/u.test(expected)) {
    return false;
  }
  try {
    const absolutePath = path.resolve(rootDir, value);
    const relativeToRoot = path.relative(rootDir, absolutePath);
    if (relativeToRoot.startsWith("..") || path.isAbsolute(relativeToRoot)) {
      return false;
    }
    const bytes = fs.readFileSync(absolutePath);
    const rawHash = createHash("sha256").update(bytes).digest("hex");
    if (rawHash === expected) {
      return true;
    }
    const normalizedTextHash = createHash("sha256")
      .update(bytes.toString("utf8").replaceAll("\r\n", "\n"), "utf8")
      .digest("hex");
    return normalizedTextHash === expected;
  } catch {
    return false;
  }
}

/**
 * @param {string} rootDir
 * @param {string} possibleAncestorSha
 * @param {string} descendantSha
 */
function isGitAncestorOf(rootDir, possibleAncestorSha, descendantSha) {
  if (!/^[0-9a-f]{40}$/u.test(possibleAncestorSha) || !/^[0-9a-f]{40}$/u.test(descendantSha)) {
    return false;
  }
  const cacheKey = `${rootDir}\0${possibleAncestorSha}\0${descendantSha}`;
  if (gitAncestorCache.has(cacheKey)) {
    return gitAncestorCache.get(cacheKey);
  }
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", possibleAncestorSha, descendantSha], {
      cwd: rootDir,
      stdio: ["ignore", "ignore", "ignore"],
    });
    gitAncestorCache.set(cacheKey, true);
    return true;
  } catch {
    gitAncestorCache.set(cacheKey, false);
    return false;
  }
}

/**
 * @param {string} rootDir
 * @returns {GateResult}
 */
function evaluateCurrentSourceApprovalFreeSecurityRemediationGate(rootDir) {
  const evidencePath = EVIDENCE_PATHS.currentSourceApprovalFreeSecurityRemediation;
  const report = readJsonFile(rootDir, evidencePath);
  if (!isRecord(report)) {
    return gateResult({
      id: "current_source_approval_free_security_remediation",
      label: "Current-source approval-free security remediation",
      state: "missing",
      evidencePath,
      detail: "The four-residual current-source remediation receipt is missing or invalid.",
      nextActions: ["Restore the bounded four-residual receipt without rewriting the sealed scan or changing approval boundaries."],
    });
  }

  const scannedBaseline = isRecord(report.scannedBaseline) ? report.scannedBaseline : {};
  const remediation = isRecord(report.remediation) ? report.remediation : {};
  const boundaries = isRecord(report.boundaries) ? report.boundaries : {};
  const receipts = Array.isArray(report.receipts) ? report.receipts.filter(isRecord) : [];
  const expectedIds = [
    "structured-xlsx-render-budget",
    "operator-document-parser-admission",
    "orchestration-smoke-csv-neutralization",
    "hwpx-anonymization-archive-budget",
  ];
  const sourceHead = readString(report.sourceHead);
  const productionCommit = readString(report.productionCommit);
  const noMutation = boundaries.dbMutationPerformed === false
    && boundaries.providerDispatchCalled === false
    && boundaries.shareSessionCreated === false
    && boundaries.embeddingOrVectorMutationPerformed === false
    && boundaries.wikiPublicationPerformed === false
    && boundaries.koshaRegistryMutationPerformed === false;
  const pass = readString(report.schemaVersion) === "safeclaw-current-source-security-approval-free-remediation/v1"
    && readString(report.verdict) === "PASS_LIVE_PRODUCTION_FOUR_APPROVAL_FREE_SECURITY_REMEDIATIONS_RESCAN_PENDING"
    && sourceHead !== ""
    && sourceHead === productionCommit
    && isGitAncestor(rootDir, sourceHead)
    && readString(scannedBaseline.scanId) === "8d7fd844-d4cb-49ab-b984-36ed6ab0beba"
    && readNumber(scannedBaseline.reportableFindingCount) === 9
    && readNumber(scannedBaseline.approvalFreeFindingCount) === 4
    && readNumber(scannedBaseline.approvalGatedFindingCount) === 5
    && scannedBaseline.immutableOriginalBaselinePreserved === true
    && readNumber(remediation.currentSourceRemediatedCount) === 4
    && readNumber(remediation.currentSourceOpenApprovalFreeCount) === 0
    && remediation.scanFindingReclassificationPerformed === false
    && receipts.length === 4
    && expectedIds.every((id) => receipts.some((receipt) => readString(receipt.id) === id
      && readString(receipt.verdict).startsWith("PASS_")
      && readString(receipt.evidencePath) !== ""
      && isRegularEvidenceFile(rootDir, readString(receipt.evidencePath))))
    && boundaries.freshFullRepositoryRescanRequired === true
    && boundaries.securityCompleteClaimAllowed === false
    && noMutation
    && readString(boundaries.exactSavedShareVerdict) === "MISSING_EVIDENCE"
    && readString(boundaries.databaseSecurityRemediation) === "APPROVAL_GATED"
    && readString(boundaries.providerDispatchPersistence) === "APPROVAL_GATED"
    && readString(boundaries.llmWikiPublication) === "APPROVAL_GATED"
    && readString(boundaries.sifVectorRuntime) === "APPROVAL_GATED"
    && readString(boundaries.koshaExactRegistryPromotion) === "APPROVAL_GATED";

  return gateResult({
    id: "current_source_approval_free_security_remediation",
    label: "Current-source approval-free security remediation",
    state: pass ? "notice" : "contradicted",
    evidencePath,
    detail: pass
      ? "All four approval-free findings from Standard scan 8d7fd844 now have bounded current-source and aligned-production remediation receipts: structured XLSX render budgeting, operator parser admission, orchestration smoke CSV formula neutralization, and HWPX archive anonymization. The sealed 9-finding scan is unchanged, the five database/RLS/atomicity findings remain approval-gated, a fresh full repository rescan is still required before reclassification, security-complete is false, no mutation occurred, and exact saved Share remains MISSING_EVIDENCE."
      : `Current-source security remediation verdict=${readString(report.verdict) || "missing"}, source=${sourceHead || "missing"}, production=${productionCommit || "missing"}, receipts=${receipts.length}, remediated=${readNumber(remediation.currentSourceRemediatedCount)}, openApprovalFree=${readNumber(remediation.currentSourceOpenApprovalFreeCount)}, noMutation=${noMutation}, exactShare=${readString(boundaries.exactSavedShareVerdict) || "missing"}.`,
    nextActions: pass
      ? [
          "Start a new Desktop Standard scan over the current repository HEAD before reclassifying the four sealed findings or making any security-complete claim.",
          "Keep the five database/RLS/atomicity findings and exact saved Share on their existing approval paths.",
        ]
      : ["Restore all four bounded receipts, aligned source/production identity, immutable scan baseline, no-mutation boundary, rescan requirement, and exact Share MISSING_EVIDENCE."],
  });
}

/**
 * @param {string} rootDir
 * @returns {GateResult}
 */
function evaluateCurrentSourceSecurityResourceBudgetRemediationGate(rootDir) {
  const evidencePath = EVIDENCE_PATHS.currentSourceSecurityResourceBudgetRemediation;
  const report = readJsonFile(rootDir, evidencePath);
  if (!isRecord(report)) {
    return gateResult({
      id: "current_source_security_resource_budget_remediation",
      label: "Current-source security resource-budget remediation",
      state: "missing",
      evidencePath,
      detail: "The current-source resource-budget remediation receipt is missing or invalid.",
      nextActions: ["Restore the five-finding receipt without closing the failed scan-completion boundary or approval-gated findings."],
    });
  }

  const source = isRecord(report.source) ? report.source : {};
  const baseline = isRecord(report.securityBaseline) ? report.securityBaseline : {};
  const severity = isRecord(baseline.canonicalSeverityCounts) ? baseline.canonicalSeverityCounts : {};
  const verification = isRecord(report.verification) ? report.verification : {};
  const python = isRecord(verification.python) ? verification.python : {};
  const typescript = isRecord(verification.typescriptResourceRegression) ? verification.typescriptResourceRegression : {};
  const ui = isRecord(verification.documentsShareUiRegression) ? verification.documentsShareUiRegression : {};
  const build = isRecord(verification.productionBuild) ? verification.productionBuild : {};
  const live = isRecord(report.liveChecks) ? report.liveChecks : {};
  const ontology = isRecord(live.ontologyGraph) ? live.ontologyGraph : {};
  const learning = isRecord(live.learningExportUnauthenticated) ? live.learningExportUnauthenticated : {};
  const boundaries = isRecord(report.boundaries) ? report.boundaries : {};
  const remediated = Array.isArray(report.remediatedFindings) ? report.remediatedFindings.filter(isRecord) : [];
  const remaining = Array.isArray(report.remainingApprovalGatedFindings) ? report.remainingApprovalGatedFindings : [];
  const expectedIds = [
    "csf_189f90e7a24ec6708057ff03",
    "csf_f026a78c7fde954e6de62b35",
    "csf_54bf3910ec279d5af8646218",
    "csf_8f5647dae8aa76ce7a7fb396",
    "csf_5b39903c1c8d110acb501e38",
  ];
  const sourceHead = readString(report.sourceHead);
  const productionCommit = readString(report.productionCommit);
  const noMutation = boundaries.dbMutationPerformed === false
    && boundaries.providerDispatchCalled === false
    && boundaries.shareSessionCreated === false
    && boundaries.vectorOrEmbeddingMutationPerformed === false
    && boundaries.wikiPublicationPerformed === false
    && boundaries.koshaExactRegistryMutationPerformed === false;
  const pass = readString(report.schemaVersion) === "safeclaw-security-resource-budget-remediation/v1"
    && readString(report.verdict) === "PASS_LIVE_DEPLOYED_SOURCE_APPROVAL_FREE_SECURITY_RESOURCE_BUDGETS_DIRECT_PROBE_ADMISSION_BLOCKED"
    && sourceHead !== ""
    && sourceHead === productionCommit
    && sourceHead === readString(source.evidenceCommit)
    && productionCommit === readString(source.productionCommitAtVerification)
    && source.sourceHeadMatchesProduction === true
    && source.liveAfterDeploymentRequired === false
    && isGitAncestor(rootDir, sourceHead)
    && readString(baseline.scanId) === "76e79aa5-1391-4014-8671-ead3c48b6ee9"
    && baseline.canonicalArtifactsPresent === true
    && readNumber(baseline.canonicalFindingCount) === 10
    && readNumber(severity.medium) === 5
    && readNumber(severity.low) === 5
    && readString(baseline.manifestStatus) === "failed"
    && readNumber(baseline.immutableOriginalFindingBaselineCount) === 18
    && baseline.originalBaselinePreserved === true
    && remediated.length === 5
    && expectedIds.every((id) => remediated.some((finding) => readString(finding.findingId) === id
      && readString(finding.status) === "current_source_verified"))
    && readNumber(python.passed) === 159
    && readNumber(python.failed) === 0
    && readNumber(typescript.passed) === 174
    && readNumber(typescript.failed) === 0
    && readNumber(ui.passed) === 60
    && readNumber(ui.failed) === 0
    && readString(verification.typecheck) === "PASS"
    && readString(build.verdict) === "PASS"
    && readNumber(build.staticPages) === 28
    && readNumber(ontology.status) === 503
    && readString(ontology.code) === "DISTRIBUTED_RATE_LIMIT_UNAVAILABLE"
    && ontology.providerOrSupabaseGraphReadReached === false
    && readNumber(learning.status) === 401
    && live.mcpProviderFanoutExecuted === false
    && live.directLiveBudgetExecutionProven === false
    && remaining.length === 5
    && noMutation
    && readString(boundaries.exactSavedShareVerdict) === "MISSING_EVIDENCE"
    && boundaries.approvalGatedFindingsClosed === false;

  return gateResult({
    id: "current_source_security_resource_budget_remediation",
    label: "Current-source security resource-budget remediation",
    state: pass ? "proven" : "contradicted",
    evidencePath,
    detail: pass
      ? "Five approval-free resource-budget findings are source-tested and live-deployed: operator parser admission, bounded learning export, shared MCP provider admission with cancellation, paginated ontology graph budgets, and final MCP result ceilings. The canonical 10-finding files exist, but their manifest remains failed because durable scan completion did not synchronize; this is not a successful rescan or a security-complete claim. Direct live graph/provider budget execution was not proven because public durable admission failed closed before graph work and MCP provider fanout was not invoked. Five database/RLS/atomicity findings remain approval-gated, no mutation occurred, the original 18-finding baseline is preserved, and exact saved Share remains MISSING_EVIDENCE."
      : `Resource-budget verdict=${readString(report.verdict) || "missing"}, source=${sourceHead || "missing"}, production=${productionCommit || "missing"}, scan=${readString(baseline.scanId) || "missing"}/${readString(baseline.manifestStatus) || "missing"}, findings=${readNumber(baseline.canonicalFindingCount)}, remediated=${remediated.length}, remainingApprovalGated=${remaining.length}, live=${readNumber(ontology.status)}/${readNumber(learning.status)}/${live.directLiveBudgetExecutionProven === true}, noMutation=${noMutation}, exactShare=${readString(boundaries.exactSavedShareVerdict) || "missing"}.`,
    nextActions: pass
      ? [
          "Keep the five database/RLS/atomicity findings on their explicit approval path and do not reclassify the failed scan manifest as complete.",
          "Activate durable admission in an approved environment before claiming direct live ontology or MCP provider budget execution; keep exact saved Share separate.",
        ]
      : ["Restore aligned live identity, the exact five remediation receipts, failed-scan boundary, live admission evidence, no-mutation boundary, five approval-gated residuals, and exact Share MISSING_EVIDENCE."],
  });
}

/**
 * @param {string} rootDir
 * @returns {GateResult}
 */
function evaluateCurrentSourceSecurityRemediationFollowupGate(rootDir) {
  const evidencePath = EVIDENCE_PATHS.currentSourceSecurityRemediationFollowup;
  const report = readJsonFile(rootDir, evidencePath);
  if (!isRecord(report)) {
    return gateResult({
      id: "current_source_security_remediation_followup",
      label: "Current-source security remediation follow-up",
      state: "missing",
      evidencePath,
      detail: "The live current-source security remediation follow-up is missing or invalid.",
      nextActions: ["Restore the no-mutation remediation receipt without rewriting either sealed scan baseline."],
    });
  }

  const production = isRecord(report.productionBuild) ? report.productionBuild : {};
  const baseline = isRecord(report.baseline) ? report.baseline : {};
  const remediations = Array.isArray(report.remediations) ? report.remediations.filter(isRecord) : [];
  const kosha = isRecord(report.koshaOfficialPdfAudit) ? report.koshaOfficialPdfAudit : {};
  const verification = isRecord(report.verification) ? report.verification : {};
  const vitest = isRecord(verification.vitest) ? verification.vitest : {};
  const python = isRecord(verification.python) ? verification.python : {};
  const remaining = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  const noMutation = remaining.shareSessionMutationPerformed === false
    && remaining.dbMutationPerformed === false
    && remaining.providerDispatchCalled === false
    && remaining.vectorMutationPerformed === false
    && remaining.wikiPublicationPerformed === false
    && remaining.koshaExactRegistryMutationPerformed === false;
  const expectedCommits = new Set([
    "03fad2a499ad10e3a5762640a350a1f3b2f979eb",
    "165278c7e1596edc22a8e8a8ee532b0309a300ee",
    "3a35f1990d83d0c89554cd122379c4159cf84f00",
    "a1a9da9bd663c05d69f8dbb00823e2761f19ad64",
  ]);
  const remediationCommits = new Set(remediations.map((item) => readString(item.commit)).filter(Boolean));
  const remediationStatusesCurrent = remediations.length === 5
    && remediations.every((item) => readString(item.status) === "current_source_and_live")
    && [...expectedCommits].every((commit) => remediationCommits.has(commit));
  const pass = readString(report.verdict) === "PASS_LIVE_PRODUCTION_APPROVAL_FREE_SECURITY_REMEDIATIONS_POST_FIX_RESCAN_PENDING"
    && readString(report.sourceHead) === "a1a9da9bd663c05d69f8dbb00823e2761f19ad64"
    && readString(production.commitSha) === readString(report.sourceHead)
    && readString(production.branch) === "master"
    && readString(production.environment) === "production"
    && readString(baseline.scanId) === "f37c3e4a-294c-4ab9-b637-b944f33a2182"
    && readString(baseline.targetRevision) === "28cc608700445d3f0ea1ad0aeb7004e9cf1b7fb2"
    && readNumber(baseline.reportableFindings) === 20
    && readNumber(baseline.medium) === 4
    && readNumber(baseline.low) === 16
    && readString(baseline.coverageCompleteness) === "partial"
    && baseline.immutableOriginalBaselinePreserved === true
    && baseline.postFixFullRepositoryRescanCompleted === false
    && remediationStatusesCurrent
    && readString(kosha.verdict) === "PASS_OFFICIAL_PDF_AUTHENTICITY_BODY_PAIR_REVIEW_STILL_REQUIRED"
    && readNumber(kosha.candidateCount) === 8
    && readNumber(kosha.machineVerifiedCount) === 8
    && readNumber(kosha.failedCount) === 0
    && readNumber(kosha.temporaryPdfFilesRetained) === 0
    && kosha.exactPromotionPerformed === false
    && readNumber(vitest.files) === 6
    && readNumber(vitest.tests) === 79
    && readString(vitest.status) === "PASS"
    && readNumber(python.files) === 3
    && readNumber(python.tests) === 11
    && readString(python.status) === "PASS"
    && readString(verification.typecheck) === "PASS"
    && readString(verification.diffCheck) === "PASS"
    && noMutation
    && readString(remaining.publicCatalogRls) === "APPROVAL_GATED_DB_POLICY_CHANGE_NOT_PERFORMED"
    && readString(remaining.exactSavedShareVerdict) === "MISSING_EVIDENCE"
    && readString(remaining.providerDispatchPersistence) === "APPROVAL_GATED"
    && readString(remaining.postFixFullRepositoryScan) === "PENDING_DESKTOP_SECURITY_SCAN";

  return gateResult({
    id: "current_source_security_remediation_followup",
    label: "Current-source security remediation follow-up",
    state: pass ? "notice" : "contradicted",
    evidencePath,
    detail: pass
      ? "Production a1a9da9b contains five bounded approval-free remediation receipts covering reviewed-improvement provenance, pre-authentication body admission, KOSHA official PDF redirects/temp identity, and four legacy archive consumers. Focused verification is 79 Vitest plus 11 Python tests, and the official KOSHA PDF audit remains 8/8 with no retained temporary files or exact promotion. The immutable 20-finding partial-coverage baseline is preserved, the post-fix full repository scan remains pending, public-catalog RLS stays approval-gated, no mutation occurred, and exact saved Share remains MISSING_EVIDENCE. This gate is notice, not security-complete proof."
      : `Security follow-up verdict=${readString(report.verdict) || "missing"}, sourceLive=${readString(report.sourceHead).length > 0 && readString(report.sourceHead) === readString(production.commitSha)}, baseline=${readNumber(baseline.reportableFindings)}/${readString(baseline.coverageCompleteness) || "missing"}, remediation=${remediations.length}/${remediationStatusesCurrent}, kosha=${readNumber(kosha.machineVerifiedCount)}/${readNumber(kosha.candidateCount)}, tests=${readNumber(vitest.tests)}/${readNumber(python.tests)}, noMutation=${noMutation}, rescan=${readString(remaining.postFixFullRepositoryScan) || "missing"}, exactShare=${readString(remaining.exactSavedShareVerdict) || "missing"}.`,
    nextActions: pass
      ? ["Run a new full Desktop Standard scan over the current product revision before changing this notice or making any security-complete claim; keep DB/RLS and exact saved Share on their approval paths."]
      : ["Restore the exact live remediation receipt, immutable partial-coverage baseline, 8/8 KOSHA audit, no-mutation boundaries, pending post-fix scan, and exact Share MISSING_EVIDENCE."],
  });
}

const CURRENT_SECURITY_GOVERNED_COMPATIBILITY_GATE_IDS = [
  "share_ack_prebody_admission_security",
  "share_recipient_contact_verification_security",
  "public_json_request_body_budget",
  "improvement_photo_analysis_budget",
  "public_provider_admission",
  "public_ask_distributed_admission",
  "learning_export_renderer_security",
  "mcp_provider_admission_security",
  "mcp_generation_work_budget_security",
  "security_followup_remediation",
];

/**
 * @param {string} rootDir
 * @param {string} gateId
 * @param {string[]} governedPaths
 */
function isCurrentSecurityGovernedPathCompatibility(rootDir, gateId, governedPaths) {
  const report = readJsonFile(rootDir, EVIDENCE_PATHS.currentSecurityGovernedPathCompatibility);
  if (!isRecord(report)) return false;
  const coveredGateIds = Array.isArray(report.coveredGateIds) ? report.coveredGateIds.map(readString) : [];
  const coveredPaths = Array.isArray(report.governedPaths) ? report.governedPaths.map(readString) : [];
  const verification = isRecord(report.verification) ? report.verification : {};
  const vitest = isRecord(verification.vitest) ? verification.vitest : {};
  const baseline = isRecord(report.baselineBoundary) ? report.baselineBoundary : {};
  const postFixScan = isRecord(report.postFixFullRepositoryScan) ? report.postFixFullRepositoryScan : {};
  const mutation = isRecord(report.mutationBoundary) ? report.mutationBoundary : {};
  const remaining = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  const sourceHead = readString(report.sourceHead);
  const productionCommit = readString(report.productionCommit);
  const noMutation = mutation.dbMutationPerformed === false
    && mutation.providerCallPerformedForEvidence === false
    && mutation.providerDispatchCalled === false
    && mutation.shareSessionCreated === false
    && mutation.readConfirmationCreated === false
    && mutation.vectorOrEmbeddingMutationPerformed === false
    && mutation.wikiPublicationPerformed === false
    && mutation.koshaExactRegistryMutationPerformed === false;
  return readString(report.verdict) === "PASS_CURRENT_SOURCE_LIVE_INCLUDED_SECURITY_GOVERNED_PATH_COMPATIBILITY_RESCAN_COMPLETE_FINDINGS_OPEN"
    && sourceHead.length > 0
    && productionCommit.length > 0
    && isGitAncestor(rootDir, sourceHead)
    && isGitAncestor(rootDir, productionCommit)
    && report.productionIncludesSourceHead === true
    && isEvidenceCurrentForPaths(rootDir, sourceHead, governedPaths)
    && coveredGateIds.length === CURRENT_SECURITY_GOVERNED_COMPATIBILITY_GATE_IDS.length
    && CURRENT_SECURITY_GOVERNED_COMPATIBILITY_GATE_IDS.every((id) => coveredGateIds.includes(id))
    && coveredGateIds.includes(gateId)
    && coveredPaths.length >= 18
    && governedPaths.every((pathName) => coveredPaths.includes(pathName))
    && readNumber(vitest.filesPassed) >= 20
    && readNumber(vitest.filesSkipped) === 1
    && readNumber(vitest.testsPassed) >= 233
    && readNumber(vitest.testsSkipped) === 7
    && readString(vitest.status) === "PASS_WITH_BROWSER_OPT_IN_SKIPPED"
    && readString(verification.typecheck) === "PASS"
    && readString(verification.browserCompatibility) === "PRESERVED_PRIOR_LIVE_EVIDENCE_NOT_REEXECUTED"
    && baseline.immutableOriginalBaselinePreserved === true
    && baseline.postFixFullRepositoryRescanCompleted === true
    && baseline.securityCompleteClaimAllowed === false
    && readString(postFixScan.scanId) === "f218c713-1a1c-4f4e-9777-8095926be1df"
    && readString(postFixScan.sourceHead) === "b5f145120766cd2ef904fce38ef32ed1a9facf74"
    && readNumber(postFixScan.reportableFindingCount) === 18
    && readNumber(postFixScan.mediumFindingCount) === 13
    && readNumber(postFixScan.lowFindingCount) === 5
    && readString(postFixScan.coverageCompleteness) === "partial"
    && postFixScan.securityCompleteClaimAllowed === false
    && noMutation
    && readString(remaining.distributedAdmissionActivation) === "OPERATOR_CONFIGURATION_REQUIRED"
    && readString(remaining.publicCatalogRls) === "APPROVAL_GATED_DB_POLICY_CHANGE_NOT_PERFORMED"
    && readString(remaining.recipientAckLiveDataApproval) === "APPROVAL_GATED"
    && readString(remaining.exactSavedShareVerdict) === "MISSING_EVIDENCE"
    && readString(remaining.postFixFullRepositoryScan) === "COMPLETE_SEALED_PARTIAL_COVERAGE_18_FINDINGS_OPEN";
}

/**
 * @param {string} rootDir
 * @returns {GateResult}
 */
function evaluateCurrentSourceLogoutStorageRemediationGate(rootDir) {
  const evidencePath = EVIDENCE_PATHS.currentSourceLogoutStorageRemediation;
  const report = readJsonFile(rootDir, evidencePath);
  if (!isRecord(report)) {
    return gateResult({
      id: "current_source_logout_storage_remediation",
      label: "Current-source logout storage remediation",
      state: "missing",
      evidencePath,
      detail: "The logout user-content storage remediation receipt is missing or invalid.",
      nextActions: ["Restore the deployed-source logout receipt without reclassifying the sealed finding or closing approval boundaries."],
    });
  }

  const finding = isRecord(report.finding) ? report.finding : {};
  const remediation = isRecord(report.remediation) ? report.remediation : {};
  const verification = isRecord(report.verification) ? report.verification : {};
  const focused = isRecord(verification.focusedAndAdjacentTests) ? verification.focusedAndAdjacentTests : {};
  const typecheck = isRecord(verification.typecheck) ? verification.typecheck : {};
  const build = isRecord(verification.productionBuild) ? verification.productionBuild : {};
  const staticAudit = isRecord(verification.frontendStaticAudit) ? verification.frontendStaticAudit : {};
  const live = isRecord(verification.liveDeployment) ? verification.liveDeployment : {};
  const mutation = isRecord(report.mutationBoundary) ? report.mutationBoundary : {};
  const boundaries = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  const exactKeys = Array.isArray(remediation.clearedExactKeys) ? remediation.clearedExactKeys : [];
  const prefixes = Array.isArray(remediation.clearedPrefixes) ? remediation.clearedPrefixes : [];
  const preferences = Array.isArray(remediation.preservedPreferenceKeys) ? remediation.preservedPreferenceKeys : [];
  const explicitLogoutPaths = Array.isArray(remediation.explicitLogoutPaths) ? remediation.explicitLogoutPaths : [];
  const productCommit = readString(report.productCommit);
  const noMutation = mutation.dbMutationPerformed === false
    && mutation.providerDispatchCalled === false
    && mutation.shareSessionCreated === false
    && mutation.vectorOrEmbeddingMutationPerformed === false
    && mutation.wikiPublicationPerformed === false
    && mutation.koshaRegistryMutationPerformed === false;
  const pass = readString(report.schemaVersion) === "safeclaw-current-source-security-logout-storage-remediation/v1"
    && readString(report.verdict) === "PASS_LIVE_DEPLOYED_SOURCE_LOGOUT_USER_CONTENT_PURGE_CONTRACT"
    && productCommit !== ""
    && productCommit === readString(report.sourceHead)
    && productCommit === readString(report.productionCommit)
    && productCommit === readString(report.productionCommitAtVerification)
    && productCommit === readString(live.commitSha)
    && readString(live.branch) === "master"
    && readString(live.environment) === "production"
    && readString(live.vercelStatus) === "success"
    && isGitAncestor(rootDir, productCommit)
    && readString(finding.findingId) === "csf_939ccf5e3f2f0fa1963be3e5"
    && readString(finding.occurrenceId) === "occ_26f3ceb91a01b89d9502da8d"
    && readString(finding.ruleId) === "client-data.persistent-logout-retention"
    && finding.sealedFindingReclassified === false
    && finding.freshRescanRequired === true
    && explicitLogoutPaths.length === 2
    && explicitLogoutPaths.includes("components/AdminLoginPanel.tsx")
    && explicitLogoutPaths.includes("components/FieldOperationsWorkspace.tsx")
    && readString(remediation.authEvent) === "SIGNED_OUT"
    && readString(remediation.workspaceAutoSaveRepopulationPreventedBy) === "navigate_to_login_after_cleanup"
    && exactKeys.length === 2
    && exactKeys.includes("safeclaw.currentWorkpack.v1")
    && exactKeys.includes("safeclaw.operationImprovements.v1")
    && prefixes.length === 3
    && prefixes.includes("safeclaw-workpack:")
    && prefixes.includes("safeclaw.documentEditorialReview.v1:")
    && prefixes.includes("safeclaw.documentEditorialReviewReviewer.v1:")
    && preferences.length === 2
    && preferences.includes("safeclaw.moduleTheme")
    && preferences.includes("safeclaw.aiMode")
    && remediation.cleanupFailureReported === true
    && remediation.supabaseSignOutFailureStillAttemptsLocalCleanup === true
    && readNumber(focused.filesPassed) === 5
    && readNumber(focused.testsPassed) === 100
    && readNumber(focused.testsFailed) === 0
    && readString(typecheck.status) === "PASS"
    && readString(build.status) === "PASS"
    && readNumber(build.staticPages) === 28
    && readString(staticAudit.status) === "pass"
    && readNumber(staticAudit.pageFiles) === 33
    && readNumber(staticAudit.componentFiles) === 24
    && readNumber(staticAudit.coverageIssues) === 0
    && readNumber(staticAudit.violationCount) === 0
    && live.behavioralLogoutExecuted === false
    && noMutation
    && boundaries.immutableOriginalBaselinePreserved === true
    && boundaries.sealedCurrentHeadScanPreserved === true
    && boundaries.securityComplete === false
    && readString(boundaries.exactSavedShareVerdict) === "MISSING_EVIDENCE"
    && boundaries.approvalGatedFindingsRemainOpen === true
    && boundaries.liveAfterDeploymentRequired === false;

  return gateResult({
    id: "current_source_logout_storage_remediation",
    label: "Current-source logout storage remediation",
    state: pass ? "notice" : "contradicted",
    evidencePath,
    detail: pass
      ? "Current live source clears worker/workpack/editorial browser content on explicit logout and SIGNED_OUT while preserving only theme and AI-mode preferences; workspace navigation prevents autosave repopulation. Five files / 100 tests, typecheck, 28-page build, and the 33-page/24-component static audit pass. Behavioral live logout was intentionally not executed because it would mutate the signed-in session. The sealed finding remains open pending a fresh scan, security-complete is false, no mutation occurred, approval-gated findings remain open, and exact saved Share remains MISSING_EVIDENCE."
      : `Logout-storage verdict=${readString(report.verdict) || "missing"}, product/live=${productCommit || "missing"}/${readString(live.commitSha) || "missing"}, tests=${readNumber(focused.testsPassed)}, keys=${exactKeys.length}/${prefixes.length}, behavioralLogout=${live.behavioralLogoutExecuted === true}, freshRescan=${finding.freshRescanRequired === true}, noMutation=${noMutation}, securityComplete=${boundaries.securityComplete === true}, exactShare=${readString(boundaries.exactSavedShareVerdict) || "missing"}.`,
    nextActions: pass
      ? [
          "Include the deployed logout contract in the next full repository scan before reclassifying the sealed finding.",
          "Keep exact saved Share and all DB/provider/vector/wiki/KOSHA approval boundaries open.",
        ]
      : ["Restore exact cleanup keys and prefixes, aligned source/live identity, verification counts, fresh-rescan boundary, no-mutation boundary, and exact Share MISSING_EVIDENCE."],
  });
}

/**
 * @param {string} rootDir
 * @returns {GateResult}
 */
function evaluateCurrentSourceOntologyErrorProjectionRemediationGate(rootDir) {
  const evidencePath = EVIDENCE_PATHS.currentSourceOntologyErrorProjectionRemediation;
  const report = readJsonFile(rootDir, evidencePath);
  if (!isRecord(report)) {
    return gateResult({
      id: "current_source_ontology_error_projection_remediation",
      label: "Current-source ontology error projection remediation",
      state: "missing",
      evidencePath,
      detail: "The public ontology error-projection remediation receipt is missing or invalid.",
      nextActions: ["Restore the deployed-source ontology receipt without reclassifying the sealed finding or closing approval boundaries."],
    });
  }

  const finding = isRecord(report.finding) ? report.finding : {};
  const remediation = isRecord(report.remediation) ? report.remediation : {};
  const verification = isRecord(report.verification) ? report.verification : {};
  const focused = isRecord(verification.focusedAndAdjacentTests) ? verification.focusedAndAdjacentTests : {};
  const typecheck = isRecord(verification.typecheck) ? verification.typecheck : {};
  const build = isRecord(verification.productionBuild) ? verification.productionBuild : {};
  const live = isRecord(verification.liveDeployment) ? verification.liveDeployment : {};
  const probe = isRecord(live.publicProbe) ? live.publicProbe : {};
  const mutation = isRecord(report.mutationBoundary) ? report.mutationBoundary : {};
  const boundaries = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  const publicErrorCodes = Array.isArray(remediation.publicErrorCodes)
    ? remediation.publicErrorCodes.map(readString).filter(Boolean)
    : [];
  const productCommit = readString(report.productCommit);
  const productionCommit = readString(report.productionCommit);
  const noMutation = mutation.dbMutationPerformed === false
    && mutation.providerDispatchCalled === false
    && mutation.shareSessionCreated === false
    && mutation.vectorOrEmbeddingMutationPerformed === false
    && mutation.wikiPublicationPerformed === false
    && mutation.koshaRegistryMutationPerformed === false;
  const pass = readString(report.schemaVersion) === "safeclaw-current-source-security-ontology-error-projection-remediation/v1"
    && readString(report.verdict) === "PASS_LIVE_DEPLOYED_SOURCE_ONTOLOGY_ERROR_PROJECTION_CONTRACT"
    && productCommit !== ""
    && productCommit === readString(report.sourceHead)
    && productionCommit !== ""
    && productionCommit === readString(report.productionCommitAtVerification)
    && productionCommit === readString(live.commitSha)
    && isGitAncestor(rootDir, productCommit)
    && isGitAncestor(rootDir, productionCommit)
    && readString(live.branch) === "master"
    && readString(live.environment) === "production"
    && readString(finding.findingId) === "csf_74a68abc8d7370ed1b78fad3"
    && readString(finding.occurrenceId) === "occ_51adcb8d80b56ecdf1de9fb2"
    && readString(finding.ruleId) === "information-exposure.public-ontology-error-projection"
    && finding.sealedFindingReclassified === false
    && finding.freshRescanRequired === true
    && publicErrorCodes.length === 2
    && publicErrorCodes.includes("ONTOLOGY_GRAPH_BUDGET_EXCEEDED")
    && publicErrorCodes.includes("ONTOLOGY_GRAPH_UPSTREAM_UNAVAILABLE")
    && remediation.correlationIdGenerated === true
    && remediation.upstreamResponseBodyReturnedPublicly === false
    && remediation.upstreamResponseBodyLogged === false
    && remediation.unknownExceptionMessageLogged === false
    && readNumber(remediation.diagnosticMessageMaxCharacters) === 512
    && remediation.callerAbortPropagationPreserved === true
    && remediation.successOutputBudgetPreserved === true
    && readNumber(focused.filesPassed) === 3
    && readNumber(focused.testsPassed) === 12
    && readNumber(focused.testsFailed) === 0
    && readString(typecheck.status) === "PASS"
    && readString(build.status) === "PASS"
    && readNumber(build.staticPages) === 28
    && readString(live.status) === "PASS_DEPLOYED_SOURCE_AND_PUBLIC_ADMISSION_BOUNDARY"
    && readString(probe.path) === "/api/ontology/graph"
    && readNumber(probe.status) === 503
    && readString(probe.code) === "DISTRIBUTED_RATE_LIMIT_UNAVAILABLE"
    && probe.upstreamReadReached === false
    && probe.internalBodyExposed === false
    && live.upstreamFailureInduced === false
    && noMutation
    && boundaries.immutableOriginalBaselinePreserved === true
    && boundaries.sealedCurrentHeadScanPreserved === true
    && boundaries.securityComplete === false
    && readString(boundaries.exactSavedShareVerdict) === "MISSING_EVIDENCE"
    && boundaries.approvalGatedFindingsRemainOpen === true
    && boundaries.liveAfterDeploymentRequired === false;

  return gateResult({
    id: "current_source_ontology_error_projection_remediation",
    label: "Current-source ontology error projection remediation",
    state: pass ? "notice" : "contradicted",
    evidencePath,
    detail: pass
      ? "Current live source returns two fixed public ontology error codes with correlation IDs while excluding upstream bodies and arbitrary exception messages from public JSON and server diagnostics. Three files / 12 tests, typecheck, and the 28-page build pass; live public admission fails closed before upstream work. No provider failure was induced, the sealed finding remains open pending a fresh scan, security-complete is false, no mutation occurred, approval-gated findings remain open, and exact saved Share remains MISSING_EVIDENCE."
      : `Ontology-error verdict=${readString(report.verdict) || "missing"}, product/live=${productCommit || "missing"}/${productionCommit || "missing"}, tests=${readNumber(focused.testsPassed)}, publicCodes=${publicErrorCodes.length}, probe=${readNumber(probe.status)}/${readString(probe.code) || "missing"}, upstreamFailureInduced=${live.upstreamFailureInduced === true}, freshRescan=${finding.freshRescanRequired === true}, noMutation=${noMutation}, securityComplete=${boundaries.securityComplete === true}, exactShare=${readString(boundaries.exactSavedShareVerdict) || "missing"}.`,
    nextActions: pass
      ? [
          "Include the deployed ontology error contract in the next full repository scan before reclassifying the sealed finding.",
          "Keep exact saved Share and all DB/provider/vector/wiki/KOSHA approval boundaries open.",
        ]
      : ["Restore fixed public codes, body-free diagnostics, aligned source/live identity, verification counts, fresh-rescan boundary, no-mutation boundary, and exact Share MISSING_EVIDENCE."],
  });
}

/**
 * @param {string} rootDir
 * @returns {GateResult}
 */
function evaluateCurrentSourcePhotoReadinessAuthFanoutRemediationGate(rootDir) {
  const evidencePath = EVIDENCE_PATHS.currentSourcePhotoReadinessAuthFanoutRemediation;
  const report = readJsonFile(rootDir, evidencePath);
  if (!isRecord(report)) {
    return gateResult({
      id: "current_source_photo_readiness_auth_fanout_remediation",
      label: "Current-source photo readiness auth fan-out remediation",
      state: "missing",
      evidencePath,
      detail: "The public photo readiness authentication fan-out remediation receipt is missing or invalid.",
      nextActions: ["Restore the deployed-source receipt without reclassifying the sealed finding or closing approval boundaries."],
    });
  }

  const finding = isRecord(report.finding) ? report.finding : {};
  const remediation = isRecord(report.remediation) ? report.remediation : {};
  const verification = isRecord(report.verification) ? report.verification : {};
  const focused = isRecord(verification.focusedTests) ? verification.focusedTests : {};
  const typecheck = isRecord(verification.typecheck) ? verification.typecheck : {};
  const build = isRecord(verification.productionBuild) ? verification.productionBuild : {};
  const live = isRecord(verification.liveDeployment) ? verification.liveDeployment : {};
  const probe = isRecord(live.publicProbe) ? live.publicProbe : {};
  const mutation = isRecord(report.mutationBoundary) ? report.mutationBoundary : {};
  const boundaries = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  const productCommit = readString(report.productCommit);
  const productionCommit = readString(report.productionCommit);
  const noMutation = mutation.dbMutationPerformed === false
    && mutation.providerDispatchCalled === false
    && mutation.shareSessionCreated === false
    && mutation.vectorOrEmbeddingMutationPerformed === false
    && mutation.wikiPublicationPerformed === false
    && mutation.koshaRegistryMutationPerformed === false
    && mutation.photoPostAnalysisExecuted === false;
  const pass = readString(report.schemaVersion) === "safeclaw-current-source-security-photo-readiness-auth-fanout-remediation/v1"
    && readString(report.verdict) === "PASS_LIVE_DEPLOYED_SOURCE_PHOTO_READINESS_AUTH_FANOUT_CONTRACT"
    && productCommit !== ""
    && productCommit === readString(report.sourceHead)
    && productionCommit === productCommit
    && productionCommit === readString(live.commitSha)
    && isGitAncestor(rootDir, productCommit)
    && readString(live.branch) === "master"
    && readString(live.environment) === "production"
    && readString(finding.findingId) === "csf_e70379e4470e7bf7ec2786a4"
    && readString(finding.occurrenceId) === "occ_cc14cdbca20eb2f3f41aa454"
    && readString(finding.ruleId) === "resource-exhaustion.photo-readiness-auth-fanout"
    && finding.sealedFindingReclassified === false
    && finding.freshRescanRequired === true
    && remediation.publicGetReturnsCoarseReadinessOnly === true
    && remediation.publicGetCreatesSupabaseAdminClient === false
    && remediation.publicGetCallsSupabaseAuthentication === false
    && remediation.arbitraryBearerChangesPublicGetResponseShape === false
    && remediation.providerDiagnosticsExposedByPublicGet === false
    && remediation.postAuthenticationPreserved === true
    && remediation.postMultipartBudgetPreserved === true
    && remediation.postProviderExecutionPreserved === true
    && readNumber(focused.filesPassed) === 2
    && readNumber(focused.testsPassed) === 13
    && readNumber(focused.testsFailed) === 0
    && readString(typecheck.status) === "PASS"
    && readString(build.status) === "PASS"
    && readNumber(build.staticPages) === 28
    && readString(live.status) === "PASS_DEPLOYED_SOURCE_AND_PUBLIC_RESPONSE_BOUNDARY"
    && readString(probe.path) === "/api/input-photos/hazard-analysis"
    && readNumber(probe.anonymousStatus) === 200
    && readNumber(probe.arbitraryBearerStatus) === 200
    && probe.responseBodiesEqual === true
    && probe.providerDiagnosticsExposed === false
    && probe.apiKeyPresenceExposed === false
    && probe.photoPostAnalysisExecuted === false
    && noMutation
    && boundaries.immutableOriginalBaselinePreserved === true
    && boundaries.sealedCurrentHeadScanPreserved === true
    && boundaries.securityComplete === false
    && readString(boundaries.exactSavedShareVerdict) === "MISSING_EVIDENCE"
    && boundaries.approvalGatedFindingsRemainOpen === true
    && boundaries.liveAfterDeploymentRequired === false;

  return gateResult({
    id: "current_source_photo_readiness_auth_fanout_remediation",
    label: "Current-source photo readiness auth fan-out remediation",
    state: pass ? "notice" : "contradicted",
    evidencePath,
    detail: pass
      ? "Current live source returns one coarse photo readiness response for anonymous and arbitrary-Bearer GET requests without creating a Supabase admin client or calling authentication. Two files / 13 tests, typecheck, and the 28-page build pass; live responses are identical and expose no provider or API-key diagnostics. Photo-analysis POST authentication and upload/provider budgets remain intact. The sealed finding stays open pending a fresh scan, security-complete is false, no mutation occurred, approval-gated findings remain open, and exact saved Share remains MISSING_EVIDENCE."
      : `Photo-readiness verdict=${readString(report.verdict) || "missing"}, product/live=${productCommit || "missing"}/${productionCommit || "missing"}, tests=${readNumber(focused.testsPassed)}, client=${remediation.publicGetCreatesSupabaseAdminClient === true}, auth=${remediation.publicGetCallsSupabaseAuthentication === true}, probe=${readNumber(probe.anonymousStatus)}/${readNumber(probe.arbitraryBearerStatus)}/${probe.responseBodiesEqual === true}, freshRescan=${finding.freshRescanRequired === true}, noMutation=${noMutation}, securityComplete=${boundaries.securityComplete === true}, exactShare=${readString(boundaries.exactSavedShareVerdict) || "missing"}.`,
    nextActions: pass
      ? [
          "Include the deployed photo readiness contract in the next full repository scan before reclassifying the sealed finding.",
          "Keep exact saved Share and all DB/provider/vector/wiki/KOSHA approval boundaries open.",
        ]
      : ["Restore auth-free coarse GET behavior, aligned source/live identity, verification counts, fresh-rescan boundary, no-mutation boundary, and exact Share MISSING_EVIDENCE."],
  });
}

/**
 * @param {string} rootDir
 * @returns {GateResult}
 */
function evaluateCurrentSourceMcpGenerationCancellationRemediationGate(rootDir) {
  const evidencePath = EVIDENCE_PATHS.currentSourceMcpGenerationCancellationRemediation;
  const report = readJsonFile(rootDir, evidencePath);
  if (!isRecord(report)) {
    return gateResult({
      id: "current_source_mcp_generation_cancellation_remediation",
      label: "Current-source MCP generation cancellation remediation",
      state: "missing",
      evidencePath,
      detail: "The MCP generation cancellation remediation receipt is missing or invalid.",
      nextActions: ["Restore deployed-source cancellation evidence without reclassifying the sealed finding or closing approval boundaries."],
    });
  }

  const finding = isRecord(report.finding) ? report.finding : {};
  const remediation = isRecord(report.remediation) ? report.remediation : {};
  const verification = isRecord(report.verification) ? report.verification : {};
  const focused = isRecord(verification.focusedTests) ? verification.focusedTests : {};
  const adjacent = isRecord(verification.adjacentTests) ? verification.adjacentTests : {};
  const typecheck = isRecord(verification.typecheck) ? verification.typecheck : {};
  const build = isRecord(verification.productionBuild) ? verification.productionBuild : {};
  const live = isRecord(verification.liveDeployment) ? verification.liveDeployment : {};
  const mutation = isRecord(report.mutationBoundary) ? report.mutationBoundary : {};
  const boundaries = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  const productCommit = readString(report.productCommit);
  const productionCommit = readString(report.productionCommit);
  const noMutation = mutation.dbMutationPerformed === false
    && mutation.providerDispatchCalled === false
    && mutation.mcpGenerationProviderCalled === false
    && mutation.shareSessionCreated === false
    && mutation.vectorOrEmbeddingMutationPerformed === false
    && mutation.wikiPublicationPerformed === false
    && mutation.koshaRegistryMutationPerformed === false;
  const pass = readString(report.schemaVersion) === "safeclaw-current-source-security-mcp-generation-cancellation-remediation/v1"
    && readString(report.verdict) === "PASS_LIVE_DEPLOYED_SOURCE_MCP_GENERATION_CANCELLATION_CONTRACT"
    && productCommit !== ""
    && productCommit === readString(report.sourceHead)
    && productionCommit === productCommit
    && productionCommit === readString(live.commitSha)
    && isGitAncestor(rootDir, productCommit)
    && readString(live.branch) === "master"
    && readString(live.environment) === "production"
    && readString(finding.findingId) === "csf_c2f6fb44442dee56c0d5c2ed"
    && readString(finding.occurrenceId) === "occ_89f04a2500ced5cf2d9057fe"
    && readString(finding.ruleId) === "resource-exhaustion.mcp-generation-cancellation-dropped"
    && finding.sealedFindingReclassified === false
    && finding.freshRescanRequired === true
    && remediation.plainGenerationTransportSignalForwarded === true
    && remediation.reviewedGenerationTransportSignalForwarded === true
    && remediation.ontologyNodeFetchSignalForwarded === true
    && remediation.ontologyEdgeFetchSignalForwarded === true
    && remediation.runAskSignalForwarded === true
    && remediation.qaReviewSignalForwarded === true
    && remediation.abortRemainsExceptionalInsteadOfFallback === true
    && remediation.persistenceSkippedAfterAbort === true
    && remediation.providerAdmissionReleasedByRejectedWorkFinally === true
    && remediation.existingDirectHandlerCallsRemainCompatible === true
    && readNumber(focused.filesPassed) === 5
    && readNumber(focused.testsPassed) === 54
    && readNumber(focused.testsFailed) === 0
    && readNumber(adjacent.filesPassed) === 5
    && readNumber(adjacent.testsPassed) === 143
    && readNumber(adjacent.testsFailed) === 0
    && readString(typecheck.status) === "PASS"
    && readString(build.status) === "PASS"
    && readNumber(build.staticPages) === 28
    && readString(live.status) === "PASS_DEPLOYED_SOURCE_CONTRACT_RUNTIME_CANCELLATION_NOT_PROBED"
    && live.sourceHeadMatchesProduction === true
    && live.authenticatedMcpCancellationProbeExecuted === false
    && noMutation
    && boundaries.immutableOriginalBaselinePreserved === true
    && boundaries.sealedCurrentHeadScanPreserved === true
    && boundaries.securityComplete === false
    && readString(boundaries.exactSavedShareVerdict) === "MISSING_EVIDENCE"
    && boundaries.approvalGatedFindingsRemainOpen === true
    && boundaries.liveAfterDeploymentRequired === false
    && boundaries.validAuthenticatedRuntimeCancellationProbeRequired === true;

  return gateResult({
    id: "current_source_mcp_generation_cancellation_remediation",
    label: "Current-source MCP generation cancellation remediation",
    state: pass ? "notice" : "contradicted",
    evidencePath,
    detail: pass
      ? "Current live source threads one MCP transport AbortSignal through plain and reviewed generation, both ontology fetches, runAsk, and QA, then stops before persistence on cancellation. Five focused files / 54 tests plus five adjacent files / 143 tests, typecheck, and the 28-page build pass. No authenticated runtime cancellation probe or provider call was executed; the sealed finding stays open pending a fresh scan, security-complete is false, no mutation occurred, approval-gated findings remain open, and exact saved Share remains MISSING_EVIDENCE."
      : `MCP cancellation verdict=${readString(report.verdict) || "missing"}, product/live=${productCommit || "missing"}/${productionCommit || "missing"}, tests=${readNumber(focused.testsPassed)}+${readNumber(adjacent.testsPassed)}, signal=${remediation.plainGenerationTransportSignalForwarded === true}/${remediation.reviewedGenerationTransportSignalForwarded === true}/${remediation.runAskSignalForwarded === true}/${remediation.qaReviewSignalForwarded === true}, runtimeProbe=${live.authenticatedMcpCancellationProbeExecuted === true}, freshRescan=${finding.freshRescanRequired === true}, noMutation=${noMutation}, securityComplete=${boundaries.securityComplete === true}, exactShare=${readString(boundaries.exactSavedShareVerdict) || "missing"}.`,
    nextActions: pass
      ? [
          "Include the deployed MCP cancellation contract in the next full repository scan before reclassifying the sealed finding.",
          "Run a valid-token runtime cancellation probe only under a separately approved non-production-safe execution plan; keep exact saved Share and all mutation boundaries open.",
        ]
      : ["Restore end-to-end signal propagation, aligned source/live identity, verification counts, fresh-rescan/runtime-probe boundaries, no-mutation, and exact Share MISSING_EVIDENCE."],
  });
}

/**
 * @param {string} rootDir
 * @returns {GateResult}
 */
function evaluateCurrentSourceKoshaArchivePreflightRemediationGate(rootDir) {
  const evidencePath = EVIDENCE_PATHS.currentSourceKoshaArchivePreflightRemediation;
  const report = readJsonFile(rootDir, evidencePath);
  if (!isRecord(report)) {
    return gateResult({
      id: "current_source_kosha_archive_preflight_remediation",
      label: "Current-source KOSHA archive preflight remediation",
      state: "missing",
      evidencePath,
      detail: "The KOSHA archive preflight remediation receipt is missing or invalid.",
      nextActions: ["Restore deployed-source archive preflight evidence without reclassifying the sealed finding or closing approval boundaries."],
    });
  }

  const finding = isRecord(report.finding) ? report.finding : {};
  const remediation = isRecord(report.remediation) ? report.remediation : {};
  const verification = isRecord(report.verification) ? report.verification : {};
  const focusedPython = isRecord(verification.focusedPython) ? verification.focusedPython : {};
  const focusedVitest = isRecord(verification.focusedVitest) ? verification.focusedVitest : {};
  const adjacentPython = isRecord(verification.adjacentPython) ? verification.adjacentPython : {};
  const adjacentVitest = isRecord(verification.adjacentVitest) ? verification.adjacentVitest : {};
  const typecheck = isRecord(verification.typecheck) ? verification.typecheck : {};
  const build = isRecord(verification.productionBuild) ? verification.productionBuild : {};
  const live = isRecord(verification.liveDeployment) ? verification.liveDeployment : {};
  const mutation = isRecord(report.mutationBoundary) ? report.mutationBoundary : {};
  const boundaries = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  const productCommit = readString(report.productCommit);
  const productionCommit = readString(report.productionCommit);
  const productCommitCurrent = isGitAncestor(rootDir, productCommit);
  const productionCommitCurrent = isGitAncestor(rootDir, productionCommit);
  const productionIncludesProduct = isGitAncestorOf(rootDir, productCommit, productionCommit);
  const noMutation = mutation.dbMutationPerformed === false
    && mutation.providerDispatchCalled === false
    && mutation.shareSessionCreated === false
    && mutation.vectorOrEmbeddingMutationPerformed === false
    && mutation.wikiPublicationPerformed === false
    && mutation.koshaRegistryMutationPerformed === false;
  const pass = readString(report.schemaVersion) === "safeclaw-current-source-security-kosha-archive-preflight-remediation/v1"
    && readString(report.verdict) === "PASS_LIVE_DEPLOYED_SOURCE_KOSHA_ARCHIVE_PREFLIGHT_CONTRACT"
    && productCommit !== ""
    && productCommit === readString(report.sourceHead)
    && productionCommit !== ""
    && productionCommit === readString(live.commitSha)
    && productCommitCurrent
    && productionCommitCurrent
    && productionIncludesProduct
    && readString(live.branch) === "master"
    && readString(live.environment) === "production"
    && readString(finding.findingId) === "csf_d7f23c57f1ee89b4c6cdad17"
    && readString(finding.occurrenceId) === "occ_150ad7ac80e3ea536f29ffcf"
    && readString(finding.ruleId) === "resource-exhaustion.unbounded-audit-archive-preflight"
    && finding.sealedFindingReclassified === false
    && finding.freshRescanRequired === true
    && remediation.nodeAdmZipInventoryRemoved === true
    && remediation.boundedPythonInventoryUsed === true
    && readNumber(remediation.endOfCentralDirectoryTailBytes) === 65557
    && readNumber(remediation.maxCentralDirectoryBytes) === 64 * 1024 * 1024
    && readNumber(remediation.maxMemberCount) === 10000
    && readNumber(remediation.maxMemberBytes) === 64 * 1024 * 1024
    && readNumber(remediation.maxTotalUncompressedBytes) === 1024 * 1024 * 1024
    && readNumber(remediation.maxCompressionRatio) === 100
    && readNumber(remediation.inventoryTimeoutMs) === 60000
    && readNumber(remediation.parseTimeoutMs) === 900000
    && remediation.sameOpenFileHandleUsedForPreflightAndZipFile === true
    && remediation.aggregateArchiveMemberBudgetEnforced === true
    && remediation.aggregateArchiveByteBudgetEnforced === true
    && remediation.directPdfLegacyInventorySemanticsPreserved === true
    && remediation.fixedSanitizedHelperErrors === true
    && remediation.providerOrDatabaseWorkReachedByOverBudgetRegression === false
    && readNumber(focusedPython.testsPassed) === 64
    && readNumber(focusedPython.testsFailed) === 0
    && readNumber(focusedVitest.testsPassed) === 112
    && readNumber(focusedVitest.testsFailed) === 0
    && readNumber(adjacentPython.testsPassed) === 13
    && readNumber(adjacentPython.testsFailed) === 0
    && readNumber(adjacentVitest.testsPassed) === 37
    && readNumber(adjacentVitest.testsFailed) === 0
    && readString(typecheck.status) === "PASS"
    && readString(build.status) === "PASS"
    && readNumber(build.staticPages) === 28
    && readString(live.status) === "PASS_DEPLOYED_SOURCE_CONTRACT_LOCAL_ARCHIVE_PROBE_NOT_EXECUTED"
    && live.sourceHeadMatchesProduction === true
    && live.runtimeArchiveProbeExecuted === false
    && noMutation
    && boundaries.immutableOriginal18FindingBaselinePreserved === true
    && boundaries.sealedCurrentHeadScanPreserved === true
    && boundaries.securityComplete === false
    && readString(boundaries.exactSavedShareVerdict) === "MISSING_EVIDENCE"
    && boundaries.approvalGatedFindingsRemainOpen === true
    && boundaries.liveAfterDeploymentRequired === false
    && boundaries.freshFullRepositorySecurityRescanRequired === true;

  return gateResult({
    id: "current_source_kosha_archive_preflight_remediation",
    label: "Current-source KOSHA archive preflight remediation",
    state: pass ? "notice" : "contradicted",
    evidencePath,
    detail: pass
      ? "Current live source removes the unbounded AdmZip inventory and preflights a bounded ZIP central directory on the same open file handle before Python ZipFile materialization. Focused Python/Vitest 64/112 plus adjacent Python/Vitest 13/37, typecheck, and the 28-page build pass. The over-budget regression stops before provider or database work. No live local-archive probe was executed; the sealed finding stays open pending a fresh scan, security-complete is false, no mutation occurred, approval-gated KOSHA promotion remains open, and exact saved Share remains MISSING_EVIDENCE."
      : `KOSHA archive verdict=${readString(report.verdict) || "missing"}, product/live=${productCommit || "missing"}/${productionCommit || "missing"}, ancestry=${productCommitCurrent}/${productionCommitCurrent}/${productionIncludesProduct}, tests=${readNumber(focusedPython.testsPassed)}+${readNumber(focusedVitest.testsPassed)}+${readNumber(adjacentPython.testsPassed)}+${readNumber(adjacentVitest.testsPassed)}, preflight=${remediation.boundedPythonInventoryUsed === true}/${remediation.sameOpenFileHandleUsedForPreflightAndZipFile === true}, runtimeProbe=${live.runtimeArchiveProbeExecuted === true}, freshRescan=${finding.freshRescanRequired === true}, noMutation=${noMutation}, securityComplete=${boundaries.securityComplete === true}, exactShare=${readString(boundaries.exactSavedShareVerdict) || "missing"}.`,
    nextActions: pass
      ? [
          "Include the deployed KOSHA archive preflight contract in the next full repository scan before reclassifying the sealed finding.",
          "Keep exact saved Share, KOSHA exact promotion, and all DB/provider/vector/wiki mutation boundaries open.",
        ]
      : ["Restore same-handle central-directory preflight, aligned source/live identity, verification counts, fresh-rescan boundary, no-mutation, and exact Share MISSING_EVIDENCE."],
  });
}

/**
 * @param {string} rootDir
 * @param {string[]} governedPaths
 */
function isCurrentMcpGenerationCancellationCompatibility(rootDir, governedPaths) {
  const gate = evaluateCurrentSourceMcpGenerationCancellationRemediationGate(rootDir);
  const report = readJsonFile(rootDir, EVIDENCE_PATHS.currentSourceMcpGenerationCancellationRemediation);
  const productCommit = isRecord(report) ? readString(report.productCommit) : "";
  if (gate.state !== "notice" || !productCommit) return false;
  try {
    execFileSync("git", ["diff", "--quiet", `${productCommit}..HEAD`, "--", ...governedPaths], {
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
 * @param {string[]} governedPaths
 */
function isCurrentPhotoReadinessAuthFanoutCompatibility(rootDir, governedPaths) {
  const gate = evaluateCurrentSourcePhotoReadinessAuthFanoutRemediationGate(rootDir);
  const report = readJsonFile(rootDir, EVIDENCE_PATHS.currentSourcePhotoReadinessAuthFanoutRemediation);
  const productCommit = isRecord(report) ? readString(report.productCommit) : "";
  if (gate.state !== "notice" || !productCommit) return false;
  try {
    execFileSync("git", ["diff", "--quiet", `${productCommit}..HEAD`, "--", ...governedPaths], {
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
 * @param {string[]} governedPaths
 */
function isCurrentSecurityGovernedPathReceiptCurrent(rootDir, governedPaths) {
  return isCurrentSecurityGovernedPathCompatibility(
    rootDir,
    CURRENT_SECURITY_GOVERNED_COMPATIBILITY_GATE_IDS[0],
    governedPaths,
  );
}

const CURRENT_SOURCE_SECURITY_RESIDUAL_PATHS = [
  "lib/accident-cases.ts",
  "lib/api-guard.ts",
  "lib/kosha-openapi.ts",
  "lib/search.ts",
  "lib/server/upstream-http.ts",
  "lib/weather.ts",
  "lib/work24.ts",
  "tests/api-guard.test.ts",
  "tests/upstream-http-security.test.ts",
  "tests/upstream-integration-security.test.ts",
];

/**
 * @param {string} rootDir
 * @returns {GateResult}
 */
function evaluateCurrentSourceSecurityResidualRemediationGate(rootDir) {
  const evidencePath = EVIDENCE_PATHS.currentSourceSecurityResidualRemediation;
  const report = readJsonFile(rootDir, evidencePath);
  if (!isRecord(report)) {
    return gateResult({
      id: "current_source_security_residual_remediation",
      label: "Current-source security residual remediation",
      state: "missing",
      evidencePath,
      detail: "Current-source security residual remediation evidence is missing or invalid.",
      nextActions: ["Restore the deployed-source receipt without rewriting or closing the sealed scan."],
    });
  }

  const baseline = isRecord(report.baseline) ? report.baseline : {};
  const residuals = Array.isArray(report.remediatedSourceResiduals)
    ? report.remediatedSourceResiduals.filter(isRecord)
    : [];
  const verification = isRecord(report.verification) ? report.verification : {};
  const focused = isRecord(verification.focusedSecurity) ? verification.focusedSecurity : {};
  const adjacent = isRecord(verification.adjacentPublicAdmissionAndHarness)
    ? verification.adjacentPublicAdmissionAndHarness
    : {};
  const live = isRecord(report.liveVerification) ? report.liveVerification : {};
  const mutation = isRecord(report.mutationBoundary) ? report.mutationBoundary : {};
  const remaining = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  const sourceHead = readString(report.sourceHead);
  const productionCommit = readString(report.productionCommit);
  const residualAnchors = residuals.map((item) => readString(item.anchor)).sort();
  const noMutation = mutation.dbMutationPerformed === false
    && mutation.providerDispatchCalled === false
    && mutation.shareSessionCreated === false
    && mutation.embeddingGenerated === false
    && mutation.vectorUploadPerformed === false
    && mutation.wikiPublished === false
    && mutation.exactTrustRegistryMutationPerformed === false;
  const pass = readString(report.verdict) === "PASS_LIVE_DEPLOYED_SOURCE_SECURITY_RESIDUAL_REMEDIATION_RESCAN_PENDING"
    && sourceHead.length === 40
    && productionCommit.length === 40
    && isEvidenceCurrentForPaths(rootDir, sourceHead, CURRENT_SOURCE_SECURITY_RESIDUAL_PATHS)
    && isGitAncestor(rootDir, productionCommit)
    && report.productionIncludesProductCommit === true
    && readString(baseline.scanId) === "3358978a-75d1-454a-9dcd-4b63b52b9768"
    && readNumber(baseline.immutableOriginalFindingCount) === 18
    && readNumber(baseline.currentScanFindingCount) === 17
    && readString(baseline.coverageCompleteness) === "partial"
    && baseline.baselineRewritten === false
    && residuals.length === 3
    && residuals.every((item) => readString(item.status) === "PASS_CURRENT_SOURCE_LOCAL")
    && residualAnchors.join(",") === "dns-toctou,provider-detail,xff-spoof"
    && readNumber(focused.testFiles) === 3
    && readNumber(focused.tests) === 33
    && readString(focused.status) === "PASS"
    && readNumber(adjacent.testFiles) === 7
    && readNumber(adjacent.tests) === 141
    && readString(adjacent.status) === "PASS"
    && verification.typecheck === "PASS"
    && verification.productionBuild === "PASS"
    && readNumber(verification.staticPages) === 28
    && readString(live.status) === "PASS_DEPLOYED_SOURCE_MARKER_ONLY"
    && readString(live.buildInfoCommit) === productionCommit
    && live.behavioralProbeExecuted === false
    && noMutation
    && readString(remaining.exactSavedShareVerdict) === "MISSING_EVIDENCE"
    && readString(remaining.databaseSecurityRemediation) === "APPROVAL_GATED"
    && readString(remaining.providerDispatchPersistence) === "APPROVAL_GATED"
    && readString(remaining.llmWikiPublication) === "APPROVAL_GATED"
    && readString(remaining.sifVectorRuntime) === "APPROVAL_GATED"
    && readString(remaining.koshaExactRegistryPromotion) === "APPROVAL_GATED"
    && remaining.followUpSecurityScanRequired === true
    && remaining.securityCompleteClaimAllowed === false;

  return gateResult({
    id: "current_source_security_residual_remediation",
    label: "Current-source security residual remediation",
    state: pass ? "notice" : "contradicted",
    evidencePath,
    detail: pass
      ? "Deployed source includes bounded remediation for provider-detail, dns-toctou, and xff-spoof with 174 focused and adjacent tests, strict typecheck, and a 28-page production build. This is deployed-source plus local contract evidence only: the immutable 18-finding baseline and sealed 17-finding partial-coverage scan remain visible, no mutation occurred, a follow-up full scan is required, security-complete is false, and exact saved Share remains MISSING_EVIDENCE."
      : `Security residual verdict=${readString(report.verdict) || "missing"}, source=${sourceHead || "missing"}, production=${productionCommit || "missing"}, residuals=${residualAnchors.join(",") || "missing"}, tests=${readNumber(focused.tests)}+${readNumber(adjacent.tests)}, live=${readString(live.status) || "missing"}/${live.behavioralProbeExecuted === true}, noMutation=${noMutation}, rescan=${remaining.followUpSecurityScanRequired === true}, exactShare=${readString(remaining.exactSavedShareVerdict) || "missing"}.`,
    nextActions: pass
      ? ["Run a fresh full-repository security scan before reclassifying the three immutable findings or making any security-complete claim."]
      : ["Restore exact source/live marker ancestry, the three residual anchors, 174 tests, no-mutation boundaries, follow-up scan requirement, and exact Share MISSING_EVIDENCE."],
  });
}

const SHARE_ACK_PREBODY_ADMISSION_PATHS = [
  "app/api/share-sessions/[sessionId]/route.ts",
  "tests/workpack-share-authority-routes.test.ts",
];

/**
 * @param {string} rootDir
 * @returns {GateResult}
 */
function evaluateShareAckPreBodyAdmissionGate(rootDir) {
  const evidencePath = EVIDENCE_PATHS.shareAckPreBodyAdmission;
  const report = readJsonFile(rootDir, evidencePath);
  if (!isRecord(report)) {
    return gateResult({
      id: "share_ack_prebody_admission_security",
      label: "Share ACK pre-body admission security",
      state: "missing",
      evidencePath,
      detail: "Share ACK pre-body admission evidence is missing or invalid.",
      nextActions: ["Restore the no-mutation source/live receipt without creating a saved Share session."],
    });
  }

  const finding = isRecord(report.finding) ? report.finding : {};
  const contract = isRecord(report.currentSourceContract) ? report.currentSourceContract : {};
  const verification = isRecord(report.verification) ? report.verification : {};
  const focused = isRecord(verification.focusedAndAdjacentTests) ? verification.focusedAndAdjacentTests : {};
  const typecheck = isRecord(verification.typecheck) ? verification.typecheck : {};
  const build = isRecord(verification.build) ? verification.build : {};
  const live = isRecord(report.liveProbe) ? report.liveProbe : {};
  const mutation = isRecord(report.mutationBoundary) ? report.mutationBoundary : {};
  const remaining = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  const sourceHead = readString(report.sourceHead);
  const productionCommit = readString(report.productionCommit);
  const noMutation = mutation.dbMutationPerformed === false
    && mutation.shareSessionCreated === false
    && mutation.readConfirmationInserted === false
    && mutation.providerDispatchCalled === false
    && mutation.vectorRuntimeCalled === false
    && mutation.wikiPublished === false
    && mutation.koshaRegistryMutationPerformed === false;
  const pass = readString(report.verdict) === "PASS_LIVE_PRODUCTION_SHARE_ACK_PREBODY_ADMISSION_SOURCE_REMEDIATED"
    && sourceHead === productionCommit
    && isGitAncestor(rootDir, sourceHead)
    && (isEvidenceCurrentForPaths(rootDir, sourceHead, SHARE_ACK_PREBODY_ADMISSION_PATHS)
      || isShareMcpCurrentSourceCompatibilityCurrent(rootDir, "share_ack_prebody_admission_security", SHARE_ACK_PREBODY_ADMISSION_PATHS)
      || isCurrentSecurityGovernedPathCompatibility(rootDir, "share_ack_prebody_admission_security", SHARE_ACK_PREBODY_ADMISSION_PATHS))
    && readString(finding.scanId) === "1411fb32-5c18-4d6a-b8ba-d52697757d8a"
    && readString(finding.slug) === "share-ack-prebody-admission"
    && contract.coarseIpRateAdmissionBeforeBody === true
    && contract.coarseBodyConcurrencyLeaseBeforeBody === true
    && contract.bodyBudgetAfterCoarseAdmission === true
    && contract.jsonParseAfterCoarseAdmission === true
    && contract.recipientSpecificAdmissionRetainedAfterParse === true
    && readNumber(contract.preBodyRateLimitPerMinute) === 60
    && readNumber(contract.preBodyConcurrency) === 8
    && readNumber(contract.preBodyLeaseMs) === 15000
    && readNumber(contract.bodyBudgetBytes) === 16384
    && readNumber(contract.bodyReadTimeoutMs) === 10000
    && readNumber(focused.testFiles) === 3
    && readNumber(focused.testsPassed) === 66
    && readNumber(focused.testsFailed) === 0
    && readString(typecheck.status) === "PASS"
    && readString(build.status) === "PASS"
    && readNumber(build.staticPagesPassed) === 28
    && readNumber(build.staticPagesFailed) === 0
    && readNumber(live.requestBodyBytes) === 16385
    && readNumber(live.status) === 503
    && readString(live.code) === "DISTRIBUTED_RATE_LIMIT_UNAVAILABLE"
    && readString(live.rateLimitHeader) === "distributed"
    && live.applicationBodyBudgetReached === false
    && live.sessionLookupReached === false
    && noMutation
    && remaining.findingSourceRemediated === true
    && remaining.freshFullRepositoryRescanRequiredForScanClosure === true
    && remaining.securityCompleteClaimAllowed === false
    && readString(remaining.shareRecipientAckLiveDataApproval) === "APPROVAL_GATED"
    && readString(remaining.providerDispatchPersistence) === "APPROVAL_GATED"
    && readString(remaining.exactSavedShareVerdict) === "MISSING_EVIDENCE";

  return gateResult({
    id: "share_ack_prebody_admission_security",
    label: "Share ACK pre-body admission security",
    state: pass ? "notice" : "contradicted",
    evidencePath,
    detail: pass
      ? "Live production now acquires coarse distributed IP admission and a bounded body-read concurrency lease before the public Share ACK body budget and JSON parser, while retaining recipient-specific admission after parsing. The no-mutation oversized probe failed closed at pre-body admission, but the sealed finding remains open pending a fresh full scan; live recipient ACK approval and exact saved Share MISSING_EVIDENCE remain unchanged."
      : `Share ACK pre-body verdict=${readString(report.verdict) || "missing"}, sourceLive=${sourceHead.length > 0 && sourceHead === productionCommit}, sourceCurrent=${sourceHead.length > 0 && isEvidenceCurrentForPaths(rootDir, sourceHead, SHARE_ACK_PREBODY_ADMISSION_PATHS)}, ordering=${contract.coarseIpRateAdmissionBeforeBody === true}/${contract.coarseBodyConcurrencyLeaseBeforeBody === true}/${contract.recipientSpecificAdmissionRetainedAfterParse === true}, live=${readNumber(live.status)}/${readString(live.code) || "missing"}, noMutation=${noMutation}, rescan=${remaining.freshFullRepositoryRescanRequiredForScanClosure === true}, exactShare=${readString(remaining.exactSavedShareVerdict) || "missing"}.`,
    nextActions: pass
      ? ["Run a fresh Standard scan before reclassifying the sealed finding; keep exact saved Share and live recipient ACK approval-gated."]
      : ["Restore source/live alignment, pre-body rate and concurrency ordering, recipient-specific post-parse admission, no-mutation live proof, fresh-rescan requirement, and exact Share MISSING_EVIDENCE."],
  });
}

const SAFETY_STATUS_DISCONNECT_LEASE_PATHS = [
  "app/api/safety-reference/status/route.ts",
  "tests/safety-reference-status-route.test.ts",
];

/**
 * @param {string} rootDir
 * @returns {GateResult}
 */
function evaluateSafetyStatusDisconnectLeaseGate(rootDir) {
  const evidencePath = EVIDENCE_PATHS.safetyStatusDisconnectLease;
  const report = readJsonFile(rootDir, evidencePath);
  if (!isRecord(report)) {
    return gateResult({
      id: "safety_status_disconnect_lease_security",
      label: "Safety status disconnect lease security",
      state: "missing",
      evidencePath,
      detail: "Safety status disconnect lease evidence is missing or invalid.",
      nextActions: ["Restore the no-mutation source/live receipt without bypassing durable admission."],
    });
  }

  const finding = isRecord(report.finding) ? report.finding : {};
  const contract = isRecord(report.currentSourceContract) ? report.currentSourceContract : {};
  const verification = isRecord(report.verification) ? report.verification : {};
  const focused = isRecord(verification.focusedAndAdjacentTests) ? verification.focusedAndAdjacentTests : {};
  const typecheck = isRecord(verification.typecheck) ? verification.typecheck : {};
  const build = isRecord(verification.build) ? verification.build : {};
  const live = isRecord(report.liveProbe) ? report.liveProbe : {};
  const mutation = isRecord(report.mutationBoundary) ? report.mutationBoundary : {};
  const remaining = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  const sourceHead = readString(report.sourceHead);
  const productionCommit = readString(report.productionCommit);
  const noMutation = mutation.dbMutationPerformed === false
    && mutation.shareSessionCreated === false
    && mutation.readConfirmationInserted === false
    && mutation.providerDispatchCalled === false
    && mutation.vectorRuntimeCalled === false
    && mutation.wikiPublished === false
    && mutation.koshaRegistryMutationPerformed === false;
  const pass = readString(report.verdict) === "PASS_LIVE_PRODUCTION_SAFETY_STATUS_DISCONNECT_LEASE_SOURCE_REMEDIATED"
    && sourceHead === productionCommit
    && isGitAncestor(rootDir, sourceHead)
    && isEvidenceCurrentForPaths(rootDir, sourceHead, SAFETY_STATUS_DISCONNECT_LEASE_PATHS)
    && readString(finding.scanId) === "1411fb32-5c18-4d6a-b8ba-d52697757d8a"
    && readString(finding.findingId) === "csf_b08a96f6b1ba27a33af52a6a"
    && readString(finding.slug) === "status-disconnect-residual"
    && contract.preAbortedRequestsRejectedBeforeWork === true
    && contract.disconnectRecordedWithoutEarlySettlement === true
    && contract.underlyingWorkSettlementPrecedesAbortRejection === true
    && contract.admissionLeaseHeldUntilUnderlyingSettlement === true
    && contract.disconnectedWorkStillConsumesConcurrency === true
    && contract.thirdConcurrentRequestRejectedWhileTwoDisconnectedTasksSettle === true
    && readNumber(contract.concurrencyLimit) === 2
    && readNumber(focused.testFiles) === 4
    && readNumber(focused.testsPassed) === 16
    && readNumber(focused.testsFailed) === 0
    && readString(typecheck.status) === "PASS"
    && readString(build.status) === "PASS"
    && readNumber(build.staticPagesPassed) === 28
    && readNumber(build.staticPagesFailed) === 0
    && readNumber(live.status) === 503
    && readString(live.code) === "DISTRIBUTED_RATE_LIMIT_UNAVAILABLE"
    && readString(live.rateLimitHeader) === "distributed"
    && readString(live.workUnitHeader) === "safety-reference-status"
    && live.statusWorkReached === false
    && noMutation
    && remaining.findingSourceRemediated === true
    && remaining.freshFullRepositoryRescanRequiredForScanClosure === true
    && remaining.securityCompleteClaimAllowed === false
    && readString(remaining.distributedAdmissionActivation) === "OPERATOR_CONFIGURATION_REQUIRED"
    && readString(remaining.providerDispatchPersistence) === "APPROVAL_GATED"
    && readString(remaining.exactSavedShareVerdict) === "MISSING_EVIDENCE";

  return gateResult({
    id: "safety_status_disconnect_lease_security",
    label: "Safety status disconnect lease security",
    state: pass ? "notice" : "contradicted",
    evidencePath,
    detail: pass
      ? "Live production source now keeps safety-reference status admission occupied until the real catalog, corpus, and exact-registry aggregate settles after disconnect. Two disconnected tasks continue to consume the two-slot concurrency budget and a third request is rejected. The sealed finding remains open pending a fresh full scan; distributed activation and exact saved Share MISSING_EVIDENCE remain unchanged."
      : `Safety status disconnect verdict=${readString(report.verdict) || "missing"}, sourceLive=${sourceHead.length > 0 && sourceHead === productionCommit}, sourceCurrent=${sourceHead.length > 0 && isEvidenceCurrentForPaths(rootDir, sourceHead, SAFETY_STATUS_DISCONNECT_LEASE_PATHS)}, settlement=${contract.underlyingWorkSettlementPrecedesAbortRejection === true}/${contract.admissionLeaseHeldUntilUnderlyingSettlement === true}/${contract.thirdConcurrentRequestRejectedWhileTwoDisconnectedTasksSettle === true}, live=${readNumber(live.status)}/${readString(live.code) || "missing"}, noMutation=${noMutation}, rescan=${remaining.freshFullRepositoryRescanRequiredForScanClosure === true}, exactShare=${readString(remaining.exactSavedShareVerdict) || "missing"}.`,
    nextActions: pass
      ? ["Run a fresh Standard scan before reclassifying the sealed finding; keep durable activation and exact saved Share boundaries open."]
      : ["Restore source/live alignment, underlying-settlement lease retention, concurrency proof, no-mutation live proof, fresh-rescan requirement, and exact Share MISSING_EVIDENCE."],
  });
}

const WEATHER_FALLBACK_ERROR_REDACTION_PATHS = [
  "lib/weather.ts",
  "tests/upstream-integration-security.test.ts",
];

/** @param {string} rootDir @param {string} gateId @param {string[]} governedPaths */
function isCurrentSourceSecurityResidualCompatibilityCurrent(rootDir, gateId, governedPaths) {
  if (!["weather_fallback_error_redaction_security", "security_followup_remediation"].includes(gateId)) {
    return false;
  }
  const report = readJsonFile(rootDir, EVIDENCE_PATHS.currentSourceSecurityResidualRemediation);
  if (!isRecord(report)) return false;
  const residuals = Array.isArray(report.remediatedSourceResiduals)
    ? report.remediatedSourceResiduals.filter(isRecord)
    : [];
  const anchors = residuals.map((item) => readString(item.anchor)).sort();
  const verification = isRecord(report.verification) ? report.verification : {};
  const focused = isRecord(verification.focusedSecurity) ? verification.focusedSecurity : {};
  const adjacent = isRecord(verification.adjacentPublicAdmissionAndHarness)
    ? verification.adjacentPublicAdmissionAndHarness
    : {};
  const live = isRecord(report.liveVerification) ? report.liveVerification : {};
  const mutation = isRecord(report.mutationBoundary) ? report.mutationBoundary : {};
  const remaining = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  const sourceHead = readString(report.sourceHead);
  const productionCommit = readString(report.productionCommit);
  return readString(report.verdict) === "PASS_LIVE_DEPLOYED_SOURCE_SECURITY_RESIDUAL_REMEDIATION_RESCAN_PENDING"
    && sourceHead.length === 40
    && productionCommit.length === 40
    && isEvidenceCurrentForPaths(rootDir, sourceHead, governedPaths)
    && isGitAncestor(rootDir, productionCommit)
    && report.productionIncludesProductCommit === true
    && anchors.join(",") === "dns-toctou,provider-detail,xff-spoof"
    && residuals.every((item) => readString(item.status) === "PASS_CURRENT_SOURCE_LOCAL")
    && readNumber(focused.tests) === 33
    && readString(focused.status) === "PASS"
    && readNumber(adjacent.tests) === 141
    && readString(adjacent.status) === "PASS"
    && verification.typecheck === "PASS"
    && verification.productionBuild === "PASS"
    && readString(live.status) === "PASS_DEPLOYED_SOURCE_MARKER_ONLY"
    && live.behavioralProbeExecuted === false
    && mutation.dbMutationPerformed === false
    && mutation.providerDispatchCalled === false
    && mutation.shareSessionCreated === false
    && mutation.embeddingGenerated === false
    && mutation.vectorUploadPerformed === false
    && mutation.wikiPublished === false
    && mutation.exactTrustRegistryMutationPerformed === false
    && remaining.followUpSecurityScanRequired === true
    && remaining.securityCompleteClaimAllowed === false
    && readString(remaining.exactSavedShareVerdict) === "MISSING_EVIDENCE";
}

/**
 * @param {string} rootDir
 * @returns {GateResult}
 */
function evaluateWeatherFallbackErrorRedactionGate(rootDir) {
  const evidencePath = EVIDENCE_PATHS.weatherFallbackErrorRedaction;
  const report = readJsonFile(rootDir, evidencePath);
  if (!isRecord(report)) {
    return gateResult({
      id: "weather_fallback_error_redaction_security",
      label: "Weather fallback error redaction security",
      state: "missing",
      evidencePath,
      detail: "Weather fallback error redaction evidence is missing or invalid.",
      nextActions: ["Restore the no-mutation source/live receipt without inducing provider failure."],
    });
  }

  const finding = isRecord(report.finding) ? report.finding : {};
  const contract = isRecord(report.currentSourceContract) ? report.currentSourceContract : {};
  const verification = isRecord(report.verification) ? report.verification : {};
  const focused = isRecord(verification.focusedAndAdjacentTests) ? verification.focusedAndAdjacentTests : {};
  const typecheck = isRecord(verification.typecheck) ? verification.typecheck : {};
  const build = isRecord(verification.build) ? verification.build : {};
  const live = isRecord(report.liveProbe) ? report.liveProbe : {};
  const mutation = isRecord(report.mutationBoundary) ? report.mutationBoundary : {};
  const remaining = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  const sourceHead = readString(report.sourceHead);
  const productionCommit = readString(report.productionCommit);
  const sourceCurrent = isEvidenceCurrentForPaths(rootDir, sourceHead, WEATHER_FALLBACK_ERROR_REDACTION_PATHS)
    || isCurrentSourceSecurityResidualCompatibilityCurrent(
      rootDir,
      "weather_fallback_error_redaction_security",
      WEATHER_FALLBACK_ERROR_REDACTION_PATHS,
    );
  const noMutation = mutation.dbMutationPerformed === false
    && mutation.shareSessionCreated === false
    && mutation.readConfirmationInserted === false
    && mutation.providerDispatchCalled === false
    && mutation.vectorRuntimeCalled === false
    && mutation.wikiPublished === false
    && mutation.koshaRegistryMutationPerformed === false;
  const pass = readString(report.verdict) === "PASS_LIVE_PRODUCTION_WEATHER_FALLBACK_ERROR_REDACTION_SOURCE_REMEDIATED"
    && sourceHead === productionCommit
    && isGitAncestor(rootDir, sourceHead)
    && sourceCurrent
    && readString(finding.scanId) === "1411fb32-5c18-4d6a-b8ba-d52697757d8a"
    && readString(finding.findingId) === "csf_fdda99ed09c6fb65bc74caff"
    && readString(finding.slug) === "weather-fallback-error-exposure"
    && readString(finding.ruleId) === "information-exposure.upstream-errors"
    && readNumber(contract.providerFallbackBranchCount) === 8
    && contract.allProviderFallbackBranchesUseFixedPublicDetail === true
    && contract.rawProviderErrorsLoggedServerSide === true
    && contract.aggregateWeatherDetailOmitsRawProviderErrors === true
    && contract.signalDetailsOmitRawProviderErrors === true
    && contract.callerAbortStillPropagatesBeforeFallbackProjection === true
    && contract.privateUpstreamDiagnosticsRemainServerOnly === true
    && readNumber(focused.testFiles) === 3
    && readNumber(focused.testsPassed) === 16
    && readNumber(focused.testsFailed) === 0
    && readString(typecheck.status) === "PASS"
    && readString(build.status) === "PASS"
    && readNumber(build.staticPagesPassed) === 28
    && readNumber(build.staticPagesFailed) === 0
    && readNumber(live.status) === 503
    && readString(live.code) === "DISTRIBUTED_RATE_LIMIT_UNAVAILABLE"
    && readString(live.rateLimitHeader) === "distributed"
    && live.providerWorkReached === false
    && live.rawProviderErrorObserved === false
    && noMutation
    && remaining.findingSourceRemediated === true
    && remaining.freshFullRepositoryRescanRequiredForScanClosure === true
    && remaining.securityCompleteClaimAllowed === false
    && readString(remaining.distributedAdmissionActivation) === "OPERATOR_CONFIGURATION_REQUIRED"
    && readString(remaining.providerDispatchPersistence) === "APPROVAL_GATED"
    && readString(remaining.exactSavedShareVerdict) === "MISSING_EVIDENCE";

  return gateResult({
    id: "weather_fallback_error_redaction_security",
    label: "Weather fallback error redaction security",
    state: pass ? "notice" : "contradicted",
    evidencePath,
    detail: pass
      ? "Live production source now keeps raw failures from all eight weather provider fallbacks in server logs and exposes only fixed public details. Production remains fail-closed before provider work while durable admission is absent. The sealed finding still needs a fresh full scan; distributed activation and exact saved Share MISSING_EVIDENCE remain open."
      : `Weather redaction verdict=${readString(report.verdict) || "missing"}, sourceLive=${sourceHead.length > 0 && sourceHead === productionCommit}, sourceCurrent=${sourceCurrent}, redaction=${contract.allProviderFallbackBranchesUseFixedPublicDetail === true}/${contract.rawProviderErrorsLoggedServerSide === true}/${contract.aggregateWeatherDetailOmitsRawProviderErrors === true}, live=${readNumber(live.status)}/${readString(live.code) || "missing"}, noMutation=${noMutation}, rescan=${remaining.freshFullRepositoryRescanRequiredForScanClosure === true}, exactShare=${readString(remaining.exactSavedShareVerdict) || "missing"}.`,
    nextActions: pass
      ? ["Run a fresh Standard scan before reclassifying the sealed finding; keep distributed activation and exact saved Share boundaries open."]
      : ["Restore source/live alignment, all-branch public redaction, server-only diagnostics, no-mutation live proof, fresh-rescan requirement, and exact Share MISSING_EVIDENCE."],
  });
}

const HWPX_ARCHIVE_EXPANSION_SECURITY_PATHS = [
  "lib/hwpx-template.ts",
  "tests/document-export-localization.test.ts",
];

/**
 * @param {string} rootDir
 * @returns {GateResult}
 */
function evaluateHwpxArchiveExpansionSecurityGate(rootDir) {
  const evidencePath = EVIDENCE_PATHS.hwpxArchiveExpansionSecurity;
  const report = readJsonFile(rootDir, evidencePath);
  if (!isRecord(report)) {
    return gateResult({
      id: "hwpx_archive_expansion_security",
      label: "HWPX archive expansion security",
      state: "missing",
      evidencePath,
      detail: "HWPX archive expansion evidence is missing or invalid.",
      nextActions: ["Restore the no-mutation source/live archive-budget receipt."],
    });
  }

  const finding = isRecord(report.finding) ? report.finding : {};
  const contract = isRecord(report.currentSourceContract) ? report.currentSourceContract : {};
  const manifest = isRecord(report.committedTemplateManifest) ? report.committedTemplateManifest : {};
  const verification = isRecord(report.verification) ? report.verification : {};
  const focused = isRecord(verification.focusedAndAdjacentTests) ? verification.focusedAndAdjacentTests : {};
  const typecheck = isRecord(verification.typecheck) ? verification.typecheck : {};
  const build = isRecord(verification.build) ? verification.build : {};
  const live = isRecord(report.liveProbe) ? report.liveProbe : {};
  const mutation = isRecord(report.mutationBoundary) ? report.mutationBoundary : {};
  const remaining = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  const sourceHead = readString(report.sourceHead);
  const productionCommit = readString(report.productionCommit);
  const noMutation = mutation.dbMutationPerformed === false
    && mutation.shareSessionCreated === false
    && mutation.readConfirmationInserted === false
    && mutation.providerDispatchCalled === false
    && mutation.vectorRuntimeCalled === false
    && mutation.wikiPublished === false
    && mutation.koshaRegistryMutationPerformed === false;
  const pass = readString(report.verdict) === "PASS_LIVE_PRODUCTION_HWPX_ARCHIVE_EXPANSION_SOURCE_REMEDIATED"
    && sourceHead === productionCommit
    && isGitAncestor(rootDir, sourceHead)
    && isEvidenceCurrentForPaths(rootDir, sourceHead, HWPX_ARCHIVE_EXPANSION_SECURITY_PATHS)
    && readString(finding.scanId) === "1411fb32-5c18-4d6a-b8ba-d52697757d8a"
    && readString(finding.findingId) === "csf_f8f783170119f2531bcc3163"
    && readString(finding.slug) === "hwpx-archive-expansion"
    && readString(finding.ruleId) === "resource-exhaustion.hwpx-archive-expansion"
    && contract.centralDirectoryCheckedBeforeEntryData === true
    && contract.entryDataReadBeforeBudgetPass === false
    && contract.outputBufferBuiltBeforeBudgetPass === false
    && readNumber(contract.entryCountBudget) === 64
    && readNumber(contract.totalUncompressedBytesBudget) === 20 * 1024 * 1024
    && readNumber(contract.largestEntryUncompressedBytesBudget) === 10 * 1024 * 1024
    && readNumber(contract.estimatedPeakWorkingBytesBudget) === 40 * 1024 * 1024
    && contract.invalidOrUnsafeIntegerMetadataRejected === true
    && contract.archiveBudgetFailureUsesBoundedPublic413 === true
    && readNumber(manifest.templateCount) === 25
    && readNumber(manifest.availableTemplateCount) === 25
    && manifest.allTemplatesPassPreDecompressionBudget === true
    && readNumber(manifest.maximumEntryCount) === 32
    && readNumber(manifest.maximumTotalUncompressedBytes) === 15184195
    && readNumber(manifest.maximumLargestEntryUncompressedBytes) === 8532294
    && readNumber(focused.testFiles) === 4
    && readNumber(focused.testsPassed) === 37
    && readNumber(focused.testsFailed) === 0
    && readString(typecheck.status) === "PASS"
    && readString(build.status) === "PASS"
    && readNumber(build.staticPagesPassed) === 28
    && readNumber(build.staticPagesFailed) === 0
    && readNumber(live.status) === 503
    && readString(live.code) === "PUBLIC_EXPORT_CONCURRENCY_LIMIT"
    && readString(live.rateLimitHeader) === "instance"
    && live.archiveProcessingReached === false
    && noMutation
    && remaining.findingSourceRemediated === true
    && remaining.freshFullRepositoryRescanRequiredForScanClosure === true
    && remaining.securityCompleteClaimAllowed === false
    && readString(remaining.publicExportDistributedAdmission) === "OPEN_OPERATOR_CONFIGURATION"
    && readString(remaining.providerDispatchPersistence) === "APPROVAL_GATED"
    && readString(remaining.exactSavedShareVerdict) === "MISSING_EVIDENCE";

  return gateResult({
    id: "hwpx_archive_expansion_security",
    label: "HWPX archive expansion security",
    state: pass ? "notice" : "contradicted",
    evidencePath,
    detail: pass
      ? "Live production source now validates HWPX entry count, total uncompressed bytes, largest entry, and estimated peak working bytes before getData or toBuffer. All 25 committed templates pass the manifest. The sealed finding still needs a fresh full scan; public export distributed activation and exact saved Share MISSING_EVIDENCE remain open."
      : `HWPX archive verdict=${readString(report.verdict) || "missing"}, sourceLive=${sourceHead.length > 0 && sourceHead === productionCommit}, sourceCurrent=${sourceHead.length > 0 && isEvidenceCurrentForPaths(rootDir, sourceHead, HWPX_ARCHIVE_EXPANSION_SECURITY_PATHS)}, preflight=${contract.centralDirectoryCheckedBeforeEntryData === true}/${contract.entryDataReadBeforeBudgetPass === false}/${contract.outputBufferBuiltBeforeBudgetPass === false}, manifest=${readNumber(manifest.availableTemplateCount)}/${readNumber(manifest.templateCount)}, live=${readNumber(live.status)}/${readString(live.code) || "missing"}, noMutation=${noMutation}, rescan=${remaining.freshFullRepositoryRescanRequiredForScanClosure === true}, exactShare=${readString(remaining.exactSavedShareVerdict) || "missing"}.`,
    nextActions: pass
      ? ["Run a fresh Standard scan before reclassifying the sealed finding; keep distributed export activation and exact saved Share boundaries open."]
      : ["Restore source/live alignment, pre-decompression archive budgets, 25-template manifest proof, no-mutation live proof, fresh-rescan requirement, and exact Share MISSING_EVIDENCE."],
  });
}

const SECURITY_ACCIDENT_CASE_COMPATIBILITY_CHANGED_PATHS = [
  "lib/accident-cases.ts",
];

const SECURITY_ACCIDENT_CASE_COMPATIBILITY_GATE_IDS = [
  "security_followup_remediation",
];

/**
 * @param {string} rootDir
 * @param {string} gateId
 * @param {string[]} governedPaths
 */
function isSecurityAccidentCaseCompatibilityCurrent(rootDir, gateId, governedPaths) {
  const report = readJsonFile(rootDir, EVIDENCE_PATHS.securityAccidentCaseCompatibility);
  if (!isRecord(report) || !isRecord(report.governedPathCompatibility)) {
    return false;
  }
  const compatibility = report.governedPathCompatibility;
  const coveredGateIds = Array.isArray(compatibility.coveredGateIds)
    ? compatibility.coveredGateIds.map(readString)
    : [];
  const changedGovernedPaths = Array.isArray(compatibility.changedGovernedPaths)
    ? compatibility.changedGovernedPaths.map(readString)
    : [];
  const verification = isRecord(report.verification) ? report.verification : {};
  const focused = isRecord(verification.focusedAndAdjacentTests)
    ? verification.focusedAndAdjacentTests
    : {};
  const build = isRecord(verification.build) ? verification.build : {};
  const contracts = isRecord(report.securityContracts) ? report.securityContracts : {};
  const mutationBoundary = isRecord(report.mutationBoundary) ? report.mutationBoundary : {};
  const remainingBoundaries = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  const productCommit = readString(report.productCommit);
  const productionCommit = readString(report.productionCommit);
  return readString(report.schema) === "safeclaw-security-accident-case-compatibility/v1"
    && readString(report.verdict) === "PASS_LIVE_PRODUCTION_ACCIDENT_CASE_SECURITY_COMPATIBILITY"
    && readString(compatibility.verdict) === "PASS_LIVE_PRODUCTION_ACCIDENT_CASE_GOVERNED_PATH_COMPATIBILITY"
    && productCommit.length > 0
    && productCommit === productionCommit
    && productCommit === readString(compatibility.sourceHead)
    && productionCommit === readString(compatibility.productionCommit)
    && isGitAncestor(rootDir, productCommit)
    && isEvidenceCurrentForPaths(rootDir, productCommit, governedPaths)
    && coveredGateIds.length === SECURITY_ACCIDENT_CASE_COMPATIBILITY_GATE_IDS.length
    && SECURITY_ACCIDENT_CASE_COMPATIBILITY_GATE_IDS.every((id) => coveredGateIds.includes(id))
    && coveredGateIds.includes(gateId)
    && changedGovernedPaths.length === SECURITY_ACCIDENT_CASE_COMPATIBILITY_CHANGED_PATHS.length
    && SECURITY_ACCIDENT_CASE_COMPATIBILITY_CHANGED_PATHS.every((item) => changedGovernedPaths.includes(item))
    && readNumber(focused.files) === 6
    && readNumber(focused.tests) === 146
    && readNumber(focused.failed) === 0
    && readString(focused.status) === "PASS"
    && verification.typecheck === "PASS"
    && readString(build.status) === "PASS"
    && readNumber(build.staticPages) === 28
    && contracts.callerAbortPropagated === true
    && contracts.accidentBranchesReceiveCallerSignal === true
    && contracts.oversizedKoshaResponseFallsBackWithinBudget === true
    && contracts.privateProxyAndRelayTokenRejected === true
    && contracts.redirectsRemainManual === true
    && contracts.liveScenarioFallbackIsolationPassed === true
    && readNumber(contracts.liveScenarioCount) === 5
    && readNumber(contracts.unrelatedIndustryCaseCount) === 0
    && mutationBoundary.dbMutationPerformed === false
    && mutationBoundary.providerDispatchPerformed === false
    && mutationBoundary.shareSessionCreated === false
    && mutationBoundary.vectorOrEmbeddingMutationPerformed === false
    && mutationBoundary.wikiPublicationPerformed === false
    && mutationBoundary.koshaRegistryMutationPerformed === false
    && remainingBoundaries.originalBaselineRewritten === false
    && remainingBoundaries.securityCompleteClaimed === false
    && readString(remainingBoundaries.exactSavedShareVerdict) === "MISSING_EVIDENCE";
}

/**
 * @param {string} rootDir
 * @returns {GateResult}
 */
function evaluateHermesReviewEventFactTraceabilityGate(rootDir) {
  const evidencePath = EVIDENCE_PATHS.hermesReviewEventFactTraceability;
  const report = readJsonFile(rootDir, evidencePath);
  if (!isRecord(report)) {
    return gateResult({
      id: "hermes_review_event_fact_traceability",
      label: "Hermes review event fact traceability",
      state: "missing",
      evidencePath,
      detail: "Hermes review event-fact traceability evidence is missing.",
      nextActions: ["Run the bounded authenticated event-fact probe against local and live production."],
    });
  }

  const beforeLive = isRecord(report.beforeLive) ? report.beforeLive : {};
  const local = isRecord(report.local) ? report.local : {};
  const afterLive = isRecord(report.afterLive) ? report.afterLive : {};
  const contract = isRecord(report.eventFactsContract) ? report.eventFactsContract : {};
  const mutation = isRecord(report.mutationBoundary) ? report.mutationBoundary : {};
  const security = isRecord(report.securityBoundary) ? report.securityBoundary : {};
  const remaining = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  const productCommit = readString(report.productCommit);
  const productionCommit = readString(report.productionCommit);
  const noMutation = mutation.dbMutationPerformed === false
    && mutation.providerDispatchCalled === false
    && mutation.shareSessionCreated === false
    && mutation.ontologyPublicationPerformed === false
    && mutation.vectorOrEmbeddingMutationPerformed === false
    && mutation.wikiPublicationPerformed === false
    && mutation.koshaRegistryMutationPerformed === false;
  const pass = report.verdict === "PASS_LIVE_PRODUCTION_HERMES_REVIEW_EVENT_FACT_TRACEABILITY"
    && productCommit !== ""
    && productionCommit !== ""
    && isGitAncestor(rootDir, productCommit)
    && isGitAncestor(rootDir, productionCommit)
    && beforeLive.verdict === "RED_HERMES_REVIEW_EVENT_FACTS"
    && beforeLive.viewportCount === 8
    && beforeLive.passedCount === 0
    && beforeLive.failedCount === 8
    && beforeLive.visibleFactCount === 0
    && beforeLive.boundFactCount === 0
    && local.verdict === "PASS_CURRENT_SOURCE_LOCAL_HERMES_REVIEW_EVENT_FACTS"
    && local.viewportCount === 8
    && local.passedCount === 8
    && local.failedCount === 0
    && afterLive.verdict === "PASS_LIVE_PRODUCTION_HERMES_REVIEW_EVENT_FACTS"
    && afterLive.viewportCount === 8
    && afterLive.passedCount === 8
    && afterLive.failedCount === 0
    && afterLive.productionAligned === true
    && afterLive.browserErrorCount === 0
    && contract.explicitReviewFactsOnly === true
    && contract.expectedFactCount === 2
    && contract.panelCount === 1
    && contract.visibleFactCount === 2
    && contract.boundFactCount === 2
    && contract.evidenceRowCount === 1
    && contract.orphanFactCount === 0
    && contract.insideCandidatePane === true
    && contract.candidateBodyMarkerDuplicated === false
    && contract.privateEventTextExposed === false
    && contract.humanVerificationRequired === true
    && contract.beforeVisibleFactCount === 0
    && contract.beforeBoundFactCount === 0
    && contract.humanReviewCompleted === false
    && contract.machineEvidenceReplacesHumanReview === false
    && contract.publicationState === "unpublished"
    && noMutation
    && security.immutableOriginal18FindingBaselinePreserved === true
    && remaining.exactSavedShareVerdict === "MISSING_EVIDENCE"
    && remaining.llmWikiPublication === "APPROVAL_GATED"
    && remaining.supabaseRlsLaunchIsolation === "APPROVAL_GATED"
    && remaining.providerDispatchPersistence === "APPROVAL_GATED";

  return gateResult({
    id: "hermes_review_event_fact_traceability",
    label: "Hermes review event fact traceability",
    state: pass ? "proven" : "contradicted",
    evidencePath,
    detail: pass
      ? "Live Hermes review event-fact traceability moves from 0/8 to 8/8 and binds two allowlisted event facts to one exact evidence row with zero orphan facts and no private event text. This is reviewer traceability only, not complete hazard-to-control-to-document-to-evidence trace closure. Human verification remains required, publication stays unpublished, the immutable 18-finding baseline is preserved, exact saved Share remains MISSING_EVIDENCE, and Wiki/RLS/provider persistence remain APPROVAL_GATED."
      : `Hermes event-fact traceability is contradicted: verdict=${readString(report.verdict) || "missing"}, before=${readString(beforeLive.verdict) || "missing"}, local=${readString(local.verdict) || "missing"}, live=${readString(afterLive.verdict) || "missing"}, bound=${String(contract.boundFactCount)}, orphan=${String(contract.orphanFactCount)}, private=${String(contract.privateEventTextExposed)}, exactShare=${readString(remaining.exactSavedShareVerdict) || "missing"}.`,
    nextActions: pass ? [] : ["Restore exact event-fact binding, privacy, no-mutation, human-review, and approval boundaries, then rerun local and live probes."],
  });
}

/**
 * @param {string} rootDir
 * @returns {GateResult}
 */
function evaluateHermesReviewTraceBlocksGate(rootDir) {
  const evidencePath = EVIDENCE_PATHS.hermesReviewTraceBlocks;
  const report = readJsonFile(rootDir, evidencePath);
  if (!isRecord(report)) {
    return gateResult({
      id: "hermes_review_trace_blocks",
      label: "Hermes review hazard-to-evidence trace blocks",
      state: "missing",
      evidencePath,
      detail: "Hermes review hazard-to-evidence trace-block evidence is missing.",
      nextActions: ["Run the bounded authenticated trace-block probe against local and live production."],
    });
  }

  const beforeLive = isRecord(report.beforeLive) ? report.beforeLive : {};
  const local = isRecord(report.local) ? report.local : {};
  const afterLive = isRecord(report.afterLive) ? report.afterLive : {};
  const contract = isRecord(report.traceabilityContract) ? report.traceabilityContract : {};
  const mutation = isRecord(report.mutationBoundary) ? report.mutationBoundary : {};
  const security = isRecord(report.securityBoundary) ? report.securityBoundary : {};
  const remaining = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  const productCommit = readString(report.productCommit);
  const productionCommit = readString(report.productionCommit);
  const noMutation = mutation.dbMutationPerformed === false
    && mutation.providerDispatchCalled === false
    && mutation.shareSessionCreated === false
    && mutation.ontologyPublicationPerformed === false
    && mutation.vectorOrEmbeddingMutationPerformed === false
    && mutation.wikiPublicationPerformed === false
    && mutation.koshaRegistryMutationPerformed === false;
  const pass = report.verdict === "PASS_LIVE_PRODUCTION_HERMES_REVIEW_TRACE_BLOCKS"
    && productCommit !== ""
    && productionCommit !== ""
    && isGitAncestor(rootDir, productCommit)
    && isGitAncestor(rootDir, productionCommit)
    && beforeLive.verdict === "RED_HERMES_REVIEW_TRACE_BLOCKS"
    && beforeLive.viewportCount === 8
    && beforeLive.passedCount === 0
    && beforeLive.failedCount === 8
    && beforeLive.panelCount === 0
    && beforeLive.resolvedTraceCount === 0
    && local.verdict === "PASS_CURRENT_SOURCE_LOCAL_HERMES_REVIEW_TRACE_BLOCKS"
    && local.viewportCount === 8
    && local.passedCount === 8
    && local.failedCount === 0
    && afterLive.verdict === "PASS_LIVE_PRODUCTION_HERMES_REVIEW_TRACE_BLOCKS"
    && afterLive.viewportCount === 8
    && afterLive.passedCount === 8
    && afterLive.failedCount === 0
    && afterLive.productionAligned === true
    && afterLive.browserErrorCount === 0
    && contract.expectedTraceCount === 1
    && contract.panelCount === 1
    && contract.resolvedTraceCount === 1
    && contract.unresolvedTraceCount === 0
    && contract.hazardBound === true
    && contract.controlsBound === true
    && contract.primaryDocumentsBound === true
    && contract.evidenceRowsBound === true
    && contract.insideCandidatePane === true
    && contract.approvalFailsClosedWhenIncomplete === true
    && contract.humanReviewCompleted === false
    && contract.publicationState === "unpublished"
    && contract.beforePanelCount === 0
    && contract.beforeResolvedTraceCount === 0
    && contract.scopedFixtureHazardCount === 1
    && contract.allHazardsClosed === false
    && contract.allDocumentsClosed === false
    && contract.machineEvidenceReplacesHumanReview === false
    && noMutation
    && security.immutableOriginal18FindingBaselinePreserved === true
    && remaining.exactSavedShareVerdict === "MISSING_EVIDENCE"
    && remaining.llmWikiPublication === "APPROVAL_GATED"
    && remaining.supabaseRlsLaunchIsolation === "APPROVAL_GATED"
    && remaining.providerDispatchPersistence === "APPROVAL_GATED";

  return gateResult({
    id: "hermes_review_trace_blocks",
    label: "Hermes review hazard-to-evidence trace blocks",
    state: pass ? "proven" : "contradicted",
    evidencePath,
    detail: pass
      ? "Live Hermes review trace blocks move from 0/8 to 8/8 and bind one scoped hazard to canonical controls, primary document targets, and an exact reviewer evidence row. Approval fails closed for incomplete traces. This is not all-hazard or all-document closure; human review remains incomplete, publication stays unpublished, the immutable 18-finding baseline is preserved, exact saved Share remains MISSING_EVIDENCE, and Wiki/RLS/provider persistence remain APPROVAL_GATED."
      : `Hermes review trace blocks are contradicted: verdict=${readString(report.verdict) || "missing"}, before=${readString(beforeLive.verdict) || "missing"}, local=${readString(local.verdict) || "missing"}, live=${readString(afterLive.verdict) || "missing"}, resolved=${String(contract.resolvedTraceCount)}, unresolved=${String(contract.unresolvedTraceCount)}, allHazards=${String(contract.allHazardsClosed)}, exactShare=${readString(remaining.exactSavedShareVerdict) || "missing"}.`,
    nextActions: pass ? [] : ["Restore complete scoped trace binding, approval fail-closed behavior, no-mutation, human-review, and approval boundaries, then rerun local and live probes."],
  });
}

/** @param {string} rootDir */
function evaluateHermesReviewTraceMatrixGate(rootDir) {
  const evidencePath = EVIDENCE_PATHS.hermesReviewTraceMatrix;
  const report = readJsonFile(rootDir, evidencePath);
  if (!isRecord(report)) {
    return gateResult({
      id: "hermes_review_trace_matrix",
      label: "Hermes canonical hazard trace matrix",
      state: "contradicted",
      evidencePath,
      detail: "Hermes canonical hazard trace matrix evidence is missing or invalid.",
      nextActions: ["Run the canonical 8-hazard trace matrix against current source and live production."],
    });
  }

  const beforeLive = isRecord(report.beforeLive) ? report.beforeLive : {};
  const local = isRecord(report.local) ? report.local : {};
  const afterLive = isRecord(report.afterLive) ? report.afterLive : {};
  const contract = isRecord(report.traceabilityContract) ? report.traceabilityContract : {};
  const mutation = isRecord(report.mutationBoundary) ? report.mutationBoundary : {};
  const security = isRecord(report.securityBoundary) ? report.securityBoundary : {};
  const remaining = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  const productCommit = readString(report.productCommit);
  const productionCommit = readString(report.productionCommit);
  const beforeMissingControls = Array.isArray(beforeLive.missingControls) ? beforeLive.missingControls : [];
  const beforeMissingDocuments = Array.isArray(beforeLive.missingPrimaryDocuments) ? beforeLive.missingPrimaryDocuments : [];
  const missingControls = Array.isArray(contract.missingControls) ? contract.missingControls : [];
  const missingDocuments = Array.isArray(contract.missingPrimaryDocuments) ? contract.missingPrimaryDocuments : [];
  const noMutation = mutation.dbMutationPerformed === false
    && mutation.providerDispatchCalled === false
    && mutation.shareSessionCreated === false
    && mutation.ontologyPublicationPerformed === false
    && mutation.vectorOrEmbeddingMutationPerformed === false
    && mutation.wikiPublicationPerformed === false
    && mutation.koshaRegistryMutationPerformed === false;
  const pass = report.verdict === "PASS_LIVE_PRODUCTION_HERMES_REVIEW_TRACE_MATRIX"
    && productCommit !== ""
    && productionCommit !== ""
    && isGitAncestor(rootDir, productCommit)
    && isGitAncestor(rootDir, productionCommit)
    && beforeLive.verdict === "RED_HERMES_REVIEW_TRACE_MATRIX"
    && beforeLive.viewportCount === 8
    && beforeLive.passedCount === 0
    && beforeLive.failedCount === 8
    && beforeLive.canonicalMatrixComplete === false
    && beforeMissingControls.length === 1
    && beforeMissingControls[0] === "사진·증빙 보관"
    && beforeMissingDocuments.length === 1
    && beforeMissingDocuments[0] === "안전보건교육"
    && local.verdict === "PASS_CURRENT_SOURCE_LOCAL_HERMES_REVIEW_TRACE_MATRIX"
    && local.viewportCount === 8
    && local.passedCount === 8
    && local.failedCount === 0
    && afterLive.verdict === "PASS_LIVE_PRODUCTION_HERMES_REVIEW_TRACE_MATRIX"
    && afterLive.viewportCount === 8
    && afterLive.passedCount === 8
    && afterLive.failedCount === 0
    && afterLive.productionAligned === true
    && afterLive.browserErrorCount === 0
    && contract.expectedTraceCount === 8
    && contract.panelCount === 1
    && contract.resolvedTraceCount === 8
    && contract.unresolvedTraceCount === 0
    && contract.canonicalHazardCount === 8
    && contract.canonicalControlLinkCount === 33
    && contract.canonicalDocumentLinkCount === 33
    && contract.canonicalMatrixComplete === true
    && contract.traceListInternalScroll === false
    && contract.traceScrollOwner === "candidate-pane"
    && contract.candidatePaneInternalScroll === true
    && contract.traceScreenshotContextVisible === true
    && missingControls.length === 0
    && missingDocuments.length === 0
    && contract.hazardBound === true
    && contract.controlsBound === true
    && contract.primaryDocumentsBound === true
    && contract.evidenceRowsBound === true
    && contract.insideCandidatePane === true
    && contract.approvalFailsClosedWhenIncomplete === true
    && contract.humanReviewCompleted === false
    && contract.publicationState === "unpublished"
    && contract.beforeCanonicalMatrixComplete === false
    && contract.allHazardsClosed === true
    && contract.allCanonicalMappingsClosed === true
    && contract.machineEvidenceReplacesHumanReview === false
    && noMutation
    && security.immutableOriginal18FindingBaselinePreserved === true
    && remaining.exactSavedShareVerdict === "MISSING_EVIDENCE"
    && remaining.llmWikiPublication === "APPROVAL_GATED"
    && remaining.supabaseRlsLaunchIsolation === "APPROVAL_GATED"
    && remaining.providerDispatchPersistence === "APPROVAL_GATED";

  return gateResult({
    id: "hermes_review_trace_matrix",
    label: "Hermes canonical hazard trace matrix",
    state: pass ? "proven" : "contradicted",
    evidencePath,
    detail: pass
      ? "Live Hermes review trace matrix closes the canonical 8 hazards, 33 controls, and 33 primary-document bindings with exact evidence rows. The candidate pane is the single bounded scroll owner; the trace list remains fully expanded inside it, avoiding nested-scroll context loss. The prior 32/33 truncation remains preserved as RED evidence. Human review remains incomplete, publication stays unpublished, exact saved Share remains MISSING_EVIDENCE, and Wiki/RLS/provider persistence remain APPROVAL_GATED."
      : `Hermes trace matrix is contradicted: verdict=${readString(report.verdict) || "missing"}, before=${readString(beforeLive.verdict) || "missing"}, local=${readString(local.verdict) || "missing"}, live=${readString(afterLive.verdict) || "missing"}, hazards=${String(contract.canonicalHazardCount)}, controls=${String(contract.canonicalControlLinkCount)}, documents=${String(contract.canonicalDocumentLinkCount)}, complete=${String(contract.canonicalMatrixComplete)}, traceScroll=${String(contract.traceListInternalScroll)}/${readString(contract.traceScrollOwner) || "missing"}/${String(contract.candidatePaneInternalScroll)}, screenshotContext=${String(contract.traceScreenshotContextVisible)}, exactShare=${readString(remaining.exactSavedShareVerdict) || "missing"}.`,
    nextActions: pass ? [] : ["Restore all 8 canonical hazards and every 33/33 control and document binding without weakening human-review or approval boundaries, then rerun local and live probes."],
  });
}

/**
 * @param {string} rootDir
 * @param {string} gateId
 * @param {string[]} governedPaths
 */
function isPublicProviderAdmissionCompatibilityCurrent(rootDir, gateId, governedPaths) {
  const report = readJsonFile(rootDir, EVIDENCE_PATHS.publicProviderAdmission);
  if (!isRecord(report) || !isRecord(report.governedPathCompatibility)) {
    return false;
  }
  const compatibility = report.governedPathCompatibility;
  const tests = isRecord(compatibility.focusedVitest) ? compatibility.focusedVitest : {};
  const coveredGateIds = Array.isArray(compatibility.coveredGateIds)
    ? compatibility.coveredGateIds.map(readString)
    : [];
  const changedGovernedPaths = Array.isArray(compatibility.changedGovernedPaths)
    ? compatibility.changedGovernedPaths.map(readString)
    : [];
  const sourceHead = readString(compatibility.sourceHead);
  return readString(compatibility.verdict) === "PASS_LIVE_PRODUCTION_GOVERNED_PATH_COMPATIBILITY"
    && sourceHead.length > 0
    && sourceHead === readString(compatibility.productionCommit)
    && sourceHead === readString(report.productionBuild?.commitSha)
    && isGitAncestor(rootDir, sourceHead)
    && (isEvidenceCurrentForPaths(rootDir, sourceHead, governedPaths)
      || isSecurityResourceRemediationCompatibilityCurrent(rootDir, gateId, governedPaths))
    && coveredGateIds.length === PUBLIC_PROVIDER_ADMISSION_COMPATIBILITY_GATE_IDS.length
    && PUBLIC_PROVIDER_ADMISSION_COMPATIBILITY_GATE_IDS.every((id) => coveredGateIds.includes(id))
    && coveredGateIds.includes(gateId)
    && changedGovernedPaths.length === PUBLIC_PROVIDER_ADMISSION_CHANGED_PATHS.length
    && PUBLIC_PROVIDER_ADMISSION_CHANGED_PATHS.every((pathName) => changedGovernedPaths.includes(pathName))
    && readNumber(tests.files) === 23
    && readNumber(tests.tests) === 215
    && readNumber(tests.failed) === 0
    && compatibility.originalSecurityBaselinesRewritten === false
    && readString(compatibility.followUpSecurityScan) === "REQUIRED"
    && compatibility.noMutation === true
    && readString(compatibility.exactSavedShareVerdict) === "MISSING_EVIDENCE";
}

/**
 * @param {string} rootDir
 * @param {string} gateId
 * @param {string[]} governedPaths
 */
function isCurrentSecurityRemediationCompatibilityCurrent(rootDir, gateId, governedPaths) {
  const report = readJsonFile(rootDir, EVIDENCE_PATHS.currentSecurityRemediationLedger);
  if (!isRecord(report) || !isRecord(report.governedPathCompatibility)) {
    return false;
  }
  const compatibility = report.governedPathCompatibility;
  const verification = isRecord(compatibility.verification) ? compatibility.verification : {};
  const baseline = isRecord(verification.baseline) ? verification.baseline : {};
  const delta = isRecord(verification.delta) ? verification.delta : {};
  const coveredGateIds = Array.isArray(compatibility.coveredGateIds)
    ? compatibility.coveredGateIds.map(readString)
    : [];
  const sourceHead = readString(compatibility.sourceHead);
  return readString(compatibility.verdict) === "PASS_LIVE_DEPLOYED_SOURCE_CURRENT_SECURITY_GOVERNED_PATH_COMPATIBILITY"
    && sourceHead.length > 0
    && sourceHead === readString(compatibility.productionCommit)
    && sourceHead === readString(report.productionBuild?.commitSha)
    && isGitAncestor(rootDir, sourceHead)
    && isEvidenceCurrentForPaths(rootDir, sourceHead, governedPaths)
    && coveredGateIds.length === 7
    && coveredGateIds.includes(gateId)
    && readString(verification.strategy) === "baseline_plus_governed_delta"
    && readString(baseline.sourceHead).length > 0
    && isGitAncestor(rootDir, readString(baseline.sourceHead))
    && readNumber(baseline.files) === 27
    && readNumber(baseline.tests) === 269
    && readNumber(baseline.failed) === 0
    && readString(baseline.status) === "PASS"
    && readString(delta.sourceHead) === sourceHead
    && Array.isArray(delta.changedProductPaths)
    && delta.changedProductPaths.length === 1
    && delta.changedProductPaths[0] === "lib/openclaw-broker-route.ts"
    && Array.isArray(delta.changedTestPaths)
    && delta.changedTestPaths.length === 1
    && delta.changedTestPaths[0] === "tests/claw-chat-route.test.ts"
    && readNumber(delta.files) === 5
    && readNumber(delta.tests) === 42
    && readNumber(delta.failed) === 0
    && readString(delta.typecheck) === "PASS"
    && readString(delta.build) === "PASS"
    && readString(delta.status) === "PASS"
    && readString(verification.status) === "PASS"
    && compatibility.originalSecurityBaselinesRewritten === false
    && compatibility.noMutation === true
    && readString(compatibility.exactSavedShareVerdict) === "MISSING_EVIDENCE";
}

const POST_REMEDIATION_SECURITY_CHANGED_PATHS = [
  "app/api/workflow/dispatch/route.ts",
  "app/api/safety-reference/status/route.ts",
  "lib/public-work-budget.ts",
  "lib/work24.ts",
];

const POST_REMEDIATION_SECURITY_COMPATIBILITY_GATE_IDS = [
  "public_json_request_body_budget",
  "public_provider_admission",
  "security_followup_remediation",
];

/**
 * @param {string} rootDir
 * @param {string} gateId
 * @param {string[]} governedPaths
 */
function isPostRemediationSecuritySourceCompatibilityCurrent(rootDir, gateId, governedPaths) {
  const report = readJsonFile(rootDir, EVIDENCE_PATHS.postRemediationSecuritySourceClosure);
  if (!isRecord(report) || !isRecord(report.governedPathCompatibility)) {
    return false;
  }
  const compatibility = report.governedPathCompatibility;
  const verification = isRecord(report.verification) ? report.verification : {};
  const focused = isRecord(verification.focusedAndAdjacentTests)
    ? verification.focusedAndAdjacentTests
    : {};
  const build = isRecord(verification.build) ? verification.build : {};
  const mutation = isRecord(report.mutationBoundary) ? report.mutationBoundary : {};
  const remaining = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  const remediation = isRecord(report.remediation) ? report.remediation : {};
  const coveredGateIds = Array.isArray(compatibility.coveredGateIds)
    ? compatibility.coveredGateIds.map(readString)
    : [];
  const changedGovernedPaths = Array.isArray(compatibility.changedGovernedPaths)
    ? compatibility.changedGovernedPaths.map(readString)
    : [];
  const productCommits = Array.isArray(remediation.productCommits)
    ? remediation.productCommits.map(readString)
    : [];
  const sourceHead = readString(report.sourceHead);
  const productionCommit = readString(report.productionCommit);
  const noMutation = mutation.dbMutationPerformed === false
    && mutation.providerDispatchCalled === false
    && mutation.shareSessionCreated === false
    && mutation.embeddingOrVectorMutationPerformed === false
    && mutation.wikiPublicationPerformed === false
    && mutation.koshaRegistryMutationPerformed === false;
  return readString(report.verdict) === "PASS_LIVE_PRODUCTION_TWO_SECURITY_REMEDIATIONS_ONE_DISTRIBUTED_RESIDUAL_RESCAN_PENDING"
    && readString(compatibility.verdict) === "PASS_LIVE_PRODUCTION_POST_REMEDIATION_GOVERNED_PATH_COMPATIBILITY"
    && sourceHead.length > 0
    && productionCommit.length > 0
    && isGitAncestor(rootDir, sourceHead)
    && isGitAncestor(rootDir, productionCommit)
    && isEvidenceCurrentForPaths(rootDir, sourceHead, governedPaths)
    && coveredGateIds.length === POST_REMEDIATION_SECURITY_COMPATIBILITY_GATE_IDS.length
    && POST_REMEDIATION_SECURITY_COMPATIBILITY_GATE_IDS.every((id) => coveredGateIds.includes(id))
    && coveredGateIds.includes(gateId)
    && changedGovernedPaths.length === POST_REMEDIATION_SECURITY_CHANGED_PATHS.length
    && POST_REMEDIATION_SECURITY_CHANGED_PATHS.every((item) => changedGovernedPaths.includes(item))
    && productCommits.length === 3
    && productCommits.includes("aa90789128023363263c18f89a9def85b5dc0c19")
    && productCommits.includes("0647d70259e82028ca5e66a1852b011ff77c9c28")
    && productCommits.includes("b026de1e82a936b03f04bbbcb3ae96f330afa832")
    && readNumber(focused.files) === 8
    && readNumber(focused.tests) === 105
    && readNumber(focused.failed) === 0
    && readString(focused.status) === "PASS"
    && verification.typecheck === "PASS"
    && readString(build.status) === "PASS"
    && readNumber(build.staticPages) === 28
    && compatibility.originalSecurityBaselinesRewritten === false
    && compatibility.noMutation === true
    && noMutation
    && remaining.approvalGatedBoundariesPreserved === true
    && remaining.securityCompleteClaimAllowed === false
    && readString(remaining.exactSavedShareVerdict) === "MISSING_EVIDENCE";
}

const LEARNING_EXPORT_RENDERER_SECURITY_PATHS = [
  "lib/workpack-learning-export.ts",
  "app/api/workpacks/[id]/learning-export/route.ts",
];

const PUBLIC_GENERATION_ADMISSION_SECURITY_PATHS = [
  "app/api/knowledge/regenerate/route.ts",
  "app/api/workpack/remediate/route.ts",
  "lib/rate-limit.ts",
];

const SECURITY_FOLLOWUP_REMEDIATION_PATHS = [
  "lib/accident-cases.ts",
  "lib/ai-deliverables.ts",
  "lib/ai.ts",
  "lib/anthropic-client.ts",
  "lib/public-distributed-rate-limit.ts",
  "lib/safety-reference-catalog.ts",
  "lib/search.ts",
  "lib/vertex/client.ts",
  "lib/weather.ts",
  "lib/work24.ts",
  "lib/kosha-education.ts",
  "lib/kosha.ts",
  "lib/kosha-openapi.ts",
  "package.json",
  "package-lock.json",
];

/**
 * @param {string} rootDir
 * @returns {GateResult}
 */
function evaluateSecurityFollowupRemediationGate(rootDir) {
  const evidencePath = EVIDENCE_PATHS.securityFollowupRemediation;
  const report = readJsonFile(rootDir, evidencePath);
  if (!isRecord(report)) {
    return gateResult({
      id: "security_followup_remediation",
      label: "Security follow-up remediation",
      state: "missing",
      evidencePath,
      detail: "Security follow-up remediation evidence is missing or invalid.",
      nextActions: ["Restore the deployed three-finding remediation evidence without rewriting the immutable scan baseline."],
    });
  }

  const scan = isRecord(report.securityScan) ? report.securityScan : {};
  const severityCounts = isRecord(scan.severityCounts) ? scan.severityCounts : {};
  const verification = isRecord(report.verification) ? report.verification : {};
  const focused = isRecord(verification.focusedVitest) ? verification.focusedVitest : {};
  const build = isRecord(verification.build) ? verification.build : {};
  const deployment = isRecord(report.deployment) ? report.deployment : {};
  const currentPathCompatibility = isRecord(report.currentPathCompatibility)
    ? report.currentPathCompatibility
    : null;
  const latestPathCompatibility = isRecord(report.latestPathCompatibility)
    ? report.latestPathCompatibility
    : null;
  const boundaries = isRecord(report.boundaries) ? report.boundaries : {};
  const sourceHead = readString(report.sourceHead);
  const remediations = Array.isArray(report.remediations) ? report.remediations.filter(isRecord) : [];
  const expectedRemediations = [
    "ask-descendant-cancellation",
    "distributed-export-concurrency",
    "safety-reference-body-deadline",
  ];
  const noMutation = boundaries.dbMutationPerformed === false
    && boundaries.providerDispatchCalled === false
    && boundaries.shareSessionCreated === false
    && boundaries.vectorRuntimeMutationPerformed === false
    && boundaries.wikiPublicationPerformed === false
    && boundaries.koshaRegistryMutationPerformed === false;
  const compatibilitySourceHead = currentPathCompatibility
    ? readString(currentPathCompatibility.sourceHead)
    : sourceHead;
  const compatibilityProductionCommit = currentPathCompatibility
    ? readString(currentPathCompatibility.productionCommit)
    : readString(deployment.productionCommit);
  const compatibilityFocused = currentPathCompatibility && isRecord(currentPathCompatibility.focusedVitest)
    ? currentPathCompatibility.focusedVitest
    : focused;
  const compatibilityPass = currentPathCompatibility === null || (
    readString(currentPathCompatibility.verdict) === "PASS_LIVE_PRODUCTION_CURRENT_PATH_COMPATIBILITY"
    && compatibilitySourceHead.length > 0
    && compatibilitySourceHead === compatibilityProductionCommit
    && Array.isArray(currentPathCompatibility.changedGovernedPaths)
    && currentPathCompatibility.changedGovernedPaths.length === 2
    && currentPathCompatibility.changedGovernedPaths.includes("lib/ai.ts")
    && currentPathCompatibility.changedGovernedPaths.includes("lib/public-distributed-rate-limit.ts")
    && readNumber(compatibilityFocused.files) === 12
    && readNumber(compatibilityFocused.tests) === 147
    && readNumber(compatibilityFocused.failed) === 0
    && currentPathCompatibility.noMutation === true
    && readString(currentPathCompatibility.exactSavedShareVerdict) === "MISSING_EVIDENCE"
    && currentPathCompatibility.originalBaselineRewritten === false
  );
  const latestCompatibilityFocused = latestPathCompatibility && isRecord(latestPathCompatibility.focusedVitest)
    ? latestPathCompatibility.focusedVitest
    : {};
  const latestCompatibilityCi = latestPathCompatibility && isRecord(latestPathCompatibility.fullCi)
    ? latestPathCompatibility.fullCi
    : {};
  const latestCompatibilitySourceHead = latestPathCompatibility
    ? readString(latestPathCompatibility.sourceHead)
    : "";
  const latestCompatibilityPass = latestPathCompatibility === null || (
    readString(latestPathCompatibility.verdict) === "PASS_LIVE_PRODUCTION_CURRENT_SEARCH_KOSHA_COMPATIBILITY"
    && latestCompatibilitySourceHead.length > 0
    && latestCompatibilitySourceHead === readString(latestPathCompatibility.productionCommit)
    && Array.isArray(latestPathCompatibility.changedGovernedPaths)
    && latestPathCompatibility.changedGovernedPaths.length === 1
    && latestPathCompatibility.changedGovernedPaths[0] === "lib/search.ts"
    && readNumber(latestCompatibilityFocused.files) === 14
    && readNumber(latestCompatibilityFocused.tests) === 245
    && readNumber(latestCompatibilityFocused.failed) === 0
    && readNumber(latestCompatibilityCi.filesPassed) === 249
    && readNumber(latestCompatibilityCi.testsPassed) === 2927
    && readNumber(latestCompatibilityCi.failed) === 0
    && latestPathCompatibility.noMutation === true
    && readString(latestPathCompatibility.exactSavedShareVerdict) === "MISSING_EVIDENCE"
    && latestPathCompatibility.originalBaselineRewritten === false
  );
  const latestCompatibilityCurrent = latestPathCompatibility !== null
    && latestCompatibilityPass
    && isEvidenceCurrentForPaths(rootDir, latestCompatibilitySourceHead, SECURITY_FOLLOWUP_REMEDIATION_PATHS);
  const accidentCompatibilityCurrent = isSecurityAccidentCaseCompatibilityCurrent(
    rootDir,
    "security_followup_remediation",
    SECURITY_FOLLOWUP_REMEDIATION_PATHS,
  );
  const productPathsCurrent = latestCompatibilityCurrent
    || isEvidenceCurrentForPaths(rootDir, compatibilitySourceHead, SECURITY_FOLLOWUP_REMEDIATION_PATHS)
    || isPublicProviderAdmissionCompatibilityCurrent(rootDir, "security_followup_remediation", SECURITY_FOLLOWUP_REMEDIATION_PATHS)
    || isSecurityUpstreamTransportCompatibilityCurrent(rootDir, "security_followup_remediation", SECURITY_FOLLOWUP_REMEDIATION_PATHS)
    || accidentCompatibilityCurrent
    || isSecuritySafetyReferenceSurfaceCompatibilityCurrent(rootDir, "security_followup_remediation", SECURITY_FOLLOWUP_REMEDIATION_PATHS)
    || isCurrentSecurityRemediationCompatibilityCurrent(rootDir, "security_followup_remediation", SECURITY_FOLLOWUP_REMEDIATION_PATHS)
    || isPostRemediationSecuritySourceCompatibilityCurrent(rootDir, "security_followup_remediation", SECURITY_FOLLOWUP_REMEDIATION_PATHS)
    || isCurrentSecurityGovernedPathReceiptCurrent(rootDir, ["lib/public-distributed-rate-limit.ts"]);
  const currentResidualCompatibility = isCurrentSourceSecurityResidualCompatibilityCurrent(
    rootDir,
    "security_followup_remediation",
    SECURITY_FOLLOWUP_REMEDIATION_PATHS,
  );
  const residualReport = readJsonFile(rootDir, EVIDENCE_PATHS.currentSourceSecurityResidualRemediation);
  const residualReportSourceHead = isRecord(residualReport) ? readString(residualReport.sourceHead) : "";
  const residualReportApplies = residualReportSourceHead.length > 0
    && isEvidenceCurrentForPaths(rootDir, residualReportSourceHead, SECURITY_FOLLOWUP_REMEDIATION_PATHS);
  const accidentReport = readJsonFile(rootDir, EVIDENCE_PATHS.securityAccidentCaseCompatibility);
  const accidentCompatibility = isRecord(accidentReport) && isRecord(accidentReport.governedPathCompatibility)
    ? accidentReport.governedPathCompatibility
    : {};
  const accidentReportSourceHead = isRecord(accidentReport) ? readString(accidentReport.productCommit) : "";
  const accidentCoveredGateIds = Array.isArray(accidentCompatibility.coveredGateIds)
    ? accidentCompatibility.coveredGateIds.map(readString)
    : [];
  const accidentReportApplies = accidentCoveredGateIds.includes("security_followup_remediation")
    && accidentReportSourceHead.length > 0
    && isEvidenceCurrentForPaths(rootDir, accidentReportSourceHead, SECURITY_FOLLOWUP_REMEDIATION_PATHS);
  const postRemediationReport = readJsonFile(rootDir, EVIDENCE_PATHS.postRemediationSecuritySourceClosure);
  const postRemediationCompatibility = isRecord(postRemediationReport)
    && isRecord(postRemediationReport.governedPathCompatibility)
    ? postRemediationReport.governedPathCompatibility
    : {};
  const postRemediationSourceHead = isRecord(postRemediationReport)
    ? readString(postRemediationReport.sourceHead)
    : "";
  const postRemediationCoveredGateIds = Array.isArray(postRemediationCompatibility.coveredGateIds)
    ? postRemediationCompatibility.coveredGateIds.map(readString)
    : [];
  const postRemediationCompatibilityCurrent = isPostRemediationSecuritySourceCompatibilityCurrent(
    rootDir,
    "security_followup_remediation",
    SECURITY_FOLLOWUP_REMEDIATION_PATHS,
  );
  const postRemediationReportApplies = postRemediationCoveredGateIds.includes("security_followup_remediation")
    && postRemediationSourceHead.length > 0
    && isEvidenceCurrentForPaths(rootDir, postRemediationSourceHead, SECURITY_FOLLOWUP_REMEDIATION_PATHS);
  const applicableCompanionReceiptsPass = (!residualReportApplies || currentResidualCompatibility)
    && (!accidentReportApplies || accidentCompatibilityCurrent)
    && (!postRemediationReportApplies || postRemediationCompatibilityCurrent);
  const exportAdmissionCompatibilityCurrent = isDocumentExportAdmissionCompatibilityCurrent(
    rootDir,
    "security_followup_remediation",
    SECURITY_FOLLOWUP_REMEDIATION_PATHS,
  );
  const currentProductPaths = productPathsCurrent || exportAdmissionCompatibilityCurrent || currentResidualCompatibility;
  const pass = readString(report.verdict) === "PASS_LIVE_PRODUCTION_DEPLOYED_SECURITY_FOLLOWUP"
    && sourceHead.length > 0
    && sourceHead === readString(deployment.productionCommit)
    && isGitAncestor(rootDir, sourceHead)
    && compatibilityPass
    && latestCompatibilityPass
    && currentProductPaths
    && applicableCompanionReceiptsPass
    && readString(deployment.branch) === "master"
    && readString(deployment.environment) === "production"
    && deployment.liveAfterDeploymentRequired === false
    && deployment.liveProviderCancellationProbeExecuted === false
    && readString(scan.scanId) === "3f0107a8-e4a4-4a5b-be37-a28bcea8b05a"
    && readNumber(scan.sealedFindingCount) === 3
    && readNumber(severityCounts.medium) === 1
    && readNumber(severityCounts.low) === 2
    && readNumber(scan.immutableOriginalBaselineFindingCount) === 18
    && readNumber(scan.deferredCandidateCount) === 2
    && remediations.length === expectedRemediations.length
    && expectedRemediations.every((id) => remediations.some((item) => readString(item.id) === id && readString(item.status) === "PASS_CURRENT_SOURCE"))
    && readNumber(focused.files) === 12
    && readNumber(focused.tests) === 129
    && readNumber(focused.failed) === 0
    && verification.typecheck === "PASS"
    && readString(build.status) === "PASS"
    && readNumber(build.staticPages) === 28
    && verification.diffCheck === "PASS"
    && Array.isArray(report.remainingSecurityWork)
    && report.remainingSecurityWork.length === 0
    && noMutation
    && readString(boundaries.exactSavedShareVerdict) === "MISSING_EVIDENCE"
    && boundaries.approvalGatedBoundariesPreserved === true
    && boundaries.originalBaselineRewritten === false;

  return gateResult({
    id: "security_followup_remediation",
    label: "Security follow-up remediation",
    state: pass ? "proven" : "contradicted",
    evidencePath,
    detail: pass
      ? `The sealed follow-up scan's three diff findings (1 medium, 2 low) remain remediated in deployed production with the original 12 files / 129 tests, its ${readNumber(compatibilityFocused.files)}/${readNumber(compatibilityFocused.tests)} compatibility check, and current governed-path receipts including accident-case cancellation and scenario isolation (${accidentCompatibilityCurrent ? "6 files / 146 tests" : "covered by another current receipt"}). This does not rewrite the immutable original 18-finding baseline, resolve the two deferred candidates, close the separate public generation admission notice, or claim live provider cancellation probing; no mutation occurred and exact saved Share remains MISSING_EVIDENCE.`
      : `Security follow-up verdict=${readString(report.verdict) || "unknown"}, sourceMatchesProduction=${sourceHead.length > 0 && sourceHead === readString(deployment.productionCommit)}, compatibilityPass=${compatibilityPass}, latestCompatibilityPass=${latestCompatibilityPass}, latestCompatibilityCurrent=${latestCompatibilityCurrent}, accidentCompatibilityCurrent=${accidentCompatibilityCurrent}, productPathsCurrent=${currentProductPaths}, applicableCompanionReceiptsPass=${applicableCompanionReceiptsPass}, exportAdmissionCompatibility=${exportAdmissionCompatibilityCurrent}, findings=${readNumber(scan.sealedFindingCount)}, baseline=${readNumber(scan.immutableOriginalBaselineFindingCount)}, deferred=${readNumber(scan.deferredCandidateCount)}, remediations=${remediations.length}, tests=${readNumber(focused.tests)}, compatibilityTests=${readNumber(compatibilityFocused.tests)}, latestCompatibilityTests=${readNumber(latestCompatibilityFocused.tests)}, liveProviderProbe=${deployment.liveProviderCancellationProbeExecuted === true}, baselineRewritten=${boundaries.originalBaselineRewritten === true}, noMutation=${noMutation}, exactShare=${readString(boundaries.exactSavedShareVerdict) || "missing"}.`,
    nextActions: pass
      ? [
          "Keep the immutable baseline and two deferred candidates visible in future security review; do not convert this scoped remediation into a security-complete claim.",
          "Retain the separate public generation admission notice and exact saved Share boundary until their own evidence contracts close.",
        ]
      : ["Restore deployed SHA alignment, all three remediation contracts, verification totals, immutable-baseline preservation, no-mutation boundaries, and exact Share MISSING_EVIDENCE."],
  });
}

const PUBLIC_JSON_REQUEST_BODY_BUDGET_PATHS = [
  "app/api/ask/route.ts",
  "app/api/ask/stream/route.ts",
  "app/api/knowledge/match/route.ts",
  "lib/public-work-budget.ts",
];

/**
 * @param {string} rootDir
 * @returns {GateResult}
 */
function evaluatePublicJsonRequestBodyBudgetGate(rootDir) {
  const evidencePath = EVIDENCE_PATHS.publicJsonRequestBodyBudget;
  const report = readJsonFile(rootDir, evidencePath);
  if (!isRecord(report)) {
    return gateResult({
      id: "public_json_request_body_budget",
      label: "Public JSON request body budget",
      state: "missing",
      evidencePath,
      detail: "Public JSON pre-parse request budget evidence is missing or invalid.",
      nextActions: ["Restore the scoped live request-budget evidence without rewriting the corrected canonical scan."],
    });
  }

  const scan = isRecord(report.scan) ? report.scan : {};
  const verification = isRecord(report.verification) ? report.verification : {};
  const focused = isRecord(verification.focusedSecurityTests) ? verification.focusedSecurityTests : {};
  const adjacent = isRecord(verification.adjacentAdmissionTests) ? verification.adjacentAdmissionTests : {};
  const build = isRecord(verification.build) ? verification.build : {};
  const liveVerification = isRecord(report.liveVerification) ? report.liveVerification : {};
  const liveCases = Array.isArray(liveVerification.cases) ? liveVerification.cases.filter(isRecord) : [];
  const mutationBoundary = isRecord(report.mutationBoundary) ? report.mutationBoundary : {};
  const remaining = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  const sourceHead = readString(report.sourceHead);
  const productionCommit = readString(report.productionCommit);
  const sourceCurrent = isEvidenceCurrentForPaths(rootDir, sourceHead, PUBLIC_JSON_REQUEST_BODY_BUDGET_PATHS)
    || isPublicProviderAdmissionCompatibilityCurrent(rootDir, "public_json_request_body_budget", PUBLIC_JSON_REQUEST_BODY_BUDGET_PATHS)
    || isPublicAskDistributedAdmissionCompatibilityCurrent(rootDir, "public_json_request_body_budget", PUBLIC_JSON_REQUEST_BODY_BUDGET_PATHS)
    || isCurrentSecurityRemediationCompatibilityCurrent(rootDir, "public_json_request_body_budget", PUBLIC_JSON_REQUEST_BODY_BUDGET_PATHS)
    || isPostRemediationSecuritySourceCompatibilityCurrent(rootDir, "public_json_request_body_budget", PUBLIC_JSON_REQUEST_BODY_BUDGET_PATHS)
    || isPublicAdmissionCurrentSourceCompatibilityCurrent(rootDir, "public_json_request_body_budget", PUBLIC_JSON_REQUEST_BODY_BUDGET_PATHS)
    || isCurrentSecurityGovernedPathCompatibility(rootDir, "public_json_request_body_budget", PUBLIC_JSON_REQUEST_BODY_BUDGET_PATHS);
  const expectedCases = [
    { path: "/api/ask", limit: 131072 },
    { path: "/api/ask/stream", limit: 131072 },
    { path: "/api/knowledge/match", limit: 16384 },
  ];
  const noMutation = mutationBoundary.dbSchemaMutation === false
    && mutationBoundary.dbDataMutation === false
    && mutationBoundary.providerDispatchCalled === false
    && mutationBoundary.shareSessionCreated === false
    && mutationBoundary.vectorOrEmbeddingMutation === false
    && mutationBoundary.wikiPublication === false
    && mutationBoundary.koshaExactRegistryMutation === false;
  const pass = readString(report.verdict) === "PASS_LIVE_PRODUCTION_PUBLIC_JSON_PRE_PARSE_BUDGET"
    && sourceHead.length > 0
    && productionCommit.length > 0
    && isGitAncestor(rootDir, sourceHead)
    && isGitAncestor(rootDir, productionCommit)
    && report.productionIncludesProductCommit === true
    && sourceCurrent
    && readString(scan.scanId) === "c4e9e2f1-7ce4-4313-a651-32205fca401f"
    && readString(scan.findingId) === "csf_44619971f6e14344d1d76da5"
    && readString(scan.anchor) === "json-body-budget-after-parse"
    && scan.immutableFindingPreserved === true
    && scan.followUpScanRequired === true
    && liveVerification.buildInfoCommit === productionCommit
    && liveVerification.providerWorkExpected === false
    && liveCases.length === expectedCases.length
    && expectedCases.every((expected) => liveCases.some((item) => readString(item.path) === expected.path
      && readNumber(item.status) === 413
      && readString(item.code) === "PUBLIC_WORK_BUDGET_EXCEEDED"
      && readNumber(item.limit) === expected.limit))
    && readNumber(focused.files) === 3
    && readNumber(focused.tests) === 22
    && readString(focused.status) === "PASS"
    && readNumber(adjacent.files) === 4
    && readNumber(adjacent.tests) === 26
    && readString(adjacent.status) === "PASS"
    && verification.typecheck === "PASS"
    && readString(build.status) === "PASS"
    && readNumber(build.staticPages) === 28
    && verification.diffCheck === "PASS"
    && noMutation
    && readString(remaining.exactSavedShareVerdict) === "MISSING_EVIDENCE"
    && remaining.securityCompleteClaimAllowed === false
    && remaining.remainingScanFindingsStayVisible === true
    && readString(remaining.followUpSecurityScan) === "REQUIRED";

  return gateResult({
    id: "public_json_request_body_budget",
    label: "Public JSON request body budget",
    state: pass ? "proven" : "contradicted",
    evidencePath,
    detail: pass
      ? "The corrected current-source scan's medium public JSON body-budget finding is source-remediated and live-proven across /api/ask, /api/ask/stream, and /api/knowledge/match with pre-parse byte limits, 48 focused/adjacent tests, and a current 23 files / 215 tests governed-path companion. The immutable 14-finding scan and nine deferred candidates remain visible, a follow-up scan is required, no mutation occurred, security-complete is false, and exact saved Share remains MISSING_EVIDENCE."
      : `Public JSON budget verdict=${readString(report.verdict) || "unknown"}, sourceCurrent=${sourceCurrent}, liveCases=${liveCases.length}, tests=${readNumber(focused.tests) + readNumber(adjacent.tests)}, followUp=${readString(remaining.followUpSecurityScan) || "missing"}, securityComplete=${remaining.securityCompleteClaimAllowed === true}, noMutation=${noMutation}, exactShare=${readString(remaining.exactSavedShareVerdict) || "missing"}.`,
    nextActions: pass
      ? [
          "Keep the canonical 14 findings and nine deferred candidates visible until a fresh follow-up scan revalidates the patched source.",
          "Continue approval-free remediation without weakening exact saved Share or other approval-gated boundaries.",
        ]
      : ["Restore deployed SHA ancestry, all three live 413 cases, verification totals, immutable-scan preservation, follow-up scan requirement, no-mutation boundaries, and exact Share MISSING_EVIDENCE."],
  });
}

/**
 * @param {string} rootDir
 * @returns {GateResult}
 */
function evaluateSecurityResourceRemediationGate(rootDir) {
  const evidencePath = EVIDENCE_PATHS.securityResourceRemediation;
  const report = readJsonFile(rootDir, evidencePath);
  if (!isRecord(report)) {
    return gateResult({
      id: "security_resource_remediation",
      label: "Security resource remediation",
      state: "missing",
      evidencePath,
      detail: "Live security resource-remediation evidence is missing or invalid.",
      nextActions: ["Restore the sealed-scan-linked live evidence without rewriting the immutable scan baseline."],
    });
  }

  const sourceScan = isRecord(report.sourceScan) ? report.sourceScan : {};
  const verification = isRecord(report.verification) ? report.verification : {};
  const focused = isRecord(verification.focused) ? verification.focused : {};
  const adjacent = isRecord(verification.adjacent) ? verification.adjacent : {};
  const liveChecks = isRecord(report.liveChecks) ? report.liveChecks : {};
  const buildInfo = isRecord(liveChecks.buildInfo) ? liveChecks.buildInfo : {};
  const mcp = isRecord(liveChecks.mcpNonPostAdmission) ? liveChecks.mcpNonPostAdmission : {};
  const knowledge = isRecord(liveChecks.knowledgeOversizedBody) ? liveChecks.knowledgeOversizedBody : {};
  const remediation = isRecord(liveChecks.remediationOversizedBody) ? liveChecks.remediationOversizedBody : {};
  const share = isRecord(liveChecks.shareOversizedAck) ? liveChecks.shareOversizedAck : {};
  const remaining = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  const mutation = isRecord(report.mutationBoundary) ? report.mutationBoundary : {};
  const remediated = Array.isArray(report.remediatedFindings) ? report.remediatedFindings.map(readString) : [];
  const expectedRemediated = [
    "mcp-non-post-admission",
    "openclaw-output-budget",
    "openclaw-termination-grace",
    "knowledge-preauth-body-budget",
    "workpack-remediation-body-budget",
    "public-share-admission",
  ];
  const sourceHead = readString(report.sourceHead);
  const productCommit = readString(report.productCommit);
  const productionCommit = readString(report.productionCommit);
  const noMutation = mutation.dbMutationPerformed === false
    && mutation.providerDispatchCalled === false
    && mutation.shareSessionCreated === false
    && mutation.vectorUploadPerformed === false
    && mutation.wikiPublicationPerformed === false
    && mutation.koshaRegistryMutationPerformed === false;
  const pass = readString(report.verdict) === "PASS_LIVE_PRODUCTION_SECURITY_RESOURCE_REMEDIATION"
    && sourceHead.length > 0
    && productCommit === sourceHead
    && productionCommit.startsWith(productCommit)
    && isGitAncestor(rootDir, productionCommit)
    && report.liveAfterDeploymentPending === false
    && readString(sourceScan.scanId) === "a8aa9242-ed42-4057-88e9-31a72e298292"
    && readString(sourceScan.targetRevision) === "8cd86f7ab2abe4ad7d4948d8feda083b0b032386"
    && readNumber(sourceScan.findingCount) === 20
    && readNumber(sourceScan.mediumCount) === 15
    && readNumber(sourceScan.lowCount) === 5
    && readString(sourceScan.coverageCompleteness) === "partial"
    && remediated.length === expectedRemediated.length
    && expectedRemediated.every((id) => remediated.includes(id))
    && readNumber(focused.testFiles) === 5
    && readNumber(focused.tests) === 79
    && readString(focused.status) === "PASS"
    && readNumber(adjacent.testFiles) === 12
    && readNumber(adjacent.tests) === 156
    && readString(adjacent.status) === "PASS"
    && verification.typecheck === "PASS"
    && verification.build === "PASS"
    && readNumber(verification.staticPages) === 28
    && readNumber(verification.dependencyAuditVulnerabilities) === 0
    && readString(buildInfo.status) === "PASS"
    && readString(buildInfo.commitSha) === productionCommit
    && readNumber(mcp.status) === 401
    && readString(mcp.verdict) === "PASS"
    && readNumber(knowledge.routes) === 3
    && readNumber(knowledge.status) === 413
    && readString(knowledge.verdict) === "PASS"
    && readNumber(remediation.status) === 413
    && readString(remediation.verdict) === "PASS"
    && readNumber(share.status) === 413
    && readString(share.verdict) === "PASS"
    && readNumber(remaining.remainingScanFindings) === 14
    && readString(remaining.exactSavedShareVerdict) === "MISSING_EVIDENCE"
    && readString(remaining.providerDispatchPersistence) === "APPROVAL_GATED"
    && noMutation;

  return gateResult({
    id: "security_resource_remediation",
    label: "Security resource remediation",
    state: pass ? "proven" : "contradicted",
    evidencePath,
    detail: pass
      ? "Fresh sealed scan a8aa9242 retained 20 findings under partial coverage; live production now proves bounded remediation for 6/20 resource-control findings with 235 focused/adjacent tests. The remaining 14 findings stay open, security-complete remains false, no mutation occurred, provider persistence remains approval-gated, and exact saved Share remains MISSING_EVIDENCE."
      : `Security resource verdict=${readString(report.verdict) || "unknown"}, scan=${readString(sourceScan.scanId) || "missing"}, findings=${readNumber(sourceScan.findingCount)}, remediated=${remediated.length}, remaining=${readNumber(remaining.remainingScanFindings)}, noMutation=${noMutation}, exactShare=${readString(remaining.exactSavedShareVerdict) || "missing"}.`,
    nextActions: pass
      ? ["Remediate or explicitly defer the remaining 14 sealed findings; do not convert this scoped 6/20 closure into a security-complete claim."]
      : ["Restore sealed scan identity, 6/20 remediation accounting, live verification, no-mutation boundaries, and exact Share MISSING_EVIDENCE."],
  });
}

/**
 * @param {string} rootDir
 * @returns {GateResult}
 */
function evaluateSecurityUpstreamTransportRemediationGate(rootDir) {
  const evidencePath = EVIDENCE_PATHS.securityUpstreamTransportRemediation;
  const report = readJsonFile(rootDir, evidencePath);
  if (!isRecord(report)) {
    return gateResult({
      id: "security_upstream_transport_remediation",
      label: "Security upstream transport remediation",
      state: "missing",
      evidencePath,
      detail: "Live upstream transport-remediation evidence is missing or invalid.",
      nextActions: ["Restore the sealed-scan-linked upstream transport evidence without rewriting the immutable scan baseline."],
    });
  }

  const sourceScan = isRecord(report.sourceScan) ? report.sourceScan : {};
  const cumulative = isRecord(report.cumulativeRemediation) ? report.cumulativeRemediation : {};
  const contracts = isRecord(report.contracts) ? report.contracts : {};
  const verification = isRecord(report.verification) ? report.verification : {};
  const focused = isRecord(verification.focused) ? verification.focused : {};
  const adjacent = isRecord(verification.adjacent) ? verification.adjacent : {};
  const liveChecks = isRecord(report.liveChecks) ? report.liveChecks : {};
  const buildInfo = isRecord(liveChecks.buildInfo) ? liveChecks.buildInfo : {};
  const providerProbe = isRecord(liveChecks.externalProviderProbe) ? liveChecks.externalProviderProbe : {};
  const remaining = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  const mutation = isRecord(report.mutationBoundary) ? report.mutationBoundary : {};
  const remediated = Array.isArray(report.remediatedFindings) ? report.remediatedFindings.filter(isRecord) : [];
  const expectedFindings = new Map([
    ["csf_afc7b9c8c2fe4982bcd22475", "configurable-mcp-upstream-ssrf"],
    ["csf_b39a066e2b5d07924770057a", "unbounded-mcp-upstream-response"],
  ]);
  const sourceHead = readString(report.sourceHead);
  const productCommit = readString(report.productCommit);
  const productionCommit = readString(report.productionCommit);
  const findingIdentityPass = remediated.length === expectedFindings.size
    && remediated.every((item) => expectedFindings.get(readString(item.findingId)) === readString(item.anchor));
  const noMutation = mutation.dbMutationPerformed === false
    && mutation.providerDispatchCalled === false
    && mutation.externalProviderProbeExecuted === false
    && mutation.shareSessionCreated === false
    && mutation.vectorUploadPerformed === false
    && mutation.wikiPublicationPerformed === false
    && mutation.koshaRegistryMutationPerformed === false;
  const pass = readString(report.verdict) === "PASS_LIVE_PRODUCTION_SOURCE_PROVEN_UPSTREAM_TRANSPORT_SECURITY_NO_PROVIDER_PROBE"
    && sourceHead.length > 0
    && productCommit === sourceHead
    && productionCommit === productCommit
    && isGitAncestor(rootDir, productionCommit)
    && report.liveAfterDeploymentPending === false
    && readString(sourceScan.scanId) === "a8aa9242-ed42-4057-88e9-31a72e298292"
    && readString(sourceScan.targetRevision) === "8cd86f7ab2abe4ad7d4948d8feda083b0b032386"
    && readNumber(sourceScan.findingCount) === 20
    && sourceScan.immutableBaselinePreserved === true
    && findingIdentityPass
    && readNumber(cumulative.previouslyRemediated) === 6
    && readNumber(cumulative.remediatedThisWave) === 2
    && readNumber(cumulative.remediatedTotal) === 8
    && readNumber(cumulative.remainingScanFindings) === 12
    && cumulative.securityCompleteClaimAllowed === false
    && cumulative.freshFollowUpScanRequired === true
    && contracts.configurableOriginsRequireExplicitAllowlist === true
    && contracts.credentialFreeHttpsDefaultPortOnly === true
    && contracts.allResolvedAddressesMustBePublic === true
    && contracts.literalPrivateAndLinkLocalAddressesRejected === true
    && contracts.redirectsDisabled === true
    && contracts.credentialsAttachedOnlyAfterUrlApproval === true
    && readNumber(contracts.weatherResponseMaxBytes) === 1048576
    && readNumber(contracts.accidentResponseMaxBytes) === 2097152
    && contracts.contentLengthPreflightEnforced === true
    && contracts.streamedByteLimitEnforced === true
    && readNumber(focused.testFiles) === 5
    && readNumber(focused.tests) === 32
    && readString(focused.status) === "PASS"
    && readNumber(adjacent.testFiles) === 11
    && readNumber(adjacent.tests) === 119
    && readString(adjacent.status) === "PASS"
    && verification.typecheck === "PASS"
    && verification.build === "PASS"
    && readNumber(verification.staticPages) === 28
    && verification.diffCheck === "PASS"
    && readString(buildInfo.status) === "PASS"
    && readString(buildInfo.commitSha) === productionCommit
    && providerProbe.executed === false
    && readNumber(remaining.remainingScanFindings) === 12
    && remaining.securityCompleteClaimAllowed === false
    && readString(remaining.exactSavedShareVerdict) === "MISSING_EVIDENCE"
    && readString(remaining.providerDispatchPersistence) === "APPROVAL_GATED"
    && noMutation;

  return gateResult({
    id: "security_upstream_transport_remediation",
    label: "Security upstream transport remediation",
    state: pass ? "proven" : "contradicted",
    evidencePath,
    detail: pass
      ? "Fresh sealed scan a8aa9242 keeps its immutable 20-finding baseline while live production source-proves configurable upstream SSRF containment and bounded provider responses. This wave closes 2 findings for a cumulative 8/20, leaves 12 visible, performs no external provider probe or mutation, keeps provider persistence approval-gated, and preserves exact saved Share as MISSING_EVIDENCE."
      : `Upstream transport verdict=${readString(report.verdict) || "unknown"}, findings=${remediated.length}, cumulative=${readNumber(cumulative.remediatedTotal)}/20, remaining=${readNumber(remaining.remainingScanFindings)}, providerProbe=${providerProbe.executed === true}, noMutation=${noMutation}, exactShare=${readString(remaining.exactSavedShareVerdict) || "missing"}.`,
    nextActions: pass
      ? ["Remediate or explicitly defer the remaining 12 sealed findings and require a fresh scan before any security-complete claim."]
      : ["Restore finding identities, cumulative 8/20 accounting, live marker equality, verification totals, no-provider/no-mutation boundaries, and exact Share MISSING_EVIDENCE."],
  });
}

/**
 * @param {string} rootDir
 * @returns {GateResult}
 */
function evaluateSecuritySafetyReferenceSurfaceRemediationGate(rootDir) {
  const evidencePath = EVIDENCE_PATHS.securitySafetyReferenceSurfaceRemediation;
  const report = readJsonFile(rootDir, evidencePath);
  if (!isRecord(report)) {
    return gateResult({
      id: "security_safety_reference_surface_remediation",
      label: "Security safety-reference surface remediation",
      state: "missing",
      evidencePath,
      detail: "Live safety-reference public-surface evidence is missing or invalid.",
      nextActions: ["Restore the sealed-scan-linked public projection evidence without exposing local corpus bodies."],
    });
  }

  const sourceScan = isRecord(report.sourceScan) ? report.sourceScan : {};
  const finding = isRecord(report.remediatedFinding) ? report.remediatedFinding : {};
  const cumulative = isRecord(report.cumulativeRemediation) ? report.cumulativeRemediation : {};
  const contracts = isRecord(report.contracts) ? report.contracts : {};
  const verification = isRecord(report.verification) ? report.verification : {};
  const focused = isRecord(verification.focused) ? verification.focused : {};
  const adjacent = isRecord(verification.adjacent) ? verification.adjacent : {};
  const liveChecks = isRecord(report.liveChecks) ? report.liveChecks : {};
  const buildInfo = isRecord(liveChecks.buildInfo) ? liveChecks.buildInfo : {};
  const publicSearch = isRecord(liveChecks.publicSafetyReferenceSearch)
    ? liveChecks.publicSafetyReferenceSearch
    : {};
  const remaining = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  const mutation = isRecord(report.mutationBoundary) ? report.mutationBoundary : {};
  const sourceHead = readString(report.sourceHead);
  const productCommit = readString(report.productCommit);
  const productionCommit = readString(report.productionCommit);
  const noMutation = mutation.dbMutationPerformed === false
    && mutation.providerDispatchCalled === false
    && mutation.shareSessionCreated === false
    && mutation.vectorUploadPerformed === false
    && mutation.wikiPublicationPerformed === false
    && mutation.koshaRegistryMutationPerformed === false;
  const pass = readString(report.verdict) === "PASS_LIVE_PRODUCTION_PUBLIC_SAFETY_REFERENCE_SURFACE_BOUNDED"
    && sourceHead.length > 0
    && productCommit === sourceHead
    && productionCommit === productCommit
    && isGitAncestor(rootDir, productionCommit)
    && report.liveAfterDeploymentPending === false
    && readString(sourceScan.scanId) === "a8aa9242-ed42-4057-88e9-31a72e298292"
    && readString(sourceScan.targetRevision) === "8cd86f7ab2abe4ad7d4948d8feda083b0b032386"
    && readNumber(sourceScan.findingCount) === 20
    && sourceScan.immutableBaselinePreserved === true
    && readString(finding.findingId) === "csf_343e69e970d1524202d48324"
    && readString(finding.anchor) === "safety-reference-local-body-amplification"
    && readString(finding.severity) === "medium"
    && readNumber(cumulative.previouslyRemediated) === 8
    && readNumber(cumulative.remediatedThisWave) === 1
    && readNumber(cumulative.remediatedTotal) === 9
    && readNumber(cumulative.remainingScanFindings) === 11
    && cumulative.securityCompleteClaimAllowed === false
    && cumulative.freshFollowUpScanRequired === true
    && contracts.internalCorpusBodyRetainedForGrounding === true
    && contracts.publicSearchBodyOmitted === true
    && contracts.publicSearchPayloadOmitted === true
    && contracts.publicSearchMetadataOmitted === true
    && contracts.publicHarnessPacketBodyOmitted === true
    && contracts.comparisonOnlySearchBodyOmitted === true
    && contracts.promptEvidenceUsesBoundedExcerpt === true
    && readNumber(contracts.summaryMaxChars) === 480
    && readNumber(contracts.controlsMaxItems) === 12
    && readNumber(contracts.controlMaxChars) === 280
    && readNumber(contracts.anchorsMaxItems) === 8
    && readNumber(contracts.anchorExcerptMaxChars) === 360
    && readNumber(focused.testFiles) === 4
    && readNumber(focused.tests) === 103
    && readString(focused.status) === "PASS"
    && readNumber(adjacent.testFiles) === 8
    && readNumber(adjacent.tests) === 176
    && readString(adjacent.status) === "PASS"
    && verification.typecheck === "PASS"
    && verification.build === "PASS"
    && readNumber(verification.staticPages) === 28
    && verification.diffCheck === "PASS"
    && readString(buildInfo.status) === "PASS"
    && readString(buildInfo.commitSha) === productionCommit
    && publicSearch.executed === true
    && publicSearch.readOnly === true
    && readNumber(publicSearch.status) === 200
    && readNumber(publicSearch.returnedItems) === 5
    && readNumber(publicSearch.bodyFieldCount) === 0
    && readNumber(publicSearch.payloadFieldCount) === 0
    && readNumber(publicSearch.metadataFieldCount) === 0
    && readNumber(publicSearch.maxSummaryChars) <= 480
    && readNumber(publicSearch.maxControlsPerItem) <= 12
    && readString(publicSearch.rateLimitMode) === "instance"
    && readString(remaining.publicSearchDistributedRateLimitReadiness) === "NOTICE_INSTANCE_MODE"
    && readNumber(remaining.remainingScanFindings) === 11
    && remaining.securityCompleteClaimAllowed === false
    && readString(remaining.exactSavedShareVerdict) === "MISSING_EVIDENCE"
    && readString(remaining.providerDispatchPersistence) === "APPROVAL_GATED"
    && noMutation;

  return gateResult({
    id: "security_safety_reference_surface_remediation",
    label: "Security safety-reference surface remediation",
    state: pass ? "proven" : "contradicted",
    evidencePath,
    detail: pass
      ? "Live public safety-reference search, MCP harness packets, and saved-workpack comparison results omit full bodies and arbitrary payload metadata while internal KOSHA grounding retains a bounded prompt excerpt. This wave closes 1 finding for a cumulative 9/20, leaves 11 visible, preserves instance rate limiting as a separate notice, performs no mutation, and keeps exact saved Share as MISSING_EVIDENCE."
      : `Safety-reference surface verdict=${readString(report.verdict) || "unknown"}, finding=${readString(finding.findingId) || "missing"}, cumulative=${readNumber(cumulative.remediatedTotal)}/20, remaining=${readNumber(remaining.remainingScanFindings)}, publicFields=${readNumber(publicSearch.bodyFieldCount)}/${readNumber(publicSearch.payloadFieldCount)}/${readNumber(publicSearch.metadataFieldCount)}, rateLimit=${readString(publicSearch.rateLimitMode) || "unknown"}, noMutation=${noMutation}, exactShare=${readString(remaining.exactSavedShareVerdict) || "missing"}.`,
    nextActions: pass
      ? ["Remediate or explicitly defer the remaining 11 sealed findings and require a fresh scan before any security-complete claim."]
      : ["Restore cumulative 9/20 accounting, live marker equality, zero public body/payload/metadata fields, bounded text contracts, instance-rate notice, no-mutation boundaries, and exact Share MISSING_EVIDENCE."],
  });
}

const IMPROVEMENT_PHOTO_ANALYSIS_BUDGET_PATHS = [
  "app/api/input-photos/hazard-analysis/route.ts",
  "app/api/workpacks/[id]/improvements/route.ts",
  "lib/photo-vision-analysis.ts",
  "lib/public-distributed-rate-limit.ts",
];

/**
 * @param {string} rootDir
 * @returns {GateResult}
 */
function evaluateImprovementPhotoAnalysisBudgetGate(rootDir) {
  const evidencePath = EVIDENCE_PATHS.improvementPhotoAnalysisBudget;
  const report = readJsonFile(rootDir, evidencePath);
  if (!isRecord(report)) {
    return gateResult({
      id: "improvement_photo_analysis_budget",
      label: "Improvement photo analysis budget",
      state: "missing",
      evidencePath,
      detail: "Improvement photo request-budget evidence is missing or invalid.",
      nextActions: ["Restore the scoped evidence without rewriting the immutable corrected scan."],
    });
  }

  const scan = isRecord(report.scan) ? report.scan : {};
  const budgets = isRecord(report.budgets) ? report.budgets : {};
  const controls = isRecord(report.controls) ? report.controls : {};
  const admission = isRecord(report.admission) ? report.admission : {};
  const verification = isRecord(report.verification) ? report.verification : {};
  const tests = isRecord(verification.focusedAndAdjacentTests) ? verification.focusedAndAdjacentTests : {};
  const build = isRecord(verification.build) ? verification.build : {};
  const live = isRecord(report.liveVerification) ? report.liveVerification : {};
  const liveCases = Array.isArray(live.cases) ? live.cases.filter(isRecord) : [];
  const mutation = isRecord(report.mutationBoundary) ? report.mutationBoundary : {};
  const remaining = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  const sourceHead = readString(report.sourceHead);
  const productionCommit = readString(report.productionCommit);
  const sourceCurrent = isEvidenceCurrentForPaths(rootDir, sourceHead, IMPROVEMENT_PHOTO_ANALYSIS_BUDGET_PATHS)
    || isPublicProviderAdmissionCompatibilityCurrent(rootDir, "improvement_photo_analysis_budget", IMPROVEMENT_PHOTO_ANALYSIS_BUDGET_PATHS)
    || isCurrentSecurityRemediationCompatibilityCurrent(rootDir, "improvement_photo_analysis_budget", IMPROVEMENT_PHOTO_ANALYSIS_BUDGET_PATHS)
    || isDocumentExportAdmissionCompatibilityCurrent(rootDir, "improvement_photo_analysis_budget", IMPROVEMENT_PHOTO_ANALYSIS_BUDGET_PATHS)
    || isPublicAdmissionCurrentSourceCompatibilityCurrent(rootDir, "improvement_photo_analysis_budget", IMPROVEMENT_PHOTO_ANALYSIS_BUDGET_PATHS)
    || isCurrentSecurityGovernedPathCompatibility(rootDir, "improvement_photo_analysis_budget", IMPROVEMENT_PHOTO_ANALYSIS_BUDGET_PATHS)
    || isCurrentPhotoReadinessAuthFanoutCompatibility(rootDir, IMPROVEMENT_PHOTO_ANALYSIS_BUDGET_PATHS);
  const noMutation = mutation.dbSchemaMutation === false
    && mutation.dbDataMutation === false
    && mutation.providerDispatchCalled === false
    && mutation.photoVisionProviderCalledDuringEvidence === false
    && mutation.shareSessionCreated === false
    && mutation.vectorOrEmbeddingMutation === false
    && mutation.wikiPublication === false
    && mutation.koshaExactRegistryMutation === false;
  const sharedLiveAdmission = liveCases.length === 2
    && liveCases.every((item) => readNumber(item.status) === 401
      && readString(item.rateLimitMode) === "instance"
      && readString(item.workUnit) === "photo-analysis"
      && item.multipartParsed === false
      && item.providerCalled === false);
  const pass = readString(report.verdict) === "PASS_LIVE_PRODUCTION_IMPROVEMENT_PHOTO_ANALYSIS_BUDGET_WITH_INSTANCE_ADMISSION"
    && sourceHead.length > 0
    && productionCommit.length > 0
    && isGitAncestor(rootDir, sourceHead)
    && isGitAncestor(rootDir, productionCommit)
    && report.productionIncludesProductCommit === true
    && sourceCurrent
    && readString(scan.scanId) === "c4e9e2f1-7ce4-4313-a651-32205fca401f"
    && readString(scan.findingId) === "csf_4632cfb321a45b5f7429daef"
    && readString(scan.anchor) === "improvement-photo-analysis-unbounded"
    && scan.immutableFindingPreserved === true
    && scan.followUpScanRequired === true
    && readNumber(budgets.maxRequestBytes) === 42_991_616
    && readNumber(budgets.maxAggregatePhotoBytes) === 41_943_040
    && readNumber(budgets.maxBytesPerPhoto) === 20_971_520
    && readNumber(budgets.maxImprovementPhotoFiles) === 2
    && readNumber(budgets.rateLimitPerMinute) === 8
    && readNumber(budgets.aggregateConcurrency) === 2
    && controls.contentLengthRequiredBeforeMultipartParse === true
    && controls.oversizedDeclaredBodyRejectedBeforeMultipartParse === true
    && controls.aggregateBytesCheckedAfterParseBeforeProvider === true
    && controls.unexpectedFileFieldsRejected === true
    && controls.mimeAllowlistChecked === true
    && controls.fileSignatureChecked === true
    && controls.improvementAnalyzerRevalidatesFiles === true
    && controls.dedicatedAndImprovementRoutesShareAdmission === true
    && controls.providerCalledOnRejectedInput === false
    && controls.dbWriteCalledOnRejectedInput === false
    && readString(admission.productionDistributedActivation) === "INSTANCE_FALLBACK_ACTIVE"
    && readNumber(tests.files) === 7
    && readNumber(tests.tests) === 76
    && readString(tests.status) === "PASS"
    && verification.typecheck === "PASS"
    && readString(build.status) === "PASS"
    && readNumber(build.staticPages) === 28
    && verification.diffCheck === "PASS"
    && verification.secretScan === "PASS"
    && live.buildInfoCommit === productionCommit
    && readString(live.status) === "PASS_READ_ONLY_ADMISSION_PROBE"
    && sharedLiveAdmission
    && noMutation
    && readString(remaining.exactSavedShareVerdict) === "MISSING_EVIDENCE"
    && remaining.securityCompleteClaimAllowed === false
    && remaining.remainingScanFindingsStayVisible === true
    && readString(remaining.distributedProductionActivation) === "INSTANCE_FALLBACK_ACTIVE_NOT_DISTRIBUTED"
    && readString(remaining.followUpSecurityScan) === "REQUIRED";

  return gateResult({
    id: "improvement_photo_analysis_budget",
    label: "Improvement photo analysis budget",
    state: pass ? "notice" : "contradicted",
    evidencePath,
    detail: pass
      ? "Improvement and dedicated photo analysis now share pre-provider byte, count, MIME/signature, rate, and concurrency controls with 76 tests plus a current 23 files / 215 tests governed-path companion. Production currently reports instance fallback rather than distributed admission, the immutable 14-finding scan remains unchanged, a follow-up scan is required, no mutation occurred, security-complete is false, and exact saved Share remains MISSING_EVIDENCE."
      : `Improvement photo verdict=${readString(report.verdict) || "unknown"}, sourceCurrent=${sourceCurrent}, liveCases=${liveCases.length}, admission=${readString(admission.productionDistributedActivation) || "missing"}, tests=${readNumber(tests.tests)}, followUp=${readString(remaining.followUpSecurityScan) || "missing"}, noMutation=${noMutation}, exactShare=${readString(remaining.exactSavedShareVerdict) || "missing"}.`,
    nextActions: pass
      ? [
          "Activate approved distributed photo-analysis admission before treating process-instance fallback as horizontally durable.",
          "Keep the canonical findings visible until a fresh follow-up security scan revalidates the patched source.",
        ]
      : ["Restore deployed source ancestry, file budgets, shared live admission, verification totals, no-mutation boundaries, follow-up scan requirement, and exact Share MISSING_EVIDENCE."],
  });
}

const PUBLIC_PROVIDER_CANCELLATION_PATHS = [
  "app/api/weather/route.ts",
  "app/api/workpack/remediate/route.ts",
  "lib/ai.ts",
  "lib/knowledge-candidate-route.ts",
];

const PUBLIC_PROVIDER_CANCELLATION_UNCHANGED_PATHS = PUBLIC_PROVIDER_CANCELLATION_PATHS
  .filter((pathName) => pathName !== "lib/knowledge-candidate-route.ts");

/** @param {string} rootDir @param {string} originalSourceHead */
function isWikiCandidateProviderCancellationCompatibilityCurrent(rootDir, originalSourceHead) {
  const report = readJsonFile(rootDir, EVIDENCE_PATHS.llmWikiCandidateContentMatrix);
  if (!isRecord(report)) {
    return false;
  }
  const compatibilityContracts = isRecord(report.compatibilityContracts) ? report.compatibilityContracts : {};
  const compatibility = isRecord(compatibilityContracts.providerCancellation)
    ? compatibilityContracts.providerCancellation
    : {};
  const tests = isRecord(compatibility.focusedVitest) ? compatibility.focusedVitest : {};
  const mutationBoundary = isRecord(report.mutationBoundary) ? report.mutationBoundary : {};
  const remainingBoundaries = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  const sourceHead = readString(compatibility.sourceHead);
  return readString(compatibility.verdict) === "PASS_CURRENT_SOURCE_KNOWLEDGE_PROVIDER_CANCELLATION_COMPATIBILITY"
    && sourceHead === readString(report.productCommit)
    && isGitAncestor(rootDir, sourceHead)
    && isEvidenceCurrentForPaths(rootDir, sourceHead, ["lib/knowledge-candidate-route.ts"])
    && isEvidenceCurrentForPaths(rootDir, originalSourceHead, PUBLIC_PROVIDER_CANCELLATION_UNCHANGED_PATHS)
    && readString(compatibility.changedGovernedPath) === "lib/knowledge-candidate-route.ts"
    && readString(tests.file) === "tests/knowledge-regenerate-route.test.ts"
    && readNumber(tests.files) === 1
    && readNumber(tests.tests) === 18
    && readNumber(tests.failed) === 0
    && compatibility.requestSignalForwardedToGeneration === true
    && compatibility.abortSkipsProviderFallback === true
    && compatibility.originalSecurityBaselineRewritten === false
    && mutationBoundary.dbMutationPerformed === false
    && mutationBoundary.providerDispatchCalled === false
    && mutationBoundary.shareSessionCreated === false
    && mutationBoundary.ontologyPublicationPerformed === false
    && mutationBoundary.vectorOrEmbeddingMutationPerformed === false
    && mutationBoundary.koshaRegistryMutationPerformed === false
    && readString(remainingBoundaries.exactSavedShareVerdict) === "MISSING_EVIDENCE";
}

/** @param {string} rootDir @param {string} originalSourceHead */
function isWikiSifProviderCancellationCompatibilityCurrent(rootDir, originalSourceHead) {
  const report = readJsonFile(rootDir, EVIDENCE_PATHS.llmWikiSifEvidenceMatrix);
  if (!isRecord(report)) {
    return false;
  }
  const compatibilityContracts = isRecord(report.compatibilityContracts) ? report.compatibilityContracts : {};
  const compatibility = isRecord(compatibilityContracts.providerCancellation)
    ? compatibilityContracts.providerCancellation
    : {};
  const tests = isRecord(compatibility.focusedVitest) ? compatibility.focusedVitest : {};
  const mutationBoundary = isRecord(report.mutationBoundary) ? report.mutationBoundary : {};
  const remainingBoundaries = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  const sourceHead = readString(compatibility.sourceHead);
  return readString(compatibility.verdict) === "PASS_CURRENT_SOURCE_WIKI_SIF_PROVIDER_CANCELLATION_COMPATIBILITY"
    && sourceHead === readString(report.productCommit)
    && isGitAncestor(rootDir, sourceHead)
    && isEvidenceCurrentForPaths(rootDir, sourceHead, ["lib/knowledge-candidate-route.ts"])
    && isEvidenceCurrentForPaths(rootDir, originalSourceHead, PUBLIC_PROVIDER_CANCELLATION_UNCHANGED_PATHS)
    && readString(compatibility.changedGovernedPath) === "lib/knowledge-candidate-route.ts"
    && readString(tests.file) === "tests/knowledge-regenerate-route.test.ts"
    && readNumber(tests.files) === 1
    && readNumber(tests.tests) === 18
    && readNumber(tests.failed) === 0
    && compatibility.requestSignalForwardedToGeneration === true
    && compatibility.abortSkipsProviderFallback === true
    && compatibility.originalSecurityBaselineRewritten === false
    && mutationBoundary.dbMutationPerformed === false
    && mutationBoundary.providerDispatchCalled === false
    && mutationBoundary.shareSessionCreated === false
    && mutationBoundary.ontologyPublicationPerformed === false
    && mutationBoundary.vectorOrEmbeddingMutationPerformed === false
    && mutationBoundary.koshaRegistryMutationPerformed === false
    && readString(remainingBoundaries.exactSavedShareVerdict) === "MISSING_EVIDENCE";
}

/** @param {string} rootDir @param {string} originalSourceHead */
function isHermesEventFactProviderCancellationCompatibilityCurrent(rootDir, originalSourceHead) {
  const report = readJsonFile(rootDir, EVIDENCE_PATHS.hermesReviewEventFactTraceability);
  if (!isRecord(report)) {
    return false;
  }
  const compatibilityContracts = isRecord(report.compatibilityContracts) ? report.compatibilityContracts : {};
  const compatibility = isRecord(compatibilityContracts.providerCancellation)
    ? compatibilityContracts.providerCancellation
    : {};
  const tests = isRecord(compatibility.focusedVitest) ? compatibility.focusedVitest : {};
  const mutationBoundary = isRecord(report.mutationBoundary) ? report.mutationBoundary : {};
  const remainingBoundaries = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  const sourceHead = readString(compatibility.sourceHead);
  return readString(compatibility.verdict) === "PASS_CURRENT_SOURCE_HERMES_EVENT_FACT_PROVIDER_CANCELLATION_COMPATIBILITY"
    && sourceHead === readString(report.productCommit)
    && isGitAncestor(rootDir, sourceHead)
    && isEvidenceCurrentForPaths(rootDir, sourceHead, ["lib/knowledge-candidate-route.ts"])
    && isEvidenceCurrentForPaths(rootDir, originalSourceHead, PUBLIC_PROVIDER_CANCELLATION_UNCHANGED_PATHS)
    && readString(compatibility.changedGovernedPath) === "lib/knowledge-candidate-route.ts"
    && readString(tests.file) === "tests/knowledge-regenerate-route.test.ts"
    && readNumber(tests.files) === 1
    && readNumber(tests.tests) === 18
    && readNumber(tests.failed) === 0
    && compatibility.requestSignalForwardedToGeneration === true
    && compatibility.abortSkipsProviderFallback === true
    && compatibility.originalSecurityBaselineRewritten === false
    && mutationBoundary.dbMutationPerformed === false
    && mutationBoundary.providerDispatchCalled === false
    && mutationBoundary.shareSessionCreated === false
    && mutationBoundary.ontologyPublicationPerformed === false
    && mutationBoundary.vectorOrEmbeddingMutationPerformed === false
    && mutationBoundary.koshaRegistryMutationPerformed === false
    && readString(remainingBoundaries.exactSavedShareVerdict) === "MISSING_EVIDENCE";
}

/**
 * @param {string} rootDir
 * @returns {GateResult}
 */
function evaluatePublicProviderCancellationGate(rootDir) {
  const evidencePath = EVIDENCE_PATHS.publicProviderCancellation;
  const report = readJsonFile(rootDir, evidencePath);
  if (!isRecord(report)) {
    return gateResult({
      id: "public_provider_cancellation",
      label: "Public provider cancellation",
      state: "missing",
      evidencePath,
      detail: "Public provider cancellation evidence is missing or invalid.",
      nextActions: ["Restore the deployed source-level cancellation evidence without invoking live providers."],
    });
  }

  const finding = isRecord(report.securityFinding) ? report.securityFinding : {};
  const contracts = isRecord(report.contracts) ? report.contracts : {};
  const weather = isRecord(contracts.weatherSharedWork) ? contracts.weatherSharedWork : {};
  const knowledge = isRecord(contracts.knowledgeRegeneration) ? contracts.knowledgeRegeneration : {};
  const remediation = isRecord(contracts.workpackRemediation) ? contracts.workpackRemediation : {};
  const verification = isRecord(report.verification) ? report.verification : {};
  const tests = isRecord(verification.focusedAndAdjacentVitest) ? verification.focusedAndAdjacentVitest : {};
  const build = isRecord(verification.build) ? verification.build : {};
  const production = isRecord(report.productionBuild) ? report.productionBuild : {};
  const currentRefresh = isRecord(report.currentSourceRefresh) ? report.currentSourceRefresh : {};
  const currentRefreshContracts = isRecord(currentRefresh.contracts) ? currentRefresh.contracts : {};
  const currentRefreshWeather = isRecord(currentRefreshContracts.weatherSharedWork)
    ? currentRefreshContracts.weatherSharedWork
    : {};
  const currentRefreshKnowledge = isRecord(currentRefreshContracts.knowledgeRegeneration)
    ? currentRefreshContracts.knowledgeRegeneration
    : {};
  const currentRefreshRemediation = isRecord(currentRefreshContracts.workpackRemediation)
    ? currentRefreshContracts.workpackRemediation
    : {};
  const currentRefreshVerification = isRecord(currentRefresh.verification) ? currentRefresh.verification : {};
  const currentRefreshTests = isRecord(currentRefreshVerification.focusedAndAdjacentVitest)
    ? currentRefreshVerification.focusedAndAdjacentVitest
    : {};
  const currentRefreshMutation = isRecord(currentRefresh.mutationBoundary)
    ? currentRefresh.mutationBoundary
    : {};
  const mutation = isRecord(report.mutationBoundary) ? report.mutationBoundary : {};
  const remaining = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  const sourceHead = readString(report.sourceHead);
  const wikiCandidateCancellationCompatibility = isWikiCandidateProviderCancellationCompatibilityCurrent(rootDir, sourceHead);
  const wikiSifCancellationCompatibility = isWikiSifProviderCancellationCompatibilityCurrent(rootDir, sourceHead);
  const eventFactCancellationCompatibility = isHermesEventFactProviderCancellationCompatibilityCurrent(rootDir, sourceHead);
  const currentRefreshSourceHead = readString(currentRefresh.sourceHead);
  const currentRefreshPresent = Object.keys(currentRefresh).length > 0;
  const currentRefreshNoMutation = currentRefreshMutation.dbMutationPerformed === false
    && currentRefreshMutation.providerDispatchCalled === false
    && currentRefreshMutation.shareSessionCreated === false
    && currentRefreshMutation.vectorRuntimeMutationPerformed === false
    && currentRefreshMutation.wikiPublicationPerformed === false
    && currentRefreshMutation.koshaRegistryMutationPerformed === false;
  const currentRefreshReceiptPass = readString(currentRefresh.verdict) === "PASS_LIVE_PRODUCTION_PUBLIC_PROVIDER_CANCELLATION_CURRENT_SOURCE_REFRESH"
    && currentRefreshSourceHead.length > 0
    && readString(currentRefresh.productionCommit) === currentRefreshSourceHead
    && readString(currentRefresh.productionBranch) === "master"
    && readString(currentRefresh.productionEnvironment) === "production"
    && readString(currentRefresh.deploymentUrl).length > 0
    && currentRefresh.liveProviderCallExecuted === false
    && isGitAncestor(rootDir, currentRefreshSourceHead)
    && currentRefreshWeather.requestSignalForwarded === true
    && currentRefreshWeather.equivalentRequestsCoalesced === true
    && currentRefreshWeather.singleConsumerDisconnectDoesNotCancelSharedProvider === true
    && currentRefreshWeather.finalConsumerDisconnectCancelsSharedProvider === true
    && currentRefreshKnowledge.requestSignalForwardedToGeneration === true
    && currentRefreshKnowledge.abortSkipsProviderFallback === true
    && currentRefreshRemediation.requestSignalForwardedToReferenceSearch === true
    && currentRefreshRemediation.requestSignalForwardedToGeneration === true
    && currentRefreshRemediation.abortSkipsProviderFallback === true
    && readNumber(currentRefreshTests.files) === 6
    && readNumber(currentRefreshTests.tests) === 49
    && readNumber(currentRefreshTests.failed) === 0
    && currentRefreshNoMutation;
  const sourceCurrent = isEvidenceCurrentForPaths(rootDir, sourceHead, PUBLIC_PROVIDER_CANCELLATION_PATHS)
    || (currentRefreshReceiptPass
      && isEvidenceCurrentForPaths(rootDir, currentRefreshSourceHead, PUBLIC_PROVIDER_CANCELLATION_PATHS))
    || isPublicProviderAdmissionCompatibilityCurrent(rootDir, "public_provider_cancellation", PUBLIC_PROVIDER_CANCELLATION_PATHS)
    || isPublicAskDistributedAdmissionCompatibilityCurrent(rootDir, "public_provider_cancellation", PUBLIC_PROVIDER_CANCELLATION_PATHS)
    || isPublicSearchDistributedAdmissionCompatibilityCurrent(rootDir, "public_provider_cancellation", PUBLIC_PROVIDER_CANCELLATION_PATHS)
    || isSecurityUpstreamTransportCompatibilityCurrent(rootDir, "public_provider_cancellation", PUBLIC_PROVIDER_CANCELLATION_PATHS)
    || isCurrentSecurityRemediationCompatibilityCurrent(rootDir, "public_provider_cancellation", PUBLIC_PROVIDER_CANCELLATION_PATHS)
    || wikiCandidateCancellationCompatibility
    || wikiSifCancellationCompatibility
    || eventFactCancellationCompatibility
    || isPublicAdmissionCurrentSourceCompatibilityCurrent(rootDir, "public_provider_cancellation", PUBLIC_PROVIDER_CANCELLATION_PATHS);
  const noMutation = mutation.dbMutationPerformed === false
    && mutation.providerDispatchCalled === false
    && mutation.shareSessionCreated === false
    && mutation.vectorRuntimeMutationPerformed === false
    && mutation.wikiPublicationPerformed === false
    && mutation.koshaRegistryMutationPerformed === false;
  const pass = readString(report.verdict) === "PASS_LIVE_PRODUCTION_PUBLIC_PROVIDER_CANCELLATION_SOURCE_PROVEN"
    && sourceHead.length > 0
    && sourceHead === readString(production.commitSha)
    && isGitAncestor(rootDir, sourceHead)
    && sourceCurrent
    && readString(production.branch) === "master"
    && readString(production.environment) === "production"
    && production.sourceHeadMatchesProduction === true
    && production.liveAfterDeploymentPending === false
    && production.liveProviderCallExecuted === false
    && readString(finding.scanId) === "c4e9e2f1-7ce4-4313-a651-32205fca401f"
    && readString(finding.findingId) === "csf_278e8efc9722eb80016c42a3"
    && readString(finding.anchor) === "provider-work-survives-disconnect"
    && finding.canonicalFindingRemainsImmutable === true
    && finding.followUpSecurityScanRequired === true
    && weather.requestSignalForwarded === true
    && weather.equivalentRequestsCoalesced === true
    && weather.singleConsumerDisconnectDoesNotCancelSharedProvider === true
    && weather.finalConsumerDisconnectCancelsSharedProvider === true
    && knowledge.requestSignalForwardedToGeneration === true
    && knowledge.abortSkipsProviderFallback === true
    && knowledge.dbMutationAllowed === false
    && remediation.requestSignalForwardedToReferenceSearch === true
    && remediation.requestSignalForwardedToGeneration === true
    && remediation.abortSkipsProviderFallback === true
    && remediation.dbMutationPerformed === false
    && readNumber(tests.files) === 9
    && readNumber(tests.tests) === 104
    && readNumber(tests.failed) === 0
    && verification.typecheck === "PASS"
    && readString(build.status) === "PASS"
    && readNumber(build.staticPages) === 28
    && verification.diffCheck === "PASS"
    && noMutation
    && readString(remaining.exactSavedShareVerdict) === "MISSING_EVIDENCE"
    && remaining.securityCompleteClaimAllowed === false
    && readString(remaining.followUpSecurityScan) === "REQUIRED"
    && remaining.approvalGatedOperationsUnchanged === true
    && (!currentRefreshPresent || currentRefreshReceiptPass);

  return gateResult({
    id: "public_provider_cancellation",
    label: "Public provider cancellation",
    state: pass ? "notice" : "contradicted",
    evidencePath,
    detail: pass
      ? `Weather coalescing cancels upstream work only after the final consumer disconnects, while knowledge regeneration and remediation forward caller cancellation through provider and reference paths. The original deployed receipt remains 9 files / 104 tests, and current source ${currentRefreshSourceHead.slice(0, 8)} adds a 6 files / 49 tests cancellation refresh${wikiCandidateCancellationCompatibility || wikiSifCancellationCompatibility || eventFactCancellationCompatibility ? " plus a current 1 file / 18 tests Knowledge regeneration cancellation compatibility receipt" : ""}; no live provider cancellation call was executed. The canonical finding remains immutable pending a follow-up scan, no mutation occurred, security-complete is false, and exact saved Share remains MISSING_EVIDENCE.`
      : `Provider cancellation verdict=${readString(report.verdict) || "unknown"}, sourceCurrent=${sourceCurrent}, refresh=${currentRefreshReceiptPass}, refreshHead=${currentRefreshSourceHead || "missing"}, tests=${readNumber(tests.tests)}/${readNumber(currentRefreshTests.tests)}, liveProviderCall=${production.liveProviderCallExecuted === true || currentRefresh.liveProviderCallExecuted === true}, followUp=${readString(remaining.followUpSecurityScan) || "missing"}, noMutation=${noMutation && (!currentRefreshPresent || currentRefreshNoMutation)}, exactShare=${readString(remaining.exactSavedShareVerdict) || "missing"}.`,
    nextActions: pass
      ? ["Run a fresh full-repository security scan before reclassifying the immutable finding or making a security-complete claim."]
      : ["Restore deployed source alignment, all cancellation contracts, verification totals, no-mutation boundaries, follow-up scan requirement, and exact Share MISSING_EVIDENCE."],
  });
}

const PUBLIC_PROVIDER_ADMISSION_PATHS = [
  "app/api/ask/route.ts",
  "app/api/ask/stream/route.ts",
  "app/api/knowledge/match/route.ts",
  "app/api/weather/route.ts",
  "lib/public-ask-admission.ts",
  "lib/public-distributed-rate-limit.ts",
  "lib/public-work-budget.ts",
];

/**
 * @param {string} rootDir
 * @returns {GateResult}
 */
function evaluatePublicProviderAdmissionGate(rootDir) {
  const evidencePath = EVIDENCE_PATHS.publicProviderAdmission;
  const report = readJsonFile(rootDir, evidencePath);
  if (!isRecord(report)) {
    return gateResult({
      id: "public_provider_admission",
      label: "Public provider admission",
      state: "missing",
      evidencePath,
      detail: "Public weighted provider admission evidence is missing or invalid.",
      nextActions: ["Restore the live no-provider admission evidence without claiming distributed activation."],
    });
  }

  const findings = Array.isArray(report.securityFindings) ? report.securityFindings.filter(isRecord) : [];
  const contracts = isRecord(report.contracts) ? report.contracts : {};
  const ask = isRecord(contracts.publicAskProviderAdmission) ? contracts.publicAskProviderAdmission : {};
  const weights = isRecord(ask.modeWeights) ? ask.modeWeights : {};
  const weather = isRecord(contracts.weatherAdmission) ? contracts.weatherAdmission : {};
  const knowledge = isRecord(contracts.knowledgeMatchAdmission) ? contracts.knowledgeMatchAdmission : {};
  const verification = isRecord(report.verification) ? report.verification : {};
  const focused = isRecord(verification.focusedVitest) ? verification.focusedVitest : {};
  const adjacent = isRecord(verification.focusedAndAdjacentVitest) ? verification.focusedAndAdjacentVitest : {};
  const build = isRecord(verification.build) ? verification.build : {};
  const production = isRecord(report.productionBuild) ? report.productionBuild : {};
  const liveChecks = Array.isArray(report.liveChecks) ? report.liveChecks.filter(isRecord) : [];
  const mutation = isRecord(report.mutationBoundary) ? report.mutationBoundary : {};
  const remaining = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  const sourceHead = readString(report.sourceHead);
  const expectedFindingIds = new Set([
    "csf_f5dd7b0bac8e0b7c7e531b29",
    "csf_a0ac317d9f81776462e0441a",
  ]);
  const noMutation = mutation.dbMutationPerformed === false
    && mutation.providerCallPerformedForEvidence === false
    && mutation.providerDispatchCalled === false
    && mutation.shareSessionCreated === false
    && mutation.vectorRuntimeMutationPerformed === false
    && mutation.wikiPublicationPerformed === false
    && mutation.koshaRegistryMutationPerformed === false;
  const pass = readString(report.verdict) === "PARTIAL_LIVE_PRODUCTION_WEIGHTED_INSTANCE_ADMISSION_DISTRIBUTED_ACTIVATION_PENDING"
    && sourceHead.length > 0
    && sourceHead === readString(production.commitSha)
    && isGitAncestor(rootDir, sourceHead)
    && (isEvidenceCurrentForPaths(rootDir, sourceHead, PUBLIC_PROVIDER_ADMISSION_PATHS)
      || isSecurityResourceRemediationCompatibilityCurrent(rootDir, "public_provider_admission", PUBLIC_PROVIDER_ADMISSION_PATHS)
      || isCurrentSecurityRemediationCompatibilityCurrent(rootDir, "public_provider_admission", PUBLIC_PROVIDER_ADMISSION_PATHS)
      || isPostRemediationSecuritySourceCompatibilityCurrent(rootDir, "public_provider_admission", PUBLIC_PROVIDER_ADMISSION_PATHS)
      || isPublicAskDistributedAdmissionCompatibilityCurrent(rootDir, "public_provider_admission", PUBLIC_PROVIDER_ADMISSION_PATHS)
      || isPublicSearchDistributedAdmissionCompatibilityCurrent(rootDir, "public_provider_admission", PUBLIC_PROVIDER_ADMISSION_PATHS)
      || isDocumentExportAdmissionCompatibilityCurrent(rootDir, "public_provider_admission", PUBLIC_PROVIDER_ADMISSION_PATHS)
      || isPublicAdmissionCurrentSourceCompatibilityCurrent(rootDir, "public_provider_admission", PUBLIC_PROVIDER_ADMISSION_PATHS)
      || isCurrentSecurityGovernedPathCompatibility(rootDir, "public_provider_admission", PUBLIC_PROVIDER_ADMISSION_PATHS))
    && findings.length === 2
    && findings.every((item) => readString(item.scanId) === "c4e9e2f1-7ce4-4313-a651-32205fca401f"
      && expectedFindingIds.has(readString(item.findingId))
      && item.canonicalFindingRemainsImmutable === true
      && item.followUpSecurityScanRequired === true)
    && ask.distributedLeaseSupported === true
    && readString(ask.productionFallbackMode) === "instance"
    && readNumber(ask.capacity) === 12
    && readNumber(weights.template) === 0
    && readNumber(weights.enhanced) === 2
    && readNumber(weights.full) === 12
    && ask.queueRejectedBeforeProviderWork === true
    && ask.jsonLeaseReleasedAfterWork === true
    && ask.streamLeaseHeldUntilCompletionOrCancellation === true
    && weather.distributedRateLimitSupported === true
    && readString(weather.productionFallbackMode) === "instance"
    && readNumber(weather.questionMaxChars) === 240
    && knowledge.distributedRateLimitSupported === true
    && readString(knowledge.productionFallbackMode) === "instance"
    && readNumber(knowledge.questionMaxChars) === 900
    && readNumber(knowledge.requestMaxBytes) === 16_384
    && readNumber(focused.files) === 7
    && readNumber(focused.tests) === 38
    && readNumber(focused.failed) === 0
    && readNumber(adjacent.files) === 10
    && readNumber(adjacent.tests) === 52
    && readNumber(adjacent.failed) === 0
    && verification.typecheck === "PASS"
    && readString(build.status) === "PASS"
    && readNumber(build.staticPages) === 28
    && verification.diffCheck === "PASS"
    && readString(production.branch) === "master"
    && readString(production.environment) === "production"
    && production.sourceHeadMatchesProduction === true
    && production.liveAfterDeploymentPending === false
    && production.liveTemplateAskExecuted === true
    && production.liveProviderBackedAskExecuted === false
    && production.liveWeatherProviderCallExecuted === false
    && production.liveKnowledgeMatchExecuted === false
    && liveChecks.length === 3
    && liveChecks.some((item) => readString(item.path) === "/api/ask"
      && readNumber(item.status) === 200
      && readString(item.rateLimitMode) === "instance"
      && readString(item.aiMode) === "template"
      && readNumber(item.workUnit) === 0)
    && liveChecks.some((item) => readString(item.path) === "/api/weather"
      && readNumber(item.status) === 413
      && readString(item.rateLimitMode) === "instance"
      && readString(item.code) === "PUBLIC_WORK_BUDGET_EXCEEDED")
    && liveChecks.some((item) => readString(item.path) === "/api/knowledge/match"
      && readNumber(item.status) === 413
      && readString(item.rateLimitMode) === "instance"
      && readString(item.code) === "PUBLIC_WORK_BUDGET_EXCEEDED")
    && noMutation
    && readString(remaining.distributedProductionActivation) === "PENDING_CONFIGURATION"
    && readString(remaining.exactSavedShareVerdict) === "MISSING_EVIDENCE"
    && remaining.securityCompleteClaimAllowed === false
    && readString(remaining.followUpSecurityScan) === "REQUIRED"
    && remaining.approvalGatedOperationsUnchanged === true;

  return gateResult({
    id: "public_provider_admission",
    label: "Public provider admission",
    state: pass ? "notice" : "contradicted",
    evidencePath,
    detail: pass
      ? "Current production enforces mode-weighted provider work units (template 0, enhanced 2, full 12) with completion/cancellation release, 23 files / 215 tests governed-path compatibility, and live no-provider work-budget probes across ask, weather, and knowledge. Production still reports process-instance admission because Upstash is not configured; both canonical medium findings remain immutable, distributed activation and a fresh follow-up scan remain required, no mutation occurred, security-complete is false, and exact saved Share remains MISSING_EVIDENCE."
      : `Public provider admission verdict=${readString(report.verdict) || "unknown"}, sourceCurrent=${sourceHead.length > 0 && isEvidenceCurrentForPaths(rootDir, sourceHead, PUBLIC_PROVIDER_ADMISSION_PATHS)}, findings=${findings.length}, liveChecks=${liveChecks.length}, distributed=${readString(remaining.distributedProductionActivation) || "missing"}, followUp=${readString(remaining.followUpSecurityScan) || "missing"}, noMutation=${noMutation}, exactShare=${readString(remaining.exactSavedShareVerdict) || "missing"}.`,
    nextActions: pass
      ? [
          "Configure and verify an approved distributed admission backend before claiming horizontal durability.",
          "Run a fresh full-repository security scan before reclassifying either immutable finding or making a security-complete claim.",
        ]
      : ["Restore source/live alignment, weighted contracts, all three no-provider live probes, verification totals, instance/distributed boundary, no-mutation boundary, follow-up scan requirement, and exact Share MISSING_EVIDENCE."],
  });
}

const PUBLIC_ASK_DISTRIBUTED_ADMISSION_PATHS = [
  "app/api/ask/route.ts",
  "app/api/ask/stream/route.ts",
  "components/SafeGuardCommandCenter.tsx",
  "lib/ask-stream-client.ts",
  "lib/public-ask-admission.ts",
];

/**
 * @param {string} rootDir
 * @returns {GateResult}
 */
function evaluatePublicAskDistributedAdmissionGate(rootDir) {
  const evidencePath = EVIDENCE_PATHS.publicAskDistributedAdmission;
  const report = readJsonFile(rootDir, evidencePath);
  if (!isRecord(report)) {
    return gateResult({
      id: "public_ask_distributed_admission",
      label: "Public Ask distributed admission",
      state: "missing",
      evidencePath,
      detail: "Public Ask distributed admission fail-closed evidence is missing or invalid.",
      nextActions: ["Restore the deployed JSON/SSE fail-closed evidence without claiming distributed backend activation."],
    });
  }

  const finding = isRecord(report.securityFinding) ? report.securityFinding : {};
  const contract = isRecord(report.currentSourceContract) ? report.currentSourceContract : {};
  const local = isRecord(report.localProductionProbe) ? report.localProductionProbe : {};
  const localCases = Array.isArray(local.cases) ? local.cases.filter(isRecord) : [];
  const live = isRecord(report.liveProductionProbe) ? report.liveProductionProbe : {};
  const liveCases = Array.isArray(live.cases) ? live.cases.filter(isRecord) : [];
  const verification = isRecord(report.verification) ? report.verification : {};
  const focused = isRecord(verification.focusedVitest) ? verification.focusedVitest : {};
  const adjacent = isRecord(verification.focusedAndAdjacentVitest) ? verification.focusedAndAdjacentVitest : {};
  const build = isRecord(verification.build) ? verification.build : {};
  const production = isRecord(report.productionBuild) ? report.productionBuild : {};
  const mutation = isRecord(report.mutationBoundary) ? report.mutationBoundary : {};
  const remaining = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  const sourceHead = readString(report.sourceHead);
  const productCommit = readString(report.productCommit);
  const productionCommit = readString(report.productionCommit);
  const casePass = (items, pathName, caseName, status, rateLimitMode, code = "") => items.some((item) => (
    readString(item.path) === pathName
    && readString(item.case) === caseName
    && readNumber(item.status) === status
    && readString(item.rateLimitMode) === rateLimitMode
    && (code.length === 0 || readString(item.code) === code)
  ));
  const templatePass = (items) => items.some((item) => (
    readString(item.path) === "/api/ask"
    && readString(item.case) === "template-no-provider"
    && readNumber(item.status) === 200
    && readString(item.rateLimitMode) === "instance"
    && readString(item.aiMode) === "template"
    && readNumber(item.workUnit) === 0
  ));
  const noMutation = mutation.dbMutationPerformed === false
    && mutation.providerCallPerformedForEvidence === false
    && mutation.providerDispatchCalled === false
    && mutation.shareSessionCreated === false
    && mutation.vectorRuntimeMutationPerformed === false
    && mutation.wikiPublicationPerformed === false
    && mutation.koshaRegistryMutationPerformed === false;
  const pass = readString(report.verdict) === "PASS_LIVE_PRODUCTION_PUBLIC_ASK_PROVIDER_MODES_FAIL_CLOSED_WITHOUT_DISTRIBUTED_ADMISSION"
    && sourceHead.length > 0
    && sourceHead === productCommit
    && productionCommit.length > 0
    && isGitAncestor(rootDir, sourceHead)
    && isGitAncestor(rootDir, productionCommit)
    && (isEvidenceCurrentForPaths(rootDir, sourceHead, PUBLIC_ASK_DISTRIBUTED_ADMISSION_PATHS)
      || isPublicAdmissionCurrentSourceCompatibilityCurrent(rootDir, "public_ask_distributed_admission", PUBLIC_ASK_DISTRIBUTED_ADMISSION_PATHS)
      || isCurrentSecurityGovernedPathCompatibility(rootDir, "public_ask_distributed_admission", PUBLIC_ASK_DISTRIBUTED_ADMISSION_PATHS))
    && readString(finding.findingId) === "csf_9b3cc6648586dabf4bfa61e9"
    && finding.canonicalFindingRemainsImmutable === true
    && finding.freshFollowUpScanRequired === true
    && readNumber(contract.templateProviderWorkUnit) === 0
    && contract.templateRequiresDistributedAdmission === false
    && readNumber(contract.enhancedProviderWorkUnit) === 2
    && readNumber(contract.fullProviderWorkUnit) === 12
    && contract.providerModesRequireDistributedRateAdmissionInProduction === true
    && contract.providerModesRequireDistributedWeightedLeaseInProduction === true
    && contract.jsonAndSseShareFailClosedContract === true
    && contract.explicitHttpAdmissionFailureRetriedViaLegacyJson === false
    && contract.providerWorkStartsAfterAdmission === true
    && local.distributedBackendConfigured === false
    && local.providerCallExecuted === false
    && localCases.length === 3
    && templatePass(localCases)
    && casePass(localCases, "/api/ask", "enhanced-distributed-unavailable", 503, "distributed", "DISTRIBUTED_RATE_LIMIT_UNAVAILABLE")
    && casePass(localCases, "/api/ask/stream", "enhanced-distributed-unavailable", 503, "distributed", "DISTRIBUTED_RATE_LIMIT_UNAVAILABLE")
    && readString(live.productionCommit) === productionCommit
    && live.providerCallExecuted === false
    && liveCases.length === 5
    && templatePass(liveCases)
    && casePass(liveCases, "/api/ask", "enhanced-distributed-unavailable", 503, "distributed", "DISTRIBUTED_RATE_LIMIT_UNAVAILABLE")
    && casePass(liveCases, "/api/ask", "full-distributed-unavailable", 503, "distributed", "DISTRIBUTED_RATE_LIMIT_UNAVAILABLE")
    && casePass(liveCases, "/api/ask/stream", "enhanced-distributed-unavailable", 503, "distributed", "DISTRIBUTED_RATE_LIMIT_UNAVAILABLE")
    && casePass(liveCases, "/api/ask/stream", "full-distributed-unavailable", 503, "distributed", "DISTRIBUTED_RATE_LIMIT_UNAVAILABLE")
    && readNumber(focused.files) === 3
    && readNumber(focused.tests) === 21
    && readNumber(focused.failed) === 0
    && readNumber(adjacent.files) === 11
    && readNumber(adjacent.tests) === 67
    && readNumber(adjacent.failed) === 0
    && verification.typecheck === "PASS"
    && readString(build.status) === "PASS"
    && readNumber(build.staticPages) === 28
    && readNumber(verification.dependencyAuditVulnerabilities) === 0
    && verification.diffCheck === "PASS"
    && readString(production.currentCommitSha) === productionCommit
    && production.productCommitDeployed === true
    && production.liveAfterDeploymentPending === false
    && production.previewDeploymentCompleted === true
    && noMutation
    && readString(remaining.exactSavedShareVerdict) === "MISSING_EVIDENCE"
    && remaining.securityCompleteClaimAllowed === false
    && readString(remaining.freshFollowUpScan) === "REQUIRED"
    && readString(remaining.distributedBackendActivation) === "OPERATOR_CONFIGURATION_REQUIRED"
    && remaining.approvalGatedOperationsUnchanged === true;

  return gateResult({
    id: "public_ask_distributed_admission",
    label: "Public Ask distributed admission",
    state: pass ? "proven" : "contradicted",
    evidencePath,
    detail: pass
      ? "Current production keeps template work at zero and fails JSON/SSE enhanced/full closed with DISTRIBUTED_RATE_LIMIT_UNAVAILABLE before provider work when distributed admission is unavailable. The immutable csf_9b3cc6648586dabf4bfa61e9 finding still requires a fresh scan; backend activation is OPERATOR_CONFIGURATION_REQUIRED, no provider or mutation was used, security-complete is false, and exact saved Share remains MISSING_EVIDENCE."
      : `Public Ask distributed admission verdict=${readString(report.verdict) || "unknown"}, sourceCurrent=${sourceHead.length > 0 && isEvidenceCurrentForPaths(rootDir, sourceHead, PUBLIC_ASK_DISTRIBUTED_ADMISSION_PATHS)}, finding=${readString(finding.findingId) || "missing"}, localCases=${localCases.length}, liveCases=${liveCases.length}, providerCall=${local.providerCallExecuted === true || live.providerCallExecuted === true}, activation=${readString(remaining.distributedBackendActivation) || "missing"}, rescan=${readString(remaining.freshFollowUpScan) || "missing"}, noMutation=${noMutation}, exactShare=${readString(remaining.exactSavedShareVerdict) || "missing"}.`,
    nextActions: pass
      ? [
          "Configure and verify an approved distributed admission backend before enabling enhanced/full provider modes horizontally.",
          "Run a fresh repository security scan before reclassifying the immutable finding or making a security-complete claim.",
        ]
      : ["Restore deployed source alignment, all JSON/SSE template/enhanced/full cases, verification totals, no-provider/no-mutation boundaries, fresh-scan requirement, and exact Share MISSING_EVIDENCE."],
  });
}

const PUBLIC_SEARCH_DISTRIBUTED_ADMISSION_PATHS = [
  "app/api/search/route.ts",
  "app/api/safety-reference/search/route.ts",
  "app/api/weather/route.ts",
  "lib/public-search-admission.ts",
];

/**
 * @param {string} rootDir
 * @returns {GateResult}
 */
function evaluatePublicSearchDistributedAdmissionGate(rootDir) {
  const evidencePath = EVIDENCE_PATHS.publicSearchDistributedAdmission;
  const report = readJsonFile(rootDir, evidencePath);
  if (!isRecord(report)) {
    return gateResult({
      id: "public_search_distributed_admission",
      label: "Public search distributed admission",
      state: "missing",
      evidencePath,
      detail: "Public search weighted distributed admission evidence is missing or invalid.",
      nextActions: ["Restore deployed legal, safety-reference, and weather fail-closed evidence."],
    });
  }

  const finding = isRecord(report.securityFinding) ? report.securityFinding : {};
  const contract = isRecord(report.currentSourceContract) ? report.currentSourceContract : {};
  const weights = isRecord(contract.weights) ? contract.weights : {};
  const live = isRecord(report.liveProductionProbe) ? report.liveProductionProbe : {};
  const cases = Array.isArray(live.cases) ? live.cases.filter(isRecord) : [];
  const verification = isRecord(report.verification) ? report.verification : {};
  const focused = isRecord(verification.focusedAndAdjacentVitest) ? verification.focusedAndAdjacentVitest : {};
  const coalesced = isRecord(verification.coalescedDistributedLeaseRegression)
    ? verification.coalescedDistributedLeaseRegression
    : {};
  const build = isRecord(verification.build) ? verification.build : {};
  const production = isRecord(report.productionBuild) ? report.productionBuild : {};
  const mutation = isRecord(report.mutationBoundary) ? report.mutationBoundary : {};
  const remaining = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  const sourceHead = readString(report.sourceHead);
  const productCommit = readString(report.productCommit);
  const productionCommit = readString(report.productionCommit);
  const casePass = (pathName, kind) => cases.some((item) => (
    readString(item.path) === pathName
    && readString(item.kind) === kind
    && readNumber(item.status) === 503
    && readString(item.rateLimitMode) === "distributed"
    && readString(item.code) === "DISTRIBUTED_RATE_LIMIT_UNAVAILABLE"
    && readNumber(item.retryAfterSeconds) === 5
  ));
  const noMutation = mutation.dbMutationPerformed === false
    && mutation.providerCallPerformedForEvidence === false
    && mutation.providerDispatchCalled === false
    && mutation.shareSessionCreated === false
    && mutation.vectorRuntimeMutationPerformed === false
    && mutation.wikiPublicationPerformed === false
    && mutation.koshaRegistryMutationPerformed === false;
  const pass = readString(report.verdict) === "PASS_LIVE_PRODUCTION_PUBLIC_SEARCH_PROVIDER_WORK_FAILS_CLOSED_WITHOUT_DISTRIBUTED_ADMISSION"
    && sourceHead.length > 0
    && sourceHead === productCommit
    && productCommit === productionCommit
    && isGitAncestor(rootDir, sourceHead)
    && (isEvidenceCurrentForPaths(rootDir, sourceHead, PUBLIC_SEARCH_DISTRIBUTED_ADMISSION_PATHS)
      || isPublicAdmissionCurrentSourceCompatibilityCurrent(rootDir, "public_search_distributed_admission", PUBLIC_SEARCH_DISTRIBUTED_ADMISSION_PATHS))
    && readString(finding.findingId) === "csf_bb897a39277591f4fbab0ca7"
    && finding.canonicalFindingRemainsImmutable === true
    && finding.freshFollowUpScanRequired === true
    && readNumber(contract.capacity) === 12
    && readNumber(contract.leaseMs) === 70000
    && readString(contract.namespace) === "public-search-provider-work"
    && readNumber(weights.legal) === 6
    && readNumber(weights["safety-reference"]) === 3
    && readNumber(weights.weather) === 1
    && contract.validRequestsRequireDistributedRateAdmissionInProduction === true
    && contract.newCoalescedJobsRequireDistributedWeightedLeaseInProduction === true
    && contract.leaseCountedPerCoalescedUpstreamJob === true
    && contract.leaseReleasedOnSuccessErrorAndFinalConsumerCancellation === true
    && contract.providerWorkStartsAfterAdmission === true
    && readString(live.productionCommit) === productionCommit
    && live.distributedBackendConfigured === false
    && live.providerCallExecutedForEvidence === false
    && cases.length === 3
    && casePass("/api/search", "legal")
    && casePass("/api/safety-reference/search", "safety-reference")
    && casePass("/api/weather", "weather")
    && readNumber(focused.files) === 5
    && readNumber(focused.tests) === 35
    && readNumber(focused.failed) === 0
    && readNumber(coalesced.httpConsumers) === 2
    && readNumber(coalesced.upstreamJobs) === 1
    && readNumber(coalesced.leaseAcquires) === 1
    && readNumber(coalesced.leaseReleases) === 1
    && verification.typecheck === "PASS"
    && readString(build.status) === "PASS"
    && verification.diffCheck === "PASS"
    && readString(production.currentCommitSha) === productionCommit
    && production.productCommitDeployed === true
    && production.liveAfterDeploymentPending === false
    && noMutation
    && readString(remaining.exactSavedShareVerdict) === "MISSING_EVIDENCE"
    && remaining.securityCompleteClaimAllowed === false
    && readString(remaining.freshFollowUpScan) === "REQUIRED"
    && readString(remaining.distributedBackendActivation) === "OPERATOR_CONFIGURATION_REQUIRED"
    && remaining.approvalGatedOperationsUnchanged === true;

  return gateResult({
    id: "public_search_distributed_admission",
    label: "Public search distributed admission",
    state: pass ? "proven" : "contradicted",
    evidencePath,
    detail: pass
      ? "Live legal, safety-reference, and weather provider work fails closed before upstream calls without distributed admission. Shared capacity is 12 with weights 6/3/1 per coalesced job. Immutable finding csf_bb897a39277591f4fbab0ca7 still requires a fresh scan; activation is OPERATOR_CONFIGURATION_REQUIRED, security-complete is false, no mutation occurred, and exact saved Share remains MISSING_EVIDENCE."
      : `Public search admission verdict=${readString(report.verdict) || "unknown"}, sourceCurrent=${sourceHead.length > 0 && isEvidenceCurrentForPaths(rootDir, sourceHead, PUBLIC_SEARCH_DISTRIBUTED_ADMISSION_PATHS)}, finding=${readString(finding.findingId) || "missing"}, liveCases=${cases.length}, providerCall=${live.providerCallExecutedForEvidence === true}, activation=${readString(remaining.distributedBackendActivation) || "missing"}, rescan=${readString(remaining.freshFollowUpScan) || "missing"}, noMutation=${noMutation}, exactShare=${readString(remaining.exactSavedShareVerdict) || "missing"}.`,
    nextActions: pass
      ? [
          "Configure and verify the approved distributed backend before enabling horizontal provider work.",
          "Run a fresh repository security scan before reclassifying the immutable finding.",
        ]
      : ["Restore source/live alignment, all three live cases, weighted coalesced lease receipts, no-mutation boundaries, fresh-scan requirement, and exact Share MISSING_EVIDENCE."],
  });
}

const MCP_GENERATION_WORK_BUDGET_SECURITY_PATHS = [
  "app/api/mcp/[transport]/implementation.ts",
  "app/api/mcp/[transport]/route.ts",
  "lib/rate-limit.ts",
];

/**
 * @param {string} rootDir
 * @returns {GateResult}
 */
function evaluatePublicGenerationAdmissionSecurityGate(rootDir) {
  const evidencePath = EVIDENCE_PATHS.publicGenerationAdmissionSecurity;
  const report = readJsonFile(rootDir, evidencePath);
  if (!isRecord(report)) {
    return gateResult({
      id: "public_generation_admission_security",
      label: "Public generation admission security",
      state: "missing",
      evidencePath,
      detail: "Public generation admission security evidence is missing or invalid.",
      nextActions: ["Restore the live no-AI admission probes and preserve the distributed-hardening and rescan boundaries."],
    });
  }

  const baseScan = isRecord(report.baseSecurityScan) ? report.baseSecurityScan : {};
  const runtimeBoundary = isRecord(report.runtimeBoundary) ? report.runtimeBoundary : {};
  const beforeLive = isRecord(report.beforeLive) ? report.beforeLive : {};
  const afterLocal = isRecord(report.afterLocal) ? report.afterLocal : {};
  const afterLive = isRecord(report.afterLive) ? report.afterLive : {};
  const beforeLiveChecks = Array.isArray(beforeLive.probes) ? beforeLive.probes.filter(isRecord) : [];
  const afterLocalChecks = Array.isArray(afterLocal.probes) ? afterLocal.probes.filter(isRecord) : [];
  const afterLiveChecks = Array.isArray(afterLive.probes) ? afterLive.probes.filter(isRecord) : [];
  const dependencyAudit = isRecord(report.dependencyAudit) ? report.dependencyAudit : {};
  const auditAfter = isRecord(dependencyAudit.after) ? dependencyAudit.after : {};
  const verification = isRecord(report.verification) ? report.verification : {};
  const focused = isRecord(verification.focused) ? verification.focused : {};
  const northstar = isRecord(verification.northstar) ? verification.northstar : {};
  const build = isRecord(verification.build) ? verification.build : {};
  const npmAudit = isRecord(verification.npmAudit) ? verification.npmAudit : {};
  const mutationBoundary = isRecord(report.mutationBoundary) ? report.mutationBoundary : {};
  const remainingBoundaries = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  const controls = Array.isArray(report.admissionControls) ? report.admissionControls.filter(isRecord) : [];
  const productCommit = readString(report.productCommit);
  const noMutation = mutationBoundary.dbMutationPerformed === false
    && mutationBoundary.providerDispatchCalled === false
    && mutationBoundary.shareSessionCreated === false
    && mutationBoundary.vectorOrEmbeddingMutationPerformed === false
    && mutationBoundary.wikiPublicationPerformed === false
    && mutationBoundary.koshaRegistryMutationPerformed === false;
  const routeSetPass = (checks, expectedStatus, expectedMode, expectedCode = "") => checks.length === 2
    && checks.some((check) => readString(check.route) === "/api/knowledge/regenerate")
    && checks.some((check) => readString(check.route) === "/api/workpack/remediate")
    && checks.every((check) => readNumber(check.status) === expectedStatus
      && readString(check.rateLimitHeader) === expectedMode
      && (expectedCode.length === 0 || readString(check.code) === expectedCode)
      && check.providerCallPerformed === false
      && check.referenceSearchPerformed === false
      && check.dbMutationPerformed === false);
  const beforeLivePass = readString(beforeLive.sourceHead).length > 0
    && isGitAncestor(rootDir, readString(beforeLive.sourceHead))
    && routeSetPass(beforeLiveChecks, 400, "instance");
  const afterLocalPass = readString(afterLocal.sourceHead) === productCommit
    && readString(afterLocal.mode) === "current-source-local-production"
    && routeSetPass(afterLocalChecks, 503, "distributed", "DISTRIBUTED_RATE_LIMIT_UNAVAILABLE");
  const afterLivePass = readString(afterLive.sourceHead) === productCommit
    && readString(afterLive.productionCommit) === productCommit
    && readString(afterLive.productionBranch) === "master"
    && readString(afterLive.productionEnvironment) === "production"
    && readString(afterLive.deploymentUrl).length > 0
    && routeSetPass(afterLiveChecks, 503, "distributed", "DISTRIBUTED_RATE_LIMIT_UNAVAILABLE");
  const pass = readString(report.verdict) === "PASS_LIVE_PRODUCTION_PUBLIC_GENERATION_DISTRIBUTED_CONFIGURATION_TRUTH"
    && productCommit.length > 0
    && isGitAncestor(rootDir, productCommit)
    && isEvidenceCurrentForPaths(rootDir, productCommit, PUBLIC_GENERATION_ADMISSION_SECURITY_PATHS)
    && readString(report.productionCommit) === productCommit
    && readString(baseScan.scanId) === "d12d04ce-deaf-497d-8754-33d5baab2ca0"
    && readString(baseScan.targetCommit) === "e087d474a1de72bd3687c703a61a4263fe792fa4"
    && baseScan.immutableBaselinePreserved === true
    && readNumber(baseScan.reportableFindingCount) === 28
    && controls.length === 2
    && controls.some((control) => readString(control.route) === "/api/knowledge/regenerate"
      && readString(control.namespace) === "knowledge-regeneration"
      && readNumber(control.limit) === 20
      && readNumber(control.windowMs) === 60_000
      && control.beforeRequestBodyParsing === true
      && control.beforeAiGeneration === true
      && control.requireDistributedInProduction === true)
    && controls.some((control) => readString(control.route) === "/api/workpack/remediate"
      && readString(control.namespace) === "workpack-remediation"
      && readNumber(control.limit) === 12
      && readNumber(control.windowMs) === 60_000
      && control.beforeRequestBodyParsing === true
      && control.beforeReferenceSearch === true
      && control.beforeAiGeneration === true
      && control.requireDistributedInProduction === true)
    && runtimeBoundary.productionRequiresDistributedAdmission === true
    && runtimeBoundary.productionInstanceFallbackAllowed === false
    && runtimeBoundary.developmentInstanceFallbackAllowed === true
    && runtimeBoundary.partialDistributedConfigFailsClosed === true
    && runtimeBoundary.absentDistributedConfigFailsClosed === true
    && runtimeBoundary.liveDeploymentVerified === true
    && readString(runtimeBoundary.configurationState) === "absent"
    && readString(runtimeBoundary.readinessMode) === "unavailable"
    && readString(runtimeBoundary.observedResponseMode) === "distributed"
    && runtimeBoundary.responseModeHeaderDoesNotProveConfigurationReady === true
    && runtimeBoundary.distributedProtectionConfiguredLive === false
    && runtimeBoundary.distributedProductionActivationPending === true
    && readString(runtimeBoundary.successHeader) === "X-SafeClaw-Rate-Limit"
    && beforeLivePass
    && afterLocalPass
    && afterLivePass
    && readNumber(auditAfter.total) === 0
    && readString(focused.status) === "PASS"
    && readNumber(focused.files) === 3
    && readNumber(focused.tests) === 34
    && readString(northstar.status) === "PASS"
    && readNumber(northstar.files) === 3
    && readNumber(northstar.tests) >= 174
    && verification.typecheck === "PASS"
    && readString(build.verdict) === "PASS"
    && readNumber(build.staticPages) === 28
    && readString(npmAudit.verdict) === "PASS"
    && readNumber(npmAudit.vulnerabilityCount) === 0
    && verification.diffCheck === "PASS"
    && noMutation
    && readString(remainingBoundaries.exactSavedShareVerdict) === "MISSING_EVIDENCE"
    && remainingBoundaries.approvalGatedOperationsUnchanged === true
    && remainingBoundaries.freshPostChangeSecurityRescanRequired === true
    && remainingBoundaries.liveDeploymentVerificationRequired === false
    && remainingBoundaries.distributedProductionActivationPending === true;

  return gateResult({
    id: "public_generation_admission_security",
    label: "Public generation admission security",
    state: pass ? "notice" : "contradicted",
    evidencePath,
    detail: pass
      ? `Current production ${productCommit.slice(0, 8)} requires distributed admission before body parsing on both public generation routes. The before-live 400/instance behavior is preserved, while local and live after-remediation probes return 503 DISTRIBUTED_RATE_LIMIT_UNAVAILABLE before reference search, AI/provider work, or DB mutation when configurationState=absent. Distributed activation and a fresh scan remain open; the immutable baseline is preserved, and exact saved Share remains MISSING_EVIDENCE.`
      : `Generation admission verdict=${readString(report.verdict) || "unknown"}, productPathsCurrent=${productCommit.length > 0 && isEvidenceCurrentForPaths(rootDir, productCommit, PUBLIC_GENERATION_ADMISSION_SECURITY_PATHS)}, before=${beforeLivePass}, local=${afterLocalPass}, live=${afterLivePass}, config=${readString(runtimeBoundary.configurationState) || "unknown"}, focused=${readNumber(focused.tests)}, northstar=${readNumber(northstar.tests)}, rescanPending=${remainingBoundaries.freshPostChangeSecurityRescanRequired === true}, noMutation=${noMutation}, exactShare=${readString(remainingBoundaries.exactSavedShareVerdict) || "missing"}.`,
    nextActions: pass
      ? [
          "Preserve the immutable scan baseline and run a fresh full repository scan before closing the remediated generation finding.",
          "Configure approved server-only Upstash credentials and require configurationState=ready before claiming active distributed protection.",
        ]
      : ["Restore the live admission, zero-audit, no-mutation, immutable-baseline, rescan-pending, and exact-Share boundaries."],
  });
}

/**
 * @param {string} rootDir
 * @returns {GateResult}
 */
function evaluateMcpGenerationWorkBudgetSecurityGate(rootDir) {
  const evidencePath = EVIDENCE_PATHS.mcpGenerationWorkBudgetSecurity;
  const report = readJsonFile(rootDir, evidencePath);
  if (!isRecord(report)) {
    return gateResult({
      id: "mcp_generation_work_budget_security",
      label: "MCP generation work-budget security",
      state: "missing",
      evidencePath,
      detail: "MCP generation work-budget evidence is missing or invalid.",
      nextActions: ["Restore the deployed source, bounded-body, limiter, no-mutation, runtime-probe, rescan, and exact-Share evidence."],
    });
  }

  const baseline = isRecord(report.canonicalBaseline) ? report.canonicalBaseline : {};
  const contract = isRecord(report.currentSourceContract) ? report.currentSourceContract : {};
  const rateLimit = isRecord(contract.rateLimit) ? contract.rateLimit : {};
  const ordering = isRecord(contract.ordering) ? contract.ordering : {};
  const preserved = isRecord(contract.preservedBehavior) ? contract.preservedBehavior : {};
  const verification = isRecord(report.verification) ? report.verification : {};
  const focused = isRecord(verification.focused) ? verification.focused : {};
  const adjacent = isRecord(verification.adjacentMcp) ? verification.adjacentMcp : {};
  const build = isRecord(verification.build) ? verification.build : {};
  const liveProbe = isRecord(verification.liveReadOnlyProbe) ? verification.liveReadOnlyProbe : {};
  const currentLiveRefresh = isRecord(report.currentLiveRefresh) ? report.currentLiveRefresh : {};
  const currentRefreshProbe = isRecord(currentLiveRefresh.probe) ? currentLiveRefresh.probe : {};
  const currentRefreshReadiness = isRecord(currentLiveRefresh.configurationReadiness)
    ? currentLiveRefresh.configurationReadiness
    : {};
  const currentRefreshMutation = isRecord(currentLiveRefresh.mutationBoundary)
    ? currentLiveRefresh.mutationBoundary
    : {};
  const remaining = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  const mutation = isRecord(report.mutationBoundary) ? report.mutationBoundary : {};
  const sourceHead = readString(report.sourceHead);
  const productionCommit = readString(report.productionCommit);
  const currentRefreshSourceHead = readString(currentLiveRefresh.sourceHead);
  const currentRefreshVerification = isRecord(currentLiveRefresh.verification)
    ? currentLiveRefresh.verification
    : {};
  const currentRefreshFocused = isRecord(currentRefreshVerification.focused)
    ? currentRefreshVerification.focused
    : {};
  const currentRefreshAdjacent = isRecord(currentRefreshVerification.adjacentMcp)
    ? currentRefreshVerification.adjacentMcp
    : {};
  const noMutation = mutation.dbMutationPerformed === false
    && mutation.providerDispatchCalled === false
    && mutation.shareSessionCreated === false
    && mutation.embeddingOrVectorMutationPerformed === false
    && mutation.wikiPublished === false
    && mutation.koshaExactRegistryMutationPerformed === false;
  const currentRefreshNoMutation = currentRefreshMutation.dbMutationPerformed === false
    && currentRefreshMutation.providerDispatchCalled === false
    && currentRefreshMutation.shareSessionCreated === false
    && currentRefreshMutation.embeddingOrVectorMutationPerformed === false
    && currentRefreshMutation.wikiPublished === false
    && currentRefreshMutation.koshaExactRegistryMutationPerformed === false;
  const distributedUnavailableFailClosed = readNumber(currentRefreshProbe.status) === 503
    && readString(currentRefreshProbe.rateLimitHeader) === "distributed"
    && readString(currentRefreshProbe.errorCode) === "DISTRIBUTED_RATE_LIMIT_UNAVAILABLE"
    && readNumber(currentRefreshProbe.retryAfterSeconds) === 5
    && currentRefreshProbe.distributedAdmissionRequired === true
    && currentRefreshProbe.distributedAdmissionAvailable === false
    && currentRefreshProbe.distributedAdmissionFailedClosed === true
    && currentRefreshProbe.authenticationNotReachedBecauseAdmissionFailedClosed === true;
  const distributedConfigurationAbsent = readString(currentRefreshReadiness.path) === "/api/export/pdf"
    && readString(currentRefreshReadiness.method) === "GET"
    && readNumber(currentRefreshReadiness.status) === 200
    && readString(currentRefreshReadiness.configurationState) === "absent"
    && readString(currentRefreshReadiness.mode) === "unavailable"
    && currentRefreshReadiness.ready === false
    && readString(currentRefreshReadiness.reason) === "distributed_limiter_unavailable";
  const invalidTokenFailClosed = readNumber(currentRefreshProbe.status) === 401
    && currentRefreshProbe.authenticationFailedClosed === true
    && ["instance", "distributed"].includes(readString(currentRefreshProbe.rateLimitHeader));
  const currentRefreshPass = readString(currentLiveRefresh.verdict) === "PASS_LIVE_PRODUCTION_MCP_PREAUTH_ADMISSION_FAIL_CLOSED_REFRESH"
    && currentRefreshSourceHead.length > 0
    && readString(currentLiveRefresh.productionCommit) === currentRefreshSourceHead
    && readString(currentLiveRefresh.productionBranch) === "master"
    && readString(currentLiveRefresh.productionEnvironment) === "production"
    && readString(currentLiveRefresh.deploymentUrl).length > 0
    && isGitAncestor(rootDir, currentRefreshSourceHead)
    && isEvidenceCurrentForPaths(rootDir, currentRefreshSourceHead, MCP_GENERATION_WORK_BUDGET_SECURITY_PATHS)
    && readString(currentRefreshProbe.path) === "/api/mcp/mcp"
    && readString(currentRefreshProbe.method) === "POST"
    && readString(currentRefreshProbe.credential) === "intentionally_invalid_non_secret"
    && readNumber(currentRefreshProbe.requestBodyBytes) === 2
    && ((distributedUnavailableFailClosed && distributedConfigurationAbsent) || invalidTokenFailClosed)
    && currentRefreshProbe.mcpToolDispatchPerformed === false
    && currentRefreshProbe.providerCallPerformed === false
    && currentRefreshProbe.validAuthenticatedBudgetProbeExecuted === false
    && readNumber(currentRefreshFocused.files) === 3
    && readNumber(currentRefreshFocused.tests) === 65
    && readNumber(currentRefreshFocused.failed) === 0
    && readString(currentRefreshFocused.status) === "PASS"
    && readNumber(currentRefreshAdjacent.files) === 8
    && readNumber(currentRefreshAdjacent.tests) === 126
    && readNumber(currentRefreshAdjacent.failed) === 0
    && readString(currentRefreshAdjacent.status) === "PASS"
    && readString(currentRefreshVerification.typecheck) === "PASS"
    && readString(currentRefreshVerification.build?.status) === "PASS"
    && readNumber(currentRefreshVerification.build?.staticPages) === 28
    && readNumber(currentRefreshVerification.dependencyAuditVulnerabilities) === 0
    && currentRefreshNoMutation;
  const currentCompatibilityPass = isCurrentSecurityRemediationCompatibilityCurrent(
    rootDir,
    "mcp_generation_work_budget_security",
    MCP_GENERATION_WORK_BUDGET_SECURITY_PATHS,
  ) || isCurrentSecurityGovernedPathReceiptCurrent(rootDir, MCP_GENERATION_WORK_BUDGET_SECURITY_PATHS);
  const cancellationCompatibilityPass = isCurrentMcpGenerationCancellationCompatibility(
    rootDir,
    MCP_GENERATION_WORK_BUDGET_SECURITY_PATHS,
  );
  const providerCompanion = readJsonFile(rootDir, EVIDENCE_PATHS.mcpProviderAdmission);
  const companionProduction = isRecord(providerCompanion?.productionBuild)
    ? providerCompanion.productionBuild
    : {};
  const companionContracts = isRecord(providerCompanion?.contracts) ? providerCompanion.contracts : {};
  const companionPreserved = isRecord(companionContracts.preservedBehavior)
    ? companionContracts.preservedBehavior
    : {};
  const companionVerification = isRecord(providerCompanion?.verification)
    ? providerCompanion.verification
    : {};
  const companionAdjacent = isRecord(companionVerification.focusedAndAdjacentMcp)
    ? companionVerification.focusedAndAdjacentMcp
    : {};
  const companionLive = isRecord(providerCompanion?.liveProbe) ? providerCompanion.liveProbe : {};
  const companionMutation = isRecord(providerCompanion?.mutationBoundary)
    ? providerCompanion.mutationBoundary
    : {};
  const companionRemaining = isRecord(providerCompanion?.remainingBoundaries)
    ? providerCompanion.remainingBoundaries
    : {};
  const companionSourceHead = readString(providerCompanion?.sourceHead);
  const companionNoMutation = companionMutation.dbSchemaChanged === false
    && companionMutation.dbMutationPerformed === false
    && companionMutation.providerDispatchCalled === false
    && companionMutation.providerGenerationExecuted === false
    && companionMutation.shareSessionCreated === false
    && companionMutation.vectorOrEmbeddingMutationPerformed === false
    && companionMutation.wikiPublicationPerformed === false
    && companionMutation.koshaRegistryMutationPerformed === false;
  const providerCompanionPass = readString(providerCompanion?.verdict) === "PASS_LIVE_DEPLOYED_SOURCE_DURABLE_MCP_PROVIDER_ADMISSION_RESCAN_PENDING"
    && companionSourceHead.length > 0
    && companionSourceHead === readString(companionProduction.commitSha)
    && isGitAncestor(rootDir, companionSourceHead)
    && (isEvidenceCurrentForPaths(rootDir, companionSourceHead, MCP_GENERATION_WORK_BUDGET_SECURITY_PATHS)
      || cancellationCompatibilityPass)
    && companionPreserved.existingTransportBodyAndAuthenticationBudgetsRetained === true
    && readNumber(companionAdjacent.files) === 8
    && readNumber(companionAdjacent.tests) >= 94
    && readNumber(companionAdjacent.failed) === 0
    && readNumber(companionLive.status) === 401
    && companionLive.mcpToolDispatchPerformed === false
    && companionLive.providerGenerationExecuted === false
    && companionNoMutation
    && companionRemaining.freshFullRepositorySecurityScanRequiredForCanonicalClosure === true
    && companionRemaining.securityCompleteClaimAllowed === false
    && readString(companionRemaining.exactSavedShareVerdict) === "MISSING_EVIDENCE";
  const currentRefreshBoundarySafe = currentRefreshSourceHead.length === 0 || (
    currentRefreshProbe.mcpToolDispatchPerformed === false
    && currentRefreshProbe.providerCallPerformed === false
    && currentRefreshProbe.validAuthenticatedBudgetProbeExecuted === false
    && (
      readNumber(currentRefreshProbe.status) === 503
        ? distributedUnavailableFailClosed && distributedConfigurationAbsent
        : invalidTokenFailClosed
    )
    && currentRefreshNoMutation
  );
  const distributedBoundaryCurrent = distributedUnavailableFailClosed && distributedConfigurationAbsent
    ? remaining.distributedProductionActivationRequired === true
      && remaining.distributedProductionHealthRequired === false
    : remaining.distributedProductionActivationRequired === true;
  const pass = readString(report.verdict) === "PASS_LIVE_PRODUCTION_SOURCE_INCLUDED_MCP_GENERATION_WORK_BUDGET_AUTHENTICATED_RUNTIME_PROBE_AND_RESCAN_PENDING"
    && sourceHead.length > 0
    && sourceHead === productionCommit
    && report.sourceHeadMatchesProduction === true
    && isGitAncestor(rootDir, sourceHead)
    && readString(baseline.scanId) === "8fe9c06a-018c-446f-aa98-1b37df95287a"
    && readString(baseline.targetRevision) === "f0c8a7be02becd53c21fb80842cf23c571f22b1f"
    && readString(baseline.findingId) === "csf_f30faad248ef517b894c8946"
    && readString(baseline.ruleId) === "resource-exhaustion.mcp-generation"
    && readString(baseline.findingStatus) === "immutable_baseline_preserved_remediation_not_rescanned"
    && readNumber(contract.postBodyMaxBytes) === 98_304
    && readNumber(contract.questionMaxChars) === 4_000
    && readNumber(contract.taskMaxChars) === 256
    && readNumber(contract.documentTextMaxChars) === 20_000
    && readString(rateLimit.namespace) === "mcp-authenticated"
    && readNumber(rateLimit.limit) === 20
    && readNumber(rateLimit.windowMs) === 60_000
    && rateLimit.rawBearerSentToLimiter === false
    && rateLimit.distributedWhenConfigured === true
    && rateLimit.instanceFallbackWhenAbsent === true
    && rateLimit.partialOrUnavailableDistributedConfigFailsClosed === true
    && readString(rateLimit.responseModeHeader) === "X-SafeClaw-Rate-Limit"
    && ordering.authenticationWrapsBudgetedHandler === true
    && ordering.admissionBeforeBodyBuffering === true
    && ordering.bodyBudgetBeforeMcpToolDispatch === true
    && ordering.oversizedChunkedBodyRejected === true
    && ordering.declaredContentLengthBypassRejectedByMeasuredBytes === true
    && preserved.boundedAuthenticatedPost === true
    && preserved.maxQaDocumentPayload === true
    && preserved.getSseExcludedFromPostBudget === true
    && preserved.deleteSessionExcludedFromPostBudget === true
    && readNumber(focused.files) === 2
    && readNumber(focused.tests) === 14
    && readString(focused.status) === "PASS"
    && readNumber(adjacent.files) === 7
    && readNumber(adjacent.tests) === 77
    && readString(adjacent.status) === "PASS"
    && verification.typecheck === "PASS"
    && readNumber(verification.dependencyAuditVulnerabilities) === 0
    && readString(build.status) === "PASS"
    && readNumber(build.staticPages) === 28
    && readNumber(liveProbe.status) === 401
    && liveProbe.authenticationFailedClosed === true
    && liveProbe.validAuthenticatedBudgetProbeExecuted === false
    && noMutation
    && remaining.liveAfterDeploymentRequired === false
    && remaining.validAuthenticatedRuntimeProbeRequired === true
    && remaining.freshSecurityRescanRequired === true
    && distributedBoundaryCurrent
    && readString(remaining.exactSavedShareVerdict) === "MISSING_EVIDENCE"
    && remaining.approvalGatedBoundariesUnchanged === true
    && currentRefreshBoundarySafe
    && (currentRefreshPass || currentCompatibilityPass || providerCompanionPass);

  const cancellationReport = readJsonFile(rootDir, EVIDENCE_PATHS.currentSourceMcpGenerationCancellationRemediation);
  const cancellationProductCommit = isRecord(cancellationReport) ? readString(cancellationReport.productCommit) : "";
  const currentProofHead = currentRefreshPass
    ? currentRefreshSourceHead
    : cancellationCompatibilityPass && cancellationProductCommit
      ? cancellationProductCommit
      : companionSourceHead;
  const currentProofDescription = distributedUnavailableFailClosed && distributedConfigurationAbsent
    ? `Current production ${currentProofHead.slice(0, 8)} proves distributed MCP admission is required but not configured: the readiness endpoint reports configurationState=absent and the pre-auth guard returns 503 DISTRIBUTED_RATE_LIMIT_UNAVAILABLE before authentication, MCP tool dispatch, provider work, or mutation. Current compatibility verification preserves the 96 KiB body contract with ${readNumber(currentRefreshFocused.files)} files / ${readNumber(currentRefreshFocused.tests)} focused tests and ${readNumber(currentRefreshAdjacent.files)} files / ${readNumber(currentRefreshAdjacent.tests)} adjacent MCP tests. Distributed activation, a valid authenticated runtime probe, and a fresh security rescan remain open.`
    : `Current production ${currentProofHead.slice(0, 8)} re-proves MCP invalid-token 401 fail-closed before any MCP tool dispatch, provider call, or mutation. The provider-admission companion preserves the 96 KiB measured body and authentication contracts through ${readNumber(companionAdjacent.tests)} adjacent MCP tests; a valid authenticated runtime probe, distributed activation, and fresh security rescan remain open.`;

  return gateResult({
    id: "mcp_generation_work_budget_security",
    label: "MCP generation work-budget security",
    state: pass ? "notice" : "contradicted",
    evidencePath,
    detail: pass
      ? `${currentProofDescription} The sealed finding is unchanged, and exact saved Share remains MISSING_EVIDENCE.`
      : `MCP budget verdict=${readString(report.verdict) || "unknown"}, source/live=${sourceHead}/${productionCommit}, currentRefresh=${currentRefreshPass}, providerCompanion=${providerCompanionPass}, refreshHead=${currentRefreshSourceHead || "missing"}, bodyBytes=${readNumber(contract.postBodyMaxBytes)}, adjacent=${readNumber(adjacent.tests)}, liveAuth=${readNumber(liveProbe.status)}, validProbe=${liveProbe.validAuthenticatedBudgetProbeExecuted === true}, rescan=${remaining.freshSecurityRescanRequired === true}, noMutation=${noMutation && (currentRefreshNoMutation || companionNoMutation)}, exactShare=${readString(remaining.exactSavedShareVerdict) || "missing"}.`,
    nextActions: pass
      ? [
          "Run a valid credential-safe production MCP boundary probe without exposing the token.",
          distributedUnavailableFailClosed && distributedConfigurationAbsent
            ? "Activate the approved distributed limiter configuration before claiming authenticated MCP availability, then complete a fresh security rescan."
            : "Activate the approved distributed limiter configuration and complete a fresh security rescan before reclassifying the sealed finding.",
        ]
      : ["Restore every deployed-source, body-budget, limiter, verification, no-mutation, rescan, and exact-Share predicate."],
  });
}

/**
 * @param {string} rootDir
 * @returns {GateResult}
 */
function evaluateShareResultFixtureCockpitGate(rootDir) {
  const evidencePath = EVIDENCE_PATHS.shareResultDrilldown;
  const report = readJsonFile(rootDir, evidencePath);
  if (!isRecord(report)) {
    return gateResult({
      id: "share_result_fixture_cockpit",
      label: "Generated share result fixture cockpit",
      state: "missing",
      evidencePath,
      detail: "Share result fixture report is missing or invalid.",
      nextActions: ["Run the generated provider-result fixture browser gate before claiming Share result-state containment."],
    });
  }

  const fixture = isRecord(report.generatedProviderResultFixture)
    ? report.generatedProviderResultFixture
    : {};
  const desktop = isRecord(fixture.desktop1440x900) ? fixture.desktop1440x900 : {};
  const mobile = isRecord(fixture.mobile390x844) ? fixture.mobile390x844 : {};
  const assertions = isRecord(fixture.assertions) ? fixture.assertions : {};
  const desktopRanges = Array.isArray(desktop.distinctFirstViewportXRanges)
    ? desktop.distinctFirstViewportXRanges
    : [];
  const pass = readString(report.verdict) === "PASS"
    && fixture.fixtureGeneratedProviderResultProof === true
    && fixture.providerDispatchLiveClaimed === false
    && fixture.externalProviderCalled === false
    && readString(desktop.verdict) === "PASS"
    && readNumber(desktop.dispatchPostCount) === 1
    && readNumber(desktop.horizontalOverflow) === 0
    && readNumber(desktop.pageHeight) !== null
    && readNumber(desktop.viewportHeight) !== null
    && (readNumber(desktop.pageHeight) || 0) <= (readNumber(desktop.viewportHeight) || 0)
    && readNumber(desktop.primaryBottom) !== null
    && (readNumber(desktop.primaryBottom) || 0) <= (readNumber(desktop.viewportHeight) || 0)
    && readNumber(desktop.previewBottom) !== null
    && (readNumber(desktop.previewBottom) || 0) <= (readNumber(desktop.viewportHeight) || 0)
    && readNumber(desktop.resultSummaryBottom) !== null
    && (readNumber(desktop.resultSummaryBottom) || 0) <= (readNumber(desktop.viewportHeight) || 0)
    && desktop.resultOpenByDefault === false
    && readNumber(desktop.openedChannelResultCount) === 2
    && desktopRanges.length >= 2
    && desktop.resultPanelMonopolizesViewportWidth === false
    && readString(mobile.verdict) === "PASS"
    && readNumber(mobile.dispatchPostCount) === 1
    && readNumber(mobile.horizontalOverflow) === 0
    && readNumber(mobile.previewBottom) !== null
    && (readNumber(mobile.previewBottom) || 0) <= (readNumber(mobile.viewportHeight) || 0)
    && readNumber(mobile.primaryBottom) !== null
    && (readNumber(mobile.primaryBottom) || 0) <= (readNumber(mobile.viewportHeight) || 0)
    && readNumber(mobile.resultSummaryBottom) !== null
    && (readNumber(mobile.resultSummaryBottom) || 0) <= (readNumber(mobile.viewportHeight) || 0)
    && mobile.resultOpenByDefault === false
    && readNumber(mobile.openedChannelResultCount) === 2
    && mobile.configCardsCollapsedByDefault === true
    && assertions.dispatchPostCalledExactlyOnce === true
    && assertions.responseIdempotencyKeyCaptured === true
    && assertions.resultClosedByDefault === true
    && assertions.closedResultSummaryShowsChannelStatus === true
    && assertions.openedResultShowsValidationCopy === true
    && assertions.openedResultShowsChannelStatus === true
    && readNumber(assertions.openedResultChannelCount) === 2
    && assertions.desktopPreviewRightPane === true
    && assertions.desktopDistinctRegions === true
    && assertions.desktopResultPanelNotMonopolizingWidth === true
    && assertions.mobileConfigCardsCollapsed === true;

  if (pass) {
    return gateResult({
      id: "share_result_fixture_cockpit",
      label: "Generated share result fixture cockpit",
      state: "proven",
      evidencePath,
      detail: `Generated provider-result fixture proof is bounded: desktop page ${readNumber(desktop.pageHeight)}/${readNumber(desktop.viewportHeight)}, result panel ${readNumber(desktop.resultPanelWidth)}px with ${desktopRanges.length} x-ranges, mobile summary/preview/CTA/result inside ${readNumber(mobile.viewportHeight)}px, closed summary shows channel status, dispatch POST count 1, provider live dispatch unclaimed.`,
      nextActions: [
        "Keep real provider dispatch gated until persistent idempotency and provider-result persistence are approved and live verified.",
      ],
    });
  }

  return gateResult({
    id: "share_result_fixture_cockpit",
    label: "Generated share result fixture cockpit",
    state: "contradicted",
    evidencePath,
    detail: "Share result report no longer proves validation-only generated result state, bounded details, first-viewport cockpit geometry, and no provider live dispatch claim together.",
    nextActions: ["Re-run the generated provider-result browser fixture and update the report with dispatch POST and opened-detail evidence."],
  });
}

/**
 * @param {string} rootDir
 * @returns {GateResult}
 */
function evaluateShareRecipientLongContentFixtureGate(rootDir) {
  const evidencePath = EVIDENCE_PATHS.shareRecipientLongContentFixture;
  const report = readJsonFile(rootDir, evidencePath);
  if (!isRecord(report)) {
    return gateResult({
      id: "share_recipient_long_content_fixture",
      label: "Recipient Share long-content fixture",
      state: "missing",
      evidencePath,
      detail: "Recipient Share long-content fixture report is missing or invalid.",
      nextActions: ["Run the route-controlled recipient long-content fixture before claiming maximum-content layout resilience."],
    });
  }

  const rows = Array.isArray(report.rows) ? report.rows.filter(isRecord) : [];
  const acceptance = isRecord(report.acceptance) ? report.acceptance : {};
  const rowsPass = rows.length === 6 && rows.every((row) => {
    const metrics = isRecord(row.metrics) ? row.metrics : {};
    const verdicts = isRecord(row.verdicts) ? row.verdicts : {};
    const isDesktop = readNumber(metrics.viewportWidth) === 1440;
    return readString(verdicts.overallVerdict) === "PASS_SCOPED"
      && readString(verdicts.exactSavedSessionVerdict) === "MISSING_EVIDENCE"
      && readNumber(metrics.confirmationBottom) !== null
      && (readNumber(metrics.confirmationBottom) || 0) <= (readNumber(metrics.viewportHeight) || 0)
      && metrics.taskBodyContained === true
      && metrics.documentsPanelOpen === false
      && readNumber(metrics.previewContainedCount) === 4
      && readNumber(metrics.collapsedDocumentCount) === 3
      && readNumber(metrics.outsideCards) === 0
      && metrics.horizontalOverflow === false
      && (isDesktop
        ? readNumber(metrics.desktopXRegionCount) === 2
        : readNumber(metrics.rootHeightRatio) !== null
          && (readNumber(metrics.rootHeightRatio) || 0) <= 1.5);
  });
  const pass = readString(report.verdict) === "PASS_LIVE_PRODUCTION_LONG_CONTENT_FIXTURE_EXACT_SAVED_MISSING"
    && readString(report.route) === "/share/[sessionId]"
    && readString(report.sessionKind) === "long-content-fixture"
    && report.routeSplitAloneAcceptedAsFix === false
    && readString(report.acceptedStructure).includes("first-viewport confirmation cockpit")
    && readNumber(acceptance.desktopMinRegions) === 2
    && readNumber(acceptance.mobileMaxRootHeightRatio) === 1.5
    && acceptance.confirmationMustRemainInFirstViewport === true
    && acceptance.longTaskMustUseLocalScroll === true
    && acceptance.documentGroupCollapsedByDefault === true
    && acceptance.exactSavedSessionRequiredForUserSpecificPass === true
    && report.exactSavedUserSessionReproduced === false
    && readString(report.exactSavedSessionVerdict) === "MISSING_EVIDENCE"
    && report.dbMutationPerformed === false
    && report.shareSessionCreated === false
    && report.providerDispatchLiveClaimed === false
    && report.externalProviderCalled === false
    && rowsPass;

  if (pass) {
    return gateResult({
      id: "share_recipient_long_content_fixture",
      label: "Recipient Share long-content fixture",
      state: "proven",
      evidencePath,
      detail: "Live recipient UI kept six day/night long-content fixture rows scoped PASS: desktop stayed two-region, mobile recipient root stayed within 1.5 viewports with confirmation in the first viewport, the long task used local scroll, the document group stayed collapsed by default, and exact saved-session evidence remains MISSING_EVIDENCE with no mutation or provider dispatch. Route split alone remains explicitly insufficient.",
      nextActions: [
        "Keep exact saved/generated /share/[sessionId] open until a concrete production URL is supplied or DB-backed session creation is explicitly approved.",
      ],
    });
  }

  return gateResult({
    id: "share_recipient_long_content_fixture",
    label: "Recipient Share long-content fixture",
    state: "contradicted",
    evidencePath,
    detail: "Recipient Share long-content fixture no longer proves scoped desktop/mobile containment together with the exact-session no-mutation boundary.",
    nextActions: ["Re-run the long-content fixture and preserve exact saved-session MISSING_EVIDENCE separately."],
  });
}

/**
 * @param {string} rootDir
 * @returns {GateResult}
 */
function evaluateShareExactSessionBoundaryGate(rootDir) {
  const evidencePath = EVIDENCE_PATHS.shareExactSessionBoundary;
  const report = readJsonFile(rootDir, evidencePath);
  if (!isRecord(report)) {
    return gateResult({
      id: "share_exact_saved_session_boundary",
      label: "Exact saved Share session boundary",
      state: "missing",
      evidencePath,
      detail: "Exact saved/generated /share/[sessionId] boundary report is missing; fixture Share proof cannot close the user-observed saved-session complaint.",
      nextActions: [
        "Run evaluation\\share-exact-session-boundary-2026-07-22\\run-share-exact-session-boundary.mjs with no mutation first, then rerun with a concrete saved session URL only when supplied or approved.",
      ],
    });
  }

  const boundary = isRecord(report.boundary) ? report.boundary : {};
  const acceptance = isRecord(report.exactSessionAcceptance) ? report.exactSessionAcceptance : {};
  const safeMissingSessionReadVerdict = readString(report.safeMissingSessionReadVerdict);
  const safeInvalidSessionReadVerdict = readString(report.safeInvalidSessionReadVerdict);
  const storageReadiness = readJsonFile(rootDir, EVIDENCE_PATHS.sharePublicSessionStorageReadiness);
  const storageApproval = readJsonFile(rootDir, EVIDENCE_PATHS.sharePublicSessionStorageApproval);
  const storageVerdict = isRecord(storageReadiness) ? readString(storageReadiness.verdict) : "";
  const storageApprovalVerdict = isRecord(storageApproval) ? readString(storageApproval.verdict) : "";
  const approvalBoundary = isRecord(storageApproval) && isRecord(storageApproval.approvalBoundary)
    ? storageApproval.approvalBoundary
    : {};
  const operatorApprovalRequired = approvalBoundary.operatorApprovalRequiredBeforeMigration === true;
  const shareSessionCreationWouldInsert = approvalBoundary.shareSessionCreationWouldInsertWorkpackShareSessions === true;
  const storageProbe = isRecord(storageReadiness) && isRecord(storageReadiness.serviceRoleReadOnlyProbe)
    ? storageReadiness.serviceRoleReadOnlyProbe
    : {};
  const storageShareProbe = isRecord(storageProbe) && isRecord(storageProbe.workpackShareSessionsFullSelect)
    ? storageProbe.workpackShareSessionsFullSelect
    : {};
  const storageShareError = isRecord(storageShareProbe.error) ? storageShareProbe.error : {};
  const storageErrorCode = readString(storageShareError.code);
  const noMutation = boundary.dbMutationPerformed === false
    && boundary.dispatchMutationPerformed === false
    && boundary.providerDispatchLiveClaimed === false
    && boundary.externalProviderCalled === false
    && readNumber(boundary.exactSessionMutationRequestCount) === 0;
  const fixtureNotAccepted = boundary.fixtureProofAcceptedAsExactSavedSession === false
    && boundary.generatedWorkspaceProofAcceptedAsExactSavedSession === false
    && boundary.exactSavedSessionRequiredForUserSpecificPass === true;
  const desktopContractPresent = readNumber(acceptance.desktopColumnCountMin) !== null
    && readNumber(acceptance.desktopColumnCountMin) >= 2
    && acceptance.firstActionMustBeInViewport === true
    && acceptance.horizontalOverflowAllowed === false;

  if (report.exactSavedUserSessionReproduced === true && noMutation && fixtureNotAccepted && desktopContractPresent) {
    return gateResult({
      id: "share_exact_saved_session_boundary",
      label: "Exact saved Share session boundary",
      state: "proven",
      evidencePath,
      detail: "Exact saved/generated /share/[sessionId] geometry has been reproduced under the desktop/mobile saved-session contract without provider dispatch or DB mutation.",
      nextActions: [
        "Keep fixture/generated Share rows separate from saved-exact rows in future UX reports.",
      ],
    });
  }

  if (readString(report.verdict) === "MISSING_EXACT_SAVED_SESSION_EVIDENCE_NO_MUTATION_BOUNDARY_CONFIRMED"
    && report.exactSavedUserSessionReproduced === false
    && report.exactSavedSessionUrlProvided === false
    && report.exactSavedSessionPayloadProvided === false
    && readString(report.sessionKind) === "missing-exact"
    && noMutation
    && fixtureNotAccepted
    && desktopContractPresent) {
    return gateResult({
      id: "share_exact_saved_session_boundary",
      label: "Exact saved Share session boundary",
      state: "notice",
      evidencePath,
      detail: `Exact saved/generated /share/[sessionId] user-session geometry remains MISSING_EVIDENCE; fixture or generated /workspace Share proof is explicitly not accepted as the user-specific saved-session pass. Safe missing-session read verdict is ${safeMissingSessionReadVerdict || "unknown"} and invalid-id read verdict is ${safeInvalidSessionReadVerdict || "unknown"}; both remain separate from exact saved-session geometry. Public share storage readiness is ${storageVerdict || "missing"} with share-session read error ${storageErrorCode || "unknown"}. Storage approval packet is ${storageApprovalVerdict || "missing"}; operator approval required is ${operatorApprovalRequired} and share-session creation would insert storage is ${shareSessionCreationWouldInsert}.`,
      nextActions: [
        "Obtain a concrete production /share/[sessionId]?workerId=... URL or approved safe creation flow before closing the user's desktop mobile-like Share complaint.",
        "Rerun desktop 1440x723/1440x900 and mobile 390x723 geometry with sessionKind=saved-exact, root width ratio, x-region count, first action, preview/status visibility, and overflow metrics.",
        "Keep the deliberately missing share-session GET fail-closed; if it returns a 5xx shape, track that as launch-quality debt rather than exact saved-session proof.",
        "Keep invalid share-session ids fail-closed at 400 so URL validation remains separated from storage-backed missing-session read debt.",
        "Resolve production public share storage readiness so workpack_share_sessions is visible in the PostgREST schema cache before exact saved-session closure.",
        "Do not call POST /api/workpacks/[id]/share-sessions without explicit DB-backed share-session creation approval; that path inserts workpack_share_sessions.",
      ],
    });
  }

  return gateResult({
    id: "share_exact_saved_session_boundary",
    label: "Exact saved Share session boundary",
    state: "contradicted",
    evidencePath,
    detail: "Share exact-session boundary no longer preserves no-mutation safety, fixture-vs-exact separation, or the desktop saved-session geometry contract.",
    nextActions: [
      "Re-run the exact-session boundary audit without provider dispatch or DB mutation and restore MISSING_EVIDENCE unless a concrete saved session is supplied or approved.",
    ],
  });
}

/**
 * @param {string} rootDir
 * @returns {GateResult}
 */
function evaluateProviderDispatchPersistenceGate(rootDir) {
  const evidencePath = EVIDENCE_PATHS.providerDispatchIdempotency;
  const report = readJsonFile(rootDir, evidencePath);
  if (!isRecord(report)) {
    return gateResult({
      id: "provider_dispatch_persistence",
      label: "Provider dispatch persistence approval",
      state: "missing",
      evidencePath,
      detail: "Provider dispatch idempotency approval packet is missing or invalid.",
      nextActions: ["Regenerate the provider dispatch idempotency approval packet before dispatch launch claims."],
    });
  }

  const liveDispatchState = isRecord(report.liveDispatchState) ? report.liveDispatchState : {};
  const draftMigration = isRecord(report.draftMigration) ? report.draftMigration : {};
  const channelResultPersistence = isRecord(report.channelResultPersistence) ? report.channelResultPersistence : {};
  const timestampBoundary = isRecord(report.timestampBoundary) ? report.timestampBoundary : {};
  const safetyLocks = isRecord(report.safetyLocks) ? report.safetyLocks : {};
  const requiredBeforeClaimingExactlyOnce = readStringArray(channelResultPersistence.requiredBeforeClaimingExactlyOnce);
  const hasChannelTableOption = requiredBeforeClaimingExactlyOnce.some((item) => (
    item.includes("provider_dispatch_attempt_channels")
      && item.includes("organization/idempotency/channel")
  ));
  const hasJsonLedgerOption = requiredBeforeClaimingExactlyOnce.some((item) => (
    item.includes("provider_result jsonb")
      && item.includes("canonical per-channel ledger")
  ));
  const attemptOnlyReservation = readString(draftMigration.scope) === "attempt_level_reservation_only"
    && readString(draftMigration.table) === "provider_dispatch_attempts"
    && readString(draftMigration.uniqueIndex) === "provider_dispatch_attempts_org_idempotency_key_unique"
    && draftMigration.forceRls === true;
  const previewLocked = liveDispatchState.capability === false
    && readString(liveDispatchState.mode) === "preview_only"
    && readString(liveDispatchState.reason) === "persistent_idempotency_unavailable"
    && readString(liveDispatchState.codeLock) === "PROVIDER_DISPATCH_IDEMPOTENCY_SUPPORTED=false";
  const noMutationOrSend = safetyLocks.dbMigrationApplied === false
    && safetyLocks.dbMutationPerformed === false
    && safetyLocks.providerMessageSent === false
    && safetyLocks.liveDispatchUnlocked === false;
  const channelLedgerStillOpen = channelResultPersistence.channelLevelExactlyOnceProven === false
    && readString(channelResultPersistence.currentShape).includes("channels text[]")
    && readString(channelResultPersistence.currentShape).includes("provider_result jsonb")
    && hasChannelTableOption
    && hasJsonLedgerOption;
  const timestampBoundaryOpen = timestampBoundary.updatedAtColumnPresent === true
    && timestampBoundary.updatedAtTriggerIncluded === true
    && readString(timestampBoundary.requiredBeforeAppliedMigration).includes("provider_dispatch_attempts_set_updated_at");
  const pass = readString(report.status) === "approval_required"
    && attemptOnlyReservation
    && previewLocked
    && noMutationOrSend
    && channelLedgerStillOpen
    && timestampBoundaryOpen;

  if (pass) {
    return gateResult({
      id: "provider_dispatch_persistence",
      label: "Provider dispatch persistence approval",
      state: "approval_gated",
      evidencePath,
      detail: "Provider dispatch remains preview-only: attempt-level idempotency reservation draft exists with an updated_at trigger, but per-channel result persistence/exactly-once behavior is not approved or proven; no migration, DB mutation, provider send, or live unlock occurred.",
      nextActions: [
        "Keep PROVIDER_DISPATCH_IDEMPOTENCY_SUPPORTED=false until route-level reservation-before-provider-call and duplicate replay behavior are tested.",
        "Approve either a per-channel dispatch child table or a tested canonical provider_result JSONB ledger before claiming channel-level exactly-once persistence.",
        "During approved migration rollout, verify provider_dispatch_attempts_set_updated_at exists in the target project before enabling live dispatch.",
      ],
    });
  }

  return gateResult({
    id: "provider_dispatch_persistence",
    label: "Provider dispatch persistence approval",
    state: "contradicted",
    evidencePath,
    detail: "Provider dispatch approval packet no longer preserves the preview-only/no-mutation boundary and attempt-only-versus-channel-ledger distinction.",
    nextActions: ["Re-run the provider dispatch idempotency approval packet and inspect live dispatch, safety lock, and channel-result ledger fields."],
  });
}

/**
 * @param {string} rootDir
 * @returns {GateResult}
 */
function evaluateKoshaExactTrustGate(rootDir) {
  const evidence = readFirstJsonFile(rootDir, [
    EVIDENCE_PATHS.koshaCurrentNorthstarRegression,
    EVIDENCE_PATHS.koshaCurrentGate,
    EVIDENCE_PATHS.koshaCurrentReconciliation,
  ]);
  const evidencePath = evidence?.path || EVIDENCE_PATHS.koshaCurrentGate;
  const report = evidence?.report;
  const liveText = readTextFile(rootDir, EVIDENCE_PATHS.koshaCurrentLive);
  if (!isRecord(report)) {
    return gateResult({
      id: "kosha_exact_trust_registry",
      label: "KOSHA exact trust registry",
      state: "missing",
      evidencePath,
      detail: "Current KOSHA reconciliation report is missing or invalid.",
      nextActions: ["Regenerate the current KOSHA reconciliation artifact before launch claims."],
    });
  }

  if (readString(report.title) === "KOSHA Current North Star Regression Gate") {
    const coveredPins = readStringArray(report.coveredExactPins);
    const requiredPins = ["D-C-13-2026", "D-C-7-2026", "B-E-10-2026"];
    const hasRequiredPins = requiredPins.every((pin) => coveredPins.includes(pin));
    const verification = isRecord(report.verification) ? report.verification : {};
    const verificationEntries = Object.values(verification).filter(isRecord);
    const checksPass = verificationEntries.length >= 3
      && verificationEntries.every((item) => item.status === "PASS");
    const structured = isRecord(verification.structuredMaterializationAndHarness)
      ? verification.structuredMaterializationAndHarness
      : {};
    const exact = isRecord(verification.exactTrustAndCorpus)
      ? verification.exactTrustAndCorpus
      : {};
    const combined = isRecord(verification.combinedFocusedRegression)
      ? verification.combinedFocusedRegression
      : {};
    const structuredTests = readNumber(structured.testsPassed);
    const exactTests = readNumber(exact.testsPassed);
    const combinedTests = readNumber(combined.testsPassed);
    const totalTests = combinedTests ?? ((structuredTests ?? 0) + (exactTests ?? 0));
    const noMutations = report.dbSchemaChanged === false
      && report.supabaseWrites === false
      && report.embeddingGenerated === false
      && report.embeddingUploaded === false;
    const readiness = readString(report.verdict) === "PASS"
      && hasRequiredPins
      && checksPass
      && totalTests >= 223
      && noMutations;

    if (readiness) {
      return gateResult({
        id: "kosha_exact_trust_registry",
        label: "KOSHA exact trust registry",
        state: "proven",
        evidencePath,
        detail: `Current source confirms ${coveredPins.length} exact KOSHA pins (${coveredPins.join(", ")}), structured materialization, grounded generation, and live harness quality: ${totalTests} tests plus typecheck PASS; no DB/schema/Supabase/embedding writes.`,
        nextActions: [
          "Use evaluation\\kosha-exact-promotion-packet-2026-07-22\\report.json as the bounded operator-review set before any exact-trust promotion.",
          "Promote additional metadata-verified KOSHA candidates to exact trust only through separate immutable acquisition/review.",
          "Keep broader corpus exact-publishing, SIF vector retrieval, and DB persistence approval-gated.",
        ],
      });
    }

    return gateResult({
      id: "kosha_exact_trust_registry",
      label: "KOSHA exact trust registry",
      state: "contradicted",
      evidencePath,
      detail: "Current KOSHA north-star regression no longer proves exact pins, structured materialization, focused tests, and no-mutation boundaries together.",
      nextActions: ["Re-run KOSHA north-star regression before KOSHA launch claims."],
    });
  }

  if (readString(report.schemaVersion) === "safeclaw-kosha-current-live-gate/v1") {
    const liveStatus = isRecord(report.liveStatus) ? report.liveStatus : {};
    const localCorpus = isRecord(liveStatus.localCorpus) ? liveStatus.localCorpus : {};
    const exactTrustRegistry = isRecord(liveStatus.exactTrustRegistry) ? liveStatus.exactTrustRegistry : {};
    const verification = Array.isArray(report.verification) ? report.verification : [];
    const verificationPassed = verification.every((item) => isRecord(item) && item.result === "pass");
    const exactKeys = readStringArray(exactTrustRegistry.stableDocumentKeys);
    const requiredPins = ["D-C-13", "D-C-7", "B-E-10"];
    const hasRequiredPins = requiredPins.every((pin) => exactKeys.includes(pin));
    const localCorpusCount = readNumber(localCorpus.itemCount);
    const localChunkCount = readNumber(localCorpus.chunkCount);
    const exactCount = readNumber(exactTrustRegistry.count);
    const readiness = readString(report.verdict) === "pass_current_kosha_exact_trust_and_corpus_gate"
      && verificationPassed
      && liveStatus.status === "ready"
      && liveStatus.catalogSearchOk === true
      && localCorpus.status === "ready"
      && localCorpusCount !== null
      && localCorpusCount >= 234
      && localChunkCount !== null
      && localChunkCount >= 7000
      && exactTrustRegistry.status === "ready"
      && exactCount === 3
      && hasRequiredPins;

    if (readiness) {
      return gateResult({
        id: "kosha_exact_trust_registry",
        label: "KOSHA exact trust registry",
        state: "proven",
        evidencePath,
        detail: `Current live runtime has ${exactCount} exact KOSHA pins (${exactKeys.join(", ")}), local corpus ${localCorpusCount} items/${localChunkCount} chunks, and focused KOSHA tests passed on the current HEAD.`,
        nextActions: [
          "Use evaluation\\kosha-exact-promotion-packet-2026-07-22\\report.json as the bounded operator-review set before any exact-trust promotion.",
          "Promote additional metadata-verified KOSHA candidates to exact trust only through separate immutable acquisition/review.",
        ],
      });
    }

    return gateResult({
      id: "kosha_exact_trust_registry",
      label: "KOSHA exact trust registry",
      state: "contradicted",
      evidencePath,
      detail: "Current KOSHA live gate no longer proves exact pins, focused tests, and local corpus readiness together.",
      nextActions: ["Re-run KOSHA exact trust tests and live status probe before KOSHA launch claims."],
    });
  }

  const verification = isRecord(report.verification) ? report.verification : {};
  const mutations = isRecord(report.mutations) ? report.mutations : {};
  const liveStatusProbe = isRecord(verification.liveStatusProbe) ? verification.liveStatusProbe : {};
  const focused = isRecord(verification.focusedKoshaVitest) ? verification.focusedKoshaVitest : {};
  const build = isRecord(verification.productionBuild) ? verification.productionBuild : {};
  const trace = isRecord(verification.nextFileTrace) ? verification.nextFileTrace : {};
  const productionPins = readStringArray(report.productionExactPins);
  const liveKeys = readStringArray(liveStatusProbe.exactTrustRegistryKeys);
  const requiredPins = ["D-C-13", "D-C-7", "B-E-10"];
  const hasRequiredPins = requiredPins.every((pin) => productionPins.includes(pin) && liveKeys.includes(pin));
  const liveMarkdownMatches = liveText !== null
    && requiredPins.every((pin) => liveText.includes(pin))
    && /General KOSHA guide rows are not promoted to direct evidence/u.test(liveText);
  const focusedTests = readNumber(focused.testsPassed);
  const focusedTotal = readNumber(focused.testsTotal);
  const localCorpusCount = readNumber(liveStatusProbe.localCorpusItemCount);
  const localChunkCount = readNumber(liveStatusProbe.localCorpusChunkCount);
  const manifestCount = readNumber(trace.manifestCount);
  const exactAssetManifests = readNumber(trace.allExactAssetsManifestCount);
  const noMutations = mutations.dbSchemaChanged === false
    && mutations.supabaseDataChanged === false
    && mutations.corpusUploaded === false
    && mutations.historicalWave2RangeMerged === false;
  const readiness = readString(report.verdict) === "pass_current_master_kosha_exact_registry_and_local_corpus_readiness"
    && hasRequiredPins
    && focused.status === "pass"
    && focusedTests !== null
    && focusedTotal !== null
    && focusedTests === focusedTotal
    && focusedTotal >= 80
    && liveStatusProbe.status === "ready"
    && liveStatusProbe.searchReady === true
    && liveStatusProbe.localCorpusStatus === "ready"
    && localCorpusCount !== null
    && localCorpusCount >= 234
    && localChunkCount !== null
    && localChunkCount >= 7000
    && liveStatusProbe.exactTrustRegistryStatus === "ready"
    && liveStatusProbe.exactTrustRegistryCount === 3
    && liveStatusProbe.exactTrustRegistryPartialFailure === false
    && build.status === "pass"
    && readNumber(build.staticPagesGenerated) === readNumber(build.staticPagesTotal)
    && trace.status === "pass"
    && manifestCount !== null
    && exactAssetManifests !== null
    && exactAssetManifests > 0
    && trace.partialExactAssetsManifestCount === 0
    && noMutations
    && liveMarkdownMatches;

  if (readiness) {
    return gateResult({
      id: "kosha_exact_trust_registry",
      label: "KOSHA exact trust registry",
      state: "proven",
      evidencePath,
      detail: `Current runtime has ${productionPins.length} exact KOSHA pins (${productionPins.join(", ")}), local corpus ${localCorpusCount} items/${localChunkCount} chunks, and zero DB/corpus mutations.`,
      nextActions: [
        "Use evaluation\\kosha-exact-promotion-packet-2026-07-22\\report.json as the bounded operator-review set before any exact-trust promotion.",
        "Promote additional metadata-verified KOSHA candidates to exact trust only through separate immutable acquisition/review.",
      ],
    });
  }

  return gateResult({
    id: "kosha_exact_trust_registry",
    label: "KOSHA exact trust registry",
    state: "contradicted",
    evidencePath,
    detail: "Current KOSHA reconciliation no longer proves exact pins, live readiness, mutation safety, and local corpus readiness together.",
    nextActions: ["Re-run KOSHA exact trust reconciliation and live status probe before KOSHA launch claims."],
  });
}

/**
 * @param {string} rootDir
 * @returns {GateResult}
 */
function evaluateKoshaExactPromotionReviewGate(rootDir) {
  const evidencePath = EVIDENCE_PATHS.koshaExactPromotionReviewGate;
  const report = readJsonFile(rootDir, evidencePath);
  const humanChecklistPath = EVIDENCE_PATHS.koshaExactPromotionHumanChecklist;
  const humanChecklist = readTextFile(rootDir, humanChecklistPath) || "";
  const checklistCandidateCount = humanChecklist.match(/^## \d+\. /gmu)?.length ?? 0;
  const checklistInputCount = humanChecklist.match(/^- \[ \] /gmu)?.length ?? 0;
  const checklistPrecheckedCount = humanChecklist.match(/^- \[[xX]\] /gmu)?.length ?? 0;
  const checklistOfficialPdfLinkCount = humanChecklist.match(/\[KOSHA PDF 열기\]\(/gu)?.length ?? 0;
  const checklistPageReceiptCount = humanChecklist.match(/^  - page receipt: /gmu)?.length ?? 0;
  const humanChecklistPass = checklistCandidateCount === 8
    && checklistInputCount === 48
    && checklistPrecheckedCount === 0
    && checklistOfficialPdfLinkCount === 8
    && checklistPageReceiptCount === 24
    && humanChecklist.includes("기계 evidence는 사람 검토를 대체하지 않습니다.")
    && humanChecklist.includes("체크 완료만으로 exact-trust promotion이 승인되거나 registry artifact가 생성되지 않습니다.")
    && humanChecklist.includes("별도 promotion 승인 전에는 exact-kosha registry를 생성하거나 수정하지 않습니다.");
  const humanChecklistDetail = humanChecklistPass
    ? ` Reviewer-facing checklist ${humanChecklistPath} exposes 8 candidates, 48 initially unchecked human inputs, 8 official PDF links, and 24 page receipts with no pre-checked items; machine evidence does not replace human review and checklist completion does not approve promotion.`
    : "";
  const officialPdfAuditPath = EVIDENCE_PATHS.koshaExactOfficialPdfAudit;
  const officialPdfAudit = readJsonFile(rootDir, officialPdfAuditPath);
  const officialLifecycleAuditPath = EVIDENCE_PATHS.koshaExactOfficialLifecycleAudit;
  const officialLifecycleAudit = readJsonFile(rootDir, officialLifecycleAuditPath);
  const reviewerSupportPath = EVIDENCE_PATHS.koshaExactPromotionReviewerSupport;
  const reviewerSupport = readJsonFile(rootDir, reviewerSupportPath);
  const reviewerCockpitPath = EVIDENCE_PATHS.koshaExactPromotionReviewerCockpit;
  const reviewerCockpit = readJsonFile(rootDir, reviewerCockpitPath);
  const reviewerCockpitBrowserPath = EVIDENCE_PATHS.koshaExactPromotionReviewerCockpitBrowser;
  const reviewerCockpitBrowser = readJsonFile(rootDir, reviewerCockpitBrowserPath);
  const contractAuditPath = EVIDENCE_PATHS.koshaExactPromotionReviewContractAudit;
  const contractAudit = readJsonFile(rootDir, contractAuditPath);
  const contractAuditProvesNoMutation = isRecord(contractAudit)
    && readString(contractAudit.verdict) === "PASS_CURRENT_SOURCE_REVIEW_GATE_CONTRACT_NO_MUTATION"
    && contractAudit.mutationBoundary
    && isRecord(contractAudit.mutationBoundary)
    && contractAudit.mutationBoundary.dbMutationPerformed === false
    && contractAudit.mutationBoundary.exactPromotionPerformed === false
    && contractAudit.mutationBoundary.exactRegistryWriteArtifactCreated === false
    && contractAudit.contractEvidence
    && isRecord(contractAudit.contractEvidence)
    && contractAudit.contractEvidence.shallowHumanConfirmationBlocked === true
    && contractAudit.contractEvidence.completedReviewStillRequiresSeparateApproval === true;
  const contractAuditDetail = contractAuditProvesNoMutation
    ? ` Contract audit ${contractAuditPath} confirms shallow human-confirmation-only reviews are blocked and completed review remains no-mutation plus separate approval.`
    : "";
  const officialPdfAuditProvesBodyPair = isRecord(officialPdfAudit)
    && readString(officialPdfAudit.schemaVersion) === "safeclaw-kosha-exact-official-pdf-audit/v1"
    && readString(officialPdfAudit.verdict) === "PASS_OFFICIAL_PDF_AUTHENTICITY_BODY_PAIR_REVIEW_STILL_REQUIRED"
    && readNumber(officialPdfAudit.candidateCount) === 8
    && readNumber(officialPdfAudit.machineVerifiedCount) === 8
    && readNumber(officialPdfAudit.failedCount) === 0
    && officialPdfAudit.temporaryPdfFilesRetained === 0
    && officialPdfAudit.exactPromotionPerformed === false
    && officialPdfAudit.separatePromotionApprovalRequired === true
    && officialPdfAudit.reviewChecklistImpact
    && isRecord(officialPdfAudit.reviewChecklistImpact)
    && officialPdfAudit.reviewChecklistImpact.officialUrlExpectedFileMachineSupported === true
    && officialPdfAudit.reviewChecklistImpact.officialMetadataAndBodyProvenanceMachineSupported === true
    && officialPdfAudit.reviewChecklistImpact.bodyAndPdfHashMachineRechecked === true
    && officialPdfAudit.reviewChecklistImpact.operatorLifecycleCurrentStatusConfirmed === false
    && officialPdfAudit.reviewChecklistImpact.humanConfirmationRecorded === false
    && officialPdfAudit.reviewChecklistImpact.reviewChecklistComplete === false
    && officialPdfAudit.mutationBoundary
    && isRecord(officialPdfAudit.mutationBoundary)
    && officialPdfAudit.mutationBoundary.dbMutationPerformed === false
    && officialPdfAudit.mutationBoundary.providerDispatchCalled === false
    && officialPdfAudit.mutationBoundary.shareSessionCreated === false
    && officialPdfAudit.mutationBoundary.embeddingGenerated === false
    && officialPdfAudit.mutationBoundary.vectorUploadPerformed === false
    && officialPdfAudit.mutationBoundary.exactTrustRegistryMutationPerformed === false;
  const officialPdfAuditDetail = officialPdfAuditProvesBodyPair
    ? ` Official PDF audit ${officialPdfAuditPath} re-downloaded and machine-verified all 8 PDF/body pairs while preserving lifecycle, human-review, and promotion boundaries.`
    : "";
  const lifecycleRows = isRecord(officialLifecycleAudit) && Array.isArray(officialLifecycleAudit.results)
    ? officialLifecycleAudit.results.filter(isRecord)
    : [];
  const lifecycleMutationBoundary = isRecord(officialLifecycleAudit)
    && isRecord(officialLifecycleAudit.mutationBoundary)
    ? officialLifecycleAudit.mutationBoundary
    : null;
  const officialLifecycleAuditProvesCurrentInventory = isRecord(officialLifecycleAudit)
    && readString(officialLifecycleAudit.schemaVersion) === "safeclaw-kosha-exact-official-lifecycle-audit/v1"
    && readString(officialLifecycleAudit.verdict) === "PASS_OFFICIAL_CURRENT_LIFECYCLE_MACHINE_SUPPORTED_HUMAN_REVIEW_REQUIRED"
    && readNumber(officialLifecycleAudit.candidateCount) === 8
    && readNumber(officialLifecycleAudit.machineLifecycleSupportedCount) === 8
    && readNumber(officialLifecycleAudit.exactTitleIdentityMatchCount) === 8
    && readNumber(officialLifecycleAudit.titleVariantFindingCount) === 0
    && readNumber(officialLifecycleAudit.failedCount) === 0
    && lifecycleRows.length === 8
    && lifecycleRows.every((row) => row.machineLifecycleSupported === true
      && row.operatorLifecycleCurrentStatusConfirmed === false
      && row.humanConfirmed === false)
    && officialLifecycleAudit.reviewChecklistImpact
    && isRecord(officialLifecycleAudit.reviewChecklistImpact)
    && officialLifecycleAudit.reviewChecklistImpact.operatorLifecycleCurrentStatusConfirmed === false
    && officialLifecycleAudit.reviewChecklistImpact.humanConfirmationRecorded === false
    && officialLifecycleAudit.reviewChecklistImpact.reviewChecklistComplete === false
    && officialLifecycleAudit.exactPromotionPerformed === false
    && officialLifecycleAudit.separatePromotionApprovalRequired === true
    && lifecycleMutationBoundary !== null
    && lifecycleMutationBoundary.dbMutationPerformed === false
    && lifecycleMutationBoundary.providerDispatchCalled === false
    && lifecycleMutationBoundary.shareSessionCreated === false
    && lifecycleMutationBoundary.embeddingGenerated === false
    && lifecycleMutationBoundary.vectorUploadPerformed === false
    && lifecycleMutationBoundary.exactTrustRegistryMutationPerformed === false;
  const officialLifecycleAuditDetail = officialLifecycleAuditProvesCurrentInventory
    ? ` Official lifecycle audit ${officialLifecycleAuditPath} reconciles all 8 packet versions against current and retired inventories with 8 exact official-current titles; corpus source titles remain separately preserved for provenance.`
    : "";
  const reviewerSupportBoundary = isRecord(reviewerSupport) && isRecord(reviewerSupport.reviewBoundary)
    ? reviewerSupport.reviewBoundary
    : null;
  const reviewerSupportMutationBoundary = isRecord(reviewerSupport) && isRecord(reviewerSupport.mutationBoundary)
    ? reviewerSupport.mutationBoundary
    : null;
  const reviewerSupportRows = isRecord(reviewerSupport) && Array.isArray(reviewerSupport.results)
    ? reviewerSupport.results.filter(isRecord)
    : [];
  const reviewerSupportRowsProvePageReceipts = reviewerSupportRows.length === 8
    && reviewerSupportRows.every((row) => {
      const groups = Array.isArray(row.semanticGroups) ? row.semanticGroups.filter(isRecord) : [];
      return row.contentRationaleMachineSupported === true
        && Array.isArray(row.failedSemanticGroups)
        && row.failedSemanticGroups.length === 0
        && row.humanReviewCompleted === false
        && row.humanConfirmed === false
        && groups.length === 3
        && groups.every((group) => {
          const receipts = Array.isArray(group.pageReceipts) ? group.pageReceipts.filter(isRecord) : [];
          return group.machineSupported === true
            && group.locationMappingComplete === true
            && group.locationMappingFailure === null
            && Boolean(readString(group.evidenceTerm))
            && readNumber(group.matchBodyCharStart) !== null
            && readNumber(group.matchBodyCharEnd) !== null
            && readNumber(group.matchBodyCharEnd) > readNumber(group.matchBodyCharStart)
            && receipts.length >= 1
            && receipts.every((receipt) => readNumber(receipt.pageNumber) !== null
              && readNumber(receipt.pageNumber) > 0
              && readNumber(receipt.matchCharStart) !== null
              && readNumber(receipt.matchCharEnd) !== null
              && readNumber(receipt.matchCharEnd) > readNumber(receipt.matchCharStart)
              && /^[0-9a-f]{64}$/.test(readString(receipt.normalizedTextSha256))
              && typeof receipt.ocrCandidate === "boolean");
        });
    });
  const reviewerSupportProvesSemanticCoverage = isRecord(reviewerSupport)
    && readString(reviewerSupport.schemaVersion) === "safeclaw-kosha-exact-promotion-reviewer-support/v1"
    && readString(reviewerSupport.verdict) === "PASS_MACHINE_REVIEWER_SUPPORT_HUMAN_CONFIRMATION_REQUIRED"
    && readNumber(reviewerSupport.candidateCount) === 8
    && readNumber(reviewerSupport.machineSupportedCount) === 8
    && readNumber(reviewerSupport.failedCount) === 0
    && readNumber(reviewerSupport.semanticGroupCount) === 24
    && readNumber(reviewerSupport.failedSemanticGroupCount) === 0
    && readNumber(reviewerSupport.pageReceiptCount) === 24
    && readNumber(reviewerSupport.semanticGroupsWithoutPageReceipt) === 0
    && Boolean(readString(reviewerSupport.bodySnapshotId))
    && /^[0-9a-f]{64}$/.test(readString(reviewerSupport.bodySourceIdentitySha256))
    && reviewerSupportRowsProvePageReceipts
    && reviewerSupportBoundary !== null
    && reviewerSupportBoundary.humanReviewCompleted === false
    && reviewerSupportBoundary.reviewChecklistComplete === false
    && reviewerSupportBoundary.machineEvidenceReplacesHumanReview === false
    && reviewerSupportMutationBoundary !== null
    && reviewerSupportMutationBoundary.dbMutationPerformed === false
    && reviewerSupportMutationBoundary.providerDispatchCalled === false
    && reviewerSupportMutationBoundary.shareSessionCreated === false
    && reviewerSupportMutationBoundary.embeddingGenerated === false
    && reviewerSupportMutationBoundary.vectorUploadPerformed === false
    && reviewerSupportMutationBoundary.exactTrustRegistryMutationPerformed === false
    && reviewerSupport.exactPromotionPerformed === false
    && reviewerSupport.exactRegistryWriteArtifactCreated === false
    && reviewerSupport.separatePromotionApprovalRequired === true;
  const reviewerSupportDetail = reviewerSupportProvesSemanticCoverage
    ? ` Reviewer-support audit ${reviewerSupportPath} records bounded excerpts plus 24/24 PDF page/body location receipts for 8/8 candidates and 24/24 semantic groups, bound to the corpus snapshot identity, without completing human review or creating a registry artifact.`
    : "";
  const reviewerCockpitBoundary = isRecord(reviewerCockpit) && isRecord(reviewerCockpit.boundary)
    ? reviewerCockpit.boundary
    : null;
  const reviewerCockpitAccessibility = isRecord(reviewerCockpit) && isRecord(reviewerCockpit.accessibilityContract)
    ? reviewerCockpit.accessibilityContract
    : null;
  const reviewerCockpitPass = isRecord(reviewerCockpit)
    && readString(reviewerCockpit.schemaVersion) === "safeclaw-kosha-exact-promotion-reviewer-cockpit/v1"
    && readString(reviewerCockpit.verdict) === "PASS_NO_MUTATION_KOSHA_REVIEWER_COCKPIT_READY"
    && readNumber(reviewerCockpit.candidateCount) === 8
    && readNumber(reviewerCockpit.semanticGroupCount) === 24
    && readNumber(reviewerCockpit.pageReceiptCount) === 24
    && readNumber(reviewerCockpit.titleReconciledCandidateCount) === 2
    && readString(reviewerCockpit.bodySnapshotId) === readString(reviewerSupport.bodySnapshotId)
    && readString(reviewerCockpit.bodySourceIdentitySha256) === readString(reviewerSupport.bodySourceIdentitySha256)
    && readNumber(reviewerCockpit.checklistInputCount) === 64
    && readNumber(reviewerCockpit.initialCompletedInputCount) === 0
    && reviewerCockpit.exportInitiallyDisabled === true
    && readString(reviewerCockpit.reviewChecklistPath) === path.join("evaluation", "kosha-exact-promotion-review-gate-2026-07-22", "review-template.md")
    && isRecord(reviewerCockpit.reviewChecklistMetrics)
    && readNumber(reviewerCockpit.reviewChecklistMetrics.candidateCount) === 8
    && readNumber(reviewerCockpit.reviewChecklistMetrics.uncheckedInputCount) === 48
    && readNumber(reviewerCockpit.reviewChecklistMetrics.precheckedInputCount) === 0
    && readNumber(reviewerCockpit.reviewChecklistMetrics.officialPdfLinkCount) === 8
    && readNumber(reviewerCockpit.reviewChecklistMetrics.pageReceiptCount) === 24
    && reviewerCockpit.reviewChecklistMetrics.boundaryPreserved === true
    && reviewerCockpitAccessibility !== null
    && readNumber(reviewerCockpitAccessibility.candidateTabCount) === 8
    && reviewerCockpitAccessibility.candidateRovingTabStop === true
    && Array.isArray(reviewerCockpitAccessibility.candidateKeyboardNavigation)
    && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End"].every((key) => reviewerCockpitAccessibility.candidateKeyboardNavigation.includes(key))
    && reviewerCockpitAccessibility.breakpointOrientationSynchronized === true
    && reviewerCockpitAccessibility.mobileEvidenceReviewTabs === true
    && reviewerCockpitAccessibility.responsiveTabPanelSemantics === true
    && reviewerCockpitAccessibility.candidateBoundDraftStorage === true
    && reviewerCockpitAccessibility.evidencePageReceipts === true
    && reviewerCockpitAccessibility.draftBoundToCorpusIdentity === true
    && reviewerCockpitAccessibility.titleProvenanceVisible === true
    && reviewerCockpitAccessibility.progressLiveRegion === true
    && reviewerCockpitAccessibility.candidatePositionLabels === true
    && reviewerCockpitAccessibility.mobileCandidateProgressVisible === true
    && reviewerCockpitAccessibility.visibleDraftPersistenceStatus === true
    && reviewerCockpitAccessibility.draftRestoreStatusVisible === true
    && reviewerCockpitAccessibility.draftSaveFailureVisible === true
    && reviewerCockpitAccessibility.nextIncompleteCandidateNavigation === true
    && reviewerCockpitAccessibility.futureReviewTimestampBlocked === true
    && reviewerCockpitAccessibility.mobileCandidateScrollSnap === true
    && reviewerCockpitAccessibility.selectedCandidateAutoReveal === true
    && reviewerCockpitAccessibility.readableEvidenceCues === true
    && reviewerCockpitAccessibility.rawEvidenceExcerptPreservedInDisclosure === true
    && reviewerCockpitAccessibility.reviewerChecklistLinkVisible === true
    && reviewerCockpitAccessibility.reviewerChecklistLinkAvailableBeforeCompletion === true
    && reviewerCockpitBoundary !== null
    && reviewerCockpitBoundary.localReviewOnly === true
    && reviewerCockpitBoundary.dbMutationPerformed === false
    && reviewerCockpitBoundary.exactRegistryWriteArtifactCreated === false
    && reviewerCockpitBoundary.exactPromotionPerformed === false
    && reviewerCockpitBoundary.machineEvidenceReplacesHumanReview === false
    && reviewerCockpitBoundary.separatePromotionApprovalRequired === true;
  const cockpitBrowserRows = isRecord(reviewerCockpitBrowser) && Array.isArray(reviewerCockpitBrowser.results)
    ? reviewerCockpitBrowser.results.filter(isRecord)
    : [];
  const cockpitBrowserMutation = isRecord(reviewerCockpitBrowser)
    && isRecord(reviewerCockpitBrowser.mutationBoundary)
    ? reviewerCockpitBrowser.mutationBoundary
    : null;
  const cockpitBrowserBoundary = isRecord(reviewerCockpitBrowser)
    && isRecord(reviewerCockpitBrowser.remainingBoundary)
    ? reviewerCockpitBrowser.remainingBoundary
    : null;
  const reviewerCockpitBrowserPass = isRecord(reviewerCockpitBrowser)
    && readString(reviewerCockpitBrowser.schemaVersion) === "safeclaw-kosha-exact-promotion-reviewer-cockpit-browser/v1"
    && readString(reviewerCockpitBrowser.verdict) === "PASS_LOCAL_KOSHA_REVIEWER_COCKPIT_GEOMETRY"
    && readNumber(reviewerCockpitBrowser.cases) === 3
    && readNumber(reviewerCockpitBrowser.passedCases) === 3
    && reviewerCockpitBrowser.desktopPass === true
    && reviewerCockpitBrowser.mobilePass === true
    && reviewerCockpitBrowser.responsiveTabPanelPass === true
    && reviewerCockpitBrowser.draftStorageIdentityPass === true
    && reviewerCockpitBrowser.titleReconciliationPass === true
    && reviewerCockpitBrowser.candidateNavigationReadabilityPass === true
    && reviewerCockpitBrowser.evidenceReadingHierarchyPass === true
    && reviewerCockpitBrowser.mobileCandidateProgressVisibilityPass === true
    && reviewerCockpitBrowser.draftPersistenceVisibilityPass === true
    && reviewerCockpitBrowser.nextIncompleteNavigationPass === true
    && reviewerCockpitBrowser.futureReviewTimestampPass === true
    && reviewerCockpitBrowser.reviewChecklistAccessPass === true
    && isRecord(reviewerCockpitBrowser.draftStorageIdentity)
    && reviewerCockpitBrowser.draftStorageIdentity.sameFingerprintPreserved === true
    && reviewerCockpitBrowser.draftStorageIdentity.sourceIdentityPresent === true
    && reviewerCockpitBrowser.draftStorageIdentity.staleFingerprintDiscarded === true
    && reviewerCockpitBrowser.draftStorageIdentity.staleExportDisabled === true
    && readString(reviewerCockpitBrowser.draftStorageIdentity.emptyDraftStatus) === "로컬 초안 · 빈 상태 저장됨"
    && readString(reviewerCockpitBrowser.draftStorageIdentity.changedDraftStatus) === "로컬 초안 · 변경사항 저장됨"
    && readString(reviewerCockpitBrowser.draftStorageIdentity.restoredDraftStatus) === "로컬 초안 · 저장된 입력 복원됨"
    && readString(reviewerCockpitBrowser.draftStorageIdentity.staleDraftStatus) === "로컬 초안 · 이전 초안 제외 · 빈 상태 저장됨"
    && readString(reviewerCockpitBrowser.draftStorageIdentity.saveFailureStatus) === "로컬 초안 · 저장 실패 · 입력은 현재 화면에만 유지"
    && readNumber(reviewerCockpitBrowser.draftStorageIdentity.nextIncompleteInitialSelectedIndex) === 1
    && readNumber(reviewerCockpitBrowser.draftStorageIdentity.nextIncompleteSkippedCompletedIndex) === 2
    && isRecord(reviewerCockpitBrowser.draftStorageIdentity.futureTimestampState)
    && readString(reviewerCockpitBrowser.draftStorageIdentity.futureTimestampState.ariaInvalid) === "true"
    && reviewerCockpitBrowser.draftStorageIdentity.futureTimestampState.errorVisible === true
    && readString(reviewerCockpitBrowser.draftStorageIdentity.futureTimestampState.candidateProgress) === "0/8"
    && isRecord(reviewerCockpitBrowser.draftStorageIdentity.titleReconciliationAccess)
    && reviewerCockpitBrowser.draftStorageIdentity.titleReconciliationAccess.candidateVisible === true
    && reviewerCockpitBrowser.draftStorageIdentity.titleReconciliationAccess.officialCurrentTitleVisible === true
    && reviewerCockpitBrowser.draftStorageIdentity.titleReconciliationAccess.corpusSourceTitleVisible === true
    && reviewerCockpitBrowser.draftStorageIdentity.titleReconciliationAccess.provenanceFullyVisible === true
    && cockpitBrowserRows.length === 3
    && cockpitBrowserRows.every((row) => {
      const viewport = isRecord(row.viewport) ? row.viewport : null;
      const body = isRecord(row.body) ? row.body : null;
      const candidateRail = isRecord(row.candidateRail) ? row.candidateRail : null;
      const candidateContext = isRecord(row.candidateContext) ? row.candidateContext : null;
      const candidateEndState = isRecord(row.candidateEndState) ? row.candidateEndState : null;
      const candidateHomeState = isRecord(row.candidateHomeState) ? row.candidateHomeState : null;
      return viewport !== null
        && body !== null
        && readNumber(body.scrollWidth) === readNumber(body.clientWidth)
        && readNumber(body.scrollHeight) === readNumber(viewport.height)
        && readNumber(body.clientHeight) === readNumber(viewport.height)
        && readNumber(row.visibleCandidatePanelCount) === 1
        && readNumber(row.candidateButtonCount) === 8
        && readString(row.candidateTablistRole) === "tablist"
        && readString(row.candidateTablistOrientation) === (readNumber(viewport.width) <= 767 ? "horizontal" : "vertical")
        && readNumber(row.selectedCandidateTabCount) === 1
        && readNumber(row.tabbableCandidateTabCount) === 1
        && row.candidateControlLinksValid === true
        && row.nextIncompleteVisible === true
        && row.nextIncompleteInitiallyEnabled === true
        && row.reviewedAtMaxPresent === true
        && row.futureTimestampErrorInitiallyHidden === true
        && candidateEndState !== null
        && readNumber(candidateEndState.selectedIndex) === 7
        && readNumber(candidateEndState.focusedIndex) === 7
        && candidateEndState.selectedFullyVisible === true
        && candidateHomeState !== null
        && readNumber(candidateHomeState.selectedIndex) === 0
        && readNumber(candidateHomeState.focusedIndex) === 0
        && candidateHomeState.selectedFullyVisible === true
        && candidateRail !== null
        && candidateContext !== null
        && readString(row.candidateContextText) === "후보 1/8 · 현재 0/8 · 전체 0/64"
        && readString(row.candidateRailHeaderDisplay) === "flex"
        && readNumber(candidateContext.top) >= readNumber(candidateRail.top)
        && readNumber(candidateContext.bottom) <= readNumber(candidateRail.bottom)
        && readString(row.draftStatusRole) === "status"
        && readString(row.draftStatusLiveMode) === "polite"
        && row.draftStatusVisible === true
        && readString(row.draftStatusText).startsWith("로컬 초안 ·")
        && (readNumber(viewport.width) > 767 || (
          readNumber(row.firstCandidateButtonWidth) >= 170
          && readString(row.selectedCandidateText).includes("후보 1/8")
          && readString(row.selectedCandidateText).includes("0/8")
        ))
        && readString(row.progressLiveRole) === "status"
        && readString(row.progressLiveMode) === "polite"
        && readString(row.mobileTablistRole) === "tablist"
        && readNumber(row.selectedMobileTabCount) === 1
        && readNumber(row.tabbableMobileTabCount) === 1
        && row.mobileControlLinksValid === true
        && readNumber(row.selectedCandidateMobilePaneRoleCount) === (readNumber(viewport.width) <= 767 ? 2 : 0)
        && readNumber(row.selectedCandidateVisibleMobilePaneCount) === (readNumber(viewport.width) <= 767 ? 1 : 2)
        && readNumber(row.requiredCheckCount) === 40
        && readNumber(row.semanticGroupCount) === 24
        && readNumber(row.evidenceReceiptCount) === 24
        && readNumber(row.evidenceReadingCueCount) === 24
        && readNumber(row.rawExcerptDisclosureCount) === 24
        && readNumber(row.openRawExcerptDisclosureCount) === 0
        && row.rawExcerptTextPreserved === true
        && (readString(row.name) === "mobile-review-390x723"
          || (isRecord(row.receiptAccess) && row.receiptAccess.fullyVisibleInsidePane === true))
        && row.exportInitiallyDisabled === true
        && row.reviewChecklistVisible === true
        && readString(row.reviewChecklistHref) === "../kosha-exact-promotion-review-gate-2026-07-22/review-template.md"
        && row.reviewChecklistTargetExists === true
        && row.horizontalOverflow === false;
    })
    && cockpitBrowserMutation !== null
    && cockpitBrowserMutation.dbMutationPerformed === false
    && cockpitBrowserMutation.providerDispatchCalled === false
    && cockpitBrowserMutation.shareSessionCreated === false
    && cockpitBrowserMutation.embeddingGenerated === false
    && cockpitBrowserMutation.vectorUploadPerformed === false
    && cockpitBrowserMutation.exactTrustRegistryMutationPerformed === false
    && cockpitBrowserMutation.exactPromotionPerformed === false
    && cockpitBrowserBoundary !== null
    && cockpitBrowserBoundary.humanReviewCompleted === false
    && cockpitBrowserBoundary.separatePromotionApprovalRequired === true;
  const reviewerCockpitDetail = reviewerCockpitPass && reviewerCockpitBrowserPass
    ? ` Reviewer cockpit ${reviewerCockpitPath} presents 8 candidates, 24 readable page-and-term cues with each raw PDF excerpt preserved behind an initially closed disclosure, 24 PDF page/body receipts, 2 reconciled official/corpus title provenance rows, and all 64 required human inputs in a viewport-contained no-mutation UI; the 8-candidate/48-unchecked-input human checklist is directly reachable before completion, export remains locked until complete, and promotion remains separate approval. Browser geometry ${reviewerCockpitBrowserPath} preserves one visible candidate, explicit official-current and corpus-source titles, 40 checks, receipt access in the bounded evidence pane, three bounded desktop/mobile cases, reciprocal breakpoint-aware tab/tabpanel semantics, one roving tab stop, End/Home keyboard selection with the selected candidate fully visible, a two-card mobile rail with an always-visible \`후보 1/8 · 현재 0/8 · 전체 0/64\` candidate/current/global progress row, a next-incomplete command that wraps and skips completed candidates, fail-visible future review timestamp rejection, visible empty/changed/restored/stale-rejected draft states plus a fail-visible browser-storage error, all 24 reading cues plus 24 closed raw-excerpt disclosures, corpus-title-and-receipt-bound draft restore that rejects stale fingerprints, and polite live progress.`
    : "";
  if (!isRecord(report)) {
    return gateResult({
      id: "kosha_exact_promotion_review_gate",
      label: "KOSHA exact promotion review gate",
      state: "missing",
      evidencePath,
      detail: "KOSHA exact promotion review-gate evidence is missing. Additional exact-trust promotion cannot be claimed.",
      nextActions: [
        "Generate the review template and run scripts\\kosha_exact_promotion_review_gate.mjs against the operator review input before any exact-trust promotion.",
      ],
    });
  }

  const failures = Array.isArray(report.failures)
    ? report.failures.map(readString).filter(Boolean)
    : [];
  const noMutation = report.mutationPerformed === false
    && report.dbMutationPerformed === false
    && report.embeddingGenerationPerformed === false
    && report.exactPromotionPerformed === false
    && report.providerDispatchLiveClaimed === false;
  const separateApprovalRequired = report.exactTrustPromotionStillRequiresSeparateApproval === true;
  const candidateCount = readNumber(report.candidateCount);
  const reviewedCandidateCount = readNumber(report.reviewedCandidateCount);
  const passedCandidateCount = readNumber(report.passedCandidateCount);
  const blockedTemplate = readString(report.schemaVersion) === "safeclaw-kosha-exact-promotion-review-gate/v1"
    && readString(report.verdict) === "REVIEW_CHECKLIST_INCOMPLETE_BLOCKED"
    && report.reviewChecklistComplete === false
    && report.exactTrustPromotionBlockedUntilChecklistComplete === true
    && separateApprovalRequired
    && noMutation
    && candidateCount === 8
    && reviewedCandidateCount === 8
    && passedCandidateCount === 0
    && failures.length >= 8
    && report.officialPdfAuditMachineVerified === true
    && report.officialLifecycleAuditMachineSupported === true
    && readNumber(report.officialLifecycleTitleVariantFindingCount) === 0
    && report.reviewerSupportMachineVerified === true
    && report.reviewerSupportHumanReviewCompleted === false
    && officialPdfAuditProvesBodyPair
    && officialLifecycleAuditProvesCurrentInventory
    && reviewerSupportProvesSemanticCoverage
    && reviewerCockpitPass
    && reviewerCockpitBrowserPass
    && humanChecklistPass;

  if (blockedTemplate) {
    return gateResult({
      id: "kosha_exact_promotion_review_gate",
      label: "KOSHA exact promotion review gate",
      state: "approval_gated",
      evidencePath,
      detail: `Review template covers ${candidateCount} KOSHA candidates and is blocked by default (${failures.length} checklist failures); no DB, embedding, provider, or exact-registry mutation was performed. Exact promotion still requires completed human review and separate approval.${humanChecklistDetail}${officialPdfAuditDetail}${officialLifecycleAuditDetail}${reviewerSupportDetail}${reviewerCockpitDetail}${contractAuditDetail}`,
      nextActions: [
        "Fill the generated KOSHA review template with reviewer, reviewedAt, humanConfirmed, and every required check before promotion.",
        "Re-run scripts\\kosha_exact_promotion_review_gate.mjs on the completed review input, then seek separate explicit approval before writing any exact-trust registry changes.",
      ],
    });
  }

  const completedButStillApprovalGated = readString(report.schemaVersion) === "safeclaw-kosha-exact-promotion-review-gate/v1"
    && report.reviewChecklistComplete === true
    && separateApprovalRequired
    && noMutation
    && candidateCount !== null
    && reviewedCandidateCount === candidateCount
    && passedCandidateCount === candidateCount
    && report.officialPdfAuditMachineVerified === true
    && report.officialLifecycleAuditMachineSupported === true
    && readNumber(report.officialLifecycleTitleVariantFindingCount) === 0
    && report.reviewerSupportMachineVerified === true
    && report.reviewerSupportHumanReviewCompleted === false
    && officialPdfAuditProvesBodyPair
    && officialLifecycleAuditProvesCurrentInventory
    && reviewerSupportProvesSemanticCoverage
    && reviewerCockpitPass
    && reviewerCockpitBrowserPass
    && humanChecklistPass;

  if (completedButStillApprovalGated) {
    return gateResult({
      id: "kosha_exact_promotion_review_gate",
      label: "KOSHA exact promotion review gate",
      state: "approval_gated",
      evidencePath,
      detail: `Human checklist is complete for ${candidateCount} KOSHA candidates, but exact-trust promotion remains approval-gated and no mutation has been performed.${humanChecklistDetail}${officialPdfAuditDetail}${officialLifecycleAuditDetail}${reviewerSupportDetail}${reviewerCockpitDetail}${contractAuditDetail}`,
      nextActions: [
        "Request explicit approval for the bounded exact-trust promotion before writing registry, DB, embedding, or production runtime changes.",
      ],
    });
  }

  return gateResult({
    id: "kosha_exact_promotion_review_gate",
    label: "KOSHA exact promotion review gate",
    state: "contradicted",
    evidencePath,
    detail: "KOSHA exact promotion review evidence no longer preserves the fail-closed checklist, no-mutation boundary, or separate-approval requirement.",
    nextActions: [
      "Re-run scripts\\kosha_exact_promotion_review_gate.mjs with a valid review input and verify that exact promotion remains blocked until completed review plus separate approval.",
    ],
  });
}

/**
 * @param {string} rootDir
 * @returns {GateResult}
 */
function evaluateCurrentSecurityGovernedPathCompatibilityGate(rootDir) {
  const evidencePath = EVIDENCE_PATHS.currentSecurityGovernedPathCompatibility;
  const report = readJsonFile(rootDir, evidencePath);
  const pass = isRecord(report)
    && isCurrentSecurityGovernedPathCompatibility(rootDir, "share_ack_prebody_admission_security", SHARE_ACK_PREBODY_ADMISSION_PATHS)
    && isCurrentSecurityGovernedPathCompatibility(rootDir, "share_recipient_contact_verification_security", SHARE_RECIPIENT_CONTACT_VERIFICATION_PATHS)
    && isCurrentSecurityGovernedPathCompatibility(rootDir, "public_json_request_body_budget", PUBLIC_JSON_REQUEST_BODY_BUDGET_PATHS)
    && (isCurrentSecurityGovernedPathCompatibility(rootDir, "improvement_photo_analysis_budget", IMPROVEMENT_PHOTO_ANALYSIS_BUDGET_PATHS)
      || isCurrentPhotoReadinessAuthFanoutCompatibility(rootDir, IMPROVEMENT_PHOTO_ANALYSIS_BUDGET_PATHS))
    && isCurrentSecurityGovernedPathCompatibility(rootDir, "public_provider_admission", PUBLIC_PROVIDER_ADMISSION_PATHS)
    && isCurrentSecurityGovernedPathCompatibility(rootDir, "public_ask_distributed_admission", PUBLIC_ASK_DISTRIBUTED_ADMISSION_PATHS)
    && isCurrentSecurityGovernedPathCompatibility(rootDir, "learning_export_renderer_security", LEARNING_EXPORT_RENDERER_SECURITY_PATHS)
    && (isCurrentSecurityGovernedPathCompatibility(rootDir, "mcp_provider_admission_security", MCP_PROVIDER_ADMISSION_PATHS)
      || isCurrentMcpGenerationCancellationCompatibility(rootDir, MCP_PROVIDER_ADMISSION_PATHS))
    && (isCurrentSecurityGovernedPathCompatibility(rootDir, "mcp_generation_work_budget_security", MCP_GENERATION_WORK_BUDGET_SECURITY_PATHS)
      || isCurrentMcpGenerationCancellationCompatibility(rootDir, MCP_GENERATION_WORK_BUDGET_SECURITY_PATHS))
    && isCurrentSecurityGovernedPathCompatibility(rootDir, "security_followup_remediation", ["lib/public-distributed-rate-limit.ts"]);
  const verification = isRecord(report) && isRecord(report.verification) ? report.verification : {};
  const vitest = isRecord(verification.vitest) ? verification.vitest : {};
  const remaining = isRecord(report) && isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  const coveredGateIds = isRecord(report) && Array.isArray(report.coveredGateIds) ? report.coveredGateIds : [];
  const governedPaths = isRecord(report) && Array.isArray(report.governedPaths) ? report.governedPaths : [];
  return gateResult({
    id: "current_security_governed_path_compatibility",
    label: "Current security governed-path compatibility",
    state: pass ? "notice" : "contradicted",
    evidencePath,
    detail: pass
      ? `Current source and production include a shared compatibility receipt for ${coveredGateIds.length} security notices across ${governedPaths.length} governed paths. Contract regression passed ${readNumber(vitest.filesPassed)} files / ${readNumber(vitest.testsPassed)} tests; the opt-in recipient browser file and its ${readNumber(vitest.testsSkipped)} tests were skipped, so no fresh browser PASS is claimed and prior live browser evidence remains the only browser proof. Sealed full scan f218c713 is complete with 18 open findings and partial coverage; this receipt does not rewrite immutable findings or claim security completion. Distributed admission and public-catalog RLS remain operator/approval-gated, no mutation occurred, and exact saved Share remains MISSING_EVIDENCE.`
      : `Current compatibility verdict=${isRecord(report) ? readString(report.verdict) || "missing" : "missing"}, tests=${readNumber(vitest.filesPassed)}/${readNumber(vitest.testsPassed)}, browserSkipped=${readNumber(vitest.filesSkipped)}/${readNumber(vitest.testsSkipped)}, rescan=${readString(remaining.postFixFullRepositoryScan) || "missing"}, exactShare=${readString(remaining.exactSavedShareVerdict) || "missing"}.`,
    nextActions: pass
      ? ["Keep prior live browser receipts visible, remediate the eight approval-free findings in bounded waves, and retain distributed, DB/RLS, recipient ACK, and exact saved Share approval boundaries."]
      : ["Restore all governed-path receipts, at least the original 20/233 contract coverage, transparent browser skips, no-mutation boundaries, the sealed 18-finding scan boundary, and exact Share MISSING_EVIDENCE."],
  });
}

/**
 * @param {{ rootDir?: string, generatedAt?: string, sourceSha?: string }} [options]
 * @returns {NorthstarAudit}
 */
export function buildNorthstarOpenGateAudit(options = {}) {
  gitAncestorCache.clear();
  evidencePathCurrentCache.clear();
  const rootDir = options.rootDir || REPO_ROOT;
  const gates = [
    evaluateFinal99Gate(rootDir),
    evaluateLiveHarnessGate(rootDir),
    evaluateDocumentQualityGroundingGate(rootDir),
    evaluateLiveDocumentQualityMatrixGate(rootDir),
    evaluateLiveDocumentQualityStressMatrixGate(rootDir),
    evaluateLiveDocumentFieldIsolationGate(rootDir),
    evaluateLiveKoshaExactMaterializationGate(rootDir),
    evaluateLiveDocumentWordingReviewGate(rootDir),
    evaluateLiveDocumentBroadReviewGate(rootDir),
    evaluateLiveDocumentEditorialReviewGate(rootDir),
    evaluateDocumentEditorialReviewCockpitGate(rootDir),
    evaluateCurrentLiveDocumentEditorialRuntimeGate(rootDir),
    evaluateProductCapabilityTruthGate(rootDir),
    evaluateCiSupplyChainFullSuiteGate(rootDir),
    evaluateKnowledgePreparationCapabilityTruthGate(rootDir),
    evaluateLaunchOperationsReadinessGate(rootDir),
    evaluateDistributedAdmissionActivationApprovalGate(rootDir),
    evaluateDocumentExportCapabilityTruthGate(rootDir),
    evaluateOntologyViewportWorkbenchGate(rootDir),
    evaluateKnowledgeViewportWorkbenchGate(rootDir),
    evaluateLlmWikiCandidateContentReadinessGate(rootDir),
    evaluateLlmWikiCandidateContentMatrixGate(rootDir),
    evaluateLlmWikiSifEvidenceMatrixGate(rootDir),
    evaluateDependencySecurityRemediationGate(rootDir),
    evaluateTenantAuthorizationRemediationGate(rootDir),
    evaluateSpreadsheetFormulaNeutralizationGate(rootDir),
    evaluatePublicProviderWorkBudgetGate(rootDir),
    evaluateDocumentExportWorkBudgetGate(rootDir),
    evaluateFullRepositorySecurityScanGate(rootDir),
    evaluateRepositorySecurityScanReconciliationGate(rootDir),
    evaluateCurrentSecurityRemediationLedgerGate(rootDir),
    evaluateCurrentRepositorySecurityRescanGate(rootDir),
    evaluateFreshCurrentSourceSecurityScanGate(rootDir),
    evaluateCompletedCurrentHeadStandardSecurityScanGate(rootDir),
    evaluateCurrentSourceApprovalFreeSecurityRemediationGate(rootDir),
    evaluateCurrentSourceSecurityResourceBudgetRemediationGate(rootDir),
    evaluateCurrentSourceLogoutStorageRemediationGate(rootDir),
    evaluateCurrentSourceOntologyErrorProjectionRemediationGate(rootDir),
    evaluateCurrentSourcePhotoReadinessAuthFanoutRemediationGate(rootDir),
    evaluateCurrentSourceMcpGenerationCancellationRemediationGate(rootDir),
    evaluateCurrentSourceKoshaArchivePreflightRemediationGate(rootDir),
    evaluateCurrentSourceSecurityRemediationFollowupGate(rootDir),
    evaluateCurrentSecurityGovernedPathCompatibilityGate(rootDir),
    evaluateCurrentSourceSecurityResidualRemediationGate(rootDir),
    evaluateShareAckPreBodyAdmissionGate(rootDir),
    evaluateSafetyStatusDisconnectLeaseGate(rootDir),
    evaluateWeatherFallbackErrorRedactionGate(rootDir),
    evaluateHwpxArchiveExpansionSecurityGate(rootDir),
    evaluatePostRemediationRepositorySecurityScanGate(rootDir),
    evaluateShareSessionRevocationSecurityGate(rootDir),
    evaluateShareRecipientContactVerificationGate(rootDir),
    evaluateSecurityAtomicDbRaceApprovalBoundaryGate(rootDir),
    evaluateAgentChatDurableAdmissionGate(rootDir),
    evaluateMcpProviderAdmissionGate(rootDir),
    evaluatePublicJsonRequestBodyBudgetGate(rootDir),
    evaluateSecurityResourceRemediationGate(rootDir),
    evaluateSecurityUpstreamTransportRemediationGate(rootDir),
    evaluateSecuritySafetyReferenceSurfaceRemediationGate(rootDir),
    evaluateImprovementPhotoAnalysisBudgetGate(rootDir),
    evaluatePublicProviderCancellationGate(rootDir),
    evaluatePublicProviderAdmissionGate(rootDir),
    evaluatePublicAskDistributedAdmissionGate(rootDir),
    evaluatePublicSearchDistributedAdmissionGate(rootDir),
    evaluatePublicSearchDistributedRateLimitReadinessGate(rootDir),
    evaluatePublicGenerationAdmissionSecurityGate(rootDir),
    evaluateSecurityFollowupRemediationGate(rootDir),
    evaluateMcpGenerationWorkBudgetSecurityGate(rootDir),
    evaluateLearningExportRendererSecurityGate(rootDir),
    evaluateHermesRemoteDurableLedgerGate(rootDir),
    evaluateHermesKnowledgeReviewAuthorityGate(rootDir),
    evaluateHermesKnowledgeReviewAuthorityUiGate(rootDir),
    evaluateHermesReviewDecisionFirstViewportGate(rootDir),
    evaluateHermesReviewCandidatePositionGate(rootDir),
    evaluateHermesKnowledgeReviewEvidenceInspectorGate(rootDir),
    evaluateHermesReviewEventFactTraceabilityGate(rootDir),
    evaluateHermesReviewTraceBlocksGate(rootDir),
    evaluateHermesReviewTraceMatrixGate(rootDir),
    evaluateLiveDocumentSecondaryGroundingGate(rootDir),
    evaluateLiveDocumentSeedProfileIsolationGate(rootDir),
    evaluateUiDocumentsShareCockpitGate(rootDir),
    evaluateLiveDocumentsShareRoutePerceptionGate(rootDir),
    evaluateDeploymentFreshnessGuardGate(rootDir),
    evaluateDispatchStandaloneCockpitGate(rootDir),
    evaluateShareResultFixtureCockpitGate(rootDir),
    evaluateShareRecipientLongContentFixtureGate(rootDir),
    evaluateShareExactSessionBoundaryGate(rootDir),
    evaluateShareRecipientAckApprovalGate(rootDir),
    evaluateProviderDispatchPersistenceGate(rootDir),
    evaluateRlsApprovalGate(rootDir),
    evaluateLlmWikiGate(rootDir),
    evaluateSifEmbeddingGate(rootDir),
    evaluateKoshaExactTrustGate(rootDir),
    evaluateKoshaExactPromotionReviewGate(rootDir),
  ];

  const hasContradiction = gates.some((gate) => gate.state === "contradicted");
  const hasMissing = gates.some((gate) => gate.state === "missing");
  const overall = hasContradiction ? "contradicted" : hasMissing ? "evidence_missing" : "open";

  return {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: options.generatedAt || new Date().toISOString(),
    sourceSha: options.sourceSha || resolveSourceSha(rootDir),
    overall,
    gates,
    safeDemoClaims: [
      "SafeClaw fixes SIF/KOSHA/current work-history evidence before LLM wording.",
      "Hermes/OpenClaw is connected through a guarded EngineAdapter boundary, while SafeClaw remains the system of record.",
      "Worker recipient review is an invited-session flow, not an anonymous public portal.",
      "Photo hazard analysis readiness supports up to 10 images and keeps Before/After improvements as reviewed operation memory.",
    ],
    forbiddenClaims: [
      "LLM Wiki publishes itself.",
      "Hermes is the production source of truth.",
      "OpenClaw learns or mutates DB facts automatically.",
      "SIF vector retrieval is production-active before the approved migration/upload/runtime gate.",
      "All KOSHA metadata-verified candidates are exact production evidence.",
      "KOSHA operator checklist completion alone approves exact-trust promotion.",
      "Live Supabase RLS tenant isolation is launch-proven before catalog and tenant A/B evidence.",
      "Real provider dispatch is production-live for any channel before persistent idempotency and provider result persistence approval.",
      "A completed full repository security scan means the product is security-complete while reportable findings remain open.",
    ],
  };
}

/**
 * @param {NorthstarAudit} audit
 */
export function renderNorthstarOpenGateMarkdown(audit) {
  const rows = audit.gates.map((gate) => (
    `| ${gate.id} | ${gate.state} | ${gate.evidencePath} | ${gate.detail.replace(/\|/gu, "\\|")} |`
  ));
  const nextActions = audit.gates
    .filter((gate) => gate.nextActions.length > 0)
    .flatMap((gate) => gate.nextActions.map((action) => `- ${gate.id}: ${action}`));

  return `# SafeClaw North Star Open Gate Audit

Generated at: ${audit.generatedAt}
Source SHA: \`${audit.sourceSha}\`
Overall: \`${audit.overall}\`

## Gate Matrix

| Gate | State | Evidence | Detail |
| --- | --- | --- | --- |
${rows.join("\n")}

## Safe Demo Claims

${audit.safeDemoClaims.map((claim) => `- ${claim}`).join("\n")}

## Forbidden Claims

${audit.forbiddenClaims.map((claim) => `- ${claim}`).join("\n")}

## Next Actions

${nextActions.length ? nextActions.join("\n") : "- No open next action recorded."}
`;
}

/**
 * @param {string[]} argv
 */
function parseArgs(argv) {
  const parsed = {
    output: DEFAULT_OUTPUT_DIR,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--output") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("--output requires a directory path");
      }
      parsed.output = value;
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      console.log("Usage: node scripts/northstar_open_gate_audit.mjs [--output evaluation/northstar-open-gates-current]");
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return parsed;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const outputDir = path.resolve(REPO_ROOT, args.output);
  fs.mkdirSync(outputDir, { recursive: true });
  const audit = buildNorthstarOpenGateAudit({ rootDir: REPO_ROOT });
  const jsonPath = path.join(outputDir, "report.json");
  const markdownPath = path.join(outputDir, "report.md");
  fs.writeFileSync(jsonPath, `${JSON.stringify(audit, null, 2)}\n`, "utf8");
  fs.writeFileSync(markdownPath, renderNorthstarOpenGateMarkdown(audit), "utf8");
  console.log(JSON.stringify({
    overall: audit.overall,
    output: path.relative(REPO_ROOT, outputDir),
    json: path.relative(REPO_ROOT, jsonPath),
    markdown: path.relative(REPO_ROOT, markdownPath),
    gates: audit.gates.map((gate) => ({ id: gate.id, state: gate.state })),
  }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
