import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildMockAskResponse, mockSearchResults } from "@/lib/mock-data";
import { runAsk } from "@/lib/search";
import type { SafetyReferenceItem, SafetyReferenceSearchResult } from "@/lib/safety-reference-catalog";
import type { SearchResult } from "@/lib/types";

const mocks = vi.hoisted(() => ({
  enhanceLegalEvidenceMappings: vi.fn(),
  generateAllDeliverablesWithDiagnostics: vi.fn(),
  generateAnswer: vi.fn(),
  searchSafetyReferences: vi.fn()
}));

vi.mock("@/lib/ai", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/ai")>();
  return {
    ...original,
    enhanceLegalEvidenceMappings: mocks.enhanceLegalEvidenceMappings,
    generateAnswer: mocks.generateAnswer
  };
});

vi.mock("@/lib/ai-deliverables", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/ai-deliverables")>();
  return {
    ...original,
    generateAllDeliverablesWithDiagnostics: mocks.generateAllDeliverablesWithDiagnostics
  };
});

vi.mock("@/lib/safety-reference-catalog", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/safety-reference-catalog")>();
  return { ...original, searchSafetyReferences: mocks.searchSafetyReferences };
});

function retrievalReference(
  id: string,
  source: NonNullable<SafetyReferenceItem["retrieval_source"]>
): SafetyReferenceItem {
  const local = source.startsWith("local-");
  return {
    id,
    source_id: local ? `kosha-guide-offline:${id}` : "supabase-test",
    item_type: local ? "technical-guideline" : "machinery",
    category: "운반하역",
    subcategory: "지게차",
    title: `${id} 지게차 보행자 충돌 근거`,
    summary: "지게차 운행경로와 보행자 통행 동선을 분리한다.",
    body: local ? "검증된 현행 KOSHA 지침 본문: 지게차 동선과 보행 동선을 분리한다." : undefined,
    keywords: ["지게차", "보행자", "동선", "충돌"],
    risk_tags: ["충돌"],
    primary_documents: ["위험성평가표", "TBM 브리핑", "TBM 기록"],
    controls: ["지게차 동선과 보행 동선을 분리"],
    evidence_role: local ? "supporting" : "direct",
    retrieval_source: source,
    ...(local ? {
      kosha_guide: {
        referenceId: id,
        stableDocumentKey: `${id}-stable`,
        version: "2026",
        quality: "accepted" as const,
        lifecycle: "current" as const,
        bodyKind: "native" as const,
        anchors: [{ page: 1, excerpt: "지게차 동선 분리" }],
        evidenceRef: `KOSHA 근거 ${id} p.1: 지게차 동선 분리`,
        directEligible: true
      }
    } : {})
  };
}

function searchResult(
  retrievalMode: SafetyReferenceSearchResult["retrievalMode"],
  items: SafetyReferenceItem[],
  query = "지게차 보행자 동선 충돌"
): SafetyReferenceSearchResult {
  return {
    ok: true,
    configured: true,
    query,
    count: items.length,
    items,
    retrievalMode,
    vectorSearch: {
      enabled: false,
      attempted: false,
      ok: false,
      reason: "disabled",
      count: 0,
      model: "text-embedding-3-small",
      message: "벡터 검색 비활성"
    },
    message: "안전 지식 DB 조회 완료"
  };
}

