import { describe, expect, it } from "vitest";

import { exactKoshaReferenceAppliesToQuery } from "@/lib/exact-kosha-applicability-policy";

describe("exact KOSHA applicability policy", () => {
  it.each([
    ["강관비계 안전기준", true],
    ["비계 붕괴 예방", true],
    ["벽이음 안전점검", true],
    ["이동식비계 안전점검", true],
    ["비계조립 안전기준", true],
    ["이동식비계 조립작업", true],
    ["비계 구매 후 설치 작업 안전점검", true],
    ["이동식 비계 구매 견적과 납품 일정", false],
    ["비계약 작업복 안전교육", false],
  ])("classifies D-C-7 query %s", (query, expected) => {
    expect(exactKoshaReferenceAppliesToQuery("D-C-7", query)).toBe(expected);
  });

  it.each([
    ["아파트 외벽 도장 작업", true],
    ["외벽도장 작업", true],
    ["건물 외벽 페인트 견적", false],
    ["공동주택 달비계 안전점검", true],
    ["외벽 자재 납품 일정", false],
  ])("classifies D-C-13 query %s", (query, expected) => {
    expect(exactKoshaReferenceAppliesToQuery("D-C-13", query)).toBe(expected);
  });
});
