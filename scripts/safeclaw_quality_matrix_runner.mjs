#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const defaultCasesPath = path.join(process.cwd(), "scripts", "safeclaw_quality_matrix_cases.json");
const casesPath = process.env.SAFECLAW_MATRIX_CASES_PATH || defaultCasesPath;
const outDir = path.resolve(process.env.SAFECLAW_MATRIX_OUT_DIR || path.join(process.cwd(), "evaluation", "saas-v1"));
const baseUrl = process.env.SAFECLAW_MATRIX_BASE_URL || process.env.SAFEGUARD_BASE_URL || "http://127.0.0.1:3000";
const liveEnabled = process.env.SAFECLAW_MATRIX_LIVE === "1";
const liveCount = Number.parseInt(process.env.SAFECLAW_MATRIX_LIVE_COUNT || "5", 10);
const timeoutMs = Number.parseInt(process.env.SAFECLAW_MATRIX_TIMEOUT_MS || "45000", 10);
const failureSampleLimit = Number.parseInt(process.env.SAFECLAW_MATRIX_FAILURE_SAMPLE_LIMIT || "12", 10);

const canonicalDocuments = [
  "workpackSummaryDraft",
  "riskAssessmentDraft",
  "workPlanDraft",
  "workPermitDraft",
  "tbmBriefing",
  "tbmLogDraft",
  "safetyEducationRecordDraft",
  "emergencyResponseDraft",
  "photoEvidenceDraft",
  "foreignWorkerBriefing",
  "foreignWorkerTransmission",
  "kakaoMessage"
];

const documentAliases = {
  workPermit: ["workPermitDraft", "workPlanDraft", "tbmBriefing", "safetyEducationRecordDraft"]
};

const documentRubrics = {
  workpackSummaryDraft: ["점검결과", "업종", "현장", "작업", "위험"],
  riskAssessmentDraft: ["위험성평가", "유해", "위험요인", "감소대책", "확인"],
  workPlanDraft: ["작업계획", "작업순서", "작업인원", "작업중지", "확인"],
  workPermitDraft: ["허가", "작업허가", "첨부서류", "보호구", "종료"],
  tbmBriefing: ["TBM", "작업", "위험요인", "안전대책", "확인"],
  tbmLogDraft: ["TBM", "기록", "참석", "확인", "후속조치"],
  safetyEducationRecordDraft: ["교육", "교육대상", "교육내용", "확인방법", "서명"],
  emergencyResponseDraft: ["비상", "초기조치", "보고", "현장보존", "재발방지"],
  photoEvidenceDraft: ["사진", "증빙", "조치 전", "조치 후", "보관"],
  foreignWorkerBriefing: ["외국인", "쉬운 한국어", "보호구", "작업을 멈추"],
  foreignWorkerTransmission: ["외국인", "작업", "STOP", "보호구"],
  kakaoMessage: ["현장", "위험", "작업", "확인"]
};

const permitTerms = ["허가", "작업허가", "화기", "밀폐", "정전", "굴착", "출입"];
const weatherFallbackTerms = {
  강풍: ["강풍", "바람", "풍속"],
  우천: ["우천", "비", "젖음", "미끄럼"],
  호우: ["호우", "집중호우", "누수"],
  폭염: ["폭염", "고온", "온열", "휴식"],
  고온: ["고온", "폭염", "온열", "환기"],
  한파: ["한파", "저온", "보온"],
  결빙: ["결빙", "미끄럼", "한파"],
  한랭: ["한랭", "저온", "냉동"]
};

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function mergeExpected(baseExpected, variantExpected) {
  return {
    ...baseExpected,
    ...variantExpected,
    hazards: unique([...asArray(baseExpected.hazards), ...asArray(variantExpected.hazards)]),
    workerSignals: unique([...asArray(baseExpected.workerSignals), ...asArray(variantExpected.workerSignals)]),
    weatherSignals: unique([...asArray(baseExpected.weatherSignals), ...asArray(variantExpected.weatherSignals)]),
    foreignLanguageSignals: unique([
      ...asArray(baseExpected.foreignLanguageSignals),
      ...asArray(variantExpected.foreignLanguageSignals)
    ]),
    requiredDocuments: unique([
      ...asArray(baseExpected.requiredDocuments),
      ...asArray(variantExpected.requiredDocuments)
    ])
  };
}

