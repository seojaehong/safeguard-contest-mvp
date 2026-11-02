// generate_risk_assessment 는 서식 파일을 못 만들어도 본표 결과를 버리지 않는다(261101 교차 검토 A2).
// - 렌더 실패(예산 초과 DocumentExportLimitError·xlsx ok:false·rhwp WASM 없음) → file:null + fileUnavailableReason.
// - 응답 크기 상한 초과 → 먼저 rows[].cells(structuredRows 로 다시 만들 수 있는 중복)를 빼고, 그래도 넘으면 file 을 뺀다.
// - 결과 JSON 은 들여쓰기 없이 싣는다.
import { describe, expect, it } from "vitest";

import { DocumentExportLimitError } from "@/lib/document-export-budget";
import {
  createGenerateRiskAssessmentHandler,
  fitRiskAssessmentToolResult,
  type RiskAssessmentToolResult,
} from "@/lib/mcp-risk-assessment";
import { buildMockAskResponse } from "@/lib/mock-data";
import { canonicalizeRiskAssessmentResponse } from "@/lib/risk-assessment-record";
import type { McpAuthContext } from "@/lib/mcp-auth";

const AUTH: McpAuthContext = { siteId: null, orgId: null, scopes: ["tools:*"], source: "env", tokenId: null };
const QUESTION = "가상 사업장 누리물류 경기 화성 물류창고 지게차 상하차 작업 4명, 비 예보, 야간";

function response() {
  return canonicalizeRiskAssessmentResponse(buildMockAskResponse(QUESTION, [], "mock", "fixture"));
}

async function call(deps: Partial<Parameters<typeof createGenerateRiskAssessmentHandler>[0]>, format: "xlsx" | "hwp") {
  const handler = createGenerateRiskAssessmentHandler({
    defaultMode: "enhanced",
    generateResponse: async () => response(),
    renderXlsx: async () => ({ ok: true, buffer: Buffer.from("PK-fixture"), fileName: "a.xlsx", fallbackName: "a" }),
    renderHwp: () => ({ buffer: Buffer.from("hwp-fixture"), fileName: "a.hwp" }),
    ...deps,
  });
  const result = await handler({ question: QUESTION, format }, AUTH, { signal: new AbortController().signal });
  return { result, payload: JSON.parse(result.content[0]?.text ?? "{}") as RiskAssessmentToolResult };
}

describe("렌더 실패는 결과를 버리지 않고 파일만 뺀다", () => {
  it("한글 예산 초과(DocumentExportLimitError)", async () => {
    const { result, payload } = await call({ renderHwp: () => { throw new DocumentExportLimitError("output bytes"); } }, "hwp");
    expect(result.isError).toBeFalsy();
    expect(payload.status).toBe("ok");
    expect(payload.riskAssessment.rowCount).toBeGreaterThan(0);
    expect(payload.file).toBeNull();
    expect(payload.fileUnavailableReason).toMatch(/크기 상한/u);
  });

  it("엑셀 렌더러가 ok:false 를 돌려줌", async () => {
    const { result, payload } = await call({ renderXlsx: async () => ({ ok: false, status: 400, error: "structured must be an object" }) }, "xlsx");
    expect(result.isError).toBeFalsy();
    expect(payload.file).toBeNull();
    expect(payload.fileUnavailableReason).toMatch(/서식 파일을 만들지 못했습니다/u);
  });

  it("rhwp WASM 을 찾지 못함 — 내부 경로를 결과에 싣지 않는다", async () => {
    const { result, payload } = await call({ renderHwp: () => { throw new Error("rhwp WASM not found in any of: C:/secret/path/rhwp_bg.wasm"); } }, "hwp");
    expect(result.isError).toBeFalsy();
    expect(payload.file).toBeNull();
    expect(payload.fileUnavailableReason).toMatch(/서식 파일을 만들지 못했습니다/u);
    expect(result.content[0]?.text).not.toContain("secret");
  });

  it("호출 취소는 결과로 바꾸지 않고 그대로 던진다", async () => {
    const controller = new AbortController();
    const handler = createGenerateRiskAssessmentHandler({
      defaultMode: "enhanced",
      generateResponse: async () => response(),
      renderXlsx: async () => { controller.abort(); throw controller.signal.reason; },
      renderHwp: () => ({ buffer: Buffer.from("x"), fileName: "a.hwp" }),
    });
    await expect(handler({ question: QUESTION, format: "xlsx" }, AUTH, { signal: controller.signal })).rejects.toBeTruthy();
  });
});

describe("응답 크기 상한", () => {
  async function fullResult() {
    const { payload } = await call({ renderXlsx: async () => ({ ok: true, buffer: Buffer.alloc(20_000, 7), fileName: "a.xlsx", fallbackName: "a" }) }, "xlsx");
    return payload;
  }
  const bytesOf = (value: unknown) => new TextEncoder().encode(JSON.stringify({ content: [{ type: "text", text: JSON.stringify(value) }] })).byteLength;

  it("결과 JSON 은 들여쓰기 없이 싣는다", async () => {
    const { result } = await call({}, "xlsx");
    expect(result.content[0]?.text).not.toMatch(/\n\s+"/u);
  });

  it("상한 안이면 그대로 돌려준다", async () => {
    const full = await fullResult();
    const fitted = fitRiskAssessmentToolResult(full, bytesOf(full));
    expect(JSON.parse(fitted.content[0]?.text ?? "{}")).toEqual(full);
  });

  it("조금 넘으면 rows[].cells 부터 빼고 파일은 남긴다", async () => {
    const full = await fullResult();
    const fitted = fitRiskAssessmentToolResult(full, bytesOf(full) - 1);
    const payload = JSON.parse(fitted.content[0]?.text ?? "{}") as RiskAssessmentToolResult;
    expect(fitted.isError).toBeFalsy();
    expect(payload.file?.base64).toBe(full.file?.base64);
    expect(payload.riskAssessment.rows.every((row) => !("cells" in row))).toBe(true);
    expect(payload.riskAssessment.structuredRows).toEqual(full.riskAssessment.structuredRows);
    expect(payload.trimmed).toEqual(["riskAssessment.rows[].cells"]);
  });

  it("cells 를 빼도 넘으면 파일을 빼고 이유를 적는다", async () => {
    const full = await fullResult();
    const fitted = fitRiskAssessmentToolResult(full, bytesOf({ ...full, file: null }) + 200);
    const payload = JSON.parse(fitted.content[0]?.text ?? "{}") as RiskAssessmentToolResult;
    expect(fitted.isError).toBeFalsy();
    expect(payload.file).toBeNull();
    expect(payload.fileUnavailableReason).toMatch(/응답 크기 상한/u);
    expect(payload.riskAssessment.structuredRows).toEqual(full.riskAssessment.structuredRows);
    expect(payload.trimmed).toEqual(["riskAssessment.rows[].cells", "file"]);
  });

  it("파일까지 빼도 넘으면 크기 초과 오류를 낸다", async () => {
    const full = await fullResult();
    const fitted = fitRiskAssessmentToolResult(full, 100);
    expect(fitted.isError).toBe(true);
    expect(fitted.content[0]?.text).toContain("MCP_TOOL_RESULT_TOO_LARGE");
  });
});
