import ExcelJS from "exceljs";
import { HwpDocument } from "@rhwp/core";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { POST as exportPdf } from "@/app/api/export/pdf/route";
import { POST as exportHwp } from "@/app/api/export/hwp/route";
import { POST as exportXlsx } from "@/app/api/export/xlsx/route";
import { serializeRiskAssessmentRowsToDraft, isCanonicalRiskAssessmentExportSafe, selectTbmBridgeRiskRows } from "@/components/workpack-editor-structure";
import { buildMockAskResponse, mockSearchResults } from "@/lib/mock-data";
import type { RiskAssessmentRow } from "@/lib/risk-assessment-schema";
import { buildTbmRiskLinks, referenceEquipmentLabel } from "@/lib/search";
import { findUserOutputLeaks } from "@/lib/user-output-gate";

type XlsxLoadBuffer = Parameters<ExcelJS.Workbook["xlsx"]["load"]>[0];

const row: RiskAssessmentRow = {
  controlId: "CTRL-001",
  location: "제1현장",
  process: "프레스 금형 교체",
  task: "금형 교체",
  equipment: "프레스",
  hazard: "슬라이드 불시 하강으로 인한 끼임",
  fourM: "Machine",
  accidentType: "caughtIn",
  currentControls: "안전블록 설치",
  likelihood: 3,
  severity: 4,
  riskLevel: "high",
  additionalControls: "전원 차단·잠금표지 후 금형 교체",
  owner: "관리감독자",
  due: "현장 확인",
  verification: "작업 전 확인",
  verificationStatus: "needsReview",
  verificationDate: "현장 확인",
  verificationChecker: "현장소장",
  whyLikelihood: "반복 작업",
  whySeverity: "끼임 시 중상",
  evidenceRefs: ["riskAssessmentDraft", "tbmBriefing", "DB 하네스 직접근거", "검색: rest"]
};

describe("risk assessment draft serializer (CI-03)", () => {
  it("writes Korean display labels, not model enums or document keys", () => {
    const draft = serializeRiskAssessmentRowsToDraft([row]);

    expect(draft).toContain("위험등급: 상");
    expect(draft).toContain("4M: 기계·설비 요인");
    expect(draft).toContain("재해형태: 끼임");
    expect(draft).toContain("확인상태: 검토 필요");
    expect(draft).toContain("근거: 위험성평가표 | TBM 브리핑");
    expect(draft).not.toMatch(/\b(?:high|Machine|caughtIn|needsReview|riskAssessmentDraft|tbmBriefing)\b/u);
    expect(draft).not.toContain("검색: rest");
    expect(findUserOutputLeaks(draft)).toEqual([]);
    // 같은 직렬화기로 비교하므로 정본 판정은 그대로 유지된다
    expect(isCanonicalRiskAssessmentExportSafe([row], draft, draft)).toBe(true);
  });

  it("keeps the template (mock) path free of internal codes", () => {
    const response = buildMockAskResponse("프레스 금형 교체 작업, 작업자 3명", mockSearchResults.slice(0, 2), "mock", "테스트");
    for (const [key, value] of Object.entries(response.deliverables)) {
      if (typeof value !== "string") continue;
      expect(findUserOutputLeaks(value), key).toEqual([]);
    }
  });
});

describe("TBM risk links (TBM-10)", () => {
  it("uses a Korean status and the right particle after the checker", () => {
    const [link] = buildTbmRiskLinks([{ ...row, verificationStatus: "planned" }], "맑음");
    expect(link.verification).toContain("현장소장이");
    expect(link.verification).toContain("조치 예정");
    expect(link.verification).not.toMatch(/\b(?:planned|needsReview|done)\b/u);
    const [second] = buildTbmRiskLinks([{ ...row, verificationChecker: "관리감독자" }], "맑음");
    expect(second.verification).toContain("관리감독자가");
  });

  it("drops weather-summary rows and review-pending rows from worker questions when real rows exist", () => {
    const weatherRow: RiskAssessmentRow = {
      ...row,
      hazard: "단시간 구름많음, 강수없음, 기온 23℃에 따른 작업환경 변화 위험",
      verificationStatus: "planned"
    };
    const reviewRow: RiskAssessmentRow = {
      ...row,
      hazard: "검토 필요: SIF 사고의 직접 원인과 현장 위험요인 미확정",
      verificationStatus: "needsReview"
    };
    const workRow: RiskAssessmentRow = { ...row, verificationStatus: "planned" };
    const links = buildTbmRiskLinks([workRow, weatherRow, reviewRow], "단시간 구름많음");

    expect(links.map((link) => link.riskRowIndex)).toEqual([0]);
    expect(links.map((link) => link.hazard).join("\n")).not.toMatch(/작업환경 변화 위험|검토 필요:/u);
  });
});

