import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildMockAskResponse, mockSearchResults } from "@/lib/mock-data";
import type { AiDeliverables, AiDeliverablesDiagnostics, AiMode, GenerateAllOptions } from "@/lib/ai-deliverables";
import type { RiskAssessmentRow } from "@/lib/risk-assessment-schema";
import { runAsk } from "@/lib/search";
import type { SafetyReferenceItem, SafetyReferenceSearchResult } from "@/lib/safety-reference-catalog";
import type { AskResponse, SearchResult, TbmRiskLink } from "@/lib/types";

const mocks = vi.hoisted(() => ({
  enhanceLegalEvidenceMappings: vi.fn(),
  fetchKoshaReferences: vi.fn(),
  generateAllDeliverablesWithDiagnostics: vi.fn(),
  generateAnswer: vi.fn(),
  searchSafetyReferences: vi.fn()
}));

vi.mock("@/lib/kosha", () => ({
  fetchKoshaReferences: mocks.fetchKoshaReferences
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
        directEligible: true,
        officialUrl: "https://portal.kosha.or.kr/archive/resources/tech-support/search/all",
        officialFileId: `fixture-${id}`,
        publicationDate: "2026-01-30",
        officialVersion: "2026",
        officialStatus: "current",
        pdfSha256: "1".repeat(64),
        bodySha256: "2".repeat(64)
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

function providerResult(deliverables: AiDeliverables = {}) {
  const diagnostics: AiDeliverablesDiagnostics = {
    geminiAvailable: true,
    providerAvailable: true,
    configuredProvider: "vertex",
    groupResults: [],
    filledKeys: Object.keys(deliverables),
    trace: {
      attempted: true,
      provider: "vertex",
      modelPerDocument: {},
      fallbackUsed: false
    }
  };
  return { deliverables, diagnostics };
}

type KoshaOnlyFixture = ReturnType<typeof configureKoshaOnlySearch>;
type ProviderActionSurface = Pick<AiDeliverables, "structuredRiskRows" | "tbmRiskLinks">;

function providerActionSurface(fixture: KoshaOnlyFixture): ProviderActionSurface {
  const riskRow: RiskAssessmentRow = {
    location: "provider location",
    process: "provider process",
    task: "provider task",
    equipment: "provider equipment",
    hazard: fixture.hazard,
    fourM: "Man",
    accidentType: "other",
    currentControls: fixture.control,
    likelihood: 3,
    severity: 4,
    riskLevel: "high",
    additionalControls: fixture.action,
    owner: "provider owner",
    due: "provider due",
    verification: "provider verification",
    verificationStatus: "planned",
    verificationDate: "2026-07-14",
    verificationChecker: "provider checker",
    whyLikelihood: "provider likelihood",
    whySeverity: "provider severity",
    evidenceRefs: [fixture.evidenceRef]
  };
  const tbmRiskLink: TbmRiskLink = {
    riskRowIndex: 0,
    hazard: fixture.hazard,
    control: fixture.control,
    weatherSignal: "provider weather",
    confirmQuestion: fixture.action,
    owner: "provider owner",
    verification: "provider verification",
    evidenceRefs: [fixture.evidenceRef]
  };
  return {
    structuredRiskRows: [riskRow],
    tbmRiskLinks: [tbmRiskLink]
  };
}

const RESPONSE_NARRATIVE_SURFACES = [
  "workpackSummaryDraft",
  "riskAssessmentDraft",
  "workPlanDraft",
  "workPermitDraft",
  "tbmBriefing",
  "tbmLogDraft",
  "safetyEducationRecordDraft",
  "emergencyResponseDraft",
  "photoEvidenceDraft",
  "foreignWorkerBriefing",
  "foreignWorkerTransmission",
  "foreignWorkerLanguages",
  "safetyEducationPoints",
  "tbmQuestions",
  "kakaoMessage"
] as const;

const AI_NARRATIVE_SURFACES = RESPONSE_NARRATIVE_SURFACES.filter((key) => key !== "workPermitDraft");

function providerNarrativeMarker(prefix: string, surface: string): string {
  return `V4_${prefix}_${surface}`;
}

function providerNarrativeMarkers(prefix: string, surfaces: readonly string[]): string[] {
  return surfaces.map((surface) => providerNarrativeMarker(prefix, surface));
}

function providerNarrativeDeliverables(prefix: string): AiDeliverables {
  return {
    workpackSummaryDraft: providerNarrativeMarker(prefix, "workpackSummaryDraft"),
    riskAssessmentDraft: providerNarrativeMarker(prefix, "riskAssessmentDraft"),
    workPlanDraft: providerNarrativeMarker(prefix, "workPlanDraft"),
    tbmBriefing: providerNarrativeMarker(prefix, "tbmBriefing"),
    tbmLogDraft: providerNarrativeMarker(prefix, "tbmLogDraft"),
    safetyEducationRecordDraft: providerNarrativeMarker(prefix, "safetyEducationRecordDraft"),
    emergencyResponseDraft: providerNarrativeMarker(prefix, "emergencyResponseDraft"),
    photoEvidenceDraft: providerNarrativeMarker(prefix, "photoEvidenceDraft"),
    foreignWorkerBriefing: providerNarrativeMarker(prefix, "foreignWorkerBriefing"),
    foreignWorkerTransmission: providerNarrativeMarker(prefix, "foreignWorkerTransmission"),
    foreignWorkerLanguages: [providerNarrativeMarker(prefix, "foreignWorkerLanguages")],
    safetyEducationPoints: [providerNarrativeMarker(prefix, "safetyEducationPoints")],
    tbmQuestions: [providerNarrativeMarker(prefix, "tbmQuestions")],
    kakaoMessage: providerNarrativeMarker(prefix, "kakaoMessage")
  };
}

function withProviderNarrativeAttack(response: AskResponse, prefix: string): AskResponse {
  return {
    ...response,
    deliverables: {
      ...response.deliverables,
      workpackSummaryDraft: providerNarrativeMarker(prefix, "workpackSummaryDraft"),
      riskAssessmentDraft: providerNarrativeMarker(prefix, "riskAssessmentDraft"),
      workPlanDraft: providerNarrativeMarker(prefix, "workPlanDraft"),
      workPermitDraft: providerNarrativeMarker(prefix, "workPermitDraft"),
      tbmBriefing: providerNarrativeMarker(prefix, "tbmBriefing"),
      tbmLogDraft: providerNarrativeMarker(prefix, "tbmLogDraft"),
      safetyEducationRecordDraft: providerNarrativeMarker(prefix, "safetyEducationRecordDraft"),
      emergencyResponseDraft: providerNarrativeMarker(prefix, "emergencyResponseDraft"),
      photoEvidenceDraft: providerNarrativeMarker(prefix, "photoEvidenceDraft"),
      foreignWorkerBriefing: providerNarrativeMarker(prefix, "foreignWorkerBriefing"),
      foreignWorkerTransmission: providerNarrativeMarker(prefix, "foreignWorkerTransmission"),
      foreignWorkerLanguages: [{
        code: "v4",
        label: providerNarrativeMarker(prefix, "foreignWorkerLanguages"),
        nativeLabel: providerNarrativeMarker(prefix, "foreignWorkerLanguages"),
        rationale: providerNarrativeMarker(prefix, "foreignWorkerLanguages"),
        lines: [providerNarrativeMarker(prefix, "foreignWorkerLanguages")]
      }],
      safetyEducationPoints: [providerNarrativeMarker(prefix, "safetyEducationPoints")],
      tbmQuestions: [providerNarrativeMarker(prefix, "tbmQuestions")],
      kakaoMessage: providerNarrativeMarker(prefix, "kakaoMessage")
    }
  };
}

function configureKoshaOnlySearch() {
  const control = "EXCLUDED_RUNASK_KOSHA_ONLY_CONTROL";
  const body = "EXCLUDED_RUNASK_KOSHA_ONLY_BODY";
  const action = "EXCLUDED_RUNASK_KOSHA_ACTION 감시인 지정";
  const evidenceRef = "EXCLUDED_RUNASK_KOSHA_EVIDENCE_REF";
  const hazard = "EXCLUDED_RUNASK_KOSHA_HAZARD";
  const reference = retrievalReference("verified-kosha-only", "local-ranked");
  reference.item_type = "technical-guideline";
  reference.title = "KOSHA 단독 지게차 기술지침";
  reference.summary = action;
  reference.body = body;
  reference.controls = [control];
  reference.primary_documents = ["위험성평가표", "TBM 브리핑", "TBM 기록"];
  reference.kosha_guide = {
    ...reference.kosha_guide!,
    evidenceRef
  };
  mocks.searchSafetyReferences.mockImplementation(async (options: { query: string; itemType?: string }) => {
    if (options.itemType === "technical-guideline") {
      return searchResult("local-ranked", [reference], options.query);
    }
    return searchResult("unconfigured", [], options.query);
  });
  return { action, body, control, evidenceRef, hazard, reference };
}

function configureV5BroadTokenFalseParentSearch(): KoshaOnlyFixture {
  const control = "V5_RUNASK_FALSE_PARENT_KOSHA_CONTROL";
  const body = "V5_RUNASK_FALSE_PARENT_KOSHA_BODY";
  const action = "V5_RUNASK_FALSE_PARENT_KOSHA_ACTION";
  const evidenceRef = "V5_RUNASK_FALSE_PARENT_KOSHA_EVIDENCE_REF";
  const hazard = "V5_RUNASK_FALSE_PARENT_KOSHA_HAZARD";
  const reference = retrievalReference("v5-broad-token-kosha-guide", "local-ranked");
  reference.item_type = "technical-guideline";
  reference.title = "KOSHA 지게차 보행자 충돌 예방 기술지침";
  reference.summary = `${action} 지게차와 보행자의 이동 동선을 분리한다.`;
  reference.body = body;
  reference.keywords = ["지게차", "보행자", "동선", "충돌"];
  reference.risk_tags = ["충돌"];
  reference.controls = [control, action];
  reference.primary_documents = ["위험성평가표", "TBM 브리핑", "TBM 기록"];
  reference.kosha_guide = {
    ...reference.kosha_guide!,
    stableDocumentKey: "V5-BROAD-TOKEN-KOSHA",
    version: "V5-BROAD-TOKEN-KOSHA-2026",
    evidenceRef
  };

  const falseParent = retrievalReference("v5-lpg-forklift-pedestrian-fire-parent", "ranked");
  falseParent.item_type = "machinery";
  falseParent.category = "운반하역";
  falseParent.subcategory = "지게차";
  falseParent.title = "LPG 지게차 보행자 통행구역 연료계통 화재 직접 근거";
  falseParent.summary = "보행자 통행구역의 LPG 지게차 연료 누출 가스가 점화되어 화재가 발생할 수 있다.";
  falseParent.body = undefined;
  falseParent.keywords = ["LPG", "지게차", "보행자", "통행구역", "연료누출", "화재"];
  falseParent.risk_tags = [];
  falseParent.controls = ["연료 밸브 차단과 점화원 통제"];
  falseParent.evidence_role = "direct";
  falseParent.kosha_guide = undefined;

  mocks.searchSafetyReferences.mockResolvedValue(searchResult(
    "hybrid-local-supabase",
    [reference, falseParent],
    "지게차 보행자 통행구역 충돌 위험"
  ));
  return { action, body, control, evidenceRef, hazard, reference };
}

function configureV5QueryUnrelatedDirectEvidenceSearch() {
  const directMarkers = {
    summary: "V5_RUNASK_UNRELATED_DIRECT_SUMMARY",
    control: "V5_RUNASK_UNRELATED_DIRECT_CONTROL",
    document: "V5_RUNASK_UNRELATED_DIRECT_DOCUMENT"
  } as const;
  const reference = retrievalReference("v5-direct-filter-kosha-guide", "local-ranked");
  reference.item_type = "technical-guideline";
  reference.title = "KOSHA 지게차 보행자 충돌 예방 기술지침";
  reference.summary = "지게차와 보행자의 이동 동선을 분리한다.";
  reference.body = "검증된 현행 KOSHA 지침 본문: 지게차 동선과 보행 동선을 분리한다.";
  reference.keywords = ["지게차", "보행자", "동선", "충돌"];
  reference.risk_tags = ["충돌"];
  reference.controls = ["후진 경보와 유도자 배치"];
  reference.primary_documents = ["위험성평가표", "TBM 브리핑", "TBM 기록"];
  reference.kosha_guide = {
    ...reference.kosha_guide!,
    stableDocumentKey: "V5-RUNASK-DIRECT-FILTER-KOSHA",
    version: "V5-RUNASK-DIRECT-FILTER-KOSHA-2026",
    evidenceRef: "KOSHA 근거 v5-direct-filter-kosha-guide p.1: 지게차 동선 분리"
  };

  const unrelatedDirect = retrievalReference("v5-query-unrelated-fire-direct", "ranked");
  unrelatedDirect.item_type = "machinery";
  unrelatedDirect.category = "운반하역";
  unrelatedDirect.subcategory = "지게차";
  unrelatedDirect.title = "LPG 지게차 보행자 통행구역 연료계통 화재 직접 근거";
  unrelatedDirect.summary = `${directMarkers.summary} 연료 누출 가스가 점화되어 화재가 발생할 수 있다.`;
  unrelatedDirect.body = undefined;
  unrelatedDirect.keywords = ["LPG", "지게차", "보행자", "통행구역", "연료누출", "화재"];
  unrelatedDirect.risk_tags = ["화재"];
  unrelatedDirect.primary_documents = ["위험성평가표", "TBM 브리핑", directMarkers.document];
  unrelatedDirect.controls = [directMarkers.control, "연료 밸브 차단과 점화원 통제"];
  unrelatedDirect.evidence_role = "direct";
  unrelatedDirect.kosha_guide = undefined;

  mocks.searchSafetyReferences.mockResolvedValue(searchResult(
    "hybrid-local-supabase",
    [reference, unrelatedDirect],
    "지게차 보행자 통행구역 충돌 위험"
  ));
  return { directMarkers, reference, unrelatedDirect };
}

describe("current-base runAsk retrieval provenance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.fetchKoshaReferences.mockResolvedValue({
      source: "kosha",
      mode: "fallback",
      detail: "테스트에서 공식 자료 URL 확인을 생략했습니다.",
      references: []
    });
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
    mocks.generateAllDeliverablesWithDiagnostics.mockResolvedValue(providerResult());
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

  it("keeps parentless KOSHA outside provider-required citations and generated document bodies", async () => {
    const fixture = configureKoshaOnlySearch();
    mocks.generateAllDeliverablesWithDiagnostics.mockImplementation(async (input: GenerateAllOptions) => {
      const requiredTitles = (input.koshaPrimaryRefs || []).map((reference) => reference.title);
      return providerResult({
        riskAssessmentDraft: `PROVIDER_REQUIRED_KOSHA_CITATIONS\n${requiredTitles.join("\n")}`
      });
    });

    const response = await runAsk("지게차 보행자 동선 충돌", { aiMode: "full" });
    const generationInputs = mocks.generateAllDeliverablesWithDiagnostics.mock.calls.map(([input]) => (
      input as GenerateAllOptions
    ));

    expect(mocks.generateAllDeliverablesWithDiagnostics).toHaveBeenCalledTimes(1);
    expect(generationInputs.every((input) => (input.koshaPrimaryRefs || []).length === 0)).toBe(true);
    expect(generationInputs.every((input) => (input.koshaLines || []).some((line) => (
      line.includes("검토필요") && line.includes("parent-evidence-missing")
    )))).toBe(true);
    expect(generationInputs.map((input) => input.dbHarnessContext || "").join("\n")).not.toContain(fixture.body);
    expect(generationInputs.flatMap((input) => input.koshaLines || []).join("\n")).not.toContain(fixture.control);
    expect(response.deliverables.riskAssessmentDraft).not.toContain(fixture.reference.title);
    expect(response.deliverables.riskAssessmentDraft).not.toContain(fixture.body);
    expect(response.deliverables.riskAssessmentDraft).not.toContain(fixture.control);
  }, 30_000);

  it.each(["enhanced", "full"] satisfies AiMode[])(
    "v4 discards every provider-authored narrative surface for parentless KOSHA in %s mode",
    async (aiMode) => {
      configureKoshaOnlySearch();
      const answerPrefix = `ANSWER_${aiMode.toUpperCase()}`;
      const deliverablesPrefix = `DELIVERABLES_${aiMode.toUpperCase()}`;
      mocks.generateAnswer.mockImplementation(async (question: string, citations: SearchResult[]) => ({
        response: withProviderNarrativeAttack(
          buildMockAskResponse(
            question,
            citations.length ? citations : mockSearchResults.slice(0, 2),
            "mock",
            "provider narrative attack"
          ),
          answerPrefix
        ),
        trace: { provider: "mock", model: null, fallbackUsed: false }
      }));
      mocks.generateAllDeliverablesWithDiagnostics.mockResolvedValue(providerResult(
        providerNarrativeDeliverables(deliverablesPrefix)
      ));

      const response = await runAsk("지게차 보행자 동선 충돌", { aiMode });
      const serializedResponse = JSON.stringify(response);
      const providerMarkers = [
        ...providerNarrativeMarkers(answerPrefix, RESPONSE_NARRATIVE_SURFACES),
        ...providerNarrativeMarkers(deliverablesPrefix, AI_NARRATIVE_SURFACES)
      ];

      expect(response.dbHarness?.summary.ontologyStatus).toBe("review_required");
      expect(response.deliverables.riskAssessmentDraft.length).toBeGreaterThan(0);
      expect(response.deliverables.workPlanDraft.length).toBeGreaterThan(0);
      expect(response.deliverables.tbmBriefing.length).toBeGreaterThan(0);
      for (const marker of providerMarkers) {
        expect(serializedResponse.includes(marker)).toBe(false);
      }
    },
    30_000
  );

  it("v4 preserves provider narratives when no parentless KOSHA review is required", async () => {
    const directReference = retrievalReference("non-kosha-direct-v4", "ranked");
    const answerPrefix = "SAFE_ANSWER";
    const deliverablesPrefix = "SAFE_DELIVERABLES";
    mocks.searchSafetyReferences.mockResolvedValue(searchResult("ranked-rpc", [directReference]));
    mocks.generateAnswer.mockImplementation(async (question: string, citations: SearchResult[]) => ({
      response: withProviderNarrativeAttack(
        buildMockAskResponse(
          question,
          citations.length ? citations : mockSearchResults.slice(0, 2),
          "mock",
          "safe provider narrative control"
        ),
        answerPrefix
      ),
      trace: { provider: "mock", model: null, fallbackUsed: false }
    }));
    mocks.generateAllDeliverablesWithDiagnostics.mockResolvedValue(providerResult(
      providerNarrativeDeliverables(deliverablesPrefix)
    ));

    const response = await runAsk("지게차 보행자 동선 충돌", { aiMode: "full" });

    expect(response.dbHarness?.summary.directEvidence).toBeGreaterThan(0);
    expect(response.deliverables.riskAssessmentDraft).toContain(
      providerNarrativeMarker(deliverablesPrefix, "riskAssessmentDraft")
    );
    expect(response.deliverables.workPlanDraft).toContain(
      providerNarrativeMarker(deliverablesPrefix, "workPlanDraft")
    );
    expect(response.deliverables.tbmBriefing).toContain(
      providerNarrativeMarker(deliverablesPrefix, "tbmBriefing")
    );
    expect(response.deliverables.workPermitDraft).toContain(
      providerNarrativeMarker(answerPrefix, "workPermitDraft")
    );
  }, 30_000);

  it.each(["enhanced", "full"] satisfies AiMode[])(
    "rejects parentless KOSHA provider action surfaces in %s mode",
    async (aiMode) => {
      const fixture = configureKoshaOnlySearch();
      const attack = providerActionSurface(fixture);
      mocks.generateAnswer.mockImplementation(async (question: string, citations: SearchResult[]) => {
        const response = buildMockAskResponse(
          question,
          citations.length ? citations : mockSearchResults.slice(0, 2),
          "mock",
          "provider action-surface attack"
        );
        const attackedDeliverables = { ...response.deliverables, ...attack };
        response.deliverables = attackedDeliverables;
        return {
          response,
          trace: { provider: "mock", model: null, fallbackUsed: false }
        };
      });
      mocks.generateAllDeliverablesWithDiagnostics.mockResolvedValue(providerResult(attack));

      const response = await runAsk("지게차 보행자 동선 충돌", { aiMode });
      const generationInputs = mocks.generateAllDeliverablesWithDiagnostics.mock.calls.map(([input]) => (
        input as GenerateAllOptions
      ));
      const serializedPrompt = JSON.stringify({
        dbHarness: response.dbHarness?.promptContext,
        generationInputs
      });
      const serializedCitations = JSON.stringify({
        citations: response.citations,
        safetyReferences: response.externalData.safetyReference?.items
      });
      const serializedResponse = JSON.stringify(response);

      for (const forbidden of [fixture.hazard]) {
        expect(serializedPrompt).not.toContain(forbidden);
        expect(serializedCitations).not.toContain(forbidden);
        expect(serializedResponse).not.toContain(forbidden);
      }
    },
    30_000
  );

  it.each(["enhanced", "full"] satisfies AiMode[])(
    "keeps unrelated direct evidence from unlocking KOSHA action surfaces in %s mode",
    async (aiMode) => {
      const fixture = configureKoshaOnlySearch();
      const unrelatedParent = retrievalReference("unrelated-electrical-parent", "ranked");
      unrelatedParent.category = "전기";
      unrelatedParent.subcategory = "배전반";
      unrelatedParent.title = "배전반 충전부 감전 직접 근거";
      unrelatedParent.summary = "배전반 충전부 접촉에 따른 감전 위험";
      unrelatedParent.keywords = ["배전반", "충전부", "감전"];
      unrelatedParent.risk_tags = ["감전"];
      unrelatedParent.controls = ["배전반 전원 차단과 잠금표지 확인"];
      const query = "지게차 충돌 및 배전반 감전";
      mocks.searchSafetyReferences.mockResolvedValue(searchResult(
        "hybrid-local-supabase",
        [fixture.reference, unrelatedParent],
        query
      ));
      const attack = providerActionSurface(fixture);
      mocks.generateAnswer.mockImplementation(async (question: string, citations: SearchResult[]) => {
        const response = buildMockAskResponse(
          question,
          citations.length ? citations : mockSearchResults.slice(0, 2),
          "mock",
          "unrelated parent action-surface attack"
        );
        const attackedDeliverables = { ...response.deliverables, ...attack };
        response.deliverables = attackedDeliverables;
        return {
          response,
          trace: { provider: "mock", model: null, fallbackUsed: false }
        };
      });
      mocks.generateAllDeliverablesWithDiagnostics.mockResolvedValue(providerResult(attack));

      const response = await runAsk(query, { aiMode });
      const generationInputs = mocks.generateAllDeliverablesWithDiagnostics.mock.calls.map(([input]) => (
        input as GenerateAllOptions
      ));
      const serializedPrompt = JSON.stringify({
        dbHarness: response.dbHarness?.promptContext,
        generationInputs
      });
      const serializedCitations = JSON.stringify({
        citations: response.citations,
        safetyReferences: response.externalData.safetyReference?.items
      });
      const surfacedKosha = response.externalData.safetyReference?.items.find((item) => (
        item.id === fixture.reference.id
      ));

      expect(response.dbHarness?.promptContext).toContain('"parentEvidenceReady":false');
      for (const forbidden of [fixture.action, fixture.body, fixture.control, fixture.evidenceRef]) {
        expect(serializedPrompt).not.toContain(forbidden);
        expect(serializedCitations).not.toContain(forbidden);
      }
      expect(JSON.stringify(response)).not.toContain(fixture.hazard);
      expect(surfacedKosha?.controls).toEqual([]);
      expect(
        surfacedKosha && "supportingCitationEligible" in surfacedKosha
          ? surfacedKosha.supportingCitationEligible
          : undefined
      ).toBe(false);
    },
    30_000
  );

  it.each(["enhanced", "full"] satisfies AiMode[])(
    "v5 keeps broad-token fire parents from unlocking KOSHA action surfaces in %s mode",
    async (aiMode) => {
      const fixture = configureV5BroadTokenFalseParentSearch();
      const attack = providerActionSurface(fixture);
      mocks.generateAnswer.mockImplementation(async (question: string, citations: SearchResult[]) => {
        const response = buildMockAskResponse(
          question,
          citations.length ? citations : mockSearchResults.slice(0, 2),
          "mock",
          "v5 broad-token false parent action-surface attack"
        );
        response.deliverables = { ...response.deliverables, ...attack };
        return {
          response,
          trace: { provider: "mock", model: null, fallbackUsed: false }
        };
      });
      mocks.generateAllDeliverablesWithDiagnostics.mockResolvedValue(providerResult(attack));

      const response = await runAsk("지게차 보행자 통행구역 충돌 위험", { aiMode });
      const generationInputs = mocks.generateAllDeliverablesWithDiagnostics.mock.calls.map(([input]) => (
        input as GenerateAllOptions
      ));
      const serializedPrompt = JSON.stringify({
        dbHarness: response.dbHarness?.promptContext,
        generationInputs
      });
      const serializedCitations = JSON.stringify({
        citations: response.citations,
        safetyReferences: response.externalData.safetyReference?.items
      });
      const serializedResponse = JSON.stringify(response);
      const surfacedKosha = response.externalData.safetyReference?.items.find((item) =>
        item.id === fixture.reference.id
      );

      expect(response.dbHarness?.promptContext).toContain('"parentEvidenceReady":false');
      expect(response.structured?.riskAssessmentRows).toEqual([]);
      expect(response.structured?.tbmRiskLinks).toEqual([]);
      expect(surfacedKosha?.controls).toEqual([]);
      expect(
        surfacedKosha && "supportingCitationEligible" in surfacedKosha
          ? surfacedKosha.supportingCitationEligible
          : undefined
      ).toBe(false);
      for (const forbidden of [
        fixture.hazard,
        fixture.action,
        fixture.body,
        fixture.control,
        fixture.evidenceRef
      ]) {
        expect(serializedPrompt).not.toContain(forbidden);
        expect(serializedCitations).not.toContain(forbidden);
        expect(serializedResponse).not.toContain(forbidden);
      }
    },
    30_000
  );

  it.each(["enhanced", "full"] satisfies AiMode[])(
    "v5 removes query-hazard-unrelated direct evidence before model prompt and response surfaces in %s mode",
    async (aiMode) => {
      const fixture = configureV5QueryUnrelatedDirectEvidenceSearch();

      const response = await runAsk("지게차 보행자 통행구역 충돌 위험", { aiMode });
      const generationInputs = mocks.generateAllDeliverablesWithDiagnostics.mock.calls.map(([input]) => (
        input as GenerateAllOptions
      ));
      const serializedPrompt = JSON.stringify({
        dbHarness: response.dbHarness?.promptContext,
        generationInputs
      });
      const serializedCitations = JSON.stringify({
        citations: response.citations,
        safetyReferences: response.externalData.safetyReference?.items
      });
      const serializedResponse = JSON.stringify(response);

      expect(response.dbHarness?.summary.directEvidence).toBe(0);
      expect(response.dbHarness?.packet.directEvidence).toEqual([]);
      expect(response.dbHarness?.promptContext).toContain('"parentEvidenceReady":false');
      expect(response.externalData.safetyReference?.items.some((item) => (
        item.id === fixture.unrelatedDirect.id
      ))).toBe(false);
      for (const marker of Object.values(fixture.directMarkers)) {
        expect(serializedPrompt).not.toContain(marker);
        expect(serializedCitations).not.toContain(marker);
        expect(serializedResponse).not.toContain(marker);
      }
    },
    30_000
  );

  it.each([
    ["enhanced", "kosha-only"],
    ["full", "kosha-only"],
    ["enhanced", "unrelated-parent"],
    ["full", "unrelated-parent"]
  ] satisfies Array<[AiMode, "kosha-only" | "unrelated-parent"]>)(
    "keeps the serialized %s response identity-only for a %s attack",
    async (aiMode, parentScenario) => {
      const fixture = configureKoshaOnlySearch();
      const query = parentScenario === "kosha-only"
        ? "지게차 보행자 동선 충돌"
        : "지게차 충돌 및 배전반 감전";
      if (parentScenario === "unrelated-parent") {
        const unrelatedParent = retrievalReference("serialized-unrelated-electrical-parent", "ranked");
        unrelatedParent.category = "전기";
        unrelatedParent.subcategory = "배전반";
        unrelatedParent.title = "배전반 충전부 감전 직접 근거";
        unrelatedParent.summary = "배전반 충전부 접촉에 따른 감전 위험";
        unrelatedParent.keywords = ["배전반", "충전부", "감전"];
        unrelatedParent.risk_tags = ["감전"];
        unrelatedParent.controls = ["배전반 전원 차단과 잠금표지 확인"];
        mocks.searchSafetyReferences.mockResolvedValue(searchResult(
          "hybrid-local-supabase",
          [fixture.reference, unrelatedParent],
          query
        ));
      }
      const attack = providerActionSurface(fixture);
      mocks.generateAnswer.mockImplementation(async (question: string, citations: SearchResult[]) => {
        const response = buildMockAskResponse(
          question,
          citations.length ? citations : mockSearchResults.slice(0, 2),
          "mock",
          "serialized action-surface attack"
        );
        const attackedDeliverables = { ...response.deliverables, ...attack };
        response.deliverables = attackedDeliverables;
        return {
          response,
          trace: { provider: "mock", model: null, fallbackUsed: false }
        };
      });
      mocks.generateAllDeliverablesWithDiagnostics.mockResolvedValue(providerResult(attack));

      const response = await runAsk(query, { aiMode });
      const generationInputs = mocks.generateAllDeliverablesWithDiagnostics.mock.calls.map(([input]) => (
        input as GenerateAllOptions
      ));
      const serializedPrompt = JSON.stringify({
        dbHarness: response.dbHarness?.promptContext,
        generationInputs
      });
      const serializedCitations = JSON.stringify({
        citations: response.citations,
        safetyReferences: response.externalData.safetyReference?.items
      });
      const serializedResponse = JSON.stringify(response);

      expect(Object.prototype.hasOwnProperty.call(response.deliverables, "structuredRiskRows")).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(response.deliverables, "tbmRiskLinks")).toBe(false);
      for (const forbidden of [
        fixture.hazard,
        fixture.action,
        fixture.body,
        fixture.control,
        fixture.evidenceRef
      ]) {
        expect(serializedPrompt).not.toContain(forbidden);
        expect(serializedCitations).not.toContain(forbidden);
        expect(serializedResponse).not.toContain(forbidden);
      }
    },
    30_000
  );

  it.each(["enhanced", "full"] satisfies AiMode[])(
    "keeps a relevant direct parent eligible for KOSHA guidance in %s mode",
    async (aiMode) => {
      const fixture = configureKoshaOnlySearch();
      const relevantParent = retrievalReference("relevant-forklift-direct-parent", "ranked");
      mocks.searchSafetyReferences.mockResolvedValue(searchResult(
        "hybrid-local-supabase",
        [fixture.reference, relevantParent]
      ));

      const response = await runAsk("지게차 보행자 동선 충돌", { aiMode });
      const surfacedKosha = response.externalData.safetyReference?.items.find((item) => (
        item.id === fixture.reference.id
      ));

      expect(response.dbHarness?.promptContext).toContain('"parentEvidenceReady":true');
      expect(response.dbHarness?.promptContext).toContain(fixture.body);
      expect(response.dbHarness?.promptContext).toContain(fixture.evidenceRef);
      expect(surfacedKosha?.controls.length).toBeGreaterThan(0);
      expect(
        surfacedKosha && "supportingCitationEligible" in surfacedKosha
          ? surfacedKosha.supportingCitationEligible
          : undefined
      ).toBe(true);
      if (aiMode === "full") {
        const requiredTitles = mocks.generateAllDeliverablesWithDiagnostics.mock.calls.flatMap(([input]) => (
          (input as GenerateAllOptions).koshaPrimaryRefs || []
        )).map((reference) => reference.title);
        expect(requiredTitles).toContain(fixture.reference.title);
      }
    },
    30_000
  );

  it("omits structured risk rows and TBM links for a KOSHA-only full-mode packet", async () => {
    configureKoshaOnlySearch();

    const response = await runAsk("지게차 보행자 동선 충돌", { aiMode: "full" });

    expect(response.structured?.riskAssessmentRows).toEqual([]);
    expect(response.structured?.tbmRiskLinks).toEqual([]);
    expect(response.structured?.riskAssessmentValidation.ok).toBe(false);
  }, 30_000);

  it("omits immediate actions and control surfaces for a KOSHA-only full-mode packet", async () => {
    const fixture = configureKoshaOnlySearch();

    const response = await runAsk("지게차 보행자 동선 충돌", { aiMode: "full" });
    const actionSection = response.answer.split("2) 오늘 문서에 먼저 반영할 조치")[1]?.split("3) 보강 필요")[0] ?? "";
    const surfacedKosha = response.externalData.safetyReference?.items.find((item) => item.id === fixture.reference.id);

    expect(response.dbHarness?.summary.ontologyStatus).toBe("review_required");
    expect(response.dbHarness?.summary.directEvidence).toBe(0);
    expect(response.dbHarness?.summary.sifCases).toBe(0);
    expect(response.answer).toContain("보강 필요");
    expect(response.answer).toContain("기술 보조지침 후보");
    expect(actionSection.trim()).toBe("- 확정된 오늘 조치 없음: SIF 사례 또는 직접 근거를 먼저 확인하세요.");
    expect(response.riskSummary.immediateActions).toEqual([]);
    expect(response.practicalPoints.some((point) => point.startsWith("문서 반영 전 확인:"))).toBe(false);
    expect(surfacedKosha?.controls).toEqual([]);
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
    const directParent = retrievalReference("verified-current-direct-parent", "ranked");
    mocks.searchSafetyReferences.mockResolvedValue(searchResult(
      "hybrid-local-supabase",
      [...unverified, verified, directParent]
    ));

    await runAsk("D-C-13 지게차 보행자 동선 충돌", { aiMode: "full" });

    const generationInputs = mocks.generateAllDeliverablesWithDiagnostics.mock.calls.map(([input]) => input as {
      koshaPrimaryRefs?: Array<{ title: string }>;
    });
    expect(generationInputs.some((input) => (
      input.koshaPrimaryRefs || []
    ).some((reference) => reference.title === verifiedTitle))).toBe(true);
  }, 30_000);

  it("keeps distinct verified KOSHA documents with identical operational controls", async () => {
    const first = retrievalReference("verified-same-controls-a", "local-ranked");
    const second = retrievalReference("verified-same-controls-b", "local-ranked");
    first.title = "VERIFIED_KOSHA_DOCUMENT_A";
    second.title = "VERIFIED_KOSHA_DOCUMENT_B";
    const directParent = retrievalReference("verified-documents-direct-parent", "ranked");
    mocks.searchSafetyReferences.mockResolvedValue(searchResult(
      "hybrid-local-supabase",
      [first, second, directParent]
    ));

    await runAsk("지게차 보행자 동선 충돌", { aiMode: "full" });

    const requiredTitles = mocks.generateAllDeliverablesWithDiagnostics.mock.calls.flatMap(([input]) => (
      (input as { koshaPrimaryRefs?: Array<{ title: string }> }).koshaPrimaryRefs || []
    ).map((reference) => reference.title));
    expect(requiredTitles).toEqual(expect.arrayContaining([first.title, second.title]));
  }, 30_000);
});
