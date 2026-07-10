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

  test("marks the answer trace when Vertex falls back to OpenAI", async () => {
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON = "{}";
    process.env.GCP_PROJECT_ID = "test-project";
    mocks.vertexGenerate.mockRejectedValue(new Error("fixture Vertex unavailable"));
    const { generateAnswer } = await import("@/lib/ai");

    const result = await generateAnswer("성수동 외벽 도장 작업", [], {
      traceId: "trace-answer-fallback"
    });

    expect(result.trace).toEqual({
      provider: "openai",
      model: "gpt-4.1-mini",
      fallbackUsed: true
    });
  });
});
