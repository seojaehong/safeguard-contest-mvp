// 안전 온톨로지 그래프 스토어 — Supabase 읽기/쓰기 + 그래프 JSON 조립.
// 계약(기후 온톨로지 이식): nodes/edges/counts/uncited_dropped/advisory_notice.
// 불변식:
//   - 노출 게이트: anon 노출 경로(loadGraph scope:"published")는 published만 조회
//   - provenance 게이트: cited_uids가 빈 노드/엣지는 조립 단계에서 드롭 + 카운트
//   - 엔드포인트가 드롭·부재한 엣지도 드롭 (dangling 방지)
// 쓰기는 service role 전용 (upsertOntology) — REST upsert, idempotent.

import {
  ontologyNodeSchema,
  ontologyEdgeSchema,
  NODE_KINDS,
  type NodeKind,
  type OntologyNode,
  type OntologyEdge
} from "@/lib/ontology/schema";
import {
  isOntologyDeadlineError,
  withOntologyDeadline,
  type OntologyDeadlineCode,
} from "@/lib/ontology/deadline";
import { resolveOntologyGraphTimeoutMs } from "@/lib/ontology-deadline-policy";

export type OntologyGraph = {
  nodes: OntologyNode[];
  edges: OntologyEdge[];
  counts: {
    nodes: number;
    edges: number;
    nodes_by_kind: Record<NodeKind, number>;
    uncited_dropped_nodes: number;
    uncited_dropped_edges: number;
    dangling_dropped_edges: number;
  };
  uncited_dropped: {
    nodes: string[];
    edges: string[];
  };
  advisory_notice: string;
};

export type GraphScope = "published" | "all";

export type GraphLoadResult = {
  ok: boolean;
  configured: boolean;
  scope: GraphScope;
  graph: OntologyGraph | null;
  message: string;
  errorCode?: OntologyDeadlineCode | "ontology_graph_load_failed";
};

export type GraphLoadOptions = {
  timeoutMs?: number;
  signal?: AbortSignal;
};

export type UpsertResult = {
  ok: boolean;
  configured: boolean;
  nodesUpserted: number;
  edgesUpserted: number;
  message: string;
};

export const ADVISORY_NOTICE =
  "본 그래프는 전문가 검토를 거친 안전 온톨로지 조회 결과이며 참고용입니다. 법적 판단은 원문 법령과 현장 확인을 거쳐야 합니다.";

type SupabaseConfig = {
  url: string;
  serviceRoleKey: string;
};

function getSupabaseConfig(): SupabaseConfig | null {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return null;
  return { url: url.replace(/\/$/, ""), serviceRoleKey };
}

function emptyKindCounts(): Record<NodeKind, number> {
  return Object.fromEntries(NODE_KINDS.map((kind) => [kind, 0])) as Record<NodeKind, number>;
}

/**
 * 그래프 JSON 조립 (순수 함수).
 * 1) zod 검증 실패·무출처(cited_uids 빈) 노드 드롭 + uncited_dropped 기록
 * 2) 무출처 엣지 드롭
 * 3) 살아남은 노드 집합에 양 끝이 없는 엣지 드롭 (dangling)
 */
export function assembleGraph(rawNodes: unknown[], rawEdges: unknown[]): OntologyGraph {
  const nodes: OntologyNode[] = [];
  const uncitedNodeIds: string[] = [];
  for (const raw of rawNodes) {
    const parsed = ontologyNodeSchema.safeParse(raw);
    if (!parsed.success) {
      const nodeId = extractId(raw, "node_id");
      uncitedNodeIds.push(nodeId);
      continue;
    }
    if (parsed.data.cited_uids.length === 0) {
      uncitedNodeIds.push(parsed.data.node_id);
      continue;
    }
    nodes.push(parsed.data);
  }

  const nodeIds = new Set(nodes.map((n) => n.node_id));
  const edges: OntologyEdge[] = [];
  const uncitedEdgeKeys: string[] = [];
  let danglingDropped = 0;
  for (const raw of rawEdges) {
    const parsed = ontologyEdgeSchema.safeParse(raw);
    if (!parsed.success) {
      uncitedEdgeKeys.push(extractEdgeKey(raw));
      continue;
    }
    const edge = parsed.data;
    if (edge.cited_uids.length === 0) {
      uncitedEdgeKeys.push(`${edge.src}|${edge.rel}|${edge.dst}`);
      continue;
    }
    if (!nodeIds.has(edge.src) || !nodeIds.has(edge.dst)) {
      danglingDropped += 1;
      continue;
    }
    edges.push(edge);
  }

  nodes.sort((a, b) => a.node_id.localeCompare(b.node_id, "ko"));
  edges.sort((a, b) =>
    `${a.src}|${a.rel}|${a.dst}`.localeCompare(`${b.src}|${b.rel}|${b.dst}`, "ko")
  );

  const nodesByKind = emptyKindCounts();
  for (const node of nodes) nodesByKind[node.kind] += 1;

  return {
    nodes,
    edges,
    counts: {
      nodes: nodes.length,
      edges: edges.length,
      nodes_by_kind: nodesByKind,
      uncited_dropped_nodes: uncitedNodeIds.length,
      uncited_dropped_edges: uncitedEdgeKeys.length,
      dangling_dropped_edges: danglingDropped
    },
    uncited_dropped: { nodes: uncitedNodeIds, edges: uncitedEdgeKeys },
    advisory_notice: ADVISORY_NOTICE
  };
}

function extractId(raw: unknown, key: string): string {
  if (typeof raw === "object" && raw !== null && key in raw) {
    const value = (raw as Record<string, unknown>)[key];
    if (typeof value === "string") return value;
  }
  return "(unknown)";
}

