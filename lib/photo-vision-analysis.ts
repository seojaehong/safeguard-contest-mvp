import { resolvePositiveIntEnv } from "@/lib/ai-deliverables-policy";
import { buildDbHarnessPacket } from "@/lib/db-harness";
import { createLogger } from "@/lib/logger";
import { MAX_INPUT_HAZARD_PHOTO_FILES } from "@/lib/operation-improvements";
import {
  deriveSafetyReferenceOperationalView,
  getSafetyReferenceDisplaySummary,
  getSafetyReferenceDisplayTitle,
  searchSafetyReferences,
  type SafetyReferenceItem
} from "@/lib/safety-reference-catalog";

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
  sourcePhotoNames: string[];
  photoCount: number;
  siteSignals: string[];
  visionEvidence: string;
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
export const MAX_HAZARD_PHOTO_FILES = MAX_INPUT_HAZARD_PHOTO_FILES;
export const MAX_HAZARD_PHOTO_BYTES = 20 * 1024 * 1024;
export const HAZARD_PHOTO_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export type HazardPhotoSeverity = "high" | "medium" | "low" | "review";

export type HazardPhotoObservation = {
  kind: "visual" | "ocr";
  text: string;
};

export type HazardPhotoVisionProvider = {
  name: string;
  model: string;
  mode: "live" | "mock";
  analyze: (input: {
    question: string;
    prompt: string;
    photo: File;
    photoIndex: number;
  }) => Promise<string>;
};

export type HazardPhotoHarnessEvidence = {
  sourceId: string;
  sourceType: "safeclaw-db" | "mcp";
  title: string;
  excerpt: string;
};

export type HazardPhotoHarnessAction = {
  text: string;
  evidenceSourceIds: string[];
};

export type HazardPhotoVisionCandidate = {
  id: string;
  label: string;
  detail: string;
  severity: HazardPhotoSeverity;
  evidence: string;
  reflectedDocuments: string[];
  sourcePhotoNames: string[];
  observation: string;
  inference: string;
  modelRole: "hazard_candidate";
  harness: {
    authority: "safeclaw-db-mcp";
    status: "pending" | "confirmed" | "insufficient";
    evidence: HazardPhotoHarnessEvidence[];
    actions: HazardPhotoHarnessAction[];
    confirmedAt: string | null;
    errorMessage: string | null;
  };
  userDecision: {
    status: "pending" | "accepted" | "rejected";
    allowed: ["accepted", "rejected"];
    requiresHarnessConfirmation: true;
    reason: string | null;
    decidedAt: string | null;
  };
};

type ParsedHazardPhotoVisionOutput = {
  status: "analyzed" | "failed";
  provider: string;
  model: string;
  summary: string;
  observations: HazardPhotoObservation[];
  candidates: HazardPhotoVisionCandidate[];
  ocrText: string;
  siteSignals: string[];
  photoCount: number;
  errorMessage?: string;
};

export type HazardPhotoAnalysisErrorCode =
  | "empty_file"
  | "unsupported_mime"
  | "file_too_large"
  | "provider_unconfigured"
  | "provider_error"
  | "invalid_model_output";

export type HazardPhotoAnalysisError = {
  code: HazardPhotoAnalysisErrorCode;
  message: string;
  retryable: boolean;
};

export type HazardPhotoImageAnalysis = {
  id: string;
  index: number;
  name: string;
  mimeType: string;
  sizeBytes: number;
  status: "analyzed" | "rejected" | "failed" | "unconfigured";
  provider: string;
  providerMode: "live" | "mock" | "unconfigured";
  model: string;
  summary: string;
  observations: HazardPhotoObservation[];
  candidates: HazardPhotoVisionCandidate[];
  ocrText: string;
  siteSignals: string[];
  error: HazardPhotoAnalysisError | null;
};