function buildCases(matrix) {
  const baseScenarios = asArray(matrix.baseScenarios);
  const variants = asArray(matrix.variants);
  if (!baseScenarios.length) throw new Error("quality matrix requires baseScenarios");
  if (!variants.length) throw new Error("quality matrix requires variants");

  return baseScenarios.flatMap((scenario) => (
    variants.map((variant) => {
      const expected = mergeExpected(scenario.expected || {}, variant.expected || {});
      return {
        id: `${scenario.id}__${variant.id}`,
        baseId: scenario.id,
        variantId: variant.id,
        label: `${scenario.id} / ${variant.label || variant.id}`,
        question: `${scenario.question} ${variant.promptSuffix || ""}`.replace(/\s+/g, " ").trim(),
        expected
      };
    })
  ));
}

function includesAny(text, terms) {
  const normalized = text.toLowerCase();
  return terms.some((term) => normalized.includes(String(term).toLowerCase()));
}

function readDocument(payload, key) {
  return typeof payload?.deliverables?.[key] === "string" ? payload.deliverables[key] : "";
}

function readAliasedDocument(payload, key) {
  const keys = documentAliases[key] || [key];
  return keys.map((item) => readDocument(payload, item)).join("\n");
}

function buildLocalPayload(testCase) {
  const expected = testCase.expected;
  const hazardLine = asArray(expected.hazards).join(", ") || "현장 위험요인";
  const workerLine = asArray(expected.workerSignals).join(", ") || "작업자 조건 현장 확인";
  const weatherLine = asArray(expected.weatherSignals).join(", ") || "기상 특이사항 현장 확인";
  const languageLine = asArray(expected.foreignLanguageSignals).join(", ") || "외국인 근로자 없음";
  const permitLine = asArray(expected.requiredDocuments).includes("workPermit")
    ? "작업허가 확인: 화기·밀폐·정전·굴착 등 고위험 작업허가서와 첨부서류를 작업 전 확인합니다."
    : "작업허가 확인: 고위험 작업 해당 여부를 현장 확인합니다.";

  const deliverables = {
    workpackSummaryDraft: [
      "점검결과 요약(초안)",
      `현장: ${expected.region} 품질 매트릭스 현장`,
      `지역: ${expected.region}`,
      `업종: ${expected.industry}`,
      `작업: ${expected.workType}`,
      `핵심 위험: ${hazardLine}`,
      `작업자 조건: ${workerLine}`,
      `기상 신호: ${weatherLine}`
    ].join("\n"),
    riskAssessmentDraft: [
      "위험성평가표(초안)",
      `작업유형: ${expected.workType}`,
      `유해·위험요인: ${hazardLine}`,
      `기상 및 작업조건: ${weatherLine}`,
      "감소대책: 작업중지 기준, 보호구, 접근통제, 담당자 확인을 적용합니다.",
      "조치 확인: 관리감독자와 작업반장이 작업 전 확인합니다."
    ].join("\n"),
    workPlanDraft: [
      "작업계획서(초안)",
      `작업개요: ${expected.region} ${expected.industry} ${expected.workType}`,
      "작업인원: 작업자 5명 기준, 실제 투입인원은 현장 확인 필요",
      "작업순서: 작업구역 설정, 장비 점검, 작업 수행, 정리정돈",
      `주요 위험: ${hazardLine}`,
      `작업중지 기준: ${weatherLine} 또는 위험 발견 시 즉시 중지`,
      permitLine
    ].join("\n"),
    workPermitDraft: [
      "위험작업 허가서(초안)",
      `허가대상 작업: ${expected.region} ${expected.industry} ${expected.workType}`,
      "작업허가 조건: 작업계획서, 위험성평가표, TBM 참석명단 첨부 확인",
      `핵심위험: ${hazardLine}`,
      `기상·환경 확인: ${weatherLine}`,
      "보호구: 안전모, 안전화, 작업별 보호구 착용 확인",
      "첨부서류: 장비 검사증, 자격증, MSDS, 통제구역 표시, 사진 증빙 해당 여부 확인",
      "종료 확인: 원상복구, 잔류위험 없음, 미조치사항 및 종료 확인자 서명"
    ].join("\n"),
    tbmBriefing: [
      "TBM 작업 전 안전점검회의",
      `오늘 작업: ${expected.workType}`,
      `위험요인: ${hazardLine}`,
      `기상 신호: ${weatherLine}`,
      `작업자 확인: ${workerLine}`,
      "안전대책: 보호구 착용, 작업중지 기준 복창, 접근통제 확인"
    ].join("\n"),
    tbmLogDraft: [
      "TBM 기록(초안)",
      `참석 대상: ${workerLine}`,
      `위험요인 공유: ${hazardLine}`,
      "확인: 전원 복창 및 서명",
      "미조치 위험요인 / 후속조치: 담당자 지정 후 재확인"
    ].join("\n"),
    safetyEducationRecordDraft: [
      "안전보건교육 기록(초안)",
      `교육대상: ${workerLine}`,
      `교육내용: ${expected.workType}, ${hazardLine}, ${weatherLine}`,
      `외국인 언어 지원: ${languageLine}`,
      "확인방법: 작업중지 기준 복창, 보호구 착용 확인, 서명"
    ].join("\n"),
    emergencyResponseDraft: [
      "비상대응 절차(초안)",
      `사고 징후: ${hazardLine}`,
      "초기조치: 작업중지, 위험구역 통제, 119 또는 관리자 보고",
      "보고체계: 작업자, 작업반장, 관리감독자, 현장소장",
      "현장보존 및 재발방지: 사진 증빙과 후속조치 확인"
    ].join("\n"),
    photoEvidenceDraft: [
      "사진/증빙 기록(초안)",
      `작업 전 사진: ${expected.workType}`,
      `위험요인 사진: ${hazardLine}`,
      "조치 전 사진:",
      "조치 후 사진:",
      "확인자 및 보관 위치: 문서팩 첨부"
    ].join("\n"),
    foreignWorkerBriefing: [
      "외국인 근로자 쉬운 한국어 안내",
      `언어: ${languageLine}`,
      `작업: ${expected.workType}`,
      `위험: ${hazardLine}`,
      "이해하지 못하면 작업을 멈추고 관리자에게 말하세요.",
      "보호구를 착용하세요."
    ].join("\n"),
    foreignWorkerTransmission: [
      "SafeClaw 외국인 근로자 전송본",
      `언어 Languages: ${languageLine}`,
      `작업 Work: ${expected.workType}`,
      `위험 Hazard: ${hazardLine}`,
      "STOP work if unsafe. 보호구 PPE를 착용하세요. Ask supervisor."
    ].join("\n"),
    kakaoMessage: [
      "현장 공유 메시지",
      `${expected.region} ${expected.workType} 작업 전 확인`,
      `위험: ${hazardLine}`,
      `기상: ${weatherLine}`,
      "작업 전 TBM과 보호구 확인 후 시작하세요."
    ].join("\n")
  };

  return {
    question: testCase.question,
    mode: "local-deterministic",
    scenario: {
      companyName: `${expected.region || "현장"} 테스트 사업장`,
      companyType: expected.industry || "현장",
      siteName: `${expected.region || "현장"} 품질 매트릭스`,
      workSummary: expected.workType || "현장 작업",
      workerCount: 5,
      weatherNote: weatherLine
    },
    externalData: {
      weather: { mode: "local", summary: weatherLine },
      safetyKnowledge: { mode: "local", matches: asArray(expected.hazards).map((title) => ({ title })) }
    },
    deliverables
  };
}

