// generate_risk_assessment 결과에 생성 품질 신호를 싣는다(261101 교차 검토 A5).
// generation{askMode, fallbackUsed, answerProvider} = runAsk 의 generationTrace. 보조 응답(fallback)으로 만든 결과는 status 로 구분한다.
import { describe, expect, it } from "vitest";

import { createGenerateRiskAssessmentHandler, type RiskAssessmentToolResult } from "@/lib/mcp-risk-assessment";
import { buildMockAskResponse } from "@/lib/mock-data";
import { canonicalizeRiskAssessmentResponse } from "@/lib/risk-assessment-record";
import type { AskResponse, GenerationTrace } from "@/lib/types";

const QUESTION = "가상 사업장 누리물류 경기 화성 물류창고 지게차 상하차 작업 4명, 비 예보, 야간";

function trace(fallbackUsed: boolean): GenerationTrace {
  return {
    traceId: "trace-fixture",
    askMode: "enhanced",
    answer: { provider: fallbackUsed ? "safeclaw" : "anthropic", model: fallbackUsed ? null : "model-fixture" },
    deliverables: { attempted: false, provider: null, modelPerDocument: {} },
    fallbackUsed,
  };
}

async function payloadFor(response: AskResponse): Promise<RiskAssessmentToolResult> {
  const handler = createGenerateRiskAssessmentHandler({
    defaultMode: "enhanced",
    generateResponse: async () => response,
    renderXlsx: async () => ({ ok: true, buffer: Buffer.from("PK"), fileName: "a.xlsx", fallbackName: "a" }),
    renderHwp: () => ({ buffer: Buffer.from("x"), fileName: "a.hwp" }),
  });
  const result = await handler({ question: QUESTION }, { siteId: null, orgId: null, scopes: ["tools:*"], source: "env", tokenId: null }, { signal: new AbortController().signal });
  return JSON.parse(result.content[0]?.text ?? "{}") as RiskAssessmentToolResult;
}

const base = () => canonicalizeRiskAssessmentResponse(buildMockAskResponse(QUESTION, [], "mock", "fixture"));

describe("생성 품질 신호", () => {
  it("모델 생성이면 generation 에 모드·공급자를 싣고 status 는 ok", async () => {
    const payload = await payloadFor({ ...base(), generationTrace: trace(false) });
    expect(payload.generation).toEqual({ askMode: "enhanced", fallbackUsed: false, answerProvider: "anthropic" });
    expect(payload.status).toBe("ok");
  });

  it("보조 응답으로 만들었으면 status 를 ok_fallback 으로 구분한다", async () => {
    const payload = await payloadFor({ ...base(), generationTrace: trace(true) });
    expect(payload.generation).toEqual({ askMode: "enhanced", fallbackUsed: true, answerProvider: "safeclaw" });
    expect(payload.status).toBe("ok_fallback");
  });

  it("생성 기록이 없으면 모드만 적고 보조 응답 여부는 모른다(null)고 적는다", async () => {
    const { generationTrace: _omit, ...rest } = base();
    const payload = await payloadFor(rest as AskResponse);
    expect(payload.generation).toEqual({ askMode: "enhanced", fallbackUsed: null, answerProvider: null });
    expect(payload.status).toBe("ok");
  });
});
