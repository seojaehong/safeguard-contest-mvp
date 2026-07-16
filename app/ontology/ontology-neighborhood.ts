import type { OntologyHoverCard, OntologyListItem } from "@/lib/ontology/visualization";

export type NeighborhoodSource = {
  nodes: OntologyListItem[];
  related: OntologyHoverCard[];
};

export type PositionedNeighborhoodNode = OntologyListItem & {
  x: number;
  y: number;
  isSelected: boolean;
};

export type NeighborhoodEdge = {
  id: string;
  rel: string;
  sourceId: string;
  targetId: string;
  isSelectedPath: boolean;
};

export type OntologyNeighborhood = {
  nodes: PositionedNeighborhoodNode[];
  edges: NeighborhoodEdge[];
};

const DISPLAY_SLOTS = [
  { x: 50, y: 50 },
  { x: 10, y: 16 },
  { x: 30, y: 16 },
  { x: 50, y: 16 },
  { x: 70, y: 16 },
  { x: 90, y: 16 },
  { x: 10, y: 50 },
  { x: 30, y: 50 },
  { x: 70, y: 50 },
  { x: 90, y: 50 },
  { x: 10, y: 84 },
  { x: 30, y: 84 },
  { x: 50, y: 84 },
  { x: 70, y: 84 },
  { x: 90, y: 84 }
] as const;

function compareNode(a: OntologyListItem, b: OntologyListItem) {
  const degreeDelta = (b.incomingCount + b.outgoingCount) - (a.incomingCount + a.outgoingCount);
  return degreeDelta || a.label.localeCompare(b.label, "ko") || a.id.localeCompare(b.id);
}

function canonicalEdges(source: NeighborhoodSource) {
  const byId = new Map<string, NeighborhoodEdge>();
  for (const card of source.related) {
    for (const relation of card.related) {
      const id = `${relation.sourceId}|${relation.rel}|${relation.targetId}`;
      if (!byId.has(id)) {
        byId.set(id, {
          id,
          rel: relation.rel,
          sourceId: relation.sourceId,
          targetId: relation.targetId,
          isSelectedPath: false
        });
      }
    }
  }
  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
}

export function buildOntologyNeighborhood(
  source: NeighborhoodSource,
  selectedNodeId: string,
  depth: 1 | 2,
  limit: number
): OntologyNeighborhood {
  const boundedLimit = Math.max(1, Math.min(limit, DISPLAY_SLOTS.length));
  const nodeById = new Map(source.nodes.map((node) => [node.id, node]));
  const selected = nodeById.get(selectedNodeId) || [...source.nodes].sort(compareNode)[0];
  if (!selected) return { nodes: [], edges: [] };

  const allEdges = canonicalEdges(source);
  const adjacency = new Map<string, Set<string>>();
  for (const edge of allEdges) {
    adjacency.set(edge.sourceId, new Set([...(adjacency.get(edge.sourceId) || []), edge.targetId]));
    adjacency.set(edge.targetId, new Set([...(adjacency.get(edge.targetId) || []), edge.sourceId]));
  }

  const orderedIds = [selected.id];
  const visited = new Set(orderedIds);
  let frontier = [selected.id];
  for (let currentDepth = 1; currentDepth <= depth && orderedIds.length < boundedLimit; currentDepth += 1) {
    const nextFrontier: string[] = [];
    for (const nodeId of frontier) {
      const neighbors = [...(adjacency.get(nodeId) || [])]
        .map((id) => nodeById.get(id))
        .filter((node): node is OntologyListItem => Boolean(node))
        .filter((node) => !visited.has(node.id))
        .sort(compareNode);
      for (const node of neighbors) {
        if (orderedIds.length >= boundedLimit) break;
        visited.add(node.id);
        orderedIds.push(node.id);
        nextFrontier.push(node.id);
      }
    }
    frontier = nextFrontier;
  }

  const visibleIds = new Set(orderedIds);
  const nodes = orderedIds.flatMap((id, index): PositionedNeighborhoodNode[] => {
    const node = nodeById.get(id);
    const slot = DISPLAY_SLOTS[index];
    if (!node || !slot) return [];
    return [{ ...node, ...slot, isSelected: id === selected.id }];
  });
  const edges = allEdges
    .filter((edge) => visibleIds.has(edge.sourceId) && visibleIds.has(edge.targetId))
    .map((edge) => ({
      ...edge,
      isSelectedPath: edge.sourceId === selected.id || edge.targetId === selected.id
    }));

  return { nodes, edges };
}

export function countPositionOverlaps(nodes: PositionedNeighborhoodNode[]) {
  let overlaps = 0;
  for (let left = 0; left < nodes.length; left += 1) {
    for (let right = left + 1; right < nodes.length; right += 1) {
      if (Math.abs(nodes[left].x - nodes[right].x) < 16 && Math.abs(nodes[left].y - nodes[right].y) < 17) {
        overlaps += 1;
      }
    }
  }
  return overlaps;
}
