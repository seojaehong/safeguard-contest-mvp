// MCP 결과가 실제 웹 경로와 같은 값인가(261101 교차 검토 A3, 2차 검토 9).
// 기준 = 실제 웹 경로: runAsk 마지막 게이트(gateAskResponseUserOutput) → /api/ask 공개 표면 정리(sanitizeAskResponsePublicSurface)
// → 편집기 정본 행(buildInitialRiskRows)·내보내기 본문(buildSingleDocumentExportBody) → 실제 /api/export/{xlsx,hwp} 라우트.
// 내부 표지를 근거 칸·현재 안전조치 칸에 심어 둔다.
import ExcelJS from "exceljs";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { POST as exportHwp } from "@/app/api/export/hwp/route";
import { POST as exportXlsx } from "@/app/api/export/xlsx/route";
import { buildInitialRiskRows } from "@/components/WorkpackEditor";
import { sanitizeAskResponsePublicSurface } from "@/lib/ask-public-surface";
import { renderHwpDocumentExport } from "@/lib/document-export-hwp";
import { renderXlsxDocumentExport } from "@/lib/document-export-xlsx";
import { createGenerateRiskAssessmentHandler, type RiskAssessmentToolResult } from "@/lib/mcp-risk-assessment";
import { buildMockAskResponse } from "@/lib/mock-data";
import { canonicalizeRiskAssessmentResponse } from "@/lib/risk-assessment-record";
import {
  buildSingleDocumentExportBody,
  RISK_ASSESSMENT_EXPORT_TITLE,
  riskAssessmentFormProfile,
} from "@/lib/risk-assessment-export-body";
import type { RiskAssessmentRow } from "@/lib/risk-assessment-schema";
import { gateAskResponseUserOutput, gateExportPayload } from "@/lib/user-output-gate";
import type { AskResponse } from "@/lib/types";

const QUESTION = "가상 사업장 누리물류 경기 화성 물류창고 지게차 상하차 작업 4명, 비 예보, 야간";
const MARKERS = ["DB 하네스 보조근거", "검색: local-ranked", "deterministic 규칙", "fallback 응답"];

/** runAsk 가 돌려주는 모양(마지막 단계 gateAskResponseUserOutput 을 지남). */
function markedRunAskResponse(): AskResponse {
  const base = canonicalizeRiskAssessmentResponse(buildMockAskResponse(QUESTION, [], "mock", "fixture"));
  const rows = (base.structured?.riskAssessmentRows ?? []).map((row, index) => (index === 0
    ? { ...row, evidenceRefs: [...MARKERS, ...row.evidenceRefs], currentControls: `${row.currentControls} (DB 하네스 deterministic fallback)` }
    : row));
  return gateAskResponseUserOutput({ ...base, structured: { ...base.structured, riskAssessmentRows: rows } as AskResponse["structured"] });
}

type Format = "xlsx" | "hwp";

/** 편집기가 생성 직후 「Excel 표 양식」「한글 표 양식」을 누를 때 /api/export 에 보내는 본문. */
function editorBody(format: Format, scenario: AskResponse["scenario"], rows: RiskAssessmentRow[], reviewItems: RiskAssessmentRow[] | undefined) {
  return buildSingleDocumentExportBody({
    format,
    edited: false,
    title: RISK_ASSESSMENT_EXPORT_TITLE,
    rows: [],
    profile: riskAssessmentFormProfile(),
    scenario,
    riskAssessmentRows: rows,
    riskReviewItems: reviewItems,
  });
}

