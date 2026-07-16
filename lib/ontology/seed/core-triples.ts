// 자동 생성 파일 — 직접 수정 금지.
// 생성: node scripts/ontology/gen-seed-from-md.mjs <온톨로지_시드트리플_감수용_v1.md>
// 원본: 노무사 감수용 시드 트리플 문서 (확신도 높음 → published, 중간 → draft+confidence:"medium")
// core-triples.json과 반드시 동기 상태여야 한다 (tests/ontology-seed.test.ts가 검증).
import type { OntologyNodeInput, OntologyEdgeInput } from "@/lib/ontology/schema";
import seed from "./core-triples.json";
import { SIF_ACCIDENT_EDGES, SIF_ACCIDENT_NODES } from "./sif-accident-overlay";

export const SEED_SOURCE = seed.source;

export type SeedStats = {
  source_rows: number;
  source_rows_high: number;
  source_rows_medium: number;
  nodes: number;
  edges: number;
  published_nodes: number;
  draft_nodes: number;
  published_edges: number;
  draft_edges: number;
  nodes_by_kind: Record<string, number>;
};

const CORE_NODES = seed.nodes as OntologyNodeInput[];
const CORE_EDGES = seed.edges as OntologyEdgeInput[];

export const SEED_NODES: OntologyNodeInput[] = [...CORE_NODES, ...SIF_ACCIDENT_NODES];

export const SEED_EDGES: OntologyEdgeInput[] = [...CORE_EDGES, ...SIF_ACCIDENT_EDGES];

export const SEED_STATS: SeedStats = {
  ...seed.stats,
  nodes: SEED_NODES.length,
  edges: SEED_EDGES.length,
  draft_nodes: seed.stats.draft_nodes + SIF_ACCIDENT_NODES.length,
  draft_edges: seed.stats.draft_edges + SIF_ACCIDENT_EDGES.length,
  nodes_by_kind: {
    ...seed.stats.nodes_by_kind,
    Accident:
      ((seed.stats.nodes_by_kind as Record<string, number>).Accident ?? 0) + SIF_ACCIDENT_NODES.length
  }
};
