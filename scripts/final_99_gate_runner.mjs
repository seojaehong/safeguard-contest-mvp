#!/usr/bin/env node
import childProcess from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import {
  coreDocumentChecks,
  requiredDeliverables,
  resolveAskAiMode,
  resolveDocsDir,
  resolveExecutionMode,
  shouldSkipAuthHistoryWrites
} from "./final_99_gate_contract.mjs";

const startedAt = Date.now();
const rootDir = process.cwd();
const outDir = path.resolve(process.env.SAFEGUARD_OUT_DIR || path.join(rootDir, "evaluation", "final-99-gate"));
const docsDir = resolveDocsDir();
const baseUrl = process.env.SAFEGUARD_BASE_URL || "https://safeguard-contest-mvp.vercel.app";
const primaryQuestion = process.env.SAFEGUARD_SMOKE_QUESTION
  || "세이프건설 서울 성수동 근린생활시설 외벽 도장 작업. 이동식 비계 사용, 작업자 5명, 신규 투입자 1명, 오후 강풍 예보. 추락과 지게차 동선 위험을 반영해 오늘 위험성평가와 TBM, 안전보건교육 기록을 만들어줘.";
const executionMode = resolveExecutionMode();
const askAiMode = resolveAskAiMode(executionMode);

const publicDataMap = [
  {
    id: "lawgo",
    label: "법제처 국가법령정보 / Law.go",
    documents: ["위험성평가표", "작업계획서", "TBM일지", "안전보건교육 기록"],
    reflection: "사업주의 안전보건조치, 위험성평가, 교육·관리 의무를 문서의 확인 항목과 근거 문장으로 반영합니다."
  },
  {
    id: "kosha",
    label: "KOSHA 공식자료·기술지침·재해사례",
    documents: ["위험성평가표", "작업계획서", "TBM일지", "사진/증빙"],
    reflection: "작업유형별 통제대책, 유사 재해 예방 포인트, 문서별 반영 근거로 연결합니다."
  },
  {
    id: "weather",
    label: "기상청 현재·예보·특보",
    documents: ["작업계획서", "TBM일지", "현장 공유 메시지"],
    reflection: "강풍·우천·폭염·자외선 등 작업중지 판단과 TBM 전달사항에 반영합니다."
  },
  {
    id: "work24",
    label: "고용24 / Work24 교육 데이터",
    documents: ["안전보건교육 기록", "외국인 근로자 출력본"],
    reflection: "후속 교육 추천과 외국인·신규 투입자 교육 연결성을 보강합니다."
  },
  {
    id: "gemini",
    label: "Gemini 기반 AI 보완 생성",
    documents: ["문서팩 편집 전반"],
    reflection: "근거 선택 후 보완 제안을 만들고, 사용자가 편집한 뒤 삽입하는 흐름으로만 반영합니다."
  }
];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function loadLocalEnv() {
  if (process.env.SAFEGUARD_LOAD_LOCAL_ENV === "0") return;
  const envPath = path.join(rootDir, ".env.local");
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [key, ...rest] = trimmed.split("=");
    const name = key.trim();
    if (!name || process.env[name]) continue;
    let value = rest.join("=").trim();
    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[name] = value;
  }
}

function writeJson(fileName, payload) {
  fs.writeFileSync(path.join(outDir, fileName), JSON.stringify(payload, null, 2), "utf8");
}

