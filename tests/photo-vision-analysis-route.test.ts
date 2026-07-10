import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/input-photos/hazard-analysis/route";
import { analyzeHazardPhotos } from "@/lib/photo-vision-analysis";

vi.mock("@/lib/photo-vision-analysis", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/photo-vision-analysis")>();
  return {
    ...actual,
    analyzeHazardPhotos: vi.fn()
  };
});

function multipartRequest(files: File[]): NextRequest {
  const form = new FormData();
  form.set("question", "옥상 방수 작업");
  files.forEach((file) => form.append("photos", file, file.name));
  return {
    headers: new Headers({
      "content-type": "multipart/form-data; boundary=contract-test",
      "x-forwarded-for": `route-test-${files.length}-${files.map((file) => file.name).join("-")}`
    }),
    formData: async () => form
  } as unknown as NextRequest;
}

describe("photo vision hazard analysis route", () => {
  beforeEach(() => {
    vi.mocked(analyzeHazardPhotos).mockReset();
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
});
