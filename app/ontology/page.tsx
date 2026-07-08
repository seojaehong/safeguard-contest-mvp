import Link from "next/link";
import { SafeClawModuleShell } from "@/components/SafeClawModuleShell";
import { assembleGraph, loadGraph } from "@/lib/ontology/graph-store";
import { SEED_EDGES, SEED_NODES, SEED_STATS } from "@/lib/ontology/seed/core-triples";
import { buildOntologyVisualizationModel } from "@/lib/ontology/visualization";

export const dynamic = "force-dynamic";

function relationLabel(value: string) {
  if (value === "entailsHazard") return "위험";
  if (value === "mitigatedBy") return "조치";
  if (value === "mandatedBy") return "법령";
  if (value === "documentedIn") return "문서";
  if (value === "evidencedBy") return "사례";
  if (value === "fulfillsDuty") return "의무";
  if (value === "relatedTo") return "관련";
  return value;
}

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
  const hoverCardsById = new Map(model?.hoverCards.map((card) => [card.id, card]) || []);
  const status = result.ok ? "live" : graph ? "partial" : result.configured ? "partial" : "planned";
  const mappedTo = graph
    ? `${graph.counts.nodes.toLocaleString("ko-KR")}개 노드 · ${graph.counts.edges.toLocaleString("ko-KR")}개 관계${isSeedFallback ? " · seed fallback" : ""}`
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
      {!graph || !model ? (
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
            {isSeedFallback ? (
              <article className="safeclaw-module-panel">
                <span>Fallback</span>
                <h2>{SEED_STATS.published_nodes.toLocaleString("ko-KR")}개 seed</h2>
                <p>Supabase graph가 없을 때만 bundled published seed를 읽기 전용으로 표시합니다.</p>
              </article>
            ) : null}
          </section>

          <section className="safeclaw-module-panel ontology-operation-loop" aria-label="작업팩 운영 이력 그래프 계약">
            <div className="compact-head">
              <span className="eyebrow">Operation Memory</span>
              <strong>작업팩별 개선 루프</strong>
            </div>
            <p>
              published 지식 그래프는 고정 근거이고, 작업팩 그래프는 오늘 작업에서 실제로 사용한 근거,
              사진 분석 개선사항, 열람 확인 이력을 묶습니다. 저장된 작업팩은
              <code>/api/workpacks/[id]/operation-graph</code>에서 Workpack → Hazard → Control/Improvement → Evidence/Ack
              구조로 내려받습니다.
            </p>
            <div className="ontology-operation-flow">
              <article>
                <span>Workpack</span>
                <strong>오늘 작업</strong>
                <small>질문 · 생성일 · 현장 맥락</small>
              </article>
              <article>
                <span>Evidence</span>
                <strong>SIF/KOSHA 근거</strong>
                <small>문서에 반영된 직접/보조 근거</small>
              </article>
              <article>
                <span>Improvement</span>
                <strong>사진/메모 개선</strong>
                <small>before-after 분석과 반영 문서</small>
              </article>
              <article>
                <span>Ack</span>
                <strong>열람 확인</strong>
                <small>작업자 표시명 · 언어 · 확인 시각</small>
              </article>
            </div>
          </section>

          <section className="ontology-graph-shell safeclaw-module-panel" aria-label="옵시디언형 온톨로지 그래프">
            <div className="compact-head">
              <span className="eyebrow">Graph Ontology</span>
              <strong>작업 이력 그래프 맵</strong>
            </div>
            <p>
              published 노드 중 연결도가 높은 항목을 먼저 배치합니다. 노드에 마우스를 올리면 관련 위험요인,
              조치, 법령, 문서 관계가 hover card로 표시됩니다.
            </p>
            <div className="ontology-graph-board">
              <svg viewBox="0 0 100 100" role="img" aria-label="작업, 위험요인, 조치, 법령, 문서 연결 지도">
                <defs>
                  <radialGradient id="ontology-node-glow" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="rgba(255, 220, 46, 0.85)" />
                    <stop offset="100%" stopColor="rgba(255, 220, 46, 0)" />
                  </radialGradient>
                </defs>
                {model.map.edges.map((edge) => (
                  <line
                    key={edge.id}
                    x1={edge.x1}
                    y1={edge.y1}
                    x2={edge.x2}
                    y2={edge.y2}
                    className={`ontology-graph-edge relation-${edge.rel}`}
                  />
                ))}
                {model.map.nodes.map((node) => (
                  <g key={node.id} className={`ontology-graph-svg-node kind-${node.kind}`}>
                    <circle cx={node.x} cy={node.y} r={node.size + 3.2} className="node-glow" />
                    <circle cx={node.x} cy={node.y} r={node.size} />
                  </g>
                ))}
              </svg>
              <div className="ontology-graph-node-layer" aria-hidden="false">
                {model.map.nodes.map((node) => {
                  const card = hoverCardsById.get(node.id);
                  return (
                    <article
                      key={node.id}
                      className={`ontology-graph-point kind-${node.kind}`}
                      style={{ left: `${node.x}%`, top: `${node.y}%` }}
                      tabIndex={0}
                    >
                      <span>{node.kind}</span>
                      <strong>{node.label}</strong>
                      <small>{node.degree} links</small>
                      {card ? (
                        <aside className="ontology-graph-popover" role="note">
                          <span>{card.subtitle}</span>
                          <strong>{card.title}</strong>
                          <p>근거 {card.evidenceCount}개 · 연결 {card.related.length}개</p>
                          <ul>
                            {card.related.slice(0, 4).map((related) => (
                              <li key={`${card.id}-map-${related.rel}-${related.targetId}`}>
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
            <div className="ontology-graph-legend" aria-label="그래프 범례">
              {["Task", "Hazard", "Control", "Article", "Document", "Accident"].map((kind) => (
                <span key={kind} className={`kind-${kind}`}>{kind}</span>
              ))}
            </div>
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
