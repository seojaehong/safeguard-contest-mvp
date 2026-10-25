// PR-06/10 — 위험성평가 정본 단일화·제37조의4 기록 칸·상중하 척도.
// 고정 자료: 운영 full 응답 4건(프레스·굴착·정화조·폭염 상하차)의 structured 행(tests/fixtures/ops-risk-rows-2026-10-25.json)
// 과 같은 질문으로 만든 기본 틀 응답.
import fs from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
import { HwpDocument } from "@rhwp/core";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { POST as exportXlsx } from "@/app/api/export/xlsx/route";
import { POST as exportPdf } from "@/app/api/export/pdf/route";
import { POST as exportHwp } from "@/app/api/export/hwp/route";
import { serializeRiskAssessmentRowsToDraft } from "@/components/workpack-editor-structure";
import { buildMockAskResponse } from "@/lib/mock-data";
import {
  buildRiskAssessmentRecordHtml,
  canonicalizeRiskAssessmentResponse,
  isRiskReviewPlaceholderRow,
  toStructuredRiskRows
} from "@/lib/risk-assessment-record";
import { riskLevelLabel, summarizeRiskLevel } from "@/lib/risk-labels";
import { gateAskResponseUserOutput } from "@/lib/user-output-gate";
import type { RiskAssessmentRow } from "@/lib/risk-assessment-schema";
import type { AskResponse } from "@/lib/types";

type OpsFixture = {
  question: string;
  scenario: AskResponse["scenario"];
  riskSummary: { riskLevel: string; topRisk: string };
  structured: { riskAssessmentRows: RiskAssessmentRow[]; tbmRiskLinks: NonNullable<NonNullable<AskResponse["structured"]>["tbmRiskLinks"]> };
};

const ops = JSON.parse(fs.readFileSync(path.join(process.cwd(), "tests/fixtures/ops-risk-rows-2026-10-25.json"), "utf8")) as Record<string, OpsFixture>;
const SCENARIOS = ["mfg-press", "con-excavation", "confined-space", "logistics-heat"] as const;

const FIXED_PARTICIPANTS = /관리감독자,\s*작업반장,\s*근로자\s*대표/u;
const INTERNAL_MARKERS = /검색:\s*[a-z]|아카이브\(|\b\d{3}, 제조업|고정 근거 (직접|보조)근거|DB 하네스/u;
const RECORD_LABELS = ["평가 실시 시기", "평가 담당자", "참여 근로자", "근로자대표 참여", "참여 방법", "이행 결과", "잔여 위험성", "3년간 보존"];

function opsResponse(id: (typeof SCENARIOS)[number]): AskResponse {
  const fixture = ops[id];
  const base = buildMockAskResponse(fixture.question, [], "mock", "fixture");
  return {
    ...base,
    scenario: fixture.scenario,
    riskSummary: { ...base.riskSummary, riskLevel: fixture.riskSummary.riskLevel as AskResponse["riskSummary"]["riskLevel"], topRisk: fixture.riskSummary.topRisk },
    deliverables: { ...base.deliverables, riskAssessmentDraft: "AI 문안: 위험요인 키워드가 다른 별도 본문" },
    structured: {
      riskAssessmentRows: fixture.structured.riskAssessmentRows,
      tbmRiskLinks: fixture.structured.tbmRiskLinks,
      riskAssessmentValidation: { ok: true, issueCount: 0, issues: [] }
    }
  };
}

function request(url: string, body: Record<string, unknown>) {
  return new NextRequest(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}

async function workbookText(response: Response) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(await response.arrayBuffer()) as unknown as Parameters<ExcelJS.Workbook["xlsx"]["load"]>[0]);
  return workbook;
}

