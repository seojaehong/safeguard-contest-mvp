"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { OntologyVisualizationModel } from "@/lib/ontology/visualization";
import { KIND_KO, type NodeKind } from "@/lib/ontology/schema";
import { buildOntologyNeighborhood } from "./ontology-neighborhood";
import styles from "./OntologyWorkbench.module.css";

type ExplorerProps = {
  model: OntologyVisualizationModel;
  totalNodes: number;
  totalEdges: number;
  droppedCount: number;
  isSeedFallback: boolean;
  seedCount: number;
};

const RELATION_LABELS: Readonly<Record<string, string>> = {
  entailsHazard: "위험요인 수반",
  mitigatedBy: "안전조치로 저감",
  mandatedBy: "법령 근거",
  documentedIn: "문서 반영",
  evidencedBy: "사례 입증",
  fulfillsDuty: "의무 이행 증빙(부분)",
  basedOnArticle: "조문 근거",
  relatedTo: "관련"
};

function relationLabel(value: string) {
  return RELATION_LABELS[value] || value;
}

function nodeDegree(node: OntologyVisualizationModel["list"][number]) {
  return node.incomingCount + node.outgoingCount;
}

type GraphCanvasProps = {
  neighborhood: ReturnType<typeof buildOntologyNeighborhood>;
  selectedNodeId: string;
  zoom: number;
  onSelect: (nodeId: string) => void;
};

function GraphCanvas({ neighborhood, selectedNodeId, zoom, onSelect }: GraphCanvasProps) {
  const positions = new Map(neighborhood.nodes.map((node) => [node.id, node]));
  return (
    <div className={styles.graphViewport} data-testid="ontology-neighborhood-graph">
      <div className={styles.graphCanvas} style={{ transform: `scale(${zoom})` }}>
        <svg viewBox="0 0 100 100" aria-hidden="true">
          {neighborhood.edges.map((edge) => {
            const source = positions.get(edge.sourceId);
            const target = positions.get(edge.targetId);
            if (!source || !target) return null;
            return (
              <line
                key={edge.id}
                x1={source.x}
                y1={source.y}
                x2={target.x}
                y2={target.y}
                className={edge.isSelectedPath ? styles.activeEdge : styles.edge}
              />
            );
          })}
        </svg>
        {neighborhood.nodes.map((node) => (
          <button
            key={node.id}
            type="button"
            className={`${styles.graphNode}${node.id === selectedNodeId ? ` ${styles.selectedNode}` : ""}`}
            style={{ left: `${node.x}%`, top: `${node.y}%` }}
            data-testid="ontology-neighborhood-node"
            data-node-id={node.id}
            aria-pressed={node.id === selectedNodeId}
            onClick={() => onSelect(node.id)}
          >
            <span>{KIND_KO[node.kind]}</span>
            <strong>{node.label}</strong>
            <small>연결 {nodeDegree(node)}</small>
          </button>
        ))}
      </div>
    </div>
  );
}

