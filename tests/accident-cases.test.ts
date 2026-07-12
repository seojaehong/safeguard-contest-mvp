import { describe, expect, it } from "vitest";

import { selectFallbackAccidentCases } from "@/lib/accident-cases";

function serializeCases(question: string) {
  return JSON.stringify(selectFallbackAccidentCases(question));
}

describe("selectFallbackAccidentCases", () => {
  it.each(["외국인", "신규", "고령", "숙련"])(
    "does not treat the worker attribute %s as chemical-cleaning work identity",
    (workerAttribute) => {
      expect(serializeCases(`${workerAttribute} 작업자 포함 일반 작업`)).not.toMatch(/화학|세척|세제/);
    }
  );

  it("keeps chemical-cleaning accidents for chemical-cleaning work identity", () => {
    const cases = selectFallbackAccidentCases("공장 바닥 세척 작업. 화학세제 사용.");

    expect(cases[0]?.title).toContain("세척");
    expect(serializeCases("공장 바닥 세척 작업. 화학세제 사용.")).toMatch(/화학|세척|세제/);
  });
});
