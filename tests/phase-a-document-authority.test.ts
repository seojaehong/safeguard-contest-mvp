import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import ExcelJS from "exceljs";

import { POST as exportPdf } from "@/app/api/export/pdf/route";
import { POST as exportXlsx } from "@/app/api/export/xlsx/route";
import { buildBriefingDispatchWorkpack, buildBriefingEmail } from "@/lib/briefing";
import { buildMockAskResponse, mockSearchResults } from "@/lib/mock-data";
import { buildCanonicalPhaseAPlanBinding } from "@/lib/ontology/evidence-chain";
import { applyPhaseADocumentAuthorityMarker } from "@/lib/phase-a-review";
import type { PhaseAReview } from "@/lib/types";

function read(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

function pendingReview(): PhaseAReview {
  const planBinding = structuredClone(
    buildCanonicalPhaseAPlanBinding("vehicle-machinery-entrapment"),
  );
  return {
    verdict: "검토 필요",
    verified: false,
    evidenceChainState: "review_required",
    groundingStatus: "review_required",
    outputStatus: "review_required_draft",
    verifiedRecords: 0,
    planBinding,
    materializationCoverage: {
      status: "missing",
      chainId: planBinding.chainId,
      planDigest: planBinding.planDigest,
      expectedRecordCount: planBinding.expectedRecordCount,
      materializedRecordCount: 0,
      expectedStableKeys: [...planBinding.expectedStableKeys],
      materializedStableKeys: [],
      unresolvedStableKeys: [...planBinding.expectedStableKeys],
    },
    humanConfirmation: { required: true, status: "pending" },
    actionableReason: "문서 반영과 사람 확인이 필요합니다.",
  };
}

describe("Phase A pending document authority marker", () => {
  it("injects a fail-closed marker into the actual PDF HTML export", async () => {
    const response = await exportPdf(new NextRequest("http://localhost/api/export/pdf?format=html", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "위험성평가표",
        scenario: {
          companyName: "테스트 사업장",
          siteName: "테스트 현장",
          workSummary: "고소작업",
          workerCount: 2,
          weatherNote: "맑음",
        },
        rows: [{
          document: "위험성평가표",
          section: "KOSHA 자료: 연결됨",
          item: "조치가 연결됨",
          content: "공식자료 기반 조치가 연결됨\n배관이 연결됨",
        }],
      }),
    }));

    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain("법령 근거: 검토 필요");
    expect(html).toContain("공식자료 연결 후보");
    expect(html).not.toContain("SafeClaw 공식자료 기반 현장 검토용 출력 초안");
    expect(html).not.toContain("KOSHA 자료: 연결됨");
    expect(html).not.toContain("조치가 연결됨");
    expect(html).toContain("배관이 연결됨");
  });

  it("injects the pending marker into an actual structured TBM XLSX", async () => {
    const response = await exportXlsx(new NextRequest("http://localhost/api/export/xlsx", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        mode: "tbmBriefingStructured",
        scenario: {
          companyName: "테스트 사업장",
          siteName: "테스트 현장",
          workSummary: "고소작업",
          workerCount: 2,
          weatherNote: "맑음",
        },
        structured: {
          meta: { dateTime: "2026-07-14 08:00", place: "테스트 현장", leader: "반장" },
          todayWork: { name: "고소작업", location: "배관이 연결됨", time: "08:00 - 17:00", equipment: ["작업대"] },
          hazards: [
            { category: "Management", description: "KOSHA 자료: 연결됨" },
            {
              category: "Machine",
              description: "evidence status: official / KOSHA·고용노동부 공식 자료 URL 3건 확인",
            },
          ],
          measures: [
            { hazardRef: 1, action: "조치가 연결됨", owner: "반장" },
            { hazardRef: 2, action: "source: connected / 하부 통제", owner: "반장" },
          ],
          stopCriteria: ["난간 미설치", "강풍"],
          confirmTopics: ["난간", "보호구", "통제"],
          photoEvidenceLocation: "현장 앱",
        },
      }),
    }));

    expect(response.status).toBe(200);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await response.arrayBuffer());
    const values: string[] = [];
    workbook.worksheets.forEach((worksheet) => {
      worksheet.eachRow((row) => {
        row.eachCell((cell) => values.push(cell.text));
      });
    });
    const workbookText = values.join("\n");
    expect(workbookText).toContain("법령 근거: 검토 필요");
    expect(workbookText).toContain("공식자료 연결 후보");
    expect(workbookText).not.toContain("KOSHA 자료: 연결됨");
    expect(workbookText).not.toContain("조치가 연결됨");
    expect(workbookText).not.toMatch(/\b(?:official|connected|mandated)\b/i);
    expect(workbookText).not.toContain("공식 자료 URL 3건 확인");
    expect(workbookText).toContain("배관이 연결됨");
  });

  it("wires the same marker through editor preview and HWP export requests", () => {
    const editor = read("components/WorkpackEditor.tsx");
    const currentModules = read("components/CurrentWorkpackModules.tsx");
    const hwpRoute = read("app/api/export/hwp/route.ts");
    const hwpBuilder = read("lib/hwp-table-builder.ts");

    expect(editor).toContain("dirtyDocumentKeys.length > 0 ? undefined : data.phaseAReview");
    expect(editor).toContain("buildPhaseADocumentAuthorityMarker(effectivePhaseAReview)");
    expect(editor).toContain("phaseADocumentAuthorityMarker");
    expect(editor).toContain("selectedExportText");
    expect(editor).toContain("applyPhaseADocumentAuthorityMarker(selectedText, effectivePhaseAReview)");
    expect(editor).toContain("phaseAReview: effectivePhaseAReview");
    expect(editor).toContain("data={authorityData}");
    expect(editor).toContain("const selectedRows = buildRowsForDocument(selected, authoritySafeValues)");
    expect(editor).toContain("const riskAssessmentRows = buildRowsForDocument(riskAssessmentMeta, authoritySafeValues)");
    expect(editor).toContain("authorityMarker: phaseADocumentAuthorityMarker");
    expect(currentModules).toContain("applyPhaseADocumentAuthorityMarker(storedDraft, data.phaseAReview)");
    expect(hwpRoute).toContain("법령 근거: 검토 필요");
    expect(hwpRoute).toContain("공식자료 연결 후보");
    expect(hwpRoute).not.toContain("(공식자료 기반 표 양식)");
    expect(hwpBuilder).toContain("법령 근거: 검토 필요");
    expect(hwpBuilder).toContain("공식자료 연결 후보");
    expect(hwpBuilder).not.toContain("(공식자료 기반 표 양식)");
  });

  it("removes a misleading connected bullet while preserving the editable body", () => {
    const body = [
      "[연결 상태 요약]",
      "- 법령 근거: 연결됨",
      "- KOSHA 자료: 연결됨",
      "- 조치가 연결됨",
      "- 법령 의무: mandated",
      "- 법령상 의무로 확정됨",
      "- KOSHA 자료: verified",
      "- 조치 상태: official",
      "- 공식자료 확인 완료",
      "- evidence status: official",
      "- source: connected",
      "- KOSHA·고용노동부 공식 자료 URL 3건 확인",
      "- 공식자료 기반 조치 문구",
      "배관이 연결됨",
      "작업자가 수정한 제출 본문",
    ].join("\n");

    const marked = applyPhaseADocumentAuthorityMarker(body, pendingReview());

    expect(marked).toContain("법령 근거: 검토 필요");
    expect(marked).toContain("공식자료 연결 후보 조치 문구");
    expect(marked).toContain("작업자가 수정한 제출 본문");
    expect(marked).not.toContain("법령 근거: 연결됨");
    expect(marked).not.toContain("KOSHA 자료: 연결됨");
    expect(marked).not.toContain("조치가 연결됨");
    expect(marked).not.toContain("법령 의무: mandated");
    expect(marked).not.toContain("의무로 확정됨");
    expect(marked).not.toContain("verified");
    expect(marked).not.toContain("official");
    expect(marked).not.toContain("connected");
    expect(marked).not.toContain("공식 자료 URL 3건 확인");
    expect(marked).not.toContain("공식자료 확인 완료");
    expect(marked).toContain("배관이 연결됨");
    expect(body).toContain("법령 근거: 연결됨");
  });

  it("injects the marker into briefing email and dispatch document copies", () => {
    const response = buildMockAskResponse(
      "지게차 상하차",
      mockSearchResults.slice(0, 2),
      "mock",
      "fixture",
    );
    response.phaseAReview = pendingReview();
    response.deliverables.riskAssessmentDraft = "위험성평가 편집 본문";
    response.deliverables.tbmBriefing = "공식자료 기반 TBM 편집 본문";

    const email = buildBriefingEmail(response, "테스트 현장");
    const dispatch = buildBriefingDispatchWorkpack(response, "테스트 현장");
    const documents = dispatch.documents;
    if (typeof documents !== "object" || documents === null || Array.isArray(documents)) {
      throw new Error("expected dispatch documents");
    }
    const riskAssessmentDraft = Reflect.get(documents, "riskAssessmentDraft");
    const tbmBriefing = Reflect.get(documents, "tbmBriefing");

    expect(email.body).toContain("법령 근거: 검토 필요");
    expect(riskAssessmentDraft).toContain("법령 근거: 검토 필요");
    expect(tbmBriefing).toContain("공식자료 연결 후보 TBM 편집 본문");
    expect(response.deliverables.riskAssessmentDraft).toBe("위험성평가 편집 본문");
    expect(response.deliverables.tbmBriefing).toBe("공식자료 기반 TBM 편집 본문");
  });
});
