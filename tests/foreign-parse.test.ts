import { describe, expect, test } from "vitest";
import { parseForeign } from "@/lib/ai-deliverables";
import { isHeavyOutputDoc } from "@/lib/ai-deliverables-policy";

const LONG = "가".repeat(300);

describe("parseForeign leniency", () => {
  test("accepts briefing-only output (missing transmission) as a partial result", () => {
    const raw = JSON.stringify({ foreignWorkerBriefing: LONG, foreignWorkerLanguages: ["ko", "en"] });
    const out = parseForeign(raw);
    expect(out).not.toBeNull();
    expect(out!.foreignWorkerBriefing).toBe(LONG);
    expect(out!.foreignWorkerTransmission).toBeUndefined();
    expect(out!.foreignWorkerLanguages).toEqual(["ko", "en"]);
  });

  test("still returns both keys when both are present", () => {
    const raw = JSON.stringify({ foreignWorkerBriefing: LONG, foreignWorkerTransmission: LONG });
    const out = parseForeign(raw);
    expect(out!.foreignWorkerTransmission).toBe(LONG);
  });

  test("rejects output without a usable briefing", () => {
    expect(parseForeign(JSON.stringify({ foreignWorkerBriefing: "짧음" }))).toBeNull();
  });

  test("tolerates code fences and trailing chatter around the JSON", () => {
    const raw = "```json\n" + JSON.stringify({ foreignWorkerBriefing: LONG }) + "\n```\n추가 정보가 필요하면 회신해 주세요.";
    expect(parseForeign(raw)).not.toBeNull();
  });
});

describe("isHeavyOutputDoc", () => {
  test("foreign and free are heavy; standard docs are not", () => {
    expect(isHeavyOutputDoc("foreign")).toBe(true);
    expect(isHeavyOutputDoc("free")).toBe(true);
    expect(isHeavyOutputDoc("riskAssessment")).toBe(false);
  });
});
