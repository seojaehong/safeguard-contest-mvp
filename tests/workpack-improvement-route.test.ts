import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { parseOperationImprovements } from "@/lib/operation-improvement-history";

const mocks = vi.hoisted(() => ({
  analyzeImprovementPhotos: vi.fn(),
  insert: vi.fn(),
  validateHazardPhotoFile: vi.fn()
}));

vi.mock("@/lib/supabase-admin", () => ({
  createSupabaseAdminClient: () => {
    const query = {
      insert(value: unknown) {
        mocks.insert(value);
        return query;
      },
      select() {
        return query;
      },
      async single() {
        return { data: { id: "improvement-db-1" }, error: null };
      }
    };
    return {
      from: () => query,
      storage: {
        from: () => ({
          upload: async () => ({ error: null }),
          remove: async () => ({ error: null })
        })
      }
    };
  },
  getWorkspaceUser: async () => ({ id: "user-1", email: "user@example.com" }),
  toJson: (value: unknown) => value
}));

vi.mock("@/lib/workpack-commercial-store", () => ({
  loadOwnedWorkpackOperationContext: async () => ({
    ok: true,
    context: {
      organizationId: "org-1",
      siteId: "site-1",
      workpackId: "workpack-1",
      question: "성수동 외벽 도장"
    }
  })
}));

vi.mock("@/lib/photo-vision-analysis", () => ({
  MAX_HAZARD_PHOTO_REQUEST_BYTES: 41 * 1024 * 1024,
  MAX_HAZARD_PHOTO_TOTAL_BYTES: 40 * 1024 * 1024,
  analyzeImprovementPhotos: mocks.analyzeImprovementPhotos,
  validateHazardPhotoFile: mocks.validateHazardPhotoFile,
  buildImprovementAnalysisPayload: () => ({
    sourcePhotoNames: [],
    photoCount: 0,
    siteSignals: [],
    visionEvidence: "",
    photoPairAttached: false,
    analysisMode: "manual_text",
    userLabel: "관리자 메모",
    exportable: true
  })
}));

function improvementVisionResult() {
  return {
    status: "unconfigured",
    provider: "none",
    model: "none",
    summary: "수동 개선사항",
    observedImprovement: "난간 보강",
    detectedHazards: [],
    ocrText: "",
    sourcePhotoNames: [],
    photoCount: 0,
    siteSignals: [],
    visionEvidence: "",
    reflectedDocuments: ["위험성평가표"],
    errorMessage: ""
  };
}

function multipartRequest(form: FormData, contentLength: number) {
  return {
    headers: new Headers({
      authorization: "Bearer route-test-token",
      "content-length": String(contentLength),
      "content-type": "multipart/form-data; boundary=contract-test",
      "x-forwarded-for": `198.51.100.${contentLength % 200 + 1}`
    }),
    formData: vi.fn(async () => form)
  } as unknown as NextRequest;
}

describe("workpack improvement POST status contract", () => {
  beforeEach(() => {
    mocks.analyzeImprovementPhotos.mockReset();
    mocks.analyzeImprovementPhotos.mockResolvedValue(improvementVisionResult());
    mocks.insert.mockClear();
    mocks.validateHazardPhotoFile.mockReset();
    mocks.validateHazardPhotoFile.mockResolvedValue(null);
  });

  it("returns the canonical DB review status for lossless local snapshot persistence", async () => {
    const { POST } = await import("@/app/api/workpacks/[id]/improvements/route");
    const response = await POST(new NextRequest(
      "http://localhost/api/workpacks/workpack-1/improvements",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          taskLabel: "외벽 도장",
          hazardLabel: "추락",
          improvementText: "난간 보강",
          reflectedDocuments: ["위험성평가표"]
        })
      }
    ), { params: Promise.resolve({ id: "workpack-1" }) });
    const body = await response.json() as {
      improvementId: string;
      reviewStatus: string;
    };

    expect(response.status).toBe(200);
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({
      review_status: "candidate"
    }));
    expect(body).toMatchObject({
      improvementId: "improvement-db-1",
      reviewStatus: "candidate"
    });

    const localSnapshot = parseOperationImprovements(JSON.stringify([{
      id: body.improvementId,
      createdAt: "2026-07-11T00:00:00.000Z",
      siteName: "성수동 현장",
      workSummary: "외벽 도장",
      hazardLabel: "추락",
      improvementText: "난간 보강",
      reflectedDocuments: ["위험성평가표"],
      status: body.reviewStatus
    }]));
    expect(localSnapshot[0]?.status).toBe("candidate");
  });

  it("rejects oversized improvement photo requests before multipart parsing or persistence", async () => {
    const { POST } = await import("@/app/api/workpacks/[id]/improvements/route");
    const request = multipartRequest(new FormData(), 41 * 1024 * 1024 + 1);

    const response = await POST(request, { params: Promise.resolve({ id: "workpack-1" }) });

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toMatchObject({ code: "photo_payload_too_large" });
    expect(request.formData).not.toHaveBeenCalled();
    expect(mocks.analyzeImprovementPhotos).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("fails closed on invalid photo signatures before provider or DB work", async () => {
    mocks.validateHazardPhotoFile.mockResolvedValueOnce({
      code: "invalid_signature",
      message: "before.jpg의 파일 내용이 선언된 MIME 형식과 일치하지 않습니다.",
      retryable: false
    });
    const form = new FormData();
    form.set("beforePhoto", new File(["not-a-jpeg"], "before.jpg", { type: "image/jpeg" }));
    form.set("afterPhoto", new File(["not-a-jpeg"], "after.jpg", { type: "image/jpeg" }));
    const { POST } = await import("@/app/api/workpacks/[id]/improvements/route");

    const response = await POST(
      multipartRequest(form, 2048),
      { params: Promise.resolve({ id: "workpack-1" }) }
    );

    expect(response.status).toBe(400);
    expect(response.headers.get("X-SafeClaw-Work-Unit")).toBe("photo-analysis");
    await expect(response.json()).resolves.toMatchObject({ code: "invalid_signature" });
    expect(mocks.analyzeImprovementPhotos).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("rejects unexpected or excess file fields before provider or DB work", async () => {
    const form = new FormData();
    form.set("beforePhoto", new File(["one"], "before.jpg", { type: "image/jpeg" }));
    form.set("afterPhoto", new File(["two"], "after.jpg", { type: "image/jpeg" }));
    form.set("extraPhoto", new File(["three"], "extra.jpg", { type: "image/jpeg" }));
    const { POST } = await import("@/app/api/workpacks/[id]/improvements/route");

    const response = await POST(
      multipartRequest(form, 4096),
      { params: Promise.resolve({ id: "workpack-1" }) }
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: "unexpected_photo_field" });
    expect(mocks.validateHazardPhotoFile).not.toHaveBeenCalled();
    expect(mocks.analyzeImprovementPhotos).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
  });
});
