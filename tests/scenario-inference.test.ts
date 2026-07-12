import { describe, expect, it } from "vitest";

import { buildMockAskResponse, inferScenario } from "@/lib/mock-data";

describe("inferScenario", () => {
  it("classifies an explicit '제조공장' site as 제조업, not 물류업, even when action verbs like 상하차 co-occur", () => {
    const scenario = inferScenario(
      "안산 제조공장 용접 및 지게차 상하차 작업, 외국인 근로자 3명 포함 작업자 6명"
    );
    expect(scenario.companyType).toBe("제조업");
  });

  it("does not misread a bare place name (안산) as the company name", () => {
    const scenario = inferScenario(
      "안산 제조공장 용접 및 지게차 상하차 작업, 외국인 근로자 3명 포함 작업자 6명"
    );
    expect(scenario.companyName).not.toBe("안산");
  });

  it("keeps 물류업 classification for an explicit 물류센터 with 상하차 work", () => {
    const scenario = inferScenario("성수동 물류센터 상하차 작업");
    expect(scenario.companyType).toBe("물류업");
  });

  it("classifies an apartment exterior painting job as 건설업", () => {
    const scenario = inferScenario("아파트 외벽 도장 공사");
    expect(scenario.companyType).toBe("건설업");
  });

  it("preserves an explicitly named company from the question", () => {
    const scenario = inferScenario("그린메탈 공장에서 용접 작업, 작업자 5명");
    expect(scenario.companyName).toBe("그린메탈");
  });

  it("keeps an excavation job out of a profile matched only by worker attributes", () => {
    const question =
      "도시가스공사 열수송관 굴착공사. 작업자 7명, 외국인 근로자 2명, 신규 투입자 1명, 이동식 크레인과 굴착기 사용, 매설물 확인 필요. 오늘 작업 전 문서팩을 만들어줘.";
    const scenario = inferScenario(question);
    const response = buildMockAskResponse(question, [], "mock", "test");

    expect(scenario.companyName).toBe("도시가스공사");
    expect(scenario.companyType).toBe("건설업");
    expect(scenario.siteName).toContain("굴착");
    expect(scenario.siteName).not.toContain("광주 하남산단");
    expect(scenario.profile.workName).toContain("굴착");
    expect(scenario.profile.hazards.join(" ")).toMatch(/붕괴|매몰/);
    expect(scenario.profile.hazards.join(" ")).toContain("매설물");
    expect(scenario.weatherNote).not.toContain("화학물질");
    expect(response.deliverables.riskAssessmentDraft).toContain("굴착면 붕괴");
    expect(response.deliverables.riskAssessmentDraft).not.toContain("화학세제");
    expect(JSON.stringify(response.externalData.accidentCases)).not.toMatch(/화학|세척|세제/);
  });

  it.each([
    "굴착기 정비 작업",
    "열수송관 밸브 점검 작업"
  ])("keeps equipment or service maintenance outside excavation: %s", (question) => {
    const scenario = inferScenario(question);

    expect(scenario.profile.id).toBe("custom-maintenance");
    expect(scenario.profile.workName).not.toContain("굴착공사");
  });

  it.each([
    "열수송관 굴착공사",
    "굴착 작업",
    "도로 굴착 보수 작업",
    "터파기 작업"
  ])("selects excavation only from excavation work identity: %s", (question) => {
    const scenario = inferScenario(question);

    expect(scenario.profile.id).toBe("construction-excavation");
    expect(scenario.profile.workName).toContain("굴착");
  });

  it.each([
    "굴착공사 작업자 5명",
    "보수공사 배수펌프 점검 작업"
  ])("does not infer a work descriptor as the company name: %s", (question) => {
    const scenario = inferScenario(question);

    expect(scenario.companyName).not.toMatch(/^(굴착|보수)공사$/);
  });

  it("preserves a top-level region in an excavation site name", () => {
    const scenario = inferScenario("세종 열수송관 굴착공사");

    expect(scenario.siteName).toContain("세종");
    expect(scenario.siteName).toContain("굴착");
  });

  it("does not let the canonical Gwangju cleaning location overwrite excavation identity", () => {
    const excavation = inferScenario("광주 하남산단 열수송관 굴착공사");
    const cleaning = inferScenario("클린온 광주 하남산단 공장 바닥 세척 작업. 화학세제 사용.");

    expect(excavation.companyName).not.toBe("굴착공사");
    expect(excavation.siteName).toContain("광주 하남산단");
    expect(excavation.siteName).toContain("굴착");
    expect(excavation.siteName).not.toMatch(/^굴착공사/);
    expect(excavation.siteName).not.toContain("청소");
    expect(cleaning.siteName).toBe("광주 하남산단 청소 현장");
  });

  it("still selects the chemical-cleaning profile from work identity terms", () => {
    const scenario = inferScenario(
      "클린온 공장 바닥 세척 작업. 외국인 근로자 3명, 화학세제 사용과 환기 제한, 미끄럼 위험."
    );

    expect(scenario.profile.id).toBe("cleaning-chemical");
    expect(scenario.companyType).toBe("서비스업");
    expect(scenario.profile.hazards.join(" ")).toContain("화학세제");
  });
});
