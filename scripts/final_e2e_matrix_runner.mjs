#!/usr/bin/env node
import childProcess from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const outDir = path.resolve(process.env.SAFECLAW_FINAL_MATRIX_OUT_DIR || path.join(process.cwd(), "evaluation", "final-e2e-matrix"));
const baseUrl = (process.env.SAFEGUARD_BASE_URL || "https://safeguard-contest-mvp.vercel.app").replace(/\/+$/g, "");
const localPort = process.env.SAFECLAW_FINAL_LOCAL_PORT || "3011";
const localBaseUrl = (process.env.SAFECLAW_FINAL_LOCAL_BASE_URL || `http://127.0.0.1:${localPort}`).replace(/\/+$/g, "");
const runLocalUi = process.env.SAFECLAW_FINAL_SKIP_UI_LOCAL !== "1";
const commandTimeoutMs = Number.parseInt(process.env.SAFECLAW_FINAL_COMMAND_TIMEOUT_MS || "600000", 10);
const serverTimeoutMs = Number.parseInt(process.env.SAFECLAW_FINAL_SERVER_TIMEOUT_MS || "90000", 10);

const STATUS = {
  pass: "pass",
  notice: "notice",
  blocked: "blocked"
};

function debug(message) {
  if (process.env.SAFECLAW_FINAL_DEBUG === "1") {
    console.error(`[final-e2e] ${message}`);
  }
}

const question = [
  "세이프건설 서울 성수동 근린생활시설 외벽 도장 작업.",
  "이동식 비계 사용, 작업자 5명, 신규 투입자 1명, 오후 강풍 예보.",
  "위험성평가, TBM, 안전교육, 다운로드 문서 확인까지 검증해줘."
].join(" ");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function clearNextCacheForDev() {
  if (process.env.SAFECLAW_FINAL_CLEAR_NEXT_CACHE !== "1") return;
  const nextDir = path.resolve(process.cwd(), ".next");
  if (!nextDir.startsWith(process.cwd())) {
    throw new Error(`Refusing to remove .next outside cwd: ${nextDir}`);
  }
  fs.rmSync(nextDir, { recursive: true, force: true });
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    return {
      parseError: error instanceof Error ? error.message : String(error)
    };
  }
}

