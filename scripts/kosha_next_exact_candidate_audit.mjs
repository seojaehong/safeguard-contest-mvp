#!/usr/bin/env node
// @ts-check

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import zlib from "node:zlib";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SCHEMA_VERSION = "safeclaw-kosha-next-exact-candidate-audit/v1";
const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "..");
const DEFAULT_OUTPUT_DIR = path.join("evaluation", "kosha-next-exact-candidate-audit-2026-07-22");
const DEFAULT_BUILD_INFO_URL = "https://www.safeclaw.kr/api/build-info";

const DEFAULT_PATHS = Object.freeze({
  officialMetadata: path.join("data", "safety-knowledge", "kosha-official-metadata", "official-metadata-2026-07-15.jsonl"),
  bodyCorpusCurrent: path.join("data", "safety-knowledge", "kosha-guide-corpus", "current.json"),
  bodyCorpusRoot: path.join("data", "safety-knowledge", "kosha-guide-corpus"),
  exactKoshaDir: path.join("data", "safety-knowledge", "exact-kosha"),
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
function asNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
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
 * @param {string} absolutePath
 */
function readJson(absolutePath) {
  return JSON.parse(fs.readFileSync(absolutePath, "utf8"));
}

/**
 * @param {string} absolutePath
 */
function readJsonl(absolutePath) {
  const text = fs.readFileSync(absolutePath, "utf8").trim();
  if (!text) return [];
  return text.split(/\r?\n/u).filter(Boolean).map((line) => JSON.parse(line));
}

/**
 * @param {string} filePathWithoutGz
 */
function countJsonlMaybeGzip(filePathWithoutGz) {
  const gzipPath = `${filePathWithoutGz}.gz`;
  let text = "";
  if (fs.existsSync(gzipPath)) {
    text = zlib.gunzipSync(fs.readFileSync(gzipPath)).toString("utf8");
  } else if (fs.existsSync(filePathWithoutGz)) {
    text = fs.readFileSync(filePathWithoutGz, "utf8");
  } else {
    return 0;
  }
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\r?\n/u).filter(Boolean).length : 0;
}

/**
 * @param {string} rootDir
 * @param {string} relativePath
 */
function resolveInsideRoot(rootDir, relativePath) {
  const resolved = path.resolve(rootDir, relativePath);
  const root = path.resolve(rootDir);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error(`path-outside-root:${relativePath}`);
  }
  return resolved;
}

/**
 * @param {string} rootDir
 * @param {string} exactKoshaDir
 */
function readExactPins(rootDir, exactKoshaDir) {
  const dir = resolveInsideRoot(rootDir, exactKoshaDir);
  const files = fs.readdirSync(dir).filter((fileName) => fileName.endsWith(".json")).sort();
  return files.map((fileName) => {
    const row = readJson(path.join(dir, fileName));
    if (!isRecord(row)) throw new Error(`invalid-exact-kosha-pin:${fileName}`);
    return {
      version: asString(row.version),
      stableDocumentKey: asString(row.stableDocumentKey),
      title: asString(row.title),
      bodySha256: asString(row.bodySha256),
      pdfSha256: asString(row.pdfSha256),
      officialFileId: asString(row.officialFileId),
      normalizedCharCount: asNumber(row.normalizedCharCount),
    };
  }).filter((pin) => pin.version);
}

/**
 * @param {Record<string, unknown>} row
 */
function hasCompleteOfficialMetadata(row) {
  return Boolean(
    asString(row.official_status)
    && asString(row.official_url)
    && asString(row.official_file_id)
    && asString(row.publication_date)
    && asString(row.official_version)
    && asString(row.stable_key)
    && asString(row.body_sha256)
    && asString(row.pdf_sha256),
  );
}

/**
 * @param {string} rootDir
 * @param {string} bodyCorpusCurrent
 * @param {string} bodyCorpusRoot
 */
