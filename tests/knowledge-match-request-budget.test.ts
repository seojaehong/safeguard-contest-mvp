import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET, POST } from "@/app/api/knowledge/match/route";
import {
  PUBLIC_KNOWLEDGE_MATCH_REQUEST_MAX_BYTES,
  PUBLIC_KNOWLEDGE_QUESTION_MAX_CHARS,
} from "@/lib/public-work-budget";

function request(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/knowledge/match", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("knowledge match request body budget", () => {
  beforeEach(() => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("fails closed before matching when distributed admission is misconfigured", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await POST(request({ question: "고소작업 안전조치" }));

    expect(response.status).toBe(503);
    expect(response.headers.get("X-SafeClaw-Rate-Limit")).toBe("distributed");
    error.mockRestore();
  });

  it("requires durable admission in production", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await POST(request({ question: "고소작업 안전조치" }));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      code: "DISTRIBUTED_RATE_LIMIT_UNAVAILABLE",
    });
    error.mockRestore();
  });

  it.each(["GET", "POST"])("rejects oversized %s questions", async (method) => {
    const question = "추락 위험 ".repeat(PUBLIC_KNOWLEDGE_QUESTION_MAX_CHARS);
    const response = method === "GET"
      ? await GET(new NextRequest(`http://localhost/api/knowledge/match?question=${encodeURIComponent(question)}`))
      : await POST(request({ question }));
    const body = await response.json() as { code: string; limit: number };

    expect(response.status).toBe(413);
    expect(body).toMatchObject({
      code: "PUBLIC_WORK_BUDGET_EXCEEDED",
      limit: PUBLIC_KNOWLEDGE_QUESTION_MAX_CHARS,
    });
  });
  it("rejects an oversized body before JSON parsing", async () => {
    const response = await POST(request({
      question: "고소작업 안전조치",
      ignored: "x".repeat(PUBLIC_KNOWLEDGE_MATCH_REQUEST_MAX_BYTES),
    }));
    const body = await response.json() as { code: string; limit: number };

    expect(response.status).toBe(413);
    expect(body).toMatchObject({
      code: "PUBLIC_WORK_BUDGET_EXCEEDED",
      limit: PUBLIC_KNOWLEDGE_MATCH_REQUEST_MAX_BYTES,
    });
  });

  it("preserves bounded knowledge matching", async () => {
    const response = await POST(request({ question: "고소작업 안전조치", limit: 2 }));
    const body = await response.json() as { ok: boolean; matches: unknown[] };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.matches.length).toBeLessThanOrEqual(2);
  });
});
