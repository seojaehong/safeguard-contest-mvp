#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import ExcelJS from "exceljs";

const repoRoot = process.cwd();
const outDir = path.resolve(
  process.env.SAFECLAW_D6_QA_OUT_DIR || path.join(repoRoot, "evaluation", "2026-05-08-d6-handoff-qa")
);
const filesDir = path.join(outDir, "files");
const baseUrl = process.env.SAFECLAW_D6_QA_BASE_URL || "http://127.0.0.1:3110";

fs.mkdirSync(filesDir, { recursive: true });

const scenario = {
  companyName: "D6테스트산업",
  companyType: "건설업",
  siteName: "성수동 외벽 보수 현장",
  workSummary: "이동식 비계 외벽 보수 및 누수 점검",
  workerCount: 5,
  weatherNote: "오후 강풍 예보, 젖은 바닥 확인 필요"
};

const expectedRiskHeaders = [
  "작업장소",
  "공정",
  "세부작업",
  "장비·도구",
  "유해·위험요인",
  "4M",
  "재해유형",
  "현재 안전조치",
  "가능성",
  "중대성",
  "위험성",
  "감소대책",
  "담당자",
  "조치기한",
  "확인상태",
  "확인일",
  "확인자",
  "근거"
];

const structuredRiskRows = [
  {
    id: "1",
    location: "성수동 외벽 보수 현장",
    process: "외벽 보수",
    task: "이동식 비계 설치 및 외벽 보수",
    unitTask: "이동식 비계 설치 및 외벽 보수",
    equipment: "이동식 비계, 안전대, 안전모",
    hazard: "강풍 시 비계 흔들림으로 인한 추락",
    fourM: "Media",
    accidentType: "fall",
    currentControls: "작업 전 비계 바퀴 잠금과 난간 상태를 확인한다.",
    likelihood: 3,
    severity: 5,
    riskLevel: "high",
    additionalControls: "강풍 예보 또는 비계 흔들림 체감 시 작업중지 후 공구를 지상으로 내린다.",
    owner: "작업반장",
    due: "2026-05-08",
    dueDate: "2026-05-08",
    verification: "비계 점검표와 TBM 복창으로 확인",
    verificationStatus: "planned",
    verificationDate: "2026-05-08",
    verificationChecker: "관리감독자",
    whyLikelihood: "외벽 고소작업과 강풍 예보가 동시에 있어 흔들림 노출 가능성이 있다.",
    whySeverity: "고소작업 추락은 중대 사고로 이어질 수 있다.",
    evidenceRefs: ["KOSHA 위험성평가", "KOSHA TBM 가이드"]
  },
  {
    id: "2",
    location: "성수동 외벽 보수 현장",
    process: "누수 점검",
    task: "젖은 바닥 보양 및 전기설비 주변 점검",
    unitTask: "젖은 바닥 보양 및 전기설비 주변 점검",
    equipment: "흡수포, 미끄럼방지 매트, 검전기",
    hazard: "젖은 바닥 미끄러짐 및 전기설비 접촉",
    fourM: "Machine",
    accidentType: "electricShock",
    currentControls: "누수 구역 접근 전 라바콘과 표지를 설치한다.",
    likelihood: 3,
    severity: 5,
    riskLevel: "high",
    additionalControls: "전원 차단과 검전 확인 전 전기설비 접촉을 금지한다.",
    owner: "관리감독자",
    due: "2026-05-08",
    dueDate: "2026-05-08",
    verification: "검전 사진과 차단 확인 서명",
    verificationStatus: "planned",
    verificationDate: "2026-05-08",
    verificationChecker: "관리감독자",
    whyLikelihood: "누수와 전기설비가 같은 구역에 있어 접촉 가능성이 있다.",
    whySeverity: "감전은 치명적 결과로 이어질 수 있다.",
    evidenceRefs: ["산업안전보건 기준", "검전 기록"]
  }
];

const commonRows = structuredRiskRows.map((row, index) => ({
  document: "위험성평가표",
  section: "위험성평가",
  item: String(index + 1),
  content: `${row.task}: ${row.hazard} / ${row.additionalControls}`
}));

const riskPayload = {
  title: "위험성평가표",
  scenario,
  profile: {
    code: "risk-assessment",
    subtitle: "KOSHA 구조화 헤더 검증",
    layout: "risk",
    primaryColumn: "유해·위험요인",
    actionColumn: "감소대책",
    confirmationRows: ["사전준비", "TBM", "보호구"],
    approvalLabels: ["작성자", "검토자", "승인자"]
  },
  rows: commonRows,
  structured: { riskAssessmentRows: structuredRiskRows },
  structuredRiskRows
};

