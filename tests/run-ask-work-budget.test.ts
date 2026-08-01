import { describe, expect, it } from "vitest";
import { PUBLIC_ASK_HARNESS_MEMORY_MAX_CHARS, PUBLIC_ASK_QUESTION_MAX_CHARS } from "@/lib/public-work-budget";
import { PublicAskWorkBudgetError, runAsk } from "@/lib/search";

describe("runAsk public work budget", () => {
  it("rejects oversized questions before downstream provider work", async () => {
    await expect(runAsk("작업 ".repeat(PUBLIC_ASK_QUESTION_MAX_CHARS)))
      .rejects.toBeInstanceOf(PublicAskWorkBudgetError);
  });

  it("rejects oversized harness memory before downstream provider work", async () => {
    await expect(runAsk("성수동 외벽 도장 작업", {
      harnessMemory: {
        improvements: [{
          id: "oversized",
          taskLabel: "외벽 도장",
          hazardLabel: "추락",
          improvementText: "x".repeat(PUBLIC_ASK_HARNESS_MEMORY_MAX_CHARS),
          reflectedDocuments: ["위험성평가표"],
          sourceType: "manual"
        }],
        workpackMemory: []
      }
    })).rejects.toBeInstanceOf(PublicAskWorkBudgetError);
  });
});