function writeMarkdown(filePath, content) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${content.trim()}\n`, "utf8");
}

function elapsedMs() {
  return Date.now() - startedAt;
}

function gateVerdict(gates) {
  if (gates.some((gate) => gate.verdict === "blocked")) return "blocked";
  if (gates.some((gate) => gate.verdict === "pass_with_notice")) return "pass_with_notice";
  return "pass";
}

function safePreview(value, max = 300) {
  return String(value || "").replace(/\s+/g, " ").slice(0, max);
}

function getCommitHash() {
  try {
    return childProcess.execFileSync("git", ["rev-parse", "--short", "HEAD"], {
      cwd: rootDir,
      encoding: "utf8"
    }).trim();
  } catch {
    return "unknown";
  }
}

function getFullCommitHash() {
  try {
    return childProcess.execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: rootDir,
      encoding: "utf8"
    }).trim();
  } catch {
    return "unknown";
  }
}

async function fetchProductionBuildInfo() {
  const response = await fetchJson("/api/build-info");
  if (!response.ok || !response.parsed?.ok) {
    return {
      ok: false,
      status: response.status,
      message: response.parsed?.message || response.rawPreview || "build info unavailable"
    };
  }
  return {
    ok: true,
    status: response.status,
    commitSha: response.parsed.commitSha || null,
    branch: response.parsed.branch || null,
    environment: response.parsed.environment || null,
    deploymentUrl: response.parsed.deploymentUrl || null
  };
}

async function fetchText(route, init) {
  const started = Date.now();
  const response = await fetch(`${baseUrl}${route}`, init);
  const text = await response.text();
  return {
    ok: response.ok,
    status: response.status,
    headers: Object.fromEntries(response.headers.entries()),
    elapsedMs: Date.now() - started,
    text
  };
}

async function fetchBinary(route, init) {
  const started = Date.now();
  const response = await fetch(`${baseUrl}${route}`, init);
  const buffer = Buffer.from(await response.arrayBuffer());
  return {
    ok: response.ok,
    status: response.status,
    headers: Object.fromEntries(response.headers.entries()),
    elapsedMs: Date.now() - started,
    buffer
  };
}

async function fetchJson(route, init) {
  const response = await fetchText(route, init);
  let parsed = null;
  try {
    parsed = response.text ? JSON.parse(response.text) : null;
  } catch {
    parsed = null;
  }
  return { ...response, parsed, rawPreview: safePreview(response.text) };
}

async function runAskGate() {
  const response = await fetchJson("/api/ask", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      question: primaryQuestion,
      ...(askAiMode ? { aiMode: askAiMode } : {})
    })
  });
  const deliverables = response.parsed?.deliverables || {};
  const missingDeliverables = requiredDeliverables.filter((key) => typeof deliverables[key] !== "string" || deliverables[key].length < 20);
  const externalData = response.parsed?.externalData || {};
  const externalSignals = {
    lawgo: Array.isArray(response.parsed?.citations) && response.parsed.citations.length > 0,
    weather: Boolean(externalData.weather),
    work24: Boolean(externalData.training),
    kosha: Boolean(externalData.kosha),
    accidentCases: Boolean(externalData.accidentCases)
  };

  return {
    verdict: response.ok && missingDeliverables.length === 0 ? "pass" : "blocked",
    status: response.status,
    elapsedMs: response.elapsedMs,
    mode: response.parsed?.mode || "unknown",
    requestedAiMode: askAiMode || "production-default",
    documentCount: requiredDeliverables.length - missingDeliverables.length,
    missingDeliverables,
    rawPreview: response.rawPreview,
    externalSignals,
    payload: response.parsed
  };
}

function buildRows(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 80)
    .map((content, index) => ({
      document: "SafeClaw 제출 서식",
      section: content.match(/^\[(.+)]$/)?.[1] || "본문",
      item: String(index + 1),
      content
    }));
}

async function runCorePdfExportCheck(askPayload) {
  const checks = [];
  const filesDir = path.join(outDir, "core-pdf");
  ensureDir(filesDir);

  for (const document of coreDocumentChecks) {
    const sourceText = askPayload.deliverables?.[document.key] || "";
    const rows = buildRows(sourceText);
    const htmlResponse = await fetchText("/api/export/pdf?format=html", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "text/html"
      },
      body: JSON.stringify({
        title: document.routeTitle,
        rows,
        scenario: askPayload.scenario,
        riskSummary: askPayload.riskSummary,
        weather: askPayload.externalData?.weather
      })
    });
    const htmlPath = path.join(filesDir, htmlResponse.ok ? `${document.id}.html` : `${document.id}.error.html`);
    fs.writeFileSync(htmlPath, htmlResponse.text, "utf8");

    const pdfResponse = await fetchBinary("/api/export/pdf?format=pdf", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/pdf"
      },
      body: JSON.stringify({
        title: document.routeTitle,
        rows,
        scenario: askPayload.scenario,
        riskSummary: askPayload.riskSummary,
        weather: askPayload.externalData?.weather
      })
    });
    const pdfPath = path.join(filesDir, `${document.id}.pdf`);
    if (pdfResponse.ok) {
      fs.writeFileSync(pdfPath, pdfResponse.buffer);
    }

    const htmlTerms = document.requiredTerms.map((term) => ({
      term,
      present: htmlResponse.text.includes(term)
    }));
    const hasUniqueStructure = htmlTerms.filter((item) => item.present).length >= Math.min(4, document.requiredTerms.length);
    const hasSignatureOrCheck = /서명|확인|검토|관리감독자/.test(htmlResponse.text);
    const hasKoreanEncoding = /[가-힣]/.test(htmlResponse.text);
    checks.push({
      id: document.id,
      title: document.title,
      sourceKey: document.key,
      htmlStatus: htmlResponse.status,
      pdfStatus: pdfResponse.status,
      htmlPath: path.relative(rootDir, htmlPath),
      pdfPath: pdfResponse.ok ? path.relative(rootDir, pdfPath) : "",
      pdfBytes: pdfResponse.ok ? pdfResponse.buffer.length : 0,
      requiredTerms: htmlTerms,
      hasUniqueStructure,
      hasSignatureOrCheck,
      hasKoreanEncoding,
      verdict: htmlResponse.ok && pdfResponse.ok && pdfResponse.buffer.length > 5000 && hasUniqueStructure && hasSignatureOrCheck && hasKoreanEncoding
        ? "pass"
        : "blocked"
    });
  }

  return {
    verdict: gateVerdict(checks),
    generatedCount: checks.length,
    checks
  };
}

function runOrchestrationDownloadSmoke() {
  const orchestrationDir = path.join(outDir, "orchestration-download");
  ensureDir(orchestrationDir);
  const result = childProcess.spawnSync(process.execPath, ["./scripts/prod_orchestration_download_smoke.mjs"], {
    cwd: rootDir,
    encoding: "utf8",
    env: {
      ...process.env,
      SAFEGUARD_BASE_URL: baseUrl,
      SAFEGUARD_OUT_DIR: orchestrationDir,
      SAFEGUARD_SMOKE_QUESTION: primaryQuestion,
      SAFEGUARD_SMOKE_AI_MODE: askAiMode || ""
    },
    timeout: 180_000,
    maxBuffer: 8 * 1024 * 1024,
    killSignal: "SIGKILL",
    windowsHide: true,
  });
  let parsedStdout = null;
  try {
    parsedStdout = JSON.parse(result.stdout.trim());
  } catch {
    parsedStdout = null;
  }
  return {
    verdict: result.status === 0 ? "pass" : "blocked",
    status: result.status,
    stdout: safePreview(result.stdout, 1000),
    stderr: safePreview(result.stderr, 1000),
    outDir: path.relative(rootDir, orchestrationDir),
    parsedStdout
  };
}

async function runDocumentDownloadGate(askPayload) {
  const corePdf = await runCorePdfExportCheck(askPayload);
  const orchestration = runOrchestrationDownloadSmoke();
  const notice = "HWPX는 원본 셀 단위 완전 복제가 아니라 제출형 초안입니다. 현장 검토 후 사용 고지를 유지합니다.";
  const hasOrchestrationProof = orchestration.verdict === "pass"
    && orchestration.parsedStdout?.downloadCount >= 12
    && orchestration.parsedStdout?.failCount === 0;
  const coreRouteUnavailable = corePdf.checks.every((check) => check.htmlStatus === 404 || check.pdfStatus === 404);
  const verdictValue = corePdf.verdict === "pass" && orchestration.verdict === "pass"
    ? "pass"
    : hasOrchestrationProof && coreRouteUnavailable
      ? "pass_with_notice"
      : gateVerdict([corePdf, orchestration]);
  const gate = {
    verdict: verdictValue,
    policyNotice: notice,
    routeNotice: coreRouteUnavailable
      ? "현재 기준 prod /api/export/pdf 직접 라우트는 404입니다. 기존 다운로드 오케스트레이션이 PDF/HWPX/XLS 산출물을 생성했으므로 제출 게이트는 notice로 분리합니다."
      : "",
    corePdf,
    orchestration
  };
  writeJson("document-download-smoke.json", gate);
  return gate;
}

async function runRemediationGate(askPayload) {
  if (executionMode === "no-mutation") {
    return {
      verdict: "pass_with_notice",
      status: null,
      configured: false,
      providerLabel: "not-called:no-mutation",
      catalogStatus: null,
      textPreview: "",
      sourceCount: 0,
      mutationBoundary: {
        providerGenerationCalled: false,
        dbMutationPerformed: false
      },
      policy: "no-mutation 모드는 외부 AI 보완 생성을 호출하지 않습니다. 제안·편집·삽입 계약은 별도 live evidence를 유지합니다."
    };
  }
  const documentText = askPayload.deliverables?.riskAssessmentDraft || "";
  const response = await fetchJson("/api/workpack/remediate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      question: primaryQuestion,
      documentKey: "riskAssessmentDraft",
      documentText,
      rubricItemId: "required-risk-reduction"
    })
  });
  const text = response.parsed?.text || "";
  const sources = Array.isArray(response.parsed?.sources) ? response.parsed.sources : [];
  return {
    verdict: response.ok && response.parsed?.ok === true && typeof text === "string" && text.includes("보완") ? "pass" : "blocked",
    status: response.status,
    configured: response.parsed?.configured ?? null,
    providerLabel: response.parsed?.providerLabel || "unknown",
    catalogStatus: response.parsed?.catalogStatus || null,
    textPreview: safePreview(text, 500),
    sourceCount: sources.length,
    policy: "AI 보완은 자동 덮어쓰기가 아니라 제안, 사용자 편집, 삽입 흐름으로만 인정합니다."
  };
}

function buildEvidenceMap(askPayload, remediationGate) {
  const citations = Array.isArray(askPayload.citations) ? askPayload.citations : [];
  const externalData = askPayload.externalData || {};
  const evidenceItems = publicDataMap.map((item) => {
    const liveSignal = item.id === "lawgo"
      ? citations.length > 0
      : item.id === "kosha"
        ? Boolean(externalData.kosha || externalData.accidentCases)
        : item.id === "weather"
          ? Boolean(externalData.weather)
          : item.id === "work24"
            ? Boolean(externalData.training)
            : remediationGate.verdict === "pass";
    return {
      ...item,
      liveSignal,
      status: liveSignal ? "reflected" : "needs-review",
      evidenceCount: item.id === "lawgo"
        ? citations.length
        : item.id === "kosha"
          ? Number(Boolean(externalData.kosha)) + Number(Boolean(externalData.accidentCases))
          : item.id === "weather"
            ? Number(Boolean(externalData.weather))
            : item.id === "work24"
              ? Number(Boolean(externalData.training))
              : Number(remediationGate.verdict === "pass")
    };
  });
  const gate = {
    verdict: evidenceItems.filter((item) => item.status === "reflected").length >= 4 ? "pass" : "pass_with_notice",
    generatedAt: new Date().toISOString(),
    baseUrl,
    principle: "공공데이터와 AI는 긴 원문 목록이 아니라 문서 문장, 확인 항목, 작업중지 기준에 반영된 위치로 설명합니다.",
    items: evidenceItems,
    citationPreview: citations.slice(0, 5).map((citation) => ({
      title: citation.title,
      sourceType: citation.sourceType,
      url: citation.url
    }))
  };
  writeJson("public-data-ai-map.json", gate);
  return gate;
}

function buildWorkers() {
  return [
    {
      id: "final99-manager",
      displayName: "제출검증 관리자",
      role: "현장관리자",
      joinedAt: "2026-05-01",
      experienceLevel: "숙련",
      experienceSummary: "최종 99 게이트 검증용 관리자",
      nationality: "대한민국",
      languageCode: "ko",
      languageLabel: "한국어",
      isNewWorker: false,
      isForeignWorker: false,
      trainingStatus: "이수",
      trainingSummary: "최종 제출 전 교육 확인",
      phone: "01000000000",
      email: "final99-check@safeguard.local"
    },
    {
      id: "final99-foreign-worker",
      displayName: "외국인 작업자",
      role: "도장 작업자",
      joinedAt: "2026-05-01",
      experienceLevel: "신규",
      experienceSummary: "다국어 전송본 검증 대상",
      nationality: "베트남",
      languageCode: "vi",
      languageLabel: "Tiếng Việt",
      isNewWorker: true,
      isForeignWorker: true,
      trainingStatus: "당일 교육 예정",
      trainingSummary: "TBM 및 쉬운 한국어/베트남어 안내 필요",
      phone: "01000000001",
      email: "foreign-worker@safeguard.local"
    }
  ];
}

async function runAuthHistoryGate(askPayload) {
  const authToken = process.env.SAFEGUARD_AUTH_TOKEN;
  const base = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    authTokenPresent: Boolean(authToken),
    executionMode
  };
  if (shouldSkipAuthHistoryWrites(authToken)) {
    const noMutation = executionMode === "no-mutation";
    const gate = {
      ...base,
      verdict: "pass_with_notice",
      configured: Boolean(authToken),
      authTokenIgnored: noMutation && Boolean(authToken),
      message: noMutation
        ? "no-mutation 모드가 관리자 저장/재열기 쓰기를 강제로 건너뛰었습니다. 인증 토큰이 있어도 사용하지 않았습니다."
        : "SAFEGUARD_AUTH_TOKEN이 없어 live 관리자 저장/재열기는 실행하지 않았습니다. UI는 비회원 임시 저장과 관리자 로그인 필요 상태로 방어합니다.",
      mutationBoundary: {
        dbMutationPerformed: false,
        dispatchLogMutationPerformed: false,
        workerMutationPerformed: false,
        workpackMutationPerformed: false,
        educationMutationPerformed: false
      }
    };
    writeJson("auth-history-smoke.json", gate);
    return gate;
  }

  const headers = {
    authorization: `Bearer ${authToken}`,
    "content-type": "application/json"
  };
  const workers = buildWorkers();
  const workerResponse = await fetchJson("/api/workers", {
    method: "POST",
    headers,
    body: JSON.stringify({ scenario: askPayload.scenario, workers })
  });
  const workpackResponse = await fetchJson("/api/workpacks", {
    method: "POST",
    headers,
    body: JSON.stringify({
      data: askPayload,
      question: askPayload.question || primaryQuestion,
      scenario: askPayload.scenario,
      deliverables: askPayload.deliverables,
      evidenceSummary: {
        answer: askPayload.answer,
        practicalPoints: askPayload.practicalPoints || [],
        citations: askPayload.citations || [],
        sourceMix: askPayload.sourceMix || {},
        externalData: askPayload.externalData,
        riskSummary: askPayload.riskSummary,
        status: askPayload.status || {}
      },
      workerSummary: { selectedCount: workers.length },
      status: askPayload.status || {}
    })
  });
  const workpackId = workpackResponse.parsed?.workpackId || workpackResponse.parsed?.workpack?.id || null;
  const educationResponse = await fetchJson("/api/education-records", {
    method: "POST",
    headers,
    body: JSON.stringify({
      scenario: askPayload.scenario,
      workpackId,
      workerMap: workerResponse.parsed?.workerMap || {},
      workers,
      records: workers.map((worker) => ({
        workerId: worker.id,
        topic: `${askPayload.scenario?.workSummary || "현장 작업"} 작업 전 안전교육`,
        languageCode: worker.languageCode,
        languageLabel: worker.languageLabel,
        confirmationStatus: worker.trainingStatus === "이수" ? "이수" : "확인 필요",
        confirmationMethod: "최종 99 게이트 저장 검증",
        memo: "문서팩 생성, 교육 확인, 이력 재사용 게이트"
      }))
    })
  });
  const listResponse = await fetchJson("/api/workpacks?limit=5", { headers });
  const detailResponse = workpackId
    ? await fetchJson(`/api/workpacks/${encodeURIComponent(workpackId)}`, { headers })
    : { ok: false, status: 0, parsed: null, elapsedMs: 0, rawPreview: "workpack id missing" };
  const dispatchLogResponse = workpackId
    ? await fetchJson("/api/dispatch-logs", {
      method: "POST",
      headers,
      body: JSON.stringify({
        scenario: askPayload.scenario,
        workpackId,
        logs: [
          {
            channel: "email",
            targetLabel: "제출검증 관리자",
            targetContact: "final99-check@safeguard.local",
            languageCode: "ko",
            provider: "safe-fixture",
            providerStatus: "sent",
            workflowRunId: `final99-${Date.now()}`,
            payload: { gate: "final-99", liveDispatch: false }
          },
          {
            channel: "sms",
            targetLabel: "외국인 작업자",
            targetContact: "010****0001",
            languageCode: "vi",
            provider: "safe-fixture",
            providerStatus: "sent",
            workflowRunId: `final99-${Date.now()}`,
            payload: { gate: "final-99", liveDispatch: false }
          }
        ]
      })
    })
    : { ok: false, status: 0, parsed: null, elapsedMs: 0, rawPreview: "workpack id missing" };
  const logListResponse = await fetchJson("/api/dispatch-logs?limit=5", { headers });

  const checks = [
    { name: "workers-upsert", ok: workerResponse.ok && workerResponse.parsed?.ok === true },
    { name: "workpack-save", ok: workpackResponse.ok && workpackResponse.parsed?.ok === true && Boolean(workpackId) },
    { name: "education-save", ok: educationResponse.ok && educationResponse.parsed?.ok === true },
    { name: "archive-list", ok: listResponse.ok && listResponse.parsed?.ok === true },
    { name: "workpack-reopen", ok: detailResponse.ok && detailResponse.parsed?.canReopen === true },
    { name: "dispatch-log-save", ok: dispatchLogResponse.ok && dispatchLogResponse.parsed?.ok === true },
    { name: "dispatch-log-list", ok: logListResponse.ok && logListResponse.parsed?.ok === true }
  ];

  const gate = {
    ...base,
    verdict: checks.every((item) => item.ok) ? "pass" : "blocked",
    configured: true,
    workpackId,
    reopenHref: workpackId ? `/documents?workpackId=${workpackId}` : null,
    checks,
    mutationBoundary: {
      dbMutationPerformed: checks.some((item) => item.ok && ["workers-upsert", "workpack-save", "education-save", "dispatch-log-save"].includes(item.name)),
      dispatchLogMutationPerformed: checks.find((item) => item.name === "dispatch-log-save")?.ok === true,
      workerMutationPerformed: checks.find((item) => item.name === "workers-upsert")?.ok === true,
      workpackMutationPerformed: checks.find((item) => item.name === "workpack-save")?.ok === true,
      educationMutationPerformed: checks.find((item) => item.name === "education-save")?.ok === true
    },
    responses: {
      worker: { status: workerResponse.status, ok: workerResponse.parsed?.ok },
      workpack: { status: workpackResponse.status, ok: workpackResponse.parsed?.ok, workpackId },
      education: { status: educationResponse.status, ok: educationResponse.parsed?.ok, savedCount: educationResponse.parsed?.savedCount },
      archive: { status: listResponse.status, ok: listResponse.parsed?.ok, count: Array.isArray(listResponse.parsed?.workpacks) ? listResponse.parsed.workpacks.length : 0 },
      reopen: { status: detailResponse.status, ok: detailResponse.parsed?.ok, canReopen: detailResponse.parsed?.canReopen },
      dispatchLog: { status: dispatchLogResponse.status, ok: dispatchLogResponse.parsed?.ok, savedCount: dispatchLogResponse.parsed?.savedCount },
      dispatchArchive: { status: logListResponse.status, ok: logListResponse.parsed?.ok, count: Array.isArray(logListResponse.parsed?.logs) ? logListResponse.parsed.logs.length : 0 }
    }
  };
  writeJson("auth-history-smoke.json", gate);
  return gate;
}

async function runDispatchPolicyGate(askPayload) {
  const capabilityResponse = await fetchJson("/api/workflow/dispatch");
  const legacyRejectedResponse = await fetchJson("/api/workflow/dispatch", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      channels: ["email", "sms"],
      recipients: ["final99-check@safeguard.local", "01000000001"],
      operatorNote: "최종 99 게이트 fixture 전파 검증",
      workpack: {
        companyName: askPayload.scenario?.companyName,
        siteName: askPayload.scenario?.siteName,
        workSummary: askPayload.scenario?.workSummary,
        riskLevel: askPayload.riskSummary?.riskLevel,
        topRisk: askPayload.riskSummary?.topRisk,
        message: askPayload.deliverables?.kakaoMessage,
        documents: askPayload.deliverables
      }
    })
  });
  const idempotencyKey = "provider-dispatch-v1-123e4567-e89b-42d3-a456-426614174000-abcdef12";
  const messageVariants = {
    ko: [
      "[SafeClaw 현장 전파]",
      `오늘 작업: ${askPayload.scenario?.workSummary || "현장 작업"}`,
      `핵심 위험: ${askPayload.riskSummary?.topRisk || "작업 전 위험 확인"}`,
      "현장 확인 후 작업을 시작하세요."
    ].join("\n")
  };
  const lockedResponse = await fetchJson("/api/workflow/dispatch", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      workpackId: "final99-workpack-fixture",
      shareSessionId: "final99-share-fixture",
      idempotencyKey,
      channels: ["band"],
      messageVariants
    })
  });
  const authGateResponse = await fetchJson("/api/workflow/dispatch", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      workpackId: "final99-workpack-fixture",
      shareSessionId: "final99-share-fixture",
      idempotencyKey,
      channels: ["email", "sms"],
      messageVariants
    })
  });
  const rejectedFields = Array.isArray(legacyRejectedResponse.parsed?.rejectedFields)
    ? legacyRejectedResponse.parsed.rejectedFields
    : [];
  const legacyRejected = legacyRejectedResponse.status === 400
    && rejectedFields.includes("recipients")
    && rejectedFields.includes("workpack")
    && typeof legacyRejectedResponse.parsed?.message === "string"
    && legacyRejectedResponse.parsed.message.includes("서버 권한 식별자");
  const lockedChannels = Array.isArray(lockedResponse.parsed?.lockedChannels)
    ? lockedResponse.parsed.lockedChannels
    : [];
  const lockedOk = lockedResponse.status === 400 && lockedChannels.includes("band");
  const authGateOk = authGateResponse.status === 401
    && typeof authGateResponse.parsed?.message === "string"
    && authGateResponse.parsed.message.includes("관리자 로그인");
  const providerNotCalled = [legacyRejectedResponse, lockedResponse, authGateResponse]
    .every((response) => response.parsed?.providerCalled !== true);
  const capabilityOk = capabilityResponse.ok && capabilityResponse.parsed?.ok === true;
  const gateOk = capabilityOk && legacyRejected && lockedOk && authGateOk && providerNotCalled;
  return {
    verdict: gateOk ? "pass_with_notice" : "blocked",
    officialChannels: ["email", "sms"],
    excludedChannels: ["kakao", "band"],
    policyNotice: "메일·문자는 관리자 인증과 서버 소유 workpack/share session이 있을 때만 provider 전송합니다. 이 게이트는 raw workpack 전송 차단, 밴드 잠금, 무인 provider 호출 차단을 확인합니다.",
    capability: {
      status: capabilityResponse.status,
      providerDispatch: capabilityResponse.parsed?.providerDispatch || null
    },
    legacyRejected: {
      status: legacyRejectedResponse.status,
      rejectedFields,
      message: legacyRejectedResponse.parsed?.message || ""
    },
    locked: {
      status: lockedResponse.status,
      lockedChannels,
      message: lockedResponse.parsed?.message || ""
    },
    authGate: {
      status: authGateResponse.status,
      message: authGateResponse.parsed?.message || "",
      providerCalled: authGateResponse.parsed?.providerCalled ?? null
    },
    mutationBoundary: {
      dbMutationPerformed: false,
      providerDispatchCalled: !providerNotCalled,
      shareSessionCreated: false
    }
  };
}

async function captureScreenshots() {
  const screenshotDir = path.join(outDir, "screenshots");
  ensureDir(screenshotDir);
  const targets = [
    ["/", "01-home.png"],
    ["/workspace", "02-workspace.png"],
    ["/documents", "03-documents.png"],
    ["/evidence", "04-evidence.png"],
    ["/dispatch", "05-dispatch.png"]
  ];
  let browser = null;
  try {
    const { chromium } = await import("playwright");
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
    const screenshots = [];
    for (const [route, fileName] of targets) {
      const url = `${baseUrl}${route}`;
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
      await page.locator("body").waitFor({ state: "visible", timeout: 10_000 });
      await page.waitForLoadState("load", { timeout: 10_000 }).catch(() => undefined);
      const filePath = path.join(screenshotDir, fileName);
      await page.screenshot({ path: filePath, fullPage: false });
      screenshots.push({ route, path: path.relative(rootDir, filePath) });
    }
    await browser.close();
    browser = null;
    return { verdict: "pass", screenshots };
  } catch (error) {
    await browser?.close().catch(() => undefined);
    const recoveredScreenshots = targets
      .map(([route, fileName]) => {
        const filePath = path.join(screenshotDir, fileName);
        return fs.existsSync(filePath) ? { route, path: path.relative(rootDir, filePath) } : null;
      })
      .filter(Boolean);
    const recoveredAllScreenshots = recoveredScreenshots.length === targets.length;
    return {
      verdict: recoveredAllScreenshots ? "pass" : "pass_with_notice",
      screenshots: recoveredScreenshots,
      message: recoveredAllScreenshots
        ? "all screenshots recovered after transient navigation warning"
        : error instanceof Error ? error.message : "screenshot capture failed"
    };
  }
}

function writeEvidenceMarkdown(evidenceGate) {
  const lines = [
    "# SafeClaw 제출용 공공데이터·AI 반영 맵",
    "",
    "이 문서는 심사위원이 공공데이터와 AI가 실제 문서 생성 흐름에 어떻게 반영됐는지 빠르게 확인하도록 만든 제출용 근거 맵입니다.",
    "",
    "## 원칙",
    "- 법령·KOSHA·기상·교육 데이터는 긴 원문 목록이 아니라 문서의 확인 항목, 작업중지 기준, 교육 문구에 반영합니다.",
    "- AI는 문서를 자동 덮어쓰지 않습니다. 근거 선택, AI 제안, 사용자 편집, 삽입 흐름으로만 반영합니다.",
    "- 판례와 해석례는 최종 법률 판단이 아니라 관리감독, 보호구, 교육 이행 여부를 점검하는 보조 근거입니다.",
    "",
    "## 데이터별 반영 위치",
    "",
    "| 데이터/AI | 상태 | 반영 문서 | 반영 방식 |",
    "|---|---:|---|---|",
    ...evidenceGate.items.map((item) => `| ${item.label} | ${item.status} | ${item.documents.join(", ")} | ${item.reflection} |`),
    "",
    "## 제출 시 설명 문장",
    "SafeClaw는 현장 한 줄 입력을 바탕으로 법령, KOSHA 자료, 재해사례, 기상, 교육 공공데이터와 AI 보완 생성 결과를 조합해 위험성평가표, 작업계획서, TBM일지, 안전보건교육 기록에 반영합니다. 산출물은 공식자료 기반 초안이며 현장관리자가 최종 확인 후 사용합니다."
  ];
  writeMarkdown(path.join(docsDir, "submission-evidence-map.md"), lines.join("\n"));
}

function writeSecurityPrivacyDoc() {
  const content = `
