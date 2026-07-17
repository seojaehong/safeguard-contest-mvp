import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabaseAdminClient: vi.fn(),
  getWorkspaceUser: vi.fn(),
  prepareKnowledgeReviewCandidate: vi.fn()
}));

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

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createSupabaseAdminClient.mockReturnValue(null);
});

function request(body: unknown) {
  return new NextRequest("http://localhost/api/knowledge/review/prepare", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer fixture" },
    body: JSON.stringify(body)
  });
}

describe("knowledge review prepare route", () => {
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
});
