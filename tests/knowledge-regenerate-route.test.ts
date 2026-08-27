import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateKnowledgeText } from "@/lib/ai";
import {
  PUBLIC_KNOWLEDGE_REGENERATION_REQUEST_MAX_BYTES,
  PUBLIC_KNOWLEDGE_QUESTION_MAX_CHARS,
  PUBLIC_KNOWLEDGE_RAW_EVENT_MAX_CHARS,
  PUBLIC_KNOWLEDGE_RAW_EVENTS_MAX_COUNT
} from "@/lib/public-work-budget";

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

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("fails closed before candidate parsing or AI generation when distributed admission is misconfigured", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { POST } = await import("@/app/api/knowledge/regenerate/route");

    const response = await POST(new NextRequest("http://localhost/api/knowledge/regenerate", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "198.51.100.41"
      },
      body: JSON.stringify({
        question: "추락 위험 통제대책을 검토해줘",
        generate: true,
        tenantContext: { organizationId: "org-1", siteId: "site-1" },
        rawEvents: []
      })
    }));
    const payload = await response.json() as { code: string };

    expect(response.status).toBe(503);
    expect(payload.code).toBe("DISTRIBUTED_RATE_LIMIT_UNAVAILABLE");
    expect(generateKnowledgeText).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledTimes(1);
    error.mockRestore();
  });

  it("fails closed before body parsing or AI generation when production distributed admission is absent", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { POST } = await import("@/app/api/knowledge/regenerate/route");

    const response = await POST(new NextRequest("http://localhost/api/knowledge/regenerate", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "198.51.100.42"
      },
      body: "not-json"
    }));
    const payload = await response.json() as { code: string };

    expect(response.status).toBe(503);
    expect(response.headers.get("X-SafeClaw-Rate-Limit")).toBe("distributed");
    expect(payload.code).toBe("DISTRIBUTED_RATE_LIMIT_UNAVAILABLE");
    expect(generateKnowledgeText).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledTimes(1);
    error.mockRestore();
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

  it("rejects oversized knowledge questions before AI generation", async () => {
    const { POST } = await import("@/app/api/knowledge/regenerate/route");
    const response = await POST(new NextRequest("http://localhost/api/knowledge/regenerate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        question: "추락 위험 ".repeat(PUBLIC_KNOWLEDGE_QUESTION_MAX_CHARS),
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

    expect(response.status).toBe(413);
    expect(payload).toMatchObject({
      code: "PUBLIC_WORK_BUDGET_EXCEEDED",
      limit: PUBLIC_KNOWLEDGE_QUESTION_MAX_CHARS
    });
    expect(generateKnowledgeText).not.toHaveBeenCalled();
  });

  it("rejects oversized knowledge regeneration bodies before JSON parsing or AI generation", async () => {
    const { POST } = await import("@/app/api/knowledge/regenerate/route");
    const response = await POST(new NextRequest("http://localhost/api/knowledge/regenerate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "x".repeat(PUBLIC_KNOWLEDGE_REGENERATION_REQUEST_MAX_BYTES + 1)
    }));

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toMatchObject({
      code: "PUBLIC_WORK_BUDGET_EXCEEDED",
      limit: PUBLIC_KNOWLEDGE_REGENERATION_REQUEST_MAX_BYTES
    });
    expect(generateKnowledgeText).not.toHaveBeenCalled();
  });

  it("rejects oversized raw event collections before candidate generation", async () => {
    const { POST } = await import("@/app/api/knowledge/regenerate/route");
    const rawEvents = Array.from({ length: PUBLIC_KNOWLEDGE_RAW_EVENTS_MAX_COUNT + 1 }, (_, index) => ({
      source: "manual",
      sourceId: `manual-${index}`,
      capturedAt: "2026-07-14T10:00:00.000Z",
      title: "작업 절차",
      payload: { note: "bounded" },
      relatedHazardIds: ["hazard-fall"],
      reflectedDocuments: ["위험성평가표"]
    }));
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
        rawEvents
      })
    }));
    const payload = await response.json();

    expect(response.status).toBe(413);
    expect(payload).toMatchObject({
      code: "PUBLIC_WORK_BUDGET_EXCEEDED",
      limit: PUBLIC_KNOWLEDGE_RAW_EVENTS_MAX_COUNT
    });
    expect(generateKnowledgeText).not.toHaveBeenCalled();
  });

  it("rejects oversized raw event payloads before AI generation", async () => {
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
          source: "manual",
          sourceId: "manual-oversized",
          capturedAt: "2026-07-14T10:00:00.000Z",
          title: "작업 절차",
          payload: { note: "x".repeat(PUBLIC_KNOWLEDGE_RAW_EVENT_MAX_CHARS) },
          relatedHazardIds: ["hazard-fall"],
          reflectedDocuments: ["위험성평가표"]
        }]
      })
    }));
    const payload = await response.json();

    expect(response.status).toBe(413);
    expect(payload).toMatchObject({
      code: "PUBLIC_WORK_BUDGET_EXCEEDED",
      limit: PUBLIC_KNOWLEDGE_RAW_EVENT_MAX_CHARS
    });
    expect(generateKnowledgeText).not.toHaveBeenCalled();
  });

  it("executes zero mutation gateway writes while returning a candidate", async () => {
    const mutationWrite = vi.fn(async () => undefined);
    const release = vi.fn(async () => undefined);
    const { createKnowledgeCandidatePostHandler } = await import("@/lib/knowledge-candidate-route");
    const post = createKnowledgeCandidatePostHandler({
      generateText: vi.mocked(generateKnowledgeText),
      mutationGateway: { write: mutationWrite },
      acquireGenerationLease: async () => ({
        weight: 2,
        release
      })
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
    expect(release).toHaveBeenCalledTimes(1);
  });

  it("builds a four-section stateless fallback without calling an AI provider", async () => {
    const { POST } = await import("@/app/api/knowledge/regenerate/route");
    const response = await POST(new NextRequest("http://localhost/api/knowledge/regenerate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        question: "밀폐공간 탱크 작업의 산소결핍 통제대책을 검토해줘",
        generate: false,
        tenantContext: { organizationId: "org-1", siteId: "site-1" },
        rawEvents: [{
          source: "lawgo",
          sourceId: "law-confined-space",
          capturedAt: "2026-08-25T00:00:00.000Z",
          title: "밀폐공간 작업 현행 법령 검토 이벤트",
          payload: {
            scenario: "탱크 내부 산소결핍",
            reviewFacts: ["입구 감시인 1명 상시 배치", "worker-phone: 010-9876-5432"]
          },
          relatedHazardIds: ["confined-space"],
          reflectedDocuments: ["위험성평가표", "비상대응 절차"]
        }, {
          source: "kosha-accident",
          sourceId: "sif-confined-space",
          capturedAt: "2026-08-25T00:00:01.000Z",
          title: "SIF 밀폐공간 질식 사고 통제 사례",
          payload: { item_type: "sif-case" },
          relatedHazardIds: ["confined-space"],
          reflectedDocuments: ["위험성평가표", "TBM 브리핑", "비상대응 절차"]
        }]
      })
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(generateKnowledgeText).not.toHaveBeenCalled();
    expect(payload).toMatchObject({
      configured: false,
      storageMode: "stateless_candidate",
      savedRunId: null,
      candidate: {
        generatedBy: "safeclaw_candidate_builder",
        matchedHazardIds: ["confined-space"],
        dbMutationPerformed: false,
        publishAllowed: false
      },
      contentReadiness: {
        status: "ready_for_human_review",
        requiredSectionCount: 4,
        presentSectionCount: 4,
        nonEmptySectionCount: 4,
        placeholderFindingCount: 0,
        legalOverclaimFindingCount: 0,
        lawProvenancePresent: true,
        sifProvenancePresent: true,
        sifEvidenceVisible: true,
        hazardGroundingPresent: true,
        unresolvedReviewItems: [],
        humanReviewCompleted: false,
        publicationState: "unpublished",
        publishAllowed: false
      },
      generated: {
        configured: false,
        providerLabel: null,
        fallbackUsed: true
      }
    });
    expect(payload.candidate.generatedText).toContain("밀폐공간 산소결핍·중독");
    expect(payload.candidate.generatedText).toContain("원본 이벤트 검토 사실: 입구 감시인 1명 상시 배치");
    expect(payload.candidate.generatedText).not.toContain("worker-phone");
    expect(payload.candidate.generatedText).not.toContain("010-9876-5432");
    expect(payload.candidate.generatedText).toContain("출입 전 산소·유해가스 측정");
    expect(payload.candidate.generatedText).toContain("SIF 재해·통제 근거 - SIF 밀폐공간 질식 사고 통제 사례");
    expect(payload.candidate.generatedText).toContain("KOSHA 기술·공식자료 후보 - 안전보건법령 스마트검색");
    expect(payload.candidate.generatedText).toContain("현행 법령 후보 - 법제처 국가법령정보 산업안전보건법");
    expect(payload.candidate.generatedText.indexOf("SIF 재해·통제 근거")).toBeLessThan(
      payload.candidate.generatedText.indexOf("KOSHA 기술·공식자료 후보")
    );
    expect(payload.candidate.generatedText.indexOf("KOSHA 기술·공식자료 후보")).toBeLessThan(
      payload.candidate.generatedText.indexOf("현행 법령 후보")
    );
    expect(payload.reviewContract).toMatchObject({
      presentAuthorityIds: ["sif", "law"],
      sourceRoleCounts: { sifIncidentControlEvidence: 1, lawStatutorySource: 1 }
    });
    expect(payload.candidate.generatedText).toContain("기술 참고 후보로만 사용");
    expect(payload.candidate.generatedText).toContain("이 후보는 사람 검토 전 게시하지 않습니다");
  });

  it("fails closed before AI generation when provider concurrency admission is full", async () => {
    const { createKnowledgeCandidatePostHandler } = await import("@/lib/knowledge-candidate-route");
    const post = createKnowledgeCandidatePostHandler({
      generateText: vi.mocked(generateKnowledgeText),
      mutationGateway: { write: vi.fn(async () => undefined) },
      acquireGenerationLease: async () => null
    });
    const response = await post(new NextRequest("http://localhost/api/knowledge/regenerate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        question: "추락 위험 통제대책을 검토해줘",
        generate: true,
        tenantContext: { organizationId: "org-1", siteId: "site-1" },
        rawEvents: [{
          source: "manual",
          sourceId: "manual-1",
          capturedAt: "2026-07-14T10:00:00.000Z",
          title: "작업 절차",
          payload: { note: "bounded" },
          relatedHazardIds: ["hazard-fall"],
          reflectedDocuments: ["위험성평가표"]
        }]
      })
    }));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ code: "PUBLIC_ASK_CONCURRENCY_LIMIT" });
    expect(generateKnowledgeText).not.toHaveBeenCalled();
  });

  it("returns an unpublished candidate that can only advance to human review", async () => {
    vi.mocked(generateKnowledgeText).mockResolvedValueOnce({
      configured: true,
      text: [
        "1) 위험요인 요약: 작업발판 단부 추락 위험",
        "2) 문서 반영 위치: 위험성평가표와 TBM 브리핑",
        "3) 통제대책: 안전난간 설치 상태를 작업 전 확인",
        "4) 검수 필요 항목: 현장 책임자가 실제 설치 상태 확인"
      ].join("\n"),
      providerLabel: "Hermes",
      policyNote: "candidate only"
    });
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
    expect(response.headers.get("X-SafeClaw-Rate-Limit")).toBe("instance");
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
      },
      reviewContract: {
        contractVersion: "knowledge-candidate-review.v1",
        status: "human_review_required",
        authorityOrder: [
          "sif",
          "kosha",
          "law",
          "organization_history",
          "site_history",
          "external_context"
        ],
        presentAuthorityIds: ["law"],
        sourceRoleCounts: {
          sifIncidentControlEvidence: 0,
          koshaTechnicalGuidance: 0,
          lawStatutorySource: 1,
          organizationPrivateMemory: 0,
          sitePrivateMemory: 0,
          externalContext: 0
        },
        statutoryClaimsRequireLawProvenance: true,
        tenantMemoryPublicPromotionAllowed: false,
        siteManagerAcceptanceRequiredBeforeWorkpackUse: true,
        publicationState: "unpublished",
        humanReviewRequired: true,
        machineEvidenceReplacesHumanReview: false,
        dbMutationAllowed: false,
        publishAllowed: false
      },
      contentReadiness: {
        contractVersion: "knowledge-candidate-content-readiness.v1",
        status: "ready_for_human_review",
        requiredSectionCount: 4,
        presentSectionCount: 4,
        nonEmptySectionCount: 4,
        placeholderFindingCount: 0,
        legalOverclaimFindingCount: 0,
        statutoryClaimDetected: false,
        lawProvenancePresent: true,
        hazardGroundingPresent: true,
        unresolvedReviewItems: [],
        humanReviewCompleted: false,
        publicationState: "unpublished",
        publishAllowed: false
      }
    });
    expect(payload.candidate.provenance[0]).toMatchObject({
      authorityId: "law",
      authority: "statutory_source"
    });
  });

  it("forwards caller cancellation into knowledge generation", async () => {
    const controller = new AbortController();
    const reason = new Error("knowledge caller disconnected");
    vi.mocked(generateKnowledgeText).mockImplementationOnce((_prompt: string, signal?: AbortSignal) => (
      new Promise((_, reject) => {
        signal?.addEventListener("abort", () => reject(signal.reason), { once: true });
      })
    ));
    const { POST } = await import("@/app/api/knowledge/regenerate/route");
    const pending = POST(new NextRequest("http://localhost/api/knowledge/regenerate", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "198.51.100.55" },
      signal: controller.signal,
      body: JSON.stringify({
        question: "추락 위험 통제대책을 검토해줘",
        generate: true,
        tenantContext: { organizationId: "org-1", siteId: "site-1" },
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
    await vi.waitFor(() => expect(generateKnowledgeText).toHaveBeenCalledTimes(1));
    const providerSignal = vi.mocked(generateKnowledgeText).mock.calls[0]?.[1];
    expect(providerSignal?.aborted).toBe(false);

    controller.abort(reason);
    await expect(pending).rejects.toBe(reason);
    expect(providerSignal?.aborted).toBe(true);
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
            reviewFacts: ["작업 전 보호구 상태 재확인", "resident-id: 900101-1234567"],
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
        topLevelKeyCount: 4,
        omittedTopLevelKeyCount: 2,
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
    expect(prompt).toContain("원본 이벤트 검토 사실(명시적 reviewFacts만 사용)");
    expect(prompt).toContain("작업 전 보호구 상태 재확인");
    expect(prompt).toContain("SIF 재해·통제 근거 → KOSHA 기술지침 → 현행 법령");
    expect(prompt).toContain("문서팩 적용 전 현장 책임자 확인");
    expect(payload.reviewContract).toMatchObject({
      presentAuthorityIds: ["site_history"],
      sourceRoleCounts: {
        sitePrivateMemory: 1
      },
      tenantMemoryPublicPromotionAllowed: false,
      siteManagerAcceptanceRequiredBeforeWorkpackUse: true
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
