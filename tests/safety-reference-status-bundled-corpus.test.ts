import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/safety-reference-catalog", () => ({
  getSafetyReferenceStats: vi.fn(async () => ({
    ok: true,
    configured: true,
    status: "ready",
    sources: 1063,
    items: 9920,
    expectedTechnicalTotal: 1040,
    technicalTotal: 1040,
    technicalSupportRegulations: 237,
    technicalGuidelines: 803,
    technicalSplitOk: true,
    catalogSearchOk: true,
    ingestionRuns: 2,
    itemTypes: [],
    samples: [],
    message: "기술지원규정 폴더 1,040건 기준과 Supabase 기술지원규정 소스 1,040건을 연결했습니다."
  }))
}));

import { GET } from "@/app/api/safety-reference/status/route";
import { resetKoshaGuideCorpusCacheForTests } from "@/lib/kosha-guide-corpus";

describe("safety-reference status bundled KOSHA corpus", () => {
  it("reports ready through the real bundled KOSHA verified subset when the catalog is healthy", async () => {
    vi.stubEnv("KOSHA_GUIDE_CORPUS_DIR", "");
    resetKoshaGuideCorpusCacheForTests();

    const response = await GET();
    const body = await response.json() as {
      ok: boolean;
      status: string;
      searchReady: boolean;
      localCorpus: {
        status: string;
        snapshotId?: string;
        itemCount?: number;
        chunkCount?: number;
        failureCount?: number;
      };
    };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.status).toBe("ready");
    expect(body.searchReady).toBe(true);
    expect(body.localCorpus).toMatchObject({
      status: "ready",
      snapshotId: "e99b7faf268c513c9eed329c016670339d686ba580141e54fe3ffdfafb478a12",
      itemCount: 234,
      chunkCount: 7127,
      failureCount: 0
    });
  }, 20_000);
});
