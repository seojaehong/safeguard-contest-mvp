import { describe, expect, it } from "vitest";

import { parseOperationImprovements } from "@/lib/operation-improvement-history";

describe("parseOperationImprovements", () => {
  it("preserves DB-backed vision and OCR metadata for learning export handoff", () => {
    const parsed = parseOperationImprovements(JSON.stringify([{
      id: "improvement-1",
      createdAt: "2026-07-09T00:00:00.000Z",
      siteName: "성수동 현장",
      workSummary: "외벽 도장",
      hazardLabel: "추락",
      improvementText: "난간 보강 후 작업",
      reflectedDocuments: ["위험성평가표", "TBM 브리핑"],
      beforePhotoName: "before.png",
      afterPhotoName: "after.png",
      photoAnalysisSummary: "난간이 보강됨",
      storageMode: "db",
      sourceType: "photo_analysis",
      workpackId: "wp-1",
      remoteImprovementId: "improvement-1",
      visionSummary: "개선 후 난간이 설치되었습니다.",
      detectedHazards: ["추락", "출입통제"],
      observedImprovement: "난간 설치와 출입금지 표지가 확인됩니다.",
      ocrText: "작업중 출입금지",
      saveMessage: "Before/After 사진 기반 개선사항 후보를 저장했습니다."
    }]));

    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({
      storageMode: "db",
      sourceType: "photo_analysis",
      workpackId: "wp-1",
      remoteImprovementId: "improvement-1",
      visionSummary: "개선 후 난간이 설치되었습니다.",
      detectedHazards: ["추락", "출입통제"],
      observedImprovement: "난간 설치와 출입금지 표지가 확인됩니다.",
      ocrText: "작업중 출입금지"
    });
  });

  it("rejects malformed remote metadata instead of keeping ambiguous local history", () => {
    const parsed = parseOperationImprovements(JSON.stringify([{
      id: "improvement-1",
      createdAt: "2026-07-09T00:00:00.000Z",
      siteName: "성수동 현장",
      workSummary: "외벽 도장",
      hazardLabel: "추락",
      improvementText: "난간 보강 후 작업",
      reflectedDocuments: ["위험성평가표"],
      storageMode: "remote",
      sourceType: "photo_analysis"
    }]));

    expect(parsed).toEqual([]);
  });
});
