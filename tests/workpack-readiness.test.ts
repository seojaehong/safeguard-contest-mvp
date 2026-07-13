import { describe, expect, it } from "vitest";

import { buildMockAskResponse, mockSearchResults } from "@/lib/mock-data";
import { buildCanonicalPhaseAPlanBinding } from "@/lib/ontology/evidence-chain";
import type { QaReviewFound } from "@/lib/ontology/qa-review";
import { applyWorkpackDeliverablesChange, assessWorkpackReadiness } from "@/lib/workpack-readiness";
import type { AskResponse, QualityContract } from "@/lib/types";

const phaseAPlanBinding = structuredClone(
  buildCanonicalPhaseAPlanBinding("vehicle-machinery-entrapment"),
);
const phaseAPlanDigest = phaseAPlanBinding.planDigest;

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
    phaseAReview: {
      verdict: "통과",
      verified: true,
      evidenceChainState: "resolved",
      groundingStatus: "resolved",
      outputStatus: "grounded_draft",
      verifiedRecords: 2,
      planBinding: phaseAPlanBinding,
      materializationCoverage: {
        status: "complete",
        chainId: phaseAPlanBinding.chainId,
        planDigest: phaseAPlanDigest,
        expectedRecordCount: 2,
        materializedRecordCount: 2,
        expectedStableKeys: [...phaseAPlanBinding.expectedStableKeys],
        materializedStableKeys: [...phaseAPlanBinding.expectedStableKeys],
        unresolvedStableKeys: []
      },
      humanConfirmation: {
        required: true,
        status: "confirmed",
        reviewerId: "reviewer-001",
        confirmedAt: "2026-07-14T03:00:00.000Z",
        chainId: phaseAPlanBinding.chainId,
        planDigest: phaseAPlanDigest,
      },
      actionableReason: "확인 완료"
    },
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
    expect(readiness.reasons.join(" / ")).toContain("품질 계약 보완 필요");
    expect(readiness.reasons.join(" / ")).toContain("DB 하네스 근거 보강 필요");
    expect(readiness.reasons.join(" / ")).toContain("결재·서명 placeholder 확인 필요");
  });

  it("does not let a legacy ontology QA pass become share authority", () => {
    const response = makeResponse();
    response.phaseAReview = undefined;
    const readiness = assessWorkpackReadiness(response);

    expect(readiness.canShare).toBe(false);
    expect(readiness.status).toBe("blocked");
    expect(readiness.reasons).toContain("Phase A 근거 검토 정보 확인 필요");
  });

  it("blocks sharing while Phase A has zero verified records and human confirmation is pending", () => {
    const response = makeResponse();
    response.phaseAReview = {
      verdict: "검토 필요",
      verified: false,
      evidenceChainState: "review_required",
      groundingStatus: "review_required",
      outputStatus: "review_required_draft",
      verifiedRecords: 0,
      planBinding: phaseAPlanBinding,
      materializationCoverage: {
        status: "missing",
        chainId: phaseAPlanBinding.chainId,
        planDigest: phaseAPlanDigest,
        expectedRecordCount: 2,
        materializedRecordCount: 0,
        expectedStableKeys: [...phaseAPlanBinding.expectedStableKeys],
        materializedStableKeys: [],
        unresolvedStableKeys: [...phaseAPlanBinding.expectedStableKeys]
      },
      humanConfirmation: { required: true, status: "pending" },
      actionableReason: "Phase A 근거와 문서 반영 위치를 확인하세요."
    };

    const readiness = assessWorkpackReadiness(response);

    expect(readiness.canShare).toBe(false);
    expect(readiness.status).toBe("blocked");
    expect(readiness.reasons).toContain("Phase A 근거 및 사람 확인 미완료");
  });

  it("blocks sharing when only 1/N required stableKeys are materialized", () => {
    const response = makeResponse();
    response.phaseAReview = {
      ...response.phaseAReview!,
      verifiedRecords: 1,
      materializationCoverage: {
        status: "partial",
        chainId: phaseAPlanBinding.chainId,
        planDigest: phaseAPlanDigest,
        expectedRecordCount: 2,
        materializedRecordCount: 1,
        expectedStableKeys: [...phaseAPlanBinding.expectedStableKeys],
        materializedStableKeys: [phaseAPlanBinding.expectedStableKeys[0]],
        unresolvedStableKeys: [phaseAPlanBinding.expectedStableKeys[1]],
      },
    } satisfies NonNullable<AskResponse["phaseAReview"]>;

    const readiness = assessWorkpackReadiness(response);

    expect(readiness.canShare).toBe(false);
    expect(readiness.status).toBe("blocked");
    expect(readiness.reasons.join(" / ")).toContain("1/2");
  });

  it("allows sharing after Phase A materialization and human confirmation are complete", () => {
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
    expect(readiness.reasons).toContain("품질 계약 확인 필요");
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
    expect(edited.phaseAReview).toBeUndefined();
    expect(edited.qualityContract).toBeUndefined();
    expect(edited.dbHarness).toBeUndefined();
    expect(readiness.canShare).toBe(false);
    expect(readiness.status).toBe("blocked");
    expect(readiness.summary).toBe("편집 후 재검수 필요");
    expect(readiness.reasons).toContain("편집된 문서 재검수 필요");
  });
});
