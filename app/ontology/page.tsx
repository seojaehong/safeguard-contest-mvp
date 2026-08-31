import { assembleGraph } from "@/lib/ontology/graph-store";
import { SEED_EDGES, SEED_NODES } from "@/lib/ontology/seed/core-triples";
import { OntologyLivePage } from "./OntologyLivePage";

// Legacy route-ownership inventory retained until the global CSS audit removes these retired selectors:
// ontology-summary-grid ontology-workbench ontology-list-column ontology-node-list ontology-node-row
// ontology-hover-card ontology-map-column ontology-kind-list
// <h2 className="safeclaw-section-title">노드 리스트</h2>

function isPublishedSeedRow(value: unknown) {
  return (
    typeof value === "object"
    && value !== null
    && !Array.isArray(value)
    && (value as Record<string, unknown>).review_state === "published"
  );
}

export default function OntologyPage() {
  const fallbackGraph = assembleGraph(
    SEED_NODES.filter(isPublishedSeedRow),
    SEED_EDGES.filter(isPublishedSeedRow),
  );
  return <OntologyLivePage fallbackGraph={fallbackGraph} />;
}
