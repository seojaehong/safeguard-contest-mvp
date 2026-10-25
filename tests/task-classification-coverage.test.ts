import { describe, expect, it } from "vitest";

import { buildMockAskResponse, inferScenario } from "@/lib/mock-data";
import { runAsk } from "@/lib/search";

// 2026-10-25 런칭 깊이 점검 커버리지 30문항(scratch-audit/coverage/cases.ts) + 운영 full 4문항.
// 합성 질문이다(실명·실사업장 아님). 기대값은 「작업 유형」 또는 「작업 유형 확인 필요(review_required)」다.
// 목표는 34/34 분류가 아니라 「틀린 작업 문서 0건」이다(결정 1: 미분류 시 보류).
type CoverageCase = {
  id: string;
  q: string;
  task: string; // taskId 또는 "review_required"
  first?: RegExp; // 1행 위험요인
  rows?: RegExp; // 1~3행 각각이 맞아야 하는 작업 특이 위험
  forbidden?: RegExp; // 1~3행(위험요인+공정)에 나오면 안 되는 다른 작업의 낱말
  companyType?: string;
};

const CASES: CoverageCase[] = [
  { id: "roof-slate", q: "경기 화성 공장 지붕 슬레이트 교체 작업, 작업자 4명, 채광창 있음", task: "roof", first: /지붕.*추락|추락/, rows: /지붕|추락|낙하|채광창|슬레이트/, forbidden: /비계 승|외벽 도장|지게차/ },
  { id: "injection-mold", q: "인천 플라스틱 사출공장 사출성형기 금형 청소 작업, 작업자 2명", task: "machine-isolation", first: /끼임|불시|기동/, rows: /끼임|기동|운전|가열|화상|방호/, forbidden: /화학세제|젖은 바닥|용접/ },
  { id: "conveyor-jam", q: "충북 식품공장 컨베이어 벨트에 걸린 이물 제거 작업, 야간조 3명", task: "conveyor", first: /컨베이어.*(끼임|말려)|말려|끼임/, rows: /컨베이어|끼임|말려|기동|비상정지/, forbidden: /비정형 작업 절차|감전·오조작/ },
  { id: "forklift-dc", q: "이천 물류센터 지게차 팔레트 하역 작업, 작업자 6명", task: "forklift-logistics", first: /지게차/, rows: /지게차|낙하|동선|충돌|적재/, forbidden: /비계|용접/ },
  { id: "tower-crane", q: "부산 아파트 건설현장 타워크레인 철골 양중 작업, 신호수 2명", task: "crane-lifting", first: /인양|양중|낙하/, rows: /인양|양중|낙하|크레인|신호|전도|줄걸이/, forbidden: /이동식 비계|외벽 도장|지게차 동선/ },
  { id: "manhole", q: "수원 하수관로 맨홀 내부 준설 작업, 밀폐공간, 작업자 3명", task: "confined-space", first: /산소|질식|유해가스/, rows: /산소|질식|유해가스|감시인|구출|구조|밀폐/, forbidden: /배수펌프|지하 기계실/ },
  { id: "chem-flange", q: "울산 화학공장 반응기 배관 플랜지 교체 작업, 인화성 물질 잔류 가능", task: "chemical-handling", first: /인화성|잔류|누출|화재|폭발/, rows: /인화성|잔류|누출|화재|폭발|점화원|노출|잔압|분출/, forbidden: /화학세제|젖은 바닥/ },
  { id: "hv-panel", q: "대전 빌딩 지하 수전반 차단기 교체 작업, 전기 작업자 2명", task: "electrical", first: /감전|전로|충전/, rows: /감전|전로|충전|검전|통전|화상/ },
  { id: "water-trench", q: "광주 상수도관 터파기 작업, 깊이 3m, 굴착기 1대", task: "excavation", first: /붕괴|매몰/, rows: /붕괴|매몰|매설물|굴착기|충돌/, forbidden: /열수송관/ },
  { id: "asphalt-heat", q: "세종 도로 아스팔트 포장 작업, 폭염 경보, 작업자 12명", task: "road-paving", first: /아스팔트|포장|롤러|건설기계|온열/, rows: /아스팔트|포장|롤러|피니셔|건설기계|화상|온열|차량/, forbidden: /고중량 박스|창고/ },
  { id: "demolition", q: "서울 노후 주택 철거 해체 작업, 굴착기 1대, 작업자 5명", task: "review_required" },
  { id: "scissor-lift", q: "평택 반도체 공장 천장 배관 설치, 시저형 고소작업대 사용", task: "aerial-work-platform", first: /고소작업대|추락|끼임/, rows: /고소작업대|추락|끼임|전도|협착|과상승/, forbidden: /누수|천장재/ },
  { id: "logging", q: "강원 산림 벌목 작업, 체인톱 사용, 작업자 4명", task: "review_required" },
  { id: "ship-tank-paint", q: "거제 조선소 선박 블록 탱크 내부 도장 작업, 작업자 4명", task: "confined-space", first: /산소|질식|유해가스/, rows: /산소|질식|유해가스|유기용제|증기|감시인|구출|구조|폭발/, forbidden: /이동식 비계|외벽/ },
  { id: "press-only", q: "창원 금속 프레스 금형 교체 작업, 작업자 3명", task: "press", first: /슬라이드|안전블록|금형/, rows: /슬라이드|안전블록|금형|기동|운전|끼임|낙하/, forbidden: /용접|비산불꽃|흄/ },
  { id: "mobile-crane", q: "김포 이동식 크레인으로 자재 인양 작업, 신호수 1명", task: "crane-lifting", first: /인양|양중|낙하/, rows: /인양|양중|낙하|크레인|신호|전도|아웃트리거|줄걸이/ },
  { id: "food-grinder", q: "식품공장 분쇄기 내부 청소 작업, 작업자 2명", task: "machine-isolation", first: /끼임|불시|기동|말려/, rows: /끼임|기동|운전|말려|칼날|방호|절단/, forbidden: /화학세제|젖은 바닥/ },
  { id: "robot-teach", q: "아산 자동차 부품 산업용 로봇 티칭 작업, 작업자 2명", task: "review_required" },
  { id: "ladder-light", q: "사무실 형광등 교체, 사다리 작업, 작업자 1명", task: "review_required" },
  { id: "dump-truck", q: "건설현장 덤프트럭 후진 토사 반출 작업, 유도자 1명", task: "vehicle-haulage", first: /덤프|후진|충돌|차량/, rows: /덤프|후진|충돌|차량|전도|적재|유도/, forbidden: /비계|외벽 도장/, companyType: "건설업" },
  { id: "formwork", q: "공사장 거푸집 동바리 설치 후 콘크리트 타설 작업", task: "review_required" },
  { id: "tank-weld", q: "탱크 내부 용접 작업, 밀폐공간, 화재감시자 1명", task: "confined-space", first: /산소|질식|유해가스/, rows: /산소|질식|유해가스|용접|불티|화재|감시인|구출|구조/ },
  { id: "ammonia", q: "냉동창고 암모니아 배관 누출 점검 작업, 작업자 2명", task: "chemical-handling", first: /암모니아|누출|급성/, rows: /암모니아|누출|노출|중독|가스|급성|점화원|배관/, forbidden: /고중량 박스|온열/ },
  { id: "manure", q: "경북 양돈농가 분뇨 저장조 청소 작업, 황화수소 우려", task: "confined-space", first: /황화수소|산소|질식/, rows: /산소|질식|황화수소|유해가스|감시인|구출|구조/, forbidden: /화학세제|젖은 바닥/ },
  { id: "elevator-pit", q: "신축 오피스텔 승강기 설치 작업, 승강로 개구부", task: "review_required" },
  { id: "chem-handling", q: "도금공장 염산 희석 투입 작업, 작업자 2명", task: "chemical-handling", first: /염산|부식|화학|비산|노출/, rows: /염산|부식|화학|비산|노출|증기|흡입|희석|혼합/, forbidden: /바닥 세척|화학세제/, companyType: "제조업" },
  { id: "outdoor-heat-construction", q: "건설현장 철근 조립 작업, 폭염 체감 35도, 외국인 근로자 4명", task: "review_required" },
  { id: "crane-wall", q: "외벽 패널 크레인 양중 작업, 작업자 5명", task: "crane-lifting", first: /인양|양중|낙하/, rows: /인양|양중|낙하|크레인|신호|전도|줄걸이|패널/, forbidden: /이동식 비계|외벽 도장/ },
  { id: "forklift-fall", q: "공장 지게차 운행 중 추락 위험 있는 적재 작업", task: "forklift-logistics", first: /지게차/, rows: /지게차|낙하|동선|충돌|적재|전도/ },
  { id: "confined-weld-order", q: "밀폐공간 맨홀 내부 배관 용접 보수", task: "confined-space", first: /산소|질식|유해가스/, rows: /산소|질식|유해가스|용접|불티|화재|감시인|구출|구조/ },
  // 운영 full 4문항
  { id: "full-excavation", q: "서울 강서구 도시가스 배관 굴착공사. 굴착 깊이 2.5m, 굴착기 1대와 이동식 크레인 1대, 작업자 8명, 매설물 확인 필요, 오후 강풍 예보. 오늘 작업 전 문서팩을 만들어줘.", task: "excavation", first: /붕괴|매몰/, rows: /붕괴|매몰|매설물|굴착기|크레인|충돌/, forbidden: /열수송관/ },
  { id: "full-confined", q: "부산 해운대 상가건물 지하 정화조 청소 작업. 밀폐공간 진입, 작업자 3명, 외부 협력업체 소속, 산소·황화수소 측정 필요. 오늘 작업 전 문서팩을 만들어줘.", task: "confined-space", first: /산소|황화수소|질식/, rows: /산소|질식|황화수소|유해가스|감시인|구출|구조/, forbidden: /전기판넬|감전|누수 구간/ },
  { id: "full-logistics-heat", q: "대구 달서구 물류창고 상하차 작업. 폭염(체감 34도), 작업자 10명 중 고령자 2명, 컨베이어와 핸드파렛트 사용. 오늘 작업 전 문서팩을 만들어줘.", task: "manual-loading-heat", first: /온열|폭염/, rows: /온열|폭염|고중량|운반|허리|충돌|컨베이어|핸드파렛트/, forbidden: /컨베이어 정비|LOTO/ },
  { id: "full-press", q: "경기 안산 금속부품 제조공장 프레스 금형 교체 작업. 작업자 6명 중 외국인 근로자 2명(베트남어), 신규 투입자 1명. 지게차로 금형 운반, 상하차 포함. 오늘 작업 전 문서팩을 만들어줘.", task: "press", first: /슬라이드|안전블록|금형/, rows: /슬라이드|안전블록|금형|기동|운전|끼임|낙하|운반/, forbidden: /용접|비산불꽃|흄/, companyType: "제조업" }
];

