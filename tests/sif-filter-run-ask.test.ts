// SIF 관련성 거름(lib/sif-case-relevance.ts)이 runAsk 의 KOSHA 상위 근거 판정에 미치는 영향(261101 2차 교차 검토 4).
// 결정: KOSHA 기술지침의 상위 근거(parent)는 거른 뒤 남은 사례·직접 근거로만 정한다(buildKoshaParentEvidenceReadyIds 가
// packet.sifCases 를 쓴다). 뺀 사례는 생성 근거가 아니므로 그 사례 하나에만 기대던 KOSHA 지침은 상위 근거 없음으로 보고
// 본표 행을 만들지 않는다(확인 필요). 이 때문에 확인 필요가 늘 수 있는데, 엉뚱한 사례를 근거로 행을 만드는 것보다 낫다고 본다.
// 검색·모델 호출은 시험 더블로 막는다. 사례·지침 문장은 가상이다.
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AiDeliverables, AiDeliverablesDiagnostics } from "@/lib/ai-deliverables";
import { buildDbHarnessPacket, hasRelevantKoshaParent } from "@/lib/db-harness";
import { buildMockAskResponse, mockSearchResults } from "@/lib/mock-data";
import type { SafetyReferenceItem, SafetyReferenceSearchResult } from "@/lib/safety-reference-catalog";
import { runAsk } from "@/lib/search";
import type { SearchResult } from "@/lib/types";

const mocks = vi.hoisted(() => ({
  enhanceLegalEvidenceMappings: vi.fn(),
  fetchKoshaReferences: vi.fn(),
  generateAllDeliverablesWithDiagnostics: vi.fn(),
  generateAnswer: vi.fn(),
  searchSafetyReferences: vi.fn()
}));

vi.mock("@/lib/kosha", () => ({ fetchKoshaReferences: mocks.fetchKoshaReferences }));
vi.mock("@/lib/ai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/ai")>()),
  enhanceLegalEvidenceMappings: mocks.enhanceLegalEvidenceMappings,
  generateAnswer: mocks.generateAnswer
}));
vi.mock("@/lib/ai-deliverables", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/ai-deliverables")>()),
  generateAllDeliverablesWithDiagnostics: mocks.generateAllDeliverablesWithDiagnostics
}));
vi.mock("@/lib/safety-reference-catalog-server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/safety-reference-catalog-server")>()),
  searchSafetyReferences: mocks.searchSafetyReferences
}));

// 작업 묶음 = 화기·용접. 재해형태(추락)는 적지 않았다.
const QUESTION = "가상 사업장 외벽 철골 용접 보수 작업 2명, 불티 비산 우려";

function facadeKoshaGuide(): SafetyReferenceItem {
  return {
    id: "v-kosha-facade",
    source_id: "kosha-guide-offline:v-kosha-facade",
    item_type: "technical-guideline",
    category: "건설안전",
    subcategory: "외벽",
    title: "가상 KOSHA 지침 외벽 작업 추락 예방",
    summary: "외벽 작업 전 작업발판과 난간 상태를 확인한다.",
    body: "가상 본문: 외벽 작업 전 작업발판과 난간 상태를 확인한다.",
    keywords: ["외벽", "추락", "작업발판"],
    risk_tags: ["추락"],
    primary_documents: ["위험성평가표", "TBM 브리핑", "TBM 기록"],
    controls: ["작업발판과 난간 확인"],
    evidence_role: "supporting",
    retrieval_source: "local-ranked",
    kosha_guide: {
      referenceId: "v-kosha-facade",
      stableDocumentKey: "v-kosha-facade-stable",
      version: "2026",
      quality: "accepted",
      lifecycle: "current",
      bodyKind: "native",
      anchors: [{ page: 1, excerpt: "작업발판과 난간 확인" }],
      evidenceRef: "가상 KOSHA 근거 p.1: 작업발판과 난간 확인",
      directEligible: true,
      officialUrl: "https://portal.kosha.or.kr/archive/resources/tech-support/search/all",
      officialFileId: "fixture-v-kosha-facade",
      publicationDate: "2026-01-30",
      officialVersion: "2026",
      officialStatus: "current",
      pdfSha256: "1".repeat(64),
      bodySha256: "2".repeat(64)
    }
  };
}

