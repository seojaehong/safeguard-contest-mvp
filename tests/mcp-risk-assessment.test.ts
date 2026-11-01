// generate_risk_assessment MCP 도구 — 웹 「위험성평가표 편집 → 내보내기」와 같은 파일을 내는가.
//
// 기준(웹) 쪽은 편집기가 생성 직후(고치지 않은 상태) /api/export/{xlsx,hwp} 에 보내는 요청 본문을
// 손으로 적어 라우트에 보낸다. 비교 쪽은 MCP 처리기가 같은 응답으로 만든 base64 파일이다.
// xlsx 는 wb.created(생성 시각)가 매번 달라 바이트가 같을 수 없으므로 칸 값·병합·열 너비·쪽 설정을 대조한다.
import fs from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
import { HwpDocument } from "@rhwp/core";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { POST as exportXlsx } from "@/app/api/export/xlsx/route";
import { POST as exportHwp } from "@/app/api/export/hwp/route";
import { sanitizeAskResponsePublicSurface } from "@/lib/ask-public-surface";
import { buildDbHarnessPacket, buildPublicDbHarnessPacket } from "@/lib/db-harness";
import { FORBIDDEN_USER_TERMS, findForbiddenUserTerms } from "@/lib/grounded-generation-contract";
import { gateExportPayload } from "@/lib/user-output-gate";
import { buildMockAskResponse } from "@/lib/mock-data";
import { canonicalizeRiskAssessmentResponse, RISK_RECORD_ROW_HEADERS } from "@/lib/risk-assessment-record";
import { MCP_TOOL_RESULT_MAX_BYTES } from "@/lib/mcp-tools";
import { MCP_TOOL_NAMES, isReadOnlyMcpTool } from "@/lib/mcp-auth";
import {
  RISK_ASSESSMENT_EXPORT_TITLE,
  RISK_ASSESSMENT_FORM_PROFILE,
  buildRiskAssessmentExportBody,
} from "@/lib/risk-assessment-export-body";
import { renderXlsxDocumentExport } from "@/lib/document-export-xlsx";
import { renderHwpDocumentExport } from "@/lib/document-export-hwp";
import {
  createGenerateRiskAssessmentHandler,
  type RiskAssessmentToolResult,
} from "@/lib/mcp-risk-assessment";
import type { McpAuthContext } from "@/lib/mcp-auth";
import type { RiskAssessmentRow } from "@/lib/risk-assessment-schema";
import { buildTaskClassification } from "@/lib/task-scenario-profiles";
import type { SafetyReferenceItem } from "@/lib/safety-reference-catalog";
import type { AskResponse } from "@/lib/types";

type OpsFixture = {
  question: string;
  scenario: AskResponse["scenario"];
  riskSummary: { riskLevel: string; topRisk: string };
  structured: { riskAssessmentRows: RiskAssessmentRow[]; tbmRiskLinks: NonNullable<NonNullable<AskResponse["structured"]>["tbmRiskLinks"]> };
};

const ops = JSON.parse(fs.readFileSync(path.join(process.cwd(), "tests/fixtures/ops-risk-rows-2026-10-25.json"), "utf8")) as Record<string, OpsFixture>;
const SCENARIOS = ["mfg-press", "con-excavation", "confined-space", "logistics-heat"] as const;

const AUTH: McpAuthContext = { siteId: null, orgId: null, scopes: ["tools:*"], source: "env", tokenId: null };

// 위험성평가 양식 설정의 기대값(편집기·MCP 가 함께 쓰는 lib/risk-assessment-export-body.ts 값과 대조한다).
const EDITOR_RISK_PROFILE = {
  code: "SC-RISK-01",
  subtitle: "위험성평가 및 감소대책 확인서",
  layout: "risk",
  primaryColumn: "위험요인",
  actionColumn: "감소대책 / 잔여위험",
  confirmationRows: ["위험요인 확인", "감소대책 담당 지정", "작업 전 공유", "잔여위험 승인"],
  approvalLabels: ["작성", "검토", "승인"],
};

function sifItem(id: string, title: string, summary: string): SafetyReferenceItem {
  return {
    id,
    source_id: "kosha-sif-archive-20260401",
    item_type: "sif-case",
    category: null,
    subcategory: null,
    title,
    summary,
    // 검색 단계(normalizeReferenceItem)가 원문 사례에서 뽑아 두는 사고개요 칸.
    display_summary: summary,
    keywords: [],
    risk_tags: [],
    primary_documents: [],
    controls: [],
    source_url: `https://example.invalid/${id}`,
  };
}

