// 비로그인/Supabase 미설정 상태에서도 "경영책임자 방어 파일" 화면이 성립하도록
// 만드는 데모 workpack 2~3건. buildMockAskResponse가 만드는 문서팩과 같은
// deliverables 구조를 재사용해 실제 화면과 동일한 그룹핑 로직을 탄다.

import { documentKeysFromDeliverables, type EvidenceFileWorkpack } from "@/lib/evidence-file";
import { buildMockAskResponse, mockSearchResults } from "@/lib/mock-data";

type DemoScenario = {
  id: string;
  question: string;
  daysAgo: number;
};

const DEMO_SCENARIOS: readonly DemoScenario[] = [
  {
    id: "demo-workpack-seongsu",
    question: [
      "세이프건설 서울 성수동 근린생활시설 외벽 도장 작업.",
      "이동식 비계 사용, 작업자 5명, 신규 투입자 1명, 오후 강풍 예보.",
      "추락과 지게차 동선 위험을 반영해 오늘 위험성평가와 TBM, 안전보건교육 기록을 만들어줘."
    ].join(" "),
    daysAgo: 1
  },
  {
    id: "demo-workpack-namdong",
    question: [
      "인천 남동공단 물류센터 지게차 상하차 작업.",
      "작업자 8명, 야간 조명 부족 구간 있음.",
      "지게차 동선과 끼임 위험을 반영해 위험성평가와 작업계획서를 만들어줘."
    ].join(" "),
    daysAgo: 6
  },
  {
    id: "demo-workpack-haeundae",
    question: [
      "부산 해운대 시설관리 현장 화기작업(용접).",
      "작업자 4명, 외국인 근로자 2명 포함.",
      "화재 위험과 비상대응 매뉴얼을 반영해 TBM과 외국인 근로자용 안전 안내 자료를 만들어줘."
    ].join(" "),
    daysAgo: 13
  }
];

function isoDaysAgo(daysAgo: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return date.toISOString();
}

/**
 * 로그인/Supabase 미설정 상태에서 보여줄 데모 문서팩 목록.
 * 실제 서버 workpack과 같은 EvidenceFileWorkpack 형태로 반환하므로
 * groupEvidenceByArticle에 그대로 넣을 수 있다.
 */
export function buildDemoEvidenceWorkpacks(): EvidenceFileWorkpack[] {
  return DEMO_SCENARIOS.map((scenario) => {
    const response = buildMockAskResponse(
      scenario.question,
      mockSearchResults,
      "mock",
      "SafeClaw 경영책임자 방어 파일 데모 문서팩입니다."
    );

    return {
      id: scenario.id,
      siteName: response.scenario.siteName,
      question: response.question,
      createdAt: isoDaysAgo(scenario.daysAgo),
      documentKeys: documentKeysFromDeliverables(response.deliverables),
      reopenHref: "/workspace"
    };
  });
}
