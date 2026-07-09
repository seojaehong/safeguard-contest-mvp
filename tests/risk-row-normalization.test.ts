import { describe, expect, it } from "vitest";

import { normalizeRiskAssessmentRiskLevels } from "@/lib/search";
import { validateRiskAssessmentRows, type RiskAssessmentRow } from "@/lib/risk-assessment-schema";

function row(overrides: Partial<RiskAssessmentRow> = {}): RiskAssessmentRow {
  return {
    location: "부산 해운대 지하 기계실",
    process: "시설관리",
    task: "배수펌프 점검",
    equipment: "배수펌프",
    hazard: "밀폐공간 산소결핍",
    fourM: "Media",
    accidentType: "asphyxiation",
    currentControls: "환기 및 산소농도 측정",
    likelihood: 4,
    severity: 5,
    riskLevel: "medium",
    additionalControls: "감시인 외부 배치 및 대피용 기구 비치",
    owner: "관리감독자",
    due: "현장 확인",
    verification: "작업 전 확인",
    verificationStatus: "planned",
    verificationDate: "현장 확인",
    verificationChecker: "관리감독자",
    whyLikelihood: "밀폐공간 진입 전 조건을 고려했습니다.",
    whySeverity: "산소결핍은 중대재해로 이어질 수 있습니다.",
    evidenceRefs: ["DB 하네스", "온톨로지 QA"],
    ...overrides
  };
}

describe("risk row normalization", () => {
  it("normalizes AI riskLevel to the likelihood and severity contract", () => {
    const normalized = normalizeRiskAssessmentRiskLevels([
      row({ likelihood: 4, severity: 5, riskLevel: "medium" }),
      row({ likelihood: 2, severity: 3, riskLevel: "high" }),
      row({ likelihood: 1, severity: 4, riskLevel: "medium" })
    ]);

    expect(normalized.map((item) => item.riskLevel)).toEqual(["high", "medium", "low"]);
    const validation = validateRiskAssessmentRows(normalized);
    expect(validation.ok).toBe(true);
    expect(validation.issues).toEqual([]);
  });
});
