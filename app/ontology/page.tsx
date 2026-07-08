import Link from "next/link";
import { SafeClawModuleShell } from "@/components/SafeClawModuleShell";
import { loadGraph } from "@/lib/ontology/graph-store";
import { buildOntologyVisualizationModel } from "@/lib/ontology/visualization";

export const dynamic = "force-dynamic";

function relationLabel(value: string) {
  if (value === "entailsHazard") return "위험";
  if (value === "mitigatedBy") return "조치";
  if (value === "basedOnArticle") return "법령";
  if (value === "evidencedByDocument") return "문서";
  if (value === "similarToAccident") return "사례";
  if (value === "supportsDuty") return "의무";
  return value;
}

export default async function OntologyPage() {
  const result = await loadGraph("published");
  const graph = result.graph;
  const model = graph ? buildOntologyVisualizationModel(graph) : null;
  const status = result.ok ? "live" : result.configured ? "partial" : "planned";
  const mappedTo = graph
    ? `${graph.counts.nodes.toLocaleString("ko-KR")}개 노드 · ${graph.counts.edges.toLocaleString("ko-KR")}개 관계`
    : "published graph 조회 대기";

  return (
    <SafeClawModuleShell
      eyebrow="운영 온톨로지"
      title="작업 이력 그래프."
      description="작업, 위험요인, 조치, 법령, 문서 반영 위치를 리스트와 hover card로 확인합니다."
      status={status}
      mappedTo={mappedTo}
      activeHref="/ontology"
      actions={<Link href="/api/ontology/graph">Graph JSON</Link>}
    >
      {!result.ok || !graph || !model ? (
        <section className="safeclaw-module-panel ontology-empty-panel">
          <span>Graph unavailable</span>
          <h2>published 온톨로지 그래프를 불러오지 못했습니다.</h2>
          <p>{result.message}</p>
        </section>
      ) : (
        <>
          <section className="ontology-summary-grid">
            <article className="safeclaw-module-panel">
              <span>Nodes</span>
              <h2>{graph.counts.nodes.toLocaleString("ko-KR")}개</h2>
              <p>Task, Hazard, Control, Article, Document를 published 범위에서만 표시합니다.</p>
            </article>
            <article className="safeclaw-module-panel">
              <span>Edges</span>
              <h2>{graph.counts.edges.toLocaleString("ko-KR")}개</h2>
              <p>관계가 끊긴 edge와 출처 없는 항목은 조립 단계에서 제외됩니다.</p>
            </article>
            <article className="safeclaw-module-panel">
              <span>Gate</span>
              <h2>{graph.counts.uncited_dropped_nodes + graph.counts.uncited_dropped_edges}개 제외</h2>
              <p>근거 없는 draft/uncited 항목은 사용자 근거처럼 노출하지 않습니다.</p>
            </article>
          </section>

          <section className="ontology-workbench">
            <div className="ontology-list-column">
              <div className="compact-head">
                <span className="eyebrow">List Ontology</span>
                <strong>노드 리스트</strong>
              </div>
              <div className="ontology-node-list">
                {model.list.map((item) => {
                  const card = model.hoverCards.find((hoverCard) => hoverCard.id === item.id);
                  return (
                    <article key={item.id} className="ontology-node-row">
                      <div>
                        <span>{item.kind}</span>
                        <strong>{item.label}</strong>
                        <small>out {item.outgoingCount} · in {item.incomingCount}</small>
                      </div>
                      {card ? (
                        <aside className="ontology-hover-card" role="note">
                          <span>{card.subtitle}</span>
                          <strong>{card.title}</strong>
                          <p>근거 {card.evidenceCount}개 · 연결 {card.related.length}개</p>
                          <ul>
                            {card.related.slice(0, 5).map((related) => (
                              <li key={`${card.id}-${related.rel}-${related.targetId}`}>
                                <b>{relationLabel(related.rel)}</b>
                                <span>{related.targetLabel}</span>
                              </li>
                            ))}
                          </ul>
                        </aside>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </div>

            <aside className="ontology-map-column safeclaw-module-panel">
              <span>Hover Cards</span>
              <h2>Obsidian식 탐색 표면</h2>
              <p>
                왼쪽 노드에 마우스를 올리면 연결된 위험요인, 조치, 법령, 문서 관계가 카드로 떠오릅니다.
                작업공간에서는 이 모델을 오늘 작업 하네스 패킷과 연결해 “지난 개선이 오늘 TBM에 다시 반영되는지”를 보여줍니다.
              </p>
              <div className="ontology-kind-list">
                {Object.entries(graph.counts.nodes_by_kind).map(([kind, count]) => (
                  <div key={kind}>
                    <span>{kind}</span>
                    <strong>{count.toLocaleString("ko-KR")}</strong>
                  </div>
                ))}
              </div>
            </aside>
          </section>
        </>
      )}
    </SafeClawModuleShell>
  );
}
