import { resolvePositiveIntEnv } from "@/lib/ai-deliverables-policy";
import { createLogger } from "@/lib/logger";

const log = createLogger("photo-vision");

export type ImprovementVisionAnalysis = {
  status: "analyzed" | "unconfigured" | "failed";
  provider: "openai";
  model: string;
  summary: string;
  detectedHazards: string[];
  observedImprovement: string;
  ocrText: string;
  reflectedDocuments: string[];
  errorMessage?: string;
};

type ResponsesApiContent = {
  type: string;
  text?: string;
  image_url?: string;
};

type ResponsesApiResponse = {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
};

const DEFAULT_MODEL = "gpt-4.1-mini";
const VISION_TIMEOUT_MS = resolvePositiveIntEnv(process.env.OPENAI_VISION_TIMEOUT_MS, 20_000);

function configuredApiKey() {
  return process.env.OPENAI_API_KEY?.trim() || "";
}

function configuredModel() {
  return process.env.OPENAI_VISION_MODEL?.trim() || process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function extractResponseText(value: unknown) {
  if (!isRecord(value)) return "";
  if (typeof value.output_text === "string") return value.output_text;
  const response = value as ResponsesApiResponse;
  return (response.output || [])
    .flatMap((item) => item.content || [])
    .map((content) => content.text || "")
    .join("")
    .trim();
}

export function parseImprovementVisionOutput(value: string, fallback: {
  model: string;
  provider?: "openai";
}): ImprovementVisionAnalysis {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!isRecord(parsed)) throw new Error("Vision output is not an object");
    return {
      status: "analyzed",
      provider: fallback.provider || "openai",
      model: fallback.model,
      summary: readText(parsed.summary),
      detectedHazards: normalizeStringArray(parsed.detectedHazards),
      observedImprovement: readText(parsed.observedImprovement),
      ocrText: readText(parsed.ocrText),
      reflectedDocuments: normalizeStringArray(parsed.reflectedDocuments)
    };
  } catch (error) {
    return {
      status: "failed",
      provider: fallback.provider || "openai",
      model: fallback.model,
      summary: "",
      detectedHazards: [],
      observedImprovement: "",
      ocrText: "",
      reflectedDocuments: [],
      errorMessage: error instanceof Error ? error.message : "Vision output parse failed"
    };
  }
}

export function buildImprovementVisionPrompt(input: {
  taskLabel: string;
  hazardLabel: string;
  reflectedDocuments: string[];
}) {
  return [
    "당신은 현장 안전 개선 Before/After 사진 검토 보조자입니다.",
    "사진에서 보이는 위험요인, 개선 후 달라진 점, 표지판/문구 OCR을 확인합니다.",
    "단정적 법적 판단이나 안전 보장 표현은 금지합니다.",
    "응답은 JSON 객체만 반환합니다.",
    `작업: ${input.taskLabel}`,
    `핵심 위험: ${input.hazardLabel}`,
    `반영 후보 문서: ${input.reflectedDocuments.join(", ")}`,
    "필드: summary, detectedHazards, observedImprovement, ocrText, reflectedDocuments"
  ].join("\n");
}

async function fileToDataUrl(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  const contentType = file.type || "application/octet-stream";
  return `data:${contentType};base64,${buffer.toString("base64")}`;
}

async function postOpenAiVision(input: {
  apiKey: string;
  model: string;
  prompt: string;
  beforePhoto: File;
  afterPhoto: File;
}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), VISION_TIMEOUT_MS);
  try {
    const beforeUrl = await fileToDataUrl(input.beforePhoto);
    const afterUrl = await fileToDataUrl(input.afterPhoto);
    const content: ResponsesApiContent[] = [
      { type: "input_text", text: input.prompt },
      { type: "input_image", image_url: beforeUrl },
      { type: "input_image", image_url: afterUrl }
    ];

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: input.model,
        input: [{ role: "user", content }],
        temperature: 0.1
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`OpenAI vision failed: ${response.status} ${body}`);
    }

    const data = await response.json() as unknown;
    return extractResponseText(data);
  } finally {
    clearTimeout(timeout);
  }
}

export async function analyzeImprovementPhotos(input: {
  taskLabel: string;
  hazardLabel: string;
  reflectedDocuments: string[];
  beforePhoto: File | null;
  afterPhoto: File | null;
}): Promise<ImprovementVisionAnalysis> {
  const model = configuredModel();
  const apiKey = configuredApiKey();
  if (!input.beforePhoto || !input.afterPhoto) {
    return {
      status: "unconfigured",
      provider: "openai",
      model,
      summary: "",
      detectedHazards: [],
      observedImprovement: "",
      ocrText: "",
      reflectedDocuments: input.reflectedDocuments,
      errorMessage: "Before/After 사진이 모두 있어야 vision 분석을 실행합니다."
    };
  }

  if (!apiKey) {
    return {
      status: "unconfigured",
      provider: "openai",
      model,
      summary: "",
      detectedHazards: [],
      observedImprovement: "",
      ocrText: "",
      reflectedDocuments: input.reflectedDocuments,
      errorMessage: "OPENAI_API_KEY가 없어 vision/OCR 분석을 건너뜁니다."
    };
  }

  try {
    const prompt = buildImprovementVisionPrompt(input);
    const text = await postOpenAiVision({
      apiKey,
      model,
      prompt,
      beforePhoto: input.beforePhoto,
      afterPhoto: input.afterPhoto
    });
    const parsed = parseImprovementVisionOutput(text, { model });
    if (parsed.status === "failed") log.warn("Vision output parse failed", parsed.errorMessage);
    return parsed;
  } catch (error) {
    log.error("Vision analysis failed", error);
    return {
      status: "failed",
      provider: "openai",
      model,
      summary: "",
      detectedHazards: [],
      observedImprovement: "",
      ocrText: "",
      reflectedDocuments: input.reflectedDocuments,
      errorMessage: error instanceof Error ? error.message : "Vision analysis failed"
    };
  }
}
