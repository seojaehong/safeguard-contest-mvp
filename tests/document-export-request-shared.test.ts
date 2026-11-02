// /api/export/{xlsx,hwp} 요청 본문을 두 렌더러가 같은 파서로 읽는가(261101 교차 검토 C2).
// 정본 위험성평가 행은 본문 8자리(최상위 4 + structured 2 + response.structured 2) 어디에 실려도 같은 파일이 나와야 한다.
// 예전 한글 렌더러는 최상위 4자리만 봐서, 응답 통째 본문을 보내면 정본 행을 버리고 글 파싱 행으로 내려갔다.
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { renderHwpDocumentExport } from "@/lib/document-export-hwp";
import { parseRiskRowsFromBody } from "@/lib/document-export-request";
import { buildMockAskResponse } from "@/lib/mock-data";
import { canonicalizeRiskAssessmentResponse } from "@/lib/risk-assessment-record";
import { buildRiskAssessmentExportBody } from "@/lib/risk-assessment-export-body";

const response = canonicalizeRiskAssessmentResponse(buildMockAskResponse("가상 사업장 물류창고 지게차 상하차 작업 4명", [], "mock", "fixture"));
const rows = response.structured?.riskAssessmentRows ?? [];

describe("요청 본문 공용 파서", () => {
  it("정본 행 8자리를 모두 읽는다", () => {
    const places: Array<Record<string, unknown>> = [
      { structuredRiskRows: rows },
      { riskAssessmentRows: rows },
      { structuredRows: rows },
      { canonicalRows: rows },
      { structured: { riskAssessmentRows: rows } },
      { structured: { structuredRiskRows: rows } },
      { response: { structured: { riskAssessmentRows: rows } } },
      { response: { structured: { structuredRiskRows: rows } } }
    ];
    for (const body of places) expect(parseRiskRowsFromBody(body).length).toBe(rows.length);
  });

  it("한글 렌더러도 structured·response.structured 자리의 정본 행으로 같은 파일을 만든다", () => {
    const base = buildRiskAssessmentExportBody(response, "hwp");
    const { riskAssessmentRows: _top, ...withoutTop } = base;
    const top = renderHwpDocumentExport(base).buffer;
    expect(renderHwpDocumentExport({ ...withoutTop, structured: { riskAssessmentRows: rows } }).buffer.equals(top)).toBe(true);
    expect(renderHwpDocumentExport({ ...withoutTop, response: { structured: { riskAssessmentRows: rows } } }).buffer.equals(top)).toBe(true);
  });

  it("두 렌더러는 본문 읽기 함수를 따로 두지 않는다", () => {
    for (const file of ["lib/document-export-xlsx.ts", "lib/document-export-hwp.ts"]) {
      const source = readFileSync(join(process.cwd(), file), "utf8");
      for (const name of ["isRecord", "readString", "readNumber", "sanitizeFileName", "parseScenario", "parseRows", "parseProfile", "parseRiskRowsFromBody"]) {
        expect(source, `${file} ${name}`).not.toMatch(new RegExp(`^function ${name}[(]`, "mu"));
      }
      expect(source).toMatch(/from "@\/lib\/document-export-request"/u);
    }
  });
});
