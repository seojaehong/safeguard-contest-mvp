import { describe, expect, it } from "vitest";

import { buildPhotoAnalysisCandidate } from "@/lib/operation-improvements";

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
