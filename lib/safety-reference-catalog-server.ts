import "server-only";

import {
  loadKoshaGuideCorpus,
  searchKoshaGuideCorpus,
  type KoshaGuideCorpusHit,
  type KoshaGuideCorpusLookup
} from "@/lib/kosha-guide-corpus";
import {
  getKoshaGroundingDecision,
  isKoshaSupportingCitationEligible,
  isKoshaTechnicalReference,
  mergeLocalAndRemoteSafetyReferenceResults,
  resolveSafetyReferenceVectorSearchState,
  searchSafetyReferences as searchRemoteSafetyReferences,
  summarizeKoshaGrounding,
  type SafetyReferenceItem,
  type SafetyReferenceSearchOptions,
  type SafetyReferenceSearchResult
} from "@/lib/safety-reference-catalog";

export type SafetyReferenceServerSearchOptions = SafetyReferenceSearchOptions & {
  offlineCorpus?: KoshaGuideCorpusLookup;
};

function isKoshaTechnicalItemType(itemType: string): boolean {
  return itemType === "technical-guideline" || itemType === "technical-support-regulation";
}

function localSnapshotAllowed(options: SafetyReferenceServerSearchOptions): boolean {
  return !options.sourceId && !options.riskTag && (!options.itemType || isKoshaTechnicalItemType(options.itemType));
}

function buildLocalItem(hit: KoshaGuideCorpusHit): SafetyReferenceItem {
  const record = hit.record;
  const summary = record.anchors[0]?.excerpt || record.nativeBody.slice(0, 220);
  const item: SafetyReferenceItem = {
    id: record.referenceId,
    source_id: `kosha-guide-offline:${record.stableDocumentKey}`,
    item_type: record.itemType,
    category: record.category,
    subcategory: null,
    title: record.version,
    summary,
    body: record.nativeBody,
    keywords: record.tags.keywords,
    risk_tags: record.tags.riskTags,
    primary_documents: record.tags.primaryDocuments,
    controls: record.tags.controls,
    source_url: null,
    evidence_role: "supporting",
    retrieval_source: hit.retrievalMode,
    display_title: `${record.version} ${record.title}`,
    display_summary: summary,
    kosha_guide: {
      referenceId: record.referenceId,
      stableDocumentKey: record.stableDocumentKey,
      version: record.version,
      quality: record.quality,
      lifecycle: record.provenance.lifecycle,
      bodyKind: record.bodyKind,
      anchors: record.anchors,
      evidenceRef: hit.evidenceRef,
      directEligible: hit.directEligible
    }
  };
  return {
    ...item,
    kosha_grounding: getKoshaGroundingDecision(item) || undefined
  };
}

function localGateReason(
  status: "blocked" | "unconfigured"
): "local-corpus-integrity-failed" | "local-corpus-unavailable" {
  return status === "blocked" ? "local-corpus-integrity-failed" : "local-corpus-unavailable";
}

function localGateMessage(status: "blocked" | "unconfigured", failures: readonly string[], excludedCount: number): string {
  const excluded = `검증되지 않은 원격 KOSHA ${excludedCount}건 제외`;
  if (status === "blocked") {
    return `KOSHA 로컬 코퍼스 무결성 게이트 차단: ${failures.join(", ") || "integrity-failed"}; ${excluded}.`;
  }
  return `KOSHA 로컬 코퍼스 미설정: ${excluded}.`;
}

export async function searchSafetyReferences(
  options: SafetyReferenceServerSearchOptions
): Promise<SafetyReferenceSearchResult> {
  const query = options.query.trim();
  const limit = Math.min(Math.max(options.limit || 12, 1), 50);
  const localAllowed = localSnapshotAllowed(options);
  const localCorpus = localAllowed
    ? await loadKoshaGuideCorpus(options.offlineCorpus)
    : { status: "unconfigured" as const, rootDir: null, failures: [] as [] };
  const localSearch = localCorpus.status === "ready"
    ? searchKoshaGuideCorpus(localCorpus, query, limit, options.itemType)
    : { retrievalMode: null, items: [] };
  const localItems = localSearch.items
    .filter(() => !options.evidenceRole || options.evidenceRole === "supporting")
    .map(buildLocalItem);
  const remote = await searchRemoteSafetyReferences(options);
  const localGateStatus = localAllowed && localCorpus.status !== "ready"
    ? localCorpus.status
    : null;
  const localGateFailures = localCorpus.status === "blocked" ? localCorpus.failures : [];
  const retainedRemoteItems = localGateStatus
    ? remote.items.filter((item) => !isKoshaTechnicalReference(item) || isKoshaSupportingCitationEligible(item))
    : remote.items;
  const excludedRemoteCount = remote.items.length - retainedRemoteItems.length;
  const gatedRemote: SafetyReferenceSearchResult = localGateStatus
    ? {
        ...remote,
        count: retainedRemoteItems.length,
        items: retainedRemoteItems,
        koshaGrounding: summarizeKoshaGrounding({
          items: retainedRemoteItems,
          localCorpusStatus: localGateStatus,
          excludedCount: excludedRemoteCount,
          blockedReason: localGateReason(localGateStatus)
        }),
        message: `${remote.message} ${localGateMessage(localGateStatus, localGateFailures, excludedRemoteCount)}`.trim()
      }
    : remote;

  if (!remote.configured) {
    if (localItems.length) {
      return {
        ok: true,
        configured: true,
        query,
        count: localItems.length,
        items: localItems,
        retrievalMode: localSearch.retrievalMode || "local-tag",
        vectorSearch: resolveSafetyReferenceVectorSearchState(options.offlineCorpus?.env).status,
        koshaGrounding: summarizeKoshaGrounding({
          items: localItems,
          localCorpusStatus: "ready"
        }),
        message: "서버 전용 KOSHA 스냅샷에서 오프라인 보조근거를 조회했습니다."
      };
    }
    if (localCorpus.status === "blocked") {
      return {
        ...gatedRemote,
        configured: true,
        message: localGateMessage("blocked", localCorpus.failures, excludedRemoteCount)
      };
    }
    return gatedRemote;
  }
  if (!remote.ok || localGateStatus) return gatedRemote;
  if (!localItems.length) return remote;

  const merged = mergeLocalAndRemoteSafetyReferenceResults({
    localItems,
    remoteItems: remote.items,
    remoteRetrievalMode: remote.retrievalMode,
    limit
  });
  return {
    ...remote,
    count: merged.items.length,
    items: merged.items,
    retrievalMode: merged.retrievalMode,
    koshaGrounding: summarizeKoshaGrounding({
      items: merged.items,
      localCorpusStatus: "ready"
    }),
    message: `KOSHA 오프라인 보조근거와 ${remote.message}`
  };
}
