import type { OntologyGraph } from "@/lib/ontology/graph-store";
import type { OntologyNode } from "@/lib/ontology/schema";

export type OntologyListItem = {
  id: string;
  kind: OntologyNode["kind"];
  label: string;
  outgoingCount: number;
  incomingCount: number;
};

export type OntologyHoverCard = {
  id: string;
  title: string;
  subtitle: string;
  evidenceCount: number;
  related: Array<{
    rel: string;
    targetId: string;
    targetLabel: string;
  }>;
};

export type OntologyMapNode = {
  id: string;
  kind: OntologyNode["kind"];
  label: string;
  x: number;
  y: number;
  size: number;
  degree: number;
};

export type OntologyMapEdge = {
  id: string;
  rel: string;
  sourceId: string;
  targetId: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

export type OntologyVisualizationModel = {
  list: OntologyListItem[];
  hoverCards: OntologyHoverCard[];
  map: {
    nodes: OntologyMapNode[];
    edges: OntologyMapEdge[];
  };
};

const MAX_MAP_NODES = 32;
const MAX_MAP_EDGES = 72;

function kindLabel(kind: OntologyNode["kind"]) {
  if (kind === "Task") return "작업";
  if (kind === "Hazard") return "위험요인";
  if (kind === "Control") return "조치";
  if (kind === "Article") return "법령";
  if (kind === "Accident") return "사례";
  if (kind === "Document") return "문서";
  return "의무";
}

function kindRadius(kind: OntologyNode["kind"]) {
  if (kind === "Task") return 12;
  if (kind === "Hazard") return 25;
  if (kind === "Control") return 33;
  if (kind === "Article") return 39;
  if (kind === "Document") return 42;
  if (kind === "Accident") return 36;
  return 29;
}

function clampCoordinate(value: number) {
  return Math.min(Math.max(Math.round(value * 10) / 10, 7), 93);
}

export function buildOntologyVisualizationModel(graph: OntologyGraph): OntologyVisualizationModel {
  const nodeMap = new Map(graph.nodes.map((node) => [node.node_id, node]));
  const outgoing = new Map<string, typeof graph.edges>();
  const incoming = new Map<string, typeof graph.edges>();

  for (const edge of graph.edges) {
    outgoing.set(edge.src, [...(outgoing.get(edge.src) || []), edge]);
    incoming.set(edge.dst, [...(incoming.get(edge.dst) || []), edge]);
  }

  const list = graph.nodes.map((node) => ({
    id: node.node_id,
    kind: node.kind,
    label: node.label,
    outgoingCount: outgoing.get(node.node_id)?.length || 0,
    incomingCount: incoming.get(node.node_id)?.length || 0
  }));

  const degreeById = new Map<string, number>();
  for (const item of list) {
    degreeById.set(item.id, item.incomingCount + item.outgoingCount);
  }

  const hoverCards = graph.nodes.map((node) => ({
    id: node.node_id,
    title: node.label,
    subtitle: kindLabel(node.kind),
    evidenceCount: node.cited_uids.length,
    related: (outgoing.get(node.node_id) || []).map((edge) => {
      const target = nodeMap.get(edge.dst);
      return {
        rel: edge.rel,
        targetId: edge.dst,
        targetLabel: target?.label || edge.dst
      };
    })
  }));

  const mapNodes = [...graph.nodes]
    .sort((a, b) => {
      const degreeDelta = (degreeById.get(b.node_id) || 0) - (degreeById.get(a.node_id) || 0);
      if (degreeDelta !== 0) return degreeDelta;
      return a.label.localeCompare(b.label, "ko");
    })
    .slice(0, MAX_MAP_NODES)
    .map((node, index, nodes): OntologyMapNode => {
      const degree = degreeById.get(node.node_id) || 0;
      const angle = ((index / Math.max(nodes.length, 1)) * Math.PI * 2) - Math.PI / 2;
      const radius = kindRadius(node.kind) + (index % 3) * 2.8;
      return {
        id: node.node_id,
        kind: node.kind,
        label: node.label,
        x: clampCoordinate(50 + Math.cos(angle) * radius),
        y: clampCoordinate(50 + Math.sin(angle) * radius * 0.72),
        size: Math.min(10.5, 4.4 + Math.sqrt(degree + 1) * 1.3),
        degree
      };
    });
  const mapNodeById = new Map(mapNodes.map((node) => [node.id, node]));
  const mapEdges = graph.edges
    .flatMap((edge): OntologyMapEdge[] => {
      const source = mapNodeById.get(edge.src);
      const target = mapNodeById.get(edge.dst);
      if (!source || !target) return [];
      return [{
        id: `${edge.src}|${edge.rel}|${edge.dst}`,
        rel: edge.rel,
        sourceId: edge.src,
        targetId: edge.dst,
        x1: source.x,
        y1: source.y,
        x2: target.x,
        y2: target.y
      }];
    })
    .slice(0, MAX_MAP_EDGES);

  return {
    list,
    hoverCards,
    map: {
      nodes: mapNodes,
      edges: mapEdges
    }
  };
}
