// @ts-check

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import zlib from "node:zlib";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const SCHEMA_VERSION = "safeclaw-kosha-exact-promotion-packet/v1";
const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "..");
const DEFAULT_OUTPUT_DIR = path.join("evaluation", "kosha-exact-promotion-packet-2026-07-22");
const DEFAULT_BUILD_INFO_URL = "https://www.safeclaw.kr/api/build-info";

const DEFAULT_PATHS = Object.freeze({
  officialMetadata: path.join("data", "safety-knowledge", "kosha-official-metadata", "official-metadata-2026-07-15.jsonl"),
  bodyCorpusCurrent: path.join("data", "safety-knowledge", "kosha-guide-corpus", "current.json"),
  bodyCorpusRoot: path.join("data", "safety-knowledge", "kosha-guide-corpus"),
  exactKoshaDir: path.join("data", "safety-knowledge", "exact-kosha"),
  officialLifecycleAudit: path.join("evaluation", "kosha-exact-official-lifecycle-audit-2026-07-25", "report.json"),
});

const DEFAULT_CANDIDATE_KEYS = Object.freeze([
  "D-C-10",
  "D-C-11",
  "A-G-1",
  "A-G-15",
  "B-E-11",
  "B-E-9",
  "D-C-4",
  "E-G-4",
]);

const CANDIDATE_RATIONALES = Object.freeze({
  "D-C-10": "construction equipment work-plan coverage for mobile crane, pile driver, and tower-crane scenarios",
  "D-C-11": "excavation and earthwork coverage for common civil/construction hazard inputs",
  "A-G-1": "fall-prevention net coverage that complements the current scaffold and exterior-paint exact pins",
  "A-G-15": "emergency action planning coverage for first-screen stop/report/preserve document flows",
  "B-E-11": "live electrical work coverage paired with the existing de-energized electrical exact pin",
  "B-E-9": "grounding equipment coverage paired with electrical isolation and live-part controls",
  "D-C-4": "excavator task coverage for construction-equipment and work-plan hazard rows",
  "E-G-4": "musculoskeletal prevention coverage for manual handling and repetitive work evidence",
});

const REQUIRED_REVIEW_CHECKS = Object.freeze([
  "official URL opens the expected KOSHA file for the selected stable key",
  "official file id, version, and publication date match metadata and body-corpus provenance",
  "body SHA-256 and PDF SHA-256 are rechecked against immutable acquisition evidence",
  "operator confirms lifecycle/current status and excludes stale superseded versions",
  "human confirmation is recorded before any exact-kosha registry JSON is created",
]);

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

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function normalizedBodySha256(value) {
  return sha256(value.normalize("NFKC").replace(/\s+/gu, " ").trim());
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
function resolveInsideRoot(rootDir, relativePath) {
  const resolved = path.resolve(rootDir, relativePath);
  const root = path.resolve(rootDir);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error(`path-outside-root:${relativePath}`);
  }
  return resolved;
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
function readJsonlMaybeGzip(filePathWithoutGz) {
  const gzipPath = `${filePathWithoutGz}.gz`;
  let text = "";
  if (fs.existsSync(gzipPath)) {
    text = zlib.gunzipSync(fs.readFileSync(gzipPath)).toString("utf8");
  } else if (fs.existsSync(filePathWithoutGz)) {
    text = fs.readFileSync(filePathWithoutGz, "utf8");
  } else {
    return [];
  }
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\r?\n/u).filter(Boolean).map((line) => JSON.parse(line)) : [];
}

