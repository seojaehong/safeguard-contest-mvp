import { describe, expect, it } from "vitest";

import { buildMockAskResponse, mockSearchResults } from "@/lib/mock-data";
import { assembleGraph } from "@/lib/ontology/graph-store";
import type { QaReviewFound } from "@/lib/ontology/qa-review";
import { SEED_EDGES, SEED_NODES } from "@/lib/ontology/seed/core-triples";
import {
  applyWorkpackDeliverablesChange,
  assessWorkpackReadiness,
  buildWorkpackRevalidationBasis,
  parseWorkpackRevalidationGraph,
  revalidateEditedWorkpack
} from "@/lib/workpack-readiness";
import type { AskResponse, QualityContract } from "@/lib/types";

const publishedGraph = assembleGraph(
  SEED_NODES.filter((node) => node.review_state === "published"),
  SEED_EDGES.filter((edge) => edge.review_state === "published")
);

const weldingControls = [
  "가연성물질 별도 보관·격리",
  "용접방화포·불티비산방지덮개 설치",
  "화재감시자 배치",
  "차광보안면·방열복 착용"
].join("\n");

const readyQuality: QualityContract = {
  overall: "ready",
  summary: "공유 전 핵심 항목이 준비됐습니다.",
  generatedAt: "2026-07-09T00:00:00.000Z",
  items: [],
  fallback: { hasFallback: false, modes: {} },
  ontology: {
    status: "ready",
    matchCount: 1,
    verdict: "통과",
    detail: "안전조치 검수 통과"
  },
  evidence: {
    status: "ready",
    mappedCount: 3,
    requiredCount: 3,
    detail: "증빙 매핑 완료"
  },
  structured: {
    status: "ready",
    readyCount: 4,
    requiredCount: 4,
    detail: "구조화 완료"
  },
  persistence: {
    status: "ready",
    requiresLogin: true,
    detail: "저장 준비"
  },
  dbHarness: {
    status: "ready",
    directEvidenceCount: 1,
    sifCaseCount: 1,
    supportingEvidenceCount: 1,
    missingEvidence: [],
    documentCoverage: [
      { document: "위험성평가표", covered: true, evidenceTypes: ["directEvidence"] },
      { document: "TBM 브리핑", covered: true, evidenceTypes: ["sifCase"] },
      { document: "TBM 기록", covered: true, evidenceTypes: ["supportingEvidence"] }
    ],
    detail: "DB 하네스 준비"
  }
};

function makeResponse(): AskResponse {
  return {
    ...buildMockAskResponse("성수동 외벽 도장 작업", mockSearchResults.slice(0, 3), "live", "test"),
    qualityContract: readyQuality,
    ontologyQa: {
      reviewTask: "외벽 도장",
      result: {
        reviewable: true,
        task: "외벽 도장",
        covered: { hazards: ["추락"], controls: ["작업발판 점검"], articles: [] },
        missing: { hazards: [], controls: [], articles: [] },
        coverageRate: 1,
        verdict: "통과",
        advisory: "검수 통과"
      },
      sourceDocumentKeys: ["riskAssessmentDraft", "tbmBriefing"],
      detail: "안전조치 검수 통과"
    },
    dbHarness: {
      packet: {} as NonNullable<AskResponse["dbHarness"]>["packet"],
      promptContext: "DB harness context",
      summary: {
        mode: "db_harness_first",
        llmRole: "naturalize_only",
        llmOutputScope: "rewrite_fixed_evidence_only",
        evidenceAuthority: "db_harness",
        providerRetryScope: "naturalization_retry_only",
        fallbackChainAllowed: false,
        genericProseSubstitutionAllowed: false,
        missingEvidencePolicy: "surface_review_required",
        directEvidence: 1,
        sifCases: 1,
        supportingEvidence: 1,
        improvementMemory: 0,
        workpackMemory: 0,
        missingEvidence: [],
        documentCoverage: readyQuality.dbHarness.documentCoverage,
        retrievalContract: {} as NonNullable<AskResponse["dbHarness"]>["summary"]["retrievalContract"],
        ontologyStatus: "ready"
      }
    }
  };
}

