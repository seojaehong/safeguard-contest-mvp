import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
}));

vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create: mocks.create };
  },
}));

const PROMPT = "비밀-프롬프트-본문-USER-INPUT-1234";

function textResponse(usage?: Record<string, unknown>) {
  return {
    stop_reason: "end_turn",
    content: [{ type: "text", text: "응답 본문" }],
    ...(usage === undefined ? {} : { usage }),
  };
}

function usageLines(spy: ReturnType<typeof vi.spyOn>): string[] {
  return spy.mock.calls
    .map((call) => String(call[0]))
    .filter((line) => line.includes("anthropic_usage"));
}

function parseContext(line: string): Record<string, unknown> {
  return JSON.parse(line.slice(line.indexOf("{")));
}

async function loadClient() {
  vi.resetModules();
  return import("@/lib/anthropic-client");
}

describe("generateWithAnthropic usage log", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    vi.stubEnv("LOG_LEVEL", "info");
    mocks.create.mockReset();
    logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
  });

  afterEach(() => {
    logSpy.mockRestore();
    vi.unstubAllEnvs();
  });

  test("records the four usage counters with model and label", async () => {
    mocks.create.mockResolvedValue(
      textResponse({
        input_tokens: 1200,
        output_tokens: 340,
        cache_creation_input_tokens: 800,
        cache_read_input_tokens: 0,
      })
    );
    const { generateWithAnthropic } = await loadClient();

    const text = await generateWithAnthropic("claude-sonnet-5-5", PROMPT, {
      maxOutputTokens: 1024,
      timeoutMs: 5000,
      logLabel: "riskAssessment",
    });

    expect(text).toBe("응답 본문");
    const lines = usageLines(logSpy);
    expect(lines).toHaveLength(1);
    expect(parseContext(lines[0]!)).toEqual({
      model: "claude-sonnet-5-5",
      label: "riskAssessment",
      input_tokens: 1200,
      output_tokens: 340,
      cache_creation_input_tokens: 800,
      cache_read_input_tokens: 0,
    });
  });

  test("defaults missing cache counters to 0", async () => {
    mocks.create.mockResolvedValue(textResponse({ input_tokens: 10, output_tokens: 5 }));
    const { generateWithAnthropic } = await loadClient();

    await generateWithAnthropic("claude-haiku-5-5", PROMPT, {
      maxOutputTokens: 256,
      timeoutMs: 5000,
      logLabel: "answer",
    });

    const context = parseContext(usageLines(logSpy)[0]!);
    expect(context.cache_creation_input_tokens).toBe(0);
    expect(context.cache_read_input_tokens).toBe(0);
    expect(context.label).toBe("answer");
  });

  test("returns the text even when the response has no usage", async () => {
    mocks.create.mockResolvedValue(textResponse());
    const { generateWithAnthropic } = await loadClient();

    await expect(
      generateWithAnthropic("claude-haiku-5-5", PROMPT, { maxOutputTokens: 256, timeoutMs: 5000 })
    ).resolves.toBe("응답 본문");
  });

  test("keeps the messages request shape unchanged", async () => {
    mocks.create.mockResolvedValue(textResponse({ input_tokens: 1, output_tokens: 1 }));
    const { generateWithAnthropic } = await loadClient();

    await generateWithAnthropic("claude-sonnet-5-5", PROMPT, {
      maxOutputTokens: 512,
      timeoutMs: 5000,
      logLabel: "workPlan",
    });

    expect(mocks.create).toHaveBeenCalledTimes(1);
    const [body] = mocks.create.mock.calls[0]!;
    expect(body).toEqual({
      model: "claude-sonnet-5-5",
      max_tokens: 512,
      messages: [{ role: "user", content: PROMPT }],
    });
    expect(body).not.toHaveProperty("system");
    expect(JSON.stringify(body)).not.toContain("cache_control");
  });

  test("never writes the prompt into the log", async () => {
    mocks.create.mockResolvedValue(
      textResponse({ input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 3 })
    );
    const { generateWithAnthropic } = await loadClient();

    await generateWithAnthropic("claude-sonnet-5-5", PROMPT, {
      maxOutputTokens: 512,
      timeoutMs: 5000,
      logLabel: "workPlan",
    });

    expect(usageLines(logSpy)).toHaveLength(1);
    const allLogged = logSpy.mock.calls.map((call) => String(call[0])).join("\n");
    expect(allLogged).not.toContain(PROMPT);
    expect(allLogged).not.toContain("test-key");
  });
});
