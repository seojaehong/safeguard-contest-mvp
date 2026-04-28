#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const baseUrl = process.env.SAFETYGUARD_BASE_URL || "http://127.0.0.1:3021";
const outDir = process.env.SAFETYGUARD_OUT_DIR || path.join(process.cwd(), "evaluation", "launch-readiness");
const timeoutMs = Number.parseInt(process.env.SAFETYGUARD_AUDIT_TIMEOUT_MS || "60000", 10);
const runDispatch = process.env.SAFETYGUARD_AUDIT_DISPATCH === "true";
const outputFile = process.env.SAFETYGUARD_AUDIT_OUTPUT || "api-connection-audit.json";

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [key, ...rawValueParts] = trimmed.split("=");
    const keyName = key.trim();
    if (!keyName || process.env[keyName]) continue;
    const rawValue = rawValueParts.join("=").trim();
    process.env[keyName] = rawValue.replace(/^["']|["']$/g, "");
  }
}

loadEnvFile(path.join(process.cwd(), ".env.local"));
loadEnvFile(path.join(process.cwd(), ".env"));

const question = process.env.SAFETYGUARD_AUDIT_QUESTION ||
  "한국지역난방공사 열수송관 굴착공사. 작업자 7명, 외국인 근로자 2명, 신규 투입자 1명, 이동식 크레인과 굴착기 사용, 매설물 확인 필요. 오늘 작업 전 문서팩을 만들어줘.";

fs.mkdirSync(outDir, { recursive: true });

function hasEnv(name) {
  return Boolean(process.env[name]?.trim());
}

function connectionLabel(mode) {
  if (mode === "live") return "연결됨";
  if (mode === "fallback") return "일부 근거 보류";
  return "연결 점검 필요";
}

async function fetchJson(url, init = {}) {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(timeoutMs)
  });
  const text = await response.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = { raw: text.slice(0, 500) };
  }
  return { response, parsed };
}

function documentStatus(result) {
  const deliverables = result?.deliverables || {};
  const keys = [
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

  return Object.fromEntries(keys.map((key) => [key, typeof deliverables[key] === "string" && deliverables[key].length > 20]));
}

function buildAuditRows(result) {
  const status = result?.status || {};
  const externalData = result?.externalData || {};

  return [
    {
      name: "Law.go / korean-law-mcp",
      keyPresent: hasEnv("LAWGO_OC") || hasEnv("KOREAN_LAW_MCP_LAW_OC"),
      liveStatus: connectionLabel(status.lawgo),
      reflectedIn: ["위험성평가표", "작업계획서", "TBM", "안전보건교육", "사진/증빙"],
      detail: status.detail || ""
    },
    {
      name: "Gemini",
      keyPresent: hasEnv("GEMINI_API_KEY"),
      liveStatus: connectionLabel(status.ai),
      reflectedIn: ["핵심 판단", "문서팩 본문"],
      detail: status.policyNote || ""
    },
    {
      name: "기상청",
      keyPresent: hasEnv("DATA_GO_KR_SERVICE_KEY") || hasEnv("PUBLIC_DATA_API_KEY"),
      liveStatus: connectionLabel(externalData.weather?.mode),
      reflectedIn: ["위험성평가표", "작업계획서", "TBM"],
      detail: externalData.weather?.detail || ""
    },
    {
      name: "Work24",
      keyPresent: hasEnv("WORK24_AUTH_KEY"),
      liveStatus: connectionLabel(externalData.training?.mode),
      reflectedIn: ["안전보건교육", "후속 교육"],
      detail: externalData.training?.detail || ""
    },
    {
      name: "KOSHA 교육",
      keyPresent: true,
      liveStatus: connectionLabel(externalData.koshaEducation?.mode),
      reflectedIn: ["안전보건교육", "후속 교육"],
      detail: externalData.koshaEducation?.detail || ""
    },
    {
      name: "KOSHA 공식자료",
      keyPresent: true,
      liveStatus: connectionLabel(externalData.kosha?.mode),
      reflectedIn: ["위험성평가표", "TBM", "안전보건교육"],
      detail: externalData.kosha?.detail || ""
    },
    {
      name: "KOSHA 재해사례",
      keyPresent: hasEnv("DATA_GO_KR_SERVICE_KEY") || hasEnv("PUBLIC_DATA_API_KEY"),
      liveStatus: connectionLabel(externalData.accidentCases?.mode),
      reflectedIn: ["TBM", "안전보건교육", "비상대응", "사진/증빙"],
      detail: externalData.accidentCases?.detail || ""
    },
    {
      name: "n8n dispatch",
      keyPresent: hasEnv("N8N_WEBHOOK_TOKEN") && hasEnv("N8N_WEBHOOK_PATH") && (hasEnv("N8N_PUBLIC_BASE") || hasEnv("N8N_INTERNAL_BASE") || hasEnv("N8N_WEBHOOK_URL")),
      liveStatus: runDispatch ? "전파 호출 확인" : "설정 점검만 수행",
      reflectedIn: ["현장 전파"],
      detail: process.env.VERCEL || process.env.VERCEL_URL ? "배포 환경에서는 N8N_PUBLIC_BASE만 사용해야 합니다." : "로컬/서버 내부에서는 N8N_INTERNAL_BASE를 사용할 수 있습니다."
    }
  ];
}

const startedAt = Date.now();
const ask = await fetchJson(`${baseUrl}/api/ask`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ question })
});

let dispatchResult = null;
if (runDispatch) {
  dispatchResult = await fetchJson(`${baseUrl}/api/workflow/dispatch`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      channels: ["email"],
      recipients: [],
      operatorNote: "SafeGuard launch readiness smoke",
      workpack: {
        message: "SafeGuard launch readiness smoke",
        documents: ask.parsed?.deliverables || {},
        status: ask.parsed?.status || {}
      }
    })
  });
}

const audit = {
  generatedAt: new Date().toISOString(),
  baseUrl,
  elapsedMs: Date.now() - startedAt,
  apiAskStatus: ask.response.status,
  apiAskOk: ask.response.ok,
  dispatchStatus: dispatchResult?.response.status ?? null,
  dispatchOk: dispatchResult?.response.ok ?? null,
  scenario: ask.parsed?.scenario || null,
  documents: documentStatus(ask.parsed),
  connections: buildAuditRows(ask.parsed),
  userFacingStatusPolicy: "연결됨 / 일부 근거 보류 / 연결 점검 필요",
  rawStatusDetail: ask.parsed?.status?.detail || ""
};

fs.writeFileSync(path.join(outDir, outputFile), JSON.stringify(audit, null, 2));
console.log(JSON.stringify({
  generatedAt: audit.generatedAt,
  baseUrl: audit.baseUrl,
  apiAskOk: audit.apiAskOk,
  dispatchOk: audit.dispatchOk,
  elapsedMs: audit.elapsedMs,
  connectionSummary: audit.connections.map((item) => `${item.name}: ${item.liveStatus}`)
}, null, 2));

process.exit(ask.response.ok ? 0 : 1);
