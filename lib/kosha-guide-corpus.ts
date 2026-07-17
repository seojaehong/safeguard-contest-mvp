import "server-only";

import { createHash } from "node:crypto";
import { lstat, open, realpath, type FileHandle } from "node:fs/promises";
import type { Stats } from "node:fs";
import { basename, isAbsolute, relative, resolve, sep } from "node:path";
import { gunzipSync } from "node:zlib";

export type KoshaGuideCorpusItemType = "technical-guideline" | "technical-support-regulation";
export type KoshaGuideOfflineRetrievalMode = "local-tag" | "local-ranked" | "local-hybrid";

const VERIFIED_SUBSET_CONTRACT = {
  sourceSnapshotId: "935340ef3f74078c36168666650164c43511daced84efa3eda849833ad8d6844",
  scopeId: "technical-support-regulation-current-native",
  sourceInventoryCount: 1040,
  candidateCount: 234,
  outOfScopeCount: 806,
  selection: "technical-support-regulation+current-unverified+success+native"
} as const;
const PRODUCTION_TRUSTED_OFFICIAL_METADATA_SHA256: readonly string[] = Object.freeze([
  "1c03af6776158ba21650325ea7b31f2a661d0adea9441d29aacf977e0c815a5f"
]);
const DEFAULT_BUNDLED_KOSHA_GUIDE_CORPUS_DIR = "data/safety-knowledge/kosha-guide-corpus";

export type KoshaGuideCorpusAnchor = {
  page: number;
  excerpt: string;
};

export type KoshaGuideCorpusRecord = {
  referenceId: string;
  stableDocumentKey: string;
  version: string;
  itemType: KoshaGuideCorpusItemType;
  title: string;
  category: string;
  nativeBody: string;
  bodyKind: "native" | "unknown";
  quality: "accepted" | "review_required";
  provenance: {
    sourceId: string;
    generationId: string;
    generatedAt: string;
    lifecycle: "current" | "stale" | "retired";
    chunkId: string;
    bodyHash: string;
    officialUrl: string;
    officialFileId: string;
    publicationDate: string;
    officialVersion: string;
    officialStatus: "current";
    pdfHash: string;
  };
  tags: {
    keywords: string[];
    riskTags: string[];
    controls: string[];
    primaryDocuments: string[];
  };
  anchors: KoshaGuideCorpusAnchor[];
};

export type KoshaGuideCorpusHit = {
  referenceId: string;
  stableDocumentKey: string;
  retrievalMode: KoshaGuideOfflineRetrievalMode;
  score: number;
  directEligible: boolean;
  evidenceRef: string | null;
  record: KoshaGuideCorpusRecord;
};

type IndexedRecord = {
  record: KoshaGuideCorpusRecord;
  tagText: string;
  bodyText: string;
};

export type KoshaGuideCorpusReady = {
  status: "ready";
  rootDir: string;
  manifestSha256: string;
  snapshotId: string;
  inventoryCount: number;
  itemCount: number;
  chunkCount: number;
  failureCount: number;
  coverageScope: KoshaGuideCoverageScope;
  records: KoshaGuideCorpusRecord[];
  indexedRecords: IndexedRecord[];
};

export type KoshaGuideCoverageScope = {
  scopeId: string;
  sourceInventoryCount: number;
  candidateCount: number;
  acceptedCount: number;
  rejectedCount: number;
  outOfScopeCount: number;
  itemTypes: KoshaGuideCorpusItemType[];
  officialStatuses: ["current"];
  bodyKinds: ["native"];
  complete: boolean;
};

export type KoshaGuideCorpusLoadResult =
  | KoshaGuideCorpusReady
  | { status: "blocked"; rootDir: string | null; failures: string[] }
  | { status: "unconfigured"; rootDir: null; failures: [] };

export type KoshaGuideCorpusLookup = {
  rootDir?: string | null;
  env?: Record<string, string | undefined>;
  testHooks?: {
    afterPathChecked?: (path: string) => Promise<void> | void;
    afterStreamChunk?: (path: string, bytesRead: number) => Promise<void> | void;
    trustedOfficialMetadataSha256?: readonly string[];
  };
};

type CurrentSnapshot = {
  manifestPath: string;
  manifestSha256: string;
  manifestSize: number;
  snapshotId: string;
  snapshotPath: string;
  reproducibilityHash: string;
  sourceIdentitySha256: string;
  generationPolicySha256: string;
};

type ManifestSnapshot = {
  snapshotId: string;
  reproducibilityHash: string;
  sourceIdentitySha256: string;
  generationPolicySha256: string;
  computedGenerationPolicySha256: string;
  sourceSnapshotId: string;
  selection: string;
  officialMetadataSha256: string | null;
  generatorSourceSha256: string;
  trustedMetadataRegistrySha256: string;
  hashes: { items: string; chunks: string; failures: string };
  counts: {
    inventory: number;
    success: number;
    chunks: number;
    failureLedger: number;
  };
  reviewedOcrCandidates: ReviewedOcrCandidateBinding[];
  launchGate: {
    launchReady: boolean;
    failureCount: number;
    partialCoverage: boolean;
    provenanceComplete: boolean;
    blockers: string[];
  };
  coverageScope: KoshaGuideCoverageScope;
};

type ReviewedOcrCandidateBinding = {
  itemId: string;
  candidateSha256: string;
  contentSha256: string;
  attestationSha256: string;
};

type RawItem = {
  itemId: string;
  itemType: KoshaGuideCorpusItemType;
  title: string;
  category: string;
  body: string;
  bodyHash: string;
  state: string;
  stableKey: string;
  versionKey: string;
  sourceKey: string;
  extractionStatus: string;
  bodyOrigin: "native" | "human-reviewed-ocr";
  reviewedOcrCandidateSha256: string | null;
  reviewedOcrContentSha256: string | null;
  reviewedOcrAttestationSha256: string | null;
  rawSha256: string;
  officialProvenance: {
    officialUrl: string;
    officialFileId: string;
    publicationDate: string;
    officialVersion: string;
    officialStatus: "current";
    pdfSha256: string;
    bodySha256: string;
  } | null;
};

