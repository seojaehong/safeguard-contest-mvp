// 안전 온톨로지 쿼리 — queryByTask: Task 라벨 퍼지 매칭 → 1~2홉 확장.
// 클로/문서 파이프라인이 "용접" 같은 단어에서 추론이 아니라 조회로 답하기 위한 진입점.
//
// 홉 확장 (설계 문서 §3):
//   1홉: Task -entailsHazard→ Hazard / Task -documentedIn→ Document / Task -mandatedBy→ Article
//        / Task -evidencedBy→ Accident
//   2홉: Hazard -mitigatedBy→ Control / Control -mandatedBy→ Article
//        / Hazard -evidencedBy→ Accident / Control -documentedIn→ Document
//        / (Document|Article) -fulfillsDuty→ Duty
//
// provenance 불변식: 이 모듈은 이미 조립(assembleGraph — 무출처 드롭 완료)된 그래프를
// 입력으로 받는다. 조립 전 원시 행을 넘기지 말 것.

import { normalizeLabel, type OntologyEdge, type OntologyNode } from "@/lib/ontology/schema";

export type QueryableGraph = {
  nodes: OntologyNode[];
  edges: OntologyEdge[];
};

export type TaskQueryResult = {
  task: OntologyNode;
  hazards: OntologyNode[];
  controls: OntologyNode[];
  articles: OntologyNode[];
  accidents: OntologyNode[];
  documents: OntologyNode[];
  duties: OntologyNode[];
};

/** Task 라벨 퍼지 매칭: 정규화(공백 제거) 후 포함 관계(양방향). */
export function matchTaskNodes(graph: QueryableGraph, taskLabel: string): OntologyNode[] {
  const query = normalizeLabel(taskLabel);
  if (!query) return [];
  return graph.nodes.filter((node) => {
    if (node.kind !== "Task") return false;
    const label = normalizeLabel(node.label);
    return label.includes(query) || query.includes(label);
  });
}

type EdgeIndex = Map<string, OntologyEdge[]>;

function indexBySrc(edges: OntologyEdge[]): EdgeIndex {
  const index: EdgeIndex = new Map();
  for (const edge of edges) {
    const list = index.get(edge.src);
    if (list) list.push(edge);
    else index.set(edge.src, [edge]);
  }
  return index;
}

function collect(
  index: EdgeIndex,
  nodeById: Map<string, OntologyNode>,
  srcIds: Iterable<string>,
  rel: OntologyEdge["rel"],
  into: Map<string, OntologyNode>
): void {
  for (const srcId of srcIds) {
    for (const edge of index.get(srcId) || []) {
      if (edge.rel !== rel) continue;
      const node = nodeById.get(edge.dst);
      if (node) into.set(node.node_id, node);
    }
  }
}

function sorted(map: Map<string, OntologyNode>): OntologyNode[] {
  return Array.from(map.values()).sort((a, b) => a.node_id.localeCompare(b.node_id, "ko"));
}

/**
 * 작업유형 라벨로 온톨로지를 조회한다. 매칭 Task가 없으면 null.
 * 복수 Task 매칭 시(예: "작업" 같은 광범위 질의) 모든 매칭 Task에서 확장하되
 * 대표 task는 라벨이 가장 짧은(가장 특정한) 노드를 반환한다.
 */
export function queryByTask(graph: QueryableGraph, taskLabel: string): TaskQueryResult | null {
  const tasks = matchTaskNodes(graph, taskLabel);
  if (tasks.length === 0) return null;
  const primary = [...tasks].sort(
    (a, b) => a.label.length - b.label.length || a.node_id.localeCompare(b.node_id, "ko")
  )[0];

  const nodeById = new Map(graph.nodes.map((node) => [node.node_id, node]));
  const bySrc = indexBySrc(graph.edges);
  const taskIds = tasks.map((t) => t.node_id);

  const hazards = new Map<string, OntologyNode>();
  const controls = new Map<string, OntologyNode>();
  const articles = new Map<string, OntologyNode>();
  const accidents = new Map<string, OntologyNode>();
  const documents = new Map<string, OntologyNode>();
  const duties = new Map<string, OntologyNode>();

  // 1홉
  collect(bySrc, nodeById, taskIds, "entailsHazard", hazards);
  collect(bySrc, nodeById, taskIds, "documentedIn", documents);
  collect(bySrc, nodeById, taskIds, "mandatedBy", articles);
  collect(bySrc, nodeById, taskIds, "evidencedBy", accidents);

  // 2홉
  collect(bySrc, nodeById, hazards.keys(), "mitigatedBy", controls);
  collect(bySrc, nodeById, hazards.keys(), "evidencedBy", accidents);
  collect(bySrc, nodeById, controls.keys(), "mandatedBy", articles);
  collect(bySrc, nodeById, controls.keys(), "documentedIn", documents);
  collect(bySrc, nodeById, documents.keys(), "fulfillsDuty", duties);
  collect(bySrc, nodeById, articles.keys(), "fulfillsDuty", duties);

  return {
    task: primary,
    hazards: sorted(hazards),
    controls: sorted(controls),
    articles: sorted(articles),
    accidents: sorted(accidents),
    documents: sorted(documents),
    duties: sorted(duties)
  };
}