/** sifCases 는 검색 결과로 보고 runAsk 와 같은 buildDbHarnessPacket(질문 = 생성에 들어간 질문)을 거친다. */
function opsResponse(id: (typeof SCENARIOS)[number], sifCases: SafetyReferenceItem[] = [], packetQuestion = ops[id].question): AskResponse {
  const fixture = ops[id];
  const base = buildMockAskResponse(fixture.question, [], "mock", "fixture");
  const response: AskResponse = {
    ...base,
    scenario: fixture.scenario,
    riskSummary: { ...base.riskSummary, riskLevel: fixture.riskSummary.riskLevel as AskResponse["riskSummary"]["riskLevel"], topRisk: fixture.riskSummary.topRisk },
    structured: {
      riskAssessmentRows: fixture.structured.riskAssessmentRows,
      tbmRiskLinks: fixture.structured.tbmRiskLinks,
      riskAssessmentValidation: { ok: true, issueCount: 0, issues: [] },
    },
  };
  const canonical = canonicalizeRiskAssessmentResponse(response);
  if (!sifCases.length) return canonical;
  const packet = buildPublicDbHarnessPacket(buildDbHarnessPacket({ question: packetQuestion, references: sifCases }));
  return {
    ...canonical,
    dbHarness: {
      packet,
      promptContext: "",
      summary: { sifCases: packet.sifCases.length } as unknown as NonNullable<AskResponse["dbHarness"]>["summary"],
    },
  };
}

/** 편집기가 생성 직후 위험성평가표에서 「Excel 표 양식」「한글 표 양식」을 누를 때 보내는 본문. */
function editorRequestBody(response: AskResponse, format: "xlsx" | "hwp"): Record<string, unknown> {
  const reviewItems = response.structured?.riskReviewItems;
  return {
    ...(format === "xlsx" ? { mode: "single" } : {}),
    edited: false,
    title: "위험성평가표",
    rows: [],
    profile: EDITOR_RISK_PROFILE,
    scenario: response.scenario,
    riskAssessmentRows: response.structured?.riskAssessmentRows,
    ...(reviewItems?.length ? { riskReviewItems: reviewItems } : {}),
  };
}

function routeRequest(url: string, body: Record<string, unknown>) {
  return new NextRequest(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}

type SheetSnapshot = {
  name: string;
  cells: Array<[string, string]>;
  merges: string[];
  widths: Array<number | undefined>;
  heights: Array<[number, number | undefined]>;
  pageSetup: unknown;
};

async function workbookSnapshot(buffer: Buffer): Promise<SheetSnapshot[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as Parameters<ExcelJS.Workbook["xlsx"]["load"]>[0]);
  return workbook.worksheets.map((sheet) => {
    const cells: Array<[string, string]> = [];
    const heights: Array<[number, number | undefined]> = [];
    sheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
      heights.push([rowNumber, row.height]);
      // 글자·글꼴·채움·테두리·정렬까지 대조한다.
      row.eachCell({ includeEmpty: false }, (cell) => cells.push([cell.address, `${cell.text}\u0000${JSON.stringify(cell.style)}`]));
    });
    const model = sheet.model as unknown as { merges?: string[] };
    return {
      name: sheet.name,
      cells,
      merges: [...(model.merges ?? [])].sort(),
      widths: sheet.columns.map((column) => column.width),
      heights,
      pageSetup: { ...sheet.pageSetup },
    };
  });
}

function hwpAllText(document: HwpDocument): string {
  const texts: string[] = [];
  for (let paraIdx = 0; paraIdx < document.getParagraphCount(0); paraIdx += 1) {
    texts.push(document.getTextRange(0, paraIdx, 0, document.getParagraphLength(0, paraIdx)));
    const positions = JSON.parse(document.getControlTextPositions(0, paraIdx)) as unknown;
    if (!Array.isArray(positions)) continue;
    positions.forEach((_position, controlIdx) => {
      let dims: { rowCount: number; colCount: number } | null = null;
      try {
        dims = JSON.parse(document.getTableDimensions(0, paraIdx, controlIdx)) as { rowCount: number; colCount: number };
      } catch {
        dims = null;
      }
      if (!dims) return;
      for (let cellIdx = 0; cellIdx < dims.rowCount * dims.colCount; cellIdx += 1) {
        const length = document.getCellParagraphLength(0, paraIdx, controlIdx, cellIdx, 0);
        texts.push(document.getTextInCell(0, paraIdx, controlIdx, cellIdx, 0, 0, length));
      }
    });
  }
  return texts.join("\n");
}