function writeJson(fileName, payload) {
  fs.writeFileSync(path.join(outDir, fileName), `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function toStatus(value) {
  if (value === "pass") return STATUS.pass;
  if (value === "pass_with_notice" || value === "notice") return STATUS.notice;
  return STATUS.blocked;
}

function aggregateStatus(items) {
  if (items.some((item) => item.status === STATUS.blocked)) return STATUS.blocked;
  if (items.some((item) => item.status === STATUS.notice)) return STATUS.notice;
  return STATUS.pass;
}

function redactEnv(env) {
  const safeKeys = [
    "SAFEGUARD_BASE_URL",
    "SAFECLAW_MATRIX_LIVE",
    "SAFECLAW_MATRIX_LIVE_COUNT",
    "SAFECLAW_MATRIX_OUT_DIR",
    "SAFEGUARD_SUBMISSION_OUT_DIR",
    "BASE_URL",
    "OUTPUT_PATH",
    "SAFEGUARD_OUT_DIR",
    "SAFEGUARD_RUN_LIVE_DISPATCH"
  ];
  return Object.fromEntries(safeKeys.filter((key) => env[key]).map((key) => [key, env[key]]));
}

function runCommand(name, command, args, envUpdates = {}) {
  const startedAt = Date.now();
  const env = { ...process.env, ...envUpdates };
  try {
    const result = childProcess.spawnSync(command, args, {
      cwd: process.cwd(),
      env,
      encoding: "utf8",
      timeout: commandTimeoutMs,
      windowsHide: true
    });
    return {
      name,
      command: [command, ...args].join(" "),
      env: redactEnv(env),
      status: result.status === 0 ? STATUS.pass : STATUS.blocked,
      exitCode: result.status,
      signal: result.signal,
      timedOut: Boolean(result.error && result.error.message.includes("ETIMEDOUT")),
      elapsedMs: Date.now() - startedAt,
      stdout: String(result.stdout || "").slice(-4000),
      stderr: String(result.stderr || "").slice(-4000),
      error: result.error ? result.error.message : ""
    };
  } catch (error) {
    return {
      name,
      command: [command, ...args].join(" "),
      env: redactEnv(env),
      status: STATUS.blocked,
      exitCode: null,
      signal: null,
      timedOut: false,
      elapsedMs: Date.now() - startedAt,
      stdout: "",
      stderr: "",
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

async function fetchText(route, init = {}) {
  const startedAt = Date.now();
  try {
    const response = await fetch(`${baseUrl}${route}`, init);
    const text = await response.text();
    return {
      ok: response.ok,
      statusCode: response.status,
      elapsedMs: Date.now() - startedAt,
      contentType: response.headers.get("content-type") || "",
      textPreview: text.slice(0, 1200),
      textLength: text.length,
      containsRiskAssessmentTitle: text.includes("위험성평가표"),
      containsSignatureTerm: text.includes("서명"),
      containsHtmlDocument: /<!doctype html|<html/i.test(text)
    };
  } catch (error) {
    return {
      ok: false,
      statusCode: 0,
      elapsedMs: Date.now() - startedAt,
      contentType: "",
      textPreview: "",
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

async function fetchBinary(route, init = {}) {
  const startedAt = Date.now();
  try {
    const response = await fetch(`${baseUrl}${route}`, init);
    const buffer = Buffer.from(await response.arrayBuffer());
    return {
      ok: response.ok,
      statusCode: response.status,
      elapsedMs: Date.now() - startedAt,
      contentType: response.headers.get("content-type") || "",
      byteLength: buffer.length,
      startsWithPdfMagic: buffer.subarray(0, 5).toString("ascii") === "%PDF-"
    };
  } catch (error) {
    return {
      ok: false,
      statusCode: 0,
      elapsedMs: Date.now() - startedAt,
      contentType: "",
      byteLength: 0,
      startsWithPdfMagic: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

async function runRouteChecks() {
  const htmlRoutes = ["/", "/ask", "/documents", "/dispatch", "/workspace"];
  const htmlChecks = [];
  for (const route of htmlRoutes) {
    const result = await fetchText(route);
    htmlChecks.push({
      route,
      expected: "HTML route responds",
      status: result.ok && result.contentType.includes("text/html") ? STATUS.pass : STATUS.blocked,
      result
    });
  }

  const apiChecks = [];
  const statusResult = await fetchText("/api/safety-reference/status");
  apiChecks.push({
    route: "/api/safety-reference/status",
    expected: "reference status API responds",
    status: statusResult.statusCode === 200 ? STATUS.pass : statusResult.statusCode === 503 ? STATUS.notice : STATUS.blocked,
    result: statusResult
  });

  const weatherResult = await fetchText(`/api/weather?question=${encodeURIComponent(question)}`);
  apiChecks.push({
    route: "/api/weather",
    expected: "weather API responds for scenario context",
    status: weatherResult.ok ? STATUS.pass : STATUS.notice,
    result: weatherResult
  });

  const pdfResult = await fetchText("/api/export/pdf", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      title: "위험성평가표",
      scenario: {
        companyName: "SafeClaw 최종검증",
        siteName: "성수동 현장",
        workSummary: "외벽 도장",
        workerCount: 5,
        weatherNote: "강풍 예보"
      },
      riskLevel: "현장 확인",
      topRisk: "비계 추락 및 강풍",
      rows: [
        { document: "위험성평가표", section: "작업 정보", item: "작업", content: "외벽 도장" },
        { document: "위험성평가표", section: "위험요인", item: "추락", content: "이동식 비계 사용 전 점검" },
        { document: "위험성평가표", section: "확인", item: "서명", content: "작업 전 확인자 서명" }
      ]
    })
  });
  const pdfLooksPrintable = pdfResult.ok
    && pdfResult.contentType.includes("text/html")
    && (pdfResult.containsRiskAssessmentTitle || pdfResult.containsSignatureTerm || pdfResult.containsHtmlDocument);
  apiChecks.push({
    route: "/api/export/pdf",
    expected: "PDF print-ready export source responds as HTML",
    status: pdfLooksPrintable ? STATUS.pass : STATUS.blocked,
    result: pdfResult
  });

  const binaryPdfResult = await fetchBinary("/api/export/pdf?format=pdf", {
    method: "POST",
    headers: {
      accept: "application/pdf",
      "content-type": "application/json"
    },
    body: JSON.stringify({
      title: "위험성평가표",
      scenario: {
        companyName: "SafeClaw 최종검증",
        siteName: "성수동 현장",
        workSummary: "외벽 도장",
        workerCount: 5,
        weatherNote: "강풍 예보"
      },
      riskLevel: "현장 확인",
      topRisk: "비계 추락 및 강풍",
      rows: [
        { document: "위험성평가표", section: "작업 정보", item: "작업", content: "외벽 도장" },
        { document: "위험성평가표", section: "위험요인", item: "추락", content: "이동식 비계 사용 전 점검" },
        { document: "위험성평가표", section: "확인", item: "서명", content: "작업 전 확인자 서명" }
      ]
    })
  });
  apiChecks.push({
    route: "/api/export/pdf?format=pdf",
    expected: "binary PDF export responds with PDF bytes",
    status: binaryPdfResult.ok
      && binaryPdfResult.contentType.includes("application/pdf")
      && binaryPdfResult.startsWithPdfMagic
      && binaryPdfResult.byteLength > 1000
      ? STATUS.pass
      : STATUS.blocked,
    result: binaryPdfResult
  });

  const dispatchLogResult = await fetchText("/api/dispatch-logs");
  apiChecks.push({
    route: "/api/dispatch-logs",
    expected: "dispatch log route is protected or returns archive",
    status: dispatchLogResult.statusCode === 401 || dispatchLogResult.ok
      ? STATUS.pass
      : dispatchLogResult.statusCode === 405
        ? STATUS.notice
        : STATUS.blocked,
    result: dispatchLogResult
  });

  const workpackArchiveResult = await fetchText("/api/workpacks");
  apiChecks.push({
    route: "/api/workpacks",
    expected: "workpack archive route is protected or returns archive",
    status: workpackArchiveResult.statusCode === 401 || workpackArchiveResult.ok
      ? STATUS.pass
      : workpackArchiveResult.statusCode === 405
        ? STATUS.notice
        : STATUS.blocked,
    result: workpackArchiveResult
  });

  return {
    status: aggregateStatus([...htmlChecks, ...apiChecks]),
    htmlChecks,
    apiChecks
  };
}

async function isReachable(url) {
  try {
    const response = await fetch(url, { method: "GET" });
    return response.status > 0;
  } catch {
    return false;
  }
}

async function waitForServer(url, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await isReachable(url)) return true;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return false;
}

function stopProcessTree(child) {
  if (!child.pid) return;
  try {
    childProcess.execFileSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
      stdio: "ignore",
      windowsHide: true
    });
  } catch {
    child.kill();
  }
}

function spawnNpmDevServer() {
  return childProcess.spawn(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", "npm.cmd", "run", "dev", "--", "--hostname", "127.0.0.1", "--port", localPort], {
    cwd: process.cwd(),
    env: process.env,
    stdio: "ignore",
    windowsHide: true
  });
}

async function runLocalUiSmoke() {
  if (!runLocalUi) {
    return {
      status: STATUS.notice,
      message: "SAFECLAW_FINAL_SKIP_UI_LOCAL=1 설정으로 로컬 UI 회귀 스모크를 건너뛰었습니다.",
      command: null,
      reportPath: null
    };
  }

  let startedServer = false;
  let server = null;
  const alreadyRunning = await isReachable(localBaseUrl);
  if (!alreadyRunning) {
    clearNextCacheForDev();
    server = spawnNpmDevServer();
    startedServer = true;
  }

  try {
    const ready = alreadyRunning || await waitForServer(localBaseUrl, serverTimeoutMs);
    if (!ready) {
      return {
        status: STATUS.blocked,
        message: "로컬 Next.js 서버가 제한 시간 안에 준비되지 않았습니다.",
        startedServer,
        reportPath: null
      };
    }

    const outputPath = path.join(outDir, "local-ui-regression-smoke.json");
    const commandResult = runCommand("local-ui-regression", process.execPath, ["./scripts/local_ui_regression_smoke.mjs"], {
      BASE_URL: localBaseUrl,
      OUTPUT_PATH: outputPath
    });
    const report = readJsonIfExists(outputPath);
    const status = commandResult.status === STATUS.pass
      && report?.generated === true
      && report?.sheetsTsvHasRows === true
      && report?.evidenceLinksValid === true
      ? STATUS.pass
      : STATUS.blocked;
    return {
      status,
      startedServer,
      baseUrl: localBaseUrl,
      command: commandResult,
      reportPath: path.relative(process.cwd(), outputPath),
      report
    };
  } finally {
    if (startedServer && server) stopProcessTree(server);
  }
}

function summarizeQualityMatrix(commandResult) {
  const reportPath = path.join(outDir, "quality-matrix", "report.json");
  const report = readJsonIfExists(reportPath);
  const status = commandResult.status === STATUS.pass && report && report.fail === 0 ? STATUS.pass : STATUS.blocked;
  return {
    status,
    command: commandResult,
    reportPath: path.relative(process.cwd(), reportPath),
    report
  };
}

function summarizeSubmission(commandResult) {
  const summaryPath = path.join(outDir, "submission-readiness", "submission-readiness-summary.json");
  const formatsPath = path.join(outDir, "submission-readiness", "document-format-verification.json");
  const dispatchPath = path.join(outDir, "submission-readiness", "prod-dispatch-smoke.json");
  const summary = readJsonIfExists(summaryPath);
  const formats = readJsonIfExists(formatsPath);
  const dispatch = readJsonIfExists(dispatchPath);
  const summaryStatus = summary?.overall ? toStatus(summary.overall) : commandResult.status;
  return {
    status: summaryStatus,
    command: commandResult,
    reportPath: path.relative(process.cwd(), summaryPath),
    summary,
    formatReportPath: path.relative(process.cwd(), formatsPath),
    formats,
    dispatchReportPath: path.relative(process.cwd(), dispatchPath),
    dispatch
  };
}

function buildGate(name, status, coverage, details = {}) {
  return { name, status, coverage, ...details };
}

function findRouteStatus(routeChecks, route) {
  const allChecks = [...routeChecks.htmlChecks, ...routeChecks.apiChecks];
  return allChecks.find((item) => item.route === route)?.status || STATUS.blocked;
}

function summarizeFormatStatus(submission, routeChecks) {
  const formatStatus = toStatus(submission.formats?.verdict || "");
  const pdfRouteStatus = findRouteStatus(routeChecks, "/api/export/pdf");
  return aggregateStatus([
    { status: formatStatus },
    { status: pdfRouteStatus }
  ]);
}

function summarizeDispatchStatus(submission, routeChecks) {
  const dispatchStatus = toStatus(submission.dispatch?.verdict || "");
  const logRouteStatus = findRouteStatus(routeChecks, "/api/dispatch-logs");
  const workpackRouteStatus = findRouteStatus(routeChecks, "/api/workpacks");
  const storageGate = Array.isArray(submission.summary?.gates)
    ? submission.summary.gates.find((item) => item.name === "storage")
    : null;
  const storageReason = [
    storageGate?.reason,
    storageGate?.message,
    storageGate?.error,
    storageGate?.detail
  ].filter(Boolean).join(" ");
  const storageBlockedByMissingToken = storageGate?.verdict === "blocked"
    && /SAFEGUARD_AUTH_TOKEN|auth token|인증 토큰|로그인/i.test(storageReason);
  const storageStatus = storageGate?.verdict === "blocked"
    ? storageBlockedByMissingToken ? STATUS.notice : STATUS.blocked
    : STATUS.pass;
  return aggregateStatus([
    { status: dispatchStatus },
    { status: logRouteStatus },
    { status: workpackRouteStatus },
    { status: storageStatus }
  ]);
}

function failedRouteReasons(routeChecks) {
  return [...routeChecks.htmlChecks, ...routeChecks.apiChecks]
    .filter((item) => item.status === STATUS.blocked)
    .map((item) => `${item.route} returned ${item.result.statusCode || "no response"}`);
}

function qualityFailureReasons(qualityMatrix) {
  const samples = Array.isArray(qualityMatrix.report?.failureSamples) ? qualityMatrix.report.failureSamples : [];
  return samples.flatMap((sample) => (
    Array.isArray(sample.failedChecks)
      ? sample.failedChecks.map((check) => `${sample.id}: ${check.name} ${check.message || ""}`.trim())
      : []
  ));
}

function buildMarkdown(report) {
  const gateRows = report.gates.map((gate) => `| ${gate.name} | ${gate.status} | ${gate.coverage} |`).join("\n");
  const blockerRows = report.blockers.length
    ? report.blockers.map((item) => `| ${item.gate} | ${item.reason} |`).join("\n")
    : "| 없음 | 현재 래퍼 기준 blocker 없음 |";
  const noticeRows = report.notices.length
    ? report.notices.map((item) => `| ${item.gate} | ${item.reason} |`).join("\n")
    : "| 없음 | 현재 래퍼 기준 notice 없음 |";

  return [
    "# SafeClaw Final E2E Matrix",
    "",
    `- 생성시각: ${report.generatedAt}`,
    `- 대상 URL: ${report.baseUrl}`,
    `- 전체 판정: ${report.overall}`,
    "",
    "## 게이트",
    "",
    "| Gate | 판정 | 커버리지 |",
    "| --- | --- | --- |",
    gateRows,
    "",
    "## Blocker",
    "",
    "| Gate | 사유 |",
    "| --- | --- |",
    blockerRows,
    "",
    "## Notice",
    "",
    "| Gate | 사유 |",
    "| --- | --- |",
    noticeRows,
    "",
    "## 산출물",
    "",
    "- `report.json`: 최종 기계 판독용 매트릭스",
    "- `quality-matrix/report.json`: 문서 루브릭 및 입력 반영 매트릭스",
    "- `submission-readiness/submission-readiness-summary.json`: 제출 준비도, 다운로드/export, 전파 상태",
    "- `local-ui-regression-smoke.json`: 로컬 UI 주요 흐름 회귀 결과",
    "",
    "## 재실행",
    "",
    "```powershell",
    "npm.cmd run smoke:final-e2e-matrix",
    "```",
    ""
  ].join("\n");
}

