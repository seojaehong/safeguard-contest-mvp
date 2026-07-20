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
    path.join("evaluation", "final-99-gate-current-2026-07-20", "report.json"),
    path.join("evaluation", "final-99-gate", "report.json"),
  ]),
  final99NoticeCarryCandidates: Object.freeze([
    path.join("evaluation", "final-99-gate-current-2026-07-20", "notice-carry.json"),
    path.join("evaluation", "final-99-gate", "notice-carry.json"),
  ]),
  liveHarness: path.join("evaluation", "live-harness-quality-probe-current-2026-07-20", "report.json"),
  rlsApproval: path.join("evaluation", "supabase-rls-approval-2026-07-17", "report.md"),
  llmWikiApproval: path.join("evaluation", "llm-wiki-rls-approval-2026-07-17", "report.md"),
  rlsLlmWikiApprovalPreflight: path.join("evaluation", "rls-llm-wiki-approval-preflight-current-2026-07-20", "report.json"),
  sifEmbeddingPreflight: path.join("evaluation", "sif-embedding-gate", "approval-preflight-report.json"),
  documentsMobileInternalPane: path.join("evaluation", "documents-mobile-internal-pane-2026-07-21", "report.json"),
  documentsMobilePaneContext: path.join("evaluation", "documents-mobile-pane-context-2026-07-21", "report.json"),
  documentsDrilldownDepth: path.join("evaluation", "documents-drilldown-depth-2026-07-21", "report.json"),
  shareMobileFullFlow: path.join("evaluation", "share-mobile-full-flow-2026-07-21", "report.json"),
  dispatchStandalone: path.join("evaluation", "dispatch-standalone-cockpit-2026-07-21", "report.json"),
  koshaCurrentNorthstarRegression: path.join("evaluation", "kosha-current-northstar-regression-2026-07-21", "report.json"),
  koshaCurrentGate: path.join("evaluation", "kosha-current-live-gate-2026-07-20", "report.json"),
  koshaCurrentReconciliation: path.join("evaluation", "kosha-current-master-reconciliation-2026-07-19", "report.json"),
  koshaCurrentLive: path.join("evaluation", "kosha-exact-trust-current-live-2026-07-19", "report.md"),
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
    const carriedNoticeCount = notices.filter((notice) => (
      isRecord(notice) && notice.carried === true && readString(notice.launchImpact)
    )).length;
    const noticeCarryReady = isRecord(noticeCarry)
      && noticeCarry.verdict === "carried"
      && carriedNoticeCount >= 2
      && noticeCarry.fullyAutomatedLaunchClaimAllowed === false;
    return gateResult({
      id: "final_99_gate",
      label: "Final 99 evidence gate",
      state: overall === "pass" ? "proven" : "notice",
      evidencePath,
      detail: overall === "pass_with_notice" && noticeCarryReady
        ? `final-99 overall is ${overall}; ${carriedNoticeCount} notices are explicitly carried in ${noticeCarryPath}.`
        : `final-99 overall is ${overall}.`,
      nextActions: overall === "pass_with_notice"
        ? noticeCarryReady
          ? ["Do not claim fully automated launch readiness until admin-auth live save/reopen and approved provider dispatch are executed in a secure environment."]
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
  const preflightReady = isRecord(preflight)
    && preflight.overall === "approval_ready_open"
    && preflight.launchReadiness === false
    && preflight.dbMutationPerformed === false
    && preflight.networkOpened === false
    && Array.isArray(preflight.failedCheckIds)
    && preflight.failedCheckIds.length === 0
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
  const sourceSha = readString(report.sourceSha);
  const sourceShaCurrent = isGitAncestor(rootDir, sourceSha);

  if (ok && approvalHeld && !dbMutationPerformed && !embeddingGenerated && !uploaded && sourceShaCurrent) {
    return gateResult({
      id: "sif_embedding_runtime",
      label: "SIF embedding runtime",
      state: "approval_gated",
      evidencePath,
      detail: `SIF corpus is ready for approval (${corpusCount ?? "unknown"} records), but embedding/upload/vector runtime is held. Source SHA: ${sourceSha || "not-recorded"}.`,
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
      ? "SIF embedding preflight does not preserve the no-mutation approval hold."
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
  const sharePath = EVIDENCE_PATHS.shareMobileFullFlow;
  const internalPane = readJsonFile(rootDir, internalPanePath);
  const paneContext = readJsonFile(rootDir, paneContextPath);
  const drilldown = readJsonFile(rootDir, drilldownPath);
  const share = readJsonFile(rootDir, sharePath);

  if (!isRecord(internalPane) || !isRecord(paneContext) || !isRecord(drilldown) || !isRecord(share)) {
    return gateResult({
      id: "ui_documents_share_cockpit",
      label: "Documents and Share cockpit UI",
      state: "missing",
      evidencePath: !isRecord(internalPane) ? internalPanePath : !isRecord(paneContext) ? paneContextPath : !isRecord(drilldown) ? drilldownPath : sharePath,
      detail: "Documents/share cockpit evidence is missing or invalid.",
      nextActions: ["Regenerate documents mobile internal-pane, pane-context, drilldown-depth, and share mobile full-flow evidence."],
    });
  }

  const internalPaneGeometry = isRecord(internalPane.currentSourceGeometry)
    ? internalPane.currentSourceGeometry
    : isRecord(internalPane.productionGeometry)
      ? internalPane.productionGeometry
      : {};
  const contextAssertions = isRecord(paneContext.assertions) ? paneContext.assertions : {};
  const drilldownAssertions = isRecord(drilldown.assertions) ? drilldown.assertions : {};
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
    && drilldownAssertions.toolbarDoesNotCoverOpenSectionTextareaAfterSectionSwitch === true
    && drilldownAssertions.selectedDocumentToolbarStillDoesNotCoverTextarea === true
    && paneChecksPass
    && drilldownChecksPass
    && contextSourceCurrent
    && drilldownSourceCurrent;

  const sharePass = readString(share.verdict).includes("PASS")
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
    && readBoolean(shareInterpretation.providerDispatchLiveClaimed) === false;

  if (documentsPass && sharePass) {
    return gateResult({
      id: "ui_documents_share_cockpit",
      label: "Documents and Share cockpit UI",
      state: "proven",
      evidencePath: drilldownPath,
      detail: "Current evidence closes /documents mobile raw height, selected-document landing/context/summary, one-section document drilldown accordion, and /share selected-summary, preview, primary CTA, and collapsed configuration stack. It does not claim provider live dispatch.",
      nextActions: [
        "Continue UI product depth on richer document-specific section actions and one-document-at-a-time editing affordances.",
        "Optional follow-up: make the mobile Share configuration disclosure a guided stepper if more hand-holding is needed.",
      ],
    });
  }

  return gateResult({
    id: "ui_documents_share_cockpit",
    label: "Documents and Share cockpit UI",
    state: "contradicted",
    evidencePath: documentsPass ? sharePath : drilldownPath,
    detail: "Documents/share cockpit evidence no longer proves bounded page height, visible selected-document pane context, and first-viewport share action together.",
    nextActions: ["Re-run documents/share browser geometry gates and fix any UI cockpit regression."],
  });
}

/**
 * @param {string} rootDir
 * @returns {GateResult}
 */
function evaluateDispatchStandaloneCockpitGate(rootDir) {
  const evidencePath = EVIDENCE_PATHS.dispatchStandalone;
  const report = readJsonFile(rootDir, evidencePath);
  if (!isRecord(report)) {
    return gateResult({
      id: "dispatch_standalone_cockpit",
      label: "Standalone dispatch desktop cockpit",
      state: "missing",
      evidencePath,
      detail: "Standalone dispatch cockpit report is missing or invalid.",
      nextActions: ["Run the standalone /dispatch desktop cockpit gate before claiming dispatch UI closure."],
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
  const productionVerified = production.liveVerified === true
    && readString(production.commitSha)
    && isGitAncestor(rootDir, readString(production.commitSha));
  const sampleProductionVerified = sampleProduction.liveVerified === true
    && readString(sampleProduction.commitSha)
    && isGitAncestor(rootDir, readString(sampleProduction.commitSha));
  const pass = readString(report.verdict) === "PASS_PRODUCTION"
    && productionVerified
    && sampleProductionVerified
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
      label: "Standalone dispatch desktop cockpit",
      state: "proven",
      evidencePath,
      detail: `Production /dispatch seeded desktop and sample shell routes are no longer mobile-stacked: seeded pageHeight ${pageHeight ?? "unknown"} (${heightRatio ?? "unknown"}x), sample panels ${readNumber(sampleDesktop.firstPanel?.width) ?? "unknown"}px/${readNumber(sampleDesktop.secondPanel?.width) ?? "unknown"}px in distinct desktop regions, overflow false/outside 0.`,
      nextActions: [
        "Keep provider dispatch live-send claims gated until persistent idempotency and provider result persistence are approved.",
      ],
    });
  }

  return gateResult({
    id: "dispatch_standalone_cockpit",
    label: "Standalone dispatch desktop cockpit",
    state: "contradicted",
    evidencePath,
    detail: "Standalone dispatch report no longer proves desktop two-pane cockpit and compact readable channel cards in production.",
    nextActions: ["Re-run standalone /dispatch desktop browser gate and fix the layout before claiming closure."],
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
    const structuredTests = readNumber(structured.testsPassed);
    const exactTests = readNumber(exact.testsPassed);
    const totalTests = (structuredTests ?? 0) + (exactTests ?? 0);
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
 * @param {{ rootDir?: string, generatedAt?: string, sourceSha?: string }} [options]
 * @returns {NorthstarAudit}
 */
export function buildNorthstarOpenGateAudit(options = {}) {
  const rootDir = options.rootDir || REPO_ROOT;
  const gates = [
    evaluateFinal99Gate(rootDir),
    evaluateLiveHarnessGate(rootDir),
    evaluateUiDocumentsShareCockpitGate(rootDir),
    evaluateDispatchStandaloneCockpitGate(rootDir),
    evaluateRlsApprovalGate(rootDir),
    evaluateLlmWikiGate(rootDir),
    evaluateSifEmbeddingGate(rootDir),
    evaluateKoshaExactTrustGate(rootDir),
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
      "Live Supabase RLS tenant isolation is launch-proven before catalog and tenant A/B evidence.",
      "Real provider dispatch is production-live for any channel before persistent idempotency and provider result persistence approval.",
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
