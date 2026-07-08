import { describe, expect, it } from "vitest";

import { buildHazardPhotoCandidates, buildPhotoAnalysisCandidate } from "@/lib/operation-improvements";

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
});
