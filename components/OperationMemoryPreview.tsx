"use client";

import { type KeyboardEvent, useEffect, useMemo, useState } from "react";
import {
  OPERATION_IMPROVEMENTS_STORAGE_KEY,
  operationImprovementToHarnessImprovement,
  parseOperationImprovements,
  type OperationImprovement
} from "@/lib/operation-improvement-history";
import { buildOperationMemoryGraph } from "@/lib/ontology/operation-memory";
import {
  buildOperationMemoryVisualizationModel,
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
  improvementText: "Before 사진의 난간 누락 구간을 보강하고 After 사진에서 출입통제선을 확인",
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

export function OperationMemoryPreview() {
  const [improvements, setImprovements] = useState<OperationImprovement[]>([]);
  const [downloadMessage, setDownloadMessage] = useState("");
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);

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

  const hoverCardsById = new Map(preview.model.hoverCards.map((card) => [card.id, card]));
  const activeCard = activeNodeId ? hoverCardsById.get(activeNodeId) : undefined;

  useEffect(() => {
    setActiveNodeId((current) => {
      if (current && hoverCardsById.has(current)) return current;
      return preview.model.focusNodeId;
    });
  }, [preview.model.focusNodeId, preview.model.hoverCards]);

  function selectNode(nodeId: string) {
    setActiveNodeId(nodeId);
  }

  function selectNodeWithKey(event: KeyboardEvent<HTMLElement>, nodeId: string) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    selectNode(nodeId);
  }

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
    <section className="safeclaw-module-panel operation-memory-preview" aria-label="작업 이력 온톨로지 미리보기">
      <div className="compact-head">
        <span className="eyebrow">Operation Graph</span>
        <strong>오늘 작업 메모리 맵</strong>
      </div>
      <div className="operation-memory-copy">
        <p>
          {preview.mode === "local"
            ? "워크스페이스에서 보관한 최근 개선사항을 관리자 검토용 작업 이력 그래프로 재구성했습니다."
            : "아직 로컬 개선 후보가 없어 Before/After 개선 루프 샘플을 보여줍니다."}
          {" "}MD/JSONL/Obsidian 노트는 다음 위험성평가와 TBM 생성에서 DB 하네스가 먼저 조회할 후보입니다.
        </p>
        <div className="operation-memory-actions" aria-label="작업 이력 메모리 파일">
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
        </div>
      </div>
      {downloadMessage ? <p className="operation-memory-message" role="status">{downloadMessage}</p> : null}

      <div className="operation-memory-grid">
        <div className="operation-memory-board" aria-label="Workpack operation memory map">
          <div className="operation-memory-stats" aria-label="작업 이력 그래프 통계">
            <span>노드 {preview.model.stats.visibleNodes}/{preview.model.stats.totalNodes}</span>
            <span>관계 {preview.model.stats.visibleEdges}/{preview.model.stats.totalEdges}</span>
          </div>
          <svg viewBox="0 0 100 100" role="img" aria-label="작업팩, 위험, 개선, 근거, 확인 연결 지도">
            {preview.model.map.edges.map((edge) => (
              <line
                key={edge.id}
                x1={edge.x1}
                y1={edge.y1}
                x2={edge.x2}
                y2={edge.y2}
                className={`operation-memory-edge relation-${edge.rel}`}
              />
            ))}
            {preview.model.map.nodes.map((node) => (
              <circle
                key={node.id}
                cx={node.x}
                cy={node.y}
                r={node.size}
                className={`operation-memory-svg-node kind-${node.kind}${node.id === activeNodeId ? " is-active" : ""}`}
              />
            ))}
          </svg>
          <div className="operation-memory-node-layer">
            {preview.model.map.nodes.map((node) => {
              const isActive = node.id === activeNodeId;
              return (
                <article
                  key={node.id}
                  className={`operation-memory-point kind-${node.kind}${isActive ? " is-active" : ""}`}
                  style={{ left: `${node.x}%`, top: `${node.y}%` }}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isActive}
                  onClick={() => selectNode(node.id)}
                  onMouseEnter={() => selectNode(node.id)}
                  onFocus={() => selectNode(node.id)}
                  onKeyDown={(event) => selectNodeWithKey(event, node.id)}
                >
                  <span>{node.kind}</span>
                  <strong>{node.label}</strong>
                  <small>{node.degree} links</small>
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
            {preview.model.list.map((item) => {
              const isActive = item.id === activeNodeId;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`operation-memory-list-item${isActive ? " is-active" : ""}`}
                  onClick={() => selectNode(item.id)}
                >
                  <span>{item.kind}</span>
                  <strong>{item.label}</strong>
                  <small>out {item.outgoingCount} · in {item.incomingCount}</small>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
