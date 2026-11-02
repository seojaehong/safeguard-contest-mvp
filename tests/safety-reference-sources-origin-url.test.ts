// 원천 자료 행(safety_reference_sources)의 origin_url 은 승인된 공공 출처 https 주소만 돌려준다(261101 2차 교차 검토 5).
// MCP generate_risk_assessment 의 sif.cases 출처 주소로 그대로 나가므로, 항목 source_url 과 같은 거름
// (normalizeApprovedSafetyReferenceProvenanceUrl)을 건다. DB 는 가짜 주소·가짜 키와 fetch 시험 더블로 막는다.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchSafetyReferenceSources } from "@/lib/safety-reference-catalog";

const ROWS = [
  { id: "v-approved", agency: "가상 기관", title: "가상 원천 1", published_at: "2026-04-01", origin_url: "https://www.kosha.or.kr/v-approved#frag" },
  { id: "v-http", agency: null, title: null, published_at: null, origin_url: "http://www.kosha.or.kr/v-http" },
  { id: "v-unapproved", agency: null, title: null, published_at: null, origin_url: "https://example.invalid/v-unapproved" },
  { id: "v-credential", agency: null, title: null, published_at: null, origin_url: "https://user:pw@data.go.kr/v-credential" },
  { id: "v-script", agency: null, title: null, published_at: null, origin_url: "javascript:alert(1)" }
];

beforeEach(() => {
  vi.stubEnv("SUPABASE_URL", "https://v-test-project.supabase.invalid");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "v-test-service-role-key");
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(ROWS), { status: 200, headers: { "content-type": "application/json" } })));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("fetchSafetyReferenceSources originUrl", () => {
  it("승인된 https 공공 출처만 남기고 나머지는 null 로 둔다", async () => {
    const sources = await fetchSafetyReferenceSources(ROWS.map((row) => row.id));
    expect(sources.get("v-approved")?.originUrl).toBe("https://www.kosha.or.kr/v-approved");
    for (const id of ["v-http", "v-unapproved", "v-credential", "v-script"]) {
      expect(sources.get(id)?.originUrl).toBeNull();
    }
    // 다른 칸은 그대로 읽는다.
    expect(sources.get("v-approved")).toMatchObject({ agency: "가상 기관", title: "가상 원천 1", publishedAt: "2026-04-01" });
  });
});
