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

export type ImprovementAnalysisMode = "vision_ocr" | "photo_pair_unanalyzed" | "manual_text";

export type ImprovementAnalysisPayload = {
  status: ImprovementVisionAnalysis["status"];
  provider: ImprovementVisionAnalysis["provider"];
  model: string;
  candidateText: string;
  summary: string;
  detectedHazards: string[];
  observedImprovement: string;
  ocrText: string;
  reflectedDocuments: string[];
  errorMessage: string | null;
  photoPairAttached: boolean;
  analysisMode: ImprovementAnalysisMode;
  userLabel: string;
  exportable: boolean;
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
export const MAX_HAZARD_PHOTO_FILES = 10;

export type HazardPhotoSeverity = "high" | "medium" | "low" | "review";

export type HazardPhotoVisionCandidate = {
  label: string;
  detail: string;
  severity: HazardPhotoSeverity;
  evidence: string;
  reflectedDocuments: string[];
  sourcePhotoNames: string[];
};

export type HazardPhotoVisionAnalysis = {
  status: "analyzed" | "unconfigured" | "failed";
  provider: "openai";
  model: string;
  summary: string;
  candidates: HazardPhotoVisionCandidate[];
  ocrText: string;
  siteSignals: string[];
  photoCount: number;
  errorMessage?: string;
};

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

function normalizeSeverity(value: unknown): HazardPhotoSeverity {
  if (value === "high" || value === "medium" || value === "low" || value === "review") return value;
  return "review";
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

function normalizeJsonPayload(value: string) {
  const trimmed = value.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced?.[1]) return fenced[1].trim();
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1).trim();
  }
  return trimmed;
}

