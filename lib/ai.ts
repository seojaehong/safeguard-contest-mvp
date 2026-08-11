import OpenAI from "openai";
import type { AskResponse, SearchResult } from "./types";
import { buildMockAskResponse } from "./mock-data";
import { generateWithVertex } from "./vertex/client";
import { resolvePositiveIntEnv } from "@/lib/ai-deliverables-policy";
import { createLogger } from "@/lib/logger";
import {
  buildPhaseACanonicalAnswer,
  buildPhaseAGenerationPrompt,
  type PhaseAGenerationGrounding,
} from "@/lib/ontology/evidence-chain";

const log = createLogger("ai");

const openAiApiKey = process.env.OPENAI_API_KEY?.trim();
const openAiModel = process.env.OPENAI_MODEL?.trim() || "gpt-4.1-mini";
const geminiModel = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
const geminiFallbackModels = (process.env.GEMINI_FALLBACK_MODELS || "gemini-2.5-flash-lite")
  .split(",")
  .map((model) => model.trim())
  .filter(Boolean);
// OpenAI free-text answer budget. 10s proved too short in prod
// (2026-07-02 smoke: "OpenAI response timeout after 10000ms" -> fallback).
const RESPONSE_TIMEOUT_MS = resolvePositiveIntEnv(process.env.OPENAI_TIMEOUT_MS, 20_000);
const GEMINI_TIMEOUT_MS = Number.parseInt(process.env.GEMINI_TIMEOUT_MS || "25000", 10);
const RETRY_DELAY_MS = 500;

function safeGenerationFailureContext(error: unknown): { errorType: string; timeout: boolean } {
  return {
    errorType: error instanceof Error ? error.name : typeof error,
    timeout: error instanceof Error && /timeout/i.test(error.message)
  };
}

type ProviderGenerationResult = {
  answer: string;
  providerLabel: string;
  policyNote: string;
  provider: "openai" | "vertex";
  model: string;
  fallbackUsed: boolean;
};

export type AnswerGenerationResult = {
  response: AskResponse;
  trace: {
    provider: "openai" | "vertex" | "mock";
    model: string | null;
    fallbackUsed: boolean;
  };
};

export function applyPhaseAAnswerBoundary(
  response: AskResponse,
  grounding?: PhaseAGenerationGrounding,
): AskResponse {
  return grounding
    ? { ...response, answer: buildPhaseACanonicalAnswer(grounding) }
    : response;
}

function isVertexConfigured(): boolean {
  return Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON && process.env.GCP_PROJECT_ID);
}

async function wait(ms: number, signal?: AbortSignal) {
  signal?.throwIfAborted();
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      signal?.removeEventListener("abort", abort);
      resolve();
    }, ms);
    const abort = () => {
      clearTimeout(timeout);
      reject(signal?.reason);
    };
    signal?.addEventListener("abort", abort, { once: true });
  });
}

async function withTimeout<T>(
  runner: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  label: string,
  callerSignal?: AbortSignal,
): Promise<T> {
  const controller = new AbortController();
  const abortFromCaller = () => controller.abort(callerSignal?.reason);
  callerSignal?.throwIfAborted();
  callerSignal?.addEventListener("abort", abortFromCaller, { once: true });
  let timeoutHandle: NodeJS.Timeout | undefined;
  timeoutHandle = setTimeout(
    () => controller.abort(new Error(`${label} timeout after ${timeoutMs}ms`)),
    timeoutMs,
  );
  try {
    return await runner(controller.signal);
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
    callerSignal?.removeEventListener("abort", abortFromCaller);
  }
}

