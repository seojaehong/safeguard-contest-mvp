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
    "Vision/OCR Harness",
    "<dt>Migration</dt>",
    "<dt>Canary</dt>",
    "<dt>Gate</dt>",
    "<dt>Verifier</dt>",
    "Preflight 자동 점검",
    "hash not recorded"
  ],
  "lib/reporting-downloads.ts": ["As-Is", "To-Be"],
  "app/ontology/page.tsx": [
    "Graph unavailable",
    "Graph Ontology",
    "List Ontology",
    "Hover Cards",
    "<span>Nodes</span>",
    "<span>Edges</span>",
    "<span>Gate</span>",
    "<span>Fallback</span>",
    "Operation Memory",
    "<span>Workpack</span>",
    "<span>Evidence</span>",
    "<span>Improvement</span>",
    "<span>Ack</span>"
  ],
  "app/knowledge/page.tsx": [
    "Built-in Wiki",
    "Runtime Knowledge",
    "Knowledge Catalog",
    "KOSHA Technical Support",
    "KOSHA Reference Library",
    ">Index<",
    ">Hazards<",
    ">Forms<",
    ">Schema<"
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

  it("maps raw SIF gate identifiers and statuses only at the render boundary", () => {
    const source = read("components/AiConnectPanel.tsx");
    expect(source).toContain('"apply-sif-only-migration": "SIF 전용 마이그레이션 적용"');
    expect(source).toContain('"migration-required": "마이그레이션 필요"');
    expect(source).toContain("formatSifGateId(sifGate.operatorGate.gateId)");
    expect(source).toContain("formatSifRuntimeStatus(sifGate.postMigrationVerification.status)");
    expect(source).toContain("formatSifRuntimeStatus(sifGate.runtimeDbProbe.status)");
    expect(source).not.toContain("<dd>{sifGate.operatorGate.gateId}</dd>");
    expect(source).not.toContain("{sifGate.postMigrationVerification.status} ·");
    expect(source).not.toContain("운영 DB 점검: {sifGate.runtimeDbProbe.status}");
  });

  it("uses positive Korean labels on ontology and knowledge surfaces", () => {
    const ontology = read("app/ontology/page.tsx");
    for (const label of ["노드", "관계", "근거 차단", "대체본", "운영 이력", "작업팩", "근거", "개선사항", "열람 확인"]) {
      expect(ontology).toContain(`>${label}<`);
    }

    const knowledge = read("app/knowledge/page.tsx");
    for (const label of ["KOSHA 기술 지원", "KOSHA 참고 자료실", "색인", "위험요인", "서식", "스키마"]) {
      expect(knowledge).toContain(`>${label}<`);
    }
  });

  it("preserves allowlisted API fields, paths, brands, and acronyms in production source", () => {
    const aiConnect = read("components/AiConnectPanel.tsx");
    for (const token of ["gateId", "runtimeDbProbe", "postMigrationVerification", "SIF", "OCR", "RPC"]) {
      expect(aiConnect).toContain(token);
    }

    const currentWorkpack = read("components/CurrentWorkpackModules.tsx");
    expect(currentWorkpack).toContain("providerStatus");
    expect(read("app/ontology/page.tsx")).toContain("/api/workpacks/[id]/operation-graph");
  });
});
