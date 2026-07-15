import { describe, expect, it } from "vitest";

import {
  operationImprovementToHarnessImprovement,
  parseOperationImprovements
} from "@/lib/operation-improvement-history";

describe("parseOperationImprovements", () => {
  it("preserves canonical and legacy review statuses without dropping them", () => {
    const base = {
      createdAt: "2026-07-09T00:00:00.000Z",
      siteName: "성수동 현장",
      workSummary: "외벽 도장",
      hazardLabel: "추락",
      improvementText: "난간 보강 후 작업",
      reflectedDocuments: ["위험성평가표"]
    };
    const parsed = parseOperationImprovements(JSON.stringify([
      { ...base, id: "candidate", status: "candidate" },
      { ...base, id: "approved", status: "approved" },
      { ...base, id: "rejected", status: "rejected" },
      { ...base, id: "reflected", status: "reflected" },
      { ...base, id: "legacy-proposed", status: "proposed" },
      { ...base, id: "legacy-in-progress", status: "in_progress" },
      { ...base, id: "legacy-on-hold", status: "on_hold" },
      { ...base, id: "legacy-completed", status: "completed" },
      { ...base, id: "legacy-verified", status: "verified" }
    ]));

    expect(parsed.map(({ id, status }) => ({ id, status }))).toEqual([
      { id: "candidate", status: "candidate" },
      { id: "approved", status: "approved" },
      { id: "rejected", status: "rejected" },
      { id: "reflected", status: "reflected" },
      { id: "legacy-proposed", status: "proposed" },
      { id: "legacy-in-progress", status: "in_progress" },
      { id: "legacy-on-hold", status: "on_hold" },
      { id: "legacy-completed", status: "completed" },
      { id: "legacy-verified", status: "verified" }
    ]);
  });

  it("rejects calendar rollover and timestamps without an RFC3339 offset", () => {
    const base = {
      siteName: "성수동 현장",
      workSummary: "외벽 도장",
      hazardLabel: "추락",
      improvementText: "난간 보강 후 작업",
      reflectedDocuments: ["위험성평가표"]
    };
    const parsed = parseOperationImprovements(JSON.stringify([
      { ...base, id: "utc", createdAt: "2026-02-28T00:00:00Z" },
      { ...base, id: "offset", createdAt: "2026-02-28T09:00:00+09:00" },
      { ...base, id: "rollover", createdAt: "2026-02-30T00:00:00Z" },
      { ...base, id: "no-offset", createdAt: "2026-02-28T00:00:00" }
    ]));

    expect(parsed.map((item) => item.id)).toEqual(["utc", "offset"]);
  });

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
      visionStatus: "analyzed",
      analysisMode: "vision_ocr",
      photoPairAttached: true,
      visionUserLabel: "vision/OCR 분석 완료",
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
      visionStatus: "analyzed",
      analysisMode: "vision_ocr",
      photoPairAttached: true,
      visionUserLabel: "vision/OCR 분석 완료",
      visionSummary: "개선 후 난간이 설치되었습니다.",
      detectedHazards: ["추락", "출입통제"],
      observedImprovement: "난간 설치와 출입금지 표지가 확인됩니다.",
      ocrText: "작업중 출입금지"
    });
  });

  it("accepts harness-shaped task labels so local photo analysis can feed the next generation", () => {
    const parsed = parseOperationImprovements(JSON.stringify([{
      id: "local-before-after-1",
      createdAt: "2026-07-10T00:00:00.000Z",
      taskLabel: "성수동 외벽 도장",
      hazardLabel: "작업발판 외측 추락 위험",
      improvementText: "Before 사진의 난간 누락 구간을 보강하고 After 사진에서 출입통제선을 확인",
      reflectedDocuments: ["위험성평가표", "TBM 브리핑", "TBM 기록"],
      sourceType: "photo_analysis",
      visionStatus: "analyzed",
      analysisMode: "vision_ocr",
      photoPairAttached: true,
      visionUserLabel: "vision/OCR 분석 완료",
      visionSummary: "난간 보강과 하부 출입통제선이 After 사진에서 확인됩니다.",
      detectedHazards: ["작업발판 외측 추락 위험", "하부 낙하물 위험"],
      observedImprovement: "난간 보강 및 통제선 설치",
      ocrText: "추락주의",
      sourcePhotoNames: ["before-rail-gap.jpg", "after-guardrail.jpg"],
      photoCount: 2,
      siteSignals: ["외벽", "이동식 비계", "단부"],
      visionEvidence: "after-guardrail.jpg에서 중간난간과 출입통제선이 식별됨"
    }]));

    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({
      siteName: "성수동 외벽 도장",
      workSummary: "성수동 외벽 도장",
      hazardLabel: "작업발판 외측 추락 위험",
      photoPairAttached: true,
      sourcePhotoNames: ["before-rail-gap.jpg", "after-guardrail.jpg"]
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

  it("round-trips report status, risk association, and photo provenance together", () => {
    const parsed = parseOperationImprovements(JSON.stringify([{
      id: "improvement-cross-contract",
      createdAt: "2026-07-11T15:00:00+09:00",
      siteName: "성수동 현장",
      workSummary: "외벽 도장",
      hazardLabel: "추락",
      improvementText: "작업발판 난간을 보강하고 통제선을 설치",
      reflectedDocuments: ["위험성평가표", "TBM 브리핑"],
      status: "approved",
      riskAssociation: {
        siteName: "성수동 현장",
        process: "도장공사",
        task: "외벽 도장",
        hazard: "작업발판 단부 추락"
      },
      sourceType: "photo_analysis",
      photoHazardProvenance: {
        candidateKey: "candidate-cross-contract",
        candidateId: "candidate-1",
        source: "vision",
        provider: "openai",
        providerMode: "live",
        model: "gpt-4.1-mini",
        providerResponses: [{
          photoId: "before-photo",
          responseId: "response-1",
          model: "gpt-4.1-mini",
          createdAt: 1783753200
        }],
        evidence: [{
          sourceId: "sif-1",
          sourceType: "safeclaw-db",
          title: "외벽 작업 추락 사례",
          excerpt: "작업발판 단부에서 추락 위험이 확인됨"
        }],
        confirmedControls: [{
          text: "작업발판 난간과 하부 출입통제를 확인",
          evidenceSourceIds: ["sif-1"]
        }],
        confirmedAt: "2026-07-11T15:00:00+09:00"
      }
    }]));

    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({
      status: "approved",
      riskAssociation: {
        siteName: "성수동 현장",
        process: "도장공사",
        task: "외벽 도장",
        hazard: "작업발판 단부 추락"
      },
      photoHazardProvenance: {
        candidateKey: "candidate-cross-contract",
        providerMode: "live",
        confirmedControls: [{
          text: "작업발판 난간과 하부 출입통제를 확인",
          evidenceSourceIds: ["sif-1"]
        }]
      }
    });

    expect(operationImprovementToHarnessImprovement(parsed[0]).photoHazardProvenance)
      .toEqual(parsed[0].photoHazardProvenance);
  });
});