export function OntologyExplorer({
  model,
  totalNodes,
  totalEdges,
  droppedCount,
  isSeedFallback,
  seedCount
}: ExplorerProps) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<"all" | NodeKind>("all");
  const [sort, setSort] = useState<"degree" | "label">("degree");
  const [depth, setDepth] = useState<1 | 2>(1);
  const [zoom, setZoom] = useState(1);
  const [visibleListCount, setVisibleListCount] = useState(9);
  const [expanded, setExpanded] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState(model.focusNodeId || model.list[0]?.id || "");
  const expandButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const source = useMemo(() => ({ nodes: model.list, related: model.hoverCards }), [model]);
  const neighborhood = useMemo(
    () => buildOntologyNeighborhood(source, selectedNodeId, depth, 15),
    [depth, selectedNodeId, source]
  );
  const cardById = useMemo(() => new Map(model.hoverCards.map((card) => [card.id, card])), [model.hoverCards]);
  const selectedCard = cardById.get(selectedNodeId);
  const selectedItem = model.list.find((item) => item.id === selectedNodeId);
  const kinds = useMemo(
    () => [...new Set(model.list.map((item) => item.kind))].sort((a, b) => KIND_KO[a].localeCompare(KIND_KO[b], "ko")),
    [model.list]
  );
  const filteredList = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("ko");
    return model.list
      .filter((item) => kind === "all" || item.kind === kind)
      .filter((item) => !normalizedQuery || item.label.toLocaleLowerCase("ko").includes(normalizedQuery))
      .sort((a, b) => sort === "label"
        ? a.label.localeCompare(b.label, "ko")
        : nodeDegree(b) - nodeDegree(a) || a.label.localeCompare(b.label, "ko"));
  }, [kind, model.list, query, sort]);

  useEffect(() => {
    if (!expanded) return;
    closeButtonRef.current?.focus();

    function handleDialogKeyDown(event: KeyboardEvent) {
      const dialog = dialogRef.current;
      if (!dialog) return;
      if (event.key === "Escape") {
        event.preventDefault();
        setExpanded(false);
        window.requestAnimationFrame(() => expandButtonRef.current?.focus());
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = [...dialog.querySelectorAll<HTMLElement>("button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex='-1'])")]
        .filter((element) => element.getClientRects().length > 0);
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleDialogKeyDown);
    return () => document.removeEventListener("keydown", handleDialogKeyDown);
  }, [expanded]);

  function selectNode(nodeId: string) {
    setSelectedNodeId(nodeId);
  }

  function closeExpandedGraph() {
    setExpanded(false);
    window.requestAnimationFrame(() => expandButtonRef.current?.focus());
  }

  return (
    <div className={styles.root} data-testid="ontology-explorer-root">
      <section className={styles.summaryGrid} aria-label="온톨로지 상태 요약">
        <article><span>검증된 안전지식</span><strong>{totalNodes.toLocaleString("ko-KR")}</strong><small>검증 완료 범위</small></article>
        <article><span>검증된 연결</span><strong>{totalEdges.toLocaleString("ko-KR")}</strong><small>출처 연결 유지</small></article>
        <article><span>근거 차단</span><strong>{droppedCount.toLocaleString("ko-KR")}</strong><small>무출처 항목 제외</small></article>
        {isSeedFallback ? <article><span>대체자료</span><strong>{seedCount.toLocaleString("ko-KR")}</strong><small>내장 검증자료 읽기 전용</small></article> : null}
      </section>

      <section className={styles.loopStrip} aria-label="작업팩 개선 루프">
        <div><span>01</span><strong>오늘 작업</strong><small>현장 맥락</small></div>
        <div><span>02</span><strong>SIF · KOSHA</strong><small>위험·조치 근거</small></div>
        <div><span>03</span><strong>개선 기록</strong><small>사진·메모 반영</small></div>
        <div><span>04</span><strong>다음 작업</strong><small>검증 후 재사용</small></div>
      </section>

      <section className={styles.explorer} aria-labelledby="ontology-explorer-title">
        <header className={styles.explorerHeader}>
          <div>
            <span>관계 탐색</span>
            <h2 id="ontology-explorer-title">선택 항목 중심 안전지식</h2>
            <p>전체 그래프 대신 선택한 항목과 직접 연결된 근거만 표시합니다.</p>
          </div>
          <div className={styles.depthControl} aria-label="관계 탐색 깊이">
            <button type="button" aria-pressed={depth === 1} onClick={() => setDepth(1)}>직접 관계</button>
            <button type="button" aria-pressed={depth === 2} onClick={() => setDepth(2)}>확장 관계</button>
          </div>
        </header>

        <div className={styles.toolbar}>
          <label className={styles.searchField}>
            <span>안전지식 검색</span>
            <input
              type="search"
              value={query}
              placeholder="작업, 위험요인, 안전조치 검색"
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <label>
            <span>유형</span>
            <select value={kind} onChange={(event) => setKind(event.target.value as "all" | NodeKind)}>
              <option value="all">전체 유형</option>
              {kinds.map((item) => <option key={item} value={item}>{KIND_KO[item]}</option>)}
            </select>
          </label>
          <label>
            <span>정렬</span>
            <select value={sort} onChange={(event) => setSort(event.target.value as "degree" | "label")}>
              <option value="degree">연결 많은 순</option>
              <option value="label">이름 순</option>
            </select>
          </label>
        </div>

        <div className={styles.selectionSummary}>
          <div>
            <span>{selectedItem ? KIND_KO[selectedItem.kind] : "선택 항목"}</span>
            <strong>{selectedItem?.label || "항목을 선택하세요"}</strong>
            <small>관련 항목 {neighborhood.nodes.length}개 · 연결 {neighborhood.edges.length}개 · 전체 안전지식 {totalNodes}개 보존</small>
          </div>
          <button ref={expandButtonRef} type="button" className={styles.expandButton} onClick={() => setExpanded(true)}>그래프 전체 화면</button>
        </div>

        <div className={styles.desktopGraph}>
          <div className={styles.graphTools} aria-label="그래프 확대 제어">
            <button type="button" title="축소" aria-label="그래프 축소" onClick={() => setZoom((value) => Math.max(0.8, value - 0.1))}>−</button>
            <button type="button" onClick={() => setZoom(1)}>초기화</button>
            <button type="button" title="확대" aria-label="그래프 확대" onClick={() => setZoom((value) => Math.min(1.2, value + 0.1))}>+</button>
          </div>
          <GraphCanvas neighborhood={neighborhood} selectedNodeId={selectedNodeId} zoom={zoom} onSelect={selectNode} />
          <div className={styles.legend} aria-label="안전지식 유형 안내">
            {kinds.map((item) => <span key={item} data-kind={item}>{KIND_KO[item]}</span>)}
          </div>
        </div>

        <div className={styles.mobileRelations} data-testid="ontology-mobile-relations">
          <h3>연결된 근거</h3>
          {selectedCard?.related.length ? selectedCard.related.slice(0, 6).map((relation) => {
            const relatedId = relation.direction === "incoming" ? relation.sourceId : relation.targetId;
            const relatedName = relation.direction === "incoming" ? relation.sourceLabel : relation.targetLabel;
            return (
              <button key={`${relation.sourceId}-${relation.rel}-${relation.targetId}`} type="button" onClick={() => selectNode(relatedId)}>
                <span>{relationLabel(relation.rel)}</span>
                <strong>{relatedName}</strong>
                <small>{relation.direction === "incoming" ? "이 항목으로 연결" : "이 항목에서 연결"}</small>
              </button>
            );
          }) : <p>직접 연결된 근거가 없습니다.</p>}
          {(selectedCard?.related.length ?? 0) > 6 ? (
            <p>나머지 연결은 검색하거나 그래프 전체 화면에서 확인하세요.</p>
          ) : null}
        </div>
      </section>

      <section className={styles.directory} aria-labelledby="ontology-directory-title">
        <header>
          <div><span>전체 목록</span><h2 id="ontology-directory-title">검증된 안전지식 찾기</h2></div>
          <strong>{filteredList.length.toLocaleString("ko-KR")}개</strong>
        </header>
        <div className={styles.nodeGrid}>
          {filteredList.slice(0, visibleListCount).map((item) => (
            <button
              key={item.id}
              type="button"
              className={item.id === selectedNodeId ? styles.activeListNode : ""}
              aria-pressed={item.id === selectedNodeId}
              onClick={() => selectNode(item.id)}
            >
              <span>{KIND_KO[item.kind]}</span>
              <strong>{item.label}</strong>
              <small>연결 {nodeDegree(item)}</small>
            </button>
          ))}
        </div>
        {visibleListCount < filteredList.length ? (
          <button type="button" className={styles.moreButton} onClick={() => setVisibleListCount((value) => value + 9)}>9개 더 보기</button>
        ) : null}
      </section>

      {expanded ? (
        <section ref={dialogRef} className={styles.graphDialog} role="dialog" aria-modal="true" aria-label="온톨로지 그래프 전체 화면">
          <header><strong>{selectedItem?.label || "관계 그래프"}</strong><button ref={closeButtonRef} type="button" onClick={closeExpandedGraph}>닫기</button></header>
          <div className={styles.dialogScroller}>
            <GraphCanvas neighborhood={neighborhood} selectedNodeId={selectedNodeId} zoom={zoom} onSelect={selectNode} />
          </div>
        </section>
      ) : null}
    </div>
  );
}