const structuredModeCases = [
  {
    mode: "workPlanStructured",
    expectedSheet: "작업계획서",
    expectedText: ["작업계획서", "작업개요", "작업단계 및 안전조치", "작업중지 기준"],
    structured: {
      workOverview: {
        workName: "외벽 보수 작업계획",
        description: "이동식 비계를 사용해 외벽 보수와 누수 구역 점검을 수행한다.",
        workerCount: 5,
        location: "성수동 외벽 보수 현장",
        condition: "오후 강풍 예보와 젖은 바닥을 작업 전 확인한다.",
        equipment: ["이동식 비계", "안전대", "검전기"]
      },
      workSteps: [
        { stepNo: 1, action: "비계 설치 전 지반과 바퀴 잠금 확인", equipment: "이동식 비계", safetyMeasure: "난간과 발판 고정 상태를 체크리스트로 확인", owner: "작업반장" },
        { stepNo: 2, action: "누수 구역 전기설비 주변 점검", equipment: "검전기", safetyMeasure: "전원 차단과 검전 완료 전 접촉 금지", owner: "관리감독자" }
      ],
      stopCriteria: ["강풍 체감 또는 비계 흔들림 발생", "젖은 바닥 통제 미완료", "검전 미완료"],
      emergencyResponse: {
        contacts: [{ role: "관리감독자", phone: "010-0000-0000" }],
        evacRoute: "현장 출입구 방향 대피",
        firstAid: "감전 의심 시 전원 차단 후 응급 연락"
      },
      approvers: { author: "작업반장", reviewer: "관리감독자", approver: "현장소장" }
    }
  },
  {
    mode: "tbmBriefingStructured",
    expectedSheet: "TBM 브리핑",
    expectedText: ["TBM 브리핑", "위험요인", "안전대책", "확인질문"],
    structured: {
      meta: {
        dateTime: "2026-05-08 08:30",
        location: "성수동 외벽 보수 현장",
        target: "외벽 보수 작업자 5명",
        attendees: "출석부 서명과 현장 사진"
      },
      todayWork: {
        name: "이동식 비계 외벽 보수",
        location: "외벽 동측 작업구역",
        time: "09:00-17:00",
        equipment: ["이동식 비계", "안전대", "검전기"]
      },
      hazards: [
        { category: "Media", description: "강풍 시 비계 흔들림과 추락 위험" },
        { category: "Machine", description: "누수 구역 전기설비 접촉 위험" }
      ],
      measures: [
        { hazardRef: 1, action: "강풍 체감 시 작업중지 후 공구를 지상으로 내림", owner: "작업반장" },
        { hazardRef: 2, action: "전원 차단과 검전 확인 전 접촉 금지", owner: "관리감독자" }
      ],
      stopCriteria: ["강풍 체감", "비계 흔들림", "검전 미완료"],
      confirmTopics: ["작업중지 기준을 전원이 복창했는가", "전원 차단 확인자가 지정됐는가"],
      photoEvidenceLocation: "현장 공유 폴더 / TBM 사진"
    }
  },
  {
    mode: "educationRecordStructured",
    expectedSheet: "안전보건교육",
    expectedText: ["안전보건교육 기록", "교육 기본정보", "교육내용", "참석자 확인"],
    structured: {
      educationName: "외벽 보수 작업 전 안전보건교육",
      type: "특별교육",
      dateTime: "2026-05-08 08:00",
      location: "성수동 외벽 보수 현장",
      target: "외벽 보수 작업자 5명",
      instructor: "관리감독자",
      confirmer: "현장소장",
      curriculum: [
        {
          topic: "이동식 비계 추락 예방",
          lawCitation: "산업안전보건법 제29조",
          keyPoints: ["비계 바퀴 잠금", "난간 확인", "강풍 시 작업중지"]
        },
        {
          topic: "누수 구역 감전 예방",
          lawCitation: "산업안전보건기준에 관한 규칙",
          keyPoints: ["전원 차단", "검전 확인", "절연보호구 착용"]
        }
      ],
      understandingCheck: "교육 후 주요 위험요인을 작업자가 구두 복창한다.",
      tbmLink: "TBM에서 위험성평가표의 주요 행을 다시 공유한다.",
      followupRecommendation: "작업조건 변경 시 보완교육을 실시한다."
    }
  }
];

