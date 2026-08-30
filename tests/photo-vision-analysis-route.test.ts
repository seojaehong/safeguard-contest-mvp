import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET, POST } from "@/app/api/input-photos/hazard-analysis/route";
import {
  analyzeHazardPhotos,
  HAZARD_PHOTO_FILE_VALIDATION,
  MAX_HAZARD_PHOTO_REQUEST_BYTES
} from "@/lib/photo-vision-analysis";
import { createSupabaseAdminClient, getWorkspaceUser } from "@/lib/supabase-admin";
import { PUBLIC_MULTIPART_BODY_READ_TIMEOUT_MS } from "@/lib/public-work-budget";

vi.mock("@/lib/photo-vision-analysis", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/photo-vision-analysis")>();
  return {
    ...actual,
    analyzeHazardPhotos: vi.fn()
  };
});

vi.mock("@/lib/supabase-admin", () => ({
  createSupabaseAdminClient: vi.fn(),
  getWorkspaceUser: vi.fn()
}));

function multipartRequest(files: File[], contentLength?: number, signal?: AbortSignal): NextRequest {
  const form = new FormData();
  form.set("question", "옥상 방수 작업");
  files.forEach((file) => form.append("photos", file, file.name));
  return {
    headers: new Headers({
      authorization: "Bearer route-test-token",
      "content-length": String(contentLength ?? files.reduce((total, file) => total + file.size, 0) + 512),
      "content-type": "multipart/form-data; boundary=contract-test",
      "x-forwarded-for": `route-test-${files.length}-${files.map((file) => file.name).join("-")}`
    }),
    formData: async () => form,
    signal
  } as unknown as NextRequest;
}

function fileWithReportedSize(name: string, size: number): File {
  const file = new File(["image"], name, { type: "image/jpeg" });
  Object.defineProperty(file, "size", { value: size });
  return file;
}

