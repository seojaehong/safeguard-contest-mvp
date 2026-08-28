#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SCHEMA_VERSION = "safeclaw-launch-readiness-current/v4";
const DEFAULT_BASE_URL = "https://www.safeclaw.kr";
const DEFAULT_OUTPUT_DIR = path.join("evaluation", "launch-readiness-current-2026-07-22");
const DEFAULT_RAW_AUDIT = path.join(DEFAULT_OUTPUT_DIR, "api-connection-audit.json");
const DEFAULT_FINAL99 = path.join("evaluation", "final-99-gate-current-2026-07-22", "report.json");
const DEFAULT_FINAL99_NOTICE = path.join("evaluation", "final-99-gate-current-2026-07-22", "notice-carry.json");
const DEFAULT_OPEN_GATES = path.join("evaluation", "northstar-open-gates-current", "report.json");
const DEFAULT_LIVE_ROLLUP = path.join("evaluation", "northstar-live-rollup-2026-07-20", "report.json");
const DEFAULT_NEXT_RUNWAY = path.join("evaluation", "northstar-next-runway-current-2026-07-22", "report.json");
const DEFAULT_DOCUMENTS_IA = path.join("evaluation", "documents-long-form-ia-2026-07-22", "report.json");
const DEFAULT_SHARE_GENERATED = path.join("evaluation", "share-generated-session-perception-2026-07-22", "report.json");
const DEFAULT_KOSHA_REGRESSION = path.join("evaluation", "kosha-current-northstar-regression-2026-07-22", "report.json");
const DEFAULT_KOSHA_LIVE = path.join("evaluation", "kosha-current-live-gate-2026-07-20", "report.json");
const DEFAULT_PROVIDER_DISPATCH = path.join("evaluation", "provider-dispatch-idempotency-gate-2026-07-19", "report.json");
const DEFAULT_SIF_PREFLIGHT = path.join("evaluation", "sif-embedding-gate", "approval-preflight-report.json");
const DEFAULT_RLS_WIKI = path.join("evaluation", "rls-llm-wiki-approval-preflight-current-2026-07-20", "report.json");
const DEFAULT_APPROVAL_RUNWAY = path.join("evaluation", "northstar-approval-runway-2026-07-21", "report.json");

const EXPECTED_DOCUMENT_KEYS = [
  "workpackSummaryDraft",
  "riskAssessmentDraft",
  "workPlanDraft",
  "workPermitDraft",
  "tbmBriefing",
  "tbmLogDraft",
  "safetyEducationRecordDraft",
  "emergencyResponseDraft",
  "photoEvidenceDraft",
  "foreignWorkerBriefing",
  "foreignWorkerTransmission",
  "kakaoMessage"
];

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asString(value) {
  return typeof value === "string" ? value : "";
}

function asBoolean(value) {
  return value === true;
}

function asNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asRecord(value) {
  return isRecord(value) ? value : {};
}

function readJson(rootDir, relativePath, fallback = {}) {
  const absolutePath = path.resolve(rootDir, relativePath);
  if (!fs.existsSync(absolutePath)) return fallback;
  const parsed = JSON.parse(fs.readFileSync(absolutePath, "utf8"));
  return isRecord(parsed) ? parsed : fallback;
}

function gitHead(rootDir) {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: rootDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();
  } catch {
    return "";
  }
}

async function fetchProductionBuildInfo(baseUrl, timeoutMs) {
  const endpoint = `${baseUrl.replace(/\/$/u, "")}/api/build-info`;
  const response = await fetch(endpoint, { signal: AbortSignal.timeout(timeoutMs) });
  const parsed = await response.json();
  return isRecord(parsed) ? parsed : {};
}

function buildInfoCommit(buildInfo) {
  return asString(buildInfo.commitSha) || asString(buildInfo.commit) || asString(buildInfo.gitCommit) || asString(buildInfo.sha) || "";
}

