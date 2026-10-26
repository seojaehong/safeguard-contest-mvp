#!/usr/bin/env node
// 운영 스모크 — 배포 후 · 주간(template) · 월간(full) 세 워크플로가 같이 쓴다.
// 판정 원칙(PR-20, 결정 18): 상태 라벨(status.summary·connector live)로 판정하지 않는다.
//   hard  = HTTP 200 · JSON · qualityContract(full: overall≠blocked, template: 설계상 차단 2항목 외 blocked 없음)
//           · 페이지 200 · (full) AI 본문 1건 이상 생존
//   leak  = 사용자 문서에 내부 코드 노출. 기본은 report(경고만), SMOKE_LEAK_GATE=enforce 에서 실패.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const SMOKE_USER_AGENT = "Mozilla/5.0 Chrome/126";
export const DEFAULT_BASE_URL = "https://www.safeclaw.kr";
export const DEFAULT_QUESTION = "안산 제조공장 용접 및 지게차 상하차 작업, 외국인 근로자 3명 포함 작업자 6명";
export const DEFAULT_PAGES = ["/", "/workspace", "/ask", "/knowledge", "/evidence", "/trust", "/login"];

// 값 전체가 내부 enum 이면 노출이다(부분 일치는 보지 않는다 — 「low」가 문장 속 영어일 수 있다).
const INTERNAL_ENUM_VALUE = /^(high|medium|low|planned|needsReview|fireExplosion|struckBy|electricShock)$/u;
// 값 안에 들어 있으면 노출이다(대소문자 무시).
const INTERNAL_SUBSTRINGS = [
  { rule: "riskAssessmentDraft", pattern: /riskAssessmentDraft/iu },
  { rule: "SIF:sif-", pattern: /SIF:sif-/iu },
  { rule: "sif-", pattern: /\bsif-(?:아카이브|archive)-/iu },
  { rule: "DB:", pattern: /\bDB:[a-z-]+-\d+/u },
  { rule: "패킷", pattern: /패킷/u },
  { rule: "fallback", pattern: /fallback/iu },
  { rule: "mock", pattern: /mock/iu }
];
// 사용자에게 보이는 본문만 본다. generationTrace·qualityContract·structured 는 기계용이라 제외한다
// (fallbackUsed 같은 키·값이 정상적으로 들어 있다).
export const USER_VISIBLE_ROOTS = ["answer", "practicalPoints", "deliverables"];

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function visitStringLeaves(value, currentPath, visit) {
  if (typeof value === "string") {
    visit(currentPath, value);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => visitStringLeaves(item, `${currentPath}[${index}]`, visit));
    return;
  }
  if (isRecord(value)) {
    // 키 이름(riskAssessmentDraft 등)은 보지 않는다. 값만 본다.
    for (const [key, child] of Object.entries(value)) visitStringLeaves(child, `${currentPath}.${key}`, visit);
  }
}

export function findInternalCodeLeaks(body) {
  const leaks = [];
  if (!isRecord(body)) return leaks;
  for (const root of USER_VISIBLE_ROOTS) {
    visitStringLeaves(body[root], root, (leafPath, raw) => {
      const value = raw.trim();
      if (INTERNAL_ENUM_VALUE.test(value)) {
        leaks.push({ path: leafPath, rule: "internal-enum", sample: value });
        return;
      }
      for (const { rule, pattern } of INTERNAL_SUBSTRINGS) {
        const match = pattern.exec(value);
        if (!match) continue;
        const start = Math.max(0, match.index - 20);
        leaks.push({ path: leafPath, rule, sample: value.slice(start, match.index + match[0].length + 20) });
        return;
      }
    });
  }
  return leaks;
}

