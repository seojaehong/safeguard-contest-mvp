import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// inventory 11-3 의 11번 — full 실출력(sc-pr12/scratch-final/out2/run1/press.json)에서 뽑은 RED 문자열.
// AI_DELIVERABLES_PROVIDER=claude + ANTHROPIC_API_KEY 만 있는 운영 조건에서 answer 경로가
// Anthropic 을 보지 못해 status.ai=mock·mode=mock·detail 「AI 제공자 키가 없어…」 로 나갔다.
const RED_FULL_PRESS = Object.freeze({
  mode: "mock",
  statusAi: "mock",
  summary: "연결 점검 필요",
  detailPrefix: "AI 제공자 키가 없어 규정 기반 문서팩으로 구성했습니다.",
  upstreamProvider: "mock"
});

const mocks = vi.hoisted(() => ({
  anthropicGenerate: vi.fn(),
  openAiCreate: vi.fn(),
  vertexGenerate: vi.fn()
}));

vi.mock("@/lib/anthropic-client", () => ({
  generateWithAnthropic: mocks.anthropicGenerate,
  isAnthropicConfigured: () => Boolean(process.env.ANTHROPIC_API_KEY?.trim())
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

describe("answer path recognises the Anthropic deliverables provider", () => {
  const savedEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.AI_DELIVERABLES_PROVIDER = "claude";
    process.env.ANTHROPIC_API_KEY = "test-anthropic-key";
    delete process.env.ANTHROPIC_MODEL;
    delete process.env.OPENAI_API_KEY;
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    delete process.env.GCP_PROJECT_ID;
    mocks.anthropicGenerate.mockResolvedValue("Anthropic 이 만든 답변");
    mocks.openAiCreate.mockResolvedValue({ output_text: "OpenAI 가 만든 답변" });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env = { ...savedEnv };
  });

  test("Anthropic 만 설정된 full 조건에서 status.ai·mode·detail 이 mock 으로 찍히지 않는다 (RED: press.json)", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const { generateAnswer } = await import("@/lib/ai");

    const result = await generateAnswer("프레스 금형 교체 작업", [], { traceId: "trace-anthropic-answer" });

    expect(result.response.mode).not.toBe(RED_FULL_PRESS.mode);
    expect(result.response.status.ai).not.toBe(RED_FULL_PRESS.statusAi);
    expect(result.response.status.summary).not.toBe(RED_FULL_PRESS.summary);
    expect(result.response.status.detail.startsWith(RED_FULL_PRESS.detailPrefix)).toBe(false);
    expect(result.trace.provider).not.toBe(RED_FULL_PRESS.upstreamProvider);

    expect(result.response.mode).toBe("live");
    expect(result.response.status.ai).toBe("live");
    expect(result.response.answer).toBe("Anthropic 이 만든 답변");
    expect(result.trace).toEqual({
      provider: "anthropic",
      model: "claude-sonnet-5-5",
      fallbackUsed: false
    });
    expect(mocks.anthropicGenerate).toHaveBeenCalledTimes(1);
    expect(mocks.anthropicGenerate.mock.calls[0]?.[0]).toBe("claude-sonnet-5-5");
    expect(String(mocks.anthropicGenerate.mock.calls[0]?.[1])).toContain("프레스 금형 교체 작업");
    expect(mocks.anthropicGenerate.mock.calls[0]?.[2]).toMatchObject({ maxOutputTokens: 2_048, logLabel: "answer" });
    expect(mocks.openAiCreate).not.toHaveBeenCalled();
    expect(mocks.vertexGenerate).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('"provider":"anthropic"'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('"traceId":"trace-anthropic-answer"'));
  });

  test("ANTHROPIC_MODEL 재정의는 deliverables 와 같은 규칙으로 answer 경로에도 적용된다", async () => {
    process.env.ANTHROPIC_MODEL = "claude-opus-4-8";
    const { generateAnswer } = await import("@/lib/ai");

    const result = await generateAnswer("굴착 작업", [], { traceId: "trace-anthropic-model-override" });

    expect(result.trace).toEqual({ provider: "anthropic", model: "claude-opus-4-8", fallbackUsed: false });
    expect(mocks.anthropicGenerate.mock.calls[0]?.[0]).toBe("claude-opus-4-8");
  });

  test("플래그만 있고 키가 없으면 그대로 mock 으로 표기한다 (사실 표기)", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const { generateAnswer } = await import("@/lib/ai");

    const result = await generateAnswer("폭염 하역 작업", [], { traceId: "trace-anthropic-no-key" });

    expect(result.response.mode).toBe("mock");
    expect(result.response.status.ai).toBe("mock");
    expect(result.response.status.detail.startsWith(RED_FULL_PRESS.detailPrefix)).toBe(true);
    expect(result.trace).toEqual({ provider: "mock", model: null, fallbackUsed: false });
    expect(mocks.anthropicGenerate).not.toHaveBeenCalled();
  });

  test("Anthropic 실패 + 다른 제공자 없음 → 거부해서 search.ts 가 fallback 으로 표기하게 한다 (mock 으로 위장하지 않음)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.anthropicGenerate.mockRejectedValue(new Error("Anthropic refusal (model=claude-sonnet-5-5)"));
    const { generateAnswer } = await import("@/lib/ai");

    await expect(generateAnswer("정화조 청소", [], { traceId: "trace-anthropic-fail" }))
      .rejects.toThrow("Anthropic refusal");
    expect(mocks.anthropicGenerate).toHaveBeenCalledTimes(1);
  });

  test("Anthropic 실패 + OpenAI 키 있음 → OpenAI 로 폴백하고 fallbackUsed=true 를 남긴다", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    process.env.OPENAI_API_KEY = "test-openai-key";
    process.env.OPENAI_MODEL = "gpt-4.1-mini";
    mocks.anthropicGenerate.mockRejectedValue(new Error("Anthropic empty response"));
    const { generateAnswer } = await import("@/lib/ai");

    const result = await generateAnswer("정화조 청소", [], { traceId: "trace-anthropic-fallback-openai" });

    expect(result.response.mode).toBe("live");
    expect(result.response.status.ai).toBe("live");
    expect(result.response.answer).toBe("OpenAI 가 만든 답변");
    expect(result.trace).toEqual({ provider: "openai", model: "gpt-4.1-mini", fallbackUsed: true });
  });

  test("Anthropic 답변도 출력 상한을 넘으면 거부한다", async () => {
    mocks.anthropicGenerate.mockResolvedValueOnce("가".repeat(8_001));
    const { generateAnswer } = await import("@/lib/ai");

    await expect(generateAnswer("일반 작업", [], { traceId: "trace-anthropic-budget" }))
      .rejects.toThrow("AI answer exceeded the 8000-character output budget");
  });

  test("Anthropic 설정이 없고 OpenAI 만 있으면 기존 경로 그대로다 (회귀 없음)", async () => {
    delete process.env.AI_DELIVERABLES_PROVIDER;
    delete process.env.ANTHROPIC_API_KEY;
    process.env.OPENAI_API_KEY = "test-openai-key";
    process.env.OPENAI_MODEL = "gpt-4.1-mini";
    const { generateAnswer } = await import("@/lib/ai");

    const result = await generateAnswer("일반 작업", [], { traceId: "trace-openai-only" });

    expect(result.trace).toEqual({ provider: "openai", model: "gpt-4.1-mini", fallbackUsed: false });
    expect(mocks.anthropicGenerate).not.toHaveBeenCalled();
  });
});
