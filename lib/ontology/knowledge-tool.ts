// query_safety_knowledge 도구의 비동기 오케스트레이션 (Phase C).
//
// loadGraph("published") → queryKnowledge → buildSafetyKnowledgeResult를 한 번에 묶어
// MCP 라우트(app/api/mcp)와 클로 채팅(lib/claw-tools) 두 호출부가 공유한다.
// published 스코프만 조회한다(draft 미노출 불변식). 순수 조립·포맷은 각각
// lib/ontology/query.ts, lib/mcp-tools.ts에 있고 여기서는 배선만 담당한다.

import { resolveEvidenceChain } from "@/lib/ontology/evidence-chain";
import { loadGraph, type OntologyGraph } from "@/lib/ontology/graph-store";
import { queryKnowledge, listTaskLabels } from "@/lib/ontology/query";
import { buildSafetyKnowledgeResult, type SafetyKnowledgeResult } from "@/lib/mcp-tools";

/**
 * 이미 조립된 그래프에서 published canonical Task를 먼저 확정한 뒤 core 지식과
 * Phase A evidence chain을 하나의 계층형 도구 페이로드로 만든다.
 */
export function buildPublishedSafetyKnowledge(
  graph: OntologyGraph,
  query: string,
): SafetyKnowledgeResult {
  const evidenceResolution = resolveEvidenceChain(graph, query);
  const hasPublishedGraphPack =
    evidenceResolution.graphPublicationState === "published" && "pack" in evidenceResolution;
  const failClosed =
    !hasPublishedGraphPack && evidenceResolution.reason !== "not_registered";
  const coreQuery = hasPublishedGraphPack ? evidenceResolution.pack.task.label : query;
  const result = failClosed ? null : queryKnowledge(graph, coreQuery);
  return buildSafetyKnowledgeResult(
    query,
    result,
    listTaskLabels(graph),
    evidenceResolution,
  );
}

/**
 * 작업유형/위험요인 라벨로 검증된 안전 지식(위험요인→안전조치→법조문→중처법 의무)을 조회한다.
 * published 부분그래프만 사용. 그래프 조회 실패(미설정/네트워크)는 예외로 던져 호출부의
 * 도구 오류 처리(toToolError / tool_result is_error)에 위임한다.
 */
export async function querySafetyKnowledge(query: string): Promise<SafetyKnowledgeResult> {
  const loaded = await loadGraph("published");
  if (!loaded.ok || !loaded.graph) {
    throw new Error(loaded.message || "안전 온톨로지 그래프를 조회할 수 없습니다.");
  }
  return buildPublishedSafetyKnowledge(loaded.graph, query);
}
