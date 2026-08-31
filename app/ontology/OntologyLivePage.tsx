"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { SafeClawModuleShell } from "@/components/SafeClawModuleShell";
import type { OntologyGraph } from "@/lib/ontology/graph-store";
import type { PublicOntologyGraphLoadResult } from "@/lib/ontology-graph";
import { publicOntologyGraphSchema } from "@/lib/ontology/schema";
import { SEED_STATS } from "@/lib/ontology/seed/core-triples";
import { buildOntologyVisualizationModel } from "@/lib/ontology/visualization";
import { OntologyExplorer } from "./OntologyExplorer";
import styles from "./OntologyWorkbench.module.css";

type OntologyLivePageProps = {
  fallbackGraph: OntologyGraph;
};

type LiveGraphState = {
  graph: OntologyGraph;
  message: string;
} | null;

export function OntologyLivePage({ fallbackGraph }: OntologyLivePageProps) {
  const [liveGraph, setLiveGraph] = useState<LiveGraphState>(null);
  const [loadMessage, setLoadMessage] = useState("배포된 그래프를 확인하고 있습니다.");

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/ontology/graph", {
      cache: "no-store",
      signal: controller.signal,
    }).then(async (response) => {
      const payload = await response.json().catch((): unknown => null);
      if (!response.ok || typeof payload !== "object" || payload === null) {
        throw new Error(`ontology graph request failed with status ${response.status}`);
      }
      const result = payload as PublicOntologyGraphLoadResult;
      const parsedGraph = publicOntologyGraphSchema.safeParse(result.graph);
      if (!result.ok || !parsedGraph.success) {
        throw new Error(result.message || "ontology graph response did not include a graph");
      }
      setLiveGraph({ graph: parsedGraph.data, message: result.message });
      setLoadMessage(result.message);
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      console.error("ontology page graph fetch failed", error);
      setLoadMessage("배포된 그래프를 불러오지 못해 내장 검증자료를 표시합니다.");
    });
    return () => controller.abort(new Error("ontology page navigation cancelled graph loading"));
  }, []);

  const graph = liveGraph?.graph || fallbackGraph;
  const model = useMemo(() => buildOntologyVisualizationModel(graph), [graph]);
  const isSeedFallback = liveGraph === null;
  const mappedTo = liveGraph
    ? `${graph.counts.nodes.toLocaleString("ko-KR")}개 안전지식 · ${graph.counts.edges.toLocaleString("ko-KR")}개 연결`
    : `${graph.counts.nodes.toLocaleString("ko-KR")}개 내장 검증자료 · 배포 그래프 확인 중`;

  return (
    <SafeClawModuleShell
      eyebrow="운영 온톨로지"
      title="작업과 근거의 연결."
      description="작업, 위험요인, 안전조치와 법령을 선택한 항목 중심으로 확인합니다."
      status={liveGraph ? "live" : "partial"}
      mappedTo={mappedTo}
      activeHref="/ontology"
      actions={<Link href="/workspace">작업공간 열기</Link>}
    >
      <p className={styles.srOnly} aria-live="polite">{loadMessage}</p>
      <OntologyExplorer
        model={model}
        totalNodes={graph.counts.nodes}
        totalEdges={graph.counts.edges}
        droppedCount={graph.counts.uncited_dropped_nodes + graph.counts.uncited_dropped_edges}
        isSeedFallback={isSeedFallback}
        seedCount={SEED_STATS.published_nodes}
      />
    </SafeClawModuleShell>
  );
}