ensureDir(outDir);

const startedAt = Date.now();
const useLocalPrimary = process.env.SAFECLAW_FINAL_USE_LOCAL_PRIMARY === "1" || baseUrl === localBaseUrl;
let primaryServer = null;
let primaryServerStarted = false;

debug(`start baseUrl=${baseUrl} localBaseUrl=${localBaseUrl} useLocalPrimary=${useLocalPrimary}`);
if (useLocalPrimary && !(await isReachable(baseUrl))) {
  debug("starting local primary server");
  debug("clearing .next cache");
  clearNextCacheForDev();
  debug("spawning dev server");
  primaryServer = spawnNpmDevServer();
  debug(`spawned dev server pid=${primaryServer.pid || "unknown"}`);
  primaryServerStarted = true;
  const ready = await waitForServer(baseUrl, serverTimeoutMs);
  if (!ready) {
    if (primaryServer) stopProcessTree(primaryServer);
    throw new Error(`Local primary server did not become ready: ${baseUrl}`);
  }
}

debug("running route checks");
const routeChecks = await runRouteChecks();

const qualityCommand = runCommand("safeclaw-quality-matrix", process.execPath, ["./scripts/safeclaw_quality_matrix_runner.mjs"], {
  SAFECLAW_MATRIX_OUT_DIR: path.join(outDir, "quality-matrix"),
  SAFECLAW_MATRIX_LIVE: "1",
  SAFECLAW_MATRIX_LIVE_COUNT: "3",
  SAFECLAW_MATRIX_TIMEOUT_MS: process.env.SAFECLAW_MATRIX_TIMEOUT_MS || "70000",
  SAFECLAW_MATRIX_BASE_URL: baseUrl
});
debug(`quality command status=${qualityCommand.status}`);
const qualityMatrix = summarizeQualityMatrix(qualityCommand);

