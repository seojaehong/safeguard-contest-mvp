// 관련성 거름에서 뺀 SIF 사례가 본표 행·근거 칸(evidenceRefs)·내보낸 파일 어디에도 남지 않는가.
// 261101 run4: MCP 결과는 사례를 「뺐다」고 하면서 본표 1행 근거 칸에는 같은 사례 제목이 남았다(생성은 거르기 전 사례를 받았다).
// 생성 경로 그대로 — 패킷(buildDbHarnessPacket) → 공개 근거(search.ts 와 같은 direct+sif+supporting) →
// DB 근거 행(buildSafetyReferenceRiskRows) → 정본화 → MCP 처리기 → xlsx.
// 사례 제목·요약은 가상 문장이다.
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import { buildDbHarnessPacket, buildPublicDbHarnessPacket } from "@/lib/db-harness";
import { renderHwpDocumentExport } from "@/lib/document-export-hwp";
import { renderXlsxDocumentExport } from "@/lib/document-export-xlsx";
import { createGenerateRiskAssessmentHandler, type RiskAssessmentToolResult } from "@/lib/mcp-risk-assessment";
import { buildMockAskResponse } from "@/lib/mock-data";
import { canonicalizeRiskAssessmentResponse } from "@/lib/risk-assessment-record";
import type { SafetyReferenceItem } from "@/lib/safety-reference-catalog";
import { buildSafetyReferenceRiskRows } from "@/lib/search";
import type { AskResponse } from "@/lib/types";

const QUESTION = "가상 사업장 한빛정화 오수처리장 맨홀 내부 슬러지 제거 작업 3명, 밀폐공간 산소결핍·황화수소 우려, 주간";

function sifItem(id: string, title: string, summary: string, controls: string[]): SafetyReferenceItem {
  return {
    id,
    source_id: "kosha-sif-archive-20260401",
    item_type: "sif-case",
    category: null,
    subcategory: null,
    title,
    summary,
    keywords: [],
    risk_tags: [],
    primary_documents: ["위험성평가표"],
    controls,
    evidence_role: "supporting",
    source_url: `https://example.invalid/${id}`,
  };
}

const EXCLUDED = sifItem(
  "v-furnace",
  "가상 사례 — 열처리로 가동 중 내화물 속 물이 끓어 폭발",
  "가상 개요: 새로 쌓은 내화물이 덜 말라 가동 직후 증기 압력으로 터졌다.",
  ["내화물 건조 상태를 가동 전 확인", "증기 배출구 확보"],
);
const KEPT = sifItem(
  "v-pipe",
  "가상 사례 — 좁은 배관 안 용접 작업자가 산소결핍으로 의식 잃음",
  "가상 개요: 환기 없이 배관 안에 들어가 용접하다 의식을 잃었다.",
  ["진입 전 산소·유해가스 농도 측정", "작업 중 강제 환기 유지"],
);

function generatedResponse(): AskResponse {
  const packet = buildPublicDbHarnessPacket(buildDbHarnessPacket({ question: QUESTION, references: [EXCLUDED, KEPT] }));
  const base = buildMockAskResponse(QUESTION, [], "mock", "fixture");
  // lib/search.ts runAsk 와 같은 순서로 공개 근거를 모아 DB 근거 행을 만든다.
  const publicEvidenceItems = [...packet.directEvidence, ...packet.sifCases, ...packet.supportingEvidence];
  const rows = buildSafetyReferenceRiskRows(base, publicEvidenceItems, "맑음", QUESTION);
  return canonicalizeRiskAssessmentResponse({
    ...base,
    structured: { ...base.structured, riskAssessmentRows: rows } as AskResponse["structured"],
    dbHarness: { packet, promptContext: "", summary: { sifCases: packet.sifCases.length } as unknown as NonNullable<AskResponse["dbHarness"]>["summary"] },
  });
}

describe("뺀 SIF 사례는 본표·근거 칸·파일에 남지 않는다", () => {
  it("DB 근거 행은 남긴 사례로만 만들고, MCP 결과·xlsx 어디에도 뺀 사례 제목·주소가 없다", async () => {
    const response = generatedResponse();
    // 본표 행 + 확인 필요 목록(가상 사례는 원인 미확정이라 정본화가 확인 필요 목록으로 옮긴다).
    const rowsText = JSON.stringify([response.structured?.riskAssessmentRows ?? [], response.structured?.riskReviewItems ?? []]);
    // 거름이 빈 결과로 통과하지 않도록, 남긴 사례로 만든 행은 있어야 한다.
    expect(rowsText).toContain("배관 안 용접");

    const handler = createGenerateRiskAssessmentHandler({
      defaultMode: "enhanced",
      generateResponse: async () => response,
      renderXlsx: renderXlsxDocumentExport,
      renderHwp: renderHwpDocumentExport,
    });
    const result = await handler({ question: QUESTION, format: "xlsx" }, { siteId: null, orgId: null, scopes: ["tools:*"], source: "env", tokenId: null }, { signal: new AbortController().signal });
    const payload = JSON.parse(result.content[0]?.text ?? "{}") as RiskAssessmentToolResult;

    const surface = JSON.stringify({ rows: payload.riskAssessment.rows, structuredRows: payload.riskAssessment.structuredRows, review: payload.reviewItems, cases: payload.sif.cases });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Buffer.from(payload.file?.base64 ?? "", "base64") as unknown as Parameters<ExcelJS.Workbook["xlsx"]["load"]>[0]);
    const cells: string[] = [];
    workbook.eachSheet((sheet) => sheet.eachRow((row) => row.eachCell((cell) => cells.push(cell.text))));
    const fileText = cells.join("\n");

    for (const needle of ["열처리로", "내화물", "example.invalid/v-furnace"]) {
      expect(rowsText).not.toContain(needle);
      expect(surface).not.toContain(needle);
      expect(fileText).not.toContain(needle);
    }
    expect(payload.sif.excluded?.map((item) => item.id)).toEqual(["v-furnace"]);
  });
});