export function summarizeAiSurvival(body) {
  const trace = isRecord(body) && isRecord(body.generationTrace) ? body.generationTrace : {};
  const perDocument = isRecord(trace.deliverables) && isRecord(trace.deliverables.modelPerDocument)
    ? trace.deliverables.modelPerDocument
    : {};
  const documents = Object.entries(perDocument).map(([key, item]) => ({
    key,
    survived: isRecord(item) && item.source === "provider" && item.fallbackUsed !== true,
    provider: isRecord(item) ? item.provider ?? null : null,
    model: isRecord(item) ? item.model ?? null : null
  }));
  const upstream = isRecord(trace.answer) && isRecord(trace.answer.upstream) ? trace.answer.upstream : {};
  return {
    traceId: typeof trace.traceId === "string" ? trace.traceId : null,
    askMode: typeof trace.askMode === "string" ? trace.askMode : null,
    answerUsedInFinal: upstream.usedInFinal === true,
    documentCount: documents.length,
    survivedDocuments: documents.filter((item) => item.survived).map((item) => item.key),
    fallbackDocuments: documents.filter((item) => !item.survived).map((item) => item.key)
  };
}

// template 은 외부 호출·AI 없이 고정 데이터로 답한다(lib/search.ts 「template fast path」).
// 그래서 실시간 근거(fallback)·고정 근거 계약(dbHarness) 두 항목은 설계상 늘 blocked 이고 overall 도 blocked 가 된다.
// template 판정은 이 두 항목을 뺀 나머지 항목 중 blocked 가 있으면 실패로 본다. full 은 overall 그대로 본다.
export const TEMPLATE_EXPECTED_BLOCKED_ITEMS = ["fallback", "dbHarness"];

export function evaluateQualityContract(body, mode) {
  const contract = isRecord(body) && isRecord(body.qualityContract) ? body.qualityContract : null;
  const overall = contract && typeof contract.overall === "string" ? contract.overall : "";
  if (!overall) return { name: "qualityContract.overall", gate: "hard", ok: false, detail: "missing" };
  if (mode !== "template") {
    return { name: "qualityContract.overall", gate: "hard", ok: overall !== "blocked", detail: overall };
  }
  const items = Array.isArray(contract.items) ? contract.items.filter(isRecord) : [];
  const blocked = items.filter((item) => item.status === "blocked").map((item) => String(item.key));
  const expected = blocked.filter((key) => TEMPLATE_EXPECTED_BLOCKED_ITEMS.includes(key));
  const unexpected = blocked.filter((key) => !TEMPLATE_EXPECTED_BLOCKED_ITEMS.includes(key));
  // items 가 없는데 overall 이 blocked 면 무엇이 막혔는지 알 수 없으므로 실패로 둔다.
  const ok = overall !== "blocked" || (items.length > 0 && unexpected.length === 0);
  return {
    name: "qualityContract.overall",
    gate: "hard",
    ok,
    detail: `${overall} (template 예상 차단: ${expected.join(",") || "없음"} / 그 밖 차단: ${unexpected.join(",") || "없음"})`
  };
}

/**
 * /api/ask 응답 하나를 판정한다. 네트워크와 분리된 순수 함수다(tests/prod-ask-smoke.test.ts).
 * @param {{ httpStatus: number, body: unknown, mode: "template" | "full", leakGate?: "report" | "enforce" }} input
 */
export function evaluateAskResponse(input) {
  const leakGate = input.leakGate === "enforce" ? "enforce" : "report";
  const body = input.body;
  const checks = [];
  checks.push({ name: "ask.http_status", gate: "hard", ok: input.httpStatus === 200, detail: String(input.httpStatus) });
  checks.push({ name: "ask.json", gate: "hard", ok: isRecord(body), detail: isRecord(body) ? "parsed" : "not a JSON object" });

  checks.push(evaluateQualityContract(body, input.mode));

  const leaks = findInternalCodeLeaks(body);
  checks.push({
    name: "deliverables.internal_codes",
    gate: leakGate === "enforce" ? "hard" : "report",
    ok: leaks.length === 0,
    detail: `${leaks.length}건`
  });

  const aiSurvival = summarizeAiSurvival(body);
  if (input.mode === "full") {
    checks.push({
      name: "generationTrace.ai_survival",
      gate: "hard",
      ok: aiSurvival.survivedDocuments.length > 0,
      detail: `${aiSurvival.survivedDocuments.length}/${aiSurvival.documentCount} 문서 AI 생존, 답변 AI=${aiSurvival.answerUsedInFinal}`
    });
  }

  const status = isRecord(body) && isRecord(body.status) ? body.status : {};
  const failed = checks.filter((check) => check.gate === "hard" && !check.ok);
  return {
    mode: input.mode,
    leakGate,
    checks,
    leaks,
    aiSurvival,
    // 참고용. 판정에 쓰지 않는다(CI-05 — 라벨만 보고 통과·실패를 정하던 것을 없앴다).
    statusLabels: { summary: status.summary ?? null, ai: status.ai ?? null, lawgo: status.lawgo ?? null },
    ok: failed.length === 0
  };
}

