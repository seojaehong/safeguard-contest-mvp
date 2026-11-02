// runAsk 가 본표 정본 행(structured.riskAssessmentRows)을 어느 분기에서 만들었는지 generationTrace.rowsOrigin 에 적는가
// (261101 2차 교차 검토 3). MCP generate_risk_assessment 의 status 는 이 값으로 정한다(전역 fallbackUsed 가 아니다).
// 검색·모델 호출은 시험 더블로 막는다(tests/kosha-current-review-run-ask.test.ts 와 같은 방식). 근거 문장은 가상이다.
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AiDeliverables, AiDeliverablesDiagnostics } from "@/lib/ai-deliverables";
import { buildMockAskResponse, mockSearchResults } from "@/lib/mock-data";
import type { RiskAssessmentRow } from "@/lib/risk-assessment-schema";
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

const QUESTION = "가상 사업장 누리물류 물류창고 지게차 보행자 동선 충돌 위험 상하차 작업 4명";

function searchResult(items: SafetyReferenceItem[], query = QUESTION): SafetyReferenceSearchResult {
  return {
    ok: true,
    configured: true,
    query,
    count: items.length,
    items,
    retrievalMode: "ranked-rpc",
    vectorSearch: { enabled: false, attempted: false, ok: false, reason: "disabled", count: 0, model: "text-embedding-3-small", message: "벡터 검색 비활성" },
    message: "안전 지식 DB 조회 완료"
  };
}

/** 작업과 맞는 직접 근거(기계·설비 원천, KOSHA 지침 아님). */
function directForkliftReference(): SafetyReferenceItem {
  return {
    id: "v-direct-forklift",
    source_id: "supabase-test",
    item_type: "machinery",
    category: "운반하역",
    subcategory: "지게차",
    title: "가상 근거 — 지게차 보행자 충돌 예방",
    summary: "지게차 운행 동선과 보행자 통행 동선을 분리한다.",
    keywords: ["지게차", "보행자", "동선", "충돌"],
    risk_tags: ["충돌"],
    primary_documents: ["위험성평가표", "TBM 브리핑", "TBM 기록"],
    controls: ["지게차 동선과 보행 동선을 분리"],
    evidence_role: "direct",
    retrieval_source: "ranked"
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

const PROVIDER_ROW: RiskAssessmentRow = {
  location: "가상 물류창고 상하차장",
  process: "상하차",
  task: "지게차 상하차",
  equipment: "지게차",
  hazard: "후진하는 지게차와 보행자 충돌",
  fourM: "Machine",
  accidentType: "struckBy",
  currentControls: "보행 통로 표시",
  likelihood: 3,
  severity: 4,
  riskLevel: "high",
  additionalControls: "지게차 동선과 보행 동선을 분리하고 유도자 배치",
  owner: "관리감독자",
  due: "현장 확인",
  verification: "작업 전 현장 확인",
  verificationStatus: "planned",
  verificationDate: "현장 확인",
  verificationChecker: "작업반장",
  whyLikelihood: "상하차 시간대 보행자 통행이 잦다",
  whySeverity: "충돌 시 중상 우려",
  evidenceRefs: ["가상 근거 — 지게차 보행자 충돌 예방"]
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.fetchKoshaReferences.mockResolvedValue({ source: "kosha", mode: "fallback", detail: "시험", references: [] });
  mocks.enhanceLegalEvidenceMappings.mockImplementation(async (_question: string, citations: SearchResult[]) => citations);
  mocks.generateAnswer.mockImplementation(async (question: string, citations: SearchResult[]) => ({
    response: buildMockAskResponse(question, citations.length ? citations : mockSearchResults.slice(0, 2), "mock", "시험 응답"),
    trace: { provider: "mock", model: null, fallbackUsed: false }
  }));
  mocks.generateAllDeliverablesWithDiagnostics.mockResolvedValue(providerDiagnostics({}));
  mocks.searchSafetyReferences.mockResolvedValue(searchResult([]));
});

describe("generationTrace.rowsOrigin", () => {
  it("template 모드로 요청하면 template", async () => {
    const response = await runAsk(QUESTION, { aiMode: "template" });
    expect(response.structured?.riskAssessmentRows.length).toBeGreaterThan(0);
    expect(response.generationTrace?.rowsOrigin).toBe("template");
  }, 30_000);

  it("작업 유형을 확인하지 못한 보류 응답은 행이 없어 none", async () => {
    const response = await runAsk("내일 오전에 사무실에서 할 일 정리", { aiMode: "enhanced" });
    expect(response.structured?.riskAssessmentRows).toEqual([]);
    expect(response.generationTrace?.rowsOrigin).toBe("none");
  }, 30_000);

  it("enhanced 에서 안전 지식 DB 근거로 행을 만들면 db_harness — 답변 생성이 보조 응답으로 끝나도 같다", async () => {
    mocks.searchSafetyReferences.mockResolvedValue(searchResult([directForkliftReference()]));
    mocks.generateAnswer.mockRejectedValue(new Error("provider down"));
    const response = await runAsk(QUESTION, { aiMode: "enhanced" });
    expect(response.structured?.riskAssessmentRows.length).toBeGreaterThan(0);
    expect(response.generationTrace?.fallbackUsed).toBe(true);
    expect(response.generationTrace?.rowsOrigin).toBe("db_harness");
  }, 30_000);

  it("enhanced 에서 DB 근거가 없어 작업 유형 기본 행으로 대신하면 fallback_baseline", async () => {
    const response = await runAsk(QUESTION, { aiMode: "enhanced" });
    expect(response.structured?.riskAssessmentRows.length).toBeGreaterThan(0);
    expect(response.generationTrace?.fallbackUsed).toBe(false);
    expect(response.generationTrace?.rowsOrigin).toBe("fallback_baseline");
  }, 30_000);

  it("full 에서 모델이 만든 행을 쓰면 ai", async () => {
    mocks.searchSafetyReferences.mockResolvedValue(searchResult([directForkliftReference()]));
    mocks.generateAllDeliverablesWithDiagnostics.mockResolvedValue(providerDiagnostics({ structuredRiskRows: [PROVIDER_ROW] }));
    const response = await runAsk(QUESTION, { aiMode: "full" });
    expect(response.structured?.riskAssessmentRows.map((row) => row.hazard)).toContain(PROVIDER_ROW.hazard);
    expect(response.generationTrace?.rowsOrigin).toBe("ai");
  }, 30_000);
});
