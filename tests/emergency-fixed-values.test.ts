import { describe, expect, it } from "vitest";

import { contextBlock, freeFormPrompt, parseFree } from "@/lib/ai-deliverables";
import { companyFilePrefix, formatCompanyName, formatWorkerCount } from "@/lib/scenario-display";
import { buildDisplayTargetWorkers, formatDisplayTargetCount } from "@/lib/workspace";
import { ACCIDENT_REPORT_TEMPLATE } from "@/lib/safety-contacts";
import { buildMockAskResponse, inferScenario, mockSearchResults } from "@/lib/mock-data";

// 운영 4시나리오(2026-10-25 launch-depth-audit ask-full-*.json 의 question 원문).
const PRESS = "경기 안산 금속부품 제조공장 프레스 금형 교체 작업. 작업자 6명 중 외국인 근로자 2명(베트남어), 신규 투입자 1명. 지게차로 금형 운반, 상하차 포함. 오늘 작업 전 문서팩을 만들어줘.";
const EXCAVATION = "서울 강서구 도시가스 배관 굴착공사. 굴착 깊이 2.5m, 굴착기 1대와 이동식 크레인 1대, 작업자 8명, 매설물 확인 필요, 오후 강풍 예보. 오늘 작업 전 문서팩을 만들어줘.";
const CONFINED = "부산 해운대 상가건물 지하 정화조 청소 작업. 밀폐공간 진입, 작업자 3명, 외부 협력업체 소속, 산소·황화수소 측정 필요. 오늘 작업 전 문서팩을 만들어줘.";
const HEAT = "대구 달서구 물류창고 상하차 작업. 폭염(체감 34도), 작업자 10명 중 고령자 2명, 컨베이어와 핸드파렛트 사용. 오늘 작업 전 문서팩을 만들어줘.";
const OPERATIONAL = [PRESS, EXCAVATION, CONFINED, HEAT];

const FIXTURE_COMPANIES = ["그린메탈", "이지시설관리", "대성창고", "세이프건설", "한빛로지스", "클린온", "현장 업체"];

function emergency(question: string) {
  return buildMockAskResponse(question, mockSearchResults.slice(0, 4), "mock", "test").deliverables.emergencyResponseDraft;
}

describe("PR-09 비상대응 법정 보고 (COPY-02·EF-07)", () => {
  it.each(OPERATIONAL)("기본 틀에 중대재해 보고·산업재해조사표·연락망·반기 점검이 있다: %s", (question) => {
    const text = emergency(question);
    expect(text).toContain("지체 없이");
    expect(text).toContain("관할 지방고용노동관서");
    expect(text).toContain("시행규칙 제67조");
    expect(text).toContain("산업재해조사표");
    expect(text).toContain("3일 이상의 휴업");
    expect(text).toContain("1개월 이내");
    expect(text).toContain("시행규칙 제73조");
    expect(text).toContain("사망자가 1명 이상");
    expect(text).toContain("119");
    expect(text).toContain("근로복지공단 1588-0075");
    expect(text).toMatch(/비상연락망/);
    expect(text).toMatch(/집결지/);
    expect(text).toMatch(/반기 1회 이상/);
    expect(text).toMatch(/점검일/);
    // 지역 관서 번호를 지어내지 않는다.
    expect(text).not.toMatch(/0\d{1,2}-\d{3,4}-\d{4}/);
  });

  it("ACCIDENT_REPORT_TEMPLATE 은 보고 대상 요건과 관서의 장을 원문대로 담는다", () => {
    expect(ACCIDENT_REPORT_TEMPLATE).toContain("사업장 소재지를 관할하는 지방고용노동관서의 장");
    expect(ACCIDENT_REPORT_TEMPLATE).toContain("3일 이상의 휴업");
    expect(ACCIDENT_REPORT_TEMPLATE).toContain("법 제57조제3항");
    expect(ACCIDENT_REPORT_TEMPLATE).toContain("발생한 날부터 1개월 이내");
  });
});

