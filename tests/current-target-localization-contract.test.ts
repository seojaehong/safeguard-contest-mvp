import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { KIND_KO, NODE_KINDS } from "@/lib/ontology/schema";
import { SEED_NODES } from "@/lib/ontology/seed/core-triples";

const root = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

describe("current target user-visible Korean localization", () => {
  it("uses Korean improvement comparison labels on Reports surfaces", () => {
    const page = read("app/reports/page.tsx");
    const center = read("components/ReportsDownloadCenter.tsx");

    expect(page).not.toMatch(/\b(?:As-Is|To-Be)\b/u);
    expect(center).not.toMatch(/\b(?:As-Is|To-Be|Before\/After)\b/u);
    expect(page).toContain("위험성평가 개선 전/개선 후");
    expect(center).toContain("위험 개선 전/개선 후");
    expect(center).toContain("개선 전/개선 후 사진 포함 승인");
  });

  it("renders ontology kinds and status labels through Korean presentation labels", () => {
    const source = read("app/ontology/page.tsx");
    const seedKinds = new Set(SEED_NODES.map((node) => node.kind));
    const publishedKinds = new Set([...NODE_KINDS, ...seedKinds]);
    const nodeKindStart = source.indexOf("function nodeKindLabel");
    const nodeKindEnd = source.indexOf("\n}", nodeKindStart);
    const nodeKindFunction = source.slice(nodeKindStart, nodeKindEnd);

    expect(source).toContain("function nodeKindLabel(value: NodeKind)");
    expect(source).toContain("return KIND_KO[value]");
    expect(nodeKindFunction).not.toContain("return value;");
    expect(source).not.toContain("<span>{node.kind}</span>");
    expect(source).not.toContain("<span>{item.kind}</span>");
    expect(source).toContain("{nodeKindLabel(item.kind)}");
    expect(source).toContain("nodeKindLabel(kind)");
    expect(seedKinds.has("Duty")).toBe(true);
    for (const kind of publishedKinds) {
      expect(KIND_KO[kind]).toMatch(/[가-힣]/u);
    }
    for (const userFacingEnglish of [
      ">Graph unavailable<",
      ">Nodes<",
      ">Edges<",
      ">Gate<",
      ">Fallback<",
      "Task, Hazard, Control"
    ]) {
      expect(source).not.toContain(userFacingEnglish);
    }
  });

  it("fails closed when production browser evidence drifts from its build", () => {
    const source = read("tests/current-target-localization-browser.test.ts");

    expect(source).toContain("Task|Hazard|Control|Article|Document|Accident|Duty");
    expect(source).toContain("SAFECLAW_EXPECTED_BUILD_ID");
    expect(source).toContain("meaningfulSelector");
    expect(source).toContain("leftElement.contains(rightElement)");
    expect(source).toContain('expect(harness.mode).toBe("prod")');
    expect(source).toContain("expect(currentBuildId).toBe(expectedBuildId)");
  });

  it("uses Korean status and section labels on the Knowledge surface", () => {
    const source = read("app/knowledge/page.tsx");
    const expectedLabels = [
      "내장 위키",
      "운영 지식",
      "지식 카탈로그",
      "KOSHA 기술 지원",
      "KOSHA 참고 자료실",
      "색인",
      "위험요인",
      "서식",
      "스키마"
    ];
    for (const label of expectedLabels) {
      expect(source).toContain(`>${label}<`);
    }
    for (const userFacingEnglish of [
      "Built-in Wiki",
      "Runtime Knowledge",
      "Knowledge Catalog",
      "KOSHA Technical Support",
      "KOSHA Reference Library",
      ">Index<",
      ">Hazards<",
      ">Forms<",
      ">Schema<"
    ]) {
      expect(source).not.toContain(userFacingEnglish);
    }
  });
});
