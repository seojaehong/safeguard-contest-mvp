import fs from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ai", () => ({
  generateKnowledgeText: vi.fn(async () => ({
    configured: true,
    text: "사람 검토가 필요한 후보 초안",
    providerLabel: "Hermes",
    policyNote: "candidate only"
  }))
}));

describe("knowledge candidate API", () => {
  it("keeps the LLM route stateless and free of direct database writes", () => {
    const routeSource = fs.readFileSync(
      path.join(process.cwd(), "app/api/knowledge/regenerate/route.ts"),
      "utf8"
    );

    expect(routeSource).not.toContain("@/lib/supabase-admin");
    expect(routeSource).not.toContain("knowledge_regeneration_runs");
    expect(routeSource).not.toMatch(/\.(?:insert|upsert|update|delete)\s*\(/);
  });

  it("returns an unpublished candidate that can only advance to human review", async () => {
    const { POST } = await import("@/app/api/knowledge/regenerate/route");
    const response = await POST(new NextRequest("http://localhost/api/knowledge/regenerate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        question: "추락 위험 통제대책을 검토해줘",
        generate: true,
        rawEvents: [{
          source: "lawgo",
          sourceId: "law-42",
          capturedAt: "2026-07-14T10:00:00.000Z",
          title: "산업안전보건법 현행 조문",
          url: "https://www.law.go.kr/",
          payload: { article: "42" },
          relatedHazardIds: ["hazard-fall"],
          reflectedDocuments: ["위험성평가표"]
        }]
      })
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      ok: true,
      storageMode: "stateless_candidate",
      savedRunId: null,
      candidate: {
        stage: "candidate",
        reviewStatus: "pending_review",
        publicationState: "unpublished",
        nextStage: "human_review",
        dbMutationAllowed: false,
        dbMutationPerformed: false,
        publishAllowed: false
      }
    });
    expect(payload.candidate.provenance[0]).toMatchObject({
      authorityId: "law",
      authority: "statutory_source"
    });
  });

  it("exposes the same read-only promotion and authority contract", async () => {
    const { GET } = await import("@/app/api/knowledge/governance/route");
    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      ok: true,
      mutationPolicy: {
        llmDbMutationAllowed: false,
        llmPublishAllowed: false,
        humanReviewRequired: true
      }
    });
    expect(payload.stages).toHaveLength(4);
    expect(payload.authorityLanes).toHaveLength(6);
  });
});
