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
  koshaNextExactCandidateAudit: path.join("evaluation", "kosha-next-exact-candidate-audit-2026-07-22", "report.json"),
  koshaExactPromotionPacket: path.join("evaluation", "kosha-exact-promotion-packet-2026-07-22", "report.json"),
  rlsLlmWikiApprovalPreflight: path.join("evaluation", "rls-llm-wiki-approval-preflight-current-2026-07-20", "report.json"),
  approvalRunway: path.join("evaluation", "northstar-approval-runway-2026-07-21", "report.json"),
  sifEmbeddingPreflight: path.join("evaluation", "sif-embedding-gate", "approval-preflight-report.json"),
  shareGeneratedSessionPerception: path.join("evaluation", "share-generated-session-perception-2026-07-22", "report.json"),
  shareExactSessionBoundary: path.join("evaluation", "share-exact-session-boundary-2026-07-22", "report.json"),
  shareRecipientAckApprovalPreflight: path.join("evaluation", "share-recipient-ack-approval-preflight-current-2026-07-19", "report.json"),
  sharePublicSessionStorageReadiness: path.join("evaluation", "share-public-session-storage-readiness-2026-07-23", "report.json"),
  sharePublicSessionStorageApproval: path.join("evaluation", "share-public-session-storage-approval-2026-07-23", "report.json"),
  documentsCockpitWorkbenchGeometry: path.join("evaluation", "documents-cockpit-workbench-geometry-2026-07-22", "report.json"),
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
 */