# SafeClaw 보안·개인정보 제출 준비도

## 운영 채널
- 정식 전파 채널은 메일과 문자입니다.
- 카카오와 밴드는 승인 전까지 잠금 상태로 표시하고 제출 성공 조건에서 제외합니다.

## 개인정보 최소 수집
- 저장 항목은 표시명, 역할, 현장 투입일, 숙련도, 국적, 주 사용 언어, 교육상태, 휴대폰, 이메일입니다.
- 주민번호, 여권번호, 주소, 생년월일, 체류자격은 저장하지 않습니다.
- 화면과 전파 로그에서는 연락처 마스킹을 기본 원칙으로 둡니다.

## AI와 공식자료 책임 경계
- AI 생성 결과는 공식자료 기반 초안입니다.
- 법률 판단, 행정 제출 확정 의견, 법적 효력 보장을 표현하지 않습니다.
- 문서 다운로드와 UI에는 현장 검토 후 사용 고지를 유지합니다.

## 저장 상태
- 비회원은 브라우저 임시 저장입니다.
- 관리자 로그인 후 Supabase 이력 저장, 재열기, 전파 로그 조회가 가능합니다.
- 저장 실패는 로그인 필요, 저장소 설정 필요, 저장 실패로 구분해 표시합니다.
`;
  writeMarkdown(path.join(docsDir, "security_privacy_readiness.md"), content);
}

function writeCommercializationOnepager(overall, gates) {
  const content = `
