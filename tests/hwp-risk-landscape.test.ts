// 한글(hwp) 위험성평가표 가독성 — 13칸 본표가 세로 A4 기본 폭(칸마다 같은 너비)이라 「번호」「가능성」 같은
// 머리 글자가 세로로 쪼개지고 4쪽으로 늘어났다(261101 MCP 실측 렌더). 위험성평가 본표가 있는 문서는
// 엑셀 내보내기와 같은 A3 가로에 놓고, 열 너비는 엑셀(lib/risk-assessment-record.ts RISK_ASSESSMENT_COLUMNS)의 비율을 그대로 쓴다.
// 웹 /api/export/hwp 와 MCP generate_risk_assessment 는 같은 renderHwpDocumentExport 를 쓴다.
import fs from "node:fs";
import path from "node:path";
import { HwpDocument } from "@rhwp/core";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { POST as exportHwp } from "@/app/api/export/hwp/route";
import { renderHwpDocumentExport } from "@/lib/document-export-hwp";
import { buildMockAskResponse } from "@/lib/mock-data";
import { canonicalizeRiskAssessmentResponse, RISK_RECORD_ROW_HEADERS } from "@/lib/risk-assessment-record";
import type { RiskAssessmentRow } from "@/lib/risk-assessment-schema";
import type { AskResponse } from "@/lib/types";

type OpsFixture = {
  question: string;
  scenario: AskResponse["scenario"];
  structured: { riskAssessmentRows: RiskAssessmentRow[] };
};

const ops = JSON.parse(fs.readFileSync(path.join(process.cwd(), "tests/fixtures/ops-risk-rows-2026-10-25.json"), "utf8")) as Record<string, OpsFixture>;

function riskBody(id: string): Record<string, unknown> {
  const fixture = ops[id];
  const base = buildMockAskResponse(fixture.question, [], "mock", "fixture");
  const canonical = canonicalizeRiskAssessmentResponse({
    ...base,
    scenario: fixture.scenario,
    structured: { riskAssessmentRows: fixture.structured.riskAssessmentRows }
  } as AskResponse);
  return {
    title: "위험성평가표",
    profile: { layout: "risk", approvalLabels: ["작성", "검토", "승인"] },
    scenario: canonical.scenario,
    rows: [],
    riskAssessmentRows: canonical.structured?.riskAssessmentRows || [],
    riskReviewItems: canonical.structured?.riskReviewItems || []
  };
}

type TableRef = { paraIdx: number; controlIdx: number; rowCount: number; colCount: number };

function listTables(document: HwpDocument): TableRef[] {
  const tables: TableRef[] = [];
  for (let paraIdx = 0; paraIdx < document.getParagraphCount(0); paraIdx += 1) {
    const positions = JSON.parse(document.getControlTextPositions(0, paraIdx)) as unknown;
    if (!Array.isArray(positions)) continue;
    positions.forEach((_position, controlIdx) => {
      try {
        const dims = JSON.parse(document.getTableDimensions(0, paraIdx, controlIdx)) as { rowCount: number; colCount: number };
        if (dims && typeof dims.rowCount === "number") tables.push({ paraIdx, controlIdx, ...dims });
      } catch {
        // 표가 아닌 컨트롤은 건너뛴다.
      }
    });
  }
  return tables;
}

function cellText(document: HwpDocument, table: TableRef, cellIdx: number): string {
  const length = document.getCellParagraphLength(0, table.paraIdx, table.controlIdx, cellIdx, 0);
  return document.getTextInCell(0, table.paraIdx, table.controlIdx, cellIdx, 0, 0, length);
}

function cellInnerWidth(document: HwpDocument, table: TableRef, cellIdx: number): number {
  const cell = JSON.parse(document.getCellProperties(0, table.paraIdx, table.controlIdx, cellIdx)) as {
    width: number;
    paddingLeft: number;
    paddingRight: number;
  };
  return cell.width - cell.paddingLeft - cell.paddingRight;
}

function openHwp(buffer: Buffer | ArrayBuffer): HwpDocument {
  return new HwpDocument(new Uint8Array(buffer as ArrayBuffer));
}

