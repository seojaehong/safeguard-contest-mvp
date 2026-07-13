import { afterEach, describe, expect, test, vi } from "vitest";
import { assembleGraph, ADVISORY_NOTICE, loadGraph } from "@/lib/ontology/graph-store";

const MANUAL = "manual:온톨로지_시드트리플_감수용_v1";

afterEach(() => {
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  vi.unstubAllGlobals();
});

function node(nodeId: string, kind: string, citedUids: string[] = [MANUAL]) {
  return {
    node_id: nodeId,
    kind,
    label: nodeId,
    text_excerpt: null,
    cited_uids: citedUids,
    meta: {},
    review_state: "published"
  };
}

function edge(src: string, rel: string, dst: string, citedUids: string[] = [MANUAL]) {
  return { src, rel, dst, cited_uids: citedUids, meta: {}, review_state: "published" };
}

describe("assembleGraph — provenance 게이트", () => {
  test("cited_uids가 빈 노드는 드롭되고 uncited_dropped에 카운트된다", () => {
    const graph = assembleGraph(
      [node("Task_a", "Task"), node("Hazard_b", "Hazard", [])],
      [edge("Task_a", "entailsHazard", "Hazard_b")]
    );
    expect(graph.counts.nodes).toBe(1);
    expect(graph.counts.uncited_dropped_nodes).toBe(1);
    expect(graph.uncited_dropped.nodes).toEqual(["Hazard_b"]);
    // 드롭된 노드에 걸린 엣지는 dangling으로 함께 드롭
    expect(graph.counts.edges).toBe(0);
    expect(graph.counts.dangling_dropped_edges).toBe(1);
  });

  test("무출처 엣지는 드롭되고 카운트된다", () => {
    const graph = assembleGraph(
      [node("Task_a", "Task"), node("Hazard_b", "Hazard")],
      [edge("Task_a", "entailsHazard", "Hazard_b", [])]
    );
    expect(graph.counts.edges).toBe(0);
    expect(graph.counts.uncited_dropped_edges).toBe(1);
    expect(graph.uncited_dropped.edges).toEqual(["Task_a|entailsHazard|Hazard_b"]);
  });

  test("스키마 위반 행(미상 kind/uid 형식 위반)도 드롭 카운트에 잡힌다", () => {
    const graph = assembleGraph(
      [node("Task_a", "Task"), { ...node("X_bad", "Issue"), cited_uids: [MANUAL] }],
      [{ ...edge("Task_a", "entailsHazard", "Task_a"), cited_uids: ["bogus-uid"] }]
    );
    expect(graph.counts.nodes).toBe(1);
    expect(graph.counts.uncited_dropped_nodes).toBe(1);
    expect(graph.counts.uncited_dropped_edges).toBe(1);
  });

  test("정상 그래프는 counts/by_kind/advisory_notice 계약을 채운다", () => {
    const graph = assembleGraph(
      [node("Task_a", "Task"), node("Hazard_b", "Hazard"), node("Control_c", "Control")],
      [edge("Task_a", "entailsHazard", "Hazard_b"), edge("Hazard_b", "mitigatedBy", "Control_c")]
    );
    expect(graph.counts.nodes).toBe(3);
    expect(graph.counts.edges).toBe(2);
    expect(graph.counts.nodes_by_kind.Task).toBe(1);
    expect(graph.counts.nodes_by_kind.Hazard).toBe(1);
    expect(graph.counts.nodes_by_kind.Accident).toBe(0);
    expect(graph.counts.uncited_dropped_nodes).toBe(0);
    expect(graph.advisory_notice).toBe(ADVISORY_NOTICE);
    // 정렬 안정성 (node_id 기준)
    expect(graph.nodes.map((n) => n.node_id)).toEqual(["Control_c", "Hazard_b", "Task_a"]);
  });
});

describe("loadGraph — bounded published snapshot", () => {
  test("aborts never-settling Supabase fetches and returns a sanitized deadline result", async () => {
    process.env.SUPABASE_URL = "https://ontology.example.test";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "PRIVATE_GRAPH_KEY";
    const signals: AbortSignal[] = [];
    vi.stubGlobal("fetch", vi.fn((_url: string | URL | Request, init?: RequestInit) => {
      if (init?.signal) signals.push(init.signal);
      return new Promise<Response>(() => undefined);
    }));

    const result = await loadGraph("published", { timeoutMs: 10 });

    expect(result).toMatchObject({
      ok: false,
      configured: true,
      graph: null,
      errorCode: "ontology_deadline_exceeded"
    });
    expect(result.message).not.toContain("PRIVATE_GRAPH_KEY");
    expect(signals).toHaveLength(2);
    expect(signals.every((signal) => signal.aborted)).toBe(true);
  }, 500);
});
