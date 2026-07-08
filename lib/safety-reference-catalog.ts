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
  retrieval_source?: "rest" | "ranked" | "vector" | "hybrid";
  vector_similarity?: number;
};

export type SafetyReferenceRetrievalMode = "unconfigured" | "rest-ilike" | "ranked-rpc" | "hybrid-vector-rpc";

export type SafetyReferenceVectorStatus = {
  enabled: boolean;
  attempted: boolean;
  ok: boolean;
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

function normalizeReferenceItem(item: SafetyReferenceItem): SafetyReferenceItem {
  const evidenceRole = deriveEvidenceRole(item);
  const reflectedDocuments = item.reflected_documents?.length ? item.reflected_documents : item.primary_documents;
  return {
    ...item,
    source_url: item.source_url || null,
    evidence_role: evidenceRole,
    reflected_documents: reflectedDocuments,
    short_summary: buildShortSummary(item),
    evidence_role_label: evidenceRole === "direct" ? "문서 문구 직접 근거" : "현장 판단 보조 근거",
    document_reflection_label: buildDocumentReflectionLabel(reflectedDocuments, item.controls),
    source_kind_label: buildSourceKindLabel(item.item_type),
    operation_signal_label: buildOperationSignalLabel(item.item_type, item.controls)
  };
}

function deriveEvidenceRole(item: Pick<SafetyReferenceItem, "item_type" | "source_id">): "direct" | "supporting" {
  const directTypes = new Set([
    "construction-process",
    "machinery",
    "risk-manual",
    "technical-guideline",
    "technical-support-regulation"
  ]);
  if (directTypes.has(item.item_type)) return "direct";
  if (item.source_id.includes("law") || item.source_id.includes("regulation")) return "direct";
  return "supporting";
}

function compactText(value: string, maxLength = 96): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}

function buildShortSummary(item: SafetyReferenceItem): string {
  const controlHint = item.controls.slice(0, 2).join(" · ");
  const base = controlHint || item.summary || item.title;
  return compactText(base);
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

function extractFallbackTerms(value: string): string[] {
  const stopwords = new Set([
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
  return Array.from(new Set(
    normalized
      .split(/\s+/)
      .map((term) => term.trim())
      .filter((term) => term.length >= 2 && !stopwords.has(term))
  )).slice(0, 8);
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
  return {
    ...item,
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
    const body = await response.text().catch(() => "");
    return {
      ok: false,
      status: response.status,
      message: `safety_reference_items 조회 실패: ${response.status} ${body}`,
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
    return {
      ok: false,
      status: 0,
      message: `RPC 호출 실패: ${error instanceof Error ? error.message : String(error)}`,
      items: []
    };
  }
  if (response.status === 404) {
    return null; // RPC missing — caller should fall back.
  }
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    return {
      ok: false,
      status: response.status,
      message: `RPC 조회 실패: ${response.status} ${body}`,
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
        return { ok: false, message: `OpenAI embedding 생성 실패: ${response.status} ${text}` };
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
    } catch (error) {
      if (attempt === 0) continue;
      return {
        ok: false,
        message: `OpenAI embedding 호출 실패: ${error instanceof Error ? error.message : String(error)}`
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
    console.error("Safety reference vector embedding failed", embedding.message);
    return {
      status: {
        ...runtime.status,
        attempted: true,
        ok: false,
        reason: "embedding-failed",
        count: 0,
        message: embedding.message
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
    const message = `SIF 임베딩 RPC 호출 실패: ${error instanceof Error ? error.message : String(error)}`;
    console.error(message);
    return {
      status: {
        ...runtime.status,
        attempted: true,
        ok: false,
        reason: "rpc-failed",
        count: 0,
        message
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
    const body = await response.text().catch(() => "");
    return {
      status: {
        ...runtime.status,
        attempted: true,
        ok: false,
        reason: "rpc-failed",
        count: 0,
        message: `SIF 임베딩 RPC 조회 실패: ${response.status} ${body}`
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
    const text = await response.text().catch(() => "");
    throw new Error(`${spec.table} count failed: ${response.status} ${text}`);
  }
  return parseContentRange(response.headers.get("content-range"));
}

export async function searchSafetyReferences(options: {
  query: string;
  limit?: number;
  itemType?: string;
  sourceId?: string;
  riskTag?: string;
  evidenceRole?: "direct" | "supporting";
}): Promise<SafetyReferenceSearchResult> {
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
      const filtered = mergeSafetyReferenceHybridResults({
        vectorItems: vector.items,
        rankedItems: ranked?.ok ? ranked.items : [],
        limit,
        evidenceRole: options.evidenceRole
      });
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
      query,
      count: 0,
      items: [],
      retrievalMode: "rest-ilike",
      vectorSearch,
      message: firstPass.message
    };
  }

  let items = filterByEvidenceRole(
    firstPass.items.map((item) => withRetrievalSource(item, "rest")),
    options.evidenceRole
  );
  if (items.length === 0 && searchTerm.includes(" ")) {
    const byId = new Map<string, SafetyReferenceItem>();
    const fallbackTerms = extractFallbackTerms(searchTerm);
    for (const term of fallbackTerms) {
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
        console.error("Safety reference fallback search failed", fallback.message);
      }
      if (byId.size >= limit) break;
    }
    items = Array.from(byId.values()).slice(0, limit);
  }

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
    console.error("Safety reference stats failed", error);
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
      message: error instanceof Error ? error.message : "안전 지식 DB 상태 확인 중 오류가 발생했습니다."
    };
  }
}
