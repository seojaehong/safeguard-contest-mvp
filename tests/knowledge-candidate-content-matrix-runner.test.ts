import { describe, expect, it } from "vitest";
// @ts-expect-error -- the executable MJS module exposes a runtime evaluator tested here.
import { evaluateCandidateMatrixPayload } from "../scripts/knowledge_candidate_content_matrix_runner.mjs";

const testCase = {
  id: "chemical-cleaning",
  expectedHazardIds: ["chemical-msds"],
  requiredAnyGroups: [["화학물질", "MSDS"], ["누출", "보호구"]],
  requiredEvidenceAnyGroups: [
    ["물질안전보건자료 조회 서비스"],
    ["산업안전보건법"]
  ],
  requiredSifEvidenceAnyGroups: [["SIF 화학물질 누출·접촉 사고 통제 사례"]],
  requiredEventFactGroups: [["야간 교대 작업"], ["청각 경보 보조수단 필요"]],
  forbiddenGeneratedTerms: ["resident-id: 900101-1234567"]
};

function payload() {
  return {
    ok: true,
    configured: true,
    storageMode: "stateless_candidate",
    savedRunId: null,
    candidate: {
      contractVersion: "knowledge-candidate.v2",
      generatedBy: "hermes_or_llm",
      reviewStatus: "pending_review",
      publicationState: "unpublished",
      generatedText: "1) 위험요인 요약: 화학물질 누출 위험 / 원본 이벤트 검토 사실: 야간 교대 작업 · 청각 경보 보조수단 필요\n2) 문서 반영 위치: 위험성평가표\n3) 통제대책: MSDS와 보호구 확인\n4) 검수 필요 항목: 근거 구분: SIF 재해·통제 근거 - SIF 화학물질 누출·접촉 사고 통제 사례 (사고 통제 참고 후보) / KOSHA 기술·공식자료 후보 - 물질안전보건자료 조회 서비스 / 현행 법령 후보 - 산업안전보건법. 현장 책임자 확인",
      matchedHazardIds: ["chemical-msds"],
      dbMutationAllowed: false,
      dbMutationPerformed: false,
      publishAllowed: false
    },
    reviewContract: {
      status: "human_review_required",
      humanReviewRequired: true,
      presentAuthorityIds: ["sif", "law"],
      sourceRoleCounts: { sifIncidentControlEvidence: 1, lawStatutorySource: 1 },
      machineEvidenceReplacesHumanReview: false,
      dbMutationAllowed: false,
      publishAllowed: false
    },
    contentReadiness: {
      contractVersion: "knowledge-candidate-content-readiness.v1",
      status: "ready_for_human_review",
      requiredSectionCount: 4,
      presentSectionCount: 4,
      nonEmptySectionCount: 4,
      placeholderFindingCount: 0,
      legalOverclaimFindingCount: 0,
      statutoryClaimDetected: false,
      lawProvenancePresent: true,
      sifProvenancePresent: true,
      sifEvidenceVisible: true,
      hazardGroundingPresent: true,
      unresolvedReviewItems: [] as string[],
      humanReviewCompleted: false,
      publicationState: "unpublished",
      publishAllowed: false
    },
    generated: {
      fallbackUsed: false,
      providerLabel: "Hermes"
    }
  };
}