type RawChunk = {
  chunkId: string;
  chunkHash: string;
  itemId: string;
  pageStart: number;
  pageEnd: number;
  text: string;
};

type RawFailure = { itemId: string };

const LIMITS = {
  current: 128 * 1024,
  manifest: 1024 * 1024,
  items: 48 * 1024 * 1024,
  chunks: 48 * 1024 * 1024,
  failures: 1024 * 1024,
  itemLine: 8 * 1024 * 1024,
  chunkLine: 512 * 1024,
  failureLine: 128 * 1024,
  itemLines: 2_000,
  chunkLines: 30_000,
  failureLines: 2_000
} as const;

class CorpusGateError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

const loadCache = new Map<string, Promise<KoshaGuideCorpusLoadResult>>();
let uncachedLoads = 0;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readRawString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function readInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

function isSha256(value: string): boolean {
  return /^[a-f0-9]{64}$/iu.test(value);
}

function readCanonicalSha256(value: unknown): string | null {
  return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value) ? value : null;
}

function readCanonicalIdentifier(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 && value.trim() === value ? value : null;
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Object.keys(value);
  return keys.length === expected.length && expected.every((key) => Object.prototype.hasOwnProperty.call(value, key));
}

function isRfc3339(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-](\d{2}):(\d{2}))$/u.exec(value);
  if (!match) return false;
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, offsetHourText, offsetMinuteText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const offsetHour = Number(offsetHourText ?? 0);
  const offsetMinute = Number(offsetMinuteText ?? 0);
  if (month < 1 || month > 12 || hour > 23 || minute > 59 || second > 59 || offsetHour > 23 || offsetMinute > 59) return false;
  return day >= 1 && day <= new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function isIsoDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return month >= 1 && month <= 12 && day >= 1 && day <= new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function isOfficialKoshaUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    return url.protocol === "https:" && (hostname === "kosha.or.kr" || hostname.endsWith(".kosha.or.kr"));
  } catch {
    return false;
  }
}

function parseLaunchGate(value: unknown): ManifestSnapshot["launchGate"] | null {
  if (!isRecord(value)) return null;
  const failureCount = readInteger(value.failure_count);
  const blockers = Array.isArray(value.blockers) && value.blockers.every((item) => typeof item === "string")
    ? value.blockers
    : null;
  if (
    typeof value.launch_ready !== "boolean"
    || failureCount === null
    || typeof value.partial_coverage !== "boolean"
    || typeof value.provenance_complete !== "boolean"
    || !blockers
  ) return null;
  return {
    launchReady: value.launch_ready,
    failureCount,
    partialCoverage: value.partial_coverage,
    provenanceComplete: value.provenance_complete,
    blockers
  };
}

function parseCoverageScope(value: unknown): KoshaGuideCoverageScope | null {
  if (!isRecord(value)) return null;
  const sourceInventoryCount = readInteger(value.source_inventory_count);
  const candidateCount = readInteger(value.candidate_count);
  const acceptedCount = readInteger(value.accepted_count);
  const rejectedCount = readInteger(value.rejected_count);
  const outOfScopeCount = readInteger(value.out_of_scope_count);
  const itemTypes = value.item_types;
  const officialStatuses = value.official_statuses;
  const bodyKinds = value.body_kinds;
  if (
    !readCanonicalIdentifier(value.scope_id)
    || sourceInventoryCount === null
    || candidateCount === null
    || acceptedCount === null
    || rejectedCount === null
    || outOfScopeCount === null
    || !Array.isArray(itemTypes)
    || itemTypes.length === 0
    || !itemTypes.every((item) => item === "technical-guideline" || item === "technical-support-regulation")
    || !Array.isArray(officialStatuses)
    || officialStatuses.length !== 1
    || officialStatuses[0] !== "current"
    || !Array.isArray(bodyKinds)
    || bodyKinds.length !== 1
    || bodyKinds[0] !== "native"
    || typeof value.complete !== "boolean"
  ) return null;
  return {
    scopeId: value.scope_id as string,
    sourceInventoryCount,
    candidateCount,
    acceptedCount,
    rejectedCount,
    outOfScopeCount,
    itemTypes: itemTypes as KoshaGuideCorpusItemType[],
    officialStatuses: ["current"],
    bodyKinds: ["native"],
    complete: value.complete
  };
}

function parseOfficialProvenance(value: unknown): RawItem["officialProvenance"] {
  if (!isRecord(value)) return null;
  const officialUrl = readCanonicalIdentifier(value.official_url);
  const officialFileId = readCanonicalIdentifier(value.official_file_id);
  const publicationDate = readCanonicalIdentifier(value.publication_date);
  const officialVersion = readCanonicalIdentifier(value.official_version);
  const pdfSha256 = readCanonicalSha256(value.pdf_sha256);
  const bodySha256 = readCanonicalSha256(value.body_sha256);
  if (
    !officialUrl
    || !isOfficialKoshaUrl(officialUrl)
    || !officialFileId
    || !publicationDate
    || !isIsoDate(publicationDate)
    || !officialVersion
    || value.official_status !== "current"
    || !pdfSha256
    || !bodySha256
  ) return null;
  return {
    officialUrl,
    officialFileId,
    publicationDate,
    officialVersion,
    officialStatus: "current",
    pdfSha256,
    bodySha256
  };
}