async function fetchAskPayload(testCase) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();
  try {
    const response = await fetch(`${baseUrl.replace(/\/+$/g, "")}/api/ask`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question: testCase.question }),
      signal: controller.signal
    });
    const text = await response.text();
    let parsed = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
    return {
      payload: parsed,
      api: {
        status: response.status,
        ok: response.ok,
        elapsedMs: Date.now() - startedAt,
        rawPreview: text.slice(0, 240)
      }
    };
  } finally {
    clearTimeout(timeout);
  }
}

function checkExpectedSchema(expected) {
  const requiredStringFields = ["region", "industry", "workType"];
  const requiredArrayFields = ["hazards", "workerSignals", "weatherSignals", "foreignLanguageSignals", "requiredDocuments"];
  const failures = [];
  for (const field of requiredStringFields) {
    if (typeof expected[field] !== "string" || !expected[field].trim()) {
      failures.push(`expected.${field} is required`);
    }
  }
  for (const field of requiredArrayFields) {
    if (!Array.isArray(expected[field])) {
      failures.push(`expected.${field} must be an array`);
    }
  }
  if (Array.isArray(expected.hazards) && expected.hazards.length === 0) failures.push("expected.hazards must not be empty");
  if (Array.isArray(expected.requiredDocuments) && expected.requiredDocuments.length === 0) failures.push("expected.requiredDocuments must not be empty");
  return failures;
}

function checkRequiredDocuments(payload, requiredDocuments) {
  return requiredDocuments.map((key) => {
    const text = readAliasedDocument(payload, key);
    const ok = text.trim().length >= 40;
    return { name: `document:${key}`, ok, message: ok ? "" : `${key} document text is missing or too short` };
  });
}