function sheetCells(worksheet: ExcelJS.Worksheet): string[] {
  const texts: string[] = [];
  worksheet.eachRow((row) => row.eachCell({ includeEmpty: false }, (cell) => texts.push(cell.text)));
  return texts;
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

describe("기본 틀 위험성평가 행(4개 시나리오)", () => {
  for (const id of SCENARIOS) {
    it(`${id}: 초안·요약이 정본 행에서 나오고 칸이 지어내지 않는다`, () => {
      const response = buildMockAskResponse(ops[id].question, [], "mock", "fixture");
      const rows = response.structured?.riskAssessmentRows || [];
      if (!rows.length) return; // 작업 유형 보류 응답은 행이 없다.
      expect(response.deliverables.riskAssessmentDraft).toBe(serializeRiskAssessmentRowsToDraft(rows));
      expect(response.riskSummary.riskLevel).toBe(summarizeRiskLevel(rows));
      expect(response.deliverables.workpackSummaryDraft).toContain(`위험수준: ${summarizeRiskLevel(rows)}`);
      for (const row of rows) {
        expect(row.task, "세부작업 칸에 위험요인을 넣지 않는다(D-11)").not.toBe(row.hazard);
        expect(row.currentControls, "현재 안전조치를 감소대책으로 복사하지 않는다(RA-09)").not.toBe(row.additionalControls);
        expect(row.evidenceRefs.join(" ")).not.toMatch(/riskAssessmentDraft|tbmBriefing/u);
        expect(row.whyLikelihood).not.toMatch(/반영$/u);
        expect(row.equipment).not.toBe("현장 장비 및 보호구");
      }
    });
  }
});

describe("정본 단일화(운영 응답 4건)", () => {
  for (const id of SCENARIOS) {
    it(`${id}: 「검토 필요:」 행을 본표에서 빼고 초안·위험수준·TBM 연결을 정본 행에 맞춘다`, () => {
      const source = opsResponse(id);
      const canonical = canonicalizeRiskAssessmentResponse(source);
      const main = canonical.structured?.riskAssessmentRows || [];
      const review = canonical.structured?.riskReviewItems || [];
      const sourceReview = source.structured?.riskAssessmentRows.filter(isRiskReviewPlaceholderRow) || [];

      expect(main.some(isRiskReviewPlaceholderRow)).toBe(false);
      expect(review.map((row) => row.hazard)).toEqual(sourceReview.map((row) => row.hazard));
      expect(canonical.deliverables.riskAssessmentDraft).toBe(serializeRiskAssessmentRowsToDraft(main));
      expect(canonical.riskSummary.riskLevel).toBe(summarizeRiskLevel(main));
      for (const link of canonical.structured?.tbmRiskLinks || []) {
        expect(main[link.riskRowIndex]?.hazard).toBe(link.hazard);
      }
      // runAsk 는 정본화 뒤에 PR-14 출력 게이트를 거친다. 다시 만든 초안에도 내부 표지가 남지 않아야 한다.
      const gated = gateAskResponseUserOutput(canonical);
      expect(gated.deliverables.riskAssessmentDraft).not.toMatch(INTERNAL_MARKERS);
      expect(gated.deliverables.workpackSummaryDraft).not.toMatch(INTERNAL_MARKERS);
    });
  }
});

// PR109-B1 — 작업계획서·허가서·TBM 일지 구조화본의 위험성평가 행 번호는 정본화 전 행 순서로 매겨진다.
// 정본화가 「검토 필요:」 행을 빼면 그 번호도 정본 행 순서로 다시 매겨야 「위험성평가#N」이 같은 위험요인을 가리킨다.
function withLinkedDocuments(source: AskResponse): AskResponse {
  const rows = source.structured?.riskAssessmentRows || [];
  const all = rows.map((_row, index) => index);
  return {
    ...source,
    deliverables: {
      ...source.deliverables,
      workPlanStructured: {
        workSteps: all.map((index) => ({ stepNo: index + 1, action: `단계 ${index + 1}`, equipment: "", safetyMeasure: "", owner: "", relatedRiskRowIndex: [index, (index + 1) % rows.length] }))
      } as unknown as NonNullable<AskResponse["deliverables"]["workPlanStructured"]>,
      permitInspectionStructured: {
        conditions: all.map((index) => ({ category: "작업구역", requirement: `조건 ${index + 1}`, action: "", owner: "", status: "확인 전", relatedRiskRowIndex: index }))
      } as unknown as NonNullable<AskResponse["deliverables"]["permitInspectionStructured"]>,
      tbmLogStructured: {
        hazardsDiscussed: all.map((index) => ({ category: "Management", description: `위험 ${index + 1}`, relatedRiskRowIndex: index }))
      } as unknown as NonNullable<AskResponse["deliverables"]["tbmLogStructured"]>
    }
  };
}

describe("작업계획서·허가서·TBM 일지의 위험성평가 행 번호가 정본 행을 가리킨다(PR109-B1)", () => {
  for (const id of SCENARIOS) {
    it(`${id}: 정본화 뒤에도 같은 위험요인을 가리키고, 빠진 행을 가리키던 번호는 버린다`, () => {
      const source = withLinkedDocuments(opsResponse(id));
      const rows = source.structured?.riskAssessmentRows || [];
      const canonical = canonicalizeRiskAssessmentResponse(source);
      const main = canonical.structured?.riskAssessmentRows || [];
      const hazardOf = (index: number) => rows[index].hazard;
      const kept = (index: number) => !isRiskReviewPlaceholderRow(rows[index]);

      const steps = canonical.deliverables.workPlanStructured?.workSteps || [];
      const sourceSteps = source.deliverables.workPlanStructured?.workSteps || [];
      expect(steps).toHaveLength(sourceSteps.length);
      steps.forEach((step, index) => {
        const expected = (sourceSteps[index].relatedRiskRowIndex || []).filter(kept).map(hazardOf);
        expect((step.relatedRiskRowIndex || []).map((ref) => main[ref]?.hazard), `작업계획서 단계 ${index + 1}`).toEqual(expected);
      });

      const conditions = canonical.deliverables.permitInspectionStructured?.conditions || [];
      conditions.forEach((condition, index) => {
        const before = rows[index];
        if (isRiskReviewPlaceholderRow(before)) expect(condition.relatedRiskRowIndex, `허가서 조건 ${index + 1}`).toBeUndefined();
        else expect(main[condition.relatedRiskRowIndex as number]?.hazard, `허가서 조건 ${index + 1}`).toBe(before.hazard);
      });

      const hazards = canonical.deliverables.tbmLogStructured?.hazardsDiscussed || [];
      hazards.forEach((hazard, index) => {
        const before = rows[index];
        if (isRiskReviewPlaceholderRow(before)) expect(hazard.relatedRiskRowIndex, `TBM 일지 ${index + 1}`).toBeUndefined();
        else expect(main[hazard.relatedRiskRowIndex as number]?.hazard, `TBM 일지 ${index + 1}`).toBe(before.hazard);
      });
    });
  }

  it("logistics-heat: 0번 「검토 필요:」 행 뒤 번호가 한 칸씩 당겨진다", () => {
    const canonical = canonicalizeRiskAssessmentResponse(withLinkedDocuments(opsResponse("logistics-heat")));
    expect(isRiskReviewPlaceholderRow(ops["logistics-heat"].structured.riskAssessmentRows[0])).toBe(true);
    expect(canonical.deliverables.permitInspectionStructured?.conditions.map((condition) => condition.relatedRiskRowIndex)).toEqual([undefined, 0, 1, 2, 3]);
    expect(canonical.deliverables.workPlanStructured?.workSteps[0].relatedRiskRowIndex).toEqual([0]);
  });
});

describe("xlsx·pdf·hwp·인쇄가 같은 정본 행을 그린다", () => {
  for (const id of SCENARIOS) {
    it(`${id}: 위험요인 집합·등급이 형식마다 같고 제37조의4 칸이 있다`, async () => {
      const canonical = canonicalizeRiskAssessmentResponse(opsResponse(id));
      const main = canonical.structured?.riskAssessmentRows || [];
      const review = canonical.structured?.riskReviewItems || [];
      const hazards = main.map((row) => row.hazard);
      const levels = main.map((row) => riskLevelLabel(row.riskLevel));

      // xlsx
      const xlsxResponse = await exportXlsx(request("http://localhost/api/export/xlsx", {
        mode: "single",
        title: "위험성평가표",
        scenario: canonical.scenario,
        profile: { code: "risk", subtitle: "위험성평가", layout: "risk", primaryColumn: "유해·위험요인", actionColumn: "감소대책", confirmationRows: [], approvalLabels: ["작성", "검토", "승인"] },
        rows: [],
        riskAssessmentRows: main,
        riskReviewItems: review
      }));
      expect(xlsxResponse.status).toBe(200);
      const workbook = await workbookText(xlsxResponse);
      const sheet = workbook.getWorksheet("위험성평가표");
      if (!sheet) throw new Error("missing sheet");
      const xlsxText = sheetCells(sheet).join("\n");
      for (const label of RECORD_LABELS) expect(xlsxText, `xlsx ${label}`).toContain(label);
      expect(xlsxText).toContain("확인 및 결재");
      expect(xlsxText).not.toMatch(FIXED_PARTICIPANTS);
      expect(xlsxText).not.toMatch(INTERNAL_MARKERS);
      expect(xlsxText).not.toMatch(/(^|\n)(높음|보통|낮음)(\n|$)/u);
      expect(sheet.pageSetup.fitToWidth).toBe(1);
      const hazardHeader = sheetCells(sheet).indexOf("유해·위험요인");
      expect(hazardHeader).toBeGreaterThanOrEqual(0);
      let headerCell: ExcelJS.Cell | undefined;
      sheet.eachRow((row) => row.eachCell((cell) => { if (!headerCell && cell.text === "유해·위험요인") headerCell = cell; }));
      if (!headerCell) throw new Error("missing hazard header");
      const xlsxHazards = main.map((_row, index) => sheet.getCell(Number(headerCell!.row) + 1 + index, Number(headerCell!.col)).text);
      expect(xlsxHazards).toEqual(hazards);
      for (const row of review) expect(xlsxText).toContain(row.hazard);

      // pdf(html) — 키워드 5행 제한 없이 정본 행 전부, 위험수준은 본표 최고 등급
      const pdfResponse = await exportPdf(request("http://localhost/api/export/pdf?format=html", {
        title: "위험성평가표",
        scenario: canonical.scenario,
        riskLevel: "하",
        riskAssessmentRows: main,
        riskReviewItems: review
      }));
      expect(pdfResponse.status).toBe(200);
      const html = await pdfResponse.text();
      for (const label of RECORD_LABELS) expect(html, `pdf ${label}`).toContain(label);
      expect(html).not.toMatch(FIXED_PARTICIPANTS);
      expect(html).not.toMatch(INTERNAL_MARKERS);
      expect(html).toContain(`위험수준 ${summarizeRiskLevel(main)}`);
      const pdfRows = [...html.matchAll(/<tr data-risk-row="\d+">(.*?)<\/tr>/gu)].map((match) => [...match[1].matchAll(/<td>(.*?)<\/td>/gu)].map((cell) => cell[1]));
      expect(pdfRows.map((cells) => cells[2])).toEqual(hazards.map((hazard) => hazard.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;")));
      expect(pdfRows.map((cells) => cells[7])).toEqual(levels);

      // hwp
      const hwpResponse = await exportHwp(request("http://localhost/api/export/hwp", {
        title: "위험성평가표",
        profile: { layout: "risk" },
        scenario: canonical.scenario,
        rows: [],
        riskAssessmentRows: main,
        riskReviewItems: review
      }));
      expect(hwpResponse.status).toBe(200);
      const document = new HwpDocument(new Uint8Array(await hwpResponse.arrayBuffer()));
      try {
        const hwpText = hwpAllText(document);
        for (const label of RECORD_LABELS) expect(hwpText, `hwp ${label}`).toContain(label);
        for (const hazard of hazards) expect(hwpText).toContain(hazard);
        expect(hwpText).not.toMatch(FIXED_PARTICIPANTS);
        expect(hwpText).not.toMatch(INTERNAL_MARKERS);
        expect(hwpText).not.toMatch(/\b(high|medium|low)\b/u);
      } finally {
        document.free();
      }

      // 인쇄·Word·JPG 공용 본문
      const printHtml = buildRiskAssessmentRecordHtml({
        rows: toStructuredRiskRows(main),
        reviewRows: toStructuredRiskRows(review),
        scenario: canonical.scenario,
        section: (title, inner) => `<section><h3>${title}</h3>${inner}</section>`
      });
      const printRows = [...printHtml.matchAll(/<tr data-risk-row="\d+">(.*?)<\/tr>/gu)].map((match) => [...match[1].matchAll(/<td>(.*?)<\/td>/gu)].map((cell) => cell[1]));
      expect(printRows.map((cells) => cells[5])).toEqual(main.map((row) => String(row.likelihood)));
      expect(printRows.map((cells) => cells[6])).toEqual(main.map((row) => String(row.severity)));
      expect(printRows.map((cells) => cells[7])).toEqual(levels);
      expect(printHtml).not.toMatch(FIXED_PARTICIPANTS);
    });
  }

  it("정본 행이 없는 위험성평가 pdf 는 키워드로 고르지 않고 편집 본문 행을 전부 싣는다", async () => {
    const rows = Array.from({ length: 8 }, (_, index) => ({ document: "위험성평가표", section: "본문", item: `항목 ${index + 1}`, content: `편집한 문장 ${index + 1}` }));
    const response = await exportPdf(request("http://localhost/api/export/pdf?format=html", {
      title: "위험성평가표",
      scenario: { companyName: "합성 사업장", siteName: "제1현장", workSummary: "합성 작업", workerCount: 3 },
      rows
    }));
    const html = await response.text();
    for (const row of rows) expect(html).toContain(row.content);
    expect(html).not.toContain("상/중/하");
    expect(html).not.toContain("인적 요인/기계·설비 요인/작업환경 요인/관리 요인");
    expect(html).not.toMatch(FIXED_PARTICIPANTS);
    expect(html).toContain("평가 실시 시기");
  });
});

describe("편집기 인쇄 마크업", () => {
  it("인쇄·Word·JPG 위험성평가표에 고정 등급·고정 참여자·추측 함수가 없다", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "components/WorkpackEditor.tsx"), "utf8");
    expect(source).not.toMatch(FIXED_PARTICIPANTS);
    expect(source).not.toContain("<td class=\"center\">중</td>");
    expect(source).not.toMatch(/function inferDisasterType|function inferRiskFactor4M|function inferEquipment/u);
    expect(source).toContain("buildRiskAssessmentRecordHtml");
  });
});
