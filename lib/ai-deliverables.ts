// AI-generated deliverables (Track C).
// Replaces the template-driven deliverables in mock-data.ts with Gemini output for
// every per-document body.
//
// Architecture (post-refactor 2026-05-07): 7 small parallel calls instead of 3 large
// ones. Each tabular doc (riskAssessment / workPlan / tbm / tbmLog / education) has its
// own Gemini call returning {key: string} with optional companion array. Free (4 short
// docs) and Foreign (3 keys) keep their grouped calls — they fit comfortably under 32K
// output tokens. Per-call: 1 retry on transient failure (parse fail or call error).
//
// Why split: 3-call design hit MAX_TOKENS truncation on tabular (5 docs × 1500-3500자
// ≈ 22K-50K tokens output) and 60s timeout on long-context cases. Splitting makes each
// call ≤ 5K tokens output, ≤ 30s wall, and isolates failures to the affected doc only.

import type {
  AskResponse,
  SearchResult,
  WorkPlanStructured,
  TbmBriefingStructured,
  TbmLogStructured,
  EducationRecordStructured,
  PermitInspectionStructured,
  TbmRiskLink
} from "@/lib/types";
import {
  ACCIDENT_TYPE_VALUES,
  FORM_SCHEMA_REGISTRY,
  FOUR_M_VALUES,
  RISK_LEVEL_VALUES,
  validateRiskAssessmentRows,
  type RiskAssessmentRow,
  type RiskAssessmentValidationIssue
} from "@/lib/risk-assessment-schema";

const geminiApiKey = process.env.GEMINI_API_KEY?.trim();
const geminiModel = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
const geminiFallbackModels = (process.env.GEMINI_FALLBACK_MODELS || "gemini-flash-latest,gemini-2.5-flash-lite")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const GEMINI_TIMEOUT_MS = Number.parseInt(process.env.GEMINI_TIMEOUT_MS || "60000", 10);

type GeminiResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
};

type Scenario = {
  companyName: string;
  companyType?: string;
  siteName: string;
  workSummary: string;
  workerCount: number;
  weatherNote: string;
};

type GenContext = {
  question: string;
  scenario: Scenario;
  citationLines: string[];
  weatherNote?: string;
  trainingLines: string[];
  koshaLines: string[];
  accidentLines: string[];
  /** Top KOSHA 기술지침/기술지원규정 references that MUST be cited in body. */
  koshaPrimaryRefs?: Array<{ kindLabel: string; title: string; sentence: string }>;
};

async function callGemini(prompt: string): Promise<string> {
  if (!geminiApiKey) throw new Error("GEMINI_API_KEY missing");
  const models = [...new Set([geminiModel, ...geminiFallbackModels])];
  let lastError: unknown;
  for (const model of models) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.4,
            // Tabular prompt asks for 5 deliverables (1,500-3,500자 각) +
            // arrays — 한국어 1.5-2 tokens/char × ~17,500자 ≈ 28K tokens.
            // 8,192에서 잘려 invalid JSON → safeParseJson null → empty
            // AiDeliverables → 모든 tabular deliverable이 template fallback.
            // Gemini 2.5 Flash 한도 65,536 내에서 32,768로 증액.
            maxOutputTokens: 32768,
            responseMimeType: "application/json"
          }
        }),
        signal: controller.signal
      });
      clearTimeout(timer);
      if (!response.ok) {
        throw new Error(`Gemini ${model} HTTP ${response.status}`);
      }
      const parsed = (await response.json()) as GeminiResponse;
      const candidate = parsed.candidates?.[0];
      const text = candidate?.content?.parts?.map((p) => p.text || "").join("").trim();
      if (!text) {
        // Gemini가 텍스트 없이 finishReason만 반환하는 경우(MAX_TOKENS/SAFETY/RECITATION 등)를
        // 그대로 throw해서 diagnostics에 어느 사유인지 노출. block 사유는 promptFeedback에 있음.
        const finishReason = candidate?.finishReason || "unknown";
        const blockReason = parsed.promptFeedback?.blockReason || "";
        throw new Error(`Gemini ${model} empty response (finishReason=${finishReason}${blockReason ? ` blockReason=${blockReason}` : ""})`);
      }
      return text;
    } catch (error) {
      lastError = error;
      console.error(`Gemini deliverables (${model}) failed`, error);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Gemini chain failed");
}

// Wraps callGemini with one retry on transient failure. If the call returns text
// but the parser rejects it (returns null), retry once — Gemini occasionally emits
// markdown-wrapped JSON or partial structured-output JSON. If the call itself errors
// (HTTP, abort timeout, empty response), retry once. After 2 attempts, throw.
async function callAndParse<T>(
  prompt: string,
  parser: (raw: string) => T | null,
  label: string
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const raw = await callGemini(prompt);
      const parsed = parser(raw);
      if (parsed) return parsed;
      lastError = new Error(`json parse failed (raw len=${raw.length})`);
      const head = raw.slice(0, 200).replace(/\n/g, "\\n");
      const tail = raw.slice(-200).replace(/\n/g, "\\n");
      console.error(`[AI ${label}] attempt ${attempt} parse failed. head=${head} ... tail=${tail}`);
    } catch (error) {
      lastError = error;
      console.error(`[AI ${label}] attempt ${attempt} call failed:`, error);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`AI ${label} exhausted retries`);
}

function safeParseJson<T = unknown>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    const m = raw.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (!m) return null;
    try {
      return JSON.parse(m[0]) as T;
    } catch {
      return null;
    }
  }
}