const submissionCommand = runCommand("submission-readiness", process.execPath, ["./scripts/submission_readiness_smoke.mjs"], {
  SAFEGUARD_BASE_URL: baseUrl,
  SAFEGUARD_SUBMISSION_OUT_DIR: path.join(outDir, "submission-readiness"),
  SAFEGUARD_RUN_LIVE_DISPATCH: process.env.SAFEGUARD_RUN_LIVE_DISPATCH || "0"
});
debug(`submission command status=${submissionCommand.status}`);
const submission = summarizeSubmission(submissionCommand);

const localUi = await runLocalUiSmoke();
debug(`local ui status=${localUi.status}`);

const gates = [
  buildGate("api-status", routeChecks.status, "주요 HTML route, safety-reference status, weather, PDF export source, archive auth gates", { routeChecks }),
  buildGate("ask-generation", qualityMatrix.status, "/api/ask live sample 및 deterministic matrix 문서 생성", {
    reportPath: qualityMatrix.reportPath
  }),
  buildGate("document-rubric", qualityMatrix.status, "위험성평가/TBM/교육/사진증빙/외국인 안내 등 문서별 필수 문구 반영", {
    reportPath: qualityMatrix.reportPath
  }),
  buildGate("download-export", summarizeFormatStatus(submission, routeChecks), "PDF/HWPX/XLS/ALL_XLS 다운로드 스모크 및 /api/export/pdf HTML source", {
    reportPath: submission.formatReportPath
  }),
  buildGate("dispatch-logs", summarizeDispatchStatus(submission, routeChecks), "전파 실행 조건, dispatch workflow, workpack archive, dispatch log 저장 게이트", {
    reportPath: submission.dispatchReportPath
  }),
  buildGate("main-routes", localUi.status === STATUS.pass && routeChecks.status !== STATUS.blocked ? STATUS.pass : localUi.status, "홈 생성 플로우, Sheets TSV, 근거 링크, 주요 route 응답", {
    reportPath: localUi.reportPath
  })
];

