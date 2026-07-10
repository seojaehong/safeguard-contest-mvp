import { describe, expect, it, vi } from "vitest";

import { MAX_INPUT_HAZARD_PHOTO_FILES } from "@/lib/operation-improvements";
import {
  MAX_HAZARD_PHOTO_FILES,
  analyzeHazardPhotos,
  buildImprovementAnalysisPayload,
  buildImprovementVisionPrompt,
  buildHazardPhotoVisionPrompt,
  getPhotoVisionReadiness,
  parseHazardPhotoVisionOutput,
  parseImprovementVisionOutput
} from "@/lib/photo-vision-analysis";

function createPhoto(name: string, type: string, content = "image-bytes"): File {
  return new File([content], name, { type });
}

function createSizedPhoto(name: string, type: string, size: number): File {
  return {
    name,
    type,
    size,
    arrayBuffer: async () => new ArrayBuffer(0)
  } as unknown as File;
}

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
      maxBytesPerPhoto: 20 * 1024 * 1024,
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
      acceptedOnly: true,
      beforeAfterSupported: true,
      ocrSupported: true,
      hazardAnalysisEndpoint: "/api/input-photos/hazard-analysis",
      improvementEndpointPattern: "/api/workpacks/[id]/improvements"
    });
    expect(unconfigured.message).toContain("OPENAI_API_KEY");
    expect(unconfigured.exportTargets).toEqual(expect.arrayContaining(["작업 이력 MD", "하네스 JSONL"]));
    expect(unconfigured.flow.map((item) => item.step)).toEqual(["attach", "analyze", "ground", "review", "export"]);
    expect(unconfigured.flow.find((item) => item.step === "ground")?.detail).toContain("DB/MCP");
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
    expect(prompt).toContain("사진별로 독립 분석");
    expect(prompt).toContain("observation");
    expect(prompt).toContain("inference");
    expect(prompt).toContain("근거 확정");
    expect(prompt).toContain("조치 확정");
    expect(prompt).not.toContain("severity는 high, medium, low, review");
  });

  it("parses multi-photo hazard JSON into document candidates", () => {
    const parsed = parseHazardPhotoVisionOutput(JSON.stringify({
      summary: "작업발판 외측과 통로 적치물이 보입니다.",
      observations: [
        { kind: "visual", text: "작업면 가장자리에서 난간이 식별되지 않습니다." },
        { kind: "ocr", text: "추락주의" }
      ],
      candidates: [
        {
          label: "작업발판 외측 추락 위험",
          observation: "작업면 가장자리에서 난간이 식별되지 않습니다.",
          inference: "추락 위험 가능성이 있어 현장 확인이 필요합니다.",
          severity: "high",
          evidence: "모델이 확정했다고 주장한 근거",
          actions: ["난간을 즉시 설치"] ,
          reflectedDocuments: ["위험성평가표", "TBM 브리핑"],
          sourcePhotoNames: ["scaffold.jpg"],
          decision: "accepted"
        },
        {
          label: "통로 정리정돈 미흡",
          observation: "보행 동선 인근에 자재가 놓여 있습니다.",
          inference: "이동 중 걸림 위험 가능성이 있습니다."
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
      observation: "작업면 가장자리에서 난간이 식별되지 않습니다.",
      inference: "추락 위험 가능성이 있어 현장 확인이 필요합니다.",
      severity: "review",
      evidence: "",
      reflectedDocuments: [],
      sourcePhotoNames: ["workface.jpg", "scaffold.jpg"],
      modelRole: "hazard_candidate",
      harness: {
        authority: "safeclaw-db-mcp",
        status: "pending",
        evidence: [],
        actions: [],
        confirmedAt: null
      },
      userDecision: {
        status: "pending",
        allowed: ["accepted", "rejected"],
        requiresHarnessConfirmation: true,
        decidedAt: null
      }
    });
    expect(parsed.observations).toEqual([
      { kind: "visual", text: "작업면 가장자리에서 난간이 식별되지 않습니다." },
      { kind: "ocr", text: "추락주의" }
    ]);
    expect(parsed.siteSignals).toEqual(["외벽", "비계", "통로"]);
  });

  it("accepts fenced hazard JSON returned by vision models", () => {
    const parsed = parseHazardPhotoVisionOutput(`\`\`\`json
{
      "summary": "사진에서 개구부와 추락주의 문구가 확인됩니다.",
      "observations": [{"kind":"visual","text":"개구부 가장자리 일부가 열려 보입니다."}],
      "candidates": [
        {
          "label": "개구부 주변 추락 위험",
          "observation": "개구부 가장자리 일부가 열려 보입니다.",
          "inference": "추락 위험 가능성이 있어 현장 확인이 필요합니다."
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

  it("drops hazard candidates that do not separate observation and inference", () => {
    const parsed = parseHazardPhotoVisionOutput(JSON.stringify({
      summary: "보완 확인 필요",
      candidates: [
        {
          label: "보호구 착용 확인",
          inference: "작업자 보호구 상태를 현장에서 확인해야 합니다."
        }
      ]
    }), { model: "gpt-4.1-mini", photoNames: ["worker.jpg"] });

    expect(parsed.status).toBe("analyzed");
    expect(parsed.candidates).toEqual([]);
  });

  it("analyzes each valid image independently and preserves partial failures", async () => {
    const provider = {
      name: "contract-stub",
      model: "vision-contract-v1",
      mode: "mock" as const,
      analyze: vi.fn(async ({ photo }: { photo: File; prompt: string }) => {
        if (photo.name === "provider-failure.png") throw new Error("fixture provider failure");
        return JSON.stringify({
          summary: `${photo.name} 관찰 완료`,
          observations: [{ kind: "visual", text: "개구부 가장자리에 난간이 보이지 않습니다." }],
          candidates: [{
            label: "개구부 추락 위험 후보",
            observation: "개구부 가장자리에 난간이 보이지 않습니다.",
            inference: "추락 위험 가능성이 있습니다.",
            evidence: "모델 임의 근거",
            actions: ["모델 임의 조치"],
            decision: "accepted"
          }],
          ocrText: "추락주의",
          siteSignals: ["개구부"]
        });
      })
    };
    const harness = {
      name: "safeclaw-db-mcp",
      resolve: vi.fn(async ({ candidates }: { candidates: Array<{ id: string }> }) => candidates.map((candidate) => ({
        candidateId: candidate.id,
        status: "confirmed" as const,
        evidence: [{
          sourceId: "kosha-open-edge",
          sourceType: "safeclaw-db" as const,
          title: "개구부 추락 예방",
          excerpt: "개구부 방호 조치 확인"
        }],
        actions: [{
          text: "개구부 덮개 또는 안전난간 상태를 현장에서 확인합니다.",
          evidenceSourceIds: ["kosha-open-edge"]
        }],
        confirmedAt: "2026-07-11T00:00:00.000Z",
        errorMessage: null
      })))
    };

    const analysis = await analyzeHazardPhotos({
      question: "옥상 방수 작업",
      photos: [
        createPhoto("open-edge.jpg", "image/jpeg"),
        createPhoto("provider-failure.png", "image/png"),
        createPhoto("notes.txt", "text/plain")
      ]
    }, { provider, harness });

    expect(provider.analyze).toHaveBeenCalledTimes(2);
    expect(harness.resolve).toHaveBeenCalledTimes(1);
    expect(analysis).toMatchObject({
      status: "partial",
      provider: "contract-stub",
      providerMode: "mock",
      model: "vision-contract-v1",
      photoCount: 3,
      counts: {
        submitted: 3,
        analyzed: 1,
        rejected: 1,
        failed: 1,
        unconfigured: 0,
        candidates: 1,
        harnessConfirmed: 1,
        harnessInsufficient: 0
      }
    });
    expect(analysis.images.map((image) => image.status)).toEqual(["analyzed", "failed", "rejected"]);
    expect(analysis.images[2]?.error).toMatchObject({ code: "unsupported_mime", retryable: false });
    expect(analysis.candidates[0]).toMatchObject({
      id: "photo-1-candidate-1",
      observation: "개구부 가장자리에 난간이 보이지 않습니다.",
      inference: "추락 위험 가능성이 있습니다.",
      severity: "review",
      evidence: "",
      reflectedDocuments: [],
      modelRole: "hazard_candidate",
      harness: {
        authority: "safeclaw-db-mcp",
        status: "confirmed",
        evidence: [{ sourceId: "kosha-open-edge", sourceType: "safeclaw-db" }],
        actions: [{
          text: "개구부 덮개 또는 안전난간 상태를 현장에서 확인합니다.",
          evidenceSourceIds: ["kosha-open-edge"]
        }],
        confirmedAt: "2026-07-11T00:00:00.000Z",
        errorMessage: null
      },
      userDecision: {
        status: "pending",
        allowed: ["accepted", "rejected"],
        requiresHarnessConfirmation: true,
        decidedAt: null
      }
    });
  });

  it("rejects empty and oversized images before calling the provider", async () => {
    const provider = {
      name: "contract-stub",
      model: "vision-contract-v1",
      mode: "mock" as const,
      analyze: vi.fn(async () => "{}")
    };

    const analysis = await analyzeHazardPhotos({
      question: "점검",
      photos: [
        createSizedPhoto("empty.jpg", "image/jpeg", 0),
        createSizedPhoto("oversized.webp", "image/webp", 20 * 1024 * 1024 + 1)
      ]
    }, { provider, harness: null });

    expect(provider.analyze).not.toHaveBeenCalled();
    expect(analysis.status).toBe("failed");
    expect(analysis.images.map((image) => image.error?.code)).toEqual(["empty_file", "file_too_large"]);
  });

  it("returns an explicit unconfigured result without an external API key", async () => {
    const analysis = await analyzeHazardPhotos({
      question: "점검",
      photos: [createPhoto("workface.jpg", "image/jpeg")]
    }, { provider: null, harness: null });

    expect(analysis.status).toBe("unconfigured");
    expect(analysis.providerMode).toBe("unconfigured");
    expect(analysis.images[0]).toMatchObject({
      status: "unconfigured",
      error: { code: "provider_unconfigured", retryable: true }
    });
  });

  it("refuses batches over ten images without silently truncating them", async () => {
    const provider = {
      name: "contract-stub",
      model: "vision-contract-v1",
      mode: "mock" as const,
      analyze: vi.fn(async () => "{}")
    };
    const photos = Array.from({ length: 11 }, (_, index) => createPhoto(`photo-${index + 1}.jpg`, "image/jpeg"));

    const analysis = await analyzeHazardPhotos({ question: "점검", photos }, { provider, harness: null });

    expect(provider.analyze).not.toHaveBeenCalled();
    expect(analysis.status).toBe("failed");
    expect(analysis.photoCount).toBe(11);
    expect(analysis.errorMessage).toContain("10");
  });

  it("keeps candidates but blocks harness confirmation when DB or MCP resolution fails", async () => {
    const provider = {
      name: "contract-stub",
      model: "vision-contract-v1",
      mode: "mock" as const,
      analyze: vi.fn(async () => JSON.stringify({
        observations: [{ kind: "visual", text: "작업자 주변에 차량이 보입니다." }],
        candidates: [{
          label: "차량과 작업자 충돌 위험 후보",
          observation: "작업자 주변에 차량이 보입니다.",
          inference: "동선 중첩 가능성을 현장에서 확인해야 합니다."
        }]
      }))
    };
    const harness = {
      name: "safeclaw-db-mcp",
      resolve: vi.fn(async () => {
        throw new Error("fixture harness unavailable");
      })
    };

    const analysis = await analyzeHazardPhotos({
      question: "자재 반입 작업",
      photos: [createPhoto("vehicle.jpg", "image/jpeg")]
    }, { provider, harness });

    expect(analysis.status).toBe("analyzed");
    expect(analysis.harness.status).toBe("insufficient");
    expect(analysis.candidates[0]).toMatchObject({
      harness: {
        status: "insufficient",
        evidence: [],
        actions: [],
        errorMessage: "fixture harness unavailable"
      },
      userDecision: {
        status: "pending",
        requiresHarnessConfirmation: true
      }
    });
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
      hasAfterPhoto: true,
      sourcePhotoNames: ["before-scaffold.jpg", "after-guardrail.jpg"]
    });

    expect(payload).toMatchObject({
      status: "analyzed",
      analysisMode: "vision_ocr",
      photoPairAttached: true,
      userLabel: "vision/OCR 분석 완료",
      exportable: true,
      sourcePhotoNames: ["before-scaffold.jpg", "after-guardrail.jpg"],
      photoCount: 2,
      visionEvidence: "after 사진에서 난간과 통제선이 보입니다."
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
      hasAfterPhoto: true,
      sourcePhotoNames: ["before.jpg", "after.jpg"]
    });

    expect(payload.analysisMode).toBe("photo_pair_unanalyzed");
    expect(payload.photoPairAttached).toBe(true);
    expect(payload.userLabel).toBe("사진쌍 저장 · vision/OCR 보류");
    expect(payload.sourcePhotoNames).toEqual(["before.jpg", "after.jpg"]);
    expect(payload.photoCount).toBe(2);
    expect(payload.errorMessage).toContain("OPENAI_API_KEY");
  });
});