function readVerifiedSubset(rootDir, bodyCorpusCurrent, bodyCorpusRoot) {
  const currentPath = resolveInsideRoot(rootDir, bodyCorpusCurrent);
  const corpusRoot = resolveInsideRoot(rootDir, bodyCorpusRoot);
  const current = readJson(currentPath);
  if (!isRecord(current)) throw new Error("invalid-kosha-body-current");
  const snapshotPath = asString(current.snapshot_path);
  if (!snapshotPath) throw new Error("kosha-body-current-missing-snapshot-path");
  const snapshotDir = path.resolve(corpusRoot, snapshotPath);
  if (!snapshotDir.startsWith(`${corpusRoot}${path.sep}`)) {
    throw new Error(`kosha-body-snapshot-outside-root:${snapshotPath}`);
  }
  const manifest = readJson(path.join(snapshotDir, "manifest.json"));
  if (!isRecord(manifest)) throw new Error("invalid-kosha-body-manifest");
  const coverage = isRecord(manifest.coverage_scope) ? manifest.coverage_scope : {};
  const counts = isRecord(manifest.counts) ? manifest.counts : {};
  const launchGate = isRecord(manifest.launch_gate) ? manifest.launch_gate : {};

  return {
    snapshotId: asString(manifest.snapshot_id) || asString(current.snapshot_id),
    scopeId: asString(coverage.scope_id),
    sourceInventoryCount: asNumber(coverage.source_inventory_count) ?? 0,
    acceptedCount: asNumber(coverage.accepted_count) ?? 0,
    outOfScopeCount: asNumber(coverage.out_of_scope_count) ?? 0,
    bodyKinds: Array.isArray(coverage.body_kinds) ? coverage.body_kinds.map(asString).filter(Boolean) : [],
    officialStatuses: Array.isArray(coverage.official_statuses) ? coverage.official_statuses.map(asString).filter(Boolean) : [],
    itemsCount: countJsonlMaybeGzip(path.join(snapshotDir, "items.jsonl")),
    chunksCount: countJsonlMaybeGzip(path.join(snapshotDir, "chunks.jsonl")),
    failures: countJsonlMaybeGzip(path.join(snapshotDir, "failures.jsonl")),
    networkCallsPerformed: manifest.network_calls_performed === true,
    ocrPerformed: manifest.ocr_performed === true,
    dbMutationPerformed: manifest.db_mutation_performed === true,
    provenanceComplete: launchGate.provenance_complete === true,
    manifestCounts: counts,
  };
}

/**
 * @param {unknown} buildInfo
 */
function normalizeBuildInfo(buildInfo) {
  if (!isRecord(buildInfo)) return { commitSha: "", branch: "", environment: "" };
  return {
    commitSha: asString(buildInfo.commitSha),
    branch: asString(buildInfo.branch),
    environment: asString(buildInfo.environment),
  };
}

/**
 * @param {{
 *   rootDir: string;
 *   officialMetadata?: string;
 *   bodyCorpusCurrent?: string;
 *   bodyCorpusRoot?: string;
 *   exactKoshaDir?: string;
 *   buildInfo?: unknown;
 *   generatedAt?: string;
 * }} options
 */
