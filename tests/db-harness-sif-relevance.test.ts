// SIF 유사사례 관련성 거름이 생성 입력(dbHarness 패킷) 단계에서 걸리는가.
// 웹 /api/ask 와 MCP generate_risk_assessment 가 같은 buildDbHarnessPacket 을 거치므로 둘 다 이 결과를 쓴다.
// 사례 제목·요약은 모두 가상 문장이다(공단 사례 원문을 시험에 두지 않는다).
import { describe, expect, it } from "vitest";

import { buildDbHarnessPacket, buildHarnessPromptContext, buildPublicDbHarnessPacket } from "@/lib/db-harness";
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
    source_url: `https://example.invalid/${id}`,
  };
}

const CONFINED_Q = "가상 사업장 한빛정화 오수처리장 맨홀 내부 슬러지 제거 작업 3명, 밀폐공간 산소결핍·황화수소 우려, 주간";
const DUCT_WELD_Q = "가상 사업장 미래화학 도장공장 배기덕트 내부 용접 보수 작업 2명, 인화성 증기 잔류 가능, 화재감시자 배치";

const FURNACE = sifItem("v-furnace", "가상 사례 — 열처리로 가동 중 내화물 속 물이 끓어 폭발", "가상 개요: 새로 쌓은 내화물이 덜 말라 가동 직후 증기 압력으로 터졌다.");
const PIPE_WELD = sifItem("v-pipe", "가상 사례 — 좁은 배관 안 용접 작업자가 산소결핍으로 의식 잃음", "가상 개요: 환기 없이 배관 안에 들어가 용접하다 의식을 잃었다.");
const CISTERN_FIRE = sifItem("v-cistern", "가상 사례 — 지하 물탱크 내부 방수 작업 중 화재로 화상", "가상 개요: 물탱크 내부에서 용접 불티가 도료 증기에 붙어 불이 났다.");
const LPG_CUT = sifItem("v-lpg", "가상 사례 — 프로판 가스 절단 중 불꽃이 작업복에 붙어 화상", "가상 개요: 프로판 토치로 철판을 자르다 작업복에 불이 붙었다.");
const LIFT_FALL = sifItem("v-lift", "가상 사례 — 승강기 출입구 개구부에서 작업자 추락", "가상 개요: 안전난간이 없는 승강기 출입구 개구부로 떨어졌다.");

describe("dbHarness 패킷 단계 SIF 관련성 거름", () => {
  it("밀폐공간 작업에서 작업·장소·기인물이 다른 사례는 생성 입력에서 빠진다", () => {
    const packet = buildDbHarnessPacket({ question: CONFINED_Q, references: [FURNACE, PIPE_WELD] });

    expect(packet.sifCases.map((item) => item.id)).toEqual(["v-pipe"]);
    // 빠진 사례가 「그 밖의 근거」로 새어 들어가지 않는다.
    expect(packet.supportingEvidence.map((item) => item.id)).not.toContain("v-furnace");
    expect(packet.retrievalContract.sourceCounts.sifCases).toBe(1);
    expect(buildHarnessPromptContext(packet)).not.toContain("열처리로");

    expect(packet.sifSelection?.retrievedCount).toBe(2);
    expect(packet.sifSelection?.excluded).toEqual([
      { id: "v-furnace", title: FURNACE.title, reason: expect.stringMatching(/작업·장소·기인물이 다름/u) },
    ]);
    expect(packet.sifSelection?.relevance).toEqual([
      { id: "v-pipe", relevance: expect.objectContaining({ matchedWork: expect.arrayContaining(["밀폐공간"]) }) },
    ]);
  });

  it("덕트 내부 용접(화재·폭발) 작업에서 리프트 추락 사례는 빠지고 남은 사례는 관련 높은 순이다", () => {
    const packet = buildDbHarnessPacket({ question: DUCT_WELD_Q, references: [LIFT_FALL, LPG_CUT, CISTERN_FIRE] });

    expect(packet.sifCases.map((item) => item.id)).toEqual(["v-cistern", "v-lpg"]);
    expect(packet.sifSelection?.excluded.map((item) => item.id)).toEqual(["v-lift"]);
    expect(packet.supportingEvidence.map((item) => item.id)).not.toContain("v-lift");
    expect(buildHarnessPromptContext(packet)).not.toContain("승강기");
  });

  it("공개 패킷(/api/ask 응답)에도 같은 선택 결과가 실린다", () => {
    const publicPacket = buildPublicDbHarnessPacket(buildDbHarnessPacket({ question: CONFINED_Q, references: [FURNACE, PIPE_WELD] }));
    expect(publicPacket.sifCases.map((item) => item.id)).toEqual(["v-pipe"]);
    expect(publicPacket.sifSelection?.excluded.map((item) => item.id)).toEqual(["v-furnace"]);
  });

  it("전부 빠지면 SIF 0건을 「SIF 유사사례」 누락으로 드러내고, 패킷 나머지는 그대로 만든다", () => {
    const packet = buildDbHarnessPacket({ question: CONFINED_Q, references: [FURNACE, LIFT_FALL] });

    expect(packet.sifCases).toEqual([]);
    expect(packet.supportingEvidence).toEqual([]);
    expect(packet.sifSelection?.excluded.map((item) => item.id)).toEqual(["v-furnace", "v-lift"]);
    expect(packet.ontologyChecklist.missing).toContain("SIF 유사사례");
    const prompt = buildHarnessPromptContext(packet);
    expect(prompt).not.toContain("열처리로");
    expect(prompt).not.toContain("승강기");
  });

  it("작업 묶음이 안 겹쳐도 작업 설명이 직접 적은 재해형태와 같은 사례는 남긴다", () => {
    // 「외벽 도장」은 작업 묶음으로 화학물질만 잡히지만 질문이 추락을 직접 묻는다(hermes-engine-adapter 시험 질문).
    const fallOnScaffold = sifItem("v-scaffold", "가상 사례 — 작업발판 위에서 균형을 잃고 추락", "가상 개요: 난간이 없는 작업발판에서 떨어졌다.");
    const packet = buildDbHarnessPacket({ question: "외벽 도장 작업의 추락 위험을 점검해줘", references: [fallOnScaffold, FURNACE] });
    expect(packet.sifCases.map((item) => item.id)).toEqual(["v-scaffold"]);
    expect(packet.sifSelection?.relevance[0]?.relevance.matchedAccidentTypes).toEqual(["추락"]);
    expect(packet.sifSelection?.excluded.map((item) => item.id)).toEqual(["v-furnace"]);
  });

  it("작업 설명에서 작업·장소·기인물을 하나도 못 뽑으면 거르지 않는다", () => {
    const packet = buildDbHarnessPacket({ question: "내일 오전에 사무실에서 할 일 정리", references: [FURNACE, LIFT_FALL] });
    expect(packet.sifCases.map((item) => item.id).sort()).toEqual(["v-furnace", "v-lift"]);
    expect(packet.sifSelection?.excluded).toEqual([]);
  });
});