export type HazardPhotoHarnessResolution = {
  candidateId: string;
  status: "confirmed" | "insufficient";
  evidence: HazardPhotoHarnessEvidence[];
  actions: HazardPhotoHarnessAction[];
  confirmedAt: string | null;
  errorMessage: string | null;
};

export type HazardPhotoHarnessResolver = {
  name: string;
  resolve: (input: {
    question: string;
    candidates: HazardPhotoVisionCandidate[];
    images: HazardPhotoImageAnalysis[];
  }) => Promise<HazardPhotoHarnessResolution[]>;
};

export type HazardPhotoVisionAnalysis = {
  status: "analyzed" | "partial" | "unconfigured" | "failed";
  provider: string;
  providerMode: "live" | "mock" | "unconfigured";
  model: string;
  summary: string;
  observations: HazardPhotoObservation[];
  candidates: HazardPhotoVisionCandidate[];
  ocrText: string;
  siteSignals: string[];
  photoCount: number;
  images: HazardPhotoImageAnalysis[];
  counts: {
    submitted: number;
    analyzed: number;
    rejected: number;
    failed: number;
    unconfigured: number;
    candidates: number;
    harnessConfirmed: number;
    harnessInsufficient: number;
  };
  harness: {
    modelRole: "candidate_only";
    authority: "safeclaw-db-mcp";
    status: "pending" | "confirmed" | "insufficient";
    confirms: ["evidence", "actions"];
    confirmedAt: string | null;
    errorMessage: string | null;
  };
  errorMessage?: string;
};

export type PhotoVisionReadiness = {
  ok: boolean;
  status: "ready" | "unconfigured";
  provider: "openai";
  model: string;
  apiKeyPresent: boolean;
  timeoutMs: number;
  maxInputPhotos: number;
  maxBytesPerPhoto: number;
  allowedMimeTypes: string[];
  hazardAnalysisEndpoint: "/api/input-photos/hazard-analysis";
  hazardAnalysisMethod: "POST multipart/form-data";
  improvementEndpointPattern: "/api/workpacks/[id]/improvements";
  acceptedOnly: true;
  beforeAfterSupported: true;
  ocrSupported: true;
  exportTargets: string[];
  flow: Array<{
    step: string;
    label: string;
    detail: string;
  }>;
  message: string;
};

function configuredApiKey(env: Record<string, string | undefined> = process.env) {
  return env.OPENAI_API_KEY?.trim() || "";
}

function configuredModel(env: Record<string, string | undefined> = process.env) {
  return env.OPENAI_VISION_MODEL?.trim() || env.OPENAI_MODEL?.trim() || DEFAULT_MODEL;
}

