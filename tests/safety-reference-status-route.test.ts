import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getSafetyReferenceStats: vi.fn(),
  loadKoshaGuideCorpus: vi.fn(),
  loadBundledExactKoshaReferences: vi.fn()
}));

vi.mock("@/lib/safety-reference-catalog", () => ({
  getSafetyReferenceStats: mocks.getSafetyReferenceStats,
  buildPublicSafetyReferenceItem: (item: Record<string, unknown>) => {
    const { body: _body, payload: _payload, metadata: _metadata, ...publicItem } = item;
    return publicItem;
  }
}));

vi.mock("@/lib/kosha-guide-corpus", () => ({
  loadKoshaGuideCorpus: mocks.loadKoshaGuideCorpus
}));

vi.mock("@/lib/safety-reference-catalog-server", () => ({
  loadBundledExactKoshaReferences: mocks.loadBundledExactKoshaReferences
}));

import { GET } from "@/app/api/safety-reference/status/route";

const readyCatalogStats = {
  ok: true,
  configured: true,
  status: "ready" as const,
  sources: 5,
  items: 9_920,
  expectedTechnicalTotal: 1_040,
  technicalTotal: 1_040,
  technicalSupportRegulations: 237,
  technicalGuidelines: 803,
  technicalSplitOk: true,
  catalogSearchOk: true,
  ingestionRuns: 1,
  itemTypes: [],
  samples: [],
  message: "Supabase catalog ready"
};

function statusRequest(signal?: AbortSignal) {
  return new NextRequest("http://localhost/api/safety-reference/status", { signal });
}

