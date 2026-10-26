// PR-12 H2·H3 — 생성 전에 온톨로지 published 조회 결과를 근거 패킷에 싣기 위한 주입 전용 해석기.
//
// 검수(QA)용 해석기(lib/ontology/qa-review.ts·query.ts 의 퍼지 매칭·hazard 폴백)와 분리한다(결정 4).
// 여기서는 ① 작업 분류 TaskId → 온톨로지 Task 라벨을 고정표로만 바꾸고 ② Task 라벨을 정확히 일치하는
// published Task 노드에서만 entailsHazard → mitigatedBy → mandatedBy 로 내려간다. hazard 폴백은 없다
// (「끼임」 하나로 지게차 상하차 조치가 프레스 패킷에 들어가던 것이 H3 다).
// 그래프는 「DB published 그래프 ∪ 시드 published ∪ PR-12 작업유형 overlay」이고 review_state 가
// published 인 노드·엣지만 쓴다.
import type { OntologyControlEvidence } from "@/lib/grounded-generation-contract";
import { assembleGraph, loadGraph, type OntologyGraph } from "@/lib/ontology/graph-store";
import type { OntologyEdge, OntologyNode } from "@/lib/ontology/schema";
import { SEED_EDGES, SEED_NODES } from "@/lib/ontology/seed/core-triples";
import { TASK_OVERLAY_EDGES, TASK_OVERLAY_NODES } from "@/lib/ontology/seed/task-overlay-2026-10";
import type { TaskId } from "@/lib/task-scenario-profiles";

export type InjectionGraph = Readonly<{
  nodes: readonly OntologyNode[];
  edges: readonly OntologyEdge[];
}>;

/** 작업 분류 TaskId → 온톨로지 Task 라벨(정확 일치). 표에 없으면 주입하지 않는다. */
const TASK_LABELS_BY_ID: Readonly<Partial<Record<TaskId, readonly string[]>>> = {
  press: ["프레스 금형 교체"],
  excavation: ["굴착 작업"],
  "manual-loading-heat": ["하역·운반", "폭염 작업"],
  "confined-space": ["밀폐공간 작업"],
  "pump-confined": ["밀폐공간 작업"],
  "crane-lifting": ["크레인 양중"],
  "forklift-logistics": ["지게차 상하차"],
  hotwork: ["화기 작업", "용접"],
  "scaffold-assembly": ["비계 조립·해체"],
  "exterior-painting": ["도장(스프레이)"],
  "work-at-height": ["고소작업"],
  "aerial-work-platform": ["고소작업"],
  roof: ["고소작업"],
  electrical: ["전기 작업"]
};

const HEAT_LAYER_LABEL = "폭염·고온";
const HEAT_TASK_LABEL = "폭염 작업";

export function resolveInjectionTaskLabels(input: {
  taskId: TaskId | null | undefined;
  layers: readonly string[];
}): string[] {
  const labels = input.taskId ? [...(TASK_LABELS_BY_ID[input.taskId] || [])] : [];
  if (input.layers.includes(HEAT_LAYER_LABEL) && !labels.includes(HEAT_TASK_LABEL)) labels.push(HEAT_TASK_LABEL);
  return labels;
}

function publishedOnly<T extends { review_state: string }>(items: readonly T[]): T[] {
  return items.filter((item) => item.review_state === "published");
}

/**
 * DB published 그래프(없으면 null)와 시드·overlay 를 합친다. node_id 가 겹치면 먼저 들어온 것(DB)이 남는다.
 * 어느 원천이든 review_state === "published" 가 아니면 버린다.
 */
