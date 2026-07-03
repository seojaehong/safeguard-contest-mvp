import { describe, expect, it } from "vitest";

import {
  buildEvidenceLabels,
  formatEvidenceBadge,
  getEvidenceLabel,
  SMSA_ARTICLE_MAP
} from "@/lib/smsa-mapping";

const knownDocTypes = [
  "riskAssessment",
  "structuredRiskRows",
  "tbmBriefing",
  "tbmLog",
  "tbmBriefingStructured",
  "tbmLogStructured",
  "safetyEducationRecord",
  "educationRecordStructured",
  "emergencyResponse",
  "workPlan",
  "workPlanStructured",
  "photoEvidence",
  "foreignWorkerBriefing",
  "foreignWorkerTransmission",
  "kakaoMessage",
  "dispatch"
];

const educationDocTypes = ["safetyEducationRecord", "educationRecordStructured"];

describe("getEvidenceLabel", () => {
  it("returns a legal-basis label for every known document type (교육 기록만 산안법 주근거)", () => {
    for (const docType of knownDocTypes) {
      const label = getEvidenceLabel(docType);
      expect(label).not.toBeNull();
      if (educationDocTypes.includes(docType)) {
        expect(label?.article).toBe("산업안전보건법 제29조");
      } else {
        expect(label?.article).toMatch(/^중대재해처벌법 시행령 제4조/);
      }
      expect(label?.purpose.length).toBeGreaterThan(0);
    }
  });

  it("returns null for an unknown document type", () => {
    expect(getEvidenceLabel("workpackSummaryDraft")).toBeNull();
    expect(getEvidenceLabel("workPermitDraft")).toBeNull();
    expect(getEvidenceLabel("totallyUnknownType")).toBeNull();
  });

  it("maps riskAssessment/structuredRiskRows to 제4조 제3호", () => {
    expect(getEvidenceLabel("riskAssessment")?.article).toBe("중대재해처벌법 시행령 제4조 제3호");
    expect(getEvidenceLabel("structuredRiskRows")?.article).toBe("중대재해처벌법 시행령 제4조 제3호");
  });

  it("labels all TBM variants as 이행 보조 증빙 with 산업안전보건법 제29조 병기", () => {
    for (const docType of ["tbmBriefing", "tbmLog", "tbmBriefingStructured", "tbmLogStructured"]) {
      const label = getEvidenceLabel(docType);
      expect(label?.related).toBe("산업안전보건법 제29조");
      expect(label?.purpose).toContain("이행 보조 증빙");
    }
  });

  it("maps 교육 기록 to 산안법 제29조 주근거 with 중처법 제3호 이행 보조 병기 (5호 제거)", () => {
    for (const docType of educationDocTypes) {
      const label = getEvidenceLabel(docType);
      expect(label?.article).toBe("산업안전보건법 제29조");
      expect(label?.related).toBe("중대재해처벌법 시행령 제4조 제3호 이행 보조");
      expect(label?.article).not.toContain("제5호");
      expect(label?.related).not.toContain("제5호");
    }
  });

  it("labels 현장사진·외국인·전파 문서를 이행 보조 증빙 표현 + 병기 근거로 라벨링한다", () => {
    for (const docType of ["photoEvidence", "foreignWorkerBriefing", "foreignWorkerTransmission", "kakaoMessage", "dispatch"]) {
      const label = getEvidenceLabel(docType);
      expect(label?.purpose).toContain("이행 보조 증빙");
      expect(label?.related).toBeDefined();
    }
  });

  it("keeps 위험성평가·작업계획서·비상대응 as 1차 이행 증빙 (보조 강등 없음)", () => {
    for (const docType of ["riskAssessment", "structuredRiskRows", "workPlan", "workPlanStructured", "emergencyResponse"]) {
      expect(getEvidenceLabel(docType)?.purpose).not.toContain("보조");
    }
  });

  it("maps emergencyResponse to 제4조 제8호", () => {
    expect(getEvidenceLabel("emergencyResponse")?.article).toBe("중대재해처벌법 시행령 제4조 제8호");
  });

  it("maps workPlan/workPlanStructured to 제4조 제3호 with 기준규칙 제38조 related", () => {
    for (const docType of ["workPlan", "workPlanStructured"]) {
      const label = getEvidenceLabel(docType);
      expect(label?.article).toBe("중대재해처벌법 시행령 제4조 제3호");
      expect(label?.related).toBe("산업안전보건기준에 관한 규칙 제38조");
    }
  });

  it("maps kakaoMessage/dispatch to the same 제4조 제3호 전파 증빙 label", () => {
    expect(getEvidenceLabel("kakaoMessage")).toEqual(getEvidenceLabel("dispatch"));
  });
});

describe("SMSA_ARTICLE_MAP", () => {
  it("contains exactly the spec'd document types", () => {
    for (const docType of knownDocTypes) {
      expect(SMSA_ARTICLE_MAP[docType]).toBeDefined();
    }
  });
});

describe("formatEvidenceBadge", () => {
  it("formats a single-호 article into a short badge", () => {
    expect(formatEvidenceBadge("중대재해처벌법 시행령 제4조 제3호")).toBe("중처법 §4-3호 증빙");
  });

  it("formats a multi-호 article using only the first 호", () => {
    expect(formatEvidenceBadge("중대재해처벌법 시행령 제4조 제3호·제5호")).toBe("중처법 §4-3호 증빙");
  });

  it("formats a 산업안전보건법 주근거 article into a 산안법 badge", () => {
    expect(formatEvidenceBadge("산업안전보건법 제29조")).toBe("산안법 §29조 증빙");
  });

  it("falls back gracefully for unrecognized article text", () => {
    expect(formatEvidenceBadge("알 수 없는 조문")).toBe("중처법 증빙");
  });
});

describe("buildEvidenceLabels", () => {
  it("indexes labels by the actual AskResponse document field key, skipping unmapped keys", () => {
    const result = buildEvidenceLabels([
      "riskAssessmentDraft",
      "workPlanDraft",
      "workpackSummaryDraft",
      "workPermitDraft",
      "kakaoMessage"
    ]);
    expect(Object.keys(result).sort()).toEqual(["kakaoMessage", "riskAssessmentDraft", "workPlanDraft"].sort());
    expect(result.riskAssessmentDraft.article).toBe("중대재해처벌법 시행령 제4조 제3호");
  });

  it("returns an empty object when no keys map", () => {
    expect(buildEvidenceLabels(["workpackSummaryDraft", "workPermitDraft"])).toEqual({});
  });
});