function persona() {
  return [
    "당신은 한국 산업안전기사 자격을 갖춘 5년 차 현장 안전관리자다.",
    "사용자의 작업 시나리오를 받아 위험성평가·작업계획·TBM·안전보건교육·비상대응 등 산업안전 문서팩 본문을 작성한다.",
    "원칙:",
    "  1) 산업안전보건법 제38조·제39조와 시행규칙·시행령의 구체적인 조항을 가능한 한 인용한다.",
    "  2) 위험요인은 시나리오 특성에 맞춰 새롭게 발굴한다. 일반론(\"안전을 지키세요\") 금지.",
    "  3) 4M(Man·Machine·Media·Management) 분류로 위험요인을 정리한다.",
    "  4) 위험도는 가능성×중대성 매트릭스로 상/중/하 결정 + 판단근거를 1문장으로.",
    "  5) 감소대책은 즉시 실행 가능한 행동 단위로 적는다.",
    "  6) 외국인 근로자·신규 투입자 이슈는 시나리오에 키워드가 있으면 별도 강조.",
    "  7) 거절 문장 금지(\"제공할 수 없습니다\"). 부족하면 '현장 확인 필요'로 표기.",
    "  8) **KOSHA 기술지침/기술지원규정이 컨텍스트에 제공되면, 위험성평가·작업계획·TBM·교육 본문 안에서 그 지침 코드(예: H-205-2018, M-123-2012, X-78-2018)와 함께 직접 인용하라.** 단순 부록이 아니라 위험요인 또는 감소대책 항목 끝에 \"(KOSHA 지침 X-XX-YYYY — 짧은 인용)\" 형태로 표시. 괄호 안에는 콜론(:) 사용 금지 — 대시(—) 또는 슬래시(/)만 사용. 줄바꿈도 금지. 한 줄에 모두 들어가야 한다.",
    "  9) 모든 출력은 반드시 JSON. 마크다운 fence 금지."
  ].join("\n");
}

function contextBlock(ctx: GenContext) {
  const cites = ctx.citationLines.length ? ctx.citationLines.join("\n") : "(법령 후보 없음)";
  const training = ctx.trainingLines.length ? ctx.trainingLines.join("\n") : "(연계 교육 후보 없음)";
  const kosha = ctx.koshaLines.length ? ctx.koshaLines.join("\n") : "(KOSHA 보강 자료 없음)";
  const accidents = ctx.accidentLines.length ? ctx.accidentLines.join("\n") : "(유사 재해사례 없음)";
  const koshaPrimaryBlock = ctx.koshaPrimaryRefs && ctx.koshaPrimaryRefs.length
    ? [
        "",
        "**[★최우선 인용 자료 — KOSHA 기술지침/기술지원규정★]**",
        "다음 KOSHA 자료는 위험성평가표/작업계획서/TBM/교육 본문 안에 반드시 직접 인용하라.",
        "각 위험요인 또는 감소대책 줄 끝에 \"(KOSHA 지침 H-XXX-YYYY — 짧은 인용)\" 형식으로 첨부. 괄호 안 콜론·줄바꿈 절대 금지(키-값 split을 유발). 인용은 1줄 30자 이내로 간결히.",
        ...ctx.koshaPrimaryRefs.map((ref, i) => (
          `${i + 1}. ${ref.kindLabel} — ${ref.title}\n     인용 문장: ${ref.sentence}`
        ))
      ].join("\n")
    : "";
  return [
    "[질문]",
    ctx.question,
    "",
    "[현장 시나리오]",
    `회사: ${ctx.scenario.companyName}`,
    `업종: ${ctx.scenario.companyType || "-"}`,
    `현장: ${ctx.scenario.siteName}`,
    `작업 요약: ${ctx.scenario.workSummary}`,
    `작업 인원: ${ctx.scenario.workerCount}명`,
    `기상/조건: ${ctx.scenario.weatherNote}`,
    "",
    "[법령·해석례·판례 근거 후보]",
    cites,
    koshaPrimaryBlock,
    "",
    "[기상 신호]",
    ctx.weatherNote || "(추가 정보 없음)",
    "",
    "[연계 교육 후보]",
    training,
    "",
    "[KOSHA 공식 자료]",
    kosha,
    "",
    "[유사 재해사례]",
    accidents
  ].join("\n");
}

// 5 tabular per-document prompts (each ≤ 1 main string, optionally + 1 small array).
// Each fits comfortably under 5K output tokens and 30s wall, so MAX_TOKENS / abort
// failures from the previous 5-in-1 prompt are eliminated.

function riskAssessmentSinglePrompt(ctx: GenContext) {
  return [
    persona(),
    "",
    "위험성평가표(초안)를 작성하고 다음 JSON 형식으로만 반환하라.",
    "[기본정보] [1.사전준비] [2.유해·위험요인 파악] (4M 표시) [3.위험성 결정] (가능성/중대성/등급) [4.감소대책 수립 및 실행] [5.공유·교육] [6.조치 확인] 섹션 포함.",
    "위험요인은 5~7개를 시나리오에 맞게 발굴. 길이 1500~3500자 권장. 줄바꿈 포함 일반 텍스트.",
    "",
    "응답 JSON 스키마: { \"riskAssessmentDraft\": \"string\" }",
    "",
    contextBlock(ctx)
  ].join("\n");
}