describe("PR-09 작업유형별 비상대응 틀 (EF-01·EF-10)", () => {
  it("밀폐공간: 구조 순서·구조훈련·주지사항이 있다", () => {
    const text = emergency(CONFINED);
    expect(text).toContain("송기마스크");
    expect(text).toMatch(/감시인은 밀폐공간에 들어가지 않고/);
    expect(text).toContain("제640조");
    expect(text).toMatch(/6개월에 1회 이상/);
    expect(text).toContain("제641조");
    expect(text).toMatch(/대피용 기구/);
  });

  it("굴착: 매몰 구조와 가스 누출 대응이 있다", () => {
    const text = emergency(EXCAVATION);
    expect(text).toContain("매몰");
    expect(text).toMatch(/가스.{0,10}누출/);
    expect(text).toContain("점화원");
    expect(text).not.toContain("공정안전보고서");
  });

  it("프레스: 끼임 시 비상정지·동력 차단 후 구출", () => {
    const text = emergency(PRESS);
    expect(text).toMatch(/비상정지/);
    expect(text).toMatch(/동력.{0,6}차단/);
  });

  it("폭염: 열사병 의심 시 119 신고(제562조③)", () => {
    const text = emergency(HEAT);
    expect(text).toContain("열사병");
    expect(text).toContain("제562조③");
    expect(text).not.toContain("공정안전보고서");
  });

  it("작업 유형 라벨은 한국어로만 나오고 내부 코드가 없다", () => {
    for (const question of OPERATIONAL) {
      const text = emergency(question);
      expect(text).toMatch(/작업 유형: /);
      expect(text).not.toMatch(/confined-space|manual-loading-heat|excavation|\bpress\b/);
    }
  });
});

describe("PR-09 결정 8: 비상대응·사진증빙은 AI 생성에서 뺀다 (H9)", () => {
  it("free 묶음 프롬프트는 비상대응·사진증빙을 요구하지 않는다", () => {
    const prompt = freeFormPrompt({
      question: "질문",
      scenario: { companyName: "", siteName: "현장", workSummary: "작업", workerCount: 0, weatherNote: "맑음" },
      citationLines: [],
      trainingLines: [],
      koshaLines: [],
      accidentLines: [],
      workDate: "2026-10-25"
    });
    expect(prompt).not.toContain("emergencyResponseDraft");
    expect(prompt).not.toContain("photoEvidenceDraft");
    expect(prompt).toContain("workpackSummaryDraft");
    expect(prompt).toContain("kakaoMessage");
  });

  it("parseFree 는 요약·카톡만 받고 비상대응·사진 본문은 채택하지 않는다", () => {
    const long = "가".repeat(150);
    const out = parseFree(JSON.stringify({
      workpackSummaryDraft: long,
      kakaoMessage: long,
      emergencyResponseDraft: long,
      photoEvidenceDraft: long
    }));
    expect(out).not.toBeNull();
    expect(out).not.toHaveProperty("emergencyResponseDraft");
    expect(out).not.toHaveProperty("photoEvidenceDraft");
    expect(parseFree(JSON.stringify({ workpackSummaryDraft: long, kakaoMessage: long }))).not.toBeNull();
  });
});

