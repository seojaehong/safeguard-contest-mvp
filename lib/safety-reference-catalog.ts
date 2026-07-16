import { createLogger } from "@/lib/logger";

export type KoshaGroundingReason =
  | "verified-current"
  | "metadata-absent"
  | "body-empty"
  | "provenance-unresolved"
  | "review-unverified"
  | "lifecycle-not-current"
  | "current-version-mismatch"
  | "body-kind-unverified"
  | "body-integrity-unverified"
  | "body-integrity-mismatch"
  | "exact-registry-integrity-failed"
  | "local-corpus-integrity-failed"
  | "local-corpus-unavailable";

export type KoshaGroundingMetadata = {
  uid: string;
  stableDocumentKey: string;
  version: string;
  currentVersion: string;
  lifecycle: "current" | "stale" | "retired" | "unresolved";
  reviewState: string;
  bodyKind: "native" | "unknown";
  bodySha256: string | null;
  officialUrl: string | null;
  officialFileId: string | null;
  publishedAt: string | null;
  provenance: string;
};

export type KoshaGroundingDecision = {
  status: "verified_current" | "review_required" | "blocked";
  reason: KoshaGroundingReason;
  source: "local-corpus" | "remote-payload" | "local-gate" | "production-registry";
  reviewRequired: boolean;
  directEvidenceEligible: boolean;
  supportingCitationEligible: boolean;
  mandatoryCitationEligible: boolean;
  riskRowEligible: boolean;
  promptExcerptEligible: boolean;
  metadata: KoshaGroundingMetadata | null;
};

export type KoshaGroundingSearchDecision = {
  status: "ready" | "review_required" | "blocked" | "not_applicable";
  reason: KoshaGroundingReason | "not-applicable";
  localGateReason: "local-corpus-integrity-failed" | "local-corpus-unavailable" | null;
  localCorpusStatus: "ready" | "blocked" | "unconfigured" | "not_applicable";
  acceptedCount: number;
  reviewRequiredCount: number;
  excludedCount: number;
};

export type SafetyReferenceItem = {
  id: string;
  source_id: string;
  item_type: string;
  category: string | null;
  subcategory: string | null;
  title: string;
  summary: string;
  body?: string;
  keywords: string[];
  risk_tags: string[];
  primary_documents: string[];
  controls: string[];
  source_url?: string | null;
  evidence_role?: "direct" | "supporting";
  reflected_documents?: string[];
  short_summary?: string;
  evidence_role_label?: string;
  document_reflection_label?: string;
  source_kind_label?: string;
  operation_signal_label?: string;
  display_title?: string;
  display_summary?: string;
  retrieval_source?: "rest" | "ranked" | "vector" | "hybrid" | "local-tag" | "local-ranked" | "local-hybrid";
  vector_similarity?: number;
  payload?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  kosha_grounding?: KoshaGroundingDecision;
  kosha_guide?: {
    referenceId: string;
    stableDocumentKey: string;
    version: string;
    quality: "accepted" | "review_required";
    lifecycle: "current" | "stale" | "retired";
    bodyKind: "native" | "unknown";
    anchors: Array<{ page: number; excerpt: string }>;
    evidenceRef: string | null;
    directEligible: boolean;
    officialUrl?: string;
    officialFileId?: string;
    publicationDate?: string;
    officialVersion?: string;
    officialStatus?: "current";
    pdfSha256?: string;
    bodySha256?: string;
  };
};

export type SafetyReferenceOperationalView = {
  hazard: string;
  controls: string[];
  reviewRequired: boolean;
};

export type SafetyReferenceRetrievalMode =
  | "unconfigured"
  | "rest-ilike"
  | "ranked-rpc"
  | "hybrid-vector-rpc"
  | "hybrid-local-supabase"
  | "local-tag"
  | "local-ranked"
  | "local-hybrid";

export const SAFETY_REFERENCE_SEARCH_FAILURE_CODE = "safety_reference_search_failed" as const;
export const SAFETY_REFERENCE_SEARCH_FAILURE_MESSAGE =
  "안전 지식 DB 조회를 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.";
export type SafetyReferenceErrorCode = typeof SAFETY_REFERENCE_SEARCH_FAILURE_CODE;
export const SAFETY_REFERENCE_VECTOR_FAILURE_CODE = "safety_reference_vector_failed" as const;
export const SAFETY_REFERENCE_VECTOR_FAILURE_MESSAGE =
  "벡터 조회를 완료하지 못해 text/ranked 검색으로 대체합니다.";

const log = createLogger("safety-reference-catalog");

export type SafetyReferenceVectorStatus = {
  enabled: boolean;
  attempted: boolean;
  ok: boolean;
  errorCode?: typeof SAFETY_REFERENCE_VECTOR_FAILURE_CODE;
  reason:
    | "disabled"
    | "missing-openai-key"
    | "embedding-failed"
    | "rpc-missing"
    | "rpc-failed"
    | "no-results"
    | "ready";
  count: number;
  model: string;
  message: string;
};

export type SafetyReferenceSearchResult = {
  ok: boolean;
  configured: boolean;
  errorCode?: SafetyReferenceErrorCode;
  query: string;
  count: number;
  items: SafetyReferenceItem[];
  retrievalMode: SafetyReferenceRetrievalMode;
  vectorSearch: SafetyReferenceVectorStatus;
  koshaGrounding?: KoshaGroundingSearchDecision;
  message: string;
};

export type SafetyReferenceStats = {
  ok: boolean;
  configured: boolean;
  status: "ready" | "degraded" | "unconfigured";
  sources: number;
  items: number;
  expectedTechnicalTotal: number;
  technicalTotal: number;
  technicalSupportRegulations: number;
  technicalGuidelines: number;
  technicalSplitOk: boolean;
  catalogSearchOk: boolean;
  ingestionRuns: number;
  itemTypes: Array<{ itemType: string; count: number }>;
  samples: SafetyReferenceItem[];
  message: string;
};

type SupabaseConfig = {
  url: string;
  serviceRoleKey: string;
};

type SafetyReferenceVectorRuntime = {
  enabled: boolean;
  apiKey: string | null;
  model: string;
  dimensions: number;
  status: SafetyReferenceVectorStatus;
};

type VectorFetchResult = {
  status: SafetyReferenceVectorStatus;
  items: SafetyReferenceItem[];
};

type CountSpec = {
  label: keyof Pick<
    SafetyReferenceStats,
    "sources" | "items" | "technicalTotal" | "technicalSupportRegulations" | "technicalGuidelines" | "ingestionRuns"
  >;
  table: string;
  filters?: Record<string, string>;
};

const TECHNICAL_SOURCE_ID = "kosha-technical-support-regulations-2025";
const EXPECTED_TECHNICAL_TOTAL = 1040;
const DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small";
const DEFAULT_EMBEDDING_DIMENSIONS = 1536;
const VECTOR_SEARCH_TIMEOUT_MS = 20_000;
const SELECT_FIELDS = [
  "id",
  "source_id",
  "item_type",
  "category",
  "subcategory",
  "title",
  "summary",
  "body",
  "keywords",
  "risk_tags",
  "primary_documents",
  "controls",
  "payload"
].join(",");

function getSupabaseConfig(): SupabaseConfig | null {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return null;
  return {
    url: url.replace(/\/$/, ""),
    serviceRoleKey
  };
}

export function resolveSafetyReferenceVectorSearchState(
  env: Record<string, string | undefined> = process.env
): SafetyReferenceVectorRuntime {
  const model = env.SAFETY_REFERENCE_EMBEDDING_MODEL || env.OPENAI_EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL;
  const dimensions = readEmbeddingDimensions(env.SAFETY_REFERENCE_EMBEDDING_DIMENSIONS);
  if (env.SAFETY_REFERENCE_VECTOR_SEARCH !== "1") {
    return {
      enabled: false,
      apiKey: null,
      model,
      dimensions,
      status: {
        enabled: false,
        attempted: false,
        ok: false,
        reason: "disabled",
        count: 0,
        model,
        message: "SIF 임베딩 검색은 승인 전 기본 비활성입니다."
      }
    };
  }

  const apiKey = env.OPENAI_API_KEY || null;
  if (!apiKey) {
    return {
      enabled: false,
      apiKey: null,
      model,
      dimensions,
      status: {
        enabled: true,
        attempted: false,
        ok: false,
        reason: "missing-openai-key",
        count: 0,
        model,
        message: "SIF 임베딩 검색이 켜져 있지만 OPENAI_API_KEY가 없어 text/ranked 검색으로 대체합니다."
      }
    };
  }

  return {
    enabled: true,
    apiKey,
    model,
    dimensions,
    status: {
      enabled: true,
      attempted: false,
      ok: false,
      reason: "no-results",
      count: 0,
      model,
      message: "SIF 임베딩 검색이 준비되었습니다."
    }
  };
}

function readEmbeddingDimensions(value: string | undefined): number {
  const parsed = Number(value || DEFAULT_EMBEDDING_DIMENSIONS);
  if (!Number.isFinite(parsed)) return DEFAULT_EMBEDDING_DIMENSIONS;
  return Math.min(Math.max(Math.trunc(parsed), 256), 3072);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((item) => typeof item === "number" && Number.isFinite(item));
}

function isReferenceItem(value: unknown): value is SafetyReferenceItem {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    typeof record.source_id === "string" &&
    typeof record.item_type === "string" &&
    (typeof record.category === "string" || record.category === null) &&
    (typeof record.subcategory === "string" || record.subcategory === null) &&
    typeof record.title === "string" &&
    typeof record.summary === "string" &&
    (typeof record.body === "string" || typeof record.body === "undefined") &&
    isStringArray(record.keywords) &&
    isStringArray(record.risk_tags) &&
    isStringArray(record.primary_documents) &&
    isStringArray(record.controls) &&
    (typeof record.source_url === "string" || typeof record.source_url === "undefined" || record.source_url === null)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function metadataRecords(item: SafetyReferenceItem): Record<string, unknown>[] {
  const records: Record<string, unknown>[] = [];
  const append = (value: unknown): void => {
    if (!isRecord(value)) return;
    records.push(value);
    if (isRecord(value.metadata)) records.push(value.metadata);
    if (isRecord(value.provenance)) records.push(value.provenance);
  };
  append(item.payload);
  append(item.metadata);
  return records;
}

function readMetadataString(records: readonly Record<string, unknown>[], keys: readonly string[]): string {
  for (const record of records) {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === "string" && value.trim()) return value.trim();
      if (typeof value === "number" && Number.isFinite(value)) return String(value);
    }
  }
  return "";
}

function readMetadataBoolean(records: readonly Record<string, unknown>[], keys: readonly string[]): boolean | undefined {
  for (const record of records) {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === "boolean") return value;
    }
  }
  return undefined;
}

function normalizeKoshaLifecycle(value: string): KoshaGroundingMetadata["lifecycle"] {
  const normalized = value.trim().toLowerCase();
  if (["current", "active", "현행", "0"].includes(normalized)) return "current";
  if (["retired", "withdrawn", "폐지", "1"].includes(normalized)) return "retired";
  if (["stale", "outdated", "구버전"].includes(normalized)) return "stale";
  return "unresolved";
}

function normalizeKoshaVersion(value: string): string {
  return value.toUpperCase().replace(/\s+/gu, "").trim();
}

function extractKoshaVersion(title: string): string {
  const normalized = normalizeKoshaVersion(title);
  return normalized.match(/[A-Z](?:-[A-Z])?-\d+(?:-\d+)?-\d{4}/u)?.[0] || "";
}

function isVerifiedReviewState(value: string): boolean {
  return ["verified", "published", "accepted"].includes(value.trim().toLowerCase());
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

function normalizeBodyForHash(value: string): string {
  return value.replace(/\r\n?/gu, "\n");
}

async function sha256Text(value: string): Promise<string | null> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return null;
  const digest = await subtle.digest("SHA-256", new TextEncoder().encode(normalizeBodyForHash(value)));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function reviewRequiredKoshaDecision(
  source: KoshaGroundingDecision["source"],
  reason: Exclude<KoshaGroundingReason, "verified-current">,
  metadata: KoshaGroundingMetadata | null = null
): KoshaGroundingDecision {
  return {
    status: reason === "local-corpus-integrity-failed" || reason === "local-corpus-unavailable"
      ? "blocked"
      : "review_required",
    reason,
    source,
    reviewRequired: true,
    directEvidenceEligible: false,
    supportingCitationEligible: false,
    mandatoryCitationEligible: false,
    riskRowEligible: false,
    promptExcerptEligible: false,
    metadata
  };
}

function verifiedKoshaDecision(
  source: "local-corpus" | "remote-payload",
  metadata: KoshaGroundingMetadata
): KoshaGroundingDecision {
  return {
    status: "verified_current",
    reason: "verified-current",
    source,
    reviewRequired: false,
    directEvidenceEligible: false,
    supportingCitationEligible: true,
    mandatoryCitationEligible: true,
    riskRowEligible: false,
    promptExcerptEligible: true,
    metadata
  };
}

function localKoshaMetadata(item: SafetyReferenceItem): KoshaGroundingMetadata | null {
  const guide = item.kosha_guide;
  if (!guide) return null;
  return {
    uid: guide.referenceId,
    stableDocumentKey: guide.stableDocumentKey,
    version: guide.version,
    currentVersion: guide.officialVersion || "",
    lifecycle: guide.lifecycle,
    reviewState: guide.quality === "accepted" ? "verified" : "review_required",
    bodyKind: guide.bodyKind,
    bodySha256: guide.bodySha256 || null,
    officialUrl: guide.officialUrl || item.source_url || null,
    officialFileId: guide.officialFileId || null,
    publishedAt: guide.publicationDate || null,
    provenance: guide.evidenceRef || `local-corpus:${guide.referenceId}`
  };
}

export function getKoshaGroundingDecision(item: SafetyReferenceItem): KoshaGroundingDecision | null {
  if (!isKoshaTechnicalReference(item)) return null;
  if (item.kosha_grounding) return item.kosha_grounding;
  const guide = item.kosha_guide;
  if (!guide) return reviewRequiredKoshaDecision("remote-payload", "metadata-absent");
  const metadata = localKoshaMetadata(item);
  if (!(item.body || "").trim()) return reviewRequiredKoshaDecision("local-corpus", "body-empty", metadata);
  if (guide.lifecycle !== "current") {
    return reviewRequiredKoshaDecision("local-corpus", "lifecycle-not-current", metadata);
  }
  if (guide.quality !== "accepted") {
    return reviewRequiredKoshaDecision("local-corpus", "review-unverified", metadata);
  }
  if (guide.bodyKind !== "native") {
    return reviewRequiredKoshaDecision("local-corpus", "body-kind-unverified", metadata);
  }
  if (
    !guide.directEligible
    || !guide.anchors.length
    || !guide.evidenceRef
    || !metadata
    || !metadata.officialUrl
    || !isOfficialKoshaUrl(metadata.officialUrl)
    || !metadata.officialFileId
    || !metadata.publishedAt
    || Number.isNaN(Date.parse(metadata.publishedAt))
    || !metadata.currentVersion
    || normalizeKoshaVersion(metadata.version) !== normalizeKoshaVersion(metadata.currentVersion)
    || guide.officialStatus !== "current"
    || !metadata.bodySha256
    || !/^[a-f0-9]{64}$/u.test(metadata.bodySha256)
    || !guide.pdfSha256
    || !/^[a-f0-9]{64}$/u.test(guide.pdfSha256)
  ) {
    return reviewRequiredKoshaDecision("local-corpus", "provenance-unresolved", metadata);
  }
  return verifiedKoshaDecision("local-corpus", metadata);
}

async function buildRemoteKoshaGroundingDecision(item: SafetyReferenceItem): Promise<KoshaGroundingDecision> {
  const body = item.body || "";
  if (!body.trim()) return reviewRequiredKoshaDecision("remote-payload", "body-empty");
  const records = metadataRecords(item);
  if (!records.some((record) => Object.keys(record).length > 0)) {
    return reviewRequiredKoshaDecision("remote-payload", "metadata-absent");
  }

  const uid = readMetadataString(records, ["reference_item_id", "referenceItemId", "uid"]) || item.id;
  const stableDocumentKey = readMetadataString(records, ["stable_document_key", "stableDocumentKey", "stable_key"]);
  const version = readMetadataString(records, ["version", "version_code", "versionKey", "version_key"])
    || extractKoshaVersion(item.title);
  const currentVersion = readMetadataString(records, [
    "official_version_code",
    "officialVersionCode",
    "current_version",
    "currentVersion"
  ]);
  const lifecycle = normalizeKoshaLifecycle(readMetadataString(records, [
    "official_status",
    "officialStatus",
    "lifecycle",
    "state",
    "status",
    "techGdlnSttsSeCdSt"
  ]));
  const reviewState = readMetadataString(records, ["review_state", "reviewState", "quality"]);
  const bodyKindValue = readMetadataString(records, ["body_kind", "bodyKind", "extraction_method", "extractionMethod"])
    .toLowerCase();
  const bodyKind: KoshaGroundingMetadata["bodyKind"] = bodyKindValue === "native"
    || bodyKindValue === "native-pdf"
    || bodyKindValue === "native_pdf"
    ? "native"
    : "unknown";
  const bodySha256 = readMetadataString(records, [
    "body_sha256",
    "bodySha256",
    "normalized_text_sha256",
    "normalizedTextSha256",
    "text_sha256",
    "textSha256"
  ]).toLowerCase();
  const officialUrl = readMetadataString(records, [
    "official_url",
    "officialUrl",
    "official_download_url",
    "officialDownloadUrl",
    "source_url",
    "sourceUrl",
    "download_url",
    "downloadUrl"
  ]) || item.source_url || "";
  const officialFileId = readMetadataString(records, [
    "official_file_id",
    "officialFileId",
    "techGdlnOrgnlAtcflNo"
  ]);
  const publishedAt = readMetadataString(records, [
    "official_published_at",
    "officialPublishedAt",
    "published_at",
    "publishedAt",
    "techGdlnOfancYmd"
  ]);
  const humanConfirmed = readMetadataBoolean(records, ["human_confirmed", "humanConfirmed"]);
  const tampered = readMetadataBoolean(records, ["tampered", "integrity_tampered", "integrityTampered"]);

  if (lifecycle !== "current") {
    return reviewRequiredKoshaDecision("remote-payload", "lifecycle-not-current");
  }
  if (!isVerifiedReviewState(reviewState) || humanConfirmed === false) {
    return reviewRequiredKoshaDecision("remote-payload", "review-unverified");
  }
  if (!version || !currentVersion || normalizeKoshaVersion(version) !== normalizeKoshaVersion(currentVersion)) {
    return reviewRequiredKoshaDecision("remote-payload", "current-version-mismatch");
  }
  if (bodyKind !== "native") {
    return reviewRequiredKoshaDecision("remote-payload", "body-kind-unverified");
  }
  if (
    !stableDocumentKey
    || !isOfficialKoshaUrl(officialUrl)
    || !officialFileId
    || !publishedAt
    || Number.isNaN(Date.parse(publishedAt))
  ) {
    return reviewRequiredKoshaDecision("remote-payload", "provenance-unresolved");
  }
  if (!/^[a-f0-9]{64}$/u.test(bodySha256)) {
    return reviewRequiredKoshaDecision("remote-payload", "body-integrity-unverified");
  }
  const actualBodySha256 = await sha256Text(body);
  if (!actualBodySha256) {
    return reviewRequiredKoshaDecision("remote-payload", "body-integrity-unverified");
  }
  if (tampered === true || actualBodySha256 !== bodySha256) {
    return reviewRequiredKoshaDecision("remote-payload", "body-integrity-mismatch");
  }

  const metadata: KoshaGroundingMetadata = {
    uid,
    stableDocumentKey,
    version,
    currentVersion,
    lifecycle,
    reviewState,
    bodyKind,
    bodySha256,
    officialUrl,
    officialFileId,
    publishedAt,
    provenance: `${officialUrl}#file=${encodeURIComponent(officialFileId)}`
  };
  return verifiedKoshaDecision("remote-payload", metadata);
}

async function normalizeRemoteReferenceItem(value: unknown): Promise<SafetyReferenceItem | null> {
  if (!isReferenceItem(value)) return null;
  const raw = value as SafetyReferenceItem;
  const item: SafetyReferenceItem = {
    ...raw,
    kosha_guide: undefined,
    kosha_grounding: undefined
  };
  if (!isKoshaTechnicalReference(item)) return normalizeReferenceItem(item);
  const decision = await buildRemoteKoshaGroundingDecision(item);
  return normalizeReferenceItem({
    ...item,
    evidence_role: "supporting",
    source_url: decision.metadata?.officialUrl || item.source_url || null,
    kosha_grounding: decision
  });
}

function normalizeReferenceItem(item: SafetyReferenceItem): SafetyReferenceItem {
  const evidenceRole = deriveEvidenceRole(item);
  const reflectedDocuments = item.reflected_documents?.length ? item.reflected_documents : item.primary_documents;
  const displayTitle = deriveSifDisplayTitle(item);
  const displaySummary = deriveSifDisplaySummary(item);
  const operationalMetadata = buildSafetyReferenceOperationalMetadata(item);
  const koshaGrounding = getKoshaGroundingDecision(item);
  return {
    ...item,
    source_url: item.source_url || null,
    evidence_role: evidenceRole,
    reflected_documents: reflectedDocuments,
    ...operationalMetadata,
    evidence_role_label: evidenceRole === "direct" ? "문서 문구 직접 근거" : "현장 판단 보조 근거",
    source_kind_label: buildSourceKindLabel(item.item_type),
    ...(koshaGrounding ? { kosha_grounding: koshaGrounding } : {}),
    ...(displayTitle ? { display_title: displayTitle } : {}),
    ...(displaySummary ? { display_summary: displaySummary } : {})
  };
}

function hasArchiveStyleSifTitle(item: Pick<SafetyReferenceItem, "item_type" | "title">): boolean {
  return item.item_type === "sif-case" && /^\s*\d+\s*\/\s*/u.test(item.title);
}

function stripLabeledPrefix(value: string): string {
  return value.replace(/^\s*(연번|재해개요|기인물|재해유발요인|위험성\s*감소대책(?:\([^)]*\))?)\s*:\s*/u, "").trim();
}

