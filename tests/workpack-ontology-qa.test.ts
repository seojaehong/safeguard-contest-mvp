import { describe, expect, it, vi } from "vitest";

import { buildMockAskResponse, mockSearchResults } from "@/lib/mock-data";
import { resolveReviewTaskLabel } from "@/lib/mcp-tools";
import {
  attachOntologyQaResult,
  attachWebOntologyQa,
  buildOntologyQaSource
} from "@/lib/workpack-ontology-qa";
import { reviewDocpack } from "@/lib/ontology/qa-review-tool";
import type { QaReviewFound } from "@/lib/ontology/qa-review";

vi.mock("@/lib/ontology/qa-review-tool", () => ({
  reviewDocpack: vi.fn()
}));

const qaPass: QaReviewFound = {
  reviewable: true,
  task: "용접",
  covered: { hazards: ["화재"], controls: ["화재감시자 배치"], articles: [] },
  missing: { hazards: [], controls: [], articles: [] },
  coverageRate: 1,
  verdict: "통과",
  advisory: "검수 고지"
};

describe("web workpack ontology QA", () => {
  it("builds a QA source from the generated workpack documents", () => {
    const response = buildMockAskResponse("서울 현장 고소 작업", mockSearchResults.slice(0, 2), "mock", "test");
    const source = buildOntologyQaSource(response);

    expect(source.text).toContain("[riskAssessmentDraft]");
    expect(source.text).toContain("[tbmBriefing]");
    expect(source.documentKeys).toContain("riskAssessmentDraft");
    expect(source.documentKeys).toContain("safetyEducationRecordDraft");
  });

  it("uses the same vague-task correction path as MCP reviewed docpack tools", async () => {
    vi.mocked(reviewDocpack).mockResolvedValueOnce(qaPass);
    const question = "안산 공장 옥외 배관 용접·절단 화기작업. 화재감시자 필요.";
    const response = buildMockAskResponse(question, mockSearchResults.slice(0, 2), "live", "test");
    const reviewed = await attachWebOntologyQa(response, question);

    expect(resolveReviewTaskLabel("일반 작업", question)).toBe("용접");
    expect(reviewDocpack).toHaveBeenCalledWith("용접", expect.stringContaining("화재감시자"));
    expect(reviewed.ontologyQa?.reviewTask).toBe("용접");
    expect(reviewed.ontologyQa?.result.reviewable).toBe(true);
  });

  it("attaches review verdicts without mutating the source response", () => {
    const response = buildMockAskResponse("용접 작업", mockSearchResults.slice(0, 2), "live", "test");
    const reviewed = attachOntologyQaResult(response, "용접", qaPass, ["riskAssessmentDraft"]);

    expect(response.ontologyQa).toBeUndefined();
    expect(reviewed.ontologyQa?.reviewTask).toBe("용접");
    expect(reviewed.ontologyQa?.detail).toContain("온톨로지 QA");
  });
});
