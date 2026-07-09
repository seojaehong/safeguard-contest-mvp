"use client";

import { useEffect, useMemo, useState } from "react";
import {
  OPERATION_IMPROVEMENTS_STORAGE_KEY,
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

function toHarnessImprovement(item: OperationImprovement): HarnessImprovement {
  return {
    id: item.remoteImprovementId || item.id,
    taskLabel: item.workSummary,
    hazardLabel: item.hazardLabel,
    improvementText: item.improvementText,
    reflectedDocuments: item.reflectedDocuments,
    sourceType: item.sourceType || "manual",
    visionStatus: item.visionStatus,
    analysisMode: item.analysisMode,
    photoPairAttached: item.photoPairAttached,
    visionUserLabel: item.visionUserLabel,
    visionSummary: item.visionSummary || item.photoAnalysisSummary,
    detectedHazards: item.detectedHazards,
    observedImprovement: item.observedImprovement,
    ocrText: item.ocrText
  };
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
    const harnessImprovements = hasLocal ? localItems.map(toHarnessImprovement) : [sampleImprovement];
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

  function downloadLearningMemory(format: WorkpackLearningFormat) {
    const file = buildWorkpackLearningFile(preview.learningInput, format);
    downloadTextFile(file.fileName, file.contentType, file.content);
    setDownloadMessage(format === "jsonl" ? "운영 메모리 JSONL을 내려받았습니다." : "작업 개선 메모리 Markdown을 내려받았습니다.");
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
        </p>
        <div className="operation-memory-actions" aria-label="작업 이력 메모리 파일">
          <button type="button" onClick={() => setImprovements(loadStoredImprovements())}>
            최근 후보 다시 읽기
          </button>
          <button type="button" onClick={() => downloadLearningMemory("markdown")}>
            MD 저장
          </button>
          <button type="button" onClick={() => downloadLearningMemory("jsonl")}>
            JSONL 저장
          </button>
        </div>
      </div>
      {downloadMessage ? <p className="operation-memory-message" role="status">{downloadMessage}</p> : null}

      <div className="operation-memory-grid">
        <div className="operation-memory-board" aria-label="Workpack operation memory map">
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
                className={`operation-memory-svg-node kind-${node.kind}`}
              />
            ))}
          </svg>
          <div className="operation-memory-node-layer">
            {preview.model.map.nodes.map((node) => {
              const card = hoverCardsById.get(node.id);
              return (
                <article
                  key={node.id}
                  className={`operation-memory-point kind-${node.kind}`}
                  style={{ left: `${node.x}%`, top: `${node.y}%` }}
                  tabIndex={0}
                >
                  <span>{node.kind}</span>
                  <strong>{node.label}</strong>
                  <small>{node.degree} links</small>
                  {card ? (
                    <aside className="operation-memory-popover" role="note">
                      <span>{card.subtitle}</span>
                      <strong>{card.title}</strong>
                      {card.detail ? <p>{card.detail}</p> : null}
                      {card.metaRows.length ? (
                        <dl>
                          {card.metaRows.slice(0, 4).map((row) => (
                            <div key={`${card.id}-${row.label}`}>
                              <dt>{row.label}</dt>
                              <dd>{row.value}</dd>
                            </div>
                          ))}
                        </dl>
                      ) : null}
                      <ul>
                        {card.related.slice(0, 4).map((related) => (
                          <li key={`${card.id}-${related.rel}-${related.targetId}`}>
                            <b>{operationRelationLabel(related.rel)}</b>
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

        <div className="operation-memory-list" aria-label="작업 이력 노드 리스트">
          {preview.model.list.map((item) => {
            const card = hoverCardsById.get(item.id);
            return (
              <article key={item.id}>
                <div>
                  <span>{item.kind}</span>
                  <strong>{item.label}</strong>
                  <small>out {item.outgoingCount} · in {item.incomingCount}</small>
                </div>
                {card ? (
                  <aside className="operation-memory-inline-card" role="note">
                    <span>{card.subtitle}</span>
                    {card.detail ? <p>{card.detail}</p> : null}
                    <ul>
                      {card.related.slice(0, 3).map((related) => (
                        <li key={`${card.id}-list-${related.rel}-${related.targetId}`}>
                          <b>{operationRelationLabel(related.rel)}</b>
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
    </section>
  );
}
