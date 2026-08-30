// GET /api/ontology/graph — 안전 온톨로지 그래프 JSON (published만).
// 시각화·외부 소비용. 노출 게이트: loadGraph("published")가 published 행만 조회하고
// assembleGraph가 무출처 노드/엣지를 드롭한다. 캐시 5분 (s-maxage=300).

import { NextRequest, NextResponse } from "next/server";
import { loadPublicOntologyGraph } from "@/lib/ontology-graph";
import { withPublicStatusAdmission } from "@/lib/server/status-admission";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return withPublicStatusAdmission(request, async (signal) => {
    const result = await loadPublicOntologyGraph(signal);
    const status = result.ok ? 200 : result.configured ? 502 : 503;
    return NextResponse.json(result, {
      status,
      headers: result.ok
        ? { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60" }
        : { "Cache-Control": "no-store" }
    });
  });
}