function parseReviewedOcrProvenance(value: unknown): {
  candidateSha256: string;
  contentSha256: string;
  attestationSha256: string;
} | null {
  if (!isRecord(value) || !hasExactKeys(value, [
    "candidate_sha256",
    "content_sha256",
    "attestation_sha256",
    "attestation_schema",
    "reviewed_by",
    "reviewed_at",
    "generator_script_sha256",
    "pages"
  ])) return null;
  const hashes = [
    value.candidate_sha256,
    value.content_sha256,
    value.attestation_sha256,
    value.generator_script_sha256
  ];
  if (!hashes.every((hash) => readCanonicalSha256(hash) !== null)) return null;
  if (value.attestation_schema !== "safeclaw-kosha-ocr-review-attestation/v1") return null;
  const reviewedBy = readCanonicalIdentifier(value.reviewed_by);
  const reviewedAt = typeof value.reviewed_at === "string" ? value.reviewed_at : "";
  if (!reviewedBy || !isRfc3339(reviewedAt)) return null;
  if (!Array.isArray(value.pages) || !value.pages.length) return null;
  const validPages = value.pages.every((page, index) => {
    if (!isRecord(page) || !hasExactKeys(page, [
      "page_number",
      "image_sha256",
      "text_sha256",
      "response_id",
      "model"
    ])) return false;
    return readInteger(page.page_number) === index + 1
      && readCanonicalSha256(page.image_sha256) !== null
      && readCanonicalSha256(page.text_sha256) !== null
      && readCanonicalIdentifier(page.response_id) !== null
      && readCanonicalIdentifier(page.model) !== null;
  });
  const candidateSha256 = readCanonicalSha256(value.candidate_sha256);
  const contentSha256 = readCanonicalSha256(value.content_sha256);
  const attestationSha256 = readCanonicalSha256(value.attestation_sha256);
  return validPages && candidateSha256 && contentSha256 && attestationSha256
    ? { candidateSha256, contentSha256, attestationSha256 }
    : null;
}

function parseReviewedOcrCandidateBindings(generationPolicy: unknown): ReviewedOcrCandidateBinding[] | null {
  if (generationPolicy === undefined) return [];
  if (!isRecord(generationPolicy)) return null;
  const declared = generationPolicy.reviewed_ocr_candidates;
  if (declared === undefined) return [];
  if (!Array.isArray(declared) || !declared.length) return null;
  const bindings: ReviewedOcrCandidateBinding[] = [];
  for (const value of declared) {
    if (!isRecord(value) || !hasExactKeys(value, [
      "item_id",
      "candidate_sha256",
      "content_sha256",
      "attestation_sha256"
    ])) return null;
    const itemId = readCanonicalIdentifier(value.item_id);
    const candidateSha256 = readCanonicalSha256(value.candidate_sha256);
    const contentSha256 = readCanonicalSha256(value.content_sha256);
    const attestationSha256 = readCanonicalSha256(value.attestation_sha256);
    if (!itemId || !candidateSha256 || !contentSha256 || !attestationSha256) return null;
    bindings.push({ itemId, candidateSha256, contentSha256, attestationSha256 });
  }
  return bindings;
}

function sha256(value: Uint8Array | string): string {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeText(value: string): string {
  return value.normalize("NFKC").replace(/\s+/gu, " ").trim();
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }
  throw new CorpusGateError("identity:canonical-json");
}

function parseCurrent(value: unknown): CurrentSnapshot | null {
  if (!isRecord(value) || value.schema_version !== "safeclaw-kosha-body-current/v1") return null;
  const manifest = isRecord(value.manifest) ? value.manifest : null;
  if (!manifest) return null;
  const parsed: CurrentSnapshot = {
    manifestPath: readString(manifest.path),
    manifestSha256: readString(manifest.sha256).toLowerCase(),
    manifestSize: readInteger(manifest.size_bytes) ?? -1,
    snapshotId: readString(value.snapshot_id),
    snapshotPath: readString(value.snapshot_path),
    reproducibilityHash: readString(value.reproducibility_hash).toLowerCase(),
    sourceIdentitySha256: readString(value.source_identity_sha256).toLowerCase(),
    generationPolicySha256: readString(value.generation_policy_sha256).toLowerCase()
  };
  if (!parsed.manifestPath || parsed.manifestSize < 0 || !parsed.snapshotId || !parsed.snapshotPath) return null;
  if (![parsed.manifestSha256, parsed.reproducibilityHash, parsed.sourceIdentitySha256, parsed.generationPolicySha256].every(isSha256)) return null;
  return parsed;
}

function parseManifest(value: unknown): ManifestSnapshot | null {
  if (!isRecord(value) || value.schema_version !== "safeclaw-kosha-verified-subset/v1") return null;
  const counts = isRecord(value.counts) ? value.counts : null;
  const hashes = isRecord(value.output_hashes) ? value.output_hashes : null;
  const identity = isRecord(value.source_identity) ? value.source_identity : null;
  const generationPolicy = isRecord(value.generation_policy) ? value.generation_policy : null;
  const reviewedOcrCandidates = parseReviewedOcrCandidateBindings(value.generation_policy);
  const launchGate = parseLaunchGate(value.launch_gate);
  const coverageScope = parseCoverageScope(value.coverage_scope);
  if (!counts || !hashes || !identity || !generationPolicy || !reviewedOcrCandidates || !launchGate || !coverageScope) return null;
  const officialMetadataSha256 = generationPolicy.official_metadata_sha256 === null
    ? null
    : readCanonicalSha256(generationPolicy.official_metadata_sha256);
  if (generationPolicy.official_metadata_sha256 !== null && !officialMetadataSha256) return null;
  const parsed: ManifestSnapshot = {
    snapshotId: readString(value.snapshot_id),
    reproducibilityHash: readString(value.reproducibility_hash).toLowerCase(),
    sourceIdentitySha256: readString(identity.identity_sha256).toLowerCase(),
    generationPolicySha256: readString(value.generation_policy_sha256).toLowerCase(),
    computedGenerationPolicySha256: sha256(canonicalJson(generationPolicy)),
    sourceSnapshotId: readString(generationPolicy.source_snapshot_id),
    selection: readString(generationPolicy.selection),
    officialMetadataSha256,
    generatorSourceSha256: readString(generationPolicy.generator_source_sha256).toLowerCase(),
    trustedMetadataRegistrySha256: readString(generationPolicy.trusted_metadata_registry_sha256).toLowerCase(),
    hashes: {
      items: readString(hashes["items.jsonl"]).toLowerCase(),
      chunks: readString(hashes["chunks.jsonl"]).toLowerCase(),
      failures: readString(hashes["failures.jsonl"]).toLowerCase()
    },
    counts: {
      inventory: readInteger(counts.inventory) ?? -1,
      success: readInteger(counts.success) ?? -1,
      chunks: readInteger(counts.chunks) ?? -1,
      failureLedger: readInteger(counts.failure_ledger) ?? -1
    },
    reviewedOcrCandidates,
    launchGate,
    coverageScope
  };
  if (!parsed.snapshotId || Object.values(parsed.counts).some((count) => count < 0)) return null;
  if (![
    parsed.reproducibilityHash,
    parsed.sourceIdentitySha256,
    parsed.generationPolicySha256,
    parsed.generatorSourceSha256,
    parsed.trustedMetadataRegistrySha256,
    ...Object.values(parsed.hashes)
  ].every(isSha256)) return null;
  return parsed;
}