describe("PR-15 업체·현장·인원 고정값 제거 (F-COV-06·07·08, EXP-03, EF-12)", () => {
  it.each(OPERATIONAL)("회사명이 없는 질문에 시연용 회사명을 넣지 않는다: %s", (question) => {
    const scenario = inferScenario(question);
    expect(FIXTURE_COMPANIES).not.toContain(scenario.companyName);
    expect(scenario.companyName).toBe("");
    const response = buildMockAskResponse(question, mockSearchResults.slice(0, 4), "mock", "test");
    const all = JSON.stringify(response.deliverables) + response.answer;
    for (const name of FIXTURE_COMPANIES) expect(all).not.toContain(name);
    expect(response.deliverables.emergencyResponseDraft).toContain("업체명: 사업장명 입력 필요");
  });

  it("현장명에 입력에 없는 업종 수식어를 붙이지 않는다(해운대 → 시설관리 없음)", () => {
    expect(inferScenario(CONFINED).siteName).not.toContain("시설관리");
    expect(inferScenario(CONFINED).siteName).toContain("부산 해운대");
    expect(inferScenario(PRESS).siteName).not.toBe("경기 안산 제조공장");
  });

  it("지명이 표에 없으면 다른 도시 현장명을 쓰지 않는다", () => {
    const scenario = inferScenario("이천 물류센터 지게차 상하차 작업");
    expect(scenario.siteName).not.toMatch(/인천|남동공단/);
    expect(scenario.companyName).not.toBe("이천");
  });

  it.each([
    ["건설현장 덤프트럭 토사 반출, 유도자 1명", "건설현장"],
    ["공사장 거푸집 해체 작업", "공사장"],
    ["탱크 내부 용접 작업, 화재감시자 1명", "탱크"],
    ["공장 지게차 하역 작업", "공장"]
  ])("질문 첫 낱말을 회사명으로 쓰지 않는다: %s", (question, firstWord) => {
    expect(inferScenario(question).companyName).not.toBe(firstWord);
  });

  it("역할 인원(유도자·화재감시자 1명)을 작업인원으로 보지 않고, 인원이 없으면 5명으로 채우지 않는다", () => {
    expect(inferScenario("건설현장 덤프트럭 토사 반출, 유도자 1명").workerCount).toBe(0);
    expect(inferScenario("탱크 내부 용접 작업, 화재감시자 1명").workerCount).toBe(0);
    expect(inferScenario("공사장 거푸집 해체 작업").workerCount).toBe(0);
    expect(inferScenario(HEAT).workerCount).toBe(10);
  });

  it("분류되는 작업 + 역할 인원만 있는 질문: 렌더된 문서에 「1명」·「0명」·「5명」 작업인원이 없다", () => {
    const question = "공장 프레스 금형 교체 작업, 유도자 1명";
    expect(inferScenario(question).taskClassification.taskId).toBe("press");
    expect(inferScenario(question).workerCount).toBe(0);
    const response = buildMockAskResponse(question, mockSearchResults.slice(0, 4), "mock", "test");
    const d = response.deliverables;
    expect(d.workpackSummaryDraft).toContain("작업인원: 확인 필요");
    expect(d.workpackSummaryDraft).toContain("입력 필요: 사업장명·총 작업인원");
    const all = [d.workpackSummaryDraft, d.riskAssessmentDraft, d.workPlanDraft, d.workPermitDraft, d.tbmBriefing, d.tbmLogDraft, d.safetyEducationRecordDraft, d.emergencyResponseDraft]
      .filter(Boolean).join("\n");
    expect(all).not.toMatch(/(작업인원|참석인원|참석 대상)[^\n]{0,8}\d+명/);
    expect(all).not.toMatch(/총\s*\d+명/);
    expect(all).not.toMatch(/(?<!\d)0명/);
  });

  it("바람 언급이 없는 질문에 강풍 예보를 붙이지 않는다", () => {
    expect(inferScenario("공사장 거푸집 해체 작업").weatherNote).not.toContain("강풍");
    expect(inferScenario(CONFINED).weatherNote).not.toContain("미끄럼 및 감전");
  });

  it("점검결과 요약의 작업명은 입력 작업을 쓴다(EF-12)", () => {
    const summary = buildMockAskResponse(PRESS, mockSearchResults.slice(0, 4), "mock", "test").deliverables.workpackSummaryDraft;
    expect(summary).toMatch(/작업명: [^\n]*프레스 금형 교체/);
    expect(summary).toContain("업체명: 사업장명 입력 필요");
  });

  it("입력에 회사명이 있으면 그대로 쓴다", () => {
    expect(inferScenario("그린메탈 공장에서 용접 작업, 작업자 5명").companyName).toBe("그린메탈");
    expect(inferScenario("강원상사 굴착 작업").companyName).toBe("강원상사");
  });
});

