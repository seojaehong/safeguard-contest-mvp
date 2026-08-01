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
  liveDocumentEditorialDuplicateClassification: path.join("evaluation", "live-document-editorial-duplicate-classification-2026-07-25", "report.json"),
  liveDocumentEditorialNearClassification: path.join("evaluation", "live-document-editorial-near-classification-2026-07-25", "report.json"),
  productCapabilityTruth: path.join("evaluation", "product-capability-truth-2026-07-25", "report.json"),
  tenantAuthorizationRemediation: path.join("evaluation", "tenant-authorization-boundary-preflight-2026-07-29", "report.json"),
  spreadsheetFormulaNeutralization: path.join("evaluation", "spreadsheet-formula-neutralization-2026-08-01", "report.json"),
  publicProviderWorkBudget: path.join("evaluation", "public-provider-work-budget-2026-08-01", "report.json"),
  documentExportWorkBudget: path.join("evaluation", "document-export-work-budget-2026-08-01", "report.json"),
  fullRepositorySecurityScan: path.join("evaluation", "full-repository-security-scan-2026-07-28", "report.json"),
  hermesKnowledgeReviewAuthorityUi: path.join("evaluation", "hermes-knowledge-review-authority-ui-2026-07-25", "report.json"),
  liveDocumentSecondaryGrounding: path.join("evaluation", "live-document-secondary-grounding-2026-07-25", "report.json"),
  liveDocumentSeedProfileIsolation: path.join("evaluation", "live-document-seed-profile-isolation-2026-07-25", "report.json"),
  kosha: path.join("evaluation", "kosha-current-live-gate-2026-07-20", "report.json"),
  rlsWiki: path.join("evaluation", "rls-llm-wiki-approval-preflight-current-2026-07-20", "report.json"),
  sifEmbedding: path.join("evaluation", "sif-embedding-gate", "approval-preflight-report.json"),
  liveCritical: path.join("evaluation", "live-critical-surface-current-2026-07-20-rerun", "report.json"),
  mobileP0: path.join("evaluation", "mobile-p0-workspace-gate-2026-07-20", "report.json"),
  workspaceGeometry: path.join("evaluation", "workspace-docs-share-production-gate-2026-07-20", "current-geometry.json"),
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
  if (isRecord(report.productionBuild)) {
    return asString(report.productionBuild.commitSha);
  }
  if (isRecord(report.liveBuildInfo)) {
    return asString(report.liveBuildInfo.commitSha);
  }
  if (isRecord(report.production)) {
    return asString(report.production.commitSha);
  }
  if (isRecord(report.build)) {
    return asString(report.build.commitSha);
  }
  if (isRecord(report.buildInfo)) {
    return asString(report.buildInfo.commitSha);
  }
  if (isRecord(report.liveDispatchState)) {
    return asString(report.liveDispatchState.productionCommitSha);
  }
  if (typeof report.liveCommitAtDraft === "string") {
    return asString(report.liveCommitAtDraft);
  }
  if (typeof report.productionCommitAtGeneration === "string") {
    return asString(report.productionCommitAtGeneration);
  }
  if (typeof report.productionCommitAfterDeployment === "string") {
    return asString(report.productionCommitAfterDeployment);
  }
  if (typeof report.productionCommit === "string") {
    return asString(report.productionCommit);
  }
  if (isRecord(report.source)) {
    return asString(report.source.productionMarkerAtValidation);
  }
  return "";
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
  const liveDocumentEditorialDuplicateClassification = tryReadJson(rootDir, ARTIFACTS.liveDocumentEditorialDuplicateClassification);
  const liveDocumentEditorialNearClassification = tryReadJson(rootDir, ARTIFACTS.liveDocumentEditorialNearClassification);
  const productCapabilityTruth = tryReadJson(rootDir, ARTIFACTS.productCapabilityTruth);
  const tenantAuthorizationRemediation = tryReadJson(rootDir, ARTIFACTS.tenantAuthorizationRemediation);
  const spreadsheetFormulaNeutralization = tryReadJson(rootDir, ARTIFACTS.spreadsheetFormulaNeutralization);
  const publicProviderWorkBudget = tryReadJson(rootDir, ARTIFACTS.publicProviderWorkBudget);
  const documentExportWorkBudget = tryReadJson(rootDir, ARTIFACTS.documentExportWorkBudget);
  const fullRepositorySecurityScan = tryReadJson(rootDir, ARTIFACTS.fullRepositorySecurityScan);
  const hermesKnowledgeReviewAuthorityUi = tryReadJson(rootDir, ARTIFACTS.hermesKnowledgeReviewAuthorityUi);
  const liveDocumentSecondaryGrounding = tryReadJson(rootDir, ARTIFACTS.liveDocumentSecondaryGrounding);
  const liveDocumentSeedProfileIsolation = tryReadJson(rootDir, ARTIFACTS.liveDocumentSeedProfileIsolation);
  const kosha = tryReadJson(rootDir, ARTIFACTS.kosha);
  const rlsWiki = tryReadJson(rootDir, ARTIFACTS.rlsWiki);
  const sifEmbedding = tryReadJson(rootDir, ARTIFACTS.sifEmbedding);
  const liveCritical = tryReadJson(rootDir, ARTIFACTS.liveCritical);
  const mobileP0 = tryReadJson(rootDir, ARTIFACTS.mobileP0);
  const workspaceGeometry = tryReadJson(rootDir, ARTIFACTS.workspaceGeometry);
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
    evidenceStatus(rootDir, currentHead, liveCommit, "live_document_editorial_duplicate_classification", ARTIFACTS.liveDocumentEditorialDuplicateClassification, liveDocumentEditorialDuplicateClassification),
    evidenceStatus(rootDir, currentHead, liveCommit, "live_document_editorial_near_classification", ARTIFACTS.liveDocumentEditorialNearClassification, liveDocumentEditorialNearClassification),
    evidenceStatus(rootDir, currentHead, liveCommit, "product_capability_truth", ARTIFACTS.productCapabilityTruth, productCapabilityTruth),
    evidenceStatus(rootDir, currentHead, liveCommit, "tenant_authorization_remediation", ARTIFACTS.tenantAuthorizationRemediation, tenantAuthorizationRemediation),
    evidenceStatus(rootDir, currentHead, liveCommit, "spreadsheet_formula_neutralization", ARTIFACTS.spreadsheetFormulaNeutralization, spreadsheetFormulaNeutralization),
    evidenceStatus(rootDir, currentHead, liveCommit, "public_provider_work_budget", ARTIFACTS.publicProviderWorkBudget, publicProviderWorkBudget),
    evidenceStatus(rootDir, currentHead, liveCommit, "document_export_work_budget", ARTIFACTS.documentExportWorkBudget, documentExportWorkBudget),
    evidenceStatus(rootDir, currentHead, liveCommit, "full_repository_security_scan", ARTIFACTS.fullRepositorySecurityScan, fullRepositorySecurityScan),
    evidenceStatus(rootDir, currentHead, liveCommit, "hermes_knowledge_review_ui", ARTIFACTS.hermesKnowledgeReviewAuthorityUi, hermesKnowledgeReviewAuthorityUi),
    evidenceStatus(rootDir, currentHead, liveCommit, "live_document_secondary_grounding", ARTIFACTS.liveDocumentSecondaryGrounding, liveDocumentSecondaryGrounding),
    evidenceStatus(rootDir, currentHead, liveCommit, "live_document_seed_profile_isolation", ARTIFACTS.liveDocumentSeedProfileIsolation, liveDocumentSeedProfileIsolation),
    evidenceStatus(rootDir, currentHead, liveCommit, "kosha_exact_trust_registry", ARTIFACTS.kosha, kosha),
    evidenceStatus(rootDir, currentHead, liveCommit, "rls_llm_wiki_approval_preflight", ARTIFACTS.rlsWiki, rlsWiki),
    evidenceStatus(rootDir, currentHead, liveCommit, "sif_embedding_preflight", ARTIFACTS.sifEmbedding, sifEmbedding),
    evidenceStatus(rootDir, currentHead, liveCommit, "live_critical_surface", ARTIFACTS.liveCritical, liveCritical),
    evidenceStatus(rootDir, currentHead, liveCommit, "mobile_p0_workspace", ARTIFACTS.mobileP0, mobileP0),
    evidenceStatus(rootDir, currentHead, liveCommit, "workspace_docs_share_geometry", ARTIFACTS.workspaceGeometry, workspaceGeometry),
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
      exactSavedShareVerdict: isRecord(fullRepositorySecurityScan)
        && isRecord(fullRepositorySecurityScan.remainingBoundaries)
        ? asString(fullRepositorySecurityScan.remainingBoundaries.exactSavedShareVerdict)
        : "",
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
      dbMutationPerformed: recordAt(hermesKnowledgeReviewAuthorityUi, "mutationBoundary")?.dbMutationPerformed === true,
      providerDispatchCalled: recordAt(hermesKnowledgeReviewAuthorityUi, "mutationBoundary")?.providerDispatchCalled === true,
      shareSessionCreated: recordAt(hermesKnowledgeReviewAuthorityUi, "mutationBoundary")?.shareSessionCreated === true,
      ontologyPublicationPerformed: recordAt(hermesKnowledgeReviewAuthorityUi, "mutationBoundary")?.ontologyPublicationPerformed === true,
      exactSavedShareVerdict: asString(recordAt(hermesKnowledgeReviewAuthorityUi, "remainingBoundaries")?.exactSavedShareVerdict),
      llmWikiPublication: asString(recordAt(hermesKnowledgeReviewAuthorityUi, "remainingBoundaries")?.llmWikiPublication),
      supabaseRlsLaunchIsolation: asString(recordAt(hermesKnowledgeReviewAuthorityUi, "remainingBoundaries")?.supabaseRlsLaunchIsolation),
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
    `- Mutation boundary DB/provider/share/publication: ${rollup.hermesKnowledgeReviewAuthorityUi.dbMutationPerformed}/${rollup.hermesKnowledgeReviewAuthorityUi.providerDispatchCalled}/${rollup.hermesKnowledgeReviewAuthorityUi.shareSessionCreated}/${rollup.hermesKnowledgeReviewAuthorityUi.ontologyPublicationPerformed}`,
    `- Exact saved Share: ${rollup.hermesKnowledgeReviewAuthorityUi.exactSavedShareVerdict || "MISSING_EVIDENCE"}; LLM Wiki/RLS: ${rollup.hermesKnowledgeReviewAuthorityUi.llmWikiPublication || "APPROVAL_GATED"}/${rollup.hermesKnowledgeReviewAuthorityUi.supabaseRlsLaunchIsolation || "APPROVAL_GATED"}`,
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
