import { describe, expect, it } from "vitest";

import {
  buildAcceptedHazardPhotoAppendix,
  buildAcceptedHazardPhotoHarnessImprovements,
  buildHazardPhotoCandidateKey,
  buildHazardPhotoCandidates,
  buildPhotoAnalysisCandidate
} from "@/lib/operation-improvements";

describe("operation improvement photo analysis candidate", () => {
  it("returns an empty candidate until both before and after photos are attached", () => {
    const candidate = buildPhotoAnalysisCandidate({
      beforePhoto: { name: "before.png" },
      afterPhoto: null,
      workSummary: "성수동 외벽 도장 작업",
      topRisk: "추락"
    });

    expect(candidate).toBe("");
  });

  it("turns before and after photos into a reviewable improvement candidate", () => {
    const candidate = buildPhotoAnalysisCandidate({
      beforePhoto: { name: "before.png" },
      afterPhoto: { name: "after.png" },
      workSummary: "성수동 외벽 도장 작업",
      topRisk: "추락",
      reflectedDocuments: ["위험성평가표", "TBM 브리핑", "TBM 기록"]
    });

    expect(candidate).toContain("Before/After 사진 비교 후보");
    expect(candidate).toContain("성수동 외벽 도장 작업");
    expect(candidate).toContain("추락");
    expect(candidate).toContain("위험성평가표");
    expect(candidate).toContain("TBM 브리핑");
  });
});

describe("hazard photo candidates", () => {
  it("does not create candidates until a photo is attached", () => {
    expect(buildHazardPhotoCandidates("성수동 외벽 도장 작업", null)).toEqual([]);
  });

  it("returns reviewable hazard candidates from narrative and photo hints", () => {
    const candidates = buildHazardPhotoCandidates(
      "외벽 도장 작업, 이동식 비계 사용, 작업자 5명",
      "scaffold-before.jpg"
    );

    expect(candidates).toContainEqual({
      label: "추락·낙하 위험",
      detail: "고소 작업, 비계, 개구부, 낙하물 가능성을 확인합니다."
    });
  });

  it("falls back to a manual site-photo review candidate", () => {
    const candidates = buildHazardPhotoCandidates("실내 점검", "site-photo.png");

    expect(candidates).toEqual([
      {
        label: "현장 사진 검토 필요",
        detail: "작업면, 보호구, 출입통제, 장비 배치 여부를 후보로 검토합니다."
      }
    ]);
  });

  it("builds a stable key for user accepted photo candidates", () => {
    const key = buildHazardPhotoCandidateKey({
      source: "vision",
      label: "추락·낙하 위험",
      detail: "개구부 주변 통제가 부족합니다.",
      sourcePhotoNames: [" Workface.JPG "]
    });

    expect(key).toBe("vision::추락·낙하 위험::개구부 주변 통제가 부족합니다.::workface.jpg");
  });

  it("adds only accepted photo hazards to the generation appendix", () => {
    const accepted = {
      source: "vision" as const,
      label: "추락·낙하 위험",
      detail: "개구부 주변 통제가 부족합니다.",
      severity: "high" as const,
      evidence: "사진의 개구부와 통제선 미확인",
      reflectedDocuments: ["위험성평가표", "TBM 브리핑"],
      sourcePhotoNames: ["workface.jpg"]
    };
    const ignored = {
      source: "vision" as const,
      label: "차량·장비 동선",
      detail: "사진상 장비 접근로가 명확하지 않습니다.",
      severity: "review" as const,
      sourcePhotoNames: ["workface.jpg"]
    };

    const appendix = buildAcceptedHazardPhotoAppendix({
      candidates: [accepted, ignored],
      acceptedCandidateKeys: [buildHazardPhotoCandidateKey(accepted)],
      summary: "외벽 작업면 사진입니다.",
      ocrText: "추락주의"
    });

    expect(appendix).toContain("[사용자 추가 사진 위험요인 후보]");
    expect(appendix).toContain("추락·낙하 위험(high)");
    expect(appendix).toContain("위험성평가표");
    expect(appendix).toContain("추락주의");
    expect(appendix).not.toContain("차량·장비 동선");
  });

  it("turns accepted photo hazards into DB harness improvement memory", () => {
    const accepted = {
      source: "vision" as const,
      label: "작업발판 외측 추락 위험",
      detail: "외벽 도장 작업면 가장자리의 난간 상태를 현장 확인해야 합니다.",
      severity: "high" as const,
      evidence: "scaffold.jpg에서 작업면 가장자리가 노출되어 보임",
      reflectedDocuments: ["위험성평가표", "TBM 브리핑"],
      sourcePhotoNames: ["scaffold.jpg"]
    };
    const ignored = {
      source: "local" as const,
      label: "보호구 착용 확인",
      detail: "작업자 보호구 상태를 확인합니다.",
      severity: "review" as const
    };

    const improvements = buildAcceptedHazardPhotoHarnessImprovements({
      taskLabel: "성수동 외벽 도장 작업",
      candidates: [accepted, ignored],
      acceptedCandidateKeys: [buildHazardPhotoCandidateKey(accepted)],
      summary: "작업발판 외측이 보입니다.",
      ocrText: "추락주의"
    });

    expect(improvements).toHaveLength(1);
    expect(improvements[0]).toMatchObject({
      taskLabel: "성수동 외벽 도장 작업",
      hazardLabel: "작업발판 외측 추락 위험",
      improvementText: "사진 위험요인 확인 및 조치 후보: 외벽 도장 작업면 가장자리의 난간 상태를 현장 확인해야 합니다.",
      reflectedDocuments: ["위험성평가표", "TBM 브리핑"],
      sourceType: "photo_analysis",
      visionStatus: "analyzed",
      analysisMode: "vision_ocr",
      photoPairAttached: false,
      visionUserLabel: "vision/OCR 사진 분석",
      ocrText: "추락주의"
    });
    expect(improvements[0].visionSummary).toContain("scaffold.jpg");
    expect(improvements[0].detectedHazards).toContain("작업발판 외측 추락 위험");
    expect(improvements[0].detectedHazards).toContain("severity:high");
  });
});
