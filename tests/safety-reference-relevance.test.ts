import { describe, expect, it } from "vitest";

import {
  filterAndRankSafetyReferencesByQuery,
  scoreSafetyReferenceQueryMatch,
  type SafetyReferenceItem
} from "@/lib/safety-reference-catalog";

function reference(overrides: Partial<SafetyReferenceItem> = {}): SafetyReferenceItem {
  return {
    id: "ref-1",
    source_id: "kosha-test",
    item_type: "technical-guideline",
    category: "시설관리",
    subcategory: "밀폐공간",
    title: "밀폐공간 환기 및 산소농도 측정 지침",
    summary: "기계실 배수펌프 점검 전 환기, 산소농도 측정, 감시인 배치, 비상연락설비를 확인한다.",
    keywords: ["밀폐공간", "산소농도", "환기", "배수펌프"],
    risk_tags: ["질식", "감전", "전도"],
    primary_documents: ["위험성평가표", "TBM 브리핑", "TBM 기록"],
    controls: ["환기 후 산소농도 측정", "감시인 외부 배치", "전원 차단 및 잠금표지"],
    ...overrides
  };
}

describe("safety reference relevance guard", () => {
  it("keeps confined-space pump evidence ahead of unrelated direct evidence", () => {
    const query = "부산 해운대 지하 기계실 배수펌프 점검 및 누수 보수, 밀폐공간 진입 전 환기와 산소농도 측정";
    const confinedSpace = reference();
    const crane = reference({
      id: "crane",
      category: "건설기계",
      subcategory: "크레인",
      title: "크레인 안전작업에 관한 기술지원규정",
      summary: "인양작업, 와이어로프, 줄걸이, 신호수 배치를 확인한다.",
      keywords: ["크레인", "인양", "줄걸이"],
      risk_tags: ["낙하", "협착"],
      controls: ["작업반경 통제", "신호수 배치"]
    });
    const press = reference({
      id: "press",
      category: "제조업",
      subcategory: "프레스",
      title: "프레스 위험방지에 관한 기술지원규정",
      summary: "프레스 방호장치와 양수조작식 안전장치를 확인한다.",
      keywords: ["프레스", "방호장치"],
      risk_tags: ["협착"],
      controls: ["방호덮개 설치", "비상정지장치 확인"]
    });

    expect(scoreSafetyReferenceQueryMatch(query, confinedSpace)).toBeGreaterThan(scoreSafetyReferenceQueryMatch(query, crane));
    expect(scoreSafetyReferenceQueryMatch(query, confinedSpace)).toBeGreaterThan(scoreSafetyReferenceQueryMatch(query, press));
    expect(filterAndRankSafetyReferencesByQuery(query, [crane, press, confinedSpace], 3).map((item) => item.id)).toEqual(["ref-1"]);
  });

  it("keeps fall-prevention evidence for scaffold and exterior painting work", () => {
    const query = "서울 성수동 외벽 도장 작업, 이동식 비계 사용, 추락과 지게차 동선 위험";
    const fall = reference({
      id: "fall",
      category: "건설업",
      subcategory: "비계",
      title: "이동식 비계 추락 예방 기준",
      summary: "외벽 도장 중 작업발판, 안전난간, 추락방지 조치, 작업 전 점검을 확인한다.",
      keywords: ["이동식 비계", "추락", "외벽 도장"],
      risk_tags: ["추락"],
      controls: ["안전난간 설치", "작업발판 고정", "작업 전 점검"]
    });
    const vdt = reference({
      id: "vdt",
      category: "사무환경",
      subcategory: "VDT",
      title: "영상표시단말기 사무환경 관리 지침",
      summary: "사무실 조명, 의자, 모니터 배치를 확인한다.",
      keywords: ["VDT", "사무환경"],
      risk_tags: ["근골격계"],
      controls: ["작업대 높이 조정"]
    });

    expect(filterAndRankSafetyReferencesByQuery(query, [vdt, fall], 2).map((item) => item.id)).toEqual(["fall"]);
  });
});