function parseItem(value: unknown): RawItem | null {
  if (!isRecord(value) || value.schema_version !== "safeclaw-kosha-body-corpus/v2") return null;
  const itemType = value.item_type;
  if (itemType !== "technical-guideline" && itemType !== "technical-support-regulation") return null;
  let bodyOrigin: RawItem["bodyOrigin"];
  let reviewedOcrCandidateSha256: string | null = null;
  let reviewedOcrContentSha256: string | null = null;
  let reviewedOcrAttestationSha256: string | null = null;
  if (value.body_origin === undefined && value.reviewed_ocr_provenance === undefined) {
    bodyOrigin = "native";
  } else {
    if (value.body_origin !== "human-reviewed-ocr") return null;
    const provenance = parseReviewedOcrProvenance(value.reviewed_ocr_provenance);
    if (!provenance) return null;
    bodyOrigin = "human-reviewed-ocr";
    reviewedOcrCandidateSha256 = provenance.candidateSha256;
    reviewedOcrContentSha256 = provenance.contentSha256;
    reviewedOcrAttestationSha256 = provenance.attestationSha256;
  }
  const body = readRawString(value.body) ?? "";
  const officialProvenance = parseOfficialProvenance(value.official_provenance);
  const parsed: RawItem = {
    itemId: readString(value.item_id),
    itemType,
    title: readString(value.title),
    category: readString(value.category),
    body,
    bodyHash: readString(value.normalized_text_sha256).toLowerCase(),
    state: readString(value.state),
    stableKey: readString(value.stable_key),
    versionKey: readString(value.version_key),
    sourceKey: readString(value.source_key),
    extractionStatus: readString(value.extraction_status),
    bodyOrigin,
    reviewedOcrCandidateSha256,
    reviewedOcrContentSha256,
    reviewedOcrAttestationSha256,
    rawSha256: readString(value.raw_sha256).toLowerCase(),
    officialProvenance
  };
  if (!parsed.itemId || !parsed.title || !parsed.category || !parsed.state || !parsed.stableKey || !parsed.versionKey || !parsed.sourceKey || !parsed.extractionStatus || !isSha256(parsed.bodyHash)) return null;
  if (parsed.bodyOrigin === "human-reviewed-ocr") {
    if (parsed.extractionStatus !== "success" || !readCanonicalSha256(value.normalized_text_sha256)) return null;
    const normalizedBody = normalizeText(parsed.body);
    if (!normalizedBody || sha256(normalizedBody) !== parsed.bodyHash) return null;
  }
  if (!isSha256(parsed.rawSha256)) return null;
  return parsed;
}

function parseChunk(value: unknown): RawChunk | null {
  if (!isRecord(value) || value.schema_version !== "safeclaw-kosha-body-corpus/v2") return null;
  const text = readRawString(value.text);
  const parsed: RawChunk = {
    chunkId: readString(value.chunk_id),
    chunkHash: readString(value.chunk_sha256).toLowerCase(),
    itemId: readString(value.item_id),
    pageStart: readInteger(value.page_start) ?? 0,
    pageEnd: readInteger(value.page_end) ?? 0,
    text: text ?? ""
  };
  if (!parsed.chunkId || !parsed.itemId || !isSha256(parsed.chunkHash) || parsed.pageStart < 1 || parsed.pageEnd < parsed.pageStart || !parsed.text) return null;
  return parsed;
}

function parseFailure(value: unknown): RawFailure | null {
  if (!isRecord(value) || value.schema_version !== "safeclaw-kosha-body-corpus/v2") return null;
  const itemId = readString(value.item_id);
  return itemId ? { itemId } : null;
}

function isInside(rootDir: string, target: string): boolean {
  const rel = relative(rootDir, target);
  return rel !== "" && rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
}

async function resolveSafePath(rootDir: string, requestedPath: string): Promise<string> {
  if (!requestedPath || isAbsolute(requestedPath)) throw new CorpusGateError("path:absolute");
  const parts = requestedPath.split(/[\\/]+/u);
  if (parts.some((part) => !part || part === "." || part === "..")) throw new CorpusGateError("path:escape");
  const candidate = resolve(rootDir, ...parts);
  if (!isInside(rootDir, candidate)) throw new CorpusGateError("path:escape");
  let cursor = rootDir;
  for (const part of parts) {
    cursor = resolve(cursor, part);
    const entry = await lstat(cursor);
    if (entry.isSymbolicLink()) throw new CorpusGateError("path:symlink");
  }
  const realTarget = await realpath(candidate);
  if (!isInside(rootDir, realTarget)) throw new CorpusGateError("path:escape");
  return realTarget;
}

function sameFile(before: Stats, opened: Stats): boolean {
  return before.isFile() && opened.isFile() && before.dev === opened.dev && before.ino === opened.ino;
}

