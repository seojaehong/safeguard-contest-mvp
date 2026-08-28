import { describe, expect, it, vi } from "vitest";

import { MAX_INPUT_HAZARD_PHOTO_FILES } from "@/lib/operation-improvements";
import { transitionHazardPhotoUserDecision } from "@/lib/photo-vision-analysis-policy";
import { searchSafetyReferences, type SafetyReferenceItem } from "@/lib/safety-reference-catalog";
import {
  HAZARD_PHOTO_FILE_VALIDATION,
  HAZARD_PHOTO_MIME_TYPES,
  MAX_HAZARD_PHOTO_BYTES,
  MAX_HAZARD_PHOTO_FILES,
  analyzeHazardPhotos,
  buildImprovementAnalysisPayload,
  buildImprovementVisionPrompt,
  buildHazardPhotoVisionPrompt,
  createOpenAiHazardPhotoVisionProvider,
  getPhotoVisionReadiness,
  parseHazardPhotoVisionOutput,
  parseImprovementVisionOutput,
  validateHazardPhotoFile
} from "@/lib/photo-vision-analysis";

vi.mock("@/lib/safety-reference-catalog", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/safety-reference-catalog")>();
  return {
    ...actual,
    searchSafetyReferences: vi.fn()
  };
});

function photoBytes(values: number[]): ArrayBuffer {
  return Uint8Array.from(values).buffer as ArrayBuffer;
}

const PHOTO_BYTES: Record<string, ArrayBuffer> = {
  "image/jpeg": photoBytes([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]),
  "image/png": photoBytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  "image/webp": photoBytes([0x52, 0x49, 0x46, 0x46, 0x04, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]),
  "image/gif": photoBytes([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])
};

const EXACT_D_C_7_ID = "technical-support-01-0073-d-c-7-2026-비계-구조-및-안전작업에-관한-기술지원규정";

function createPhoto(name: string, type: string, content?: BlobPart): File {
  return new File([content ?? PHOTO_BYTES[type] ?? "not-an-image"], name, { type });
}

function createSizedPhoto(name: string, type: string, size: number): File {
  return {
    name,
    type,
    size,
    arrayBuffer: async () => new ArrayBuffer(0)
  } as unknown as File;
}

