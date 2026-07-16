import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { ontologyNodeSchema, ontologyEdgeSchema, parseCitedUid } from "@/lib/ontology/schema";
import { assembleGraph } from "@/lib/ontology/graph-store";
import { SEED_NODES, SEED_EDGES, SEED_STATS, SEED_SOURCE } from "@/lib/ontology/seed/core-triples";
import { SIF_ACCIDENT_EDGES, SIF_ACCIDENT_NODES } from "@/lib/ontology/seed/sif-accident-overlay";

// 원본 감수 문서(온톨로지_시드트리플_감수용_v1.md)의 확정 수치.
// 문서 헤더 기준 트리플 188로 표기됐으나 표 실측은 190행 (문서 카운트 오차) —
// 파서 실측: 높음 177 / 중간 13, 엣지 dedup(동일 src|rel|dst 병합) 8건 → 182 엣지.
const SOURCE_ROWS = 190;
const SOURCE_HIGH = 177;
const SOURCE_MEDIUM = 13;
const SIF_CORPUS_HASH = "2712c6eafd24962588293749bb12d249cf761972dcdea7b249f16efea76b8f3e";

const SIF_ACCIDENTS = [
  {
    itemId: "sif-아카이브-건설업-00323",
    hazardId: "Hazard_추락",
    contentHash: "e6035abf293df3d2b5d4a59083c1276955f8f47ee7c37743bc0646d185dea770",
    excerpt:
      "2021년 03월경 ○○현장에서 피재자가 멍에(각관)설치상태 확인을 위해 발붙임 겸용 신축형 사다리(A형) 최상부 디딘대(9단)에 올라가 확인 하던 중 2.5m 아래 바닥으로 떨어져 사망"
  },
  {
    itemId: "sif-아카이브-건설업-00024",
    hazardId: "Hazard_충돌_협착_끼임",
    contentHash: "4ae1315616343d8dcc50385276c2d6d847a6f5be613c2825fabdf2525cfc288f",
    excerpt:
      "2017년 12월경 ○○ 신축공사 현장에서 굴삭기 후미로 이동하던 설비 작업자가 회전하는 굴삭기 몸체 후미와 콘크리트 구조물 사이에 협착되어 쓰러져 있는 재해자를 주변 근로자가 발견하여 119에 연락 응급조치 및 병원으로 후송 하였으나 사망"
  },
  {
    itemId: "sif-아카이브-건설업-01798",
    hazardId: "Hazard_감전_직접_간접_접촉",
    contentHash: "ba16f6e2587914f70b8a37d1f7b95e0b3ab8b29e8debea6570141cf1b8c3374a",
    excerpt: "2021년 07월경 ○○현장에서 수·변전반 결선작업 중 380V 노출충전부에 신체가 접촉되어 감전 사망"
  }
] as const;

describe("시드 파싱 무결성 — 원본 감수 문서와 수치 일치", () => {
  test("원본 행 수(높음/중간)가 SEED_STATS와 일치한다", () => {
    expect(SEED_STATS.source_rows).toBe(SOURCE_ROWS);
    expect(SEED_STATS.source_rows_high).toBe(SOURCE_HIGH);
    expect(SEED_STATS.source_rows_medium).toBe(SOURCE_MEDIUM);
  });

  test("엣지의 원본 행 합계(meta.source_rows)가 원본 총행과 일치한다 — 유실 없음", () => {
    const totalRows = SEED_EDGES.reduce((sum, e) => {
      const rows = e.meta && typeof e.meta === "object" ? (e.meta as Record<string, unknown>).source_rows : 1;
      return sum + (typeof rows === "number" ? rows : 0);
    }, 0);
    expect(totalRows).toBe(SOURCE_ROWS);
  });

  test("확신도 반영: 중간 엣지는 전부 draft + meta.confidence='medium', 높음 엣지는 published", () => {
    const sourceEdges = SEED_EDGES.filter((e) => typeof (e.meta as Record<string, unknown>).source_rows === "number");
    const drafts = sourceEdges.filter((e) => e.review_state === "draft");
    const published = SEED_EDGES.filter((e) => e.review_state === "published");
    expect(drafts.length).toBe(SOURCE_MEDIUM);
    expect(drafts.every((e) => (e.meta as Record<string, unknown>).confidence === "medium")).toBe(true);
    expect(published.length + drafts.length).toBe(sourceEdges.length);
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

  test("SIF 사고 overlay는 원문 사고개요와 hash provenance만 가진 draft Accident다", () => {
    for (const expected of SIF_ACCIDENTS) {
      const node = SEED_NODES.find(
        (candidate) => candidate.kind === "Accident" && candidate.cited_uids.includes(`ref:safety_reference_items:${expected.itemId}`)
      );
      expect(node, expected.itemId).toBeDefined();
      expect(node).toMatchObject({
        kind: "Accident",
        text_excerpt: expected.excerpt,
        cited_uids: [`ref:safety_reference_items:${expected.itemId}`],
        review_state: "draft",
        meta: {
          source_item_id: expected.itemId,
          content_hash: expected.contentHash,
          corpus_hash: SIF_CORPUS_HASH,
          evidence_role: "hazard_priority_only",
          llm_role: "naturalize_only"
        }
      });
      expect(JSON.stringify(node)).not.toMatch(/controls?|mitigatedBy/i);
    }
  });

  test("SIF 사고 overlay는 Hazard-evidencedBy-Accident draft edge만 추가한다", () => {
    const accidentIds = new Set(
      SEED_NODES.filter((node) =>
        SIF_ACCIDENTS.some((expected) => node.cited_uids.includes(`ref:safety_reference_items:${expected.itemId}`))
      ).map((node) => node.node_id)
    );
    const overlayEdges = SEED_EDGES.filter((edge) => accidentIds.has(edge.dst));

    expect(accidentIds.size).toBe(SIF_ACCIDENTS.length);
    expect(overlayEdges).toHaveLength(SIF_ACCIDENTS.length);
    for (const expected of SIF_ACCIDENTS) {
      const citedUid = `ref:safety_reference_items:${expected.itemId}`;
      expect(overlayEdges).toContainEqual(
        expect.objectContaining({
          src: expected.hazardId,
          rel: "evidencedBy",
          cited_uids: [citedUid],
          review_state: "draft",
          meta: expect.objectContaining({
            source_item_id: expected.itemId,
            evidence_role: "hazard_priority_only",
            llm_role: "naturalize_only"
          })
        })
      );
    }
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

  test("core-triples.json 본체와 SIF overlay가 TS 상수에 유실 없이 합성된다", () => {
    const jsonPath = path.resolve(__dirname, "..", "lib", "ontology", "seed", "core-triples.json");
    const raw = JSON.parse(readFileSync(jsonPath, "utf-8")) as {
      source: string;
      nodes: unknown[];
      edges: unknown[];
    };
    expect(raw.source).toBe(SEED_SOURCE);
    expect([...raw.nodes, ...SIF_ACCIDENT_NODES]).toEqual(SEED_NODES);
    expect([...raw.edges, ...SIF_ACCIDENT_EDGES]).toEqual(SEED_EDGES);
  });
});
