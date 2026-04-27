import OpenAI from "openai";
import { AskResponse, SearchResult } from "./types";
import { buildMockAskResponse } from "./mock-data";

const openAiApiKey = process.env.OPENAI_API_KEY?.trim();
const geminiApiKey = process.env.GEMINI_API_KEY?.trim();
const openAiModel = process.env.OPENAI_MODEL?.trim() || "gpt-4.1-mini";
const geminiModel = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
const geminiFallbackModels = (process.env.GEMINI_FALLBACK_MODELS || "gemini-2.0-flash,gemini-2.0-flash-lite,gemini-flash-latest")
  .split(",")
  .map((model) => model.trim())
  .filter(Boolean);
const RESPONSE_TIMEOUT_MS = 20_000;
const GEMINI_TIMEOUT_MS = Number.parseInt(process.env.GEMINI_TIMEOUT_MS || "45000", 10);
const RETRY_DELAY_MS = 500;

type GeminiGenerateContentResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
};

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

async function generateWithOpenAI(prompt: string) {
  if (!openAiApiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  const client = new OpenAI({ apiKey: openAiApiKey });
  const response = await withRetry(
    () =>
      withTimeout(
        client.responses.create({
          model: openAiModel,
          input: prompt
        }),
        RESPONSE_TIMEOUT_MS,
        "OpenAI response"
      ),
    2,
    "OpenAI response"
  );

  return {
    answer: response.output_text || "답변을 생성하지 못했습니다.",
    providerLabel: "OpenAI",
    policyNote: "OpenAI 응답은 timeout 20초, 1회 retry, 실패 시 graceful fallback 정책을 따릅니다."
  };
}

async function generateWithGeminiModel(prompt: string, model: string) {
  if (!geminiApiKey) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`;

  const response = await withRetry(
    async () =>
      withTimeout(
        fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [{ text: prompt }]
              }
            ]
          })
        }),
        GEMINI_TIMEOUT_MS,
        "Gemini response"
      ),
    2,
    "Gemini response"
  );

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`Gemini API error ${response.status}: ${errorText || "empty response"}`);
  }

  const parsed = (await response.json()) as GeminiGenerateContentResponse;
  const answer = parsed.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("").trim();

  if (!answer) {
    throw new Error("Gemini response did not include answer text");
  }

  return {
    answer,
    providerLabel: `Gemini (${model})`,
    policyNote: "Gemini 응답은 timeout 20초, 1회 retry, 실패 시 graceful fallback 정책을 따릅니다."
  };
}

async function generateWithGemini(prompt: string) {
  const models = [...new Set([geminiModel, ...geminiFallbackModels])];
  let lastError: unknown;

  for (const model of models) {
    try {
      return await generateWithGeminiModel(prompt, model);
    } catch (error) {
      lastError = error;
      console.error(`Gemini model failed: ${model}`, error);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Gemini model chain failed");
}

function trimCitationText(text: string, maxLength: number) {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trimEnd()}…`;
}

function buildPrompt(question: string, citations: SearchResult[]) {
  const trimmedQuestion = trimCitationText(question.trim(), 220);
  const compactCitations = citations.slice(0, 4).map((citation, index) => {
    const title = trimCitationText(citation.title, 60);
    const summary = trimCitationText(citation.summary, 100);
    const citationText = trimCitationText(citation.citation || "", 40);
    return `${index + 1}. ${title} | ${summary}${citationText ? ` | ${citationText}` : ""}`;
  });

  return [
    "당신은 산업안전 실무용 코파일럿이다.",
    "반드시 제공된 근거 목록 범위 안에서만 한국어로 답하라.",
    "출력 순서는 1) 핵심 판단 2) 즉시 조치 3) 실무 체크포인트 3개다.",
    "불확실한 내용은 단정하지 말고 검토 필요라고 표현하라.",
    "근거 목록:",
    ...compactCitations,
    `질문: ${trimmedQuestion}`
  ].join("\n");
}

export async function generateAnswer(question: string, citations: SearchResult[]): Promise<AskResponse> {
  if (!geminiApiKey && !openAiApiKey) {
    return buildMockAskResponse(
      question,
      citations,
      "mock",
      "GEMINI_API_KEY와 OPENAI_API_KEY가 없어 AI 호출 없이 데모 산출물을 구성했습니다."
    );
  }

  const prompt = buildPrompt(question, citations);

  const response = geminiApiKey
    ? await generateWithGemini(prompt).catch((error) => {
        if (!openAiApiKey) throw error;
        console.error("Gemini model chain failed; falling back to OpenAI", error);
        return generateWithOpenAI(prompt);
      })
    : await generateWithOpenAI(prompt);

  const live = buildMockAskResponse(
    question,
    citations,
    "live",
    `Law.go와 ${response.providerLabel} 응답을 결합한 라이브 모드입니다.`
  );
  return {
    ...live,
    answer: response.answer,
    status: {
      ...live.status,
      lawgo: "live" as const,
      ai: "live" as const,
      policyNote: response.policyNote
    }
  };
}
