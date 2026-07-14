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

function requireRecord(value: unknown): asserts value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("expected an object result");
  }
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

  test("does not attach reviewed Phase A provenance from a task unrelated to the question", async () => {
    mocks.querySafetyKnowledge.mockResolvedValue(
      buildPublishedSafetyKnowledge(publishedGraph, "고소작업"),
    );

    const result = await executeClawTool("generate_reviewed_safety_docpack", {
      question: "전기 설비 작업을 위한 문서팩",
      task: "고소작업",
      mode: "template",
      includeFull: true,
    });
    requireRecord(result);
    requireRecord(result.docpack);

    expect(mocks.reviewDocpack).toHaveBeenCalledWith(
      "고소작업",
      expect.not.stringContaining("work-at-height-fall:risk-assessment:"),
    );
    expect(result.docpack).not.toHaveProperty("phaseAProduct");
    expect(result).not.toHaveProperty("phaseAReviewStatus");
    expect(result).not.toHaveProperty("qaAuthority");
  });

  test("does not attach reviewed Phase A provenance when the question names multiple chains", async () => {
    mocks.querySafetyKnowledge.mockResolvedValue(
      buildPublishedSafetyKnowledge(publishedGraph, "높은 곳 작업"),
    );

    const result = await executeClawTool("generate_reviewed_safety_docpack", {
      question: "높은 곳 작업과 전기 작업을 함께 수행하는 문서팩",
      task: "높은 곳 작업",
      mode: "template",
      includeFull: true,
    });
    requireRecord(result);
    requireRecord(result.docpack);

    expect(result.docpack).not.toHaveProperty("phaseAProduct");
    expect(result).not.toHaveProperty("phaseAReviewStatus");
  });

  test.each([
    {
      task: "고소작업",
      question: "고소작업은 하지 않고 배관 작업 수행",
      knowledgeTask: "고소작업",
    },
    {
      task: "고소작업",
      question: "고소작업 여부가 아직 미확정",
      knowledgeTask: "고소작업",
    },
    {
      task: "전기작업",
      question: "비전기작업 문서팩",
      knowledgeTask: "전기작업",
    },
  ])("does not materialize reviewed provenance for unsupported intent: '$question'", async ({
    task,
    question,
    knowledgeTask,
  }) => {
    mocks.querySafetyKnowledge.mockResolvedValue(
      buildPublishedSafetyKnowledge(publishedGraph, knowledgeTask),
    );

    const result = await executeClawTool("generate_reviewed_safety_docpack", {
      question,
      task,
      mode: "template",
      includeFull: true,
    });
    requireRecord(result);
    requireRecord(result.docpack);

    expect(result.docpack).not.toHaveProperty("phaseAProduct");
    expect(result).not.toHaveProperty("phaseAReviewStatus");
  });

  test("keeps reviewed Phase A provenance for a canonical question and alias task", async () => {
    mocks.querySafetyKnowledge.mockResolvedValue(
      buildPublishedSafetyKnowledge(publishedGraph, "높은 곳 작업"),
    );

    const result = await executeClawTool("generate_reviewed_safety_docpack", {
      question: "외벽 고소작업을 위한 문서팩",
      task: "높은 곳 작업",
      mode: "template",
      includeFull: true,
    });
    requireRecord(result);
    requireRecord(result.docpack);

    expect(result.docpack).toMatchObject({
      phaseAProduct: {
        chainId: "work-at-height-fall",
      },
      documents: {
        riskAssessmentDraft: expect.stringContaining(
          "work-at-height-fall:risk-assessment:",
        ),
      },
    });
  });

  test("materializes an electrical registry alias through the plain docpack product path", async () => {
    mocks.querySafetyKnowledge.mockImplementation(async (query: string) =>
      buildPublishedSafetyKnowledge(publishedGraph, query),
    );

    const result = await executeClawTool("generate_safety_docpack", {
      question: "전기작업",
      mode: "template",
      includeFull: true,
    });

    expect(mocks.querySafetyKnowledge).toHaveBeenCalledWith("전기작업");
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

  test.each([
    { task: "고소작업", chainId: "work-at-height-fall" },
    { task: "높은 곳 작업", chainId: "work-at-height-fall" },
    { task: "지게차 상하차", chainId: "vehicle-machinery-entrapment" },
    { task: "차량계·기계 인접작업", chainId: "vehicle-machinery-entrapment" },
    { task: "전기 작업", chainId: "electrical-work-electrocution" },
  ])("materializes canonical and registry alias task '$task' through the same matcher path", async ({
    task,
    chainId,
  }) => {
    mocks.querySafetyKnowledge.mockImplementation(async (query: string) =>
      buildPublishedSafetyKnowledge(publishedGraph, query),
    );

    const result = await executeClawTool("generate_safety_docpack", {
      question: task,
      mode: "template",
      includeFull: true,
    });

    expect(mocks.querySafetyKnowledge).toHaveBeenCalledTimes(1);
    expect(mocks.querySafetyKnowledge).toHaveBeenCalledWith(task);
    expect(result).toMatchObject({
      phaseAProduct: {
        chainId,
        authorityState: "review_required",
        humanConfirmation: { required: true, status: "pending" },
      },
      documents: {
        riskAssessmentDraft: expect.stringContaining(`${chainId}:risk-assessment:`),
        tbmBriefing: expect.stringContaining(`${chainId}:tbm:`),
      },
    });
  });

  test("preserves plain docpack generation outside the registered Phase A chains", async () => {
    mocks.querySafetyKnowledge.mockImplementation(async (query: string) =>
      buildPublishedSafetyKnowledge(publishedGraph, query),
    );

    const result = await executeClawTool("generate_safety_docpack", {
      question: "일반 정리 작업 문서팩",
      mode: "template",
      includeFull: true,
    });

    expect(mocks.querySafetyKnowledge).toHaveBeenCalledWith("일반 정리 작업 문서팩");
    expect(result).toMatchObject({
      documents: {
        riskAssessmentDraft: expect.any(String),
        tbmBriefing: expect.any(String),
      },
    });
    expect(result).not.toHaveProperty("phaseAProduct");
  });
});
