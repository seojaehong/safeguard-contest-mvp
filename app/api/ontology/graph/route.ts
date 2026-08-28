// GET /api/ontology/graph — 안전 온톨로지 그래프 JSON (published만).
// 시각화·외부 소비용. 노출 게이트: loadGraph("published")가 published 행만 조회하고
// assembleGraph가 무출처 노드/엣지를 드롭한다. 캐시 5분 (s-maxage=300).

import { NextRequest, NextResponse } from "next/server";
import {
  applyPublicStatusAdmissionHeaders,
  runPublicOntologyGraphRead,
} from "@/lib/public-status-operation";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const graphRead = await runPublicOntologyGraphRead(request);
  if (!graphRead.ok) return graphRead.response;
  const result = graphRead.data;
  const status = result.ok ? 200 : result.configured ? 502 : 503;
  return applyPublicStatusAdmissionHeaders(NextResponse.json(result, {
    status,
    headers: result.ok
      ? { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60" }
      : { "Cache-Control": "no-store" }
  }), graphRead.admissionHeaders);
}