function extractSifAccidentOverview(item: Pick<SafetyReferenceItem, "summary" | "body">): string | null {
  const text = [item.summary, item.body || ""].filter(Boolean).join("\n");
  const match = text.match(/재해개요\s*:\s*([\s\S]*?)(?=\n?\s*(?:연번|업종|사업장명|발생형태|재해발생형태|기인물|재해유발요인|위험성\s*감소대책(?:\([^)]*\))?|공종|작업내용|원인|대책)\s*:|$)/u);
  if (!match) return null;
  const overview = stripLabeledPrefix(match[1] || "").replace(/\s+/g, " ").trim();
  return overview || null;
}

function cleanSifAccidentOverview(value: string): string {
  return value
    .replace(/^\s*(?:\d{4}\s*년\s*\d{1,2}\s*월(?:\s*\d{1,2}\s*일)?\s*경?|\d{4}\s*\.\s*\d{1,2}\s*\.\s*\d{1,2}\s*\.?|\d{4}-\d{1,2}-\d{1,2})\s*[.,]?\s*/u, "")
    .replace(/^\s*(?:피해자|피재자|재해자|근로자|작업자)(?:가|는|이)\s+/u, "")
    .replace(/\s+(?:피해자|피재자|재해자|근로자|작업자)(?:가|는|이)\s+/gu, " ")
    .replace(/[.。]\s*$/u, "")
    .replace(/\s+/g, " ")
    .trim();
}

function appendCaseSuffix(value: string): string {
  if (/사례$/u.test(value)) return value;
  return `${value} 사례`;
}

function deriveSifDisplayTitle(item: SafetyReferenceItem): string | null {
  if (!hasArchiveStyleSifTitle(item)) return null;
  const overview = extractSifAccidentOverview(item);
  if (!overview) return null;
  const cleaned = cleanSifAccidentOverview(overview);
  if (!cleaned) return null;
  return appendCaseSuffix(compactText(cleaned, 86));
}

function deriveSifDisplaySummary(item: SafetyReferenceItem): string | null {
  if (!hasArchiveStyleSifTitle(item)) return null;
  const overview = extractSifAccidentOverview(item);
  if (!overview) return null;
  const cleaned = cleanSifAccidentOverview(overview);
  return cleaned ? compactText(cleaned, 140) : null;
}

export function getSafetyReferenceDisplayTitle(item: SafetyReferenceItem): string {
  return item.display_title || deriveSifDisplayTitle(item) || item.title;
}

function stripRawSifSummaryLabels(value: string): string {
  return value
    .replace(/\b(?:연번|재해개요|기인물|재해유발요인|위험성\s*감소대책(?:\([^)]*\))?)\s*:\s*/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function getSafetyReferenceDisplaySummary(item: SafetyReferenceItem): string {
  const displaySummary = item.display_summary || deriveSifDisplaySummary(item);
  if (displaySummary) return displaySummary;
  return compactText(stripRawSifSummaryLabels(item.short_summary || item.summary || item.title), 140);
}

const OPERATIONAL_RISK_PATTERN = /추락|전도|질식|폭발|화재|감전|붕괴|끼임|협착|충돌|낙하|비래|중독|매몰|익사|화상|절단|전기|소음|분진|밀폐|강풍|유해/;
const OPERATIONAL_ACTION_PATTERN = /중지|차단|통제|부착|배치|체결|착용|잠금|설치|공유|교육|보고|복창|격리|환기|측정/;
const GENERIC_OPERATIONAL_CONTROL_PATTERN = /유해[·\s]?위험요인.*확인|관리감독자.*확인|필수 확인 항목|현장 확인 항목|일반 안전사항/;

function operationalIdentityText(item: SafetyReferenceItem): string {
  return [
    getSafetyReferenceDisplayTitle(item),
    item.title,
    item.category || "",
    item.subcategory || "",
    item.summary,
    item.body || "",
    ...item.risk_tags,
    ...item.keywords
  ].join(" ");
}

function stripOperationalCountermeasures(value: string): string {
  return value.split(/위험성\s*감소대책(?:\s*\(예시\))?\s*:/u, 1)[0] || "";
}

function operationalIncidentText(item: SafetyReferenceItem): string {
  const narrative = [
    stripOperationalCountermeasures(item.summary),
    stripOperationalCountermeasures(item.body || "")
  ].join(" ");
  if (item.item_type === "sif-case") return narrative;
  return [
    getSafetyReferenceDisplayTitle(item),
    item.title,
    item.category || "",
    item.subcategory || "",
    narrative,
    ...item.keywords
  ].join(" ");
}

function extractOperationalAccidentType(text: string): string {
  const match = text.match(/재해종류\s*:\s*([^\n.;]{1,24}?)(?=\s+재해개요\s*:|[.;]|$)/u);
  return match?.[1]?.trim() || "";
}

function extractOperationalIncidentOverview(text: string): string {
  const overviewMarker = /재해개요\s*:/u;
  const firstMarkerIndex = text.search(overviewMarker);
  const prefix = firstMarkerIndex > 0 ? text.slice(0, firstMarkerIndex).trim() : "";
  const structuredPrefix = /(?:^|\s)(?:자료유형|제목|분류|요약|본문|연번|고위험작업[·\s]*상황|column_\d+|산재업종\s*\([^)]*\))\s*:/u.test(prefix);
  const unlabelledSummary = prefix && !structuredPrefix ? prefix : "";
  const labelledOverviews = [...text.matchAll(
    /재해개요\s*:\s*([\s\S]*?)(?=\s+재해개요\s*:|\s+기인물\s*:|\s+고위험작업[·\s]*상황\s*:|\s+재해유발요인\s*:|$)/gu
  )]
    .map((match) => match[1]?.trim() || "")
    .filter(Boolean);
  const incidentSections = [...new Set([unlabelledSummary, ...labelledOverviews].filter(Boolean))];
  return incidentSections.length ? incidentSections.join(" ") : text;
}

export function getSafetyReferenceOperationalIncidentOverview(item: SafetyReferenceItem): string {
  return extractOperationalIncidentOverview(operationalIncidentText(item));
}

function normalizeOperationalRiskTag(value: string | null | undefined): string {
  return compactText(value || "", 24)
    .replace(/\s*위험(?:요인)?$/g, "")
    .replace(/\s*관련$/g, "")
    .trim();
}

