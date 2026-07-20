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
  sifEmbeddingPreflight: path.join("evaluation", "sif-embedding-gate", "approval-preflight-report.json"),
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
  if (approvalRequired && launchNotProven) {
    return gateResult({
      id: "supabase_rls_launch_isolation",
      label: "Supabase RLS launch isolation",
      state: "approval_gated",
      evidencePath,
      detail: "Read-only audit exists, but live RLS catalog and tenant A/B isolation are not proven.",
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
    evidencePath,
    detail: "RLS approval report does not preserve the approval-required launch boundary.",
    nextActions: ["Re-audit RLS evidence and restore explicit launch-isolation status."],
  });
}

/**
 * @param {string} rootDir
 * @returns {GateResult}
 */
function evaluateLlmWikiGate(rootDir) {
  const evidencePath = EVIDENCE_PATHS.llmWikiApproval;
  const text = readTextFile(rootDir, evidencePath);
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
  if (redApproval && unavailable) {
    return gateResult({
      id: "llm_wiki_publication",
      label: "LLM Wiki publication",
      state: "approval_gated",
      evidencePath,
      detail: "Candidate/wiki surfaces exist, but publication RPC/RLS/ledger approval is not complete.",
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
    evidencePath,
    detail: "LLM Wiki report no longer clearly states the approval-required publication boundary.",
    nextActions: ["Re-audit publication evidence before making any North Star completion claim."],
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

  if (ok && approvalHeld && !dbMutationPerformed && !embeddingGenerated && !uploaded) {
    return gateResult({
      id: "sif_embedding_runtime",
      label: "SIF embedding runtime",
      state: "approval_gated",
      evidencePath,
      detail: `SIF corpus is ready for approval (${corpusCount ?? "unknown"} records), but embedding/upload/vector runtime is held.`,
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
    detail: "SIF embedding preflight does not preserve the no-mutation approval hold.",
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
 * @param {string} rootDir
 * @returns {GateResult}
 */
function evaluateKoshaExactTrustGate(rootDir) {
  const evidence = readFirstJsonFile(rootDir, [
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
      "Photo hazard analysis supports up to 10 images and keeps Before/After improvements as reviewed operation memory.",
    ],
    forbiddenClaims: [
      "LLM Wiki publishes itself.",
      "Hermes is the production source of truth.",
      "OpenClaw learns or mutates DB facts automatically.",
      "SIF vector retrieval is production-active before the approved migration/upload/runtime gate.",
      "All KOSHA metadata-verified candidates are exact production evidence.",
      "Live Supabase RLS tenant isolation is launch-proven before catalog and tenant A/B evidence.",
      "Provider dispatch is fully live for unapproved channels.",
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
