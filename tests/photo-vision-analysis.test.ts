import { describe, expect, it } from "vitest";

import { MAX_INPUT_HAZARD_PHOTO_FILES } from "@/lib/operation-improvements";
import {
  MAX_HAZARD_PHOTO_FILES,
  buildImprovementAnalysisPayload,
  buildImprovementVisionPrompt,
  buildHazardPhotoVisionPrompt,
  getPhotoVisionReadiness,
  parseHazardPhotoVisionOutput,
  parseImprovementVisionOutput
} from "@/lib/photo-vision-analysis";

describe("photo vision analysis contract", () => {
  it("reports readiness and the accepted-only harness flow for input photos", () => {
    const unconfigured = getPhotoVisionReadiness({
      OPENAI_API_KEY: "",
      OPENAI_VISION_MODEL: "gpt-4.1-mini"
    });
    const ready = getPhotoVisionReadiness({
      OPENAI_API_KEY: "sk-test",
      OPENAI_VISION_MODEL: "gpt-4.1-mini"
    });

    expect(unconfigured).toMatchObject({
      ok: false,
      status: "unconfigured",
      maxInputPhotos: 10,
      acceptedOnly: true,
      beforeAfterSupported: true,
      ocrSupported: true,
      hazardAnalysisEndpoint: "/api/input-photos/hazard-analysis",
      improvementEndpointPattern: "/api/workpacks/[id]/improvements"
    });
    expect(unconfigured.message).toContain("OPENAI_API_KEY");
    expect(unconfigured.exportTargets).toEqual(expect.arrayContaining(["작업 이력 MD", "하네스 JSONL"]));
    expect(unconfigured.flow.map((item) => item.step)).toEqual(["attach", "analyze", "accept", "export"]);
    expect(ready).toMatchObject({
      ok: true,
      status: "ready",
      model: "gpt-4.1-mini"
    });
  });

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

  it("builds a constrained multi-photo hazard prompt", () => {
    const prompt = buildHazardPhotoVisionPrompt({
      question: "성수동 외벽 도장, 작업자 5명, 오후 강풍",
      photoNames: ["workface.jpg", "scaffold.jpg"]
    });

    expect(MAX_HAZARD_PHOTO_FILES).toBe(MAX_INPUT_HAZARD_PHOTO_FILES);
    expect(MAX_HAZARD_PHOTO_FILES).toBe(10);
    expect(prompt).toContain("현장 사진들을 서로 비교");
    expect(prompt).toContain("사진 파일명(2장): workface.jpg, scaffold.jpg");
    expect(prompt).toContain("후보는 최대 8개");
    expect(prompt).toContain("severity는 high, medium, low, review");
  });

  it("parses multi-photo hazard JSON into document candidates", () => {
    const parsed = parseHazardPhotoVisionOutput(JSON.stringify({
      summary: "작업발판 외측과 통로 적치물이 보입니다.",
      candidates: [
        {
          label: "작업발판 외측 추락 위험",
          detail: "외벽 도장 작업면 가장자리의 난간 상태를 현장 확인해야 합니다.",
          severity: "high",
          evidence: "scaffold.jpg에서 작업면 가장자리가 노출되어 보임",
          reflectedDocuments: ["위험성평가표", "TBM 브리핑"],
          sourcePhotoNames: ["scaffold.jpg"]
        },
        {
          label: "통로 정리정돈 미흡",
          detail: "자재가 보행 동선 근처에 있어 이동 중 걸림 위험을 확인해야 합니다.",
          severity: "medium",
          evidence: "workface.jpg의 통로 적치물",
          reflectedDocuments: ["TBM 기록"],
          sourcePhotoNames: ["workface.jpg"]
        }
      ],
      ocrText: "추락주의",
      siteSignals: ["외벽", "비계", "통로"]
    }), { model: "gpt-4.1-mini", photoNames: ["workface.jpg", "scaffold.jpg"] });

    expect(parsed.status).toBe("analyzed");
    expect(parsed.photoCount).toBe(2);
    expect(parsed.candidates).toHaveLength(2);
    expect(parsed.candidates[0]).toMatchObject({
      label: "작업발판 외측 추락 위험",
      severity: "high",
      reflectedDocuments: ["위험성평가표", "TBM 브리핑"],
      sourcePhotoNames: ["scaffold.jpg"]
    });
    expect(parsed.siteSignals).toEqual(["외벽", "비계", "통로"]);
  });

  it("accepts fenced hazard JSON returned by vision models", () => {
    const parsed = parseHazardPhotoVisionOutput(`\`\`\`json
{
  "summary": "사진에서 개구부와 추락주의 문구가 확인됩니다.",
  "candidates": [
    {
      "label": "개구부 주변 추락 위험",
      "detail": "개구부 주변 임시 난간과 통제선 상태를 확인해야 합니다.",
      "severity": "high",
      "evidence": "사진의 OPEN EDGE 표기와 추락주의 문구",
      "reflectedDocuments": ["위험성평가표", "TBM 브리핑"],
      "sourcePhotoNames": ["hazard-photo-smoke.png"]
    }
  ],
  "ocrText": "FALL HAZARD / 추락주의",
  "siteSignals": ["개구부", "추락주의"]
}
\`\`\``, { model: "gpt-4.1-mini", photoNames: ["hazard-photo-smoke.png"] });

    expect(parsed.status).toBe("analyzed");
    expect(parsed.candidates[0]?.label).toBe("개구부 주변 추락 위험");
    expect(parsed.ocrText).toContain("추락주의");
  });

  it("falls back to review severity and file names for incomplete hazard candidates", () => {
    const parsed = parseHazardPhotoVisionOutput(JSON.stringify({
      summary: "보완 확인 필요",
      candidates: [
        {
          label: "보호구 착용 확인",
          detail: "작업자 보호구 상태를 현장에서 확인해야 합니다.",
          severity: "certain"
        }
      ]
    }), { model: "gpt-4.1-mini", photoNames: ["worker.jpg"] });

    expect(parsed.status).toBe("analyzed");
    expect(parsed.candidates[0]?.severity).toBe("review");
    expect(parsed.candidates[0]?.sourcePhotoNames).toEqual(["worker.jpg"]);
  });

  it("returns failed status for non-JSON hazard model output", () => {
    const parsed = parseHazardPhotoVisionOutput("not-json", {
      model: "gpt-4.1-mini",
      photoNames: ["workface.jpg"]
    });

    expect(parsed.status).toBe("failed");
    expect(parsed.photoCount).toBe(1);
    expect(parsed.errorMessage).toBeTruthy();
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

  it("accepts fenced before/after improvement JSON", () => {
    const parsed = parseImprovementVisionOutput(`\`\`\`json
{
  "summary": "after 사진에서 통제선이 추가된 것으로 보입니다.",
  "detectedHazards": ["출입통제 미흡"],
  "observedImprovement": "작업구역 통제선 설치",
  "ocrText": "출입금지",
  "reflectedDocuments": ["TBM 기록"]
}
\`\`\``, { model: "gpt-4.1-mini" });

    expect(parsed.status).toBe("analyzed");
    expect(parsed.observedImprovement).toContain("통제선");
    expect(parsed.reflectedDocuments).toEqual(["TBM 기록"]);
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
