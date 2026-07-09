import { describe, expect, it } from "vitest";

import { buildMockAskResponse, mockSearchResults } from "@/lib/mock-data";
import {
  buildDefaultWorkers,
  buildDisplayTargetWorkers,
  buildWorkerDispatchTargets,
  formatDisplayTargetCount
} from "@/lib/workspace";

describe("workspace worker defaults", () => {
  it("uses role-based snapshot labels instead of demo A/B/C names", () => {
    const response = buildMockAskResponse("성수동 외벽 도장 작업, 신규 1명, 외국인 작업자 포함", mockSearchResults.slice(0, 2), "live", "test");
    const workers = buildDefaultWorkers(response);
    const names = workers.map((worker) => worker.displayName);

    expect(names).toContain("현장관리자");
    expect(names).toContain("신규 작업자");
    expect(names).toContain("다국어 작업자");
    expect(names.join(" ")).not.toMatch(/\b[A-C]\b|관리자 A|작업자 B|작업자 C/);
  });

  it("keeps the share draft populated before server workpack storage exists", () => {
    const response = buildMockAskResponse("부산 해운대 밀폐공간 배수펌프 점검 작업, 작업자 5명", mockSearchResults.slice(0, 2), "live", "test");
    response.scenario.workerCount = 5;

    const fallbackTargets = buildDisplayTargetWorkers(response, []);
    expect(formatDisplayTargetCount(response, [])).toBe("5명 기준");
    expect(fallbackTargets.map((worker) => worker.displayName)).toEqual(["현장관리자", "작업자 그룹 5명"]);
    expect(fallbackTargets.every((worker) => worker.trainingStatus === "확인 필요")).toBe(true);

    const realTargets = buildWorkerDispatchTargets(buildDefaultWorkers(response));
    expect(buildDisplayTargetWorkers(response, realTargets)).toBe(realTargets);
    expect(formatDisplayTargetCount(response, realTargets)).toBe(`${realTargets.length}명`);
  });
});