function stripOperationalTitle(value: string): string {
  return value
    .replace(/^[A-Z]-[A-Z]-\d{1,4}-\d{4}\s*/i, "")
    .replace(/^\d{4,}\s*/, "")
    .replace(/\s*에\s*관한\s*(기술지원규정|기술지침|안전작업지침|가이드|지침)$/g, "")
    .replace(/\s*(기술지원규정|기술지침|안전작업지침|가이드|지침)$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function operationalHazardSubjectFromControl(value: string | undefined): string {
  const control = compactText(value || "", 92);
  if (!control) return "";
  const subject = control
    .replace(/^작업\s*(전|중|후)\s*/g, "")
    .replace(/\s*사전\s*/g, " ")
    .replace(/\s*상태를?\s*확인(?:합니다)?\.?$/g, "")
    .replace(/\s*여부를?\s*확인(?:합니다)?\.?$/g, "")
    .replace(/\s*확인(?:합니다)?\.?$/g, "")
    .replace(/\s*점검(?:합니다)?\.?$/g, "")
    .replace(/\s*측정(?:합니다)?\.?$/g, "")
    .replace(/[.。]$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!subject) return "";
  const suffix = OPERATIONAL_ACTION_PATTERN.test(control) ? "미이행" : /점검/.test(control) ? "미점검" : "미확인";
  return compactText(`${subject} ${suffix}`, 84);
}

function deriveDefaultOperationalHazard(item: SafetyReferenceItem, controls: string[]): string {
  const explicitTag = normalizeOperationalRiskTag(item.risk_tags.find((tag) => OPERATIONAL_RISK_PATTERN.test(tag)));
  const categoryTag = normalizeOperationalRiskTag(item.category);
  const subcategoryTag = normalizeOperationalRiskTag(item.subcategory);
  const title = stripOperationalTitle(getSafetyReferenceDisplayTitle(item));
  const titleTag = normalizeOperationalRiskTag(title.match(OPERATIONAL_RISK_PATTERN)?.[0]);
  const riskTag = explicitTag || (OPERATIONAL_RISK_PATTERN.test(categoryTag) ? categoryTag : "") ||
    (OPERATIONAL_RISK_PATTERN.test(subcategoryTag) ? subcategoryTag : "") || titleTag;
  const controlSubject = operationalHazardSubjectFromControl(controls[0]) ||
    operationalHazardSubjectFromControl(getSafetyReferenceDisplaySummary(item));
  const titleSubject = title
    ? /사례|재해|사고/.test(title)
      ? compactText(`${title} 재발 위험`, 84)
      : compactText(`${title} 조치 미확인`, 84)
    : "";
  const subject = controlSubject || titleSubject;
  if (riskTag && subject) return `${riskTag} 위험: ${subject}`;
  if (riskTag) return `${riskTag} 위험: 현장 조치 미확인`;
  if (subject) return /위험/.test(subject) ? subject : `${subject} 관련 위험`;
  return "DB 하네스 근거 기반 위험요인";
}

function genericOperationalView(item: SafetyReferenceItem): SafetyReferenceOperationalView {
  const displaySummary = getSafetyReferenceDisplaySummary(item);
  const rawControls = item.controls.map((control) => control.trim()).filter(Boolean);
  const onlyGenericControls = rawControls.length > 0 && rawControls.every((control) => GENERIC_OPERATIONAL_CONTROL_PATTERN.test(control));
  if (onlyGenericControls) {
    const subject = stripOperationalTitle(getSafetyReferenceDisplayTitle(item)) || "일반 안전 참고자료";
    return {
      hazard: `검토 필요: ${compactText(subject, 64)}의 현장 위험요인 미확정`,
      controls: [
        "근거 원문과 현장 조건을 대조해 위험요인·통제대책 검토",
        "관리감독자 검토 완료 전 특정 통제대책으로 확정하지 않음"
      ],
      reviewRequired: true
    };
  }

  const controls = rawControls.length
    ? rawControls
    : [displaySummary || "근거 원문의 위험요인과 통제대책 검토", "관리감독자 확인 후 현장 통제대책 확정"];
  return {
    hazard: deriveDefaultOperationalHazard(item, controls),
    controls,
    reviewRequired: rawControls.length === 0
  };
}

export function deriveSafetyReferenceOperationalView(item: SafetyReferenceItem): SafetyReferenceOperationalView {
  const technicalKosha = isKoshaTechnicalReference(item);
  const explicitKoshaDecision = technicalKosha && (item.kosha_grounding || item.kosha_guide)
    ? getKoshaGroundingDecision(item)
    : null;
  if (
    (explicitKoshaDecision && !explicitKoshaDecision.supportingCitationEligible)
    || (!technicalKosha && !isSafetyReferenceDirectEligible(item))
  ) {
    return {
      hazard: `검토 필요: ${compactText(getSafetyReferenceDisplayTitle(item), 64)} 근거 상태 미확정`,
      controls: ["검증된 현행 원문과 provenance를 확인한 뒤 기술적 보조지침으로 사용"],
      reviewRequired: true
    };
  }
  const text = operationalIdentityText(item);
  const incidentText = operationalIncidentText(item);
  const accidentType = extractOperationalAccidentType(incidentText);
  const eventText = getSafetyReferenceOperationalIncidentOverview(item);
  const isSif = item.item_type === "sif-case";
  const hasAccidentType = Boolean(accidentType);
  const fallEventSignal = (
    /(?:재해자|작업자|근로자|피재자).{0,100}(?:추락|떨어져|떨어짐|아래로\s*떨어)/u.test(eventText) ||
    /(?:작업대|작업발판|사다리|비계|개구부|단부|지붕|고소작업대).{0,60}(?:추락|떨어)/u.test(eventText)
  );
  const sifFallRiskCandidate = isSif && (
    /추락|떨어짐/u.test(accidentType) ||
    (!hasAccidentType && fallEventSignal)
  );
  const sifPinchRisk = isSif && (
    /끼임|협착|말림|절단/u.test(accidentType) ||
    /끼어|끼여|끼임|끼이|끼일|끼인|끼고|끼며|끼면서|협착|말림/u.test(eventText)
  );
  const poweredEquipmentTerm = /항타기|천공기|혼합기|교반기|분쇄기|롤러|언코일러|코일이송장치|언로더|압연설비|칠러|스크류\s*컨베이어|컨베이어|리프트|고소작업대|산업용\s*로봇|로봇|진공성형기|병입기|환편기|굴삭기|엔진|샤프트|드릴(?:링)?\s*기계|드릴|기계식\s*주차(?:장|기)|주차설비|균형추|와이어로프|드럼|기어(?:박스)?|구동부품|승강기|승강설비|의료장비\s*테이블|설비|기계/u;
  const poweredEquipmentCausalSignal = (
    /(?:항타기|천공기|혼합기|교반기|분쇄기|롤러|언코일러|코일이송장치|언로더|압연설비|칠러|스크류\s*컨베이어|컨베이어|리프트|고소작업대|산업용\s*로봇|로봇|진공성형기|병입기|환편기|굴삭기|엔진|샤프트|드릴(?:링)?\s*기계|드릴|기계식\s*주차(?:장|기)|주차설비|균형추|와이어로프|드럼|기어(?:박스)?|구동부품|승강기|승강설비|의료장비\s*테이블|설비|기계).{0,140}(?:불시\s*|갑자기\s*|재)?(?:작동|가동|동작|회전|상승|하강|움직|감기|말리|구동(?:되|하|\s*중))/u.test(eventText) ||
    /(?:불시\s*|갑자기\s*|재)?(?:작동|가동|동작|회전|상승|하강|움직|감기|말리|구동(?:되|하|\s*중)).{0,140}(?:항타기|천공기|혼합기|교반기|분쇄기|롤러|언코일러|코일이송장치|언로더|압연설비|칠러|스크류\s*컨베이어|컨베이어|산업용\s*로봇|로봇|진공성형기|병입기|환편기|굴삭기|엔진|샤프트|드릴|기계식\s*주차(?:장|기)|주차설비|균형추|와이어로프|드럼|기어|승강기|승강설비|의료장비\s*테이블|설비|기계)/u.test(eventText) ||
    /자동화\s*라인.{0,80}(?:점검|진입).{0,80}설비.{0,60}(?:끼|협착)|운전\s*중인.{0,80}(?:레버조립설비|설비).{0,100}(?:셔틀|프레임).{0,60}(?:끼|협착)/u.test(eventText)
  );
  const poweredGravityFailureSignal = /(?:리프트|승강기|승강설비).{0,160}(?:체인.{0,60}파단|운반구.{0,80}(?:낙하|떨어|함께\s*떨어)|불시.{0,40}(?:하강|작동).{0,80}(?:깔|끼))|(?:운반구|균형추).{0,120}(?:낙하|떨어|하강).{0,80}(?:리프트|승강기|끼|협착)/u.test(eventText);
  const liftUnexpectedMotionRisk = isSif && /리프트|엘리베이터|승강기|운반구/u.test(eventText) && /갑자기|불시|고장|수리|점검|설치|작업|작동|이동/u.test(eventText) && /상승|하강|올라가|내려/u.test(eventText) && /끼어|끼여|끼임|협착|추락|떨어/u.test(eventText);
  const detachedObjectMotionSignal = /(?:전석|우수관|수로관|배관|판넬|화물|적재물|자재|부재)(?:이|가|은|는).{0,120}(?:낙하|떨어|회전|넘어|전도|이탈|빠지)/u.test(eventText);
  const poweredEquipmentPinchCandidate = isSif && sifPinchRisk && poweredEquipmentTerm.test(eventText) && (poweredEquipmentCausalSignal || poweredGravityFailureSignal) && !detachedObjectMotionSignal;
  const machineryTerm = /프레스|선반|컨베이어|쇄석기|파쇄기|팔파기|이송\s*스크류|스크류\s*펌프|무빙워크|사출\s*성형기|사출성형기|산업용\s*로봇|기계설비|가동부|회전체|배수펌프|턴테이블|화물적재기/u;
  const forkliftMaintenanceIdentity = (
    /지게차.{0,24}(?:엔진|연료계통|배터리|유압|브레이크|구동부).{0,16}(?:정비|보수|수리|점검)|지게차\s*(?:정비|보수|수리)/u.test(eventText)
  );
  const machineryMaintenanceIdentity = (
    /(?:프레스|선반|컨베이어|사출\s*성형기|사출성형기|산업용\s*로봇|기계설비|가동부|회전체|배수펌프|턴테이블|화물적재기).{0,60}(?:정비(?!고)|보수|수리|점검|조정)|(?:정비(?!고)|보수|수리|점검|조정).{0,60}(?:프레스|선반|컨베이어|사출\s*성형기|사출성형기|산업용\s*로봇|기계설비|가동부|회전체|배수펌프|턴테이블|화물적재기)/u.test(eventText)
  );
  const machineryIdentity = item.item_type === "machinery" || machineryTerm.test(eventText) || forkliftMaintenanceIdentity;
  const hazardousEnergyIdentity = (
    /불시기동|전원\s*차단|잠금표지|LOTO|에너지\s*격리/u.test(eventText) ||
    forkliftMaintenanceIdentity || machineryMaintenanceIdentity
  );
  const sifMachineryMaintenanceRisk = isSif && machineryIdentity && hazardousEnergyIdentity;
  const sifMachineryPinchRisk = isSif && machineryIdentity && sifPinchRisk;
  const forkliftIncident = isSif && /지게차/u.test(eventText);
  const workPlatformEdgeFallRisk = isSif && /작업발판/u.test(eventText) && /단부/u.test(eventText) && /추락|떨어/u.test(eventText);
  const forkliftRidingSignal = (
    /(?:포크|파렛트).{0,40}(?:탑승|올라|승강)|(?:탑승|올라|승강).{0,40}(?:포크|파렛트)|(?:재해자|작업자|근로자).{0,60}(?:포크|파렛트)\s*(?:위|상부|에)\s*(?:에서|올라|탑승)/u.test(eventText)
  );
  const sifForkliftRidingFallRisk = forkliftIncident && forkliftRidingSignal && sifFallRiskCandidate;
  const sifForkliftRidingPinchRisk = forkliftIncident && forkliftRidingSignal && sifPinchRisk && !sifForkliftRidingFallRisk;
  const sifForkliftParkingRisk = forkliftIncident && (
    /(?:주차|정차).{0,100}(?:밀(?:리|려)|뒤로\s*밀|불시\s*이동|움직|구름|브레이크)|(?:밀(?:리|려)|뒤로\s*밀|불시\s*이동|움직|구름).{0,100}(?:주차|정차)/u.test(eventText)
  );
  const sifForkliftRolloverRisk = forkliftIncident && !workPlatformEdgeFallRisk && (
    /지게차\s*(?:전도|전복|넘어지|기울어지)|지게차(?:가|이|는|은).{0,100}(?:전도|전복|넘어지|기울어지|굴러\s*떨어)|(?:(?:전도|전복)되는|넘어지는)\s*지게차|지게차.{0,140}(?:도크|단부).{0,100}(?:아래로\s*떨어|추락)/u.test(eventText)
  );
  const forkliftRolloverWithLoad = sifForkliftRolloverRisk && /적재물|마대|화물|하역/u.test(eventText);
  const vehicleTerm = /지게차|암롤트럭|압롤트럭|덤프트럭|화물운반트럭|화물자동차|화물차량|화물차|운반차|셔틀차량|믹서트럭|레미콘|펌프카|트럭|작업차량|차량탑재형\s*고소작업대|차량|고소작업차|고소작업대|하역운반기계|건설기계|타이어\s*롤러|로울러|스키드로더|불도저|살수차|페이로더|(?<!언)로더|굴삭기|굴착기|천공기|백호|크램쉘|크람쉘/u;
  const vehicleIncident = isSif && vehicleTerm.test(eventText);
  const pumpCarBrakeReleasePinchRisk = isSif && /펌프카/u.test(eventText) && /제동장치|주차브레이크|공압호스/u.test(eventText) && /풀리|빠져|이탈/u.test(eventText) && /움직|밀리|불시\s*이동/u.test(eventText) && /끼어|끼임|협착/u.test(eventText);
  const mobileEquipmentSwingPinchRisk = isSif && /굴삭기|굴착기/u.test(eventText) && /회전|선회/u.test(eventText) && /뒷부분|후미|후방/u.test(eventText) && /사면|벽체|구조물/u.test(eventText) && /끼어|끼여|끼임|협착/u.test(eventText);
  const vehicleRolloverSubjectSignal = (
    /(?:지게차|덤프트럭|믹서트럭|화물자동차|화물차량|화물차|트럭|작업차량|셔틀차량|차량|고소작업대|건설기계|스키드로더|불도저|살수차|페이로더|로더|굴삭기|굴착기|천공기|백호)(?:가|이|는|은)(?:(?!재해자|작업자|근로자|피재자).){0,180}(?:전도|전복|넘어지|넘어가|굴러\s*떨어|(?:아래로\s*)?떨어|추락)|(?:(?:전도|전복)되는|넘어지는)\s*(?:지게차|덤프트럭|믹서트럭|화물자동차|화물차|차량|고소작업대|건설기계|스키드로더|불도저|살수차|페이로더|로더|굴삭기|굴착기|천공기)/u.test(eventText) ||
    /(?:스키드로더|굴삭기|굴착기|덤프트럭|믹서트럭|로더|천공기)에\s*탑승한\s*채.{0,60}(?:전도|전복|굴러\s*떨어|아래로\s*추락)|(?:덤프트럭|믹서트럭|화물자동차|트럭|굴삭기|굴착기|로더|천공기)(?:을|를).{0,80}운전.{0,120}(?:경로를?\s*이탈|굴러\s*떨어|전도|전복)|(?:로더|굴삭기|굴착기|덤프트럭|믹서트럭).{0,120}운전석.{0,60}(?:넘어지|전도|전복)/u.test(eventText) ||
    /(?:굴삭기|굴착기|백호|지게차)(?:의)?\s*(?:궤도|바퀴)가.{0,80}(?:이탈|부딪).{0,80}(?:전도|전복|넘어지)|(?:덤프트럭|화물자동차|화물차|트럭).{0,120}(?:후진|주행|운행).{0,100}(?:차량에\s*탑승한\s*채|운전원).{0,80}(?:아래로\s*추락|굴러\s*떨어)|(?:믹서트럭|레미콘).{0,180}(?:운전|이동).{0,120}(?:전도|전복)|(?:굴삭기|굴착기|백호|지게차|천공기).{0,240}(?:앞바퀴|뒷바퀴|궤도|차체|장비|선회).{0,100}(?:무게중심.{0,40})?(?:전도|전복)|(?:굴삭기|굴착기|천공기).{0,240}(?:미끄러|경사면).{0,100}(?:전도|전복)|(?:굴삭기|굴착기|천공기).{0,180}(?:장비|굴삭기|굴착기|천공기)와\s*함께.{0,80}(?:추락|떨어)|(?:덤프트럭|굴삭기|굴착기|천공기).{0,100}운전.{0,180}(?:임도|경사|지반|가설도로|석산|단부|아래로).{0,100}(?:이탈|무너지|추락|떨어)/u.test(eventText)
  );
  const aerialGroundInstabilityRisk = isSif && /고소작업(?:대|차)/u.test(eventText) && /아웃트리거|지반/u.test(eventText) && /침하|기울/u.test(eventText);
  const aerialStructuralFailureRisk = isSif && /고소작업(?:대|차)|차량탑재형\s*고소작업/u.test(eventText) && /(?:턴테이블.{0,80}(?:볼트|체결부).{0,60}파단)|(?:붐|Boom).{0,100}(?:파단|꺾)|(?:힌지|용접부).{0,80}파단/u.test(eventText) && /추락|떨어/u.test(eventText);
  const aerialPlatformRolloverRisk = isSif && !aerialStructuralFailureRisk && (
    aerialGroundInstabilityRisk ||
    /고소작업(?:대|차)(?:가|이|는|은).{0,100}(?:전도|전복|넘어지|넘어져|넘어짐|기울어)/u.test(eventText) ||
    /고소작업(?:대|차).{0,140}(?:차대|차체|바퀴)(?:가|이|는|은).{0,80}(?:전도|전복|넘어지|넘어져|넘어짐|기울어)|(?:(?:전도|전복)되는|넘어지는)\s*고소작업(?:대|차)/u.test(eventText)
  );
  const vehicleParkingMovementRisk = vehicleIncident && /주차|정차/u.test(eventText) && /불시\s*이동|움직|전진|밀(?:리|려)|굴러|구름/u.test(eventText);
  const vehicleRolloverRisk = vehicleIncident && !sifForkliftRolloverRisk && !aerialPlatformRolloverRisk && !vehicleParkingMovementRisk && (
    vehicleRolloverSubjectSignal
  );
  const vehicleSlopeRollbackRisk = vehicleIncident && !vehicleRolloverRisk && /비탈|경사|내리막/u.test(eventText) && /밀(?:리|려)|굴러|구름|미끄러|움직|전진|돌진|불시\s*이동/u.test(eventText);
  const vehicleMotionSignal = (
    /(?:지게차|덤프트럭|화물자동차|화물차량|화물차|운반차|트럭|작업차량|차량|고소작업대|건설기계|타이어\s*롤러|로울러|스키드로더|불도저|살수차|페이로더|로더|굴삭기|굴착기|천공기|백호).{0,120}(?:후진|주행|운행|운전(?!기사|원)|이동(?!식)|이송|출차|전진|우회전|좌회전|선회|돌진)|(?:후진|주행|운행|운전(?!기사|원)|이동(?!식)|이송|출차|전진|우회전|좌회전|선회|돌진).{0,120}(?:지게차|덤프트럭|화물자동차|화물차|운반차|트럭|작업차량|차량|건설기계|타이어\s*롤러|로울러|스키드로더|로더|굴삭기|굴착기)/u.test(eventText)
  );
  const vehicleWorkerImpactSignal = (
    /(?:지게차|덤프트럭|화물자동차|화물차|트럭|작업차량|건설기계|스키드로더|불도저|페이로더|로더|굴삭기|굴착기|백호).{0,100}(?:철골|구조물|벽체|기둥|설비).{0,80}사이.{0,50}(?:끼어|끼임|협착)|(?:재해자|작업자|근로자|피재자).{0,100}(?:지게차|덤프트럭|화물자동차|화물차|트럭|작업차량|건설기계|스키드로더|불도저|페이로더|로더|굴삭기|굴착기|백호).{0,80}(?:바퀴|궤도|후미|후방|작업반경).{0,50}(?:깔|충돌|부딪|끼|협착)/u.test(eventText)
  );
  const vehicleAccessFallRisk = vehicleIncident && !vehicleRolloverRisk && !vehicleMotionSignal && (
    /(?:재해자|작업자|운전자).{0,120}(?:적재함|화물자동차|화물차|화물트럭|트럭|차량).{0,100}(?:올라|내려오|승차|하차|승하차)|(?:적재함|화물자동차|화물차|화물트럭|트럭|차량).{0,120}(?:재해자|작업자|운전자).{0,100}(?:올라|내려오|승차|하차|승하차)/u.test(eventText)
  ) && /(?:재해자|작업자|운전자).{0,360}(?:추락|떨어져|떨어지면서|떨어짐|아래로\s*떨어)/u.test(eventText);
  const carLiftOpeningFallRisk = isSif && /카리프트/u.test(eventText) && /개구부/u.test(eventText) && /추락|떨어/u.test(eventText);
  const crusherRotorPinchRisk = isSif && /쇄석기|크라샤/u.test(eventText) && /로터|Blow\s*bar|임팩트\s*curtain/iu.test(eventText) && /원석|이물질/u.test(eventText) && /제거|꺼내/u.test(eventText) && /끼어|끼임|협착|사이에\s*빠/u.test(eventText);
  const craneBucketCrusherFallRisk = isSif && /(?:고정식\s*)?크레인\s*버킷/u.test(eventText) && /부딪|충돌/u.test(eventText) && /파쇄기/u.test(eventText) && /추락|떨어/u.test(eventText);
  const crusherOpeningFallRisk = isSif && !/컨베이어/u.test(eventText) && /파쇄기/u.test(eventText) && /투입|폐기물/u.test(eventText) && /추락|떨어/u.test(eventText);
  const aerialObstructionReleaseFallRisk = isSif && /고소작업대/u.test(eventText) && /가드/u.test(eventText) && /비계파이프/u.test(eventText) && /걸려|걸림/u.test(eventText) && /절단/u.test(eventText) && /출렁|반동/u.test(eventText) && /추락|떨어/u.test(eventText);
  const automatedLinePinchRisk = isSif && /자동화설비|이재기/u.test(eventText) && /컨베이어\s*(?:프레임|프레인)/u.test(eventText) && /끼어|끼임|협착/u.test(eventText);
  const palletFootholdFallRisk = isSif && /파렛트/u.test(eventText) && /발을\s*딛|임시\s*발판/u.test(eventText) && /몸의\s*중심|균형/u.test(eventText) && /추락|떨어/u.test(eventText);
  const laundryLoadPushFallRisk = isSif && /세탁물/u.test(eventText) && /쏟아|더미/u.test(eventText) && /밀려/u.test(eventText) && /추락|떨어/u.test(eventText);
  const craneLiftedLoadRidingFallRisk = isSif && /크레인/u.test(eventText) && /달아올린|매달린|인양/u.test(eventText) && /컨베이어|물체|하중/u.test(eventText) && /올라탄|탑승/u.test(eventText) && /기울|추락|떨어/u.test(eventText);
  const excavatorBucketRidingFallRisk = isSif && /굴삭기|굴착기/u.test(eventText) && /버킷|버켓/u.test(eventText) && /올라타|타고\s*올라/u.test(eventText) && /추락|떨어/u.test(eventText);
  const conveyorWorkerAccessSignal = /(?:재해자|작업자|근로자|피재자|순찰원).{0,140}컨베이어(?:\s*벨트)?\s*(?:상부|위)(?:에|에서|로)?\s*(?:올라|이동|건너|통행|작업|확인)/u.test(eventText);
  const conveyorTraversalFallRisk = isSif && conveyorWorkerAccessSignal && /추락|떨어|끼어|끼임|가동/u.test(eventText);
  const vehicleInducedElevatedWorkerFallRisk = isSif && (
    /(?:차량|운반차량)(?:이|가)?.{0,180}(?:출발|이동|지나가|추돌|충돌).{0,220}(?:재해자|작업자).{0,120}(?:추락|떨어)|(?:재해자|작업자).{0,180}(?:적재함|작업대|고소작업대).{0,140}차량(?:이|가).{0,50}(?:출발|이동).{0,140}(?:재해자|작업자).{0,100}(?:추락|떨어)/u.test(eventText)
  );
  const vehicleTrafficCandidate = vehicleIncident && !sifForkliftParkingRisk && !sifForkliftRolloverRisk && !vehicleRolloverRisk && !vehicleSlopeRollbackRisk && (
    (vehicleMotionSignal || vehicleWorkerImpactSignal) && (
      /충돌|부딪|끼어|끼임|협착|깔려|깔림|치여|앞바퀴|뒷바퀴|사각지대/u.test(eventText) ||
      /충돌|부딪힘|끼임|깔림/u.test(accidentType)
    )
  ) && !conveyorTraversalFallRisk;
  const poweredEquipmentPinchRisk = poweredEquipmentPinchCandidate && !vehicleTrafficCandidate && !vehicleRolloverRisk && !vehicleSlopeRollbackRisk;
  const objectDropStrikeSignal = /(?:이|가)\s*.{0,60}(?:낙하|떨어|넘어|무너|전도|파단|이탈).{0,100}(?:재해자|작업자|근로자|피재자).{0,50}(?:맞|깔|타격)/u.test(eventText);
  const pipeLoadFailureSignal = /(?:우수관|수로관|배관)(?:이|가|은|는).{0,100}(?:빠지|회전|넘어|전도|낙하|떨어)/u.test(eventText);
  const elevatedWorkerDirectFallSignal = isSif && (
    /(?:재해자|작업자|근로자|피재자).{0,180}(?:적재함|톤백\s*위|트럭\s*위|화물자동차|화물트럭).{0,180}(?:몸의\s*중심|균형|차량이\s*출발|이동하는\s*과정|이동\s*중).{0,100}(?:추락|떨어)|(?:적재함|톤백\s*위|트럭\s*위).{0,120}(?:몸의\s*중심|균형).{0,80}(?:추락|떨어)/u.test(eventText)
  );
  const directWorkerFallSignal = (elevatedWorkerDirectFallSignal || fallEventSignal) && (!accidentType || /추락|떨어짐/u.test(accidentType)) && !/(?:맞|깔|덮치|강타|타격|충격|협착|끼어|끼여|끼임)/u.test(eventText);
  const causalLoadFailureSignal = (
    pipeLoadFailureSignal || /(?:중량물|모터|코일|자연석|철근\s*다발|철\s*구조물|철구조물|지보재|화물(?!운반트럭|자동차|차량|차|적재기)|적재물|몰탈\s*믹서기|믹서기|PHC\s*파일|기초파일|파일)(?:이|가|은|는|을|를)?\s*.{0,120}(?:넘어|전도|낙하|추락|떨어|빠지|쏟아|덮치|굴러|붕괴|깔림)|(?:넘어|전도|낙하|추락|떨어|빠지|쏟아|덮치|굴러|붕괴).{0,100}(?:중량물|모터|코일|자연석|철근\s*다발|철\s*구조물|철구조물|지보재|화물(?!운반트럭|자동차|차량|차|적재기)|적재물|몰탈\s*믹서기|믹서기|PHC\s*파일|기초파일|파일)/u.test(eventText)
  );
  const supportedHeavyObjectFailureSignal = /(?:철근|금형|금속\s*구조물|프레임|톤백|강관|동력전달판|케이싱|버팀대|PC\s*기둥|PC기둥|몰드커버|선박\s*블록|블록|운반대차|판유리).{0,180}(?:넘어|전도|기울|움직|이탈|변형|파손|탈락|부서|무게중심|낙하|떨어|구르)|(?:고임목|받침대|캐스터|바퀴).{0,100}(?:부서|파손|탈락|이탈|변형).{0,120}(?:금형|블록|운반대차|판유리|끼어|협착)/u.test(eventText);
  const loadFailureSignal = (
    !directWorkerFallSignal && (objectDropStrikeSignal || causalLoadFailureSignal || supportedHeavyObjectFailureSignal || /(?:적재물|적재된\s*물체|화물|자재|철근\s*다발|철\s*구조물|철구조물|지보재|톤백|인양화물|프레임|구조부재|압력용기|전주|부재|버킷|드롭해머|토석|암석|비산석|PHC\s*파일|기초파일|파일|몰탈\s*믹서기|믹서기|벌도목|나무|강관파이프|거푸집|완충기|조경블록|H빔|파이프\s*묶음|목재\s*묶음|(?:연료|경유)?탱크|금속용기)(?:\s*일부)?(?:이|가|을|를)\s*.{0,120}(?:낙하|떨어|날아|넘어|무너|붕괴|전도|구르|파단|이탈|타격|가격|깔림)|(?:적재물|화물|자재|철근\s*다발|철\s*구조물|철구조물|지보재|톤백|인양화물|프레임|구조부재|압력용기|전주|부재|버킷|드롭해머|토석|암석|비산석|PHC\s*파일|기초파일|파일|몰탈\s*믹서기|믹서기|벌도목|나무|강관파이프|거푸집|완충기|조경블록|H빔|파이프\s*묶음|목재\s*묶음|(?:연료|경유)?탱크|금속용기)\s*(?:낙하|떨어|날아|넘어|무너|붕괴|전도|구르|파단|이탈)|(?:낙하|떨어|날아|넘어|무너|붕괴|전도|구르|파단|이탈).{0,60}(?:적재물|화물|자재|철근\s*다발|철\s*구조물|철구조물|지보재|톤백|인양화물|프레임|구조부재|압력용기|전주|부재|버킷|드롭해머|토석|암석|비산석|PHC\s*파일|기초파일|파일|몰탈\s*믹서기|믹서기|벌도목|나무|강관파이프|거푸집|완충기|조경블록|H빔|파이프\s*묶음|목재\s*묶음|(?:연료|경유)?탱크|금속용기)/u.test(eventText))
  );
  const sifFallRisk = sifFallRiskCandidate && !loadFailureSignal;
  const sifVehicleTrafficRisk = vehicleTrafficCandidate && !loadFailureSignal;
  const sifForkliftLoadRisk = forkliftIncident && !sifForkliftRidingFallRisk && !sifForkliftParkingRisk && !sifForkliftRolloverRisk && !sifVehicleTrafficRisk && loadFailureSignal;
  const liftingFailureSignal = /(?:인양|양중).{0,100}(?:낙하|떨어|풀리|이탈|파단|전도|흔들|충돌|부딪|협착|끼임|깔)|(?:훅|슬링|와이어로프).{0,80}(?:미체결|풀리|파단|이탈)|(?:낙하|떨어|흔들).{0,80}(?:인양|양중|인양물|설비|화물)|(?:인양물|양중물|균형추|중량물|매달린\s*하중).{0,120}(?:반발|진자|흔들|튀|충돌|부딪|협착|끼어|끼임|깔림)/u.test(eventText);
  const suspendedLoadIncident = isSif && /크레인|체인블록|인양|양중|와이어로프|슬링|훅|마그넷|굴착기|버킷|드롭해머/u.test(eventText) && (loadFailureSignal || liftingFailureSignal);
  const stackedLoadIncident = isSif && !suspendedLoadIncident && /적재|적층|톤백|쌓|단\s*높이/u.test(eventText) && /무너|넘어|붕괴|깔림/u.test(eventText);
  const blastFlyrockIncident = isSif && /발파/u.test(eventText) && /암석|비산석|돌/u.test(eventText) && /날아|비래|맞아|가격|타격/u.test(eventText);
  const fallingObjectIncident = isSif && !sifForkliftLoadRisk && !suspendedLoadIncident && !stackedLoadIncident && (
    /낙하/u.test(accidentType) || loadFailureSignal
  );
  const explicitFireAccident = /화재|폭발|화상/u.test(accidentType);
  const sifFireRisk = isSif && (explicitFireAccident || (!accidentType && /화재(?!\s*(?:감지기|경보기|설비))|폭발(?!\s*방지)|화염/u.test(eventText)));
  const sifChemicalExposureRisk = isSif && !sifFireRisk && /황산|염소|과산화수소|암모니아|불화수소|황화수소|포스겐|액화질소|아르곤|화학물질|유해물질|독성가스/u.test(eventText) && /누출|비산|분출|배출|흡입|접촉|노출|중독|질식|화상|쓰러/u.test(eventText);
  const sifElectricalArcRisk = isSif && !/아크\s*용접/u.test(eventText) && /(?:전기)?아크(?:\s*(?:폭발|플래시|발생))?|Arc\s*Flash/u.test(eventText) && (
    !accidentType || /화상|폭발|감전/u.test(accidentType)
  );
  const sifElectricalContactRisk = isSif && (
    /감전/u.test(accidentType) || (!accidentType && (/감전(?:되어|으로|사고|위험)/u.test(eventText) || /충전부.{0,40}접촉|누전.{0,40}접촉/u.test(eventText)))
  );
  const portableToolJamFallRisk = isSif && /그라인더.{0,40}(?:날|숫돌).{0,60}(?:끼|걸리)|(?:날|숫돌).{0,60}그라인더.{0,40}(?:끼|걸리)/u.test(eventText) && sifFallRiskCandidate;
  const abrasiveWheelFragmentRisk = isSif && /그라인더|연삭숫돌/u.test(eventText) && /파편|파손|파단|튀/u.test(eventText) && /맞|타격|접촉/u.test(eventText);
  const springStoredEnergyRisk = isSif && /텐션\s*스프링|텐션\s*로드|스프링/u.test(eventText) && /압축|장력/u.test(eventText) && /파단|튀|반발/u.test(eventText) && /맞|타격/u.test(eventText);
  const pressureReleaseSignal = /폭발|파열|파손|분출|급격한\s*누출|내부\s*압력|잔(?:여)?압|압력이?\s*(?:걸려|남아)|(?:호스|Hose).{0,24}(?:터지|파열)|(?:맨홀|캡|뚜껑|경판|문).{0,24}(?:이탈|날아|열|개방)/u.test(eventText);
  const combustionFireSignal = /LPG|LNG|연료가스|인화성|가연성|유기용제|도료|점화원/u.test(eventText) && /화재|폭발/u.test(eventText);
  const sifSteamPressureRisk = isSif && /스팀|수증기|고온\s*증기/u.test(eventText) && (
    pressureReleaseSignal || /(?:연결부|배관|밸브).{0,50}(?:파괴|파열|누출|분출)/u.test(eventText)
  );
  const sifPressureVesselRisk = isSif && (
    /압력(?:밥솥|솥|용기|테스트)|공기압축기|공기저장용기|고압\s*살균기|정련기|염색기|소독기|고압\s*드럼|가압|배관|호스|맨홀|캡/u.test(eventText) &&
    pressureReleaseSignal && !combustionFireSignal && !sifChemicalExposureRisk
  );
  const sifCraneTrafficRisk = isSif && !suspendedLoadIncident && /크레인/u.test(eventText) && (
    /충돌|부딪힘|끼임/u.test(accidentType) || /주행.{0,80}(?:충돌|부딪|끼어)|(?:충돌|부딪|끼어).{0,80}주행/u.test(eventText)
  );
  const sifRaisedEquipmentMaintenanceRisk = isSif && /턴테이블|화물적재기|적재기/u.test(eventText) && /수리|정비|점검/u.test(eventText) && /불시\s*(?:낙하|하강)|끼어|끼임/u.test(eventText);
  const confinedLocationSignal = /밀폐공간|맨홀|탱크|피트|집수정|저장조|반응기|사일로|호퍼|선창|화물창|홀드|오[·\s]?폐수\s*처리시설/u.test(eventText);
  const confinedHazardSignal = /산소결핍|유해가스|질식|중독/u.test(eventText);
  const confinedRescueSignal = /(?:재해자\s*[1-9]|[2-9]\s*명|동료|작업자).{0,160}(?:구조|구출)|(?:구조|구출).{0,160}(?:재해자\s*[1-9]|[2-9]\s*명|동료|작업자)/u.test(eventText) && /쓰러|의식\s*잃/u.test(eventText);
  const sifConfinedSpaceRisk = isSif && (
    /질식|산소결핍/u.test(accidentType) ||
    (confinedLocationSignal && (confinedHazardSignal || confinedRescueSignal))
  );
  const confinedPoweredEquipment = sifConfinedSpaceRisk && /펌프|모터|교반기|믹서|회전체|가동부|기계설비/u.test(eventText);
  const sifDrowningRisk = isSif && (/익사|수몰/u.test(accidentType) || /익사|수몰/u.test(eventText));
  const sifHeatIllnessRisk = isSif && (
    /이상온도|열사병|온열/u.test(accidentType) || /폭염|열사병|온열질환|(?:더위|고온).{0,40}탈진/u.test(eventText)
  );
  const deckStructuralFailureRisk = isSif && /데크\s*플레이트|데크플레이트|데크플래이트|Deck\s*Plate/u.test(eventText) && /무너지|붕괴/u.test(eventText);
  const sifStructuralCollapseRisk = isSif && /붕괴/u.test(accidentType);
  const excavationAdjacentCollapse = sifStructuralCollapseRisk && /굴착|터파기|관로|트렌치|흙막이|사면|토사/u.test(eventText) && /담장|벽체|옹벽|흙막이|사면|토사/u.test(eventText);
  const excavationFaceCollapse = sifStructuralCollapseRisk && /굴착면|굴착부|관로|흄관|트렌치/u.test(eventText) && /붕괴|매몰/u.test(eventText);
  const formworkSlabCollapse = (sifStructuralCollapseRisk || deckStructuralFailureRisk) && /데크|Deck|슬래브|슬라브|동바리|거푸집|콘크리트\s*타설|PC거더|PC빔/u.test(eventText);
  const demolitionCollapse = sifStructuralCollapseRisk && /철거|해체|용단|절단|파쇄/u.test(eventText);
  const craneStructureCollapse = sifStructuralCollapseRisk && /타워크레인|텔레스코픽\s*케이지|메인\s*슈/u.test(eventText);
  const sludgeCollapse = sifStructuralCollapseRisk && /슬러지/u.test(eventText) && /붕괴|매몰/u.test(eventText);
  const tunnelRockfallCollapse = sifStructuralCollapseRisk && /터널|막장|천단부|낙반|부석/u.test(eventText) && /낙반|떨어|붕괴/u.test(eventText);
  const sifEngulfmentRisk = isSif && /사일로|호퍼|저장조/u.test(eventText) && /무너|매몰|붕괴|파묻|함몰|빠져/u.test(eventText);
  const excavatorLoadImpactRisk = isSif && !vehicleRolloverRisk && /굴삭기|굴착기/u.test(eventText) && /운반|인양|내려놓/u.test(eventText) && /맞아|충격|깔|끼/u.test(eventText);
  const raisedVehiclePartRisk = isSif && /적재함|운전석|캡|Cab/u.test(eventText) && /하강|내려오|유압\s*소실|지지대/u.test(eventText) && /끼|협착|깔/u.test(eventText);
  const handCartSlopePinchRisk = isSif && /손수레/u.test(eventText) && /경사|내리막/u.test(eventText) && /밀려|끼어|끼임|협착/u.test(eventText);
  const nonManualPinchContext = /설비|기계|장치|크레인|지게차|굴삭기|굴착기|항타기|리프트|승강기|호이스트|모터|TBM|셔틀|자동화|주차기|엔진|마스트|와이어로프|균형추|카운터웨이트|운반구/u.test(eventText);
  const manualHandlingPinchSignal = !poweredEquipmentPinchRisk && !nonManualPinchContext && /손|손가락|수작업|인력|부재|해체|조립|취급/u.test(eventText);
  const preferMixedMachineryFall = poweredEquipmentPinchRisk && !hasAccidentType && sifFallRisk && sifMachineryMaintenanceRisk;

  if (/D-C-13-2026|외벽도장보수공사/u.test(text)) {
    return {
      hazard: "외벽 도장 중 이동식 비계 작업발판·난간 미확인으로 인한 추락·전도 위험",
      controls: [
        "이동식 비계 작업발판·안전난간·바퀴 잠금·아웃트리거 상태 확인",
        "안전대 체결, 하부 출입통제 및 강풍 시 작업중지 기준 적용"
      ],
      reviewRequired: false
    };
  }

  if (/B-E-20-2026|정전도장기|정전도장/u.test(text)) {
    return {
      hazard: "정전도장 중 정전기 방전과 도료 증기 점화로 인한 화재·폭발 위험",
      controls: [
        "정전도장기·피도장물 접지 및 정전기 제거 상태 확인",
        "방폭형 환기설비 가동 및 화기·스파크 등 점화원 통제"
      ],
      reviewRequired: false
    };
  }

  if (/B-E-17-2026|도장 공정.*(?:화재|폭발|도료|유기용제)/u.test(text)) {
    return {
      hazard: "도장 공정의 도료·유기용제 증기 점화로 인한 화재·폭발 위험",
      controls: [
        "도료·유기용제 취급 구역 국소배기·전체환기 실시",
        "화기·스파크 등 점화원 통제, MSDS·보호구 확인 및 소화기 비치"
      ],
      reviewRequired: false
    };
  }

  if (sifDrowningRisk) {
    const floodInflow = /폭우|집중호우|우수|수문|수위|수몰|터널/u.test(eventText);
    const floatingPlatform = /수상\s*작업발판|바지선|부선|전복/u.test(eventText);
    const pressurizedWater = /수압|상수도관|급수|차단밸브|밸브\s*파손/u.test(eventText);
    return {
      hazard: floodInflow
        ? "폭우·수문 개방에 따른 급격한 우수 유입과 침수·수몰 위험"
        : floatingPlatform
        ? "수상 작업발판 전복·추락에 따른 익사 위험"
        : pressurizedWater
        ? "급수 배관의 잔류 수압과 피트 물 유입에 따른 익사·수몰 위험"
        : "침수 구역·수중 진입 중 익사 위험",
      controls: floodInflow
        ? [
          "강우·수위·수문 상태를 연동 감시하고 유입 우려 시 즉시 작업중지·대피",
          "침수 구역 재진입 금지, 경보·구명기구·수난 구조계획 확보"
        ]
        : floatingPlatform
        ? [
          "수상 작업발판의 부력·정원·무게중심과 전복 방지 상태 확인",
          "구명조끼·구명환·구명줄 착용 및 감시자·수상 구조계획 확보"
        ]
        : pressurizedWater
        ? [
          "급수원을 격리·차단하고 완전 감압 후 피트 물 유입·배수 상태 확인",
          "침수 피트 진입 금지, 구명조끼·구명줄·감시자와 구조계획 확보"
        ]
        : [
          "침수 구역 수영·수중 진입을 금지하고 안전통로·배수·전기 격리 조치",
          "구명조끼·구명줄·감시자와 비상 구조계획 확보"
        ],
      reviewRequired: false
    };
  }

  if (sifHeatIllnessRisk) {
    return {
      hazard: "폭염·고온 작업 중 탈진·온열질환 위험",
      controls: [
        "물·그늘·휴식과 작업강도 조정 계획을 적용하고 폭염 작업중지 기준 확인",
        "작업자 간 이상징후를 상호 확인하고 의식저하 시 즉시 냉각·응급조치"
      ],
      reviewRequired: false
    };
  }

  if (sifStructuralCollapseRisk || deckStructuralFailureRisk) {
    return {
      hazard: tunnelRockfallCollapse
        ? "터널 막장·천단부 부석과 암반 낙반에 따른 장비 운전석 타격·매몰 위험"
        : sludgeCollapse
        ? "탱크 내부 슬러지 과절취면 붕괴에 따른 매몰·질식 위험"
        : excavationFaceCollapse
        ? "굴착면·관로 측벽 붕괴에 따른 작업자 매몰 위험"
        : craneStructureCollapse
        ? "타워크레인 상승·해체 중 균형 상실과 연결부 이탈에 따른 붕괴 위험"
        : demolitionCollapse
        ? "건물·슬래브 철거·해체 중 지지력 상실에 따른 구조물 붕괴·매몰 위험"
        : formworkSlabCollapse
        ? "거푸집·동바리·데크플레이트·슬래브의 하중 초과에 따른 붕괴·추락 위험"
        : excavationAdjacentCollapse
        ? "굴착 인접 담장·벽체·구조물 붕괴·전도로 인한 협착 위험"
        : "구조물 지지력·연결부 상실에 따른 붕괴·매몰 위험",
      controls: tunnelRockfallCollapse
        ? [
          "터널 막장·천단부 부석을 점검·제거하고 지보재·보강 상태를 확인한 뒤 장비 진입",
          "낙반 예상 구역 출입통제, 운전석 방호와 원격·보호 위치 작업방법 적용"
        ]
        : sludgeCollapse
        ? [
          "슬러지 잔존 높이·함수율과 붕괴 가능성을 확인하고 안전한 경사·단계로 반출",
          "붕괴 예상면 하부 진입 금지, 감시인·구조장비와 밀폐공간 진입조치 병행"
        ]
        : excavationFaceCollapse
        ? [
          "굴착 깊이·지반 상태에 맞춰 흙막이·버팀 또는 안전기울기를 적용하고 작업 전 점검",
          "굴착면 하부 출입통제, 사다리·대피통로와 붕괴 감시자를 확보"
        ]
        : craneStructureCollapse
        ? [
          "타워크레인 상승·해체 순서와 균형 상태, 메인 슈·연결부 체결 상태 확인",
          "작업 단계별 지지·고정 상태 확인 및 타워크레인 붕괴 예상 반경 출입통제"
        ]
        : demolitionCollapse
        ? [
          "구조검토에 따라 해체 방법·순서와 잔존 구조물 지지·보강 계획 수립",
          "해체 중 하중 집중·균열·변형을 감시하고 붕괴 예상 반경 출입통제"
        ]
        : formworkSlabCollapse
        ? [
          "설계하중·타설 순서에 맞춰 거푸집·동바리·데크플레이트 설치·접합 상태 확인",
          "타설 중 변형을 감시하고 슬래브 하부 붕괴·추락 예상 구역 출입통제"
        ]
        : excavationAdjacentCollapse
        ? [
          "굴착 전 인접 담장·벽체의 안정성을 조사하고 지지·보강 또는 선해체",
          "구조물 전도·붕괴 예상 반경 출입통제 및 굴착 순서·흙막이 계획 확인"
        ]
        : [
          "구조물 지지력·연결부와 작업하중을 검토하고 임시 지지·보강 상태 확인",
          "붕괴 예상 반경 출입통제 및 작업 순서별 변형·이탈 상태 감시"
        ],
      reviewRequired: false
    };
  }

  if (sifEngulfmentRisk) {
    return {
      hazard: "사일로·호퍼 내부 내용물 붕괴에 따른 매몰·질식 위험",
      controls: [
        "투입·배출원을 격리하고 내용물 붕괴 가능 상태에서 내부 진입 금지",
        "불가피한 진입은 작업허가, 감시인·구조장비와 추락·매몰 방지 조치 후 실시"
      ],
      reviewRequired: false
    };
  }

  if (excavatorLoadImpactRisk) {
    return {
      hazard: "굴삭기 운반물 하강·이동 중 작업자 충돌·타격·끼임 위험",
      controls: [
        "운반물 고정·결속과 굴삭기 운전자·신호수 간 작업 신호 확인",
        "운반물 이동·하강 반경 출입통제 및 작업자 대피 후 내려놓기"
      ],
      reviewRequired: false
    };
  }

  if (sifElectricalArcRisk || sifElectricalContactRisk) {
    return {
      hazard: sifElectricalArcRisk
        ? "전기설비 시험·결선 중 잔류전압과 아크 플래시로 인한 감전·화상 위험"
        : "고압선·충전부 접근 또는 접촉으로 인한 감전 위험",
      controls: [
        "작업 전 전원 차단·검전·접지 및 잠금표지(LOTO) 적용",
        "충전부 접근한계거리 준수, 절연방호와 절연·아크 방호 보호구 착용"
      ],
      reviewRequired: false
    };
  }

  if (sifSteamPressureRisk) {
    return {
      hazard: "스팀 배관·밸브 연결부 파괴로 인한 고온 증기·잔압 분출 위험",
      controls: [
        "스팀 공급원을 격리·차단하고 감압·잔압 제거 후 밸브 조작",
        "배관·연결부 건전성 확인, 작업반경 출입통제 및 방열 보호구 착용"
      ],
      reviewRequired: false
    };
  }

  if (sifPressureVesselRisk) {
    return {
      hazard: "압력설비 가압·개방 중 잔압 방출과 용기·부품 파열·비래 위험",
      controls: [
        "개방 전 공급원을 차단하고 완전 감압·잔압 제거 상태 확인",
        "작업 용도에 적합한 승인 압력용기 사용, 임의 개조 금지 및 안전밸브·방호장치 사전 점검"
      ],
      reviewRequired: false
    };
  }

  if (sifChemicalExposureRisk) {
    return {
      hazard: "부식성·독성·불활성 화학물질 누출·비산에 따른 접촉 화상·흡입·질식 위험",
      controls: [
        "밸브·배관·호스를 격리해 누출원을 차단하고 비상세척설비·적정 보호구 확보",
        "MSDS 확인, 국소배기·환기 및 산소·유해가스 농도 측정"
      ],
      reviewRequired: false
    };
  }

  if (sifFireRisk) {
    const moltenMetalExplosion = /용탕|도가니|반사로/u.test(eventText) && /수분|냉각수|증기(?:폭발)?/u.test(eventText);
    const forkliftFireSource = (
      /지게차.{0,80}(?:연료(?:계통)?|LPG|가스\s*누출|배터리|충전|주유)|(?:연료(?:계통)?|LPG|가스\s*누출|배터리|충전|주유).{0,80}지게차/u.test(eventText)
    );
    const chemicalFireSource = /인화성|가연성|유기용제|도료|LPG|LNG|연료가스|화학물질/u.test(eventText) || (
      /누출/u.test(eventText) && /화재|폭발/u.test(eventText)
    );
    const fireControls = moltenMetalExplosion && hazardousEnergyIdentity
      ? [
        "용탕 투입 원료·도구의 수분 제거와 사전 건조 및 냉각수 누출·유입 차단",
        "정비 전 유해에너지 차단·잠금표지(LOTO) 후 작업반경 출입통제 및 방열 보호구 착용"
      ]
      : moltenMetalExplosion
      ? [
        "용탕 투입 원료·도구의 수분 제거와 사전 건조 확인",
        "냉각수 누출·수분 유입 차단 및 작업반경 출입통제·방열 보호구 착용"
      ]
      : hazardousEnergyIdentity
      ? [
        forkliftFireSource
          ? "지게차 연료·가스·배터리 누출 확인 후 정비 전 전원·연료원 등 유해에너지를 차단하고 잠금표지(LOTO) 적용"
          : "가연물·연료 누출 확인 후 정비 전 전원·연료원 등 유해에너지를 차단하고 잠금표지(LOTO) 적용",
        "잔류 가스·압력·전하 제거 후 환기·점화원 통제 및 적합 소화기 비치"
      ]
      : forkliftFireSource
      ? [
        "지게차 연료·가스·배터리 누출 및 충전·주유 설비 상태 확인",
        "충전·주유 구역 환기, 점화원 통제 및 적합 소화기 비치"
      ]
      : chemicalFireSource
      ? [
        "인화성·가연성 물질의 배관·호스·용기 누출 여부 확인 및 누출원 차단",
        "방폭 환기·가스감지 경보 가동, 점화원 통제 및 적합 소화기 비치"
      ]
      : [
        "사고 원인과 가연물·압력·점화원 상태를 원문에서 재확인",
        "원인 확인 전 작업 중지, 위험구역 출입통제 및 관리감독자 검토"
      ];
    return {
      hazard: moltenMetalExplosion
        ? "용탕에 수분·냉각수가 유입되어 발생하는 증기폭발·화상 위험"
        : forkliftFireSource && hazardousEnergyIdentity
        ? "지게차 정비 중 연료·가스·배터리 누출과 유해에너지로 인한 화재·폭발 위험"
        : forkliftFireSource
        ? "지게차 연료·가스·배터리 누출과 점화원 접촉으로 인한 화재·폭발 위험"
        : chemicalFireSource
        ? "인화성·가연성 물질 누출과 점화원 접촉으로 인한 화재·폭발 위험"
        : "검토 필요: 화재·폭발 사고의 직접 원인 미확정",
      controls: fireControls,
      reviewRequired: !moltenMetalExplosion && !forkliftFireSource && !chemicalFireSource
    };
  }

  if (springStoredEnergyRisk) {
    return {
      hazard: "텐션 스프링·로드의 압축 저장에너지 방출과 파단 부품 비래·타격 위험",
      controls: [
        "분해 전 스프링 장력과 잔류에너지를 단계적으로 방출하고 전용 지그·고정구로 부품 고정",
        "예상 비래 방향 출입통제, 원격·차폐 위치에서 해체하고 손상 부품은 즉시 교체"
      ],
      reviewRequired: false
    };
  }

  if (abrasiveWheelFragmentRisk) {
    return {
      hazard: "그라인더 연삭숫돌 파손·파편 비래로 인한 작업자 타격 위험",
      controls: [
        "연삭숫돌 균열·정격 회전수와 체결 상태를 확인하고 방호덮개를 올바른 위치에 설치",
        "파편 비래 방향을 통제하고 보안면·보안경을 착용한 뒤 공회전 시험 후 작업"
      ],
      reviewRequired: false
    };
  }

  if (portableToolJamFallRisk) {
    return {
      hazard: "그라인더 날 걸림을 해소하다 반력으로 균형을 잃는 추락·끼임 위험",
      controls: [
        "걸린 날을 빼기 전 스위치 전원 차단·플러그 분리·잠금표지(LOTO)로 불시기동 방지",
        "단부 작업발판·안전난간과 안전대 체결 상태를 확보한 뒤 전용 공구로 걸림 해소"
      ],
      reviewRequired: false
    };
  }

  if (/G-67(?:-2011)?|건물 외벽 청소/u.test(text)) {
    return {
      hazard: "건물 외벽 청소 중 작업로프·작업발판에서의 추락 위험",
      controls: [
        "작업로프·안전대·구명줄 체결 및 고정점 사전 점검",
        "작업발판·난간 설치, 하부 출입 통제 및 강풍·우천 시 작업 중지"
      ],
      reviewRequired: false
    };
  }

  if (/B-M-11-2025/u.test(text)) {
    return {
      hazard: "자재 반입 지게차 동선과 작업자 통행 동선 중첩으로 인한 충돌 위험",
      controls: [
        "지게차 동선과 보행 동선을 바닥표시·차단시설로 분리",
        "교차·후진 구간 신호수 배치 및 후진 경보·접근통제 확인"
      ],
      reviewRequired: false
    };
  }

  if (handCartSlopePinchRisk) {
    return {
      hazard: "경사로 중량 손수레 밀림과 벽체·적재물 사이 작업자 끼임 위험",
      controls: [
        "손수레 하중·제동 상태와 경사로 이동방법을 확인하고 필요한 작업 인원 배치",
        "손수레 진행방향 협착구역 접근통제 및 작업자 간 이동 신호 확인"
      ],
      reviewRequired: false
    };
  }

  if (aerialStructuralFailureRisk) {
    return {
      hazard: "고소작업대 턴테이블·붐·힌지 구조부의 볼트·용접부 파단으로 인한 작업대 추락 위험",
      controls: [
        "턴테이블 체결볼트·붐 연결핀·힌지 용접부를 제작사 기준으로 점검하고 변형·균열 부품 즉시 교체",
        "작업대 정격하중을 준수하고 탑승자 안전대 체결·하부 출입통제 후 구조부 이상 시 즉시 사용중지"
      ],
      reviewRequired: false
    };
  }

  if (aerialPlatformRolloverRisk) {
    return {
      hazard: "고소작업대 과다 탑승·불안정 지반·충돌에 따른 전도 및 탑승자 추락 위험",
      controls: [
        "정격 탑승인원·적재하중을 확인하고 수평 지반에서 아웃트리거·안정장치 설치",
        "승인된 주행경로와 크레인 작업반경을 분리하고 안전대 체결·주변 출입통제"
      ],
      reviewRequired: false
    };
  }

  if (carLiftOpeningFallRisk) {
    return {
      hazard: "카리프트 금지구역 재진입 중 차량과 구조물 사이 개구부 추락 위험",
      controls: [
        "카리프트 운행·고장 구역 출입금지와 잠금표지를 유지하고 관리감독자 승인 없이 재진입 금지",
        "차량 주변 개구부에 덮개·안전난간을 설치하고 회수 작업은 설비 정지·고정 후 안전한 작업발판에서 수행"
      ],
      reviewRequired: false
    };
  }

  if (crusherRotorPinchRisk) {
    return {
      hazard: "쇄석기 로터·블로바 사이 원석 제거 중 협착 및 불시기동 위험",
      controls: [
        "원석 제거 전 쇄석기 운전을 정지하고 주전원 차단·잠금표지(LOTO) 후 로터를 기계적으로 고정",
        "쇄석기 내부 진입을 금지하고 전용 제거도구·감시인을 배치해 외부의 안전한 위치에서 걸림 해소"
      ],
      reviewRequired: false
    };
  }

  if (craneBucketCrusherFallRisk) {
    return {
      hazard: "고정식 크레인 버킷과 작업자 충돌로 파쇄기 투입구에 추락하는 위험",
      controls: [
        "선별 작업 중 크레인 버킷을 정지하고 작업반경·파쇄기 투입구 주변의 작업자 출입통제",
        "파쇄기 투입구에 안전난간·방호울·접근 인터록을 설치하고 크레인과 선별 작업을 동시 수행하지 않음"
      ],
      reviewRequired: false
    };
  }

  if (crusherOpeningFallRisk) {
    return {
      hazard: "파쇄기 폐기물 투입구·개구부에 추락해 말림·파쇄되는 위험",
      controls: [
        "파쇄기 투입구에 안전난간·방호울과 접근 인터록을 설치하고 작업자가 투입구에 접근하지 않는 공급방식 사용",
        "단독 투입작업을 금지하고 감시·비상정지 체계를 유지하며 내부 확인 전 운전 정지·잠금표지(LOTO)"
      ],
      reviewRequired: false
    };
  }

  if (aerialObstructionReleaseFallRisk) {
    return {
      hazard: "고소작업대 가드가 비계파이프에 걸린 상태에서 절단해 반동·출렁임으로 추락하는 위험",
      controls: [
        "고소작업대를 안전한 위치로 하강·고정한 뒤 관리감독자 구조계획에 따라 걸림을 해소하고 탑승 상태 절단 금지",
        "작업대 고정점에 안전대를 체결하고 비상하강·구조수단과 하부 출입통제를 확보한 후 작업 재개"
      ],
      reviewRequired: false
    };
  }

  if (automatedLinePinchRisk) {
    return {
      hazard: "자동화 이재기 하단부와 컨베이어 프레임 사이 가동부 끼임 위험",
      controls: [
        "이재기·컨베이어 협착점에 방호울·감응형 안전장치·접근 인터록을 설치하고 비상정지 기능 확인",
        "점검·검사 구역 진입 전 자동운전을 정지하고 전원 차단·잠금표지(LOTO) 후 원점복귀 절차 확인"
      ],
      reviewRequired: false
    };
  }

  if (palletFootholdFallRisk) {
    return {
      hazard: "파렛트를 임시 발판으로 딛고 작업하다 균형을 잃는 추락 위험",
      controls: [
        "파렛트·적재물을 발판으로 사용하는 행위를 금지하고 승인된 작업발판·사다리를 사용",
        "작업 높이에 맞는 안전난간·추락방호를 설치하고 바닥 적재물과 이동 동선을 정리"
      ],
      reviewRequired: false
    };
  }

  if (laundryLoadPushFallRisk) {
    return {
      hazard: "작업대에서 세탁물 운반물을 풀던 중 쏟아지는 더미에 밀려 추락하는 위험",
      controls: [
        "작업대에 안전난간·발끝막이판을 설치하고 운반물 자루를 풀기 전 묶음·배출 상태를 고정",
        "운반물 낙하·쏟아짐 구역과 작업자를 분리하고 안전한 위치에서 원격 또는 보조도구로 개방"
      ],
      reviewRequired: false
    };
  }

  if (craneLiftedLoadRidingFallRisk) {
    return {
      hazard: "크레인에 매달린 컨베이어에 탑승한 채 이동하다 하중이 기울어 추락하는 위험",
      controls: [
        "매달린 하중·인양물 탑승을 금지하고 작업자는 승인된 고소작업대·작업발판에서 줄걸이 상태를 확인",
        "인양 전 줄걸이·체결부와 무게중심을 확인하고 시험 인양 후 하부 작업반경 출입통제"
      ],
      reviewRequired: false
    };
  }

  if (excavatorBucketRidingFallRisk) {
    return {
      hazard: "굴삭기 버킷에 승차석 외 탑승해 장비를 용도 외로 사용하다 추락하는 위험",
      controls: [
        "굴삭기 버킷 탑승과 승차석 외 승강을 금지하고 승인된 고소작업대·비계·작업발판 사용",
        "고소 작업발판의 난간·안전대 체결을 확인하고 장비 운전 중 작업반경 출입통제"
      ],
      reviewRequired: false
    };
  }

  if (conveyorTraversalFallRisk) {
    return {
      hazard: "컨베이어 상부 접근·통행 중 추락 또는 불시기동에 따른 끼임 위험",
      controls: [
        "컨베이어 횡단용 고정 작업발판·건널다리와 안전난간을 설치하고 설비 위 임의 통행 금지",
        "접근·구조·정비 전 컨베이어 전원을 차단하고 잠금표지(LOTO)로 불시기동 방지"
      ],
      reviewRequired: false
    };
  }

  if (liftUnexpectedMotionRisk) {
    const maintenanceContext = /고장|수리|점검|설치|정비/u.test(eventText);
    return {
      hazard: /추락|떨어/u.test(eventText)
        ? "리프트·승강 운반구의 불시 상승·하강으로 인한 작업자 추락·끼임 위험"
        : "엘리베이터·승강기의 불시 상승·하강으로 인한 작업자 끼임 위험",
      controls: [
        "운반구 탑승·이송 구역 출입을 통제하고 권과방지장치·비상정지·출입문 인터록 작동 확인",
        maintenanceContext
          ? "점검·수리 전 주전원을 차단하고 잠금표지(LOTO) 후 승강로·운반구를 기계적으로 고정"
          : "운전 신호를 단일화하고 작업자 완전 이탈 확인 후 조작, 이상 작동 시 즉시 비상정지"
      ],
      reviewRequired: false
    };
  }

  if (vehicleAccessFallRisk) {
    return {
      hazard: "정차 차량 적재함·운전석 승하차 중 지지 상실에 따른 추락 위험",
      controls: [
        "승하차 발판·손잡이 건전성을 확인하고 오르내릴 때 3점 지지 유지",
        "적재물 위 임시 작업을 금지하고 승인된 사다리·작업발판 등 접근설비 사용"
      ],
      reviewRequired: false
    };
  }

  if (pumpCarBrakeReleasePinchRisk) {
    return {
      hazard: "펌프카 제동 공압 해제와 불시 이동으로 차량·구조물 사이에 협착되는 위험",
      controls: [
        "정비 전 평탄한 장소에서 주차브레이크·고임목·차량 지지대로 펌프카를 기계적으로 고정",
        "공압호스 분리 전 잔류 제동에너지를 차단·배출하고 차량 이동 예상 구역 접근통제"
      ],
      reviewRequired: false
    };
  }

  if (mobileEquipmentSwingPinchRisk) {
    return {
      hazard: "굴삭기 선회 중 장비 뒷부분과 굴착사면 사이 작업자 끼임·협착 위험",
      controls: [
        "굴삭기 선회반경과 사각지대를 차단시설로 통제하고 작업자 접근 시 장비를 완전히 정지",
        "신호수를 배치해 운전자·작업자 신호를 단일화하고 후방카메라·경보장치 작동 확인"
      ],
      reviewRequired: false
    };
  }

  if (poweredEquipmentPinchRisk && !preferMixedMachineryFall) {
    const gravityDrivenMotion = poweredGravityFailureSignal || /상승|하강|균형추|승강기|승강설비|고소작업대|의료장비\s*테이블/u.test(eventText);
    return {
      hazard: gravityDrivenMotion
        ? "동력 승강·하강 설비의 불시 작동과 지지력 상실로 인한 끼임 위험"
        : "동력설비·회전체의 불시 작동으로 인한 끼임·말림 위험",
      controls: gravityDrivenMotion
        ? [
          "승강·하강부 아래 접근을 통제하고 안전블록·지지대로 기계적 고정 상태 확인",
          "조정·해체 전 동력과 잔류에너지를 격리하고 잠금표지(LOTO) 적용"
        ]
        : [
          "가동부·회전체 방호와 위험작업 반경 접근통제 상태 확인",
          "해체·정비 전 동력과 잔류에너지를 격리하고 잠금표지(LOTO) 적용"
        ],
      reviewRequired: false
    };
  }

  if (sifForkliftRidingFallRisk) {
    return {
      hazard: "지게차 포크·파렛트에 탑승해 승강·이동하는 중 추락 위험",
      controls: [
        "지게차 포크·파렛트 탑승 금지 및 승인된 고소작업대 사용",
        "작업발판·안전난간·안전대 등 추락 방호조치 확인"
      ],
      reviewRequired: false
    };
  }

  if (sifForkliftRidingPinchRisk) {
    return {
      hazard: "지게차 포크·적재물 무단 탑승 중 마스트·프레임·상부 구조물 사이 끼임 위험",
      controls: [
        "지게차 포크·적재물 탑승을 금지하고 승인된 고소작업대·승강설비 사용",
        "탑승자 완전 하차와 작업반경 접근통제 확인 후 지게차 승강·이동 조작"
      ],
      reviewRequired: false
    };
  }

  if (sifForkliftParkingRisk) {
    return {
      hazard: "경사로 주·정차 후 지게차 제동 불량·불시 이동으로 인한 깔림 위험",
      controls: [
        "운전석 이탈 전 포크를 바닥에 내리고 주차 브레이크·제동장치 체결 확인",
        "경사로 주차 금지, 불가피한 경우 바퀴 구름방지 스토퍼 설치"
      ],
      reviewRequired: false
    };
  }

  if (sifForkliftRolloverRisk) {
    return {
      hazard: "지게차 운반·하역 중 무게중심 상실과 전도·전복으로 인한 깔림 위험",
      controls: [
        "지게차 운전자 좌석 안전띠 착용 및 운행 전 전도방호 상태 확인",
        forkliftRolloverWithLoad
          ? "적재물 무게중심과 운행경로를 작업계획서에 반영하고 유도자 배치"
          : "경사·후진 구간 운행경로와 작업방법을 작업계획서에 반영하고 유도자 배치"
      ],
      reviewRequired: false
    };
  }

  if (vehicleInducedElevatedWorkerFallRisk) {
    return {
      hazard: "차량 출발·이동 또는 추돌로 고소작업대·적재함 작업자가 추락하는 위험",
      controls: [
        "고소작업대·적재함 작업자 완전 하차 전 차량 출발·이동 금지",
        "차량 동선과 고소작업구역을 분리하고 작업대 안전대 체결·충돌구역 출입통제"
      ],
      reviewRequired: false
    };
  }

  if (vehicleRolloverRisk) {
    return {
      hazard: "덤프트럭·건설기계의 지반·경사·하역 조건 불량에 따른 전도·전복 위험",
      controls: [
        "운전자 안전띠와 전도방호 상태, 적재물 무게중심·적재함 상승 한계 확인",
        "지반 지지력·단부 이격·운행경로를 작업계획서에 반영하고 신호수 배치"
      ],
      reviewRequired: false
    };
  }

  if (raisedVehiclePartRisk) {
    return {
      hazard: "차량 적재함·운전석 캡의 불시 하강으로 인한 협착·끼임 위험",
      controls: [
        "상승한 적재함·운전석 캡에 안전지지대·블록을 설치하고 기계적 고정 상태 확인",
        "유압·잔류에너지를 제거하고 정비 전 전원 차단·잠금표지(LOTO) 적용"
      ],
      reviewRequired: false
    };
  }

  if (vehicleSlopeRollbackRisk) {
    return {
      hazard: "경사로 주·정차 차량의 제동 불량·불시 이동과 밀림으로 인한 충돌·깔림 위험",
      controls: [
        "경사로 정차 전 제동장치 상태를 확인하고 주차 브레이크·바퀴 고임 적용",
        "차량 이동경로와 작업자 동선을 분리하고 신호수 배치·이동반경 출입통제"
      ],
      reviewRequired: false
    };
  }

  if (sifVehicleTrafficRisk && !suspendedLoadIncident) {
    return {
      hazard: "작업차량 이동·후진 구간에서 작업자와 충돌·깔림 위험",
      controls: [
        "운전자 시야·사각지대 확인 및 차량과 작업자 동선을 차단시설로 분리",
        "교차·후진 구간 신호수 배치, 후진 경보와 작업반경 접근통제 확인"
      ],
      reviewRequired: false
    };
  }

  if (sifCraneTrafficRisk) {
    return {
      hazard: "주행 크레인·주변 구조물 사이 작업자 충돌·끼임 위험",
      controls: [
        "크레인 주행 전 운전자 시야와 이동경로 내 작업자·장애물 확인",
        "주행 구간 출입통제, 신호수 배치 및 구조물 사이 끼임구역 접근 금지"
      ],
      reviewRequired: false
    };
  }

  if (sifForkliftLoadRisk) {
    return {
      hazard: "지게차 운반·상하차 중 적재물 전도·낙하 및 작업자 타격 위험",
      controls: [
        "적재물 무게중심·결속 및 포크 삽입 상태 확인",
        "적재물 전도·낙하 작업반경 출입통제 및 신호수 배치"
      ],
      reviewRequired: false
    };
  }

  if (suspendedLoadIncident) {
    return {
      hazard: "인양·적재 중 부재·화물의 낙하·전도 및 작업자 타격·깔림 위험",
      controls: [
        "줄걸이·체인·결속 상태와 인양물 무게중심을 작업 전 확인",
        "인양·전도 작업반경 출입통제 및 신호수 배치"
      ],
      reviewRequired: false
    };
  }

  if (stackedLoadIncident) {
    return {
      hazard: "정적 적재·적층 화물의 붕괴·전도로 인한 작업자 깔림 위험",
      controls: [
        "적재 높이·적층 방법과 받침·벽체 이격을 확인하고 붕괴방지 조치 적용",
        "적재물 전도 예상 구역 출입통제 및 불안정 적재물 재정렬"
      ],
      reviewRequired: false
    };
  }

  if (blastFlyrockIncident) {
    return {
      hazard: "발파 비래 암석의 위험반경 내 작업자·운전석 타격 위험",
      controls: [
        "발파 전 비래 예상 위험반경을 설정하고 작업자·차량을 방호된 피난장소로 대피",
        "발파 신호·출입통제와 잔류 위험 확인 후 관리감독자 승인에 따라 재진입"
      ],
      reviewRequired: false
    };
  }

  if (fallingObjectIncident) {
    return {
      hazard: "상부 물체·부재·장비의 낙하·비래로 인한 작업자 타격·깔림 위험",
      controls: [
        "물체·부재·부착장치의 고정·결속 및 낙하방지 상태 확인",
        "낙하 예상 작업반경과 하부 출입통제"
      ],
      reviewRequired: false
    };
  }

  if (/지게차/u.test(incidentText) && /동선|보행|통행|충돌|하역|상하차|도크/u.test(incidentText) && !hazardousEnergyIdentity) {
    return {
      hazard: "자재 반입 지게차 동선과 작업자 통행 동선 중첩으로 인한 충돌 위험",
      controls: [
        "지게차 동선과 보행 동선을 바닥표시·차단시설로 분리",
        "교차·후진 구간 신호수 배치 및 후진 경보·접근통제 확인"
      ],
      reviewRequired: false
    };
  }

  if (sifConfinedSpaceRisk || (!isSif && /밀폐공간|산소결핍|유해가스|맨홀|탱크 내부|지하 기계실.*배수펌프/u.test(text))) {
    return {
      hazard: confinedPoweredEquipment || !isSif
        ? "밀폐공간 진입 중 산소결핍·유해가스 노출 및 내부 설비 불시기동 위험"
        : "밀폐공간 진입 중 산소결핍·유해가스 노출과 질식 위험",
      controls: [
        "진입 전 산소·유해가스 농도 측정 및 강제환기 실시",
        confinedPoweredEquipment || !isSif
          ? "감시인 외부 배치·구조장비 확보 후 내부 설비·펌프·모터 전원 차단 및 잠금표지(LOTO) 적용"
          : "감시인 외부 배치, 구조장비·구조계획 확보 및 단독 구조진입 금지"
      ],
      reviewRequired: false
    };
  }

  if (sifRaisedEquipmentMaintenanceRisk) {
    return {
      hazard: "화물적재기·턴테이블 정비 중 불시 하강으로 인한 끼임 위험",
      controls: [
        "상승 설비에 안전블록·지지대를 설치하고 기계적 고정 상태 확인",
        "정비 전 전원 차단·잠금표지(LOTO) 후 잔류에너지 제거"
      ],
      reviewRequired: false
    };
  }

  if (sifFallRisk && sifMachineryMaintenanceRisk) {
    return {
      hazard: "기계설비 정비 중 작업대 추락·가동부 끼임 및 불시기동 위험",
      controls: [
        "작업발판·안전난간 상태 확인 및 안전대 체결",
        "가동부 방호덮개·비상정지장치 확인 후 정비 전 전원 차단·잠금표지(LOTO)"
      ],
      reviewRequired: false
    };
  }

  if (sifFallRisk && sifMachineryPinchRisk) {
    return {
      hazard: "기계설비 주변 작업대 추락 및 가동부 끼임·불시기동 위험",
      controls: [
        "작업발판·안전난간 상태 확인 및 안전대 체결",
        "가동부 방호덮개·비상정지장치 확인 후 접근·이물질 제거 전 전원 차단·잠금표지(LOTO)"
      ],
      reviewRequired: false
    };
  }

  if (sifFallRisk && sifPinchRisk) {
    return {
      hazard: "비계·부재 해체 중 작업발판 추락 및 손·신체 끼임 위험",
      controls: [
        "작업발판·안전난간 상태 확인 및 안전대 체결",
        "부재 사이 손 끼임점 확인, 작업구역 접근 통제 및 작업자 간 신호 확인"
      ],
      reviewRequired: false
    };
  }

  if (sifFallRisk) {
    return {
      hazard: "고소·비계 작업 중 작업발판·단부 방호 미확인으로 인한 추락 위험",
      controls: [
        "작업발판·안전난간·개구부 상태 확인",
        "안전대 체결 및 작업반경 출입통제"
      ],
      reviewRequired: false
    };
  }

  if (sifPinchRisk && !machineryIdentity && manualHandlingPinchSignal) {
    return {
      hazard: "수작업·부재 취급 중 손·신체 끼임 위험",
      controls: [
        "부재 사이 손 끼임점 확인 및 작업구역 접근 통제",
        "취급 보조도구 사용과 작업자 간 신호 확인"
      ],
      reviewRequired: false
    };
  }

  if (machineryIdentity && !isSif) {
    return {
      hazard: "기계 가동부 끼임 및 정비 중 불시기동 위험",
      controls: [
        "가동부 방호덮개 설치 및 비상정지장치 작동 확인",
        "정비 전 전원 차단 및 잠금표지(LOTO)"
      ],
      reviewRequired: false
    };
  }

  if (isSif) {
    const incidentLabel = accidentType || "SIF";
    return {
      hazard: `검토 필요: ${incidentLabel} 사고의 직접 원인과 현장 위험요인 미확정`,
      controls: [
        "SIF 사고개요와 원문 감소대책을 현장 작업조건에 대조해 직접 원인 확인",
        "관리감독자 검토 완료 전 원시 태그·관리대책을 현장 통제대책으로 확정하지 않음"
      ],
      reviewRequired: true
    };
  }

  return genericOperationalView(item);
}

export function buildSafetyReferenceOperationalMetadata(item: SafetyReferenceItem): Pick<
  SafetyReferenceItem,
  "controls" | "short_summary" | "document_reflection_label" | "operation_signal_label"
> {
  const operationalView = deriveSafetyReferenceOperationalView(item);
  const controls = operationalView.controls.slice(0, 2);
  const reflectedDocuments = item.reflected_documents?.length ? item.reflected_documents : item.primary_documents;
  return {
    controls,
    short_summary: compactText([operationalView.hazard, ...controls].join(" · "), 180),
    document_reflection_label: buildDocumentReflectionLabel(reflectedDocuments, controls),
    operation_signal_label: buildOperationSignalLabel(item.item_type, controls)
  };
}

function deriveEvidenceRole(item: SafetyReferenceItem): "direct" | "supporting" {
  if (isKoshaTechnicalReference(item)) {
    return getKoshaGroundingDecision(item)?.directEvidenceEligible === true ? "direct" : "supporting";
  }
  if (item.kosha_guide) return "supporting";
  if (item.evidence_role) return item.evidence_role;
  const directTypes = new Set([
    "construction-process",
    "machinery",
    "risk-manual"
  ]);
  if (directTypes.has(item.item_type)) return "direct";
  if (item.source_id.includes("law") || item.source_id.includes("regulation")) return "direct";
  return "supporting";
}

export function isKoshaTechnicalReference(
  item: Pick<SafetyReferenceItem, "item_type">
): boolean {
  return item.item_type === "technical-guideline" || item.item_type === "technical-support-regulation";
}

export function isSafetyReferenceRiskEligible(item: SafetyReferenceItem): boolean {
  if (isKoshaTechnicalReference(item)) {
    return getKoshaGroundingDecision(item)?.riskRowEligible === true;
  }
  return !item.kosha_guide;
}

export function isSafetyReferenceDirectEligible(
  item: SafetyReferenceItem
): boolean {
  if (isKoshaTechnicalReference(item)) {
    return getKoshaGroundingDecision(item)?.directEvidenceEligible === true;
  }
  return !item.kosha_guide;
}

export function isKoshaSupportingCitationEligible(item: SafetyReferenceItem): boolean {
  return getKoshaGroundingDecision(item)?.supportingCitationEligible === true;
}

export function summarizeKoshaGrounding(input: {
  items: readonly SafetyReferenceItem[];
  localCorpusStatus?: KoshaGroundingSearchDecision["localCorpusStatus"];
  excludedCount?: number;
  blockedReason?: "exact-registry-integrity-failed" | "local-corpus-integrity-failed" | "local-corpus-unavailable";
}): KoshaGroundingSearchDecision {
  const decisions = input.items
    .filter(isKoshaTechnicalReference)
    .map(getKoshaGroundingDecision)
    .filter((decision): decision is KoshaGroundingDecision => decision !== null);
  const acceptedCount = decisions.filter((decision) => decision.status === "verified_current").length;
  const reviewRequired = decisions.filter((decision) => decision.status !== "verified_current");
  const excludedCount = input.excludedCount || 0;
  const localCorpusStatus = input.localCorpusStatus || "not_applicable";
  const localGateReason = input.blockedReason === "local-corpus-integrity-failed"
    || input.blockedReason === "local-corpus-unavailable"
    ? input.blockedReason
    : null;
  if (input.blockedReason === "local-corpus-integrity-failed"
    || input.blockedReason === "exact-registry-integrity-failed") {
    return {
      status: "blocked",
      reason: input.blockedReason,
      localGateReason,
      localCorpusStatus,
      acceptedCount,
      reviewRequiredCount: reviewRequired.length,
      excludedCount
    };
  }
  if (reviewRequired.length) {
    return {
      status: "review_required",
      reason: reviewRequired[0]?.reason || "metadata-absent",
      localGateReason,
      localCorpusStatus,
      acceptedCount,
      reviewRequiredCount: reviewRequired.length,
      excludedCount
    };
  }
  if (acceptedCount) {
    return {
      status: "ready",
      reason: "verified-current",
      localGateReason,
      localCorpusStatus,
      acceptedCount,
      reviewRequiredCount: 0,
      excludedCount
    };
  }
  if (input.blockedReason) {
    return {
      status: "blocked",
      reason: input.blockedReason,
      localGateReason,
      localCorpusStatus,
      acceptedCount: 0,
      reviewRequiredCount: 0,
      excludedCount
    };
  }
  return {
    status: "not_applicable",
    reason: "not-applicable",
    localGateReason,
    localCorpusStatus,
    acceptedCount: 0,
    reviewRequiredCount: 0,
    excludedCount
  };
}

function compactText(value: string, maxLength = 96): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}

function buildDocumentReflectionLabel(documents: string[], controls: string[]): string {
  const documentLabel = documents.slice(0, 3).join(" · ") || "문서 보완 후보";
  const actionLabel = controls[0] ? compactText(controls[0], 48) : "확인 항목으로 반영";
  return `${documentLabel}에 ${actionLabel}`;
}

function buildSourceKindLabel(itemType: string): string {
  if (itemType === "sif-case") return "고위험요인 사례";
  if (itemType === "technical-guideline" || itemType === "technical-support-regulation") return "KOSHA 공식자료";
  if (itemType === "tbm") return "TBM 반영 기준";
  if (itemType === "risk_assessment") return "위험성평가 기준";
  if (itemType === "work_plan") return "작업계획 기준";
  if (itemType === "construction-process") return "공정 분류 기준";
  if (itemType === "machinery") return "장비 위험 기준";
  return "안전 참고자료";
}

function buildOperationSignalLabel(itemType: string, controls: string[]): string {
  const control = controls[0] ? compactText(controls[0], 42) : "현장 확인 항목";
  if (itemType === "sif-case") return `유사사례에서 ${control} 후보`;
  if (itemType === "tbm") return `TBM에서 ${control} 확인`;
  if (itemType === "risk_assessment") return `위험성평가에 ${control} 반영`;
  return `문서와 TBM에 ${control} 반영`;
}

function safeIlikeTerm(value: string): string {
  return value.replaceAll("*", "").replaceAll(",", " ").replace(/[()]/g, " ").trim();
}

const PRIORITY_QUERY_TERMS = [
  "밀폐공간",
  "배수펌프",
  "산소농도",
  "유해가스",
  "지게차",
  "비계",
  "외벽",
  "도장",
  "도료",
  "유기용제",
  "강풍",
  "추락",
  "동선",
  "충돌",
  "감전",
  "누수",
  "화재",
  "폭발"
];

function extractFallbackTerms(value: string): string[] {
  const stopwords = new Set([
    "부산",
    "해운대",
    "서울",
    "성수동",
    "작업",
    "작업자",
    "반영",
    "예보",
    "사용",
    "관리",
    "확인",
    "위험",
    "위험성평가",
    "안전",
    "문서",
    "보완",
    "방향"
  ]);
  const normalized = value.replace(/[^\p{L}\p{N}\s]/gu, " ");
  const priorityTerms = PRIORITY_QUERY_TERMS.filter((term) => normalized.includes(term));
  const ordinaryTerms = normalized
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length >= 2 && !stopwords.has(term));
  return Array.from(new Set([...priorityTerms, ...ordinaryTerms])).slice(0, 12);
}

