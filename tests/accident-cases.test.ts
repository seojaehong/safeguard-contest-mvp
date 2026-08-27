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

  it.each([
    ["물류센터 지게차 상하차 작업", "지게차"],
    ["지하 기계실 점검 작업", "기계실"]
  ])("does not leak a chemical-cleaning accident into unrelated work: %s", (question, primaryCase) => {
    const cases = selectFallbackAccidentCases(question);

    expect(cases[0]?.title).toContain(primaryCase);
    expect(JSON.stringify(cases)).not.toMatch(/화학|세척|세제/);
  });

  it("keeps roof-repair heat evidence limited to fall and heat cases", () => {
    const cases = selectFallbackAccidentCases(
      "대구 옥외 지붕 보수 작업. 폭염과 자외선 노출에 대비해 물·그늘·휴식 기준을 확인한다."
    );
    const surface = JSON.stringify(cases);

    expect(cases).toHaveLength(2);
    expect(cases[0]?.title).toContain("추락");
    expect(cases[1]?.title).toContain("온열질환");
    expect(surface).toMatch(/지붕|고소|추락/);
    expect(surface).toMatch(/폭염|고온|온열질환/);
    expect(surface).not.toMatch(/지게차|상하차|용접|화재|기계실/);
  });

  it("keeps automation-equipment maintenance evidence limited to guarding and unexpected startup", () => {
    const cases = selectFallbackAccidentCases(
      "구미 전자부품 공장 자동화설비 방호장치 개선과 정비 작업. 끼임과 예기치 않은 기동을 다루되 KOSHA Guide는 기술지침으로 참고한다."
    );
    const surface = JSON.stringify(cases);

    expect(cases).toHaveLength(1);
    expect(cases[0]?.title).toContain("자동화설비 정비");
    expect(surface).toMatch(/방호장치|LOTO|잔류에너지/);
    expect(surface).not.toMatch(/지게차|상하차|용접|화재|비계|추락|기계실|세척 작업/);
  });

  it("retains the representative fallback only for an unspecified general question", () => {
    const cases = selectFallbackAccidentCases("산업안전 실무 질문");

    expect(cases.map((item) => item.title)).toEqual([
      "이동식 비계 작업 중 추락 재해사례",
      "지게차 후진 중 보행자 충돌 재해사례",
      "용접 불티에 의한 화재 재해사례"
    ]);
  });

  it("prioritizes simultaneous lifting and hot-work cross-risk over a logistics site label", () => {
    const cases = selectFallbackAccidentCases(
      "평택 물류창고 증축 현장. 상부에서는 크레인 양중, 하부에서는 배관 화기작업을 동시에 계획하고 있어 낙하물과 불티 교차위험이 있다."
    );
    const surface = JSON.stringify(cases);

    expect(cases).toHaveLength(1);
    expect(cases[0]?.title).toContain("양중·화기 동시작업");
    expect(surface).toMatch(/작업구역과 시간을 분리|출입통제|작업순서/);
    expect(surface).not.toMatch(/지게차 후진|화학물질 노출|기계실 점검|비계 작업/);
  });

  it.each([
    ["물류센터 지게차 상하차 작업", /추락|용접|기계실/],
    ["제조공장 용접 화기작업", /지게차|기계실|세척 작업/],
    ["지하 기계실 감전 점검 작업", /지게차|용접|세척 작업/],
    ["자동화설비 방호장치 정비 작업", /지게차|용접|추락|기계실|세척 작업/],
    ["공장 화학세척 작업", /지게차|용접|기계실/]
  ])("does not mix unrelated fallback industries into explicit work: %s", (question, forbidden) => {
    expect(serializeCases(question)).not.toMatch(forbidden);
  });

  it.each([
    "물류센터 바닥 세척 작업. 화학세제 사용.",
    "지하 기계실 바닥 세척 작업. 화학세제 사용."
  ])("prioritizes genuine chemical-cleaning work at a domain-specific site: %s", (question) => {
    const cases = selectFallbackAccidentCases(question);

    expect(cases[0]?.title).toContain("세척");
    expect(JSON.stringify(cases)).toMatch(/화학|세척|세제/);
  });
});