function makeRevalidatableResponse(): AskResponse {
  const response = makeResponse();
  response.question = "용접 작업 전 안전조치 확인";
  response.ontologyQa = {
    ...response.ontologyQa!,
    reviewTask: "용접"
  };
  response.deliverables.tbmBriefing = weldingControls;
  response.status = {
    ...response.status,
    lawgo: "live",
    ai: "live",
    weather: "live",
    work24: "live",
    kosha: "live"
  };
  response.externalData.weather.mode = "live";
  response.externalData.training.mode = "live";
  response.externalData.koshaEducation.mode = "live";
  response.externalData.accidentCases.mode = "live";
  response.externalData.kosha.mode = "live";
  response.externalData.safetyKnowledge = {
    source: "safety-knowledge",
    mode: "live",
    detail: "검수 기준 연결",
    matches: [{
      id: "welding-ready",
      title: "용접 안전조치",
      primaryDocuments: ["TBM 브리핑"],
      controls: weldingControls.split("\n"),
      sourceTitles: ["published ontology"],
      legalMappingTitles: []
    }]
  };
  response.externalData.safetyReference = {
    source: "safety-reference-catalog",
    mode: "live",
    query: response.question,
    count: 1,
    totalItems: 1,
    message: "published reference ready",
    items: []
  };
  response.structured = {
    riskAssessmentRows: [{} as NonNullable<AskResponse["structured"]>["riskAssessmentRows"][number]],
    riskAssessmentValidation: { ok: true, issueCount: 0, issues: [] }
  };
  response.deliverables.workPlanStructured = {} as NonNullable<AskResponse["deliverables"]["workPlanStructured"]>;
  response.deliverables.tbmBriefingStructured = {} as NonNullable<AskResponse["deliverables"]["tbmBriefingStructured"]>;
  response.deliverables.tbmLogStructured = {} as NonNullable<AskResponse["deliverables"]["tbmLogStructured"]>;
  response.dbHarness!.packet = {
    mode: "db_harness_first",
    question: response.question,
    directEvidence: [{} as NonNullable<AskResponse["dbHarness"]>["packet"]["directEvidence"][number]],
    sifCases: [],
    supportingEvidence: [],
    improvementMemory: [],
    workpackMemory: [],
    retrievalContract: response.dbHarness!.summary.retrievalContract,
    ontologyChecklist: { status: "ready", missing: [] },
    generationContract: {
      llmRole: "naturalize_only",
      llmOutputScope: "rewrite_fixed_evidence_only",
      evidenceAuthority: "db_harness",
      providerRetryScope: "naturalization_retry_only",
      fallbackChainAllowed: false,
      genericProseSubstitutionAllowed: false,
      missingEvidencePolicy: "surface_review_required",
      requiredDocuments: ["위험성평가표", "TBM 브리핑", "TBM 기록"],
      missingEvidence: [],
      documentCoverage: readyQuality.dbHarness.documentCoverage
    }
  };
  return response;
}

