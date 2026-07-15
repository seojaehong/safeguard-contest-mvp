import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildOntologyNeighborhood,
  countPositionOverlaps,
  type NeighborhoodSource
} from "@/app/ontology/ontology-neighborhood";

const root = path.resolve(__dirname, "..");

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function buildSource(count = 24): NeighborhoodSource {
  const nodes = Array.from({ length: count }, (_, index) => ({
    id: `node-${index}`,
    kind: index === 0 ? "Task" as const : index % 3 === 0 ? "Hazard" as const : "Control" as const,
    label: `노드 ${index}`,
    outgoingCount: index === count - 1 ? 0 : 1,
    incomingCount: index === 0 ? 0 : 1
  }));
  const related = nodes.map((node, index) => ({
    id: node.id,
    title: node.label,
    subtitle: node.kind,
    excerpt: null,
    evidenceCount: 1,
    related: index === count - 1 ? [] : [{
      rel: "relatedTo",
      direction: "outgoing" as const,
      sourceId: node.id,
      sourceLabel: node.label,
      targetId: nodes[index + 1].id,
      targetLabel: nodes[index + 1].label
    }]
  }));
  return { nodes, related };
}

describe("ontology P0 neighborhood contract", () => {
  it("bounds a deterministic two-hop neighborhood to collision-free display slots", () => {
    const source = buildSource();
    const first = buildOntologyNeighborhood(source, "node-0", 2, 15);
    const second = buildOntologyNeighborhood(source, "node-0", 2, 15);

    expect(first).toEqual(second);
    expect(first.nodes.map((node) => node.id)).toEqual(["node-0", "node-1", "node-2"]);
    expect(first.nodes.length).toBeLessThanOrEqual(15);
    expect(first.nodes[0]).toMatchObject({ id: "node-0", isSelected: true });
    expect(countPositionOverlaps(first.nodes)).toBe(0);
  });

  it("keeps one-hop and two-hop exploration distinct", () => {
    const source = buildSource();

    expect(buildOntologyNeighborhood(source, "node-6", 1, 15).nodes.map((node) => node.id))
      .toEqual(["node-6", "node-5", "node-7"]);
    expect(buildOntologyNeighborhood(source, "node-6", 2, 15).nodes.map((node) => node.id))
      .toEqual(["node-6", "node-5", "node-7", "node-4", "node-8"]);
  });
});

describe("ontology P0 presentation contract", () => {
  it("replaces the two hairball graphs with a single task-focused explorer", () => {
    const page = read("app/ontology/page.tsx");
    const explorer = read("app/ontology/OntologyExplorer.tsx");

    expect(page).not.toContain("OperationMemoryPreview");
    expect(page).toContain("OntologyExplorer");
    expect(explorer).toContain("data-testid=\"ontology-neighborhood-graph\"");
    expect(explorer).toContain("data-testid=\"ontology-mobile-relations\"");
    expect(explorer).toContain("그래프 전체 화면");
  });

  it("keeps raw exports secondary and controls touch-safe", () => {
    const explorer = read("app/ontology/OntologyExplorer.tsx");
    const styles = read("app/ontology/OntologyWorkbench.module.css");

    expect(explorer).toContain("원본 데이터 내보내기");
    expect(explorer).toContain("<details");
    expect(explorer).toContain("그래프 JSON");
    expect(styles).toMatch(/min-height:\s*44px/);
    expect(styles).toContain("@media (max-width: 720px)");
    expect(styles).toMatch(/\.desktopGraph\s*\{[\s\S]*?display:\s*none/);
    expect(styles).toMatch(/\.mobileRelations\s*\{[\s\S]*?display:\s*grid/);
  });
});
