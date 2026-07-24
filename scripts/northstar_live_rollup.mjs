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
  kosha: path.join("evaluation", "kosha-current-live-gate-2026-07-20", "report.json"),
  rlsWiki: path.join("evaluation", "rls-llm-wiki-approval-preflight-current-2026-07-20", "report.json"),
  sifEmbedding: path.join("evaluation", "sif-embedding-gate", "approval-preflight-report.json"),
  liveCritical: path.join("evaluation", "live-critical-surface-current-2026-07-20-rerun", "report.json"),
  mobileP0: path.join("evaluation", "mobile-p0-workspace-gate-2026-07-20", "report.json"),
  workspaceGeometry: path.join("evaluation", "workspace-docs-share-production-gate-2026-07-20", "current-geometry.json"),
  dispatchStandalone: path.join("evaluation", "dispatch-standalone-cockpit-2026-07-21", "report.json"),
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
    || asString(report.commit);
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
  const kosha = tryReadJson(rootDir, ARTIFACTS.kosha);
  const rlsWiki = tryReadJson(rootDir, ARTIFACTS.rlsWiki);
  const sifEmbedding = tryReadJson(rootDir, ARTIFACTS.sifEmbedding);
  const liveCritical = tryReadJson(rootDir, ARTIFACTS.liveCritical);
  const mobileP0 = tryReadJson(rootDir, ARTIFACTS.mobileP0);
  const workspaceGeometry = tryReadJson(rootDir, ARTIFACTS.workspaceGeometry);
  const dispatchStandalone = tryReadJson(rootDir, ARTIFACTS.dispatchStandalone);
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
    evidenceStatus(rootDir, currentHead, liveCommit, "kosha_exact_trust_registry", ARTIFACTS.kosha, kosha),
    evidenceStatus(rootDir, currentHead, liveCommit, "rls_llm_wiki_approval_preflight", ARTIFACTS.rlsWiki, rlsWiki),
    evidenceStatus(rootDir, currentHead, liveCommit, "sif_embedding_preflight", ARTIFACTS.sifEmbedding, sifEmbedding),
    evidenceStatus(rootDir, currentHead, liveCommit, "live_critical_surface", ARTIFACTS.liveCritical, liveCritical),
    evidenceStatus(rootDir, currentHead, liveCommit, "mobile_p0_workspace", ARTIFACTS.mobileP0, mobileP0),
    evidenceStatus(rootDir, currentHead, liveCommit, "workspace_docs_share_geometry", ARTIFACTS.workspaceGeometry, workspaceGeometry),
    evidenceStatus(rootDir, currentHead, liveCommit, "dispatch_standalone_cockpit", ARTIFACTS.dispatchStandalone, dispatchStandalone),
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
