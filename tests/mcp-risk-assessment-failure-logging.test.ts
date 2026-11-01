// 조용히 삼키던 실패 두 곳이 오류 종류만 남기는가(261101 2차 교차 검토 7).
// - generate_risk_assessment 렌더 실패: 파일만 빼고 결과는 돌려주되 서식·오류 종류를 남긴다.
// - fetchSafetyReferenceSources 조회 실패: 빈 Map 을 돌려주되 오류 종류를 남긴다.
// 오류 메시지 본문은 남기지 않는다(렌더러·DB 오류 문구에 사용자 입력이나 주소가 섞일 수 있다, lib/search.ts 와 같은 방침).
import { afterEach, describe, expect, it, vi } from "vitest";

import type { RiskAssessmentToolResult } from "@/lib/mcp-risk-assessment";
import { createGenerateRiskAssessmentHandler } from "@/lib/mcp-risk-assessment";
import { buildMockAskResponse } from "@/lib/mock-data";
import { canonicalizeRiskAssessmentResponse } from "@/lib/risk-assessment-record";
import { fetchSafetyReferenceSources } from "@/lib/safety-reference-catalog";

const QUESTION = "가상 사업장 누리물류 물류창고 지게차 상하차 작업 4명";
const SECRET = "V_SECRET_DETAIL_가상";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function errorLines(spy: { mock: { calls: unknown[][] } }): string {
  return spy.mock.calls.map((call) => call.map(String).join(" ")).join("\n");
}

async function callWith(format: "xlsx" | "hwp", renderers: {
  renderXlsx: Parameters<typeof createGenerateRiskAssessmentHandler>[0]["renderXlsx"];
  renderHwp: Parameters<typeof createGenerateRiskAssessmentHandler>[0]["renderHwp"];
}): Promise<RiskAssessmentToolResult> {
  const response = canonicalizeRiskAssessmentResponse(buildMockAskResponse(QUESTION, [], "mock", "fixture"));
  const handler = createGenerateRiskAssessmentHandler({ defaultMode: "enhanced", generateResponse: async () => response, ...renderers });
  const result = await handler({ question: QUESTION, format }, { siteId: null, orgId: null, scopes: ["tools:*"], source: "env", tokenId: null }, { signal: new AbortController().signal });
  return JSON.parse(result.content[0]?.text ?? "{}") as RiskAssessmentToolResult;
}

describe("generate_risk_assessment 렌더 실패 기록", () => {
  it("xlsx 렌더러가 본문을 거절하면 파일만 빼고, 서식과 오류 종류(RiskAssessmentRenderError)를 남기며 거절 문구는 남기지 않는다", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const payload = await callWith("xlsx", {
      renderXlsx: async () => ({ ok: false, status: 400, error: SECRET }),
      renderHwp: () => { throw new Error("unused"); }
    });
    expect(payload.file).toBeNull();
    expect(payload.fileUnavailableReason).toBeTruthy();
    const lines = errorLines(errorSpy);
    expect(lines).toContain("\"format\":\"xlsx\"");
    expect(lines).toContain("\"errorType\":\"RiskAssessmentRenderError\"");
    expect(lines).not.toContain(SECRET);
  });

  it("hwp 렌더러가 던지면 그 오류 종류를 남기고 메시지는 남기지 않는다", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const payload = await callWith("hwp", {
      renderXlsx: async () => ({ ok: false, status: 400, error: "unused" }),
      renderHwp: () => { throw new TypeError(SECRET); }
    });
    expect(payload.file).toBeNull();
    const lines = errorLines(errorSpy);
    expect(lines).toContain("\"format\":\"hwp\"");
    expect(lines).toContain("\"errorType\":\"TypeError\"");
    expect(lines).not.toContain(SECRET);
  });
});

describe("fetchSafetyReferenceSources 조회 실패 기록", () => {
  it("요청이 던지면 빈 Map 을 돌려주고 오류 종류만 남긴다", async () => {
    vi.stubEnv("SUPABASE_URL", "https://v-test-project.supabase.invalid");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "v-test-service-role-key");
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError(SECRET); }));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const sources = await fetchSafetyReferenceSources(["v-source"]);
    expect(sources.size).toBe(0);
    const lines = errorLines(errorSpy);
    expect(lines).toMatch(/safety_reference_sources/u);
    expect(lines).toContain("\"errorType\":\"TypeError\"");
    expect(lines).not.toContain(SECRET);
  });
});
