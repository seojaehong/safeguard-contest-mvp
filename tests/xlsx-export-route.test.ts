import ExcelJS from "exceljs";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { POST } from "@/app/api/export/xlsx/route";
import { ACCIDENT_TYPE_VALUES } from "@/lib/risk-assessment-schema";

type XlsxLoadBuffer = Parameters<ExcelJS.Workbook["xlsx"]["load"]>[0];

async function loadWorkbook(response: Response) {
  const workbook = new ExcelJS.Workbook();
  const buffer = Buffer.from(await response.arrayBuffer()) as unknown as XlsxLoadBuffer;
  await workbook.xlsx.load(buffer);
  return workbook;
}

function readWorksheetText(workbook: ExcelJS.Workbook, sheetName: string) {
  const worksheet = workbook.getWorksheet(sheetName);
  if (!worksheet) throw new Error(`Missing worksheet: ${sheetName}`);

  const cells: string[] = [];
  worksheet.eachRow((row) => {
    row.eachCell({ includeEmpty: false }, (cell) => {
      const value = cell.value;
      if (typeof value === "string") {
        cells.push(value);
        return;
      }
      if (typeof value === "number") {
        cells.push(String(value));
      }
    });
  });

  return cells.join("\n");
}

function workbookCellTexts(workbook: ExcelJS.Workbook): string[] {
  const texts: string[] = [];
  workbook.eachSheet((worksheet) => {
    worksheet.eachRow((row) => {
      row.eachCell({ includeEmpty: false }, (cell) => texts.push(cell.text));
    });
  });
  return texts;
}

function findCellByText(worksheet: ExcelJS.Worksheet, text: string): ExcelJS.Cell | undefined {
  let match: ExcelJS.Cell | undefined;
  worksheet.eachRow((row) => {
    row.eachCell({ includeEmpty: false }, (cell) => {
      if (!match && cell.text.trim() === text.trim()) match = cell;
    });
  });
  return match;
}

function xlsxRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/export/xlsx", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

const scenario = {
  companyName: "세이프건설",
  companyType: "건설업",
  siteName: "서울 성수동 근린생활시설 현장",
  workSummary: "외벽 도장 작업",
  workerCount: 5,
  weatherNote: "오후 강풍 예보"
};

const riskProfile = {
  code: "risk-assessment",
  subtitle: "현장 위험성평가",
  layout: "risk",
  primaryColumn: "유해·위험요인",
  actionColumn: "감소대책",
  confirmationRows: ["현장 확인"],
  approvalLabels: ["작성", "검토", "승인"]
};

const accidentLabels = new Map([
  ["fall", "추락"],
  ["slip", "미끄러짐"],
  ["struckBy", "맞음"],
  ["caughtIn", "끼임"],
  ["cut", "베임"],
  ["burn", "화상"],
  ["electricShock", "감전"],
  ["chemicalExposure", "화학물질 노출"],
  ["asphyxiation", "질식"],
  ["heatIllness", "온열질환"],
  ["traffic", "교통사고"],
  ["collapse", "붕괴"],
  ["fireExplosion", "화재·폭발"],
  ["other", "기타"]
] as const);