function hwpText(buffer: Buffer): string {
  const document = new HwpDocument(new Uint8Array(buffer));
  try {
    return hwpAllText(document);
  } finally {
    document.free();
  }
}

function handlerFor(response: AskResponse) {
  const calls: Array<{ question: string; mode: string }> = [];
  const handler = createGenerateRiskAssessmentHandler({
    defaultMode: "enhanced",
    generateResponse: async (question, mode) => {
      calls.push({ question, mode });
      return response;
    },
    renderXlsx: renderXlsxDocumentExport,
    renderHwp: renderHwpDocumentExport,
    // 안전 지식 DB safety_reference_sources 대신(가상 값). 출처 메타는 코드가 아니라 DB 행에서 온다.
    lookupSources: async (ids) => new Map(ids.filter((id) => id === "kosha-sif-archive-20260401").map((id) => [id, {
      id,
      agency: "한국산업안전보건공단",
      title: "산업재해 고위험요인(SIF) 아카이브",
      publishedAt: "2026-04-01",
      originUrl: null,
    }])),
  });
  return { handler, calls };
}

async function callTool(response: AskResponse, args: { question: string; mode?: "template" | "enhanced" | "full"; format?: "xlsx" | "hwp" }) {
  const { handler, calls } = handlerFor(response);
  const result = await handler(args, AUTH, { signal: new AbortController().signal });
  expect(result.isError, result.content[0]?.text).toBeFalsy();
  const text = result.content[0]?.text ?? "";
  return { payload: JSON.parse(text) as RiskAssessmentToolResult, bytes: new TextEncoder().encode(JSON.stringify(result)).byteLength, calls };
}

describe("위험성평가 내보내기 요청 본문(편집기와 같은 값)", () => {
  // 편집기는 lib 의 양식 값·본문 함수를 그대로 쓴다(tests/workpack-editor-risk-export-body.test.ts). 여기서는 값 자체를 본다.
  it("위험성평가 양식 설정·문서 제목이 정해 둔 값과 같다", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "components/WorkpackEditor.tsx"), "utf8");
    expect(RISK_ASSESSMENT_FORM_PROFILE).toEqual(EDITOR_RISK_PROFILE);
    expect(source).toMatch(/key: "riskAssessmentDraft",\s*title: "위험성평가표"/u);
    expect(RISK_ASSESSMENT_EXPORT_TITLE).toBe("위험성평가표");
  });

  it("생성 직후 편집기가 보내는 본문과 같은 값을 만든다", () => {
    const response = opsResponse("logistics-heat");
    expect(buildRiskAssessmentExportBody(response, "xlsx")).toEqual(editorRequestBody(response, "xlsx"));
    expect(buildRiskAssessmentExportBody(response, "hwp")).toEqual(editorRequestBody(response, "hwp"));
  });
});

