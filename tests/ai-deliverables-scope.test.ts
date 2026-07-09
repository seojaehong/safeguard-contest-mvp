import { describe, expect, it } from "vitest";
import { listAiDeliverableGroupsForScope } from "@/lib/ai-deliverables";

describe("AI deliverable group scope", () => {
  it("keeps enhanced generation out of AI document calls", () => {
    expect(listAiDeliverableGroupsForScope("enhanced")).toEqual([]);
  });

  it("keeps non-core document groups out of enhanced generation", () => {
    expect(listAiDeliverableGroupsForScope("enhanced")).not.toEqual(
      expect.arrayContaining([
        "workPlanStructured",
        "riskAssessment",
        "tbmBriefingStructured",
        "tbmLogStructured",
        "educationRecordStructured",
        "tbmLog",
        "structuredRiskRows",
        "free",
        "foreign",
        "tbmRiskLinks"
      ])
    );
  });

  it("keeps full generation broad for explicit full-mode runs", () => {
    expect(listAiDeliverableGroupsForScope("full")).toEqual([
      "riskAssessment",
      "workPlanStructured",
      "tbmBriefingStructured",
      "tbmLogStructured",
      "tbmLog",
      "educationRecordStructured",
      "structuredRiskRows",
      "free",
      "foreign",
      "tbmRiskLinks"
    ]);
  });
});