function readLogicalFileMaybeGzip(filePathWithoutGz) {
  const gzipPath = `${filePathWithoutGz}.gz`;
  if (fs.existsSync(gzipPath)) {
    const gzipBytes = fs.readFileSync(gzipPath);
    return {
      path: gzipPath,
      gzipSha256: sha256(gzipBytes),
      logicalBytes: zlib.gunzipSync(gzipBytes),
    };
  }
  if (fs.existsSync(filePathWithoutGz)) {
    return {
      path: filePathWithoutGz,
      gzipSha256: null,
      logicalBytes: fs.readFileSync(filePathWithoutGz),
    };
  }
  throw new Error(`kosha-body-output-missing:${filePathWithoutGz}`);
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
 * @param {string} relativePath
 */
function readOfficialLifecycleRows(rootDir, relativePath) {
  const audit = readJson(resolveInsideRoot(rootDir, relativePath));
  if (!isRecord(audit) || asString(audit.schemaVersion) !== "safeclaw-kosha-exact-official-lifecycle-audit/v1") {
    throw new Error("kosha-promotion-packet-invalid-lifecycle-audit");
  }
  const verdict = asString(audit.verdict);
  if (
    verdict !== "REVIEW_REQUIRED_OFFICIAL_CURRENT_LIFECYCLE_MACHINE_SUPPORTED_TITLE_VARIANTS_UNRESOLVED" &&
    verdict !== "PASS_OFFICIAL_CURRENT_LIFECYCLE_MACHINE_SUPPORTED_HUMAN_REVIEW_REQUIRED"
  ) {
    throw new Error("kosha-promotion-packet-lifecycle-audit-not-machine-supported");
  }
  if (
    audit.failedCount !== 0 ||
    audit.exactPromotionPerformed !== false ||
    audit.separatePromotionApprovalRequired !== true ||
    !Array.isArray(audit.results)
  ) {
    throw new Error("kosha-promotion-packet-lifecycle-audit-boundary-mismatch");
  }
  const rows = audit.results.filter(isRecord);
  if (rows.some((row) => row.machineLifecycleSupported !== true)) {
    throw new Error("kosha-promotion-packet-lifecycle-candidate-not-supported");
  }
  return rows;
}

/**
 * @param {string} rootDir
 * @param {string} exactKoshaDir
 */
function readExactVersions(rootDir, exactKoshaDir) {
  const dir = resolveInsideRoot(rootDir, exactKoshaDir);
  return new Set(fs.readdirSync(dir)
    .filter((fileName) => fileName.endsWith(".json"))
    .map((fileName) => readJson(path.join(dir, fileName)))
    .filter(isRecord)
    .map((row) => asString(row.version))
    .filter(Boolean));
}

/**
 * @param {string} rootDir
 * @param {string} bodyCorpusCurrent
 * @param {string} bodyCorpusRoot
 */
function readBodyItems(rootDir, bodyCorpusCurrent, bodyCorpusRoot) {
  const currentPath = resolveInsideRoot(rootDir, bodyCorpusCurrent);
  const currentBytes = fs.readFileSync(currentPath);
  const current = JSON.parse(currentBytes.toString("utf8"));
  if (!isRecord(current)) throw new Error("invalid-kosha-body-current");
  const snapshotPath = asString(current.snapshot_path);
  if (!snapshotPath) throw new Error("kosha-body-current-missing-snapshot-path");
  const corpusRoot = resolveInsideRoot(rootDir, bodyCorpusRoot);
  const snapshotDir = path.resolve(corpusRoot, snapshotPath);
  if (!snapshotDir.startsWith(`${corpusRoot}${path.sep}`)) {
    throw new Error(`kosha-body-snapshot-outside-root:${snapshotPath}`);
  }
  const manifestDescriptor = isRecord(current.manifest) ? current.manifest : {};
  const declaredManifestPath = asString(manifestDescriptor.path) || path.join(snapshotPath, "manifest.json");
  const manifestPath = path.resolve(corpusRoot, declaredManifestPath);
  if (!manifestPath.startsWith(`${corpusRoot}${path.sep}`)) {
    throw new Error(`kosha-body-manifest-outside-root:${declaredManifestPath}`);
  }
  const manifestBytes = fs.readFileSync(manifestPath);
  const manifestSha256 = sha256(manifestBytes);
  const declaredManifestSha256 = asString(manifestDescriptor.sha256);
  if (!declaredManifestSha256 || declaredManifestSha256 !== manifestSha256) {
    throw new Error("kosha-body-current-manifest-hash-mismatch");
  }
  const manifest = JSON.parse(manifestBytes.toString("utf8"));
  if (!isRecord(manifest)) throw new Error("invalid-kosha-body-manifest");
  const currentSnapshotId = asString(current.snapshot_id);
  const manifestSnapshotId = asString(manifest.snapshot_id);
  if (!currentSnapshotId || currentSnapshotId !== manifestSnapshotId || currentSnapshotId !== path.basename(snapshotDir)) {
    throw new Error("kosha-body-snapshot-identity-mismatch");
  }
  const sourceIdentity = isRecord(manifest.source_identity) ? manifest.source_identity : {};
  if (asString(current.source_identity_sha256) !== asString(sourceIdentity.identity_sha256)) {
    throw new Error("kosha-body-source-identity-mismatch");
  }
  const coverage = isRecord(manifest.coverage_scope) ? manifest.coverage_scope : {};
  const launchGate = isRecord(manifest.launch_gate) ? manifest.launch_gate : {};
  const outputHashes = isRecord(manifest.output_hashes) ? manifest.output_hashes : {};
  const itemsFile = readLogicalFileMaybeGzip(path.join(snapshotDir, "items.jsonl"));
  const itemsLogicalSha256 = sha256(itemsFile.logicalBytes);
  const declaredItemsLogicalSha256 = asString(outputHashes["items.jsonl"]);
  if (!declaredItemsLogicalSha256 || declaredItemsLogicalSha256 !== itemsLogicalSha256) {
    throw new Error("kosha-body-items-logical-hash-mismatch");
  }
  const itemsText = itemsFile.logicalBytes.toString("utf8").trim();
  const items = (itemsText ? itemsText.split(/\r?\n/u).filter(Boolean).map((line) => JSON.parse(line)) : []).filter(isRecord);
  const chunks = readJsonlMaybeGzip(path.join(snapshotDir, "chunks.jsonl"));
  const failures = readJsonlMaybeGzip(path.join(snapshotDir, "failures.jsonl"));
  return {
    snapshotId: asString(manifest.snapshot_id) || asString(current.snapshot_id),
    scopeId: asString(coverage.scope_id),
    acceptedCount: asNumber(coverage.accepted_count) ?? items.length,
    bodyKinds: Array.isArray(coverage.body_kinds) ? coverage.body_kinds.map(asString).filter(Boolean) : [],
    officialStatuses: Array.isArray(coverage.official_statuses) ? coverage.official_statuses.map(asString).filter(Boolean) : [],
    provenanceComplete: launchGate.provenance_complete === true,
    networkCallsPerformed: manifest.network_calls_performed === true,
    ocrPerformed: manifest.ocr_performed === true,
    dbMutationPerformed: manifest.db_mutation_performed === true,
    chunksCount: chunks.length,
    failures: failures.length,
    items,
    corpusSource: {
      snapshotId: currentSnapshotId,
      sourceIdentitySha256: asString(sourceIdentity.identity_sha256),
      current: {
        path: path.relative(rootDir, currentPath).replaceAll("\\", "/"),
        sha256: sha256(currentBytes),
      },
      manifest: {
        path: path.relative(rootDir, manifestPath).replaceAll("\\", "/"),
        sha256: manifestSha256,
        declaredSha256: declaredManifestSha256,
      },
      items: {
        path: path.relative(rootDir, itemsFile.path).replaceAll("\\", "/"),
        gzipSha256: itemsFile.gzipSha256,
        logicalSha256: itemsLogicalSha256,
        declaredLogicalSha256: declaredItemsLogicalSha256,
      },
    },
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
 *   candidateKeys?: readonly string[];
 *   officialMetadata?: string;
 *   bodyCorpusCurrent?: string;
 *   bodyCorpusRoot?: string;
 *   exactKoshaDir?: string;
 *   officialLifecycleAudit?: string;
 *   buildInfo?: unknown;
 *   generatedAt?: string;
 * }} options
 */
export function buildKoshaExactPromotionPacket(options) {
  const rootDir = options.rootDir;
  const candidateKeys = Array.from(options.candidateKeys || DEFAULT_CANDIDATE_KEYS);
  const metadataRows = readJsonl(resolveInsideRoot(rootDir, options.officialMetadata || DEFAULT_PATHS.officialMetadata)).filter(isRecord);
  const officialLifecycleAuditPath = options.officialLifecycleAudit || DEFAULT_PATHS.officialLifecycleAudit;
  const lifecycleRows = readOfficialLifecycleRows(rootDir, officialLifecycleAuditPath);
  const exactVersions = readExactVersions(rootDir, options.exactKoshaDir || DEFAULT_PATHS.exactKoshaDir);
  const bodySubset = readBodyItems(
    rootDir,
    options.bodyCorpusCurrent || DEFAULT_PATHS.bodyCorpusCurrent,
    options.bodyCorpusRoot || DEFAULT_PATHS.bodyCorpusRoot,
  );

  if (bodySubset.failures !== 0) throw new Error("kosha-promotion-packet-body-failures");
  if (bodySubset.networkCallsPerformed || bodySubset.ocrPerformed || bodySubset.dbMutationPerformed) {
    throw new Error("kosha-promotion-packet-body-not-read-only");
  }
  if (!bodySubset.provenanceComplete) throw new Error("kosha-promotion-packet-provenance-incomplete");

  const metadataByStableKey = new Map(metadataRows.map((row) => [asString(row.stable_key), row]));
  const lifecycleByStableKey = new Map(lifecycleRows.map((row) => [asString(row.stableKey), row]));
  const bodyByStableKey = new Map(bodySubset.items.map((row) => [asString(row.stable_key), row]));
  const candidates = candidateKeys.map((stableKey, index) => {
    const metadata = metadataByStableKey.get(stableKey);
    const lifecycle = lifecycleByStableKey.get(stableKey);
    const item = bodyByStableKey.get(stableKey);
    if (!metadata) throw new Error(`kosha-promotion-packet-missing-metadata:${stableKey}`);
    if (!item) throw new Error(`kosha-promotion-packet-missing-body-item:${stableKey}`);
    if (!hasCompleteOfficialMetadata(metadata)) throw new Error(`kosha-promotion-packet-incomplete-metadata:${stableKey}`);
    if (asString(metadata.official_status) !== "current") throw new Error(`kosha-promotion-packet-not-current:${stableKey}`);
    const version = asString(metadata.official_version);
    if (exactVersions.has(version)) throw new Error(`kosha-promotion-packet-already-exact:${stableKey}`);
    if (!lifecycle) throw new Error(`kosha-promotion-packet-missing-lifecycle:${stableKey}`);
    const bodySha256 = asString(metadata.body_sha256);
    const pdfSha256 = asString(metadata.pdf_sha256);
    const itemProvenance = isRecord(item.official_provenance) ? item.official_provenance : {};
    const lifecycleMismatches = [
      ["version", version, asString(lifecycle.packetVersion)],
      ["officialFileId", asString(metadata.official_file_id), asString(lifecycle.currentOfficialFileId)],
      ["publishedAt", asString(metadata.publication_date), asString(lifecycle.currentPublishedAt)],
    ].filter(([, expected, actual]) => expected !== actual);
    if (lifecycleMismatches.length > 0) {
      throw new Error(`kosha-promotion-packet-lifecycle-identity-mismatch:${stableKey}:${lifecycleMismatches.map(([field]) => field).join(",")}`);
    }
    const officialCurrentTitle = asString(lifecycle.currentOfficialTitle);
    if (!officialCurrentTitle) throw new Error(`kosha-promotion-packet-missing-official-current-title:${stableKey}`);
    if (asString(item.version_key) !== version) throw new Error(`kosha-promotion-packet-version-mismatch:${stableKey}`);
    const recomputedBodySha256 = normalizedBodySha256(asString(item.body));
    if (recomputedBodySha256 !== bodySha256) throw new Error(`kosha-promotion-packet-body-bytes-mismatch:${stableKey}`);
    if (asString(itemProvenance.body_sha256) !== bodySha256) throw new Error(`kosha-promotion-packet-body-hash-mismatch:${stableKey}`);
    if (asString(itemProvenance.pdf_sha256) !== pdfSha256) throw new Error(`kosha-promotion-packet-pdf-hash-mismatch:${stableKey}`);
    if (asString(itemProvenance.official_file_id) !== asString(metadata.official_file_id)) throw new Error(`kosha-promotion-packet-file-id-mismatch:${stableKey}`);
    return {
      order: index + 1,
      stableKey,
      version,
      title: `${version} ${officialCurrentTitle}`,
      sourceTitle: asString(item.title),
      officialCurrentTitle,
      category: asString(item.category) || asString(metadata.official_category),
      publishedAt: asString(metadata.publication_date),
      officialFileId: asString(metadata.official_file_id),
      officialUrl: asString(metadata.official_url),
      bodySha256,
      recomputedBodySha256,
      pdfSha256,
      normalizedCharCount: asNumber(item.normalized_char_count) ?? 0,
      pageCount: asNumber(item.page_count) ?? 0,
      rationale: CANDIDATE_RATIONALES[stableKey] || "metadata-verified current native technical-support candidate",
      requiredReviewChecks: REQUIRED_REVIEW_CHECKS,
      reviewChecklistComplete: false,
      reviewRequiredBeforeExactTrust: true,
    };
  });

  const candidatePairs = candidates
    .map(({ stableKey, version, recomputedBodySha256, pdfSha256 }) => ({
      stableKey,
      version,
      recomputedBodySha256,
      expectedPdfSha256: pdfSha256,
    }))
    .sort((left, right) => left.stableKey.localeCompare(right.stableKey));
  const candidatePairsSha256 = sha256(canonicalJson(candidatePairs));
  const corpusBindingMaterial = {
    schemaVersion: "safeclaw-kosha-corpus-binding/v1",
    ...bodySubset.corpusSource,
    candidatePairs,
    candidatePairsSha256,
  };
  const corpusBinding = {
    ...corpusBindingMaterial,
    bindingSha256: sha256(canonicalJson(corpusBindingMaterial)),
  };

  return {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: options.generatedAt || new Date().toISOString(),
    sourceHead: gitHead(rootDir),
    liveBuildInfoAtPacket: normalizeBuildInfo(options.buildInfo),
    verdict: "EXACT_PROMOTION_PACKET_READY_FOR_OPERATOR_REVIEW",
    scope: "read-only bounded selection packet for future KOSHA exact-trust promotion review",
    mutationPerformed: false,
    networkAcquisitionPerformed: false,
    dbMutationPerformed: false,
    embeddingGenerationPerformed: false,
    exactPromotionPerformed: false,
    candidateCount: candidates.length,
    corpusBinding,
    officialLifecycleAuditPath,
    titleReconciliation: {
      sourceTitlesPreserved: true,
      officialCurrentTitlesUsed: true,
      reconciledCandidateCount: candidates.length,
      changedTitleCount: candidates.filter((candidate) => candidate.title !== candidate.sourceTitle).length,
    },
    operatorReviewReadiness: {
      packetReadyForReview: true,
      reviewChecklistComplete: false,
      exactTrustPromotionBlockedUntilChecklistComplete: true,
      perCandidateRequiredCheckCount: REQUIRED_REVIEW_CHECKS.length,
    },
    selectionPolicy: {
      sourcePool: "metadata-verified current native technical-support regulations",
      selectedStableKeys: candidateKeys,
      acceptedStructure: "operator review packet only; no exact trust registry mutation",
      reasons: [
        "prioritize construction work-plan, excavation, fall, emergency, electrical, equipment, and ergonomic scenarios that complement current SafeClaw evidence flows",
      "require complete official metadata and matching body-corpus provenance before review",
      "preserve corpus source titles while presenting the read-only official current-list title to reviewers",
        "exclude already exact-trusted pins",
      ],
    },
    verifiedSubsetCurrent: {
      snapshotId: bodySubset.snapshotId,
      scopeId: bodySubset.scopeId,
      acceptedCount: bodySubset.acceptedCount,
      chunksCount: bodySubset.chunksCount,
      failures: bodySubset.failures,
      bodyKinds: bodySubset.bodyKinds,
      officialStatuses: bodySubset.officialStatuses,
      provenanceComplete: bodySubset.provenanceComplete,
      networkCallsPerformed: bodySubset.networkCallsPerformed,
      ocrPerformed: bodySubset.ocrPerformed,
      dbMutationPerformed: bodySubset.dbMutationPerformed,
    },
    candidates,
    requiredBeforePromotion: [
      "Review each official URL, file ID, version, publication date, body hash, and PDF hash against immutable acquisition evidence.",
      "Create exact-kosha JSON pins only after human review confirms the official body/PDF pair.",
      "Add fail-closed tests for stale version, hash mismatch, missing lifecycle, missing human confirmation, and metadata contradiction.",
      "Run exact-trusted grounding, KOSHA current live gate, North Star open-gate audit, and launch-readiness boundary tests after promotion.",
      "Keep SIF/KOSHA vector upload and provider dispatch separate approval-gated boundaries.",
    ],
    safeClaims: [
      "This packet selects a bounded KOSHA exact-promotion review set from metadata-verified current native rows.",
      "No exact trust registry, DB, embedding, upload, provider dispatch, or live runtime mutation occurred.",
    ],
    forbiddenClaims: [
      "These candidates are already exact production evidence.",
      "The exact-kosha registry was expanded by this packet.",
      "All KOSHA Guide rows are exact direct evidence.",
      "KOSHA vector retrieval or embeddings are production-active because of this packet.",
    ],
  };
}

/**
 * @param {ReturnType<typeof buildKoshaExactPromotionPacket>} report
 */
function renderMarkdown(report) {
  const rows = report.candidates.map((candidate) => (
    `| ${candidate.order} | ${candidate.stableKey} | ${candidate.version} | ${candidate.title} | ${candidate.sourceTitle} | ${candidate.officialFileId} | ${candidate.bodySha256.slice(0, 12)} | ${candidate.pdfSha256.slice(0, 12)} | ${candidate.rationale} |`
  )).join("\n");
  return `# KOSHA Exact Promotion Packet

Generated at: ${report.generatedAt}

Verdict: \`${report.verdict}\`

Source HEAD: \`${report.sourceHead}\`

Live commit at packet generation: \`${report.liveBuildInfoAtPacket.commitSha || "unknown"}\`

Scope: ${report.scope}

Mutation performed: \`${report.mutationPerformed}\`

Exact promotion performed: \`${report.exactPromotionPerformed}\`

Review checklist complete: \`${report.operatorReviewReadiness.reviewChecklistComplete}\`

## Selection Policy

- Source pool: \`${report.selectionPolicy.sourcePool}\`
- Selected stable keys: \`${report.selectionPolicy.selectedStableKeys.join(", ")}\`
- Accepted structure: ${report.selectionPolicy.acceptedStructure}
- Verified subset: ${report.verifiedSubsetCurrent.acceptedCount} items / ${report.verifiedSubsetCurrent.chunksCount} chunks / ${report.verifiedSubsetCurrent.failures} failures

## Candidate Packet

| # | Stable key | Version | Official current title | Source corpus title | Official file id | Body hash | PDF hash | Why this candidate |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
${rows}

## Per-Candidate Review Checks

${report.candidates[0]?.requiredReviewChecks.map((item) => `- ${item}`).join("\n") || "- No candidate checks were generated."}

## Review Required Before Promotion

${report.requiredBeforePromotion.map((item) => `- ${item}`).join("\n")}

## Forbidden Claims

${report.forbiddenClaims.map((item) => `- ${item}`).join("\n")}
`;
}

/**
 * @param {string[]} args
 */
function parseArgs(args) {
  /** @type {{ rootDir: string; output: string; buildInfoUrl: string; buildInfoFile: string; officialLifecycleAudit: string; generatedAt: string; candidateKeys: string[] }} */
  const parsed = {
    rootDir: REPO_ROOT,
    output: DEFAULT_OUTPUT_DIR,
    buildInfoUrl: DEFAULT_BUILD_INFO_URL,
    buildInfoFile: "",
    officialLifecycleAudit: DEFAULT_PATHS.officialLifecycleAudit,
    generatedAt: "",
    candidateKeys: [],
  };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1] || "";
    if (arg === "--root") {
      parsed.rootDir = path.resolve(next);
      index += 1;
    } else if (arg === "--output") {
      parsed.output = next;
      index += 1;
    } else if (arg === "--build-info-url") {
      parsed.buildInfoUrl = next;
      index += 1;
    } else if (arg === "--build-info-file") {
      parsed.buildInfoFile = next;
      index += 1;
    } else if (arg === "--official-lifecycle-audit") {
      parsed.officialLifecycleAudit = next;
      index += 1;
    } else if (arg === "--generated-at") {
      parsed.generatedAt = next;
      index += 1;
    } else if (arg === "--candidate-keys") {
      parsed.candidateKeys = next.split(",").map((key) => key.trim()).filter(Boolean);
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return parsed;
}

/**
 * @param {string} rootDir
 * @param {string} buildInfoFile
 * @param {string} buildInfoUrl
 */
async function loadBuildInfo(rootDir, buildInfoFile, buildInfoUrl) {
  if (buildInfoFile) {
    return readJson(resolveInsideRoot(rootDir, buildInfoFile));
  }
  try {
    const response = await fetch(`${buildInfoUrl}?codexCacheBust=kosha-promotion-packet-${Date.now()}`);
    if (!response.ok) return {};
    return await response.json();
  } catch {
    return {};
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const buildInfo = await loadBuildInfo(args.rootDir, args.buildInfoFile, args.buildInfoUrl);
  const report = buildKoshaExactPromotionPacket({
    rootDir: args.rootDir,
    candidateKeys: args.candidateKeys.length > 0 ? args.candidateKeys : DEFAULT_CANDIDATE_KEYS,
    officialLifecycleAudit: args.officialLifecycleAudit,
    buildInfo,
    generatedAt: args.generatedAt || undefined,
  });
  const outputDir = resolveInsideRoot(args.rootDir, args.output);
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  fs.writeFileSync(path.join(outputDir, "report.md"), renderMarkdown(report), "utf8");
  console.log(JSON.stringify({ output: args.output, sourceHead: report.sourceHead, candidateCount: report.candidateCount }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) {
  await main();
}