describe("knowledge candidate content matrix runner", () => {
  it("accepts a grounded stateless candidate while preserving approval boundaries", () => {
    expect(evaluateCandidateMatrixPayload(testCase, 200, payload())).toMatchObject({
      ok: true,
      failures: [],
      missingHazardIds: [],
      missingTermGroups: [],
      missingEvidenceTermGroups: [],
      missingSifEvidenceTermGroups: [],
      missingEventFactGroups: [],
      exposedForbiddenTerms: [],
      reviewerEvidenceTraceVisible: true,
      sifEvidenceBoundaryVisible: true,
      sifProvenancePresent: true,
      technicalGuidanceBoundaryVisible: true,
      lawCandidateBoundaryVisible: true,
      eventSemanticGroundingVisible: true,
      boundary: {
        storageMode: "stateless_candidate",
        savedRunId: null,
        publicationState: "unpublished",
        dbMutationPerformed: false,
        publishAllowed: false,
        humanReviewRequired: true,
        machineEvidenceReplacesHumanReview: false
      }
    });
  });

  it("fails closed for a missing scenario term even when readiness self-reports green", () => {
    const unsafe = payload();
    unsafe.candidate.generatedText = "1) 위험요인 요약: 일반 위험\n2) 문서 반영 위치: 위험성평가표\n3) 통제대책: 일반 점검\n4) 검수 필요 항목: 현장 확인";

    expect(evaluateCandidateMatrixPayload(testCase, 200, unsafe)).toMatchObject({
      ok: false,
      missingTermGroups: [["화학물질", "MSDS"], ["누출", "보호구"]]
    });
  });

  it("fails closed when provenance exists only in metadata and is absent from reviewer-visible text", () => {
    const unsafe = payload();
    unsafe.candidate.generatedText = "1) 위험요인 요약: 화학물질 누출 위험\n2) 문서 반영 위치: 위험성평가표\n3) 통제대책: MSDS와 보호구 확인\n4) 검수 필요 항목: 현장 책임자 확인";

    const result = evaluateCandidateMatrixPayload(testCase, 200, unsafe);
    expect(result.ok).toBe(false);
    expect(result.missingEvidenceTermGroups).toEqual([
      ["물질안전보건자료 조회 서비스"],
      ["산업안전보건법"]
    ]);
    expect(result.failures).toEqual(expect.arrayContaining([
      "reviewer_evidence_trace_missing",
      "sif_evidence_boundary_missing",
      "technical_guidance_boundary_missing",
      "law_candidate_boundary_missing"
    ]));
  });

  it("fails closed when linked SIF evidence is absent from reviewer-visible text", () => {
    const unsafe = payload();
    unsafe.candidate.generatedText = unsafe.candidate.generatedText.replace(
      "SIF 재해·통제 근거 - SIF 화학물질 누출·접촉 사고 통제 사례 (사고 통제 참고 후보) / ",
      ""
    );
    unsafe.contentReadiness.sifEvidenceVisible = false;
    unsafe.contentReadiness.unresolvedReviewItems = ["sif_provenance_not_visible"];
    unsafe.contentReadiness.status = "revision_required";

    const result = evaluateCandidateMatrixPayload(testCase, 200, unsafe);
    expect(result.ok).toBe(false);
    expect(result.missingSifEvidenceTermGroups).toEqual([["SIF 화학물질 누출·접촉 사고 통제 사례"]]);
    expect(result.failures).toEqual(expect.arrayContaining([
      "sif_readiness_evidence_missing",
      "sif_evidence_boundary_missing",
      "missing_sif_evidence_term_group:SIF 화학물질 누출·접촉 사고 통제 사례"
    ]));
  });

  it("fails closed when explicit event review facts are absent", () => {
    const unsafe = payload();
    unsafe.candidate.generatedText = unsafe.candidate.generatedText.replace(
      " / 원본 이벤트 검토 사실: 야간 교대 작업 · 청각 경보 보조수단 필요",
      ""
    );

    const result = evaluateCandidateMatrixPayload(testCase, 200, unsafe);
    expect(result.ok).toBe(false);
    expect(result.missingEventFactGroups).toEqual([
      ["야간 교대 작업"],
      ["청각 경보 보조수단 필요"]
    ]);
    expect(result.failures).toContain("event_semantic_grounding_missing");
  });

  it("fails closed when a private event term reaches reviewer-visible text", () => {
    const unsafe = payload();
    unsafe.candidate.generatedText += "\n내부 메모: resident-id: 900101-1234567";

    const result = evaluateCandidateMatrixPayload(testCase, 200, unsafe);
    expect(result.ok).toBe(false);
    expect(result.exposedForbiddenTerms).toEqual(["resident-id: 900101-1234567"]);
    expect(result.failures).toContain("private_event_term_exposed:resident-id: 900101-1234567");
  });

  it("fails closed for publication, mutation, or human-review overclaims", () => {
    const unsafe = payload();
    unsafe.candidate.publicationState = "published";
    unsafe.candidate.dbMutationPerformed = true;
    unsafe.contentReadiness.humanReviewCompleted = true;

    const result = evaluateCandidateMatrixPayload(testCase, 200, unsafe);
    expect(result.ok).toBe(false);
    expect(result.failures).toEqual(expect.arrayContaining([
      "candidate_publication_state_changed",
      "candidate_db_mutation_boundary_failed",
      "human_review_overclaimed"
    ]));
  });

  it("accepts the stateless built-in candidate builder only when fallback use is explicit", () => {
    const base = payload();
    const fallback = {
      ...base,
      configured: false,
      candidate: { ...base.candidate, generatedBy: "safeclaw_candidate_builder" },
      generated: { fallbackUsed: true, providerLabel: null }
    };

    expect(evaluateCandidateMatrixPayload(testCase, 200, fallback, { generationMode: "deterministic" })).toMatchObject({
      ok: true,
      generation: {
        mode: "deterministic",
        configured: false,
        generatedBy: "safeclaw_candidate_builder",
        fallbackUsed: true,
        providerLabel: null
      }
    });
  });
});
