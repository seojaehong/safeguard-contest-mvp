#!/usr/bin/env node
// @ts-check

import fs from "node:fs";
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
  liveHarness: path.join("evaluation", "live-harness-quality-probe-current-2026-07-20", "report.json"),
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
  liveDocumentRainContextIsolation: path.join("evaluation", "live-document-rain-context-isolation-2026-07-25", "report.json"),
  productCapabilityTruth: path.join("evaluation", "product-capability-truth-2026-07-25", "report.json"),
  dispatchEntryCapabilityTruth: path.join("evaluation", "dispatch-entry-capability-truth-2026-07-28", "report.json"),
  landingHumanReviewBoundary: path.join("evaluation", "landing-human-review-boundary-2026-07-28", "report.json"),
  dependencySecurityRemediation: path.join("evaluation", "dependency-security-remediation-2026-07-28", "report.json"),
  fullRepositorySecurityScan: path.join("evaluation", "full-repository-security-scan-2026-07-28", "report.json"),
  hermesKnowledgeReviewContract: path.join("evaluation", "hermes-knowledge-review-contract-live-2026-07-25", "report.json"),
  hermesKnowledgeReviewAuthorityUi: path.join("evaluation", "hermes-knowledge-review-authority-ui-2026-07-25", "report.json"),
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
  shareDesktopComposition: path.join("evaluation", "share-desktop-composition-2026-07-21", "report.json"),
  shareDesktopShortCockpit: path.join("evaluation", "share-desktop-short-cockpit-2026-07-21", "report.json"),
  shareDesktopPerception: path.join("evaluation", "share-desktop-perception-2026-07-22", "report.json"),
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
  providerDispatchIdempotency: path.join("evaluation", "provider-dispatch-idempotency-gate-2026-07-19", "report.json"),
  workspaceIaLiveRefinement: path.join("evaluation", "workspace-ia-live-f67-2026-07-21", "report.json"),
  workspaceEditorDetailLanding: path.join("evaluation", "workspace-editor-detail-landing-2026-07-21", "report.json"),
  workspaceIaLiveCurrent: path.join("evaluation", "workspace-ia-live-7b36-2026-07-22", "report.json"),
  koshaCurrentNorthstarRegression: path.join("evaluation", "kosha-current-northstar-regression-2026-07-22", "report.json"),
  koshaCurrentGate: path.join("evaluation", "kosha-current-live-gate-2026-07-20", "report.json"),
  koshaCurrentReconciliation: path.join("evaluation", "kosha-current-master-reconciliation-2026-07-19", "report.json"),
  koshaCurrentLive: path.join("evaluation", "kosha-exact-trust-current-live-2026-07-19", "report.md"),
  koshaExactPromotionReviewGate: path.join("evaluation", "kosha-exact-promotion-review-gate-2026-07-22", "report.json"),
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
function isGitAncestor(rootDir, possibleAncestorSha) {
  if (!/^[0-9a-f]{40}$/u.test(possibleAncestorSha)) {
    return true;
  }
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", possibleAncestorSha, "HEAD"], {
      cwd: rootDir,
      stdio: ["ignore", "ignore", "ignore"],
    });
    return true;
  } catch {
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
        ? `final-99 overall is ${overall}; ${carriedNoticeCount} notices are explicitly carried in ${noticeCarryPath}: ${noticeImpacts}. Fully automated launch remains forbidden until those approval/auth gates are proven.${noApprovalBoundaryDetail}`
        : `final-99 overall is ${overall}.`,
      nextActions: overall === "pass_with_notice"
        ? noticeCarryReady
          ? [
            "Do not claim fully automated launch readiness until admin-auth live save/reopen and approved provider dispatch are executed in a secure environment.",
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
  const mutationBoundary = isRecord(report.mutationBoundary) ? report.mutationBoundary : {};
  const remainingBoundaries = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
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
    && noMutation
    && remainingBoundaries.llmWikiPublication === "APPROVAL_GATED"
    && remainingBoundaries.supabaseRlsLaunchIsolation === "APPROVAL_GATED"
    && remainingBoundaries.exactSavedShareVerdict === "MISSING_EVIDENCE";

  if (pass) {
    return gateResult({
      id: "hermes_knowledge_review_ui",
      label: "Hermes knowledge reviewer UI",
      state: "proven",
      evidencePath,
      detail: "Live authenticated reviewer cockpit passes 8/8 Day/Night desktop and mobile geometry cases, exposes six SIF -> KOSHA -> law -> tenant-memory evidence roles, requires law provenance and site-manager acceptance, and performs no DB, provider, publication, or Share mutation. LLM Wiki/RLS remain APPROVAL_GATED and exact saved Share remains MISSING_EVIDENCE.",
      nextActions: [],
    });
  }

  return gateResult({
    id: "hermes_knowledge_review_ui",
    label: "Hermes knowledge reviewer UI",
    state: "contradicted",
    evidencePath,
    detail: `Hermes reviewer UI contract failed: local=${readString(local.verdict) || "missing"}, live=${readString(afterLive.verdict) || "missing"}, humanReview=${String(authorityContract.humanReviewRequired)}, noMutation=${String(noMutation)}, exactShare=${readString(remainingBoundaries.exactSavedShareVerdict) || "missing"}.`,
    nextActions: ["Restore the six-role reviewer cockpit, live geometry, human-review, tenant-memory, and no-mutation boundaries."],
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
    && noMutation;

  if (liveReady) {
    return gateResult({
      id: "live_document_field_isolation",
      label: "Live document scenario field isolation",
      state: "proven",
      evidencePath,
      detail: "Ten live normal and stress scenarios keep process/task/equipment fields grounded in their own work identity and free of other scenario-exclusive fingerprints. No DB/share-session/provider mutation occurred; broad human wording review and exact saved Share geometry remain separate.",
      nextActions: ["Keep the 10-scenario field-isolation gate in release evidence and preserve broad human wording review as a separate boundary."],
    });
  }

  return gateResult({
    id: "live_document_field_isolation",
    label: "Live document scenario field isolation",
    state: "contradicted",
    evidencePath,
    detail: `Field-isolation verdict=${readString(report.verdict) || "unknown"}, live=${livePass}/10, failed=${liveFail}, livePending=${report.liveAfterDeploymentPending === true}, noMutation=${noMutation}.`,
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
    && readString(remainingBoundaries.documentsShareIaVerdict) === "OPEN_SEPARATE_VIEWPORT_IA_WAVE"
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
      detail: `Manual email/SMS/Kakao and scheduled briefing email are fail-closed preview-only because persistent idempotency is unavailable. Live dispatch entry copy distinguishes preview/readiness from approved results (${entryTruthPath}), and the public landing keeps safety judgment and final confirmation with a human instead of claiming role replacement (${landingTruthPath}). Live photo Vision/OCR readiness is accepted-only, AI generation modes are template/enhanced/full, and no DB/share/provider/photo POST mutation occurred. This does not grant provider dispatch approval or replace broad human/legal review: exact saved Share remains MISSING_EVIDENCE and Documents/Share IA remains OPEN_SEPARATE_VIEWPORT_IA_WAVE.`,
      nextActions: [
        "Keep provider dispatch persistence approval-gated.",
        "Measure exact saved Share and Documents/Share viewport IA in their separate gates.",
      ],
    });
  }

  return gateResult({
    id: "product_capability_truth",
    label: "Live product capability truth",
    state: "contradicted",
    evidencePath,
    detail: `Capability verdict=${readString(report.verdict) || "unknown"}, sourceMatchesProduction=${sourceMatchesProduction}, dispatch=${readString(providerDispatch.mode) || "unknown"}/${readString(providerDispatch.reason) || "unknown"}, providerCalled=${providerDispatch.providerCalled === true}, briefingEmailReady=${briefing.emailReady === true}, photoReady=${photo.ready === true}, photoAcceptedOnly=${photo.acceptedOnly === true}, photoPost=${photo.photoPostAnalysisExecuted === true}, uiTruthPass=${uiTruthPass}, entryTruthPass=${entryTruthPass}, landingTruthPass=${landingTruthPass}, aiModes=${sortedModes || "missing"}, noMutation=${noMutation}, exactShare=${readString(remainingBoundaries.exactSavedShareVerdict) || "missing"}, ia=${readString(remainingBoundaries.documentsShareIaVerdict) || "missing"}.`,
    nextActions: ["Restore the fail-closed capability boundaries and rerun current-production truth evidence without mutation."],
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
  const preflightReady = isRecord(preflight)
    && preflight.overall === "approval_ready_open"
    && preflight.launchReadiness === false
    && preflight.dbMutationPerformed === false
    && preflight.networkOpened === false
    && Array.isArray(preflight.failedCheckIds)
    && preflight.failedCheckIds.length === 0
    && requiredWikiChecks.every((id) => passedCheckIds.has(id))
    && publicationSurfaceInventoryPass
    && preflightCurrent;
  if (redApproval && unavailable && preflightReady) {
    return gateResult({
      id: "llm_wiki_publication",
      label: "LLM Wiki publication",
      state: "approval_gated",
      evidencePath: preflightPath,
      detail: `Candidate/wiki surfaces exist, but publication RPC/RLS/ledger approval is not complete. Current preflight passed at source SHA ${preflightSourceSha || "not-recorded"}.`,
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
  const shareDesktopPath = EVIDENCE_PATHS.shareDesktopComposition;
  const shareDesktopShortPath = EVIDENCE_PATHS.shareDesktopShortCockpit;
  const shareDesktopPerceptionPath = EVIDENCE_PATHS.shareDesktopPerception;
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
  const shareDesktop = readJsonFile(rootDir, shareDesktopPath);
  const shareDesktopShort = readJsonFile(rootDir, shareDesktopShortPath);
  const shareDesktopPerception = readJsonFile(rootDir, shareDesktopPerceptionPath);
  const share = readJsonFile(rootDir, sharePath);
  const shareStageRail = readJsonFile(rootDir, shareStageRailPath);
  const shareMobileStageRailCollapse = readJsonFile(rootDir, shareMobileStageRailCollapsePath);
  const shareMobileExactViewport = readJsonFile(rootDir, shareMobileExactViewportPath);
  const shareRecipientCockpit = readJsonFile(rootDir, shareRecipientCockpitPath);
  const workspaceIaLiveRefinement = readJsonFile(rootDir, workspaceIaLiveRefinementPath);
  const workspaceEditorDetailLanding = readJsonFile(rootDir, workspaceEditorDetailLandingPath);
  const workspaceIaCurrentReport = readJsonFile(rootDir, workspaceIaLiveCurrentPath);

  if (!isRecord(internalPane) || !isRecord(paneContext) || !isRecord(drilldown) || !isRecord(innerPaneDepth) || !isRecord(fieldFirst) || !isRecord(riskRowCockpit) || !isRecord(tbmCockpit) || !isRecord(firstViewSplit) || !isRecord(educationCockpit) || !isRecord(emergencyCockpit) || !isRecord(completeCockpits) || !isRecord(completeCockpitsLive) || !isRecord(documentsMobileExactCockpit) || !isRecord(documentsSelectedEditorCockpit) || !isRecord(documentsCockpitWorkbenchGeometry) || !isRecord(shareDesktop) || !isRecord(shareDesktopShort) || !isRecord(shareDesktopPerception) || !isRecord(share) || !isRecord(shareStageRail) || !isRecord(shareMobileStageRailCollapse) || !isRecord(shareMobileExactViewport) || !isRecord(shareRecipientCockpit) || !isRecord(workspaceIaLiveRefinement) || !isRecord(workspaceEditorDetailLanding) || !isRecord(workspaceIaCurrentReport)) {
    return gateResult({
      id: "ui_documents_share_cockpit",
      label: "Documents and Share cockpit UI",
      state: "missing",
      evidencePath: !isRecord(internalPane) ? internalPanePath : !isRecord(paneContext) ? paneContextPath : !isRecord(drilldown) ? drilldownPath : !isRecord(innerPaneDepth) ? innerPaneDepthPath : !isRecord(fieldFirst) ? fieldFirstPath : !isRecord(riskRowCockpit) ? riskRowCockpitPath : !isRecord(tbmCockpit) ? tbmCockpitPath : !isRecord(firstViewSplit) ? firstViewSplitPath : !isRecord(educationCockpit) ? educationCockpitPath : !isRecord(emergencyCockpit) ? emergencyCockpitPath : !isRecord(completeCockpits) ? completeCockpitsPath : !isRecord(completeCockpitsLive) ? completeCockpitsLivePath : !isRecord(documentsMobileExactCockpit) ? documentsMobileExactCockpitPath : !isRecord(documentsSelectedEditorCockpit) ? documentsSelectedEditorCockpitPath : !isRecord(documentsCockpitWorkbenchGeometry) ? documentsCockpitWorkbenchGeometryPath : !isRecord(shareDesktop) ? shareDesktopPath : !isRecord(shareDesktopShort) ? shareDesktopShortPath : !isRecord(shareDesktopPerception) ? shareDesktopPerceptionPath : !isRecord(share) ? sharePath : !isRecord(shareStageRail) ? shareStageRailPath : !isRecord(shareMobileStageRailCollapse) ? shareMobileStageRailCollapsePath : !isRecord(shareMobileExactViewport) ? shareMobileExactViewportPath : !isRecord(shareRecipientCockpit) ? shareRecipientCockpitPath : !isRecord(workspaceIaLiveRefinement) ? workspaceIaLiveRefinementPath : !isRecord(workspaceEditorDetailLanding) ? workspaceEditorDetailLandingPath : workspaceIaLiveCurrentPath,
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

  if (documentsPass && sharePass && workspaceIaRefinementPass && workspaceEditorDetailLandingPass && selectedEditorCockpitPass && workspaceIaCurrentPass && documentsCockpitWorkbenchGeometryPass) {
    return gateResult({
      id: "ui_documents_share_cockpit",
      label: "Documents and Share cockpit UI",
      state: "proven",
      evidencePath: isRecord(documentsCockpitWorkbenchGeometry) ? documentsCockpitWorkbenchGeometryPath : workspaceIaLiveCurrentPath,
      detail: "Scoped first-task cockpit proof only, not full Documents/Share IA completion: live /documents?theme=day geometry now directly proves the selected-document cockpit/workbench is not the stale stacked layout at 1440x723 and 390x723, with 12 unique document keys, exactly 3 visible core launchers, 9 supporting launchers kept inside the closed disclosure, 0 visible supporting launchers by default, and the legacy document index hidden. Default /workspace Documents and Share cockpits, /documents mobile first-action containment, exact one-viewport Documents review cockpit, selected-document context/summary layers, selected editor/detail field-summary risk-row landing, selected-editor field summary plus evidence/recheck CTA before raw textarea, one-section document drilldown accordion, production-confirmed inner-pane default depth, selected-section field/evidence/recheck affordance, and live 12 document first-task cockpits before long raw editors remain scoped. Live Workspace Share now separately proves a 1440px three-zone cockpit, including desktop-short 1440x723, with the status/provenance rail inside the first viewport and a 390x723 mobile stack with that rail hidden; the invited recipient fixture retains a separate desktop two-zone contract. It also keeps desktop-short Share containment, staged Share rail, live mobile selected-summary/preview/primary CTA/config toggle, collapsed mobile configuration stack, provider-result summary inside the first viewport, mobile Share exact 844px viewport containment, and /share/[sessionId] desktop recipient confirmation cockpit with mobile confirmation CTA before document details. This is not a claim that the whole Documents page is short; raw textarea/full long-form editing remains open secondary drilldown. It also does not prove exact saved/generated Share, provider live dispatch, or route/page split alone as the UX fix.",
      nextActions: [
        "Keep the production live geometry recorded for first-action Documents/Share cockpits and 12-document cockpit slices; do not phrase it as documents page height fixed or expand it into a full 12-document field-first authoring claim.",
        "Keep raw textarea and deeper row/all-document authoring as secondary drilldown follow-up; selected-editor evidence/recheck CTA is live-proven before raw textarea, but the full 12-document edit surface itself is not claimed short.",
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
    evidencePath: !workspaceIaRefinementPass ? workspaceIaLiveRefinementPath : !workspaceEditorDetailLandingPass ? workspaceEditorDetailLandingPath : !selectedEditorCockpitPass ? documentsSelectedEditorCockpitPath : !workspaceIaCurrentPass ? workspaceIaLiveCurrentPath : !documentsCockpitWorkbenchGeometryPass ? documentsCockpitWorkbenchGeometryPath : !shareDesktopPerceptionPass ? shareDesktopPerceptionPath : documentsPass ? shareDesktopShortPath : documentsMobileExactCockpitPath,
    detail: "Documents/share cockpit evidence no longer proves bounded page height, the 12/3/9/0 default document exposure budget with the legacy index hidden, exact mobile Documents cockpit, visible selected-document pane context, selected editor/detail field-summary landing with raw textarea kept secondary, selected-editor evidence/recheck CTA before raw textarea, first-viewport share action, share recipient cockpit geometry, and the latest IA refinement together.",
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
  const report = readJsonFile(rootDir, evidencePath);
  const viewportReport = readJsonFile(rootDir, viewportEvidencePath);
  if (!isRecord(report) || !isRecord(viewportReport)) {
    return gateResult({
      id: "dispatch_standalone_cockpit",
      label: "Standalone dispatch viewport cockpit",
      state: "missing",
      evidencePath: !isRecord(report) ? evidencePath : viewportEvidencePath,
      detail: "Standalone dispatch desktop or viewport companion report is missing or invalid.",
      nextActions: ["Run the standalone /dispatch desktop-short and mobile-short cockpit gates before claiming dispatch UI closure."],
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
  const productionVerified = production.liveVerified === true
    && readString(production.commitSha)
    && isGitAncestor(rootDir, readString(production.commitSha));
  const sampleProductionVerified = sampleProduction.liveVerified === true
    && readString(sampleProduction.commitSha)
    && isGitAncestor(rootDir, readString(sampleProduction.commitSha));
  const viewportProductionVerified = readString(viewportReport.sourceHead) === readString(viewportProduction.commitSha)
    && readString(viewportProduction.commitSha)
    && isGitAncestor(rootDir, readString(viewportProduction.commitSha));
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
      evidencePath: viewportEvidencePath,
      detail: `Production /dispatch keeps the legacy desktop/sample resilience proof and now requires the viewport companion: 1440x723 preview bottom=${readNumber(viewportDesktop.previewBottom) ?? "unknown"}, primary bottom=${readNumber(viewportDesktop.primaryBottom) ?? "unknown"}, mobile Day/Night primary bottom=${readNumber(viewportMobileDay.primaryBottom) ?? "unknown"}/${readNumber(viewportMobileNight.primaryBottom) ?? "unknown"}, local scroll retained, route split alone false, exact saved Share MISSING_EVIDENCE. Legacy seeded pageHeight ${pageHeight ?? "unknown"} (${heightRatio ?? "unknown"}x), sample panels ${readNumber(sampleDesktop.firstPanel?.width) ?? "unknown"}px/${readNumber(sampleDesktop.secondPanel?.width) ?? "unknown"}px.`,
      nextActions: [
        "Keep provider dispatch live-send claims gated until persistent idempotency and provider result persistence are approved.",
      ],
    });
  }

  return gateResult({
    id: "dispatch_standalone_cockpit",
    label: "Standalone dispatch viewport cockpit",
    state: "contradicted",
    evidencePath: viewportPass ? evidencePath : viewportEvidencePath,
    detail: "Standalone dispatch reports no longer prove desktop two-pane, desktop-short preview containment, mobile-short first action, compact controls, and exact-session non-closure together.",
    nextActions: ["Re-run standalone /dispatch desktop-short and mobile-short browser gates and fix the layout before claiming closure."],
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
  const verification = isRecord(report.verification) ? report.verification : {};
  const mutationBoundary = isRecord(report.mutationBoundary) ? report.mutationBoundary : {};
  const remainingBoundaries = isRecord(report.remainingBoundaries) ? report.remainingBoundaries : {};
  const findingFamilies = isRecord(report.findingFamilies) ? report.findingFamilies : {};
  const noMutation = mutationBoundary.dbMutationPerformed === false
    && mutationBoundary.shareSessionCreated === false
    && mutationBoundary.providerDispatchCalled === false
    && mutationBoundary.embeddingGenerated === false
    && mutationBoundary.vectorUploadPerformed === false
    && mutationBoundary.wikiPublished === false
    && mutationBoundary.exactTrustRegistryMutationPerformed === false;
  const pass = readString(report.verdict) === "COMPLETE_LIVE_PRODUCTION_REPOSITORY_SECURITY_SCAN_REPORTABLE_FINDINGS_OPEN"
    && readString(report.sourceHead).length > 0
    && readString(report.sourceHead) === readString(productionBuild.commitSha)
    && productionBuild.sourceHeadMatchesProduction === true
    && readString(scan.mode) === "repository"
    && readString(scan.inventoryStrategy) === "repository"
    && readString(scan.completeness) === "complete"
    && readString(scan.targetKind) === "git_revision"
    && readNumber(scan.fileCount) === 4772
    && readNumber(scan.candidateCount) === 21
    && readNumber(scan.reportableFindingCount) === 18
    && readNumber(scan.suppressedCandidateCount) === 3
    && readNumber(scan.deferredCandidateCount) === 0
    && readNumber(severity.critical) === 0
    && readNumber(severity.high) === 0
    && readNumber(severity.medium) === 5
    && readNumber(severity.low) === 13
    && readNumber(findingFamilies.crossTenantAuthorization) === 2
    && readNumber(findingFamilies.publicProviderAndUpstreamResourceAbuse) === 4
    && readNumber(findingFamilies.spreadsheetFormulaInjection) === 4
    && readNumber(findingFamilies.documentExportResourceExhaustion) === 8
    && readNumber(verification.focusedTestFiles) === 7
    && readNumber(verification.focusedTestsPassed) === 102
    && verification.canonicalJsonValidated === true
    && verification.finalizerCompleted === true
    && readNumber(verification.sealedArtifactCount) === 16
    && noMutation
    && remainingBoundaries.fullRepositorySecurityScanCompleted === true
    && remainingBoundaries.securityCompleteClaimAllowed === false
    && remainingBoundaries.remediationRequired === true
    && readNumber(remainingBoundaries.reportableFindingCount) === 18
    && readString(remainingBoundaries.exactSavedShareVerdict) === "MISSING_EVIDENCE"
    && readString(remainingBoundaries.providerDispatchPersistence) === "approval_gated";

  if (pass) {
    return gateResult({
      id: "full_repository_security_scan",
      label: "Full repository security scan",
      state: "proven",
      evidencePath,
      detail: "The immutable live production revision received complete repository coverage: 4,772 files accounted for, 21 candidates decided, 18 reportable findings retained (5 medium, 13 low), 3 Share/confirmation candidates suppressed with explicit counterevidence, and 0 deferred rows. Completion is not a security-complete claim: remediation remains required, no mutation or destructive load was performed, and exact saved Share remains MISSING_EVIDENCE.",
      nextActions: [
        "Remediate the scheduled-briefing cross-tenant owner binding first, then public provider work budgets, export work budgets, and CSV/TSV formula neutralization.",
        "Do not claim security completion until the 18 reportable findings are fixed and a follow-up scan confirms closure.",
      ],
    });
  }

  return gateResult({
    id: "full_repository_security_scan",
    label: "Full repository security scan",
    state: "contradicted",
    evidencePath,
    detail: `Security scan verdict=${readString(report.verdict) || "unknown"}, sourceMatchesProduction=${readString(report.sourceHead) === readString(productionBuild.commitSha)}, completeness=${readString(scan.completeness) || "unknown"}, files=${readNumber(scan.fileCount)}, candidates=${readNumber(scan.candidateCount)}, reportable=${readNumber(scan.reportableFindingCount)}, deferred=${readNumber(scan.deferredCandidateCount)}, securityComplete=${remainingBoundaries.securityCompleteClaimAllowed === true}, noMutation=${noMutation}, exactShare=${readString(remainingBoundaries.exactSavedShareVerdict) || "missing"}.`,
    nextActions: ["Restore complete candidate closure and the explicit findings-open/no-mutation boundary before claiming repository scan completion."],
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
  const reviewerSupportProvesSemanticCoverage = isRecord(reviewerSupport)
    && readString(reviewerSupport.schemaVersion) === "safeclaw-kosha-exact-promotion-reviewer-support/v1"
    && readString(reviewerSupport.verdict) === "PASS_MACHINE_REVIEWER_SUPPORT_HUMAN_CONFIRMATION_REQUIRED"
    && readNumber(reviewerSupport.candidateCount) === 8
    && readNumber(reviewerSupport.machineSupportedCount) === 8
    && readNumber(reviewerSupport.failedCount) === 0
    && readNumber(reviewerSupport.semanticGroupCount) === 24
    && readNumber(reviewerSupport.failedSemanticGroupCount) === 0
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
    ? ` Reviewer-support audit ${reviewerSupportPath} records bounded excerpts for 8/8 candidates and 24/24 semantic groups without completing human review or creating a registry artifact.`
    : "";
  const reviewerCockpitBoundary = isRecord(reviewerCockpit) && isRecord(reviewerCockpit.boundary)
    ? reviewerCockpit.boundary
    : null;
  const reviewerCockpitPass = isRecord(reviewerCockpit)
    && readString(reviewerCockpit.schemaVersion) === "safeclaw-kosha-exact-promotion-reviewer-cockpit/v1"
    && readString(reviewerCockpit.verdict) === "PASS_NO_MUTATION_KOSHA_REVIEWER_COCKPIT_READY"
    && readNumber(reviewerCockpit.candidateCount) === 8
    && readNumber(reviewerCockpit.semanticGroupCount) === 24
    && readNumber(reviewerCockpit.checklistInputCount) === 64
    && readNumber(reviewerCockpit.initialCompletedInputCount) === 0
    && reviewerCockpit.exportInitiallyDisabled === true
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
    && cockpitBrowserRows.length === 3
    && cockpitBrowserRows.every((row) => {
      const viewport = isRecord(row.viewport) ? row.viewport : null;
      const body = isRecord(row.body) ? row.body : null;
      return viewport !== null
        && body !== null
        && readNumber(body.scrollWidth) === readNumber(body.clientWidth)
        && readNumber(body.scrollHeight) === readNumber(viewport.height)
        && readNumber(body.clientHeight) === readNumber(viewport.height)
        && readNumber(row.visibleCandidatePanelCount) === 1
        && readNumber(row.candidateButtonCount) === 8
        && readNumber(row.requiredCheckCount) === 40
        && readNumber(row.semanticGroupCount) === 24
        && row.exportInitiallyDisabled === true
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
    ? ` Reviewer cockpit ${reviewerCockpitPath} presents 8 candidates, 24 bounded excerpts, and all 64 required human inputs in a viewport-contained no-mutation UI; export remains locked until complete and promotion remains separate approval. Browser geometry ${reviewerCockpitBrowserPath} preserves one visible candidate, 40 checks, and three bounded desktop/mobile cases.`
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
    && reviewerCockpitBrowserPass;

  if (blockedTemplate) {
    return gateResult({
      id: "kosha_exact_promotion_review_gate",
      label: "KOSHA exact promotion review gate",
      state: "approval_gated",
      evidencePath,
      detail: `Review template covers ${candidateCount} KOSHA candidates and is blocked by default (${failures.length} checklist failures); no DB, embedding, provider, or exact-registry mutation was performed. Exact promotion still requires completed human review and separate approval.${officialPdfAuditDetail}${officialLifecycleAuditDetail}${reviewerSupportDetail}${reviewerCockpitDetail}${contractAuditDetail}`,
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
    && reviewerCockpitBrowserPass;

  if (completedButStillApprovalGated) {
    return gateResult({
      id: "kosha_exact_promotion_review_gate",
      label: "KOSHA exact promotion review gate",
      state: "approval_gated",
      evidencePath,
      detail: `Human checklist is complete for ${candidateCount} KOSHA candidates, but exact-trust promotion remains approval-gated and no mutation has been performed.${officialPdfAuditDetail}${officialLifecycleAuditDetail}${reviewerSupportDetail}${reviewerCockpitDetail}${contractAuditDetail}`,
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
 * @param {{ rootDir?: string, generatedAt?: string, sourceSha?: string }} [options]
 * @returns {NorthstarAudit}
 */
export function buildNorthstarOpenGateAudit(options = {}) {
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
    evaluateProductCapabilityTruthGate(rootDir),
    evaluateDependencySecurityRemediationGate(rootDir),
    evaluateFullRepositorySecurityScanGate(rootDir),
    evaluateHermesKnowledgeReviewAuthorityGate(rootDir),
    evaluateHermesKnowledgeReviewAuthorityUiGate(rootDir),
    evaluateLiveDocumentSecondaryGroundingGate(rootDir),
    evaluateLiveDocumentSeedProfileIsolationGate(rootDir),
    evaluateUiDocumentsShareCockpitGate(rootDir),
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
