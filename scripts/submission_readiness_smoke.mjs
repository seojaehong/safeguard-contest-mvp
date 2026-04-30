#!/usr/bin/env node
import childProcess from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const baseUrl = process.env.SAFEGUARD_BASE_URL || "https://safeguard-contest-mvp.vercel.app";
const outDir = path.resolve(process.env.SAFEGUARD_SUBMISSION_OUT_DIR || path.join(process.cwd(), "evaluation", "submission-readiness"));
const authToken = process.env.SAFEGUARD_AUTH_TOKEN || "";
const runLiveDispatch = process.env.SAFEGUARD_RUN_LIVE_DISPATCH === "1";
const dispatchRecipients = (process.env.SAFEGUARD_DISPATCH_RECIPIENTS || "")
  .split(/[,;\n]/)
  .map((item) => item.trim())
  .filter(Boolean);

const scenarios = [
  {
    id: "seoul-construction-windy",
    title: "서울 건설 강풍",
    question: "세이프건설 서울 성수동 근린생활시설 외벽 도장 작업. 이동식 비계 사용, 작업자 5명, 신규 투입자 1명, 오후 강풍 예보. 추락과 지게차 동선 위험을 반영해 오늘 위험성평가와 TBM, 안전보건교육 기록을 만들어줘."
  },
  {
    id: "incheon-logistics-rain",
    title: "인천 물류 우천",
    question: "한빛로지스 인천 남동공단 물류센터 지게차 상하차 작업. 숙련 지게차 운전자 2명과 피킹 인력 6명, 우천 후 출입구 바닥 젖음, 보행 동선과 지게차 동선이 겹친다. 오늘 위험성평가와 TBM, 안전보건교육 기록을 만들어줘."
  },
  {
    id: "ansan-manufacturing-foreign-hotwork",
    title: "안산 제조 화기 외국인 포함",
    question: "그린메탈 경기 안산 공장 배관 용접·절단 화기작업. 외국인 근로자 2명과 신규 작업자 1명 포함, 작업자 6명, 실내 고온과 환기 불량, 가연물 인접. 화재감시자와 다국어 안전교육까지 반영해 위험성평가, TBM, 안전보건교육 기록을 만들어줘."
  }
];

const requiredDeliverables = [
  "workpackSummaryDraft",
  "riskAssessmentDraft",
  "workPlanDraft",
  "tbmBriefing",
  "tbmLogDraft",
  "safetyEducationRecordDraft",
  "emergencyResponseDraft",
  "photoEvidenceDraft",
  "foreignWorkerBriefing",
  "foreignWorkerTransmission",
  "kakaoMessage"
];

const requiredFormatStrings = [
  "위험성평가",
  "TBM",
  "안전보건교육",
  "확인",
  "서명"
];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJson(fileName, payload) {
  fs.writeFileSync(path.join(outDir, fileName), JSON.stringify(payload, null, 2), "utf8");
}

function verdict(items) {
  if (items.some((item) => item.verdict === "blocked")) return "blocked";
  if (items.some((item) => item.verdict === "pass_with_notice")) return "pass_with_notice";
  return "pass";
}

async function fetchJson(route, init) {
  const startedAt = Date.now();
  const response = await fetch(`${baseUrl}${route}`, init);
  const text = await response.text();
  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = null;
  }
  return {
    status: response.status,
    ok: response.ok,
    elapsedMs: Date.now() - startedAt,
    parsed,
    rawPreview: text.slice(0, 240)
  };
}

async function runAskScenario(scenario) {
  const response = await fetchJson("/api/ask", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ question: scenario.question })
  });
  const deliverables = response.parsed?.deliverables || {};
  const missing = requiredDeliverables.filter((key) => typeof deliverables[key] !== "string" || deliverables[key].length < 20);
  const formatChecks = requiredFormatStrings.map((text) => ({
    text,
    present: Object.values(deliverables).some((value) => typeof value === "string" && value.includes(text))
  }));
  return {
    id: scenario.id,
    title: scenario.title,
    status: response.status,
    elapsedMs: response.elapsedMs,
    verdict: response.ok && missing.length === 0 && formatChecks.every((item) => item.present) ? "pass" : "blocked",
    missingDeliverables: missing,
    formatChecks,
    mode: response.parsed?.mode || "unknown",
    documentCount: requiredDeliverables.length - missing.length,
    payload: response.parsed
  };
}