describe("generate_risk_assessment 가 웹 내보내기와 같은 서식을 낸다", () => {
  for (const id of SCENARIOS) {
    it(`${id}: xlsx 칸 값·병합·열 너비가 웹 라우트 산출물과 같다`, async () => {
      const response = opsResponse(id);
      const web = await exportXlsx(routeRequest("http://localhost/api/export/xlsx", editorRequestBody(response, "xlsx")));
      expect(web.status).toBe(200);
      const webSnapshot = await workbookSnapshot(Buffer.from(await web.arrayBuffer()));

      const { payload, bytes } = await callTool(response, { question: ops[id].question, format: "xlsx" });
      expect(payload.file?.format).toBe("xlsx");
      const mcpBuffer = Buffer.from(payload.file?.base64 ?? "", "base64");
      expect(mcpBuffer.subarray(0, 2).toString("latin1")).toBe("PK");
      expect(payload.file?.byteLength).toBe(mcpBuffer.byteLength);
      expect(await workbookSnapshot(mcpBuffer)).toEqual(webSnapshot);
      expect(bytes).toBeLessThan(MCP_TOOL_RESULT_MAX_BYTES);
    });

    it(`${id}: hwp 본문·표 칸 글자가 웹 라우트 산출물과 같다`, async () => {
      const response = opsResponse(id);
      const web = await exportHwp(routeRequest("http://localhost/api/export/hwp", editorRequestBody(response, "hwp")));
      expect(web.status).toBe(200);
      const webBuffer = Buffer.from(await web.arrayBuffer());

      const { payload, bytes } = await callTool(response, { question: ops[id].question, format: "hwp" });
      const mcpBuffer = Buffer.from(payload.file?.base64 ?? "", "base64");
      expect(mcpBuffer.subarray(0, 4).toString("hex")).toBe("d0cf11e0");
      expect(hwpText(mcpBuffer)).toBe(hwpText(webBuffer));
      // rhwp exportHwp 는 시각 도장을 찍지 않아 같은 본문이면 바이트까지 같다.
      expect(mcpBuffer.equals(webBuffer)).toBe(true);
      expect(bytes).toBeLessThan(MCP_TOOL_RESULT_MAX_BYTES);
    });
  }

  it("구조화 행은 파일 본표와 같은 칸 순서·값이고 결재란은 작성/검토/승인이다", async () => {
    const response = opsResponse("con-excavation");
    const { payload } = await callTool(response, { question: ops["con-excavation"].question });
    // 결과는 웹 /api/ask 공개 표면과 같은 정리·게이트를 지난 행이다(tests/mcp-risk-assessment-public-surface.test.ts).
    const main = gateExportPayload(sanitizeAskResponsePublicSurface(response)).structured?.riskAssessmentRows ?? [];
    expect(payload.status).toBe("ok");
    expect(payload.mode).toBe("enhanced");
    expect(payload.riskAssessment.headers).toEqual([...RISK_RECORD_ROW_HEADERS]);
    expect(payload.riskAssessment.rowCount).toBe(main.length);
    expect(payload.riskAssessment.rows.map((row) => row.cells[2])).toEqual(main.map((row) => row.hazard));
    expect(payload.riskAssessment.approvalLabels).toEqual(["작성", "검토", "승인"]);
    expect(payload.riskAssessment.structuredRows).toEqual(main);
    expect(payload.file?.format).toBe("xlsx");
  });

  it("「검토 필요:」 행은 본표에서 빼고 확인 필요 목록으로 따로 낸다", async () => {
    const response = opsResponse("logistics-heat");
    const review = response.structured?.riskReviewItems ?? [];
    expect(review.length).toBeGreaterThan(0);
    const { payload } = await callTool(response, { question: ops["logistics-heat"].question, format: "xlsx" });
    expect(payload.reviewItems.count).toBe(review.length);
    expect(payload.reviewItems.items.map((item) => item.content)).toEqual(review.map((row) => row.hazard));
    expect(payload.riskAssessment.rows.some((row) => /^\s*검토\s*필요/u.test(row.cells[2]))).toBe(false);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Buffer.from(payload.file?.base64 ?? "", "base64") as unknown as Parameters<ExcelJS.Workbook["xlsx"]["load"]>[0]);
    const texts: string[] = [];
    workbook.worksheets[0]?.eachRow((row) => row.eachCell((cell) => texts.push(cell.text)));
    for (const row of review) expect(texts).toContain(row.hazard);
  });
});