describe("photo vision hazard analysis route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(analyzeHazardPhotos).mockReset();
    vi.mocked(createSupabaseAdminClient).mockReturnValue({} as never);
    vi.mocked(getWorkspaceUser).mockResolvedValue({ id: "route-user" } as never);
  });

  it("rejects unauthenticated requests before multipart parsing or provider work", async () => {
    vi.mocked(getWorkspaceUser).mockResolvedValue(null);
    const form = new FormData();
    form.append("photos", new File(["image"], "workface.jpg", { type: "image/jpeg" }));
    const formData = vi.fn(async () => form);
    const request = {
      headers: new Headers({
        "content-length": "1024",
        "content-type": "multipart/form-data; boundary=contract-test",
        "x-forwarded-for": "route-test-unauthenticated"
      }),
      formData
    } as unknown as NextRequest;

    const response = await POST(request);

    expect(response.status).toBe(401);
    expect(formData).not.toHaveBeenCalled();
    expect(analyzeHazardPhotos).not.toHaveBeenCalled();
  });

  it("rejects an oversized aggregate even when Content-Length is underreported", async () => {
    const files = [
      fileWithReportedSize("one.jpg", 15 * 1024 * 1024),
      fileWithReportedSize("two.jpg", 15 * 1024 * 1024),
      fileWithReportedSize("three.jpg", 15 * 1024 * 1024)
    ];

    const response = await POST(multipartRequest(files, 1024));
    const body = await response.json() as { ok: boolean; code?: string };

    expect(response.status).toBe(413);
    expect(body).toMatchObject({ ok: false, code: "photo_payload_too_large" });
    expect(analyzeHazardPhotos).not.toHaveBeenCalled();
  });

  it("rejects an oversized Content-Length before multipart parsing", async () => {
    const formData = vi.fn(async () => new FormData());
    const request = {
      headers: new Headers({
        authorization: "Bearer route-test-token",
        "content-length": String(MAX_HAZARD_PHOTO_REQUEST_BYTES + 1),
        "content-type": "multipart/form-data; boundary=contract-test",
        "x-forwarded-for": "route-test-content-length"
      }),
      formData
    } as unknown as NextRequest;

    const response = await POST(request);
    const body = await response.json() as { ok: boolean; code?: string };

    expect(response.status).toBe(413);
    expect(body).toMatchObject({ ok: false, code: "photo_payload_too_large" });
    expect(formData).not.toHaveBeenCalled();
    expect(analyzeHazardPhotos).not.toHaveBeenCalled();
  });

  it("preserves empty files for per-image validation and reports partial success", async () => {
    vi.mocked(analyzeHazardPhotos).mockResolvedValue({
      status: "partial",
      provider: "contract-stub",
      providerMode: "mock",
      model: "vision-contract-v1",
      summary: "한 장 분석, 한 장 거부",
      observations: [],
      candidates: [],
      ocrText: "",
      siteSignals: [],
      photoCount: 2,
      images: [],
      counts: {
        submitted: 2,
        analyzed: 1,
        rejected: 1,
        failed: 0,
        unconfigured: 0,
        candidates: 0
      }
    } as unknown as Awaited<ReturnType<typeof analyzeHazardPhotos>>);

    const response = await POST(multipartRequest([
      new File(["image"], "workface.jpg", { type: "image/jpeg" }),
      new File([], "empty.jpg", { type: "image/jpeg" })
    ]));
    const body = await response.json() as { ok: boolean; analysis: { status: string } };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.analysis.status).toBe("partial");
    expect(vi.mocked(analyzeHazardPhotos).mock.calls[0]?.[0].photos).toHaveLength(2);
  });

  it("returns only coarse capability and upload limits to anonymous callers", async () => {
    const response = await GET(new NextRequest("http://localhost/api/input-photos/hazard-analysis"));
    const body = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      status: expect.stringMatching(/^(ready|unavailable)$/u),
      maxInputPhotos: 10,
      acceptedOnly: true,
      ocrSupported: true
    });
    expect(body).not.toHaveProperty("provider");
    expect(body).not.toHaveProperty("model");
    expect(body).not.toHaveProperty("apiKeyPresent");
    expect(body).not.toHaveProperty("timeoutMs");
    expect(body).not.toHaveProperty("fileValidation");
    expect(body).not.toHaveProperty("hazardAnalysisEndpoint");
    expect(body).not.toHaveProperty("improvementEndpointPattern");
    expect(createSupabaseAdminClient).not.toHaveBeenCalled();
    expect(getWorkspaceUser).not.toHaveBeenCalled();
  });

  it("does not fan out to authentication or expose diagnostics for arbitrary bearer tokens", async () => {
    const response = await GET(new NextRequest("http://localhost/api/input-photos/hazard-analysis", {
      headers: { authorization: "Bearer route-test-token" }
    }));
    const body = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      status: expect.stringMatching(/^(ready|unavailable)$/u),
      maxInputPhotos: 10,
      acceptedOnly: true,
      ocrSupported: true
    });
    expect(body).not.toHaveProperty("provider");
    expect(body).not.toHaveProperty("model");
    expect(body).not.toHaveProperty("apiKeyPresent");
    expect(body).not.toHaveProperty("timeoutMs");
    expect(body).not.toHaveProperty("hazardAnalysisEndpoint");
    expect(createSupabaseAdminClient).not.toHaveBeenCalled();
    expect(getWorkspaceUser).not.toHaveBeenCalled();
  });

  it("times out a stalled authenticated multipart upload before parsing or provider work", async () => {
    vi.useFakeTimers();
    try {
      const cancel = vi.fn();
      const stream = new ReadableStream<Uint8Array>({ cancel });
      const request = new NextRequest(new Request("http://localhost/api/input-photos/hazard-analysis", {
        method: "POST",
        headers: {
          authorization: "Bearer route-test-token",
          "content-length": "1024",
          "content-type": "multipart/form-data; boundary=contract-test",
          "x-forwarded-for": "route-test-slow-multipart"
        },
        body: stream,
        duplex: "half"
      } as RequestInit & { duplex: "half" }));

      const pending = POST(request);
      await vi.advanceTimersByTimeAsync(PUBLIC_MULTIPART_BODY_READ_TIMEOUT_MS);
      const response = await pending;

      expect(response.status).toBe(408);
      await expect(response.json()).resolves.toMatchObject({
        code: "PUBLIC_MULTIPART_BODY_READ_TIMEOUT",
        limit: PUBLIC_MULTIPART_BODY_READ_TIMEOUT_MS
      });
      expect(cancel).toHaveBeenCalledTimes(1);
      expect(analyzeHazardPhotos).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("propagates request cancellation to photo analysis", async () => {
    const controller = new AbortController();
    vi.mocked(analyzeHazardPhotos).mockResolvedValue({
      status: "failed",
      provider: "contract-stub",
      providerMode: "mock",
      model: "vision-contract-v1",
      summary: "",
      observations: [],
      candidates: [],
      ocrText: "",
      siteSignals: [],
      photoCount: 1,
      images: [],
      providerResponses: [],
      fileValidation: HAZARD_PHOTO_FILE_VALIDATION,
      counts: {
        submitted: 1,
        analyzed: 0,
        rejected: 0,
        failed: 1,
        unconfigured: 0,
        candidates: 0,
        harnessConfirmed: 0,
        harnessInsufficient: 0
      },
      harness: {
        modelRole: "candidate_only",
        authority: "safeclaw-db-mcp",
        status: "pending",
        confirms: ["evidence", "confirmedControls"],
        confirmedAt: null,
        errorMessage: null
      }
    } as Awaited<ReturnType<typeof analyzeHazardPhotos>>);

    await POST(multipartRequest([
      new File(["image"], "workface.jpg", { type: "image/jpeg" })
    ], undefined, controller.signal));

    expect(analyzeHazardPhotos).toHaveBeenCalledWith(
      expect.objectContaining({ question: "옥상 방수 작업" }),
      expect.objectContaining({ signal: controller.signal })
    );
  });

  it("reports each partial-failure category accurately", async () => {
    vi.mocked(analyzeHazardPhotos).mockResolvedValue({
      status: "partial",
      provider: "contract-stub",
      providerMode: "mock",
      model: "vision-contract-v1",
      summary: "한 장 분석",
      observations: [],
      candidates: [],
      ocrText: "",
      siteSignals: [],
      photoCount: 3,
      images: [],
      counts: {
        submitted: 3,
        analyzed: 1,
        rejected: 1,
        failed: 1,
        unconfigured: 0,
        candidates: 0,
        harnessConfirmed: 0,
        harnessInsufficient: 0
      }
    } as unknown as Awaited<ReturnType<typeof analyzeHazardPhotos>>);

    const response = await POST(multipartRequest([
      new File(["image"], "analyzed.jpg", { type: "image/jpeg" }),
      new File(["image"], "rejected.jpg", { type: "image/jpeg" }),
      new File(["image"], "failed.jpg", { type: "image/jpeg" })
    ]));
    const body = await response.json() as { ok: boolean; message: string };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.message).toContain("분석 1장");
    expect(body.message).toContain("거부 1장");
    expect(body.message).toContain("실패 1장");
  });
});
