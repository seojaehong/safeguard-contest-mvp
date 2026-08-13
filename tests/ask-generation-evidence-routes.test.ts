import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildDbHarnessPacket } from "@/lib/db-harness";
import { buildMockAskResponse } from "@/lib/mock-data";
import {
  PUBLIC_ASK_HARNESS_MEMORY_MAX_CHARS,
  PUBLIC_ASK_QUESTION_MAX_CHARS,
  PUBLIC_ASK_REQUEST_MAX_BYTES,
} from "@/lib/public-work-budget";
import type { AskResponse } from "@/lib/types";

const mocks = vi.hoisted(() => ({
  runAsk: vi.fn()
}));

vi.mock("@/lib/search", () => ({
  runAsk: mocks.runAsk
}));

function responseWithHarness(): AskResponse {
  const question = "성수동 외벽 도장 작업";
  const response = buildMockAskResponse(question, [], "mock", "test");
  const packet = buildDbHarnessPacket({ question, references: [] });
  return {
    ...response,
    generationTrace: {
      traceId: "trace-ask-route-test",
      askMode: "full",
      answer: {
        provider: "openai",
        model: "gpt-4.1-mini"
      },
      deliverables: {
        attempted: true,
        provider: "anthropic",
        modelPerDocument: {
          riskAssessment: {
            provider: "anthropic",
            model: "claude-opus-4-8"
          }
        }
      },
      fallbackUsed: false
    },
    dbHarness: {
      packet,
      promptContext: "server generation harness",
      summary: {
        mode: packet.mode,
        llmRole: packet.generationContract.llmRole,
        llmOutputScope: packet.generationContract.llmOutputScope,
        evidenceAuthority: packet.generationContract.evidenceAuthority,
        providerRetryScope: packet.generationContract.providerRetryScope,
        fallbackChainAllowed: packet.generationContract.fallbackChainAllowed,
        genericProseSubstitutionAllowed: packet.generationContract.genericProseSubstitutionAllowed,
        missingEvidencePolicy: packet.generationContract.missingEvidencePolicy,
        directEvidence: 0,
        sifCases: 0,
        supportingEvidence: 0,
        improvementMemory: 0,
        workpackMemory: 0,
        missingEvidence: packet.generationContract.missingEvidence,
        documentCoverage: packet.generationContract.documentCoverage,
        retrievalContract: packet.retrievalContract,
        ontologyStatus: packet.ontologyChecklist.status
      }
    }
  };
}

function request(path: string): NextRequest {
  return requestWithBody(path, { question: "성수동 외벽 도장 작업" });
}

function requestWithBody(path: string, body: unknown, options: { ip?: string; signal?: AbortSignal } = {}): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": options.ip ?? `203.0.113.${path.includes("stream") ? "41" : "40"}`
    },
    body: JSON.stringify(body),
    signal: options.signal,
  });
}