const QUERY_TERM_ALIASES: Record<string, string[]> = {
  "밀폐공간": ["밀폐", "산소", "환기", "질식", "유해가스", "감시인"],
  "산소농도": ["산소", "농도", "환기", "질식", "가스"],
  "유해가스": ["가스", "환기", "질식", "농도"],
  "환기": ["환기", "배기", "송풍"],
  "감시인": ["감시", "연락", "구조", "대피"],
  "배수펌프": ["펌프", "배수", "기계실", "전원", "잠금", "LOTO"],
  "기계실": ["기계실", "펌프", "전기", "배수"],
  "누수": ["누수", "누전", "감전", "젖은", "미끄러짐", "전도"],
  "감전": ["감전", "절연", "전기", "누전"],
  "전원": ["전원", "잠금", "LOTO", "정비"],
  "잠금표지": ["잠금", "표지", "LOTO", "전원차단"],
  "추락": ["추락", "비계", "사다리", "작업발판", "고소"],
  "지게차": ["지게차", "동선", "충돌", "하역", "보행자", "신호수"],
  "비계": ["비계", "작업발판", "난간", "고소", "추락"],
  "강풍": ["강풍", "돌풍", "풍속", "악천후", "작업중지"],
  "동선": ["동선", "통행", "보행", "보행자", "충돌", "교차"],
  "충돌": ["충돌", "지게차", "차량", "동선", "보행자"],
  "외벽": ["외벽", "외부마감", "고소", "비계"],
  "도장": ["도장", "도료", "페인트", "유기용제"]
};

