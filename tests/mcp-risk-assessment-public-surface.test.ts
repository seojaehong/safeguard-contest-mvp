// MCP 결과 JSON 이 웹 /api/ask 공개 표면 정리(sanitizeAskResponsePublicSurface)와 내보내기 게이트(gateExportPayload)를
// 우회하지 않는가(261101 교차 검토 A3). 내부 표지를 근거 칸에 심고, 웹 경로(정리 → 게이트)를 지난 값과 MCP JSON 이 같은지 본다.
import { describe, expect, it } from "vitest";

import { sanitizeAskResponsePublicSurface } from "@/lib/ask-public-surface";
import { renderHwpDocumentExport } from "@/lib/document-export-hwp";
import { renderXlsxDocumentExport } from "@/lib/document-export-xlsx";
import { createGenerateRiskAssessmentHandler, type RiskAssessmentToolResult } from "@/lib/mcp-risk-assessment";
import { buildMockAskResponse } from "@/lib/mock-data";
import { canonicalizeRiskAssessmentResponse, displayEvidenceRefs } from "@/lib/risk-assessment-record";
import { buildRiskAssessmentExportBody } from "@/lib/risk-assessment-export-body";
import { gateExportPayload } from "@/lib/user-output-gate";
import type { AskResponse } from "@/lib/types";

const QUESTION = "가상 사업장 누리물류 경기 화성 물류창고 지게차 상하차 작업 4명, 비 예보, 야간";
const MARKERS = ["DB 하네스 보조근거", "검색: local-ranked", "deterministic 규칙", "fallback 응답"];

function markedResponse(): AskResponse {
  const base = canonicalizeRiskAssessmentResponse(buildMockAskResponse(QUESTION, [], "mock", "fixture"));
  const rows = (base.structured?.riskAssessmentRows ?? []).map((row, index) => (index === 0
    ? { ...row, evidenceRefs: [...MARKERS, ...row.evidenceRefs], currentControls: `${row.currentControls} (DB 하네스 deterministic fallback)` }
    : row));
  return { ...base, structured: { ...base.structured, riskAssessmentRows: rows } as AskResponse["structured"] };
}

async function mcpPayload(response: AskResponse, format: "xlsx" | "hwp") {
  const handler = createGenerateRiskAssessmentHandler({
    defaultMode: "enhanced",
    generateResponse: async () => response,
    renderXlsx: renderXlsxDocumentExport,
    renderHwp: renderHwpDocumentExport,
  });
  const result = await handler({ question: QUESTION, format }, { siteId: null, orgId: null, scopes: ["tools:*"], source: "env", tokenId: null }, { signal: new AbortController().signal });
  return JSON.parse(result.content[0]?.text ?? "{}") as RiskAssessmentToolResult;
}

describe("MCP JSON 은 웹 공개 표면과 같은 정리·게이트를 지난다", () => {
  it("본표 행·근거 칸은 웹 경로(정리 → 게이트)를 지난 값과 같고 내부 표지가 없다", async () => {
    const response = markedResponse();
    const web = gateExportPayload(sanitizeAskResponsePublicSurface(response));
    const payload = await mcpPayload(response, "xlsx");

    expect(payload.riskAssessment.structuredRows).toEqual(web.structured?.riskAssessmentRows);
    expect(payload.riskAssessment.rows[0]?.evidenceRefs).toEqual(displayEvidenceRefs(web.structured?.riskAssessmentRows?.[0]?.evidenceRefs));
    // 근거 칸의 내부 표지는 웹 공개 표면 정리가 바꾼다. 그 밖의 칸(현재 안전조치 등)은 웹과 같은 값이면 된다.
    const refs = JSON.stringify([payload.riskAssessment.rows.map((row) => row.evidenceRefs), payload.riskAssessment.structuredRows.map((row) => row.evidenceRefs)]);
    for (const marker of ["DB 하네스", "deterministic", "fallback"]) expect(refs).not.toContain(marker);
  });

  it("파일은 같은 정리·게이트 값으로 만든다(웹 편집기 본문 → 내보내기와 바이트가 같다)", async () => {
    const response = markedResponse();
    const web = gateExportPayload(sanitizeAskResponsePublicSurface(response));
    const payload = await mcpPayload(response, "hwp");
    const webFile = renderHwpDocumentExport(buildRiskAssessmentExportBody(web, "hwp"));
    expect(Buffer.from(payload.file?.base64 ?? "", "base64").equals(webFile.buffer)).toBe(true);
  });
});
