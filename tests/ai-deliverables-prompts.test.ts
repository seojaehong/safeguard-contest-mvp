import { describe, expect, it } from "vitest";

import { contextBlock, persona } from "@/lib/ai-deliverables";

const baseCtx = {
  question: "질문",
  scenario: {
    companyName: "테스트회사",
    siteName: "테스트현장",
    workSummary: "테스트 작업",
    workerCount: 5,
    weatherNote: "맑음"
  },
  citationLines: [],
  trainingLines: [],
  koshaLines: [],
  accidentLines: [],
  workDate: "2026-07-02"
};

describe("persona", () => {
  it("forbids inventing dates outside the scenario work date", () => {
    expect(persona()).toMatch(/작업일자/);
    expect(persona()).toMatch(/다른 날짜를 만들지 마라/);
  });

  it("forbids inventing example names/companies/addresses", () => {
    expect(persona()).toMatch(/현장 확인 필요/);
    expect(persona()).toMatch(/김철수/);
  });
});

describe("contextBlock", () => {
  it("includes the injected work date in the 현장 시나리오 block", () => {
    const block = contextBlock(baseCtx);
    expect(block).toMatch(/작업일자: 2026-07-02/);
  });
});
