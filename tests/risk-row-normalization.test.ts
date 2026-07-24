import { describe, expect, it } from "vitest";

import { normalizeAndValidateRiskAssessmentRows, normalizeRiskAssessmentRiskLevels } from "@/lib/search";
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

  it("validates only the final normalized rows, not stale AI precheck issues", () => {
    const finalValidation = normalizeAndValidateRiskAssessmentRows([
      row({ likelihood: 4, severity: 5, riskLevel: "medium" })
    ]);

    expect(finalValidation.rows).toHaveLength(1);
    expect(finalValidation.rows[0].riskLevel).toBe("high");
    expect(finalValidation.issues).toEqual([]);
  });

  it("replaces duplicated current and additional controls with a distinct field verification action", () => {
    const duplicatedControl = "매설물 도면 확인과 시험굴착 결과를 작업 전에 확인합니다.";
    const finalValidation = normalizeAndValidateRiskAssessmentRows([
      row({
        hazard: "지하 매설물 파손",
        currentControls: duplicatedControl,
        additionalControls: duplicatedControl,
        riskLevel: "high"
      })
    ]);

    expect(finalValidation.rows).toHaveLength(1);
    expect(finalValidation.rows[0].currentControls).toBe(duplicatedControl);
    expect(finalValidation.rows[0].additionalControls).toContain("현장 반영 여부");
    expect(finalValidation.rows[0].additionalControls).toContain("미반영 시 작업을 보류");
    expect(finalValidation.rows[0].additionalControls).not.toBe(duplicatedControl);
    expect(finalValidation.issues).toEqual([]);
  });

  it("preserves an optional canonical controlId through schema validation", () => {
    const validation = validateRiskAssessmentRows({
      rows: [row({ controlId: "fall-work-platform", riskLevel: "high" })],
    });

    expect(validation.ok).toBe(true);
    expect(validation.rows[0]?.controlId).toBe("fall-work-platform");
  });
});