export function parseImprovementVisionOutput(value: string, fallback: {
  model: string;
  provider?: "openai";
}): ImprovementVisionAnalysis {
  try {
    const parsed = JSON.parse(normalizeJsonPayload(value)) as unknown;
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

export function parseHazardPhotoVisionOutput(value: string, fallback: {
  model: string;
  provider?: "openai";
  photoNames: string[];
}): HazardPhotoVisionAnalysis {
  try {
    const parsed = JSON.parse(normalizeJsonPayload(value)) as unknown;
    if (!isRecord(parsed)) throw new Error("Hazard photo vision output is not an object");
    const rawCandidates = Array.isArray(parsed.candidates) ? parsed.candidates : [];
    const candidates = rawCandidates.flatMap((item): HazardPhotoVisionCandidate[] => {
      if (!isRecord(item)) return [];
      const label = readText(item.label);
      const detail = readText(item.detail);
      if (!label || !detail) return [];
      const sourcePhotoNames = normalizeStringArray(item.sourcePhotoNames);
      return [{
        label,
        detail,
        severity: normalizeSeverity(item.severity),
        evidence: readText(item.evidence),
        reflectedDocuments: normalizeStringArray(item.reflectedDocuments),
        sourcePhotoNames: sourcePhotoNames.length ? sourcePhotoNames : fallback.photoNames
      }];
    });
    return {
      status: "analyzed",
      provider: fallback.provider || "openai",
      model: fallback.model,
      summary: readText(parsed.summary),
      candidates,
      ocrText: readText(parsed.ocrText),
      siteSignals: normalizeStringArray(parsed.siteSignals),
      photoCount: fallback.photoNames.length
    };
  } catch (error) {
    return {
      status: "failed",
      provider: fallback.provider || "openai",
      model: fallback.model,
      summary: "",
      candidates: [],
      ocrText: "",
      siteSignals: [],
      photoCount: fallback.photoNames.length,
      errorMessage: error instanceof Error ? error.message : "Hazard photo vision output parse failed"
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

export function buildHazardPhotoVisionPrompt(input: {
  question: string;
  photoNames: string[];
}) {
  return [
    "당신은 건설·시설관리 현장 사진 위험요인 검토 보조자입니다.",
    "업로드된 현장 사진들을 서로 비교해 위험성평가와 TBM에 반영할 후보를 도출합니다.",
    "사진에서 보이는 것과 OCR 가능한 문구만 근거로 삼고, 확정 판단·법적 판단·안전 보장 표현은 금지합니다.",
    "응답은 JSON 객체만 반환합니다.",
    `현장 입력: ${input.question}`,
    `사진 파일명(${input.photoNames.length}장): ${input.photoNames.join(", ")}`,
    "후보는 최대 8개로 제한합니다.",
    "severity는 high, medium, low, review 중 하나만 사용합니다.",
    "reflectedDocuments에는 위험성평가표, TBM 브리핑, TBM 기록, 사진/증빙 중 관련 문서만 넣습니다.",
    "필드: summary, candidates[{label, detail, severity, evidence, reflectedDocuments, sourcePhotoNames}], ocrText, siteSignals"
  ].join("\n");
}

function resolveAnalysisMode(input: {
  visionStatus: ImprovementVisionAnalysis["status"];
  hasBeforePhoto: boolean;
  hasAfterPhoto: boolean;
}): ImprovementAnalysisMode {
  const photoPairAttached = input.hasBeforePhoto && input.hasAfterPhoto;
  if (photoPairAttached && input.visionStatus === "analyzed") return "vision_ocr";
  if (photoPairAttached) return "photo_pair_unanalyzed";
  return "manual_text";
}

function analysisUserLabel(mode: ImprovementAnalysisMode, status: ImprovementVisionAnalysis["status"]) {
  if (mode === "vision_ocr") return "vision/OCR 분석 완료";
  if (mode === "manual_text") return "수기 개선사항";
  if (status === "failed") return "사진쌍 저장 · vision/OCR 실패";
  return "사진쌍 저장 · vision/OCR 보류";
}

export function buildImprovementAnalysisPayload(input: {
  vision: ImprovementVisionAnalysis;
  candidateText: string;
  reflectedDocuments: string[];
  hasBeforePhoto: boolean;
  hasAfterPhoto: boolean;
}): ImprovementAnalysisPayload {
  const photoPairAttached = input.hasBeforePhoto && input.hasAfterPhoto;
  const analysisMode = resolveAnalysisMode({
    visionStatus: input.vision.status,
    hasBeforePhoto: input.hasBeforePhoto,
    hasAfterPhoto: input.hasAfterPhoto
  });

  return {
    status: input.vision.status,
    provider: input.vision.provider,
    model: input.vision.model,
    candidateText: input.candidateText,
    summary: input.vision.summary,
    detectedHazards: input.vision.detectedHazards,
    observedImprovement: input.vision.observedImprovement,
    ocrText: input.vision.ocrText,
    reflectedDocuments: input.reflectedDocuments,
    errorMessage: input.vision.errorMessage || null,
    photoPairAttached,
    analysisMode,
    userLabel: analysisUserLabel(analysisMode, input.vision.status),
    exportable: true
  };
}

async function fileToDataUrl(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  const contentType = file.type || "application/octet-stream";
  return `data:${contentType};base64,${buffer.toString("base64")}`;
}

async function postOpenAiVisionImages(input: {
  apiKey: string;
  model: string;
  prompt: string;
  photos: File[];
}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), VISION_TIMEOUT_MS);
  try {
    const imageUrls = await Promise.all(input.photos.map((photo) => fileToDataUrl(photo)));
    const content: ResponsesApiContent[] = [
      { type: "input_text", text: input.prompt },
      ...imageUrls.map((imageUrl) => ({ type: "input_image", image_url: imageUrl }))
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

async function postOpenAiVision(input: {
  apiKey: string;
  model: string;
  prompt: string;
  beforePhoto: File;
  afterPhoto: File;
}) {
  return postOpenAiVisionImages({
    apiKey: input.apiKey,
    model: input.model,
    prompt: input.prompt,
    photos: [input.beforePhoto, input.afterPhoto]
  });
}

export async function analyzeHazardPhotos(input: {
  question: string;
  photos: File[];
}): Promise<HazardPhotoVisionAnalysis> {
  const model = configuredModel();
  const apiKey = configuredApiKey();
  const photos = input.photos.slice(0, MAX_HAZARD_PHOTO_FILES);
  const photoNames = photos.map((photo) => photo.name);

  if (!photos.length) {
    return {
      status: "unconfigured",
      provider: "openai",
      model,
      summary: "",
      candidates: [],
      ocrText: "",
      siteSignals: [],
      photoCount: 0,
      errorMessage: "현장 사진을 1장 이상 첨부해야 vision 위험요인 분석을 실행합니다."
    };
  }

  if (!apiKey) {
    return {
      status: "unconfigured",
      provider: "openai",
      model,
      summary: "",
      candidates: [],
      ocrText: "",
      siteSignals: [],
      photoCount: photos.length,
      errorMessage: "OPENAI_API_KEY가 없어 현장 사진 vision 분석을 건너뜁니다."
    };
  }

  try {
    const prompt = buildHazardPhotoVisionPrompt({ question: input.question, photoNames });
    const text = await postOpenAiVisionImages({
      apiKey,
      model,
      prompt,
      photos
    });
    const parsed = parseHazardPhotoVisionOutput(text, { model, photoNames });
    if (parsed.status === "failed") log.warn("Hazard photo vision output parse failed", parsed.errorMessage);
    return parsed;
  } catch (error) {
    log.error("Hazard photo vision analysis failed", error);
    return {
      status: "failed",
      provider: "openai",
      model,
      summary: "",
      candidates: [],
      ocrText: "",
      siteSignals: [],
      photoCount: photos.length,
      errorMessage: error instanceof Error ? error.message : "Hazard photo vision analysis failed"
    };
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