describe("task-first classification coverage fixture (PR-02)", () => {
  it.each(CASES)("$id → $task", (c) => {
    const scenario = inferScenario(c.q);
    const response = buildMockAskResponse(c.q, [], "mock", "test");
    const classification = response.scenario.taskClassification;

    expect(scenario.taskClassification.status).toBe(c.task === "review_required" ? "review_required" : "classified");
    expect(classification?.status).toBe(scenario.taskClassification.status);

    if (c.task === "review_required") {
      expect(scenario.taskClassification.taskId).toBeNull();
      // 미분류 작업은 「비정형」 상투 행을 정상 문서로 내지 않는다.
      expect(response.structured?.riskAssessmentRows ?? []).toHaveLength(0);
      const surface = Object.values(response.deliverables).filter((value) => typeof value === "string").join("\n");
      expect(surface).not.toContain("비정형 작업 절차 미확정");
      expect(response.deliverables.riskAssessmentDraft).toContain("작업 유형 확인 필요");
      return;
    }

    expect(scenario.taskClassification.taskId).toBe(c.task);
    const rows = response.structured?.riskAssessmentRows ?? [];
    expect(rows.length).toBeGreaterThanOrEqual(3);
    const top = rows.slice(0, 3);
    if (c.first) expect(top[0].hazard).toMatch(c.first);
    if (c.rows) top.forEach((row) => expect(row.hazard).toMatch(c.rows as RegExp));
    if (c.forbidden) {
      top.forEach((row) => expect(`${row.hazard} ${row.process}`).not.toMatch(c.forbidden as RegExp));
    }
    if (c.companyType) expect(scenario.companyType).toBe(c.companyType);
    expect(top.map((row) => row.hazard).join(" ")).not.toContain("비정형 작업 절차 미확정");
  });
});