function documentCoverage(rawAudit) {
  const documents = isRecord(rawAudit.documents) ? rawAudit.documents : {};
  const present = EXPECTED_DOCUMENT_KEYS.filter((key) => documents[key] === true);
  const missing = EXPECTED_DOCUMENT_KEYS.filter((key) => documents[key] !== true);
  return {
    expectedCount: EXPECTED_DOCUMENT_KEYS.length,
    presentCount: present.length,
    missing,
    present
  };
}

function connectionSummary(rawAudit) {
  const connections = Array.isArray(rawAudit.connections) ? rawAudit.connections.filter(isRecord) : [];
  return {
    connectedCount: connections.filter((item) => asString(item.liveStatus) === "연결됨").length,
    partialCount: connections.filter((item) => asString(item.liveStatus) === "일부 근거 보류").length,
    needsCheckCount: connections.filter((item) => asString(item.liveStatus) === "연결 점검 필요").length
  };
}

function connectedSurfaces(rawAudit) {
  const connections = Array.isArray(rawAudit.connections) ? rawAudit.connections.filter(isRecord) : [];
  return connections.map((item) => `${asString(item.name) || "unknown"}: ${asString(item.liveStatus) || "unknown"}`);
}

function final99Boundary(final99, noticeCarry, currentRuntimeReady) {
  const notices = Array.isArray(noticeCarry.notices) ? noticeCarry.notices.filter(isRecord) : [];
  const overall = asString(final99.overall) || asString(final99.verdict) || "unknown";
  const historicalGateSafeLaunchDemoClaimAllowed = overall === "pass_with_notice" || overall === "pass";
  return {
    overall,
    noticeCount: notices.length,
    fullyAutomatedLaunchClaimAllowed: false,
    historicalGateSafeLaunchDemoClaimAllowed,
    safeLaunchDemoClaimAllowed: historicalGateSafeLaunchDemoClaimAllowed && currentRuntimeReady,
    notices
  };
}

function buildApprovalGatedBoundaries(approvalRunway) {
  if (!isRecord(approvalRunway) || !Array.isArray(approvalRunway.approvalGates)) {
    throw new Error("Canonical approval runway is missing approvalGates.");
  }

  return approvalRunway.approvalGates.map((entry, index) => {
    if (!isRecord(entry)) {
      throw new Error(`Canonical approval runway gate ${index + 1} is invalid.`);
    }
    const gate = asString(entry.id);
    const state = asString(entry.state);
    const currentSafetyLock = asString(entry.currentSafetyLock);
    const evidencePath = asString(entry.evidencePath);
    const approvalNeeded = Array.isArray(entry.approvalNeeded)
      ? entry.approvalNeeded.map(asString).filter(Boolean)
      : [];
    const forbiddenUntilApproved = Array.isArray(entry.forbiddenUntilApproved)
      ? entry.forbiddenUntilApproved.map(asString).filter(Boolean)
      : [];
    if (!gate || state !== "approval_gated" || !currentSafetyLock || !evidencePath) {
      throw new Error(`Canonical approval runway gate ${index + 1} is incomplete or not approval_gated.`);
    }
    if (approvalNeeded.length === 0 || forbiddenUntilApproved.length === 0) {
      throw new Error(`Canonical approval runway gate ${gate} is missing approval or prohibition detail.`);
    }
    return {
      gate,
      state,
      evidencePath,
      readyForOperatorReview: asBoolean(entry.readyForOperatorReview),
      currentSafetyLock,
      approvalNeeded,
      forbiddenUntilApproved,
      reason: `Approval needed: ${approvalNeeded.join("; ")} Forbidden until approved: ${forbiddenUntilApproved.join("; ")}`
    };
  });
}