const blockers = gates
  .filter((gate) => gate.status === STATUS.blocked)
  .map((gate) => ({
    gate: gate.name,
    reason: gate.name === "api-status"
      ? failedRouteReasons(routeChecks).join("; ") || "API route check failed."
      : gate.name === "ask-generation" || gate.name === "document-rubric"
        ? qualityFailureReasons(qualityMatrix).join("; ") || "quality matrix smoke failed."
        : gate.name === "dispatch-logs" && submission.summary?.gates?.some((item) => item.name === "storage" && item.verdict === "blocked")
          ? "저장 API live gate는 인증 토큰이 없으면 notice로 기록합니다. 전파/로그 route 자체는 보호 상태까지 확인했습니다."
          : `${gate.coverage} 게이트가 통과하지 못했습니다. 세부 JSON을 확인하세요.`
  }));

const notices = gates
  .filter((gate) => gate.status === STATUS.notice)
  .map((gate) => ({
    gate: gate.name,
    reason: `${gate.coverage} 게이트가 조건부 통과 또는 설정 미완료 상태입니다.`
  }));

const report = {
  generatedAt: new Date().toISOString(),
  baseUrl,
  localBaseUrl,
  elapsedMs: Date.now() - startedAt,
  overall: aggregateStatus(gates),
  gates,
  blockers,
  notices,
  artifacts: {
    report: path.relative(process.cwd(), path.join(outDir, "report.json")),
    summary: path.relative(process.cwd(), path.join(outDir, "summary.md")),
    qualityMatrix: qualityMatrix.reportPath,
    submissionReadiness: submission.reportPath,
    localUi: localUi.reportPath
  },
  commandResults: {
    qualityMatrix: qualityCommand,
    submission: submissionCommand,
    localUi: localUi.command || null
  }
};

writeJson("report.json", report);
fs.writeFileSync(path.join(outDir, "summary.md"), buildMarkdown(report), "utf8");

if (primaryServerStarted && primaryServer) stopProcessTree(primaryServer);

console.log(JSON.stringify({
  overall: report.overall,
  outDir: path.relative(process.cwd(), outDir),
  gates: gates.map((item) => ({ name: item.name, status: item.status }))
}, null, 2));

process.exit(report.overall === STATUS.blocked ? 1 : 0);
