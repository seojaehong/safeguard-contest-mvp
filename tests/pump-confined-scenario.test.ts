import { describe, expect, it } from "vitest";

import { matchSafetyKnowledge } from "@/lib/safety-knowledge";
import { inferScenario } from "@/lib/mock-data";

describe("confined pump scenario inference", () => {
  it("keeps basement pump inspections out of the generic ceiling-leak template", () => {
    const scenario = inferScenario(
      "부산 해운대 시설관리 현장 지하 기계실 배수펌프 점검, 작업자 4명, 밀폐공간 진입 전 환기와 산소농도 측정, 배수펌프 전원 차단 및 LOTO, 누수 바닥 미끄럼 위험, 감시인 배치 필요."
    );

    expect(scenario.profile.workName).toBe("지하 기계실 배수펌프 점검");
    expect(scenario.profile.processName).toContain("밀폐공간");
    expect(scenario.profile.processName).toContain("배수펌프");
    expect(scenario.profile.topRisk).toContain("산소결핍");
    expect(scenario.profile.topRisk).toContain("불시기동");
    expect(scenario.profile.hazards).toEqual(expect.arrayContaining([
      expect.stringContaining("환기·산소농도"),
      expect.stringContaining("LOTO"),
      expect.stringContaining("누수 바닥")
    ]));
    expect(scenario.profile.workName).not.toContain("천장");
    expect(scenario.profile.topRisk).not.toContain("천장재");
  });

  it("does not leak internal document keys into safety knowledge reflection labels", () => {
    const matches = matchSafetyKnowledge(
      "부산 해운대 시설관리 현장 지하 기계실 배수펌프 점검, 밀폐공간 진입 전 산소농도 측정과 환기, LOTO, 감시인 배치 필요."
    );

    expect(matches.length).toBeGreaterThan(0);
    for (const match of matches) {
      expect(match.documentReflectionLabel).not.toMatch(/riskAssessment|tbmBriefing|safetyEducation|workpackSummary/);
      expect(match.documentReflectionLabel).toMatch(/위험성평가표|TBM|안전보건교육|작업 요약/);
    }
  });
});
