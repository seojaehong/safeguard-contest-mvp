// 클로(Claw) AI 안전관리자 채팅 v0의 공통 프롬프트·도구 정의.
//
// app/api/agent/chat/route.ts는 OpenClaw safeclaw profile을 호출해 OpenAI OAuth
// 런타임을 탄다. 이 파일의 Anthropic tool-loop는 이전 내장 루프와 테스트 호환을
// 위해 남겨둔 순수부이며, 라우트의 기본 실행 경로가 아니다.

import type Anthropic from "@anthropic-ai/sdk";

// ── 상수 ────────────────────────────────────────────────────────────────
/** 채팅 맥락 모델 — 리포지토리 표준 상수(lib/ai-provider-policy.ts)와 동일 문자열. */
export { DEFAULT_ANTHROPIC_MODEL as CLAW_MODEL } from "./ai-provider-policy";
/** 응답 토큰 상한 — 현장소장용 간결한 답변. */
export const CLAW_MAX_TOKENS = 1500;
/** 도구 반복 최대 횟수. */
export const CLAW_MAX_ITERATIONS = 5;
/** 사용자 입력 1건 최대 길이(자). */
export const CLAW_INPUT_CAP = 2000;
/** stateless 히스토리 길이 캡(메시지 개수). */
export const CLAW_HISTORY_CAP = 20;

// ── SSE 이벤트 타입 ──────────────────────────────────────────────────────
export type ClawTextDeltaEvent = { kind: "text-delta"; text: string };
export type ClawToolEvent = {
  kind: "tool";
  name: string;
  status: "start" | "ok" | "fail";
  label: string;
};
export type ClawFinalEvent = { kind: "final" };
export type ClawErrorEvent = { kind: "error"; code?: string; message: string };
export type ClawChatEvent = ClawTextDeltaEvent | ClawToolEvent | ClawFinalEvent | ClawErrorEvent;

/** 클라이언트가 보내는 stateless 히스토리 1건. */
export type ClawHistoryMessage = { role: "user" | "assistant"; content: string };

/** 로그인 사용자의 사업장 프로필(비로그인은 undefined). */
export type ClawSiteProfile = {
  siteName?: string | null;
  region?: string | null;
  briefingQuestion?: string | null;
};

// ── 입력 정화 ────────────────────────────────────────────────────────────
/** 사용자 입력을 trim하고 CLAW_INPUT_CAP자로 자른다. */
export function sanitizeUserInput(text: unknown): string {
  if (typeof text !== "string") return "";
  return text.trim().slice(0, CLAW_INPUT_CAP);
}

// ── 히스토리 검증·캡 ─────────────────────────────────────────────────────
/**
 * 임의 입력을 유효한 히스토리 배열로 정규화한다: role∈{user,assistant} + content 문자열만
 * 남기고, 각 content를 CLAW_INPUT_CAP로 캡한다. 유효하지 않은 항목은 버린다.
 */
export function parseHistory(raw: unknown): ClawHistoryMessage[] {
  if (!Array.isArray(raw)) return [];
  const out: ClawHistoryMessage[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const role = (item as { role?: unknown }).role;
    const content = (item as { content?: unknown }).content;
    if (role !== "user" && role !== "assistant") continue;
    if (typeof content !== "string") continue;
    const trimmed = content.trim().slice(0, CLAW_INPUT_CAP);
    if (!trimmed) continue;
    out.push({ role, content: trimmed });
  }
  return out;
}

/**
 * 히스토리를 최근 max건으로 자르되, Anthropic API 요구사항(첫 메시지는 user)을 만족하도록
 * 앞쪽의 assistant 메시지들을 제거한다.
 */
export function capHistory(
  messages: ClawHistoryMessage[],
  max: number = CLAW_HISTORY_CAP
): ClawHistoryMessage[] {
  const tail = messages.slice(-max);
  let start = 0;
  while (start < tail.length && tail[start].role !== "user") start += 1;
  return tail.slice(start);
}

