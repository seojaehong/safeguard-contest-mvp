import OpenAI from "openai";
import { AskResponse, SearchResult } from "./types";
import { buildMockAskResponse } from "./mock-data";

const apiKey = process.env.OPENAI_API_KEY;
const RESPONSE_TIMEOUT_MS = 20_000;
const RETRY_DELAY_MS = 500;

async function wait(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function withTimeout<T>(task: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeoutHandle: NodeJS.Timeout | undefined;

  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutHandle = setTimeout(() => reject(new Error(`${label} timeout after ${timeoutMs}ms`)), timeoutMs);
  });

  try {
    return await Promise.race([task, timeoutPromise]);
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
}

async function withRetry<T>(runner: () => Promise<T>, attempts: number, label: string): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await runner();
    } catch (error) {
      lastError = error;
      if (attempt < attempts - 1) {
        await wait(RETRY_DELAY_MS);
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`${label} failed`);
}

export async function generateAnswer(question: string, citations: SearchResult[]): Promise<AskResponse> {
  if (!apiKey) {
    return buildMockAskResponse(
      question,
      citations,
      "mock",
      "OPENAI_API_KEY가 없어 AI 호출 없이 데모 산출물을 구성했습니다."
    );
  }

  const client = new OpenAI({ apiKey });
  const prompt = [
    "당신은 산업안전/노무 실무용 리서치 코파일럿이다.",
    "질문에 대해 과장 없이 한국어로 답하라.",
    "실무 체크포인트 3개를 포함하라.",
    "반드시 제공된 근거 목록 범위 안에서만 답하라.",
    "근거 목록:",
    ...citations.map((c, i) => `${i + 1}. ${c.title} | ${c.summary} | ${c.citation || ""}`),
    `질문: ${question}`
  ].join("\n");

  const response = await withRetry(
    () =>
      withTimeout(
        client.responses.create({
          model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
          input: prompt
        }),
        RESPONSE_TIMEOUT_MS,
        "OpenAI response"
      ),
    2,
    "OpenAI response"
  );

  const answer = response.output_text || "답변을 생성하지 못했습니다.";
  const live = buildMockAskResponse(
    question,
    citations,
    "live",
    "Law.go와 AI 응답을 결합한 라이브 모드입니다."
  );
  return {
    ...live,
    answer,
    status: {
      ...live.status,
      lawgo: "live" as const,
      ai: "live" as const,
      policyNote: "OpenAI 응답은 timeout 20초, 1회 retry, 실패 시 graceful fallback 정책을 따릅니다."
    }
  };
}
