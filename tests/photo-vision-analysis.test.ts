import { describe, expect, it } from "vitest";

import {
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
});