describe("export routes gate the payload (EXP-10, COPY-05, COPY-04)", () => {
  it("xlsx risk sheet shows 상, document titles in 근거, and no placeholder text in date cells", async () => {
    const response = await exportXlsx(new NextRequest("http://localhost/api/export/xlsx", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        mode: "single",
        title: "위험성평가표",
        scenario: { companyName: "합성건설", siteName: "제1현장", workSummary: "프레스 금형 교체", workerCount: 3 },
        profile: { code: "risk-assessment", subtitle: "현장 위험성평가", layout: "risk", primaryColumn: "유해·위험요인", actionColumn: "감소대책", confirmationRows: ["현장 확인"], approvalLabels: ["작성", "검토", "승인"] },
        rows: [],
        structuredRiskRows: [{
          location: "제1현장",
          process: "프레스",
          task: "금형 교체",
          equipment: "프레스",
          hazard: "끼임 (SIF:sif-아카이브-제조업등-01163)",
          fourM: "Machine",
          accidentType: "caughtIn",
          currentControls: "안전블록",
          likelihood: 3,
          severity: 4,
          riskLevel: "high",
          additionalControls: "전원 차단·잠금표지",
          verificationStatus: "planned",
          due: "현장 확인",
          verificationDate: "현장 확인",
          evidenceRefs: ["riskAssessmentDraft", "tbmBriefing", "DB 하네스 직접근거", "검색: rest"]
        }]
      })
    }));

    expect(response.status).toBe(200);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Buffer.from(await response.arrayBuffer()) as unknown as XlsxLoadBuffer);
    const sheet = workbook.getWorksheet("위험성평가표");
    if (!sheet) throw new Error("missing sheet");
    const texts: string[] = [];
    sheet.eachRow((sheetRow) => sheetRow.eachCell({ includeEmpty: false }, (cell) => texts.push(cell.text)));
    const all = texts.join("\n");

    expect(texts).toContain("상");
    expect(all).not.toContain("높음");
    expect(all).toContain("위험성평가표\nTBM 브리핑");
    expect(all).not.toMatch(/riskAssessmentDraft|tbmBriefing|SIF:|검색: rest|DB 하네스/u);
    // 조치기한·확인일 칸에는 「현장 확인」 글자 대신 날짜 기입란
    const dataRow = sheet.getRow(texts.indexOf("상") >= 0 ? findRowWith(sheet, "상") : 0);
    expect(dataRow.getCell(15).text).not.toBe("현장 확인");
    expect(dataRow.getCell(17).text).not.toBe("현장 확인");
  });

  it("pdf html prints Korean grade for TBM bridge rows and strips SIF IDs and document keys", async () => {
    const response = await exportPdf(new NextRequest("http://localhost/api/export/pdf?format=html", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "TBM 브리핑",
        scenario: { companyName: "합성건설", siteName: "제1현장", workSummary: "정화조 청소", workerCount: 3 },
        rows: [
          { document: "TBM 브리핑", section: "위험성평가 기반 전달사항", item: "위험등급", content: "high" },
          { document: "TBM 브리핑", section: "위험요인", item: "질식", content: "산소결핍 질식 위험 (SIF:sif-아카이브-건설업-01001)" },
          { document: "TBM 브리핑", section: "근거", item: "근거", content: "riskAssessmentDraft | tbmBriefing" },
          { document: "TBM 브리핑", section: "기상", item: "기상", content: "기상 API 결과: 맑음 / 원문성 근거는 evidence UI/metadata에서 확인" }
        ]
      })
    }));

    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).not.toMatch(/>\s*high\s*</u);
    expect(html).not.toMatch(/SIF:|riskAssessmentDraft|tbmBriefing|기상 API|evidence UI/u);
    expect(html).toContain("산소결핍 질식 위험");
  });
});