describe("current-base runAsk retrieval provenance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.enhanceLegalEvidenceMappings.mockImplementation(
      async (_question: string, citations: SearchResult[]) => citations
    );
    mocks.generateAnswer.mockImplementation(async (question: string, citations: SearchResult[]) => ({
      response: buildMockAskResponse(
        question,
        citations.length ? citations : mockSearchResults.slice(0, 2),
        "mock",
        "provider unavailable in retrieval provenance test"
      ),
      trace: { provider: "mock", model: null, fallbackUsed: false }
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("propagates final local-ranked items through runAsk and the DB packet", async () => {
    mocks.searchSafetyReferences.mockResolvedValue(searchResult(
      "local-ranked",
      [retrievalReference("local-ranked-guide", "local-ranked")]
    ));

    const response = await runAsk("지게차 보행자 동선 충돌", { aiMode: "enhanced" });

    expect(response.externalData.safetyReference?.retrievalMode).toBe("local-ranked");
    expect(response.dbHarness?.packet.retrievalContract.mode).toBe("local-ranked");
    expect(response.dbHarness?.packet.retrievalContract.sourceCounts.localRanked).toBe(1);
  }, 30_000);

  it("derives hybrid-local from final mixed items instead of attempted buckets", async () => {
    const remote = retrievalReference("remote-ranked-guide", "ranked");
    const local = retrievalReference("local-ranked-guide", "local-ranked");
    mocks.searchSafetyReferences.mockImplementation(async (options: { query: string; itemType?: string }) => {
      if (options.itemType === "technical-support-regulation") {
        return searchResult("ranked-rpc", [remote], options.query);
      }
      if (options.itemType === "technical-guideline") {
        return searchResult("local-ranked", [local], options.query);
      }
      return searchResult("unconfigured", [], options.query);
    });

    const response = await runAsk("지게차 보행자 동선 충돌", { aiMode: "enhanced" });

    expect(response.externalData.safetyReference?.retrievalMode).toBe("hybrid-local-supabase");
    expect(response.dbHarness?.packet.retrievalContract.mode).toBe("hybrid-local-supabase");
    expect(response.dbHarness?.packet.retrievalContract.sourceCounts).toMatchObject({
      ranked: 1,
      localRanked: 1
    });
  }, 30_000);

  it("excludes stale D-C-13 when the local corpus is unavailable", async () => {
    const remote = retrievalReference("remote-ranked-guide", "ranked");
    const local = retrievalReference("d-c-13-current-unverified", "local-ranked");
    remote.title = "외벽 작업발판 안전난간 직접 근거";
    remote.summary = "외벽 작업발판과 안전난간 상태를 확인한다.";
    remote.keywords = ["외벽", "도장", "작업발판", "안전난간"];
    remote.controls = ["외벽 작업발판과 안전난간 상태 확인"];
    local.title = "D-C-13-2026 외벽도장보수공사 안전 기술지원규정";
    local.summary = "외벽 작업발판과 안전난간 상태를 확인한다.";
    local.keywords = ["외벽", "도장", "작업발판", "안전난간"];
    local.controls = ["외벽 작업발판과 안전난간 상태 확인"];
    local.kosha_guide = {
      referenceId: "d-c-13-current-unverified",
      stableDocumentKey: "D-C-13",
      version: "D-C-13-2026",
      quality: "review_required",
      lifecycle: "stale",
      bodyKind: "native",
      anchors: [{ page: 7, excerpt: "외벽 작업발판과 안전난간 상태를 확인한다." }],
      evidenceRef: "KOSHA 근거 D-C-13-2026 p.7: 외벽 작업발판과 안전난간 상태를 확인한다.",
      directEligible: false
    };
    mocks.searchSafetyReferences.mockImplementation(async (options: { query: string; itemType?: string }) => {
      if (options.itemType === "technical-support-regulation") {
        return searchResult("ranked-rpc", [remote], options.query);
      }
      if (options.itemType === "technical-guideline") {
        return searchResult("local-ranked", [local], options.query);
      }
      return searchResult("unconfigured", [], options.query);
    });

    const response = await runAsk("외벽 도장 작업발판 안전난간", { aiMode: "enhanced" });
    const surfaced = response.externalData.safetyReference?.items.find((item) => item.id === local.id);

    expect(response.externalData.safetyReference?.retrievalMode).toBe("ranked-rpc");
    expect(surfaced).toBeUndefined();
    expect(response.dbHarness?.packet.supportingEvidence.some((item) => item.id === local.id)).toBe(false);
  }, 30_000);

  it("does not promote metadata-less remote KOSHA into required body citations", async () => {
    const unverified = retrievalReference("metadata-less-kosha", "ranked");
    unverified.item_type = "technical-guideline";
    unverified.title = "D-C-13-2026 메타데이터 없는 KOSHA 기술지침";
    unverified.summary = "EXCLUDED_KOSHA_CONTROL을 문서에 직접 반영한다.";
    unverified.controls = ["EXCLUDED_KOSHA_CONTROL"];
    unverified.evidence_role = "direct";
    mocks.searchSafetyReferences.mockResolvedValue(searchResult("ranked-rpc", [unverified]));

    await runAsk("D-C-13 지게차 EXCLUDED_KOSHA_CONTROL", { aiMode: "full" });

    expect(mocks.generateAllDeliverablesWithDiagnostics).toHaveBeenCalled();
    const generationInputs = mocks.generateAllDeliverablesWithDiagnostics.mock.calls.map(([input]) => input as {
      koshaLines?: string[];
      koshaPrimaryRefs?: Array<{ title: string }>;
    });
    expect(generationInputs.every((input) => (input.koshaPrimaryRefs || []).length === 0)).toBe(true);
    expect(generationInputs.flatMap((input) => input.koshaLines || []).join("\n")).not.toContain(
      "EXCLUDED_KOSHA_CONTROL"
    );
  }, 30_000);

  it("selects a verified current KOSHA citation even after five unverified matches", async () => {
    const sharedTitle = "D-C-13 지게차 보행자 동선 충돌 기술지침";
    const verifiedTitle = "VERIFIED_CURRENT_AFTER_FIVE KOSHA 기술지침";
    const unverified = Array.from({ length: 5 }, (_, index) => {
      const item = retrievalReference(`unverified-kosha-${index + 1}`, "ranked");
      item.item_type = "technical-guideline";
      item.title = sharedTitle;
      item.evidence_role = "supporting";
      item.primary_documents = ["위험성평가표", `UNVERIFIED_DOCUMENT_${index + 1}`];
      item.kosha_guide = undefined;
      return item;
    });
    const verified = retrievalReference("verified-current-after-five", "local-ranked");
    verified.title = verifiedTitle;
    verified.primary_documents = ["위험성평가표", "VERIFIED_DOCUMENT"];
    mocks.searchSafetyReferences.mockResolvedValue(searchResult(
      "hybrid-local-supabase",
      [...unverified, verified]
    ));

    await runAsk("D-C-13 지게차 보행자 동선 충돌", { aiMode: "full" });

    const generationInputs = mocks.generateAllDeliverablesWithDiagnostics.mock.calls.map(([input]) => input as {
      koshaPrimaryRefs?: Array<{ title: string }>;
    });
    expect(generationInputs.some((input) => (
      input.koshaPrimaryRefs || []
    ).some((reference) => reference.title === verifiedTitle))).toBe(true);
  }, 30_000);
});