const STRONG_RELEVANCE_ALIASES = new Set([
  "밀폐",
  "산소",
  "환기",
  "질식",
  "유해가스",
  "펌프",
  "배수",
  "기계실",
  "누수",
  "누전",
  "감전",
  "젖은",
  "미끄러짐",
  "전도",
  "추락",
  "비계",
  "작업발판",
  "지게차",
  "강풍",
  "동선",
  "충돌",
  "보행",
  "보행자"
]);

const CONFINED_OR_PUMP_QUERY_TERMS = ["밀폐공간", "산소농도", "환기", "배수펌프", "기계실", "누수"];
const CONFINED_OR_PUMP_INCOMPATIBLE_TERMS = ["프레스", "크레인", "영상표시단말기", "VDT", "운송용 차량"];

function normalizeMatchText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ");
}

function referenceMatchText(item: SafetyReferenceItem): string {
  return normalizeMatchText([
    item.title,
    item.summary,
    item.category || "",
    item.subcategory || "",
    ...item.keywords,
    ...item.risk_tags,
    ...item.controls,
    ...item.primary_documents
  ].join(" "));
}

function expandedQueryTerms(query: string): string[] {
  const baseTerms = extractFallbackTerms(query);
  const terms = new Set<string>(baseTerms);
  for (const term of baseTerms) {
    const aliases = QUERY_TERM_ALIASES[term] || [];
    aliases.forEach((alias) => terms.add(alias));
  }
  return Array.from(terms).filter((term) => term.length >= 2);
}