describe("한글 위험성평가표 — 가로 용지·엑셀 비율 열 너비", () => {
  it("위험성평가 본표 문서는 A3 가로(엑셀과 같은 용지)이고, 본표 열 너비는 엑셀 비율(감소대책 > 번호)을 따른다", () => {
    const { buffer } = renderHwpDocumentExport(riskBody("confined-space"));
    const document = openHwp(buffer);
    try {
      const page = JSON.parse(document.getPageDef(0)) as { width: number; height: number; landscape: boolean; marginLeft: number; marginRight: number };
      expect(page.landscape).toBe(true);
      expect([page.width, page.height]).toEqual([84186, 119055]); // A3 297mm × 420mm(세로 기준 + 가로 표시)
      const bodyWidth = Math.max(page.width, page.height) - page.marginLeft - page.marginRight;

      const tables = listTables(document);
      const body = tables.find((table) => table.colCount === RISK_RECORD_ROW_HEADERS.length);
      if (!body) throw new Error("본표(13칸)가 없다");
      const headers = Array.from({ length: body.colCount }, (_x, index) => cellText(document, body, index));
      expect(headers).toEqual([...RISK_RECORD_ROW_HEADERS]);
      const widths = headers.map((_header, index) => JSON.parse(document.getCellProperties(0, body.paraIdx, body.controlIdx, index)).width as number);
      const total = widths.reduce((sum, width) => sum + width, 0);
      expect(total).toBeLessThanOrEqual(bodyWidth);
      expect(total).toBeGreaterThan(bodyWidth * 0.95);
      const width = (label: string) => widths[headers.indexOf(label)];
      expect(width("감소대책")).toBeGreaterThan(width("번호") * 3);
      expect(width("유해·위험요인")).toBeGreaterThan(width("가능성") * 2);
      // 여러 쪽이면 머리 행을 쪽마다 반복한다(엑셀 printTitlesRow 와 같은 역할).
      expect(JSON.parse(document.getTableProperties(0, body.paraIdx, body.controlIdx)).repeatHeader).toBe(true);
    } finally {
      document.free();
    }
  });

  it.each(["confined-space", "mfg-press", "con-excavation", "logistics-heat"])("%s: 어느 표든 칸 안 너비가 머리 낱말 전부·값 낱말(최대 5자)보다 좁지 않다 — 글자가 한 자씩 세로로 쪼개지지 않는다", (id) => {
    const { buffer } = renderHwpDocumentExport(riskBody(id));
    const document = openHwp(buffer);
    const CHAR_WIDTH = 1000; // 기본 글자 크기 10pt(HWPUNIT 1000), 한글 한 자 폭
    try {
      const narrow: string[] = [];
      for (const table of listTables(document)) {
        for (let cellIdx = 0; cellIdx < table.rowCount * table.colCount; cellIdx += 1) {
          const text = cellText(document, table, cellIdx);
          // 한글은 한국어를 글자 단위로 줄바꿈한다. 머리 행·6자 이하 칸 글은 통째로, 긴 글은 가장 긴 낱말(최대 5자)이 한 줄.
          const length = [...text.trim()].length;
          const longest = Math.max(0, ...text.split(/\s+/u).map((word) => [...word].length));
          const isBodyHeader = table.colCount === RISK_RECORD_ROW_HEADERS.length && cellIdx < table.colCount;
          const need = (isBodyHeader || length <= 6 ? length : Math.min(longest, 5)) * CHAR_WIDTH;
          const inner = cellInnerWidth(document, table, cellIdx);
          if (inner < need) narrow.push(`${table.colCount}칸 표 ${cellIdx}번 「${text.slice(0, 12)}」 ${inner} < ${need}`);
        }
      }
      expect(narrow).toEqual([]);
    } finally {
      document.free();
    }
  });

  it("웹 /api/export/hwp 와 renderHwpDocumentExport 가 같은 바이트를 낸다(가로 용지 포함)", async () => {
    const body = riskBody("mfg-press");
    const response = await exportHwp(new NextRequest("http://localhost/api/export/hwp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    }));
    expect(response.status).toBe(200);
    const web = Buffer.from(await response.arrayBuffer());
    const direct = renderHwpDocumentExport(body).buffer;
    expect(web.equals(direct)).toBe(true);
    const document = openHwp(web);
    try {
      expect(JSON.parse(document.getPageDef(0)).landscape).toBe(true);
    } finally {
      document.free();
    }
  });

  it("위험성평가가 아닌 문서(4칸 표)는 세로 용지 그대로다", () => {
    const { buffer } = renderHwpDocumentExport({
      title: "작업계획서",
      profile: { layout: "workPlan" },
      scenario: { siteName: "가상 현장", workSummary: "가상 작업", workerCount: 3 },
      rows: [{ document: "작업계획서", section: "개요", item: "작업", content: "가상 작업 내용" }]
    });
    const document = openHwp(buffer);
    try {
      expect(JSON.parse(document.getPageDef(0)).landscape).toBe(false);
    } finally {
      document.free();
    }
  });
});