describe("PR-09 법령 원문 대조 문구 (2026-10-25 법제처 조회)", () => {
  it("밀폐공간 구출: 조문별로 근거를 붙인다(제623조②·제620조·제643조)", () => {
    const text = emergency(CONFINED);
    expect(text).toMatch(/감시인은 밀폐공간에 들어가지 않고[^\n]*제623조②/);
    expect(text).toMatch(/환기를 계속[^\n]*제620조/);
    expect(text).toMatch(/공기호흡기 또는 송기마스크[^\n]*제643조/);
    // 같은 구출 지시를 두 번 싣지 않는다(프로필 초기조치 + 밀폐 추가 확인).
    expect(text.match(/제643조/g)?.length).toBe(1);
    expect(text.match(/제623조/g)?.length).toBe(1);
  });

  it("산업재해조사표 재해자 확인은 「할 수 있다」, 근로자대표 이견은 첨부", () => {
    const text = emergency(PRESS);
    expect(text).toContain("재해자 본인의 확인을 받아 제출할 수 있습니다");
    expect(text).toContain("이견이 있으면 그 내용을 첨부");
  });

  it("중처법 반기 점검 칸에 적용범위(5명 미만 적용 제외, 법 제3조)를 단다", () => {
    const text = emergency(CONFINED);
    expect(text).toMatch(/5명 미만[^\n]*중대재해처벌법 제3조/);
  });

  it("1350 은 고용노동부 고객상담센터로 적는다", () => {
    const text = emergency(HEAT);
    expect(text).toContain("고용노동부 고객상담센터: 1350");
    expect(text).not.toContain("대표전화");
  });
});

describe("PR-15 문서 머리·파일명·AI 프롬프트의 고정값", () => {
  it("표시 함수: 빈 회사명·0명은 입력 요청으로, 파일명은 제목만", () => {
    expect(formatCompanyName("")).toBe("사업장명 입력 필요");
    expect(formatCompanyName("그린메탈")).toBe("그린메탈");
    expect(formatWorkerCount(0)).toBe("확인 필요");
    expect(formatWorkerCount(8)).toBe("8명");
    expect(companyFilePrefix("", "위험성평가표")).toBe("위험성평가표");
    expect(companyFilePrefix("그린메탈", "위험성평가표")).toBe("그린메탈-위험성평가표");
  });

  it("AI 프롬프트 맥락에 빈 회사명·「0명」을 그대로 넘기지 않는다", () => {
    const block = contextBlock({
      question: "공장 프레스 금형 교체 작업, 유도자 1명",
      scenario: { companyName: "", siteName: "프레스 금형 교체 현장(현장명 입력 필요)", workSummary: "프레스 금형 교체 작업", workerCount: 0, weatherNote: "맑음" },
      citationLines: [],
      trainingLines: [],
      koshaLines: [],
      accidentLines: [],
      workDate: "2026-10-25"
    });
    expect(block).not.toMatch(/작업 인원: 0명/);
    expect(block).toMatch(/작업 인원: 입력 없음[^\n]*지어내지 않는다/);
    expect(block).toMatch(/회사: 입력 없음[^\n]*사업장명 입력 필요/);
  });

  it("작업 공유 대상 표시는 인원을 모르면 「1명 기준」으로 채우지 않는다", () => {
    const response = buildMockAskResponse("공장 프레스 금형 교체 작업, 유도자 1명", mockSearchResults.slice(0, 4), "mock", "test");
    expect(formatDisplayTargetCount(response, [])).toBe("인원 확인 필요");
    expect(buildDisplayTargetWorkers(response, []).map((w) => w.displayName)).toContain("작업자 그룹(인원 확인 필요)");
  });
});
