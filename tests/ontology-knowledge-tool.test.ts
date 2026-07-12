import { describe, expect, test } from "vitest";

import { assembleGraph } from "@/lib/ontology/graph-store";
import { queryKnowledge, matchHazardNodes, listTaskLabels } from "@/lib/ontology/query";
import { SEED_NODES, SEED_EDGES } from "@/lib/ontology/seed/core-triples";
import {
  buildSafetyKnowledgeResult,
  CORE_ONTOLOGY_PROVENANCE,
  ONTOLOGY_PROVENANCE,
} from "@/lib/mcp-tools";

// published 게이트 재현: published 부분그래프만으로 조회한다(draft 미노출 불변식).
const graph = assembleGraph(
  SEED_NODES.filter((n) => n.review_state === "published"),
  SEED_EDGES.filter((e) => e.review_state === "published")
);

describe("queryKnowledge — Task 매칭 경로", () => {
  test("밀폐공간 → matchedBy:task, 대표 task, 619조 대역 조문 조회", () => {
    const result = queryKnowledge(graph, "밀폐공간");
    expect(result).not.toBeNull();
    expect(result!.matchedBy).toBe("task");
    expect(result!.task?.label).toBe("밀폐공간 작업");
    const articleIds = result!.articles.map((a) => a.node_id);
    expect(articleIds).toContain("Article_기준규칙_619");
    expect(articleIds).toContain("Article_기준규칙_619의2");
  });

  test("controls는 각 안전조치에 근거 조문(mandatedBy)이 병기된다", () => {
    const result = queryKnowledge(graph, "밀폐공간");
    expect(result!.controls.length).toBeGreaterThan(0);
    // 적어도 하나의 안전조치는 근거 조문이 붙어 있어야 한다.
    expect(result!.controls.some((c) => c.articles.length > 0)).toBe(true);
  });
});

describe("queryKnowledge — Hazard 라벨 폴백", () => {
  test("'산소결핍 질식'은 Task가 아니라 Hazard로 매칭된다", () => {
    // 어떤 Task 라벨에도 포함되지 않는 위험요인 라벨.
    expect(matchHazardNodes(graph, "산소결핍 질식").length).toBeGreaterThan(0);
    const result = queryKnowledge(graph, "산소결핍 질식");
    expect(result).not.toBeNull();
    expect(result!.matchedBy).toBe("hazard");
    expect(result!.hazards.map((h) => h.label)).toContain("산소결핍 질식");
    // 위험요인 → 안전조치 확장이 이뤄진다.
    expect(result!.controls.length).toBeGreaterThan(0);
  });
});

describe("queryKnowledge — 미등록", () => {
  test("등록되지 않은 라벨은 null", () => {
    expect(queryKnowledge(graph, "우주유영")).toBeNull();
  });
});

describe("buildSafetyKnowledgeResult — 도구 페이로드 정형화", () => {
  test("매칭 성공: provenance + 조번호/제목 + 안전조치별 조문", () => {
    const result = queryKnowledge(graph, "밀폐공간");
    const payload = buildSafetyKnowledgeResult("밀폐공간", result, listTaskLabels(graph));
    expect(payload.found).toBe(true);
    if (!payload.found) throw new Error("unreachable");
    expect(payload.provenance).toBe(ONTOLOGY_PROVENANCE);
    expect(payload.provenance).toBe("SafeClaw 계층형 안전근거 계약 phase-a/v1");
    expect(payload.coreProvenance).toBe(CORE_ONTOLOGY_PROVENANCE);
    expect(payload.coreProvenance).toBe("법제처 검증 시드 v1");
    expect(payload.task).toBe("밀폐공간 작업");
    // articles: 조번호(article_no) + 제목(label) 병기
    const a619 = payload.articles.find((a) => a.articleNo === "619");
    expect(a619).toBeDefined();
    expect(a619!.label).toContain("제619조");
    // controls: 각 안전조치에 조문 라벨 배열
    expect(payload.controls.some((c) => c.articles.length > 0)).toBe(true);
    // duties는 단독 충족이 아니라 이행 증빙 일부임을 명시
    expect(payload.dutiesNote).toContain("단독 충족 아님");
  });

  test("매칭 실패(result=null): 미등록 안내 + 등록된 Task 목록", () => {
    const payload = buildSafetyKnowledgeResult("우주유영", null, listTaskLabels(graph));
    expect(payload.found).toBe(false);
    if (payload.found) throw new Error("unreachable");
    expect(payload.message).toContain("등록된");
    expect(payload.registeredTasks).toContain("밀폐공간 작업");
    expect(payload.registeredTasks.length).toBeGreaterThan(0);
  });
});