async function openSafeFile(
  rootDir: string,
  requestedPath: string,
  maxBytes: number,
  hooks?: KoshaGuideCorpusLookup["testHooks"]
): Promise<{ handle: FileHandle; path: string; initialSize: number }> {
  const path = await resolveSafePath(rootDir, requestedPath);
  const before = await lstat(path);
  if (!before.isFile() || before.size > maxBytes) throw new CorpusGateError(`limit:file:${basename(path)}`);
  await hooks?.afterPathChecked?.(path);
  const handle = await open(path, "r");
  const opened = await handle.stat();
  if (!sameFile(before, opened)) {
    await handle.close();
    throw new CorpusGateError("path:toctou");
  }
  return { handle, path, initialSize: opened.size };
}

async function readJsonFile<T>(
  rootDir: string,
  path: string,
  maxBytes: number,
  parser: (value: unknown) => T | null,
  hooks?: KoshaGuideCorpusLookup["testHooks"]
): Promise<{ raw: Buffer; value: T }> {
  const file = await openSafeFile(rootDir, path, maxBytes, hooks);
  try {
    const raw = Buffer.alloc(file.initialSize);
    const result = await file.handle.read(raw, 0, raw.length, 0);
    if (result.bytesRead !== raw.length) throw new CorpusGateError(`read:short:${basename(path)}`);
    const value = parser(JSON.parse(raw.toString("utf8")) as unknown);
    if (!value) throw new CorpusGateError(`schema:${basename(path)}`);
    return { raw, value };
  } catch (error) {
    if (error instanceof CorpusGateError) throw error;
    throw new CorpusGateError(`schema:${basename(path)}`);
  } finally {
    await file.handle.close();
  }
}

async function readJsonLines<T>(
  rootDir: string,
  path: string,
  maxBytes: number,
  maxLines: number,
  maxLineBytes: number,
  parser: (value: unknown) => T | null,
  hooks?: KoshaGuideCorpusLookup["testHooks"]
): Promise<{ rows: T[]; hash: string }> {
  let file: { handle: FileHandle; path: string; initialSize: number };
  try {
    file = await openSafeFile(rootDir, path, maxBytes, hooks);
  } catch (error) {
    if (error instanceof CorpusGateError) throw error;
    const compressedPath = `${path}.gz`;
    const compressedFile = await openSafeFile(rootDir, compressedPath, maxBytes, hooks);
    try {
      const compressed = Buffer.alloc(compressedFile.initialSize);
      const result = await compressedFile.handle.read(compressed, 0, compressed.length, 0);
      if (result.bytesRead !== compressed.length) throw new CorpusGateError(`read:short:${basename(compressedPath)}`);
      const raw = gunzipSync(compressed);
      if (raw.length > maxBytes) throw new CorpusGateError(`limit:file:${basename(path)}`);
      await hooks?.afterStreamChunk?.(compressedFile.path, raw.length);
      return parseJsonLinesBuffer(raw, path, maxLines, maxLineBytes, parser);
    } catch (compressedError) {
      if (compressedError instanceof CorpusGateError) throw compressedError;
      throw new CorpusGateError(`schema:${basename(compressedPath)}`);
    } finally {
      await compressedFile.handle.close();
    }
  }
  const hash = createHash("sha256");
  const rows: T[] = [];
  let pending = Buffer.alloc(0);
  let offset = 0;
  let total = 0;
  const parseLine = (lineWithCr: Buffer): void => {
    const line = lineWithCr.at(-1) === 13 ? lineWithCr.subarray(0, -1) : lineWithCr;
    if (!line.length) return;
    if (line.length > maxLineBytes) throw new CorpusGateError(`limit:record:${basename(path)}`);
    if (rows.length >= maxLines) throw new CorpusGateError(`limit:lines:${basename(path)}`);
    let value: T | null = null;
    try {
      value = parser(JSON.parse(line.toString("utf8")) as unknown);
    } catch {
      throw new CorpusGateError(`schema:${basename(path)}`);
    }
    if (!value) throw new CorpusGateError(`schema:${basename(path)}`);
    rows.push(value);
  };
  try {
    while (true) {
      const buffer = Buffer.alloc(64 * 1024);
      const result = await file.handle.read(buffer, 0, buffer.length, offset);
      if (!result.bytesRead) break;
      const chunk = buffer.subarray(0, result.bytesRead);
      offset += result.bytesRead;
      total += result.bytesRead;
      if (total > maxBytes) throw new CorpusGateError(`limit:file:${basename(path)}`);
      hash.update(chunk);
      await hooks?.afterStreamChunk?.(file.path, total);
      const current = await file.handle.stat();
      if (current.size > maxBytes) throw new CorpusGateError(`limit:file:${basename(path)}`);
      pending = Buffer.concat([pending, chunk]);
      let newline = pending.indexOf(10);
      while (newline >= 0) {
        parseLine(pending.subarray(0, newline));
        pending = pending.subarray(newline + 1);
        newline = pending.indexOf(10);
      }
      if (pending.length > maxLineBytes) throw new CorpusGateError(`limit:record:${basename(path)}`);
    }
    if (pending.length) parseLine(pending);
    return { rows, hash: hash.digest("hex") };
  } finally {
    await file.handle.close();
  }
}

function parseJsonLinesBuffer<T>(
  raw: Buffer,
  path: string,
  maxLines: number,
  maxLineBytes: number,
  parser: (value: unknown) => T | null
): { rows: T[]; hash: string } {
  const hash = createHash("sha256");
  const rows: T[] = [];
  const parseLine = (lineWithCr: Buffer): void => {
    const line = lineWithCr.at(-1) === 13 ? lineWithCr.subarray(0, -1) : lineWithCr;
    if (!line.length) return;
    if (line.length > maxLineBytes) throw new CorpusGateError(`limit:record:${basename(path)}`);
    if (rows.length >= maxLines) throw new CorpusGateError(`limit:lines:${basename(path)}`);
    let value: T | null = null;
    try {
      value = parser(JSON.parse(line.toString("utf8")) as unknown);
    } catch {
      throw new CorpusGateError(`schema:${basename(path)}`);
    }
    if (!value) throw new CorpusGateError(`schema:${basename(path)}`);
    rows.push(value);
  };
  hash.update(raw);
  let pending = raw;
  let newline = pending.indexOf(10);
  while (newline >= 0) {
    parseLine(pending.subarray(0, newline));
    pending = pending.subarray(newline + 1);
    newline = pending.indexOf(10);
  }
  if (pending.length) {
    if (pending.length > maxLineBytes) {
      throw new CorpusGateError(`limit:record:${basename(path)}`);
    }
    parseLine(pending);
  }
  return { rows, hash: hash.digest("hex") };
}