function checkDocumentRubrics(payload, requiredDocuments) {
  const checks = [];
  for (const key of requiredDocuments) {
    if (key === "workPermit") {
      const text = readAliasedDocument(payload, key);
      const ok = includesAny(text, permitTerms);
      checks.push({ name: "rubric:workPermit", ok, message: ok ? "" : "work permit scenario lacks permit/authorization wording" });
      continue;
    }
    const terms = documentRubrics[key];
    if (!terms) continue;
    const text = readDocument(payload, key);
    const missing = terms.filter((term) => !includesAny(text, [term]));
    checks.push({
      name: `rubric:${key}`,
      ok: missing.length === 0,
      message: missing.length ? `${key} missing section terms: ${missing.join(", ")}` : ""
    });
  }
  return checks;
}

function checkHazardReflection(payload, expected) {
  const coreText = [
    readDocument(payload, "riskAssessmentDraft"),
    readDocument(payload, "workPlanDraft"),
    readDocument(payload, "tbmBriefing"),
    readDocument(payload, "safetyEducationRecordDraft")
  ].join("\n");
  const missing = asArray(expected.hazards).filter((hazard) => !includesAny(coreText, [hazard]));
  return [{
    name: "reflection:hazards",
    ok: missing.length === 0,
    message: missing.length ? `hazards not reflected: ${missing.join(", ")}` : ""
  }];
}

function checkWeatherReflection(payload, expected) {
  const weatherSignals = asArray(expected.weatherSignals);
  if (!weatherSignals.length) return [{ name: "reflection:weather", ok: true, message: "" }];
  const text = [
    readDocument(payload, "riskAssessmentDraft"),
    readDocument(payload, "workPlanDraft"),
    readDocument(payload, "tbmBriefing"),
    readDocument(payload, "kakaoMessage")
  ].join("\n");
  const missing = weatherSignals.filter((signal) => !includesAny(text, weatherFallbackTerms[signal] || [signal]));
  return [{
    name: "reflection:weather",
    ok: missing.length === 0,
    message: missing.length ? `weather signals not reflected: ${missing.join(", ")}` : ""
  }];
}

function checkWorkerReflection(payload, expected) {
  const workerSignals = asArray(expected.workerSignals);
  if (!workerSignals.length) return [{ name: "reflection:workers", ok: true, message: "" }];
  const text = [
    readDocument(payload, "tbmBriefing"),
    readDocument(payload, "tbmLogDraft"),
    readDocument(payload, "safetyEducationRecordDraft"),
    readDocument(payload, "kakaoMessage")
  ].join("\n");
  const missing = workerSignals.filter((signal) => !includesAny(text, [signal]));
  return [{
    name: "reflection:workers",
    ok: missing.length === 0,
    message: missing.length ? `worker signals not reflected: ${missing.join(", ")}` : ""
  }];
}

function checkForeignLanguageReflection(payload, expected) {
  const languages = asArray(expected.foreignLanguageSignals);
  if (!languages.length) return [{ name: "reflection:foreignLanguages", ok: true, message: "" }];
  const text = [
    readDocument(payload, "foreignWorkerBriefing"),
    readDocument(payload, "foreignWorkerTransmission"),
    readDocument(payload, "safetyEducationRecordDraft"),
    readDocument(payload, "kakaoMessage")
  ].join("\n");
  const missing = languages.filter((language) => !includesAny(text, [language, "외국인", "쉬운 한국어", "STOP"]));
  return [{
    name: "reflection:foreignLanguages",
    ok: missing.length === 0,
    message: missing.length ? `foreign language signals not reflected: ${missing.join(", ")}` : ""
  }];
}

function checkCase(testCase, payload, api) {
  const failures = checkExpectedSchema(testCase.expected).map((message) => ({ name: "expected:schema", ok: false, message }));
  if (!payload || typeof payload !== "object") {
    failures.push({ name: "payload:object", ok: false, message: "payload is not an object" });
    return { checks: failures, ok: false };
  }

  const checks = [
    ...failures,
    ...(api ? [{ name: "api:/api/ask", ok: api.ok, message: api.ok ? "" : `api failed: ${api.status} ${api.rawPreview}` }] : []),
    ...checkRequiredDocuments(payload, asArray(testCase.expected.requiredDocuments)),
    ...checkDocumentRubrics(payload, asArray(testCase.expected.requiredDocuments)),
    ...checkHazardReflection(payload, testCase.expected),
    ...checkWeatherReflection(payload, testCase.expected),
    ...checkWorkerReflection(payload, testCase.expected),
    ...checkForeignLanguageReflection(payload, testCase.expected)
  ];
  return { checks, ok: checks.every((item) => item.ok) };
}

