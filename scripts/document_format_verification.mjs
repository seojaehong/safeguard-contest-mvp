#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const startedAt = Date.now();
const repoRoot = process.cwd();
const sourceFiles = [
  path.join(repoRoot, "components", "WorkpackEditor.tsx"),
  path.join(repoRoot, "components", "SafeGuardCommandCenter.tsx"),
  path.join(repoRoot, "app", "page.tsx")
];
const outDir = path.join(repoRoot, "evaluation", "document-format");

for (const filePath of sourceFiles) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Required source file is missing: ${filePath}`);
  }
}

fs.mkdirSync(outDir, { recursive: true });

const sourceText = sourceFiles
  .map((filePath) => fs.readFileSync(filePath, "utf-8"))
  .join("\n\n");

const documentRules = [
  {
    id: "risk-assessment",
    label: "위험성평가표",
    required: ["위험성평가표", "준제출형", "위험요인", "위험성", "기상", "확인", "서명", "근거", "증빙"]
  },
  {
    id: "work-plan",
    label: "작업계획서",
    required: ["작업계획서", "준제출형", "작업계획", "작업 전", "작업 중", "기상", "위험요인", "확인", "서명"]
  },
  {
    id: "permit-attachments",
    label: "허가서/첨부",
    required: ["허가서/첨부", "안전작업허가", "첨부서류", "허가", "기상", "위험요인", "확인/서명란", "근거"]
  },
  {
    id: "tbm",
    label: "TBM일지/브리핑",
    required: ["TBM", "작업 전", "참석", "기상", "위험요인", "확인", "서명", "사진/영상 증빙", "근거"]
  },
  {
    id: "safety-education",
    label: "안전교육",
    required: ["안전보건교육 기록", "교육대상", "교육내용", "기상", "위험요인", "근거", "확인", "서명", "증빙"]
  }
];

const exportRules = [
  {
    id: "xls-export",
    label: "XLS export",
    required: ["downloadXls", "buildExcelHtml", "application/vnd.ms-excel", "선택 서식 다운로드"]
  },
  {
    id: "hwpx-export",
    label: "HWPX export",
    required: ["downloadHwpx", "buildHwpTemplateText", "application/hwp+zip", "@rhwp/core"]
  },
  {
    id: "pdf-output",
    label: "PDF output",
    required: ["printPdf", "popup.print", "PDF 저장/인쇄", "downloadHtml"]
  },
  {
    id: "download-cta",
    label: "document card CTA",
    required: ["SafeGuardCommandCenter", "focusWorkpackEditor", "다운로드 영역 열기", "준제출형 내려받기", "scrollIntoView"]
  }
];

function evaluateRule(rule) {
  const missing = rule.required.filter((token) => !sourceText.includes(token));
  return {
    id: rule.id,
    label: rule.label,
    ok: missing.length === 0,
    required: rule.required,
    missing
  };
}

const documentResults = documentRules.map(evaluateRule);
const exportResults = exportRules.map(evaluateRule);
const allResults = [...documentResults, ...exportResults];
const failed = allResults.filter((result) => !result.ok);
const summary = {
  generatedAt: new Date().toISOString(),
  elapsedMs: Date.now() - startedAt,
  checkedFiles: sourceFiles.map((filePath) => path.relative(repoRoot, filePath)),
  documentCount: documentResults.length,
  exportCheckCount: exportResults.length,
  passCount: allResults.length - failed.length,
  failCount: failed.length,
  readinessLabel: "준제출형",
  oneToOneReproduction: false,
  remainingGaps: [
    "발주처 지정 원본 갑지/을지의 직인과 허가번호 칸은 아직 1:1 재현하지 않음",
    "HWPX는 @rhwp 기반 텍스트 삽입형으로 표 병합·결재칸의 원본 레이아웃 재현은 아님",
    "PDF는 브라우저 print 출력 흐름이며 서버 생성 PDF 파일의 서식 검증은 아님"
  ]
};

const report = {
  summary,
  documentResults,
  exportResults
};

const markdownLines = [
  "# SafeGuard document format verification",
  "",
  `- generatedAt: ${summary.generatedAt}`,
  `- readinessLabel: ${summary.readinessLabel}`,
  `- oneToOneReproduction: ${summary.oneToOneReproduction}`,
  `- passCount: ${summary.passCount}`,
  `- failCount: ${summary.failCount}`,
  "",
  "## Document requirements",
  "",
  ...documentResults.map((result) => [
    `### ${result.label}`,
    `- ok: ${result.ok}`,
    `- required: ${result.required.join(", ")}`,
    `- missing: ${result.missing.length ? result.missing.join(", ") : "none"}`,
    ""
  ].join("\n")),
  "## Export requirements",
  "",
  ...exportResults.map((result) => [
    `### ${result.label}`,
    `- ok: ${result.ok}`,
    `- required: ${result.required.join(", ")}`,
    `- missing: ${result.missing.length ? result.missing.join(", ") : "none"}`,
    ""
  ].join("\n")),
  "## Remaining gaps",
  "",
  ...summary.remainingGaps.map((gap) => `- ${gap}`),
  ""
];

fs.writeFileSync(path.join(outDir, "report.json"), JSON.stringify(report, null, 2));
fs.writeFileSync(path.join(outDir, "report.md"), markdownLines.join("\n"));

console.log(JSON.stringify(summary, null, 2));
if (failed.length > 0) {
  process.exitCode = 1;
}
