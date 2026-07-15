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
  "components/ReportsDownloadCenter.tsx": ["As-Is", "To-Be", "Before/After"],
  "app/reports/page.tsx": ["As-Is", "To-Be"],
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
  "app/ontology/OntologyExplorer.tsx": [
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
    "<span>Ack</span>",
    "그래프 JSON",
    "JSONL",
    "Obsidian",
    "API 계약 보기"
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
    const presentation = read("lib/web-safe-presentation.ts");
    expect(presentation).toContain('"apply-sif-only-migration": "SIF 전용 마이그레이션 적용"');
    expect(presentation).toContain('"migration-required": "마이그레이션 필요"');
    expect(source).toContain("formatSifGateIdForPresentation(sifGate.operatorGate.gateId)");
    expect(source).toContain("formatSifRuntimeStatusForPresentation(sifGate.postMigrationVerification.status)");
    expect(source).toContain("formatSifRuntimeStatusForPresentation(sifGate.runtimeDbProbe.status)");
    expect(source).not.toContain("<dd>{sifGate.operatorGate.gateId}</dd>");
    expect(source).not.toContain("{sifGate.postMigrationVerification.status} ·");
    expect(source).not.toContain("운영 DB 점검: {sifGate.runtimeDbProbe.status}");
  });

  it("uses positive Korean labels on ontology and knowledge surfaces", () => {
    const ontologyPage = read("app/ontology/page.tsx");
    for (const label of ["운영 온톨로지", "작업과 근거의 연결.", "그래프를 사용할 수 없음"]) {
      expect(ontologyPage).toContain(label);
    }

    const ontologyExplorer = read("app/ontology/OntologyExplorer.tsx");
    for (const label of ["검증된 안전지식", "검증된 연결", "근거 차단", "대체자료", "관계 탐색", "연결된 근거", "개선 기록"]) {
      expect(ontologyExplorer).toContain(`>${label}<`);
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
    expect(currentWorkpack).toContain("formatDispatchProviderStatus(log.providerStatus)");
    expect(currentWorkpack).not.toContain('log.providerStatus || "상태 확인"');
    const fieldOperations = read("components/FieldOperationsWorkspace.tsx");
    expect(fieldOperations).toContain("fetch(`/api/workpacks/${encodeURIComponent(workpackId)}/operation-graph`");
  });

  it("uses Korean before-and-after labels on the Reports page and download center", () => {
    const page = read("app/reports/page.tsx");
    const center = read("components/ReportsDownloadCenter.tsx");
    expect(page).toContain("위험성평가 개선 전/개선 후");
    expect(center).toContain("위험 개선 전/개선 후");
    expect(center).toContain("개선 전/개선 후 사진 포함 승인 항목만");
    expect(center).toContain("개선 전/개선 후 사진 포함 승인");
  });
});