function readEnv(name, fallback) {
  const value = process.env[name]?.trim();
  return value ? value : fallback;
}

function annotate(level, message) {
  if (process.env.GITHUB_ACTIONS === "true") console.log(`::${level}::${message.replace(/\r?\n/gu, " ")}`);
  else console.log(`[${level}] ${message}`);
}

async function fetchWithTimeout(url, init, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      headers: { "User-Agent": SMOKE_USER_AGENT, ...(init?.headers ?? {}) },
      signal: controller.signal,
      redirect: "follow"
    });
  } finally {
    clearTimeout(timer);
  }
}

async function waitForDeployment(baseUrl, expectedSha, waitSeconds) {
  const deadline = Date.now() + waitSeconds * 1000;
  let last = null;
  while (Date.now() < deadline) {
    try {
      const response = await fetchWithTimeout(`${baseUrl}/api/build-info`, { cache: "no-store" }, 15_000);
      const info = await response.json().catch(() => null);
      last = isRecord(info) ? info.commitSha ?? null : null;
      if (last === expectedSha) return { ok: true, commitSha: last };
    } catch (error) {
      last = `error: ${error instanceof Error ? error.message : String(error)}`;
    }
    console.log(`build-info commitSha=${last} (기다리는 값 ${expectedSha})`);
    await new Promise((resolve) => setTimeout(resolve, 20_000));
  }
  return { ok: false, commitSha: last };
}

async function probePages(baseUrl, pages) {
  const results = [];
  for (const page of pages) {
    let status = 0;
    try {
      const response = await fetchWithTimeout(`${baseUrl}${page}`, {}, 60_000);
      status = response.status;
      await response.arrayBuffer();
    } catch {
      status = 0;
    }
    results.push({ name: `page ${page}`, gate: "hard", ok: status === 200, detail: String(status) });
  }
  return results;
}