describe("ask generation evidence routes", () => {
  beforeEach(() => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    vi.stubEnv("VERCEL_ENV", "");
    process.env.SAFECLAW_GENERATION_EVIDENCE_SECRET = "ask-route-generation-evidence-secret";
    mocks.runAsk.mockResolvedValue(responseWithHarness());
  });

  afterEach(() => {
    delete process.env.SAFECLAW_GENERATION_EVIDENCE_SECRET;
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("attaches generation evidence to the JSON response", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const { POST } = await import("@/app/api/ask/route");
    const response = await POST(request("/api/ask"));
    const body = await response.json() as AskResponse;

    expect(body.generationEvidence).toMatchObject({
      version: "safeclaw-generation-evidence/v1",
      algorithm: "HMAC-SHA256"
    });
    expect(body.generationEvidence?.snapshot.dbHarnessPacket).toEqual(body.dbHarness?.packet);
    expect(body.generationEvidence?.snapshot.generationTrace).toEqual(body.generationTrace);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("[api/ask] safeclaw_generation_trace"));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('"traceId":"trace-ask-route-test"'));
    logSpy.mockRestore();
  });

  it("attaches generation evidence to the SSE final payload", async () => {
    const { POST } = await import("@/app/api/ask/stream/route");
    const response = await POST(request("/api/ask/stream"));
    const body = await response.text();

    expect(body).toContain('"kind":"final"');
    expect(body).toContain('"version":"safeclaw-generation-evidence/v1"');
    expect(body).toContain('"algorithm":"HMAC-SHA256"');
  });

  it("does not expose raw internal errors through the SSE response", async () => {
    mocks.runAsk.mockRejectedValueOnce(new Error("PII_MARKER worker=Kim secret=internal"));
    const { POST } = await import("@/app/api/ask/stream/route");
    const response = await POST(request("/api/ask/stream"));
    const body = await response.text();

    expect(body).toContain('"kind":"error"');
    expect(body).toContain("요청 처리 중 오류가 발생했습니다");
    expect(body).not.toContain("PII_MARKER");
    expect(body).not.toContain("secret=internal");
  });

  it("rejects oversized ask questions before runAsk", async () => {
    const { POST } = await import("@/app/api/ask/route");
    const response = await POST(requestWithBody("/api/ask", {
      question: "작업 ".repeat(PUBLIC_ASK_QUESTION_MAX_CHARS)
    }));
    const body = await response.json() as { code: string; limit: number };

    expect(response.status).toBe(413);
    expect(body).toMatchObject({
      code: "PUBLIC_WORK_BUDGET_EXCEEDED",
      limit: PUBLIC_ASK_QUESTION_MAX_CHARS
    });
    expect(mocks.runAsk).not.toHaveBeenCalled();
  });

  it("rejects oversized harness memory before stream runAsk", async () => {
    const { POST } = await import("@/app/api/ask/stream/route");
    const response = await POST(requestWithBody("/api/ask/stream", {
      question: "성수동 외벽 도장 작업",
      harnessMemory: {
        improvements: [{
          id: "oversized",
          sourceType: "photo_analysis",
          improvementText: "x".repeat(PUBLIC_ASK_HARNESS_MEMORY_MAX_CHARS)
        }]
      }
    }));
    const body = await response.json() as { code: string; limit: number };

    expect(response.status).toBe(413);
    expect(body).toMatchObject({
      code: "PUBLIC_WORK_BUDGET_EXCEEDED",
      limit: PUBLIC_ASK_HARNESS_MEMORY_MAX_CHARS
    });
    expect(mocks.runAsk).not.toHaveBeenCalled();
  });

  it.each([
    ["JSON", "/api/ask", () => import("@/app/api/ask/route")],
    ["SSE", "/api/ask/stream", () => import("@/app/api/ask/stream/route")],
  ])("rejects an oversized %s body before JSON parsing and runAsk", async (_label, path, loadRoute) => {
    const { POST } = await loadRoute();
    const response = await POST(requestWithBody(path, {
      question: "성수동 외벽 도장 작업",
      ignored: "x".repeat(PUBLIC_ASK_REQUEST_MAX_BYTES),
    }));
    const body = await response.json() as { code: string; limit: number };

    expect(response.status).toBe(413);
    expect(body).toMatchObject({
      code: "PUBLIC_WORK_BUDGET_EXCEEDED",
      limit: PUBLIC_ASK_REQUEST_MAX_BYTES,
    });
    expect(mocks.runAsk).not.toHaveBeenCalled();
  });

  it("shares one admission budget across JSON and SSE transports", async () => {
    const ip = "203.0.113.88";
    const { POST: postJson } = await import("@/app/api/ask/route");
    const { POST: postStream } = await import("@/app/api/ask/stream/route");

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const post = attempt % 2 === 0 ? postJson : postStream;
      const path = attempt % 2 === 0 ? "/api/ask" : "/api/ask/stream";
      const response = await post(requestWithBody(path, { question: "성수동 외벽 도장 작업" }, { ip }));
      expect(response.status).toBe(200);
      expect(response.headers.get("X-SafeClaw-Rate-Limit")).toBe("instance");
      if (response.body) await response.body.cancel();
    }

    const limited = await postJson(requestWithBody("/api/ask", { question: "성수동 외벽 도장 작업" }, { ip }));
    expect(limited.status).toBe(429);
    expect(mocks.runAsk).toHaveBeenCalledTimes(10);
  });

  it.each([
    ["JSON enhanced", "/api/ask", "enhanced", () => import("@/app/api/ask/route")],
    ["JSON full", "/api/ask", "full", () => import("@/app/api/ask/route")],
    ["SSE enhanced", "/api/ask/stream", "enhanced", () => import("@/app/api/ask/stream/route")],
    ["SSE full", "/api/ask/stream", "full", () => import("@/app/api/ask/stream/route")],
  ] as const)("fails %s provider generation closed when distributed production admission is absent", async (_label, path, aiMode, loadRoute) => {
    vi.stubEnv("VERCEL_ENV", "production");
    const { POST } = await loadRoute();

    const response = await POST(requestWithBody(path, {
      question: "성수동 외벽 도장 작업",
      aiMode,
    }, { ip: `203.0.113.${path.includes("stream") ? "121" : "120"}` }));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      code: "DISTRIBUTED_RATE_LIMIT_UNAVAILABLE",
    });
    expect(response.headers.get("X-SafeClaw-Rate-Limit")).toBe("distributed");
    expect(mocks.runAsk).not.toHaveBeenCalled();
  });

  it("holds a full-mode work lease until the SSE consumer cancels", async () => {
    let receivedSignal: AbortSignal | undefined;
    mocks.runAsk.mockImplementationOnce(async (_question, options: { signal?: AbortSignal }) => {
      receivedSignal = options.signal;
      await new Promise<never>((_resolve, reject) => {
        options.signal?.addEventListener("abort", () => reject(options.signal?.reason), { once: true });
      });
    });
    const { POST: postStream } = await import("@/app/api/ask/stream/route");
    const { POST: postJson } = await import("@/app/api/ask/route");
    const stream = await postStream(requestWithBody(
      "/api/ask/stream",
      { question: "성수동 외벽 도장 작업", aiMode: "full" },
      { ip: "203.0.113.91" },
    ));
    await vi.waitFor(() => expect(receivedSignal).toBeInstanceOf(AbortSignal));

    const busy = await postJson(requestWithBody(
      "/api/ask",
      { question: "다른 현장 작업", aiMode: "full" },
      { ip: "203.0.113.92" },
    ));
    expect(busy.status).toBe(503);
    await expect(busy.json()).resolves.toMatchObject({ code: "PUBLIC_ASK_CONCURRENCY_LIMIT" });
    expect(mocks.runAsk).toHaveBeenCalledTimes(1);

    await stream.body?.cancel("release full-mode test lease");
    expect(receivedSignal?.aborted).toBe(true);
  });

  it("aborts streaming work when the response consumer cancels", async () => {
    let receivedSignal: AbortSignal | undefined;
    mocks.runAsk.mockImplementationOnce(async (_question, options: { signal?: AbortSignal }) => {
      receivedSignal = options.signal;
      await new Promise<never>((_resolve, reject) => {
        options.signal?.addEventListener("abort", () => reject(options.signal?.reason), { once: true });
      });
    });
    const { POST } = await import("@/app/api/ask/stream/route");
    const response = await POST(requestWithBody(
      "/api/ask/stream",
      { question: "성수동 외벽 도장 작업" },
      { ip: "203.0.113.89" },
    ));

    await response.body?.cancel("test consumer cancelled");

    expect(receivedSignal?.aborted).toBe(true);
  });

  it("aborts JSON work when the request disconnects", async () => {
    let receivedSignal: AbortSignal | undefined;
    mocks.runAsk.mockImplementationOnce(async (_question, options: { signal?: AbortSignal }) => {
      receivedSignal = options.signal;
      await new Promise<never>((_resolve, reject) => {
        options.signal?.addEventListener("abort", () => reject(options.signal?.reason), { once: true });
      });
    });
    const controller = new AbortController();
    const { POST } = await import("@/app/api/ask/route");
    const pending = POST(requestWithBody(
      "/api/ask",
      { question: "성수동 외벽 도장 작업" },
      { ip: "203.0.113.90", signal: controller.signal },
    ));
    await vi.waitFor(() => expect(receivedSignal).toBeInstanceOf(AbortSignal));
    const reason = new Error("request disconnected");
    controller.abort(reason);

    await expect(pending).rejects.toBe(reason);
    expect(receivedSignal?.aborted).toBe(true);
  });
});
