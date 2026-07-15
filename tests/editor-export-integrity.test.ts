import ExcelJS from "exceljs";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { POST } from "@/app/api/export/xlsx/route";
import type { RiskAssessmentRow } from "@/lib/risk-assessment-schema";

const staleStructuredRow: RiskAssessmentRow = {
  location: "성수동 외벽",
  process: "외벽 도장",
  task: "이동식 비계 작업",
  equipment: "이동식 비계",
  hazard: "STALE_STRUCTURED_RISK_ROW",
  fourM: "Machine",
  accidentType: "fall",
  currentControls: "기존 구조화 조치",
  likelihood: 3,
  severity: 4,
  riskLevel: "high",
  additionalControls: "기존 구조화 감소대책",
  owner: "관리감독자",
  due: "작업 전",
  verification: "기존 구조화 확인",
  verificationStatus: "planned",
  verificationDate: "현장 확인",
  verificationChecker: "안전관리자",
  whyLikelihood: "기존 구조화 가능성 근거",
  whySeverity: "기존 구조화 중대성 근거",
  evidenceRefs: ["기존 근거"]
};

describe("editor export integrity", () => {
  it("renders edited prose rows in the actual XLSX payload instead of stale structured rows", async () => {
    const sentinel = "SAFECLAW_EDITED_EXPORT_ROW";
    const request = new NextRequest("http://localhost/api/export/xlsx", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        mode: "single",
        edited: true,
        title: "위험성평가표",
        rows: [{
          document: "위험성평가표",
          section: "편집 반영",
          item: "감소대책",
          content: sentinel
        }],
        profile: {
          code: "risk-assessment",
          subtitle: "편집 반영 검증",
          layout: "risk",
          primaryColumn: "유해·위험요인",
          actionColumn: "감소대책",
          confirmationRows: [],
          approvalLabels: []
        },
        scenario: {
          companyName: "세이프건설",
          companyType: "건설업",
          siteName: "성수동 현장",
          workSummary: "외벽 도장",
          workerCount: 5,
          weatherNote: "강풍 주의"
        },
        riskAssessmentRows: [staleStructuredRow]
      })
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    const workbook = new ExcelJS.Workbook();
    const workbookBytes = Buffer.from(await response.arrayBuffer());
    await workbook.xlsx.load(workbookBytes as unknown as Parameters<typeof workbook.xlsx.load>[0]);
    const renderedCells: string[] = [];
    workbook.eachSheet((sheet) => {
      sheet.eachRow((row) => {
        row.eachCell((cell) => renderedCells.push(String(cell.text || cell.value || "")));
      });
    });
    const rendered = renderedCells.join("\n");

    expect(rendered).toContain(sentinel);
    expect(rendered).not.toContain("STALE_STRUCTURED_RISK_ROW");
  });

  it("replaces stale schema-first fields with every edited row in the actual XLSX binary", async () => {
    const editedRows = Array.from({ length: 27 }, (_, index) => ({
      document: "작업계획서",
      section: index === 0 ? "작업개요" : "작업단계 및 안전조치",
      item: index === 0 ? "작업명" : `편집 작업 ${index}`,
      content: index === 0 ? "CANONICAL_EDITED_WORK_NAME" : `CANONICAL_EDITED_ROW_${index}`
    }));
    const request = new NextRequest("http://localhost/api/export/xlsx", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        mode: "workPlanStructured",
        edited: true,
        scenario: {
          companyName: "세이프건설",
          companyType: "건설업",
          siteName: "성수동 현장",
          workSummary: "외벽 도장",
          workerCount: 5,
          weatherNote: "강풍 주의"
        },
        structured: {
          workOverview: {
            workName: "STALE_STRUCTURED_WORK_NAME",
            description: "STALE_STRUCTURED_DESCRIPTION",
            workerCount: 5,
            location: "STALE_STRUCTURED_LOCATION",
            condition: "STALE_STRUCTURED_CONDITION",
            equipment: ["STALE_STRUCTURED_EQUIPMENT"]
          },
          workSteps: [],
          stopCriteria: [],
          emergencyResponse: { contacts: [] },
          approvers: {}
        },
        rows: editedRows
      })
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("spreadsheetml.sheet");
    const workbook = new ExcelJS.Workbook();
    const workbookBytes = Buffer.from(await response.arrayBuffer());
    await workbook.xlsx.load(workbookBytes as unknown as Parameters<typeof workbook.xlsx.load>[0]);
    const renderedCells: string[] = [];
    workbook.eachSheet((sheet) => {
      sheet.eachRow((row) => {
        row.eachCell((cell) => renderedCells.push(String(cell.text || cell.value || "")));
      });
    });
    const rendered = renderedCells.join("\n");

    expect(rendered).toContain("CANONICAL_EDITED_WORK_NAME");
    expect(rendered).toContain("CANONICAL_EDITED_ROW_26");
    expect(rendered).not.toContain("STALE_STRUCTURED_WORK_NAME");
    expect(rendered).not.toContain("STALE_STRUCTURED_DESCRIPTION");
    expect(rendered).not.toContain("사용자 편집 반영");
    expect(renderedCells.filter((cell) => cell === "CANONICAL_EDITED_WORK_NAME")).toHaveLength(1);
  });
});