/** 지침과는 영역(외벽·추락)이 겹쳐 상위 근거가 될 수 있지만, 질문의 작업(용접)과는 작업 묶음이 다른 사례. */
function facadeFallSif(): SafetyReferenceItem {
  return {
    id: "v-sif-facade-fall",
    source_id: "kosha-sif-archive-20260401",
    item_type: "sif-case",
    category: null,
    subcategory: null,
    title: "가상 사례 — 외벽 작업발판에서 균형을 잃고 추락",
    summary: "가상 개요: 난간이 없는 외벽 작업발판에서 떨어졌다.",
    keywords: ["외벽", "추락"],
    risk_tags: ["추락"],
    primary_documents: ["위험성평가표"],
    controls: ["작업발판 난간 설치"],
    evidence_role: "supporting",
    retrieval_source: "ranked"
  };
}

function searchResult(items: SafetyReferenceItem[]): SafetyReferenceSearchResult {
  return {
    ok: true,
    configured: true,
    query: QUESTION,
    count: items.length,
    items,
    retrievalMode: "hybrid-local-supabase",
    vectorSearch: { enabled: false, attempted: false, ok: false, reason: "disabled", count: 0, model: "text-embedding-3-small", message: "벡터 검색 비활성" },
    message: "안전 지식 DB 조회 완료"
  };
}

function providerDiagnostics(deliverables: AiDeliverables) {
  const diagnostics: AiDeliverablesDiagnostics = {
    geminiAvailable: true,
    providerAvailable: true,
    configuredProvider: "vertex",
    groupResults: [],
    filledKeys: Object.keys(deliverables),
    trace: { attempted: true, provider: "vertex", modelPerDocument: {}, fallbackUsed: false }
  };
  return { deliverables, diagnostics };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.fetchKoshaReferences.mockResolvedValue({ source: "kosha", mode: "fallback", detail: "시험", references: [] });
  mocks.enhanceLegalEvidenceMappings.mockImplementation(async (_question: string, citations: SearchResult[]) => citations);
  mocks.generateAnswer.mockImplementation(async (question: string, citations: SearchResult[]) => ({
    response: buildMockAskResponse(question, citations.length ? citations : mockSearchResults.slice(0, 2), "mock", "시험 응답"),
    trace: { provider: "mock", model: null, fallbackUsed: false }
  }));
  mocks.generateAllDeliverablesWithDiagnostics.mockResolvedValue(providerDiagnostics({}));
});

describe("KOSHA 지침의 상위 근거는 거른 뒤 남은 사례로만 정한다", () => {
  it("거르기 전이면 상위 근거가 됐을 사례가 빠지면 패킷 기준으로 그 지침은 상위 근거가 없다", () => {
    const packet = buildDbHarnessPacket({ question: QUESTION, references: [facadeKoshaGuide(), facadeFallSif()] });
    // 시험 전제: 이 사례는 거르기 전 목록이라면 지침의 상위 근거다.
    expect(hasRelevantKoshaParent(facadeKoshaGuide(), [facadeFallSif()])).toBe(true);
    expect(packet.sifSelection?.excluded.map((item) => item.id)).toEqual(["v-sif-facade-fall"]);
    expect(hasRelevantKoshaParent(facadeKoshaGuide(), [...packet.sifCases, ...packet.directEvidence])).toBe(false);
  });

  it("runAsk 는 뺀 사례 하나에만 기대던 지침으로 행을 만들지 않고 확인 필요로 둔다 — 사례가 없을 때와 같다", async () => {
    mocks.searchSafetyReferences.mockResolvedValue(searchResult([facadeKoshaGuide(), facadeFallSif()]));
    const withExcluded = await runAsk(QUESTION, { aiMode: "enhanced" });

    expect(withExcluded.structured?.riskAssessmentRows).toEqual([]);
    expect(withExcluded.generationTrace?.rowsOrigin).toBe("none");
    expect(withExcluded.dbHarness?.packet?.sifSelection?.excluded?.map((item) => item.id)).toEqual(["v-sif-facade-fall"]);
    expect(withExcluded.dbHarness?.packet?.sifCases).toEqual([]);
    expect(withExcluded.dbHarness?.summary.ontologyStatus).toBe("review_required");
    const structuredText = JSON.stringify(withExcluded.structured);
    for (const needle of ["균형을 잃고", "v-sif-facade-fall"]) expect(structuredText).not.toContain(needle);

    mocks.searchSafetyReferences.mockResolvedValue(searchResult([facadeKoshaGuide()]));
    const withoutCase = await runAsk(QUESTION, { aiMode: "enhanced" });
    expect(withExcluded.structured?.riskAssessmentRows).toEqual(withoutCase.structured?.riskAssessmentRows);
    expect(withExcluded.generationTrace?.rowsOrigin).toBe(withoutCase.generationTrace?.rowsOrigin);
    expect(withExcluded.dbHarness?.summary.ontologyStatus).toBe(withoutCase.dbHarness?.summary.ontologyStatus);
  }, 60_000);
});
