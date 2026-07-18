import { NextResponse } from "next/server";
import { loadKoshaGuideCorpus } from "@/lib/kosha-guide-corpus";
import { getProductionExactKoshaTrustPins } from "@/lib/production-kosha-trust";
import { getSafetyReferenceStats } from "@/lib/safety-reference-catalog";

export const dynamic = "force-dynamic";

export async function GET() {
  const exactTrustPins = getProductionExactKoshaTrustPins();
  const [catalog, localCorpus] = await Promise.all([
    getSafetyReferenceStats(),
    loadKoshaGuideCorpus()
  ]);
  const searchReady = catalog.ok && localCorpus.status === "ready";
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
  const result = {
    ...catalog,
    ok: searchReady,
    status,
    searchReady,
    localCorpus: localCorpusStatus,
    exactTrustRegistry: {
      status: exactTrustPins.length ? "ready" : "blocked",
      count: exactTrustPins.length,
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
    message: `${catalog.message} ${localMessage}`
  };

  return NextResponse.json(result, { status: result.ok ? 200 : 503 });
}
