import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

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

    expect(source).toContain("function nodeKindLabel(value: string)");
    expect(source).toContain("{nodeKindLabel(node.kind)}");
    expect(source).toContain("nodeKindLabel(kind)");
    for (const label of ["작업", "위험요인", "조치", "법령 조문", "문서", "재해사례"]) {
      expect(source).toContain(`return \"${label}\"`);
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