async function postExport(format: Format, body: Record<string, unknown>): Promise<Buffer> {
  const request = new NextRequest(`http://localhost/api/export/${format}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const response = format === "xlsx" ? await exportXlsx(request) : await exportHwp(request);
  expect(response.status).toBe(200);
  return Buffer.from(await response.arrayBuffer());
}

/** /api/ask 응답을 받은 편집기 → /api/export 라우트가 내는 파일(실제 웹 경로). */
async function webFile(response: AskResponse, format: Format): Promise<{ web: AskResponse; buffer: Buffer }> {
  const web = sanitizeAskResponsePublicSurface(response);
  const buffer = await postExport(format, editorBody(format, web.scenario, buildInitialRiskRows(web), web.structured?.riskReviewItems));
  return { web, buffer };
}

async function mcpPayload(response: AskResponse, format: Format) {
  const handler = createGenerateRiskAssessmentHandler({
    defaultMode: "enhanced",
    generateResponse: async () => response,
    renderXlsx: renderXlsxDocumentExport,
    renderHwp: renderHwpDocumentExport,
  });
  const result = await handler({ question: QUESTION, format }, { siteId: null, orgId: null, scopes: ["tools:*"], source: "env", tokenId: null }, { signal: new AbortController().signal });
  return JSON.parse(result.content[0]?.text ?? "{}") as RiskAssessmentToolResult;
}

async function xlsxCells(buffer: Buffer): Promise<string[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as Parameters<ExcelJS.Workbook["xlsx"]["load"]>[0]);
  const cells: string[] = [];
  workbook.eachSheet((sheet) => sheet.eachRow((row) => row.eachCell((cell) => cells.push(`${cell.address}=${cell.text}`))));
  return cells;
}

describe("MCP 결과는 실제 웹 경로(편집기 → /api/export)와 같은 값이다", () => {
  it("hwp 파일 바이트가 실제 웹 경로 파일과 같다", async () => {
    const response = markedRunAskResponse();
    const { buffer } = await webFile(response, "hwp");
    const payload = await mcpPayload(response, "hwp");
    expect(Buffer.from(payload.file?.base64 ?? "", "base64").equals(buffer)).toBe(true);
  });

  it("xlsx 칸 글자가 실제 웹 경로 파일과 같다", async () => {
    const response = markedRunAskResponse();
    const { buffer } = await webFile(response, "xlsx");
    const payload = await mcpPayload(response, "xlsx");
    expect(await xlsxCells(Buffer.from(payload.file?.base64 ?? "", "base64"))).toEqual(await xlsxCells(buffer));
  });

  it("결과의 structuredRows·scenario 로 편집기 본문을 만들어 라우트에 보내면 같은 파일이 나온다", async () => {
    const payload = await mcpPayload(markedRunAskResponse(), "hwp");
    const roundTrip = await postExport("hwp", editorBody("hwp", payload.scenario, payload.riskAssessment.structuredRows, payload.reviewItems.structuredRows));
    expect(Buffer.from(payload.file?.base64 ?? "", "base64").equals(roundTrip)).toBe(true);
  });

  it("evidenceRefs 는 runAsk 처럼 출처 추적 데이터라 내보내기 게이트를 걸지 않은 /api/ask 값 그대로다", async () => {
    const response = markedRunAskResponse();
    const web = sanitizeAskResponsePublicSurface(response);
    const payload = await mcpPayload(response, "xlsx");
    expect(payload.riskAssessment.structuredRows.map((row) => row.evidenceRefs)).toEqual(buildInitialRiskRows(web).map((row) => row.evidenceRefs));
    // 화면용 근거(rows[].evidenceRefs)에는 내부 표지가 없다.
    const display = JSON.stringify(payload.riskAssessment.rows.map((row) => row.evidenceRefs));
    for (const marker of ["DB 하네스", "deterministic", "fallback", "검색:"]) expect(display).not.toContain(marker);
  });

  it("riskSummary.topRisk 도 본표 칸과 같은 내보내기 게이트를 지난다(261102 3차 검토)", async () => {
    const base = markedRunAskResponse();
    const response = { ...base, riskSummary: { ...base.riskSummary, topRisk: `${base.riskSummary.topRisk} (DB 하네스 deterministic fallback)` } };
    const payload = await mcpPayload(response, "xlsx");
    expect(payload.riskSummary.topRisk).toBe(gateExportPayload({ topRisk: sanitizeAskResponsePublicSurface(response).riskSummary.topRisk }).topRisk);
    expect(payload.riskSummary.topRisk).not.toContain("DB 하네스");
  });

  it("본표 글자 칸(현재 안전조치 등)·scenario 는 라우트가 렌더하는 게이트 뒤 본문 값과 같다", async () => {
    const response = markedRunAskResponse();
    const web = sanitizeAskResponsePublicSurface(response);
    const routeBody = gateExportPayload(editorBody("xlsx", web.scenario, buildInitialRiskRows(web), web.structured?.riskReviewItems));
    const payload = await mcpPayload(response, "xlsx");
    const withoutRefs = (rows: readonly RiskAssessmentRow[]) => rows.map(({ evidenceRefs: _refs, ...row }) => row);
    expect(withoutRefs(payload.riskAssessment.structuredRows)).toEqual(withoutRefs(routeBody.riskAssessmentRows as RiskAssessmentRow[]));
    expect(payload.scenario).toEqual(routeBody.scenario);
    expect(JSON.stringify(payload.riskAssessment.rows.map((row) => row.cells))).not.toContain("DB 하네스");
  });
});
