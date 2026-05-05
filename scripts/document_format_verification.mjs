#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const startedAt = Date.now();
const repoRoot = process.cwd();
const sourceFiles = [
  path.join(repoRoot, "components", "WorkpackEditor.tsx"),
  path.join(repoRoot, "components", "SafeGuardCommandCenter.tsx"),
  path.join(repoRoot, "app", "page.tsx"),
  path.join(repoRoot, "app", "api", "export", "pdf", "route.ts")
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
    required: ["downloadXls", "buildExcelHtml", "application/vnd.ms-excel", "XLS(HTML 호환)", "HTML 호환 .xls"]
  },
  {
    id: "hwpx-export",
    label: "HWPX export",
    required: ["downloadHwpx", "buildHwpTemplateText", "application/hwp+zip", "@rhwp/core", "HWPX(rhwp", "rhwp 구조화"]
  },
  {
    id: "pdf-output",
    label: "PDF output",
    required: ["printPdf", "popup.print", "PDF(브라우저 인쇄)", "text/html; charset=utf-8", "format\") === \"pdf"]
  },
  {
    id: "download-cta",
    label: "document card CTA",
    required: ["SafeGuardCommandCenter", "focusWorkpackEditor", "다운로드 영역 열기", "준제출형 내려받기", "scrollIntoView"]
  }
];

const structureRules = [
  {
    id: "risk-renderer-structure",
    label: "위험성평가표 renderer",
    required: ["renderRiskAssessmentRows", "form-layout-risk", "doc-risk", "1. 사전준비", "2. 유해·위험요인 파악 및 위험성 결정", "3. 감소대책 수립·실행", "4. 공유·교육 및 재평가"]
  },
  {
    id: "work-plan-renderer-structure",
    label: "작업계획서 renderer",
    required: ["renderWorkPlanRows", "form-layout-workPlan", "doc-workPlan", "1. 작업개요", "2. 세부 작업순서 및 안전대책", "3. 장비·인원·첨부서류", "4. 작업중지 및 재개 기준"]
  },
  {
    id: "permit-renderer-structure",
    label: "허가서/첨부 renderer",
    required: ["renderPermitRows", "form-layout-permit", "doc-permit", "1. 허가 기본정보", "2. 작업 전 허가조건", "3. 첨부서류 및 종료 확인", "허가번호"]
  },
  {
    id: "tbm-renderer-structure",
    label: "TBM 기록 renderer",
    required: ["renderTbmRows", "form-layout-tbmLog", "doc-tbm", "1. TBM 회의 정보", "2. 위험성평가 기반 전달사항", "3. 참석자 확인", "4. 미조치 위험 및 증빙"]
  },
  {
    id: "tbm-risk-weather-bridge",
    label: "TBM risk/weather bridge",
    required: ["riskRows", "위험성평가표 → TBM", "오늘 기상/환경 신호", "출처 연결", "위험성평가 결과를 작업 전 공유"]
  },
  {
    id: "honest-export-wording",
    label: "honest export wording",
    required: ["현장 검토용 출력 초안", "현장 검토용 PDF 초안", "원본 서식 1:1 재현", "발주처 지정 원본 양식"]
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
const structureResults = structureRules.map(evaluateRule);
const allResults = [...documentResults, ...exportResults, ...structureResults];
const failed = allResults.filter((result) => !result.ok);
const summary = {
  generatedAt: new Date().toISOString(),
  elapsedMs: Date.now() - startedAt,
  checkedFiles: sourceFiles.map((filePath) => path.relative(repoRoot, filePath)),
  documentCount: documentResults.length,
  structureCheckCount: structureResults.length,
  exportCheckCount: exportResults.length,
  passCount: allResults.length - failed.length,
  failCount: failed.length,
  readinessLabel: "준제출형",
  oneToOneReproduction: false,
  remainingGaps: [
    "발주처 지정 원본 갑지/을지의 직인과 허가번호 칸은 아직 1:1 재현하지 않음",
    "HWPX는 @rhwp 기반 구조화 파일이며 표 병합·결재칸의 원본 레이아웃 재현은 아님",
    "UI PDF는 브라우저 print 출력 흐름이며 서버 binary PDF 경로는 보조 다운로드 API로만 검증함",
    "XLS는 Excel에서 열 수 있는 HTML 호환 .xls이며 true binary XLS/XLSX가 아님"
  ]
};

const report = {
  summary,
  documentResults,
  structureResults,
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
  "## Distinct renderer structures",
  "",
  ...structureResults.map((result) => [
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