describe("TBM bridge rows from the risk draft (COPY-04)", () => {
  // 편집기 parseSheetRows 와 같은 「키: 값」 → 행 변환(머리줄은 키 없는 행)
  function draftToSheetRows(draft: string) {
    return draft.split("\n").map((line) => line.trim()).filter((line) => line && !/^\[.+\]$/u.test(line)).map((line, index) => {
      const match = line.match(/^([^:]+):\s*(.*)$/u);
      return match ? { item: match[1].trim(), content: match[2].trim() } : { item: String(index + 1), content: line };
    });
  }

  it("uses only the hazard lines, never the header line or the 위험등급 line", () => {
    const draft = serializeRiskAssessmentRowsToDraft([row, { ...row, hazard: "적재물 낙하로 인한 맞음 위험", riskLevel: "medium" }]);
    const picked = selectTbmBridgeRiskRows(draftToSheetRows(draft));
    expect(picked.map((item) => item.content)).toEqual(["슬라이드 불시 하강으로 인한 끼임", "적재물 낙하로 인한 맞음 위험"]);
  });

  it("drops field-label rows and the header when the draft is free text", () => {
    const rows = [
      { item: "1", content: "위험성평가표(구조화 편집본)" },
      { item: "위험등급", content: "high" },
      { item: "1", content: "지게차 후진 중 충돌 위험" }
    ];
    expect(selectTbmBridgeRiskRows(rows).map((item) => item.content)).toEqual(["지게차 후진 중 충돌 위험"]);
  });
});

describe("equipment cell from accident-case categories (RA-10)", () => {
  it("never writes archive or industry codes as equipment", () => {
    expect(referenceEquipmentLabel("518", "제조업")).toBe("");
    expect(referenceEquipmentLabel("아카이브(건설업)", "")).toBe("");
    expect(referenceEquipmentLabel("아카이브(제조업등)", undefined)).toBe("");
    expect(referenceEquipmentLabel("프레스", "금형")).toBe("프레스, 금형");
    expect(referenceEquipmentLabel("고소작업", null)).toBe("고소작업");
  });
});

describe("hwp export gate (COPY-16)", () => {
  it("gates the hwp request body before building", async () => {
    const response = await exportHwp(new NextRequest("http://localhost/api/export/hwp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "TBM 브리핑",
        scenario: { companyName: "합성건설", siteName: "제1현장", workSummary: "정화조 청소", workerCount: 3 },
        profile: { code: "tbm", subtitle: "TBM", layout: "tbmBriefing", primaryColumn: "위험요인", actionColumn: "대책", confirmationRows: ["확인"], approvalLabels: ["작성"] },
        rows: [
          { document: "TBM 브리핑", section: "위험", item: "위험등급", content: "high" },
          { document: "TBM 브리핑", section: "위험", item: "질식", content: "산소결핍 질식 위험 (SIF:sif-아카이브-건설업-01001)" }
        ]
      })
    }));
    expect(response.status).toBe(200);
    const reloaded = new HwpDocument(new Uint8Array(await response.arrayBuffer()));
    try {
      const cells: string[] = [];
      for (let paraIdx = 0; paraIdx < reloaded.getParagraphCount(0); paraIdx += 1) {
        const positions = JSON.parse(reloaded.getControlTextPositions(0, paraIdx)) as unknown;
        if (!Array.isArray(positions)) continue;
        positions.forEach((_position, controlIdx) => {
          let dimensions: { colCount: number; rowCount: number } | null = null;
          try {
            dimensions = JSON.parse(reloaded.getTableDimensions(0, paraIdx, controlIdx)) as { colCount: number; rowCount: number };
          } catch {
            return;
          }
          if (!dimensions) return;
          for (let cellIdx = 0; cellIdx < dimensions.colCount * dimensions.rowCount; cellIdx += 1) {
            const length = reloaded.getCellParagraphLength(0, paraIdx, controlIdx, cellIdx, 0);
            cells.push(reloaded.getTextInCell(0, paraIdx, controlIdx, cellIdx, 0, 0, length));
          }
        });
      }
      const all = cells.join("\n");
      expect(all).toContain("산소결핍 질식 위험");
      expect(cells).toContain("상");
      expect(all).not.toMatch(/SIF:|\bhigh\b/u);
    } finally {
      reloaded.free();
    }
  });
});

function findRowWith(sheet: ExcelJS.Worksheet, text: string): number {
  let found = 0;
  sheet.eachRow((sheetRow, rowNumber) => {
    if (found) return;
    sheetRow.eachCell({ includeEmpty: false }, (cell) => {
      if (cell.text === text) found = rowNumber;
    });
  });
  return found;
}
