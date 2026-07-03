import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { ontologyNodeSchema, ontologyEdgeSchema, parseCitedUid } from "@/lib/ontology/schema";
import { assembleGraph } from "@/lib/ontology/graph-store";
import { SEED_NODES, SEED_EDGES, SEED_STATS, SEED_SOURCE } from "@/lib/ontology/seed/core-triples";

// 원본 감수 문서(온톨로지_시드트리플_감수용_v1.md)의 확정 수치.
// 문서 헤더 기준 트리플 188로 표기됐으나 표 실측은 190행 (문서 카운트 오차) —
// 파서 실측: 높음 177 / 중간 13, 엣지 dedup(동일 src|rel|dst 병합) 8건 → 182 엣지.
const SOURCE_ROWS = 190;
const SOURCE_HIGH = 177;
const SOURCE_MEDIUM = 13;

describe("시드 파싱 무결성 — 원본 감수 문서와 수치 일치", () => {
  test("원본 행 수(높음/중간)가 SEED_STATS와 일치한다", () => {
    expect(SEED_STATS.source_rows).toBe(SOURCE_ROWS);
    expect(SEED_STATS.source_rows_high).toBe(SOURCE_HIGH);
    expect(SEED_STATS.source_rows_medium).toBe(SOURCE_MEDIUM);
  });

  test("엣지의 원본 행 합계(meta.source_rows)가 원본 총행과 일치한다 — 유실 없음", () => {
    const totalRows = SEED_EDGES.reduce((sum, e) => {
      const rows = e.meta && typeof e.meta === "object" ? (e.meta as Record<string, unknown>).source_rows : 1;
      return sum + (typeof rows === "number" ? rows : 1);
    }, 0);
    expect(totalRows).toBe(SOURCE_ROWS);
  });

  test("확신도 반영: 중간 엣지는 전부 draft + meta.confidence='medium', 높음 엣지는 published", () => {
    const drafts = SEED_EDGES.filter((e) => e.review_state === "draft");
    const published = SEED_EDGES.filter((e) => e.review_state === "published");
    expect(drafts.length).toBe(SOURCE_MEDIUM);
    expect(drafts.every((e) => (e.meta as Record<string, unknown>).confidence === "medium")).toBe(true);
    expect(published.length + drafts.length).toBe(SEED_EDGES.length);
    expect(published.every((e) => (e.meta as Record<string, unknown>).confidence === undefined)).toBe(true);
  });

  test("통계 자기 일관성 (노드/엣지 수, published/draft 분할)", () => {
    expect(SEED_NODES.length).toBe(SEED_STATS.nodes);
    expect(SEED_EDGES.length).toBe(SEED_STATS.edges);
    expect(SEED_NODES.filter((n) => n.review_state === "published").length).toBe(SEED_STATS.published_nodes);
    expect(SEED_EDGES.filter((e) => e.review_state === "published").length).toBe(SEED_STATS.published_edges);
    expect(SEED_STATS.nodes_by_kind.Task).toBe(10); // 고빈도 작업 10종
  });
});

describe("시드 데이터 스키마·provenance 무결성", () => {
  test("모든 노드/엣지가 zod 스키마를 통과한다", () => {
    for (const n of SEED_NODES) {
      const parsed = ontologyNodeSchema.safeParse(n);
      expect(parsed.success, `node ${n.node_id}`).toBe(true);
    }
    for (const e of SEED_EDGES) {
      const parsed = ontologyEdgeSchema.safeParse(e);
      expect(parsed.success, `edge ${e.src}|${e.rel}|${e.dst}`).toBe(true);
    }
  });

  test("무출처 없음: 모든 노드/엣지 cited_uids ≥ 1", () => {
    expect(SEED_NODES.every((n) => n.cited_uids.length >= 1)).toBe(true);
    expect(SEED_EDGES.every((e) => e.cited_uids.length >= 1)).toBe(true);
  });

  test("Article 노드는 전부 law: uid를 갖고 node_id가 조문 식별 형식이다", () => {
    const articles = SEED_NODES.filter((n) => n.kind === "Article");
    expect(articles.length).toBeGreaterThan(40);
    for (const a of articles) {
      expect(a.node_id, a.node_id).toMatch(/^Article_기준규칙_\d+(의\d+)?$/);
      const lawUids = a.cited_uids.filter((uid) => {
        const parsed = parseCitedUid(uid);
        return parsed?.namespace === "law" && parsed.lawName === "산업안전보건기준에 관한 규칙";
      });
      expect(lawUids.length, a.node_id).toBeGreaterThanOrEqual(1);
    }
    // 밀폐공간 사건 해소분 대표 조문
    expect(articles.map((a) => a.node_id)).toContain("Article_기준규칙_619");
  });

  test("dangling 없음: 모든 엣지 양 끝이 시드 노드에 존재하고 엣지 (src,rel,dst) 유일", () => {
    const ids = new Set(SEED_NODES.map((n) => n.node_id));
    const keys = new Set<string>();
    for (const e of SEED_EDGES) {
      expect(ids.has(e.src), e.src).toBe(true);
      expect(ids.has(e.dst), e.dst).toBe(true);
      const key = `${e.src}|${e.rel}|${e.dst}`;
      expect(keys.has(key), key).toBe(false);
      keys.add(key);
    }
  });

  test("published 엣지의 양 끝 노드는 published (published 그래프 단절 없음)", () => {
    const stateById = new Map(SEED_NODES.map((n) => [n.node_id, n.review_state]));
    for (const e of SEED_EDGES.filter((e) => e.review_state === "published")) {
      expect(stateById.get(e.src), e.src).toBe("published");
      expect(stateById.get(e.dst), e.dst).toBe("published");
    }
  });

  test("전체 시드가 assembleGraph 게이트에서 하나도 드롭되지 않는다", () => {
    const graph = assembleGraph([...SEED_NODES], [...SEED_EDGES]);
    expect(graph.counts.uncited_dropped_nodes).toBe(0);
    expect(graph.counts.uncited_dropped_edges).toBe(0);
    expect(graph.counts.dangling_dropped_edges).toBe(0);
    expect(graph.counts.nodes).toBe(SEED_NODES.length);
    expect(graph.counts.edges).toBe(SEED_EDGES.length);
  });

  test("Document 노드 meta.smsa_key가 lib/smsa-mapping.ts 키와 1:1", async () => {
    const { SMSA_ARTICLE_MAP } = await import("@/lib/smsa-mapping");
    const documents = SEED_NODES.filter((n) => n.kind === "Document");
    expect(documents.length).toBeGreaterThan(0);
    for (const d of documents) {
      const key = (d.meta as Record<string, unknown>).smsa_key;
      expect(typeof key).toBe("string");
      expect(SMSA_ARTICLE_MAP[key as string], `smsa key ${String(key)}`).toBeTruthy();
    }
  });

  test("core-triples.json과 TS 상수가 동기 상태다", () => {
    const jsonPath = path.resolve(__dirname, "..", "lib", "ontology", "seed", "core-triples.json");
    const raw = JSON.parse(readFileSync(jsonPath, "utf-8")) as {
      source: string;
      nodes: unknown[];
      edges: unknown[];
    };
    expect(raw.source).toBe(SEED_SOURCE);
    expect(raw.nodes).toEqual(SEED_NODES);
    expect(raw.edges).toEqual(SEED_EDGES);
  });
});