export function getPhotoVisionReadiness(
  env: Record<string, string | undefined> = process.env
): PhotoVisionReadiness {
  const apiKeyPresent = Boolean(configuredApiKey(env));
  const model = configuredModel(env);
  return {
    ok: apiKeyPresent,
    status: apiKeyPresent ? "ready" : "unconfigured",
    provider: "openai",
    model,
    apiKeyPresent,
    timeoutMs: VISION_TIMEOUT_MS,
    maxInputPhotos: MAX_HAZARD_PHOTO_FILES,
    maxBytesPerPhoto: MAX_HAZARD_PHOTO_BYTES,
    allowedMimeTypes: [...HAZARD_PHOTO_MIME_TYPES],
    hazardAnalysisEndpoint: "/api/input-photos/hazard-analysis",
    hazardAnalysisMethod: "POST multipart/form-data",
    improvementEndpointPattern: "/api/workpacks/[id]/improvements",
    acceptedOnly: true,
    beforeAfterSupported: true,
    ocrSupported: true,
    exportTargets: ["위험성평가표", "TBM 브리핑", "TBM 기록", "사진/증빙", "작업 이력 MD", "하네스 JSONL"],
    flow: [
      {
        step: "attach",
        label: "현장 사진 첨부",
        detail: `입력 화면의 + 첨부에서 최대 ${MAX_HAZARD_PHOTO_FILES}장까지 받습니다.`
      },
      {
        step: "analyze",
        label: "Vision/OCR 후보 도출",
        detail: "OpenAI Responses API가 observation과 inference를 분리한 위험 후보만 구조화합니다."
      },
      {
        step: "ground",
        label: "DB/MCP 근거 확정",
        detail: "SafeClaw DB/MCP 하네스가 후보별 근거 source ID와 현장 통제를 확정하거나 근거 부족으로 잠급니다."
      },
      {
        step: "review",
        label: "사용자 채택·기각",
        detail: "하네스가 확정한 후보를 사용자가 채택하거나 기각하고, 채택한 항목만 개선 메모리에 들어갑니다."
      },
      {
        step: "export",
        label: "운영 메모리 보존",
        detail: "채택된 후보와 Before/After 개선사항은 MD/JSONL export와 다음 DB 하네스 입력에 보존됩니다."
      }
    ],
    message: apiKeyPresent
      ? "Vision/OCR 사진 분석 실행 환경이 준비되어 있습니다."
      : "OPENAI_API_KEY가 없어 사진은 첨부/저장되지만 Vision/OCR 분석은 보류됩니다."
  };
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

function normalizeObservations(value: unknown): HazardPhotoObservation[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): HazardPhotoObservation[] => {
    if (!isRecord(item)) return [];
    const text = readText(item.text);
    if (!text) return [];
    return [{
      kind: item.kind === "ocr" ? "ocr" : "visual",
      text
    }];
  });
}