describe("task profile legal pairs (PR-03)", () => {
  const pairOf = (q: string) => {
    const response = buildMockAskResponse(q, [], "mock", "test");
    return (response.structured?.riskAssessmentRows ?? []).map((row) => ({ hazard: row.hazard, action: row.additionalControls }));
  };

  it("keeps hazards[i] and actions[i] paired by construction (no index shift)", () => {
    const scenario = inferScenario("방호장치 정비. KOSHA Guide는 기술지침으로 참고하고 법령 적용 여부는 별도 확인.");
    expect(scenario.profile.pairs.length).toBe(scenario.profile.hazards.length);
    scenario.profile.pairs.forEach((pair, index) => {
      expect(scenario.profile.hazards[index]).toBe(pair.hazard);
      expect(scenario.profile.actions[index]).toBe(pair.action);
    });
  });

  it("press die change carries 안전블록(제104조) on the slide row and 운전정지·잠금(제92조) on the start-up row", () => {
    const rows = pairOf("창원 금속 프레스 금형 교체 작업, 작업자 3명");
    const slide = rows.find((row) => /슬라이드/.test(row.hazard));
    const startUp = rows.find((row) => /기동|운전/.test(row.hazard) && !/슬라이드/.test(row.hazard));
    expect(slide?.action).toMatch(/안전블록/);
    expect(startUp?.action).toMatch(/운전.*정지|기동장치.*잠금|잠금/);
    expect(JSON.stringify(rows)).not.toMatch(/용접|화기/);
  });

  it("confined space puts measurement on row 1 and the watcher/rescue rows next", () => {
    const rows = pairOf("부산 해운대 상가건물 지하 정화조 청소 작업. 밀폐공간 진입, 산소·황화수소 측정 필요.");
    expect(rows[0].hazard).toMatch(/산소|황화수소/);
    expect(rows[0].action).toMatch(/측정/);
    expect(rows[0].action).toMatch(/송기마스크|환기/);
    expect(rows.map((row) => row.action).join(" ")).toMatch(/감시인/);
    expect(rows.map((row) => row.action).join(" ")).toMatch(/구출|대피/);
  });

  it("excavation pairs collapse with slope/shoring and buried utilities with survey, without a fixed 열수송관 site", () => {
    const q = "서울 강서구 도시가스 배관 굴착공사. 굴착 깊이 2.5m, 굴착기 1대와 이동식 크레인 1대, 작업자 8명, 매설물 확인 필요.";
    const scenario = inferScenario(q);
    const rows = pairOf(q);
    const collapse = rows.find((row) => /붕괴|매몰/.test(row.hazard));
    const utility = rows.find((row) => /매설물/.test(row.hazard));
    expect(collapse?.action).toMatch(/기울기|흙막이/);
    expect(utility?.action).toMatch(/도면|탐사|시험굴착/);
    expect(scenario.siteName).not.toContain("열수송관");
    expect(scenario.profile.workName).not.toContain("열수송관");
    expect(scenario.profile.workName).toContain("도시가스 배관");
  });

  it("does not mention a crane in excavation rows when the question has no crane", () => {
    const rows = pairOf("광주 상수도관 터파기 작업, 깊이 3m, 굴착기 1대");
    expect(JSON.stringify(rows)).not.toContain("크레인");
  });

  it("adds the 체감 33도 heat layer (2시간 이내 20분 이상 휴식) on top of the loading task", () => {
    const q = "대구 달서구 물류창고 상하차 작업. 폭염(체감 34도), 작업자 10명 중 고령자 2명, 컨베이어와 핸드파렛트 사용.";
    const rows = pairOf(q);
    const heat = rows.find((row) => /체감온도|폭염/.test(row.hazard));
    expect(heat?.action).toMatch(/2시간/);
    expect(heat?.action).toMatch(/20분/);
    expect(heat?.action).toMatch(/33도|체감온도/);
    expect(heat?.action).toMatch(/119|소방/);
    expect(rows.map((row) => row.hazard).join(" ")).toMatch(/고중량|운반/);
    const response = buildMockAskResponse(q, [], "mock", "test");
    expect(response.deliverables.workPlanDraft).not.toContain("컨베이어 정비");
  });

  it("adds the heat layer to a non-heat task instead of replacing it", () => {
    const rows = pairOf("창원 금속 프레스 금형 교체 작업, 폭염 체감 35도");
    expect(rows[0].hazard).toMatch(/슬라이드|금형/);
    expect(rows.some((row) => /20분/.test(row.action))).toBe(true);
  });

  it("adds foreign and new worker layers as extra rows after the task rows", () => {
    const rows = pairOf("경기 안산 금속부품 제조공장 프레스 금형 교체 작업. 작업자 6명 중 외국인 근로자 2명(베트남어), 신규 투입자 1명.");
    expect(rows.slice(0, 3).every((row) => !/외국인|신규/.test(row.hazard))).toBe(true);
    expect(rows.some((row) => /외국인/.test(row.hazard))).toBe(true);
    expect(rows.some((row) => /신규/.test(row.hazard))).toBe(true);
  });

  it("routes press education away from the welding course", () => {
    const scenario = inferScenario("경기 안산 금속부품 제조공장 프레스 금형 교체 작업. 외국인 근로자 2명, 신규 투입자 1명.");
    expect(scenario.profile.educationName).not.toMatch(/용접|화기/);
    expect(scenario.profile.educationName).toMatch(/프레스|금형/);
    expect(scenario.profile.educationTargets).toMatch(/외국인/);
    expect(scenario.profile.educationTargets).toMatch(/신규/);
  });

  it("routes confined-space emergency and education to the confined profile", () => {
    const response = buildMockAskResponse("부산 해운대 상가건물 지하 정화조 청소 작업. 밀폐공간 진입, 산소·황화수소 측정 필요.", [], "mock", "test");
    expect(response.deliverables.safetyEducationRecordDraft).toMatch(/밀폐공간/);
    expect(response.deliverables.safetyEducationRecordDraft).not.toMatch(/감전 예방 교육/);
    expect(response.deliverables.emergencyResponseDraft).toMatch(/산소|황화수소|질식/);
    expect(response.deliverables.emergencyResponseDraft).toMatch(/송기마스크|공기호흡기/);
    expect(response.riskSummary.riskLevel).toBe("상");
  });

  it("does not let the 제조공장 industry noun force the welding profile", () => {
    const scenario = inferScenario("안산 제조공장 지게차 상하차 작업, 작업자 6명");
    expect(scenario.companyType).toBe("제조업");
    expect(scenario.profile.hazards.join(" ")).not.toMatch(/용접|비산불꽃/);
  });
});