function addDimension(summary, dimension, value, ok) {
  const key = value || "none";
  summary[dimension] ||= {};
  summary[dimension][key] ||= { total: 0, pass: 0, fail: 0 };
  summary[dimension][key].total += 1;
  if (ok) summary[dimension][key].pass += 1;
  else summary[dimension][key].fail += 1;
}

function updateDimensionSummary(summary, testCase, ok) {
  const expected = testCase.expected;
  addDimension(summary, "region", expected.region, ok);
  addDimension(summary, "industry", expected.industry, ok);
  addDimension(summary, "workType", expected.workType, ok);
  for (const hazard of asArray(expected.hazards)) addDimension(summary, "hazards", hazard, ok);
  for (const signal of asArray(expected.workerSignals)) addDimension(summary, "workerSignals", signal, ok);
  for (const signal of asArray(expected.weatherSignals)) addDimension(summary, "weatherSignals", signal, ok);
  for (const signal of asArray(expected.foreignLanguageSignals)) addDimension(summary, "foreignLanguageSignals", signal, ok);
  for (const documentKey of asArray(expected.requiredDocuments)) addDimension(summary, "requiredDocuments", documentKey, ok);
}

function writeJson(fileName, payload) {
  fs.writeFileSync(path.join(outDir, fileName), `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

ensureDir(outDir);

const startedAt = Date.now();
const matrix = readJson(casesPath);
const allCases = buildCases(matrix);
const maxLiveCases = liveEnabled ? Math.max(0, Math.min(liveCount, allCases.length)) : 0;
const selectedLiveIds = new Set(allCases.slice(0, maxLiveCases).map((item) => item.id));
const details = [];
const byDimension = {};

for (const testCase of allCases) {
  const caseStartedAt = Date.now();
  const shouldCallLive = selectedLiveIds.has(testCase.id);
  let payload = null;
  let api = null;
  let runnerError = "";

  try {
    if (shouldCallLive) {
      const result = await fetchAskPayload(testCase);
      payload = result.payload;
      api = result.api;
    } else {
      payload = buildLocalPayload(testCase);
    }
  } catch (error) {
    runnerError = error instanceof Error ? error.message : String(error);
  }

  const result = runnerError
    ? { checks: [{ name: "runner:error", ok: false, message: runnerError }], ok: false }
    : checkCase(testCase, payload, api);
  updateDimensionSummary(byDimension, testCase, result.ok);

  details.push({
    id: testCase.id,
    baseId: testCase.baseId,
    variantId: testCase.variantId,
    mode: shouldCallLive ? "live" : "local-deterministic",
    ok: result.ok,
    elapsedMs: Date.now() - caseStartedAt,
    expected: testCase.expected,
    api,
    failedChecks: result.checks.filter((item) => !item.ok),
    checkCount: result.checks.length
  });
}

const pass = details.filter((item) => item.ok).length;
const fail = details.length - pass;
const failureSamples = details
  .filter((item) => !item.ok)
  .slice(0, failureSampleLimit)
  .map((item) => ({
    id: item.id,
    mode: item.mode,
    expected: {
      region: item.expected.region,
      industry: item.expected.industry,
      workType: item.expected.workType
    },
    failedChecks: item.failedChecks.slice(0, 8)
  }));

const report = {
  generatedAt: new Date().toISOString(),
  elapsedMs: Date.now() - startedAt,
  mode: liveEnabled ? "mixed-live" : "local-deterministic",
  baseUrl: liveEnabled ? baseUrl : null,
  casesPath: path.relative(process.cwd(), casesPath),
  total: details.length,
  pass,
  fail,
  live: {
    enabled: liveEnabled,
    requested: liveEnabled ? liveCount : 0,
    executed: maxLiveCases,
    timeoutMs
  },
  matrix: {
    baseScenarios: asArray(matrix.baseScenarios).length,
    variants: asArray(matrix.variants).length
  },
  failureSamples,
  byDimension
};

writeJson("matrix-runner-report.json", report);
writeJson("report.json", report);
writeJson("details.json", details);

console.log(JSON.stringify({
  total: report.total,
  pass: report.pass,
  fail: report.fail,
  mode: report.mode,
  liveExecuted: report.live.executed,
  outDir: path.relative(process.cwd(), outDir)
}, null, 2));

process.exit(fail === 0 ? 0 : 1);