export function buildKoshaNextExactCandidateAudit(options) {
  const rootDir = options.rootDir;
  const metadataRows = readJsonl(resolveInsideRoot(rootDir, options.officialMetadata || DEFAULT_PATHS.officialMetadata))
    .filter(isRecord);
  const exactPins = readExactPins(rootDir, options.exactKoshaDir || DEFAULT_PATHS.exactKoshaDir);
  const exactVersions = new Set(exactPins.map((pin) => pin.version));
  const completeRows = metadataRows.filter(hasCompleteOfficialMetadata);
  const currentRows = metadataRows.filter((row) => asString(row.official_status) === "current");
  const completeCurrentRows = completeRows.filter((row) => asString(row.official_status) === "current");
  const metadataVerifiedNotExact = completeCurrentRows.filter((row) => !exactVersions.has(asString(row.official_version)));
  /** @type {Record<string, number>} */
  const completeCurrentByCategory = {};
  for (const row of completeCurrentRows) {
    const category = asString(row.official_category) || "unknown";
    completeCurrentByCategory[category] = (completeCurrentByCategory[category] || 0) + 1;
  }
  const verifiedSubset = readVerifiedSubset(
    rootDir,
    options.bodyCorpusCurrent || DEFAULT_PATHS.bodyCorpusCurrent,
    options.bodyCorpusRoot || DEFAULT_PATHS.bodyCorpusRoot,
  );
  const sampleNextCandidates = metadataVerifiedNotExact.slice(0, 5).map((row) => ({
    stableKey: asString(row.stable_key),
    version: asString(row.official_version),
    category: asString(row.official_category),
    publishedAt: asString(row.publication_date),
    officialFileId: asString(row.official_file_id),
    bodySha256Prefix: asString(row.body_sha256).slice(0, 12),
    pdfSha256Prefix: asString(row.pdf_sha256).slice(0, 12),
  }));

  return {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: options.generatedAt || new Date().toISOString(),
    sourceHead: gitHead(rootDir),
    liveBuildInfoAtAudit: normalizeBuildInfo(options.buildInfo),
    verdict: "NEXT_EXACT_TRUST_CANDIDATES_IDENTIFIED_APPROVAL_FREE",
    scope: "read-only audit of KOSHA exact trust boundary and next immutable-acquisition candidates",
    mutationPerformed: false,
    networkAcquisitionPerformed: false,
    dbMutationPerformed: false,
    embeddingGenerationPerformed: false,
    exactTrustRegistryCurrent: {
      status: "proven",
      count: exactPins.length,
      versions: exactPins.map((pin) => pin.version).sort(),
      evidence: [
        "evaluation/kosha-current-northstar-regression-2026-07-22/report.json",
        "evaluation/kosha-current-live-gate-2026-07-20/report.json",
        "evaluation/kosha-current-3pin-gate-2026-07-21/report.json",
        "data/safety-knowledge/exact-kosha/",
      ],
    },
    verifiedSubsetCurrent: {
      snapshotId: verifiedSubset.snapshotId,
      scopeId: verifiedSubset.scopeId,
      sourceInventoryCount: verifiedSubset.sourceInventoryCount,
      acceptedCount: verifiedSubset.acceptedCount,
      outOfScopeCount: verifiedSubset.outOfScopeCount,
      bodyKinds: verifiedSubset.bodyKinds,
      officialStatuses: verifiedSubset.officialStatuses,
      itemsCount: verifiedSubset.itemsCount,
      chunksCount: verifiedSubset.chunksCount,
      failures: verifiedSubset.failures,
      networkCallsPerformed: verifiedSubset.networkCallsPerformed,
      ocrPerformed: verifiedSubset.ocrPerformed,
      dbMutationPerformed: verifiedSubset.dbMutationPerformed,
      provenanceComplete: verifiedSubset.provenanceComplete,
    },
    officialMetadataRegistry: {
      path: options.officialMetadata || DEFAULT_PATHS.officialMetadata,
      metadataRows: metadataRows.length,
      currentRows: currentRows.length,
      completeRows: completeRows.length,
      completeCurrentRows: completeCurrentRows.length,
      metadataVerifiedNotExact: metadataVerifiedNotExact.length,
      completeCurrentByCategory,
    },
    sampleNextCandidates,
    interpretation: {
      closed: [
        "The exact trust registry remains proven for the accepted pins.",
        "A read-only verified subset exists for current native technical-support regulations with complete official metadata and no snapshot failures.",
        "The next candidate pool is identifiable without DB writes, embedding generation, or provider changes.",
      ],
      open: [
        "The metadata-verified non-exact candidates are not yet exact production evidence.",
        "The broader 1,040-row Guide corpus must not be described as fully authoritative-grounding ready.",
        "Exact trust promotion still requires separate immutable acquisition/review and fail-closed tests per promoted item.",
      ],
    },
    requiredBeforePromotingAdditionalExactPins: [
      "Select a bounded candidate set from the metadata-verified non-exact current native rows.",
      "Persist exact-kosha reference JSON only after immutable body/pdf/provenance hashes are reviewed and matched to official URL, file ID, version, publication date, and stable key.",
      "Add registry tests proving each new pin fails closed on stale version, hash mismatch, missing lifecycle, missing human confirmation, and metadata contradiction.",
      "Run exact-trusted grounding, KOSHA current live gate, North Star open-gate audit, and launch-readiness boundary tests after promotion.",
      "Keep KOSHA Guide vector/embedding/runtime claims separate until approved SIF/KOSHA vector gates are executed.",
    ],
    safeClaims: [
      `KOSHA exact trust is current and proven for the accepted ${exactPins.length}-pin slice.`,
      `A ${verifiedSubset.acceptedCount}-item current native technical-support regulation subset is reproducible and complete as a candidate pool.`,
      "Additional exact pins can be proposed from the verified subset, but only after separate immutable acquisition/review.",
    ],
    forbiddenClaims: [
      "All 1,040 KOSHA Guide rows are exact direct evidence.",
      "The metadata-verified non-exact candidates are already exact production evidence.",
      "KOSHA Guide embeddings or vector retrieval are production-active.",
      "This audit performed DB mutation, embedding generation, upload, or provider dispatch.",
    ],
  };
}

/**
 * @param {ReturnType<typeof buildKoshaNextExactCandidateAudit>} report
 */