// 작업계획서는 schema-first. AI가 산문 1500-3500자를 만들면 row parser에서 손실되어
// 셀에 안 맞는 행이 생기거나 텍스트가 한 셀에 다 박히는 문제가 있어, 표준 표 양식의
// 셀 단위 객체로 직접 반환하게 한다. parseSheetRows를 거치지 않고 xlsx-builder가
// 정해진 행/열 레이아웃에 그대로 채운다.
function workPlanStructuredPrompt(ctx: GenContext) {
  return [
    persona(),
    "",
    "한국 산업안전 표준 작업계획서의 셀 단위 데이터를 다음 JSON 스키마로 정확히 채워 반환하라.",
    "산문/장문 금지. 각 필드는 셀에 들어갈 짧은 문구(80자 이내) 단위로 작성. 위험요인·감소대책은 시나리오 특화. KOSHA 자료가 있으면 safetyMeasure 안에 \"(KOSHA 지침 X-XX-YYYY — 짧은 인용)\" 형식으로 1줄 포함.",
    "",
    "응답 JSON 스키마:",
    `{
  "workPlanStructured": {
    "workOverview": {
      "workName": "string (작업명, 30자 이내)",
      "description": "string (작업내용 1~2문장, 120자 이내)",
      "workerCount": 0,
      "location": "string (작업장소, 50자 이내)",
      "condition": "string (기상/현장 조건 1줄, 80자 이내)",
      "equipment": ["string", "string"]
    },
    "workSteps": [
      { "stepNo": 1, "action": "string (작업 단계, 60자 이내)", "equipment": "string (해당 장비, 30자 이내)", "safetyMeasure": "string (단계별 안전조치, 80자 이내. KOSHA 인용 가능)", "owner": "string (담당자/직책, 30자 이내)", "relatedRiskRowIndex": [0], "evidenceRefs": ["string"], "verification": "string (확인 방법 1줄)" }
    ],
    "stopCriteria": ["string (작업중지 기준 1줄, 60자 이내)"],
    "emergencyResponse": {
      "contacts": [{ "role": "string (직책, 30자 이내)", "phone": "string (전화번호 또는 형식)" }],
      "evacRoute": "string (대피경로 1줄)",
      "firstAid": "string (응급조치 요약 1줄)"
    },
    "approvers": {
      "author": "string (작성자 직책)",
      "reviewer": "string (검토자 직책)",
      "approver": "string (승인자 직책)"
    }
  }
}`,
    "",
    "필수 조건: workSteps 4-7개. 각 workStep은 위험성평가 row 0-based index를 relatedRiskRowIndex에 1개 이상 넣고, evidenceRefs와 verification을 채운다. stopCriteria 3-5개. contacts 3-4개. 모든 string은 \\n 없이 한 줄.",
    "",
    contextBlock(ctx)
  ].join("\n");
}

// TBM 브리핑 schema-first. workPlan과 동일하게 산문 대신 셀 객체 직접 반환.
function tbmBriefingStructuredPrompt(ctx: GenContext) {
  return [
    persona(),
    "",
    "한국 산업안전 표준 TBM 브리핑의 셀 단위 데이터를 다음 JSON 스키마로 정확히 채워 반환하라.",
    "산문/장문 금지. 각 필드는 1줄 단위 짧은 문구. hazards/measures는 시나리오 특화 4M 분류. KOSHA 자료가 있으면 measures.action 안에 \"(KOSHA 지침 X-XX-YYYY — 짧은 인용)\" 형식 포함.",
    "",
    "응답 JSON 스키마:",
    `{
  "tbmBriefingStructured": {
    "meta": {
      "dateTime": "string (일시 1줄)",
      "location": "string (장소)",
      "target": "string (대상, 예: 전 작업자 8명)",
      "attendees": "string (참석자 확인 방식)"
    },
    "todayWork": {
      "name": "string (작업명)",
      "location": "string (작업 위치)",
      "time": "string (작업 시간, 예: 09:00-17:00)",
      "equipment": ["string"]
    },
    "hazards": [
      { "category": "Man|Machine|Media|Management", "description": "string (위험요인, 60자 이내)" }
    ],
    "measures": [
      { "hazardRef": 1, "action": "string (안전대책, 80자 이내. KOSHA 인용 가능)", "owner": "string" }
    ],
    "stopCriteria": ["string (작업중지 기준 1줄)"],
    "confirmTopics": ["string (마무리 확인질문)"],
    "photoEvidenceLocation": "string (사진증빙 위치/방식)"
  },
  "tbmQuestions": ["string","string","string","string","string"]
}`,
    "",
    "필수: hazards 4-6개 / measures 4-6개 / stopCriteria 3-5개 / confirmTopics 5개 / tbmQuestions 5개. measures.hazardRef는 hazards 인덱스(1부터). 모든 string은 \\n 없이 한 줄.",
    "",
    contextBlock(ctx)
  ].join("\n");
}

// Schema-first TBM 일지 (사후 기록). tbmBriefing(사전)과 분리된 export.
function tbmLogStructuredPrompt(ctx: GenContext) {
  return [
    persona(),
    "",
    "한국 산업안전 표준 TBM 일지(사후 기록)의 셀 단위 데이터를 다음 JSON 스키마로 정확히 채워 반환하라.",
    "산문/장문 금지. 각 필드는 1줄 단위 짧은 문구. hazardsDiscussed/safetyEducation은 실제 진행한 내용 기준. unaddressedItems는 미조치 항목(없으면 빈 배열).",
    "tbmBriefing(사전)이 다룬 내용을 실제로 진행했다는 사후 기록 관점으로 작성. 시나리오 위험성평가 hazard와 표현이 일치하면 hazardsDiscussed[].relatedRiskRowIndex(0-based)로 연결.",
    "",
    "응답 JSON 스키마:",
    `{
  "tbmLogStructured": {
    "meta": {
      "dateTime": "string (일시 1줄)",
      "location": "string (장소)",
      "workType": "string (공종, 예: 배관 점검)",
      "instructor": "string (진행자/책임자)"
    },
    "attendance": {
      "expected": 0,
      "actual": 0,
      "attendees": ["string (이름 또는 사번)"],
      "absenceReason": "string (없으면 \\"없음\\")",
      "confirmationMethod": "string (예: 출석부 서명)"
    },
    "todayWork": {
      "name": "string (작업명)",
      "location": "string (작업 위치)",
      "time": "string (작업 시간)",
      "equipment": ["string"]
    },
    "workerConfirmations": ["string (근로자 확인사항 1줄)"],
    "hazardsDiscussed": [
      { "category": "Man|Machine|Media|Management", "description": "string (60자 이내)", "relatedRiskRowIndex": 0 }
    ],
    "safetyEducation": {
      "topic": "string (교육 주제)",
      "keyPoints": ["string (핵심 1줄)"],
      "materials": "string (사용 자료/근거, 예: KOSHA Guide C-12-2024)"
    },
    "unaddressedItems": [
      { "item": "string", "plannedAction": "string", "owner": "string", "dueDate": "YYYY-MM-DD 또는 현장 확인" }
    ],
    "photoEvidence": {
      "captureLocations": ["string (촬영 위치)"],
      "storagePath": "string (보관 위치/방법)"
    },
    "signatures": {
      "author": "string",
      "reviewer": "string",
      "approver": "string"
    }
  }
}`,
    "",
    "필수: workerConfirmations 5개 / hazardsDiscussed 3-5개 / safetyEducation.keyPoints 3-5개 / unaddressedItems 0-3개 / photoEvidence.captureLocations 1-3개. relatedRiskRowIndex는 시나리오 위험성평가 rows 인덱스(0부터, 매핑 가능한 경우만 포함, 없으면 필드 omit). 모든 string은 \\n 없이 한 줄.",
    "",
    contextBlock(ctx)
  ].join("\n");
}

