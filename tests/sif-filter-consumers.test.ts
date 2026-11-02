// SIF 관련성 거름을 패킷(buildDbHarnessPacket)에 넣은 뒤, 패킷을 읽는 다른 소비처가 뺀 사례를 어떻게 다루는가(261101 2차 교차 검토 4).
// 결정: 모든 소비처는 거른 뒤의 packet.sifCases 만 근거로 본다. 뺀 사례는 packet.sifSelection.excluded 에 이유와 함께 남는다.
// - MCP run_safeclaw_harness_agent(buildHarnessAgentResult): 패킷·프롬프트 문맥에 뺀 사례가 없고 excluded 로 보인다.
// - KOSHA 검색 감사(auditKoshaRetrievalScenario): 고른 근거·금지어 검사가 생성이 실제로 받는 패킷 기준이다.
// runAsk·Hermes·사진 분석은 각각 tests/sif-filter-run-ask.test.ts, hermes-engine-adapter.test.ts, photo-vision-analysis.test.ts.
// 사례·지침 문장은 가상이다.
import { describe, expect, it } from "vitest";

import { auditKoshaRetrievalScenario } from "@/lib/kosha-guide-corpus-audit";
import { buildHarnessAgentResult } from "@/lib/mcp-tools";
import type { SafetyReferenceItem } from "@/lib/safety-reference-catalog";

const QUESTION = "가상 사업장 외벽 철골 용접 보수 작업 2명, 불티 비산 우려";
const EXCLUDED_MARKER = "균형을 잃고";

function weldGuide(overrides: Partial<SafetyReferenceItem> = {}): SafetyReferenceItem {
  return {
    id: "v-weld-guide",
    source_id: "kosha-guide-offline:v-weld-guide",
    item_type: "technical-guideline",
    category: "화재폭발",
    subcategory: "용접",
    title: "X-T-1-2026 가상 외벽 용접 불티 화재 예방 지침",
    summary: "용접 불티 비산 방지포를 설치하고 화재감시자를 둔다.",
    body: "가상 본문: 용접 전 불티 비산 방지포를 설치하고 화재감시자를 둔다.",
    keywords: ["용접", "불티", "화재", "외벽"],
    risk_tags: ["화재"],
    primary_documents: ["위험성평가표", "TBM 브리핑", "TBM 기록"],
    controls: ["불티 비산 방지포 설치", "화재감시자 배치"],
    evidence_role: "supporting",
    retrieval_source: "local-ranked",
    ...overrides
  };
}

function facadeFallSif(overrides: Partial<SafetyReferenceItem> = {}): SafetyReferenceItem {
  return {
    id: "v-sif-facade-fall",
    source_id: "kosha-sif-archive-20260401",
    item_type: "sif-case",
    category: null,
    subcategory: null,
    title: `가상 사례 — 외벽 작업발판에서 ${EXCLUDED_MARKER} 추락`,
    summary: "가상 개요: 난간이 없는 외벽 작업발판에서 떨어졌다.",
    body: `가상 재해개요: 외벽 작업발판에서 ${EXCLUDED_MARKER} 떨어졌다. 위험성 감소대책: 난간 설치.`,
    keywords: ["외벽", "추락"],
    risk_tags: ["추락"],
    primary_documents: ["위험성평가표"],
    controls: ["작업발판 난간 설치"],
    evidence_role: "supporting",
    retrieval_source: "ranked",
    ...overrides
  };
}

describe("MCP run_safeclaw_harness_agent 결과", () => {
  it("뺀 사례는 패킷 근거·프롬프트 문맥에 없고 sifSelection.excluded 에 이유와 함께 남는다", () => {
    const result = buildHarnessAgentResult({ question: QUESTION, references: [weldGuide(), facadeFallSif()], referenceSearch: [] });

    expect(result.packet.sifCases).toEqual([]);
    expect(result.packet.sifSelection?.relevanceApplied).toBe(true);
    expect(result.packet.sifSelection?.excluded).toEqual([
      expect.objectContaining({ id: "v-sif-facade-fall", reason: expect.stringContaining("작업·장소·기인물이 다름") })
    ]);
    const evidenceText = JSON.stringify([result.packet.directEvidence, result.packet.sifCases, result.packet.supportingEvidence]);
    expect(evidenceText).not.toContain(EXCLUDED_MARKER);
    expect(result.promptContext).not.toContain(EXCLUDED_MARKER);
  });
});

describe("KOSHA 검색 감사(auditKoshaRetrievalScenario)", () => {
  it("고른 근거와 금지어 검사는 거른 뒤의 패킷 기준이라 뺀 사례 문장으로 실패를 내지 않는다", () => {
    const branch = "local-ranked" as const;
    const result = auditKoshaRetrievalScenario({
      id: "v-facade-weld",
      query: QUESTION,
      expectedCodes: ["X-T-1-2026"],
      requiredControlTerms: ["방지포"],
      forbiddenTerms: [EXCLUDED_MARKER]
    }, [weldGuide({ retrieval_source: branch }), facadeFallSif({ retrieval_source: branch })], branch);

    expect(result.executionStatus).toBe("tested");
    expect(result.selectedIds).toContain("v-weld-guide");
    expect(result.selectedIds).not.toContain("v-sif-facade-fall");
    expect(result.failures).not.toContain(`cross-task-term:${EXCLUDED_MARKER}`);
    expect(result.promptContext).not.toContain(EXCLUDED_MARKER);
  });
});