function buildUiArchitectureBoundary(nextRunway) {
  const ui = isRecord(nextRunway.uiInterpretation) ? nextRunway.uiInterpretation : {};
  const shareBoundary = asString(ui.shareRouteEvidenceBoundary)
    || "invited recipient fixture, exact saved/generated /share/[sessionId], and manager/workspace share-result states are separate proof layers.";
  const documentsVerdict = isRecord(nextRunway.documentsLongFormIA)
    ? asString(nextRunway.documentsLongFormIA.verdict)
    : "";
  const shareGeneratedVerdict = isRecord(nextRunway.shareGeneratedSessionPerception)
    ? asString(nextRunway.shareGeneratedSessionPerception.verdict)
    : "";
  const exactSaved = isRecord(nextRunway.shareExactSessionBoundary)
    ? asBoolean(nextRunway.shareExactSessionBoundary.exactSavedUserSessionReproduced)
    : false;
  return {
    routeSplitAloneAcceptedAsFix: false,
    acceptedStructure: "route split plus selected-only bounded workbench: first-viewport cockpit, one selected detail/editor, and long raw/provenance content in local scroll, drawer, accordion, or drilldown",
    documentsScopedEvidenceVerdict: documentsVerdict,
    shareGeneratedFixtureVerdict: shareGeneratedVerdict,
    exactSavedUserShareSessionReproduced: exactSaved,
    shareRouteEvidenceBoundary: shareBoundary
  };
}

