import { describe, expect, it } from "vitest";

import type { RiskAssessmentRow } from "@/lib/risk-assessment-schema";
import {
  areRiskAssessmentRowsRepresentedInDraft,
  isCanonicalRiskAssessmentExportSafe,
  serializeRiskAssessmentRowsToDraft,
  updateRiskAssessmentRowField
} from "@/components/workpack-editor-structure";

const row: RiskAssessmentRow = {
  controlId: "CTRL-001",
  location: "성수동 외벽",
  process: "외벽 도장",
  task: "이동식 비계 작업",
  equipment: "이동식 비계",
  hazard: "작업발판 외측 추락 위험",
  fourM: "Machine",
  accidentType: "fall",
  currentControls: "안전난간 설치 상태 확인",
  likelihood: 3,
  severity: 4,
  riskLevel: "high",
  additionalControls: "강풍 시 작업중지 및 안전대 체결",
  owner: "관리감독자",
  due: "현장 확인",
  verification: "작업 전 사진과 TBM 복창 확인",
  verificationStatus: "planned",
  verificationDate: "현장 확인",
  verificationChecker: "안전관리자",
  whyLikelihood: "비계 이동과 반복 노출",
  whySeverity: "고소 추락 시 중상 가능",
  evidenceRefs: ["KOSHA 이동식 비계 지침", "현장 작업계획"]
};

describe("workpack risk row editor contract", () => {
  it("serializes every canonical risk row field into the editable draft", () => {
    const draft = serializeRiskAssessmentRowsToDraft([row]);

    expect(draft).toContain("CTRL-001");
    expect(draft).toContain("작업발판 외측 추락 위험");
    expect(draft).toContain("강풍 시 작업중지 및 안전대 체결");
    expect(draft).toContain("가능성: 3");
    expect(draft).toContain("중대성: 4");
    expect(draft).toContain("위험등급: high");
    expect(draft).toContain("KOSHA 이동식 비계 지침 | 현장 작업계획");
  });

  it("recomputes riskLevel when likelihood or severity changes", () => {
    const loweredLikelihood = updateRiskAssessmentRowField(row, "likelihood", 2);
    const loweredSeverity = updateRiskAssessmentRowField(loweredLikelihood, "severity", 1);

    expect(loweredLikelihood.riskLevel).toBe("medium");
    expect(loweredSeverity.riskLevel).toBe("low");
  });

  it("allows canonical export only while valid rows match the synchronized draft", () => {
    const canonicalDraft = serializeRiskAssessmentRowsToDraft([row]);

    expect(isCanonicalRiskAssessmentExportSafe([row], canonicalDraft, canonicalDraft)).toBe(true);
    expect(isCanonicalRiskAssessmentExportSafe([row], canonicalDraft, `${canonicalDraft}\n자유 서술 추가`)).toBe(false);
    expect(isCanonicalRiskAssessmentExportSafe([{ ...row, hazard: "" }], canonicalDraft, canonicalDraft)).toBe(false);
  });

  it("rejects generated rows when the prose no longer represents their hazard or control", () => {
    const represented = `위험요인: ${row.hazard}\n감소대책: ${row.additionalControls}`;

    expect(areRiskAssessmentRowsRepresentedInDraft([row], represented)).toBe(true);
    expect(areRiskAssessmentRowsRepresentedInDraft([row], "사용자가 전혀 다른 자유 서술로 교체함")).toBe(false);
  });
});
