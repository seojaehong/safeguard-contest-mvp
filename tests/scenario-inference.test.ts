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

  it.each([
    ["울산 도금공장 탱크 외부 화학세척 작업", "울산"],
    ["평택 물류창고 증축 현장 상하부 동시작업", "평택"],
    ["대전 식품공장 야간 컨베이어 정비", "대전"],
    ["구미 전자부품 공장 자동화설비 정비", "구미"],
    ["제주 리조트 심야 전기설비 긴급복구", "제주"],
  ])("keeps the explicit leading location in the generated site: %s", (question, location) => {
    const scenario = inferScenario(question);

    expect(scenario.siteName).toContain(location);
    expect(scenario.companyName).not.toBe(location);
  });

  it("keeps an excavation job out of a profile matched only by worker attributes", () => {
    const question =
      "도시가스공사 열수송관 굴착공사. 작업자 7명, 외국인 근로자 2명, 신규 투입자 1명, 이동식 크레인과 굴착기 사용, 매설물 확인 필요. 오늘 작업 전 문서팩을 만들어줘.";
    const scenario = inferScenario(question);
    const response = buildMockAskResponse(question, [], "mock", "test");

    expect(scenario.companyName).toBe("도시가스공사");
    expect(scenario.companyType).toBe("건설업");
    expect(scenario.siteName).toContain("굴착");
    expect(scenario.workerCount).toBe(7);
    expect(scenario.specialContext.join(" ")).toContain("외국인 근로자 2명");
    expect(scenario.specialContext.join(" ")).toContain("신규 투입자 1명");
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

  it.each([
    ["안산건설 굴착 작업", "안산건설"],
    ["하남산단관리 굴착 작업", "하남산단관리"],
    ["강원상사 굴착 작업", "강원상사"],
    ["제주개발 굴착 작업", "제주개발"]
  ])("does not infer an embedded region from a company token: %s", (question, companyName) => {
    const scenario = inferScenario(question);

    expect(scenario.companyName).toBe(companyName);
    expect(scenario.siteName).toBe(`${companyName} 열수송관 굴착공사 현장`);
  });

  it.each([
    ["안산 굴착 작업", "경기 안산"],
    ["광주 하남산단 굴착 작업", "광주 하남산단"],
    ["강원 굴착 작업", "강원"],
    ["제주 굴착 작업", "제주"],
    ["세종 굴착 작업", "세종"]
  ])("preserves a standalone excavation location: %s", (question, location) => {
    const scenario = inferScenario(question);

    expect(scenario.companyName).toBe("현장 업체");
    expect(scenario.siteName).toBe(`${location} 열수송관 굴착공사 현장`);
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

  it("keeps an electrical distribution-board inspection out of generic maintenance", () => {
    const question =
      "세이프전기 부산 해운대 상가 정전전로 인근 배전반 점검 작업. 작업자 3명, 절연보호구와 검전 필요. 위험성평가와 TBM을 만들어줘.";
    const scenario = inferScenario(question);
    const response = buildMockAskResponse(question, [], "mock", "test");

    expect(scenario.companyName).toBe("세이프전기");
    expect(scenario.companyType).toBe("전기설비 점검");
    expect(scenario.workSummary).toContain("정전전로 인근 배전반 점검 작업");
    expect(scenario.profile.workName).toBe("정전전로 인근 배전반 점검 작업");
    expect(scenario.profile.hazards.join(" ")).toMatch(/정전전로|배전반|검전|감전/);
    expect(scenario.profile.hazards.join(" ")).not.toContain("비정형 작업 절차 미확정");

    const documentSurface = [
      response.deliverables.riskAssessmentDraft,
      response.deliverables.tbmBriefing,
      response.deliverables.kakaoMessage
    ].join("\n");
    expect(documentSurface).toContain("정전전로");
    expect(documentSurface).toContain("배전반");
    expect(documentSurface).toContain("검전");
    expect(documentSurface).toContain("절연보호구");
    expect(documentSurface).not.toContain("비정형 유지보수 작업");
  });

  it.each([
    {
      label: "chemical identity",
      question: "울산 도금공장 화학세척 작업. 용기 라벨 훼손, SDS와 GHS 경고표지 확인 전 작업 보류 필요.",
      expected: /SDS.*GHS.*작업 보류|SDS.*GHS.*사용 금지/,
    },
    {
      label: "simultaneous work",
      question: "상부 크레인 양중과 하부 화기 동시작업. 작업구역 분리와 공정 순서 조정, 신호수 필요.",
      expected: /작업구역.*분리.*출입 통제.*작업순서/,
    },
    {
      label: "vulnerable workers",
      question: "야간 컨베이어 정비. 고령 작업자, 청각장애 작업자, 신규 작업자가 함께 작업.",
      expected: /청각장애.*시각 신호.*복창/,
    },
    {
      label: "KOSHA guidance boundary",
      question: "방호장치 정비. KOSHA Guide는 기술지침으로 참고하고 법령 적용 여부는 별도 확인.",
      expected: /KOSHA Guide.*기술지침.*법령.*별도 확인/,
    },
    {
      label: "overnight handover",
      question: "심야 전기설비 복구. 야간조 2명, 단독작업 전환 위험, 교대 인수인계와 재통전 확인 필요.",
      expected: /2인 1조.*인수인계.*재통전/,
    },
  ])("preserves explicit high-risk signals for $label", ({ question, expected }) => {
    const response = buildMockAskResponse(question, [], "mock", "test");
    const surface = [
      response.deliverables.workpackSummaryDraft,
      response.deliverables.riskAssessmentDraft,
      response.deliverables.workPlanDraft,
      response.deliverables.tbmBriefing,
      response.deliverables.safetyEducationRecordDraft,
    ].join("\n");

    expect(surface).toMatch(expected);
    expect(surface).not.toContain("KOSHA 가이드는 법적 의무입니다");
  });

  it.each([
    {
      label: "press maintenance",
      question: "창원 자동차부품 공장 프레스 설비 보전. 끼임, 예기치 않은 기동, LOTO 필요, 신규 보전원 포함.",
      expectedProcess: /프레스 설비 보전/,
      forbiddenProcess: /배수펌프|지하 기계실/,
    },
    {
      label: "night conveyor maintenance",
      question: "대전 식품공장 야간 컨베이어 정비. 고령 작업자 1명, 청각장애 작업자 1명, 신규 작업자 1명이 포함되고 조도가 낮다.",
      expectedProcess: /컨베이어.*정비/,
      forbiddenProcess: /비정형 유지보수/,
    },
    {
      label: "automated equipment guard maintenance",
      question: "구미 전자부품 공장 자동화설비 방호장치 개선과 정비 작업. 끼임과 예기치 않은 기동을 다뤄줘.",
      expectedProcess: /자동화설비.*방호장치/,
      forbiddenProcess: /비정형 유지보수/,
    },
  ])("grounds structured risk row fields for $label", ({ question, expectedProcess, forbiddenProcess }) => {
    const response = buildMockAskResponse(question, [], "mock", "test");
    const rows = response.structured?.riskAssessmentRows ?? [];

    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => expectedProcess.test(row.process))).toBe(true);
    expect(rows.every((row) => !forbiddenProcess.test(row.process))).toBe(true);
    expect(rows[0]?.task).toMatch(expectedProcess);
  });

  it("keeps scaffold assembly out of the exterior-painting work identity", () => {
    const response = buildMockAskResponse(
      "서울 건설현장 이동식 비계 조립과 해체 작업. 비계 구조, 안전난간, 작업발판과 추락 위험을 반영해줘.",
      [],
      "mock",
      "test"
    );
    const rows = response.structured?.riskAssessmentRows ?? [];

    expect(rows).toHaveLength(3);
    expect(rows.every((row) => /비계 조립·해체/.test(row.process))).toBe(true);
    expect(rows.every((row) => !/외벽 도장/.test(`${row.process} ${row.task}`))).toBe(true);
    expect(rows.map((row) => row.hazard).join(" ")).toMatch(/추락.*전도.*낙하/);
  });
});