function includesAnyTerm(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(normalizeMatchText(term)));
}

function hasStrongQueryMatch(query: string, item: SafetyReferenceItem): boolean {
  const baseTerms = extractFallbackTerms(query);
  if (!baseTerms.length) return true;
  const text = referenceMatchText(item);
  if (includesAnyTerm(text, baseTerms)) return true;
  return baseTerms.some((term) =>
    (QUERY_TERM_ALIASES[term] || []).some((alias) =>
      STRONG_RELEVANCE_ALIASES.has(alias) && text.includes(normalizeMatchText(alias))
    )
  );
}

function isIncompatibleReferenceForQuery(query: string, item: SafetyReferenceItem): boolean {
  const queryText = normalizeMatchText(query);
  const text = referenceMatchText(item);
  const identityText = normalizeMatchText([
    item.title,
    item.category || "",
    item.subcategory || "",
    ...item.keywords
  ].join(" "));
  const specializedGuards: Array<{ reference: RegExp; query: RegExp }> = [
    {
      reference: /B-E-20-2026|정전도장기|정전도장/u,
      query: /정전\s*도장|정전도장기|정전기.*(?:도장|도료)|(?:도장|도료).*정전기|고전압\s*도장/u
    },
    {
      reference: /G-117-2014|선박\s*내부|선박내부/u,
      query: /선박|선체|조선/u
    },
    {
      reference: /M-77-2011|자동차\s*부분\s*분무도장/u,
      query: /자동차|차량\s*도장|분무도장|스프레이\s*도장/u
    }
  ];
  if (specializedGuards.some((guard) => guard.reference.test(identityText) && !guard.query.test(queryText))) {
    return true;
  }
  const confinedOrPumpQuery = CONFINED_OR_PUMP_QUERY_TERMS.some((term) => queryText.includes(normalizeMatchText(term)));
  if (!confinedOrPumpQuery) return false;
  return CONFINED_OR_PUMP_INCOMPATIBLE_TERMS.some((term) =>
    !queryText.includes(normalizeMatchText(term)) && text.includes(normalizeMatchText(term))
  );
}

