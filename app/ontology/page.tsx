import Link from "next/link";
import { OperationMemoryPreview } from "@/components/OperationMemoryPreview";
import { SafeClawModuleShell } from "@/components/SafeClawModuleShell";
import { assembleGraph, loadGraph } from "@/lib/ontology/graph-store";
import { ontologyRelationLabel } from "@/lib/ontology/operation-memory-visualization";
import { KIND_KO, NODE_KINDS, type NodeKind } from "@/lib/ontology/schema";
import { SEED_EDGES, SEED_NODES, SEED_STATS } from "@/lib/ontology/seed/core-triples";
import { buildOntologyVisualizationModel } from "@/lib/ontology/visualization";

export const dynamic = "force-dynamic";

function nodeKindLabel(value: NodeKind) {
  return KIND_KO[value];
}

function relatedLabel(related: { direction?: "outgoing" | "incoming"; sourceLabel: string; targetLabel: string }) {
  return related.direction === "incoming" ? related.sourceLabel : related.targetLabel;
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
  const status = result.ok ? "live" : graph ? "partial" : result.configured ? "partial" : "planned";
  const mappedTo = graph
    ? `${graph.counts.nodes.toLocaleString("ko-KR")}개 노드 · ${graph.counts.edges.toLocaleString("ko-KR")}개 관계${isSeedFallback ? " · 내장 공개 시드" : ""}`
    : "공개 그래프 조회 대기";
  const staticNodes = model?.map.nodes || [];
  const staticEdges = model?.map.edges || [];
  const staticNodeById = new Map(staticNodes.map((node) => [node.id, node]));
  const reviewRequiredCount = staticNodes.filter((node) => node.degree === 0).length;

  return (
    <SafeClawModuleShell
      eyebrow="운영 온톨로지"
      title="작업 이력 그래프."
      description="작업, 위험요인, 조치, 법령, 문서 반영 위치를 목록과 펼침 카드로 확인합니다."
      status={status}
      mappedTo={mappedTo}
      activeHref="/ontology"
      actions={<Link href="/api/ontology/graph">그래프 JSON</Link>}
    >
      {!graph || !model ? (
        <section className="safeclaw-module-panel ontology-empty-panel">
          <span>그래프 조회 불가</span>
          <h2>공개 온톨로지 그래프를 불러오지 못했습니다.</h2>
          <p>{result.message}</p>
        </section>
      ) : (
        <>
          <section className="ontology-summary-grid">
            <article className="safeclaw-module-panel">
              <span>노드</span>
              <h2>{graph.counts.nodes.toLocaleString("ko-KR")}개</h2>
              <p>작업, 위험요인, 조치, 법령 조문, 문서를 공개 범위에서만 표시합니다.</p>
            </article>
            <article className="safeclaw-module-panel">
              <span>관계</span>
              <h2>{graph.counts.edges.toLocaleString("ko-KR")}개</h2>
              <p>연결이 끊긴 관계와 출처 없는 항목은 조립 단계에서 제외됩니다.</p>
            </article>
            <article className="safeclaw-module-panel">
              <span>근거 차단</span>
              <h2>{graph.counts.uncited_dropped_nodes + graph.counts.uncited_dropped_edges}개 제외</h2>
              <p>근거 없는 초안과 무출처 항목은 사용자 근거처럼 노출하지 않습니다.</p>
            </article>
            {isSeedFallback ? (
              <article className="safeclaw-module-panel">
                <span>대체본</span>
                <h2>{SEED_STATS.published_nodes.toLocaleString("ko-KR")}개 시드</h2>
                <p>Supabase 그래프가 없을 때만 내장 공개 시드를 읽기 전용으로 표시합니다.</p>
              </article>
            ) : null}
          </section>

          <section className="safeclaw-module-panel ontology-operation-loop" aria-label="작업팩 운영 이력 그래프 계약">
            <div className="compact-head">
              <span className="eyebrow">운영 이력</span>
              <strong>작업팩별 개선 루프</strong>
            </div>
            <p>
              공개 지식 그래프는 고정 근거이고, 작업팩 그래프는 오늘 작업에서 실제로 사용한 근거,
              사진 분석 개선사항, 열람 확인 이력을 묶습니다. 저장된 작업팩은
              <code>/api/workpacks/[id]/operation-graph</code>에서 작업팩 → 위험요인 → 조치/개선 → 근거/열람 확인
              구조로 내려받습니다.
            </p>
            <div className="ontology-operation-flow">
              <article>
                <span>작업팩</span>
                <strong>오늘 작업</strong>
                <small>질문 · 생성일 · 현장 맥락</small>
              </article>
              <article>
                <span>근거</span>
                <strong>SIF/KOSHA 근거</strong>
                <small>문서에 반영된 직접/보조 근거</small>
              </article>
              <article>
                <span>개선사항</span>
                <strong>사진/메모 개선</strong>
                <small>개선 전/개선 후 분석과 반영 문서</small>
              </article>
              <article>
                <span>열람 확인</span>
                <strong>열람 확인</strong>
                <small>작업자 표시명 · 언어 · 확인 시각</small>
              </article>
            </div>
          </section>

          <OperationMemoryPreview />

          <section className="ontology-graph-shell safeclaw-module-panel" aria-label="옵시디언형 온톨로지 그래프">
            <div className="compact-head">
              <span className="eyebrow">그래프 온톨로지</span>
              <strong>작업 이력 그래프 맵</strong>
            </div>
            <p>
              공개 노드 중 연결도가 높은 항목과 실제 관계의 출발·도착 ID를 함께 표시합니다.
              연결이 없는 표시 노드는 검토 필요 상태로 구분하고, 아래 목록은 전체 공개 노드를 보존합니다.
            </p>
            <div
              className="ontology-graph-board ontology-static-surface"
              style={{ display: "grid", gap: "20px", minHeight: "auto", overflow: "visible", padding: "16px" }}
            >
              <section aria-label="정적 온톨로지 노드 인덱스" style={{ display: "grid", gap: "10px", minWidth: 0 }}>
                <div className="compact-head">
                  <span className="eyebrow">노드 인덱스</span>
                  <strong>{staticNodes.length.toLocaleString("ko-KR")}개 표시</strong>
                </div>
                <ul
                  style={{
                    display: "grid",
                    gap: "8px",
                    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
                    listStyle: "none",
                    margin: 0,
                    padding: 0
                  }}
                >
                  {staticNodes.map((node) => {
                    const reviewRequired = node.degree === 0;
                    return (
                      <li
                        key={node.id}
                        className={`ontology-static-node kind-${node.kind}`}
                        data-node-id={node.id}
                        data-degree={node.degree}
                        data-review-required={reviewRequired ? "true" : "false"}
                        aria-label={`${nodeKindLabel(node.kind)} ${node.label}, 노드 ID ${node.id}${reviewRequired ? ", 연결 검토 필요" : ""}`}
                        style={{
                          borderBottom: "1px solid rgba(246, 245, 239, 0.16)",
                          display: "grid",
                          gap: "4px",
                          minWidth: 0,
                          overflowWrap: "anywhere",
                          padding: "10px 2px"
                        }}
                      >
                        <span>{nodeKindLabel(node.kind)}</span>
                        <strong>{node.label}</strong>
                        <small>노드 ID {node.id} · 연결 {node.degree}개</small>
                        {reviewRequired ? <b>연결 검토 필요</b> : null}
                      </li>
                    );
                  })}
                </ul>
              </section>

              <section aria-label="정적 온톨로지 관계 목록" style={{ display: "grid", gap: "10px", minWidth: 0 }}>
                <div className="compact-head">
                  <span className="eyebrow">관계 목록</span>
                  <strong>{staticEdges.length.toLocaleString("ko-KR")}개 표시</strong>
                </div>
                <ol style={{ display: "grid", gap: "8px", listStyle: "none", margin: 0, padding: 0 }}>
                  {staticEdges.map((edge) => {
                    const source = staticNodeById.get(edge.sourceId);
                    const target = staticNodeById.get(edge.targetId);
                    const relation = ontologyRelationLabel(edge.rel);
                    const sourceLabel = source?.label || "분류 검토 필요";
                    const targetLabel = target?.label || "분류 검토 필요";
                    return (
                      <li
                        key={edge.id}
                        className="ontology-static-edge"
                        data-source-id={edge.sourceId}
                        data-target-id={edge.targetId}
                        data-relation-label={relation}
                        aria-label={`${sourceLabel}, 출발 ID ${edge.sourceId}에서 ${targetLabel}, 도착 ID ${edge.targetId}로 ${relation}`}
                        style={{
                          alignItems: "stretch",
                          borderBottom: "1px solid rgba(246, 245, 239, 0.16)",
                          display: "flex",
                          flexWrap: "wrap",
                          gap: "8px",
                          minWidth: 0,
                          padding: "10px 2px"
                        }}
                      >
                        <span style={{ display: "grid", flex: "1 1 220px", gap: "3px", minWidth: 0, overflowWrap: "anywhere" }}>
                          <b>출발</b>
                          <strong>{sourceLabel}</strong>
                          <small>노드 ID {edge.sourceId}</small>
                        </span>
                        <b style={{ alignSelf: "center", flex: "0 1 auto", overflowWrap: "anywhere" }}>{relation}</b>
                        <span style={{ display: "grid", flex: "1 1 220px", gap: "3px", minWidth: 0, overflowWrap: "anywhere" }}>
                          <b>도착</b>
                          <strong>{targetLabel}</strong>
                          <small>노드 ID {edge.targetId}</small>
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </section>
            </div>
            <div className="ontology-graph-stats" aria-label="온톨로지 그래프 표시 범위">
              <span>맵 노드 {model.stats.visibleNodes.toLocaleString("ko-KR")}/{model.stats.totalNodes.toLocaleString("ko-KR")}</span>
              <span>맵 관계 {model.stats.visibleEdges.toLocaleString("ko-KR")}/{model.stats.totalEdges.toLocaleString("ko-KR")}</span>
              <span>연결 검토 {reviewRequiredCount.toLocaleString("ko-KR")}개</span>
              {model.stats.hiddenNodes > 0 ? (
                <span>리스트 보존 {model.stats.hiddenNodes.toLocaleString("ko-KR")}개</span>
              ) : null}
            </div>
            <div className="ontology-graph-legend" aria-label="그래프 범례">
              {NODE_KINDS.map((kind) => (
                <span key={kind} className={`kind-${kind}`}>{nodeKindLabel(kind)}</span>
              ))}
            </div>
          </section>

          <section className="ontology-workbench">
            <div className="ontology-list-column">
              <div className="compact-head">
                <span className="eyebrow">목록 온톨로지</span>
                <h2 className="safeclaw-section-title">노드 리스트</h2>
              </div>
              <div className="ontology-node-list" style={{ gap: "6px" }}>
                {model.list.map((item) => {
                  const card = model.hoverCards.find((hoverCard) => hoverCard.id === item.id);
                  return (
                    <article key={item.id} className="ontology-node-row">
                      <div>
                        <span>{nodeKindLabel(item.kind)}</span>
                        <strong>{item.label}</strong>
                        <small>나가는 관계 {item.outgoingCount} · 들어오는 관계 {item.incomingCount}</small>
                      </div>
                      {card ? (
                        <aside className="ontology-hover-card" role="note">
                          <span>{card.subtitle}</span>
                          <strong>{card.title}</strong>
                          {card.excerpt ? <small>{card.excerpt}</small> : null}
                          <p>근거 {card.evidenceCount}개 · 연결 {card.related.length}개</p>
                          <ul>
                            {card.related.slice(0, 5).map((related) => (
                              <li key={`${card.id}-${related.direction}-${related.rel}-${related.sourceId}-${related.targetId}`}>
                                <b>{ontologyRelationLabel(related.rel)} · {related.direction === "incoming" ? "들어옴" : "나감"}</b>
                                <span>{relatedLabel(related)}</span>
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
              <span>펼침 카드</span>
              <h2>연결 탐색 화면</h2>
              <p>
                왼쪽 노드에 마우스를 올리면 연결된 위험요인, 조치, 법령, 문서 관계가 카드로 떠오릅니다.
                작업공간에서는 이 모델을 오늘 작업 하네스 패킷과 연결해 “지난 개선이 오늘 TBM에 다시 반영되는지”를 보여줍니다.
                그래프에 보이지 않는 노드도 리스트와 API 응답에는 남아 있어 근거 추적이 끊기지 않습니다.
              </p>
              <div className="ontology-kind-list">
                {NODE_KINDS.map((kind) => (
                  <div key={kind}>
                    <span>{nodeKindLabel(kind)}</span>
                    <strong>{graph.counts.nodes_by_kind[kind].toLocaleString("ko-KR")}</strong>
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