async function runStorageSmoke(askPayload) {
  if (!authToken) {
    return {
      verdict: "blocked",
      message: "SAFEGUARD_AUTH_TOKEN이 없어 Production 저장 API를 인증 호출하지 못했습니다.",
      configured: false
    };
  }

  const workers = [
    {
      id: "submission-worker-manager",
      displayName: "제출검증 관리자",
      role: "현장관리자",
      joinedAt: "2026-04-30",
      experienceLevel: "숙련",
      experienceSummary: "제출 전 저장 검증용 관리자",
      nationality: "대한민국",
      languageCode: "ko",
      languageLabel: "한국어",
      isNewWorker: false,
      isForeignWorker: false,
      trainingStatus: "이수",
      trainingSummary: "제출 전 교육 확인",
      phone: "01000000000",
      email: "submission-check@safeguard.local"
    }
  ];
  const authHeaders = {
    authorization: `Bearer ${authToken}`,
    "content-type": "application/json"
  };
  const workerResponse = await fetchJson("/api/workers", {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ scenario: askPayload.scenario, workers })
  });
  const workpackResponse = await fetchJson("/api/workpacks", {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      question: askPayload.question,
      scenario: askPayload.scenario,
      deliverables: askPayload.deliverables,
      evidenceSummary: {
        citations: askPayload.citations || [],
        status: askPayload.status || {}
      },
      workerSummary: { selectedCount: workers.length },
      status: askPayload.status || {}
    })
  });
  const educationResponse = await fetchJson("/api/education-records", {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      scenario: askPayload.scenario,
      workpackId: workpackResponse.parsed?.workpackId,
      workerMap: workerResponse.parsed?.workerMap || {},
      workers,
      records: [{
        workerId: workers[0].id,
        topic: `${askPayload.scenario?.workSummary || "현장 작업"} 작업 전 안전교육`,
        languageCode: "ko",
        languageLabel: "한국어",
        confirmationStatus: "이수",
        confirmationMethod: "제출 전 저장 검증",
        memo: "제출 기준점 저장 검증"
      }]
    })
  });

  const ok = Boolean(workerResponse.parsed?.ok && workpackResponse.parsed?.ok && educationResponse.parsed?.ok);
  return {
    verdict: ok ? "pass" : "blocked",
    configured: true,
    workpackId: workpackResponse.parsed?.workpackId || null,
    worker: workerResponse.parsed,
    workpack: workpackResponse.parsed,
    education: educationResponse.parsed
  };
}

