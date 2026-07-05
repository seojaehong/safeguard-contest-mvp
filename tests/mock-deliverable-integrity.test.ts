import { describe, expect, it } from "vitest";

import { buildMockAskResponse } from "@/lib/mock-data";

const ansanHotworkQuestion =
  "그린메탈 경기 안산 공장 배관 용접·절단 화기작업. 외국인 근로자 2명과 신규 작업자 1명 포함, 작업자 6명, 실내 고온과 환기 불량, 가연물 인접. 화재감시자와 다국어 안전교육까지 반영해 위험성평가, TBM, 안전보건교육 기록을 만들어줘.";
const incheonRainQuestion =
  "한빛로지스 인천 남동공단 물류센터 지게차 상하차 작업. 숙련 지게차 운전자 2명과 피킹 인력 6명, 우천 후 출입구 바닥 젖음, 보행 동선과 지게차 동선이 겹친다. 오늘 위험성평가와 TBM, 안전보건교육 기록을 만들어줘.";

describe("mock deliverable integrity", () => {
  it("carries hot-work, foreign-worker, and site context into fallback deliverables", () => {
    const response = buildMockAskResponse(ansanHotworkQuestion, [], "mock", "test");
    const deliverables = response.deliverables;

    expect(deliverables.workpackSummaryDraft).toContain("외국인");
    expect(deliverables.workPlanDraft).toContain("안전조치");
    expect(deliverables.emergencyResponseDraft).toContain("그린메탈");
    expect(deliverables.emergencyResponseDraft).toContain("화재감시자");
    expect(deliverables.photoEvidenceDraft).toContain("그린메탈");
    expect(deliverables.foreignWorkerTransmission).toContain("화재감시자");
    expect(deliverables.kakaoMessage).toContain("외국인");
  });

  it("carries rain and wet-floor context into foreign worker fallback documents", () => {
    const response = buildMockAskResponse(incheonRainQuestion, [], "mock", "test");

    expect(response.deliverables.foreignWorkerBriefing).toContain("우천");
    expect(response.deliverables.foreignWorkerTransmission).toContain("우천");
  });
});
