#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const startedAt = Date.now();
const rootDir = process.cwd();
const baseUrl = process.env.SAFECLAW_RELEASE_BASE_URL || "https://www.safeclaw.kr";
const outDir = path.resolve(process.env.SAFECLAW_RELEASE_AUDIT_OUT_DIR || path.join(rootDir, "evaluation", "final-release-scale-audit"));

const existingFlowQuestion = "그린메탈 경기 안산 제조공장 옥외 용접 작업. 작업자 6명, 외국인 근로자 2명, 신규 작업자 1명, 우천 후 바닥 젖음과 화재감시자 필요. 오늘 위험성평가, TBM, 안전보건교육 기록을 만들어줘.";

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

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJson(fileName, payload) {
  fs.writeFileSync(path.join(outDir, fileName), `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function writeMarkdown(fileName, content) {
  fs.writeFileSync(path.join(outDir, fileName), `${content.trim()}\n`, "utf8");
}

function sourceText(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), "utf8");
}

function gate(name, ok, details) {
  return { name, verdict: ok ? "pass" : "blocked", details };
}

function overallVerdict(gates) {
  return gates.some((item) => item.verdict === "blocked") ? "blocked" : "pass";
}

async function fetchText(route, init) {
  const started = Date.now();
  const response = await fetch(`${baseUrl}${route}`, init);
  const text = await response.text();
  return {
    ok: response.ok,
    status: response.status,
    elapsedMs: Date.now() - started,
    text,
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
  return { ...response, parsed, rawPreview: response.text.slice(0, 400) };
}

async function runExistingWebFlow() {
  const response = await fetchJson("/api/ask", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ question: existingFlowQuestion }),
  });
  const deliverables = response.parsed?.deliverables || {};
  const missing = requiredDeliverables.filter((key) => typeof deliverables[key] !== "string" || deliverables[key].length < 20);
  const tbm = typeof deliverables.tbmBriefing === "string" ? deliverables.tbmBriefing : "";
  const risk = typeof deliverables.riskAssessmentDraft === "string" ? deliverables.riskAssessmentDraft : "";
  return gate("existing-web-api-ask", response.ok && missing.length === 0 && tbm.includes("TBM") && risk.includes("위험"), {
    status: response.status,
    elapsedMs: response.elapsedMs,
    missingDeliverables: missing,
    deliverableCount: requiredDeliverables.length - missing.length,
    scenario: response.parsed?.scenario || null,
    tbmPreview: tbm.slice(0, 240),
  });
}

async function runAiConnectionSurface() {
  const page = await fetchText("/settings/ai-connect", {
    headers: { "user-agent": "Mozilla/5.0 Chrome/126" },
  });
  const noAuthTokenList = await fetchJson("/api/mcp-tokens?limit=5000&cursor=bad", {
    headers: { "user-agent": "Mozilla/5.0 Chrome/126" },
  });
  const noAuthMcp = await fetchJson("/api/mcp/mcp", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "accept": "application/json, text/event-stream",
      "user-agent": "Mozilla/5.0 Chrome/126",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
  });

  return [
    gate("ai-connect-page", page.ok && page.text.includes("내 AI 연결") && page.text.includes("OpenClaw"), {
      status: page.status,
      elapsedMs: page.elapsedMs,
    }),
    gate("ai-token-api-auth-guard", noAuthTokenList.status === 401 && noAuthTokenList.parsed?.limit === 50 && noAuthTokenList.parsed?.nextCursor === null, {
      status: noAuthTokenList.status,
      limit: noAuthTokenList.parsed?.limit,
      nextCursor: noAuthTokenList.parsed?.nextCursor,
      message: noAuthTokenList.parsed?.message,
    }),
    gate("mcp-no-token-auth-guard", noAuthMcp.status === 401, {
      status: noAuthMcp.status,
      rawPreview: noAuthMcp.rawPreview,
    }),
  ];
}

function runScaleContractChecks() {
  const tokenService = sourceText("lib/mcp-token-service.ts");
  const tokenRoute = sourceText("app/api/mcp-tokens/route.ts");
  const aiPanel = sourceText("components/AiConnectPanel.tsx");
  const authCallback = sourceText("components/AuthCallbackClient.tsx");
  const docs = sourceText("docs/mcp-server.md");

  return [
    gate("tenant-scoped-token-insert", tokenService.includes("token_hash: hashToken") && tokenService.includes("site_id: input.siteId") && tokenService.includes("org_id: input.orgId"), {
      evidence: "lib/mcp-token-service.ts stores only hash + site/org scope",
    }),
    gate("bounded-token-list", tokenService.includes("DEFAULT_MCP_TOKEN_LIST_LIMIT = 25") && tokenService.includes("MAX_MCP_TOKEN_LIST_LIMIT = 50") && tokenRoute.includes("resolveMcpTokenListLimit"), {
      evidence: "token list limit constants and API usage present",
    }),
    gate("cursor-pagination-contract", tokenService.includes("parseMcpTokenListCursor") && tokenService.includes("UUID_PATTERN") && tokenRoute.includes("nextCursor") && aiPanel.includes("이전 토큰 더 보기"), {
      evidence: "opaque cursor helpers, API nextCursor, and UI load-more present",
    }),
    gate("active-token-cap", tokenService.includes("MAX_ACTIVE_MCP_TOKENS_PER_SITE = 50") && tokenRoute.includes("canIssueMoreMcpTokens") && tokenRoute.includes("status: 409"), {
      evidence: "site-level active token cap enforced before issuing plaintext token",
    }),
    gate("multi-provider-auth-return", authCallback.includes("resolveSafeNextPath") && authCallback.includes("auth.setSession") && authCallback.includes("exchangeCodeForSession") && aiPanel.includes("/login?next=/settings/ai-connect"), {
      evidence: "email hash callbacks and OAuth code callbacks return to AI connect safely",
    }),
    gate("operator-scale-docs", docs.includes("nextCursor") && docs.includes("활성 토큰 50개") && docs.includes("1만"), {
      evidence: "docs/mcp-server.md documents cursor paging, active cap, and index approval gate",
    }),
  ];
}

function renderReport(payload) {
  const gateRows = payload.gates
    .map((item) => `| ${item.name} | ${item.verdict} | ${JSON.stringify(item.details).replace(/\|/g, "\\|").slice(0, 220)} |`)
    .join("\n");

  return `
# SafeClaw Final Release Scale Audit

Generated: ${payload.generatedAt}

Base URL: ${payload.baseUrl}

Verdict: **${payload.verdict}**

## Coverage

- Existing web workflow: production /api/ask document generation.
- AI connection workflow: production AI connection page, token API auth guard, MCP auth guard.
- Scale contract: tenant-scoped hashed tokens, bounded cursor pagination, active-token cap, magic-link return path, operator docs.

## Gates

| Gate | Verdict | Details |
|------|---------|---------|
${gateRows}

## Remaining Manual Gates

- Supabase Auth dashboard Site URL/Redirect URL must be confirmed in production.
- DB index migration for 10,000-user operation still requires explicit approval before application.
`;
}

async function main() {
  ensureDir(outDir);
  const gates = [
    await runExistingWebFlow(),
    ...(await runAiConnectionSurface()),
    ...runScaleContractChecks(),
  ];
  const payload = {
    generatedAt: new Date().toISOString(),
    elapsedMs: Date.now() - startedAt,
    baseUrl,
    verdict: overallVerdict(gates),
    gates,
  };
  writeJson("final-release-scale-audit.json", payload);
  writeMarkdown("final-release-scale-audit.md", renderReport(payload));
  console.log(JSON.stringify({
    verdict: payload.verdict,
    gateCount: gates.length,
    blocked: gates.filter((item) => item.verdict === "blocked").map((item) => item.name),
    outDir,
  }, null, 2));
  if (payload.verdict !== "pass") process.exitCode = 1;
}

await main();