function approvalGates(approvalRunway) {
  if (!isRecord(approvalRunway) || !Array.isArray(approvalRunway.approvalGates)) {
    throw new Error("Approval runway report is missing approvalGates.");
  }
  return approvalRunway.approvalGates.filter(isRecord).map((gate) => ({
    gate: asString(gate.id),
    state: asString(gate.state),
    evidencePath: asString(gate.evidencePath),
    readyForOperatorReview: asBoolean(gate.readyForOperatorReview),
    currentSafetyLock: asString(gate.currentSafetyLock),
    approvalNeeded: Array.isArray(gate.approvalNeeded) ? gate.approvalNeeded.map(asString).filter(Boolean) : [],
    forbiddenUntilApproved: Array.isArray(gate.forbiddenUntilApproved) ? gate.forbiddenUntilApproved.map(asString).filter(Boolean) : [],
  }));
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
 * @param {unknown} hermes
 */
function hermesSummary(hermes) {
  if (!isRecord(hermes)) return {};
  return {
    verdict: asString(hermes.verdict),
    focusedTests: isRecord(hermes.focusedTests) ? hermes.focusedTests : {},
    liveUnauthenticatedBrokerSmoke: isRecord(hermes.liveUnauthenticatedBrokerSmoke) ? hermes.liveUnauthenticatedBrokerSmoke : {},
    liveExecutionClaimed: isRecord(hermes.liveExecutionReadiness) && asBoolean(hermes.liveExecutionReadiness.claimed),
  };
}

/**
 * @param {unknown} sif
 */
function sifSummary(sif) {
  if (!isRecord(sif)) return {};
  const corpus = isRecord(sif.corpus) ? sif.corpus : {};
  return {
    approvalHeld: asBoolean(sif.approvalHeld),
    dbMutationPerformed: asBoolean(sif.dbMutationPerformed),
    embeddingGenerated: asBoolean(sif.embeddingGenerated),
    uploaded: asBoolean(sif.uploaded),
    corpusCount: typeof corpus.corpusCount === "number" ? corpus.corpusCount : undefined,
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
        detailsOpen: metrics.detailsOpen === true || metrics.detailsOpen === false ? metrics.detailsOpen : null,
      };
    }),
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
  const koshaCandidateAudit = readJson(options.rootDir, ARTIFACTS.koshaNextExactCandidateAudit);
  const koshaPromotionPacket = readJson(options.rootDir, ARTIFACTS.koshaExactPromotionPacket);
  const sif = readJson(options.rootDir, ARTIFACTS.sifEmbeddingPreflight);
  const shareGenerated = readJson(options.rootDir, ARTIFACTS.shareGeneratedSessionPerception);
  const shareExactBoundary = readJson(options.rootDir, ARTIFACTS.shareExactSessionBoundary);
  const shareRecipientAckApproval = readOptionalJson(options.rootDir, ARTIFACTS.shareRecipientAckApprovalPreflight);
  const sharePublicSessionStorageReadiness = readOptionalJson(options.rootDir, ARTIFACTS.sharePublicSessionStorageReadiness);
  const sharePublicSessionStorageApproval = readOptionalJson(options.rootDir, ARTIFACTS.sharePublicSessionStorageApproval);
  const documentsCockpitGeometry = readOptionalJson(options.rootDir, ARTIFACTS.documentsCockpitWorkbenchGeometry);
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
    ],
    approvalGated: approvalGates(approvalRunway),
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
      documentsDefaultCockpit: "first actionable cockpit is live-proven; do not phrase this as documents page height fixed or the whole Documents page shortened",
      documentsRemainingDebt: "full 12-document authoring polish remains; the all-12 launcher exposure is now bounded navigation in current evidence, while raw/full document text must stay secondary drilldown rather than serial page content and the local workbench shell ratio target remains <= 3",
      selectedEditorDetail: "risk-assessment default, same-document reselect, and all-12 launcher exposure now land the field strip, evidence/recheck CTA, first risk row, and hazard field before raw long-form textarea across desktop-short, desktop 1440x900, and mobile; raw textarea remains secondary drilldown",
      documentsContainment: "route/page split is only orientation; /documents must remain a selected-only bounded workbench with a default exposure budget, core 3/supporting 9 as index or collapsed navigation, and long source/section/provenance content in drilldown",
      shareDesktop: "current measured Workspace Share and invited recipient fixture routes pass scoped desktop workbench width/region geometry; exact saved/generated user sessions that still feel mobile-like require their own width-ratio/grid repro before product changes, and desktop must not regress into a mobile card stack",
      shareGeneratedResult: "current-source generated provider-result fixture keeps the result summary inside 1440x723, 1440x900, and 390x844 after the short desktop landing fix; exact saved user sessions still require their own repro if reported",
      shareRouteEvidenceBoundary: "separate Share evidence into invited recipient fixture pass, exact saved/generated /share/[sessionId] missing evidence, and manager/workspace share-result route repro; do not use one route's pass to close another route's mobile-like complaint",
      shareMobile: "current compact cockpit remains first-viewport bounded in current evidence",
      hermesOpenclaw: "adapter and fail-closed auth boundary current-proven; live unauthenticated broker smoke returns AUTH_REQUIRED before engine execution",
    },
    hermesOpenclaw: hermesSummary(hermes),
    documentQualityGrounding: documentQualityGroundingSummary(documentQuality),
    liveDocumentQualityMatrix: liveDocumentQualityMatrixSummary(liveDocumentQualityMatrix),
    koshaNextExactCandidateAudit: koshaCandidateAuditSummary(koshaCandidateAudit),
    koshaExactPromotionPacket: koshaPromotionPacketSummary(koshaPromotionPacket),
    sifEmbeddingRuntime: sifSummary(sif),
    shareGeneratedSessionPerception: shareGeneratedSessionSummary(shareGenerated),
    shareExactSessionBoundary: shareExactSessionBoundarySummary(shareExactBoundary),
    shareRecipientAckApproval: shareRecipientAckApprovalSummary(shareRecipientAckApproval),
    sharePublicSessionStorageReadiness: sharePublicSessionStorageReadinessSummary(sharePublicSessionStorageReadiness),
    sharePublicSessionStorageApproval: sharePublicSessionStorageApprovalSummary(sharePublicSessionStorageApproval),
    documentsCockpitWorkbenchGeometry: documentsCockpitWorkbenchGeometrySummary(documentsCockpitGeometry),
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
      "keep Hermes/OpenClaw bounded at adapter/service-auth/runtime policy until authenticated tenant-bound execution, replay ledger, tool denial, Evidence Harness, and terminal ledger gates are proven",
      "keep provider dispatch, RLS, LLM Wiki publication, and SIF vector runtime as approval-required gates",
      "do not claim full launch completion while final-99 remains pass_with_notice and approval-gated runtime boundaries remain held",
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
- Hermes/OpenClaw runtime architecture is proven at the adapter, policy, service-auth, route, and fail-closed boundary level, without claiming live production engine execution.
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
- Documents cockpit workbench geometry: \`${report.documentsCockpitWorkbenchGeometry.verdict || "missing"}\`; 1440x723 and 390x723 rows must show grid workbench, core buttons 3, no horizontal overflow, and route split alone remains \`false\`.
- Documents selected editor/detail: risk-assessment default, same-document reselect, and all-12 launcher exposure land the field strip, evidence/recheck CTA, first risk row, and hazard field before raw long-form textarea across desktop-short, desktop 1440x900, and mobile; raw textarea remains secondary drilldown.
- Documents remaining debt: full 12-document authoring polish remains. The all-12 launcher exposure is now bounded navigation in current evidence, while raw/full document text must stay secondary drilldown rather than serial page content.
- Documents structure contract: route/page split is only orientation; /documents must remain a selected-only bounded workbench with core 3/supporting 9 as index or collapsed navigation.
- Bounded workbench DoD: route split alone is not accepted; desktop Documents hard-REDs above the recorded screen threshold, /share/result desktop requires multi-region workbench geometry, and generated fixture evidence must stay separate from exact saved/session proof.
- Legacy workspace-layout regression: remains a broad no-overflow/editor-flow smoke only, not a long-form UX PASS gate; the DoD and route-specific evidence own first-task distance.
- ${boundedWorkbenchNote}
- Share desktop: current measured Workspace Share and invited recipient fixture routes pass scoped desktop workbench width/region geometry; exact saved/generated user sessions that still feel mobile-like require their own width-ratio/grid repro before product changes.
- Share generated-result fixture: current-source generated provider-result fixture keeps the result summary inside 1440x723, 1440x900, and 390x844 after the short desktop landing fix; exact saved user sessions still require their own repro if reported.
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
