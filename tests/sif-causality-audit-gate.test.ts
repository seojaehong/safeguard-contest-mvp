import { describe, expect, it } from "vitest";

import {
  hasPoweredMachineryCausalSignal,
  listSifCausalityAuditGateFailures,
  type SifCausalityAuditGateInput
} from "@/lib/sif-causality-audit-gate";

const expectedCorpus = {
  rows: 6032,
  corpusSha256: "54db348b32016725afcf1a550d819ef7cb9b6ef6a278c728ac6f8d7eed02a5f7"
};

function passingInput(overrides: Partial<SifCausalityAuditGateInput> = {}): SifCausalityAuditGateInput {
  return {
    rows: 6032,
    branchSum: 6032,
    corpusSha256: expectedCorpus.corpusSha256,
    deterministic: true,
    mutationRun1: 0,
    mutationRun2: 0,
    rawControlAliasCount: 0,
    rawTagStandaloneLeakCount: 0,
    causalityFlagCount: 0,
    ...overrides
  };
}

describe("listSifCausalityAuditGateFailures", () => {
  it("accepts a deterministic baseline-matched audit without mutation, aliasing, tag leaks, or causality flags", () => {
    expect(listSifCausalityAuditGateFailures(passingInput(), expectedCorpus)).toEqual([]);
  });

  it("blocks causality flags even when all structural counters are green", () => {
    expect(listSifCausalityAuditGateFailures(passingInput({ causalityFlagCount: 1 }), expectedCorpus)).toContain(
      "causality-flags:1"
    );
  });

  it("blocks a same-size corpus when its authoritative file hash changed", () => {
    expect(listSifCausalityAuditGateFailures(passingInput({ corpusSha256: "0".repeat(64) }), expectedCorpus)).toContain(
      `corpus-sha256:${"0".repeat(64)}`
    );
  });

  it("reports every independent integrity failure instead of stopping at the first one", () => {
    const failures = listSifCausalityAuditGateFailures(
      passingInput({
        rows: 6031,
        branchSum: 6030,
        deterministic: false,
        mutationRun1: 1,
        rawControlAliasCount: 2,
        rawTagStandaloneLeakCount: 3
      }),
      expectedCorpus
    );

    expect(failures).toEqual(
      expect.arrayContaining([
        "rows:6031",
        "branch-sum:6030",
        "non-deterministic-output",
        "source-mutations:1",
        "raw-control-aliases:2",
        "raw-tag-leaks:3"
      ])
    );
  });
});

describe("hasPoweredMachineryCausalSignal", () => {
  it.each([
    "움직이는 리프트 브라켓 사이에 끼여 사망",
    "운전 중인 레버조립설비 셔틀과 프레임 사이에 끼임",
    "자동화 라인 점검 중 설비 사이에 끼여 사망",
    "드릴에 손이 말리면서 상부 드릴에 끼여 사망",
    "권취기 드럼과 감기는 전선 사이에 다리가 말림",
    "회전하는 천공기 로드에 작업복이 말림",
    "혼합기 회전날과 내벽 사이에 끼임",
    "취출로봇이 작동하여 금형과 로봇 사이에 협착"
  ])("recognizes direct powered-equipment motion or entanglement: %s", (overview) => {
    expect(hasPoweredMachineryCausalSignal(overview)).toBe(true);
  });

  it("does not manufacture powered-equipment causality from a machinery noun alone", () => {
    expect(hasPoweredMachineryCausalSignal("배수펌프 주변에서 원인이 확인되지 않은 사고가 발생함")).toBe(false);
  });

  it("does not treat vehicle or structure pinch prose as powered-machinery causality", () => {
    expect(hasPoweredMachineryCausalSignal("운전 중 차량 후미와 벽체 사이에 끼여 사망")).toBe(false);
    expect(hasPoweredMachineryCausalSignal("작업자가 설비 옆 철근 더미와 벽체 사이에 끼임")).toBe(false);
    expect(hasPoweredMachineryCausalSignal("설비 주변 자재 정리 중 구조물 사이에 협착")).toBe(false);
  });
});
