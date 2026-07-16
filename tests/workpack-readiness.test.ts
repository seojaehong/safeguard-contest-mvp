import { describe, expect, it } from "vitest";

import { buildMockAskResponse, mockSearchResults } from "@/lib/mock-data";
import { assembleGraph } from "@/lib/ontology/graph-store";
import type { QaReviewFound } from "@/lib/ontology/qa-review";
import {
  applyWorkpackDeliverablesChange,
  assessWorkpackReadiness,
  revalidateEditedWorkpack
} from "@/lib/workpack-readiness";
import type { AskResponse, QualityContract } from "@/lib/types";

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
    expect(edited.qualityContract?.overall).toBe("blocked");
    expect(edited.qualityContract?.ontology.status).toBe("pending");
    expect(edited.dbHarness).toBe(response.dbHarness);
    expect(edited.deliverables.tbmBriefing).toContain("편집된 안전대책");
    expect(readiness.canShare).toBe(false);
    expect(readiness.status).toBe("blocked");
    expect(readiness.summary).toBe("편집 후 재검수 필요");
    expect(readiness.reasons).toContain("편집된 문서 재검수 필요");
  });

  it("revalidates the edited canonical text and only unlocks a newly passing review", () => {
    const graph = assembleGraph(
      [
        {
          node_id: "Task_high_work",
          kind: "Task",
          label: "고소작업",
          text_excerpt: null,
          cited_uids: ["manual:launch-p0-test"],
          meta: {},
          review_state: "published"
        },
        {
          node_id: "Hazard_fall",
          kind: "Hazard",
          label: "추락",
          text_excerpt: null,
          cited_uids: ["manual:launch-p0-test"],
          meta: {},
          review_state: "published"
        },
        {
          node_id: "Control_platform",
          kind: "Control",
          label: "작업발판 점검",
          text_excerpt: null,
          cited_uids: ["manual:launch-p0-test"],
          meta: {},
          review_state: "published"
        }
      ],
      [
        {
          src: "Task_high_work",
          rel: "entailsHazard",
          dst: "Hazard_fall",
          cited_uids: ["manual:launch-p0-test"],
          meta: {},
          review_state: "published"
        },
        {
          src: "Hazard_fall",
          rel: "mitigatedBy",
          dst: "Control_platform",
          cited_uids: ["manual:launch-p0-test"],
          meta: {},
          review_state: "published"
        }
      ]
    );
    const response = makeResponse();
    response.ontologyQa = {
      ...response.ontologyQa!,
      detail: "STALE_QA_MUST_NOT_RETURN"
    };
    const edited = applyWorkpackDeliverablesChange(
      response,
      {
        tbmBriefing: [
          "사용자 편집 본문",
          "추락 위험을 확인하고 작업발판 점검을 완료한다."
        ].join("\n")
      },
      { requiresRevalidation: true }
    );

    const revalidated = revalidateEditedWorkpack(edited, graph, "2026-07-17T00:00:00.000Z");
    const readiness = assessWorkpackReadiness(revalidated);

    expect(revalidated.deliverables.tbmBriefing).toContain("사용자 편집 본문");
    expect(revalidated.ontologyQa?.result.reviewable).toBe(true);
    expect(revalidated.ontologyQa?.result.reviewable && revalidated.ontologyQa.result.verdict).toBe("통과");
    expect(revalidated.ontologyQa?.detail).not.toContain("STALE_QA_MUST_NOT_RETURN");
    expect(revalidated.qualityContract?.generatedAt).toBe("2026-07-17T00:00:00.000Z");
    expect(readiness.canShare).toBe(true);
  });

  it("fails closed when deterministic revalidation cannot review the edited task", () => {
    const edited = applyWorkpackDeliverablesChange(
      makeResponse(),
      { tbmBriefing: "사용자 편집 본문" },
      { requiresRevalidation: true }
    );
    const emptyGraph = assembleGraph([], []);

    const revalidated = revalidateEditedWorkpack(edited, emptyGraph, "2026-07-17T00:00:00.000Z");
    const readiness = assessWorkpackReadiness(revalidated);

    expect(revalidated.ontologyQa?.result.reviewable).toBe(false);
    expect(readiness.canShare).toBe(false);
    expect(readiness.reasons).toContain("안전조치 검수 미통과");
  });
});
