import { beforeEach, describe, expect, test, vi } from "vitest";

import { buildMockAskResponse, mockSearchResults } from "@/lib/mock-data";
import { assembleGraph } from "@/lib/ontology/graph-store";
import type { QaReviewFound } from "@/lib/ontology/qa-review";

const mocks = vi.hoisted(() => ({
  querySafetyKnowledge: vi.fn(),
  resolveSafetyKnowledgeSnapshot: vi.fn(),
  reviewDocpack: vi.fn(),
  runAsk: vi.fn(),
}));

vi.mock("@/lib/ontology/knowledge-tool", () => ({
  querySafetyKnowledge: mocks.querySafetyKnowledge,
  resolveSafetyKnowledgeSnapshot: mocks.resolveSafetyKnowledgeSnapshot,
}));

vi.mock("@/lib/ontology/qa-review-tool", () => ({
  reviewDocpack: mocks.reviewDocpack,
}));

vi.mock("@/lib/search", () => ({
  runAsk: mocks.runAsk,
}));

import { executeClawTool } from "@/lib/claw-tools";

function response(question: string) {
  return buildMockAskResponse(
    question,
    mockSearchResults.slice(0, 3),
    "mock",
    "claw ontology grounding test",
  );
}

function passingQa(): QaReviewFound {
  return {
    reviewable: true,
    task: "지게차 상하차",
    covered: { hazards: ["끼임"], controls: ["출입통제"], articles: ["제172조"] },
    missing: { hazards: [], controls: [], articles: [] },
    coverageRate: 1,
    verdict: "통과",
    advisory: "검수 고지",
  };
}

describe("claw ontology generation handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.querySafetyKnowledge.mockRejectedValue(new Error("PRIVATE_ONTOLOGY_FAILURE"));
    mocks.resolveSafetyKnowledgeSnapshot.mockRejectedValue(new Error("PRIVATE_ONTOLOGY_FAILURE"));
    mocks.runAsk.mockImplementation(async (question: string) => response(question));
    mocks.reviewDocpack.mockResolvedValue(passingQa());
  });

  test("routes the reviewed tool through missing Phase A grounding and non-authoritative QA", async () => {
    const result = await executeClawTool("generate_reviewed_safety_docpack", {
      question: "등록되지 않은 해체 작업",
      task: "지게차 상하차",
      mode: "enhanced",
      includeFull: true,
    });

    expect(mocks.resolveSafetyKnowledgeSnapshot).toHaveBeenCalledTimes(1);
    expect(mocks.querySafetyKnowledge).not.toHaveBeenCalled();
    expect(mocks.runAsk).toHaveBeenCalledWith(
      "등록되지 않은 해체 작업",
      expect.objectContaining({
        aiMode: "enhanced",
        phaseAGraphSnapshot: null,
        phaseAGrounding: expect.objectContaining({
          groundingStatus: "missing",
          evidencePack: null,
        }),
      }),
    );
    expect(mocks.reviewDocpack).toHaveBeenCalledWith(
      "지게차 상하차",
      expect.any(String),
      null,
    );
    expect(result).toMatchObject({
      reviewStatus: {
        verdict: "검토 필요",
        verified: false,
        groundingStatus: "missing",
        reasonCode: "phase_a_evidence_missing",
      },
      qa: {
        authoritative: false,
        diagnostic: { verdict: "통과" },
      },
      docpack: {
        evidenceMaterialization: {
          verifiedRecords: [],
          humanConfirmation: { required: true, status: "pending" },
        },
      },
    });
    expect(JSON.stringify(result)).not.toContain("최종 답변의 근거로 사용");
  });

  test("wraps standalone legacy QA as diagnostic-only review-required output", async () => {
    const result = await executeClawTool("qa_review_docpack", {
      task: "지게차 상하차",
      document_text: "끼임 출입통제 산업안전보건기준에 관한 규칙 제172조",
    });

    expect(mocks.reviewDocpack).toHaveBeenCalledWith(
      "지게차 상하차",
      "끼임 출입통제 산업안전보건기준에 관한 규칙 제172조",
    );
    expect(result).not.toHaveProperty("verdict");
    expect(result).toMatchObject({
      authority: "diagnostic_only",
      reviewStatus: {
        status: "review_required",
        verdict: "검토 필요",
        verified: false,
        authoritative: false,
        reasonCode: "phase_a_authority_contract_missing",
        humanConfirmation: { required: true, status: "pending" },
      },
      qa: {
        authority: "diagnostic_only",
        diagnostic: { verdict: "통과" },
      },
    });
  });

  test("routes the plain docpack tool through missing Phase A grounding", async () => {
    const result = await executeClawTool("generate_safety_docpack", {
      question: "등록되지 않은 해체 작업",
      mode: "template",
      includeFull: true,
    });

    expect(mocks.resolveSafetyKnowledgeSnapshot).toHaveBeenCalledTimes(1);
    expect(mocks.querySafetyKnowledge).not.toHaveBeenCalled();
    expect(mocks.runAsk).toHaveBeenCalledWith(
      "등록되지 않은 해체 작업",
      expect.objectContaining({
        aiMode: "template",
        phaseAGrounding: expect.objectContaining({ groundingStatus: "missing" }),
      }),
    );
    expect(result).toMatchObject({
      ontologyGrounding: {
        groundingStatus: "missing",
        outputStatus: "missing_evidence_draft",
        verified: false,
      },
      evidenceMaterialization: {
        verifiedRecords: [],
        humanConfirmation: { required: true, status: "pending" },
      },
    });
  });

  test("reuses the resolver graph snapshot for generation and reviewed QA", async () => {
    const graphSnapshot = assembleGraph([], []);
    mocks.resolveSafetyKnowledgeSnapshot.mockResolvedValue({
      evidence: {
        found: false,
        message: "Phase A Task 미등록",
        registeredTasks: [],
        evidenceContract: null,
        evidenceDiagnostics: null,
        evidenceChainState: "not_registered",
      },
      graphSnapshot,
    });

    await executeClawTool("generate_reviewed_safety_docpack", {
      question: "등록되지 않은 해체 작업",
      task: "지게차 상하차",
      mode: "full",
      includeFull: true,
    });

    expect(mocks.runAsk).toHaveBeenCalledWith(
      "등록되지 않은 해체 작업",
      expect.objectContaining({ phaseAGraphSnapshot: graphSnapshot }),
    );
    expect(mocks.reviewDocpack).toHaveBeenCalledWith(
      "지게차 상하차",
      expect.any(String),
      graphSnapshot,
    );
  });
});