describe("/api/export/xlsx structured contract", () => {
  it("keeps schema-first TBM exports on the structured workbook contract after edits", async () => {
    const sentinel = "SAFECLAW_EDITED_TBM_SENTINEL";
    const scenario = {
      companyName: "세이프건설",
      companyType: "건설업",
      siteName: "서울 성수동 근린생활시설 현장",
      workSummary: "외벽 도장 작업",
      workerCount: 5,
      weatherNote: "오후 강풍 예보"
    };
    const structured = {
      meta: {
        dateTime: "2026-07-11 08:00",
        location: scenario.siteName,
        target: "전 작업자",
        attendees: "서명 확인"
      },
      todayWork: {
        name: scenario.workSummary,
        location: scenario.siteName,
        time: "08:00 - 17:00",
        equipment: ["이동식 비계"]
      },
      hazards: [{ category: "Machine", description: "비계 흔들림" }],
      measures: [{ hazardRef: 1, action: "비계 고정핀과 작업발판 점검", owner: "관리감독자" }],
      stopCriteria: ["강풍 시 즉시 작업중지"],
      confirmTopics: ["작업중지 기준 복창"],
      photoEvidenceLocation: "현장 안전 폴더"
    };

    const request = new NextRequest("http://localhost/api/export/xlsx", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        mode: "tbmBriefingStructured",
        edited: true,
        scenario,
        structured,
        rows: [
          {
            document: "TBM 브리핑",
            section: "사용자 편집",
            item: "편집 문구",
            content: sentinel
          }
        ]
      })
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("spreadsheetml");

    const workbook = await loadWorkbook(response);
    expect(workbook.worksheets).toHaveLength(1);

    const sheetText = readWorksheetText(workbook, "TBM 브리핑");
    expect(sheetText).toContain("TBM 기본정보");
    expect(sheetText).toContain("안전대책");
    expect(sheetText).toContain(sentinel);
    expect(sheetText).not.toContain("본문 표");
  });

  it("localizes structured user-facing labels and applies Korean typography throughout", async () => {
    const response = await POST(xlsxRequest({
      mode: "tbmLogStructured",
      scenario,
      structured: {
        meta: { dateTime: "2026-07-13 08:00", location: scenario.siteName },
        hazardsDiscussed: [{ category: "Machine", description: "비계 흔들림", relatedRiskRowIndex: 0 }],
        unaddressedItems: [{ item: "난간 보강", plannedAction: "작업 전 보강", owner: "관리감독자", dueDate: "작업 전" }]
      }
    }));

    expect(response.status).toBe(200);
    const workbook = await loadWorkbook(response);
    const texts = workbookCellTexts(workbook);
    const rendered = texts.join("\n");

    expect(rendered).toContain("번호");
    expect(rendered).toContain("기계·설비 요인");
    expect(rendered).toContain("연계 위험성평가 번호");
    expect(rendered).toContain("위험성평가#1");
    expect(rendered).not.toMatch(/(^|\n)(No\.|Machine|Management|other|planned|relatedRiskRowIndex)($|\n)/);
    expect(rendered).not.toContain("structured JSON");
    expect(rendered).not.toContain("OOXML(.xlsx)");

    workbook.eachSheet((worksheet) => {
      worksheet.eachRow((row) => {
        row.eachCell({ includeEmpty: false }, (cell) => {
          expect(cell.font.name, `${worksheet.name}!${cell.address}`).toBe("Malgun Gothic");
        });
      });
    });
  });

  it("formats a wide risk sheet for readable printing and long wrapped rows", async () => {
    const longControl = "추락 방지 난간과 작업발판의 고정 상태를 작업 시작 전에 점검하고 점검 결과를 현장 기록에 남깁니다. ".repeat(5);
    const response = await POST(xlsxRequest({
      mode: "single",
      title: "위험성평가표",
      scenario,
      profile: riskProfile,
      rows: [],
      structuredRiskRows: [{
        location: "외벽",
        process: "도장",
        task: "이동식 비계 작업",
        equipment: "이동식 비계",
        hazard: "발판에서 추락",
        fourM: "Man",
        accidentType: "other",
        currentControls: longControl,
        likelihood: 3,
        severity: 4,
        riskLevel: "high",
        additionalControls: longControl,
        verificationStatus: "planned"
      }]
    }));

    expect(response.status).toBe(200);
    const workbook = await loadWorkbook(response);
    const worksheet = workbook.getWorksheet("위험성평가표");
    expect(worksheet).toBeDefined();
    if (!worksheet) throw new Error("Missing 위험성평가표 worksheet");

    expect(readWorksheetText(workbook, "위험성평가표")).toContain("인적 요인");
    expect(readWorksheetText(workbook, "위험성평가표")).toContain("기타");
    expect(readWorksheetText(workbook, "위험성평가표")).toContain("예정");
    expect(worksheet.pageSetup.paperSize).toBe(8);
    expect(worksheet.pageSetup.fitToWidth).toBe(2);
    expect(worksheet.pageSetup.printArea).toMatch(/^A1:S\d+$/);
    expect(worksheet.pageSetup.printTitlesRow).toMatch(/^\d+:\d+$/);
    expect(worksheet.views[0]).toMatchObject({ state: "frozen", ySplit: expect.any(Number) });

    const longTextCell = findCellByText(worksheet, longControl);
    expect(longTextCell).toBeDefined();
    if (!longTextCell) throw new Error("Missing long wrapped control cell");
    expect(longTextCell.alignment?.wrapText).toBe(true);
    expect(longTextCell.alignment?.vertical).toBe("top");
    const longTextRowHeight = worksheet.getRow(longTextCell.fullAddress.row).height;
    expect(longTextRowHeight).toBeGreaterThan(48);
    expect(longTextRowHeight).toBeLessThanOrEqual(90);
  });

  it("spans wide risk confirmation items so short Korean labels do not wrap vertically", async () => {
    const response = await POST(xlsxRequest({
      mode: "single",
      title: "위험성평가표",
      scenario,
      profile: { ...riskProfile, confirmationRows: ["작업 전 확인"] },
      rows: [],
      structuredRiskRows: [{
        location: "외벽",
        process: "도장",
        task: "이동식 비계 작업",
        equipment: "이동식 비계",
        hazard: "발판에서 추락",
        fourM: "Man",
        accidentType: "fall",
        currentControls: "난간 확인",
        likelihood: 3,
        severity: 4,
        riskLevel: "high",
        additionalControls: "작업 전 점검",
        verificationStatus: "planned"
      }]
    }));

    const workbook = await loadWorkbook(response);
    const worksheet = workbook.getWorksheet("위험성평가표");
    if (!worksheet) throw new Error("Missing 위험성평가표 worksheet");
    const confirmationCell = findCellByText(worksheet, "□ 작업 전 확인");
    if (!confirmationCell) throw new Error("Missing confirmation cell");

    expect(confirmationCell.address).toBe("A4");
    expect(confirmationCell.isMerged).toBe(true);
    expect(worksheet.getCell("S4").master.address).toBe("A4");
    expect(confirmationCell.alignment).toMatchObject({
      vertical: "middle",
      horizontal: "center",
      wrapText: true
    });
  });

  it("keeps workpack sheets consistent with single-sheet print and body styles", async () => {
    const document = {
      title: "작업계획서",
      profile: { ...riskProfile, layout: "generic" },
      rows: [{ document: "작업계획서", section: "작업 개요", item: "작업순서", content: "작업구역 통제 후 순차 작업" }]
    };
    const response = await POST(xlsxRequest({ mode: "workpack", scenario, documents: [document] }));

    expect(response.status).toBe(200);
    const workbook = await loadWorkbook(response);
    const cover = workbook.getWorksheet("표지");
    const worksheet = workbook.getWorksheet("작업계획서");
    expect(cover).toBeDefined();
    expect(worksheet).toBeDefined();
    if (!cover || !worksheet) throw new Error("Missing workpack worksheet");

    expect(readWorksheetText(workbook, "작업계획서")).toContain("번호");
    expect(cover.pageSetup.printArea).toMatch(/^A1:B\d+$/);
    expect(worksheet.pageSetup.printArea).toMatch(/^A1:F\d+$/);
    expect(worksheet.pageSetup.printTitlesRow).toBe("2:2");
    expect(worksheet.views[0]).toMatchObject({ state: "frozen", ySplit: 2 });
    worksheet.eachRow((row) => {
      row.eachCell({ includeEmpty: false }, (cell) => {
        expect(cell.font.name, `${worksheet.name}!${cell.address}`).toBe("Malgun Gothic");
      });
    });
  });

  it("localizes every canonical accident type only in the typed accident column", async () => {
    const structuredRiskRows = [...accidentLabels.keys()].map((accidentType, index) => ({
      location: index === 0 ? "Machine" : "외벽",
      process: index === 0 ? "planned" : "도장",
      task: `위험작업 ${index + 1}`,
      hazard: `위험요인 ${index + 1}`,
      fourM: "Management",
      accidentType,
      currentControls: index === 0 ? "현장 structured JSON 원문" : "현장 통제",
      additionalControls: index === 0 ? "high" : "추가 안전조치",
      owner: index === 0 ? "other" : "관리감독자",
      verificationStatus: "planned"
    }));
    const response = await POST(xlsxRequest({
      mode: "single",
      title: "위험성평가표",
      scenario,
      profile: riskProfile,
      rows: [],
      structuredRiskRows
    }));

    expect(response.status).toBe(200);
    const workbook = await loadWorkbook(response);
    const worksheet = workbook.getWorksheet("위험성평가표");
    if (!worksheet) throw new Error("Missing 위험성평가표 worksheet");
    const accidentHeader = findCellByText(worksheet, "재해유형");
    if (!accidentHeader) throw new Error("Missing accident type header");
    const renderedAccidents = [...accidentLabels.values()].map((_, index) => (
      worksheet.getCell(accidentHeader.row + index + 1, accidentHeader.col).text
    ));

    expect([...accidentLabels.keys()]).toEqual([...ACCIDENT_TYPE_VALUES]);
    expect(renderedAccidents).toEqual([...accidentLabels.values()]);
    expect(worksheet.getCell(accidentHeader.row + 1, 2).text).toBe("Machine");
    expect(worksheet.getCell(accidentHeader.row + 1, 3).text).toBe("planned");
    expect(worksheet.getCell(accidentHeader.row + 1, 9).text).toBe("현장 structured JSON 원문");
    expect(worksheet.getCell(accidentHeader.row + 1, 13).text).toBe("high");
    expect(worksheet.getCell(accidentHeader.row + 1, 14).text).toBe("other");
  });

  it("matches workpack body and section alignment to the single-document sheet", async () => {
    const rows = [{ document: "작업계획서", section: "작업 개요", item: "작업순서", content: "작업구역 통제 후 순차 작업" }];
    const profile = { ...riskProfile, layout: "generic" };
    const response = await POST(xlsxRequest({
      mode: "workpack",
      scenario,
      documents: [{
        title: "작업계획서",
        profile,
        rows
      }]
    }));
    const singleResponse = await POST(xlsxRequest({ mode: "single", title: "작업계획서", scenario, profile, rows }));
    const workbook = await loadWorkbook(response);
    const singleWorkbook = await loadWorkbook(singleResponse);
    const worksheet = workbook.getWorksheet("작업계획서");
    const singleWorksheet = singleWorkbook.getWorksheet("작업계획서");
    if (!worksheet || !singleWorksheet) throw new Error("Missing 작업계획서 worksheet");
    const contentCell = findCellByText(worksheet, "작업구역 통제 후 순차 작업");
    const singleContentCell = findCellByText(singleWorksheet, "작업구역 통제 후 순차 작업");
    if (!contentCell || !singleContentCell) throw new Error("Missing workpack body row");
    const row = contentCell.fullAddress.row;
    const singleRow = singleContentCell.fullAddress.row;

    [1, 5].forEach((column) => {
      expect(worksheet.getCell(row, column).alignment).toEqual(singleWorksheet.getCell(singleRow, column).alignment);
    });
    [2, 3, 4, 6].forEach((column) => {
      expect(worksheet.getCell(row, column).alignment).toEqual(singleWorksheet.getCell(singleRow, column).alignment);
    });
    const sectionHeader = worksheet.getCell(row - 1, 1);
    const singleSectionHeader = singleWorksheet.getCell(singleRow - 1, 1);
    expect(sectionHeader.text).toBe("작업 개요");
    expect(singleSectionHeader.text).toBe("작업 개요");
    expect(sectionHeader.alignment).toEqual(singleSectionHeader.alignment);
    expect(sectionHeader.alignment).toMatchObject({ vertical: "middle", horizontal: "left", indent: 1 });
  });

  it("uses actual column and merged-span widths when estimating row heights", async () => {
    const narrowSection = "좁은열에서두줄이필요한섹션명";
    const longTitle = "긴 제목 ".repeat(18).trim();
    const response = await POST(xlsxRequest({
      mode: "single",
      title: longTitle,
      scenario,
      profile: { ...riskProfile, layout: "generic", subtitle: "인쇄용 문서" },
      rows: [{ document: longTitle, section: narrowSection, item: "점검", content: "확인" }]
    }));
    const workbook = await loadWorkbook(response);
    const worksheet = workbook.worksheets[0];
    const bodySection = findCellByText(worksheet, narrowSection);
    if (!bodySection) throw new Error("Missing narrow body section");

    expect(worksheet.getRow(bodySection.fullAddress.row).height).toBeGreaterThan(24);
    expect(worksheet.getRow(1).height).toBeLessThan(90);
  });

  it("applies the default Korean font to styled empty editable cells", async () => {
    const response = await POST(xlsxRequest({
      mode: "educationRecordStructured",
      scenario,
      structured: { educationName: "신규자교육", curriculum: [] }
    }));
    const workbook = await loadWorkbook(response);
    const worksheet = workbook.getWorksheet("안전보건교육");
    if (!worksheet) throw new Error("Missing education worksheet");
    const attendeeHeader = findCellByText(worksheet, "성명");
    if (!attendeeHeader) throw new Error("Missing attendee header");
    const editableRow = attendeeHeader.row + 1;

    [2, 3, 6].forEach((column) => {
      const cell = worksheet.getCell(editableRow, column);
      expect(cell.text).toBe("");
      expect(cell.font.name).toBe("Malgun Gothic");
      expect(cell.border).toBeDefined();
    });
  });
});