const RISK_TERMS = ["추락", "충돌", "끼임", "감전", "질식", "화재", "폭발", "붕괴", "낙하", "전도"];

function tokens(value: string): string[] {
  return [...new Set(normalizeText(value).toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/u)
    .filter((token) => token.length >= 2 && !["작업", "안전", "관리", "확인"].includes(token)))];
}

function buildRecord(item: RawItem, chunks: RawChunk[], snapshotId: string): KoshaGuideCorpusRecord {
  const normalizedBody = normalizeText(item.body);
  const validBody = Boolean(normalizedBody) && sha256(normalizedBody) === item.bodyHash;
  const official = item.officialProvenance;
  const validOfficialProvenance = official !== null
    && official.officialStatus === "current"
    && official.officialVersion === item.versionKey
    && official.pdfSha256 === item.rawSha256
    && official.bodySha256 === item.bodyHash;
  const anchors = chunks.slice(0, 8).map((chunk) => ({
    page: chunk.pageStart,
    excerpt: normalizeText(chunk.text).slice(0, 220)
  }));
  const searchText = normalizeText(`${item.title} ${item.category} ${normalizedBody}`);
  const controls = searchText.split(/(?<=[.!?다])\s+/u)
    .filter((sentence) => /설치|점검|차단|분리|배치|통제|착용|금지|확인/u.test(sentence))
    .slice(0, 2)
    .map((sentence) => sentence.slice(0, 180));
  const lifecycle = item.state === "current" ? "current" : item.state === "retired" ? "retired" : "stale";
  const quality = validBody
    && item.bodyOrigin === "native"
    && anchors.length > 0
    && lifecycle === "current"
    && validOfficialProvenance
    ? "accepted"
    : "review_required";
  return {
    referenceId: item.itemId.startsWith("kosha-") ? item.itemId : `kosha-${item.itemId}`,
    stableDocumentKey: item.stableKey,
    version: item.versionKey,
    itemType: item.itemType,
    title: item.title,
    category: item.category,
    nativeBody: normalizedBody,
    bodyKind: validBody && item.bodyOrigin === "native" ? "native" : "unknown",
    quality,
    provenance: {
      sourceId: item.sourceKey,
      generationId: snapshotId,
      generatedAt: "",
      lifecycle,
      chunkId: anchors.length ? chunks[0]?.chunkId ?? "" : "",
      bodyHash: item.bodyHash,
      officialUrl: official?.officialUrl ?? "",
      officialFileId: official?.officialFileId ?? "",
      publicationDate: official?.publicationDate ?? "",
      officialVersion: official?.officialVersion ?? "",
      officialStatus: "current",
      pdfHash: official?.pdfSha256 ?? ""
    },
    tags: {
      keywords: tokens(`${item.title} ${item.category}`).slice(0, 24),
      riskTags: RISK_TERMS.filter((term) => searchText.includes(term)),
      controls: controls.length ? controls : [anchors[0]?.excerpt ?? item.title],
      primaryDocuments: ["위험성평가표", "TBM 브리핑", "TBM 기록"]
    },
    anchors
  };
}

function validateSnapshot(current: CurrentSnapshot, manifest: ManifestSnapshot): void {
  if (current.snapshotId !== manifest.snapshotId || current.reproducibilityHash !== manifest.reproducibilityHash) throw new CorpusGateError("identity:snapshot");
  if (current.sourceIdentitySha256 !== manifest.sourceIdentitySha256) throw new CorpusGateError("identity:source");
  if (current.generationPolicySha256 !== manifest.generationPolicySha256) throw new CorpusGateError("identity:policy");
  if (manifest.computedGenerationPolicySha256 !== manifest.generationPolicySha256) {
    throw new CorpusGateError("identity:policy-content");
  }
  const identityPayload = {
    generator_source_sha256: manifest.generatorSourceSha256,
    generation_policy_sha256: manifest.generationPolicySha256,
    official_metadata_sha256: manifest.officialMetadataSha256,
    output_hashes: {
      "chunks.jsonl": manifest.hashes.chunks,
      "failures.jsonl": manifest.hashes.failures,
      "items.jsonl": manifest.hashes.items
    },
    source_identity_sha256: manifest.sourceIdentitySha256,
    source_snapshot_id: manifest.sourceSnapshotId,
    trusted_metadata_registry_sha256: manifest.trustedMetadataRegistrySha256
  };
  if (sha256(canonicalJson(identityPayload)) !== manifest.snapshotId) {
    throw new CorpusGateError("identity:snapshot-content");
  }
}

function validateReviewedOcrBindings(
  manifest: ManifestSnapshot,
  items: ReadonlyMap<string, RawItem>,
  chunksByItem: ReadonlyMap<string, RawChunk[]>,
  failedIds: ReadonlySet<string>
): void {
  const bindingsByItem = new Map<string, ReviewedOcrCandidateBinding>();
  for (const binding of manifest.reviewedOcrCandidates) {
    if (bindingsByItem.has(binding.itemId)) {
      throw new CorpusGateError(`ocr:binding:duplicate:${binding.itemId}`);
    }
    bindingsByItem.set(binding.itemId, binding);
  }
  for (const binding of manifest.reviewedOcrCandidates) {
    const item = items.get(binding.itemId);
    if (!item || item.bodyOrigin !== "human-reviewed-ocr") {
      throw new CorpusGateError(`ocr:binding:orphan:${binding.itemId}`);
    }
  }
  for (const item of items.values()) {
    if (item.bodyOrigin !== "human-reviewed-ocr") continue;
    const binding = bindingsByItem.get(item.itemId);
    if (!binding) throw new CorpusGateError(`ocr:binding:missing:${item.itemId}`);
    if (binding.candidateSha256 !== item.reviewedOcrCandidateSha256) {
      throw new CorpusGateError(`ocr:binding:mismatch:${item.itemId}`);
    }
    if (
      binding.contentSha256 !== item.reviewedOcrContentSha256 ||
      binding.attestationSha256 !== item.reviewedOcrAttestationSha256
    ) {
      throw new CorpusGateError(`ocr:binding:provenance-mismatch:${item.itemId}`);
    }
    if (failedIds.has(item.itemId)) throw new CorpusGateError(`ocr:item:failed:${item.itemId}`);
    const chunks = chunksByItem.get(item.itemId) ?? [];
    if (!chunks.some((chunk) => Boolean(normalizeText(chunk.text)))) {
      throw new CorpusGateError(`ocr:anchor:missing:${item.itemId}`);
    }
  }
}

