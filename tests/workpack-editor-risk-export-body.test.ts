// 편집기(components/WorkpackEditor.tsx)와 MCP 도구가 위험성평가 내보내기 본문을 같은 코드로 만드는가(261101 교차 검토 C3).
// 예전에는 편집기 TSX 를 정규식으로 잘라 new Function 으로 평가해 양식 값을 대조했다. 이제 편집기가 lib 의 양식 상수와
// 본문 함수를 가져다 쓰므로 원문 대조가 필요 없다. 여기서는 그 연결과 본문 모양만 본다.
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import * as exportBody from "@/lib/risk-assessment-export-body";

const editor = readFileSync(join(process.cwd(), "components/WorkpackEditor.tsx"), "utf8");
const script = readFileSync(join(process.cwd(), "scripts/mcp_risk_assessment_live_check.mjs"), "utf8");

describe("위험성평가 내보내기 본문 공용화", () => {
  it("편집기는 양식 값(RISK_ASSESSMENT_FORM_PROFILE 사본)과 본문 함수를 lib 에서 가져오고 양식 값을 따로 적지 않는다", () => {
    expect(editor).toMatch(/import \{[^}]*riskAssessmentFormProfile[^}]*\} from "@\/lib\/risk-assessment-export-body"/u);
    expect(editor).toMatch(/import \{[^}]*buildSingleDocumentExportBody[^}]*\} from "@\/lib\/risk-assessment-export-body"/u);
    expect(editor).not.toMatch(/code: "SC-RISK-01"/u);
    expect((editor.match(/buildSingleDocumentExportBody\(/gu) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it("실측 스크립트도 양식 값을 따로 적지 않는다", () => {
    expect(script).not.toMatch(/code: "SC-RISK-01"/u);
    expect(script).toMatch(/risk-assessment-export-body\.ts/u);
  });

  it("buildSingleDocumentExportBody 는 형식별 편집기 본문 모양을 만든다", () => {
    const build = (exportBody as Record<string, unknown>).buildSingleDocumentExportBody as ((input: Record<string, unknown>) => Record<string, unknown>) | undefined;
    expect(typeof build).toBe("function");
    const input = { edited: false, title: "위험성평가표", rows: [], profile: exportBody.RISK_ASSESSMENT_FORM_PROFILE, scenario: undefined, riskAssessmentRows: undefined, riskReviewItems: [] };
    expect(Object.keys(build!({ ...input, format: "xlsx" }))).toEqual(["mode", "edited", "title", "rows", "profile", "scenario", "riskAssessmentRows"]);
    expect(build!({ ...input, format: "xlsx" }).mode).toBe("single");
    expect(build!({ ...input, format: "hwp" })).not.toHaveProperty("mode");
    expect(build!({ ...input, format: "hwp", riskReviewItems: [{ a: 1 }] })).toHaveProperty("riskReviewItems");
  });
});
