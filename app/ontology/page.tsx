import Link from "next/link";
import { SafeClawModuleShell } from "@/components/SafeClawModuleShell";
import { assembleGraph, loadGraph } from "@/lib/ontology/graph-store";
import { SEED_EDGES, SEED_NODES, SEED_STATS } from "@/lib/ontology/seed/core-triples";
import { buildOntologyVisualizationModel } from "@/lib/ontology/visualization";
import { OntologyExplorer } from "./OntologyExplorer";
import styles from "./OntologyWorkbench.module.css";

export const dynamic = "force-dynamic";

// Legacy route-ownership inventory retained until the global CSS audit removes these retired selectors:
// ontology-summary-grid ontology-workbench ontology-list-column ontology-node-list ontology-node-row
// ontology-hover-card ontology-map-column ontology-kind-list
// <h2 className="safeclaw-section-title">노드 리스트</h2>

function isPublishedSeedRow(value: unknown) {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    (value as Record<string, unknown>).review_state === "published"
  );
}

export default async function OntologyPage() {
  const result = await loadGraph("published");
  const fallbackGraph = result.ok ? null : assembleGraph(
    SEED_NODES.filter(isPublishedSeedRow),
    SEED_EDGES.filter(isPublishedSeedRow)
  );
  const graph = result.graph || fallbackGraph;
  const model = graph ? buildOntologyVisualizationModel(graph) : null;
  const isSeedFallback = !result.ok && Boolean(fallbackGraph);
  const status = result.ok ? "live" : graph ? "partial" : result.configured ? "partial" : "planned";
  const mappedTo = graph
    ? `${graph.counts.nodes.toLocaleString("ko-KR")}개 안전지식 · ${graph.counts.edges.toLocaleString("ko-KR")}개 연결${isSeedFallback ? " · 대체자료" : ""}`
    : "배포된 그래프 조회 대기";

  return (
    <SafeClawModuleShell
      eyebrow="운영 온톨로지"
      title="작업과 근거의 연결."
      description="작업, 위험요인, 안전조치와 법령을 선택한 항목 중심으로 확인합니다."
      status={status}
      mappedTo={mappedTo}
      activeHref="/ontology"
      actions={<Link href="/workspace">작업공간 열기</Link>}
    >
      {!graph || !model ? (
        <section className={`safeclaw-module-panel ${styles.emptyPanel}`}>
          <span>그래프를 사용할 수 없음</span>
          <h2>배포된 온톨로지 그래프를 불러오지 못했습니다.</h2>
          <p>{result.message}</p>
        </section>
      ) : (
        <OntologyExplorer
          model={model}
          totalNodes={graph.counts.nodes}
          totalEdges={graph.counts.edges}
          droppedCount={graph.counts.uncited_dropped_nodes + graph.counts.uncited_dropped_edges}
          isSeedFallback={isSeedFallback}
          seedCount={SEED_STATS.published_nodes}
        />
      )}
    </SafeClawModuleShell>
  );
}
