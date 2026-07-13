"use client";

import { type KeyboardEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import {
  OPERATION_IMPROVEMENTS_STORAGE_KEY,
  operationImprovementToHarnessImprovement,
  parseOperationImprovements,
  type OperationImprovement
} from "@/lib/operation-improvement-history";
import { buildOperationMemoryGraph, type OperationMemoryGraph } from "@/lib/ontology/operation-memory";
import {
  buildOperationMemoryVisualizationModel,
  operationKindLabel,
  operationRelationLabel
} from "@/lib/ontology/operation-memory-visualization";
import type { HarnessImprovement } from "@/lib/db-harness";
import type { SafetyReferenceItem } from "@/lib/safety-reference-catalog";
import {
  buildWorkpackLearningFile,
  type WorkpackLearningFormat,
  type WorkpackLearningInput
} from "@/lib/workpack-learning-export";

function loadStoredImprovements() {
  if (typeof window === "undefined") return [];
  return parseOperationImprovements(window.localStorage.getItem(OPERATION_IMPROVEMENTS_STORAGE_KEY));
}

function sampleReference(): SafetyReferenceItem {
  return {
    id: "sample-sif-fall-guardrail",
    source_id: "safeclaw-operation-preview",
    item_type: "sif-case",
    category: "건설",
    subcategory: "고소작업",
    title: "외벽 도장 중 작업발판 단부 추락 사례",
    summary: "작업발판 단부와 난간 상태를 확인하지 않아 추락 위험이 커진 사례",
    keywords: ["외벽", "도장", "작업발판"],
    risk_tags: ["추락"],
    primary_documents: ["위험성평가표", "TBM 브리핑"],
    controls: ["작업발판 난간 보강", "강풍 시 작업중지 기준 공유"],
    evidence_role: "direct",
    reflected_documents: ["위험성평가표", "TBM 기록"],
    short_summary: "작업 전 난간·단부 상태 확인 필요"
  };
}

const sampleImprovement: HarnessImprovement = {
  id: "sample-improvement-before-after",
  taskLabel: "성수동 외벽 도장",
  hazardLabel: "추락",
  improvementText: "개선 전 사진의 난간 누락 구간을 보강하고 개선 후 사진에서 출입통제선을 확인",
  reflectedDocuments: ["위험성평가표", "TBM 브리핑", "TBM 기록"],
  sourceType: "photo_analysis",
  visionStatus: "analyzed",
  analysisMode: "vision_ocr",
  photoPairAttached: true,
  visionUserLabel: "vision/OCR 분석 완료",
  visionSummary: "난간 보강과 출입통제선이 확인됩니다.",
  detectedHazards: ["추락", "하부 통제 미흡"],
  observedImprovement: "작업발판 외측 난간 보강",
  ocrText: "작업중 출입금지"
};

function downloadTextFile(fileName: string, contentType: string, content: string) {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function OperationMemoryGraphViewer({
  graph,
  eyebrow = "작업 이력 그래프",
  title,
  description,
  actions,
  statusMessage,
  className = ""
}: {
  graph: OperationMemoryGraph;
  eyebrow?: string;
  title: string;
  description: ReactNode;
  actions?: ReactNode;
  statusMessage?: ReactNode;
  className?: string;
}) {
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const model = useMemo(() => buildOperationMemoryVisualizationModel(graph), [graph]);
  const hoverCardsById = useMemo(
    () => new Map(model.hoverCards.map((card) => [card.id, card])),
    [model.hoverCards]
  );
  const activeCard = activeNodeId ? hoverCardsById.get(activeNodeId) : undefined;
  const mapNodesById = useMemo(() => new Map(model.map.nodes.map((node) => [node.id, node])), [model.map.nodes]);

  useEffect(() => {
    setActiveNodeId((current) => {
      if (current && hoverCardsById.has(current)) return current;
      return model.focusNodeId;
    });
  }, [hoverCardsById, model.focusNodeId]);

  function selectNode(nodeId: string) {
    setActiveNodeId(nodeId);
  }

  function selectNodeWithKey(event: KeyboardEvent<HTMLElement>, nodeId: string) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    selectNode(nodeId);
  }

  return (
    <section className={`safeclaw-module-panel operation-memory-preview${className ? ` ${className}` : ""}`} aria-label={title}>
      <div className="compact-head">
        <span className="eyebrow">{eyebrow}</span>
        <strong>{title}</strong>
      </div>
      <div className="operation-memory-copy">
        <p>{description}</p>
        {actions ? <div className="operation-memory-actions" aria-label="작업 이력 액션">{actions}</div> : null}
      </div>
      {statusMessage ? <p className="operation-memory-message" role="status">{statusMessage}</p> : null}

      <div className="operation-memory-grid">
        <div
          className="operation-memory-board"
          aria-label="작업 이력 노드 선택"
          style={{ minHeight: "clamp(430px, 54vw, 620px)", padding: 0, position: "relative" }}
        >
          <div className="operation-memory-stats" aria-label="작업 이력 그래프 통계">
            <span>노드 {model.stats.visibleNodes}/{model.stats.totalNodes}</span>
            <span>관계 {model.stats.visibleEdges}/{model.stats.totalEdges}</span>
            <span>확인 {graph.summary.ackCount}</span>
          </div>
          <svg
            className="operation-memory-relation-map"
            viewBox="0 0 100 100"
            role="img"
            aria-label={`작업 이력 관계 ${model.map.edges.length}개`}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 1, pointerEvents: "none" }}
          >
            <defs>
              <marker id="operation-memory-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(145, 121, 31, 0.72)" />
              </marker>
            </defs>
            {model.map.edges.map((edge) => {
              const source = mapNodesById.get(edge.sourceId);
              const target = mapNodesById.get(edge.targetId);
              const relation = operationRelationLabel(edge.rel);
              return (
                <line
                  key={edge.id}
                  className={`operation-memory-edge relation-${edge.rel}`}
                  data-source-id={edge.sourceId}
                  data-target-id={edge.targetId}
                  x1={edge.x1}
                  y1={edge.y1}
                  x2={edge.x2}
                  y2={edge.y2}
                  stroke="rgba(246, 245, 239, 0.3)"
                  strokeWidth="0.45"
                  vectorEffect="non-scaling-stroke"
                  markerEnd="url(#operation-memory-arrow)"
                  role="img"
                  aria-label={`${source?.label || edge.sourceId}에서 ${target?.label || edge.targetId}로 ${relation}`}
                  style={{ stroke: "rgba(145, 121, 31, 0.72)" }}
                />
              );
            })}
          </svg>
          <div
            className="operation-memory-node-layer"
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 2
            }}
          >
            {model.map.nodes.map((node) => {
              const isActive = node.id === activeNodeId;
              return (
                <article
                  key={node.id}
                  className={`operation-memory-point kind-${node.kind}${isActive ? " is-active" : ""}`}
                  data-node-id={node.id}
                  style={{
                    position: "absolute",
                    left: `clamp(42px, ${node.x}%, calc(100% - 42px))`,
                    top: `${node.y}%`,
                    width: "clamp(72px, 16vw, 104px)",
                    minWidth: "clamp(72px, 16vw, 104px)",
                    maxWidth: "clamp(72px, 16vw, 104px)",
                    height: "72px",
                    minHeight: "72px",
                    maxHeight: "72px",
                    overflow: "hidden",
                    padding: "6px 8px",
                    transform: "translate(-50%, -50%)"
                  }}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isActive}
                  aria-label={`${operationKindLabel(node.kind)}: ${node.label}`}
                  onClick={() => selectNode(node.id)}
                  onMouseEnter={() => selectNode(node.id)}
                  onFocus={() => selectNode(node.id)}
                  onKeyDown={(event) => selectNodeWithKey(event, node.id)}
                >
                  <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "4px" }}>
                    {operationKindLabel(node.kind)}
                    <small style={{ display: "inline", fontFamily: "var(--font-base)" }}>연결 {node.degree}</small>
                  </span>
                  <strong style={{
                    display: "-webkit-box",
                    overflow: "hidden",
                    WebkitBoxOrient: "vertical",
                    WebkitLineClamp: 2
                  }}>{node.label}</strong>
                </article>
              );
            })}
          </div>
        </div>

        <div className="operation-memory-side">
          <aside className="operation-memory-detail" aria-live="polite" aria-label="선택한 작업 이력 상세">
            {activeCard ? (
              <>
                <span>{activeCard.subtitle}</span>
                <strong>{activeCard.title}</strong>
                {activeCard.detail ? <p>{activeCard.detail}</p> : null}
                {activeCard.metaRows.length ? (
                  <dl>
                    {activeCard.metaRows.slice(0, 5).map((row) => (
                      <div key={`${activeCard.id}-${row.key}`}>
                        <dt>{row.label}</dt>
                        <dd>{row.value}</dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
                <ul>
                  {activeCard.related.slice(0, 6).map((related) => (
                    <li key={`${activeCard.id}-detail-${related.direction}-${related.rel}-${related.nodeId}`}>
                      <b>{operationRelationLabel(related.rel)} · {related.direction === "incoming" ? "들어옴" : "나감"}</b>
                      <span>{related.nodeLabel}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p>그래프나 리스트에서 노드를 선택하면 연결 관계를 확인할 수 있습니다.</p>
            )}
          </aside>

          <div className="operation-memory-list" aria-label="작업 이력 노드 리스트">
            {model.list.map((item) => {
              const isActive = item.id === activeNodeId;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`operation-memory-list-item${isActive ? " is-active" : ""}`}
                  onClick={() => selectNode(item.id)}
                >
                  <span>{operationKindLabel(item.kind)}</span>
                  <strong>{item.label}</strong>
                  <small>나가는 관계 {item.outgoingCount} · 들어오는 관계 {item.incomingCount}</small>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

export function OperationMemoryPreview() {
  const [improvements, setImprovements] = useState<OperationImprovement[]>([]);
  const [downloadMessage, setDownloadMessage] = useState("");

  useEffect(() => {
    setImprovements(loadStoredImprovements());
    const onStorage = (event: StorageEvent) => {
      if (event.key === OPERATION_IMPROVEMENTS_STORAGE_KEY) {
        setImprovements(loadStoredImprovements());
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const preview = useMemo(() => {
    const localItems = improvements.slice(0, 5);
    const hasLocal = localItems.length > 0;
    const first = localItems[0];
    const workpack = hasLocal
      ? {
        id: first.workpackId || "local-operation-memory",
        question: first.workSummary,
        generatedAt: first.createdAt,
        taskLabel: first.workSummary
      }
      : {
        id: "sample-operation-memory",
        question: "성수동 외벽 도장 작업",
        generatedAt: "2026-07-09T00:00:00.000Z",
        taskLabel: "성수동 외벽 도장"
      };
    const references = hasLocal ? [] : [sampleReference()];
    const harnessImprovements = hasLocal ? localItems.map(operationImprovementToHarnessImprovement) : [sampleImprovement];
    const confirmations = hasLocal ? [] : [
      { displayName: "Nguyen", languageCode: "vi", readAt: "2026-07-09T09:20:00.000Z" }
    ];
    const graph = buildOperationMemoryGraph({
      workpack,
      references,
      improvements: harnessImprovements,
      confirmations
    });

    const learningInput: WorkpackLearningInput = {
      workpackId: workpack.id,
      generatedAt: workpack.generatedAt,
      question: workpack.question,
      taskLabel: workpack.taskLabel,
      references,
      improvements: harnessImprovements,
      confirmations
    };

    return {
      mode: hasLocal ? "local" as const : "sample" as const,
      graph,
      model: buildOperationMemoryVisualizationModel(graph),
      learningInput
    };
  }, [improvements]);

  function downloadLearningMemory(format: WorkpackLearningFormat) {
    const file = buildWorkpackLearningFile(preview.learningInput, format);
    downloadTextFile(file.fileName, file.contentType, file.content);
    if (format === "jsonl") {
      setDownloadMessage("운영 메모리 JSONL을 내려받았습니다.");
      return;
    }
    if (format === "obsidian") {
      setDownloadMessage("Obsidian용 작업 그래프 Markdown을 내려받았습니다.");
      return;
    }
    setDownloadMessage("작업 개선 메모리 Markdown을 내려받았습니다.");
  }

  return (
    <OperationMemoryGraphViewer
      graph={preview.graph}
      title="오늘 작업 메모리 맵"
      description={(
        <>
          {preview.mode === "local"
            ? "워크스페이스에서 보관한 최근 개선사항을 관리자 검토용 작업 이력 그래프로 재구성했습니다."
            : "아직 로컬 개선 후보가 없어 개선 전/개선 후 개선 루프 샘플을 보여줍니다."}
          {" "}MD/JSONL/Obsidian 노트는 다음 위험성평가와 TBM 생성에서 DB 하네스가 먼저 조회할 후보입니다.
        </>
      )}
      actions={(
        <>
          <button type="button" onClick={() => setImprovements(loadStoredImprovements())}>
            최근 후보 다시 읽기
          </button>
          <button type="button" onClick={() => downloadLearningMemory("markdown")}>
            작업 이력 MD
          </button>
          <button type="button" onClick={() => downloadLearningMemory("jsonl")}>
            하네스 JSONL
          </button>
          <button type="button" onClick={() => downloadLearningMemory("obsidian")}>
            Obsidian MD
          </button>
        </>
      )}
      statusMessage={downloadMessage || null}
    />
  );
}
