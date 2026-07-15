import { createHash } from "node:crypto";

import {
  buildSafetyReferenceOperationalMetadata,
  deriveSafetyReferenceOperationalView,
  filterAndRankSafetyReferencesByQuery,
  type SafetyReferenceItem
} from "@/lib/safety-reference-catalog";
import {
  buildDbHarnessAnswer,
  buildDbHarnessPacket,
  buildHarnessPromptContext
} from "@/lib/db-harness";

export const KOSHA_GUIDE_SOURCE_ID = "kosha-technical-support-regulations-2025";
export const KOSHA_GUIDE_OFFICIAL_DOWNLOAD_BASE = "https://portal.kosha.or.kr/openapi/v1/file/down";
export const KOSHA_AUDIT_REQUEST_TIMEOUT_MS = 20_000;
export const KOSHA_AUDIT_REQUEST_RETRIES = 1;

const KOSHA_BRIDGE_CANDIDATE_EXACT_PATHS = new Set([
  "data/safety-knowledge/kosha-body-corpus.schema.json",
  "lib/kosha-guide-corpus-audit.ts",
  "lib/kosha-guide-corpus.ts",
  "scripts/audit_kosha_guides.mjs",
  "scripts/recover_kosha_ocr_boundary.py",
  "scripts/snapshot_kosha_guide_corpus.py",
  "scripts/tests/test_recover_kosha_ocr_boundary.py",
  "scripts/tests/test_snapshot_kosha_guide_corpus.py",
  "tests/kosha-guide-corpus-audit.test.ts",
  "tests/kosha-guide-offline-harness.test.ts"
]);
const KOSHA_BRIDGE_EVALUATION_PREFIX =
  "evaluation/phase-a-kosha-reviewed-ocr-bridge-2026-07-13/";

const KOSHA_EVALUATION_BINARY_SIGNATURES: readonly {
  mimeType: string;
  signature: readonly number[];
}[] = [
  { mimeType: "image/png", signature: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { mimeType: "image/jpeg", signature: [0xff, 0xd8, 0xff] },
  { mimeType: "image/gif", signature: [0x47, 0x49, 0x46, 0x38, 0x37, 0x61] },
  { mimeType: "image/gif", signature: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61] },
  { mimeType: "application/pdf", signature: [0x25, 0x50, 0x44, 0x46, 0x2d] },
  { mimeType: "application/zip", signature: [0x50, 0x4b, 0x03, 0x04] },
  { mimeType: "application/zip", signature: [0x50, 0x4b, 0x05, 0x06] },
  { mimeType: "application/gzip", signature: [0x1f, 0x8b] },
  { mimeType: "application/x-7z-compressed", signature: [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c] },
  { mimeType: "application/x-ole-storage", signature: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] },
  { mimeType: "font/woff", signature: [0x77, 0x4f, 0x46, 0x46] },
  { mimeType: "font/woff2", signature: [0x77, 0x4f, 0x46, 0x32] },
  { mimeType: "font/ttf", signature: [0x00, 0x01, 0x00, 0x00] },
  { mimeType: "image/x-icon", signature: [0x00, 0x00, 0x01, 0x00] }
];

const KOSHA_EVALUATION_SAFE_DIGEST_LABELS = new Set([
  "body_sha256",
  "candidateattestationsha256",
  "candidatecontentsha256",
  "candidatefilesha256",
  "current_sha256",
  "currentsha256",
  "entry_manifest_sha256",
  "entrymanifestsha256",
  "generationpolicysha256",
  "identity_sha256",
  "manifest_sha256",
  "manifestsha256",
  "provenance_identity_sha256",
  "raw_sha256",
  "recomputedgenerationpolicysha256",
  "recomputedsourceidentitysha256",
  "recomputedsnapshotid",
  "recorder_sha256",
  "recordersha256",
  "reproducibility_hash",
  "resume_log_sha256",
  "resumelogsha256",
  "sha256",
  "snapshot_script_sha256",
  "snapshotid",
  "snapshotscriptsha256",
  "sourceidentitysha256"
]);

export type KoshaEvaluationArtifactViolation = {
  artifactPath: string;
  code:
    | "absolute-local-path"
    | "configured-secret-value"
    | "credential-assignment"
    | "raw-hmac-value"
    | "sensitive-digest-label"
    | "token-pattern";
  detail: string;
};

export type KoshaEvaluationArtifactScanInput = {
  artifactPath: string;
  text: string;
  repositoryRoots: readonly string[];
  configuredSecrets: Readonly<Record<string, string | undefined>>;
};

function normalizeCandidatePath(path: string): string {
  return path.replaceAll("\\", "/");
}

export function assertKoshaBridgeCandidatePaths(paths: readonly string[]): void {
  for (const originalPath of paths) {
    const path = normalizeCandidatePath(originalPath);
    const invalidShape =
      path.length === 0 ||
      path.startsWith("/") ||
      /^[A-Za-z]:\//u.test(path) ||
      path.split("/").includes("..");
    const allowed =
      KOSHA_BRIDGE_CANDIDATE_EXACT_PATHS.has(path) ||
      path.startsWith(KOSHA_BRIDGE_EVALUATION_PREFIX);
    if (invalidShape || !allowed) {
      throw new Error(`kosha-bridge-candidate-path-out-of-scope:${path}`);
    }
  }
}

function startsWithBytes(bytes: Uint8Array, signature: readonly number[]): boolean {
  return signature.length <= bytes.length && signature.every((value, index) => bytes[index] === value);
}

