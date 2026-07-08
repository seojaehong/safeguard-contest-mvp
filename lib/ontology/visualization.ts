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

export type OntologyVisualizationModel = {
  list: OntologyListItem[];
  hoverCards: OntologyHoverCard[];
};

function kindLabel(kind: OntologyNode["kind"]) {
  if (kind === "Task") return "작업";
  if (kind === "Hazard") return "위험요인";
  if (kind === "Control") return "조치";
  if (kind === "Article") return "법령";
  if (kind === "Accident") return "사례";
  if (kind === "Document") return "문서";
  return "의무";
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

  return { list, hoverCards };
}
