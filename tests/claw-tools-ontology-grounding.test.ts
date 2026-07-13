import { beforeEach, describe, expect, test, vi } from "vitest";

import { buildMockAskResponse, mockSearchResults } from "@/lib/mock-data";
import type { QaReviewFound } from "@/lib/ontology/qa-review";

const mocks = vi.hoisted(() => ({
  querySafetyKnowledge: vi.fn(),
  reviewDocpack: vi.fn(),
  runAsk: vi.fn(),
}));

vi.mock("@/lib/ontology/knowledge-tool", () => ({
  querySafetyKnowledge: mocks.querySafetyKnowledge,
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

    expect(mocks.querySafetyKnowledge).toHaveBeenCalledTimes(1);
    expect(mocks.runAsk).toHaveBeenCalledWith(
      "등록되지 않은 해체 작업",
      expect.objectContaining({
        aiMode: "enhanced",
        phaseAGrounding: expect.objectContaining({
          groundingStatus: "missing",
          evidencePack: null,
        }),
      }),
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

  test("routes the plain docpack tool through missing Phase A grounding", async () => {
    const result = await executeClawTool("generate_safety_docpack", {
      question: "등록되지 않은 해체 작업",
      mode: "template",
      includeFull: true,
    });

    expect(mocks.querySafetyKnowledge).toHaveBeenCalledTimes(1);
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
});
