import { NextRequest, NextResponse } from "next/server";
import { loadKoshaGuideCorpus } from "@/lib/kosha-guide-corpus";
import { getProductionExactKoshaTrustPins } from "@/lib/production-kosha-trust";
import { getSafetyReferenceStats } from "@/lib/safety-reference-catalog";
import { loadBundledExactKoshaReferences } from "@/lib/safety-reference-catalog-server";
import { createRateLimiter } from "@/lib/rate-limit";
import {
  applyPublicRateLimitHeader,
  checkPublicRateLimit,
  publicRateLimitResponse,
} from "@/lib/public-distributed-rate-limit";

export const dynamic = "force-dynamic";
const limiter = createRateLimiter({ limit: 30, windowMs: 60_000 });
const STATUS_CACHE_CONTROL = "public, max-age=5, s-maxage=30, stale-while-revalidate=60";

export async function GET(request: NextRequest) {
  const rateLimit = await checkPublicRateLimit({
    request,
    namespace: "safety-reference-status",
    limit: 30,
    windowMs: 60_000,
    instanceLimiter: limiter,
  });
  const limited = publicRateLimitResponse(rateLimit);
  if (limited) return limited;

  const exactTrustPins = getProductionExactKoshaTrustPins();
  const [catalog, localCorpus, exactTrustRegistryLoad] = await Promise.all([
    getSafetyReferenceStats(),
    loadKoshaGuideCorpus(),
    loadBundledExactKoshaReferences()
  ]);
  const exactTrustReady = exactTrustRegistryLoad.status === "ready";
  const searchReady = catalog.ok && localCorpus.status === "ready" && exactTrustReady;
  const status = searchReady ? "ready" : "degraded";
  const localCorpusStatus = localCorpus.status === "ready"
    ? {
        status: localCorpus.status,
        failures: [],
        snapshotId: localCorpus.snapshotId,
        manifestSha256: localCorpus.manifestSha256,
        inventoryCount: localCorpus.inventoryCount,
        itemCount: localCorpus.itemCount,
        chunkCount: localCorpus.chunkCount,
        failureCount: localCorpus.failureCount
      }
    : {
        status: localCorpus.status,
        failures: localCorpus.failures
      };
  const localMessage = localCorpus.status === "unconfigured"
    ? "KOSHA 로컬 코퍼스가 설정되지 않아 검색 준비 상태가 아닙니다."
    : localCorpus.status === "blocked"
      ? `KOSHA 로컬 코퍼스 무결성 게이트가 차단되어 검색 준비 상태가 아닙니다: ${localCorpus.failures.join(", ") || "integrity-failed"}.`
      : "KOSHA 로컬 코퍼스 무결성 게이트가 준비되었습니다.";
  const exactTrustMessage = exactTrustReady
    ? "Exact KOSHA registry integrity gate ready."
    : `exact KOSHA registry integrity gate blocked: ${exactTrustRegistryLoad.reason}.`;
  const result = {
    ...catalog,
    ok: searchReady,
    status,
    searchReady,
    localCorpus: localCorpusStatus,
    exactTrustRegistry: {
      status: exactTrustReady ? "ready" : "blocked",
      count: exactTrustPins.length,
      integrityStatus: exactTrustReady ? "ready" : "blocked",
      loadedItemCount: exactTrustReady ? exactTrustRegistryLoad.items.length : 0,
      failureReason: exactTrustReady ? null : exactTrustRegistryLoad.reason,
      stableDocumentKeys: exactTrustPins.map((pin) => pin.stableDocumentKey),
      versions: exactTrustPins.map((pin) => pin.version),
      items: exactTrustPins.map((pin) => ({
        itemId: pin.itemId,
        stableDocumentKey: pin.stableDocumentKey,
        version: pin.version,
        title: pin.title,
        itemType: pin.itemType,
        publishedAt: pin.publishedAt,
        officialFileId: pin.officialFileId,
        bodySha256: pin.bodySha256,
        pdfSha256: pin.pdfSha256,
        provenanceSha256: pin.provenanceSha256
      }))
    },
    message: `${catalog.message} ${localMessage} ${exactTrustMessage}`
  };

  const response = NextResponse.json(result, { status: result.ok ? 200 : 503 });
  response.headers.set("Cache-Control", STATUS_CACHE_CONTROL);
  return applyPublicRateLimitHeader(response, rateLimit);
}
