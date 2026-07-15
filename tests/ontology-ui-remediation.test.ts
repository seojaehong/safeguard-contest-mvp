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

function buildDenseTwoHopSource(): NeighborhoodSource {
  const nodes = Array.from({ length: 22 }, (_, index) => ({
    id: `dense-${index}`,
    kind: index === 0 ? "Task" as const : index < 6 ? "Hazard" as const : "Control" as const,
    label: `밀집 항목 ${index}`,
    outgoingCount: index === 0 ? 5 : index < 6 ? 3 : 0,
    incomingCount: index === 0 ? 0 : 1
  }));
  const edges = [1, 2, 3, 4, 5].flatMap((firstHop, branch) => {
    const secondHopStart = 6 + branch * 3;
    return [
      { source: 0, target: firstHop },
      { source: firstHop, target: secondHopStart },
      { source: firstHop, target: secondHopStart + 1 },
      { source: firstHop, target: secondHopStart + 2 }
    ];
  });
  const related = nodes.map((node) => ({
    id: node.id,
    title: node.label,
    subtitle: node.kind,
    excerpt: null,
    evidenceCount: 1,
    related: edges.filter((edge) => edge.source === Number(node.id.split("-")[1])).map((edge) => ({
      rel: "relatedTo",
      direction: "outgoing" as const,
      sourceId: nodes[edge.source].id,
      sourceLabel: nodes[edge.source].label,
      targetId: nodes[edge.target].id,
      targetLabel: nodes[edge.target].label
    }))
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

  it("fills the bounded two-hop canvas with fifteen non-overlapping nodes", () => {
    const result = buildOntologyNeighborhood(buildDenseTwoHopSource(), "dense-0", 2, 15);

    expect(result.nodes).toHaveLength(15);
    expect(countPositionOverlaps(result.nodes)).toBe(0);
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

  it("uses design tokens and customer-facing Korean labels at the presentation boundary", () => {
    const page = read("app/ontology/page.tsx");
    const explorer = read("app/ontology/OntologyExplorer.tsx");
    const styles = read("app/ontology/OntologyWorkbench.module.css");

    expect(styles).not.toMatch(/#[\da-fA-F]{3,8}|rgba?\(/);
    expect(page).not.toContain("개 노드");
    for (const internalLabel of ["published 범위", "검증 노드", "노드 검색", "노드를 선택", ">1홉<", ">2홉<", ">대체본<"]) {
      expect(explorer).not.toContain(internalLabel);
    }
    for (const customerLabel of ["검증된 안전지식", "직접 관계", "확장 관계", "대체자료"]) {
      expect(`${page}\n${explorer}`).toContain(customerLabel);
    }
  });
});
