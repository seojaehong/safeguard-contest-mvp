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

describe("getEvidenceLabel", () => {
  it("returns a 중대재해처벌법 시행령 제4조 label for every known document type", () => {
    for (const docType of knownDocTypes) {
      const label = getEvidenceLabel(docType);
      expect(label).not.toBeNull();
      expect(label?.article).toMatch(/^중대재해처벌법 시행령 제4조/);
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

  it("attaches 산업안전보건법 제29조 as related for all TBM variants", () => {
    for (const docType of ["tbmBriefing", "tbmLog", "tbmBriefingStructured", "tbmLogStructured"]) {
      expect(getEvidenceLabel(docType)?.related).toBe("산업안전보건법 제29조");
    }
  });

  it("maps safetyEducationRecord/educationRecordStructured to 제4조 제3호·제5호 with 산안법 제29조", () => {
    for (const docType of ["safetyEducationRecord", "educationRecordStructured"]) {
      const label = getEvidenceLabel(docType);
      expect(label?.article).toBe("중대재해처벌법 시행령 제4조 제3호·제5호");
      expect(label?.related).toBe("산업안전보건법 제29조");
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
