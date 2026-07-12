import { createLogger } from "@/lib/logger";
import type {
  KoshaGuideCorpusLookup
} from "@/lib/kosha-guide-corpus";
import {
  buildSafetyReferenceOperationalMetadata,
  compactText,
  deriveSafetyReferenceOperationalView,
  extractFallbackTerms,
  filterAndRankSafetyReferencesByQuery,
  getSafetyReferenceDisplayTitle,
  getSafetyReferenceDisplaySummary,
  getSafetyReferenceOperationalIncidentOverview,
  isSafetyReferenceCompatibleWithQuery,
  normalizeReferenceItem,
  parseContentRange,
  readSafetyReferenceLimit,
  scoreSafetyReferenceQueryMatch,
  safeIlikeTerm,
  withRetrievalSource,
  type SafetyReferenceItem,
  type SafetyReferenceOperationalView,
  type SafetyReferenceRetrievalMode,
  type SafetyReferenceVectorStatus
} from "@/lib/safety-reference-policy";

export type {
  SafetyReferenceItem,
  SafetyReferenceOperationalView,
  SafetyReferenceRetrievalMode,
  SafetyReferenceVectorStatus
} from "@/lib/safety-reference-policy";
export {
  buildSafetyReferenceOperationalMetadata,
  compactText,
  deriveSafetyReferenceOperationalView,
  filterAndRankSafetyReferencesByQuery,
  getSafetyReferenceDisplayTitle,
  getSafetyReferenceDisplaySummary,
  getSafetyReferenceOperationalIncidentOverview,
  isSafetyReferenceCompatibleWithQuery,
  readSafetyReferenceLimit,
  scoreSafetyReferenceQueryMatch
} from "@/lib/safety-reference-policy";

export const SAFETY_REFERENCE_SEARCH_FAILURE_CODE = "safety_reference_search_failed" as const;
export const SAFETY_REFERENCE_SEARCH_FAILURE_MESSAGE =
  "안전 지식 DB 조회를 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.";
export type SafetyReferenceErrorCode = typeof SAFETY_REFERENCE_SEARCH_FAILURE_CODE;
export const SAFETY_REFERENCE_VECTOR_FAILURE_CODE = "safety_reference_vector_failed" as const;
export const SAFETY_REFERENCE_VECTOR_FAILURE_MESSAGE =
  "벡터 조회를 완료하지 못해 text/ranked 검색으로 대체합니다.";
const log = createLogger("safety-reference-catalog");
export type SafetyReferenceSearchResult = {
  ok: boolean;
  configured: boolean;
  errorCode?: SafetyReferenceErrorCode;
  query: string;
  count: number;
  items: SafetyReferenceItem[];
  retrievalMode: SafetyReferenceRetrievalMode;
  vectorSearch: SafetyReferenceVectorStatus;
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
  "keywords",
  "risk_tags",
  "primary_documents",
  "controls"
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
  const items = Array.isArray(data) ? data.filter(isReferenceItem).map(normalizeReferenceItem) : [];
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
  const items = Array.isArray(data) ? data.filter(isReferenceItem).map(normalizeReferenceItem) : [];
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

function normalizeVectorReferenceRow(value: unknown): SafetyReferenceItem | null {
  if (!isReferenceItem(value)) return null;
  const record = value as Record<string, unknown>;
  return withRetrievalSource(
    normalizeReferenceItem(value),
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
  const items = Array.isArray(data)
    ? data.map(normalizeVectorReferenceRow).filter((item): item is SafetyReferenceItem => item !== null)
    : [];
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
  offlineCorpus?: KoshaGuideCorpusLookup;
};

async function searchSupabaseSafetyReferences(
  options: SafetyReferenceSearchOptions,
  config: SupabaseConfig,
  vectorRuntime: SafetyReferenceVectorRuntime
): Promise<SafetyReferenceSearchResult> {
  const query = options.query.trim();
  const limit = Math.min(Math.max(options.limit || 12, 1), 50);
  const fetchLimit = options.evidenceRole ? Math.min(limit * 3, 50) : limit;
  let vectorSearch = vectorRuntime.status;

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
    message: "Supabase 안전 지식 DB에서 참고자료를 조회했습니다."
  };
}

export async function searchSafetyReferences(options: SafetyReferenceSearchOptions): Promise<SafetyReferenceSearchResult> {
  const query = options.query.trim();
  const limit = Math.min(Math.max(options.limit || 12, 1), 50);
  const vectorRuntime = resolveSafetyReferenceVectorSearchState(options.offlineCorpus?.env || process.env);
  const config = getSupabaseConfig();
  if (!config) {
    return {
      ok: false,
      configured: false,
      query,
      count: 0,
      items: [],
      retrievalMode: "unconfigured",
      vectorSearch: vectorRuntime.status,
      message: "Supabase service role key가 없어 안전 지식 DB 검색을 실행하지 않았습니다."
    };
  }
  return await searchSupabaseSafetyReferences(options, config, vectorRuntime);
}

export function isSafetyReferenceRiskEligible(item: SafetyReferenceItem): boolean {
  return !item.kosha_guide;
}

function filterByEvidenceRole(
  items: SafetyReferenceItem[],
  evidenceRole: "direct" | "supporting" | undefined
): SafetyReferenceItem[] {
  if (!evidenceRole) return items;
  return items.filter((item) => item.evidence_role === evidenceRole);
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