async function withRetry<T>(
  runner: () => Promise<T>,
  attempts: number,
  label: string,
  signal?: AbortSignal,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    signal?.throwIfAborted();
    try {
      return await runner();
    } catch (error) {
      signal?.throwIfAborted();
      lastError = error;
      if (attempt < attempts - 1) {
        await wait(RETRY_DELAY_MS, signal);
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`${label} failed`);
}

async function generateWithOpenAI(prompt: string, signal?: AbortSignal): Promise<ProviderGenerationResult> {
  if (!openAiApiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  const client = new OpenAI({ apiKey: openAiApiKey });
  const response = await withRetry(
    () =>
      withTimeout(
        (requestSignal) => client.responses.create({
          model: openAiModel,
          input: prompt
        }, { signal: requestSignal }),
        RESPONSE_TIMEOUT_MS,
        "OpenAI response",
        signal,
      ),
    1,
    "OpenAI response",
    signal,
  );

  return {
    answer: response.output_text || "답변을 생성하지 못했습니다.",
    providerLabel: "OpenAI",
    policyNote: `OpenAI 응답은 timeout ${RESPONSE_TIMEOUT_MS}ms, retry 없음, 실패 시 graceful fallback 정책을 따릅니다.`,
    provider: "openai",
    model: openAiModel,
    fallbackUsed: false
  };
}

async function generateWithGeminiModel(
  prompt: string,
  model: string,
  signal?: AbortSignal,
): Promise<ProviderGenerationResult> {
  // generateWithVertex handles its own timeout internally (Promise.race).
  // 1 attempt only — retry doubles wall time, which defeats the timeout budget.
  const answer = await withRetry(
    () => generateWithVertex(model, prompt, { timeoutMs: GEMINI_TIMEOUT_MS, signal }),
    1,
    `Vertex AI response (${model})`,
    signal,
  );

  return {
    answer,
    providerLabel: `Gemini via Vertex (${model})`,
    policyNote: `Vertex AI 응답은 timeout ${GEMINI_TIMEOUT_MS}ms, 1회 retry, 실패 시 graceful fallback 정책을 따릅니다.`,
    provider: "vertex",
    model,
    fallbackUsed: false
  };
}

async function generateWithGemini(prompt: string, signal?: AbortSignal): Promise<ProviderGenerationResult> {
  const models = [...new Set([geminiModel, ...geminiFallbackModels])];
  let lastError: unknown;

  for (const [index, model] of models.entries()) {
    signal?.throwIfAborted();
    try {
      const result = await generateWithGeminiModel(prompt, model, signal);
      return { ...result, fallbackUsed: index > 0 };
    } catch (error) {
      signal?.throwIfAborted();
      lastError = error;
      log.error(`Gemini model failed: ${model}`, safeGenerationFailureContext(error));
      // Skip fallback models on timeout — they are unlikely to respond faster.
      if (error instanceof Error && /timeout/i.test(error.message)) break;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Gemini model chain failed");
}

function trimCitationText(text: string, maxLength: number) {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trimEnd()}…`;
}

function buildPrompt(
  question: string,
  citations: SearchResult[],
  phaseAGrounding?: PhaseAGenerationGrounding,
) {
  const trimmedQuestion = trimCitationText(question.trim(), 220);
  const compactCitations = citations.slice(0, 4).map((citation, index) => {
    const title = trimCitationText(citation.title, 60);
    const summary = trimCitationText(citation.summary, 100);
    const citationText = trimCitationText(citation.citation || "", 40);
    return `${index + 1}. ${title} | ${summary}${citationText ? ` | ${citationText}` : ""}`;
  });

  return [
    ...(phaseAGrounding ? [buildPhaseAGenerationPrompt(phaseAGrounding), ""] : []),
    "당신은 산업안전 실무용 코파일럿이다.",
    "사용자가 현장 조건을 제공하면, 법정 제출 최종본이 아니라 현장 검토용 초안을 바로 작성하라.",
    "현장 실측값이 부족하다는 이유로 생성을 거절하지 말고, 부족한 항목은 '현장 확인 필요'로 표시하라.",
    "'직접 생성은 불가능합니다', '제공할 수 없습니다' 같은 거절 문장으로 시작하지 말라.",
    "반드시 제공된 근거 목록 범위 안에서만 한국어로 답하라.",
    "법령정보를 먼저 근거로 삼고, 판례와 해석례는 보조 근거로만 연결하라.",
    "출력 순서는 1) 핵심 판단 2) 즉시 조치 3) 실무 체크포인트 3개다.",
    "불확실한 내용은 단정하지 말고 검토 필요라고 표현하라.",
    "근거 목록:",
    ...compactCitations,
    `질문: ${trimmedQuestion}`
  ].join("\n");
}

type CitationMapping = {
  id: string;
  summary: string;
  tags: string[];
  rank: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map(readString).filter(Boolean).slice(0, 6);
}

function extractJsonArray(text: string) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] || text;
  const start = candidate.indexOf("[");
  const end = candidate.lastIndexOf("]");
  if (start < 0 || end < start) return [];
  const parsed = JSON.parse(candidate.slice(start, end + 1)) as unknown;
  return Array.isArray(parsed) ? parsed : [];
}

function parseCitationMappings(text: string): CitationMapping[] {
  try {
    return extractJsonArray(text)
      .map((item): CitationMapping | null => {
        if (!isRecord(item)) return null;
        const id = readString(item.id);
        const summary = readString(item.summary);
        const rankValue = item.rank;
        const rank = typeof rankValue === "number" && Number.isFinite(rankValue) ? rankValue : 999;
        if (!id || !summary) return null;
        return {
          id,
          summary: trimCitationText(summary, 180),
          tags: readStringArray(item.tags),
          rank
        };
      })
      .filter((item): item is CitationMapping => Boolean(item));
  } catch (error) {
    log.error("Failed to parse Gemini citation mapping JSON", safeGenerationFailureContext(error));
    return [];
  }
}

function buildCitationMappingPrompt(
  question: string,
  citations: SearchResult[],
  phaseAGrounding?: PhaseAGenerationGrounding,
) {
  const evidence = citations.slice(0, 10).map((item, index) => ({
    index: index + 1,
    id: item.id,
    type: item.type,
    title: trimCitationText(item.title, 120),
    summary: trimCitationText(item.summary, 180),
    citation: trimCitationText(item.citation || "", 80),
    source: item.sourceLabel
  }));

  return [
    ...(phaseAGrounding ? [buildPhaseAGenerationPrompt(phaseAGrounding), ""] : []),
    "당신은 산업안전 문서팩의 근거 매핑 편집자다.",
    "목표는 검색된 법령·해석례·판례를 오늘 작업 조건에 맞게 재정렬하고, 화면과 문서에 들어갈 '연결 이유'를 짧고 정확하게 쓰는 것이다.",
    "절대 새로운 법령, 사건번호, 출처, 사실관계를 만들지 말라. 제공된 id만 사용하라.",
    "법령은 1차 근거, 해석례는 적용범위 보조 근거, 판례는 이행 여부 점검 보조 근거로만 설명하라.",
    "현재 작업과 약한 근거는 낮은 순위로 보내고, summary에 '직접 근거가 아니라 보조 검토 근거'라고 명시하라.",
    "반드시 JSON 배열만 반환하라. 각 원소 형식은 {\"id\":\"...\",\"rank\":1,\"summary\":\"...\",\"tags\":[\"위험성평가\",\"TBM\"]} 이다.",
    "summary는 한국어 90자 안팎으로 쓰고, 어떤 문서에 반영되는지 포함하라.",
    `작업 조건: ${trimCitationText(question.trim(), 420)}`,
    `근거 후보 JSON: ${JSON.stringify(evidence)}`
  ].join("\n");
}

export async function enhanceLegalEvidenceMappings(
  question: string,
  citations: SearchResult[],
  phaseAGrounding?: PhaseAGenerationGrounding,
  signal?: AbortSignal,
): Promise<SearchResult[]> {
  if (!citations.length || (!isVertexConfigured() && !openAiApiKey)) return citations;

  const prompt = buildCitationMappingPrompt(question, citations, phaseAGrounding);
  const response = isVertexConfigured()
      ? await generateWithGemini(prompt, signal).catch((error) => {
        signal?.throwIfAborted();
        if (!openAiApiKey) throw error;
        log.error(
          "Vertex AI legal evidence mapping failed; falling back to OpenAI",
          safeGenerationFailureContext(error)
        );
        return generateWithOpenAI(prompt, signal);
      })
    : await generateWithOpenAI(prompt, signal);

  const mappings = parseCitationMappings(response.answer);
  if (!mappings.length) return citations;

  const byId = new Map(mappings.map((item) => [item.id, item]));
  return citations
    .map((citation) => {
      const mapping = byId.get(citation.id);
      if (!mapping) return citation;
      return {
        ...citation,
        summary: mapping.summary,
        tags: [...new Set([...(citation.tags || []), ...mapping.tags, "AI 근거매핑"])]
      };
    })
    .sort((left, right) => {
      const leftRank = byId.get(left.id)?.rank ?? 999;
      const rightRank = byId.get(right.id)?.rank ?? 999;
      return leftRank - rightRank;
    });
}

export async function generateAnswer(
  question: string,
  citations: SearchResult[],
  options: { traceId: string; phaseAGrounding?: PhaseAGenerationGrounding; signal?: AbortSignal }
): Promise<AnswerGenerationResult> {
  options.signal?.throwIfAborted();
  if (!isVertexConfigured() && !openAiApiKey) {
    const trace = { provider: "mock", model: null, fallbackUsed: false } as const;
    log.info("safeclaw_answer_trace", {
      event: "safeclaw_answer_trace",
      traceId: options.traceId,
      ...trace
    });
    return {
      response: applyPhaseAAnswerBoundary(buildMockAskResponse(
        question,
        citations,
        "mock",
        "AI 제공자 키가 없어 규정 기반 문서팩으로 구성했습니다."
      ), options.phaseAGrounding),
      trace
    };
  }

  const prompt = buildPrompt(question, citations, options.phaseAGrounding);

  const response = isVertexConfigured()
    ? await generateWithGemini(prompt, options.signal).catch((error) => {
        options.signal?.throwIfAborted();
        if (!openAiApiKey) throw error;
        log.error("Vertex AI model chain failed; falling back to OpenAI", safeGenerationFailureContext(error));
        return generateWithOpenAI(prompt, options.signal).then((fallback) => ({ ...fallback, fallbackUsed: true }));
      })
    : await generateWithOpenAI(prompt, options.signal);

  const live = buildMockAskResponse(
    question,
    citations,
    "live",
    `Law.go와 ${response.providerLabel} 응답을 결합했습니다.`
  );
  const trace = {
    provider: response.provider,
    model: response.model,
    fallbackUsed: response.fallbackUsed
  };
  log.info("safeclaw_answer_trace", {
    event: "safeclaw_answer_trace",
    traceId: options.traceId,
    ...trace
  });
  return {
    response: applyPhaseAAnswerBoundary({
      ...live,
      answer: response.answer,
      status: {
        ...live.status,
        lawgo: "live" as const,
        ai: "live" as const,
        policyNote: response.policyNote
      }
    }, options.phaseAGrounding),
    trace
  };
}

export async function generateKnowledgeText(prompt: string) {
  if (!isVertexConfigured() && !openAiApiKey) {
    return {
      configured: false,
      text: "",
      providerLabel: null,
      policyNote: "AI 제공자 키가 없어 지식 위키 초안을 생성하지 않았습니다."
    };
  }

  const response = isVertexConfigured()
    ? await generateWithGemini(prompt).catch((error) => {
        if (!openAiApiKey) throw error;
        log.error(
          "Vertex AI knowledge generation failed; falling back to OpenAI",
          safeGenerationFailureContext(error)
        );
        return generateWithOpenAI(prompt);
      })
    : await generateWithOpenAI(prompt);

  return {
    configured: true,
    text: response.answer,
    providerLabel: response.providerLabel,
    policyNote: response.policyNote
  };
}