function rel(filePath) {
  return path.relative(repoRoot, filePath).replaceAll("\\", "/");
}

function bufferMagic(buffer, length) {
  return buffer.subarray(0, length).toString("hex").toUpperCase();
}

async function postBuffer(pathname, body) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  const arrayBuffer = await response.arrayBuffer();
  return {
    ok: response.ok,
    status: response.status,
    contentType: response.headers.get("content-type") || "",
    contentDisposition: response.headers.get("content-disposition") || "",
    buffer: Buffer.from(arrayBuffer)
  };
}

async function collectWorkbookText(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const values = [];
  workbook.eachSheet((worksheet) => {
    worksheet.eachRow((row) => {
      row.eachCell((cell) => {
        if (cell.value !== null && cell.value !== undefined) values.push(String(cell.value));
      });
    });
  });
  return {
    sheetNames: workbook.worksheets.map((worksheet) => worksheet.name),
    values
  };
}

async function verifyStructuredMode(testCase) {
  const result = await postBuffer("/api/export/xlsx", {
    mode: testCase.mode,
    scenario,
    structured: testCase.structured
  });
  const filePath = path.join(filesDir, `${testCase.mode}.xlsx`);
  fs.writeFileSync(filePath, result.buffer);

  const details = {
    mode: testCase.mode,
    ok: false,
    httpStatus: result.status,
    contentType: result.contentType,
    contentDisposition: result.contentDisposition,
    file: rel(filePath),
    bytes: result.buffer.length,
    zipMagic: bufferMagic(result.buffer, 2),
    sheetNames: [],
    missingText: [],
    error: ""
  };

  try {
    const workbookText = await collectWorkbookText(result.buffer);
    details.sheetNames = workbookText.sheetNames;
    details.missingText = testCase.expectedText.filter((text) => !workbookText.values.includes(text));
    details.ok = result.ok
      && result.contentType.includes("spreadsheetml.sheet")
      && details.zipMagic === "504B"
      && workbookText.sheetNames.includes(testCase.expectedSheet)
      && details.missingText.length === 0;
  } catch (error) {
    details.error = error instanceof Error ? error.message : String(error);
  }

  return details;
}

async function verifyRiskAssessmentXlsxHeaders() {
  const result = await postBuffer("/api/export/xlsx", riskPayload);
  const filePath = path.join(filesDir, "riskAssessment-kosha-headers.xlsx");
  fs.writeFileSync(filePath, result.buffer);

  const details = {
    ok: false,
    httpStatus: result.status,
    contentType: result.contentType,
    contentDisposition: result.contentDisposition,
    file: rel(filePath),
    bytes: result.buffer.length,
    zipMagic: bufferMagic(result.buffer, 2),
    sheetNames: [],
    expectedHeaders: expectedRiskHeaders,
    missingHeaders: [],
    error: ""
  };

  try {
    const workbookText = await collectWorkbookText(result.buffer);
    details.sheetNames = workbookText.sheetNames;
    details.missingHeaders = expectedRiskHeaders.filter((header) => !workbookText.values.includes(header));
    details.ok = result.ok
      && result.contentType.includes("spreadsheetml.sheet")
      && details.zipMagic === "504B"
      && details.missingHeaders.length === 0;
  } catch (error) {
    details.error = error instanceof Error ? error.message : String(error);
  }

  return details;
}

async function verifyHwpSignature() {
  const result = await postBuffer("/api/export/hwp", riskPayload);
  const filePath = path.join(filesDir, "riskAssessment-signature.hwp");
  fs.writeFileSync(filePath, result.buffer);
  const expectedMagic = "D0CF11E0A1B11AE1";
  const magic = bufferMagic(result.buffer, 8);
  return {
    ok: result.ok && result.contentType.includes("application/x-hwp") && magic === expectedMagic,
    httpStatus: result.status,
    contentType: result.contentType,
    contentDisposition: result.contentDisposition,
    file: rel(filePath),
    bytes: result.buffer.length,
    magic,
    expectedMagic
  };
}

async function verifyPdfBehavior() {
  const result = await postBuffer("/api/export/pdf", riskPayload);
  const filePath = path.join(filesDir, "riskAssessment-honest.pdf");
  fs.writeFileSync(filePath, result.buffer);
  const magic = result.buffer.subarray(0, 5).toString("utf8");
  const prefix = result.buffer.subarray(0, 128).toString("utf8").toLowerCase();
  const looksLikeHtml = prefix.includes("<!doctype html") || prefix.includes("<html");
  return {
    ok: result.ok && result.contentType.includes("application/pdf") && magic === "%PDF-" && !looksLikeHtml,
    httpStatus: result.status,
    contentType: result.contentType,
    contentDisposition: result.contentDisposition,
    file: rel(filePath),
    bytes: result.buffer.length,
    magic,
    looksLikeHtml,
    honestBehavior: "binary PDF route must return application/pdf with %PDF- magic, not HTML-as-PDF"
  };
}