export function renderKoshaNextExactCandidateAuditMarkdown(report) {
  const subset = report.verifiedSubsetCurrent;
  const metadata = report.officialMetadataRegistry;
  const categoryRows = Object.entries(metadata.completeCurrentByCategory)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([category, count]) => `| ${category} | ${count} |`)
    .join("\n");
  const candidateRows = report.sampleNextCandidates
    .map((candidate) => `| ${candidate.stableKey} | ${candidate.version} | ${candidate.category} | ${candidate.publishedAt} | ${candidate.officialFileId} |`)
    .join("\n");
  return `# KOSHA Next Exact Candidate Audit

Generated at: ${report.generatedAt}

Verdict: \`${report.verdict}\`

This is a read-only audit. It did not perform DB mutation, embedding generation, upload, provider dispatch, or new KOSHA network acquisition.

## Current Boundary

The current exact KOSHA trust registry is proven for ${report.exactTrustRegistryCurrent.count} pins only:

${report.exactTrustRegistryCurrent.versions.map((version) => `- \`${version}\``).join("\n")}

This remains enough to claim the accepted exact-trust slice. It is not enough to claim that every KOSHA Guide row is exact direct evidence.

## Candidate Pool

| Item | Count |
| --- | ---: |
| Source inventory | ${subset.sourceInventoryCount} |
| Current native technical-support regulation subset | ${subset.acceptedCount} |
| Generated chunks | ${subset.chunksCount} |
| Snapshot failures | ${subset.failures} |
| Out of scope rows | ${subset.outOfScopeCount} |
| Existing exact pins | ${report.exactTrustRegistryCurrent.count} |
| Metadata-verified non-exact candidates | ${metadata.metadataVerifiedNotExact} |

Subset properties:

- scope: \`${subset.scopeId}\`
- body kind: \`${subset.bodyKinds.join(", ")}\`
- official status: \`${subset.officialStatuses.join(", ")}\`
- provenance complete: ${subset.provenanceComplete}
- network calls: ${subset.networkCallsPerformed}
- OCR: ${subset.ocrPerformed}
- DB mutation: ${subset.dbMutationPerformed}

## Metadata Coverage

\`${metadata.path}\` contains ${metadata.completeCurrentRows} complete current metadata rows.

| Category | Complete current rows |
| --- | ---: |
${categoryRows}

Sample non-exact candidates:

| Stable key | Version | Category | Published | File ID |
| --- | --- | --- | --- | --- |
${candidateRows}

These rows are not exact production evidence yet. They are next-promotion candidates.

## Required Before Promotion

${report.requiredBeforePromotingAdditionalExactPins.map((item, index) => `${index + 1}. ${item}`).join("\n")}

## Safe Claims

${report.safeClaims.map((claim) => `- ${claim}`).join("\n")}

## Forbidden Claims

${report.forbiddenClaims.map((claim) => `- ${claim}`).join("\n")}
`;
}

/**
 * @param {{ buildInfoFile: string; buildInfoUrl: string }} options
 */
async function readBuildInfo(options) {
  if (options.buildInfoFile) {
    return readJson(options.buildInfoFile);
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
  const options = {
    rootDir: REPO_ROOT,
    outputDir: DEFAULT_OUTPUT_DIR,
    buildInfoFile: "",
    buildInfoUrl: DEFAULT_BUILD_INFO_URL,
    generatedAt: "",
    officialMetadata: DEFAULT_PATHS.officialMetadata,
    bodyCorpusCurrent: DEFAULT_PATHS.bodyCorpusCurrent,
    bodyCorpusRoot: DEFAULT_PATHS.bodyCorpusRoot,
    exactKoshaDir: DEFAULT_PATHS.exactKoshaDir,
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
    } else if (arg === "--generated-at" && next) {
      options.generatedAt = next;
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      console.log("Usage: node scripts/kosha_next_exact_candidate_audit.mjs [--root DIR] [--output DIR] [--build-info-file FILE] [--build-info-url URL] [--generated-at ISO]");
      process.exit(0);
    } else {
      throw new Error(`Unknown or incomplete argument: ${arg}`);
    }
  }
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const buildInfo = await readBuildInfo(options);
  const report = buildKoshaNextExactCandidateAudit({
    rootDir: options.rootDir,
    officialMetadata: options.officialMetadata,
    bodyCorpusCurrent: options.bodyCorpusCurrent,
    bodyCorpusRoot: options.bodyCorpusRoot,
    exactKoshaDir: options.exactKoshaDir,
    buildInfo,
    generatedAt: options.generatedAt || undefined,
  });
  const outputDir = resolveInsideRoot(options.rootDir, options.outputDir);
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  fs.writeFileSync(path.join(outputDir, "report.md"), renderKoshaNextExactCandidateAuditMarkdown(report), "utf8");
  console.log(JSON.stringify({
    output: options.outputDir,
    verdict: report.verdict,
    exactPins: report.exactTrustRegistryCurrent.count,
    candidatePool: report.officialMetadataRegistry.metadataVerifiedNotExact,
    mutationPerformed: report.mutationPerformed,
  }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
