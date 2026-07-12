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
});
