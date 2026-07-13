import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

const forbiddenUserFacingCopy: Record<string, readonly string[]> = {
  "components/CurrentWorkpackModules.tsx": [
    "Language preview",
    "작업자·전파 snapshot",
    "현재 작업공간 snapshot",
    "작업공간 전파 snapshot",
    "작업자 snapshot에서 재계산",
    "provider 결과",
    "브라우저 current snapshot",
    "브라우저 snapshot 없음",
    "전파 snapshot 없음"
  ],
  "components/WorkpackEditor.tsx": ["XLS(legacy)", "PDF/XLS(legacy)"],
  "components/AiConnectPanel.tsx": [
    "SIF Embedding Gate",
    "Next approval",
    "Operator gate",
    "Runtime DB probe:",
    "table ready",
    "table missing",
    "Vision/OCR Harness"
  ],
  "lib/reporting-downloads.ts": ["As-Is", "To-Be"],
  "app/ontology/page.tsx": [
    "Graph unavailable",
    "Graph Ontology",
    "List Ontology",
    "Hover Cards"
  ],
  "app/knowledge/page.tsx": [
    "Built-in Wiki",
    "Runtime Knowledge",
    "Knowledge Catalog"
  ]
};

// Brand names, file extensions, domain acronyms, paths, environment variables,
// API fields, and code identifiers are intentionally outside this copy contract.
const approvedTechnicalTerms = [
  "SafeClaw",
  "OpenAI",
  "PDF",
  "XLSX",
  "HWPX",
  "SIF",
  "TBM",
  "OCR",
  "API",
  "providerStatus",
  "SAFETY_REFERENCE_VECTOR_SEARCH"
] as const;

describe("user-visible Korean copy contract", () => {
  it("removes unintended English phrases from user-facing UI and exports", () => {
    for (const [relativePath, phrases] of Object.entries(forbiddenUserFacingCopy)) {
      const source = read(relativePath);
      for (const phrase of phrases) {
        expect(source, `${relativePath} still exposes ${phrase}`).not.toContain(phrase);
      }
    }
  });

  it("uses Korean numbering labels in document preview tables", () => {
    const source = read("components/WorkpackEditor.tsx");
    expect(source).not.toMatch(/<th>No\.<\/th>|<th>NO<\/th>/u);
  });

  it("keeps the allowlisted technical vocabulary out of the forbidden phrase list", () => {
    const forbiddenPhrases = Object.values(forbiddenUserFacingCopy).flat();
    for (const term of approvedTechnicalTerms) {
      expect(forbiddenPhrases).not.toContain(term);
    }
  });
});
