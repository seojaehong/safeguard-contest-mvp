import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  acquirePublicAskWorkLease: vi.fn(),
  buildKnowledgeCandidateDraft: vi.fn(),
  createSupabaseAdminClient: vi.fn(),
  getWorkspaceUser: vi.fn(),
  prepareKnowledgeReviewCandidate: vi.fn()
}));

type PrepareFunction = typeof import("@/lib/knowledge-review-prepare").prepareKnowledgeReviewCandidate;

const RUN_ID = "11111111-1111-4111-8111-111111111111";

vi.mock("@/lib/supabase-admin", () => ({
  createSupabaseAdminClient: mocks.createSupabaseAdminClient,
  getWorkspaceUser: mocks.getWorkspaceUser
}));

vi.mock("@/lib/knowledge-review-prepare", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/knowledge-review-prepare")>();
  return {
    ...original,
    prepareKnowledgeReviewCandidate: mocks.prepareKnowledgeReviewCandidate
  };
});

vi.mock("@/lib/knowledge-candidate-route", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/knowledge-candidate-route")>();
  return {
    ...original,
    buildKnowledgeCandidateDraft: mocks.buildKnowledgeCandidateDraft
  };
});

vi.mock("@/lib/public-ask-admission", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/public-ask-admission")>();
  return {
    ...original,
    acquirePublicAskWorkLease: mocks.acquirePublicAskWorkLease
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createSupabaseAdminClient.mockReturnValue(null);
  mocks.acquirePublicAskWorkLease.mockResolvedValue({
    weight: 2,
    release: vi.fn(async () => undefined)
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function request(body: unknown, options: { ip?: string; signal?: AbortSignal } = {}) {
  return new NextRequest("http://localhost/api/knowledge/review/prepare", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: "Bearer fixture",
      "x-forwarded-for": options.ip || "198.51.100.90"
    },
    body: JSON.stringify(body),
    signal: options.signal
  });
}

describe("knowledge review prepare route", () => {
  it("fails closed before auth or preparation when distributed admission is partially configured", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { POST } = await import("@/app/api/knowledge/review/prepare/route");

    const response = await POST(request({ runId: RUN_ID }, { ip: "198.51.100.89" }));

    expect(response.status).toBe(503);
    expect(mocks.createSupabaseAdminClient).not.toHaveBeenCalled();
    expect(mocks.getWorkspaceUser).not.toHaveBeenCalled();
    expect(mocks.prepareKnowledgeReviewCandidate).not.toHaveBeenCalled();
    expect(mocks.acquirePublicAskWorkLease).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledOnce();
  });

  it("fails closed when persistence or authentication is unavailable", async () => {
    const { POST } = await import("@/app/api/knowledge/review/prepare/route");
    const unconfigured = await POST(request({ runId: RUN_ID }));
    expect(unconfigured.status).toBe(503);

    mocks.createSupabaseAdminClient.mockReturnValue({});
    mocks.getWorkspaceUser.mockResolvedValue(null);
    const unauthenticated = await POST(request({ runId: RUN_ID }));
    expect(unauthenticated.status).toBe(401);
    expect(mocks.prepareKnowledgeReviewCandidate).not.toHaveBeenCalled();
  });

  it("rejects an invalid body before candidate preparation", async () => {
    mocks.createSupabaseAdminClient.mockReturnValue({});
    mocks.getWorkspaceUser.mockResolvedValue({ id: "reviewer-1", email: null });
    const { POST } = await import("@/app/api/knowledge/review/prepare/route");

    const response = await POST(request({ runId: " " }));
    expect(response.status).toBe(400);
    expect(mocks.prepareKnowledgeReviewCandidate).not.toHaveBeenCalled();
  });

  it.each(["run-1", "11111111-1111-1111-8111-111111111111", "{11111111-1111-4111-8111-111111111111}"])(
    "rejects non-canonical UUID %s before database preparation",
    async (runId) => {
      mocks.createSupabaseAdminClient.mockReturnValue({});
      mocks.getWorkspaceUser.mockResolvedValue({ id: "reviewer-1", email: null });
      const { POST } = await import("@/app/api/knowledge/review/prepare/route");

      const response = await POST(request({ runId }));

      expect(response.status).toBe(400);
      expect(mocks.createSupabaseAdminClient).not.toHaveBeenCalled();
      expect(mocks.getWorkspaceUser).not.toHaveBeenCalled();
      expect(mocks.prepareKnowledgeReviewCandidate).not.toHaveBeenCalled();
    }
  );

  it("returns only the bounded unpublished preparation result", async () => {
    mocks.createSupabaseAdminClient.mockReturnValue({ from: vi.fn() });
    mocks.getWorkspaceUser.mockResolvedValue({ id: "reviewer-1", email: null });
    mocks.prepareKnowledgeReviewCandidate.mockResolvedValue({
      ok: true,
      runId: RUN_ID,
      status: "review_required",
      candidate: {
        contractVersion: "knowledge-candidate.v2",
        generatedText: "난간 상태를 확인합니다.",
        publicationState: "unpublished",
        publishAllowed: false
      },
      configured: true,
      publicationState: "unpublished",
      ontologyPublished: false,
      legalConfirmed: false,
      rawEventPayloadIncluded: false
    });
    const { POST } = await import("@/app/api/knowledge/review/prepare/route");

    const response = await POST(request({ runId: RUN_ID }));
    const payload = await response.json();
    const serialized = JSON.stringify(payload);

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      ok: true,
      status: "review_required",
      publicationState: "unpublished",
      ontologyPublished: false,
      rawEventPayloadIncluded: false
    });
    expect(serialized).not.toMatch(/base64-secret|signature=secret|residentNumber/u);
  });

  it("fails closed before preparation when provider concurrency is unavailable", async () => {
    mocks.createSupabaseAdminClient.mockReturnValue({ from: vi.fn() });
    mocks.getWorkspaceUser.mockResolvedValue({ id: "reviewer-1", email: null });
    mocks.acquirePublicAskWorkLease.mockResolvedValueOnce(null);
    const { POST } = await import("@/app/api/knowledge/review/prepare/route");

    const response = await POST(request({ runId: RUN_ID }, { ip: "198.51.100.91" }));
    const payload = await response.json() as { code: string };

    expect(response.status).toBe(503);
    expect(payload.code).toBe("PUBLIC_ASK_CONCURRENCY_LIMIT");
    expect(mocks.prepareKnowledgeReviewCandidate).not.toHaveBeenCalled();
    expect(mocks.buildKnowledgeCandidateDraft).not.toHaveBeenCalled();
  });

  it("distinguishes distributed admission failure from temporary provider concurrency", async () => {
    mocks.createSupabaseAdminClient.mockReturnValue({ from: vi.fn() });
    mocks.getWorkspaceUser.mockResolvedValue({ id: "reviewer-1", email: null });
    mocks.acquirePublicAskWorkLease.mockRejectedValueOnce(
      new Error("fixture private distributed admission detail")
    );
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { POST } = await import("@/app/api/knowledge/review/prepare/route");

    const response = await POST(request({ runId: RUN_ID }, { ip: "198.51.100.94" }));
    const payload = await response.json() as { code: string; message: string };

    expect(response.status).toBe(503);
    expect(payload).toEqual({
      ok: false,
      configured: false,
      code: "DISTRIBUTED_RATE_LIMIT_UNAVAILABLE",
      message: "AI 강화 후보 준비는 분산 보호 설정이 완료될 때까지 잠겨 있습니다."
    });
    expect(JSON.stringify(payload)).not.toContain("fixture private distributed admission detail");
    expect(mocks.prepareKnowledgeReviewCandidate).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledOnce();
  });

  it("keeps coalesced preparation alive until the final consumer disconnects", async () => {
    const release = vi.fn(async () => undefined);
    mocks.acquirePublicAskWorkLease.mockResolvedValueOnce({ weight: 2, release });
    mocks.createSupabaseAdminClient.mockReturnValue({ from: vi.fn() });
    mocks.getWorkspaceUser.mockResolvedValue({ id: "reviewer-1", email: null });
    let generationSignal: AbortSignal | undefined;
    mocks.buildKnowledgeCandidateDraft.mockImplementationOnce((input: { signal?: AbortSignal }) => {
      generationSignal = input.signal;
      return new Promise((_resolve, reject) => {
        input.signal?.addEventListener("abort", () => reject(input.signal?.reason), { once: true });
      });
    });
    mocks.prepareKnowledgeReviewCandidate.mockImplementationOnce(async (...args: Parameters<PrepareFunction>) => {
      await args[3].buildCandidate({
        runId: RUN_ID,
        question: "원본 이벤트 1건 기반 현장 지식 후보 검토",
        rawEvents: [],
        tenantContext: { organizationId: "org-1", siteId: "site-1" }
      });
      throw new Error("unreachable after stalled generation");
    });
    const firstController = new AbortController();
    const secondController = new AbortController();
    const { POST } = await import("@/app/api/knowledge/review/prepare/route");

    const first = POST(request({ runId: RUN_ID }, {
      ip: "198.51.100.92",
      signal: firstController.signal
    }));
    const second = POST(request({ runId: RUN_ID }, {
      ip: "198.51.100.93",
      signal: secondController.signal
    }));
    await vi.waitFor(() => expect(mocks.prepareKnowledgeReviewCandidate).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(generationSignal).toBeInstanceOf(AbortSignal));

    const firstReason = new Error("first review consumer disconnected");
    firstController.abort(firstReason);
    await expect(first).rejects.toBe(firstReason);
    expect(generationSignal?.aborted).toBe(false);
    expect(release).not.toHaveBeenCalled();

    const secondReason = new Error("final review consumer disconnected");
    secondController.abort(secondReason);
    await expect(second).rejects.toBe(secondReason);
    expect(generationSignal?.aborted).toBe(true);
    await vi.waitFor(() => expect(release).toHaveBeenCalledTimes(1));
  });
});
