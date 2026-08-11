import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  openAiCreate: vi.fn(),
  vertexGenerate: vi.fn()
}));

vi.mock("openai", () => ({
  default: class MockOpenAI {
    responses = {
      create: mocks.openAiCreate
    };
  }
}));

vi.mock("@/lib/vertex/client", () => ({
  generateWithVertex: mocks.vertexGenerate
}));

describe("answer generation trace", () => {
  const savedEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.OPENAI_API_KEY = "test-openai-key";
    process.env.OPENAI_MODEL = "gpt-4.1-mini";
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    delete process.env.GCP_PROJECT_ID;
    mocks.openAiCreate.mockResolvedValue({ output_text: "구조화된 답변" });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env = { ...savedEnv };
  });

  test("returns the provider and model that produced the answer", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const { generateAnswer } = await import("@/lib/ai");

    const result = await generateAnswer("성수동 외벽 도장 작업", [], {
      traceId: "trace-openai-answer"
    });

    expect(result.response.answer).toBe("구조화된 답변");
    expect(result.trace).toEqual({
      provider: "openai",
      model: "gpt-4.1-mini",
      fallbackUsed: false
    });
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("safeclaw_answer_trace"));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('"traceId":"trace-openai-answer"'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('"model":"gpt-4.1-mini"'));
  });

  test("aborts the active OpenAI request when the caller disconnects", async () => {
    const controller = new AbortController();
    mocks.openAiCreate.mockImplementationOnce((_input: unknown, options?: { signal?: AbortSignal }) =>
      new Promise((_, reject) => {
        options?.signal?.addEventListener("abort", () => reject(options.signal?.reason), { once: true });
      })
    );
    const { generateAnswer } = await import("@/lib/ai");
    const pending = generateAnswer("성수동 외벽 도장 작업", [], {
      traceId: "trace-openai-abort",
      signal: controller.signal,
    });
    const reason = new Error("caller disconnected");
    controller.abort(reason);

    await expect(pending).rejects.toBe(reason);
    expect(mocks.openAiCreate).toHaveBeenCalledOnce();
    expect((mocks.openAiCreate.mock.calls[0]?.[1] as { signal?: AbortSignal })?.signal?.aborted).toBe(true);
  });

  test("marks the answer trace when Vertex falls back to OpenAI", async () => {
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON = "{}";
    process.env.GCP_PROJECT_ID = "test-project";
    mocks.vertexGenerate.mockRejectedValue(new Error("PII_MARKER worker=Kim fixture Vertex unavailable"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { generateAnswer } = await import("@/lib/ai");

    const result = await generateAnswer("성수동 외벽 도장 작업", [], {
      traceId: "trace-answer-fallback"
    });

    expect(result.trace).toEqual({
      provider: "openai",
      model: "gpt-4.1-mini",
      fallbackUsed: true
    });
    const logged = errorSpy.mock.calls.flat().map(String).join("\n");
    expect(logged).not.toContain("PII_MARKER");
    expect(logged).not.toContain("worker=Kim");
  });

  test("places Phase A untrusted grounding before the answer persona", async () => {
    const { generateAnswer } = await import("@/lib/ai");
    const { buildPhaseAGenerationGrounding } = await import("@/lib/ontology/evidence-chain");
    const phaseAGrounding = buildPhaseAGenerationGrounding({
      evidenceChainState: "not_registered",
      evidencePack: null,
    });

    await generateAnswer("일반 작업", [], {
      traceId: "trace-phase-a-grounding",
      phaseAGrounding,
    });

    const request = mocks.openAiCreate.mock.calls[0]?.[0] as { input?: string } | undefined;
    expect(request?.input).toContain("<<<BEGIN_PHASE_A_UNTRUSTED_EVIDENCE_JSON>>>");
    expect(request?.input?.indexOf("<<<BEGIN_PHASE_A_UNTRUSTED_EVIDENCE_JSON>>>")).toBeLessThan(
      request?.input?.indexOf("당신은 산업안전 실무용 코파일럿이다.") ?? -1,
    );
    expect(request?.input).toContain('"groundingStatus":"missing"');
  });

  test("blocks provider-authored hazard and control prose at the Phase A answer boundary", async () => {
    const providerClaim = "고정 패킷에 없는 신규 붕괴 위험 때문에 드론 감시원을 배치한다.";
    mocks.openAiCreate.mockResolvedValue({ output_text: providerClaim });
    const { generateAnswer } = await import("@/lib/ai");
    const { buildPhaseAGenerationGrounding } = await import("@/lib/ontology/evidence-chain");
    const phaseAGrounding = buildPhaseAGenerationGrounding({
      evidenceChainState: "not_registered",
      evidencePack: null,
    });

    const result = await generateAnswer("일반 작업", [], {
      traceId: "trace-phase-a-output-boundary",
      phaseAGrounding,
    });

    expect(result.response.answer).not.toContain(providerClaim);
    expect(result.response.answer).toContain("현장 확인 필요");
  });

  test("fails closed to the canonical Phase A answer when no provider is configured", async () => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    delete process.env.GCP_PROJECT_ID;
    const { generateAnswer } = await import("@/lib/ai");
    const { buildPhaseAGenerationGrounding } = await import("@/lib/ontology/evidence-chain");
    const phaseAGrounding = buildPhaseAGenerationGrounding({
      evidenceChainState: "not_registered",
      evidencePack: null,
    });

    const result = await generateAnswer("일반 작업", [], {
      traceId: "trace-phase-a-no-provider",
      phaseAGrounding,
    });

    expect(result.response.answer).toBe([
      "핵심 판단: 현장 확인 필요",
      "즉시 조치: 현장 확인 필요",
      "실무 체크포인트: 현장 확인 필요",
    ].join("\n"));
    expect(result.trace.provider).toBe("mock");
  });

  test("passes the same Phase A grounding into legal evidence mapping generation", async () => {
    const { enhanceLegalEvidenceMappings } = await import("@/lib/ai");
    const { buildPhaseAGenerationGrounding } = await import("@/lib/ontology/evidence-chain");
    const phaseAGrounding = buildPhaseAGenerationGrounding({
      evidenceChainState: "review_required",
      evidencePack: null,
    });
    const citations = [{
      id: "law-1",
      type: "law" as const,
      title: "산업안전보건법",
      summary: "검토 근거",
      sourceLabel: "법제처",
      url: "https://law.go.kr",
    }];

    await enhanceLegalEvidenceMappings("고소작업", citations, phaseAGrounding);

    const request = mocks.openAiCreate.mock.calls[0]?.[0] as { input?: string } | undefined;
    expect(request?.input).toContain("<<<BEGIN_PHASE_A_UNTRUSTED_EVIDENCE_JSON>>>");
    expect(request?.input).toContain('"evidenceChainState":"review_required"');
    expect(request?.input?.indexOf("<<<BEGIN_PHASE_A_UNTRUSTED_EVIDENCE_JSON>>>")).toBeLessThan(
      request?.input?.indexOf("당신은 산업안전 문서팩의 근거 매핑 편집자다.") ?? -1,
    );
  });
});
