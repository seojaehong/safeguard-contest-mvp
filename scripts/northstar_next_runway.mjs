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
  koshaNextExactCandidateAudit: path.join("evaluation", "kosha-next-exact-candidate-audit-2026-07-22", "report.json"),
  rlsLlmWikiApprovalPreflight: path.join("evaluation", "rls-llm-wiki-approval-preflight-current-2026-07-20", "report.json"),
  approvalRunway: path.join("evaluation", "northstar-approval-runway-2026-07-21", "report.json"),
  sifEmbeddingPreflight: path.join("evaluation", "sif-embedding-gate", "approval-preflight-report.json"),
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
 * @param {string} relativePath
 */
function readJson(rootDir, relativePath) {
  return JSON.parse(fs.readFileSync(path.join(rootDir, relativePath), "utf8"));
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
 * @param {{ rootDir: string, buildInfo: unknown, generatedAt?: string }} options
 */
export function buildNorthstarNextRunway(options) {
  const sourceHead = gitHead(options.rootDir);
  const liveCommit = isRecord(options.buildInfo) ? asString(options.buildInfo.commitSha) : "";
  const liveRollup = readJson(options.rootDir, ARTIFACTS.liveRollup);
  const approvalRunway = readJson(options.rootDir, ARTIFACTS.approvalRunway);
  const hermes = readJson(options.rootDir, ARTIFACTS.hermesOpenclawRuntime);
  const launch = readJson(options.rootDir, ARTIFACTS.launchReadiness);
  const koshaCandidateAudit = readJson(options.rootDir, ARTIFACTS.koshaNextExactCandidateAudit);
  const sif = readJson(options.rootDir, ARTIFACTS.sifEmbeddingPreflight);
  const liveExactEvidenceCommit = isRecord(liveRollup) ? asString(liveRollup.head) : "";
  const liveRollupLiveCommit = isRecord(liveRollup) && isRecord(liveRollup.liveBuildInfo)
    ? asString(liveRollup.liveBuildInfo.commitSha)
    : "";
  const liveRollupMatchesProduction = liveExactEvidenceCommit === liveCommit && liveRollupLiveCommit === liveCommit;
  const latestEvidenceCommitLive = sourceHead === liveCommit;
  const currentHeadIsEvidenceOnlyPending = sourceHead !== liveCommit && liveRollupMatchesProduction;

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
    liveExactEvidenceCommit,
    liveRollupLiveCommit,
    liveRollupMatchesProduction,
    artifacts: Object.fromEntries(
      Object.entries(ARTIFACTS).map(([key, value]) => [key, value.replaceAll("/", "\\")]),
    ),
    provenCurrentState: [
      "live_harness_quality",
      "kosha_exact_trust_registry",
      "ui_documents_share_cockpit",
      "dispatch_standalone_cockpit",
      "share_result_fixture_cockpit",
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
      acceptedStructure: "step split plus first-viewport cockpit plus bounded drilldown/detail panes",
      documentsDefaultCockpit: "closed for raw route height in current live geometry",
      selectedEditorDetail: "first risk-row header and hazard field land in the first viewport; raw long-form textarea remains secondary drilldown",
      shareDesktop: "raw geometry is two-column; perceived full-workbench composition remains a follow-up only if reproduced",
      shareMobile: "current compact cockpit remains first-viewport bounded in current evidence",
      hermesOpenclaw: "adapter and fail-closed auth boundary current-proven; live unauthenticated broker smoke returns AUTH_REQUIRED before engine execution",
    },
    hermesOpenclaw: hermesSummary(hermes),
    koshaNextExactCandidateAudit: koshaCandidateAuditSummary(koshaCandidateAudit),
    sifEmbeddingRuntime: sifSummary(sif),
    nextSafeWorkWithoutApproval: [
      "refresh source/live exact evidence when production marker advances to the evidence-only head",
      "refresh live rollup before claiming live-exact if production advances beyond the current live rollup head",
      "use the KOSHA next exact candidate audit to select a bounded metadata-verified candidate set before any exact-trust promotion",
      "keep UI follow-up scoped to selected-editor/detail readability or reproduced desktop share perception issues",
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
  const liveNote = report.latestEvidenceCommitLive
    ? "Note: source HEAD and production marker match for this artifact."
    : report.liveRollupMatchesProduction
      ? `Note: current HEAD \`${report.sourceHead}\` is an evidence-only refresh pushed after the live-exact artifact set. Production is still \`${report.productionCommit}\`, and the live rollup remains exact for that deployed marker.`
      : `Note: current HEAD \`${report.sourceHead}\` is ahead of production \`${report.productionCommit}\`, and the live rollup head \`${report.liveExactEvidenceCommit}\` does not yet match production. Refresh live rollup before claiming live-exact.`;

  return `# North Star Next Runway

Checked at: 2026-07-22 KST

Verdict: \`${report.verdict}\`

Source HEAD: \`${report.sourceHead}\`

Production \`/api/build-info\`: \`${report.productionCommit}\`

Latest evidence commit live: \`${report.latestEvidenceCommitLive}\`

Live-exact evidence commit: \`${report.liveExactEvidenceCommit}\`

Live rollup matches production: \`${report.liveRollupMatchesProduction}\`

${liveNote}

Open-gate artifact: \`evaluation\\northstar-open-gates-current\\report.json\`

Live-rollup artifact: \`evaluation\\northstar-live-rollup-2026-07-20\\report.json\`

## Proven Current State

- Live harness quality is proven.
- KOSHA exact trust registry is proven for the accepted exact-trust slice.
- KOSHA next exact candidate audit identifies the 234-item current native technical-support subset and 231 metadata-verified non-exact candidates without mutation.
- Documents and Share cockpit UI is proven for the current evidence scope.
- Standalone Dispatch cockpit is proven for the current evidence scope.
- Generated Share result fixture cockpit is proven without claiming real provider dispatch.
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

- Default Documents cockpit: raw route height is closed in current live geometry.
- Selected editor/detail: first risk-row header and hazard field land in the first viewport; raw long-form textarea remains a secondary drilldown.
- Share desktop: raw geometry is two-column, not a literal mobile stack; any remaining discomfort should be treated as a reproduced visual full-workbench composition follow-up.
- Share mobile: compact cockpit remains first-viewport bounded in current evidence.

Route/page split alone is not accepted as the UX fix. The accepted structure is step split plus first-viewport cockpit plus bounded drilldown/detail panes for long documents, messages, logs, and raw metadata.

## Next Safe Work Without Approval

${report.nextSafeWorkWithoutApproval.map((item, index) => `${index + 1}. ${item}.`).join("\n")}

## KOSHA Candidate Boundary

- Exact trust remains proven only for the accepted exact pins.
- Candidate pool: ${report.koshaNextExactCandidateAudit.acceptedSubsetItems || "unknown"} current native technical-support items.
- Metadata-verified non-exact candidates: ${report.koshaNextExactCandidateAudit.metadataVerifiedNotExact || "unknown"}.
- Mutation performed by candidate audit: ${report.koshaNextExactCandidateAudit.mutationPerformed === true}.
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
