import ExcelJS from "exceljs";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { POST } from "@/app/api/export/xlsx/route";

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
});