function tbmLogSinglePrompt(ctx: GenContext) {
  return [
    persona(),
    "",
    "TBM 일지(초안)를 작성하고 다음 JSON 형식으로만 반환하라.",
    "결재/공종/일자/근로자 확인사항/금일 작업/금일 위험요인/일일 안전교육/참석자명단/인원집계/미조치 및 사진증빙 섹션 포함. 길이 1500~3500자.",
    "",
    "응답 JSON 스키마: { \"tbmLogDraft\": \"string\" }",
    "",
    contextBlock(ctx)
  ].join("\n");
}

// 안전보건교육 기록 schema-first.
function educationRecordStructuredPrompt(ctx: GenContext) {
  return [
    persona(),
    "",
    "한국 산업안전 표준 안전보건교육 기록의 셀 단위 데이터를 다음 JSON 스키마로 정확히 채워 반환하라.",
    "산문/장문 금지. curriculum 각 항목의 lawCitation은 산업안전보건법/시행규칙/시행령 조항 명시. KOSHA 자료가 있으면 keyPoints 항목 끝에 \"(KOSHA 지침 X-XX-YYYY — 짧은 인용)\" 형식 포함.",
    "",
    "응답 JSON 스키마:",
    `{
  "educationRecordStructured": {
    "educationName": "string (교육명, 50자 이내)",
    "type": "정기교육|특별교육|외국인교육|신규자교육|관리감독자교육|기타",
    "dateTime": "string",
    "location": "string",
    "target": "string (교육대상)",
    "instructor": "string (실시자)",
    "confirmer": "string (확인자)",
    "curriculum": [
      {
        "topic": "string (교육 주제, 60자 이내)",
        "lawCitation": "string (예: 산업안전보건법 제29조)",
        "keyPoints": ["string (핵심 내용 1줄)", "string", "string"]
      }
    ],
    "understandingCheck": "string (이해확인방법 1-2 문장)",
    "tbmLink": "string (TBM 연계 강조 포인트)",
    "followupRecommendation": "string (후속 교육 추천 1-2 문장)"
  },
  "safetyEducationPoints": ["string","string","string","string","string"]
}`,
    "",
    "필수: curriculum 3-5개 항목 / keyPoints 각 3-5개 / safetyEducationPoints 5개. 모든 string은 \\n 없이 한 줄.",
    "",
    contextBlock(ctx)
  ].join("\n");
}

function safetyEducationSinglePrompt(ctx: GenContext) {
  return [
    persona(),
    "",
    "안전보건교육 기록 초안 + 강조사항 5개를 작성하고 다음 JSON 형식으로만 반환하라.",
    "safetyEducationRecordDraft: 교육명/구분/일시/장소/대상/실시자/확인자/교육내용(법령조항 명시)/이해확인방법/TBM 연계/후속 교육 추천. 길이 1500~3500자.",
    "safetyEducationPoints: 작업자에게 강조할 핵심 메시지 5개 짧은 문장 배열.",
    "",
    "응답 JSON 스키마: { \"safetyEducationRecordDraft\": \"string\", \"safetyEducationPoints\": [\"string\",\"string\",\"string\",\"string\",\"string\"] }",
    "",
    contextBlock(ctx)
  ].join("\n");
}

function structuredRiskRowsPrompt(ctx: GenContext) {
  const rowSchema = FORM_SCHEMA_REGISTRY.riskAssessment.rowSchema;
  return [
    persona(),
    "",
    "위험성평가표 렌더러가 바로 사용할 수 있는 JSON rows만 반환하라.",
    "산문, 마크다운, 설명, 코드 fence 금지. 최상위 객체는 반드시 {\"rows\":[...]} 형태.",
    "",
    "필수 규칙:",
    "  - rows는 현장 시나리오에 맞는 5~7개 위험성평가 행이다.",
    "  - 모든 행은 필수 필드를 빠짐없이 채운다.",
    "  - location은 작업장소, equipment는 장비·도구, verificationStatus/verificationDate/verificationChecker는 조치 확인 칸에 그대로 들어간다.",
    `  - fourM enum: ${FOUR_M_VALUES.join(", ")}`,
    `  - accidentType enum: ${ACCIDENT_TYPE_VALUES.join(", ")}`,
    "  - likelihood와 severity는 1~5 정수다.",
    `  - riskLevel enum: ${RISK_LEVEL_VALUES.join(", ")}. likelihood×severity 기준으로 1~4는 low, 5~9는 medium, 10 이상은 high.`,
    "  - due는 YYYY-MM-DD 또는 \"현장 확인\"만 허용한다.",
    "  - verificationDate는 YYYY-MM-DD 또는 \"현장 확인\"만 허용하고, verificationStatus는 planned/done/needsReview 중 하나다.",
    "  - evidenceRefs는 법령, KOSHA, 재해사례, 지식 DB 후보 중 해당 행을 뒷받침하는 짧은 근거 문자열 배열이다.",
    "  - whyLikelihood와 whySeverity는 수치 판단 근거를 각각 한 문장으로 적는다.",
    "",
    "행 JSON schema:",
    JSON.stringify(rowSchema, null, 2),
    "",
    "응답 예시 형태:",
    `{"rows":[{"location":"string","process":"string","task":"string","equipment":"string","hazard":"string","fourM":"Man","accidentType":"fall","currentControls":"string","likelihood":3,"severity":4,"riskLevel":"high","additionalControls":"string","owner":"string","due":"현장 확인","verification":"string","verificationStatus":"planned","verificationDate":"현장 확인","verificationChecker":"string","whyLikelihood":"string","whySeverity":"string","evidenceRefs":["string"]}]}`,
    "",
    contextBlock(ctx)
  ].join("\n");
}

