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
      summary: "프레스 방호장치, 가동부, 정비 전 전원 차단과 잠금표지를 확인한다.",
      keywords: ["프레스", "방호장치", "전원차단", "잠금표지"],
      risk_tags: ["협착"],
      controls: ["방호덮개 설치", "정비 전 전원 차단 및 잠금표지", "비상정지장치 확인"]
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

  it("rejects electrostatic-only painting evidence and preserves explicit forklift traffic evidence", () => {
    const query = [
      "세이프건설 서울 성수동 근린생활시설 외벽 도장 작업.",
      "이동식 비계를 사용하고 작업자 5명 중 신규 투입자 1명이 포함된다.",
      "오후 강풍 예보가 있으며 자재 반입 지게차 동선과 작업자 통행 동선이 겹친다."
    ].join(" ");
    const exteriorPainting = reference({
      id: "exterior-painting",
      category: "건설안전분야",
      subcategory: "기술지원규정",
      title: "D-C-13-2026 외벽도장보수공사에 안전작업에 관한 기술지원규정",
      summary: "외벽 도장 보수공사의 비계, 추락방지, 작업발판 안전 기준",
      keywords: ["외벽도장", "비계", "추락"],
      risk_tags: ["추락", "비계"],
      controls: ["가동부 방호덮개와 비상정지장치 확인", "정비 전 전원 차단 및 잠금표지"]
    });
    const electrostaticPainting = reference({
      id: "electrostatic-painting",
      category: "전기안전분야",
      subcategory: "기술지원규정",
      title: "B-E-20-2026 정전도장기 제작 및 설치에 관한 기술지원규정",
      summary: "정전도장기의 정전기 방전과 도료 증기 점화 방지 기준",
      keywords: ["정전도장", "정전기", "접지"],
      risk_tags: ["화재", "폭발"],
      controls: ["정전도장기 접지", "방폭형 환기설비 가동"]
    });
    const forkliftTraffic = reference({
      id: "forklift-traffic",
      category: "운반하역",
      subcategory: "지게차",
      title: "지게차와 보행자 교차 동선 충돌 예방 기준",
      summary: "자재 반입 지게차와 작업자 통행 동선을 분리하고 신호수를 배치한다.",
      keywords: ["지게차", "보행자", "동선", "충돌"],
      risk_tags: ["충돌"],
      controls: ["지게차 동선과 보행 동선 분리", "신호수 배치 및 후진 경보 확인"]
    });

    const ids = filterAndRankSafetyReferencesByQuery(
      query,
      [electrostaticPainting, exteriorPainting, forkliftTraffic],
      3
    ).map((item) => item.id);

    expect(ids).toEqual(expect.arrayContaining(["exterior-painting", "forklift-traffic"]));
    expect(ids).not.toContain("electrostatic-painting");
  });

  it("keeps multiple explicit risk domains instead of filling the result with one repeated domain", () => {
    const query = "외벽 도장 작업, 이동식 비계, 강풍, 지게차와 작업자 동선 중첩";
    const trafficReferences = ["traffic-1", "traffic-2", "traffic-3"].map((id) => reference({
      id,
      category: "운반하역",
      subcategory: "지게차",
      title: `${id} 지게차 보행자 동선 충돌 예방`,
      summary: "지게차와 보행자 동선을 분리하고 신호수를 배치한다.",
      keywords: ["지게차", "보행자", "동선", "충돌"],
      risk_tags: ["충돌"],
      controls: ["지게차 동선과 보행 동선 분리", "신호수 배치"]
    }));
    const exteriorPainting = reference({
      id: "exterior-painting",
      category: "건설안전분야",
      title: "D-C-13-2026 외벽도장보수공사 안전작업",
      summary: "이동식 비계 작업발판과 안전난간, 강풍 작업중지 기준",
      keywords: ["외벽도장", "비계", "추락", "강풍"],
      risk_tags: ["추락", "비계"],
      controls: ["비계 작업발판·난간 확인", "강풍 시 작업중지"]
    });
    const paintFire = reference({
      id: "paint-fire",
      category: "화재폭발",
      title: "B-E-17-2026 도장 공정 화재·폭발 예방",
      summary: "도료와 유기용제 증기 점화 방지 기준",
      keywords: ["도장", "도료", "유기용제"],
      risk_tags: ["화재", "폭발"],
      controls: ["환기 실시", "점화원 통제"]
    });

    const ids = filterAndRankSafetyReferencesByQuery(
      query,
      [...trafficReferences, exteriorPainting, paintFire],
      3
    ).map((item) => item.id);

    expect(ids).toEqual(expect.arrayContaining(["exterior-painting", "paint-fire"]));
    expect(ids.filter((id) => id.startsWith("traffic-"))).toHaveLength(1);
  });

  it("uses the forklift-specific official reference as the traffic representative", () => {
    const query = "외벽 도장 작업, 이동식 비계 사용, 오후 강풍, 자재 반입 지게차 동선과 작업자 통행 동선 중첩";
    const broadConstructionEquipment = reference({
      id: "broad-construction-equipment",
      category: "건설안전분야",
      title: "D-C-10-2026 이동식크레인·항타기·타워크레인 작업계획서 작성",
      summary: "건설장비 작업계획서와 이동식크레인 고소작업 기준",
      keywords: ["크레인", "지게차", "고소"],
      risk_tags: ["크레인", "지게차"],
      controls: [
        "작업발판·난간·개구부 상태 확인",
        "안전대 체결 및 작업반경 출입통제",
        "가동부 방호덮개와 비상정지장치 확인",
        "정비 전 전원 차단 및 잠금표지",
        "보행자 동선과 장비 동선 분리",
        "신호수 배치 및 후진 경보 확인"
      ],
      evidence_role: "direct"
    });
    const forkliftOfficial = reference({
      id: "forklift-official",
      category: "기계안전분야",
      title: "B-M-11-2025 지게차의 안전작업에 관한 기술지원규정",
      summary: "지게차 운행과 보행자 충돌 예방 기준",
      keywords: ["지게차", "보행자", "동선"],
      risk_tags: ["지게차", "충돌"],
      controls: ["지게차 동선과 보행 동선 분리", "신호수 배치 및 후진 경보 확인"],
      evidence_role: "direct"
    });

    const ranked = filterAndRankSafetyReferencesByQuery(
      query,
      [broadConstructionEquipment, forkliftOfficial],
      2
    );

    expect(ranked[0]?.id).toBe("forklift-official");
  });
});