export function isSafetyReferenceCompatibleWithQuery(query: string, item: SafetyReferenceItem): boolean {
  return !isIncompatibleReferenceForQuery(query, item);
}

export function scoreSafetyReferenceQueryMatch(query: string, item: SafetyReferenceItem): number {
  const baseTerms = extractFallbackTerms(query);
  if (!baseTerms.length) return 1;
  if (isIncompatibleReferenceForQuery(query, item)) return 0;
  const text = referenceMatchText(item);
  const title = normalizeMatchText(item.title);
  let score = 0;

  for (const term of baseTerms) {
    const normalizedTerm = normalizeMatchText(term);
    if (title.includes(normalizedTerm)) score += 5;
    if (text.includes(normalizedTerm)) score += 3;
    for (const alias of QUERY_TERM_ALIASES[term] || []) {
      const normalizedAlias = normalizeMatchText(alias);
      if (title.includes(normalizedAlias)) score += 3;
      if (text.includes(normalizedAlias)) score += 2;
    }
  }

  return hasStrongQueryMatch(query, item) ? score : Math.min(score, 1);
}

function referenceRiskDomain(item: SafetyReferenceItem): string {
  const text = referenceMatchText(item);
  return /정전도장|정전도장기/.test(text)
    ? "electrostatic_paint"
    : /지게차/.test(text) && /동선|보행|통행|충돌|하역/.test(text)
      ? "forklift_traffic"
      : /도장|도료|유기용제/.test(text) && /화재|폭발|점화/.test(text)
        ? "paint_fire"
        : /외벽|비계|추락|작업발판|고소/.test(text)
          ? "fall_scaffold"
          : /밀폐공간|산소결핍|유해가스|배수펌프/.test(text)
            ? "confined_space"
            : /감전|누전|전기작업/.test(text)
              ? "electrical"
              : `reference:${item.id}`;
}

const ROW_DOMAIN_GENERIC_TERMS = new Set([
  "건설안전",
  "기계안전",
  "산업안전",
  "기술지원규정",
  "기술지침",
  "작업",
  "안전",
  "관리",
  "일반",
  "기준",
  "규정",
  "지침",
  "예방",
  "점검",
  "조치",
  "통제",
  "확인",
  "직접",
  "근거"
]);

function referenceRowDomainTerms(item: SafetyReferenceItem): Set<string> {
  return new Set([
    item.title,
    item.category || "",
    item.subcategory || "",
    ...item.keywords,
    ...item.risk_tags
  ].flatMap((field) => extractFallbackTerms(field))
    .map((term) => normalizeMatchText(term))
    .filter((term) => !ROW_DOMAIN_GENERIC_TERMS.has(term)));
}

export function hasStrongSafetyReferenceRowOverlap(
  directReference: SafetyReferenceItem,
  supportingReference: SafetyReferenceItem
): boolean {
  const directDomain = referenceRiskDomain(directReference);
  const supportingDomain = referenceRiskDomain(supportingReference);
  if (!directDomain.startsWith("reference:") && directDomain === supportingDomain) return true;

  const directTerms = referenceRowDomainTerms(directReference);
  const supportingTerms = referenceRowDomainTerms(supportingReference);
  let overlap = 0;
  for (const term of directTerms) {
    if (!supportingTerms.has(term)) continue;
    overlap += 1;
    if (overlap >= 2) return true;
  }
  return false;
}

function referenceDomainSpecificity(domain: string, item: SafetyReferenceItem): number {
  const title = normalizeMatchText(item.title);
  switch (domain) {
    case "forklift_traffic":
      return (/지게차/.test(title) ? 6 : 0) + (/안전작업|충돌|보행/.test(title) ? 2 : 0);
    case "fall_scaffold":
      return (/d-c-13-2026|외벽도장|비계\s*구조/.test(title) ? 6 : 0) + (/추락|작업발판/.test(title) ? 2 : 0);
    case "paint_fire":
      return (/b-e-17-2026/.test(title) ? 6 : 0) + (/도장/.test(title) && /화재|폭발/.test(title) ? 2 : 0);
    case "confined_space":
      return (/밀폐공간|산소결핍|유해가스/.test(title) ? 6 : 0) + (/배수펌프/.test(title) ? 2 : 0);
    default:
      return 0;
  }
}

export function filterAndRankSafetyReferencesByQuery(
  query: string,
  items: SafetyReferenceItem[],
  limit: number
): SafetyReferenceItem[] {
  const terms = expandedQueryTerms(query);
  if (!terms.length) return items.slice(0, limit);
  const ranked = items
    .filter((item) => isSafetyReferenceCompatibleWithQuery(query, item))
    .map((item, index) => ({ item, index, score: scoreSafetyReferenceQueryMatch(query, item) }))
    .filter(({ score }) => score >= 2)
    .sort((a, b) => b.score - a.score || a.index - b.index);
  const selected: typeof ranked = [];
  const deferred: typeof ranked = [];
  const selectedDomainIndexes = new Map<string, number>();

  for (const candidate of ranked) {
    const domain = referenceRiskDomain(candidate.item);
    const selectedIndex = selectedDomainIndexes.get(domain);
    if (selectedIndex !== undefined) {
      const selectedCandidate = selected[selectedIndex];
      const shouldPreferDirect = candidate.item.evidence_role === "direct" &&
        selectedCandidate.item.evidence_role !== "direct";
      const sameEvidenceAuthority = candidate.item.evidence_role === selectedCandidate.item.evidence_role;
      const shouldPreferSpecificReference = sameEvidenceAuthority &&
        referenceDomainSpecificity(domain, candidate.item) > referenceDomainSpecificity(domain, selectedCandidate.item);
      if (shouldPreferDirect || shouldPreferSpecificReference) {
        selected[selectedIndex] = candidate;
        deferred.push(selectedCandidate);
      } else {
        deferred.push(candidate);
      }
      continue;
    }
    if (selected.length >= limit) {
      deferred.push(candidate);
      continue;
    }
    selectedDomainIndexes.set(domain, selected.length);
    selected.push(candidate);
  }

  for (const candidate of deferred) {
    if (selected.length >= limit) break;
    selected.push(candidate);
  }

  return selected.map(({ item }) => item);
}

export function readSafetyReferenceLimit(value: string | null): number {
  const parsed = Number(value || "12");
  if (!Number.isFinite(parsed)) return 12;
  return Math.min(Math.max(Math.trunc(parsed), 1), 50);
}

function parseContentRange(value: string | null): number {
  if (!value) return 0;
  const total = value.split("/").at(-1);
  const parsed = Number(total);
  return Number.isFinite(parsed) ? parsed : 0;
}

function withRetrievalSource(
  item: SafetyReferenceItem,
  retrievalSource: NonNullable<SafetyReferenceItem["retrieval_source"]>,
  vectorSimilarity?: number
): SafetyReferenceItem {
  const normalized = normalizeReferenceItem(item);
  return {
    ...normalized,
    retrieval_source: retrievalSource,
    vector_similarity: vectorSimilarity
  };
}

export function mergeSafetyReferenceHybridResults(input: {
  vectorItems: SafetyReferenceItem[];
  rankedItems: SafetyReferenceItem[];
  limit: number;
  evidenceRole?: "direct" | "supporting";
}): SafetyReferenceItem[] {
  const byId = new Map<string, SafetyReferenceItem>();
  const add = (item: SafetyReferenceItem, source: NonNullable<SafetyReferenceItem["retrieval_source"]>) => {
    const normalized = withRetrievalSource(item, source, item.vector_similarity);
    const existing = byId.get(item.id);
    if (!existing) {
      byId.set(item.id, normalized);
      return;
    }
    byId.set(item.id, {
      ...existing,
      ...normalized,
      retrieval_source: "hybrid",
      vector_similarity: existing.vector_similarity ?? normalized.vector_similarity
    });
  };

  filterByEvidenceRole(input.vectorItems, input.evidenceRole).forEach((item) => add(item, "vector"));
  filterByEvidenceRole(input.rankedItems, input.evidenceRole).forEach((item) => add(item, "ranked"));
  return Array.from(byId.values()).slice(0, input.limit);
}

export function mergeLocalAndRemoteSafetyReferenceResults(input: {
  localItems: SafetyReferenceItem[];
  remoteItems: SafetyReferenceItem[];
  remoteRetrievalMode?: SafetyReferenceRetrievalMode;
  limit: number;
}): { items: SafetyReferenceItem[]; retrievalMode: SafetyReferenceRetrievalMode } {
  const remoteById = new Map<string, SafetyReferenceItem>();
  input.remoteItems.forEach((item) => remoteById.set(item.id, normalizeReferenceItem(item)));
  const remoteItems = [...remoteById.values()];
  const localItems = input.localItems
    .filter((item) => !remoteById.has(item.id))
    .map(normalizeReferenceItem);
  const items: SafetyReferenceItem[] = [];
  for (let index = 0; items.length < input.limit && (index < remoteItems.length || index < localItems.length); index += 1) {
    const remote = remoteItems[index];
    if (remote && items.length < input.limit) items.push(remote);
    const local = localItems[index];
    if (local && items.length < input.limit) items.push(local);
  }

  const returnedLocal = items.filter((item) => !remoteById.has(item.id));
  const returnedRemote = items.some((item) => remoteById.has(item.id));
  const localMode: SafetyReferenceRetrievalMode = returnedLocal.some((item) => item.retrieval_source === "local-hybrid")
    ? "local-hybrid"
    : returnedLocal.some((item) => item.retrieval_source === "local-ranked")
      ? "local-ranked"
      : "local-tag";
  const remoteMode = input.remoteRetrievalMode === "rest-ilike" || input.remoteRetrievalMode === "hybrid-vector-rpc"
    ? input.remoteRetrievalMode
    : "ranked-rpc";
  return {
    items,
    retrievalMode: returnedRemote && returnedLocal.length
      ? "hybrid-local-supabase"
      : returnedRemote
        ? remoteMode
        : localMode
  };
}

function buildRestUrl(config: SupabaseConfig, table: string, params: URLSearchParams): string {
  return `${config.url}/rest/v1/${table}?${params.toString()}`;
}