describe("safety-reference status route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSafetyReferenceStats.mockResolvedValue(readyCatalogStats);
    mocks.loadBundledExactKoshaReferences.mockResolvedValue({
      status: "ready",
      items: [
        { id: "KOSHA-D-C-13-2026" },
        { id: "KOSHA-D-C-7-2026" },
        { id: "KOSHA-B-E-10-2026" }
      ]
    });
  });

  it("fails closed when the catalog is ready but the local KOSHA corpus is unavailable", async () => {
    mocks.loadKoshaGuideCorpus.mockResolvedValue({
      status: "unconfigured",
      rootDir: null,
      failures: []
    });

    const response = await GET(statusRequest());
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload).toMatchObject({
      ok: false,
      status: "degraded",
      catalogSearchOk: true,
      searchReady: false,
      localCorpus: {
        status: "unconfigured",
        failures: []
      }
    });
    expect(payload.message).toContain("KOSHA 로컬 코퍼스가 설정되지 않아 검색 준비 상태가 아닙니다");
  });

  it("reports degraded when both the catalog and local KOSHA corpus are unconfigured", async () => {
    mocks.getSafetyReferenceStats.mockResolvedValue({
      ...readyCatalogStats,
      ok: false,
      configured: false,
      status: "unconfigured",
      catalogSearchOk: false,
      message: "Supabase catalog unconfigured"
    });
    mocks.loadKoshaGuideCorpus.mockResolvedValue({
      status: "unconfigured",
      rootDir: null,
      failures: []
    });

    const response = await GET(statusRequest());
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload).toMatchObject({
      ok: false,
      status: "degraded",
      searchReady: false,
      configured: false,
      localCorpus: {
        status: "unconfigured",
        failures: []
      }
    });
  });

  it("reports ready only when the verified local KOSHA snapshot is loaded", async () => {
    mocks.loadKoshaGuideCorpus.mockResolvedValue({
      status: "ready",
      rootDir: "C:/private/kosha-corpus",
      snapshotId: "snapshot-id",
      manifestSha256: "manifest-sha256",
      inventoryCount: 1_040,
      itemCount: 1_040,
      chunkCount: 20_520,
      failureCount: 0,
      records: [],
      indexedRecords: []
    });

    const response = await GET(statusRequest());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=5, s-maxage=30, stale-while-revalidate=60");
    expect(response.headers.get("X-SafeClaw-Rate-Limit")).toBe("instance");
    expect(payload).toMatchObject({
      ok: true,
      status: "ready",
      searchReady: true,
      localCorpus: {
        status: "ready",
        snapshotId: "snapshot-id",
        inventoryCount: 1_040,
        failureCount: 0
      },
      exactTrustRegistry: {
        status: "ready",
        count: 3,
        integrityStatus: "ready",
        loadedItemCount: 3,
        failureReason: null,
        stableDocumentKeys: ["D-C-13", "D-C-7", "B-E-10"],
        versions: ["D-C-13-2026", "D-C-7-2026", "B-E-10-2026"]
      }
    });
    expect(payload.exactTrustRegistry.items).toHaveLength(3);
    expect(payload.exactTrustRegistry.items[2]).toMatchObject({
      stableDocumentKey: "B-E-10",
      version: "B-E-10-2026",
      officialFileId: "CTC2026012913263450093332"
    });
    expect(JSON.stringify(payload)).not.toContain("C:/private/kosha-corpus");
  });

  it("projects catalog samples without raw body, payload, or metadata", async () => {
    mocks.getSafetyReferenceStats.mockResolvedValue({
      ...readyCatalogStats,
      samples: [{
        id: "sample-1",
        source_id: "source-1",
        item_type: "guide",
        category: "전기",
        subcategory: null,
        title: "감전 예방",
        summary: "공개 요약",
        body: "private full corpus body",
        keywords: ["감전"],
        risk_tags: ["전기"],
        primary_documents: ["위험성평가표"],
        controls: ["검전"],
        payload: { internal: "secret" },
        metadata: { privatePath: "C:/private/corpus" }
      }]
    });
    mocks.loadKoshaGuideCorpus.mockResolvedValue({
      status: "ready",
      rootDir: "C:/private/kosha-corpus",
      snapshotId: "snapshot-id",
      manifestSha256: "manifest-sha256",
      inventoryCount: 1_040,
      itemCount: 1_040,
      chunkCount: 20_520,
      failureCount: 0,
      records: [],
      indexedRecords: []
    });

    const response = await GET(statusRequest());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.samples[0]).toMatchObject({ title: "감전 예방", summary: "공개 요약" });
    expect(payload.samples[0]).not.toHaveProperty("body");
    expect(payload.samples[0]).not.toHaveProperty("payload");
    expect(payload.samples[0]).not.toHaveProperty("metadata");
    expect(JSON.stringify(payload)).not.toContain("private full corpus body");
    expect(JSON.stringify(payload)).not.toContain("C:/private/corpus");
  });

  it("fails closed when the exact KOSHA trust assets fail runtime integrity loading", async () => {
    mocks.loadKoshaGuideCorpus.mockResolvedValue({
      status: "ready",
      rootDir: "C:/private/kosha-corpus",
      snapshotId: "snapshot-id",
      manifestSha256: "manifest-sha256",
      inventoryCount: 1_040,
      itemCount: 1_040,
      chunkCount: 20_520,
      failureCount: 0,
      records: [],
      indexedRecords: []
    });
    mocks.loadBundledExactKoshaReferences.mockResolvedValue({
      status: "blocked",
      reason: "asset-integrity-failed",
      message: "exact KOSHA asset does not satisfy the immutable production trust pin"
    });

    const response = await GET(statusRequest());
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload).toMatchObject({
      ok: false,
      status: "degraded",
      searchReady: false,
      exactTrustRegistry: {
        status: "blocked",
        count: 3,
        integrityStatus: "blocked",
        loadedItemCount: 0,
        failureReason: "asset-integrity-failed"
      }
    });
    expect(payload.message).toContain("exact KOSHA registry integrity gate blocked");
    expect(JSON.stringify(payload)).not.toContain("C:/private/kosha-corpus");
  });

  it("exposes integrity failure codes without leaking the configured corpus path", async () => {
    mocks.loadKoshaGuideCorpus.mockResolvedValue({
      status: "blocked",
      rootDir: "C:/private/kosha-corpus",
      failures: ["hash:manifest"]
    });

    const response = await GET(statusRequest());
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload).toMatchObject({
      ok: false,
      status: "degraded",
      searchReady: false,
      localCorpus: {
        status: "blocked",
        failures: ["hash:manifest"]
      }
    });
    expect(JSON.stringify(payload)).not.toContain("C:/private/kosha-corpus");
  });

  it("releases status admission when the client disconnects", async () => {
    const controller = new AbortController();
    mocks.getSafetyReferenceStats.mockImplementationOnce(() => new Promise(() => undefined));
    mocks.loadKoshaGuideCorpus.mockResolvedValue({
      status: "unconfigured",
      rootDir: null,
      failures: []
    });

    const pending = GET(statusRequest(controller.signal));
    await vi.waitFor(() => expect(mocks.getSafetyReferenceStats).toHaveBeenCalledOnce());
    controller.abort(new DOMException("client disconnected", "AbortError"));

    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  });
});