async function runDispatchSmoke(askPayload, storageSmoke) {
  if (!runLiveDispatch) {
    return {
      verdict: "pass_with_notice",
      message: "SAFEGUARD_RUN_LIVE_DISPATCH=1이 아니어서 실제 메일·문자 발송은 실행하지 않았습니다.",
      requested: false
    };
  }
  if (!dispatchRecipients.length) {
    return {
      verdict: "blocked",
      message: "SAFEGUARD_DISPATCH_RECIPIENTS가 없어 실제 전파 수신자를 확정하지 못했습니다.",
      requested: true
    };
  }

  const dispatchResponse = await fetchJson("/api/workflow/dispatch", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      channels: ["email", "sms"],
      recipients: dispatchRecipients,
      operatorNote: "제출 기준점 live 전파 검증입니다.",
      workpack: {
        companyName: askPayload.scenario?.companyName,
        siteName: askPayload.scenario?.siteName,
        workSummary: askPayload.scenario?.workSummary,
        riskLevel: askPayload.riskSummary?.riskLevel,
        topRisk: askPayload.riskSummary?.topRisk,
        immediateActions: askPayload.riskSummary?.immediateActions,
        message: askPayload.deliverables?.kakaoMessage,
        documents: askPayload.deliverables,
        evidence: {
          citations: askPayload.citations || [],
          weather: askPayload.externalData?.weather,
          training: askPayload.externalData?.training,
          kosha: askPayload.externalData?.kosha,
          accidentCases: askPayload.externalData?.accidentCases
        },
        status: askPayload.status || {}
      }
    })
  });

  const channelResults = Array.isArray(dispatchResponse.parsed?.channelResults)
    ? dispatchResponse.parsed.channelResults
    : [];
  const resultByChannel = new Map(channelResults.map((item) => [item.channel, item]));
  const emailStatus = resultByChannel.get("email")?.status;
  const smsStatus = resultByChannel.get("sms")?.status;
  const hasUnconfiguredOfficialChannel = [emailStatus, smsStatus].some((status) => status === "unconfigured" || status === "skipped");
  const emailSent = emailStatus === "sent";
  const smsSent = smsStatus === "sent";
  const smsCarrierNotice = smsStatus === "failed";
  const verdictValue = dispatchResponse.parsed?.ok === true && emailSent && smsSent
    ? "pass"
    : dispatchResponse.parsed?.ok === true && emailSent && smsCarrierNotice && !hasUnconfiguredOfficialChannel
      ? "pass_with_notice"
      : "blocked";

  let logResponse = null;
  if (authToken && storageSmoke.workpackId && channelResults.length) {
    logResponse = await fetchJson("/api/dispatch-logs", {
      method: "POST",
      headers: {
        authorization: `Bearer ${authToken}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        scenario: askPayload.scenario,
        workpackId: storageSmoke.workpackId,
        logs: channelResults.map((item) => ({
          channel: item.channel || "unknown",
          targetLabel: "제출검증 수신자",
          targetContact: dispatchRecipients.join(", "),
          languageCode: "ko",
          provider: item.provider,
          providerStatus: item.status,
          workflowRunId: dispatchResponse.parsed?.workflowRunId,
          failureReason: item.status === "failed" || item.status === "unconfigured" ? item.message : "",
          payload: item
        }))
      })
    });
  }

  return {
    verdict: verdictValue,
    requested: true,
    response: dispatchResponse.parsed,
    logResponse: logResponse?.parsed || null
  };
}

function runFormatSmoke(scenario) {
  const scenarioOut = path.join(outDir, "formats", scenario.id);
  fs.mkdirSync(scenarioOut, { recursive: true });
  const env = {
    ...process.env,
    SAFEGUARD_BASE_URL: baseUrl,
    SAFEGUARD_OUT_DIR: scenarioOut,
    SAFEGUARD_SMOKE_QUESTION: scenario.question
  };
  try {
    childProcess.execFileSync(process.execPath, ["./scripts/prod_orchestration_download_smoke.mjs"], {
      cwd: process.cwd(),
      env,
      stdio: "pipe"
    });
    const reportPath = path.join(scenarioOut, "api-orchestration-download-smoke.json");
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
    const requiredFormats = ["PDF", "HWPX", "XLS", "ALL_XLS"];
    const missing = requiredFormats.filter((format) => !report.downloads?.some((item) => item.format === format && item.ok));
    return {
      id: scenario.id,
      title: scenario.title,
      verdict: missing.length === 0 ? "pass" : "blocked",
      reportPath: path.relative(process.cwd(), reportPath),
      missing,
      downloads: report.downloads
    };
  } catch (error) {
    return {
      id: scenario.id,
      title: scenario.title,
      verdict: "blocked",
      message: error instanceof Error ? error.message : "format smoke failed",
      reportPath: path.relative(process.cwd(), scenarioOut)
    };
  }
}

ensureDir(outDir);

const startedAt = Date.now();
const askResults = [];
for (const scenario of scenarios) {
  askResults.push(await runAskScenario(scenario));
}
const primaryAsk = askResults.find((item) => item.payload)?.payload;
if (!primaryAsk) {
  throw new Error("No /api/ask response could be used for submission readiness smoke.");
}

const storageSmoke = await runStorageSmoke(primaryAsk);
const dispatchSmoke = await runDispatchSmoke(primaryAsk, storageSmoke);
const formatSmokes = scenarios.map((scenario) => runFormatSmoke(scenario));
const gates = [
  { name: "ask-orchestration", verdict: verdict(askResults), details: askResults.map(({ payload, ...item }) => item) },
  { name: "storage", ...storageSmoke },
  { name: "dispatch", ...dispatchSmoke },
  { name: "formats", verdict: verdict(formatSmokes), details: formatSmokes }
];
const overall = verdict(gates);

const summary = {
  generatedAt: new Date().toISOString(),
  baseUrl,
  elapsedMs: Date.now() - startedAt,
  overall,
  gates
};

writeJson("prod-storage-smoke.json", storageSmoke);
writeJson("prod-dispatch-smoke.json", dispatchSmoke);
writeJson("document-format-verification.json", { verdict: verdict(formatSmokes), scenarios: formatSmokes });
writeJson("submission-readiness-summary.json", summary);

console.log(JSON.stringify({
  overall,
  outDir: path.relative(process.cwd(), outDir),
  gates: gates.map((item) => ({ name: item.name, verdict: item.verdict }))
}, null, 2));

process.exit(overall === "blocked" ? 1 : 0);