describe("review-required hold through runAsk (decision 1)", () => {
  it("flags an unclassified task in template mode and keeps classified tasks generating", async () => {
    const held = await runAsk("강원 산림 벌목 작업, 체인톱 사용, 작업자 4명", { aiMode: "template" });
    expect(held.scenario.taskClassification?.status).toBe("review_required");
    expect(held.structured?.riskAssessmentRows ?? []).toHaveLength(0);
    expect(held.qualityContract?.items.find((item) => item.key === "taskClassification")?.status).toBe("blocked");

    const heldEnhanced = await runAsk("강원 산림 벌목 작업, 체인톱 사용, 작업자 4명", { aiMode: "enhanced" });
    expect(heldEnhanced.scenario.taskClassification?.status).toBe("review_required");
    expect(heldEnhanced.structured?.riskAssessmentRows ?? []).toHaveLength(0);
    expect(heldEnhanced.riskSummary.title).toBe("작업 유형 확인 필요");

    const ok = await runAsk("창원 금속 프레스 금형 교체 작업, 작업자 3명", { aiMode: "template" });
    expect(ok.scenario.taskClassification?.status).toBe("classified");
    expect((ok.structured?.riskAssessmentRows ?? [])[0]?.hazard).toMatch(/슬라이드|금형/);
  }, 60000);
});
