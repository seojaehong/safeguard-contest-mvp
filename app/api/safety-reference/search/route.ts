import { NextRequest, NextResponse } from "next/server";

type SafetyReferenceItem = {
  id: string;
  source_id: string;
  item_type: string;
  category: string | null;
  subcategory: string | null;
  title: string;
  summary: string;
  keywords: string[];
  risk_tags: string[];
  primary_documents: string[];
  controls: string[];
};

type SafetyReferenceResponse = {
  ok: boolean;
  configured: boolean;
  query: string;
  count: number;
  items: SafetyReferenceItem[];
  message: string;
};

export const dynamic = "force-dynamic";

function readLimit(value: string | null) {
  const parsed = Number(value || "12");
  if (!Number.isFinite(parsed)) return 12;
  return Math.min(Math.max(Math.trunc(parsed), 1), 50);
}

function safeIlikeTerm(value: string) {
  return value.replaceAll("*", "").replaceAll(",", " ").trim();
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
    isStringArray(record.keywords) &&
    isStringArray(record.risk_tags) &&
    isStringArray(record.primary_documents) &&
    isStringArray(record.controls)
  );
}

async function fetchSupabaseReferences(query: string, limit: number) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return {
      ok: false,
      configured: false,
      items: [],
      message: "Supabase service role key가 없어 지식 DB 검색을 실행하지 않았습니다."
    };
  }

  const searchTerm = safeIlikeTerm(query);
  const params = new URLSearchParams();
  params.set("select", "id,source_id,item_type,category,subcategory,title,summary,keywords,risk_tags,primary_documents,controls");
  params.set("limit", String(limit));
  params.set("order", "item_type.asc,title.asc");
  if (searchTerm) {
    params.set("or", `(title.ilike.*${searchTerm}*,summary.ilike.*${searchTerm}*,body.ilike.*${searchTerm}*)`);
  }

  const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/safety_reference_items?${params.toString()}`, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`
    },
    cache: "no-store"
  });

  if (!response.ok) {
    const body = await response.text();
    return {
      ok: false,
      configured: true,
      items: [],
      message: `safety_reference_items 조회 실패: ${response.status} ${body}`
    };
  }

  const data = await response.json() as unknown;
  const items = Array.isArray(data) ? data.filter(isReferenceItem) : [];
  return {
    ok: true,
    configured: true,
    items,
    message: "Supabase 안전 지식 DB에서 참고자료를 조회했습니다."
  };
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q") || "";
  const limit = readLimit(request.nextUrl.searchParams.get("limit"));
  const result = await fetchSupabaseReferences(query, limit);
  const body: SafetyReferenceResponse = {
    ok: result.ok,
    configured: result.configured,
    query,
    count: result.items.length,
    items: result.items,
    message: result.message
  };

  return NextResponse.json(body, { status: result.ok ? 200 : 503 });
}