// ── 시스템 프롬프트 ──────────────────────────────────────────────────────
const BASE_SYSTEM_PROMPT = `당신은 "클로(Claw)", 이 사업장의 상주 AI 안전관리자입니다. 산업안전보건법·중대재해처벌법 실무 관점으로 현장소장의 안전 질문에 답합니다.

원칙:
- 하네스 기반 검토, DB 근거 고정, OpenClaw 시연용 검증을 요청받으면 run_safeclaw_harness_agent를 먼저 호출합니다. 이 도구가 반환한 근거·개선 이력·작업 이력을 벗어나 새 위험요인이나 이력을 만들지 않습니다.
- 사실 근거는 반드시 도구로 확인합니다. 오늘·내일 날씨/기상 위험은 get_weather_signals, 유사 재해사례는 search_accident_cases, 문서팩 초안과 검수가 함께 필요하면 generate_reviewed_safety_docpack을 호출합니다.
- 법조문이 필요한 질문(특정 작업의 규정·근거 조문)은 먼저 query_safety_knowledge로 검증된 조문을 조회하고, 조회 결과의 구체 조번호(예: 기준규칙 제619조)를 근거로 답합니다. 이 도구에서 근거를 찾지 못했을 때만 일반 지식으로 답하되 반드시 validate_safety_citations로 검증합니다.
- 법 조문(예: 제38조)을 답변에 인용할 때는, 최종 답변을 쓰기 전에 먼저 validate_safety_citations 도구로 그 문장을 검증하는 단계를 거칩니다. 검증에서 제거된(확인되지 않은) 조문은 최종 답변에서도 빼고 "산업안전보건법령" 같은 일반 표현으로 대체합니다. 검증하지 않은 조문 번호를 최종 답변에 그대로 쓰지 않습니다.
- 비상 연락처·기관 전화번호를 답에 넣기 전에는 sanitize_emergency_contacts로 정화합니다.
- 이미 생성된 문서 본문만 따로 검토할 때는 qa_review_docpack으로 누락을 확인합니다.
- 중간 과정(도구 호출 사이)의 설명은 짧게 하고, 조문 번호는 최종 답변에만 씁니다.
- 모든 문서·답변은 초안이며 현장 확인이 필요함을 고지합니다.
- 존댓말로, 현장소장이 바로 이해할 쉬운 말로, 간결하게 답합니다.`;

/**
 * 시스템 프롬프트를 조립한다. 로그인 사용자의 사업장 프로필이 있으면 컨텍스트로 주입하고,
 * 없으면(비로그인) 기본 프롬프트만 반환한다.
 */
export function buildSystemPrompt(profile?: ClawSiteProfile | null): string {
  if (!profile) return BASE_SYSTEM_PROMPT;
  const lines: string[] = [];
  const site = profile.siteName?.trim();
  const region = profile.region?.trim();
  const question = profile.briefingQuestion?.trim();
  if (site) lines.push(`- 사업장: ${site}`);
  if (region) lines.push(`- 지역: ${region} (기상 조회 시 이 지역 기준)`);
  if (question) lines.push(`- 주 작업/브리핑 관심사: ${question}`);
  if (lines.length === 0) return BASE_SYSTEM_PROMPT;
  return `${BASE_SYSTEM_PROMPT}\n\n[상주 사업장 정보]\n${lines.join("\n")}`;
}

