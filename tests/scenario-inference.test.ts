import { describe, expect, it } from "vitest";

import { inferScenario } from "@/lib/mock-data";

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
});