function tbmRiskLinksPrompt(ctx: GenContext, rows: RiskAssessmentRow[]) {
  const compactRows = rows.slice(0, 7).map((row, index) => ({
    riskRowIndex: index,
    hazard: row.hazard,
    currentControls: row.currentControls,
    additionalControls: row.additionalControls,
    owner: row.owner,
    verification: row.verification,
    verificationChecker: row.verificationChecker,
    evidenceRefs: row.evidenceRefs
  }));
  return [
    persona(),
    "",
    "위험성평가 rows를 TBM에서 바로 확인할 수 있는 연결 질문 JSON으로 변환하라.",
    "산문, 마크다운, 설명, 코드 fence 금지. 최상위 객체는 반드시 {\"tbmRiskLinks\":[...]} 형태.",
    "",
    "필수 규칙:",
    "  - tbmRiskLinks는 입력 risk rows 중 TBM에서 공유해야 할 핵심 행 3~6개를 고른다.",
    "  - riskRowIndex는 아래 입력 배열의 0부터 시작하는 인덱스다. 없는 행을 참조하지 않는다.",
    "  - hazard는 연결된 risk row의 hazard 표현을 그대로 재사용한다.",
    "  - control은 해당 row의 additionalControls 또는 currentControls를 TBM 행동 문장으로 짧게 바꾼다.",
    "  - weatherSignal은 기상 신호와 현장 조건을 연결한 1줄 문장이다.",
    "  - confirmQuestion은 작업자가 예/아니오로 답할 수 있는 확인 질문이다.",
    "  - owner, verification, evidenceRefs를 반드시 채운다.",
    "",
    "응답 JSON 스키마:",
    `{
  "tbmRiskLinks": [
    {
      "riskRowIndex": 0,
      "hazard": "string",
      "control": "string",
      "weatherSignal": "string",
      "confirmQuestion": "string",
      "owner": "string",
      "verification": "string",
      "evidenceRefs": ["string"]
    }
  ]
}`,
    "",
    "[입력 risk rows]",
    JSON.stringify(compactRows, null, 2),
    "",
    contextBlock(ctx)
  ].join("\n");
}

function freeFormPrompt(ctx: GenContext) {
  return [
    persona(),
    "",
    "다음 4개의 자유 텍스트 본문을 모두 작성하고 JSON 객체로 반환하라:",
    "  - workpackSummaryDraft: 점검결과 요약(초안). 현장명/작업조건/핵심 위험/즉시 조치/연결 상태를 첫 장으로 정리. 600자 내외.",
    "  - emergencyResponseDraft: 비상대응 절차(초안). 1.사고 징후 및 즉시 중지 / 2.초기조치 / 3.보고체계 / 4.현장보존 및 재발방지. 1200~1800자.",
    "  - photoEvidenceDraft: 사진/증빙 기록(초안). 작업 전 / 조치 전·후 / TBM·교육 증빙 / 확인자. 800~1200자.",
    "  - kakaoMessage: 현장 공유 메시지. 카톡 단톡방에 바로 붙여넣을 수 있게 이모지 일부 사용 가능. 400~700자.",
    "",
    "응답 JSON 스키마:",
    `{
  "workpackSummaryDraft": "string",
  "emergencyResponseDraft": "string",
  "photoEvidenceDraft": "string",
  "kakaoMessage": "string"
}`,
    "",
    contextBlock(ctx)
  ].join("\n");
}

function foreignWorkerPrompt(ctx: GenContext) {
  return [
    persona(),
    "",
    "외국인 근로자용 안내문 2종을 작성하고 JSON 객체로 반환하라.",
    "  - foreignWorkerBriefing: 한국어 + 영어 + 베트남어 3가지 버전을 한 본문 안에 [한국어] [English] [Tiếng Việt] 헤더로 연속 작성. 각 버전은 위험요인 / 즉시 조치 / 작업중지 기준 / 보호구 / 비상연락 항목 포함. 한 헤더당 800~1500자, 전체 4500~7000자.",
    "  - foreignWorkerTransmission: 단톡방·문자에 그대로 붙여넣을 전송용 안내문. 한국어 + 영어 + 베트남어 + 태국어 + 우즈베크어 5개 언어 짧은 버전(각 800~1500자, 전체 7000~10000자). 각 언어 블록 시작에 [언어명] 헤더.",
    "  - foreignWorkerLanguages: 본 본문에서 사용한 언어 코드 배열 예: [\"ko\",\"en\",\"vi\",\"th\",\"uz\"]. ISO 639-1 코드.",
    "",
    "응답 JSON 스키마:",
    `{
  "foreignWorkerBriefing": "string",
  "foreignWorkerTransmission": "string",
  "foreignWorkerLanguages": ["ko", "en", "vi", "th", "uz"]
}`,
    "",
    contextBlock(ctx)
  ].join("\n");
}

export type AiDeliverables = Partial<{
  workpackSummaryDraft: string;
  riskAssessmentDraft: string;
  workPlanDraft: string;
  /** schema-first 작업계획서 셀 단위 구조. xlsx 직접 렌더 경로용. */
  workPlanStructured: WorkPlanStructured;
  /** TBM 브리핑 schema-first 구조. xlsx 직접 렌더 경로용. */
  tbmBriefingStructured: TbmBriefingStructured;
  /** TBM 일지 schema-first 구조. xlsx 직접 렌더 경로용. */
  tbmLogStructured: TbmLogStructured;
  /** 안전보건교육 기록 schema-first 구조. xlsx 직접 렌더 경로용. */
  educationRecordStructured: EducationRecordStructured;
  /** 안전작업허가 확인서 schema-first 구조. xlsx 직접 렌더 경로용. */
  permitInspectionStructured: PermitInspectionStructured;
  tbmBriefing: string;
  tbmLogDraft: string;
  safetyEducationRecordDraft: string;
  emergencyResponseDraft: string;
  photoEvidenceDraft: string;
  foreignWorkerBriefing: string;
  foreignWorkerTransmission: string;
  foreignWorkerLanguages: string[];
  safetyEducationPoints: string[];
  tbmQuestions: string[];
  kakaoMessage: string;
  structuredRiskRows: RiskAssessmentRow[];
  structuredRiskRowsValidationIssues: RiskAssessmentValidationIssue[];
  tbmRiskLinks: TbmRiskLink[];
}>;