export function assembleInjectionGraph(
  dbGraph: Pick<OntologyGraph, "nodes" | "edges"> | { nodes: unknown[]; edges: unknown[] } | null
): InjectionGraph {
  const seed = assembleGraph(
    [...SEED_NODES, ...TASK_OVERLAY_NODES] as unknown[],
    [...SEED_EDGES, ...TASK_OVERLAY_EDGES] as unknown[]
  );
  const db = dbGraph ? assembleGraph(dbGraph.nodes as unknown[], dbGraph.edges as unknown[]) : null;
  const nodes = new Map<string, OntologyNode>();
  for (const node of publishedOnly([...(db?.nodes || []), ...seed.nodes])) {
    if (!nodes.has(node.node_id)) nodes.set(node.node_id, node);
  }
  const edges = new Map<string, OntologyEdge>();
  for (const edge of publishedOnly([...(db?.edges || []), ...seed.edges])) {
    if (!nodes.has(edge.src) || !nodes.has(edge.dst)) continue;
    const key = `${edge.src}|${edge.rel}|${edge.dst}`;
    if (!edges.has(key)) edges.set(key, edge);
  }
  return { nodes: [...nodes.values()], edges: [...edges.values()] };
}

export async function loadInjectionGraph(signal?: AbortSignal): Promise<InjectionGraph> {
  try {
    const loaded = await loadGraph("published", signal);
    return assembleInjectionGraph(loaded.ok && loaded.graph ? loaded.graph : null);
  } catch (error) {
    signal?.throwIfAborted();
    void error;
    return assembleInjectionGraph(null);
  }
}

function targets(edges: readonly OntologyEdge[], src: string, rel: OntologyEdge["rel"]): string[] {
  return edges.filter((edge) => edge.src === src && edge.rel === rel).map((edge) => edge.dst);
}

function articleEvidence(node: OntologyNode): OntologyControlEvidence["articles"][number] | null {
  const meta = node.meta as Record<string, unknown>;
  const law = typeof meta.law === "string" ? meta.law : null;
  const articleNo = typeof meta.article_no === "string"
    ? meta.article_no
    : (node.label.match(/제(\d+조(?:의\d+)?)/)?.[1]?.replace(/조$/, "") ?? null);
  if (!law || !articleNo) return null;
  return { nodeId: node.node_id, label: node.label, law, articleNo };
}

/**
 * Task 라벨 정확 일치 → published 경로만 따라 Control 1건 = 근거 1건으로 돌려준다.
 * 조문이 하나도 연결되지 않은 Control 은 근거로 쓰지 않는다(조문 매핑이 패킷의 전제다).
 */
export function buildOntologyGroundingSources(
  graph: InjectionGraph,
  taskLabels: readonly string[]
): OntologyControlEvidence[] {
  const byId = new Map(graph.nodes.map((node) => [node.node_id, node]));
  const seen = new Map<string, OntologyControlEvidence>();
  for (const label of taskLabels) {
    const tasks = graph.nodes.filter((node) => node.kind === "Task" && node.label === label);
    for (const task of tasks) {
      for (const hazardId of targets(graph.edges, task.node_id, "entailsHazard")) {
        const hazard = byId.get(hazardId);
        if (!hazard || hazard.kind !== "Hazard") continue;
        for (const controlId of targets(graph.edges, hazardId, "mitigatedBy")) {
          const control = byId.get(controlId);
          if (!control || control.kind !== "Control" || seen.has(controlId)) continue;
          const articles = targets(graph.edges, controlId, "mandatedBy")
            .map((articleId) => byId.get(articleId))
            .filter((node): node is OntologyNode => Boolean(node && node.kind === "Article"))
            .map(articleEvidence)
            .filter((article): article is NonNullable<typeof article> => article !== null)
            .sort((left, right) => left.nodeId.localeCompare(right.nodeId, "ko"));
          if (articles.length === 0) continue;
          seen.set(controlId, {
            controlId,
            controlLabel: control.label,
            taskLabel: task.label,
            hazardLabel: hazard.label,
            articles
          });
        }
      }
    }
  }
  return [...seen.values()].sort((left, right) => left.controlId.localeCompare(right.controlId, "ko"));
}