export function buildLaunchReadinessCurrentReport(options = {}) {
  const rootDir = path.resolve(options.rootDir || process.cwd());
  const rawAuditPath = options.rawAuditPath || DEFAULT_RAW_AUDIT;
  const rawAudit = readJson(rootDir, rawAuditPath);
  const final99 = readJson(rootDir, options.final99Path || DEFAULT_FINAL99);
  const noticeCarry = readJson(rootDir, options.final99NoticePath || DEFAULT_FINAL99_NOTICE);
  const openGates = readJson(rootDir, options.openGatesPath || DEFAULT_OPEN_GATES);
  const liveRollup = readJson(rootDir, options.liveRollupPath || DEFAULT_LIVE_ROLLUP);
  const nextRunway = readJson(rootDir, options.nextRunwayPath || DEFAULT_NEXT_RUNWAY);
  const approvalRunwayPath = options.approvalRunwayPath || DEFAULT_APPROVAL_RUNWAY;
  const approvalRunway = readJson(rootDir, approvalRunwayPath);
  const approvalGatedBoundaries = buildApprovalGatedBoundaries(approvalRunway);
  const sourceHeadAtGeneration = options.sourceHead || gitHead(rootDir);
  const productionBuild = isRecord(options.productionBuild) ? options.productionBuild : {};
  const productionCommit = options.productionCommit || buildInfoCommit(productionBuild);
  const coverage = documentCoverage(rawAudit);
  const summary = connectionSummary(rawAudit);
  const dispatchCalled = rawAudit.dispatchStatus !== null && rawAudit.dispatchStatus !== undefined;
  const distributedAdmissionBlocked = asNumber(rawAudit.apiAskStatus) === 503
    && asString(rawAudit.apiAskErrorCode) === "DISTRIBUTED_RATE_LIMIT_UNAVAILABLE"
    && !dispatchCalled;
  const liveGenerationPassed = rawAudit.apiAskOk === true
    && coverage.missing.length === 0
    && summary.needsCheckCount === 0
    && !dispatchCalled;
  const verdict = liveGenerationPassed
    ? "PASS_LIVE_PRODUCTION_WITH_BOUNDARIES"
    : distributedAdmissionBlocked
      ? "BLOCKED_LIVE_PRODUCTION_DISTRIBUTED_ADMISSION_REQUIRED_NO_DISPATCH"
      : "REVIEW_REQUIRED_WITH_BOUNDARIES";

  return {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: options.generatedAt || new Date().toISOString(),
    baseUrl: options.baseUrl || asString(rawAudit.baseUrl) || DEFAULT_BASE_URL,
    sourceHeadAtGeneration,
    productionCommit,
    runtimeSmokeCommit: productionCommit,
    evidenceHeadBeforeThisReport: options.evidenceHeadBeforeThisReport || sourceHeadAtGeneration,
    currentHeadIsEvidenceOnlyPending: Boolean(sourceHeadAtGeneration && productionCommit && sourceHeadAtGeneration !== productionCommit),
    verdict,
    safeLaunchDemoClaimAllowed: liveGenerationPassed,
    guidedPilotClaimAllowed: liveGenerationPassed,
    fullyAutomatedLaunchClaimAllowed: false,
    selfServeSaasLaunchClaimAllowed: false,
    providerDispatchLiveClaimed: false,
    dispatchCalled,
    apiAsk: {
      status: asNumber(rawAudit.apiAskStatus),
      ok: rawAudit.apiAskOk === true,
      elapsedMs: asNumber(rawAudit.elapsedMs),
      errorCode: asString(rawAudit.apiAskErrorCode),
      error: asString(rawAudit.apiAskError),
      retryAfterSeconds: asNumber(rawAudit.apiAskRetryAfterSeconds),
      rateLimit: asString(rawAudit.apiAskRateLimit),
      workUnit: asString(rawAudit.apiAskWorkUnit)
    },
    runtimeBoundary: {
      distributedAdmissionBlocked,
      providerWorkExecuted: distributedAdmissionBlocked ? false : null,
      providerDispatchExecuted: false,
      databaseMutationPerformed: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
      distributedAdmissionActivation: distributedAdmissionBlocked
        ? "OPERATOR_CONFIGURATION_REQUIRED"
        : "NOT_MEASURED_BY_THIS_SMOKE"
    },
    scenario: isRecord(rawAudit.scenario) ? rawAudit.scenario : null,
    documentCoverage: coverage,
    connectionVerdict: distributedAdmissionBlocked
      ? "BLOCKED_BEFORE_CONNECTION_CHECK_NO_DISPATCH"
      : summary.needsCheckCount === 0 && summary.partialCount === 0
        ? "PASS_CONNECTED_NO_DISPATCH"
        : "REVIEW_CONNECTIONS_NO_DISPATCH",
    connectionSummary: summary,
    liveConnections: Array.isArray(rawAudit.connections) ? rawAudit.connections.filter(isRecord) : [],
    connectedSurfaces: connectedSurfaces(rawAudit),
    currentEvidence: {
      rawAudit: rawAuditPath,
      final99Gate: options.final99Path || DEFAULT_FINAL99,
      final99NoticeCarry: options.final99NoticePath || DEFAULT_FINAL99_NOTICE,
      northstarOpenGates: options.openGatesPath || DEFAULT_OPEN_GATES,
      northstarLiveRollup: options.liveRollupPath || DEFAULT_LIVE_ROLLUP,
      northstarNextRunway: options.nextRunwayPath || DEFAULT_NEXT_RUNWAY,
      documentsLongFormIA: DEFAULT_DOCUMENTS_IA,
      shareGeneratedSessionPerception: DEFAULT_SHARE_GENERATED,
      koshaRegression: DEFAULT_KOSHA_REGRESSION,
      koshaLiveGate: DEFAULT_KOSHA_LIVE,
      providerDispatchReadiness: DEFAULT_PROVIDER_DISPATCH,
      sifEmbeddingPreflight: DEFAULT_SIF_PREFLIGHT,
      rlsWikiPreflight: DEFAULT_RLS_WIKI,
      approvalRunway: approvalRunwayPath
    },
    final99Boundary: final99Boundary(final99, noticeCarry, liveGenerationPassed),
    northstarOverall: {
      verdict: asString(openGates.verdict) || asString(openGates.overall) || "unknown"
    },
    northstarLiveRollupOverall: {
      sourceHeadAtGeneration: asString(liveRollup.sourceHeadAtGeneration) || asString(liveRollup.head),
      liveCommitAtGeneration: asString(liveRollup.liveCommitAtGeneration) || buildInfoCommit(asRecord(liveRollup.liveBuildInfo)),
      liveCommitMatchesSourceHead: liveRollup.liveCommitMatchesSourceHead === true || (
        Boolean(asString(liveRollup.head))
        && asString(liveRollup.head) === buildInfoCommit(asRecord(liveRollup.liveBuildInfo))
      )
    },
    approvalGatedBoundaryCount: approvalGatedBoundaries.length,
    approvalGatedBoundaryIds: approvalGatedBoundaries.map((boundary) => boundary.gate),
    approvalGatedBoundaries,
    safeClaims: liveGenerationPassed
      ? [
          `Live /api/ask generated the expected ${coverage.presentCount}-document workpack for the audited construction scenario.`,
          `Live public-data/AI surfaces returned connected statuses for ${summary.connectedCount} connection surface(s) in this smoke.`,
          `A safe launch demo or guided pilot can be claimed only with all ${approvalGatedBoundaries.length} canonical approval boundaries preserved.`,
          "Documents selected-only bounded workbench evidence is current in scoped artifacts; route split alone is not accepted as the UX fix."
        ]
      : [
          "The current live launch smoke fails closed before generation while distributed admission is unavailable.",
          "No provider dispatch or database mutation was executed by the current launch smoke.",
          "Documents and Share scoped UI evidence remains separate from current live generation availability.",
          "Exact saved user Share remains MISSING_EVIDENCE."
        ],
    forbiddenClaims: [
      "Fully automated self-serve launch readiness is complete.",
      "Real provider dispatch is production-live for any channel.",
      "Provider idempotency and per-channel result persistence are production-proven.",
      "SIF vector retrieval or LLM Wiki publication is production-active.",
      "Live Supabase RLS tenant isolation is launch-proven.",
      "Exact saved/generated user share session has been reproduced unless a concrete session URL/state is measured.",
      "n8n/provider dispatch was executed in the latest launch-readiness smoke.",
      ...(distributedAdmissionBlocked ? ["Current live /api/ask generation is available for a launch demo."] : [])
    ],
    uiArchitectureBoundary: buildUiArchitectureBoundary(nextRunway),
    productionBuild: Object.keys(productionBuild).length ? productionBuild : { commitSha: productionCommit }
  };
}