describe("SIF 유사사례", () => {
  it("생성에 쓰인 SIF 사례(dbHarness)를 제목·사고개요·출처 id 로 돌려준다", async () => {
    const response = opsResponse("con-excavation", [
      sifItem("sif-1", "굴착 사면 붕괴로 매몰", "굴착 깊이 3m 사면이 무너져 작업자 1명이 매몰되었다."),
      sifItem("sif-2", "굴착기 버킷 협착", "후진하던 굴착기와 흙막이 사이에 끼였다."),
    ]);
    const { payload } = await callTool(response, { question: ops["con-excavation"].question, mode: "enhanced" });
    expect(payload.sif.count).toBe(2);
    // 작업 묶음이 더 많이 겹친 사례(굴착·토사 + 굴착기)가 앞에 온다.
    expect(payload.sif.cases.map((item) => item.id)).toEqual(["sif-2", "sif-1"]);
    expect([...payload.sif.cases].sort((left, right) => left.id.localeCompare(right.id))).toEqual([
      {
        id: "sif-1",
        title: "굴착 사면 붕괴로 매몰",
        overview: "굴착 깊이 3m 사면이 무너져 작업자 1명이 매몰되었다.",
        source: { id: "kosha-sif-archive-20260401", agency: "한국산업안전보건공단", title: "산업재해 고위험요인(SIF) 아카이브", publishedAt: "2026-04-01", sourcePublishedYear: 2026, url: null },
        relevance: expect.objectContaining({ matchedWork: expect.arrayContaining(["굴착·토사"]) }),
      },
      {
        id: "sif-2",
        title: "굴착기 버킷 협착",
        overview: "후진하던 굴착기와 흙막이 사이에 끼였다.",
        source: { id: "kosha-sif-archive-20260401", agency: "한국산업안전보건공단", title: "산업재해 고위험요인(SIF) 아카이브", publishedAt: "2026-04-01", sourcePublishedYear: 2026, url: null },
        relevance: expect.objectContaining({ matchedWork: expect.arrayContaining(["굴착·토사"]) }),
      },
    ]);
    expect(payload.sif.reason).toBeUndefined();
  });

  it("DB 에 없는 원천은 출처·날짜를 지어내지 않는다(source_id 꼬리 날짜로 추측하지 않음)", async () => {
    const unknown = { ...sifItem("sif-9", "굴착 사면 붕괴로 매몰", "개요"), source_id: "other-sif-20250115" };
    const { payload } = await callTool(opsResponse("con-excavation", [unknown]), { question: ops["con-excavation"].question });
    expect(payload.sif.cases[0]?.source).toEqual({ id: "other-sif-20250115", agency: null, title: null, publishedAt: null, sourcePublishedYear: null, url: null });
  });

  it("template 모드는 0건과 이유(DB 를 조회하지 않음)를 숨기지 않고 돌려준다", async () => {
    const response = opsResponse("mfg-press");
    const { payload, calls } = await callTool(response, { question: ops["mfg-press"].question, mode: "template" });
    expect(calls).toEqual([{ question: ops["mfg-press"].question, mode: "template" }]);
    expect(payload.sif.count).toBe(0);
    expect(payload.sif.cases).toEqual([]);
    expect(payload.sif.reason).toMatch(/template/u);
  });

  // 261101 MCP 실측(run3)에서 밀폐공간 작업에 열처리로 폭발, 화재 작업에 리프트 추락 사례가 붙었다.
  // 아래 제목·개요는 그 결을 본뜬 가상 문장이다(공단 사례 원문을 시험에 두지 않는다).
  const S1_QUESTION = "가상 사업장 한빛정화 오수처리장 맨홀 내부 슬러지 제거 작업 3명, 밀폐공간 산소결핍·황화수소 우려, 주간";
  const S3_QUESTION = "가상 사업장 미래화학 도장공장 배기덕트 내부 용접 보수 작업 2명, 인화성 증기 잔류 가능, 화재감시자 배치";
  const HEAT_FURNACE = sifItem("sif-furnace", "가상 사례 — 열처리로 가동 중 내화물 속 물이 끓어 폭발", "가상 개요: 새로 쌓은 내화물이 덜 말라 가동 직후 증기 압력으로 터졌다.");
  const PIPE_WELD = sifItem("sif-pipe", "가상 사례 — 좁은 배관 안 용접 작업자가 산소결핍으로 의식 잃음", "가상 개요: 환기 없이 배관 안에 들어가 용접하다 의식을 잃었다.");
  const CISTERN_FIRE = sifItem("sif-cistern", "가상 사례 — 지하 물탱크 내부 방수 작업 중 화재로 화상", "가상 개요: 물탱크 내부에서 용접 불티가 도료 증기에 붙어 불이 났다.");
  const LPG_CUT = sifItem("sif-lpg", "가상 사례 — 프로판 가스 절단 중 불꽃이 작업복에 붙어 화상", "가상 개요: 프로판 토치로 철판을 자르다 작업복에 불이 붙었다.");
  const LIFT_FALL = sifItem("sif-lift", "가상 사례 — 승강기 출입구 개구부에서 작업자 추락", "가상 개요: 안전난간이 없는 승강기 출입구 개구부로 떨어졌다.");

  it("밀폐공간 작업: 생성 입력 단계에서 뺀 열처리로 폭발 사례를 이유와 함께 그대로 돌려준다", async () => {
    const { payload } = await callTool(opsResponse("confined-space", [HEAT_FURNACE, PIPE_WELD], S1_QUESTION), { question: S1_QUESTION, mode: "enhanced" });
    expect(payload.sif.cases.map((item) => item.id)).toEqual(["sif-pipe"]);
    expect(payload.sif.cases[0]?.relevance?.matchedWork).toContain("밀폐공간");
    expect(payload.sif.excluded).toEqual([expect.objectContaining({ id: "sif-furnace", reason: expect.stringMatching(/작업·장소·기인물이 다름/u) })]);
    expect(payload.sif.retrievedCount).toBe(2);
  });

  it("화재·용접 작업: 저수조 화재·용단 화상 사례는 남기고 리프트 개구부 추락 사례는 뺀다", async () => {
    const { payload } = await callTool(opsResponse("mfg-press", [CISTERN_FIRE, LPG_CUT, LIFT_FALL], S3_QUESTION), { question: S3_QUESTION, mode: "enhanced" });
    expect(payload.sif.cases.map((item) => item.id)).toEqual(["sif-cistern", "sif-lpg"]);
    expect(payload.sif.excluded?.map((item) => item.id)).toEqual(["sif-lift"]);
    expect(payload.sif.retrievedCount).toBe(3);
  });

  it("검색된 사례가 모두 작업과 맞지 않으면 0건과 그 이유를 돌려준다", async () => {
    const { payload } = await callTool(opsResponse("confined-space", [HEAT_FURNACE, LIFT_FALL], S1_QUESTION), { question: S1_QUESTION, mode: "enhanced" });
    expect(payload.sif.count).toBe(0);
    expect(payload.sif.cases).toEqual([]);
    expect(payload.sif.reason).toMatch(/2건.*맞지 않아/u);
    expect(payload.sif.excluded?.map((item) => item.id)).toEqual(["sif-furnace", "sif-lift"]);
  });

  it("DB 를 조회했는데 0건이면 그 사실을 이유로 적는다", async () => {
    const response = opsResponse("mfg-press");
    const { payload } = await callTool(response, { question: ops["mfg-press"].question, mode: "enhanced" });
    expect(payload.sif.count).toBe(0);
    expect(payload.sif.reason).toMatch(/찾지 못했/u);
  });
});

