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
    label: string;
    value: string;
  }>;
  related: Array<{
    rel: OperationMemoryEdge["relation"];
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
  map: {
    nodes: OperationMemoryMapNode[];
    edges: OperationMemoryMapEdge[];
  };
};

const MAX_OPERATION_MAP_NODES = 24;
const MAX_OPERATION_MAP_EDGES = 48;

export function operationKindLabel(kind: OperationMemoryNodeKind) {
  if (kind === "Workpack") return "작업팩";
  if (kind === "Evidence") return "근거";
  if (kind === "Hazard") return "위험";
  if (kind === "Control") return "조치";
  if (kind === "Improvement") return "개선";
  return "확인";
}

export function operationRelationLabel(value: OperationMemoryEdge["relation"]) {
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

function metaRows(node: OperationMemoryNode): OperationMemoryHoverCard["metaRows"] {
  const priority = new Map([
    ["visionLabel", 0],
    ["visionStatus", 1],
    ["analysisMode", 2],
    ["photoPairAttached", 3],
    ["sourceType", 4],
    ["visionModel", 5]
  ]);
  return Object.entries(node.meta)
    .flatMap(([label, raw]) => {
      if (raw === null || typeof raw === "undefined" || raw === "") return [];
      return [{ label, value: String(raw) }];
    })
    .sort((a, b) => {
      const priorityDelta = (priority.get(a.label) ?? 100) - (priority.get(b.label) ?? 100);
      if (priorityDelta !== 0) return priorityDelta;
      return a.label.localeCompare(b.label, "ko");
    })
    .slice(0, 5);
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

  const list = graph.nodes.map((node) => ({
    id: node.id,
    kind: node.kind,
    label: node.label,
    detail: node.detail,
    outgoingCount: outgoing.get(node.id)?.length || 0,
    incomingCount: incoming.get(node.id)?.length || 0
  }));

  const degreeById = new Map<string, number>();
  for (const item of list) {
    degreeById.set(item.id, item.incomingCount + item.outgoingCount);
  }

  const hoverCards = graph.nodes.map((node) => ({
    id: node.id,
    title: node.label,
    subtitle: operationKindLabel(node.kind),
    detail: node.detail,
    metaRows: metaRows(node),
    related: (outgoing.get(node.id) || []).map((edge) => {
      const target = nodeMap.get(edge.targetId);
      return {
        rel: edge.relation,
        targetId: edge.targetId,
        targetLabel: target?.label || edge.targetId
      };
    })
  }));

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
    map: {
      nodes: mapNodes,
      edges: mapEdges
    }
  };
}
