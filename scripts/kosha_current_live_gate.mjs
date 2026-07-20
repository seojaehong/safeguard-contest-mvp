#!/usr/bin/env node
// @ts-check

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SCHEMA_VERSION = "safeclaw-kosha-current-live-gate/v1";
const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "..");
const DEFAULT_OUTPUT_DIR = path.join("evaluation", "kosha-current-live-gate-2026-07-20");
const DEFAULT_BASE_URL = "https://www.safeclaw.kr";
const REQUIRED_EXACT_KEYS = Object.freeze(["D-C-13", "D-C-7", "B-E-10"]);

/**
 * @typedef {Record<string, unknown>} JsonRecord
 *
 * @typedef {object} GateCheck
 * @property {string} id
 * @property {boolean} passed
 * @property {string} detail
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
function readString(value) {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * @param {unknown} value
 */
function readNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * @param {unknown} value
 * @returns {string[]}
 */
function readStringArray(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
}

/**
 * @param {unknown} value
 * @param {string} key
 */
function recordAt(value, key) {
  if (!isRecord(value)) {
    return {};
  }
  const next = value[key];
  return isRecord(next) ? next : {};
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
 * @param {string[]} argv
 */
function parseArgs(argv) {
  /** @type {{ rootDir: string, outputDir: string, baseUrl: string, buildInfoFile: string, statusFile: string }} */
  const options = {
    rootDir: REPO_ROOT,
    outputDir: DEFAULT_OUTPUT_DIR,
    baseUrl: DEFAULT_BASE_URL,
    buildInfoFile: "",
    statusFile: "",
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
    } else if (arg === "--base-url") {
      options.baseUrl = next.replace(/\/$/u, "");
      index += 1;
    } else if (arg === "--build-info-file") {
      options.buildInfoFile = next;
      index += 1;
    } else if (arg === "--status-file") {
      options.statusFile = next;
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      console.log("Usage: node scripts/kosha_current_live_gate.mjs [--root DIR] [--output DIR] [--base-url URL] [--build-info-file FILE] [--status-file FILE]");
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

/**
 * @param {string} url
 */
async function fetchJson(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`${url} returned HTTP ${response.status}`);
  }
  return await response.json();
}

/**
 * @param {{ rootDir: string, baseUrl: string, buildInfoFile: string, statusFile: string }} options
 */
async function loadInputs(options) {
  const buildInfo = options.buildInfoFile
    ? readJson(options.rootDir, options.buildInfoFile)
    : await fetchJson(`${options.baseUrl}/api/build-info`);
  const status = options.statusFile
    ? readJson(options.rootDir, options.statusFile)
    : await fetchJson(`${options.baseUrl}/api/safety-reference/status`);
  return { buildInfo, status };
}

/**
 * @param {string} id
 * @param {boolean} passed
 * @param {string} detail
 * @returns {GateCheck}
 */
function check(id, passed, detail) {
  return { id, passed, detail };
}

/**
 * @param {string} rootDir
 * @param {unknown} buildInfo
 * @param {unknown} status
 * @param {string} [generatedAt]
 */
export function buildKoshaCurrentLiveGate(rootDir, buildInfo, status, generatedAt = new Date().toISOString()) {
  const sourceSha = gitHead(rootDir);
  const liveStatus = isRecord(status) ? status : {};
  const localCorpus = recordAt(liveStatus, "localCorpus");
  const exactTrustRegistry = recordAt(liveStatus, "exactTrustRegistry");
  const exactKeys = readStringArray(exactTrustRegistry.stableDocumentKeys);
  const exactItems = Array.isArray(exactTrustRegistry.items)
    ? exactTrustRegistry.items.filter(isRecord).map((item) => ({
      itemId: readString(item.itemId),
      stableDocumentKey: readString(item.stableDocumentKey),
      version: readString(item.version),
      title: readString(item.title),
      itemType: readString(item.itemType),
      publishedAt: readString(item.publishedAt),
      officialFileId: readString(item.officialFileId),
      bodySha256: readString(item.bodySha256),
      pdfSha256: readString(item.pdfSha256),
      provenanceSha256: readString(item.provenanceSha256),
    }))
    : [];

  const technicalTotal = readNumber(liveStatus.technicalTotal);
  const technicalGuidelines = readNumber(liveStatus.technicalGuidelines);
  const technicalSupportRegulations = readNumber(liveStatus.technicalSupportRegulations);
  const localItemCount = readNumber(localCorpus.itemCount);
  const localChunkCount = readNumber(localCorpus.chunkCount);
  const exactCount = readNumber(exactTrustRegistry.count);
  const loadedItemCount = readNumber(exactTrustRegistry.loadedItemCount);

  const requiredKeySet = new Set(REQUIRED_EXACT_KEYS);
  const exactKeySet = new Set(exactKeys);
  const hasOnlyRequiredExactKeys = exactKeys.length === REQUIRED_EXACT_KEYS.length
    && REQUIRED_EXACT_KEYS.every((key) => exactKeySet.has(key));
  const itemKeysMatch = exactItems.length === REQUIRED_EXACT_KEYS.length
    && exactItems.every((item) => requiredKeySet.has(item.stableDocumentKey));

  /** @type {GateCheck[]} */
  const checks = [
    check("build_info_configured", isRecord(buildInfo) && buildInfo.ok === true && readString(buildInfo.commitSha).length === 40, "Production build-info must identify a configured 40-character commit."),
    check("status_ready", liveStatus.status === "ready" && liveStatus.ok === true && liveStatus.searchReady === true, "Safety reference status must be ready/searchReady."),
    check("catalog_total_ready", liveStatus.items === 9920, "Safety reference catalog must report 9,920 items."),
    check("technical_total_ready", technicalTotal === 1040, "KOSHA technical corpus must report 1,040 technical rows."),
    check("technical_split_ready", technicalGuidelines === 803 && technicalSupportRegulations === 237 && technicalGuidelines + technicalSupportRegulations === technicalTotal, "KOSHA technical split must remain 803 guides + 237 support regulations."),
    check("local_corpus_ready", localCorpus.status === "ready" && localItemCount !== null && localItemCount >= 234 && localChunkCount !== null && localChunkCount >= 7127 && localCorpus.failureCount === 0, "Local KOSHA corpus must be ready with 234+ items, 7,127+ chunks, and zero failures."),
    check("exact_registry_ready", exactTrustRegistry.status === "ready" && exactTrustRegistry.integrityStatus === "ready" && exactTrustRegistry.failureReason === null, "Exact KOSHA trust registry must be ready with no integrity failure."),
    check("exact_registry_count", exactCount === 3 && loadedItemCount === 3, "Exact KOSHA trust registry must load exactly three pinned documents."),
    check("exact_registry_required_keys", hasOnlyRequiredExactKeys, `Exact KOSHA keys must be ${REQUIRED_EXACT_KEYS.join(", ")} only.`),
    check("exact_registry_items_match_keys", itemKeysMatch, "Exact trust registry item keys must match the required stable document keys."),
  ];

  const failedCheckIds = checks.filter((item) => !item.passed).map((item) => item.id);
  return {
    schemaVersion: SCHEMA_VERSION,
    generatedAt,
    sourceSha,
    liveBuildInfo: buildInfo,
    verdict: failedCheckIds.length === 0
      ? "pass_current_kosha_exact_trust_and_corpus_gate"
      : "fail_current_kosha_exact_trust_and_corpus_gate",
    dbMutationPerformed: false,
    networkOpened: true,
    checks,
    failedCheckIds,
    liveStatus: {
      status: readString(liveStatus.status),
      ok: liveStatus.ok === true,
      searchReady: liveStatus.searchReady === true,
      items: readNumber(liveStatus.items),
      technicalTotal,
      technicalGuidelines,
      technicalSupportRegulations,
      technicalSplitOk: technicalGuidelines !== null && technicalSupportRegulations !== null && technicalGuidelines + technicalSupportRegulations === technicalTotal,
      catalogSearchOk: liveStatus.searchReady === true,
      localCorpus: {
        status: readString(localCorpus.status),
        failures: Array.isArray(localCorpus.failures) ? localCorpus.failures : [],
        snapshotId: readString(localCorpus.snapshotId),
        manifestSha256: readString(localCorpus.manifestSha256),
        inventoryCount: readNumber(localCorpus.inventoryCount),
        itemCount: localItemCount,
        chunkCount: localChunkCount,
        failureCount: readNumber(localCorpus.failureCount),
      },
      exactTrustRegistry: {
        status: readString(exactTrustRegistry.status),
        count: exactCount,
        integrityStatus: readString(exactTrustRegistry.integrityStatus),
        loadedItemCount,
        failureReason: exactTrustRegistry.failureReason === null ? null : readString(exactTrustRegistry.failureReason),
        stableDocumentKeys: exactKeys,
        versions: readStringArray(exactTrustRegistry.versions),
        items: exactItems,
      },
    },
    verification: [],
    claimsAllowed: [
      "KOSHA technical corpus is live-ready for current retrieval/search status.",
      "Exact KOSHA evidence is limited to the pinned D-C-13, D-C-7, and B-E-10 documents.",
      "Metadata-verified KOSHA candidates remain supporting/review-required unless promoted through exact acquisition review.",
    ],
    forbiddenClaims: [
      "All 1,040 KOSHA technical materials are exact direct evidence.",
      "Any KOSHA candidate can be cited as mandatory legal proof without lifecycle/provenance review.",
      "Vector embedding retrieval is active before the approved SIF/KOSHA embedding migration/upload runtime gate.",
    ],
  };
}

/**
 * @param {ReturnType<typeof buildKoshaCurrentLiveGate>} report
 */
export function renderKoshaCurrentLiveGateMarkdown(report) {
  const failedChecks = report.failedCheckIds.length === 0
    ? "- None."
    : report.failedCheckIds.map((id) => `- ${id}`).join("\n");
  const exact = report.liveStatus.exactTrustRegistry;
  const local = report.liveStatus.localCorpus;
  const lines = [
    "# SafeClaw KOSHA Current Live Gate",
    "",
    `Generated at: ${report.generatedAt}`,
    `Source HEAD at generation: ${report.sourceSha}`,
    `Live commit at generation: ${isRecord(report.liveBuildInfo) ? readString(report.liveBuildInfo.commitSha) : ""}`,
    "",
    "Note: this artifact is generated before it is committed. The containing Git commit and deployed build must be verified through `git log` and `/api/build-info` after push.",
    `Verdict: \`${report.verdict}\``,
    `DB mutation performed: ${report.dbMutationPerformed ? "yes" : "no"}`,
    "",
    "## Live Runtime Summary",
    "",
    `- Catalog items: ${report.liveStatus.items}`,
    `- KOSHA technical rows: ${report.liveStatus.technicalTotal} (${report.liveStatus.technicalGuidelines} guides + ${report.liveStatus.technicalSupportRegulations} support regulations)`,
    `- Local corpus: ${local.status}, ${local.itemCount} items, ${local.chunkCount} chunks, ${local.failureCount} failures`,
    `- Exact registry: ${exact.status}, ${exact.count} documents (${exact.stableDocumentKeys.join(", ")})`,
    "",
    "## Checks",
    "",
    "| Check | Result | Detail |",
    "| --- | --- | --- |",
    ...report.checks.map((item) => `| ${item.id} | ${item.passed ? "pass" : "fail"} | ${item.detail.replace(/\|/gu, "\\|")} |`),
    "",
    "## Failed Check IDs",
    "",
    failedChecks,
    "",
    "## Allowed Claims",
    "",
    ...report.claimsAllowed.map((claim) => `- ${claim}`),
    "",
    "## Forbidden Claims",
    "",
    ...report.forbiddenClaims.map((claim) => `- ${claim}`),
  ];
  return `${lines.join("\n")}\n`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const inputs = await loadInputs(options);
  const report = buildKoshaCurrentLiveGate(options.rootDir, inputs.buildInfo, inputs.status);
  const outputDir = path.isAbsolute(options.outputDir)
    ? options.outputDir
    : path.join(options.rootDir, options.outputDir);
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  fs.writeFileSync(path.join(outputDir, "report.md"), renderKoshaCurrentLiveGateMarkdown(report), "utf8");
  console.log(JSON.stringify({
    verdict: report.verdict,
    output: path.relative(options.rootDir, outputDir),
    sourceSha: report.sourceSha,
    liveCommit: isRecord(report.liveBuildInfo) ? readString(report.liveBuildInfo.commitSha) : "",
    failedCheckIds: report.failedCheckIds,
  }, null, 2));
  if (report.failedCheckIds.length > 0) {
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
