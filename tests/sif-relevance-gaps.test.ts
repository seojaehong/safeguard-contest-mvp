// SIF 관련성 거름의 빈틈(261101 교차 검토 A4).
// 1) 질문에서 작업 묶음을 못 뽑으면 거름이 걸리지 않았다고 드러낸다(통과한 사례를 「관련 있음」으로 내지 않는다).
// 2) 「리프트」가 포크리프트·테일리프트에 걸리지 않는다(지게차 작업에 승강 리프트 개구부 추락 사례가 붙지 않게).
// 사례 제목·요약은 가상 문장이다.
import { describe, expect, it } from "vitest";

import { buildDbHarnessPacket } from "@/lib/db-harness";
import { judgeSifCase } from "@/lib/sif-case-relevance";
import type { SafetyReferenceItem } from "@/lib/safety-reference-catalog";

function sifItem(id: string, title: string, summary: string): SafetyReferenceItem {
  return {
    id,
    source_id: "kosha-sif-archive-20260401",
    item_type: "sif-case",
    category: null,
    subcategory: null,
    title,
    summary,
    keywords: [],
    risk_tags: [],
    primary_documents: [],
    controls: [],
  };
}

const LIFT_OPENING = sifItem("v-lift", "가상 사례 — 화물 승강 리프트 출입구 개구부에서 추락", "가상 개요: 난간이 없는 리프트 출입구로 떨어졌다.");
const FORKLIFT_HIT = sifItem("v-fork", "가상 사례 — 후진하던 포크리프트에 보행자가 부딪힘", "가상 개요: 상하차 중 포크리프트가 후진하다 보행자와 충돌했다.");
const FURNACE = sifItem("v-furnace", "가상 사례 — 열처리로 가동 중 내화물 속 물이 끓어 폭발", "가상 개요: 새로 쌓은 내화물이 덜 말라 가동 직후 증기 압력으로 터졌다.");

describe("작업 묶음을 못 뽑은 질문", () => {
  it("거름을 걸지 않았다고 표시하고, 남긴 사례에 관련 근거를 붙이지 않는다", () => {
    const packet = buildDbHarnessPacket({ question: "내일 오전에 사무실에서 할 일 정리", references: [FURNACE] });
    expect(packet.sifCases.map((item) => item.id)).toEqual(["v-furnace"]);
    expect(packet.sifSelection?.relevanceApplied).toBe(false);
    expect(packet.sifSelection?.reason).toMatch(/작업·장소·기인물/u);
    expect(packet.sifSelection?.relevance).toEqual([]);
  });

  it("작업 묶음을 뽑았으면 거름을 걸었다고 표시한다", () => {
    const packet = buildDbHarnessPacket({ question: "물류창고 포크리프트 상하차 작업 3명", references: [FORKLIFT_HIT] });
    expect(packet.sifSelection?.relevanceApplied).toBe(true);
    expect(packet.sifSelection?.reason).toBeUndefined();
  });
});

describe("포크리프트·테일리프트는 승강 리프트가 아니다", () => {
  it("포크리프트 작업에 리프트 개구부 추락 사례는 빠지고 포크리프트 충돌 사례는 남는다", () => {
    const packet = buildDbHarnessPacket({ question: "물류창고 포크리프트 상하차 작업 3명", references: [LIFT_OPENING, FORKLIFT_HIT] });
    expect(packet.sifCases.map((item) => item.id)).toEqual(["v-fork"]);
    expect(packet.sifSelection?.excluded.map((item) => item.id)).toEqual(["v-lift"]);
    expect(packet.sifSelection?.relevance[0]?.relevance.matchedWork).toEqual(["차량·운반기계"]);
  });

  it("테일리프트 차량 상하차는 고소·개구부로 보지 않는다", () => {
    const decision = judgeSifCase(LIFT_OPENING, { workText: "화물차 테일리프트로 상하차 작업" });
    expect(decision.kept).toBe(false);
  });

  // 띄어 쓴 표기·화물차 적재함 승강판(리프트게이트·파워게이트)·핸드리프트도 승강 리프트가 아니다(2차 검토 2).
  for (const question of [
    "물류창고 포크 리프트 상하차 작업 3명",
    "화물차 테일 리프트로 상하차 작업",
    "택배 화물차 리프트게이트로 상하차 작업",
    "택배 화물차 파워게이트로 상하차 작업",
    "창고 핸드 리프트로 팔레트 운반 작업",
  ]) {
    it(`「${question}」은 고소·개구부로 보지 않고 리프트 개구부 사례를 뺀다`, () => {
      const decision = judgeSifCase(LIFT_OPENING, { workText: question });
      expect(decision.kept).toBe(false);
    });
  }

  it("띄어 쓴 「포크 리프트」 사례도 지게차 작업의 차량·운반기계 사례로 남는다", () => {
    const spacedFork = sifItem("v-fork-spaced", "가상 사례 — 후진하던 포크 리프트에 보행자가 부딪힘", "가상 개요: 상하차 중 포크 리프트가 후진하다 보행자와 충돌했다.");
    const decision = judgeSifCase(spacedFork, { workText: "물류창고 지게차 상하차 작업 3명" });
    expect(decision.kept && decision.relevance.matchedWork).toEqual(["차량·운반기계"]);
  });

  it("승강 리프트 작업은 여전히 리프트 개구부 사례와 맞는다", () => {
    const decision = judgeSifCase(LIFT_OPENING, { workText: "화물용 리프트에 자재를 싣는 작업" });
    expect(decision.kept).toBe(true);
  });
});

