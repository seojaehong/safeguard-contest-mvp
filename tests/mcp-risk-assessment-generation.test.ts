// generate_risk_assessment 결과의 생성 품질 신호(261101 교차 검토 A5, 2차 검토 3).
// generation{askMode, rowsOrigin, fallbackUsed} = runAsk generationTrace. status 는 본표 행을 만든 분기(rowsOrigin)로 정한다 —
// 전역 fallbackUsed(답변·문서 어느 하나라도 보조 응답이면 true)로 정하지 않는다.
import { describe, expect, it } from "vitest";

import { createGenerateRiskAssessmentHandler, type RiskAssessmentToolResult } from "@/lib/mcp-risk-assessment";
import { buildMockAskResponse } from "@/lib/mock-data";
import { canonicalizeRiskAssessmentResponse } from "@/lib/risk-assessment-record";
import type { AskResponse, GenerationTrace } from "@/lib/types";

const QUESTION = "가상 사업장 누리물류 경기 화성 물류창고 지게차 상하차 작업 4명, 비 예보, 야간";

function trace(rowsOrigin: NonNullable<GenerationTrace["rowsOrigin"]>, fallbackUsed: boolean, askMode: GenerationTrace["askMode"] = "enhanced"): GenerationTrace {
  return {
    traceId: "trace-fixture",
    askMode,
    answer: { provider: "safeclaw", model: null, composition: "safeclaw_db_harness", upstream: { provider: "mock", model: null, fallbackUsed, usedInFinal: false } },
    deliverables: { attempted: false, provider: null, modelPerDocument: {} },
    fallbackUsed,
    rowsOrigin,
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
  it("DB 근거 행이면 답변 생성이 보조 응답으로 끝났어도(fallbackUsed=true) status 는 ok", async () => {
    const payload = await payloadFor({ ...base(), generationTrace: trace("db_harness", true) });
    expect(payload.generation).toEqual({ askMode: "enhanced", rowsOrigin: "db_harness", fallbackUsed: true });
    expect(payload.status).toBe("ok");
  });

  it("모델 생성 행·요청한 template 행도 ok", async () => {
    expect((await payloadFor({ ...base(), generationTrace: trace("ai", false, "full") })).status).toBe("ok");
    expect((await payloadFor({ ...base(), generationTrace: trace("template", false, "template") })).status).toBe("ok");
  });

  it("DB 근거가 없어 작업 유형 기본 행으로 대신했으면 fallbackUsed=false 여도 ok_fallback", async () => {
    const payload = await payloadFor({ ...base(), generationTrace: trace("fallback_baseline", false) });
    expect(payload.generation).toEqual({ askMode: "enhanced", rowsOrigin: "fallback_baseline", fallbackUsed: false });
    expect(payload.status).toBe("ok_fallback");
  });

  it("생성 기록이 없으면 모드만 적고 행 출처·보조 응답 여부는 모른다(null)고 적는다", async () => {
    const { generationTrace: _omit, ...rest } = base();
    const payload = await payloadFor(rest as AskResponse);
    expect(payload.generation).toEqual({ askMode: "enhanced", rowsOrigin: null, fallbackUsed: null });
    expect(payload.status).toBe("ok");
  });
});
