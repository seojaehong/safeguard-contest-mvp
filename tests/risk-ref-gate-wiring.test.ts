import { describe, expect, it } from "vitest";

import {
  applyRiskRowClamp,
  parseTbmBriefingStructured,
  type AiDeliverables
} from "@/lib/ai-deliverables";

function tbmBriefingRaw(measures: Array<{ hazardRef: number; action: string; owner: string }>) {
  return JSON.stringify({
    tbmBriefingStructured: {
      meta: { dateTime: "2026-07-02 09:00", location: "현장", target: "전 작업자 8명", attendees: "출석부 서명" },
      todayWork: { name: "배관 점검", location: "1층", time: "09:00-17:00", equipment: ["공구세트"] },
      hazards: [
        { category: "Man", description: "추락 위험" },
        { category: "Machine", description: "협착 위험" }
      ],
      measures,
      stopCriteria: ["작업중지 기준1", "작업중지 기준2"],
      confirmTopics: ["질문1", "질문2", "질문3"],
      photoEvidenceLocation: "공유 드라이브"
    },
    tbmQuestions: ["q1", "q2", "q3", "q4", "q5"]
  });
}

describe("parseTbmBriefingStructured hazardRef clamp", () => {
  it("keeps in-range 1-based hazardRef unchanged", () => {
    const out = parseTbmBriefingStructured(
      tbmBriefingRaw([
        { hazardRef: 1, action: "안전대책1", owner: "반장" },
        { hazardRef: 2, action: "안전대책2", owner: "반장" }
      ])
    );
    expect(out?.tbmBriefingStructured?.measures.map((m) => m.hazardRef)).toEqual([1, 2]);
  });

  it("clamps out-of-range hazardRef (past hazards.length) to 1", () => {
    const out = parseTbmBriefingStructured(
      tbmBriefingRaw([
        { hazardRef: 5, action: "안전대책1", owner: "반장" },
        { hazardRef: 2, action: "안전대책2", owner: "반장" }
      ])
    );
    expect(out?.tbmBriefingStructured?.measures.map((m) => m.hazardRef)).toEqual([1, 2]);
  });

  it("clamps hazardRef of 0 (non 1-based) to 1", () => {
    const out = parseTbmBriefingStructured(
      tbmBriefingRaw([
        { hazardRef: 0, action: "안전대책1", owner: "반장" },
        { hazardRef: 1, action: "안전대책2", owner: "반장" }
      ])
    );
    expect(out?.tbmBriefingStructured?.measures.map((m) => m.hazardRef)).toEqual([1, 1]);
  });
});

function makeWorkPlan(relatedRiskRowIndex: number[] | undefined): AiDeliverables["workPlanStructured"] {
  return {
    workOverview: {
      workName: "테스트 작업",
      description: "설명",
      workerCount: 5,
      location: "현장",
      condition: "맑음",
      equipment: ["공구"]
    },
    workSteps: [
      {
        stepNo: 1,
        action: "단계1",
        equipment: "공구",
        safetyMeasure: "안전조치",
        owner: "반장",
        relatedRiskRowIndex,
        evidenceRefs: [],
        verification: "확인"
      }
    ],
    stopCriteria: ["기준1", "기준2"],
    emergencyResponse: { contacts: [{ role: "반장", phone: "010" }], evacRoute: "경로", firstAid: "응급조치" },
    approvers: { author: "작성자", reviewer: "검토자", approver: "승인자" }
  };
}

function makeTbmLog(relatedRiskRowIndex: number | undefined): AiDeliverables["tbmLogStructured"] {
  return {
    meta: { dateTime: "2026-07-02", location: "현장", workType: "배관 점검", instructor: "반장" },
    attendance: {
      expected: 8,
      actual: 8,
      attendees: ["홍길동"],
      absenceReason: "없음",
      confirmationMethod: "출석부 서명"
    },
    todayWork: { name: "배관 점검", location: "1층", time: "09:00-17:00", equipment: ["공구"] },
    workerConfirmations: ["확인1", "확인2", "확인3"],
    hazardsDiscussed: [{ category: "Man", description: "추락 위험", relatedRiskRowIndex }],
    safetyEducation: { topic: "낙하물 예방", keyPoints: ["요점1", "요점2"], materials: "KOSHA 지침" },
    unaddressedItems: [],
    photoEvidence: { captureLocations: ["1층"], storagePath: "드라이브" },
    signatures: { author: "작성자", reviewer: "검토자", approver: "승인자" }
  };
}

describe("applyRiskRowClamp", () => {
  it("keeps in-range workPlanStructured relatedRiskRowIndex entries", () => {
    const out: AiDeliverables = {
      structuredRiskRows: [{} as never, {} as never],
      workPlanStructured: makeWorkPlan([0, 1])
    };
    applyRiskRowClamp(out);
    expect(out.workPlanStructured?.workSteps[0].relatedRiskRowIndex).toEqual([0, 1]);
  });

  it("drops out-of-range and duplicate workPlanStructured indices using the merged row count", () => {
    const out: AiDeliverables = {
      structuredRiskRows: [{} as never, {} as never],
      workPlanStructured: makeWorkPlan([0, 4, -1, 1, 1])
    };
    applyRiskRowClamp(out);
    expect(out.workPlanStructured?.workSteps[0].relatedRiskRowIndex).toEqual([0, 1]);
  });

  it("drops all workPlanStructured indices when structuredRiskRows is empty", () => {
    const out: AiDeliverables = {
      structuredRiskRows: [],
      workPlanStructured: makeWorkPlan([0, 1])
    };
    applyRiskRowClamp(out);
    expect(out.workPlanStructured?.workSteps[0].relatedRiskRowIndex).toEqual([]);
  });

  it("keeps in-range tbmLogStructured relatedRiskRowIndex", () => {
    const out: AiDeliverables = {
      structuredRiskRows: [{} as never, {} as never],
      tbmLogStructured: makeTbmLog(1)
    };
    applyRiskRowClamp(out);
    expect(out.tbmLogStructured?.hazardsDiscussed[0].relatedRiskRowIndex).toBe(1);
  });

  it("clears out-of-range tbmLogStructured relatedRiskRowIndex to undefined", () => {
    const out: AiDeliverables = {
      structuredRiskRows: [{} as never, {} as never],
      tbmLogStructured: makeTbmLog(4)
    };
    applyRiskRowClamp(out);
    expect(out.tbmLogStructured?.hazardsDiscussed[0].relatedRiskRowIndex).toBeUndefined();
  });

  it("leaves an already-undefined tbmLogStructured relatedRiskRowIndex untouched", () => {
    const out: AiDeliverables = {
      structuredRiskRows: [{} as never],
      tbmLogStructured: makeTbmLog(undefined)
    };
    applyRiskRowClamp(out);
    expect(out.tbmLogStructured?.hazardsDiscussed[0].relatedRiskRowIndex).toBeUndefined();
  });
});