export type AiMode = "template" | "enhanced" | "full";

export type GenerateAllOptions = {
  scenario: Scenario;
  question: string;
  citations?: SearchResult[];
  weatherSummary?: string;
  trainingLines?: string[];
  koshaLines?: string[];
  accidentLines?: string[];
  /** Top KOSHA 기술지침/기술지원규정 references the AI must cite in body. */
  koshaPrimaryRefs?: Array<{ kindLabel: string; title: string; sentence: string }>;
  /**
   * Which call groups to run.
   * - "full" (default): tabular + free + foreign  → 14 deliverables AI-generated
   * - "enhanced": tabular only → 5 표 양식 deliverables only (others remain template)
   */
  scope?: "full" | "enhanced";
};

function buildContext(opts: GenerateAllOptions): GenContext {
  const cites = (opts.citations || []).slice(0, 6).map((c, i) => {
    const head = c.title ? c.title.slice(0, 80) : "";
    const body = c.summary ? c.summary.slice(0, 140) : "";
    const cite = c.citation ? c.citation.slice(0, 60) : "";
    return `${i + 1}. [${c.type || "-"}] ${head} | ${body}${cite ? ` | ${cite}` : ""}`;
  });
  return {
    question: opts.question,
    scenario: opts.scenario,
    citationLines: cites,
    weatherNote: opts.weatherSummary,
    trainingLines: opts.trainingLines || [],
    koshaLines: opts.koshaLines || [],
    accidentLines: opts.accidentLines || [],
    koshaPrimaryRefs: opts.koshaPrimaryRefs || []
  };
}

// Per-call parsers. Each validates the expected shape (length floors, array types)
// and returns null when the validation fails — that triggers callAndParse's retry.

