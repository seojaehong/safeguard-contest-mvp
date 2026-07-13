import type {
  OperationMemoryEdge,
  OperationMemoryGraph,
  OperationMemoryNode,
  OperationMemoryNodeKind
} from "@/lib/ontology/operation-memory";
import type { HarnessImprovement } from "@/lib/db-harness";
import { EDGE_RELS, REL_KO, type EdgeRel } from "@/lib/ontology/schema";
import { isRfc3339OffsetTimestamp } from "@/lib/rfc3339-timestamp";

export type OperationMemoryListItem = {
  id: string;
  kind: OperationMemoryNodeKind;
  label: string;
  detail?: string;
  outgoingCount: number;
  incomingCount: number;
};

export type OperationMemoryHoverCard = {
  id: string;
  title: string;
  subtitle: string;
  detail?: string;
  metaRows: Array<{
    key: string;
    label: string;
    value: string;
  }>;
  related: Array<{
    rel: OperationMemoryEdge["relation"];
    direction: "incoming" | "outgoing";
    nodeId: string;
    nodeLabel: string;
    nodeKind: OperationMemoryNodeKind;
    targetId: string;
    targetLabel: string;
  }>;
};

export type OperationMemoryMapNode = {
  id: string;
  kind: OperationMemoryNodeKind;
  label: string;
  x: number;
  y: number;
  size: number;
  degree: number;
};