// 작업 묶음이 안 겹쳐도 질문이 적은 재해형태로 사례를 남기는 예외(261101 2차 교차 검토 1).
// 「화재감시자 배치」「낙하 우려」처럼 질문의 작업 묶음이 이미 설명하는 재해형태로는 장소가 다른 사례를 살리지 않는다.
describe("질문이 적은 재해형태로 사례를 남기는 예외", () => {
  const DUCT_WELD_Q = "가상 사업장 미래화학 도장공장 배기덕트 내부 용접 보수 작업 2명, 인화성 증기 잔류 가능, 화재감시자 배치";
  const TOWER_CRANE_Q = "가상 사업장 타워크레인으로 철골 자재 인양 작업 3명, 낙하 우려, 신호수 배치";
  const SHAFT_FALL = sifItem("v-shaft", "가상 사례 — 승강로 개구부에서 인양 자재를 받다가 추락", "가상 개요: 난간이 없는 승강로 개구부에서 낙하하는 자재를 피하다 떨어졌다.");
  const SCAFFOLD_FALL = sifItem("v-scaffold", "가상 사례 — 작업발판 위에서 균형을 잃고 추락", "가상 개요: 난간이 없는 작업발판에서 떨어졌다.");

  it("덕트 용접(화재감시자 배치) 작업에 작업 묶음이 없는 열처리로 폭발 사례는 빠진다", () => {
    const packet = buildDbHarnessPacket({ question: DUCT_WELD_Q, references: [FURNACE] });
    expect(packet.sifCases).toEqual([]);
    expect(packet.sifSelection?.excluded.map((item) => item.id)).toEqual(["v-furnace"]);
  });

  it("타워크레인 인양(낙하 우려) 작업에 승강로 개구부 추락 사례는 빠진다", () => {
    const decision = judgeSifCase(SHAFT_FALL, { workText: TOWER_CRANE_Q });
    expect(decision.kept).toBe(false);
  });

  it("작업 묶음이 그 재해형태를 설명하지 못하는 질문(외벽 도장의 추락)은 고소 작업 추락 사례를 남긴다", () => {
    const decision = judgeSifCase(SCAFFOLD_FALL, { workText: "외벽 도장 작업의 추락 위험을 점검해줘" });
    expect(decision.kept).toBe(true);
    expect(decision.kept && decision.relevance.matchedAccidentTypes).toEqual(["추락"]);
  });
});

describe("MCP 결과에도 거름 적용 여부가 드러난다", () => {
  async function sifOf(question: string, references: SafetyReferenceItem[]) {
    const { buildPublicDbHarnessPacket } = await import("@/lib/db-harness");
    const { buildMockAskResponse } = await import("@/lib/mock-data");
    const { canonicalizeRiskAssessmentResponse } = await import("@/lib/risk-assessment-record");
    const { createGenerateRiskAssessmentHandler } = await import("@/lib/mcp-risk-assessment");
    const packet = buildPublicDbHarnessPacket(buildDbHarnessPacket({ question, references }));
    const base = canonicalizeRiskAssessmentResponse(buildMockAskResponse("가상 사업장 물류창고 지게차 상하차 작업 3명", [], "mock", "fixture"));
    const handler = createGenerateRiskAssessmentHandler({
      defaultMode: "enhanced",
      generateResponse: async () => ({ ...base, dbHarness: { packet, promptContext: "", summary: {} as never } }),
      renderXlsx: async () => ({ ok: true, buffer: Buffer.from("PK"), fileName: "a.xlsx", fallbackName: "a" }),
      renderHwp: () => ({ buffer: Buffer.from("x"), fileName: "a.hwp" }),
    });
    const result = await handler({ question }, { siteId: null, orgId: null, scopes: ["tools:*"], source: "env", tokenId: null }, { signal: new AbortController().signal });
    return (JSON.parse(result.content[0]?.text ?? "{}") as { sif: { relevanceApplied: boolean; relevanceNote?: string; cases: Array<{ id: string; relevance?: unknown }> } }).sif;
  }

  it("못 걸었으면 relevanceApplied:false 와 이유, 사례에 relevance 없음", async () => {
    const sif = await sifOf("내일 오전에 사무실에서 할 일 정리", [FURNACE]);
    expect(sif.relevanceApplied).toBe(false);
    expect(sif.relevanceNote).toMatch(/거름을 걸지 않았습니다/u);
    expect(sif.cases.map((item) => item.id)).toEqual(["v-furnace"]);
    expect(sif.cases[0]?.relevance).toBeUndefined();
  });

  it("걸었으면 relevanceApplied:true", async () => {
    const sif = await sifOf("물류창고 포크리프트 상하차 작업 3명", [FORKLIFT_HIT]);
    expect(sif.relevanceApplied).toBe(true);
    expect(sif.relevanceNote).toBeUndefined();
  });
});