function bulletList(items) {
  return items.map((item) => `- ${item}`).join("\n");
}

export function renderLaunchReadinessCurrentMarkdown(report) {
  const notices = Array.isArray(report.final99Boundary?.notices) ? report.final99Boundary.notices : [];
  const noticeLines = notices.length
    ? notices.map((notice) => {
      const gate = asString(notice.gate) || "unknown";
      const impact = asString(notice.launchImpact) || "notice";
      const allowed = asString(notice.allowedClaim) || "";
      const forbidden = asString(notice.forbiddenClaim) || "";
      return `- \`${gate}\`: ${impact}. Allowed: ${allowed}. Forbidden: ${forbidden}.`;
    }).join("\n")
    : "- none";
  const evidence = isRecord(report.currentEvidence) ? report.currentEvidence : {};
  const evidenceLines = Object.entries(evidence).map(([key, value]) => `- ${key}: \`${String(value)}\``).join("\n");
  const connectionLines = Array.isArray(report.connectedSurfaces) ? bulletList(report.connectedSurfaces) : "";
  const approvalLines = Array.isArray(report.approvalGatedBoundaries)
    ? report.approvalGatedBoundaries.map((gate) => `- \`${gate.gate}\`: ${gate.reason}`).join("\n")
    : "";

  return `# Launch Readiness Current Boundary

Generated: ${report.generatedAt}

Base URL: \`${report.baseUrl}\`

Source HEAD at generation: \`${report.sourceHeadAtGeneration}\`

Production runtime smoke commit: \`${report.runtimeSmokeCommit}\`

Current HEAD is evidence-only pending relative to production: \`${report.currentHeadIsEvidenceOnlyPending}\`

## Verdict

\`${report.verdict}\`

${report.safeLaunchDemoClaimAllowed
    ? "Safe launch demo / guided pilot wording is allowed with the recorded boundaries."
    : "Current live launch demo generation is not allowed while the measured runtime blocker remains active."} Fully automated self-serve launch and real provider dispatch readiness are not allowed.

## Live Smoke

\`scripts/launch_readiness_audit.mjs\` was run against production with \`SAFETYGUARD_AUDIT_DISPATCH=false\`.

- \`/api/ask\`: ${report.apiAsk?.status ?? "unknown"} ${report.apiAsk?.ok ? "OK" : "CHECK"}
- error code: \`${report.apiAsk?.errorCode || "none"}\`
- admission: \`${report.apiAsk?.rateLimit || "unknown"}\` / \`${report.apiAsk?.workUnit || "unknown"}\`
- elapsed: ${report.apiAsk?.elapsedMs ?? "unknown"} ms
- dispatch call: ${report.dispatchCalled ? "run" : "not run"}
- generated documents: ${report.documentCoverage?.presentCount ?? 0} / ${report.documentCoverage?.expectedCount ?? 0}
- connection verdict: \`${report.connectionVerdict}\` (${report.connectionSummary?.connectedCount ?? 0} connected, ${report.connectionSummary?.partialCount ?? 0} bounded fallback, ${report.connectionSummary?.needsCheckCount ?? 0} check-required)
- scenario: \`${asString(report.scenario?.workSummary) || "unknown"}\`

## Connected Surfaces

${connectionLines}

## Final-99 Notices

Final-99 remains \`${report.final99Boundary?.overall ?? "unknown"}\`; ${report.final99Boundary?.noticeCount ?? 0} notices are carried. These are approval/auth gates, not safe no-approval cleanup tasks.

${noticeLines}

## Safe Claims

${bulletList(report.safeClaims || [])}

## UI / IA Boundary

Route/page split alone is not accepted as the UX fix. The accepted structure is ${report.uiArchitectureBoundary?.acceptedStructure}.

- Documents scoped evidence verdict: \`${report.uiArchitectureBoundary?.documentsScopedEvidenceVerdict || "unknown"}\`
- Share generated fixture verdict: \`${report.uiArchitectureBoundary?.shareGeneratedFixtureVerdict || "unknown"}\`
- Exact saved user share session reproduced: \`${report.uiArchitectureBoundary?.exactSavedUserShareSessionReproduced === true}\`
- Share route evidence boundary: ${report.uiArchitectureBoundary?.shareRouteEvidenceBoundary || "unknown"}

## Forbidden Claims

${bulletList(report.forbiddenClaims || [])}

## Approval-Gated Boundaries

${approvalLines}

## Evidence

${evidenceLines}
`;
}

