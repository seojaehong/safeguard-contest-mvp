import { NextResponse } from "next/server";
import { loadKoshaGuideCorpus } from "@/lib/kosha-guide-corpus";
import { getSafetyReferenceStats } from "@/lib/safety-reference-catalog";

export const dynamic = "force-dynamic";

export async function GET() {
  const [catalog, localCorpus] = await Promise.all([
    getSafetyReferenceStats(),
    loadKoshaGuideCorpus()
  ]);
  const searchReady = catalog.ok && localCorpus.status === "ready";
  const status = searchReady
    ? "ready"
    : catalog.status === "unconfigured"
      ? "unconfigured"
      : "degraded";
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
    message: `${catalog.message} ${localMessage}`
  };

  return NextResponse.json(result, { status: result.ok ? 200 : 503 });
}
