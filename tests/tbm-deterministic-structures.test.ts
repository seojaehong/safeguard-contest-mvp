import { describe, expect, it } from "vitest";
import {
  buildTbmBriefingStructuredFromRiskRows,
  buildTbmLogStructuredFromRiskRows
} from "@/lib/search";
import type { AskResponse } from "@/lib/types";
import type { RiskAssessmentRow } from "@/lib/risk-assessment-schema";

const scenario: AskResponse["scenario"] = {
  companyName: "세이프건설",
  companyType: "건설업",
  siteName: "서울 성수동 근린생활시설 현장",
  workSummary: "외벽 도장 작업",
  workerCount: 5,
  weatherNote: "오후 강풍 예보"
};

const rows: RiskAssessmentRow[] = [
  {
    location: "외벽 작업구간",
    process: "도장",
    task: "이동식 비계 외벽 도장",
    equipment: "이동식 비계, 안전대",
    hazard: "작업발판 외측 추락 위험",
    fourM: "Machine",
    accidentType: "fall",
    currentControls: "작업 전 난간 상태 확인",
    likelihood: 3,
    severity: 5,
    riskLevel: "high",
    additionalControls: "중간난간 보강 및 안전대 체결 확인",
    owner: "작업반장",
    due: "현장 확인",
    verification: "관리감독자 현장 확인",
    verificationStatus: "planned",
    verificationDate: "현장 확인",
    verificationChecker: "관리감독자",
    whyLikelihood: "이동식 비계와 강풍 조건이 동시에 존재합니다.",
    whySeverity: "추락 시 중대재해 가능성이 큽니다.",
    evidenceRefs: ["KOSHA D-C-13-2026", "사진: before.jpg, after.jpg"]
  },
  {
    location: "자재 반입 동선",
    process: "운반",
    task: "지게차 주변 이동",
    equipment: "지게차, 통제선",
    hazard: "지게차 동선과 작업자 충돌 위험",
    fourM: "Management",
    accidentType: "traffic",
    currentControls: "작업자 동선 안내",
    likelihood: 3,
    severity: 4,
    riskLevel: "high",
    additionalControls: "보행자 동선과 장비 동선 분리",
    owner: "신호수",
    due: "현장 확인",
    verification: "동선 분리 상태 사진 확인",
    verificationStatus: "planned",
    verificationDate: "현장 확인",
    verificationChecker: "관리감독자",
    whyLikelihood: "동선 혼재 가능성이 있습니다.",
    whySeverity: "충돌 시 중상 가능성이 있습니다.",
    evidenceRefs: ["산업안전보건법 제38조"]
  }
];

describe("deterministic TBM structures", () => {
  it("builds TBM briefing cells from fixed risk rows", () => {
    const briefing = buildTbmBriefingStructuredFromRiskRows(scenario, rows, "단시간 흐림, 풍속 1m/s");

    expect(briefing.meta.target).toBe("전 작업자 5명");
    expect(briefing.todayWork.name).toBe("외벽 도장 작업");
    expect(briefing.hazards.map((hazard) => hazard.description)).toEqual([
      "작업발판 외측 추락 위험",
      "지게차 동선과 작업자 충돌 위험"
    ]);
    expect(briefing.measures[0]).toMatchObject({
      hazardRef: 1,
      owner: "작업반장"
    });
    expect(briefing.measures[0].action).toContain("중간난간");
    expect(briefing.confirmTopics).toHaveLength(5);
  });

  it("builds TBM log cells with risk-row references", () => {
    const log = buildTbmLogStructuredFromRiskRows(scenario, rows, "단시간 흐림, 풍속 1m/s");

    expect(log.attendance.expected).toBe(5);
    expect(log.attendance.actual).toBe(5);
    expect(log.hazardsDiscussed[0]).toMatchObject({
      description: "작업발판 외측 추락 위험",
      relatedRiskRowIndex: 0
    });
    expect(log.safetyEducation.materials).toContain("KOSHA D-C-13-2026");
    expect(log.workerConfirmations).toHaveLength(5);
  });
});