function extractEdgeKey(raw: unknown): string {
  return `${extractId(raw, "src")}|${extractId(raw, "rel")}|${extractId(raw, "dst")}`;
}

async function fetchRows(
  config: SupabaseConfig,
  table: string,
  scope: GraphScope,
  signal: AbortSignal,
): Promise<unknown[]> {
  const params = new URLSearchParams();
  params.set("select", "*");
  params.set("limit", "10000");
  if (scope === "published") params.set("review_state", "eq.published");
  const response = await fetch(`${config.url}/rest/v1/${table}?${params.toString()}`, {
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`
    },
    cache: "no-store",
    signal
  });
  if (!response.ok) {
    const error = new Error(`${table} request failed with status ${response.status}.`);
    error.name = "OntologyGraphFetchError";
    throw error;
  }
  const data = (await response.json()) as unknown;
  return Array.isArray(data) ? data : [];
}

/**
 * Supabase에서 그래프를 읽어 조립한다.
 * scope "published": anon 노출 경로 — published만. "all": 운영/검증용(서비스롤 전제).
 */
export async function loadGraph(
  scope: GraphScope = "published",
  options: GraphLoadOptions = {},
): Promise<GraphLoadResult> {
  const config = getSupabaseConfig();
  if (!config) {
    return {
      ok: false,
      configured: false,
      scope,
      graph: null,
      message: "Supabase service role key가 없어 온톨로지 그래프를 조회하지 않았습니다."
    };
  }
  try {
    const [rawNodes, rawEdges] = await withOntologyDeadline(
      (signal) => Promise.all([
        fetchRows(config, "safety_ontology_nodes", scope, signal),
        fetchRows(config, "safety_ontology_edges", scope, signal)
      ]),
      {
        timeoutMs: resolveOntologyGraphTimeoutMs(
          options.timeoutMs,
          process.env.ONTOLOGY_GRAPH_TIMEOUT_MS,
        ),
        signal: options.signal,
      },
    );
    return {
      ok: true,
      configured: true,
      scope,
      graph: assembleGraph(rawNodes, rawEdges),
      message: `안전 온톨로지 그래프 조회 완료 (scope=${scope}).`
    };
  } catch (error) {
    const errorCode = isOntologyDeadlineError(error)
      ? error.code
      : "ontology_graph_load_failed";
    return {
      ok: false,
      configured: true,
      scope,
      graph: null,
      message: errorCode === "ontology_deadline_exceeded"
        ? "온톨로지 그래프 조회 제한시간을 초과했습니다."
        : errorCode === "ontology_request_aborted"
          ? "온톨로지 그래프 조회가 중단되었습니다."
          : "온톨로지 그래프 조회 중 오류가 발생했습니다.",
      errorCode
    };
  }
}

async function upsertRows(
  config: SupabaseConfig,
  table: string,
  onConflict: string,
  rows: Record<string, unknown>[]
): Promise<void> {
  if (rows.length === 0) return;
  const response = await fetch(`${config.url}/rest/v1/${table}?on_conflict=${encodeURIComponent(onConflict)}`, {
    method: "POST",
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      "content-type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal"
    },
    body: JSON.stringify(rows)
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`${table} upsert 실패: ${response.status} ${body}`);
  }
}

/**
 * 노드/엣지 upsert (service role 전용, idempotent).
 * 노드 먼저(FK) → 엣지. 입력은 zod 검증을 통과해야 하며 무출처 입력은 거부한다.
 */
export async function upsertOntology(
  nodes: readonly unknown[],
  edges: readonly unknown[]
): Promise<UpsertResult> {
  const config = getSupabaseConfig();
  if (!config) {
    return {
      ok: false,
      configured: false,
      nodesUpserted: 0,
      edgesUpserted: 0,
      message: "Supabase service role key가 없어 온톨로지 적재를 실행하지 않았습니다."
    };
  }
  const parsedNodes: OntologyNode[] = [];
  for (const raw of nodes) {
    const parsed = ontologyNodeSchema.safeParse(raw);
    if (!parsed.success || parsed.data.cited_uids.length === 0) {
      return {
        ok: false,
        configured: true,
        nodesUpserted: 0,
        edgesUpserted: 0,
        message: `무출처 또는 스키마 위반 노드는 적재할 수 없습니다: ${extractId(raw, "node_id")}`
      };
    }
    parsedNodes.push(parsed.data);
  }
  const parsedEdges: OntologyEdge[] = [];
  for (const raw of edges) {
    const parsed = ontologyEdgeSchema.safeParse(raw);
    if (!parsed.success || parsed.data.cited_uids.length === 0) {
      return {
        ok: false,
        configured: true,
        nodesUpserted: 0,
        edgesUpserted: 0,
        message: `무출처 또는 스키마 위반 엣지는 적재할 수 없습니다: ${extractEdgeKey(raw)}`
      };
    }
    parsedEdges.push(parsed.data);
  }
  try {
    await upsertRows(
      config,
      "safety_ontology_nodes",
      "node_id",
      parsedNodes.map((n) => ({ ...n }))
    );
    await upsertRows(
      config,
      "safety_ontology_edges",
      "src,rel,dst",
      parsedEdges.map((e) => ({ ...e }))
    );
    return {
      ok: true,
      configured: true,
      nodesUpserted: parsedNodes.length,
      edgesUpserted: parsedEdges.length,
      message: `온톨로지 적재 완료: 노드 ${parsedNodes.length} / 엣지 ${parsedEdges.length}.`
    };
  } catch (error) {
    return {
      ok: false,
      configured: true,
      nodesUpserted: 0,
      edgesUpserted: 0,
      message: error instanceof Error ? error.message : "온톨로지 적재 중 오류가 발생했습니다."
    };
  }
}
