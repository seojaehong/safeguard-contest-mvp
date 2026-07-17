import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateKnowledgeText } from "@/lib/ai";

vi.mock("@/lib/ai", () => ({
  generateKnowledgeText: vi.fn(async () => ({
    configured: true,
    text: "사람 검토가 필요한 후보 초안",
    providerLabel: "Hermes",
    policyNote: "candidate only"
  }))
}));

describe("knowledge candidate API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    ["missing", undefined],
    ["non-array", { source: "lawgo" }],
    ["empty", []]
  ])("rejects %s rawEvents without creating a candidate", async (_label, rawEvents) => {
    const { POST } = await import("@/app/api/knowledge/regenerate/route");
    const response = await POST(new NextRequest("http://localhost/api/knowledge/regenerate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        question: "추락 위험 통제대책을 검토해줘",
        generate: true,
        ...(rawEvents === undefined ? {} : { rawEvents })
      })
    }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toMatchObject({
      ok: false,
      message: "rawEvents must be a non-empty array"
    });
    expect(payload.candidate).toBeUndefined();
    expect(generateKnowledgeText).not.toHaveBeenCalled();
  });

  it.each([
    ["missing", undefined],
    ["missing site", { organizationId: "org-1" }],
    ["missing organization", { siteId: "site-1" }]
  ])("rejects %s tenant context before candidate generation", async (_label, tenantContext) => {
    const { POST } = await import("@/app/api/knowledge/regenerate/route");
    const response = await POST(new NextRequest("http://localhost/api/knowledge/regenerate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        question: "추락 위험 통제대책을 검토해줘",
        generate: true,
        ...(tenantContext === undefined ? {} : { tenantContext }),
        rawEvents: [{
          source: "lawgo",
          sourceId: "law-42",
          capturedAt: "2026-07-14T10:00:00.000Z",
          title: "산업안전보건법 현행 조문",
          payload: { article: "42" },
          relatedHazardIds: ["hazard-fall"],
          reflectedDocuments: ["위험성평가표"]
        }]
      })
    }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toMatchObject({
      ok: false,
      message: "tenantContext.organizationId and tenantContext.siteId are required"
    });
    expect(payload.candidate).toBeUndefined();
    expect(generateKnowledgeText).not.toHaveBeenCalled();
  });

  it("executes zero mutation gateway writes while returning a candidate", async () => {
    const mutationWrite = vi.fn(async () => undefined);
    const { createKnowledgeCandidatePostHandler } = await import("@/lib/knowledge-candidate-route");
    const post = createKnowledgeCandidatePostHandler({
      generateText: vi.mocked(generateKnowledgeText),
      mutationGateway: { write: mutationWrite }
    });
    const response = await post(new NextRequest("http://localhost/api/knowledge/regenerate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        question: "추락 위험 통제대책을 검토해줘",
        generate: true,
        tenantContext: {
          organizationId: "org-1",
          siteId: "site-1"
        },
        rawEvents: [{
          source: "lawgo",
          sourceId: "law-42",
          capturedAt: "2026-07-14T10:00:00.000Z",
          title: "산업안전보건법 현행 조문",
          payload: { article: "42" },
          relatedHazardIds: ["hazard-fall"],
          reflectedDocuments: ["위험성평가표"]
        }]
      })
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.candidate).toMatchObject({
      dbMutationAllowed: false,
      dbMutationPerformed: false,
      publishAllowed: false
    });
    expect(mutationWrite).toHaveBeenCalledTimes(0);
  });

  it("returns an unpublished candidate that can only advance to human review", async () => {
    const { POST } = await import("@/app/api/knowledge/regenerate/route");
    const response = await POST(new NextRequest("http://localhost/api/knowledge/regenerate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        question: "추락 위험 통제대책을 검토해줘",
        generate: true,
        tenantContext: {
          organizationId: "org-1",
          siteId: "site-1"
        },
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

  it("returns tenant-bound immutable provenance without exposing sensitive raw event text", async () => {
    const sensitiveTitle = "김테스트 작업자 사고 원문";
    const sensitivePayload = "resident-id: 900101-1234567";
    const sensitiveUrlToken = "private-access-token";
    const { POST } = await import("@/app/api/knowledge/regenerate/route");
    const response = await POST(new NextRequest("http://localhost/api/knowledge/regenerate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        question: "현장 사고 통제대책을 검토해줘",
        generate: true,
        tenantContext: {
          organizationId: "org-knowledge-1",
          siteId: "site-knowledge-1"
        },
        rawEvents: [{
          source: "manual",
          sourceId: "manual-event-77",
          capturedAt: "2026-07-14T11:00:00.000Z",
          title: sensitiveTitle,
          url: `https://internal.example/events/77?token=${sensitiveUrlToken}`,
          payload: {
            provenanceScope: "site",
            article: `42-${"x".repeat(160)}`,
            privateWorkerNote: sensitivePayload
          },
          relatedHazardIds: ["hazard-fall"],
          reflectedDocuments: ["위험성평가표"]
        }]
      })
    }));
    const payload = await response.json();
    const provenance = payload.candidate.provenance[0];
    const serializedPayload = JSON.stringify(payload);
    const prompt = vi.mocked(generateKnowledgeText).mock.calls[0]?.[0];

    expect(response.status).toBe(200);
    expect(payload.candidate).toMatchObject({
      contractVersion: "knowledge-candidate.v2",
      tenantContext: {
        organizationId: "org-knowledge-1",
        siteId: "site-knowledge-1"
      },
      authority: "none",
      publicationState: "unpublished",
      publishAllowed: false
    });
    expect(provenance).toMatchObject({
      source: "manual",
      authorityId: "site_history",
      scope: "site_private",
      tenantContext: {
        organizationId: "org-knowledge-1",
        siteId: "site-knowledge-1"
      },
      eventReference: {
        sourceId: "manual-event-77",
        capturedAt: "2026-07-14T11:00:00.000Z",
        digestAlgorithm: "sha256"
      },
      payloadEvidence: {
        digestAlgorithm: "sha256",
        topLevelKeyCount: 3,
        omittedTopLevelKeyCount: 1,
        reviewMetadata: {
          provenanceScope: "site"
        },
        metadataTruncated: true
      }
    });
    expect(provenance.eventReference.digest).toMatch(/^[a-f0-9]{64}$/);
    expect(provenance.payloadEvidence.digest).toMatch(/^[a-f0-9]{64}$/);
    expect(provenance.payloadEvidence.reviewMetadata.article.length).toBeLessThanOrEqual(96);
    expect(provenance).not.toHaveProperty("title");
    expect(provenance).not.toHaveProperty("url");
    expect(payload.bundle).toMatchObject({ eventCount: 1 });
    expect(payload.bundle).not.toHaveProperty("rawEvents");
    expect(serializedPayload).not.toContain(sensitiveTitle);
    expect(serializedPayload).not.toContain(sensitivePayload);
    expect(serializedPayload).not.toContain(sensitiveUrlToken);
    expect(prompt).not.toContain(sensitiveTitle);
    expect(prompt).not.toContain(sensitivePayload);
    expect(prompt).not.toContain(sensitiveUrlToken);
    expect(prompt).not.toContain("manual-event-77");
    expect(prompt).not.toContain("provenanceScope");
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