async function loadUncached(
  rootDir: string,
  current: CurrentSnapshot,
  hooks: KoshaGuideCorpusLookup["testHooks"] | undefined,
  trustedOfficialMetadataSha256: readonly string[]
): Promise<KoshaGuideCorpusLoadResult> {
  uncachedLoads += 1;
  try {
    const manifestFile = await readJsonFile(rootDir, current.manifestPath, LIMITS.manifest, parseManifest, hooks);
    if (manifestFile.raw.length !== current.manifestSize || sha256(manifestFile.raw) !== current.manifestSha256) throw new CorpusGateError("hash:manifest");
    validateSnapshot(current, manifestFile.value);
    const prefix = current.snapshotPath;
    const [itemsFile, chunksFile, failuresFile] = await Promise.all([
      readJsonLines(rootDir, `${prefix}/items.jsonl`, LIMITS.items, LIMITS.itemLines, LIMITS.itemLine, parseItem, hooks),
      readJsonLines(rootDir, `${prefix}/chunks.jsonl`, LIMITS.chunks, LIMITS.chunkLines, LIMITS.chunkLine, parseChunk, hooks),
      readJsonLines(rootDir, `${prefix}/failures.jsonl`, LIMITS.failures, LIMITS.failureLines, LIMITS.failureLine, parseFailure, hooks)
    ]);
    const manifest = manifestFile.value;
    if (itemsFile.hash !== manifest.hashes.items || chunksFile.hash !== manifest.hashes.chunks || failuresFile.hash !== manifest.hashes.failures) throw new CorpusGateError("hash:outputs");

    const failedIds = new Set(failuresFile.rows.map((failure) => failure.itemId));
    const items = new Map<string, RawItem>();
    for (const item of itemsFile.rows) {
      if (items.has(item.itemId)) throw new CorpusGateError(`duplicate:item:${item.itemId}`);
      items.set(item.itemId, item);
    }
    const chunksByItem = new Map<string, RawChunk[]>();
    const chunkIds = new Set<string>();
    for (const chunk of chunksFile.rows) {
      if (chunkIds.has(chunk.chunkId)) throw new CorpusGateError(`duplicate:chunk:${chunk.chunkId}`);
      chunkIds.add(chunk.chunkId);
      if (!items.has(chunk.itemId)) throw new CorpusGateError(`orphan:chunk:${chunk.itemId}`);
      if (sha256(chunk.text) !== chunk.chunkHash) throw new CorpusGateError(`hash:chunk:${chunk.chunkId}`);
      const list = chunksByItem.get(chunk.itemId) ?? [];
      list.push(chunk);
      chunksByItem.set(chunk.itemId, list);
    }
    validateReviewedOcrBindings(manifest, items, chunksByItem, failedIds);
    const records = [...items.values()]
      .filter((item) => !failedIds.has(item.itemId))
      .map((item) => buildRecord(item, chunksByItem.get(item.itemId) ?? [], current.snapshotId));
    if (
      manifest.counts.inventory !== items.size + failuresFile.rows.length
      || manifest.counts.success !== records.length
      || manifest.counts.chunks !== chunksFile.rows.length
      || manifest.counts.failureLedger !== failuresFile.rows.length
    ) {
      throw new CorpusGateError("count:manifest");
    }
    const gate = manifest.launchGate;
    const coverage = manifest.coverageScope;
    if (!gate.launchReady) throw new CorpusGateError("gate:launch-not-ready");
    if (gate.failureCount > 0 || failuresFile.rows.length > 0 || coverage.rejectedCount > 0) {
      throw new CorpusGateError("gate:failures");
    }
    if (gate.partialCoverage || !coverage.complete || coverage.acceptedCount !== coverage.candidateCount) {
      throw new CorpusGateError("gate:partial-coverage");
    }
    if (!gate.provenanceComplete || records.some((record) => record.quality !== "accepted")) {
      throw new CorpusGateError("gate:provenance-incomplete");
    }
    if (
      manifest.sourceSnapshotId !== VERIFIED_SUBSET_CONTRACT.sourceSnapshotId
      || manifest.selection !== VERIFIED_SUBSET_CONTRACT.selection
      || coverage.scopeId !== VERIFIED_SUBSET_CONTRACT.scopeId
      || coverage.sourceInventoryCount !== VERIFIED_SUBSET_CONTRACT.sourceInventoryCount
      || coverage.candidateCount !== VERIFIED_SUBSET_CONTRACT.candidateCount
      || coverage.outOfScopeCount !== VERIFIED_SUBSET_CONTRACT.outOfScopeCount
      || coverage.itemTypes.length !== 1
      || coverage.itemTypes[0] !== "technical-support-regulation"
    ) {
      throw new CorpusGateError("gate:scope-contract");
    }
    if (
      !manifest.officialMetadataSha256
      || !trustedOfficialMetadataSha256.every(isSha256)
      || manifest.trustedMetadataRegistrySha256 !== sha256(JSON.stringify([...trustedOfficialMetadataSha256].sort()))
      || !trustedOfficialMetadataSha256.includes(manifest.officialMetadataSha256)
    ) {
      throw new CorpusGateError("gate:untrusted-official-metadata");
    }
    if (
      gate.failureCount !== manifest.counts.failureLedger
      || coverage.acceptedCount !== records.length
      || coverage.rejectedCount !== failuresFile.rows.length
      || coverage.candidateCount !== coverage.acceptedCount + coverage.rejectedCount
      || coverage.sourceInventoryCount !== coverage.candidateCount + coverage.outOfScopeCount
      || records.some((record) => !coverage.itemTypes.includes(record.itemType))
    ) {
      throw new CorpusGateError("gate:count-mismatch");
    }
    return {
      status: "ready",
      rootDir,
      manifestSha256: current.manifestSha256,
      snapshotId: current.snapshotId,
      inventoryCount: manifest.counts.inventory,
      itemCount: records.length,
      chunkCount: chunksFile.rows.length,
      failureCount: failuresFile.rows.length,
      coverageScope: coverage,
      records,
      indexedRecords: records.map((record) => ({
        record,
        tagText: normalizeText([record.title, record.category, ...record.tags.keywords, ...record.tags.riskTags, ...record.tags.controls].join(" ")).toLowerCase(),
        bodyText: record.nativeBody.toLowerCase()
      }))
    };
  } catch (error) {
    const code = error instanceof CorpusGateError ? error.code : "load:unexpected";
    return { status: "blocked", rootDir, failures: [code] };
  }
}

