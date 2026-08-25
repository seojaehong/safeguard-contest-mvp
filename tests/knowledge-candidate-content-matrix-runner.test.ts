import { describe, expect, it } from "vitest";
// @ts-expect-error -- the executable MJS module exposes a runtime evaluator tested here.
import { evaluateCandidateMatrixPayload } from "../scripts/knowledge_candidate_content_matrix_runner.mjs";

const testCase = {
  id: "chemical-cleaning",
  expectedHazardIds: ["chemical-msds"],
  requiredAnyGroups: [["화학물질", "MSDS"], ["누출", "보호구"]]
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
      generatedText: "1) 위험요인 요약: 화학물질 누출 위험\n2) 문서 반영 위치: 위험성평가표\n3) 통제대책: MSDS와 보호구 확인\n4) 검수 필요 항목: 현장 책임자 확인",
      matchedHazardIds: ["chemical-msds"],
      dbMutationAllowed: false,
      dbMutationPerformed: false,
      publishAllowed: false
    },
    reviewContract: {
      status: "human_review_required",
      humanReviewRequired: true,
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
      hazardGroundingPresent: true,
      unresolvedReviewItems: [],
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
