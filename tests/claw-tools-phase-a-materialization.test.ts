import { beforeEach, describe, expect, test, vi } from "vitest";

import { buildMockAskResponse, mockSearchResults } from "@/lib/mock-data";
import { assembleGraph } from "@/lib/ontology/graph-store";
import { buildPublishedSafetyKnowledge } from "@/lib/ontology/knowledge-tool";
import type { QaReviewFound } from "@/lib/ontology/qa-review";
import { SEED_EDGES, SEED_NODES } from "@/lib/ontology/seed/core-triples";

const mocks = vi.hoisted(() => ({
  querySafetyKnowledge: vi.fn(),
  reviewDocpack: vi.fn(),
  runAsk: vi.fn(),
}));

vi.mock("@/lib/ontology/knowledge-tool", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/ontology/knowledge-tool")>();
  return {
    ...original,
    querySafetyKnowledge: mocks.querySafetyKnowledge,
  };
});

vi.mock("@/lib/ontology/qa-review-tool", () => ({
  reviewDocpack: mocks.reviewDocpack,
}));

vi.mock("@/lib/search", () => ({
  runAsk: mocks.runAsk,
}));

import { executeClawTool } from "@/lib/claw-tools";

const publishedGraph = assembleGraph(
  SEED_NODES.filter((node) => node.review_state === "published"),
  SEED_EDGES.filter((edge) => edge.review_state === "published"),
);

function response(question: string) {
  return buildMockAskResponse(
    question,
    mockSearchResults.slice(0, 3),
    "mock",
    "Claw Phase A product materialization test",
  );
}

function passingQa(task: string): QaReviewFound {
  return {
    reviewable: true,
    task,
    covered: { hazards: [], controls: [], articles: [] },
    missing: { hazards: [], controls: [], articles: [] },
    coverageRate: 1,
    verdict: "통과",
    advisory: "검수 고지",
  };
}

describe("Claw Phase A product handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.runAsk.mockImplementation(async (question: string) => response(question));
    mocks.reviewDocpack.mockImplementation(async (task: string) => passingQa(task));
  });

  test("materializes the reviewed canonical chain before QA and result projection", async () => {
    mocks.querySafetyKnowledge.mockResolvedValue(
      buildPublishedSafetyKnowledge(publishedGraph, "고소작업"),
    );

    const result = await executeClawTool("generate_reviewed_safety_docpack", {
      question: "외벽 고소 작업을 위한 문서팩",
      task: "고소작업",
      mode: "template",
      includeFull: true,
    });

    expect(mocks.querySafetyKnowledge).toHaveBeenCalledWith("고소작업");
    expect(mocks.reviewDocpack).toHaveBeenCalledWith(
      "고소작업",
      expect.stringContaining("work-at-height-fall:risk-assessment:fall-work-platform"),
    );
    expect(result).toMatchObject({
      phaseAReviewStatus: {
        verdict: "검토 필요",
        verified: false,
        authorityState: "review_required",
        humanConfirmation: { required: true, status: "pending" },
      },
      qaAuthority: "diagnostic_only",
      docpack: {
        phaseAProduct: {
          chainId: "work-at-height-fall",
          authorityState: "review_required",
          verifiedDocumentRows: [],
        },
        documents: {
          riskAssessmentDraft: expect.stringContaining(
            "work-at-height-fall:risk-assessment:fall-work-platform",
          ),
          tbmBriefing: expect.stringContaining("work-at-height-fall:tbm:fall-work-platform"),
        },
      },
    });
    expect(result).toMatchObject({
      openClawUsageNote: expect.stringContaining("최종 근거로 사용하지 마세요"),
    });
  });

  test("infers the canonical Task for the plain docpack product path", async () => {
    mocks.querySafetyKnowledge.mockResolvedValue(
      buildPublishedSafetyKnowledge(publishedGraph, "전기 작업"),
    );

    const result = await executeClawTool("generate_safety_docpack", {
      question: "수전설비 감전 위험이 있는 전기 작업",
      mode: "template",
      includeFull: true,
    });

    expect(mocks.querySafetyKnowledge).toHaveBeenCalledWith("전기 작업");
    expect(result).toMatchObject({
      phaseAProduct: {
        chainId: "electrical-work-electrocution",
        authorityState: "review_required",
        verifiedDocumentRows: [],
      },
      documents: {
        riskAssessmentDraft: expect.stringContaining(
          "electrical-work-electrocution:risk-assessment:electrical-live-part-guarding",
        ),
        tbmBriefing: expect.stringContaining(
          "electrical-work-electrocution:tbm:electrical-live-part-guarding",
        ),
      },
    });
  });

  test("preserves plain docpack generation outside the registered Phase A chains", async () => {
    mocks.querySafetyKnowledge.mockRejectedValue(new Error("ontology unavailable"));

    const result = await executeClawTool("generate_safety_docpack", {
      question: "일반 정리 작업 문서팩",
      mode: "template",
      includeFull: true,
    });

    expect(mocks.querySafetyKnowledge).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      documents: {
        riskAssessmentDraft: expect.any(String),
        tbmBriefing: expect.any(String),
      },
    });
    expect(result).not.toHaveProperty("phaseAProduct");
  });
});