export async function loadKoshaGuideCorpus(options: KoshaGuideCorpusLookup = {}): Promise<KoshaGuideCorpusLoadResult> {
  const envRoot = options.env ? options.env.KOSHA_GUIDE_CORPUS_DIR : process.env.KOSHA_GUIDE_CORPUS_DIR;
  const configuredRoot = options.rootDir
    ?? (envRoot && envRoot.trim().length > 0
      ? envRoot
      : options.env
        ? undefined
        : DEFAULT_BUNDLED_KOSHA_GUIDE_CORPUS_DIR);
  if (!configuredRoot) return { status: "unconfigured", rootDir: null, failures: [] };
  let rootDir: string;
  try {
    rootDir = await realpath(resolve(configuredRoot));
    const currentFile = await readJsonFile(rootDir, "current.json", LIMITS.current, parseCurrent, options.testHooks);
    const current = currentFile.value;
    const trustedMetadata = options.testHooks?.trustedOfficialMetadataSha256
      ?? PRODUCTION_TRUSTED_OFFICIAL_METADATA_SHA256;
    const key = `${rootDir}|${current.snapshotId}|${current.manifestSha256}|${sha256(JSON.stringify([...trustedMetadata].sort()))}`;
    const cached = loadCache.get(key);
    if (cached) return cached;
    const promise = loadUncached(rootDir, current, options.testHooks, trustedMetadata);
    loadCache.set(key, promise);
    return await promise;
  } catch (error) {
    const code = error instanceof CorpusGateError ? error.code : "load:root";
    return { status: "blocked", rootDir: configuredRoot, failures: [code] };
  }
}

function directEligible(record: KoshaGuideCorpusRecord): boolean {
  return record.quality === "accepted"
    && record.bodyKind === "native"
    && record.provenance.lifecycle === "current"
    && record.anchors.length > 0
    && isOfficialKoshaUrl(record.provenance.officialUrl)
    && Boolean(record.provenance.officialFileId)
    && isIsoDate(record.provenance.publicationDate)
    && record.provenance.officialStatus === "current"
    && record.provenance.officialVersion === record.version
    && isSha256(record.provenance.pdfHash)
    && isSha256(record.provenance.bodyHash);
}

function evidenceRef(record: KoshaGuideCorpusRecord): string | null {
  if (record.bodyKind === "unknown") return null;
  const anchor = record.anchors[0];
  if (!anchor) return null;
  return `KOSHA 근거 ${record.version} p.${anchor.page}: ${anchor.excerpt}`;
}

export function searchKoshaGuideCorpus(
  corpus: KoshaGuideCorpusReady,
  query: string,
  limit: number,
  itemType?: string
): { retrievalMode: KoshaGuideOfflineRetrievalMode | null; items: KoshaGuideCorpusHit[] } {
  const queryTokens = tokens(query);
  const candidates = corpus.indexedRecords.filter(({ record }) => !itemType || record.itemType === itemType);
  const hits = candidates.map(({ record, tagText, bodyText }) => {
    const tagMatches = queryTokens.filter((token) => tagText.includes(token)).length;
    const bodyMatches = queryTokens.filter((token) => bodyText.includes(token)).length;
    const retrievalMode: KoshaGuideOfflineRetrievalMode = tagMatches && bodyMatches
      ? "local-hybrid"
      : bodyMatches
        ? "local-ranked"
        : "local-tag";
    return {
      referenceId: record.referenceId,
      stableDocumentKey: record.stableDocumentKey,
      retrievalMode,
      score: tagMatches * 5 + bodyMatches * 2 + (queryTokens.length ? 0 : 1),
      directEligible: directEligible(record),
      evidenceRef: evidenceRef(record),
      record
    };
  }).filter((hit) => !queryTokens.length || hit.score > 0)
    .sort((left, right) => right.score - left.score || left.referenceId.localeCompare(right.referenceId))
    .slice(0, Math.min(Math.max(limit, 1), 50));
  const retrievalMode = hits.some((hit) => hit.retrievalMode === "local-hybrid")
    ? "local-hybrid"
    : hits.some((hit) => hit.retrievalMode === "local-ranked")
      ? "local-ranked"
      : hits.length ? "local-tag" : null;
  return { retrievalMode, items: hits };
}

export function isKoshaGuideDirectEvidenceAccepted(record: KoshaGuideCorpusRecord): boolean {
  return directEligible(record);
}

export function resetKoshaGuideCorpusCacheForTests(): void {
  loadCache.clear();
  uncachedLoads = 0;
}

export function getKoshaGuideCorpusCacheStatsForTests(): { entries: number; uncachedLoads: number } {
  return { entries: loadCache.size, uncachedLoads };
}
