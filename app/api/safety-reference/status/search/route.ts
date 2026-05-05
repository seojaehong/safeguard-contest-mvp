import { NextRequest, NextResponse } from "next/server";
import {
  getSafetyReferenceStats,
  readSafetyReferenceLimit,
  searchSafetyReferences
} from "@/lib/safety-reference-catalog";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q") || "";
  const limit = readSafetyReferenceLimit(request.nextUrl.searchParams.get("limit"));
  const itemType = request.nextUrl.searchParams.get("itemType") || undefined;
  const sourceId = request.nextUrl.searchParams.get("sourceId") || undefined;
  const riskTag = request.nextUrl.searchParams.get("riskTag") || undefined;
  const evidenceRoleParam = request.nextUrl.searchParams.get("evidenceRole");
  const evidenceRole = evidenceRoleParam === "direct" || evidenceRoleParam === "supporting"
    ? evidenceRoleParam
    : undefined;

  const [status, search] = await Promise.all([
    getSafetyReferenceStats(),
    searchSafetyReferences({
      query,
      limit,
      itemType,
      sourceId,
      riskTag,
      evidenceRole
    })
  ]);

  return NextResponse.json({
    ok: status.configured && search.ok,
    route: "/api/safety-reference/status/search",
    purpose: "안전 지식 DB 연결 상태와 문서 반영용 근거 검색을 한 번에 확인합니다.",
    roleGuide: {
      direct: "문서 문구 직접 근거",
      supporting: "현장 판단 보조 근거"
    },
    status,
    search
  }, { status: status.configured && search.ok ? 200 : 503 });
}