// All parsers return Partial<AiDeliverables> so they share a single signature in
// TABULAR_SPECS (TypeScript's contextual narrowing on Pick<> union doesn't widen).
function parseRiskAssessment(raw: string): Partial<AiDeliverables> | null {
  const j = safeParseJson<AiDeliverables>(raw);
  const v = j?.riskAssessmentDraft;
  return typeof v === "string" && v.length > 100 ? { riskAssessmentDraft: v } : null;
}
function parseWorkPlanStructured(raw: string): Partial<AiDeliverables> | null {
  // schema-first: workPlanStructured 객체를 셀 단위로 검증.
  // 누락 필드가 있거나 array가 비어있으면 null로 retry 트리거.
  const j = safeParseJson<{ workPlanStructured?: AiDeliverables["workPlanStructured"] }>(raw);
  const s = j?.workPlanStructured;
  if (!s || typeof s !== "object") return null;
  if (!s.workOverview || typeof s.workOverview.workName !== "string") return null;
  if (!Array.isArray(s.workSteps) || s.workSteps.length < 3) return null;
  if (!Array.isArray(s.stopCriteria) || s.stopCriteria.length < 2) return null;
  if (!s.emergencyResponse || !Array.isArray(s.emergencyResponse.contacts)) return null;
  if (!s.approvers) return null;
  return { workPlanStructured: s };
}
function parseTbmBriefingStructured(raw: string): Partial<AiDeliverables> | null {
  // schema-first TBM. workPlan과 동일 패턴: meta/todayWork/hazards/measures 필수.
  const j = safeParseJson<{ tbmBriefingStructured?: TbmBriefingStructured; tbmQuestions?: string[] }>(raw);
  const s = j?.tbmBriefingStructured;
  if (!s || typeof s !== "object") return null;
  if (!s.meta || typeof s.meta.dateTime !== "string") return null;
  if (!s.todayWork || typeof s.todayWork.name !== "string") return null;
  if (!Array.isArray(s.hazards) || s.hazards.length < 2) return null;
  if (!Array.isArray(s.measures) || s.measures.length < 2) return null;
  if (!Array.isArray(s.stopCriteria) || s.stopCriteria.length < 2) return null;
  if (!Array.isArray(s.confirmTopics) || s.confirmTopics.length < 3) return null;
  const out: Partial<AiDeliverables> = { tbmBriefingStructured: s };
  if (Array.isArray(j?.tbmQuestions)) {
    out.tbmQuestions = j.tbmQuestions.filter((str) => typeof str === "string");
  }
  return out;
}
function parseTbmLog(raw: string): Partial<AiDeliverables> | null {
  const j = safeParseJson<AiDeliverables>(raw);
  const v = j?.tbmLogDraft;
  return typeof v === "string" && v.length > 100 ? { tbmLogDraft: v } : null;
}
function parseTbmLogStructured(raw: string): Partial<AiDeliverables> | null {
  const j = safeParseJson<{ tbmLogStructured?: TbmLogStructured }>(raw);
  const s = j?.tbmLogStructured;
  if (!s || typeof s !== "object") return null;
  if (!s.meta || typeof s.meta.dateTime !== "string") return null;
  if (!s.attendance || typeof s.attendance.confirmationMethod !== "string") return null;
  if (!s.todayWork || typeof s.todayWork.name !== "string") return null;
  if (!Array.isArray(s.workerConfirmations) || s.workerConfirmations.length < 3) return null;
  if (!Array.isArray(s.hazardsDiscussed) || s.hazardsDiscussed.length < 2) return null;
  if (!s.safetyEducation || typeof s.safetyEducation.topic !== "string") return null;
  if (!Array.isArray(s.safetyEducation.keyPoints) || s.safetyEducation.keyPoints.length < 2) return null;
  if (!Array.isArray(s.unaddressedItems)) return null; // 빈 배열 허용
  if (!s.photoEvidence || !Array.isArray(s.photoEvidence.captureLocations)) return null;
  if (!s.signatures || typeof s.signatures.author !== "string") return null;
  return { tbmLogStructured: s };
}
function parseEducationRecordStructured(raw: string): Partial<AiDeliverables> | null {
  const j = safeParseJson<{ educationRecordStructured?: EducationRecordStructured; safetyEducationPoints?: string[] }>(raw);
  const s = j?.educationRecordStructured;
  if (!s || typeof s !== "object") return null;
  if (typeof s.educationName !== "string" || s.educationName.length === 0) return null;
  if (!Array.isArray(s.curriculum) || s.curriculum.length < 2) return null;
  if (typeof s.understandingCheck !== "string") return null;
  const out: Partial<AiDeliverables> = { educationRecordStructured: s };
  if (Array.isArray(j?.safetyEducationPoints)) {
    out.safetyEducationPoints = j.safetyEducationPoints.filter((str) => typeof str === "string");
  }
  return out;
}
function parseStructuredRiskRows(raw: string): Partial<AiDeliverables> | null {
  const parsed = safeParseJson<unknown>(raw);
  const validation = validateRiskAssessmentRows(parsed);
  if (!validation.rows.length) return null;
  const out: Partial<AiDeliverables> = { structuredRiskRows: validation.rows };
  if (validation.issues.length) out.structuredRiskRowsValidationIssues = validation.issues;
  return out;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringOrFallback(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

function parseTbmRiskLinks(raw: string, rows: RiskAssessmentRow[]): Partial<AiDeliverables> | null {
  const parsed = safeParseJson<unknown>(raw);
  const linksValue = isRecord(parsed) ? parsed.tbmRiskLinks : Array.isArray(parsed) ? parsed : null;
  if (!Array.isArray(linksValue)) return null;

  const links: TbmRiskLink[] = [];
  const seenIndexes = new Set<number>();
  for (const value of linksValue) {
    if (!isRecord(value)) continue;
    const riskRowIndexValue = value.riskRowIndex;
    if (typeof riskRowIndexValue !== "number" || !Number.isInteger(riskRowIndexValue)) continue;
    const riskRowIndex = riskRowIndexValue;
    const row = rows[riskRowIndex];
    if (!row || seenIndexes.has(riskRowIndex)) continue;

    const control = stringOrFallback(value.control, row.additionalControls || row.currentControls || "작업 전 안전조치를 확인합니다.");
    const owner = stringOrFallback(value.owner, row.owner || "작업반장");
    const verification = stringOrFallback(value.verification, row.verification || "TBM 기록과 현장 확인으로 검증합니다.");
    const evidenceRefsValue = value.evidenceRefs;
    const evidenceRefs = Array.isArray(evidenceRefsValue)
      ? evidenceRefsValue.filter((ref): ref is string => typeof ref === "string" && ref.trim().length > 0).map((ref) => ref.trim())
      : row.evidenceRefs || [];

    links.push({
      riskRowIndex,
      hazard: row.hazard,
      control,
      weatherSignal: stringOrFallback(value.weatherSignal, "기상청 현재·예보 신호와 현장 체감 조건을 함께 확인합니다."),
      confirmQuestion: stringOrFallback(value.confirmQuestion, `${row.hazard} 위험에 대해 ${control} 조치를 이해하고 작업 전 확인했습니까?`),
      owner,
      verification,
      evidenceRefs
    });
    seenIndexes.add(riskRowIndex);
  }

  return links.length ? { tbmRiskLinks: links.slice(0, 6) } : null;
}

async function generateTbmRiskLinks(ctx: GenContext, rows: RiskAssessmentRow[]): Promise<Partial<AiDeliverables>> {
  if (!rows.length) return { tbmRiskLinks: [] };
  try {
    return await callAndParse(
      tbmRiskLinksPrompt(ctx, rows),
      (raw) => parseTbmRiskLinks(raw, rows),
      "tbmRiskLinks"
    );
  } catch (error) {
    console.error("[AI tbmRiskLinks] falling back to []", error);
    return { tbmRiskLinks: [] };
  }
}
function parseFree(raw: string): Partial<AiDeliverables> | null {
  const j = safeParseJson<AiDeliverables>(raw);
  if (!j) return null;
  const required: Array<keyof AiDeliverables> = ["workpackSummaryDraft", "emergencyResponseDraft", "photoEvidenceDraft", "kakaoMessage"];
  // Free 그룹은 4개 모두 짧은 문서. 1-2개만 살아남는 부분 응답을 retry로 잡아내려고
  // 4개 모두 length>100인 경우에만 success로 인정.
  const valid = required.every((k) => typeof j[k] === "string" && (j[k] as string).length > 100);
  if (!valid) return null;
  return {
    workpackSummaryDraft: j.workpackSummaryDraft as string,
    emergencyResponseDraft: j.emergencyResponseDraft as string,
    photoEvidenceDraft: j.photoEvidenceDraft as string,
    kakaoMessage: j.kakaoMessage as string
  };
}
function parseForeign(raw: string): Partial<AiDeliverables> | null {
  const j = safeParseJson<AiDeliverables>(raw);
  const briefing = j?.foreignWorkerBriefing;
  const transmission = j?.foreignWorkerTransmission;
  if (typeof briefing !== "string" || briefing.length <= 200) return null;
  if (typeof transmission !== "string" || transmission.length <= 200) return null;
  const out: Partial<AiDeliverables> = {
    foreignWorkerBriefing: briefing,
    foreignWorkerTransmission: transmission
  };
  if (Array.isArray(j?.foreignWorkerLanguages)) {
    out.foreignWorkerLanguages = j.foreignWorkerLanguages.filter((s) => typeof s === "string");
  }
  return out;
}

// Specs for the 7 parallel calls. Order in the array doesn't matter; Promise.allSettled
// reports per-spec status independently.
const TABULAR_SPECS = [
  { name: "riskAssessment", buildPrompt: riskAssessmentSinglePrompt, parse: parseRiskAssessment },
  // workPlan은 산문이 아닌 셀 단위 구조(workPlanStructured)로 직접 반환.
  // xlsx-builder가 parseSheetRows 우회하고 표 양식에 직접 매핑.
  { name: "workPlanStructured", buildPrompt: workPlanStructuredPrompt, parse: parseWorkPlanStructured },
  // TBM 브리핑도 schema-first. tbmBriefingStructured + tbmQuestions 반환.
  { name: "tbmBriefingStructured", buildPrompt: tbmBriefingStructuredPrompt, parse: parseTbmBriefingStructured },
  // TBM 일지도 schema-first 구조를 별도 생성하되, 기존 tbmLogDraft 산문 경로는 유지.
  { name: "tbmLogStructured", buildPrompt: tbmLogStructuredPrompt, parse: parseTbmLogStructured },
  { name: "tbmLog", buildPrompt: tbmLogSinglePrompt, parse: parseTbmLog },
  // 안전보건교육 기록도 schema-first. educationRecordStructured + safetyEducationPoints.
  { name: "educationRecordStructured", buildPrompt: educationRecordStructuredPrompt, parse: parseEducationRecordStructured }
] as const;

export async function generateAllDeliverables(opts: GenerateAllOptions): Promise<AiDeliverables> {
  if (!geminiApiKey) return {};
  const ctx = buildContext(opts);
  const scope = opts.scope || "full";

  // 7-way parallel: 5 tabular per-doc + 1 free + 1 foreign (free/foreign skipped on enhanced).
  const tabularPromises = TABULAR_SPECS.map((spec) =>
    callAndParse(spec.buildPrompt(ctx), spec.parse, spec.name)
  );
  const structuredRiskRowsPromise = callAndParse(
    structuredRiskRowsPrompt(ctx),
    parseStructuredRiskRows,
    "structuredRiskRows"
  );
  const freePromise = scope === "full"
    ? callAndParse(freeFormPrompt(ctx), parseFree, "free")
    : Promise.reject(new Error("skipped (enhanced scope)"));
  const foreignPromise = scope === "full"
    ? callAndParse(foreignWorkerPrompt(ctx), parseForeign, "foreign")
    : Promise.reject(new Error("skipped (enhanced scope)"));

  const settled = await Promise.allSettled([
    ...tabularPromises,
    structuredRiskRowsPromise,
    freePromise,
    foreignPromise
  ]);

  const out: AiDeliverables = {};
  for (const s of settled) {
    if (s.status === "fulfilled") Object.assign(out, s.value);
  }
  Object.assign(out, await generateTbmRiskLinks(ctx, out.structuredRiskRows || []));
  return out;
}

export type AiDeliverablesDiagnostics = {
  geminiAvailable: boolean;
  // group: per-doc name (riskAssessment / workPlan / tbmBriefing / tbmLog / safetyEducation / free / foreign).
  groupResults: Array<{ group: string; status: "fulfilled" | "rejected"; reason?: string }>;
  filledKeys: string[];
};

export async function generateAllDeliverablesWithDiagnostics(
  opts: GenerateAllOptions
): Promise<{ deliverables: AiDeliverables; diagnostics: AiDeliverablesDiagnostics }> {
  if (!geminiApiKey) {
    return {
      deliverables: {},
      diagnostics: { geminiAvailable: false, groupResults: [], filledKeys: [] }
    };
  }
  const ctx = buildContext(opts);
  const scope = opts.scope || "full";

  const allSpecs: Array<{ name: string; promise: Promise<Partial<AiDeliverables>> }> = [
    ...TABULAR_SPECS.map((spec) => ({
      name: spec.name,
      promise: callAndParse(spec.buildPrompt(ctx), spec.parse, spec.name) as Promise<Partial<AiDeliverables>>
    })),
    {
      name: "structuredRiskRows",
      promise: callAndParse(
        structuredRiskRowsPrompt(ctx),
        parseStructuredRiskRows,
        "structuredRiskRows"
      ) as Promise<Partial<AiDeliverables>>
    },
    {
      name: "free",
      promise: scope === "full"
        ? (callAndParse(freeFormPrompt(ctx), parseFree, "free") as Promise<Partial<AiDeliverables>>)
        : Promise.reject(new Error("skipped (enhanced)"))
    },
    {
      name: "foreign",
      promise: scope === "full"
        ? (callAndParse(foreignWorkerPrompt(ctx), parseForeign, "foreign") as Promise<Partial<AiDeliverables>>)
        : Promise.reject(new Error("skipped (enhanced)"))
    }
  ];

  const settled = await Promise.allSettled(allSpecs.map((s) => s.promise));
  const out: AiDeliverables = {};
  const groupResults: AiDeliverablesDiagnostics["groupResults"] = [];

  settled.forEach((s, i) => {
    const name = allSpecs[i].name;
    if (s.status === "fulfilled") {
      groupResults.push({ group: name, status: "fulfilled" });
      Object.assign(out, s.value);
    } else {
      groupResults.push({
        group: name,
        status: "rejected",
        reason: s.reason instanceof Error ? s.reason.message : String(s.reason)
      });
    }
  });

  const tbmRiskLinksResult = await generateTbmRiskLinks(ctx, out.structuredRiskRows || []);
  Object.assign(out, tbmRiskLinksResult);
  groupResults.push({
    group: "tbmRiskLinks",
    status: (tbmRiskLinksResult.tbmRiskLinks?.length || 0) > 0 ? "fulfilled" : "rejected",
    reason: (tbmRiskLinksResult.tbmRiskLinks?.length || 0) > 0 ? undefined : "empty or skipped"
  });

  return {
    deliverables: out,
    diagnostics: {
      geminiAvailable: true,
      groupResults,
      filledKeys: Object.keys(out)
    }
  };
}