export type OperationMemoryMapEdge = {
  id: string;
  rel: OperationMemoryEdge["relation"];
  sourceId: string;
  targetId: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

export type OperationMemoryVisualizationModel = {
  list: OperationMemoryListItem[];
  hoverCards: OperationMemoryHoverCard[];
  focusNodeId: string | null;
  stats: {
    totalNodes: number;
    totalEdges: number;
    visibleNodes: number;
    visibleEdges: number;
    hiddenNodes: number;
    hiddenEdges: number;
  };
  map: {
    nodes: OperationMemoryMapNode[];
    edges: OperationMemoryMapEdge[];
  };
};

const MAX_OPERATION_MAP_NODES = 9;
const MAX_OPERATION_MAP_EDGES = 36;

export function ontologyRelationLabel(value: unknown): string {
  if (typeof value !== "string" || !EDGE_RELS.includes(value as EdgeRel)) {
    return "분류 검토 필요";
  }
  return REL_KO[value as EdgeRel];
}

export function operationKindLabel(kind: OperationMemoryNodeKind) {
  if (kind === "Workpack") return "작업팩";
  if (kind === "Evidence") return "근거";
  if (kind === "Hazard") return "위험";
  if (kind === "Control") return "조치";
  if (kind === "Improvement") return "개선";
  return "확인";
}

export function operationRelationLabel(value: OperationMemoryEdge["relation"]) {
  if (value === "similarWorkpack") return "유사 작업";
  if (value === "usesEvidence") return "근거";
  if (value === "mentionsHazard") return "위험";
  if (value === "mitigatedBy") return "조치";
  if (value === "hasImprovement") return "개선";
  if (value === "addressesHazard") return "대상";
  return "확인";
}

function clampCoordinate(value: number) {
  return Math.min(Math.max(Math.round(value * 10) / 10, 8), 92);
}

function compareStableText(left: string, right: string) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

type OperationMemoryMetadataKey =
  | "sourceId"
  | "generatedAt"
  | "reflectedDocuments"
  | "referenceItemId"
  | "itemType"
  | "rawTitle"
  | "displayTitle"
  | "evidenceRole"
  | "source"
  | "improvementId"
  | "sourceType"
  | "visionStatus"
  | "analysisMode"
  | "photoPairAttached"
  | "visionLabel"
  | "visionModel"
  | "photoCount"
  | "sourcePhotos"
  | "siteSignals"
  | "photoEvidence"
  | "languageCode"
  | "readAt";

const operationMemoryMetadataLabels = {
  sourceId: "원본 ID",
  generatedAt: "생성 시각",
  reflectedDocuments: "반영 문서",
  referenceItemId: "근거 ID",
  itemType: "근거 유형",
  rawTitle: "원본 제목",
  displayTitle: "표시 제목",
  evidenceRole: "근거 역할",
  source: "출처",
  improvementId: "개선 ID",
  sourceType: "수집 방식",
  visionStatus: "이미지 상태",
  analysisMode: "분석 방식",
  photoPairAttached: "개선 전/개선 후",
  visionLabel: "이미지 분석",
  visionModel: "분석 모델",
  photoCount: "사진 수",
  sourcePhotos: "원본 사진",
  siteSignals: "현장 신호",
  photoEvidence: "사진 근거",
  languageCode: "언어",
  readAt: "확인 시각"
} satisfies Record<OperationMemoryMetadataKey, string>;

function isOperationMemoryMetadataKey(key: string): key is OperationMemoryMetadataKey {
  return Object.prototype.hasOwnProperty.call(operationMemoryMetadataLabels, key);
}

type ImprovementSourceType = HarnessImprovement["sourceType"];
type VisionStatus = NonNullable<HarnessImprovement["visionStatus"]>;
type AnalysisMode = NonNullable<HarnessImprovement["analysisMode"]>;
type KnownItemType =
  | "sif-case"
  | "technical-guideline"
  | "technical-support-regulation"
  | "machinery"
  | "kosha-guide"
  | "guide"
  | "guideline"
  | "source";

const improvementSourceLabels = {
  manual: "수기 입력",
  photo_analysis: "개선 사진 분석",
  operator_note: "작업자 메모"
} satisfies Record<ImprovementSourceType, string>;

const visionStatusLabels = {
  analyzed: "분석 완료",
  unconfigured: "분석 설정 필요",
  failed: "분석 실패"
} satisfies Record<VisionStatus, string>;

const analysisModeLabels = {
  vision_ocr: "이미지·문자 인식 분석",
  photo_pair_unanalyzed: "개선 전/개선 후 사진 미분석",
  manual_text: "수기 입력"
} satisfies Record<AnalysisMode, string>;

const itemTypeLabels = {
  "sif-case": "중대위험 사례",
  "technical-guideline": "기술 지침",
  "technical-support-regulation": "기술지원 규정",
  machinery: "기계 안전 자료",
  "kosha-guide": "KOSHA 가이드",
  guide: "안전 가이드",
  guideline: "안전 지침",
  source: "원문 근거"
} satisfies Record<KnownItemType, string>;

const languageLabels: Record<string, string> = {
  ko: "한국어",
  vi: "베트남어",
  zh: "중국어",
  mn: "몽골어",
  th: "태국어",
  tl: "타갈로그어",
  uz: "우즈베크어",
  km: "크메르어",
  id: "인도네시아어",
  ne: "네팔어"
};

function mappedValue(value: string, labels: Readonly<Record<string, string>>): string {
  return labels[value] || "분류 검토 필요";
}

function metaValue(key: OperationMemoryMetadataKey, raw: string | number | boolean | null) {
  if (key === "generatedAt" || key === "readAt") {
    if (typeof raw === "string" && isRfc3339OffsetTimestamp(raw)) return raw;
    return key === "generatedAt" ? "생성 시각 확인 전" : "확인 시각 확인 전";
  }
  if (typeof raw === "boolean") return raw ? "예" : "아니오";
  if (typeof raw === "string") {
    if (key === "sourceType") return mappedValue(raw, improvementSourceLabels);
    if (key === "visionStatus") return mappedValue(raw, visionStatusLabels);
    if (key === "analysisMode") return mappedValue(raw, analysisModeLabels);
    if (key === "itemType") return mappedValue(raw, itemTypeLabels);
    if (key === "evidenceRole") return mappedValue(raw, { direct: "직접 근거", supporting: "보조 근거" });
    if (key === "source") return mappedValue(raw, {
      safety_reference_items: "안전 근거 카탈로그",
      manual: "수기 입력",
      photo_analysis: "개선 사진 분석",
      operator_note: "작업자 메모"
    });
    if (key === "languageCode") return mappedValue(raw, languageLabels);
    if (key === "visionLabel") return mappedValue(raw, {
      "vision/OCR 분석 완료": "이미지·문자 인식 분석 완료",
      "수기 개선사항": "수기 개선사항"
    });
    if (key === "visionModel") return mappedValue(raw, {
      "gpt-4.1-mini": "이미지 분석 모델",
      "gemini-2.5-flash": "이미지 분석 모델"
    });
  }
  return String(raw);
}

function metaRows(node: OperationMemoryNode): OperationMemoryHoverCard["metaRows"] {
  const priority = new Map([
    ["reviewRequired", -1],
    ["visionLabel", 0],
    ["visionStatus", 1],
    ["analysisMode", 2],
    ["photoPairAttached", 3],
    ["sourcePhotos", 4],
    ["siteSignals", 5],
    ["photoEvidence", 6],
    ["sourceType", 7],
    ["visionModel", 8]
  ]);
  return Object.entries(node.meta)
    .flatMap(([key, raw]) => {
      if (!isOperationMemoryMetadataKey(key)) {
        return [{ key: "reviewRequired", label: "분류 검토 필요", value: "분류 검토 필요" }];
      }
      if (typeof raw === "undefined" || raw === "" || (raw === null && key !== "generatedAt" && key !== "readAt")) {
        return [];
      }
      return [{ key, label: operationMemoryMetadataLabels[key], value: metaValue(key, raw) }];
    })
    .filter((row, index, rows) => row.key !== "reviewRequired" || rows.findIndex((item) => item.key === row.key) === index)
    .sort((a, b) => {
      const priorityDelta = (priority.get(a.key) ?? 100) - (priority.get(b.key) ?? 100);
      if (priorityDelta !== 0) return priorityDelta;
      return compareStableText(a.label, b.label);
    })
    .slice(0, 5);
}

function nodeSortPriority(kind: OperationMemoryNodeKind) {
  if (kind === "Workpack") return 0;
  if (kind === "Hazard") return 1;
  if (kind === "Improvement") return 2;
  if (kind === "Evidence") return 3;
  if (kind === "Control") return 4;
  return 5;
}

export function buildOperationMemoryVisualizationModel(
  graph: OperationMemoryGraph
): OperationMemoryVisualizationModel {
  const nodeMap = new Map(graph.nodes.map((node) => [node.id, node]));
  const outgoing = new Map<string, OperationMemoryEdge[]>();
  const incoming = new Map<string, OperationMemoryEdge[]>();

  for (const edge of graph.edges) {
    outgoing.set(edge.sourceId, [...(outgoing.get(edge.sourceId) || []), edge]);
    incoming.set(edge.targetId, [...(incoming.get(edge.targetId) || []), edge]);
  }

  const list = graph.nodes
    .map((node) => ({
      id: node.id,
      kind: node.kind,
      label: node.label,
      detail: node.detail,
      outgoingCount: outgoing.get(node.id)?.length || 0,
      incomingCount: incoming.get(node.id)?.length || 0
    }))
    .sort((a, b) => {
      const priorityDelta = nodeSortPriority(a.kind) - nodeSortPriority(b.kind);
      if (priorityDelta !== 0) return priorityDelta;
      const degreeDelta = (b.incomingCount + b.outgoingCount) - (a.incomingCount + a.outgoingCount);
      if (degreeDelta !== 0) return degreeDelta;
      return compareStableText(a.label, b.label);
    });

  const degreeById = new Map<string, number>();
  for (const item of list) {
    degreeById.set(item.id, item.incomingCount + item.outgoingCount);
  }

  const hoverCards = graph.nodes.map((node) => {
    const outgoingRelations = (outgoing.get(node.id) || []).map((edge) => {
      const target = nodeMap.get(edge.targetId);
      return {
        rel: edge.relation,
        direction: "outgoing" as const,
        nodeId: edge.targetId,
        nodeLabel: target?.label || edge.targetId,
        nodeKind: target?.kind || "Evidence" as OperationMemoryNodeKind,
        targetId: edge.targetId,
        targetLabel: target?.label || edge.targetId
      };
    });
    const incomingRelations = (incoming.get(node.id) || []).map((edge) => {
      const source = nodeMap.get(edge.sourceId);
      return {
        rel: edge.relation,
        direction: "incoming" as const,
        nodeId: edge.sourceId,
        nodeLabel: source?.label || edge.sourceId,
        nodeKind: source?.kind || "Evidence" as OperationMemoryNodeKind,
        targetId: edge.sourceId,
        targetLabel: source?.label || edge.sourceId
      };
    });
    return {
      id: node.id,
      title: node.label,
      subtitle: operationKindLabel(node.kind),
      detail: node.detail,
      metaRows: metaRows(node),
      related: [...outgoingRelations, ...incomingRelations].sort((a, b) => {
        const directionDelta = compareStableText(a.direction, b.direction);
        if (directionDelta !== 0) return directionDelta;
        const relationDelta = compareStableText(operationRelationLabel(a.rel), operationRelationLabel(b.rel));
        if (relationDelta !== 0) return relationDelta;
        return compareStableText(a.nodeLabel, b.nodeLabel);
      })
    };
  });

  const sortedNodes = [...graph.nodes].sort((a, b) => {
    if (a.kind === "Workpack") return -1;
    if (b.kind === "Workpack") return 1;
    const degreeDelta = (degreeById.get(b.id) || 0) - (degreeById.get(a.id) || 0);
    if (degreeDelta !== 0) return degreeDelta;
    return compareStableText(a.label, b.label);
  }).slice(0, MAX_OPERATION_MAP_NODES);

  const outerNodes = sortedNodes.filter((node) => node.kind !== "Workpack");
  const mapNodes = sortedNodes.map((node, index): OperationMemoryMapNode => {
    const degree = degreeById.get(node.id) || 0;
    if (node.kind === "Workpack") {
      return {
        id: node.id,
        kind: node.kind,
        label: node.label,
        x: 50,
        y: 50,
        size: Math.min(11, 5.8 + Math.sqrt(degree + 1) * 1.2),
        degree
      };
    }
    const outerIndex = Math.max(0, outerNodes.findIndex((item) => item.id === node.id));
    const angle = ((outerIndex / Math.max(outerNodes.length, 1)) * Math.PI * 2) - Math.PI / 2;
    return {
      id: node.id,
      kind: node.kind,
      label: node.label,
      x: clampCoordinate(50 + Math.cos(angle) * 40),
      y: clampCoordinate(50 + Math.sin(angle) * 30),
      size: Math.min(10.2, 4.4 + Math.sqrt(degree + 1) * 1.2),
      degree
    };
  });

  const mapNodeById = new Map(mapNodes.map((node) => [node.id, node]));
  const mapEdges = graph.edges.flatMap((edge): OperationMemoryMapEdge[] => {
    const source = mapNodeById.get(edge.sourceId);
    const target = mapNodeById.get(edge.targetId);
    if (!source || !target) return [];
    return [{
      id: edge.id,
      rel: edge.relation,
      sourceId: edge.sourceId,
      targetId: edge.targetId,
      x1: source.x,
      y1: source.y,
      x2: target.x,
      y2: target.y
    }];
  }).slice(0, MAX_OPERATION_MAP_EDGES);

  return {
    list,
    hoverCards,
    focusNodeId: sortedNodes[0]?.id || null,
    stats: {
      totalNodes: graph.nodes.length,
      totalEdges: graph.edges.length,
      visibleNodes: mapNodes.length,
      visibleEdges: mapEdges.length,
      hiddenNodes: Math.max(graph.nodes.length - mapNodes.length, 0),
      hiddenEdges: Math.max(graph.edges.length - mapEdges.length, 0)
    },
    map: {
      nodes: mapNodes,
      edges: mapEdges
    }
  };
}