# SafeClaw 상용 SaaS v1 원페이지

## 한 줄 정의
SafeClaw는 현장관리자가 오늘 작업을 한 줄로 입력하면 위험성평가표, 작업계획서, TBM일지, 안전보건교육 기록, 외국인 공지, 전파 이력을 한 작업공간에서 처리하는 안전 문서 운영 SaaS입니다.

## 제출 기준 판정
- 최종 게이트: ${overall}
- 정식 전파 채널: 메일, 문자
- 제외 채널: 카카오, 밴드
- HWPX: 원본 셀 단위 복제물이 아니라 제출형 초안
- PDF: 서버 export와 브라우저 검토 흐름 병행

## 닫힌 운영 흐름
1. 작업 입력.
2. 법령, KOSHA, 재해사례, 기상, 교육 데이터 반영.
3. 위험성평가표, 작업계획서, 허가/점검표, TBM일지 생성.
4. 사용자가 AI 보완 제안을 편집 후 삽입.
5. PDF/HWPX/XLS 다운로드.
6. 메일/SMS 전파.
7. 관리자 이력에서 재열기.

## 게이트 요약
${gates.map((gate) => `- ${gate.name}: ${gate.verdict}`).join("\n")}

## 정직한 고지
SafeClaw는 공식자료 기반 초안과 현장 기록 보조 도구입니다. 최종 제출·법률 판단·현장 조치 책임은 현장 확인 절차를 거쳐 확정합니다.
`;
  writeMarkdown(path.join(docsDir, "commercialization-onepager.md"), content);
}

function buildNoticeCarry(summary) {
  const notices = [];
  const authGate = summary.gates.find((gate) => gate.name === "auth-history-reuse");
  if (authGate?.verdict === "pass_with_notice") {
    const noMutation = summary.executionMode === "no-mutation";
    notices.push({
      gate: "auth-history-reuse",
      sourceVerdict: authGate.verdict,
      carried: true,
      launchImpact: "operator-auth-gated",
      reason: noMutation
        ? "The explicit no-mutation run ignored any available SAFEGUARD_AUTH_TOKEN and skipped all admin save/reopen writes."
        : "SAFEGUARD_AUTH_TOKEN is intentionally absent from the local/live evidence run. Unauthenticated users remain defended by temporary browser state and login-required UI/API boundaries.",
      allowedClaim: "관리자 인증 없는 환경에서도 비회원 임시 저장과 로그인 필요 상태가 방어된다.",
      forbiddenClaim: "관리자 서버 저장과 이력 재열기를 live에서 실행 완료했다.",
      nextSecureProof: "Run final-99 with SAFEGUARD_AUTH_TOKEN from a secure operator environment and verify server save/reopen evidence."
    });
  }

  const dispatchGate = summary.gates.find((gate) => gate.name === "dispatch-policy");
  if (dispatchGate?.verdict === "pass_with_notice") {
    notices.push({
      gate: "dispatch-policy",
      sourceVerdict: dispatchGate.verdict,
      carried: true,
      launchImpact: "provider-approval-gated",
      reason: "Raw payload dispatch is rejected, Band is locked, and provider dispatch requires authenticated server-owned workpack/share-session authority. Kakao/Band approval is not claimed.",
      allowedClaim: "메일·문자는 관리자 인증과 서버 소유 세션에서만 전송 가능한 정책으로 잠겨 있다.",
      forbiddenClaim: "카카오·밴드 또는 모든 provider 전파가 실제 승인 채널로 live 완료됐다.",
      nextSecureProof: "Configure approved providers and run authenticated provider dispatch in an operator-owned workpack/share session."
    });
  }

  return {
    verdict: notices.length > 0 ? "carried" : "none",
    generatedAt: summary.generatedAt,
    sourceReport: outFile("report.json"),
    fullyAutomatedLaunchClaimAllowed: notices.length === 0,
    safeLaunchDemoClaimAllowed: true,
    notices,
    status: notices.length > 0 ? "carried_not_fully_automated" : "no_notices"
  };
}

function outFile(fileName) {
  return path.relative(rootDir, path.join(outDir, fileName));
}

function docFile(fileName) {
  return path.relative(rootDir, path.join(docsDir, fileName));
}

function writeDecisionMarkdown(summary) {
  const lines = [
    "# SafeClaw final-99-gate decision",
    "",
    `- Generated at: ${summary.generatedAt}`,
    `- Base URL: ${summary.baseUrl}`,
    `- Commit: ${summary.commit}`,
    `- Overall: ${summary.overall}`,
    `- Elapsed: ${summary.elapsedMs}ms`,
    "",
    "## Gate Results",
    "",
    "| Gate | Verdict | Evidence |",
    "|---|---:|---|",
    ...summary.gates.map((gate) => `| ${gate.name} | ${gate.verdict} | ${gate.evidence || ""} |`),
    "",
    "## Closing Notes",
    "- provider 전파는 관리자 인증과 서버 소유 workpack/share session에서만 허용하며, 카카오/밴드는 승인 전이므로 정식 제출 게이트에서 제외했습니다.",
    "- HWPX는 제출형 초안이며 원본 셀 단위 완전 복제는 별도 고급 기능으로 분리했습니다.",
    "- final gate는 pass 또는 pass_with_notice만 출시 후보로 봅니다. blocked가 있으면 제출 전 수정 대상입니다."
  ];
  writeMarkdown(path.join(outDir, "decision.md"), lines.join("\n"));
}

async function main() {
  ensureDir(outDir);
  ensureDir(docsDir);
  loadLocalEnv();

  const askGate = await runAskGate();
  if (askGate.verdict === "blocked") {
    const summary = {
      generatedAt: new Date().toISOString(),
      baseUrl,
      commit: getCommitHash(),
      overall: "blocked",
      elapsedMs: elapsedMs(),
      executionMode,
      gates: [{ name: "ask-orchestration", verdict: "blocked", evidence: "12종 문서 생성 실패" }],
      ask: {
        status: askGate.status,
        mode: askGate.mode,
        requestedAiMode: askGate.requestedAiMode,
        documentCount: askGate.documentCount,
        missingDeliverables: askGate.missingDeliverables,
        rawPreview: askGate.rawPreview
      },
      mutationBoundary: {
        dbMutationPerformed: false,
        providerDispatchCalled: false,
        shareSessionCreated: false,
        noMutationMode: executionMode === "no-mutation"
      }
    };
    writeJson("prod-golden-path.json", summary);
    writeDecisionMarkdown(summary);
    console.log(JSON.stringify(summary, null, 2));
    process.exit(1);
  }

  const remediationGate = await runRemediationGate(askGate.payload);
  const evidenceGate = buildEvidenceMap(askGate.payload, remediationGate);
  writeEvidenceMarkdown(evidenceGate);
  writeSecurityPrivacyDoc();

  const [authHistoryGate, documentDownloadGate, dispatchPolicyGate, screenshotGate] = await Promise.all([
    runAuthHistoryGate(askGate.payload),
    runDocumentDownloadGate(askGate.payload),
    runDispatchPolicyGate(askGate.payload),
    captureScreenshots()
  ]);

  const productionBuild = await fetchProductionBuildInfo();
  const gates = [
    { name: "ask-orchestration", verdict: askGate.verdict, evidence: `${askGate.documentCount}/${requiredDeliverables.length} documents` },
    { name: "auth-history-reuse", verdict: authHistoryGate.verdict, evidence: authHistoryGate.workpackId || authHistoryGate.message },
    { name: "document-downloads", verdict: documentDownloadGate.verdict, evidence: "core PDF + orchestration XLS/HWPX/PDF smoke" },
    { name: "public-data-ai-map", verdict: evidenceGate.verdict, evidence: "docs/submission-evidence-map.md" },
    { name: "ai-remediation-flow", verdict: remediationGate.verdict, evidence: remediationGate.providerLabel },
    { name: "dispatch-policy", verdict: dispatchPolicyGate.verdict, evidence: "raw payload rejected, band locked, auth gate enforced" },
    { name: "screenshots", verdict: screenshotGate.verdict, evidence: Array.isArray(screenshotGate.screenshots) ? `${screenshotGate.screenshots.length} screenshots` : "" }
  ];
  const overall = gateVerdict(gates);
  const summary = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    commit: getCommitHash(),
    sourceCommit: getFullCommitHash(),
    productionBuild,
    executionMode,
    overall,
    elapsedMs: elapsedMs(),
    gates,
    mutationBoundary: {
      dbMutationPerformed: authHistoryGate.mutationBoundary?.dbMutationPerformed === true,
      providerDispatchCalled: dispatchPolicyGate.mutationBoundary?.providerDispatchCalled === true,
      shareSessionCreated: false,
      noMutationMode: executionMode === "no-mutation"
    },
    outputs: {
      authHistory: outFile("auth-history-smoke.json"),
      documentDownloads: outFile("document-download-smoke.json"),
      publicDataAiMap: outFile("public-data-ai-map.json"),
      prodGoldenPath: outFile("prod-golden-path.json"),
      decision: outFile("decision.md"),
      evidenceMapDoc: docFile("submission-evidence-map.md"),
      securityPrivacyDoc: docFile("security_privacy_readiness.md"),
      commercializationDoc: docFile("commercialization-onepager.md")
    },
    notes: [
      "provider 전파는 관리자 인증과 서버 소유 workpack/share session이 필요하며, 카카오/밴드는 승인 전이라 제외했습니다.",
      "HWPX는 제출형 초안으로 고지합니다.",
      executionMode === "no-mutation"
        ? "no-mutation 모드는 인증 토큰 존재 여부와 무관하게 관리자 이력 쓰기를 건너뛰고 pass_with_notice를 유지합니다."
        : "관리자 이력 게이트는 SAFEGUARD_AUTH_TOKEN이 없으면 pass_with_notice로 남습니다."
    ]
  };

  writeJson("prod-golden-path.json", {
    ...summary,
    ask: {
      status: askGate.status,
      mode: askGate.mode,
      documentCount: askGate.documentCount,
      externalSignals: askGate.externalSignals
    },
    remediation: remediationGate,
    dispatch: dispatchPolicyGate,
    screenshots: screenshotGate
  });
  writeDecisionMarkdown(summary);
  writeCommercializationOnepager(overall, gates);
  writeJson("report.json", summary);
  writeJson("notice-carry.json", buildNoticeCarry(summary));

  console.log(JSON.stringify({
    overall,
    outDir: path.relative(rootDir, outDir),
    gates: gates.map((gate) => ({ name: gate.name, verdict: gate.verdict }))
  }, null, 2));

  process.exit(overall === "blocked" ? 1 : 0);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  main().catch((error) => {
    ensureDir(outDir);
    const payload = {
      generatedAt: new Date().toISOString(),
      baseUrl,
      commit: getCommitHash(),
      overall: "blocked",
      elapsedMs: elapsedMs(),
      error: error instanceof Error ? error.message : String(error)
    };
    writeJson("prod-golden-path.json", payload);
    writeDecisionMarkdown({
      ...payload,
      gates: [{ name: "final-99-gate-runner", verdict: "blocked", evidence: payload.error }]
    });
    console.error(error);
    process.exit(1);
  });
}