export function writeLaunchReadinessCurrentReport(options = {}) {
  const rootDir = path.resolve(options.rootDir || process.cwd());
  const outputDir = options.outputDir || DEFAULT_OUTPUT_DIR;
  const report = buildLaunchReadinessCurrentReport({ ...options, rootDir });
  const absoluteOutputDir = path.resolve(rootDir, outputDir);
  fs.mkdirSync(absoluteOutputDir, { recursive: true });
  const jsonPath = path.join(absoluteOutputDir, "report.json");
  const markdownPath = path.join(absoluteOutputDir, "report.md");
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(markdownPath, renderLaunchReadinessCurrentMarkdown(report));
  return { report, jsonPath, markdownPath };
}

function parseArgs(argv) {
  const args = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      args.set(key, next);
      index += 1;
    } else {
      args.set(key, "true");
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const rootDir = path.resolve(args.get("root") || process.cwd());
  const baseUrl = args.get("base-url") || DEFAULT_BASE_URL;
  const timeoutMs = Number.parseInt(args.get("timeout-ms") || "20000", 10);
  const productionBuild = await fetchProductionBuildInfo(baseUrl, timeoutMs);
  const productionCommit = args.get("production-commit") || buildInfoCommit(productionBuild);
  const result = writeLaunchReadinessCurrentReport({
    rootDir,
    baseUrl,
    productionCommit,
    productionBuild,
    rawAuditPath: args.get("raw-audit") || DEFAULT_RAW_AUDIT,
    outputDir: args.get("output-dir") || DEFAULT_OUTPUT_DIR
  });
  console.log(JSON.stringify({
    verdict: result.report.verdict,
    sourceHeadAtGeneration: result.report.sourceHeadAtGeneration,
    productionCommit: result.report.productionCommit,
    dispatchCalled: result.report.dispatchCalled,
    jsonPath: path.relative(rootDir, result.jsonPath),
    markdownPath: path.relative(rootDir, result.markdownPath)
  }, null, 2));
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1] || "")) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
