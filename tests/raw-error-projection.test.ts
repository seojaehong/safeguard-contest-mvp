import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const knowledgeMocks = vi.hoisted(() => ({
  matchSafetyKnowledge: vi.fn(),
}));

vi.mock("@/lib/safety-knowledge", () => ({
  getSafetyKnowledgeLegalMap: () => [],
  getSafetyKnowledgeSources: () => [],
  getSafetyKnowledgeTemplates: () => [],
  matchSafetyKnowledge: knowledgeMocks.matchSafetyKnowledge,
}));

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("raw error projection boundary", () => {
  it("returns a stable public knowledge error without the thrown message", async () => {
    const secretMarker = "postgres://internal-host/private-table";
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
    knowledgeMocks.matchSafetyKnowledge.mockImplementation(() => {
      throw new Error(secretMarker);
    });
    const { GET } = await import("@/app/api/knowledge/match/route");

    const response = await GET(new NextRequest("http://localhost/api/knowledge/match?question=scaffold"));
    const body = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(500);
    expect(body).toMatchObject({
      ok: false,
      code: "KNOWLEDGE_MATCH_FAILED",
      message: "안전 지식 매칭을 완료하지 못했습니다.",
    });
    expect(body.correlationId).toMatch(/^[0-9a-f-]{36}$/u);
    expect(JSON.stringify(body)).not.toContain(secretMarker);
    expect(JSON.stringify(errorLog.mock.calls)).not.toContain(secretMarker);
  });

  it("applies the same stable error boundary to public knowledge POST", async () => {
    const secretMarker = "supabase private schema from POST matcher";
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
    knowledgeMocks.matchSafetyKnowledge.mockImplementation(() => {
      throw new Error(secretMarker);
    });
    const { POST } = await import("@/app/api/knowledge/match/route");

    const response = await POST(new NextRequest("http://localhost/api/knowledge/match", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question: "scaffold" }),
    }));
    const body = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(500);
    expect(body).toMatchObject({
      ok: false,
      code: "KNOWLEDGE_MATCH_FAILED",
      message: "안전 지식 매칭을 완료하지 못했습니다.",
    });
    expect(body.correlationId).toMatch(/^[0-9a-f-]{36}$/u);
    expect(JSON.stringify(body)).not.toContain(secretMarker);
    expect(JSON.stringify(errorLog.mock.calls)).not.toContain(secretMarker);
  });

  it("does not place a failed n8n response body in the thrown error", async () => {
    const secretMarker = "internal webhook body with bearer-secret";
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(secretMarker, { status: 502 })));
    const { postWebhookWithTimeout } = await import("@/lib/n8n-webhook");

    await expect(postWebhookWithTimeout(
      "https://n8n.example/webhook",
      "relay-secret",
      { event: "contract-test" },
    )).rejects.not.toThrow(secretMarker);
  });

  it("projects only bounded receipt fields from a successful n8n response", async () => {
    const secretMarker = "internal workflow debug payload";
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      ok: true,
      workflowRunId: "run-123",
      providerStatus: "accepted",
      message: secretMarker,
      summary: { debug: secretMarker },
      channelResults: [{
        channel: "email",
        provider: secretMarker,
        status: "sent",
        message: secretMarker,
        httpStatus: 202,
      }],
    }), { status: 200 })));
    const { postWebhookWithTimeout } = await import("@/lib/n8n-webhook");

    const response = await postWebhookWithTimeout(
      "https://n8n.example/webhook",
      "relay-secret",
      { event: "contract-test" },
    );

    expect(response).toEqual({
      ok: true,
      workflowRunId: "run-123",
      providerStatus: "accepted",
      channelResults: [{ channel: "email", status: "sent", httpStatus: 202 }],
      message: "n8n 웹훅이 요청을 접수했습니다.",
    });
    expect(JSON.stringify(response)).not.toContain(secretMarker);
  });
});
