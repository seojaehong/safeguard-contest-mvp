import { describe, expect, it } from "vitest";

import {
  buildImprovementAnalysisPayload,
  buildImprovementVisionPrompt,
  parseImprovementVisionOutput
} from "@/lib/photo-vision-analysis";

describe("photo vision analysis contract", () => {
  it("builds a constrained safety improvement prompt", () => {
    const prompt = buildImprovementVisionPrompt({
      taskLabel: "성수동 외벽 도장",
      hazardLabel: "추락",
      reflectedDocuments: ["위험성평가표", "TBM 브리핑"]
    });

    expect(prompt).toContain("Before/After 사진");
    expect(prompt).toContain("단정적 법적 판단");
    expect(prompt).toContain("summary, detectedHazards, observedImprovement, ocrText, reflectedDocuments");
  });

  it("parses JSON vision output into a reviewable analysis payload", () => {
    const parsed = parseImprovementVisionOutput(JSON.stringify({
      summary: "난간이 보강된 것으로 보입니다.",
      detectedHazards: ["추락"],
      observedImprovement: "작업발판 외측 난간 보강",
      ocrText: "추락주의",
      reflectedDocuments: ["위험성평가표"]
    }), { model: "gpt-4.1-mini" });

    expect(parsed.status).toBe("analyzed");
    expect(parsed.observedImprovement).toContain("난간");
    expect(parsed.ocrText).toBe("추락주의");
    expect(parsed.reflectedDocuments).toEqual(["위험성평가표"]);
  });

  it("returns failed status for non-JSON model output", () => {
    const parsed = parseImprovementVisionOutput("not-json", { model: "gpt-4.1-mini" });

    expect(parsed.status).toBe("failed");
    expect(parsed.errorMessage).toBeTruthy();
  });

  it("labels analyzed before/after payloads as vision OCR export memory", () => {
    const vision = parseImprovementVisionOutput(JSON.stringify({
      summary: "after 사진에서 난간과 통제선이 보입니다.",
      detectedHazards: ["추락", "하부 통제 미흡"],
      observedImprovement: "작업발판 외측 난간 보강",
      ocrText: "작업중 출입금지",
      reflectedDocuments: ["위험성평가표", "TBM 기록"]
    }), { model: "gpt-4.1-mini" });

    const payload = buildImprovementAnalysisPayload({
      vision,
      candidateText: "작업발판 외측 난간 보강",
      reflectedDocuments: ["위험성평가표", "TBM 기록"],
      hasBeforePhoto: true,
      hasAfterPhoto: true
    });

    expect(payload).toMatchObject({
      status: "analyzed",
      analysisMode: "vision_ocr",
      photoPairAttached: true,
      userLabel: "vision/OCR 분석 완료",
      exportable: true
    });
  });

  it("keeps photo pairs exportable even when vision is unconfigured", () => {
    const payload = buildImprovementAnalysisPayload({
      vision: {
        status: "unconfigured",
        provider: "openai",
        model: "gpt-4.1-mini",
        summary: "",
        detectedHazards: [],
        observedImprovement: "",
        ocrText: "",
        reflectedDocuments: ["위험성평가표"],
        errorMessage: "OPENAI_API_KEY가 없어 vision/OCR 분석을 건너뜁니다."
      },
      candidateText: "Before/After 사진 비교 후보",
      reflectedDocuments: ["위험성평가표"],
      hasBeforePhoto: true,
      hasAfterPhoto: true
    });

    expect(payload.analysisMode).toBe("photo_pair_unanalyzed");
    expect(payload.photoPairAttached).toBe(true);
    expect(payload.userLabel).toBe("사진쌍 저장 · vision/OCR 보류");
    expect(payload.errorMessage).toContain("OPENAI_API_KEY");
  });
});