async function fetchRest(config: SupabaseConfig, table: string, params: URLSearchParams): Promise<Response> {
  return await fetch(buildRestUrl(config, table, params), {
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`
    },
    cache: "no-store"
  });
}

async function fetchReferenceItems(config: SupabaseConfig, params: URLSearchParams): Promise<{
  ok: boolean;
  status: number;
  message: string;
  items: SafetyReferenceItem[];
}> {
  const response = await fetchRest(config, "safety_reference_items", params);
  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      message: "안전 지식 DB 자료 조회를 완료하지 못했습니다.",
      items: []
    };
  }
  const data = (await response.json()) as unknown;
  const parsed = Array.isArray(data) ? await Promise.all(data.map(normalizeRemoteReferenceItem)) : [];
  const items = parsed.filter((item): item is SafetyReferenceItem => item !== null);
  return {
    ok: true,
    status: response.status,
    message: "Supabase 안전 지식 DB에서 참고자료를 조회했습니다.",
    items
  };
}

/**
 * Track E-3: ranked search via Postgres RPC. Uses tsvector + pg_trgm
 * with weighted scoring (KOSHA 기술지원규정 100 / 기술지침 80 / others
 * 10–30) + ts_rank_cd × 50 + title-similarity × 20.
 *
 * Returns null when the RPC isn't reachable (caller falls back to ilike).
 */
async function fetchRankedReferences(
  config: SupabaseConfig,
  query: string,
  limit: number,
  itemType?: string
): Promise<{ ok: boolean; status: number; message: string; items: SafetyReferenceItem[] } | null> {
  const url = `${config.url}/rest/v1/rpc/search_safety_references_ranked`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        q: query,
        result_limit: limit,
        item_type_filter: itemType ?? null
      }),
      cache: "no-store"
    });
  } catch (error) {
    log.error("safety reference ranked RPC failed", {
      event: SAFETY_REFERENCE_SEARCH_FAILURE_CODE,
      errorCode: SAFETY_REFERENCE_SEARCH_FAILURE_CODE,
      errorType: error instanceof Error ? error.name : typeof error
    });
    return {
      ok: false,
      status: 0,
      message: "안전 지식 DB ranked 조회를 완료하지 못했습니다.",
      items: []
    };
  }
  if (response.status === 404) {
    return null; // RPC missing — caller should fall back.
  }
  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      message: "안전 지식 DB ranked 조회를 완료하지 못했습니다.",
      items: []
    };
  }
  const data = (await response.json()) as unknown;
  const parsed = Array.isArray(data) ? await Promise.all(data.map(normalizeRemoteReferenceItem)) : [];
  const items = parsed.filter((item): item is SafetyReferenceItem => item !== null);
  return {
    ok: true,
    status: response.status,
    message: "Supabase 안전 지식 DB ranked RPC 호출 성공.",
    items
  };
}

function readVectorSimilarity(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

async function normalizeVectorReferenceRow(value: unknown): Promise<SafetyReferenceItem | null> {
  const normalized = await normalizeRemoteReferenceItem(value);
  if (!normalized) return null;
  const record = value as Record<string, unknown>;
  return withRetrievalSource(
    normalized,
    "vector",
    readVectorSimilarity(record.vector_similarity)
  );
}

async function fetchQueryEmbedding(
  query: string,
  runtime: SafetyReferenceVectorRuntime
): Promise<{ ok: true; embedding: number[] } | { ok: false; message: string }> {
  if (!runtime.apiKey) {
    return { ok: false, message: "OPENAI_API_KEY가 없어 query embedding을 생성하지 않았습니다." };
  }

  const input = compactText(query, 1000);
  const payload: Record<string, unknown> = {
    model: runtime.model,
    input,
    dimensions: runtime.dimensions
  };

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), VECTOR_SEARCH_TIMEOUT_MS);
    try {
      const response = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${runtime.apiKey}`,
          "content-type": "application/json"
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
        cache: "no-store"
      });
      const text = await response.text();
      if (!response.ok) {
        if (attempt === 0) continue;
        return { ok: false, message: SAFETY_REFERENCE_VECTOR_FAILURE_MESSAGE };
      }
      const parsed = JSON.parse(text) as unknown;
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        return { ok: false, message: "OpenAI embedding 응답 형식이 올바르지 않습니다." };
      }
      const record = parsed as Record<string, unknown>;
      const data = record.data;
      if (!Array.isArray(data) || data.length === 0) {
        return { ok: false, message: "OpenAI embedding 응답에 data가 없습니다." };
      }
      const first = data[0];
      if (typeof first !== "object" || first === null || Array.isArray(first)) {
        return { ok: false, message: "OpenAI embedding data 형식이 올바르지 않습니다." };
      }
      const embedding = (first as Record<string, unknown>).embedding;
      if (!isNumberArray(embedding) || embedding.length !== runtime.dimensions) {
        return { ok: false, message: `OpenAI embedding 차원이 ${runtime.dimensions}이 아닙니다.` };
      }
      return { ok: true, embedding };
    } catch {
      if (attempt === 0) continue;
      return {
        ok: false,
        message: SAFETY_REFERENCE_VECTOR_FAILURE_MESSAGE
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  return { ok: false, message: "OpenAI embedding 생성에 실패했습니다." };
}

async function fetchVectorReferences(
  config: SupabaseConfig,
  query: string,
  limit: number,
  itemType: string | undefined,
  runtime: SafetyReferenceVectorRuntime
): Promise<VectorFetchResult> {
  if (!runtime.enabled) {
    return { status: runtime.status, items: [] };
  }

  const embedding = await fetchQueryEmbedding(query, runtime);
  if (!embedding.ok) {
    log.error("safety reference vector embedding failed", {
      event: SAFETY_REFERENCE_VECTOR_FAILURE_CODE,
      errorCode: SAFETY_REFERENCE_VECTOR_FAILURE_CODE,
      reason: "embedding-failed"
    });
    return {
      status: {
        ...runtime.status,
        attempted: true,
        ok: false,
        errorCode: SAFETY_REFERENCE_VECTOR_FAILURE_CODE,
        reason: "embedding-failed",
        count: 0,
        message: SAFETY_REFERENCE_VECTOR_FAILURE_MESSAGE
      },
      items: []
    };
  }

  const url = `${config.url}/rest/v1/rpc/match_safety_reference_embeddings`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        query_embedding: embedding.embedding,
        match_count: limit,
        item_type_filter: itemType ?? null
      }),
      cache: "no-store"
    });
  } catch (error) {
    log.error("safety reference vector RPC failed", {
      event: SAFETY_REFERENCE_VECTOR_FAILURE_CODE,
      errorCode: SAFETY_REFERENCE_VECTOR_FAILURE_CODE,
      errorType: error instanceof Error ? error.name : typeof error,
      reason: "rpc-failed"
    });
    return {
      status: {
        ...runtime.status,
        attempted: true,
        ok: false,
        errorCode: SAFETY_REFERENCE_VECTOR_FAILURE_CODE,
        reason: "rpc-failed",
        count: 0,
        message: SAFETY_REFERENCE_VECTOR_FAILURE_MESSAGE
      },
      items: []
    };
  }

  if (response.status === 404) {
    return {
      status: {
        ...runtime.status,
        attempted: true,
        ok: false,
        reason: "rpc-missing",
        count: 0,
        message: "match_safety_reference_embeddings RPC가 없어 ranked/text 검색으로 대체합니다."
      },
      items: []
    };
  }

  if (!response.ok) {
    return {
      status: {
        ...runtime.status,
        attempted: true,
        ok: false,
        errorCode: SAFETY_REFERENCE_VECTOR_FAILURE_CODE,
        reason: "rpc-failed",
        count: 0,
        message: SAFETY_REFERENCE_VECTOR_FAILURE_MESSAGE
      },
      items: []
    };
  }

  const data = (await response.json()) as unknown;
  const parsed = Array.isArray(data) ? await Promise.all(data.map(normalizeVectorReferenceRow)) : [];
  const items = parsed.filter((item): item is SafetyReferenceItem => item !== null);
  return {
    status: {
      ...runtime.status,
      attempted: true,
      ok: items.length > 0,
      reason: items.length > 0 ? "ready" : "no-results",
      count: items.length,
      message: items.length > 0
        ? "SIF 임베딩 RPC 결과를 ranked/text 근거와 함께 사용했습니다."
        : "SIF 임베딩 RPC 결과가 없어 ranked/text 검색으로 대체합니다."
    },
    items
  };
}

async function countRows(config: SupabaseConfig, spec: CountSpec): Promise<number> {
  const params = new URLSearchParams();
  params.set("select", "id");
  params.set("limit", "1");
  Object.entries(spec.filters || {}).forEach(([key, value]) => params.set(key, value));
  const response = await fetch(buildRestUrl(config, spec.table, params), {
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      Prefer: "count=exact"
    },
    cache: "no-store"
  });
  if (!response.ok) {
    throw new Error(`${spec.table} count failed with status ${response.status}`);
  }
  return parseContentRange(response.headers.get("content-range"));
}

export type SafetyReferenceSearchOptions = {
  query: string;
  limit?: number;
  itemType?: string;
  sourceId?: string;
  riskTag?: string;
  evidenceRole?: "direct" | "supporting";
};

export function deriveSafetyReferenceRetrievalModeFromItems(
  items: readonly SafetyReferenceItem[],
  fallback: SafetyReferenceRetrievalMode = "unconfigured"
): SafetyReferenceRetrievalMode {
  if (!items.length) return "unconfigured";
  const hasLocal = items.some((item) => item.retrieval_source === "local-tag"
    || item.retrieval_source === "local-ranked"
    || item.retrieval_source === "local-hybrid");
  const hasRemote = items.some((item) => item.retrieval_source === "rest"
    || item.retrieval_source === "ranked"
    || item.retrieval_source === "vector"
    || item.retrieval_source === "hybrid");
  if (hasLocal && hasRemote) return "hybrid-local-supabase";
  if (hasLocal) {
    if (items.some((item) => item.retrieval_source === "local-hybrid")) return "local-hybrid";
    if (items.some((item) => item.retrieval_source === "local-ranked")) return "local-ranked";
    return "local-tag";
  }
  if (hasRemote) {
    if (items.some((item) => item.retrieval_source === "hybrid" || item.retrieval_source === "vector")) {
      return "hybrid-vector-rpc";
    }
    if (items.some((item) => item.retrieval_source === "ranked")) return "ranked-rpc";
    return "rest-ilike";
  }
  return fallback;
}

export async function searchSafetyReferences(options: SafetyReferenceSearchOptions): Promise<SafetyReferenceSearchResult> {
  const config = getSupabaseConfig();
  const query = options.query.trim();
  const limit = Math.min(Math.max(options.limit || 12, 1), 50);
  const fetchLimit = options.evidenceRole ? Math.min(limit * 3, 50) : limit;
  const vectorRuntime = resolveSafetyReferenceVectorSearchState();
  let vectorSearch = vectorRuntime.status;
  if (!config) {
    return {
      ok: false,
      configured: false,
      query,
      count: 0,
      items: [],
      retrievalMode: "unconfigured",
      vectorSearch,
      message: "Supabase service role key가 없어 안전 지식 DB 검색을 실행하지 않았습니다."
    };
  }

  // Track E-3: try the ranked RPC first when no specialised filters block it.
  // RPC handles only `query` + `itemType`. For sourceId/riskTag we still use the
  // legacy ilike path. evidenceRole is post-filtered on returned items.
  if (query && !options.sourceId && !options.riskTag) {
    const vector = await fetchVectorReferences(config, query, fetchLimit, options.itemType, vectorRuntime);
    vectorSearch = vector.status;
    const ranked = await fetchRankedReferences(config, query, fetchLimit, options.itemType);
    if ((ranked && ranked.ok && ranked.items.length) || vector.items.length) {
      const merged = mergeSafetyReferenceHybridResults({
        vectorItems: vector.items,
        rankedItems: ranked?.ok ? ranked.items : [],
        limit,
        evidenceRole: options.evidenceRole
      });
      const filtered = filterAndRankSafetyReferencesByQuery(query, merged, limit);
      return {
        ok: true,
        configured: true,
        query,
        count: filtered.length,
        items: filtered,
        retrievalMode: vector.items.length > 0 ? "hybrid-vector-rpc" : "ranked-rpc",
        vectorSearch,
        koshaGrounding: summarizeKoshaGrounding({ items: filtered }),
        message: vector.items.length > 0
          ? "Supabase 안전 지식 DB vector+ranked 하이브리드 결과를 사용했습니다."
          : "Supabase 안전 지식 DB ranked RPC 결과를 사용했습니다."
      };
    }
    // Otherwise fall through to legacy ilike path (RPC missing or empty).
  }

  const params = new URLSearchParams();
  params.set("select", SELECT_FIELDS);
  params.set("limit", String(fetchLimit));
  params.set("order", "item_type.asc,title.asc");
  if (options.itemType) params.set("item_type", `eq.${options.itemType}`);
  if (options.sourceId) params.set("source_id", `eq.${options.sourceId}`);
  if (options.riskTag) params.set("risk_tags", `cs.{"${options.riskTag}"}`);

  const searchTerm = safeIlikeTerm(query);
  if (searchTerm) {
    params.set("or", `(title.ilike.*${searchTerm}*,summary.ilike.*${searchTerm}*,body.ilike.*${searchTerm}*)`);
  }

  const firstPass = await fetchReferenceItems(config, params);
  if (!firstPass.ok) {
    return {
      ok: false,
      configured: true,
      errorCode: SAFETY_REFERENCE_SEARCH_FAILURE_CODE,
      query,
      count: 0,
      items: [],
      retrievalMode: "rest-ilike",
      vectorSearch,
      message: SAFETY_REFERENCE_SEARCH_FAILURE_MESSAGE
    };
  }

  let items = filterByEvidenceRole(
    firstPass.items.map((item) => withRetrievalSource(item, "rest")),
    options.evidenceRole
  );
  if (items.length === 0 && searchTerm.includes(" ")) {
    const byId = new Map<string, SafetyReferenceItem>();
    const fallbackTerms = extractFallbackTerms(searchTerm);
    const minimumSignalPasses = Math.min(4, fallbackTerms.length);
    for (const [index, term] of fallbackTerms.entries()) {
      const fallbackParams = new URLSearchParams(params);
      fallbackParams.set("limit", String(fetchLimit));
      fallbackParams.set("or", `(title.ilike.*${term}*,summary.ilike.*${term}*,body.ilike.*${term}*)`);
      const fallback = await fetchReferenceItems(config, fallbackParams);
      if (fallback.ok) {
        filterByEvidenceRole(
          fallback.items.map((item) => withRetrievalSource(item, "rest")),
          options.evidenceRole
        ).forEach((item) => byId.set(item.id, item));
      } else {
        log.error("safety reference fallback search failed", {
          event: SAFETY_REFERENCE_SEARCH_FAILURE_CODE,
          errorCode: SAFETY_REFERENCE_SEARCH_FAILURE_CODE,
          status: fallback.status
        });
      }
      if (index + 1 >= minimumSignalPasses && byId.size >= limit) break;
    }
    items = Array.from(byId.values());
  }
  items = filterAndRankSafetyReferencesByQuery(query, items, limit);

  return {
    ok: true,
    configured: true,
    query,
    count: items.slice(0, limit).length,
    items: items.slice(0, limit),
    retrievalMode: "rest-ilike",
    vectorSearch,
    koshaGrounding: summarizeKoshaGrounding({ items: items.slice(0, limit) }),
    message: "Supabase 안전 지식 DB에서 참고자료를 조회했습니다."
  };
}

function filterByEvidenceRole(
  items: SafetyReferenceItem[],
  evidenceRole: "direct" | "supporting" | undefined
): SafetyReferenceItem[] {
  if (!evidenceRole) return items;
  return items.filter((item) => deriveEvidenceRole(item) === evidenceRole);
}

async function readItemTypeCounts(config: SupabaseConfig): Promise<Array<{ itemType: string; count: number }>> {
  const itemTypes = [
    "sif-case",
    "construction-process",
    "machinery",
    "risk-manual",
    "jsa-training",
    "technical-guideline",
    "technical-support-regulation"
  ];
  const counts = await Promise.all(
    itemTypes.map(async (itemType) => ({
      itemType,
      count: await countRows(config, {
        label: "items",
        table: "safety_reference_items",
        filters: { item_type: `eq.${itemType}` }
      })
    }))
  );
  return counts.filter((item) => item.count > 0);
}

export async function getSafetyReferenceStats(): Promise<SafetyReferenceStats> {
  const config = getSupabaseConfig();
  if (!config) {
    return {
      ok: false,
      configured: false,
      status: "unconfigured",
      sources: 0,
      items: 0,
      expectedTechnicalTotal: EXPECTED_TECHNICAL_TOTAL,
      technicalTotal: 0,
      technicalSupportRegulations: 0,
      technicalGuidelines: 0,
      technicalSplitOk: false,
      catalogSearchOk: false,
      ingestionRuns: 0,
      itemTypes: [],
      samples: [],
      message: "Supabase service role key가 없어 안전 지식 DB 상태를 확인하지 않았습니다."
    };
  }

  try {
    const countSpecs: CountSpec[] = [
      { label: "sources", table: "safety_reference_sources" },
      { label: "items", table: "safety_reference_items" },
      {
        label: "technicalTotal",
        table: "safety_reference_items",
        filters: { source_id: `eq.${TECHNICAL_SOURCE_ID}` }
      },
      {
        label: "technicalSupportRegulations",
        table: "safety_reference_items",
        filters: { source_id: `eq.${TECHNICAL_SOURCE_ID}`, item_type: "eq.technical-support-regulation" }
      },
      {
        label: "technicalGuidelines",
        table: "safety_reference_items",
        filters: { source_id: `eq.${TECHNICAL_SOURCE_ID}`, item_type: "eq.technical-guideline" }
      },
      { label: "ingestionRuns", table: "safety_reference_ingestion_runs" }
    ];
    const counts = await Promise.all(countSpecs.map(async (spec) => [spec.label, await countRows(config, spec)] as const));
    const countMap = Object.fromEntries(counts) as Record<CountSpec["label"], number>;
    const samples = await searchSafetyReferences({
      query: "위험성평가 작업계획 TBM",
      sourceId: TECHNICAL_SOURCE_ID,
      limit: 6
    });
    const itemTypes = await readItemTypeCounts(config);
    const technicalSplitOk =
      countMap.technicalTotal === EXPECTED_TECHNICAL_TOTAL &&
      countMap.technicalSupportRegulations + countMap.technicalGuidelines === countMap.technicalTotal;
    const catalogSearchOk = samples.ok;
    const status: SafetyReferenceStats["status"] = technicalSplitOk && catalogSearchOk ? "ready" : "degraded";

    return {
      ok: status === "ready",
      configured: true,
      status,
      sources: countMap.sources,
      items: countMap.items,
      expectedTechnicalTotal: EXPECTED_TECHNICAL_TOTAL,
      technicalTotal: countMap.technicalTotal,
      technicalSupportRegulations: countMap.technicalSupportRegulations,
      technicalGuidelines: countMap.technicalGuidelines,
      technicalSplitOk,
      catalogSearchOk,
      ingestionRuns: countMap.ingestionRuns,
      itemTypes,
      samples: samples.items,
      message: technicalSplitOk
        ? `기술지원규정 폴더 ${EXPECTED_TECHNICAL_TOTAL.toLocaleString("ko-KR")}건 기준과 Supabase 기술지원규정 소스 ${countMap.technicalTotal.toLocaleString("ko-KR")}건을 연결했습니다.`
        : `기술지원규정 기준 ${EXPECTED_TECHNICAL_TOTAL.toLocaleString("ko-KR")}건과 현재 연결 ${countMap.technicalTotal.toLocaleString("ko-KR")}건이 달라 점검이 필요합니다.`
    };
  } catch (error) {
    log.error("safety reference stats failed", {
      event: "safety_reference_stats_failed",
      errorCode: "safety_reference_stats_failed",
      errorType: error instanceof Error ? error.name : typeof error
    });
    return {
      ok: false,
      configured: true,
      status: "degraded",
      sources: 0,
      items: 0,
      expectedTechnicalTotal: EXPECTED_TECHNICAL_TOTAL,
      technicalTotal: 0,
      technicalSupportRegulations: 0,
      technicalGuidelines: 0,
      technicalSplitOk: false,
      catalogSearchOk: false,
      ingestionRuns: 0,
      itemTypes: [],
      samples: [],
      message: "안전 지식 DB 상태 확인 중 오류가 발생했습니다."
    };
  }
}
