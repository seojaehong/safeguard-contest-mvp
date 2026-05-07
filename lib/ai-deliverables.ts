// AI-generated deliverables (Track C).
// Replaces the template-driven deliverables in mock-data.ts with Gemini output for
// every per-document body. Uses 3 parallel calls grouped by output type to stay under
// per-call token limits while keeping wall-clock latency at ~30-60s.
//
// Each call asks for JSON only. Parsing is defensive: if Gemini returns malformed
// JSON or omits a field, callers keep the template fallback.

import type { AskResponse, SearchResult } from "@/lib/types";

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

function tabularPrompt(ctx: GenContext) {
  return [
    persona(),
    "",
    "다음 5개의 표 양식 본문을 모두 작성하고 JSON 객체로 반환하라:",
    "  - riskAssessmentDraft: 위험성평가표(초안). [기본정보] [1.사전준비] [2.유해·위험요인 파악] (4M 표시) [3.위험성 결정] (가능성/중대성/등급) [4.감소대책 수립 및 실행] [5.공유·교육] [6.조치 확인] 섹션 포함. 위험요인은 5~7개를 시나리오에 맞게 발굴.",
    "  - workPlanDraft: 작업계획서(초안). 작업개요 / 세부 작업순서 / 장비·인원·첨부서류 / 작업중지 기준 / 비상대응 / 확인자 서명.",
    "  - tbmBriefing: TBM 브리핑(초안). 일시/장소/대상/오늘 작업/위험요인/안전대책/작업중지 기준/참석자 확인/사진증빙 위치/교육시간 인정 검토/확인질문.",
    "  - tbmLogDraft: TBM 일지(초안). 결재/공종/일자/근로자 확인사항/금일 작업/금일 위험요인/일일 안전교육/참석자명단/인원집계/미조치 및 사진증빙.",
    "  - safetyEducationRecordDraft: 안전보건교육 기록(초안). 교육명/구분/일시/장소/대상/실시자/확인자/교육내용(법령조항 명시)/이해확인방법/TBM 연계/후속 교육 추천.",
    "추가로 같은 JSON 객체에 다음 보조 배열도 함께 채워라:",
    "  - safetyEducationPoints: 강조사항 5개 짧은 문장 배열.",
    "  - tbmQuestions: TBM 마무리 확인질문 5개 배열.",
    "",
    "각 본문은 줄바꿈(\\n)을 포함한 일반 텍스트(섹션 헤더는 [제목] 형태). 길이 1500~3500자 권장.",
    "",
    "응답 JSON 스키마:",
    `{
  "riskAssessmentDraft": "string",
  "workPlanDraft": "string",
  "tbmBriefing": "string",
  "tbmLogDraft": "string",
  "safetyEducationRecordDraft": "string",
  "safetyEducationPoints": ["string", "string", "string", "string", "string"],
  "tbmQuestions": ["string", "string", "string", "string", "string"]
}`,
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

export async function generateAllDeliverables(opts: GenerateAllOptions): Promise<AiDeliverables> {
  if (!geminiApiKey) return {};
  const ctx = buildContext(opts);
  const scope = opts.scope || "full";

  const tabularPromise = callGemini(tabularPrompt(ctx));
  const freePromise = scope === "full" ? callGemini(freeFormPrompt(ctx)) : Promise.reject(new Error("skipped (enhanced scope)"));
  const foreignPromise = scope === "full" ? callGemini(foreignWorkerPrompt(ctx)) : Promise.reject(new Error("skipped (enhanced scope)"));

  const [tabularRaw, freeRaw, foreignRaw] = await Promise.allSettled([
    tabularPromise,
    freePromise,
    foreignPromise
  ]);

  const out: AiDeliverables = {};

  if (tabularRaw.status === "fulfilled") {
    const parsed = safeParseJson<AiDeliverables>(tabularRaw.value);
    if (parsed) {
      for (const k of [
        "riskAssessmentDraft",
        "workPlanDraft",
        "tbmBriefing",
        "tbmLogDraft",
        "safetyEducationRecordDraft"
      ] as const) {
        const v = parsed[k];
        if (typeof v === "string" && v.length > 100) out[k] = v;
      }
      if (Array.isArray(parsed.safetyEducationPoints)) {
        out.safetyEducationPoints = parsed.safetyEducationPoints.filter((s) => typeof s === "string");
      }
      if (Array.isArray(parsed.tbmQuestions)) {
        out.tbmQuestions = parsed.tbmQuestions.filter((s) => typeof s === "string");
      }
    }
  }

  if (freeRaw.status === "fulfilled") {
    const parsed = safeParseJson<AiDeliverables>(freeRaw.value);
    if (parsed) {
      for (const k of [
        "workpackSummaryDraft",
        "emergencyResponseDraft",
        "photoEvidenceDraft",
        "kakaoMessage"
      ] as const) {
        const v = parsed[k];
        if (typeof v === "string" && v.length > 100) out[k] = v;
      }
    }
  }

  if (foreignRaw.status === "fulfilled") {
    const parsed = safeParseJson<AiDeliverables>(foreignRaw.value);
    if (parsed) {
      for (const k of ["foreignWorkerBriefing", "foreignWorkerTransmission"] as const) {
        const v = parsed[k];
        if (typeof v === "string" && v.length > 200) out[k] = v;
      }
      if (Array.isArray(parsed.foreignWorkerLanguages)) {
        out.foreignWorkerLanguages = parsed.foreignWorkerLanguages.filter((s) => typeof s === "string");
      }
    }
  }

  return out;
}

export type AiDeliverablesDiagnostics = {
  geminiAvailable: boolean;
  groupResults: Array<{ group: "tabular" | "free" | "foreign"; status: "fulfilled" | "rejected"; reason?: string }>;
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
  const [tabularRaw, freeRaw, foreignRaw] = await Promise.allSettled([
    callGemini(tabularPrompt(ctx)),
    scope === "full" ? callGemini(freeFormPrompt(ctx)) : Promise.reject(new Error("skipped (enhanced)")),
    scope === "full" ? callGemini(foreignWorkerPrompt(ctx)) : Promise.reject(new Error("skipped (enhanced)"))
  ]);
  const out: AiDeliverables = {};
  const groupResults: AiDeliverablesDiagnostics["groupResults"] = [];

  for (const [name, raw] of [
    ["tabular", tabularRaw],
    ["free", freeRaw],
    ["foreign", foreignRaw]
  ] as const) {
    if (raw.status === "fulfilled") {
      const parsed = safeParseJson<AiDeliverables>(raw.value);
      if (!parsed) {
        // 디버깅: parse 실패 시 raw 응답의 시작/끝 일부를 로그로 남겨 패턴 분석.
        // 32K 토큰 초과 truncation이면 끝이 잘려 있고, 마크다운 fence 감싸기면 시작에 ```가 보임.
        const head = raw.value.slice(0, 200).replace(/\n/g, "\\n");
        const tail = raw.value.slice(-200).replace(/\n/g, "\\n");
        console.error(`[AI ${name}] safeParseJson failed. head=${head} ... tail=${tail}`);
      }
      groupResults.push({ group: name, status: "fulfilled", reason: parsed ? undefined : "json parse failed" });
      if (parsed) Object.assign(out, parsed);
    } else {
      groupResults.push({
        group: name,
        status: "rejected",
        reason: raw.reason instanceof Error ? raw.reason.message : String(raw.reason)
      });
    }
  }

  return {
    deliverables: out,
    diagnostics: {
      geminiAvailable: true,
      groupResults,
      filledKeys: Object.keys(out)
    }
  };
}
