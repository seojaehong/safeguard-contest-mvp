import "server-only";

import {
  loadKoshaGuideCorpus,
  searchKoshaGuideCorpus,
  type KoshaGuideCorpusHit
} from "@/lib/kosha-guide-corpus";
import {
  resolveSafetyReferenceVectorSearchState,
  searchSafetyReferences as searchRemoteSafetyReferences,
  type SafetyReferenceItem,
  type SafetyReferenceSearchOptions,
  type SafetyReferenceSearchResult
} from "@/lib/safety-reference-catalog";
import { mergeLocalAndRemoteSafetyReferenceResults } from "@/lib/safety-reference-policy";

function isKoshaTechnicalItemType(itemType: string): boolean {
  return itemType === "technical-guideline" || itemType === "technical-support-regulation";
}

function localSnapshotAllowed(options: SafetyReferenceSearchOptions): boolean {
  return !options.sourceId && !options.riskTag && (!options.itemType || isKoshaTechnicalItemType(options.itemType));
}

function buildLocalItem(hit: KoshaGuideCorpusHit): SafetyReferenceItem {
  const record = hit.record;
  return {
    id: record.referenceId,
    source_id: `kosha-guide-offline:${record.stableDocumentKey}`,
    item_type: record.itemType,
    category: record.category,
    subcategory: null,
    title: record.version,
    summary: record.anchors[0]?.excerpt || record.nativeBody,
    body: record.nativeBody,
    keywords: record.tags.keywords,
    risk_tags: record.tags.riskTags,
    primary_documents: record.tags.primaryDocuments,
    controls: record.tags.controls,
    source_url: null,
    evidence_role: hit.directEligible ? "direct" : "supporting",
    retrieval_source: hit.retrievalMode,
    display_title: `${record.version} ${record.title}`,
    display_summary: record.anchors[0]?.excerpt || record.nativeBody.slice(0, 140),
    kosha_guide: {
      referenceId: record.referenceId,
      stableDocumentKey: record.stableDocumentKey,
      version: record.version,
      quality: record.quality,
      bodyKind: record.bodyKind,
      anchors: record.anchors,
      evidenceRef: hit.evidenceRef,
      directEligible: hit.directEligible
    }
  };
}

export async function searchSafetyReferences(options: SafetyReferenceSearchOptions): Promise<SafetyReferenceSearchResult> {
  const query = options.query.trim();
  const limit = Math.min(Math.max(options.limit || 12, 1), 50);
  const localAllowed = localSnapshotAllowed(options);
  const localCorpus = localAllowed
    ? await loadKoshaGuideCorpus(options.offlineCorpus)
    : { status: "unconfigured" as const, rootDir: null, failures: [] as [] };
  const localHits = localCorpus.status === "ready"
    ? searchKoshaGuideCorpus(localCorpus, query, options.evidenceRole === "direct" ? Math.min(limit * 3, 50) : limit).items
    : [];
  const localItems = localHits
    .filter((item) => !options.evidenceRole || (options.evidenceRole === "direct" ? item.directEligible : !item.directEligible))
    .filter((item) => !options.itemType || item.record.itemType === options.itemType)
    .map(buildLocalItem);
  const remote = await searchRemoteSafetyReferences(options);
  if (!remote.configured) {
    if (localItems.length) {
      return {
        ok: true,
        configured: true,
        query,
        count: Math.min(localItems.length, limit),
        items: localItems.slice(0, limit),
        retrievalMode: localHits[0]?.retrievalMode || "local-tag",
        vectorSearch: resolveSafetyReferenceVectorSearchState(options.offlineCorpus?.env || process.env).status,
        message: "서버 전용 KOSHA 스냅샷에서 오프라인 보조근거를 조회했습니다."
      };
    }
    if (localCorpus.status === "blocked") {
      return {
        ...remote,
        configured: true,
        message: `KOSHA 오프라인 스냅샷 게이트 차단: ${localCorpus.failures.join(", ")}`
      };
    }
    return remote;
  }
  if (!remote.ok) return remote;
  if (localCorpus.status === "blocked") {
    return { ...remote, message: `${remote.message} KOSHA 오프라인 스냅샷 게이트 차단: ${localCorpus.failures.join(", ")}` };
  }
  if (!localItems.length) return remote;
  const merged = mergeLocalAndRemoteSafetyReferenceResults({
    localItems,
    remoteItems: remote.items,
    limit
  });
  return {
    ...remote,
    count: merged.items.length,
    items: merged.items,
    retrievalMode: merged.retrievalMode,
    message: `KOSHA 오프라인 보조근거와 ${remote.message}`
  };
}
