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
};

export type SafetyReferenceSearchResult = {
  ok: boolean;
  configured: boolean;
  query: string;
  count: number;
  items: SafetyReferenceItem[];
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

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
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
  return {
    ...item,
    source_url: item.source_url || null
  };
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
}): Promise<SafetyReferenceSearchResult> {
  const config = getSupabaseConfig();
  const query = options.query.trim();
  const limit = Math.min(Math.max(options.limit || 12, 1), 50);
  if (!config) {
    return {
      ok: false,
      configured: false,
      query,
      count: 0,
      items: [],
      message: "Supabase service role key가 없어 안전 지식 DB 검색을 실행하지 않았습니다."
    };
  }

  const params = new URLSearchParams();
  params.set("select", SELECT_FIELDS);
  params.set("limit", String(limit));
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
      message: firstPass.message
    };
  }

  let items = firstPass.items;
  if (items.length === 0 && searchTerm.includes(" ")) {
    const byId = new Map<string, SafetyReferenceItem>();
    const fallbackTerms = extractFallbackTerms(searchTerm);
    for (const term of fallbackTerms) {
      const fallbackParams = new URLSearchParams(params);
      fallbackParams.set("limit", String(limit));
      fallbackParams.set("or", `(title.ilike.*${term}*,summary.ilike.*${term}*,body.ilike.*${term}*)`);
      const fallback = await fetchReferenceItems(config, fallbackParams);
      if (fallback.ok) {
        fallback.items.forEach((item) => byId.set(item.id, item));
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
    count: items.length,
    items,
    message: "Supabase 안전 지식 DB에서 참고자료를 조회했습니다."
  };
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
