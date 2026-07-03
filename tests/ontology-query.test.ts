import { describe, expect, test } from "vitest";
import { assembleGraph } from "@/lib/ontology/graph-store";
import { queryByTask, matchTaskNodes } from "@/lib/ontology/query";
import { SEED_NODES, SEED_EDGES } from "@/lib/ontology/seed/core-triples";

// published만 노출된다는 게이트를 그대로 재현: 시드의 published 부분그래프로 질의한다.
const publishedGraph = assembleGraph(
  SEED_NODES.filter((n) => n.review_state === "published"),
  SEED_EDGES.filter((e) => e.review_state === "published")
);

describe("matchTaskNodes — Task 라벨 퍼지 매칭", () => {
  test("부분 문자열(포함)로 매칭한다", () => {
    const matches = matchTaskNodes(publishedGraph, "밀폐공간");
    expect(matches.map((m) => m.label)).toContain("밀폐공간 작업");
  });

  test("공백 차이를 무시한다", () => {
    expect(matchTaskNodes(publishedGraph, "밀폐 공간 작업").length).toBeGreaterThan(0);
  });

  test("매칭 없으면 빈 배열, queryByTask는 null", () => {
    expect(matchTaskNodes(publishedGraph, "우주유영")).toEqual([]);
    expect(queryByTask(publishedGraph, "우주유영")).toBeNull();
  });
});

describe("queryByTask — 1~2홉 확장 (밀폐공간, prod 실증 케이스)", () => {
  const result = queryByTask(publishedGraph, "밀폐공간");

  test("task/hazards/controls/articles/duties 구조를 반환한다", () => {
    expect(result).not.toBeNull();
    expect(result!.task.kind).toBe("Task");
    expect(result!.task.label).toBe("밀폐공간 작업");
    expect(result!.hazards.length).toBeGreaterThan(0);
    expect(result!.controls.length).toBeGreaterThan(0);
    expect(result!.articles.length).toBeGreaterThan(0);
    expect(result!.duties.length).toBeGreaterThan(0);
  });

  test("1홉: 산소결핍 질식 등 위험요인이 나온다", () => {
    expect(result!.hazards.map((h) => h.label)).toContain("산소결핍 질식");
  });

  test("2홉: 위험요인→안전조치→법조문 — 기준규칙 제619조 대역이 조회된다 (화이트리스트 부재 사건의 해소 대상)", () => {
    const articleIds = result!.articles.map((a) => a.node_id);
    expect(articleIds).toContain("Article_기준규칙_619");
    expect(articleIds).toContain("Article_기준규칙_619의2");
    expect(articleIds).toContain("Article_기준규칙_620");
    expect(articleIds).toContain("Article_기준규칙_623");
  });

  test("2홉: 문서→중처법 의무 (emergencyResponse → 시행령 §4-8호)", () => {
    expect(result!.documents.map((d) => d.node_id)).toContain("Document_emergencyResponse");
    expect(result!.duties.map((d) => d.node_id)).toContain("Duty_중처법시행령_제4조제8호");
  });

  test("결과 노드는 전부 published (draft 미노출 불변식)", () => {
    const all = [
      result!.task,
      ...result!.hazards,
      ...result!.controls,
      ...result!.articles,
      ...result!.accidents,
      ...result!.documents,
      ...result!.duties
    ];
    expect(all.every((n) => n.review_state === "published")).toBe(true);
  });
});

describe("queryByTask — 용접", () => {
  test("불티 화재 위험과 화재감시자 배치, 제241조의2가 연결된다", () => {
    const result = queryByTask(publishedGraph, "용접");
    expect(result).not.toBeNull();
    expect(result!.hazards.map((h) => h.label)).toContain("불티에 의한 화재·폭발");
    expect(result!.controls.map((c) => c.label)).toContain("화재감시자 배치");
    expect(result!.articles.map((a) => a.node_id)).toContain("Article_기준규칙_241의2");
    // Task→documentedIn→workPlan→fulfillsDuty→§4-3호
    expect(result!.duties.map((d) => d.node_id)).toContain("Duty_중처법시행령_제4조제3호");
  });
});