describe("workpack readiness", () => {
  it("blocks normal sharing when generated output still has review blockers", () => {
    const response = makeResponse();
    const incompleteQa: QaReviewFound = {
      reviewable: true,
      task: "외벽 도장",
      covered: { hazards: ["추락"], controls: ["작업발판 점검"], articles: [] },
      missing: {
        hazards: [],
        controls: [{ control: "하부 출입통제", articles: ["산업안전보건기준"] }],
        articles: []
      },
      coverageRate: 0.5,
      verdict: "미흡",
      advisory: "검수 미흡"
    };
    response.ontologyQa = {
      ...response.ontologyQa!,
      result: incompleteQa
    };
    response.qualityContract = {
      ...readyQuality,
      overall: "degraded",
      summary: "보완 항목이 남았습니다.",
      dbHarness: {
        ...readyQuality.dbHarness,
        missingEvidence: ["TBM 기록 근거"],
        status: "degraded"
      }
    };
    response.dbHarness = {
      ...response.dbHarness!,
      summary: {
        ...response.dbHarness!.summary,
        missingEvidence: ["TBM 기록 근거"],
        ontologyStatus: "review_required"
      }
    };
    response.deliverables.tbmBriefing += "\n[결재] 작성 ___ / 검토 ___ / 승인 ___";

    const readiness = assessWorkpackReadiness(response);

    expect(readiness.canShare).toBe(false);
    expect(readiness.status).toBe("blocked");
    expect(readiness.summary).toBe("공유 전 보완 필요");
    expect(readiness.reasons.join(" / ")).toContain("안전조치 검수 미통과");
    expect(readiness.reasons.join(" / ")).toContain("품질 검수 보완 필요");
    expect(readiness.reasons.join(" / ")).toContain("검증 근거 보강 필요");
    expect(readiness.reasons.join(" / ")).toContain("결재·서명 placeholder 확인 필요");
  });

  it("allows sharing only when quality, ontology, DB harness, and placeholders are clean", () => {
    const readiness = assessWorkpackReadiness(makeResponse());

    expect(readiness.canShare).toBe(true);
    expect(readiness.status).toBe("ready");
    expect(readiness.summary).toBe("공유 준비됨");
    expect(readiness.reasons).toEqual([]);
  });

  it("fails closed when required quality or ontology review data is missing", () => {
    const response = makeResponse();
    response.qualityContract = undefined;
    response.ontologyQa = undefined;

    const readiness = assessWorkpackReadiness(response);

    expect(readiness.canShare).toBe(false);
    expect(readiness.reasons).toContain("품질 검수 확인 필요");
    expect(readiness.reasons).toContain("안전조치 검수 정보 확인 필요");
  });

  it("requires explicit revalidation after a reviewed workpack is edited", () => {
    const response = makeResponse();
    const edited = applyWorkpackDeliverablesChange(
      response,
      { tbmBriefing: `${response.deliverables.tbmBriefing}\n편집된 안전대책` },
      { requiresRevalidation: true }
    );
    const readiness = assessWorkpackReadiness(edited, { requiresRevalidation: true });

    expect(edited.ontologyQa).toBeUndefined();
    expect(edited.qualityContract).toBeUndefined();
    expect(edited.dbHarness?.summary.ontologyStatus).toBe("review_required");
    expect(edited.dbHarness?.packet.ontologyChecklist).toEqual({
      status: "review_required",
      missing: ["편집된 문서 재검수 필요"]
    });
    expect(buildWorkpackRevalidationBasis(edited)?.reviewTask).toBe("고소작업");
    expect(readiness.canShare).toBe(false);
    expect(readiness.status).toBe("blocked");
    expect(readiness.summary).toBe("편집 후 재검수 필요");
    expect(readiness.reasons).toContain("편집된 문서 재검수 필요");
  });

  it("revalidates edited canonical content without restoring the old QA result", () => {
    const response = makeRevalidatableResponse();
    const previousQa = response.ontologyQa;
    const basis = buildWorkpackRevalidationBasis(response);
    const editedValue = `${weldingControls}\n편집된 작업순서 유지`;
    const edited = applyWorkpackDeliverablesChange(
      response,
      { tbmBriefing: editedValue },
      { requiresRevalidation: true }
    );

    const revalidated = revalidateEditedWorkpack(
      edited,
      basis,
      publishedGraph,
      "2026-07-17T00:00:00.000Z"
    );

    expect(revalidated.deliverables.tbmBriefing).toBe(editedValue);
    expect(revalidated.ontologyQa).toBeDefined();
    expect(revalidated.ontologyQa).not.toBe(previousQa);
    expect(revalidated.ontologyQa?.result.reviewable && revalidated.ontologyQa.result.verdict).toBe("통과");
    expect(revalidated.qualityContract?.generatedAt).toBe("2026-07-17T00:00:00.000Z");
    expect(assessWorkpackReadiness(revalidated).canShare).toBe(true);
  });

  it("keeps sharing blocked when edited canonical content fails revalidation", () => {
    const response = makeRevalidatableResponse();
    const basis = buildWorkpackRevalidationBasis(response);
    const editedValue = weldingControls
      .split("\n")
      .filter((control) => control !== "화재감시자 배치")
      .join("\n");
    const edited = applyWorkpackDeliverablesChange(
      response,
      { tbmBriefing: editedValue },
      { requiresRevalidation: true }
    );

    const revalidated = revalidateEditedWorkpack(edited, basis, publishedGraph);
    const readiness = assessWorkpackReadiness(revalidated);

    expect(revalidated.deliverables.tbmBriefing).toBe(editedValue);
    expect(revalidated.ontologyQa?.result.reviewable && revalidated.ontologyQa.result.verdict).not.toBe("통과");
    expect(readiness.canShare).toBe(false);
    expect(readiness.reasons).toContain("안전조치 검수 미통과");
  });

  it("rejects malformed ontology graph responses before revalidation", () => {
    expect(parseWorkpackRevalidationGraph({ graph: { nodes: [{}], edges: [] } })).toBeNull();
    expect(parseWorkpackRevalidationGraph({ graph: { nodes: publishedGraph.nodes, edges: publishedGraph.edges } }))
      .toEqual({ nodes: publishedGraph.nodes, edges: publishedGraph.edges });
  });
});