describe("시행규칙 제37조의4 기재 항목 충족 검사", () => {
  it("항목별 채움/일부/빈칸을 행 값으로 가르고 책임 문구를 붙인다", async () => {
    const base = opsResponse("con-excavation");
    const rows = base.structured?.riskAssessmentRows ?? [];
    expect(rows.length).toBeGreaterThan(1);
    // 첫 행만 이행 결과를 적고, 둘째 행은 감소대책을 지운다.
    const edited = rows.map((row, index) => ({
      ...row,
      ...(index === 0 ? { implementationResult: "작업 전 조치 완료" } : {}),
      ...(index === 1 ? { additionalControls: "" } : {}),
    }));
    const response: AskResponse = { ...base, structured: { ...base.structured, riskAssessmentRows: edited } as AskResponse["structured"] };
    const { payload } = await callTool(response, { question: ops["con-excavation"].question });
    const check = payload.recordItemsCheck;
    expect(check.basis).toContain("제37조의4제1항");
    const byItem = Object.fromEntries(check.items.map((entry) => [entry.item, entry]));
    expect(Object.keys(byItem)).toEqual([
      "위험성평가 실시 시기",
      "위험성평가 담당자",
      "위험성평가에 참여한 근로자",
      "위험성평가에 참여한 근로자대표",
      "파악한 유해·위험 요인",
      "위험성 수준 결정 결과",
      "개선대책 수립 내용",
      "개선대책 이행 결과",
    ]);
    expect(byItem["위험성평가 실시 시기"].status).toBe("blank");
    expect(byItem["위험성평가에 참여한 근로자대표"].status).toBe("blank");
    expect(byItem["파악한 유해·위험 요인"]).toMatchObject({ status: "filled", filledRows: rows.length, totalRows: rows.length });
    expect(byItem["위험성 수준 결정 결과"].status).toBe("filled");
    expect(byItem["개선대책 수립 내용"]).toMatchObject({ status: "partial", filledRows: rows.length - 1 });
    expect(byItem["개선대책 이행 결과"]).toMatchObject({ status: "partial", filledRows: 1 });
    expect(check.filled + check.partial + check.blank).toBe(8);
    expect(payload.responsibilityNote).toMatch(/초안 작성 보조.*사업주/u);
  });

  it("정본 행 원본으로 센다 — 등급 숫자가 빠진 행(0)은 위험성 수준 결정을 채운 것으로 보지 않는다", async () => {
    const base = opsResponse("con-excavation");
    const rows = base.structured?.riskAssessmentRows ?? [];
    const edited = rows.map((row, index) => (index === 0 ? { ...row, likelihood: 0, severity: 0 } : row));
    const response: AskResponse = { ...base, structured: { ...base.structured, riskAssessmentRows: edited } as AskResponse["structured"] };
    const { payload } = await callTool(response, { question: ops["con-excavation"].question });
    const byItem = Object.fromEntries(payload.recordItemsCheck.items.map((entry) => [entry.item, entry]));
    expect(byItem["위험성 수준 결정 결과"]).toMatchObject({ status: "partial", filledRows: rows.length - 1, totalRows: rows.length });
  });

  it("머리 기록란 4항목은 생성 결과에 값이 없으므로 늘 빈칸(현장 기재)이다", async () => {
    const { payload } = await callTool(opsResponse("logistics-heat"), { question: ops["logistics-heat"].question });
    const header = payload.recordItemsCheck.items.slice(0, 4);
    expect(header.map((entry) => entry.status)).toEqual(["blank", "blank", "blank", "blank"]);
    for (const entry of header) expect(entry.note).toMatch(/현장에서 적습니다/u);
  });

  // 도구 설명·docs·기능 지도와 결과 payload 에 금지 문구가 없어야 한다(261101 N3, 2차 검토 8).
  // 공용 금지어는 lib/grounded-generation-contract.ts FORBIDDEN_USER_TERMS 하나를 쓰고, 도구 표면 전용 낱말만 여기서 더한다.
  const MCP_SURFACE_EXTRA = /정본\s*서식|고시\s*서식|지도|대리|자문/u;
  const BANNED_SURFACE = new RegExp(`${FORBIDDEN_USER_TERMS.source}|${MCP_SURFACE_EXTRA.source}`, "u");

  /** 결과 payload 에서 생성문(위험 요약·본표 행·확인 필요 목록)·DB 원문(SIF 사례 제목·개요·출처, 뺀 사례 제목)·파일 바이트만 뺀 나머지 전부. */
  function toolOwnSurface(payload: RiskAssessmentToolResult): Record<string, unknown> {
    const { riskSummary: _summary, riskAssessment, reviewItems, sif, file, ...rest } = payload;
    const { rows: _rows, structuredRows: _main, ...riskOwn } = riskAssessment;
    const { items: _items, structuredRows: _review, ...reviewOwn } = reviewItems;
    return {
      ...rest,
      riskAssessment: riskOwn,
      reviewItems: reviewOwn,
      sif: {
        ...sif,
        cases: sif.cases.map(({ title: _title, overview: _overview, source: _source, ...own }) => own),
        excluded: (sif.excluded ?? []).map(({ title: _title, ...own }) => own),
      },
      file: file ? { ...file, base64: "" } : null,
    };
  }

  function expectNoBannedSurface(payload: RiskAssessmentToolResult) {
    const surface = toolOwnSurface(payload);
    expect(findForbiddenUserTerms(surface)).toEqual([]);
    expect(JSON.stringify(surface)).not.toMatch(MCP_SURFACE_EXTRA);
  }

  it("도구 설명과 결과 문구에 금지 문구(「정본 서식」「고시 서식」·노무사·상담·진단·판정·지도·대리·자문)를 쓰지 않는다", async () => {
    const source = fs.readFileSync(path.join(process.cwd(), "app/api/mcp/[transport]/implementation.ts"), "utf8");
    const start = source.indexOf("\"generate_risk_assessment\",");
    const block = source.slice(start, source.indexOf("withMcpProviderAdmission", start));
    expect(block).toMatch(/초안 작성 보조 도구이며, 위험성평가 실시와 최종 판단 책임은 사업주에게 있다/u);
    const docsRow = fs.readFileSync(path.join(process.cwd(), "docs/mcp-server.md"), "utf8").split("\n").find((line) => line.startsWith("| `generate_risk_assessment`")) ?? "";
    const feature = fs.readFileSync(path.join(process.cwd(), ".claude/skills/verify-safeclaw/features/mcp-risk-assessment.md"), "utf8");
    expect(docsRow).not.toBe("");
    for (const text of [block, docsRow, feature]) expect(text).not.toMatch(BANNED_SURFACE);

    const ok = (await callTool(opsResponse("logistics-heat"), { question: ops["logistics-heat"].question })).payload;
    const base = opsResponse("mfg-press");
    const noRows = (await callTool({ ...base, structured: { ...base.structured, riskAssessmentRows: [] } as AskResponse["structured"] }, { question: "무엇인가 하는 작업", format: "hwp" })).payload;
    const withSif = (await callTool(opsResponse("confined-space", [
      sifItem("sif-furnace", "가상 사례 — 열처리로 가동 중 내화물 속 물이 끓어 폭발", "가상 개요: 내화물이 덜 말라 터졌다."),
      sifItem("sif-pipe", "가상 사례 — 좁은 배관 안 용접 작업자가 산소결핍으로 의식 잃음", "가상 개요: 환기 없이 배관 안에 들어갔다."),
    ], ops["confined-space"].question), { question: ops["confined-space"].question })).payload;
    for (const payload of [ok, noRows, withSif]) expectNoBannedSurface(payload);
  });

  // run6 S4: 작업 분류 이유 「…판정하지 못했습니다」가 결과로 새어 나왔다. 문구는 원천(작업 분류)에서 고치고
  // 결과 scenario 는 웹 /api/ask 와 같은 값(이유 포함)을 그대로 싣는다.
  it("실제 runAsk 보류·template 응답도 결과 payload 전체에 금지 문구가 없고, 작업 분류 이유를 그대로 싣는다", async () => {
    const { runAsk } = await import("@/lib/search");
    const run = async (question: string, mode: "template" | "enhanced") => {
      const handler = createGenerateRiskAssessmentHandler({
        defaultMode: "enhanced",
        generateResponse: (q, m) => runAsk(q, { aiMode: m }),
        renderXlsx: renderXlsxDocumentExport,
        renderHwp: renderHwpDocumentExport,
      });
      const result = await handler({ question, mode }, AUTH, { signal: new AbortController().signal });
      return JSON.parse(result.content[0]?.text ?? "{}") as RiskAssessmentToolResult;
    };
    const unclassifiedQuestion = "내일 오전에 사무실에서 할 일 정리";
    const held = await run(unclassifiedQuestion, "enhanced");
    expect(held.status).toBe("review_required");
    expect(held.fileUnavailableReason).toMatch(/작업 유형을 확인하지 못해/u);
    expect(held.scenario.taskClassification).toEqual(buildTaskClassification(unclassifiedQuestion));
    expect(held.scenario.taskClassification?.reason).toMatch(/작업 유형을 확인하지 못했습니다/u);
    const template = await run(ops["logistics-heat"].question, "template");
    expect(template.scenario.taskClassification?.reason).toBeTruthy();
    for (const payload of [held, template]) expectNoBannedSurface(payload);
  }, 60_000);
});

describe("위험성평가 행이 없을 때", () => {
  it("파일을 만들지 않고 review_required 와 이유를 돌려준다", async () => {
    const base = opsResponse("mfg-press");
    const response: AskResponse = { ...base, structured: { ...base.structured, riskAssessmentRows: [] } as AskResponse["structured"] };
    const { payload } = await callTool(response, { question: "무엇인가 하는 작업", format: "hwp" });
    expect(payload.status).toBe("review_required");
    expect(payload.file).toBeNull();
    expect(payload.fileUnavailableReason).toBeTruthy();
    expect(payload.riskAssessment.rowCount).toBe(0);
  });
});

describe("도구 등록 계약", () => {
  it("이름 목록 끝에 있고 쓰기(생성) 도구로 분류된다", () => {
    expect(MCP_TOOL_NAMES[MCP_TOOL_NAMES.length - 1]).toBe("generate_risk_assessment");
    expect(isReadOnlyMcpTool("generate_risk_assessment")).toBe(false);
  });
});