function verifyTbmRiskLinksPresence() {
  const files = {
    types: path.join(repoRoot, "lib", "types.ts"),
    aiDeliverables: path.join(repoRoot, "lib", "ai-deliverables.ts"),
    search: path.join(repoRoot, "lib", "search.ts"),
    schemaGate: path.join(repoRoot, "scripts", "safeclaw_form_schema_gate.mjs"),
    fixtures: path.join(repoRoot, "scripts", "safeclaw_form_schema_gate_fixtures.json")
  };
  const source = Object.fromEntries(
    Object.entries(files).map(([key, filePath]) => [key, fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : ""])
  );
  const fixture = source.fixtures ? JSON.parse(source.fixtures) : {};
  const fixtureCases = Array.isArray(fixture.cases) ? fixture.cases : [];
  const fixtureLinkCounts = fixtureCases.map((item) => Array.isArray(item.tbmRiskLinks) ? item.tbmRiskLinks.length : 0);
  const positiveFixtureLinkCounts = fixtureCases
    .filter((item) => item && item.expectedVerdict !== "blocked")
    .map((item) => Array.isArray(item.tbmRiskLinks) ? item.tbmRiskLinks.length : 0);
  return {
    ok: source.types.includes("tbmRiskLinks?: TbmRiskLink[]")
      && source.aiDeliverables.includes("tbmRiskLinksPrompt")
      && source.search.includes("tbmRiskLinks")
      && source.schemaGate.includes("tbmRiskLinks")
      && positiveFixtureLinkCounts.length > 0
      && positiveFixtureLinkCounts.every((count) => count > 0),
    checks: {
      typeExposed: source.types.includes("tbmRiskLinks?: TbmRiskLink[]"),
      aiPromptPresent: source.aiDeliverables.includes("tbmRiskLinksPrompt"),
      searchResponseMentionsLinks: source.search.includes("tbmRiskLinks"),
      schemaGateValidatesLinks: source.schemaGate.includes("tbmRiskLinks"),
      fixtureCaseCount: fixtureCases.length,
      fixtureLinkCounts,
      positiveFixtureLinkCounts
    }
  };
}

async function main() {
  const startedAt = Date.now();
  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    outputDir: rel(outDir),
    structuredXlsxModes: [],
    riskAssessmentXlsx: null,
    hwpSignature: null,
    pdfBehavior: null,
    tbmRiskLinks: verifyTbmRiskLinksPresence(),
    elapsedMs: 0,
    overall: "blocked",
    blockers: []
  };

  try {
    for (const testCase of structuredModeCases) {
      report.structuredXlsxModes.push(await verifyStructuredMode(testCase));
    }
    report.riskAssessmentXlsx = await verifyRiskAssessmentXlsxHeaders();
    report.hwpSignature = await verifyHwpSignature();
    report.pdfBehavior = await verifyPdfBehavior();
  } catch (error) {
    report.blockers.push({
      id: "http-smoke",
      message: error instanceof Error ? error.message : String(error),
      hint: "Start SafeClaw first, for example: $env:PORT='3110'; npm.cmd run dev"
    });
  }

  const httpChecks = [
    ...report.structuredXlsxModes.map((item) => item.ok),
    report.riskAssessmentXlsx?.ok,
    report.hwpSignature?.ok,
    report.pdfBehavior?.ok
  ];
  if (httpChecks.some((ok) => ok === false)) {
    report.blockers.push({
      id: "failed-checks",
      message: "One or more export checks returned a non-passing result. Inspect the per-check fields in this report."
    });
  }
  if (!report.tbmRiskLinks.ok) {
    report.blockers.push({
      id: "tbm-risk-links",
      message: "tbmRiskLinks source/schema presence check did not pass."
    });
  }

  report.elapsedMs = Date.now() - startedAt;
  report.overall = report.blockers.length === 0 && httpChecks.length === 6 && httpChecks.every(Boolean) && report.tbmRiskLinks.ok
    ? "pass"
    : "blocked";

  const reportPath = path.join(outDir, "smoke-report.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (report.overall !== "pass") process.exitCode = 1;
}

await main();