function pendingHarnessReview(): Pick<HazardPhotoVisionCandidate, "harness" | "userDecision"> {
  return {
    harness: {
      authority: "safeclaw-db-mcp",
      status: "pending",
      evidence: [],
      actions: [],
      confirmedAt: null,
      errorMessage: null
    },
    userDecision: {
      status: "pending",
      allowed: ["accepted", "rejected"],
      requiresHarnessConfirmation: true,
      reason: null,
      decidedAt: null
    }
  };
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
  provider?: string;
  photoNames: string[];
}): ParsedHazardPhotoVisionOutput {
  try {
    const parsed = JSON.parse(normalizeJsonPayload(value)) as unknown;
    if (!isRecord(parsed)) throw new Error("Hazard photo vision output is not an object");
    const rawCandidates = Array.isArray(parsed.candidates) ? parsed.candidates : [];
    const candidates = rawCandidates.flatMap((item, index): HazardPhotoVisionCandidate[] => {
      if (!isRecord(item)) return [];
      const label = readText(item.label);
      const observation = readText(item.observation);
      const inference = readText(item.inference);
      if (!label || !observation || !inference) return [];
      return [{
        id: `candidate-${index + 1}`,
        label,
        detail: inference,
        severity: "review",
        evidence: "",
        reflectedDocuments: [],
        sourcePhotoNames: fallback.photoNames,
        observation,
        inference,
        modelRole: "hazard_candidate",
        ...pendingHarnessReview()
      }];
    });
    return {
      status: "analyzed",
      provider: fallback.provider || "openai",
      model: fallback.model,
      summary: readText(parsed.summary),
      observations: normalizeObservations(parsed.observations),
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
      observations: [],
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
    "각 호출은 사진 1장을 사진별로 독립 분석하며, 다른 사진의 성공이나 실패를 전제로 삼지 않습니다.",
    "observation에는 사진에서 직접 보이는 사실 또는 OCR 문구만 적습니다.",
    "inference에는 observation에서 추론한 위험 가능성만 적고 현장 확인 필요를 명시합니다.",
    "모델은 위험 후보만 제시합니다. 근거 확정과 조치 확정은 SafeClaw DB/MCP 하네스의 책임입니다.",
    "법적 판단, 안전 보장, 확정 위험도, 근거 ID, 법령 인용, 개선 조치, 사용자 채택 여부를 출력하지 않습니다.",
    "응답은 JSON 객체만 반환합니다.",
    `현장 입력: ${input.question}`,
    `사진 파일명(${input.photoNames.length}장): ${input.photoNames.join(", ")}`,
    "후보는 최대 4개로 제한합니다.",
    "필드: summary, observations[{kind: visual|ocr, text}], candidates[{label, observation, inference}], ocrText, siteSignals"
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
  sourcePhotoNames?: string[];
  siteSignals?: string[];
}): ImprovementAnalysisPayload {
  const photoPairAttached = input.hasBeforePhoto && input.hasAfterPhoto;
  const sourcePhotoNames = (input.sourcePhotoNames || []).map((name) => name.trim()).filter(Boolean).slice(0, 10);
  const inferredPhotoCount = [input.hasBeforePhoto, input.hasAfterPhoto].filter(Boolean).length;
  const photoCount = sourcePhotoNames.length || inferredPhotoCount;
  const siteSignals = (input.siteSignals || []).map((signal) => signal.trim()).filter(Boolean).slice(0, 12);
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
    sourcePhotoNames,
    photoCount,
    siteSignals,
    visionEvidence: input.vision.summary || input.vision.observedImprovement,
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

export function createOpenAiHazardPhotoVisionProvider(
  env: Record<string, string | undefined> = process.env
): HazardPhotoVisionProvider | null {
  const apiKey = configuredApiKey(env);
  if (!apiKey) return null;
  const model = configuredModel(env);
  return {
    name: "openai",
    model,
    mode: "live",
    analyze: async ({ prompt, photo }) => postOpenAiVisionImages({
      apiKey,
      model,
      prompt,
      photos: [photo]
    })
  };
}

function uniqueSafetyReferences(items: SafetyReferenceItem[]): SafetyReferenceItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function resolveCandidateFromReferences(input: {
  question: string;
  candidate: HazardPhotoVisionCandidate;
  references: SafetyReferenceItem[];
}): HazardPhotoHarnessResolution {
  const candidateQuestion = [
    input.question,
    input.candidate.label,
    input.candidate.observation,
    input.candidate.inference
  ].join(" ");
  const packet = buildDbHarnessPacket({
    question: candidateQuestion,
    references: input.references
  });
  const matchedReferences = uniqueSafetyReferences([
    ...packet.directEvidence,
    ...packet.sifCases,
    ...packet.supportingEvidence
  ]).slice(0, 6);
  const evidence = matchedReferences.map((item): HazardPhotoHarnessEvidence => ({
    sourceId: item.id,
    sourceType: "safeclaw-db",
    title: getSafetyReferenceDisplayTitle(item),
    excerpt: getSafetyReferenceDisplaySummary(item).slice(0, 500)
  }));
  const actionsByText = new Map<string, HazardPhotoHarnessAction>();
  let hasConfirmedControl = false;

  matchedReferences.forEach((item) => {
    const operational = deriveSafetyReferenceOperationalView(item);
    if (!operational.reviewRequired && operational.controls.length) hasConfirmedControl = true;
    operational.controls.slice(0, 2).forEach((control) => {
      const text = control.trim();
      if (!text) return;
      const existing = actionsByText.get(text);
      if (existing) {
        if (!existing.evidenceSourceIds.includes(item.id)) existing.evidenceSourceIds.push(item.id);
        return;
      }
      actionsByText.set(text, { text, evidenceSourceIds: [item.id] });
    });
  });

  const actions = [...actionsByText.values()].slice(0, 6);
  const confirmed = packet.directEvidence.length > 0 && evidence.length > 0 && actions.length > 0 && hasConfirmedControl;
  return {
    candidateId: input.candidate.id,
    status: confirmed ? "confirmed" : "insufficient",
    evidence,
    actions,
    confirmedAt: confirmed ? new Date().toISOString() : null,
    errorMessage: confirmed ? null : "DB/MCP 하네스가 직접 근거와 통제를 확정하지 못했습니다."
  };
}

export function createSafeClawDbMcpHazardResolver(): HazardPhotoHarnessResolver {
  return {
    name: "safeclaw-db-mcp",
    resolve: async ({ question, candidates }) => {
      const query = [
        question,
        ...candidates.flatMap((candidate) => [candidate.label, candidate.observation, candidate.inference])
      ].join(" ").slice(0, 4_000);
      const [direct, sif, supporting] = await Promise.all([
        searchSafetyReferences({ query, limit: 6, evidenceRole: "direct" }),
        searchSafetyReferences({ query, limit: 6, itemType: "sif-case" }),
        searchSafetyReferences({ query, limit: 6, evidenceRole: "supporting" })
      ]);
      const references = uniqueSafetyReferences([
        ...direct.items,
        ...sif.items,
        ...supporting.items
      ]);
      return candidates.map((candidate) => resolveCandidateFromReferences({
        question,
        candidate,
        references
      }));
    }
  };
}

function validateHazardPhoto(photo: File): HazardPhotoAnalysisError | null {
  if (photo.size <= 0) {
    return {
      code: "empty_file",
      message: `${photo.name || "이름 없는 사진"} 파일이 비어 있습니다.`,
      retryable: false
    };
  }

  const mimeType = photo.type.trim().toLowerCase();
  if (!HAZARD_PHOTO_MIME_TYPES.some((allowed) => allowed === mimeType)) {
    return {
      code: "unsupported_mime",
      message: `${photo.name || "이름 없는 사진"}의 MIME 형식(${mimeType || "없음"})은 지원하지 않습니다.`,
      retryable: false
    };
  }

  if (photo.size > MAX_HAZARD_PHOTO_BYTES) {
    return {
      code: "file_too_large",
      message: `${photo.name || "이름 없는 사진"}은 사진별 최대 용량 20MB를 초과합니다.`,
      retryable: false
    };
  }

  return null;
}

function harnessContract(input: {
  status?: HazardPhotoVisionAnalysis["harness"]["status"];
  confirmedAt?: string | null;
  errorMessage?: string | null;
} = {}): HazardPhotoVisionAnalysis["harness"] {
  return {
    modelRole: "candidate_only",
    authority: "safeclaw-db-mcp",
    status: input.status || "pending",
    confirms: ["evidence", "actions"],
    confirmedAt: input.confirmedAt || null,
    errorMessage: input.errorMessage || null
  };
}

function emptyCounts(submitted: number): HazardPhotoVisionAnalysis["counts"] {
  return {
    submitted,
    analyzed: 0,
    rejected: 0,
    failed: 0,
    unconfigured: 0,
    candidates: 0,
    harnessConfirmed: 0,
    harnessInsufficient: 0
  };
}

export async function analyzeHazardPhotos(input: {
  question: string;
  photos: File[];
}, options: {
  provider?: HazardPhotoVisionProvider | null;
  harness?: HazardPhotoHarnessResolver | null;
  env?: Record<string, string | undefined>;
} = {}): Promise<HazardPhotoVisionAnalysis> {
  const env = options.env || process.env;
  const hasInjectedProvider = Object.prototype.hasOwnProperty.call(options, "provider");
  const provider = hasInjectedProvider
    ? options.provider || null
    : createOpenAiHazardPhotoVisionProvider(env);
  const hasInjectedHarness = Object.prototype.hasOwnProperty.call(options, "harness");
  const harnessResolver = hasInjectedHarness
    ? options.harness || null
    : createSafeClawDbMcpHazardResolver();
  const providerName = provider?.name || "openai";
  const providerMode = provider?.mode || "unconfigured";
  const model = provider?.model || configuredModel(env);
  const submitted = input.photos.length;

  if (!submitted) {
    return {
      status: "failed",
      provider: providerName,
      providerMode,
      model,
      summary: "",
      observations: [],
      candidates: [],
      ocrText: "",
      siteSignals: [],
      photoCount: 0,
      images: [],
      counts: emptyCounts(0),
      harness: harnessContract(),
      errorMessage: "현장 사진을 1장 이상 첨부해야 vision 위험요인 분석을 실행합니다."
    };
  }

  if (submitted > MAX_HAZARD_PHOTO_FILES) {
    return {
      status: "failed",
      provider: providerName,
      providerMode,
      model,
      summary: "",
      observations: [],
      candidates: [],
      ocrText: "",
      siteSignals: [],
      photoCount: submitted,
      images: [],
      counts: {
        ...emptyCounts(submitted),
        rejected: submitted
      },
      harness: harnessContract(),
      errorMessage: `현장 사진은 최대 ${MAX_HAZARD_PHOTO_FILES}장까지 분석할 수 있습니다.`
    };
  }

  const rawImages = await Promise.all(input.photos.map(async (photo, index): Promise<HazardPhotoImageAnalysis> => {
    const base = {
      id: `photo-${index + 1}`,
      index,
      name: photo.name,
      mimeType: photo.type.trim().toLowerCase(),
      sizeBytes: photo.size,
      provider: providerName,
      providerMode,
      model,
      summary: "",
      observations: [],
      candidates: [],
      ocrText: "",
      siteSignals: []
    } satisfies Omit<HazardPhotoImageAnalysis, "status" | "error">;
    const validationError = validateHazardPhoto(photo);
    if (validationError) {
      return {
        ...base,
        status: "rejected",
        error: validationError
      };
    }

    if (!provider) {
      return {
        ...base,
        status: "unconfigured",
        error: {
          code: "provider_unconfigured",
          message: "OPENAI_API_KEY가 없어 현장 사진 vision 분석을 건너뜁니다.",
          retryable: true
        }
      };
    }

    const prompt = buildHazardPhotoVisionPrompt({
      question: input.question,
      photoNames: [photo.name]
    });

    try {
      const text = await provider.analyze({
        question: input.question,
        prompt,
        photo,
        photoIndex: index
      });
      const parsed = parseHazardPhotoVisionOutput(text, {
        model: provider.model,
        provider: provider.name,
        photoNames: [photo.name]
      });
      if (parsed.status === "failed") {
        log.warn(`Hazard photo vision output parse failed: ${photo.name}`, parsed.errorMessage);
        return {
          ...base,
          status: "failed",
          error: {
            code: "invalid_model_output",
            message: parsed.errorMessage || "Hazard photo vision output parse failed",
            retryable: false
          }
        };
      }

      const candidates = parsed.candidates.map((candidate, candidateIndex) => ({
        ...candidate,
        id: `photo-${index + 1}-candidate-${candidateIndex + 1}`,
        sourcePhotoNames: [photo.name]
      }));
      return {
        ...base,
        status: "analyzed",
        summary: parsed.summary,
        observations: parsed.observations,
        candidates,
        ocrText: parsed.ocrText,
        siteSignals: parsed.siteSignals,
        error: null
      };
    } catch (error) {
      log.error(`Hazard photo vision analysis failed: ${photo.name}`, error);
      return {
        ...base,
        status: "failed",
        error: {
          code: "provider_error",
          message: error instanceof Error ? error.message : "Hazard photo vision analysis failed",
          retryable: true
        }
      };
    }
  }));

  const modelCandidates = rawImages.flatMap((image) => image.candidates);
  let resolvedCandidates = modelCandidates;
  if (modelCandidates.length && harnessResolver) {
    try {
      const resolutions = await harnessResolver.resolve({
        question: input.question,
        candidates: modelCandidates,
        images: rawImages
      });
      const resolutionByCandidate = new Map(resolutions.map((resolution) => [resolution.candidateId, resolution]));
      resolvedCandidates = modelCandidates.map((candidate) => {
        const resolution = resolutionByCandidate.get(candidate.id);
        if (!resolution) {
          return {
            ...candidate,
            harness: {
              ...candidate.harness,
              status: "insufficient" as const,
              errorMessage: "DB/MCP 하네스가 후보에 대한 확정 결과를 반환하지 않았습니다."
            }
          };
        }
        const confirmed = resolution.status === "confirmed" && resolution.evidence.length > 0 && resolution.actions.length > 0;
        return {
          ...candidate,
          harness: {
            authority: "safeclaw-db-mcp" as const,
            status: confirmed ? "confirmed" as const : "insufficient" as const,
            evidence: resolution.evidence,
            actions: resolution.actions,
            confirmedAt: confirmed ? resolution.confirmedAt : null,
            errorMessage: confirmed
              ? null
              : resolution.errorMessage || "DB/MCP 하네스가 직접 근거와 통제를 확정하지 못했습니다."
          }
        };
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "DB/MCP harness resolution failed";
      log.error(`Hazard photo DB/MCP harness failed: ${harnessResolver.name}`, error);
      resolvedCandidates = modelCandidates.map((candidate) => ({
        ...candidate,
        harness: {
          ...candidate.harness,
          status: "insufficient" as const,
          errorMessage: message
        }
      }));
    }
  }

  const candidateById = new Map(resolvedCandidates.map((candidate) => [candidate.id, candidate]));
  const images = rawImages.map((image) => ({
    ...image,
    candidates: image.candidates.map((candidate) => candidateById.get(candidate.id) || candidate)
  }));
  const candidates = images.flatMap((image) => image.candidates);
  const counts: HazardPhotoVisionAnalysis["counts"] = {
    submitted,
    analyzed: images.filter((image) => image.status === "analyzed").length,
    rejected: images.filter((image) => image.status === "rejected").length,
    failed: images.filter((image) => image.status === "failed").length,
    unconfigured: images.filter((image) => image.status === "unconfigured").length,
    candidates: candidates.length,
    harnessConfirmed: candidates.filter((candidate) => candidate.harness.status === "confirmed").length,
    harnessInsufficient: candidates.filter((candidate) => candidate.harness.status === "insufficient").length
  };
  const status: HazardPhotoVisionAnalysis["status"] = counts.analyzed === submitted
    ? "analyzed"
    : counts.analyzed > 0
      ? "partial"
      : counts.unconfigured > 0
        ? "unconfigured"
        : "failed";
  const summaries = images.map((image) => image.summary).filter(Boolean);
  const ocrTexts = images.map((image) => image.ocrText).filter(Boolean);
  const siteSignals = [...new Set(images.flatMap((image) => image.siteSignals))];
  const firstError = images.find((image) => image.error)?.error;
  const harnessStatus: HazardPhotoVisionAnalysis["harness"]["status"] = !candidates.length || !harnessResolver
    ? "pending"
    : counts.harnessInsufficient > 0
      ? "insufficient"
      : counts.harnessConfirmed === candidates.length
        ? "confirmed"
        : "pending";
  const harnessConfirmedAt = harnessStatus === "confirmed"
    ? candidates.find((candidate) => candidate.harness.confirmedAt)?.harness.confirmedAt || null
    : null;
  const harnessErrorMessage = candidates.find((candidate) => candidate.harness.errorMessage)?.harness.errorMessage || null;

  return {
    status,
    provider: providerName,
    providerMode,
    model,
    summary: summaries.join("\n"),
    observations: images.flatMap((image) => image.observations),
    candidates,
    ocrText: ocrTexts.join("\n"),
    siteSignals,
    photoCount: submitted,
    images,
    counts,
    harness: harnessContract({
      status: harnessStatus,
      confirmedAt: harnessConfirmedAt,
      errorMessage: harnessErrorMessage
    }),
    errorMessage: status === "analyzed" || status === "partial" ? undefined : firstError?.message
  };
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