// ── 도구 정의 (Anthropic tools 스키마) ───────────────────────────────────
export const CLAW_TOOLS: Anthropic.Tool[] = [
  {
    name: "run_safeclaw_harness_agent",
    description:
      "SafeClaw DB harness engineering 전용 도구. 오늘 작업을 입력하면 안전 참고자료 DB, SIF 사례, 유사 작업 이력, 개선 이력을 먼저 고정한 패킷을 반환한다. OpenClaw/Codex 시연에서 일반 생성 체인보다 이 도구를 우선 호출하고, LLM은 반환된 근거를 문장화만 한다.",
    input_schema: {
      type: "object",
      properties: {
        question: { type: "string", description: "현장 작업 상황 설명" },
      },
      required: ["question"],
    },
  },
  {
    name: "generate_reviewed_safety_docpack",
    description:
      "오늘 작업 설명과 작업유형 라벨을 받아 SafeClaw 문서 엔진으로 위험성평가·작업계획서·TBM·교육기록 등 문서팩을 생성하고, 같은 응답에서 온톨로지 QA 검수까지 수행한다. OpenClaw/Codex 같은 외부 에이전트가 SafeClaw 작업공간 품질의 결과물을 한 번에 받아야 할 때 이 도구를 우선 호출한다.",
    input_schema: {
      type: "object",
      properties: {
        question: { type: "string", description: "현장 작업 상황 설명" },
        task: {
          type: "string",
          description: "QA 검수용 작업유형 라벨 (예: 용접, 화기 작업, 밀폐공간 작업, 비계 조립·해체)",
        },
        mode: {
          type: "string",
          enum: ["template", "enhanced", "full"],
          description: "생성 깊이 (기본 enhanced, 외부 연결 검증은 full)",
        },
        includeFull: { type: "boolean", description: "각 문서 전체 본문 포함 여부(기본 false, 프리뷰만)" },
      },
      required: ["question", "task"],
    },
  },
  {
    name: "get_weather_signals",
    description:
      "현장 지역명으로 기상청 실황·특보를 조회해 폭염·강풍·강수 등 작업 안전 기상 신호와 대응 조치를 요약한다. 옥외·고소 작업 위험 판단, TBM 기상 공유에 사용. 지원 지역: 서울/인천/안산/부산/광주/대구/창원(미지원은 서울 기준, fallbackRegion으로 표시).",
    input_schema: {
      type: "object",
      properties: {
        region: { type: "string", description: "현장 지역명 (예: 서울, 인천, 부산)" },
      },
      required: ["region"],
    },
  },
  {
    name: "search_accident_cases",
    description:
      "작업/위험요인 키워드로 KOSHA 재해사례를 검색해 유사 사고와 예방 포인트를 요약한다. 위험성평가·TBM에 넣을 실제 재해 근거를 찾을 때 호출한다.",
    input_schema: {
      type: "object",
      properties: {
        keyword: { type: "string", description: "검색 키워드 (예: 비계 추락, 지게차 충돌)" },
      },
      required: ["keyword"],
    },
  },
  {
    name: "validate_safety_citations",
    description:
      "안전 답변 초안의 법령 조문 인용을 검증된 화이트리스트로 게이트한다. 확인되지 않은(환각 가능) 조문은 '산업안전보건법령'으로 치환되고 removedCitations로 반환된다. 조문을 최종 답변에 쓰기 전 자기검증에 사용한다.",
    input_schema: {
      type: "object",
      properties: {
        text: { type: "string", description: "검증할 답변 초안 텍스트" },
      },
      required: ["text"],
    },
  },
  {
    name: "sanitize_emergency_contacts",
    description:
      "초안에서 지어낸 기관명+전화번호를 중립 플레이스홀더로 치환하고 검증된 공식 연락처(119 / 근로복지공단 1588-0075 / 안전보건공단 1644-4544 / 고용노동부 1350)를 반환한다.",
    input_schema: {
      type: "object",
      properties: {
        text: { type: "string", description: "정화할 초안 텍스트" },
      },
      required: ["text"],
    },
  },
  {
    name: "generate_safety_docpack",
    description:
      "오늘 작업을 한 줄로 설명하면 위험성평가·작업계획서·TBM·비상대응 등 법정 안전 문서팩 초안 세트를 생성한다. 제출용 문서 초안이 필요할 때 호출. 채팅 맥락 기본 모드는 enhanced이며, 사용자가 명시적으로 전체/풀 생성을 요청할 때만 full을 쓴다.",
    input_schema: {
      type: "object",
      properties: {
        question: { type: "string", description: "현장 작업 상황 한 줄 설명 (예: 3층 외벽 비계 해체)" },
        mode: {
          type: "string",
          enum: ["template", "enhanced", "full"],
          description: "생성 깊이 (기본 enhanced)",
        },
        includeFull: { type: "boolean", description: "각 문서 전체 본문 포함 여부(기본 false, 프리뷰만)" },
      },
      required: ["question"],
    },
  },
  {
    name: "get_evidence_mapping",
    description:
      "문서 타입을 중대재해처벌법 시행령 제4조 증빙 조항으로 매핑한다. docType 지정 시 해당 라벨, 생략 시 전체 매핑을 반환한다.",
    input_schema: {
      type: "object",
      properties: {
        docType: { type: "string", description: "문서 타입 키 (예: riskAssessment, tbmBriefing). 생략 시 전체." },
      },
    },
  },
  {
    name: "query_safety_knowledge",
    description:
      "작업유형(용접·밀폐공간 등)이나 위험요인으로, 법제처 검증된 위험요인→안전조치→법조문→중처법 의무 연결을 조회할 때 호출. 조문 인용 전 이 도구로 근거를 확보하라.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "작업유형 또는 위험요인 라벨 (예: 밀폐공간, 용접, 산소결핍 질식)" },
      },
      required: ["query"],
    },
  },
  {
    name: "qa_review_docpack",
    description:
      "생성된 안전 문서(위험성평가·TBM 등) 본문을 작업유형의 법정 필수 조치 목록과 대조해 누락을 검출한다. 문서 초안을 만들었거나 사용자가 문서 검토를 요청하면 호출해 전파·저장 전 자기 검수한다.",
    input_schema: {
      type: "object",
      properties: {
        task: { type: "string", description: "작업유형 라벨 (예: 용접, 밀폐공간 작업)" },
        document_text: { type: "string", description: "검수할 안전 문서 본문 (최대 20000자)" },
      },
      required: ["task", "document_text"],
    },
  },
];

