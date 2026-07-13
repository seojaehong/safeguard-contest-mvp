import { afterEach, describe, expect, it, vi } from "vitest";

import { buildMockAskResponse } from "@/lib/mock-data";

const mocks = vi.hoisted(() => ({
  resolveSafetyKnowledgeSnapshot: vi.fn(),
  querySafetyKnowledge: vi.fn(),
  runAsk: vi.fn()
}));

vi.mock("@/lib/ontology/knowledge-tool", () => ({
  resolveSafetyKnowledgeSnapshot: mocks.resolveSafetyKnowledgeSnapshot,
  querySafetyKnowledge: mocks.querySafetyKnowledge
}));

vi.mock("@/lib/search", () => ({
  runAsk: mocks.runAsk
}));

describe("Phase A grounding deadline", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it.each(["template", "enhanced", "full"] as const)(
    "continues %s generation with explicit missing grounding when the resolver never settles",
    async (aiMode) => {
      mocks.resolveSafetyKnowledgeSnapshot.mockImplementation(() => new Promise(() => undefined));
      mocks.querySafetyKnowledge.mockImplementation(() => new Promise(() => undefined));
      mocks.runAsk.mockImplementation(async (question: string) =>
        buildMockAskResponse(question, [], "mock", "deadline fallback")
      );

      const { runPhaseAGroundedAsk } = await import("@/lib/ontology/grounded-ask");
      const response = await runPhaseAGroundedAsk("끝나지 않는 ontology lookup", {
        aiMode,
        phaseAGroundingTimeoutMs: 10
      });

      expect(response.question).toBe("끝나지 않는 ontology lookup");
      expect(mocks.runAsk).toHaveBeenCalledWith(
        "끝나지 않는 ontology lookup",
        expect.objectContaining({
          aiMode,
          phaseAGrounding: expect.objectContaining({
            groundingStatus: "missing",
            evidenceChainState: "not_evaluated",
            allowedCitedUids: []
          }),
          phaseAGraphSnapshot: null,
        })
      );
    },
    500
  );
});
