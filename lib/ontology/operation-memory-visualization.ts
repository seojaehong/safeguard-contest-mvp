import type {
  OperationMemoryEdge,
  OperationMemoryGraph,
  OperationMemoryNode,
  OperationMemoryNodeKind
} from "@/lib/ontology/operation-memory";

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

const MAX_OPERATION_MAP_NODES = 18;
const MAX_OPERATION_MAP_EDGES = 36;

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

function kindRadius(kind: OperationMemoryNodeKind) {
  if (kind === "Workpack") return 0;
  if (kind === "Evidence") return 22;
  if (kind === "Hazard") return 30;
  if (kind === "Control") return 36;
  if (kind === "Improvement") return 24;
  return 38;
}

function clampCoordinate(value: number) {
  return Math.min(Math.max(Math.round(value * 10) / 10, 8), 92);
}

function metaLabel(key: string) {
  if (key === "sourceId") return "원본 ID";
  if (key === "generatedAt") return "생성 시각";
  if (key === "referenceItemId") return "근거 ID";
  if (key === "itemType") return "근거 유형";
  if (key === "evidenceRole") return "근거 역할";
  if (key === "source") return "출처";
  if (key === "improvementId") return "개선 ID";
  if (key === "sourceType") return "수집 방식";
  if (key === "visionStatus") return "이미지 상태";
  if (key === "analysisMode") return "분석 방식";
  if (key === "photoPairAttached") return "비포/애프터";
  if (key === "visionLabel") return "이미지 분석";
  if (key === "visionModel") return "분석 모델";
  if (key === "photoCount") return "사진 수";
  if (key === "sourcePhotos") return "원본 사진";
  if (key === "siteSignals") return "현장 신호";
  if (key === "photoEvidence") return "사진 근거";
  if (key === "languageCode") return "언어";
  if (key === "readAt") return "확인 시각";
  return key;
}

function metaValue(raw: string | number | boolean | null) {
  if (typeof raw === "boolean") return raw ? "예" : "아니오";
  return String(raw);
}

function metaRows(node: OperationMemoryNode): OperationMemoryHoverCard["metaRows"] {
  const priority = new Map([
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
    .flatMap(([label, raw]) => {
      if (raw === null || typeof raw === "undefined" || raw === "") return [];
      return [{ key: label, label: metaLabel(label), value: metaValue(raw) }];
    })
    .sort((a, b) => {
      const priorityDelta = (priority.get(a.key) ?? 100) - (priority.get(b.key) ?? 100);
      if (priorityDelta !== 0) return priorityDelta;
      return a.label.localeCompare(b.label, "ko");
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
      return a.label.localeCompare(b.label, "ko");
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
        const directionDelta = a.direction.localeCompare(b.direction);
        if (directionDelta !== 0) return directionDelta;
        const relationDelta = operationRelationLabel(a.rel).localeCompare(operationRelationLabel(b.rel), "ko");
        if (relationDelta !== 0) return relationDelta;
        return a.nodeLabel.localeCompare(b.nodeLabel, "ko");
      })
    };
  });

  const sortedNodes = [...graph.nodes].sort((a, b) => {
    if (a.kind === "Workpack") return -1;
    if (b.kind === "Workpack") return 1;
    const degreeDelta = (degreeById.get(b.id) || 0) - (degreeById.get(a.id) || 0);
    if (degreeDelta !== 0) return degreeDelta;
    return a.label.localeCompare(b.label, "ko");
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
    const radius = kindRadius(node.kind) + (index % 2) * 2.8;
    return {
      id: node.id,
      kind: node.kind,
      label: node.label,
      x: clampCoordinate(50 + Math.cos(angle) * radius),
      y: clampCoordinate(50 + Math.sin(angle) * radius * 0.68),
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