function identifyKoshaEvaluationBinaryMimeType(bytes: Uint8Array): string | null {
  const directMatch = KOSHA_EVALUATION_BINARY_SIGNATURES.find(({ signature }) =>
    startsWithBytes(bytes, signature)
  );
  if (directMatch) return directMatch.mimeType;
  const riffWebp =
    startsWithBytes(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    bytes.length >= 12 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50;
  return riffWebp ? "image/webp" : null;
}

export function decodeKoshaEvaluationArtifactText(
  artifactPath: string,
  bytes: Uint8Array
): string | null {
  let decoded: string;
  try {
    decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    if (identifyKoshaEvaluationBinaryMimeType(bytes)) return null;
    throw new Error(`kosha-evaluation-artifact-invalid-utf8:${artifactPath}`);
  }
  if (identifyKoshaEvaluationBinaryMimeType(bytes)) return null;
  if (decoded.includes("\u0000")) {
    throw new Error(`kosha-evaluation-artifact-invalid-utf8:${artifactPath}`);
  }
  return decoded;
}

function normalizedPathText(value: string): string {
  return value
    .replaceAll("\\\\", "//")
    .replaceAll("\\/", "/")
    .replaceAll("\\", "/")
    .toLowerCase();
}

function containsUncPath(value: string): boolean {
  const separatorCode = 92;
  const allowedPrefix = new Set([" ", "\t", "\r", "\n", "\"", "'", "(", "=", ":", ","]);
  const segmentCharacter = (character: string): boolean => /[A-Za-z0-9._$-]/u.test(character);
  for (let index = 0; index + 1 < value.length; index += 1) {
    if (value.charCodeAt(index) !== separatorCode || value.charCodeAt(index + 1) !== separatorCode) {
      continue;
    }
    if (index > 0 && !allowedPrefix.has(value[index - 1] || "")) continue;
    let cursor = index + 2;
    while (value.charCodeAt(cursor) === separatorCode) cursor += 1;
    const serverStart = cursor;
    while (cursor < value.length && segmentCharacter(value[cursor] || "")) cursor += 1;
    if (cursor === serverStart || value.charCodeAt(cursor) !== separatorCode) continue;
    while (value.charCodeAt(cursor) === separatorCode) cursor += 1;
    const shareStart = cursor;
    while (cursor < value.length && segmentCharacter(value[cursor] || "")) cursor += 1;
    if (cursor > shareStart) return true;
  }
  return false;
}

function addEvaluationViolation(
  violations: KoshaEvaluationArtifactViolation[],
  violation: KoshaEvaluationArtifactViolation
): void {
  const duplicate = violations.some((candidate) =>
    candidate.code === violation.code && candidate.detail === violation.detail
  );
  if (!duplicate) violations.push(violation);
}

export function scanKoshaEvaluationArtifactText(
  input: KoshaEvaluationArtifactScanInput
): KoshaEvaluationArtifactViolation[] {
  const violations: KoshaEvaluationArtifactViolation[] = [];
  const normalizedText = normalizedPathText(input.text);
  const drivePath = /(?:^|[\s"'(=])(?:file:\/{2,})?[a-z]:\/+[^\s"'<>]+/iu;
  const posixPath = /(?:^|[\s"'(=])\/(?:builds|etc|exports|github|home|mnt|opt|private|root|runner|srv|tmp|users|var|volumes|workspace|workspaces)\/+[^\s"'<>]+/iu;
  const repositoryPathPresent = input.repositoryRoots.some((root) => {
    const normalizedRoot = normalizedPathText(root).replace(/\/+$/u, "");
    return normalizedRoot.length > 2 && normalizedText.includes(normalizedRoot);
  });
  if (
    drivePath.test(normalizedText) ||
    containsUncPath(input.text) ||
    posixPath.test(normalizedText) ||
    repositoryPathPresent
  ) {
    addEvaluationViolation(violations, {
      artifactPath: input.artifactPath,
      code: "absolute-local-path",
      detail: "local-path"
    });
  }

  const tokenPatterns: readonly RegExp[] = [
    /\bsk-(?:proj-)?[A-Za-z0-9_-]{16,}\b/gu,
    /\bsb_secret_[A-Za-z0-9_-]{16,}\b/gu,
    /\bBearer\s+[A-Za-z0-9._~+/=-]{16,}\b/giu,
    /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/gu
  ];
  if (tokenPatterns.some((pattern) => pattern.test(input.text))) {
    addEvaluationViolation(violations, {
      artifactPath: input.artifactPath,
      code: "token-pattern",
      detail: "token"
    });
  }

  const safeAssignmentValues = new Set([
    "absent",
    "false",
    "null",
    "present",
    "redacted",
    "true",
    "undefined"
  ]);
  const credentialAssignmentPattern = /\b([A-Za-z][A-Za-z0-9_]*(?:api_key|service_role_key|anon_key|hmac_key|access_token|auth_token|password|secret|token))\b["']?\s*[:=]\s*["']?([^\s"',}\]]+)/giu;
  for (const match of input.text.matchAll(credentialAssignmentPattern)) {
    const value = match[2]?.replace(/[;.]$/u, "") || "";
    const normalizedValue = value.toLowerCase();
    const placeholder = value.startsWith("<") || value.startsWith("${");
    if (value.length >= 8 && !placeholder && !safeAssignmentValues.has(normalizedValue)) {
      addEvaluationViolation(violations, {
        artifactPath: input.artifactPath,
        code: "credential-assignment",
        detail: match[1] || "credential"
      });
    }
  }

  const hmacPattern = /\b(?:signature_hmac_sha256|review_hmac|hmac(?:_key|_sha256)?)\b["']?\s*[:,=]\s*["']?([A-Fa-f0-9]{64}|[A-Za-z0-9+/]{40,}={0,2})\b/giu;
  if (hmacPattern.test(input.text)) {
    addEvaluationViolation(violations, {
      artifactPath: input.artifactPath,
      code: "raw-hmac-value",
      detail: "hmac"
    });
  }

  const digestLabelPattern = /\b([A-Za-z][A-Za-z0-9_-]*(?:sha256|digest|hash))\b["']?\s*[:,=]\s*["']?([A-Fa-f0-9]{64}|[A-Za-z0-9+/]{40,}={0,2})\b/giu;
  for (const match of input.text.matchAll(digestLabelPattern)) {
    const label = match[1] || "digest";
    const normalizedLabel = label.toLowerCase();
    const compactLabel = normalizedLabel.replaceAll("-", "").replaceAll("_", "");
    const explicitlySafe =
      KOSHA_EVALUATION_SAFE_DIGEST_LABELS.has(normalizedLabel) ||
      KOSHA_EVALUATION_SAFE_DIGEST_LABELS.has(compactLabel);
    const sensitive = /secret|hmac|token|credential|password|apikey|servicerole/u.test(compactLabel);
    if (sensitive && !explicitlySafe) {
      addEvaluationViolation(violations, {
        artifactPath: input.artifactPath,
        code: "sensitive-digest-label",
        detail: label
      });
    }
  }

  for (const [name, value] of Object.entries(input.configuredSecrets)) {
    if (value && value.length >= 8 && input.text.includes(value)) {
      addEvaluationViolation(violations, {
        artifactPath: input.artifactPath,
        code: "configured-secret-value",
        detail: name
      });
    }
  }

  return violations;
}

export type KoshaJsonResponse = {
  ok: boolean;
  status: number;
  headers: Headers;
  json: () => Promise<unknown>;
};

export type KoshaJsonFetch = (
  input: string | URL,
  init?: RequestInit
) => Promise<KoshaJsonResponse>;

export type KoshaJsonFetchOptions = {
  timeoutMs?: number;
  retries?: number;
  fetchImpl?: KoshaJsonFetch;
};

export type KoshaHeadersResponse = {
  ok: boolean;
  status: number;
  headers: Headers;
};

export type KoshaHeadersFetch = (
  input: string | URL,
  init?: RequestInit
) => Promise<KoshaHeadersResponse>;

export type KoshaHeadersFetchOptions = {
  timeoutMs?: number;
  retries?: number;
  fetchImpl?: KoshaHeadersFetch;
};

export async function fetchKoshaJsonWithRetry(
  input: string | URL,
  init: RequestInit,
  label: string,
  options: KoshaJsonFetchOptions = {}
): Promise<{ response: KoshaJsonResponse; payload: unknown; attemptCount: number }> {
  const timeoutMs = options.timeoutMs ?? KOSHA_AUDIT_REQUEST_TIMEOUT_MS;
  const retries = options.retries ?? KOSHA_AUDIT_REQUEST_RETRIES;
  const fetchImpl: KoshaJsonFetch = options.fetchImpl || ((fetchInput, fetchInit) => fetch(fetchInput, fetchInit));
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(input, {
        cache: "no-store",
        ...init,
        signal: controller.signal
      });
      if (response.status >= 500 && attempt < retries) {
        lastError = new Error(`${label} returned HTTP ${response.status}`);
        continue;
      }
      const payload = await response.json();
      return { response, payload, attemptCount: attempt + 1 };
    } catch (error) {
      lastError = error;
      if (attempt === retries) break;
    } finally {
      clearTimeout(timeout);
    }
  }

  const reason = lastError instanceof Error ? lastError.message : String(lastError || "unknown error");
  throw new Error(`${label} failed after ${retries + 1} attempts: ${reason}`);
}

export async function fetchHeadersWithRetry(
  input: string | URL,
  init: RequestInit,
  label: string,
  options: KoshaHeadersFetchOptions = {}
): Promise<KoshaHeadersResponse> {
  const timeoutMs = options.timeoutMs ?? KOSHA_AUDIT_REQUEST_TIMEOUT_MS;
  const retries = options.retries ?? KOSHA_AUDIT_REQUEST_RETRIES;
  const fetchImpl: KoshaHeadersFetch = options.fetchImpl || ((fetchInput, fetchInit) =>
    fetch(fetchInput, fetchInit));
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(input, {
        cache: "no-store",
        ...init,
        signal: controller.signal
      });
      if (response.status < 500 || attempt === retries) return response;
      lastError = new Error(`${label} returned HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
      if (attempt === retries) break;
    } finally {
      clearTimeout(timeout);
    }
  }

  const reason = lastError instanceof Error ? lastError.message : String(lastError || "unknown error");
  throw new Error(`${label} failed after ${retries + 1} attempts: ${reason}`);
}

export type KoshaGuideItemType = "technical-guideline" | "technical-support-regulation";

export type KoshaArchiveEntry = {
  zipFile: string;
  internalPath: string;
  crc32: string;
  compressedSize: number;
  fileSize: number;
  itemType: KoshaGuideItemType;
};

export type KoshaArchiveInventory = {
  archiveCount: number;
  archiveNames: string[];
  pdfEntryCount: number;
  itemTypes: Record<KoshaGuideItemType, number>;
  entryManifestSha256: string;
  emptyPdfEntryCount: number;
  duplicateInternalPathGroups: number;
  duplicateContentCandidateGroups: number;
  duplicateContentCandidateRows: number;
  missingVersionCodeCount: number;
};

export type KoshaSupabaseVisibleExpectation = {
  sourceId: string;
  rowCount: number;
  itemTypes: Record<KoshaGuideItemType, number>;
  canonicalRowSha256?: string | null;
};

export type KoshaParseStatsExpectation = {
  rowsReturned: number;
  parseAttemptedCount: number;
  parseSuccessCount: number;
  parseEmptyOutputCount: number;
  parseFailureCount: number;
  parseNotAttemptedCount: number;
  accountingMatches: boolean;
};

export type KoshaGuideAuditManifest = {
  version: 1;
  measuredAt: string;
  localArchive: Pick<
    KoshaArchiveInventory,
    "archiveCount" | "pdfEntryCount" | "entryManifestSha256" | "itemTypes"
  >;
  localParse?: KoshaParseStatsExpectation;
  supabaseVisible: KoshaSupabaseVisibleExpectation;
  officialSnapshot?: KoshaOfficialSnapshotExpectation;
};

export type KoshaOfficialSnapshotExpectation = {
  currentCount: number;
  currentCanonicalSha256: string;
  retiredCount: number;
  retiredCanonicalSha256: string;
};

export type KoshaAuditCheck = {
  id: string;
  status: "pass" | "fail" | "boundary";
  count: number;
  detail: string;
};

export type KoshaOfficialGuideRecord = {
  code: string;
  stableKey: string;
  title: string;
  category: string;
  field: string;
  status: string;
  publishedAt: string | null;
  fileId: string | null;
  fileSeq: number | null;
};

export type KoshaGuideRowAudit = {
  rowCount: number;
  sourceIds: string[];
  itemTypes: Record<string, number>;
  emptyBodyCount: number;
  emptySummaryCount: number;
  emptyControlsCount: number;
  duplicateIdGroups: number;
  duplicateTitleGroups: number;
  duplicateSummaryGroups: number;
  duplicateSummaryRows: number;
  templatedFallbackSummaryGroups: number;
  templatedFallbackSummaryRows: number;
  nonTemplateDuplicateSummaryGroups: number;
  nonTemplateDuplicateSummaryRows: number;
  duplicateSummaryDetails: Array<{
    summary: string;
    rowCount: number;
    sampleIds: string[];
    templateFallback: boolean;
    nonEmptyBodyRows: number;
  }>;
  exactBodyDuplicateCandidateGroups: number;
  exactBodyDuplicateCandidateRows: number;
  missingSourceUrlCount: number;
  missingOfficialFileIdCount: number;
  missingOfficialPublishedAtCount: number;
  missingOfficialStatusCount: number;
  missingVersionCodeCount: number;
  rawTagStandaloneControlLeakCount: number;
  rawInitialControlContaminationCount: number;
  rawControlContaminationCount: number;
  rawControlGroundTruthClearedCount: number;
  rawControlReviewRequiredCount: number;
  rawControlHeuristicDeltaFlagCount: number;
  operationalInitialControlContaminationCount: number;
  operationalControlContaminationCount: number;
  operationalControlGroundTruthClearedCount: number;
  operationalControlReviewRequiredCount: number;
  operationalControlHeuristicDeltaFlagCount: number;
  sourceMutationCount: number;
  rawInitialControlContaminationRows: Array<{
    id: string;
    title: string;
    flags: string[];
    controls: string[];
  }>;
  rawControlContaminationRows: Array<{
    id: string;
    title: string;
    flags: string[];
    controls: string[];
  }>;
  operationalInitialControlContaminationRows: Array<{
    id: string;
    title: string;
    flags: string[];
    controls: string[];
  }>;
  operationalControlContaminationRows: Array<{
    id: string;
    title: string;
    flags: string[];
    controls: string[];
  }>;
  rawControlGroundTruthClearedRows: Array<{
    id: string;
    title: string;
    initialFlags: string[];
    removedFlags: string[];
  }>;
  rawControlReviewRequiredRows: Array<{
    id: string;
    title: string;
    initialFlags: string[];
    removedFlags: string[];
    unlabelledFlags: string[];
  }>;
  operationalControlGroundTruthClearedRows: Array<{
    id: string;
    title: string;
    initialFlags: string[];
    removedFlags: string[];
  }>;
  operationalControlReviewRequiredRows: Array<{
    id: string;
    title: string;
    initialFlags: string[];
    removedFlags: string[];
    unlabelledFlags: string[];
  }>;
};

export type KoshaControlGroundTruthLabels = Record<
  string,
  Record<string, "false-positive" | "confirmed-contamination">
>;

export type KoshaRetrievalScenario = {
  id: string;
  query: string;
  expectedCodes: string[];
  requiredControlTerms: string[];
  forbiddenTerms: string[];
};

export type KoshaRetrievalBranch = NonNullable<SafetyReferenceItem["retrieval_source"]>;

export type KoshaRetrievalScenarioAudit = {
  scenarioId: string;
  branch: KoshaRetrievalBranch;
  executionStatus: "tested" | "untested";
  selectedIds: string[];
  selectedTitles: string[];
  retrievalSources: KoshaRetrievalBranch[];
  promptContext: string;
  answer: string;
  documentReflections: Array<{
    code: string | null;
    title: string;
    documents: string[];
    label: string;
  }>;
  failures: string[];
};

export type KoshaVisibleStatus = KoshaSupabaseVisibleExpectation & {
  ok: true;
  configured: true;
  catalogStatus: string;
  totalSources: number;
  totalItems: number;
  sampleCount: number;
  fullRowSnapshotAvailable: false;
  canonicalRowSha256: null;
};

export type KoshaBridgeSnapshotIntegrity = {
  currentSchemaVersion: string;
  currentSnapshotId: string;
  currentReproducibilityHash: string;
  currentSourceIdentitySha256: string;
  currentGenerationPolicySha256: string;
  manifestSchemaVersion: string;
  manifestSnapshotId: string;
  manifestReproducibilityHash: string;
  manifestSourceIdentity: unknown;
  manifestSourceIdentitySha256: string;
  manifestGenerationPolicy: unknown;
  manifestGenerationPolicySha256: string;
  currentManifestSha256: string;
  manifestFileSha256: string;
  manifestItemsSha256: string;
  itemsFileSha256: string;
  manifestChunksSha256: string;
  chunksFileSha256: string;
  manifestOutputHashes: unknown;
  snapshotOutputHashes: unknown;
};

export type KoshaReviewedCandidateBridgeInput = {
  candidateBytes: Uint8Array;
  candidateFileSha256: string;
  candidateContentSha256: string;
  candidateAttestationSha256: string;
};

export type KoshaProductionLocalBridgeInput = {
  productionRows: unknown[];
  localItems: unknown[];
  localChunks: unknown[];
  reviewedCandidates?: KoshaReviewedCandidateBridgeInput[];
  snapshot: KoshaBridgeSnapshotIntegrity;
};

export type KoshaProductionLocalBridgeCandidateIdentity = {
  schemaVersion: "safeclaw-kosha-production-local-bridge-candidate/v2";
  production: {
    id: string;
    sourceId: string;
    tuple: { zipFile: string; internalPath: string };
  };
  local: {
    snapshotId: string;
    itemId: string;
    rawSha256: string;
    itemSha256: string;
  };
  candidateFileSha256: string | null;
  candidateContentSha256: string | null;
  candidateAttestationSha256: string | null;
  chunks: Array<{
    chunkId: string;
    sha256: string;
    pageStart: number;
    pageEnd: number;
  }>;
  humanConfirmation: "pending";
  readOnly: true;
  dbMutationPerformed: false;
  launchReadiness: false;
};

export type KoshaProductionLocalBridgeCandidate = KoshaProductionLocalBridgeCandidateIdentity & {
  reproducibilityHash: string;
};

export const KOSHA_GUIDE_REFRESH_PLAN = {
  mode: "read-only-plan",
  mutationPerformed: false,
  checkpointField: "publishedAt",
  shardKeys: ["category", "status", "page"],
  emptyResponsePolicy: "reject-empty-page-and-empty-file-provenance",
  reconciliation: "full-stable-key-current-vs-retired",
  stableDocumentKey: "normalized-guide-code-without-year",
  versionKey: "normalized-full-guide-code",
  contentKey: "sha256-official-pdf-bytes",
  retry: {
    timeoutMs: 20_000,
    retries: 1
  },
  dryRunDiffs: ["insert", "update", "retire", "unchanged"],
  approvalRequiredBeforeMutation: true
} as const;

function codepointCompare(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/gu, " ").trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readNonNegativeInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

function isSha256(value: string): boolean {
  return /^[0-9a-f]{64}$/u.test(value);
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort(codepointCompare)
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }
  const encoded = JSON.stringify(value);
  if (encoded === undefined) throw new Error("kosha-bridge-candidate-content-invalid");
  return encoded;
}

function corpusBodySha256(value: unknown): string {
  const body = typeof value === "string" ? value : "";
  return createHash("sha256")
    .update(body.normalize("NFKC").replace(/\s+/gu, " ").trim())
    .digest("hex");
}

const KOSHA_BODY_CURRENT_SCHEMA_VERSION = "safeclaw-kosha-body-current/v1";
const KOSHA_BODY_CORPUS_SCHEMA_VERSION = "safeclaw-kosha-body-corpus/v2";
const KOSHA_SNAPSHOT_OUTPUT_FILES = [
  "items.jsonl",
  "chunks.jsonl",
  "failures.jsonl",
  "checkpoint.json"
] as const;

function canonicalSha256(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function readSnapshotOutputHashes(value: unknown, label: "manifest" | "snapshot"): Record<string, string> {
  if (!isRecord(value)) throw new Error(`kosha-bridge-${label}-output-hashes-invalid`);
  const expectedKeys = [...KOSHA_SNAPSHOT_OUTPUT_FILES].sort(codepointCompare);
  const actualKeys = Object.keys(value).sort(codepointCompare);
  if (
    actualKeys.length !== expectedKeys.length ||
    actualKeys.some((key, index) => key !== expectedKeys[index])
  ) {
    throw new Error(`kosha-bridge-${label}-output-hash-set-mismatch`);
  }
  const outputHashes: Record<string, string> = {};
  for (const name of KOSHA_SNAPSHOT_OUTPUT_FILES) {
    const digest = readString(value[name]);
    if (!isSha256(digest)) {
      throw new Error(`kosha-bridge-${label}-output-hash-invalid:${name}`);
    }
    outputHashes[name] = digest;
  }
  return outputHashes;
}

export function verifyKoshaBridgeSnapshotIntegrity(
  snapshot: KoshaBridgeSnapshotIntegrity
): void {
  if (snapshot.currentSchemaVersion !== KOSHA_BODY_CURRENT_SCHEMA_VERSION) {
    throw new Error("kosha-bridge-current-schema-version-mismatch");
  }
  if (snapshot.manifestSchemaVersion !== KOSHA_BODY_CORPUS_SCHEMA_VERSION) {
    throw new Error("kosha-bridge-manifest-schema-version-mismatch");
  }
  if (!isRecord(snapshot.manifestSourceIdentity)) {
    throw new Error("kosha-bridge-manifest-source-identity-mismatch");
  }
  const sourceIdentityMaterial = Object.fromEntries(
    Object.entries(snapshot.manifestSourceIdentity).filter(([key]) => key !== "identity_sha256")
  );
  const recomputedSourceIdentitySha256 = canonicalSha256(sourceIdentityMaterial);
  const embeddedSourceIdentitySha256 = readString(
    snapshot.manifestSourceIdentity.identity_sha256
  );
  if (
    !isSha256(snapshot.manifestSourceIdentitySha256) ||
    !isSha256(embeddedSourceIdentitySha256) ||
    snapshot.manifestSourceIdentitySha256 !== embeddedSourceIdentitySha256 ||
    snapshot.manifestSourceIdentitySha256 !== recomputedSourceIdentitySha256
  ) {
    throw new Error("kosha-bridge-manifest-source-identity-mismatch");
  }
  if (
    !isSha256(snapshot.currentSourceIdentitySha256) ||
    snapshot.currentSourceIdentitySha256 !== recomputedSourceIdentitySha256
  ) {
    throw new Error("kosha-bridge-source-identity-mismatch");
  }

  if (!isRecord(snapshot.manifestGenerationPolicy)) {
    throw new Error("kosha-bridge-manifest-generation-policy-hash-mismatch");
  }
  const recomputedGenerationPolicySha256 = canonicalSha256(
    snapshot.manifestGenerationPolicy
  );
  if (
    !isSha256(snapshot.manifestGenerationPolicySha256) ||
    snapshot.manifestGenerationPolicySha256 !== recomputedGenerationPolicySha256
  ) {
    throw new Error("kosha-bridge-manifest-generation-policy-hash-mismatch");
  }
  if (
    !isSha256(snapshot.currentGenerationPolicySha256) ||
    snapshot.currentGenerationPolicySha256 !== recomputedGenerationPolicySha256
  ) {
    throw new Error("kosha-bridge-generation-policy-identity-mismatch");
  }

  const snapshotIds = [
    snapshot.currentSnapshotId,
    snapshot.currentReproducibilityHash,
    snapshot.manifestSnapshotId,
    snapshot.manifestReproducibilityHash
  ];
  if (!snapshotIds.every(isSha256) || new Set(snapshotIds).size !== 1) {
    throw new Error("kosha-bridge-snapshot-id-mismatch");
  }
  if (
    !isSha256(snapshot.currentManifestSha256) ||
    !isSha256(snapshot.manifestFileSha256) ||
    snapshot.currentManifestSha256 !== snapshot.manifestFileSha256
  ) {
    throw new Error("kosha-bridge-manifest-hash-mismatch");
  }
  if (
    !isSha256(snapshot.manifestItemsSha256) ||
    !isSha256(snapshot.itemsFileSha256) ||
    snapshot.manifestItemsSha256 !== snapshot.itemsFileSha256
  ) {
    throw new Error("kosha-bridge-items-hash-mismatch");
  }
  if (
    !isSha256(snapshot.manifestChunksSha256) ||
    !isSha256(snapshot.chunksFileSha256) ||
    snapshot.manifestChunksSha256 !== snapshot.chunksFileSha256
  ) {
    throw new Error("kosha-bridge-chunks-hash-mismatch");
  }

  const manifestOutputHashes = readSnapshotOutputHashes(
    snapshot.manifestOutputHashes,
    "manifest"
  );
  const snapshotOutputHashes = readSnapshotOutputHashes(
    snapshot.snapshotOutputHashes,
    "snapshot"
  );
  for (const name of KOSHA_SNAPSHOT_OUTPUT_FILES) {
    if (manifestOutputHashes[name] !== snapshotOutputHashes[name]) {
      throw new Error(`kosha-bridge-output-hash-mismatch:${name}`);
    }
  }
  if (
    manifestOutputHashes["items.jsonl"] !== snapshot.manifestItemsSha256 ||
    snapshotOutputHashes["items.jsonl"] !== snapshot.itemsFileSha256
  ) {
    throw new Error("kosha-bridge-items-hash-mismatch");
  }
  if (
    manifestOutputHashes["chunks.jsonl"] !== snapshot.manifestChunksSha256 ||
    snapshotOutputHashes["chunks.jsonl"] !== snapshot.chunksFileSha256
  ) {
    throw new Error("kosha-bridge-chunks-hash-mismatch");
  }

  const recomputedReproducibilityHash = canonicalSha256({
    schema_version: snapshot.manifestSchemaVersion,
    source_identity_sha256: recomputedSourceIdentitySha256,
    generation_policy_sha256: recomputedGenerationPolicySha256,
    output_hashes: snapshotOutputHashes
  });
  if (snapshotIds[0] !== recomputedReproducibilityHash) {
    throw new Error("kosha-bridge-reproducibility-hash-mismatch");
  }
}

type InspectedKoshaReviewedCandidate = {
  payload: Record<string, unknown>;
  review: Record<string, unknown>;
  candidateFileSha256: string;
  candidateContentSha256: string;
  candidateAttestationSha256: string;
};

function inspectKoshaReviewedCandidateBytes(
  candidateBytes: Uint8Array
): InspectedKoshaReviewedCandidate {
  if (!(candidateBytes instanceof Uint8Array) || candidateBytes.byteLength === 0) {
    throw new Error("kosha-bridge-reviewed-candidate-bytes-invalid");
  }
  const candidateFileSha256 = createHash("sha256").update(candidateBytes).digest("hex");
  let parsed: unknown;
  try {
    const candidateJson = new TextDecoder("utf-8", { fatal: true }).decode(candidateBytes);
    parsed = JSON.parse(candidateJson) as unknown;
  } catch (error) {
    throw new Error("kosha-bridge-reviewed-candidate-json-invalid", { cause: error });
  }
  if (!isRecord(parsed)) throw new Error("kosha-bridge-reviewed-candidate-json-invalid");
  if (!isRecord(parsed.review)) throw new Error("kosha-bridge-reviewed-candidate-review-invalid");
  const immutableContent = Object.fromEntries(
    Object.entries(parsed).filter(([key]) => key !== "review")
  );
  return {
    payload: parsed,
    review: parsed.review,
    candidateFileSha256,
    candidateContentSha256: canonicalSha256(immutableContent),
    candidateAttestationSha256: canonicalSha256(parsed.review)
  };
}

export function prepareKoshaReviewedCandidateBridgeInput(
  candidateBytes: Uint8Array
): KoshaReviewedCandidateBridgeInput {
  const inspected = inspectKoshaReviewedCandidateBytes(candidateBytes);
  return {
    candidateBytes: Uint8Array.from(candidateBytes),
    candidateFileSha256: inspected.candidateFileSha256,
    candidateContentSha256: inspected.candidateContentSha256,
    candidateAttestationSha256: inspected.candidateAttestationSha256
  };
}

function verifyKoshaReviewedCandidateBridgeInput(
  input: KoshaReviewedCandidateBridgeInput
): InspectedKoshaReviewedCandidate {
  const inspected = inspectKoshaReviewedCandidateBytes(input.candidateBytes);
  if (!isSha256(input.candidateFileSha256)) {
    throw new Error("kosha-bridge-reviewed-candidate-file-hash-invalid");
  }
  if (input.candidateFileSha256 !== inspected.candidateFileSha256) {
    throw new Error("kosha-bridge-reviewed-candidate-file-hash-mismatch");
  }
  if (!isSha256(input.candidateContentSha256)) {
    throw new Error("kosha-bridge-reviewed-candidate-content-hash-invalid");
  }
  if (input.candidateContentSha256 !== inspected.candidateContentSha256) {
    throw new Error("kosha-bridge-reviewed-candidate-content-hash-mismatch");
  }
  if (!isSha256(input.candidateAttestationSha256)) {
    throw new Error("kosha-bridge-reviewed-candidate-attestation-hash-invalid");
  }
  if (input.candidateAttestationSha256 !== inspected.candidateAttestationSha256) {
    throw new Error("kosha-bridge-reviewed-candidate-attestation-hash-mismatch");
  }
  const declaredContentSha256 = readString(inspected.review.content_sha256);
  if (declaredContentSha256 && !isSha256(declaredContentSha256)) {
    throw new Error("kosha-bridge-reviewed-candidate-content-hash-invalid");
  }
  if (declaredContentSha256 && declaredContentSha256 !== inspected.candidateContentSha256) {
    throw new Error("kosha-bridge-reviewed-candidate-content-hash-mismatch");
  }
  if (
    inspected.review.state === "verified" &&
    inspected.review.human_confirmed === true &&
    !declaredContentSha256
  ) {
    throw new Error("kosha-bridge-reviewed-candidate-content-hash-invalid");
  }
  return inspected;
}

export function buildKoshaProductionLocalBridgeCandidate(
  input: KoshaProductionLocalBridgeInput
): KoshaProductionLocalBridgeCandidate {
  verifyKoshaBridgeSnapshotIntegrity(input.snapshot);
  if (input.productionRows.length !== 1) {
    throw new Error(`kosha-bridge-production-match-count:${input.productionRows.length}`);
  }
  const production = input.productionRows[0];
  if (!isRecord(production)) throw new Error("kosha-bridge-production-row-invalid");
  const productionId = readString(production.id);
  const productionSourceId = readString(production.source_id);
  if (!productionId || !productionSourceId) {
    throw new Error("kosha-bridge-production-identity-missing");
  }
  const payload = isRecord(production.payload) ? production.payload : null;
  const zipFile = payload?.zipFile;
  const internalPath = payload?.internalPath;
  if (typeof zipFile !== "string" || !zipFile || typeof internalPath !== "string" || !internalPath) {
    throw new Error("kosha-bridge-production-tuple-missing");
  }

  const localMatches = input.localItems.filter((item): item is Record<string, unknown> =>
    isRecord(item) && item.source_zip === zipFile && item.source_member === internalPath
  );
  if (localMatches.length !== 1) {
    throw new Error(`kosha-bridge-local-match-count:${localMatches.length}`);
  }
  const localItem = localMatches[0];
  const itemId = readString(localItem.item_id);
  const rawSha256 = readString(localItem.raw_sha256).toLowerCase();
  const itemSha256 = readString(localItem.normalized_text_sha256).toLowerCase();
  if (!itemId) throw new Error("kosha-bridge-local-item-id-missing");
  if (!isSha256(rawSha256)) throw new Error("kosha-bridge-local-raw-hash-invalid");
  if (!isSha256(itemSha256)) throw new Error("kosha-bridge-local-item-hash-invalid");
  if (corpusBodySha256(localItem.body) !== itemSha256) {
    throw new Error("kosha-bridge-local-item-hash-mismatch");
  }

  const chunks: KoshaProductionLocalBridgeCandidate["chunks"] = [];
  const allChunkIds = new Set<string>();
  for (const chunk of input.localChunks) {
    if (!isRecord(chunk)) continue;
    const chunkId = readString(chunk.chunk_id);
    if (chunkId) {
      if (allChunkIds.has(chunkId)) throw new Error(`kosha-bridge-duplicate-chunk-id:${chunkId}`);
      allChunkIds.add(chunkId);
    }
    const carriesProductionTuple = chunk.source_zip === zipFile && chunk.source_member === internalPath;
    if (carriesProductionTuple && chunk.item_id !== itemId) {
      throw new Error(`kosha-bridge-chunk-item-mismatch:${chunkId || "missing"}`);
    }
    if (chunk.item_id !== itemId) continue;
    if (!chunkId) throw new Error("kosha-bridge-chunk-id-missing");
    if (!carriesProductionTuple) {
      throw new Error(`kosha-bridge-chunk-tuple-mismatch:${chunkId}`);
    }
    const sha256 = readString(chunk.chunk_sha256).toLowerCase();
    if (!isSha256(sha256)) throw new Error(`kosha-bridge-chunk-hash-invalid:${chunkId}`);
    const chunkText = typeof chunk.text === "string" ? chunk.text : "";
    const chunkContentSha256 = createHash("sha256").update(chunkText).digest("hex");
    if (!chunkText || chunkContentSha256 !== sha256) {
      throw new Error(`kosha-bridge-chunk-content-hash-mismatch:${chunkId}`);
    }
    const pageStart = readNonNegativeInteger(chunk.page_start) ?? 0;
    const pageEnd = readNonNegativeInteger(chunk.page_end) ?? 0;
    if (pageStart < 1 || pageEnd < pageStart) {
      throw new Error(`kosha-bridge-chunk-page-range-invalid:${chunkId}`);
    }
    chunks.push({ chunkId, sha256, pageStart, pageEnd });
  }
  chunks.sort((left, right) =>
    left.pageStart - right.pageStart ||
    left.pageEnd - right.pageEnd ||
    codepointCompare(left.chunkId, right.chunkId)
  );

  const reviewedCandidates = (input.reviewedCandidates || []).map((candidate) =>
    verifyKoshaReviewedCandidateBridgeInput(candidate)
  );
  const matchingReviewedCandidates = reviewedCandidates.filter((candidate) =>
    isRecord(candidate.payload.source) && candidate.payload.source.item_id === itemId
  );
  if (matchingReviewedCandidates.length > 1) {
    throw new Error(`kosha-bridge-reviewed-candidate-match-count:${matchingReviewedCandidates.length}`);
  }
  const reviewedCandidate = matchingReviewedCandidates[0];
  const reviewedSource = reviewedCandidate && isRecord(reviewedCandidate.payload.source)
    ? reviewedCandidate.payload.source
    : null;
  if (reviewedSource && readString(reviewedSource.raw_sha256).toLowerCase() !== rawSha256) {
    throw new Error("kosha-bridge-reviewed-candidate-raw-hash-mismatch");
  }
  const candidateIdentity: KoshaProductionLocalBridgeCandidateIdentity = {
    schemaVersion: "safeclaw-kosha-production-local-bridge-candidate/v2",
    production: {
      id: productionId,
      sourceId: productionSourceId,
      tuple: { zipFile, internalPath }
    },
    local: {
      snapshotId: input.snapshot.currentSnapshotId,
      itemId,
      rawSha256,
      itemSha256
    },
    candidateFileSha256: reviewedCandidate?.candidateFileSha256 ?? null,
    candidateContentSha256: reviewedCandidate?.candidateContentSha256 ?? null,
    candidateAttestationSha256: reviewedCandidate?.candidateAttestationSha256 ?? null,
    chunks,
    humanConfirmation: "pending",
    readOnly: true,
    dbMutationPerformed: false,
    launchReadiness: false
  };
  return {
    ...candidateIdentity,
    reproducibilityHash: canonicalSha256(candidateIdentity)
  };
}

function decodeQuality(value: string): number {
  const hangulCount = value.match(/[가-힣]/gu)?.length || 0;
  const replacementCount = value.match(/�/gu)?.length || 0;
  return hangulCount * 4 - replacementCount * 20;
}

export function decodeKoshaArchiveEntryName(rawName: Uint8Array): string {
  const candidates = ["utf-8", "euc-kr"].map((encoding) => new TextDecoder(encoding).decode(rawName));
  return candidates
    .sort((left, right) => decodeQuality(right) - decodeQuality(left))[0]
    .replaceAll("\\", "/");
}

function countValues(values: string[]): Record<string, number> {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) || 0) + 1);
  return Object.fromEntries([...counts.entries()].sort(([left], [right]) => codepointCompare(left, right)));
}

function duplicateGroups(values: string[]): { groups: number; rows: number } {
  const counts = Object.values(countValues(values.filter(Boolean))).filter((count) => count > 1);
  return {
    groups: counts.length,
    rows: counts.reduce((sum, count) => sum + count, 0)
  };
}

function itemTypeCounts(values: KoshaGuideItemType[]): Record<KoshaGuideItemType, number> {
  const counts = countValues(values);
  return {
    "technical-guideline": counts["technical-guideline"] || 0,
    "technical-support-regulation": counts["technical-support-regulation"] || 0
  };
}

function canonicalArchiveEntries(entries: KoshaArchiveEntry[]): KoshaArchiveEntry[] {
  return entries
    .map((entry) => ({ ...entry, internalPath: entry.internalPath.replaceAll("\\", "/") }))
    .sort((left, right) =>
      codepointCompare(left.zipFile, right.zipFile) || codepointCompare(left.internalPath, right.internalPath)
    );
}

export function normalizeKoshaVersionCode(value: string): string | null {
  const normalized = value
    .trim()
    .replace(/[–—−]/gu, "-")
    .replace(/-\s+/gu, "-");
  const match = normalized.match(/^([A-Z](?:-[A-Z])?-\d+(?:-\d{4})?)(?=\b|[_\s.])/iu);
  if (!match) return null;
  return match[1]
    .toUpperCase()
    .split("-")
    .map((part) => /^\d+$/u.test(part) ? String(Number(part)) : part)
    .join("-");
}

export function toKoshaStableDocumentKey(value: string): string | null {
  const versionCode = normalizeKoshaVersionCode(value);
  if (!versionCode) return null;
  const parts = versionCode.split("-");
  if (/^\d{4}$/u.test(parts.at(-1) || "")) parts.pop();
  return parts.join("-");
}

export function buildKoshaArchiveInventory(entries: KoshaArchiveEntry[]): KoshaArchiveInventory {
  const canonical = canonicalArchiveEntries(entries);
  const internalPathDuplicates = duplicateGroups(canonical.map((entry) => entry.internalPath.toLowerCase()));
  const contentDuplicates = duplicateGroups(canonical.map((entry) => `${entry.crc32}:${entry.fileSize}`));
  const archiveNames = [...new Set(canonical.map((entry) => entry.zipFile))].sort(codepointCompare);
  return {
    archiveCount: archiveNames.length,
    archiveNames,
    pdfEntryCount: canonical.length,
    itemTypes: itemTypeCounts(canonical.map((entry) => entry.itemType)),
    entryManifestSha256: createHash("sha256").update(JSON.stringify(canonical), "utf8").digest("hex"),
    emptyPdfEntryCount: canonical.filter((entry) => entry.fileSize <= 0).length,
    duplicateInternalPathGroups: internalPathDuplicates.groups,
    duplicateContentCandidateGroups: contentDuplicates.groups,
    duplicateContentCandidateRows: contentDuplicates.rows,
    missingVersionCodeCount: canonical.filter((entry) => !normalizeKoshaVersionCode(entry.internalPath)).length
  };
}

function compareItemTypes(
  actual: Record<KoshaGuideItemType, number>,
  expected: Record<KoshaGuideItemType, number>,
  prefix: string
): string[] {
  const failures: string[] = [];
  for (const itemType of ["technical-guideline", "technical-support-regulation"] as const) {
    if (actual[itemType] !== expected[itemType]) failures.push(`${prefix}-${itemType}:${actual[itemType]}`);
  }
  return failures;
}

export function listKoshaManifestGateFailures(
  actual: {
    localArchive: Pick<KoshaArchiveInventory, "archiveCount" | "pdfEntryCount" | "entryManifestSha256" | "itemTypes">;
    localParse?: KoshaParseStatsExpectation | null;
    supabaseVisible: KoshaSupabaseVisibleExpectation | null;
    officialSnapshot?: KoshaOfficialSnapshotExpectation | null;
  },
  expected: KoshaGuideAuditManifest
): string[] {
  const failures: string[] = [];
  if (actual.localArchive.archiveCount !== expected.localArchive.archiveCount) {
    failures.push(`local-archives:${actual.localArchive.archiveCount}`);
  }
  if (actual.localArchive.pdfEntryCount !== expected.localArchive.pdfEntryCount) {
    failures.push(`local-pdf-rows:${actual.localArchive.pdfEntryCount}`);
  }
  if (actual.localArchive.entryManifestSha256 !== expected.localArchive.entryManifestSha256) {
    failures.push(`local-entry-manifest-sha256:${actual.localArchive.entryManifestSha256}`);
  }
  failures.push(...compareItemTypes(actual.localArchive.itemTypes, expected.localArchive.itemTypes, "local"));

  if (expected.localParse) {
    if (!actual.localParse) {
      failures.push("local-parse-unavailable");
    } else {
      const parseFields: Array<[keyof KoshaParseStatsExpectation, string]> = [
        ["rowsReturned", "rows-returned"],
        ["parseAttemptedCount", "attempted"],
        ["parseSuccessCount", "success"],
        ["parseEmptyOutputCount", "empty-output"],
        ["parseFailureCount", "failure"],
        ["parseNotAttemptedCount", "not-attempted"]
      ];
      for (const [field, label] of parseFields) {
        if (actual.localParse[field] !== expected.localParse[field]) {
          failures.push(`local-parse-${label}:${actual.localParse[field]}`);
        }
      }
      if (actual.localParse.accountingMatches !== expected.localParse.accountingMatches) {
        failures.push(`local-parse-accounting:${actual.localParse.accountingMatches}`);
      }
    }
  }

  if (!actual.supabaseVisible) {
    failures.push("supabase-visible-unavailable");
    return failures;
  }
  if (actual.supabaseVisible.sourceId !== expected.supabaseVisible.sourceId) {
    failures.push(`supabase-visible-source:${actual.supabaseVisible.sourceId}`);
  }
  if (actual.supabaseVisible.rowCount !== expected.supabaseVisible.rowCount) {
    failures.push(`supabase-visible-rows:${actual.supabaseVisible.rowCount}`);
  }
  failures.push(...compareItemTypes(actual.supabaseVisible.itemTypes, expected.supabaseVisible.itemTypes, "supabase-visible"));
  if (
    expected.supabaseVisible.canonicalRowSha256 &&
    actual.supabaseVisible.canonicalRowSha256 !== expected.supabaseVisible.canonicalRowSha256
  ) {
    failures.push(`supabase-visible-row-sha256:${actual.supabaseVisible.canonicalRowSha256 || "unavailable"}`);
  }
  if (expected.officialSnapshot) {
    if (!actual.officialSnapshot) {
      failures.push("official-snapshot-unavailable");
    } else {
      if (actual.officialSnapshot.currentCount !== expected.officialSnapshot.currentCount) {
        failures.push(`official-current-rows:${actual.officialSnapshot.currentCount}`);
      }
      if (actual.officialSnapshot.currentCanonicalSha256 !== expected.officialSnapshot.currentCanonicalSha256) {
        failures.push(`official-current-sha256:${actual.officialSnapshot.currentCanonicalSha256}`);
      }
      if (actual.officialSnapshot.retiredCount !== expected.officialSnapshot.retiredCount) {
        failures.push(`official-retired-rows:${actual.officialSnapshot.retiredCount}`);
      }
      if (actual.officialSnapshot.retiredCanonicalSha256 !== expected.officialSnapshot.retiredCanonicalSha256) {
        failures.push(`official-retired-sha256:${actual.officialSnapshot.retiredCanonicalSha256}`);
      }
    }
  }
  return failures;
}

export function summarizeKoshaAuditChecks(checks: KoshaAuditCheck[]) {
  const failed = checks.filter((check) => check.status === "fail");
  const boundaries = checks.filter((check) => check.status === "boundary");
  return {
    checkCount: checks.length,
    passedCheckCount: checks.filter((check) => check.status === "pass").length,
    failedCheckCount: failed.length,
    boundaryCheckCount: boundaries.length,
    failures: failed.map((check) => `${check.id}:${check.count}`),
    boundaries: boundaries.map((check) => `${check.id}:${check.count}`)
  };
}

function payloadValue(payload: Record<string, unknown> | undefined, keys: string[]): unknown {
  if (!payload) return undefined;
  for (const key of keys) {
    if (payload[key] !== undefined && payload[key] !== null && payload[key] !== "") return payload[key];
  }
  return undefined;
}

function controlContaminationFlags(
  item: SafetyReferenceItem,
  controls: string[],
  calibration: "initial" | "calibrated"
): string[] {
  const identity = normalizeWhitespace([
    item.title,
    item.summary,
    item.body || "",
    item.category || "",
    item.subcategory || "",
    ...item.keywords,
    ...item.risk_tags
  ].join(" "));
  const controlText = normalizeWhitespace(controls.join(" "));
  const flags: string[] = [];

  const machineryIdentity = /기계|설비|정비|가동부|회전체|프레스|컨베이어|드릴|크레인|지게차|전로|전기작업|정전전로|충전전로/u.test(identity);
  if (!machineryIdentity && /가동부|방호덮개|비상정지/u.test(controlText)) flags.push("machinery-control-cross-task");

  const transportIdentity = calibration === "calibrated"
    ? /지게차|운반|운송|하역|수거|창고|차량|자동차|리프트|주차장치|물류|이송/u.test(identity)
    : /지게차/u.test(identity);
  if (!transportIdentity && /지게차|보행자 동선과 장비 동선|후진 경보/u.test(controlText)) {
    flags.push("forklift-control-cross-task");
  }

  const confinedIdentity = calibration === "calibrated"
    ? /밀폐공간|산소결핍|유해가스|가스|탱크|맨홀|피트|질식|잠수|기압|호흡기체|불활성|산소|환기|노출|중독|응급대응/u.test(identity)
    : /밀폐공간|산소결핍|유해가스|탱크|맨홀|피트|질식/u.test(identity);
  if (!confinedIdentity && /산소·?유해가스|감시인 배치|구조장비/u.test(controlText)) {
    flags.push("confined-space-control-cross-task");
  }

  const fallIdentity = calibration === "calibrated"
    ? /추락|비계|작업발판|고소|외벽|사다리|개구부|지붕|달비계|낙하|떨어짐|승강/u.test(identity)
    : /추락|비계|작업발판|고소|외벽|사다리|개구부/u.test(identity);
  if (!fallIdentity && /작업발판|안전난간|안전대 체결|개구부/u.test(controlText)) {
    flags.push("fall-control-cross-task");
  }

  const fireChemicalIdentity = calibration === "calibrated"
    ? /화재|폭발|도장|도료|유기용제|화학|인화성|가연성|정전기|물질|노출|독성|MSDS|물질안전보건자료|작업환경|중독|세척|세정|미화/u.test(identity)
    : /화재|폭발|도장|도료|유기용제|화학|인화성|가연성|정전기/u.test(identity);
  if (!fireChemicalIdentity && /MSDS|점화원|방폭|유기용제|도료/u.test(controlText)) {
    flags.push("fire-chemical-control-cross-task");
  }

  return flags;
}

function isTemplatedFallbackSummary(summary: string): boolean {
  return /^.+ 분야의 KOSHA 기술지원규정 또는 안전보건 기술지침 자료입니다\.$/u.test(summary);
}

export function auditKoshaGuideRows(
  rows: Array<SafetyReferenceItem & { payload?: Record<string, unknown> }>,
  groundTruthLabels: KoshaControlGroundTruthLabels = {}
): KoshaGuideRowAudit {
  const duplicateIds = duplicateGroups(rows.map((row) => row.id));
  const duplicateTitles = duplicateGroups(rows.map((row) => normalizeWhitespace(row.title).toLowerCase()));
  const duplicateSummaries = duplicateGroups(rows.map((row) => normalizeWhitespace(row.summary)));
  const duplicateBodies = duplicateGroups(
    rows.map((row) => normalizeWhitespace(row.body || "")).filter(Boolean)
  );
  const summaryRows = new Map<string, typeof rows>();
  for (const row of rows) {
    const summary = normalizeWhitespace(row.summary);
    if (!summary) continue;
    const group = summaryRows.get(summary) || [];
    group.push(row);
    summaryRows.set(summary, group);
  }
  const duplicateSummaryDetails = [...summaryRows.entries()]
    .filter(([, groupedRows]) => groupedRows.length > 1)
    .map(([summary, groupedRows]) => ({
      summary,
      rowCount: groupedRows.length,
      sampleIds: groupedRows.map((row) => row.id).sort(codepointCompare).slice(0, 3),
      templateFallback: isTemplatedFallbackSummary(summary),
      nonEmptyBodyRows: groupedRows.filter((row) => normalizeWhitespace(row.body || "")).length
    }))
    .sort((left, right) => right.rowCount - left.rowCount || codepointCompare(left.summary, right.summary));
  const templatedFallbackSummaries = duplicateSummaryDetails.filter((detail) => detail.templateFallback);
  const nonTemplateDuplicateSummaries = duplicateSummaryDetails.filter((detail) => !detail.templateFallback);
  const rawInitialControlContaminationRows: KoshaGuideRowAudit["rawInitialControlContaminationRows"] = [];
  const rawControlContaminationRows: KoshaGuideRowAudit["rawControlContaminationRows"] = [];
  const operationalInitialControlContaminationRows: KoshaGuideRowAudit["operationalInitialControlContaminationRows"] = [];
  const operationalControlContaminationRows: KoshaGuideRowAudit["operationalControlContaminationRows"] = [];
  const rawControlGroundTruthClearedRows: KoshaGuideRowAudit["rawControlGroundTruthClearedRows"] = [];
  const rawControlReviewRequiredRows: KoshaGuideRowAudit["rawControlReviewRequiredRows"] = [];
  const operationalControlGroundTruthClearedRows: KoshaGuideRowAudit["operationalControlGroundTruthClearedRows"] = [];
  const operationalControlReviewRequiredRows: KoshaGuideRowAudit["operationalControlReviewRequiredRows"] = [];
  let sourceMutationCount = 0;
  let rawTagStandaloneControlLeakCount = 0;
  let rawControlHeuristicDeltaFlagCount = 0;
  let operationalControlHeuristicDeltaFlagCount = 0;

  for (const row of rows) {
    const before = JSON.stringify(row);
    const rawInitialFlags = controlContaminationFlags(row, row.controls, "initial");
    const rawFlags = controlContaminationFlags(row, row.controls, "calibrated");
    const rawRemovedFlags = rawInitialFlags.filter((flag) => !rawFlags.includes(flag));
    rawControlHeuristicDeltaFlagCount += rawRemovedFlags.length;
    if (rawInitialFlags.length) {
      rawInitialControlContaminationRows.push({
        id: row.id,
        title: row.title,
        flags: rawInitialFlags,
        controls: [...row.controls]
      });
    }
    if (rawFlags.length) {
      rawControlContaminationRows.push({
        id: row.id,
        title: row.title,
        flags: rawFlags,
        controls: [...row.controls]
      });
    }
    if (rawRemovedFlags.length) {
      const unlabelledFlags = rawRemovedFlags.filter(
        (flag) => groundTruthLabels[row.id]?.[flag] !== "false-positive"
      );
      const delta = {
        id: row.id,
        title: row.title,
        initialFlags: rawInitialFlags,
        removedFlags: rawRemovedFlags
      };
      if (unlabelledFlags.length) {
        rawControlReviewRequiredRows.push({ ...delta, unlabelledFlags });
      } else {
        rawControlGroundTruthClearedRows.push(delta);
      }
    }
    rawTagStandaloneControlLeakCount += row.controls.some((control) =>
      row.risk_tags.some((tag) => normalizeWhitespace(tag) === normalizeWhitespace(control))
    ) ? 1 : 0;
    const operationalView = deriveSafetyReferenceOperationalView(row);
    const operationalInitialFlags = controlContaminationFlags(row, operationalView.controls, "initial");
    const operationalFlags = controlContaminationFlags(row, operationalView.controls, "calibrated");
    const operationalRemovedFlags = operationalInitialFlags.filter((flag) => !operationalFlags.includes(flag));
    operationalControlHeuristicDeltaFlagCount += operationalRemovedFlags.length;
    if (operationalInitialFlags.length) {
      operationalInitialControlContaminationRows.push({
        id: row.id,
        title: row.title,
        flags: operationalInitialFlags,
        controls: [...operationalView.controls]
      });
    }
    if (operationalFlags.length) {
      operationalControlContaminationRows.push({
        id: row.id,
        title: row.title,
        flags: operationalFlags,
        controls: [...operationalView.controls]
      });
    }
    if (operationalRemovedFlags.length) {
      const unlabelledFlags = operationalRemovedFlags.filter(
        (flag) => groundTruthLabels[row.id]?.[flag] !== "false-positive"
      );
      const delta = {
        id: row.id,
        title: row.title,
        initialFlags: operationalInitialFlags,
        removedFlags: operationalRemovedFlags
      };
      if (unlabelledFlags.length) {
        operationalControlReviewRequiredRows.push({ ...delta, unlabelledFlags });
      } else {
        operationalControlGroundTruthClearedRows.push(delta);
      }
    }
    if (JSON.stringify(row) !== before) sourceMutationCount += 1;
  }

  return {
    rowCount: rows.length,
    sourceIds: [...new Set(rows.map((row) => row.source_id))].sort(codepointCompare),
    itemTypes: countValues(rows.map((row) => row.item_type)),
    emptyBodyCount: rows.filter((row) => !normalizeWhitespace(row.body || "")).length,
    emptySummaryCount: rows.filter((row) => !normalizeWhitespace(row.summary)).length,
    emptyControlsCount: rows.filter((row) => row.controls.length === 0).length,
    duplicateIdGroups: duplicateIds.groups,
    duplicateTitleGroups: duplicateTitles.groups,
    duplicateSummaryGroups: duplicateSummaries.groups,
    duplicateSummaryRows: duplicateSummaries.rows,
    templatedFallbackSummaryGroups: templatedFallbackSummaries.length,
    templatedFallbackSummaryRows: templatedFallbackSummaries.reduce((sum, detail) => sum + detail.rowCount, 0),
    nonTemplateDuplicateSummaryGroups: nonTemplateDuplicateSummaries.length,
    nonTemplateDuplicateSummaryRows: nonTemplateDuplicateSummaries.reduce((sum, detail) => sum + detail.rowCount, 0),
    duplicateSummaryDetails,
    exactBodyDuplicateCandidateGroups: duplicateBodies.groups,
    exactBodyDuplicateCandidateRows: duplicateBodies.rows,
    missingSourceUrlCount: rows.filter((row) => !row.source_url && !payloadValue(row.payload, [
      "officialDownloadUrl",
      "official_download_url",
      "officialUrl",
      "official_url",
      "sourceUrl",
      "source_url",
      "downloadUrl",
      "download_url"
    ])).length,
    missingOfficialFileIdCount: rows.filter((row) => !payloadValue(row.payload, [
      "officialFileId",
      "official_file_id",
      "techGdlnOrgnlAtcflNo"
    ])).length,
    missingOfficialPublishedAtCount: rows.filter((row) => !payloadValue(row.payload, [
      "officialPublishedAt",
      "official_published_at",
      "publishedAt",
      "techGdlnOfancYmd"
    ])).length,
    missingOfficialStatusCount: rows.filter((row) => !payloadValue(row.payload, [
      "officialStatus",
      "official_status",
      "status",
      "techGdlnSttsSeCdSt"
    ])).length,
    missingVersionCodeCount: rows.filter((row) => !normalizeKoshaVersionCode(row.title)).length,
    rawTagStandaloneControlLeakCount,
    rawInitialControlContaminationCount: rawInitialControlContaminationRows.length,
    rawControlContaminationCount: rawControlContaminationRows.length,
    rawControlGroundTruthClearedCount: rawControlGroundTruthClearedRows.length,
    rawControlReviewRequiredCount: rawControlReviewRequiredRows.length,
    rawControlHeuristicDeltaFlagCount,
    operationalInitialControlContaminationCount: operationalInitialControlContaminationRows.length,
    operationalControlContaminationCount: operationalControlContaminationRows.length,
    operationalControlGroundTruthClearedCount: operationalControlGroundTruthClearedRows.length,
    operationalControlReviewRequiredCount: operationalControlReviewRequiredRows.length,
    operationalControlHeuristicDeltaFlagCount,
    sourceMutationCount,
    rawInitialControlContaminationRows,
    rawControlContaminationRows,
    operationalInitialControlContaminationRows,
    operationalControlContaminationRows,
    rawControlGroundTruthClearedRows,
    rawControlReviewRequiredRows,
    operationalControlGroundTruthClearedRows,
    operationalControlReviewRequiredRows
  };
}

export function buildKoshaOfficialDownloadUrl(record: KoshaOfficialGuideRecord): string | null {
  if (!record.fileId || record.fileSeq === null || record.fileSeq === undefined) return null;
  return `${KOSHA_GUIDE_OFFICIAL_DOWNLOAD_BASE}/${encodeURIComponent(record.fileId)}/${record.fileSeq}`;
}

function normalizeOfficialDate(value: unknown): string | null {
  const text = readString(value).replace(/[^0-9]/gu, "");
  if (!/^\d{8}$/u.test(text)) return null;
  return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`;
}

export function toKoshaOfficialGuideRecord(value: unknown): KoshaOfficialGuideRecord | null {
  if (!isRecord(value)) return null;
  const code = normalizeKoshaVersionCode(readString(value.techGdlnNo));
  const stableKey = code ? toKoshaStableDocumentKey(code) : null;
  const title = readString(value.techGdlnNm);
  if (!code || !stableKey || !title) return null;
  const rawFileSeq = value.techGdlnOrgnlAtcflNoSeq;
  const parsedFileSeq = typeof rawFileSeq === "string" && /^\d+$/u.test(rawFileSeq)
    ? Number(rawFileSeq)
    : rawFileSeq;
  return {
    code,
    stableKey,
    title,
    category: readString(value.techGdlnCtgryCd),
    field: readString(value.techGdlnFldSeCd),
    status: readString(value.techGdlnSttsSeCdSt),
    publishedAt: normalizeOfficialDate(value.techGdlnOfancYmd),
    fileId: readString(value.techGdlnOrgnlAtcflNo) || null,
    fileSeq: readNonNegativeInteger(parsedFileSeq)
  };
}

export function summarizeKoshaVisibleStatus(value: unknown): KoshaVisibleStatus | null {
  if (!isRecord(value) || value.ok !== true || value.configured !== true) return null;
  const totalSources = readNonNegativeInteger(value.sources);
  const totalItems = readNonNegativeInteger(value.items);
  const rowCount = readNonNegativeInteger(value.technicalTotal);
  const technicalSupportRegulations = readNonNegativeInteger(value.technicalSupportRegulations);
  const technicalGuidelines = readNonNegativeInteger(value.technicalGuidelines);
  if (
    totalSources === null ||
    totalItems === null ||
    rowCount === null ||
    technicalSupportRegulations === null ||
    technicalGuidelines === null
  ) {
    return null;
  }
  const samples = Array.isArray(value.samples) ? value.samples : [];
  const sampleSourceId = samples
    .filter(isRecord)
    .map((sample) => readString(sample.source_id))
    .find(Boolean);
  return {
    ok: true,
    configured: true,
    catalogStatus: readString(value.status) || "unknown",
    totalSources,
    totalItems,
    sourceId: sampleSourceId || KOSHA_GUIDE_SOURCE_ID,
    rowCount,
    itemTypes: {
      "technical-guideline": technicalGuidelines,
      "technical-support-regulation": technicalSupportRegulations
    },
    sampleCount: samples.length,
    fullRowSnapshotAvailable: false,
    canonicalRowSha256: null
  };
}

export function reconcileKoshaVisibleSnapshots(
  production: KoshaSupabaseVisibleExpectation,
  fullRows: KoshaSupabaseVisibleExpectation | null
): {
  snapshot: KoshaSupabaseVisibleExpectation;
  parityFailures: string[];
  deploymentIdentityProven: false;
  identityBoundary: "deployment-project-identity-unverified";
} {
  const identity = {
    deploymentIdentityProven: false as const,
    identityBoundary: "deployment-project-identity-unverified" as const
  };
  if (!fullRows) {
    return {
      snapshot: { ...production, canonicalRowSha256: production.canonicalRowSha256 || null },
      parityFailures: [],
      ...identity
    };
  }
  const parityFailures: string[] = [];
  if (fullRows.sourceId !== production.sourceId) {
    parityFailures.push(`supabase-visible-source-parity:${fullRows.sourceId}/${production.sourceId}`);
  }
  if (fullRows.rowCount !== production.rowCount) {
    parityFailures.push(`supabase-visible-row-parity:${fullRows.rowCount}/${production.rowCount}`);
  }
  for (const itemType of ["technical-guideline", "technical-support-regulation"] as const) {
    if (fullRows.itemTypes[itemType] !== production.itemTypes[itemType]) {
      parityFailures.push(
        `supabase-visible-${itemType}-parity:${fullRows.itemTypes[itemType]}/${production.itemTypes[itemType]}`
      );
    }
  }
  return parityFailures.length
    ? {
        snapshot: { ...production, canonicalRowSha256: null },
        parityFailures,
        ...identity
      }
    : {
        snapshot: fullRows,
        parityFailures,
        ...identity
      };
}

export function compareKoshaInventoryToOfficial(
  localEntries: KoshaArchiveEntry[],
  currentRecords: KoshaOfficialGuideRecord[],
  retiredRecords: KoshaOfficialGuideRecord[]
) {
  const currentByStableKey = new Map(
    currentRecords.map((record) => [toKoshaStableDocumentKey(record.code) || record.stableKey, record])
  );
  const retiredStableKeys = new Set(
    retiredRecords.map((record) => toKoshaStableDocumentKey(record.code) || record.stableKey)
  );
  const local = canonicalArchiveEntries(localEntries).map((entry) => ({
    ...entry,
    code: normalizeKoshaVersionCode(entry.internalPath),
    stableKey: toKoshaStableDocumentKey(entry.internalPath)
  }));
  const stableKeyMatches = local.filter((entry) => entry.stableKey && currentByStableKey.has(entry.stableKey)).length;
  const exactVersionMatches = local.filter((entry) => {
    if (!entry.stableKey || !entry.code) return false;
    const officialRecord = currentByStableKey.get(entry.stableKey);
    return officialRecord ? normalizeKoshaVersionCode(officialRecord.code) === entry.code : false;
  }).length;
  const versionMismatches = local
    .filter((entry) => {
      if (!entry.stableKey || !entry.code) return false;
      const officialRecord = currentByStableKey.get(entry.stableKey);
      return Boolean(officialRecord && normalizeKoshaVersionCode(officialRecord.code) !== entry.code);
    })
    .map((entry) => {
      const officialRecord = currentByStableKey.get(entry.stableKey || "");
      return {
        stableKey: entry.stableKey || "",
        officialCode: normalizeKoshaVersionCode(officialRecord?.code || "") || officialRecord?.code || "",
        localCode: entry.code || "",
        internalPath: entry.internalPath
      };
    });
  const staleLocalRows = local
    .filter((entry) => entry.stableKey && !currentByStableKey.has(entry.stableKey))
    .map((entry) => ({
      stableKey: entry.stableKey || "",
      localCode: entry.code || "",
      internalPath: entry.internalPath,
      officialRetired: retiredStableKeys.has(entry.stableKey || "")
    }));
  const localStableKeys = new Set(local.map((entry) => entry.stableKey).filter((value): value is string => Boolean(value)));
  const officialMissingLocal = currentRecords
    .filter((record) => !localStableKeys.has(toKoshaStableDocumentKey(record.code) || record.stableKey))
    .map((record) => ({ code: record.code, stableKey: record.stableKey, title: record.title }));
  const retiredLocalRows = staleLocalRows.filter((entry) => entry.officialRetired);
  const unverifiedLocalRows = staleLocalRows.filter((entry) => !entry.officialRetired);
  const refreshDryRun = {
    readOnly: true as const,
    mutationPerformed: false as const,
    approvalRequiredBeforeMutation: true as const,
    counts: {
      insert: officialMissingLocal.length,
      update: versionMismatches.length,
      retire: retiredLocalRows.length,
      unchanged: exactVersionMatches
    },
    insert: officialMissingLocal,
    update: versionMismatches,
    retire: retiredLocalRows,
    unverifiedLocal: unverifiedLocalRows
  };

  return {
    localRows: local.length,
    localMissingStableKey: local.filter((entry) => !entry.stableKey).length,
    officialCurrentRows: currentRecords.length,
    officialRetiredRows: retiredRecords.length,
    stableKeyMatches,
    exactVersionMatches,
    versionMismatches,
    staleLocalRows,
    officialMissingLocal,
    refreshDryRun
  };
}

export function auditKoshaRetrievalScenario(
  scenario: KoshaRetrievalScenario,
  items: SafetyReferenceItem[],
  branch: KoshaRetrievalBranch
): KoshaRetrievalScenarioAudit {
  const candidates = items.filter((item) => item.retrieval_source === branch);
  if (!candidates.length) {
    return {
      scenarioId: scenario.id,
      branch,
      executionStatus: "untested",
      selectedIds: [],
      selectedTitles: [],
      retrievalSources: [],
      promptContext: "",
      answer: "",
      documentReflections: [],
      failures: [`branch-not-executed:${branch}`]
    };
  }
  const ranked = filterAndRankSafetyReferencesByQuery(scenario.query, candidates, candidates.length);
  const packet = buildDbHarnessPacket({ question: scenario.query, references: ranked });
  const promptContext = buildHarnessPromptContext(packet);
  const answer = buildDbHarnessAnswer(packet);
  const selected = [...packet.directEvidence, ...packet.sifCases, ...packet.supportingEvidence];
  const expectedCodeSet = new Set(scenario.expectedCodes.map((code) => normalizeKoshaVersionCode(code) || code));
  const expectedItems = selected.filter((item) => {
    const code = normalizeKoshaVersionCode(item.title);
    return code ? expectedCodeSet.has(code) : false;
  });
  const documentReflections = expectedItems.map((item) => {
    const metadata = buildSafetyReferenceOperationalMetadata(item);
    return {
      code: normalizeKoshaVersionCode(item.title),
      title: item.title,
      documents: [...item.primary_documents],
      label: metadata.document_reflection_label || ""
    };
  });
  const sourceEvidenceText = selected.map((item) => [
    item.title,
    item.summary,
    item.body || "",
    ...item.keywords,
    ...item.risk_tags,
    ...item.controls,
    ...item.primary_documents
  ].join("\n")).join("\n");
  const failures: string[] = [];

  for (const expectedCode of expectedCodeSet) {
    if (!expectedItems.some((item) => normalizeKoshaVersionCode(item.title) === expectedCode)) {
      failures.push(`missing-kosha-evidence:${expectedCode}`);
    }
  }
  for (const item of expectedItems) {
    if (!promptContext.includes(item.title)) failures.push(`prompt-missing-title:${item.id}`);
    if (item.retrieval_source !== branch) failures.push(`retrieval-source:${item.id}:${item.retrieval_source || "missing"}`);
  }
  for (const term of scenario.requiredControlTerms) {
    if (!sourceEvidenceText.includes(term)) failures.push(`missing-control-term:${term}`);
  }
  for (const term of scenario.forbiddenTerms) {
    if (sourceEvidenceText.includes(term)) failures.push(`cross-task-term:${term}`);
  }
  for (const reflection of documentReflections) {
    if (!reflection.documents.includes("위험성평가표")) failures.push(`missing-risk-document:${reflection.code || reflection.title}`);
    if (!reflection.label.includes("위험성평가표")) failures.push(`missing-document-reflection:${reflection.code || reflection.title}`);
  }

  return {
    scenarioId: scenario.id,
    branch,
    executionStatus: "tested",
    selectedIds: selected.map((item) => item.id),
    selectedTitles: selected.map((item) => item.title),
    retrievalSources: [...new Set(
      selected
        .map((item) => item.retrieval_source)
        .filter((source): source is KoshaRetrievalBranch => Boolean(source))
    )].sort(codepointCompare),
    promptContext,
    answer,
    documentReflections,
    failures
  };
}