function safetyReference(input: {
  id: string;
  title: string;
  keywords: string[];
  riskTags: string[];
  controls: string[];
}): SafetyReferenceItem {
  return {
    id: input.id,
    source_id: `${input.id}-source`,
    item_type: "guideline",
    category: "construction",
    subcategory: null,
    title: input.title,
    summary: `${input.title} 현장 안전 참고자료`,
    keywords: input.keywords,
    risk_tags: input.riskTags,
    primary_documents: ["위험성평가표", "TBM 브리핑", "TBM 기록"],
    controls: input.controls,
    source_url: `https://safety.example/${input.id}`,
    evidence_role: "direct",
    retrieval_source: "ranked"
  };
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
      maxBytesPerPhoto: 10 * 1024 * 1024,
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
      fileValidation: {
        mode: "signature_only",
        decodesPixels: false,
        signatureBytes: 12
      },
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
      model: "gpt-4.1-mini",
      fileValidation: {
        mode: "signature_only",
        decodesPixels: false
      }
    });
  });

  it("preserves the actual OpenAI response id and model", async () => {
    const actualModel = "gpt-4.1-mini-2026-06-01";
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      id: "resp_vision_actual",
      model: actualModel,
      created_at: 1_783_500_000,
      output_text: JSON.stringify({
        summary: "비계 작업면이 보입니다.",
        observations: [{ kind: "visual", text: "비계 작업면 가장자리가 보입니다." }],
        candidates: [{
          label: "비계 작업면 추락 위험 후보",
          observation: "비계 작업면 가장자리가 보입니다.",
          inference: "추락 가능성을 현장에서 확인합니다."
        }],
        ocrText: "",
        siteSignals: ["비계"]
      })
    }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    try {
      const provider = createOpenAiHazardPhotoVisionProvider({
        OPENAI_API_KEY: "sk-contract",
        OPENAI_VISION_MODEL: "gpt-configured-model"
      });
      if (!provider) throw new Error("Expected configured provider");

      const analysis = await analyzeHazardPhotos({
        question: "비계 작업",
        photos: [createPhoto("scaffold.jpg", "image/jpeg")]
      }, { provider, harness: null });

      expect(analysis.model).toBe(actualModel);
      expect(analysis.providerResponses).toEqual([{
        photoId: "photo-1",
        responseId: "resp_vision_actual",
        model: actualModel,
        createdAt: 1_783_500_000
      }]);
      expect(analysis.images[0]?.providerResponse).toMatchObject({
        responseId: "resp_vision_actual",
        model: actualModel
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("aborts the OpenAI fetch when the caller disconnects", async () => {
    const controller = new AbortController();
    let fetchSignal: AbortSignal | null | undefined;
    const fetchMock = vi.fn((_input: string | URL | Request, init?: RequestInit) => {
      fetchSignal = init?.signal;
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    try {
      const provider = createOpenAiHazardPhotoVisionProvider({
        OPENAI_API_KEY: "sk-contract",
        OPENAI_VISION_MODEL: "gpt-configured-model"
      });
      if (!provider) throw new Error("Expected configured provider");

      const pending = analyzeHazardPhotos({
        question: "비계 작업",
        photos: [createPhoto("scaffold.jpg", "image/jpeg")]
      }, { provider, harness: null, signal: controller.signal });

      await vi.waitFor(() => expect(fetchSignal).toBeInstanceOf(AbortSignal));
      controller.abort(new DOMException("client disconnected", "AbortError"));

      await expect(pending).rejects.toMatchObject({ name: "AbortError" });
      expect(fetchSignal?.aborted).toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("fails a photo analysis when the provider response exceeds its byte budget", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", {
      headers: { "content-length": String(2 * 1024 * 1024 + 1) },
    })));
    try {
      const provider = createOpenAiHazardPhotoVisionProvider({
        OPENAI_API_KEY: "sk-contract",
        OPENAI_VISION_MODEL: "gpt-configured-model"
      });
      if (!provider) throw new Error("Expected configured provider");

      const analysis = await analyzeHazardPhotos({
        question: "비계 작업",
        photos: [createPhoto("scaffold.jpg", "image/jpeg")]
      }, { provider, harness: null });

      expect(analysis.images[0]?.status).toBe("failed");
      expect(analysis.images[0]?.error?.message).toContain("2097152-byte response limit");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("does not return raw upstream error bodies to photo analysis clients", async () => {
    const rawProviderBody = "upstream request rejected: tenant-secret-debug-context";
    vi.stubGlobal("fetch", vi.fn(async () => new Response(rawProviderBody, { status: 429 })));
    try {
      const provider = createOpenAiHazardPhotoVisionProvider({
        OPENAI_API_KEY: "sk-contract",
        OPENAI_VISION_MODEL: "gpt-configured-model"
      });
      if (!provider) throw new Error("Expected configured provider");

      const analysis = await analyzeHazardPhotos({
        question: "비계 작업",
        photos: [createPhoto("scaffold.jpg", "image/jpeg")]
      }, { provider, harness: null });

      expect(analysis.images[0]?.error).toMatchObject({
        code: "provider_error",
        retryable: true
      });
      expect(analysis.images[0]?.error?.message).toMatch(
        /^Photo vision provider request failed\. Reference: [0-9a-f-]{36}$/u
      );
      expect(analysis.images[0]?.error?.message).not.toContain(rawProviderBody);
      expect(analysis.errorMessage).not.toContain(rawProviderBody);
    } finally {
      vi.unstubAllGlobals();
    }
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
    expect(prompt).toContain("허용 필드 외 추가 필드");
    expect(prompt).toContain("summary 500자");
    expect(prompt).toContain("summary와 siteSignals");
    expect(prompt).toContain("통제·법적 근거 주장");
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
          inference: "추락 위험 가능성이 있어 현장 확인이 필요합니다."
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
        confirmedControls: [],
        confirmedAt: null
      },
      userDecision: {
        status: "pending",
        allowed: ["rejected"],
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

  it("rejects hazard output that does not contain valid observations and candidates", () => {
    const parsed = parseHazardPhotoVisionOutput(JSON.stringify({
      summary: "보완 확인 필요",
      candidates: [
        {
          label: "보호구 착용 확인",
          inference: "작업자 보호구 상태를 현장에서 확인해야 합니다."
        }
      ]
    }), { model: "gpt-4.1-mini", photoNames: ["worker.jpg"] });

    expect(parsed.status).toBe("failed");
    expect(parsed.candidates).toEqual([]);
    expect(parsed.errorMessage).toContain("observations");
  });

  it("does not mark an empty provider JSON object as analyzed", () => {
    const parsed = parseHazardPhotoVisionOutput("{}", {
      model: "gpt-4.1-mini",
      photoNames: ["worker.jpg"]
    });

    expect(parsed.status).toBe("failed");
    expect(parsed.candidates).toEqual([]);
  });

  it.each(["actions", "evidence", "controls", "legalClaim"])(
    "rejects model authority field %s instead of silently accepting it",
    (field) => {
      const parsed = parseHazardPhotoVisionOutput(JSON.stringify({
        summary: "작업면 가장자리가 열려 보입니다.",
        observations: [{ kind: "visual", text: "작업면 가장자리가 열려 보입니다." }],
        candidates: [{
          label: "작업면 추락 위험 후보",
          observation: "작업면 가장자리가 열려 보입니다.",
          inference: "추락 위험 가능성을 현장에서 확인해야 합니다.",
          [field]: field === "actions" || field === "controls" ? ["난간 설치"] : "법적 근거 주장"
        }],
        ocrText: "",
        siteSignals: ["작업면"]
      }), { model: "gpt-4.1-mini", photoNames: ["worker.jpg"] });

      expect(parsed.status).toBe("failed");
      expect(parsed.errorMessage).toContain(field);
    }
  );

  it("rejects provider output with more than four hazard candidates", () => {
    const parsed = parseHazardPhotoVisionOutput(JSON.stringify({
      summary: "여러 위험 후보가 보입니다.",
      observations: [{ kind: "visual", text: "작업 구역에 여러 설비가 보입니다." }],
      candidates: Array.from({ length: 5 }, (_, index) => ({
        label: `위험 후보 ${index + 1}`,
        observation: "작업 구역에 여러 설비가 보입니다.",
        inference: `위험 가능성 ${index + 1}을 현장에서 확인해야 합니다.`
      })),
      ocrText: "",
      siteSignals: ["작업 구역"]
    }), { model: "gpt-4.1-mini", photoNames: ["worker.jpg"] });

    expect(parsed.status).toBe("failed");
    expect(parsed.errorMessage).toContain("at most 4");
  });

  it("rejects provider strings that exceed the bounded hazard schema", () => {
    const base = {
      summary: "작업 구역 가장자리가 보입니다.",
      observations: [{ kind: "visual", text: "작업 구역 가장자리가 보입니다." }],
      candidates: [{
        label: "작업면 위험 후보",
        observation: "작업 구역 가장자리가 보입니다.",
        inference: "추락 가능성을 현장에서 확인해야 합니다."
      }],
      ocrText: "",
      siteSignals: ["작업면"]
    };
    const oversizedPayloads = [
      { ...base, summary: "s".repeat(501) },
      { ...base, observations: [{ kind: "visual", text: "o".repeat(501) }] },
      { ...base, candidates: [{ ...base.candidates[0], label: "l".repeat(161) }] },
      { ...base, candidates: [{ ...base.candidates[0], inference: "i".repeat(501) }] },
      { ...base, ocrText: "t".repeat(2_001) },
      { ...base, siteSignals: ["g".repeat(121)] }
    ];

    const results = oversizedPayloads.map((payload) => parseHazardPhotoVisionOutput(
      JSON.stringify(payload),
      { model: "gpt-4.1-mini", photoNames: ["worker.jpg"] }
    ));

    expect(results.every((result) => result.status === "failed")).toBe(true);
    expect(results.every((result) => result.errorMessage?.includes("maximum"))).toBe(true);
  });

  it.each([
    { summary: "산업안전보건법 제42조 위반입니다.", siteSignals: ["작업면"] },
    { summary: "안전난간을 즉시 설치해야 합니다.", siteSignals: ["작업면"] },
    { summary: "작업면 가장자리가 열려 보입니다.", siteSignals: ["KOSHA 근거 확인"] },
    { summary: "작업면 가장자리가 열려 보입니다.", siteSignals: ["난간 설치 필요"] }
  ])("rejects control or legal-authority claims in summary and site signals", ({ summary, siteSignals }) => {
    const parsed = parseHazardPhotoVisionOutput(JSON.stringify({
      summary,
      observations: [{ kind: "visual", text: "작업면 가장자리가 열려 보입니다." }],
      candidates: [{
        label: "작업면 추락 위험 후보",
        observation: "작업면 가장자리가 열려 보입니다.",
        inference: "추락 위험 가능성을 현장에서 확인해야 합니다."
      }],
      ocrText: "",
      siteSignals
    }), { model: "gpt-4.1-mini", photoNames: ["worker.jpg"] });

    expect(parsed.status).toBe("failed");
    expect(parsed.errorMessage).toContain("candidate-only");
  });

  it("rejects a control recommendation hidden in candidate inference", () => {
    const parsed = parseHazardPhotoVisionOutput(JSON.stringify({
      summary: "작업면 가장자리가 열려 보입니다.",
      observations: [{ kind: "visual", text: "작업면 가장자리가 열려 보입니다." }],
      candidates: [{
        label: "작업면 추락 위험 후보",
        observation: "작업면 가장자리가 열려 보입니다.",
        inference: "안전난간을 즉시 설치해야 합니다."
      }],
      ocrText: "",
      siteSignals: ["작업면"]
    }), { model: "gpt-4.1-mini", photoNames: ["worker.jpg"] });

    expect(parsed.status).toBe("failed");
    expect(parsed.errorMessage).toContain("candidate-only");
  });

  it("rejects instructions in every non-OCR observation field but preserves literal OCR", () => {
    const base = {
      summary: "작업면 가장자리가 보입니다.",
      observations: [{ kind: "visual", text: "작업면 가장자리가 보입니다." }],
      candidates: [{
        label: "작업면 추락 위험 후보",
        observation: "작업면 가장자리가 보입니다.",
        inference: "추락 가능성을 현장에서 확인합니다."
      }],
      ocrText: "",
      siteSignals: ["작업면"]
    };
    const visualInstruction = parseHazardPhotoVisionOutput(JSON.stringify({
      ...base,
      observations: [{ kind: "visual", text: "안전난간을 즉시 설치해야 합니다." }]
    }), { model: "gpt-4.1-mini", photoNames: ["visual.jpg"] });
    const candidateObservationInstruction = parseHazardPhotoVisionOutput(JSON.stringify({
      ...base,
      candidates: [{
        ...base.candidates[0],
        observation: "안전난간을 즉시 설치해야 합니다."
      }]
    }), { model: "gpt-4.1-mini", photoNames: ["candidate.jpg"] });
    const literalOcr = parseHazardPhotoVisionOutput(JSON.stringify({
      ...base,
      observations: [{ kind: "ocr", text: "안전난간을 즉시 설치해야 합니다." }],
      ocrText: "안전난간을 즉시 설치해야 합니다."
    }), { model: "gpt-4.1-mini", photoNames: ["sign.jpg"] });

    expect(visualInstruction.status).toBe("failed");
    expect(candidateObservationInstruction.status).toBe("failed");
    expect(literalOcr.status).toBe("analyzed");
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
            inference: "추락 위험 가능성이 있습니다."
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
        confirmedControls: [{
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
        confirmedControls: [{
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

  it("bounds concurrent provider calls while preserving image order", async () => {
    let active = 0;
    let maximumActive = 0;
    const provider = {
      name: "contract-stub",
      model: "vision-contract-v1",
      mode: "mock" as const,
      analyze: vi.fn(async ({ photoIndex }: { photoIndex: number }) => {
        active += 1;
        maximumActive = Math.max(maximumActive, active);
        await new Promise<void>((resolve) => setTimeout(resolve, 10));
        active -= 1;
        return JSON.stringify({
          summary: `사진 ${photoIndex + 1} 관찰`,
          observations: [{ kind: "visual", text: `비계 ${photoIndex + 1}번 구역이 보입니다.` }],
          candidates: [{
            label: `비계 ${photoIndex + 1}번 구역 추락 위험 후보`,
            observation: `비계 ${photoIndex + 1}번 구역이 보입니다.`,
            inference: "추락 가능성을 현장에서 확인합니다."
          }],
          ocrText: "",
          siteSignals: ["비계"]
        });
      })
    };
    const photos = Array.from({ length: 5 }, (_, index) => (
      createPhoto(`scaffold-${index + 1}.jpg`, "image/jpeg")
    ));

    const analysis = await analyzeHazardPhotos({ question: "비계 점검", photos }, { provider, harness: null });

    expect(maximumActive).toBeLessThanOrEqual(2);
    expect(analysis.images.map((image) => image.name)).toEqual(photos.map((photo) => photo.name));
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
        createSizedPhoto("oversized.webp", "image/webp", 10 * 1024 * 1024 + 1)
      ]
    }, { provider, harness: null });

    expect(provider.analyze).not.toHaveBeenCalled();
    expect(analysis.status).toBe("failed");
    expect(analysis.images.map((image) => image.error?.code)).toEqual(["empty_file", "file_too_large"]);
  });

  it("rejects an oversized aggregate before reading images or calling the provider", async () => {
    const provider = {
      name: "contract-stub",
      model: "vision-contract-v1",
      mode: "mock" as const,
      analyze: vi.fn(async () => "{}")
    };
    const photos = [
      createSizedPhoto("one.jpg", "image/jpeg", 15 * 1024 * 1024),
      createSizedPhoto("two.jpg", "image/jpeg", 15 * 1024 * 1024),
      createSizedPhoto("three.jpg", "image/jpeg", 15 * 1024 * 1024)
    ];

    const analysis = await analyzeHazardPhotos({ question: "점검", photos }, { provider, harness: null });

    expect(analysis.status).toBe("failed");
    expect(analysis.images).toEqual([]);
    expect(analysis.errorMessage).toContain("합계 용량");
    expect(provider.analyze).not.toHaveBeenCalled();
  });

  it("rejects storage-incompatible GIF and mismatched JPEG files before provider analysis", async () => {
    const provider = {
      name: "contract-stub",
      model: "vision-contract-v1",
      mode: "mock" as const,
      analyze: vi.fn(async () => JSON.stringify({
        summary: "작업 구역 표지가 보입니다.",
        observations: [{ kind: "visual", text: "작업 구역 표지가 보입니다." }],
        candidates: [{
          label: "작업 구역 확인 후보",
          observation: "작업 구역 표지가 보입니다.",
          inference: "표지 주변 위험요인을 현장에서 확인해야 합니다."
        }],
        ocrText: "",
        siteSignals: ["작업 구역"]
      }))
    };

    const analysis = await analyzeHazardPhotos({
      question: "현장 점검",
      photos: [
        createPhoto("authentic.gif", "image/gif"),
        createPhoto("spoofed.jpg", "image/jpeg", PHOTO_BYTES["image/png"])
      ]
    }, { provider, harness: null });

    expect(provider.analyze).not.toHaveBeenCalled();
    expect(analysis.status).toBe("failed");
    expect(analysis.images.map((image) => image.error?.code)).toEqual(["unsupported_mime", "invalid_signature"]);
  });

  it("keeps analysis limits aligned with the commercial photo bucket contract", () => {
    expect(MAX_HAZARD_PHOTO_BYTES).toBe(10_485_760);
    expect(HAZARD_PHOTO_MIME_TYPES).toEqual(["image/jpeg", "image/png", "image/webp"]);
    expect(HAZARD_PHOTO_FILE_VALIDATION.description).toContain("JPEG/PNG/WebP");
    expect(HAZARD_PHOTO_FILE_VALIDATION.description).not.toContain("GIF");
  });

  it("isolates signature read failures to the affected image", async () => {
    const provider = {
      name: "contract-stub",
      model: "vision-contract-v1",
      mode: "mock" as const,
      analyze: vi.fn(async () => JSON.stringify({
        summary: "작업 구역이 보입니다.",
        observations: [{ kind: "visual", text: "작업 구역이 보입니다." }],
        candidates: [{
          label: "작업 구역 위험 후보",
          observation: "작업 구역이 보입니다.",
          inference: "현장 위험 가능성을 확인해야 합니다."
        }],
        ocrText: "",
        siteSignals: ["작업 구역"]
      }))
    };
    const unreadablePhoto = {
      name: "unreadable.png",
      type: "image/png",
      size: 8,
      slice: () => ({
        arrayBuffer: async () => {
          throw new Error("fixture read failure");
        }
      })
    } as unknown as File;

    const analysis = await analyzeHazardPhotos({
      question: "현장 점검",
      photos: [createPhoto("readable.jpg", "image/jpeg"), unreadablePhoto]
    }, { provider, harness: null });

    expect(provider.analyze).toHaveBeenCalledTimes(1);
    expect(analysis.status).toBe("partial");
    expect(analysis.images[1]?.error).toMatchObject({
      code: "invalid_signature",
      retryable: false
    });
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
        confirmedControls: [],
        errorMessage: "fixture harness unavailable"
      },
      userDecision: {
        status: "pending",
        allowed: ["rejected"],
        requiresHarnessConfirmation: true
      }
    });
  });

  it("clears unconfirmed evidence and controls and blocks acceptance for insufficient candidates", async () => {
    const provider = {
      name: "contract-stub",
      model: "vision-contract-v1",
      mode: "mock" as const,
      analyze: vi.fn(async () => JSON.stringify({
        summary: "작업자 주변에 차량이 보입니다.",
        observations: [{ kind: "visual", text: "작업자 주변에 차량이 보입니다." }],
        candidates: [{
          label: "차량과 작업자 충돌 위험 후보",
          observation: "작업자 주변에 차량이 보입니다.",
          inference: "동선 중첩 가능성을 현장에서 확인해야 합니다."
        }],
        ocrText: "",
        siteSignals: ["차량", "작업자"]
      }))
    };
    const harness = {
      name: "safeclaw-db-mcp",
      resolve: vi.fn(async ({ candidates }: { candidates: Array<{ id: string }> }) => candidates.map((candidate) => ({
        candidateId: candidate.id,
        status: "insufficient" as const,
        evidence: [{
          sourceId: "unrelated-source",
          sourceType: "safeclaw-db" as const,
          title: "무관한 근거",
          excerpt: "후보와 관련 없는 내용"
        }],
        confirmedControls: [{
          text: "근거 없는 통제",
          evidenceSourceIds: ["unrelated-source"]
        }],
        confirmedAt: null,
        errorMessage: "positive relevance not established"
      })))
    };

    const analysis = await analyzeHazardPhotos({
      question: "자재 반입 작업",
      photos: [createPhoto("vehicle.jpg", "image/jpeg")]
    }, { provider, harness });
    const candidate = analysis.candidates[0];
    if (!candidate) throw new Error("Expected one hazard candidate");

    expect(candidate.harness).toMatchObject({
      status: "insufficient",
      evidence: [],
      confirmedControls: [],
      confirmedAt: null
    });
    expect(candidate.userDecision.allowed).toEqual(["rejected"]);

    const transition = transitionHazardPhotoUserDecision({
      harnessStatus: candidate.harness.status,
      decision: candidate.userDecision,
      nextStatus: "accepted",
      reason: "사용자 채택 시도",
      decidedAt: "2026-07-11T00:00:00.000Z"
    });

    expect(transition).toMatchObject({
      ok: false,
      code: "harness_confirmation_required"
    });
  });

  it("grounds each candidate with an independent default resolver query and positively relevant pool", async () => {
    const fallReference = safetyReference({
      id: "fall-scaffold",
      title: "비계 작업발판 추락 예방",
      keywords: ["비계", "작업발판", "추락"],
      riskTags: ["추락"],
      controls: ["비계 작업발판 안전난간 상태 확인"]
    });
    const forkliftReference = safetyReference({
      id: "forklift-traffic",
      title: "지게차 보행자 충돌 예방",
      keywords: ["지게차", "보행자", "충돌"],
      riskTags: ["충돌"],
      controls: ["지게차와 보행자 동선 분리 상태 확인"]
    });
    const genericReference = safetyReference({
      id: "generic-site-check",
      title: "현장 위험 후보 확인",
      keywords: ["현장", "확인"],
      riskTags: [],
      controls: ["일반 작업 전 현장 확인"]
    });
    vi.mocked(searchSafetyReferences).mockReset();
    vi.mocked(searchSafetyReferences).mockImplementation(async ({ query }) => ({
      ok: true,
      configured: true,
      query,
      count: 3,
      items: [fallReference, forkliftReference, genericReference],
      retrievalMode: "ranked-rpc",
      vectorSearch: {
        enabled: false,
        attempted: false,
        ok: false,
        reason: "disabled",
        count: 0,
        model: "text-embedding-3-small",
        message: "disabled"
      },
      message: "contract fixture"
    }));
    const provider = {
      name: "contract-stub",
      model: "vision-contract-v1",
      mode: "mock" as const,
      analyze: vi.fn(async () => JSON.stringify({
        summary: "비계와 지게차 작업 구역이 각각 보입니다.",
        observations: [
          { kind: "visual", text: "비계 작업발판 가장자리가 보입니다." },
          { kind: "visual", text: "지게차와 보행자가 가까이 보입니다." }
        ],
        candidates: [
          {
            label: "비계 작업발판 추락 위험 후보",
            observation: "비계 작업발판 가장자리가 보입니다.",
            inference: "추락 위험 가능성을 현장에서 확인해야 합니다."
          },
          {
            label: "지게차 보행자 충돌 위험 후보",
            observation: "지게차와 보행자가 가까이 보입니다.",
            inference: "충돌 위험 가능성을 현장에서 확인해야 합니다."
          }
        ],
        ocrText: "",
        siteSignals: ["비계", "지게차"]
      }))
    };

    const analysis = await analyzeHazardPhotos({
      question: "복합 작업 구역 점검",
      photos: [createPhoto("mixed-work.jpg", "image/jpeg")]
    }, { provider });

    expect(searchSafetyReferences).toHaveBeenCalledTimes(6);
    const queries = vi.mocked(searchSafetyReferences).mock.calls.map(([options]) => options.query);
    expect(queries.filter((query) => query.includes("비계"))).toHaveLength(3);
    expect(queries.filter((query) => query.includes("지게차"))).toHaveLength(3);
    expect(analysis.counts.harnessConfirmed).toBe(2);
    const scaffoldEvidence = analysis.candidates[0]?.harness.evidence ?? [];
    expect(scaffoldEvidence.map((item) => item.sourceId)).toEqual([
      EXACT_D_C_7_ID,
      "fall-scaffold"
    ]);
    expect(scaffoldEvidence.find((item) => item.sourceId === EXACT_D_C_7_ID)).toMatchObject({
      stableDocumentKey: "D-C-7",
      evidenceRole: "direct",
      directEligible: true,
      reviewRequired: false
    });
    expect(scaffoldEvidence.find((item) => item.sourceId === "fall-scaffold")).toMatchObject({
      catalogSourceId: "fall-scaffold-source",
      sourceUrl: "https://safety.example/fall-scaffold",
      itemType: "guideline",
      evidenceRole: "direct",
      retrievals: expect.arrayContaining([
        expect.objectContaining({ channel: "direct", mode: "ranked-rpc", source: "ranked" }),
        expect.objectContaining({ channel: "sif", mode: "ranked-rpc", source: "ranked" }),
        expect.objectContaining({ channel: "supporting", mode: "ranked-rpc", source: "ranked" })
      ])
    });
    const scaffoldControls = analysis.candidates[0]?.harness.confirmedControls ?? [];
    expect(scaffoldControls).toEqual([{
      text: "비계 작업발판 안전난간 상태 확인",
      evidenceSourceIds: ["fall-scaffold"]
    }]);
    expect(analysis.candidates[1]?.harness.evidence.map((item) => item.sourceId)).toEqual(["forklift-traffic"]);
    const forkliftControls = analysis.candidates[1]?.harness.confirmedControls || [];
    expect(forkliftControls.length).toBeGreaterThan(0);
    expect(forkliftControls.every((control) =>
      control.evidenceSourceIds.length === 1 && control.evidenceSourceIds[0] === "forklift-traffic"
    )).toBe(true);
    expect(forkliftControls.map((control) => control.text).join(" ")).toContain("지게차");
    expect(forkliftControls.map((control) => control.text).join(" ")).not.toContain("비계");

    const confirmedCandidate = analysis.candidates[0];
    if (!confirmedCandidate) throw new Error("Expected a confirmed hazard candidate");
    const accepted = transitionHazardPhotoUserDecision({
      harnessStatus: confirmedCandidate.harness.status,
      decision: confirmedCandidate.userDecision,
      nextStatus: "accepted",
      reason: "현장 검토 완료",
      decidedAt: "2026-07-11T00:00:00.000Z"
    });
    expect(accepted).toMatchObject({
      ok: true,
      decision: {
        status: "accepted",
        allowed: [],
        reason: "현장 검토 완료"
      }
    });
  });

  it("confirms controls and source IDs only from individually trusted evidence", async () => {
    const trustedReference = safetyReference({
      id: "trusted-fall-control",
      title: "비계 추락 방지 통제",
      keywords: ["비계", "추락", "안전난간"],
      riskTags: ["추락"],
      controls: ["비계 작업발판 안전난간 상태 확인"]
    });
    const reviewRequiredReference = safetyReference({
      id: "review-required-fall-control",
      title: "D-C-13-2026 외벽 작업 안전 기술지원규정",
      keywords: ["비계", "추락", "안전난간"],
      riskTags: ["추락"],
      controls: ["외벽 작업발판 안전난간 상태 확인"]
    });
    const bodyExtractableReference = safetyReference({
      id: "body-extractable-kosha-control",
      title: "비계 작업발판 안전 기술지원규정",
      keywords: ["비계", "추락", "작업발판"],
      riskTags: ["추락"],
      controls: ["작업발판 고정 상태를 확인한다."]
    });
    bodyExtractableReference.item_type = "technical-support-regulation";
    bodyExtractableReference.body = "작업 전 작업발판 고정 상태를 확인한다.";
    bodyExtractableReference.kosha_grounding = {
      status: "verified_current",
      reason: "verified-current",
      source: "local-corpus",
      reviewRequired: false,
      directEvidenceEligible: true,
      supportingCitationEligible: true,
      mandatoryCitationEligible: true,
      riskRowEligible: false,
      promptExcerptEligible: true,
      metadata: {
        uid: bodyExtractableReference.id,
        stableDocumentKey: "D-C-PHOTO-TEST",
        version: "2026",
        currentVersion: "2026",
        lifecycle: "current",
        reviewState: "verified",
        bodyKind: "native",
        bodySha256: "a".repeat(64),
        officialUrl: "https://portal.kosha.or.kr/photo-test",
        officialFileId: "PHOTO-TEST",
        publishedAt: "2026-01-01",
        provenance: "test-exact-body"
      }
    };
    reviewRequiredReference.source_id = "kosha-guide-offline:D-C-13";
    reviewRequiredReference.item_type = "technical-support-regulation";
    reviewRequiredReference.evidence_role = "supporting";
    reviewRequiredReference.retrieval_source = "local-ranked";
    reviewRequiredReference.kosha_guide = {
      referenceId: reviewRequiredReference.id,
      stableDocumentKey: "D-C-13",
      version: "D-C-13-2026",
      quality: "review_required",
      lifecycle: "stale",
      bodyKind: "native",
      anchors: [{ page: 7, excerpt: "외벽 작업발판 안전난간 상태 확인" }],
      evidenceRef: "KOSHA 근거 D-C-13-2026 p.7: 외벽 작업발판 안전난간 상태 확인",
      directEligible: false
    };
    vi.mocked(searchSafetyReferences).mockReset();
    vi.mocked(searchSafetyReferences).mockResolvedValue({
      ok: true,
      configured: true,
      query: "비계 작업발판 추락 위험",
      count: 3,
      items: [trustedReference, bodyExtractableReference, reviewRequiredReference],
      retrievalMode: "ranked-rpc",
      vectorSearch: {
        enabled: false,
        attempted: false,
        ok: false,
        reason: "disabled",
        count: 0,
        model: "text-embedding-3-small",
        message: "disabled"
      },
      message: "mixed trust fixture"
    });
    const provider = {
      name: "contract-stub",
      model: "vision-contract-v1",
      mode: "mock" as const,
      analyze: vi.fn(async () => JSON.stringify({
        summary: "비계 작업발판 가장자리가 보입니다.",
        observations: [{ kind: "visual", text: "비계 작업발판 가장자리가 보입니다." }],
        candidates: [{
          label: "비계 작업발판 추락 위험 후보",
          observation: "비계 작업발판 가장자리가 보입니다.",
          inference: "추락 위험 가능성을 현장에서 확인해야 합니다."
        }],
        ocrText: "",
        siteSignals: ["비계", "작업발판"]
      }))
    };

    const analysis = await analyzeHazardPhotos({
      question: "비계 작업 구역 점검",
      photos: [createPhoto("mixed-trust.jpg", "image/jpeg")]
    }, { provider });

    expect(analysis.candidates[0]?.harness.status).toBe("confirmed");
    expect(analysis.candidates[0]?.harness.evidence.map((item) => item.sourceId)).toEqual(expect.arrayContaining([
      EXACT_D_C_7_ID,
      "trusted-fall-control",
      "body-extractable-kosha-control",
      "review-required-fall-control"
    ]));
    expect(analysis.candidates[0]?.harness.evidence.find((item) => (
      item.sourceId === "review-required-fall-control"
    ))).toMatchObject({
      evidenceRole: "supporting",
      stableDocumentKey: "D-C-13",
      anchor: { page: 7, excerpt: "외벽 작업발판 안전난간 상태 확인" },
      quality: "review_required",
      lifecycle: "stale",
      directEligible: false,
      reviewRequired: true
    });
    const confirmedControls = analysis.candidates[0]?.harness.confirmedControls ?? [];
    expect(confirmedControls).toEqual(expect.arrayContaining([
      {
        text: "비계 작업발판 안전난간 상태 확인",
        evidenceSourceIds: ["trusted-fall-control"]
      },
      {
        text: "작업발판 고정 상태를 확인한다.",
        evidenceSourceIds: ["body-extractable-kosha-control"]
      }
    ]));
    expect(confirmedControls.flatMap((item) => item.evidenceSourceIds)).not.toContain(
      "review-required-fall-control"
    );
  });

  it("does not ground a candidate from generic review vocabulary alone", async () => {
    const genericReference = safetyReference({
      id: "generic-review",
      title: "현장 안전 상태 검토 필요",
      keywords: ["현장", "안전", "상태", "검토", "필요", "확인"],
      riskTags: [],
      controls: ["작업 전 안전 상태 확인"]
    });
    vi.mocked(searchSafetyReferences).mockReset();
    vi.mocked(searchSafetyReferences).mockResolvedValue({
      ok: true,
      configured: true,
      query: "현장 안전 상태 검토 필요",
      count: 1,
      items: [genericReference],
      retrievalMode: "ranked-rpc",
      vectorSearch: {
        enabled: false,
        attempted: false,
        ok: false,
        reason: "disabled",
        count: 0,
        model: "text-embedding-3-small",
        message: "disabled"
      },
      message: "generic-only fixture"
    });
    const provider = {
      name: "contract-stub",
      model: "vision-contract-v1",
      mode: "mock" as const,
      analyze: vi.fn(async () => JSON.stringify({
        summary: "현장 안전 상태를 검토할 필요가 있어 보입니다.",
        observations: [{ kind: "visual", text: "현장 상태가 보입니다." }],
        candidates: [{
          label: "현장 안전 검토 필요 후보",
          observation: "현장 상태가 보입니다.",
          inference: "안전 확인 필요 여부를 현장에서 검토합니다."
        }],
        ocrText: "",
        siteSignals: ["현장", "상태"]
      }))
    };

    const analysis = await analyzeHazardPhotos({
      question: "사진 검토",
      photos: [createPhoto("generic.jpg", "image/jpeg")]
    }, { provider });

    expect(analysis.candidates[0]?.harness).toMatchObject({
      status: "insufficient",
      evidence: [],
      confirmedControls: []
    });
    expect(analysis.counts.harnessConfirmed).toBe(0);
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

  it("propagates caller cancellation to the provider without converting it to a failed image", async () => {
    const controller = new AbortController();
    let providerSignal: AbortSignal | undefined;
    const provider = {
      name: "contract-stub",
      model: "vision-contract-v1",
      mode: "mock" as const,
      analyze: vi.fn(async (input: { signal?: AbortSignal }) => {
        providerSignal = input.signal;
        return new Promise<string>((_resolve, reject) => {
          input.signal?.addEventListener("abort", () => reject(input.signal?.reason), { once: true });
        });
      })
    };

    const pending = analyzeHazardPhotos({
      question: "비계 점검",
      photos: [createPhoto("cancellation.jpg", "image/jpeg")]
    }, { provider, harness: null, signal: controller.signal });

    await vi.waitFor(() => expect(providerSignal).toBe(controller.signal));
    controller.abort(new DOMException("client disconnected", "AbortError"));

    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  });

  it("rejects spoofed improvement photos with the shared MIME signature validator", async () => {
    const error = await validateHazardPhotoFile(
      new File(["plain text"], "before.jpg", { type: "image/jpeg" })
    );

    expect(error).toMatchObject({
      code: "invalid_signature",
      retryable: false
    });
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