async function callAsk(baseUrl, mode, question, timeoutMs) {
  try {
    const response = await fetchWithTimeout(`${baseUrl}/api/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ question, aiMode: mode })
    }, timeoutMs);
    const text = await response.text();
    let body = null;
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
    return { httpStatus: response.status, body, text };
  } catch (error) {
    return { httpStatus: 0, body: null, text: `request failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

function renderSummary(report) {
  const lines = [`## SafeClaw 운영 스모크 (${report.mode ?? "pages"})`, "", `대상: ${report.baseUrl}`, ""];
  lines.push("| 점검 | 구분 | 결과 | 값 |", "|---|---|---|---|");
  for (const check of report.checks) {
    const result = check.ok ? "PASS" : check.gate === "hard" ? "FAIL" : "WARN";
    lines.push(`| ${check.name} | ${check.gate} | ${result} | ${String(check.detail).replace(/\|/gu, "/")} |`);
  }
  if (report.ask) {
    const survival = report.ask.aiSurvival;
    lines.push("", `AI 생존: ${survival.survivedDocuments.length}/${survival.documentCount} 문서 · 답변 AI 사용=${survival.answerUsedInFinal} · traceId=${survival.traceId}`);
    lines.push(`상태 라벨(참고, 판정 미사용): summary=${report.ask.statusLabels.summary} ai=${report.ask.statusLabels.ai}`);
    if (report.ask.leaks.length > 0) {
      lines.push("", `### 내부 코드 노출 ${report.ask.leaks.length}건 (leak gate=${report.ask.leakGate})`, "", "| 위치 | 규칙 | 값 |", "|---|---|---|");
      for (const leak of report.ask.leaks.slice(0, 50)) {
        lines.push(`| ${leak.path} | ${leak.rule} | ${leak.sample.replace(/\|/gu, "/").replace(/\r?\n/gu, " ")} |`);
      }
      if (report.ask.leaks.length > 50) lines.push(`| … | | ${report.ask.leaks.length - 50}건 더 |`);
    }
  }
  return `${lines.join("\n")}\n`;
}

export async function runSmoke() {
  const baseUrl = readEnv("SMOKE_BASE_URL", DEFAULT_BASE_URL).replace(/\/+$/u, "");
  const mode = readEnv("SMOKE_ASK_MODE", "template");
  if (!["template", "full", "none"].includes(mode)) throw new Error(`SMOKE_ASK_MODE must be template|full|none: ${mode}`);
  const leakGate = readEnv("SMOKE_LEAK_GATE", "report");
  if (!["report", "enforce"].includes(leakGate)) throw new Error(`SMOKE_LEAK_GATE must be report|enforce: ${leakGate}`);
  const pagesEnv = readEnv("SMOKE_PAGES", "");
  const pages = pagesEnv === "none" ? [] : pagesEnv ? pagesEnv.split(",").map((item) => item.trim()).filter(Boolean) : DEFAULT_PAGES;
  const outputDir = readEnv("SMOKE_OUTPUT_DIR", "smoke-output");
  const expectedSha = readEnv("SMOKE_EXPECT_SHA", "").toLowerCase();
  const waitSeconds = Number(readEnv("SMOKE_DEPLOY_WAIT_SECONDS", "900"));
  const askTimeoutMs = Number(readEnv("SMOKE_ASK_TIMEOUT_MS", mode === "full" ? "280000" : "120000"));
  const question = readEnv("SMOKE_QUESTION", DEFAULT_QUESTION);

  fs.mkdirSync(outputDir, { recursive: true });
  const report = { baseUrl, mode: mode === "none" ? null : mode, startedAt: new Date().toISOString(), checks: [], ask: null };

  if (expectedSha) {
    const deployment = await waitForDeployment(baseUrl, expectedSha, waitSeconds);
    report.checks.push({
      name: "build-info.commitSha",
      gate: "hard",
      ok: deployment.ok,
      detail: deployment.ok ? expectedSha : `${waitSeconds}s 안에 ${expectedSha} 미도달 (마지막 ${deployment.commitSha})`
    });
  }

  const deployReady = report.checks.every((check) => check.ok);
  if (deployReady) {
    report.checks.push(...await probePages(baseUrl, pages));
    if (mode !== "none") {
      const response = await callAsk(baseUrl, mode, question, askTimeoutMs);
      fs.writeFileSync(path.join(outputDir, `ask-${mode}-response.json`), response.body ? JSON.stringify(response.body, null, 2) : response.text, "utf8");
      const evaluation = evaluateAskResponse({ httpStatus: response.httpStatus, body: response.body, mode, leakGate });
      report.ask = evaluation;
      report.checks.push(...evaluation.checks);
    }
  }

  report.finishedAt = new Date().toISOString();
  report.ok = report.checks.every((check) => check.ok || check.gate !== "hard");
  fs.writeFileSync(path.join(outputDir, "smoke-report.json"), JSON.stringify(report, null, 2), "utf8");

  const summary = renderSummary(report);
  console.log(summary);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary, "utf8");
  for (const check of report.checks) {
    if (check.ok) continue;
    annotate(check.gate === "hard" ? "error" : "warning", `${check.name}: ${check.detail}`);
  }
  if (report.ask?.leaks.length) {
    const rules = [...new Set(report.ask.leaks.map((leak) => leak.rule))].join(", ");
    annotate(leakGate === "enforce" ? "error" : "warning", `사용자 문서 내부 코드 노출 ${report.ask.leaks.length}건 (${rules}) — leak gate=${leakGate}`);
  }
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runSmoke()
    .then((report) => {
      process.exitCode = report.ok ? 0 : 1;
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
