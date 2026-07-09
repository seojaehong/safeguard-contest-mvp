import { describe, expect, it } from "vitest";

import { buildMockAskResponse, mockSearchResults } from "@/lib/mock-data";
import { buildDefaultWorkers } from "@/lib/workspace";

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
});
