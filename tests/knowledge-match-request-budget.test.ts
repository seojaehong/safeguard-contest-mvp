import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { POST } from "@/app/api/knowledge/match/route";
import { PUBLIC_KNOWLEDGE_MATCH_REQUEST_MAX_BYTES } from "@/lib/public-work-budget";

function request(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/knowledge/match", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("knowledge match request body budget", () => {
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
