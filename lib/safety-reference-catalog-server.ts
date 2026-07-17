import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import {
  loadKoshaGuideCorpus,
  searchKoshaGuideCorpus,
  type KoshaGuideCorpusHit,
  type KoshaGuideCorpusLookup
} from "@/lib/kosha-guide-corpus";
import {
  getKoshaGroundingDecision,
  isSafetyReferenceDirectEligible,
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
import {
  buildExactTrustedKoshaGroundingDecision,
  getProductionExactKoshaTrustPin,
  getProductionExactKoshaTrustPins,
  isProductionTrustedKoshaReference,
} from "@/lib/production-kosha-trust";
import { exactKoshaReferenceAppliesToQuery } from "@/lib/exact-kosha-applicability-policy";

export type SafetyReferenceServerSearchOptions = SafetyReferenceSearchOptions & {
  offlineCorpus?: KoshaGuideCorpusLookup;
  exactKoshaAssetPaths?: readonly string[];
};

type BundledExactKoshaAsset = Readonly<{
  schemaVersion: string;
  itemId: string;
  sourceId: string;
  itemType: string;
  category: string;
  title: string;
  stableDocumentKey: string;
  version: string;
  normalizedCharCount: number;
  bodySha256: string;
  pdfSha256: string;
  officialUrl: string;
  officialFileId: string;
  publishedAt: string;
  extractionSchema: string;
  extractionSnapshot: string | null;
  portabilityLedgerSha256: string | null;
  body: string;
}>;

export type BundledExactKoshaLoadResult =
  | Readonly<{ status: "ready"; item: SafetyReferenceItem }>
  | Readonly<{
      status: "blocked";
      reason: "asset-unavailable" | "asset-invalid" | "asset-integrity-failed";
      message: string;
    }>;

export type BundledExactKoshaRegistryLoadResult =
  | Readonly<{ status: "ready"; items: readonly SafetyReferenceItem[] }>
  | Exclude<BundledExactKoshaLoadResult, Readonly<{ status: "ready"; item: SafetyReferenceItem }>>;

const DEFAULT_EXACT_KOSHA_ASSET_PATH = join(
  process.cwd(),
  "data",
  "safety-knowledge",
  "exact-kosha",
  "d-c-13-2026.json",
);

const DEFAULT_EXACT_KOSHA_ASSET_PATHS = Object.freeze([
  DEFAULT_EXACT_KOSHA_ASSET_PATH,
  join(
    process.cwd(),
    "data",
    "safety-knowledge",
    "exact-kosha",
    "d-c-7-2026.json",
  ),
  join(
    process.cwd(),
    "data",
    "safety-knowledge",
    "exact-kosha",
    "b-e-10-2026.json",
  ),
]);

const EXACT_KOSHA_CONTENT = Object.freeze({
  "B-E-10": Object.freeze({
    summary: "정전전로 전기작업의 전원 차단, 잠금·표지, 검전 및 무전압 확인 기술지침",
    keywords: ["정전전로", "전기작업", "전원 차단", "잠금표지", "LOTO", "검전", "무전압"],
    riskTags: ["감전", "전기", "정전작업"],
    controls: [
      "전기기기등에 공급되는 모든 전원을 관련 도면, 배선도 등으로 확인할 것",
      "차단장치나 단로기 등에 잠금장치 및 꼬리표를 부착할 것",
      "검전기를 이용하여 작업 대상 기기가 충전되었는지를 확인할 것",
    ],
    anchors: [
      { page: 6, excerpt: "전기기기등에 공급되는 모든 전원을 관련 도면, 배선도 등으로 확인할 것" },
      { page: 6, excerpt: "차단장치나 단로기 등에 잠금장치 및 꼬리표를 부착할 것" },
      { page: 6, excerpt: "검전기를 이용하여 작업 대상 기기가 충전되었는지를 확인할 것" },
    ],
  }),
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSha256(value: string): boolean {
  return /^[a-f0-9]{64}$/u.test(value);
}

function readAssetString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function parseBundledExactKoshaAsset(value: unknown): BundledExactKoshaAsset | null {
  if (!isRecord(value)) return null;
  const stringKeys = [
    "schemaVersion",
    "itemId",
    "sourceId",
    "itemType",
    "category",
    "title",
    "stableDocumentKey",
    "version",
    "bodySha256",
    "pdfSha256",
    "officialUrl",
    "officialFileId",
    "publishedAt",
    "extractionSchema",
    "body",
  ] as const;
  const strings = Object.fromEntries(
    stringKeys.map((key) => [key, readAssetString(value, key)]),
  );
  if (Object.values(strings).some((entry) => entry === null)) return null;
  if (typeof value.normalizedCharCount !== "number" || !Number.isInteger(value.normalizedCharCount)) return null;
  return {
    schemaVersion: strings.schemaVersion as string,
    itemId: strings.itemId as string,
    sourceId: strings.sourceId as string,
    itemType: strings.itemType as string,
    category: strings.category as string,
    title: strings.title as string,
    stableDocumentKey: strings.stableDocumentKey as string,
    version: strings.version as string,
    normalizedCharCount: value.normalizedCharCount,
    bodySha256: strings.bodySha256 as string,
    pdfSha256: strings.pdfSha256 as string,
    officialUrl: strings.officialUrl as string,
    officialFileId: strings.officialFileId as string,
    publishedAt: strings.publishedAt as string,
    extractionSchema: strings.extractionSchema as string,
    extractionSnapshot: readAssetString(value, "extractionSnapshot"),
    portabilityLedgerSha256: readAssetString(value, "portabilityLedgerSha256"),
    body: strings.body as string,
  };
}

function buildBundledExactKoshaItem(asset: BundledExactKoshaAsset): SafetyReferenceItem | null {
  if (asset.schemaVersion !== "safeclaw-exact-kosha-reference/v1"
    || asset.extractionSchema !== "safeclaw-kosha-body-corpus/v2"
    || asset.body.length !== asset.normalizedCharCount) {
    return null;
  }
  const pin = getProductionExactKoshaTrustPin(asset.itemId);
  if (!pin
    || pin.sourceId !== asset.sourceId
    || pin.itemType !== asset.itemType
    || pin.title !== asset.title
    || pin.stableDocumentKey !== asset.stableDocumentKey
    || pin.version !== asset.version
    || pin.bodySha256 !== asset.bodySha256
    || pin.pdfSha256 !== asset.pdfSha256
    || pin.officialUrl !== asset.officialUrl
    || pin.officialFileId !== asset.officialFileId
    || asset.publishedAt !== pin.publishedAt) {
    return null;
  }
  const provenanceSnapshots = [asset.extractionSnapshot, asset.portabilityLedgerSha256]
    .filter((value): value is string => value !== null);
  if (!provenanceSnapshots.length
    || provenanceSnapshots.some((value) => !isSha256(value) || value !== pin.provenanceSha256)) {
    return null;
  }
  const provenanceSnapshot = pin.provenanceSha256;
  const exactContent = EXACT_KOSHA_CONTENT[asset.stableDocumentKey as keyof typeof EXACT_KOSHA_CONTENT];
  if (exactContent && (
    exactContent.controls.some((control) => !asset.body.includes(control))
    || exactContent.anchors.some((anchor) => !asset.body.includes(anchor.excerpt))
  )) {
    return null;
  }
  const payload: Record<string, unknown> = {
    reference_item_id: asset.itemId,
    stable_document_key: asset.stableDocumentKey,
    version: asset.version,
    official_version_code: asset.version,
    body_sha256: asset.bodySha256,
    pdf_sha256: asset.pdfSha256,
    official_url: asset.officialUrl,
    official_file_id: asset.officialFileId,
    official_published_at: pin.publishedAt,
    official_status: "current",
    review_state: "published",
    body_kind: "native",
    human_confirmed: true,
    tampered: false,
    extraction_snapshot: provenanceSnapshot,
  };
  const item: SafetyReferenceItem = {
    id: asset.itemId,
    source_id: asset.sourceId,
    item_type: asset.itemType,
    category: asset.category,
    subcategory: "기술지원규정",
    title: asset.title,
    summary: exactContent?.summary ?? (asset.stableDocumentKey === "D-C-7"
      ? "비계 구조, 작업발판, 추락 방지 및 조립·해체 작업의 기술지침"
      : "외벽도장보수공사의 작업발판, 비계, 추락 방지 및 작업 전 점검 기술지침"),
    body: asset.body,
    keywords: exactContent?.keywords ?? (asset.stableDocumentKey === "D-C-7"
      ? ["비계", "이동식 비계", "시스템비계", "작업발판", "조립", "해체", "추락"]
      : ["외벽도장", "외벽 보수", "비계", "작업발판", "추락", "강풍"]),
    risk_tags: exactContent?.riskTags ?? ["추락", "비계", "고소작업"],
    primary_documents: ["위험성평가표", "TBM 브리핑", "TBM 기록"],
    controls: exactContent?.controls ?? [
      "작업발판과 비계의 구조 및 설치 상태를 확인한다.",
      "추락방지설비와 개인보호구 착용 상태를 확인한다.",
      "기상 조건과 작업중지 기준을 작업 전 공유한다.",
    ],
    source_url: asset.officialUrl,
    evidence_role: "supporting",
    retrieval_source: "local-tag",
    payload,
    kosha_guide: {
      referenceId: asset.itemId,
      stableDocumentKey: asset.stableDocumentKey,
      version: asset.version,
      quality: "accepted",
      lifecycle: "current",
      bodyKind: "native",
      anchors: exactContent?.anchors ?? [],
      evidenceRef: `${asset.version} 공식 정규화 본문`,
      directEligible: true,
      officialUrl: asset.officialUrl,
      officialFileId: asset.officialFileId,
      publicationDate: pin.publishedAt,
      officialVersion: asset.version,
      officialStatus: "current",
      pdfSha256: asset.pdfSha256,
      bodySha256: asset.bodySha256,
    },
  };
  const grounding = buildExactTrustedKoshaGroundingDecision(item);
  return grounding ? { ...item, kosha_grounding: grounding } : null;
}

export async function loadBundledExactKoshaReference(
  assetPath = DEFAULT_EXACT_KOSHA_ASSET_PATH,
): Promise<BundledExactKoshaLoadResult> {
  let raw: string;
  try {
    raw = await readFile(assetPath, "utf8");
  } catch (error) {
    return {
      status: "blocked",
      reason: "asset-unavailable",
      message: error instanceof Error ? error.message : "exact KOSHA asset read failed",
    };
  }
  let value: unknown;
  try {
    value = JSON.parse(raw) as unknown;
  } catch (error) {
    return {
      status: "blocked",
      reason: "asset-invalid",
      message: error instanceof Error ? error.message : "exact KOSHA asset JSON invalid",
    };
  }
  const asset = parseBundledExactKoshaAsset(value);
  if (!asset) {
    return { status: "blocked", reason: "asset-invalid", message: "exact KOSHA asset shape invalid" };
  }
  const item = buildBundledExactKoshaItem(asset);
  if (!item) {
    return {
      status: "blocked",
      reason: "asset-integrity-failed",
      message: "exact KOSHA asset does not satisfy the immutable production trust pin",
    };
  }
  return { status: "ready", item };
}

export async function loadBundledExactKoshaReferences(
  assetPaths: readonly string[] = DEFAULT_EXACT_KOSHA_ASSET_PATHS,
): Promise<BundledExactKoshaRegistryLoadResult> {
  if (!assetPaths.length) {
    return { status: "blocked", reason: "asset-invalid", message: "exact KOSHA registry is empty" };
  }
  const items: SafetyReferenceItem[] = [];
  const seen = new Set<string>();
  for (const assetPath of assetPaths) {
    const loaded = await loadBundledExactKoshaReference(assetPath);
    if (loaded.status !== "ready") return loaded;
    if (seen.has(loaded.item.id)) {
      return {
        status: "blocked",
        reason: "asset-invalid",
        message: `duplicate exact KOSHA registry item: ${loaded.item.id}`,
      };
    }
    seen.add(loaded.item.id);
    items.push(loaded.item);
  }
  const expectedIds = new Set(getProductionExactKoshaTrustPins().map((pin) => pin.itemId));
  if (seen.size !== expectedIds.size || [...expectedIds].some((itemId) => !seen.has(itemId))) {
    return { status: "blocked", reason: "asset-invalid", message: "exact KOSHA registry membership mismatch" };
  }
  return { status: "ready", items };
}

function isKoshaTechnicalItemType(itemType: string): boolean {
  return itemType === "technical-guideline" || itemType === "technical-support-regulation";
}

function localSnapshotAllowed(options: SafetyReferenceServerSearchOptions): boolean {
  return !options.sourceId
    && !options.riskTag
    && !options.evidenceRole
    && (!options.itemType || isKoshaTechnicalItemType(options.itemType));
}

function koshaTrustGateApplies(options: SafetyReferenceServerSearchOptions): boolean {
  return !options.itemType || isKoshaTechnicalItemType(options.itemType);
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
    source_url: record.provenance.officialUrl,
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
      directEligible: hit.directEligible,
      officialUrl: record.provenance.officialUrl,
      officialFileId: record.provenance.officialFileId,
      publicationDate: record.provenance.publicationDate,
      officialVersion: record.provenance.officialVersion,
      officialStatus: record.provenance.officialStatus,
      pdfSha256: record.provenance.pdfHash,
      bodySha256: record.provenance.bodyHash
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

function localGateMessage(
  status: "blocked" | "unconfigured",
  failures: readonly string[],
  excludedCount: number,
  retainedVerifiedCount: number
): string {
  const excluded = `검증되지 않은 원격 KOSHA ${excludedCount}건 제외`;
  const retained = retainedVerifiedCount
    ? ` 검증된 현행 원격 KOSHA ${retainedVerifiedCount}건은 기술적 보조지침으로 유지.`
    : "";
  if (status === "blocked") {
    return `KOSHA 로컬 코퍼스 무결성 게이트 차단: ${failures.join(", ") || "integrity-failed"}; ${excluded}.${retained}`;
  }
  return `KOSHA 로컬 코퍼스 미설정: ${excluded}.${retained}`;
}

export function isRemoteReferenceRetainedByLocalKoshaGate(
  item: SafetyReferenceItem
): boolean {
  return !isKoshaTechnicalReference(item) || isProductionTrustedKoshaReference(item);
}

function exactBundleAppliesToQuery(item: SafetyReferenceItem, query: string): boolean {
  const stableKey = item.kosha_guide?.stableDocumentKey;
  return stableKey ? exactKoshaReferenceAppliesToQuery(stableKey, query) : false;
}

function normalizeFilterValue(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase("ko-KR").replace(/[^\p{L}\p{N}]+/gu, "");
}

function exactBundleMatchesFilters(
  item: SafetyReferenceItem,
  filters: Pick<SafetyReferenceSearchOptions, "sourceId" | "riskTag" | "itemType" | "evidenceRole">,
): boolean {
  if (filters.sourceId && item.source_id !== filters.sourceId) return false;
  if (filters.itemType && item.item_type !== filters.itemType) return false;
  if (filters.evidenceRole === "direct" && !isSafetyReferenceDirectEligible(item)) return false;
  if (filters.evidenceRole === "supporting" && isSafetyReferenceDirectEligible(item)) return false;
  if (filters.riskTag) {
    const expected = normalizeFilterValue(filters.riskTag);
    if (!item.risk_tags.some((tag) => normalizeFilterValue(tag) === expected)) return false;
  }
  return true;
}

export function mergeBundledExactKoshaFallback(input: Readonly<{
  query: string;
  remoteItems: readonly SafetyReferenceItem[];
  bundledItem: SafetyReferenceItem;
  localGateActive: boolean;
  limit: number;
  filters?: Pick<SafetyReferenceSearchOptions, "sourceId" | "riskTag" | "itemType" | "evidenceRole">;
}>): SafetyReferenceItem[] {
  return mergeBundledExactKoshaFallbacks({
    ...input,
    bundledItems: [input.bundledItem],
  });
}

export function mergeBundledExactKoshaFallbacks(input: Readonly<{
  query: string;
  remoteItems: readonly SafetyReferenceItem[];
  bundledItems: readonly SafetyReferenceItem[];
  localGateActive: boolean;
  limit: number;
  filters?: Pick<SafetyReferenceSearchOptions, "sourceId" | "riskTag" | "itemType" | "evidenceRole">;
}>): SafetyReferenceItem[] {
  const gated = input.localGateActive
    ? input.remoteItems.filter(isRemoteReferenceRetainedByLocalKoshaGate)
    : [...input.remoteItems];
  const applicable = input.bundledItems.filter((item) => (
    exactBundleAppliesToQuery(item, input.query)
    && exactBundleMatchesFilters(item, input.filters ?? {})
  ));
  const configuredIds = new Set(input.bundledItems.map((item) => item.id));
  const exactItems = applicable.map((bundledItem) => (
    gated.find((item) => item.id === bundledItem.id && isProductionTrustedKoshaReference(item))
    ?? bundledItem
  ));
  const retained = gated.filter((item) => (
    !configuredIds.has(item.id)
    && !isKoshaTechnicalReference(item)
  ));
  const selected = [...exactItems, ...retained];
  const deduplicated: SafetyReferenceItem[] = [];
  const seen = new Set<string>();
  for (const item of selected) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    deduplicated.push(item);
    if (deduplicated.length >= input.limit) break;
  }
  return deduplicated;
}

export async function searchSafetyReferences(
  options: SafetyReferenceServerSearchOptions
): Promise<SafetyReferenceSearchResult> {
  const query = options.query.trim();
  const limit = Math.min(Math.max(options.limit || 12, 1), 50);
  const localSearchAllowed = localSnapshotAllowed(options);
  const trustGateActive = koshaTrustGateApplies(options);
  const localCorpus = trustGateActive
    ? await loadKoshaGuideCorpus(options.offlineCorpus)
    : { status: "unconfigured" as const, rootDir: null, failures: [] as [] };
  const responseLocalCorpusStatus = localSearchAllowed ? localCorpus.status : "unconfigured";
  const localSearch = localSearchAllowed && localCorpus.status === "ready"
    ? searchKoshaGuideCorpus(localCorpus, query, limit, options.itemType)
    : { retrievalMode: null, items: [] };
  const localItems = localSearch.items
    .filter(() => !options.evidenceRole || options.evidenceRole === "supporting")
    .map(buildLocalItem);
  const bundledExact = trustGateActive
    ? await loadBundledExactKoshaReferences(options.exactKoshaAssetPaths)
    : { status: "blocked" as const, reason: "asset-unavailable" as const, message: "bundle not applicable" };
  const remoteResult = await searchRemoteSafetyReferences(options);
  const remoteItems = remoteResult.items.map((item) => {
    const exactGrounding = buildExactTrustedKoshaGroundingDecision(item);
    return exactGrounding ? { ...item, kosha_grounding: exactGrounding } : item;
  });
  const remote: SafetyReferenceSearchResult = { ...remoteResult, items: remoteItems };
  const localGateStatus = trustGateActive && localCorpus.status !== "ready"
    ? localCorpus.status
    : null;
  const exactRegistryBlocked = trustGateActive && bundledExact.status !== "ready";
  const localGateFailures = localCorpus.status === "blocked" ? localCorpus.failures : [];
  const retainedRemoteItems = bundledExact.status === "ready"
    ? mergeBundledExactKoshaFallbacks({
        query,
        remoteItems: remote.items,
        bundledItems: bundledExact.items,
        localGateActive: localGateStatus !== null,
        limit,
        filters: options,
      })
    : trustGateActive
      ? remote.items.filter((item) => !isKoshaTechnicalReference(item))
      : remote.items;
  const retainedOriginalRemoteCount = remote.items.filter((item) => retainedRemoteItems.includes(item)).length;
  const excludedRemoteCount = remote.items.length - retainedOriginalRemoteCount;
  const bundledFallbackUsed = bundledExact.status === "ready"
    && bundledExact.items.some((bundledItem) => retainedRemoteItems.includes(bundledItem));
  const remoteSelectionChanged = retainedRemoteItems.length !== remote.items.length
    || retainedRemoteItems.some((item, index) => item !== remote.items[index]);
  const retainedVerifiedRemoteCount = retainedRemoteItems.filter((item) => (
    isKoshaTechnicalReference(item) && isKoshaSupportingCitationEligible(item)
  )).length;
  const remoteWithFallback: SafetyReferenceSearchResult = bundledExact.status === "ready" && remoteSelectionChanged
    ? {
        ...remote,
        configured: true,
        count: retainedRemoteItems.length,
        items: retainedRemoteItems,
        koshaGrounding: summarizeKoshaGrounding({
          items: retainedRemoteItems,
          localCorpusStatus: localGateStatus ?? responseLocalCorpusStatus,
          excludedCount: excludedRemoteCount,
        }),
        message: bundledFallbackUsed
          ? `${remote.message} 공식 KOSHA 정확 본문 번들로 partial DB 본문을 대체했습니다.`.trim()
          : `${remote.message} 질의 및 exact trust gate 기준에 맞지 않는 KOSHA 원격 행을 제외했습니다.`.trim(),
      }
    : exactRegistryBlocked
      ? {
          ...remote,
          count: retainedRemoteItems.length,
          items: retainedRemoteItems,
          message: `${remote.message} 공식 KOSHA 정확 본문 레지스트리 무결성 실패로 기술지침 근거를 차단했습니다.`.trim(),
        }
      : remote;
  const blockedReason = exactRegistryBlocked
    ? "exact-registry-integrity-failed" as const
    : localGateStatus
      ? localGateReason(localGateStatus)
      : undefined;
  const gatedRemote: SafetyReferenceSearchResult = localGateStatus || exactRegistryBlocked
    ? {
        ...remoteWithFallback,
        count: retainedRemoteItems.length,
        items: retainedRemoteItems,
        koshaGrounding: summarizeKoshaGrounding({
          items: retainedRemoteItems,
          localCorpusStatus: localGateStatus ?? responseLocalCorpusStatus,
          excludedCount: excludedRemoteCount,
          blockedReason,
        }),
        message: localGateStatus
          ? `${remoteWithFallback.message} ${localGateMessage(
              localGateStatus,
              localGateFailures,
              excludedRemoteCount,
              retainedVerifiedRemoteCount
            )}`.trim()
          : remoteWithFallback.message,
      }
    : remoteWithFallback;

  if (!remote.configured) {
    if (exactRegistryBlocked) return gatedRemote;
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
          localCorpusStatus: "ready",
          excludedCount: excludedRemoteCount,
        }),
        message: "서버 전용 KOSHA 스냅샷에서 오프라인 보조근거를 조회했습니다."
      };
    }
    if (localCorpus.status === "blocked") {
      return {
        ...gatedRemote,
        configured: true,
        message: localGateMessage(
          "blocked",
          localCorpus.failures,
          excludedRemoteCount,
          retainedVerifiedRemoteCount
        )
      };
    }
    return gatedRemote;
  }
  if (!remote.ok || localGateStatus || exactRegistryBlocked) return gatedRemote;
  if (!localItems.length) return remoteWithFallback;

  const merged = mergeLocalAndRemoteSafetyReferenceResults({
    localItems,
    remoteItems: remoteWithFallback.items,
    remoteRetrievalMode: remoteWithFallback.retrievalMode,
    limit
  });
  return {
    ...remoteWithFallback,
    count: merged.items.length,
    items: merged.items,
    retrievalMode: merged.retrievalMode,
    koshaGrounding: summarizeKoshaGrounding({
      items: merged.items,
      localCorpusStatus: "ready"
    }),
    message: `KOSHA 오프라인 보조근거와 ${remoteWithFallback.message}`
  };
}