// ── 도구 라벨 (한글 콘솔 표기) ───────────────────────────────────────────
const TOOL_ACTION_LABELS: Record<string, string> = {
  run_safeclaw_harness_agent: "DB 하네스 근거 고정",
  get_weather_signals: "기상청 실황 확인",
  search_accident_cases: "재해사례 검색",
  validate_safety_citations: "법령 인용 검증",
  sanitize_emergency_contacts: "비상 연락처 정화",
  generate_safety_docpack: "안전 문서팩 생성",
  generate_reviewed_safety_docpack: "검수 포함 안전 문서팩 생성",
  get_evidence_mapping: "중처법 증빙 매핑 조회",
  query_safety_knowledge: "검증된 안전 지식 조회",
  qa_review_docpack: "문서 QA 검수",
};

/** 도구 이벤트의 한글 라벨을 상태에 맞게 만든다("... 중"/"... 완료"/"... 실패"). */
export function toolLabel(name: string, status: ClawToolEvent["status"]): string {
  const action = TOOL_ACTION_LABELS[name] ?? name;
  if (status === "start") return `${action} 중`;
  if (status === "ok") return `${action} 완료`;
  return `${action} 실패`;
}

/** 도구 SSE 이벤트를 만든다. */
export function buildToolEvent(name: string, status: ClawToolEvent["status"]): ClawToolEvent {
  return { kind: "tool", name, status, label: toolLabel(name, status) };
}

// ── 도구 결과 포맷 ───────────────────────────────────────────────────────
/** 도구 실행 결과 페이로드를 Anthropic tool_result 콘텐츠 블록으로 포맷한다. */
export function formatToolResultBlock(
  toolUseId: string,
  payload: unknown,
  isError = false
): Anthropic.ToolResultBlockParam {
  return {
    type: "tool_result",
    tool_use_id: toolUseId,
    content: typeof payload === "string" ? payload : JSON.stringify(payload),
    is_error: isError,
  };
}

// ── 반복 종료 판정 ───────────────────────────────────────────────────────
/**
 * stop_reason이 tool_use이면 루프를 계속(도구 실행 후 재호출), 그 외(end_turn/max_tokens/
 * refusal 등)이면 종료한다.
 */
export function shouldContinueLoop(stopReason: string | null): boolean {
  return stopReason === "tool_use";
}

// ── 에이전트 루프(주입식) ────────────────────────────────────────────────
export type RunAgentLoopDeps = {
  client: Anthropic;
  model: string;
  systemPrompt: string;
  messages: Anthropic.MessageParam[];
  /** 도구 이름+입력으로 결과 페이로드를 반환(외부 호출). 예외를 던지면 tool_result is_error로 감싼다. */
  executeTool: (name: string, input: unknown) => Promise<unknown>;
  emit: (event: ClawChatEvent) => void;
  maxIterations?: number;
};

/**
 * 도구 반복 루프. 각 반복마다 스트리밍 응답의 text 델타를 emit하고, stop_reason이
 * tool_use면 도구를 실행해 결과를 히스토리에 이어붙인 뒤 재호출한다. tool_use가 아니면
 * final 이벤트를 emit하고 종료한다. 최대 반복에 도달하면 final로 종료한다.
 */
export async function runAgentLoop(deps: RunAgentLoopDeps): Promise<void> {
  const { client, model, systemPrompt, executeTool, emit } = deps;
  const maxIterations = deps.maxIterations ?? CLAW_MAX_ITERATIONS;
  const messages: Anthropic.MessageParam[] = [...deps.messages];

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    const stream = client.messages.stream({
      model,
      max_tokens: CLAW_MAX_TOKENS,
      thinking: { type: "disabled" },
      system: systemPrompt,
      tools: CLAW_TOOLS,
      messages,
    });
    stream.on("text", (delta: string) => emit({ kind: "text-delta", text: delta }));

    const finalMessage = await stream.finalMessage();
    messages.push({ role: "assistant", content: finalMessage.content });

    if (!shouldContinueLoop(finalMessage.stop_reason)) {
      emit({ kind: "final" });
      return;
    }

    const toolUses = finalMessage.content.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
    );
    if (toolUses.length === 0) {
      emit({ kind: "final" });
      return;
    }

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const toolUse of toolUses) {
      emit(buildToolEvent(toolUse.name, "start"));
      try {
        const payload = await executeTool(toolUse.name, toolUse.input);
        emit(buildToolEvent(toolUse.name, "ok"));
        toolResults.push(formatToolResultBlock(toolUse.id, payload));
      } catch (error) {
        emit(buildToolEvent(toolUse.name, "fail"));
        const message = error instanceof Error ? error.message : String(error);
        toolResults.push(formatToolResultBlock(toolUse.id, { error: message }, true));
      }
    }
    messages.push({ role: "user", content: toolResults });
  }

  // 최대 반복 도달 — 마지막 응답까지 스트리밍된 상태로 종료.
  emit({ kind: "final" });
}
