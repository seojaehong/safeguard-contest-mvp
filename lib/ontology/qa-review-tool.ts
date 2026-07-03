// qa_review_docpack 도구의 비동기 오케스트레이션 (SafeClaw 2 · 2층 검증).
//
// loadGraph("published") → reviewDocumentCoverage를 묶어 MCP 라우트(app/api/mcp)와
// 클로 채팅(lib/claw-tools)이 공유한다. published 부분그래프만 조회한다(draft 미노출).
// 순수 대조는 lib/ontology/qa-review.ts에 있고 여기서는 배선만 담당한다
// (lib/ontology/knowledge-tool.ts와 동일 패턴).

import { loadGraph } from "@/lib/ontology/graph-store";
import { reviewDocumentCoverage, type QaReviewResult } from "@/lib/ontology/qa-review";

/**
 * 안전 문서 본문을 작업유형의 법정 필수 조치 목록과 대조해 누락을 검출한다.
 * published 부분그래프만 사용. 그래프 조회 실패는 예외로 던져 호출부의 도구 오류 처리에 위임한다.
 */
export async function reviewDocpack(task: string, documentText: string): Promise<QaReviewResult> {
  const loaded = await loadGraph("published");
  if (!loaded.ok || !loaded.graph) {
    throw new Error(loaded.message || "안전 온톨로지 그래프를 조회할 수 없습니다.");
  }
  return reviewDocumentCoverage(task, documentText, loaded.graph);
}
